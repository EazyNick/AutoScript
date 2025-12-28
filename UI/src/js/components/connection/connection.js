/**
 * 노드 간 연결을 관리하는 메인 클래스
 *
 * 이 모듈은 워크플로우 편집기에서 노드 간 연결선을 관리하는 핵심 클래스입니다.
 * 모듈화된 구조로 설계되어 유지보수성과 확장성을 높였습니다.
 *
 * @module connection
 */

import { getLogger, createCurvedPath } from './connection-utils.js';
import { ConnectionSVGManager } from './connection-svg.js';
import { ConnectionEventHandler } from './connection-events.js';
import { ConnectionCoordinateCalculator } from './connection-coordinates.js';

/**
 * ConnectionManager 클래스
 *
 * 노드 간 연결선을 관리하고 그리는 역할을 담당하는 메인 클래스입니다.
 * 하위 모듈들을 조합하여 사용하며, 각 모듈의 책임을 명확히 분리했습니다.
 *
 * **모듈 구조:**
 * - `ConnectionSVGManager`: SVG 초기화 및 연결선 그리기
 * - `ConnectionEventHandler`: 이벤트 바인딩 및 처리
 * - `ConnectionCoordinateCalculator`: 커넥터 위치 계산
 * - `connection-utils`: 공통 유틸리티 함수
 *
 * **주요 기능:**
 * - 노드 간 연결 생성/삭제
 * - 연결선 실시간 업데이트 (노드 이동 시)
 * - 조건 노드의 True/False 분기 지원
 * - 드래그 중 임시 연결선 표시
 *
 * @class ConnectionManager
 */
export class ConnectionManager {
    /**
     * ConnectionManager 생성자
     *
     * @param {HTMLElement} workflowCanvas - 워크플로우 캔버스 DOM 요소
     */
    constructor(workflowCanvas) {
        this.canvas = workflowCanvas;
        this.connections = new Map(); // 연결 정보 저장
        this.connectionLines = new Map(); // SVG 라인 요소 저장
        this.isConnecting = false;
        this.isUpdating = false; // 업데이트 중복 방지 플래그
        this.startNode = null;
        this.startConnector = null;
        this.startConnectorType = null; // 연결 시작 커넥터 타입
        this.startOutputType = null; // 조건 노드의 출력 타입
        this.tempLine = null;
        this.tempConnection = null; // 롱터치용 임시 연결 라인

        // 하위 모듈 초기화
        this.svgManager = new ConnectionSVGManager(this);
        this.eventHandler = new ConnectionEventHandler(this);
        this.coordinateCalculator = new ConnectionCoordinateCalculator(this);

        // SVG 초기화 및 이벤트 바인딩
        this.svgManager.initSVG();
        this.eventHandler.bindEvents();
    }

    /**
     * SVG 컨테이너 접근자 (getter)
     *
     * 하위 모듈에서 SVG 컨테이너에 접근할 수 있도록 제공하는 getter입니다.
     *
     * @returns {SVGElement|null} SVG 컨테이너 요소 또는 null
     */
    get svgContainer() {
        return this.svgManager.svgContainer;
    }

    /**
     * 노드 커넥터 클릭 이벤트 바인딩
     *
     * 새로 생성된 노드의 커넥터에 클릭 이벤트를 바인딩합니다.
     * 이벤트 처리는 ConnectionEventHandler에 위임합니다.
     *
     * @param {HTMLElement} nodeElement - 노드 DOM 요소
     * @returns {void}
     */
    async bindNodeConnector(nodeElement) {
        await this.eventHandler.bindNodeConnector(nodeElement);
    }

    /**
     * 노드 매니저의 패닝 상태 확인
     *
     * 캔버스가 현재 패닝(드래그 이동) 중인지 확인합니다.
     * 패닝 중일 때는 연결 작업을 방지하여 의도치 않은 연결 생성을 막습니다.
     *
     * @returns {boolean} 패닝 중이면 true, 아니면 false
     */
    isPanning() {
        // 노드 매니저의 패닝 상태를 전역에서 확인
        return window.nodeManager && window.nodeManager.isPanning;
    }

    /**
     * 커넥터 클릭 처리
     *
     * 커넥터 클릭 시 연결 시작 또는 연결 완료를 처리합니다.
     * 조건 노드의 경우 True/False 출력 타입을 자동으로 감지합니다.
     *
     * **연결 흐름:**
     * 1. 연결 모드가 아닐 때: 연결 시작 (임시 연결선 표시)
     * 2. 연결 모드 중일 때: 연결 완료 또는 취소
     *
     * @param {HTMLElement} nodeElement - 클릭된 커넥터가 속한 노드 요소
     * @param {string} connectorType - 커넥터 타입 ('input' 또는 'output')
     * @param {HTMLElement} connectorElement - 클릭된 커넥터 요소
     * @returns {void}
     */
    handleConnectorClick(nodeElement, connectorType, connectorElement, outputType = null) {
        const logger = getLogger();
        const nodeId = nodeElement.dataset.nodeId;

        logger.log('[ConnectionManager] 커넥터 클릭:', {
            nodeId: nodeId,
            connectorType: connectorType,
            isConnecting: this.isConnecting,
            connectionsCount: this.connections.size
        });

        // 연결 모드가 아닐 때: 연결 시작
        if (!this.isConnecting) {
            // 출력 타입 감지 (조건 노드, 반복 노드의 경우)
            // detectedOutputType: 감지된 출력 타입 (true, false, bottom, 또는 null)
            let detectedOutputType = outputType || null;
            // connectorType이 'output'이고 출력 타입이 아직 감지되지 않았으면 감지 시도
            if (connectorType === 'output' && connectorElement && !detectedOutputType) {
                // 조건 노드의 true 출력인지 확인
                if (connectorElement.classList.contains('true-output') || connectorElement.closest('.true-output')) {
                    detectedOutputType = 'true';
                } else if (
                    // 조건 노드의 false 출력인지 확인
                    connectorElement.classList.contains('false-output') ||
                    connectorElement.closest('.false-output')
                ) {
                    detectedOutputType = 'false';
                } else if (
                    // 반복 노드의 아래 출력(bottom)인지 확인
                    connectorElement.classList.contains('node-bottom-output') ||
                    connectorElement.closest('.node-bottom-output')
                ) {
                    detectedOutputType = 'bottom';
                }
            }

            // 조건 노드의 경우 .output-dot을 찾아서 사용
            // 반복 노드의 경우 .bottom-output-dot을 찾아서 사용
            let actualConnector = connectorElement;
            if (connectorType === 'output' && detectedOutputType) {
                if (detectedOutputType === 'true' || detectedOutputType === 'false') {
                    // .true-output 또는 .false-output이 클릭된 경우, 내부의 .output-dot을 찾음
                    if (
                        connectorElement.classList.contains('true-output') ||
                        connectorElement.classList.contains('false-output')
                    ) {
                        const outputDot = connectorElement.querySelector('.output-dot');
                        if (outputDot) {
                            actualConnector = outputDot;
                            logger.log('[ConnectionManager] .output-dot 찾음:', {
                                original: connectorElement,
                                actual: actualConnector,
                                outputType: detectedOutputType
                            });
                        }
                    }
                } else if (detectedOutputType === 'bottom') {
                    // .node-bottom-output이 클릭된 경우, 내부의 .bottom-output-dot을 찾음
                    if (connectorElement.classList.contains('node-bottom-output')) {
                        const bottomDot = connectorElement.querySelector('.bottom-output-dot');
                        if (bottomDot) {
                            actualConnector = bottomDot;
                            logger.log('[ConnectionManager] .bottom-output-dot 찾음:', {
                                original: connectorElement,
                                actual: actualConnector,
                                outputType: detectedOutputType
                            });
                        }
                    }
                }
            }

            // 연결 시작 (입력/출력 모두 시작점이 될 수 있음)
            // 이미 연결된 커넥터도 클릭하면 연결 모드 시작 가능
            this.startConnection(nodeElement, actualConnector, connectorType, detectedOutputType);
        } else {
            // 연결 모드 중일 때
            // 같은 커넥터를 다시 클릭하면 연결 취소
            // startNode, startConnectorType, startConnector가 모두 같으면 같은 커넥터로 판단
            if (
                this.startNode === nodeElement &&
                this.startConnectorType === connectorType &&
                this.startConnector === connectorElement
            ) {
                logger.log('[ConnectionManager] 같은 커넥터 클릭 - 연결 취소');
                this.cancelConnection();
                return;
            }

            // 다른 타입의 커넥터 + 다른 노드일 때: 연결 완료
            // startConnectorType과 connectorType이 다르고, startNode와 nodeElement가 다르면 연결 완료 가능
            if (this.startConnectorType !== connectorType && this.startNode !== nodeElement) {
                this.completeConnection(nodeElement, connectorElement);
            } else {
                // 같은 타입이거나 같은 노드면 연결 취소
                logger.log('[ConnectionManager] 잘못된 연결 시도 - 연결 취소');
                this.cancelConnection();
            }
        }
    }

    /**
     * 커넥터가 이미 연결되어 있는지 확인
     * @param {string} nodeId - 노드 ID
     * @param {string} connectorType - 커넥터 타입 ('input' 또는 'output')
     * @param {string} outputType - 출력 타입 ('true', 'false', 또는 null) - 조건 노드의 경우에만 사용
     * @returns {boolean} 연결되어 있으면 true
     */
    isConnectorConnected(nodeId, connectorType, outputType = null) {
        const logger = getLogger();

        // 노드 ID를 문자열로 정규화 (숫자와 문자열 비교 문제 방지)
        const normalizedNodeId = String(nodeId).trim();

        logger.log('[ConnectionManager] isConnectorConnected 호출:', {
            nodeId: normalizedNodeId,
            connectorType: connectorType,
            outputType: outputType,
            connectionsSize: this.connections ? this.connections.size : 0
        });

        // connections가 없거나 비어있으면 연결되지 않음
        if (!this.connections || this.connections.size === 0) {
            logger.log('[ConnectionManager] isConnectorConnected: connections가 비어있음');
            return false;
        }

        // 모든 연결 정보 로그 출력 (디버깅용)
        const allConnections = Array.from(this.connections.entries()).map(([id, conn]) => ({
            id: id,
            from: String(conn.from || '').trim(),
            to: String(conn.to || '').trim(),
            outputType: conn.outputType || null
        }));

        logger.log('[ConnectionManager] isConnectorConnected: 모든 연결 정보:', allConnections);

        // connections Map을 순회하며 해당 노드의 커넥터가 사용되는지 확인
        for (const [connectionId, connection] of this.connections.entries()) {
            // 연결 정보의 노드 ID도 문자열로 정규화하여 비교
            const connectionFrom = String(connection.from || '').trim();
            const connectionTo = String(connection.to || '').trim();

            if (connectorType === 'input') {
                // input 커넥터: 해당 노드가 'to'로 사용되는 연결이 있는지 확인
                if (connectionTo === normalizedNodeId) {
                    logger.log('[ConnectionManager] ✅ isConnectorConnected: input 커넥터가 이미 연결됨', {
                        nodeId: normalizedNodeId,
                        connectionId: connectionId,
                        connection: connection,
                        connectionTo: connectionTo,
                        match: true
                    });
                    return true;
                }
            } else if (connectorType === 'output') {
                // output 커넥터: 해당 노드가 'from'으로 사용되는 연결이 있는지 확인
                // 조건 노드의 경우, 같은 outputType을 가진 연결만 확인
                if (connectionFrom === normalizedNodeId) {
                    if (outputType) {
                        // 조건 노드의 경우, 같은 outputType을 가진 연결만 확인
                        if (connection.outputType === outputType) {
                            logger.log(
                                '[ConnectionManager] ✅ isConnectorConnected: 조건 노드 output 커넥터가 이미 연결됨',
                                {
                                    nodeId: normalizedNodeId,
                                    outputType: outputType,
                                    connectionId: connectionId,
                                    connection: connection,
                                    connectionFrom: connectionFrom,
                                    match: true
                                }
                            );
                            return true;
                        }
                    } else {
                        // 일반 노드의 경우, outputType이 없으면 모든 연결 확인
                        logger.log('[ConnectionManager] ✅ isConnectorConnected: output 커넥터가 이미 연결됨', {
                            nodeId: normalizedNodeId,
                            connectionId: connectionId,
                            connection: connection,
                            connectionFrom: connectionFrom,
                            match: true
                        });
                        return true;
                    }
                }
            }
        }

        // 추가 확인: 실제로 화면에 그려진 연결선도 확인
        // connectionLines Map에서 해당 노드와 관련된 연결선이 있는지 확인
        let hasDrawnConnection = false;
        for (const [connectionId, line] of this.connectionLines.entries()) {
            const connection = this.connections.get(connectionId);
            if (connection) {
                const connectionFrom = String(connection.from || '').trim();
                const connectionTo = String(connection.to || '').trim();

                if (connectorType === 'input' && connectionTo === normalizedNodeId) {
                    hasDrawnConnection = true;
                    logger.log('[ConnectionManager] ✅ 화면에 그려진 연결선 발견 (input):', {
                        connectionId: connectionId,
                        connection: connection
                    });
                    break;
                } else if (connectorType === 'output' && connectionFrom === normalizedNodeId) {
                    // 조건 노드의 경우, 같은 outputType을 가진 연결만 확인
                    if (outputType) {
                        if (connection.outputType === outputType) {
                            hasDrawnConnection = true;
                            logger.log('[ConnectionManager] ✅ 화면에 그려진 연결선 발견 (조건 노드 output):', {
                                connectionId: connectionId,
                                connection: connection,
                                outputType: outputType
                            });
                            break;
                        }
                    } else {
                        // 일반 노드의 경우, outputType이 없으면 모든 연결 확인
                        hasDrawnConnection = true;
                        logger.log('[ConnectionManager] ✅ 화면에 그려진 연결선 발견 (output):', {
                            connectionId: connectionId,
                            connection: connection
                        });
                        break;
                    }
                }
            }
        }

        if (hasDrawnConnection) {
            logger.log('[ConnectionManager] ⚠️ connections Map에는 없지만 화면에 연결선이 있음 - 연결된 것으로 간주');
            return true;
        }

        logger.log('[ConnectionManager] ❌ isConnectorConnected: 연결되지 않음', {
            nodeId: normalizedNodeId,
            connectorType: connectorType,
            allConnections: allConnections,
            searchedFor: connectorType === 'input' ? `to === "${normalizedNodeId}"` : `from === "${normalizedNodeId}"`,
            connectionLinesCount: this.connectionLines ? this.connectionLines.size : 0
        });
        return false;
    }

    /**
     * 연결 시작
     */
    startConnection(nodeElement, connectorElement, connectorType) {
        const logger = getLogger();
        const nodeId = nodeElement.dataset.nodeId || nodeElement.id;

        logger.log('[ConnectionManager] ========== 연결 시작 호출 ==========');
        logger.log('[ConnectionManager] 연결 시작 호출:', {
            nodeId: nodeId,
            connectorType: connectorType,
            connectorElement: connectorElement,
            connectorClasses: connectorElement.className,
            nodeElement: nodeElement,
            nodeStyleLeft: nodeElement.style.left,
            nodeStyleTop: nodeElement.style.top
        });

        // 출력 타입 감지 (조건 노드의 경우)
        // .output-dot이 클릭된 경우 부모 요소(.true-output 또는 .false-output)를 확인
        let outputType = null;
        if (connectorType === 'output' && connectorElement) {
            if (connectorElement.classList.contains('true-output') || connectorElement.closest('.true-output')) {
                outputType = 'true';
            } else if (
                connectorElement.classList.contains('false-output') ||
                connectorElement.closest('.false-output')
            ) {
                outputType = 'false';
            }
        }

        logger.log('[ConnectionManager] 연결 시작 진행:', {
            nodeId: nodeId,
            connectorType: connectorType,
            outputType: outputType
        });

        this.isConnecting = true;
        this.startNode = nodeElement;
        this.startConnector = connectorElement;
        this.startConnectorType = connectorType; // 시작 커넥터 타입 저장
        this.startOutputType = outputType; // 조건 노드의 출력 타입 저장

        // 시작 커넥터 스타일 표시
        connectorElement.classList.add('connecting');

        // 커넥터 위치 미리 계산해서 로그 출력
        const testPos = this.getConnectorPosition(connectorElement);
        logger.log('[ConnectionManager] startConnection에서 커넥터 위치 테스트:', {
            testPos: testPos,
            nodeId: nodeId,
            connectorType: connectorType,
            outputType: outputType
        });

        // 임시 연결선 생성
        this.svgManager.createTempLine();

        // 마우스 이동 이벤트 등록
        const boundHandleMouseMove = this.eventHandler.handleMouseMove.bind(this.eventHandler);
        this.canvas.addEventListener('mousemove', boundHandleMouseMove);

        // 이벤트 핸들러 저장 (나중에 제거하기 위해)
        this._tempMouseMoveHandler = boundHandleMouseMove;

        logger.log('[ConnectionManager] ========== 연결 시작 완료 ==========');
    }

    /**
     * 연결 완료
     */
    completeConnection(targetNodeElement, targetConnectorElement) {
        const logger = getLogger();
        const startNodeId = this.startNode.dataset.nodeId;
        const targetNodeId = targetNodeElement.dataset.nodeId;

        logger.log('[ConnectionManager] ========== 연결 완료 ==========');
        logger.log('[ConnectionManager] 연결 완료 호출:', {
            startNodeId: startNodeId,
            startConnectorType: this.startConnectorType,
            targetNodeId: targetNodeId,
            targetConnectorType: targetConnectorElement.classList.contains('node-input')
                ? 'input'
                : targetConnectorElement.classList.contains('node-output')
                  ? 'output'
                  : 'unknown'
        });

        // 자기 자신으로의 연결 방지
        if (startNodeId === targetNodeId) {
            logger.warn('[ConnectionManager] 자기 자신으로의 연결 시도 - 취소');
            this.cancelConnection();
            return;
        }

        // 연결 방향 결정
        // 출력 -> 입력 방향으로만 연결 가능
        // 아래 연결점(bottom)도 출력으로 취급
        let fromNodeId, toNodeId;

        const isBottomOutput =
            this.startConnectorType === 'output' &&
            (this.startOutputType === 'bottom' ||
                this.startConnector.classList.contains('node-bottom-output') ||
                this.startConnector.closest('.node-bottom-output'));

        if (
            (this.startConnectorType === 'output' || isBottomOutput) &&
            targetConnectorElement.classList.contains('node-input')
        ) {
            // 시작: 출력(또는 아래 연결점), 타겟: 입력 -> start -> target (정상)
            fromNodeId = startNodeId;
            toNodeId = targetNodeId;
            logger.log('[ConnectionManager] 연결 방향: 출력 -> 입력 (정상)', {
                from: fromNodeId,
                to: toNodeId,
                outputType: this.startOutputType
            });
        } else if (
            this.startConnectorType === 'input' &&
            (targetConnectorElement.classList.contains('node-output') ||
                targetConnectorElement.classList.contains('node-bottom-output'))
        ) {
            // 시작: 입력, 타겟: 출력(또는 아래 연결점) -> target -> start (반대)
            fromNodeId = targetNodeId;
            toNodeId = startNodeId;
            logger.log('[ConnectionManager] 연결 방향: 입력 -> 출력 (반대로 변환)', {
                original: { from: startNodeId, to: targetNodeId },
                corrected: { from: fromNodeId, to: toNodeId }
            });
        } else {
            // 잘못된 연결 타입 조합
            logger.warn('[ConnectionManager] 잘못된 연결 타입 조합:', {
                startType: this.startConnectorType,
                startOutputType: this.startOutputType,
                targetType: targetConnectorElement.classList.contains('node-input')
                    ? 'input'
                    : targetConnectorElement.classList.contains('node-output')
                      ? 'output'
                      : targetConnectorElement.classList.contains('node-bottom-output')
                        ? 'bottom'
                        : 'unknown'
            });
            this.cancelConnection();
            return;
        }

        // 기존 연결 확인 및 삭제 (덮어쓰기)
        const connectionId = `${fromNodeId}-${toNodeId}`;
        if (this.connections.has(connectionId)) {
            logger.log('[ConnectionManager] 기존 연결 발견 - 덮어쓰기:', {
                connectionId: connectionId
            });
            this.deleteConnection(connectionId);
        }

        // 입력 커넥터에 기존 연결이 있으면 삭제 (입력은 하나만 연결 가능)
        const existingInputConnections = Array.from(this.connections.values()).filter((conn) => conn.to === toNodeId);
        existingInputConnections.forEach((conn) => {
            logger.log('[ConnectionManager] 입력 커넥터 기존 연결 삭제:', {
                connectionId: conn.id || `${conn.from}-${conn.to}`,
                from: conn.from,
                to: conn.to
            });
            this.deleteConnection(conn.id || `${conn.from}-${conn.to}`);
        });

        // 출력 타입 감지 (조건 노드, 반복 노드의 경우) - 검증 전에 먼저 감지
        // startOutputType이 이미 설정되어 있으면 사용, 없으면 자동 감지
        let outputType = this.startOutputType || null;
        if (!outputType && this.startConnectorType === 'output') {
            const startConnector = this.startConnector;
            if (startConnector) {
                if (startConnector.classList.contains('true-output') || startConnector.closest('.true-output')) {
                    outputType = 'true';
                } else if (
                    startConnector.classList.contains('false-output') ||
                    startConnector.closest('.false-output')
                ) {
                    outputType = 'false';
                } else if (
                    startConnector.classList.contains('node-bottom-output') ||
                    startConnector.closest('.node-bottom-output') ||
                    startConnector.classList.contains('bottom-output-dot') ||
                    startConnector.closest('.bottom-output-dot')
                ) {
                    outputType = 'bottom';
                }
            }
        } else if (
            !outputType &&
            this.startConnectorType === 'input' &&
            (targetConnectorElement.classList.contains('node-output') ||
                targetConnectorElement.classList.contains('node-bottom-output') ||
                targetConnectorElement.closest('.node-bottom-output'))
        ) {
            // 입력에서 출력으로 연결하는 경우 (반대 방향)
            // 타겟이 반복 노드의 아래 연결점인지 먼저 확인 (우선순위 높음)
            if (
                targetConnectorElement.classList.contains('node-bottom-output') ||
                targetConnectorElement.closest('.node-bottom-output') ||
                targetConnectorElement.classList.contains('bottom-output-dot') ||
                targetConnectorElement.closest('.bottom-output-dot')
            ) {
                outputType = 'bottom';
            } else if (
                targetConnectorElement.classList.contains('true-output') ||
                targetConnectorElement.closest('.true-output')
            ) {
                outputType = 'true';
            } else if (
                targetConnectorElement.classList.contains('false-output') ||
                targetConnectorElement.closest('.false-output')
            ) {
                outputType = 'false';
            }
        }

        // 출력 연결 개수 검증 (조건 노드, 반복 노드 제외)
        // fromNodeId에서 나가는 연결 개수 확인
        // 조건 노드의 경우, 같은 outputType을 가진 연결만 카운트
        // 반복 노드의 경우, 아래 연결점(bottom)은 출력으로 카운트하지 않음
        const fromNodeElement = document.querySelector(`[data-node-id="${fromNodeId}"]`);
        const nodeType = fromNodeElement ? fromNodeElement.dataset.nodeType : null;
        const isConditionNode = nodeType === 'condition';
        const isRepeatNode = nodeType === 'repeat';

        // 모든 출력 연결 가져오기 (원본)
        const allOutputConnections = Array.from(this.connections.values()).filter((conn) => conn.from === fromNodeId);

        // 검증용 연결 목록 (카운트용)
        let existingOutputConnections = allOutputConnections;

        // 조건 노드인 경우, 같은 outputType을 가진 연결만 카운트
        if (isConditionNode && outputType) {
            existingOutputConnections = existingOutputConnections.filter((conn) => conn.outputType === outputType);
        }

        // 반복 노드인 경우, 아래 연결점(bottom)은 출력으로 카운트하지 않음
        if (isRepeatNode) {
            existingOutputConnections = existingOutputConnections.filter((conn) => conn.outputType !== 'bottom');
        }

        logger.log('[ConnectionManager] 출력 연결 검증:', {
            fromNodeId: fromNodeId,
            nodeType: nodeType,
            isCondition: isConditionNode,
            isRepeat: isRepeatNode,
            outputType: outputType,
            allConnections: allOutputConnections.length,
            existingOutputConnections: existingOutputConnections.length,
            allConnectionsList: allOutputConnections.map((c) => `${c.from} → ${c.to} (${c.outputType || 'default'})`),
            existingConnections: existingOutputConnections.map(
                (c) => `${c.from} → ${c.to} (${c.outputType || 'default'})`
            )
        });

        // 노드 타입 확인 (조건 노드가 아닌 경우 출력은 최대 1개만 허용)
        if (fromNodeElement) {
            logger.log('[ConnectionManager] 노드 타입 확인:', {
                fromNodeId: fromNodeId,
                nodeType: nodeType,
                isCondition: isConditionNode,
                isRepeat: isRepeatNode,
                existingCount: existingOutputConnections.length
            });

            // 조건 노드는 출력 연결 개수 제한 없음 (각 outputType별로 독립적)
            // 반복 노드는 아래 연결점(bottom)과 오른쪽 출력을 모두 가질 수 있음
            // 반복 노드의 경우, 같은 outputType을 가진 연결만 삭제
            if (isRepeatNode) {
                // 반복 노드에서 같은 outputType의 기존 연결만 삭제
                // 원본 연결 목록(allOutputConnections)에서 필터링
                const sameTypeConnections = allOutputConnections.filter((conn) => {
                    // outputType이 null인 경우 (일반 출력 연결점)
                    if (outputType === null || outputType === undefined) {
                        // outputType이 null이거나 undefined인 연결만 (아래 연결점 제외)
                        return conn.outputType === null || conn.outputType === undefined;
                    } else {
                        // outputType이 'bottom'인 경우, 같은 타입만
                        return conn.outputType === outputType;
                    }
                });

                if (sameTypeConnections.length >= 1) {
                    logger.log('[ConnectionManager] 반복 노드의 같은 타입 출력 연결 삭제:', {
                        nodeId: fromNodeId,
                        outputType: outputType,
                        existingConnections: sameTypeConnections.length,
                        existingConnectionsList: sameTypeConnections.map(
                            (c) => `${c.from} → ${c.to} (${c.outputType || 'default'})`
                        )
                    });

                    // 같은 타입의 기존 연결만 삭제
                    sameTypeConnections.forEach((conn) => {
                        const connId = conn.id || `${conn.from}-${conn.to}`;
                        logger.log('[ConnectionManager] 반복 노드 출력 커넥터 기존 연결 삭제:', {
                            connectionId: connId,
                            from: conn.from,
                            to: conn.to,
                            outputType: conn.outputType
                        });
                        this.deleteConnection(connId);
                    });
                }
            } else if (!isConditionNode && !isRepeatNode && existingOutputConnections.length >= 1) {
                // 조건 노드와 반복 노드가 아니고 이미 출력 연결이 있는 경우: 기존 연결 삭제 (덮어쓰기)
                logger.log('[ConnectionManager] 조건 노드가 아닌 노드의 기존 출력 연결 삭제:', {
                    nodeId: fromNodeId,
                    nodeType: nodeType || 'undefined',
                    existingConnections: existingOutputConnections.length,
                    existingConnectionsList: existingOutputConnections.map((c) => `${c.from} → ${c.to}`)
                });

                // 기존 출력 연결 삭제
                existingOutputConnections.forEach((conn) => {
                    const connId = conn.id || `${conn.from}-${conn.to}`;
                    logger.log('[ConnectionManager] 출력 커넥터 기존 연결 삭제:', {
                        connectionId: connId,
                        from: conn.from,
                        to: conn.to
                    });
                    this.deleteConnection(connId);
                });
            }
        } else {
            // 노드 요소를 찾을 수 없어도 기존 연결이 있으면 삭제
            // 반복 노드인 경우 같은 outputType만 삭제
            if (isRepeatNode) {
                // 원본 연결 목록(allOutputConnections)에서 필터링
                const sameTypeConnections = allOutputConnections.filter((conn) => {
                    // outputType이 null인 경우 (일반 출력 연결점)
                    if (outputType === null || outputType === undefined) {
                        // outputType이 null이거나 undefined인 연결만 (아래 연결점 제외)
                        return conn.outputType === null || conn.outputType === undefined;
                    } else {
                        // outputType이 'bottom'인 경우, 같은 타입만
                        return conn.outputType === outputType;
                    }
                });

                if (sameTypeConnections.length >= 1) {
                    logger.log('[ConnectionManager] 노드 요소를 찾을 수 없지만 반복 노드의 같은 타입 연결 삭제:', {
                        fromNodeId: fromNodeId,
                        outputType: outputType,
                        existingConnections: sameTypeConnections.length
                    });

                    sameTypeConnections.forEach((conn) => {
                        const connId = conn.id || `${conn.from}-${conn.to}`;
                        this.deleteConnection(connId);
                    });
                }
            } else if (existingOutputConnections.length >= 1) {
                logger.log('[ConnectionManager] 노드 요소를 찾을 수 없지만 기존 연결 삭제:', {
                    fromNodeId: fromNodeId,
                    existingConnections: existingOutputConnections.length
                });

                // 기존 출력 연결 삭제
                existingOutputConnections.forEach((conn) => {
                    const connId = conn.id || `${conn.from}-${conn.to}`;
                    this.deleteConnection(connId);
                });
            }
        }

        // 연결 생성
        logger.log('[ConnectionManager] 연결 생성:', {
            from: fromNodeId,
            to: toNodeId,
            connectionId: connectionId,
            outputType: outputType
        });
        this.createConnection(fromNodeId, toNodeId, outputType);

        // 연결 완료 처리
        this.finishConnection();

        // 도착 커넥터 스타일 표시
        targetConnectorElement.classList.add('connected');

        logger.log('[ConnectionManager] ========== 연결 완료 성공 ==========');
    }

    /**
     * 연결 취소
     */
    cancelConnection() {
        const logger = getLogger();
        logger.log('[ConnectionManager] 연결 취소');

        this.isConnecting = false;

        // 시작 커넥터 상태 복원
        if (this.startConnector) {
            this.startConnector.classList.remove('connecting');
        }

        // 임시 연결선 제거
        if (this.tempLine) {
            this.tempLine.remove();
            this.tempLine = null;
        }

        // 임시 연결선 제거 (롱터치용)
        if (this.tempConnection) {
            this.tempConnection.remove();
            this.tempConnection = null;
        }

        // 마우스 이동 이벤트 제거
        if (this._tempMouseMoveHandler) {
            this.canvas.removeEventListener('mousemove', this._tempMouseMoveHandler);
            this._tempMouseMoveHandler = null;
        }

        // 연결 시작 정보 초기화
        this.startNode = null;
        this.startConnector = null;
        this.startConnectorType = null;
        this.startOutputType = null;
    }

    /**
     * 연결 완료 후 정리 처리
     */
    finishConnection() {
        this.isConnecting = false;

        // 시작 커넥터 상태 복원
        if (this.startConnector) {
            this.startConnector.classList.remove('connecting');
        }

        // 임시 연결선 제거
        if (this.tempLine) {
            this.tempLine.remove();
            this.tempLine = null;
        }

        // 마우스 이동 이벤트 제거
        if (this._tempMouseMoveHandler) {
            this.canvas.removeEventListener('mousemove', this._tempMouseMoveHandler);
            this._tempMouseMoveHandler = null;
        }

        // 연결 시작 정보 초기화
        this.startNode = null;
        this.startConnector = null;
        this.startConnectorType = null;
        this.startOutputType = null;
    }

    /**
     * 커넥터 위치 계산 (위임)
     */
    getConnectorPosition(connectorElement) {
        return this.coordinateCalculator.getConnectorPosition(connectorElement);
    }

    /**
     * 임시 연결선 업데이트
     */
    updateTempLine(x1, y1, x2, y2) {
        const logger = getLogger();

        if (!this.tempLine) {
            logger.warn('[ConnectionManager] updateTempLine: tempLine이 없습니다.');
            return;
        }

        // 좌표 유효성 체크
        if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) {
            logger.warn('[ConnectionManager] updateTempLine: 유효하지 않은 좌표:', { x1, y1, x2, y2 });
            return;
        }

        const path = createCurvedPath(x1, y1, x2, y2);
        this.tempLine.setAttribute('d', path);

        logger.log('[ConnectionManager] 임시 연결선 경로 업데이트:', {
            from: { x: x1, y: y1 },
            to: { x: x2, y: y2 },
            path: path
        });
    }

    /**
     * 연결 생성
     */
    createConnection(fromNodeId, toNodeId, outputType = null) {
        const logger = getLogger();
        const connectionId = `${fromNodeId}-${toNodeId}`;

        // 입력 커넥터에 기존 연결이 있으면 삭제 (입력은 하나만 연결 가능)
        const existingInputConnections = Array.from(this.connections.values()).filter((conn) => conn.to === toNodeId);

        if (existingInputConnections.length > 0) {
            logger.log('[ConnectionManager] createConnection: 입력 커넥터 기존 연결 삭제:', {
                toNodeId: toNodeId,
                existingConnections: existingInputConnections.length,
                existingConnectionsList: existingInputConnections.map((c) => `${c.from} → ${c.to}`)
            });

            // 기존 입력 연결 삭제
            existingInputConnections.forEach((conn) => {
                const connId = conn.id || `${conn.from}-${conn.to}`;
                this.deleteConnection(connId);
            });
        }

        // 출력 연결 개수 검증 (조건 노드, 반복 노드 제외) - createConnection에서도 재검증
        // 조건 노드의 경우, 같은 outputType을 가진 연결만 카운트
        // 반복 노드의 경우, 아래 연결점(bottom)과 오른쪽 출력은 독립적
        const fromNodeElement = document.querySelector(`[data-node-id="${fromNodeId}"]`);
        const nodeType = fromNodeElement ? fromNodeElement.dataset.nodeType : null;
        const isConditionNode = nodeType === 'condition';
        const isRepeatNode = nodeType === 'repeat';

        // 모든 출력 연결 가져오기 (원본)
        const allOutputConnections = Array.from(this.connections.values()).filter((conn) => conn.from === fromNodeId);

        // 검증용 연결 목록 (카운트용)
        let existingOutputConnections = allOutputConnections;

        // 조건 노드인 경우, 같은 outputType을 가진 연결만 카운트
        if (isConditionNode && outputType) {
            existingOutputConnections = existingOutputConnections.filter((conn) => conn.outputType === outputType);
        }

        // 반복 노드인 경우, 아래 연결점(bottom)은 출력으로 카운트하지 않음
        if (isRepeatNode) {
            existingOutputConnections = existingOutputConnections.filter((conn) => conn.outputType !== 'bottom');
        }

        logger.log('[ConnectionManager] createConnection 출력 연결 검증:', {
            fromNodeId: fromNodeId,
            nodeType: nodeType,
            isCondition: isConditionNode,
            isRepeat: isRepeatNode,
            outputType: outputType,
            allConnections: allOutputConnections.length,
            existingOutputConnections: existingOutputConnections.length,
            allConnectionsList: allOutputConnections.map((c) => `${c.from} → ${c.to} (${c.outputType || 'default'})`),
            existingConnections: existingOutputConnections.map(
                (c) => `${c.from} → ${c.to} (${c.outputType || 'default'})`
            )
        });

        // 노드 타입 확인 (조건 노드, 반복 노드가 아닌 경우 출력은 최대 1개만 허용)
        if (fromNodeElement) {
            logger.log('[ConnectionManager] createConnection 노드 타입 확인:', {
                fromNodeId: fromNodeId,
                nodeType: nodeType,
                isCondition: isConditionNode,
                isRepeat: isRepeatNode,
                existingCount: existingOutputConnections.length
            });

            // 조건 노드는 출력 연결 개수 제한 없음 (각 outputType별로 독립적)
            // 반복 노드는 아래 연결점(bottom)과 오른쪽 출력을 모두 가질 수 있음
            // 반복 노드의 경우, 같은 outputType을 가진 연결만 삭제
            if (isRepeatNode) {
                // 반복 노드에서 같은 outputType의 기존 연결만 삭제
                // 원본 연결 목록(allOutputConnections)에서 필터링
                const sameTypeConnections = allOutputConnections.filter((conn) => {
                    // outputType이 null인 경우 (일반 출력 연결점)
                    if (outputType === null || outputType === undefined) {
                        // outputType이 null이거나 undefined인 연결만 (아래 연결점 제외)
                        return conn.outputType === null || conn.outputType === undefined;
                    } else {
                        // outputType이 'bottom'인 경우, 같은 타입만
                        return conn.outputType === outputType;
                    }
                });

                if (sameTypeConnections.length >= 1) {
                    logger.log('[ConnectionManager] createConnection: 반복 노드의 같은 타입 출력 연결 삭제:', {
                        nodeId: fromNodeId,
                        outputType: outputType,
                        existingConnections: sameTypeConnections.length,
                        existingConnectionsList: sameTypeConnections.map(
                            (c) => `${c.from} → ${c.to} (${c.outputType || 'default'})`
                        )
                    });

                    // 같은 타입의 기존 연결만 삭제
                    sameTypeConnections.forEach((conn) => {
                        const connId = conn.id || `${conn.from}-${conn.to}`;
                        logger.log('[ConnectionManager] createConnection 반복 노드 출력 커넥터 기존 연결 삭제:', {
                            connectionId: connId,
                            from: conn.from,
                            to: conn.to,
                            outputType: conn.outputType
                        });
                        this.deleteConnection(connId);
                    });
                }
            } else if (!isConditionNode && !isRepeatNode && existingOutputConnections.length >= 1) {
                // 조건 노드와 반복 노드가 아니고 이미 출력 연결이 있는 경우: 기존 연결 삭제 (덮어쓰기)
                logger.log('[ConnectionManager] createConnection: 조건 노드가 아닌 노드의 기존 출력 연결 삭제:', {
                    nodeId: fromNodeId,
                    nodeType: nodeType || 'undefined',
                    existingConnections: existingOutputConnections.length,
                    existingConnectionsList: existingOutputConnections.map((c) => `${c.from} → ${c.to}`)
                });

                // 기존 출력 연결 삭제
                existingOutputConnections.forEach((conn) => {
                    const connId = conn.id || `${conn.from}-${conn.to}`;
                    this.deleteConnection(connId);
                });
            }
        } else {
            // 노드 요소를 찾을 수 없어도 기존 연결이 있으면 삭제
            // 반복 노드인 경우 같은 outputType만 삭제
            if (isRepeatNode) {
                // 원본 연결 목록(allOutputConnections)에서 필터링
                const sameTypeConnections = allOutputConnections.filter((conn) => {
                    // outputType이 null인 경우 (일반 출력 연결점)
                    if (outputType === null || outputType === undefined) {
                        // outputType이 null이거나 undefined인 연결만 (아래 연결점 제외)
                        return conn.outputType === null || conn.outputType === undefined;
                    } else {
                        // outputType이 'bottom'인 경우, 같은 타입만
                        return conn.outputType === outputType;
                    }
                });

                if (sameTypeConnections.length >= 1) {
                    logger.log(
                        '[ConnectionManager] createConnection: 노드 요소를 찾을 수 없지만 반복 노드의 같은 타입 연결 삭제:',
                        {
                            fromNodeId: fromNodeId,
                            outputType: outputType,
                            existingConnections: sameTypeConnections.length
                        }
                    );

                    sameTypeConnections.forEach((conn) => {
                        const connId = conn.id || `${conn.from}-${conn.to}`;
                        this.deleteConnection(connId);
                    });
                }
            } else if (existingOutputConnections.length >= 1) {
                logger.log('[ConnectionManager] createConnection: 노드 요소를 찾을 수 없지만 기존 연결 삭제:', {
                    fromNodeId: fromNodeId,
                    existingConnections: existingOutputConnections.length
                });

                // 기존 출력 연결 삭제
                existingOutputConnections.forEach((conn) => {
                    const connId = conn.id || `${conn.from}-${conn.to}`;
                    this.deleteConnection(connId);
                });
            }
        }

        // 연결 정보 저장 (조건 노드의 경우 출력 타입 포함)
        const connectionData = {
            id: connectionId,
            from: fromNodeId,
            to: toNodeId,
            outputType: outputType || null // 'true', 'false', 또는 null
        };
        this.connections.set(connectionId, connectionData);

        // 연결선 그리기 (출력 타입 전달)
        this.svgManager.drawConnection(fromNodeId, toNodeId, outputType || null);

        // 연결 생성 이벤트 발생
        this.canvas.dispatchEvent(
            new CustomEvent('connectionCreated', {
                detail: { from: fromNodeId, to: toNodeId }
            })
        );
    }

    /**
     * 연결 전체 업데이트
     * 노드 이동/캔버스 변화 시 연결들을 다시 그린다
     */
    updateConnections() {
        // 이미 업데이트 중이면 중복 호출 방지
        if (this.isUpdating) {
            return;
        }

        this.isUpdating = true;

        try {
            // SVG 크기 업데이트
            this.svgManager.updateSVGSize();

            // 모든 연결 다시 그리기
            this.redrawAllConnections();
        } finally {
            this.isUpdating = false;
        }
    }

    /**
     * 기존 연결선의 위치만 업데이트
     * 이미 존재하는 path의 d 값만 수정한다.
     */
    updateAllConnections() {
        this.svgManager.updateAllConnections();
    }

    /**
     * 연결 삭제
     */
    deleteConnection(connectionId) {
        if (!this.connections.has(connectionId)) {
            return;
        }

        // 연결선 제거
        const line = this.connectionLines.get(connectionId);
        if (line) {
            line.remove();
            this.connectionLines.delete(connectionId);
        }

        // 연결 정보 제거
        this.connections.delete(connectionId);

        // 연결 삭제 이벤트 발생
        this.canvas.dispatchEvent(
            new CustomEvent('connectionDeleted', {
                detail: { connectionId }
            })
        );
    }

    /**
     * 모든 연결 다시 그리기
     * Transform 변경 시 연결 위치를 다시 계산해서 그린다
     */
    redrawAllConnections() {
        // 기존 연결선 모두 제거
        this.connectionLines.forEach((line) => line.remove());
        this.connectionLines.clear();

        // 저장된 연결 정보를 기반으로 모두 다시 그리기
        this.connections.forEach((connection, connectionId) => {
            this.svgManager.drawConnection(connection.from, connection.to, connection.outputType || null);
        });
    }

    /**
     * 연결 정보 가져오기
     */
    getConnections() {
        return Array.from(this.connections.values());
    }

    /**
     * 연결 정보 설정
     * (예: 저장된 워크플로우를 로드할 때 사용)
     */
    setConnections(connections) {
        // 기존 연결 정보 제거
        this.connections.clear();
        this.connectionLines.forEach((line) => line.remove());
        this.connectionLines.clear();

        // 새로운 연결 정보 추가
        connections.forEach((connection) => {
            // 연결 정보 구조 정규화
            const connectionId = connection.id || `${connection.from}-${connection.to}`;
            const normalizedConnection = {
                id: connectionId,
                from: connection.from || connection.fromNodeId,
                to: connection.to || connection.toNodeId,
                outputType: connection.outputType || null // 조건 노드의 출력 타입 복원
            };

            this.connections.set(connectionId, normalizedConnection);
            this.svgManager.drawConnection(
                normalizedConnection.from,
                normalizedConnection.to,
                normalizedConnection.outputType || null
            );
        });
    }

    /**
     * 특정 노드가 이동했을 때 그 노드와 관련된 연결만 다시 그리기
     */
    updateNodeConnections(nodeId) {
        // 약간의 지연을 두고 실행 (DOM 업데이트 완료 후 반영하기 위함)
        setTimeout(() => {
            this.connections.forEach((connection, connectionId) => {
                if (connection.from === nodeId || connection.to === nodeId) {
                    // 기존 연결선 제거
                    const line = this.connectionLines.get(connectionId);
                    if (line) {
                        line.remove();
                        this.connectionLines.delete(connectionId);
                    }

                    // 새로 연결선 그리기
                    this.svgManager.drawConnection(connection.from, connection.to, connection.outputType || null);
                }
            });
        }, 10);
    }

    /**
     * 특정 노드 관련 연결을 즉시 업데이트
     * 드래그 중에 실시간으로 연결선을 업데이트하기 위해 사용
     */
    updateNodeConnectionsImmediately(nodeId) {
        const logger = getLogger();

        // 지연 없이 바로 업데이트
        this.connections.forEach((connection, connectionId) => {
            if (connection.from === nodeId || connection.to === nodeId) {
                // 기존 연결선 제거
                const line = this.connectionLines.get(connectionId);
                if (line) {
                    line.remove();
                    this.connectionLines.delete(connectionId);
                }

                // 새로 연결선 그리기 (조건 노드의 경우 outputType 전달)
                try {
                    this.svgManager.drawConnection(connection.from, connection.to, connection.outputType || null);
                } catch (error) {
                    logger.warn(`[ConnectionManager] 연결선 그리기 실패: ${connectionId}`, error);
                }
            }
        });
    }

    /**
     * 임시 연결선 업데이트 (롱터치용)
     * 마우스/터치 이동에 따라 임시 연결선을 그린다.
     */
    updateTempConnection(startX, startY, endX, endY) {
        this.svgManager.updateTempConnection(startX, startY, endX, endY);
    }

    /**
     * 임시 연결선 제거
     */
    removeTempConnection() {
        if (this.tempConnection) {
            this.tempConnection.remove();
            this.tempConnection = null;
        }
    }

    /**
     * 특정 노드와 관련된 모든 연결 제거
     * 노드가 삭제될 때 호출한다.
     */
    removeNodeConnections(nodeId) {
        const connectionsToRemove = [];

        // 해당 노드와 관련된 모든 연결 찾기
        this.connections.forEach((connection, connectionId) => {
            if (connection.from === nodeId || connection.to === nodeId) {
                connectionsToRemove.push(connectionId);
            }
        });

        // 찾은 연결들 삭제
        connectionsToRemove.forEach((connectionId) => {
            this.deleteConnection(connectionId);
        });
    }

    /**
     * 모든 연결 제거
     * 캔버스를 완전히 초기화할 때 사용
     */
    clearAllConnections() {
        // 모든 연결선 SVG 요소 제거
        this.connectionLines.forEach((line) => {
            line.remove();
        });
        this.connectionLines.clear();

        // 모든 연결 정보 제거
        this.connections.clear();
    }
}

/**
 * ConnectionManager 인스턴스 설정 함수
 * 다른 파일과의 호환성을 위해 전역 변수로도 설정 (임시)
 * TODO: 다른 파일들이 ES6 모듈로 전환되면 제거
 */
export function setConnectionManager(connectionManager) {
    window.connectionManager = connectionManager;
}

// 전역 호환성을 위한 설정 (다른 파일과의 호환성 유지)
// TODO: 다른 파일들이 ES6 모듈로 전환되면 제거
if (typeof window !== 'undefined') {
    window.ConnectionManager = ConnectionManager;
    window.setConnectionManager = setConnectionManager;
}
