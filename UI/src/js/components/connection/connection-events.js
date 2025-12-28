/**
 * ConnectionManager 이벤트 처리
 * 이벤트 바인딩, 클릭 처리, 마우스 이동 등을 담당
 */

import { getLogger } from './connection-utils.js';
import { createCurvedPath } from './connection-utils.js';

/**
 * 이벤트 처리 클래스
 */
export class ConnectionEventHandler {
    constructor(connectionManager) {
        this.connectionManager = connectionManager;
    }

    /**
     * 이벤트 바인딩
     */
    bindEvents() {
        const logger = getLogger();

        // ESC 키 이벤트(연결 취소용)
        this._escKeyHandler = (e) => {
            if (e.key === 'Escape' && this.connectionManager.isConnecting) {
                logger.log('[ConnectionManager] ESC 키로 연결 취소');
                this.connectionManager.cancelConnection();
            }
        };
        window.addEventListener('keydown', this._escKeyHandler);

        // 캔버스 클릭 이벤트(연결 취소용)
        // 연결점이 아닌 곳 클릭 시 취소
        this._canvasClickHandler = (e) => {
            if (!this.connectionManager.isConnecting) {
                return;
            }

            // 클릭된 요소가 연결점인지 확인
            const clickedElement = e.target;
            const isConnector =
                clickedElement.classList.contains('node-input') ||
                clickedElement.classList.contains('node-output') ||
                clickedElement.classList.contains('true-output') ||
                clickedElement.classList.contains('false-output') ||
                clickedElement.classList.contains('node-bottom-output') ||
                clickedElement.classList.contains('bottom-output-dot') ||
                clickedElement.classList.contains('output-dot') ||
                clickedElement.closest('.node-input') ||
                clickedElement.closest('.node-output') ||
                clickedElement.closest('.true-output') ||
                clickedElement.closest('.false-output') ||
                clickedElement.closest('.node-bottom-output') ||
                clickedElement.closest('.bottom-output-dot') ||
                clickedElement.closest('.output-dot');

            // 연결점이 아닌 곳 클릭 시 취소
            if (!isConnector) {
                logger.log('[ConnectionManager] 연결점이 아닌 곳 클릭으로 연결 취소');
                this.connectionManager.cancelConnection();
            }
        };
        this.connectionManager.canvas.addEventListener('click', this._canvasClickHandler);

        // 윈도우 리사이즈 이벤트
        window.addEventListener('resize', () => {
            this.connectionManager.svgManager.updateSVGSize();
            this.connectionManager.redrawAllConnections();
        });
    }

    /**
     * 노드 커넥터 클릭 이벤트 바인딩
     * 중복 등록 방지를 위해 데이터 속성으로 바인딩 여부 확인
     */
    async bindNodeConnector(nodeElement) {
        const logger = getLogger();
        const nodeId = nodeElement.dataset.nodeId;

        if (!nodeElement) {
            logger.warn('[ConnectionManager] bindNodeConnector: nodeElement가 없습니다.');
            return;
        }

        logger.log('[ConnectionManager] bindNodeConnector 호출:', {
            nodeId: nodeId,
            hasInput: !!nodeElement.querySelector('.node-input'),
            hasOutput: !!nodeElement.querySelector('.node-output')
        });

        // 입력 커넥터
        const inputConnector = nodeElement.querySelector('.node-input');
        if (inputConnector) {
            // 기존 이벤트 리스너 제거 (중복 방지)
            const newInputConnector = inputConnector.cloneNode(true);
            inputConnector.parentNode.replaceChild(newInputConnector, inputConnector);

            // 클릭 이벤트 (연결 시작/완료)
            newInputConnector.addEventListener('click', (e) => {
                e.stopPropagation();

                // 패닝 중일 때는 연결 시작 방지
                if (this.connectionManager.isPanning()) {
                    return;
                }
                logger.log('[ConnectionManager] 입력 커넥터 클릭:', nodeId);
                this.connectionManager.handleConnectorClick(nodeElement, 'input', newInputConnector);
            });

            // 더블클릭 이벤트 (연결 삭제)
            newInputConnector.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                e.preventDefault();

                if (this.connectionManager.isPanning()) {
                    return;
                }

                logger.log('[ConnectionManager] 입력 커넥터 더블클릭:', nodeId);
                // NodeManager의 handleConnectorDoubleClick 호출
                if (window.nodeManager && typeof window.nodeManager.handleConnectorDoubleClick === 'function') {
                    window.nodeManager.handleConnectorDoubleClick(newInputConnector, nodeElement, 'input');
                }
            });

            logger.log('[ConnectionManager] 입력 커넥터 바인딩 완료:', nodeId);
        } else {
            // 경계 노드는 입력이 없으므로 경고 출력하지 않음
            const nodeType = nodeElement.dataset.nodeType || null;
            // 경계 노드인지 확인 (동기적 체크)
            const { isBoundaryNodeSync } = await import('../../../pages/workflow/constants/node-types.js');
            if (!isBoundaryNodeSync(nodeType)) {
                logger.warn('[ConnectionManager] 입력 커넥터를 찾을 수 없습니다:', nodeId);
            }
        }

        // 일반 출력 커넥터
        const outputConnector = nodeElement.querySelector('.node-output:not(.true-output):not(.false-output)');
        if (outputConnector) {
            // 기존 이벤트 리스너 제거 (중복 방지)
            const newOutputConnector = outputConnector.cloneNode(true);
            outputConnector.parentNode.replaceChild(newOutputConnector, outputConnector);

            // 클릭 이벤트 (연결 시작/완료)
            newOutputConnector.addEventListener('click', (e) => {
                e.stopPropagation();

                // 패닝 중일 때는 연결 시작 방지
                if (this.connectionManager.isPanning()) {
                    return;
                }
                logger.log('[ConnectionManager] 출력 커넥터 클릭:', nodeId);
                this.connectionManager.handleConnectorClick(nodeElement, 'output', newOutputConnector);
            });

            // 더블클릭 이벤트 (연결 삭제)
            newOutputConnector.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                e.preventDefault();

                if (this.connectionManager.isPanning()) {
                    return;
                }

                logger.log('[ConnectionManager] 출력 커넥터 더블클릭:', nodeId);
                // NodeManager의 handleConnectorDoubleClick 호출
                if (window.nodeManager && typeof window.nodeManager.handleConnectorDoubleClick === 'function') {
                    window.nodeManager.handleConnectorDoubleClick(newOutputConnector, nodeElement, 'output');
                }
            });

            logger.log('[ConnectionManager] 출력 커넥터 바인딩 완료:', nodeId);
        } else {
            // 종료 노드는 출력이 없으므로 경고 출력하지 않음
            const nodeType = nodeElement.dataset.nodeType || null;
            if (nodeType) {
                logger.warn('[ConnectionManager] 출력 커넥터를 찾을 수 없습니다:', nodeId);
            }
        }

        // 조건 노드용 True/False 출력 커넥터
        const trueOutput = nodeElement.querySelector('.true-output .output-dot');
        const falseOutput = nodeElement.querySelector('.false-output .output-dot');

        if (trueOutput) {
            // 기존 이벤트 리스너 제거 (중복 방지)
            const newTrueOutput = trueOutput.cloneNode(true);
            trueOutput.parentNode.replaceChild(newTrueOutput, trueOutput);

            // 클릭 이벤트 (연결 시작/완료)
            newTrueOutput.addEventListener('click', (e) => {
                e.stopPropagation();

                if (this.connectionManager.isPanning()) {
                    return;
                }
                logger.log('[ConnectionManager] True 출력 커넥터 클릭:', nodeId);
                this.connectionManager.handleConnectorClick(nodeElement, 'output', newTrueOutput);
            });

            // 더블클릭 이벤트 (연결 삭제)
            newTrueOutput.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                e.preventDefault();

                if (this.connectionManager.isPanning()) {
                    return;
                }

                logger.log('[ConnectionManager] True 출력 커넥터 더블클릭:', nodeId);
                // NodeManager의 handleConnectorDoubleClick 호출
                if (window.nodeManager && typeof window.nodeManager.handleConnectorDoubleClick === 'function') {
                    window.nodeManager.handleConnectorDoubleClick(newTrueOutput, nodeElement, 'output');
                }
            });

            logger.log('[ConnectionManager] True 출력 커넥터 바인딩 완료:', nodeId);
        }

        if (falseOutput) {
            // 기존 이벤트 리스너 제거 (중복 방지)
            const newFalseOutput = falseOutput.cloneNode(true);
            falseOutput.parentNode.replaceChild(newFalseOutput, falseOutput);

            // 클릭 이벤트 (연결 시작/완료)
            newFalseOutput.addEventListener('click', (e) => {
                e.stopPropagation();

                if (this.connectionManager.isPanning()) {
                    return;
                }
                logger.log('[ConnectionManager] False 출력 커넥터 클릭:', nodeId);
                this.connectionManager.handleConnectorClick(nodeElement, 'output', newFalseOutput);
            });

            // 더블클릭 이벤트 (연결 삭제)
            newFalseOutput.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                e.preventDefault();

                if (this.connectionManager.isPanning()) {
                    return;
                }

                logger.log('[ConnectionManager] False 출력 커넥터 더블클릭:', nodeId);
                // NodeManager의 handleConnectorDoubleClick 호출
                if (window.nodeManager && typeof window.nodeManager.handleConnectorDoubleClick === 'function') {
                    window.nodeManager.handleConnectorDoubleClick(newFalseOutput, nodeElement, 'output');
                }
            });

            logger.log('[ConnectionManager] False 출력 커넥터 바인딩 완료:', nodeId);
        }
    }

    /**
     * 마우스 이동 처리
     * 임시 연결선을 마우스 위치에 맞게 업데이트
     */
    handleMouseMove(e) {
        if (!this.connectionManager.tempLine || !this.connectionManager.startConnector) {
            return;
        }

        const logger = getLogger();

        // 마우스 위치를 canvas-content 기준 좌표로 변환
        const canvasContent = document.getElementById('canvas-content');
        const canvas = this.connectionManager.canvas;

        if (!canvas) {
            logger.warn('[ConnectionManager] handleMouseMove: canvas가 없습니다.');
            return;
        }

        let mouseX, mouseY;

        if (canvasContent) {
            // canvas-content 기준 좌표 계산
            const canvasRect = canvas.getBoundingClientRect();
            const mouseScreenX = e.clientX;
            const mouseScreenY = e.clientY;

            // 화면 좌표를 canvas 기준 좌표로 변환
            const mouseCanvasX = mouseScreenX - canvasRect.left;
            const mouseCanvasY = mouseScreenY - canvasRect.top;

            // Transform 정보 가져오기
            const transform = canvasContent.style.transform || 'translate(0px, 0px) scale(1)';
            let transformX = 0,
                transformY = 0,
                scale = 1;

            const translateMatch = transform.match(/translate\(([^,]+)px,\s*([^)]+)px\)/);
            if (translateMatch) {
                transformX = parseFloat(translateMatch[1]) || 0;
                transformY = parseFloat(translateMatch[2]) || 0;
            }

            const scaleMatch = transform.match(/scale\(([^)]+)\)/);
            if (scaleMatch) {
                scale = parseFloat(scaleMatch[1]) || 1;
            }

            // canvas-content 기준 좌표로 변환
            // Transform을 역으로 적용: (mouseCanvas - transform) / scale
            mouseX = (mouseCanvasX - transformX) / scale;
            mouseY = (mouseCanvasY - transformY) / scale;

            logger.log('[ConnectionManager] 마우스 위치 변환:', {
                screen: { x: mouseScreenX, y: mouseScreenY },
                canvas: { x: mouseCanvasX, y: mouseCanvasY },
                transform: { x: transformX, y: transformY, scale: scale },
                content: { x: mouseX, y: mouseY }
            });
        } else {
            // 스크롤 기반 모드
            const canvasRect = canvas.getBoundingClientRect();
            mouseX = e.clientX - canvasRect.left;
            mouseY = e.clientY - canvasRect.top;
        }

        // 시작 커넥터 좌표 (이미 canvas-content 기준)
        const startPos = this.connectionManager.getConnectorPosition(this.connectionManager.startConnector);

        if (!startPos || isNaN(startPos.x) || isNaN(startPos.y)) {
            logger.warn('[ConnectionManager] 유효하지 않은 시작 커넥터 위치:', startPos);
            return;
        }

        if (isNaN(mouseX) || isNaN(mouseY)) {
            logger.warn('[ConnectionManager] 유효하지 않은 마우스 위치:', { x: mouseX, y: mouseY });
            return;
        }

        // 모든 노드의 임시 연결선에서 마우스 커서 위치(끝점) 보정
        // x좌표를 +10만큼 조정 (하드코딩)
        //
        // 용어 설명:
        // - canvas: 워크플로우 캔버스 컨테이너 (workflow-canvas)
        // - canvas-content: canvas 안에 있는 div 요소로, 노드들이 배치되는 실제 컨텐츠 영역
        //   transform(translate, scale)이 적용되어 무한 캔버스와 줌 기능을 구현함
        // - SVG: Scalable Vector Graphics, 연결선을 그리기 위한 벡터 그래픽 요소
        //   SVG는 canvas-content 안에 배치되어 있어서 canvas-content의 좌표계를 사용함
        //
        // 원인:
        // - 실제 연결선은 getConnectorPosition()으로 두 커넥터 위치를 모두 계산하므로 정확함
        // - 임시 연결선은 시작 커넥터는 getConnectorPosition()을 사용하지만, 마우스 위치는 직접 계산함
        // - 마우스 위치 변환 공식: mouseX = (mouseCanvasX - transformX) / scale
        //   * mouseCanvasX: 마우스 화면 좌표에서 canvas의 왼쪽 상단을 뺀 값 (canvas 기준 좌표)
        //   * transformX: canvas-content에 적용된 translate X 값
        //   * scale: canvas-content에 적용된 scale 값
        //   * 계산 과정: canvas 좌표에서 transform의 translate를 빼고, scale로 나눠서 canvas-content 로컬 좌표로 변환
        // - 이 변환 과정에서 canvas와 canvas-content의 좌표계 차이로 인해 약 10픽셀 정도의 오차 발생
        // - canvas-content에 transform이 적용되어 있고, SVG가 canvas-content 안에 있어서
        //   좌표 변환 시 미세한 오차가 발생하는 것으로 추정됨
        // - 실제 연결선은 두 커넥터 모두 같은 방식(getConnectorPosition)으로 계산하므로 오차가 없음
        const adjustedMouseX = mouseX - -10; // mouseX + 10과 동일

        logger.log('[ConnectionManager] 임시 연결선 업데이트:', {
            start: startPos,
            end: { x: adjustedMouseX, y: mouseY },
            originalMouse: { x: mouseX, y: mouseY }
        });

        // 임시 연결선 업데이트 (보정된 마우스 위치 사용)
        this.connectionManager.updateTempLine(startPos.x, startPos.y, adjustedMouseX, mouseY);
    }
}
