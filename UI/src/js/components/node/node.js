/**
 * 워크플로우 노드 관리 클래스
 *
 * 이 매니저는 캔버스 위에 그려지는 워크플로우 노드를 생성·관리·조작하는 모든 기능을 담당한다.
 * 주요 기능:
 * - 노드 생성, 이동, 삭제
 * - 마우스로 드래그/팬(화면 이동)
 * - Ctrl + 마우스 휠(줌 인/줌 아웃)
 * - 캔버스 크기 및 위치 관리
 * - 연결선(에지) 관리 및 미니맵과 연동
 *
 * ES6 모듈 방식으로 작성됨
 */

// Logger는 logger.js에서 로드됨
const log = window.Logger ? window.Logger.log.bind(window.Logger) : console.log;
const logWarn = window.Logger ? window.Logger.warn.bind(window.Logger) : console.warn;
const logError = window.Logger ? window.Logger.error.bind(window.Logger) : console.error;

export class NodeManager {
    constructor() {
        // === 기본 속성 초기화 ===
        this.nodes = []; // 생성된 모든 노드들의 배열
        this.selectedNode = null; // 현재 선택된 노드
        this.nodeData = {}; // 노드 데이터(위치, 설정 등 메타 정보)

        // === 무한 캔버스 관련 속성 ===
        this.isInfiniteCanvas = true; // 무한 캔버스 모드 활성화 여부
        this.canvasSize = { width: 50000, height: 50000 }; // 무한 캔버스 가상 크기

        // === 연결 모드 관련 속성 ===
        this.isConnecting = false; // 연결 모드 여부 (기본: false)
        this.connectionStart = null; // 연결 시작 정보

        // === 연결 핸들러 ===
        this.connectionHandler = null; // 연결 처리 핸들러(초기화 후 할당)

        // === 캔버스 관련 속성 ===
        this.canvas = null; // 워크플로우 캔버스 DOM 요소
        this.isCanvasFocused = false; // 캔버스에 포커스가 있는지 여부

        // === 외부 매니저 참조 ===
        this.connectionManager = null; // 노드 간 연결선 관리 객체
        this.workflowPage = null; // WorkflowPage 인스턴스 참조

        // 드래그/연결 업데이트 스로틀링 관련 플래그
        this.connectionUpdateScheduled = false;
        this.pendingConnectionUpdateNodeId = null;

        // 마그네틱 연결 거리 임계값(픽셀)
        this.magneticThreshold = 40;
        // 롱터치로 연결 그리기 활성화까지 지연(ms)
        this.longTouchDelay = 600;

        this.init();
    }

    /**
     * 초기화 메서드
     * 캔버스 설정, 이벤트 리스너 등록, 기존 노드 설정 등을 수행한다.
     */
    init() {
        // 캔버스 DOM 요소 가져오기
        this.canvas = document.getElementById('workflow-canvas');
        if (!this.canvas) {
            logError('워크플로우 캔버스를 찾을 수 없습니다.');
            return;
        }

        // 전역 이벤트 리스너 등록
        this.setupEventListeners();

        // 이미 존재하는 노드들에 이벤트 리스너 바인딩
        this.setupExistingNodes();

        // 컨트롤러(선택/드래그/캔버스/연결) 스크립트 로드를 기다렸다가 초기화
        this.waitForControllersAndInitialize();

        // 외부 매니저(연결 관리자 등) 초기화
        setTimeout(() => {
            this.initializeExternalManagers();
        }, 100);
    }

    /**
     * 컨트롤러 스크립트가 로드될 때까지 기다렸다가 초기화
     */
    waitForControllersAndInitialize(maxAttempts = 20, attempt = 0) {
        const requiredControllers = [
            'NodeSelectionController',
            'NodeDragController',
            'NodeCanvasController',
            'NodeConnectionHandler'
        ];

        // allLoaded: 모든 필수 컨트롤러가 로드되었는지 여부
        const allLoaded = requiredControllers.every((name) => typeof window[name] === 'function');

        // 모든 컨트롤러가 로드되었거나 최대 시도 횟수에 도달했으면 초기화
        if (allLoaded || attempt >= maxAttempts) {
            // 모든 컨트롤러가 로드되었으면 초기화 시작
            if (allLoaded) {
                log('모든 컨트롤러 스크립트 로드 완료, 초기화 시작');
            } else {
                // 일부 컨트롤러를 찾을 수 없으면 경고 출력 (기본 동작으로 진행)
                logWarn('일부 컨트롤러를 찾을 수 없습니다. 기본 동작으로 진행합니다.');
            }
            // 컨트롤러 초기화 실행
            this.initializeControllers();
        } else {
            // 아직 로드되지 않았으면 50ms 후 재시도
            setTimeout(() => {
                this.waitForControllersAndInitialize(maxAttempts, attempt + 1);
            }, 50);
        }
    }

    /**
     * 컨트롤러 인스턴스 초기화
     * (선택, 드래그, 캔버스, 연결 핸들러 등)
     */
    initializeControllers() {
        // 선택 컨트롤러
        if (typeof window.NodeSelectionController === 'function') {
            this.selectionController = new window.NodeSelectionController(this);
        } else {
            logWarn('NodeSelectionController 를 찾을 수 없습니다. (선택 기능 기본 모드로 동작)');
            this.selectionController = null;
        }

        // 드래그 컨트롤러
        if (typeof window.NodeDragController === 'function') {
            this.dragController = new window.NodeDragController(this);
        } else {
            logWarn('NodeDragController 를 찾을 수 없습니다. (드래그 기능 비활성)');
            this.dragController = null;
        }

        // 캔버스 컨트롤러
        if (typeof window.NodeCanvasController === 'function') {
            this.canvasController = new window.NodeCanvasController(this);

            // 캔버스 이벤트(팬/줌 등) 바인딩
            this.canvasController.bindEvents();

            // 무한 캔버스 모드일 때 초기 위치 보정
            this.canvasController.ensureCanvasScrollable();
        } else {
            logWarn('NodeCanvasController 를 찾을 수 없습니다. (기본 캔버스 모드)');
            this.canvasController = null;
        }

        // 연결 핸들러 초기화
        if (typeof window.NodeConnectionHandler === 'function') {
            this.connectionHandler = new window.NodeConnectionHandler(this);
        } else {
            logWarn('NodeConnectionHandler 를 찾을 수 없습니다. (연결 기능 비활성)');
            this.connectionHandler = null;
        }

        // 컨트롤러 초기화 후 기존 노드들에 이벤트 리스너 다시 바인딩
        this.setupExistingNodes();
    }

    // === 선택 관련 래퍼 메서드 ===
    selectNode(node) {
        if (this.selectionController) {
            this.selectionController.selectNode(node);
        }
    }

    deselectNode() {
        if (this.selectionController) {
            this.selectionController.deselectNode();
        }
    }

    // === 상태 조회용 getter (connection.js 등에서 사용) ===
    get isDragging() {
        // dragController가 있으면 드래그 상태 반환, 없으면 false
        return this.dragController ? this.dragController.isDragging : false;
    }

    get isPanning() {
        // canvasController가 있으면 패닝 상태 반환, 없으면 false
        return this.canvasController ? this.canvasController.isPanning : false;
    }

    /**
     * 외부 매니저 초기화
     * 연결 관리자, 미니맵 관리자 등을 초기화한다.
     */
    initializeExternalManagers() {
        // 연결 관리자 초기화
        // ConnectionManager가 있고 아직 초기화되지 않았으면 초기화
        if (window.ConnectionManager && !this.connectionManager) {
            // connectionManager: 연결 관리자 인스턴스 (연결선 관리용)
            this.connectionManager = new window.ConnectionManager(this.canvas);
            // 전역 변수로도 노출 (다른 모듈에서 접근 가능하도록)
            if (window.setConnectionManager) {
                window.setConnectionManager(this.connectionManager);
            }
            log('연결 관리자 초기화 완료');
        } else if (!window.ConnectionManager) {
            // ConnectionManager 클래스를 찾을 수 없으면 경고 출력
            logWarn('ConnectionManager 클래스를 찾을 수 없습니다.');
        }
    }

    /**
     * 전역 이벤트 리스너 설정
     * 마우스 정보와 키보드 입력 등 공통 이벤트를 처리한다.
     */
    setupEventListeners() {
        // === 연결 모드 관련 이벤트 ===

        // 캔버스 클릭 시 연결 모드 취소
        this.canvas.addEventListener('click', (e) => {
            if (e.target === this.canvas) {
                if (this.isConnecting) {
                    this.cancelConnection();
                } else if (this.connectionHandler && this.connectionHandler.isClickConnecting) {
                    this.connectionHandler.cancelClickConnection();
                }
            }
        });

        // 마우스 이동 시 클릭 기반 연결선 업데이트
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.connectionHandler && this.connectionHandler.isClickConnecting) {
                this.connectionHandler.updateClickConnectionLine(e);
            }
        });

        // ESC 키로 연결 모드 취소
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.isConnecting) {
                    e.preventDefault();
                    this.cancelConnection();
                } else if (this.connectionHandler && this.connectionHandler.isClickConnecting) {
                    e.preventDefault();
                    this.connectionHandler.cancelClickConnection();
                }
            }
        });
    }

    /**
     * 기존 노드에 이벤트 리스너 설정
     * 페이지 로드 시 이미 존재하는 노드들에 대해 설정한다.
     */
    setupExistingNodes() {
        const existingNodes = document.querySelectorAll('.workflow-node');
        existingNodes.forEach((node) => {
            this.setupNodeEventListeners(node);
        });
    }

    /**
     * 개별 노드에 이벤트 리스너 설정
     * 노드 클릭, 드래그, 선택 등 이벤트를 처리한다.
     */
    setupNodeEventListeners(node) {
        // 클릭으로 선택 (NodeManager가 직접 처리)
        node.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectNode(node);
        });

        // 더블클릭으로 노드 설정 모달 열기
        node.addEventListener('dblclick', (e) => {
            // 입력/출력 커넥터를 더블클릭한 경우 노드 설정 모달을 열지 않음
            const target = e.target;
            if (
                target.classList.contains('node-input') ||
                target.classList.contains('node-output') ||
                target.closest('.node-input') ||
                target.closest('.node-output')
            ) {
                return; // 커넥터의 더블클릭 이벤트가 처리하도록 함
            }

            e.stopPropagation();
            e.preventDefault();
            this.openNodeSettings(node);
        });

        // 설정 톱니바퀴 아이콘 클릭 시 노드 설정 모달 열기
        const settingsBtn = node.querySelector('.node-settings');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.openNodeSettings(node);
            });
        }

        // 드래그는 드래그 컨트롤러에 위임
        if (this.dragController) {
            this.dragController.attachNode(node);
        }
    }

    /**
     * WorkflowPage 인스턴스 설정
     * @param {WorkflowPage} workflowPage - WorkflowPage 인스턴스
     */
    setWorkflowPage(workflowPage) {
        this.workflowPage = workflowPage;
    }

    /**
     * 노드 설정 모달 열기
     * @param {HTMLElement} node - 설정할 노드 요소
     */
    openNodeSettings(node) {
        // WorkflowPage의 showNodeSettingsModal 호출
        if (this.workflowPage && typeof this.workflowPage.showNodeSettingsModal === 'function') {
            this.workflowPage.showNodeSettingsModal(node);
        } else {
            logWarn('WorkflowPage의 showNodeSettingsModal을 찾을 수 없습니다.');
        }
    }

    // ==========================================
    // 노드 생성 관련 메서드들
    // ==========================================

    /**
     * 노드 생성 (메인 메서드)
     * 새로운 워크플로우 노드를 생성하고 캔버스에 추가한다.
     *
     * @param {Object} nodeData - 노드 데이터
     * @param {string} nodeData.id - 노드 ID
     * @param {string} nodeData.title - 노드 제목
     * @param {string} nodeData.type - 노드 타입('action' | 'condition' 등)
     * @param {number} nodeData.x - X 좌표
     * @param {number} nodeData.y - Y 좌표
     * @returns {HTMLElement} 생성된 노드 요소
     */
    createNode(nodeData) {
        try {
            // 1. 기본 노드 DOM 요소 생성
            const nodeElement = this.createNodeElement(nodeData);

            // 2. 노드 내부 콘텐츠 생성
            const nodeContent = this.generateNodeContent(nodeData);
            nodeElement.innerHTML = nodeContent;

            // 3. 노드 이벤트 리스너 바인딩
            this.setupNodeEventListeners(nodeElement);

            // 4. 연결 이벤트 설정
            if (this.connectionHandler) {
                this.connectionHandler.setupConnectionEvents(nodeElement);
            }

            // 5. 캔버스에 추가
            this.addNodeToCanvas(nodeElement);

            // 5-1. 노드 크기 조정 (텍스트 길이에 따라)
            this.adjustNodeSize(nodeElement);

            // 5-2. 아래 연결점 위치 조정 (반복 노드 등)
            this.adjustBottomOutputPosition(nodeElement);

            // 6. 노드 데이터 저장
            this.saveNodeData(nodeData);

            // 7. 내부 nodes 배열에 등록
            this.nodes.push({
                id: nodeData.id,
                data: nodeData,
                element: nodeElement
            });

            // 8. ConnectionManager에 노드 커넥터 바인딩
            this.registerNodeWithConnectionManager(nodeElement);

            log(`노드 생성 완료: ${nodeData.id} (${nodeData.title})`);
            return nodeElement;
        } catch (error) {
            logError('노드 생성 실패:', error);
            throw error;
        }
    }

    /**
     * 노드 DOM 요소 생성
     * @param {Object} nodeData - 노드 데이터
     * @returns {HTMLElement} 노드 요소
     */
    createNodeElement(nodeData) {
        const nodeElement = document.createElement('div');
        nodeElement.className = 'workflow-node';
        nodeElement.id = nodeData.id;
        nodeElement.dataset.nodeId = nodeData.id;
        // 노드 타입을 data 속성에 저장 (연결 검증 시 사용)
        if (nodeData.type) {
            nodeElement.dataset.nodeType = nodeData.type;
        }
        nodeElement.style.left = nodeData.x + 'px';
        nodeElement.style.top = nodeData.y + 'px';

        log(`노드 DOM 생성: ${nodeData.id} 위치 (${nodeData.x}, ${nodeData.y}) 타입: ${nodeData.type || 'undefined'}`);

        return nodeElement;
    }

    /**
     * 노드 내부 HTML 생성
     * @param {Object} nodeData - 노드 데이터
     * @returns {string} HTML 문자열
     */
    generateNodeContent(nodeData) {
        // nodeManager.nodeData와 병합하여 최신 파라미터 값 포함
        const nodeId = nodeData.id;
        let mergedNodeData = { ...nodeData };

        // nodeManager.nodeData에 저장된 데이터와 병합 (파라미터 등 최신 값 포함)
        if (nodeId && this.nodeData && this.nodeData[nodeId]) {
            mergedNodeData = {
                ...this.nodeData[nodeId],
                ...nodeData // 전달된 nodeData가 우선순위 높음
            };
        }

        // 정적 노드 타입 정의 레지스트리에서 타입별 렌더러를 찾는다.
        const registry = this.constructor.nodeTypeDefinitions || {};

        log(
            `[NodeManager] generateNodeContent 호출: type=${mergedNodeData.type}, registry keys:`,
            Object.keys(registry)
        );

        // 우선순위: 명시된 type → 'action' → 'default'
        const def = registry[mergedNodeData.type] || registry['action'] || registry['default'];

        if (def && typeof def.renderContent === 'function') {
            log(`[NodeManager] 노드 타입 '${mergedNodeData.type}' 렌더러 사용`);
            // renderContent 내부에서 this.escapeHtml 등을 쓸 수 있게 this 바인딩
            return def.renderContent.call(this, mergedNodeData);
        }

        log(`[NodeManager] ⚠️ 노드 타입 '${mergedNodeData.type}'에 대한 렌더러를 찾을 수 없음. 기본 형태로 렌더링`);
        // 어떠한 정의도 등록되어 있지 않을 경우 기본 형태로 렌더링
        const icon = window.NodeIcons ? window.NodeIcons.getIcon('default', mergedNodeData) : '⚙';
        return `
            <div class="node-input"></div>
            <div class="node-content">
                <div class="node-icon-box">
                    <div class="node-icon">${icon}</div>
                </div>
                <div class="node-text-area">
                    <div class="node-title">${this.escapeHtml(mergedNodeData.title)}</div>
                    <div class="node-description">${this.escapeHtml(mergedNodeData.description || '')}</div>
                </div>
            </div>
            <div class="node-output"></div>
            <div class="node-settings"></div>
        `;
    }

    /**
     * 연결 관련 이벤트 설정 (connectionHandler 위임용)
     * @param {HTMLElement} nodeElement - 노드 요소
     */
    setupConnectionEvents(nodeElement) {
        if (this.connectionHandler) {
            this.connectionHandler.setupConnectionEvents(nodeElement);
        }
    }

    /**
     * 입력 커넥터 이벤트 설정
     * @param {HTMLElement} inputConnector - 입력 커넥터 요소
     * @param {HTMLElement} nodeElement - 노드 요소
     */
    setupInputConnectorEvents(inputConnector, nodeElement) {
        // ConnectionManager가 필수로 있어야 함
        const connectionManager = this.connectionManager || window.connectionManager;
        if (!connectionManager) {
            console.error('[NodeManager] ConnectionManager가 없습니다. 입력 커넥터 이벤트를 설정할 수 없습니다.');
            return;
        }

        // ConnectionManager가 있으면 클릭 이벤트는 ConnectionManager가 처리
        // 여기서는 더블클릭만 처리
        inputConnector.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.handleConnectorDoubleClick(inputConnector, nodeElement, 'input');
        });

        // 현재 연결 상태 반영
        const connections = this.findConnectionsByNode(nodeElement.dataset.nodeId, 'input');
        this.updateConnectorVisualState(inputConnector, connections.length > 0);

        inputConnector.addEventListener('mouseenter', () => {
            const tooltipText = connections.length > 0 ? `입력 커넥터 (연결 ${connections.length}개)` : '입력 커넥터';
            this.showConnectorTooltip(inputConnector, tooltipText);
        });

        inputConnector.addEventListener('mouseleave', () => {
            this.hideConnectorTooltip();
        });
    }

    /**
     * 출력 커넥터 이벤트 설정
     * @param {HTMLElement} outputConnector - 출력 커넥터 요소
     * @param {HTMLElement} nodeElement - 노드 요소
     */
    setupOutputConnectorEvents(outputConnector, nodeElement) {
        // ConnectionManager가 필수로 있어야 함
        const connectionManager = this.connectionManager || window.connectionManager;
        if (!connectionManager) {
            console.error('[NodeManager] ConnectionManager가 없습니다. 출력 커넥터 이벤트를 설정할 수 없습니다.');
            return;
        }

        // ConnectionManager가 있으면 클릭 이벤트는 ConnectionManager가 처리
        // 여기서는 더블클릭만 처리
        outputConnector.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.handleConnectorDoubleClick(outputConnector, nodeElement, 'output');
        });

        // 현재 연결 상태 반영
        const outputConnections = this.findConnectionsByNode(nodeElement.dataset.nodeId, 'output');
        this.updateConnectorVisualState(outputConnector, outputConnections.length > 0);

        outputConnector.addEventListener('mouseenter', () => {
            const label = outputConnector.querySelector('.output-label');
            const baseText = label ? label.textContent : '출력 커넥터';
            const tooltipText =
                outputConnections.length > 0 ? `${baseText} (연결 ${outputConnections.length}개)` : baseText;
            this.showConnectorTooltip(outputConnector, tooltipText);
        });

        outputConnector.addEventListener('mouseleave', () => {
            this.hideConnectorTooltip();
        });
    }

    /**
     * 입력 커넥터 클릭 처리
     * @param {HTMLElement} inputConnector
     * @param {HTMLElement} nodeElement
     */
    handleInputConnectorClick(inputConnector, nodeElement) {
        const nodeId = nodeElement.dataset.nodeId;

        if (this.isClickConnecting) {
            // 이미 클릭 연결 모드인 경우: 연결 완료
            this.completeClickConnection(nodeId, 'input');
        } else {
            // 클릭 연결 모드가 아닌 경우: 입력에서 시작
            this.startClickConnectionFromInput(inputConnector, nodeElement);
        }
    }

    /**
     * 클릭 기반 연결 시작 (출력 커넥터에서 시작)
     * @param {HTMLElement} outputConnector
     * @param {HTMLElement} nodeElement
     */
    startClickConnection(outputConnector, nodeElement) {
        log('출력 커넥터에서 클릭 연결 시작');

        const nodeId = nodeElement.dataset.nodeId;
        // .output-dot이 클릭된 경우 부모 요소(.true-output 또는 .false-output)를 확인
        const outputType =
            outputConnector.classList.contains('true-output') || outputConnector.closest('.true-output')
                ? 'true'
                : outputConnector.classList.contains('false-output') || outputConnector.closest('.false-output')
                  ? 'false'
                  : 'default';

        // 클릭 연결 상태 설정
        this.isClickConnecting = true;
        this.clickConnectionStart = {
            nodeId,
            outputType,
            connector: outputConnector,
            isFromOutput: true
        };

        // 시작 커넥터 하이라이트
        outputConnector.style.backgroundColor = '#FF6B35';
        outputConnector.style.borderColor = '#FF6B35';
        outputConnector.style.boxShadow = '0 0 15px rgba(255, 107, 53, 0.8)';

        // 임시 연결선 생성
        const startPos = this.getConnectorPosition(outputConnector);
        this.createTempConnectionLine(startPos.x, startPos.y);

        // 안내 메시지 표시
        this.showClickConnectionMessage('연결할 입력 커넥터를 클릭하세요.');

        // 입력 커넥터들을 활성 상태로 전환
        this.activateInputConnectors();

        log(`출력 커넥터 클릭 연결 시작: ${nodeId} (${outputType})`);
    }

    /**
     * 클릭 기반 연결 시작 (입력 커넥터에서 시작)
     * @param {HTMLElement} inputConnector
     * @param {HTMLElement} nodeElement
     */
    startClickConnectionFromInput(inputConnector, nodeElement) {
        log('입력 커넥터에서 클릭 연결 시작');

        const nodeId = nodeElement.dataset.nodeId;

        // 클릭 연결 상태 설정
        this.isClickConnecting = true;
        this.clickConnectionStart = {
            nodeId,
            outputType: 'input',
            connector: inputConnector,
            isFromOutput: false
        };

        // 시작 커넥터 하이라이트
        inputConnector.style.backgroundColor = '#FF6B35';
        inputConnector.style.borderColor = '#FF6B35';
        inputConnector.style.boxShadow = '0 0 15px rgba(255, 107, 53, 0.8)';

        // 임시 연결선 생성
        const startPos = this.getConnectorPosition(inputConnector);
        this.createTempConnectionLine(startPos.x, startPos.y);

        // 안내 메시지 표시
        this.showClickConnectionMessage('연결할 출력 커넥터를 클릭하세요.');

        // 출력 커넥터들을 활성 상태로 전환
        this.activateOutputConnectors();

        log(`입력 커넥터에서 클릭 연결 시작: ${nodeId}`);
    }

    /**
     * 클릭 기반 연결 완료
     * @param {string} nodeId - 대상 노드 ID
     * @param {string} connectorType - 대상 커넥터 타입
     */
    completeClickConnection(nodeId, connectorType) {
        if (!this.isClickConnecting || !this.clickConnectionStart) {
            logWarn('클릭 연결 모드가 활성화되어 있지 않습니다.');
            return;
        }

        const startNodeId = this.clickConnectionStart.nodeId;
        const startOutputType = this.clickConnectionStart.outputType;
        const isFromOutput = this.clickConnectionStart.isFromOutput;

        // 방향에 따라 유효성 검사
        let isValid = false;
        if (isFromOutput) {
            // 출력 → 입력 (조건 노드의 경우 outputType 전달)
            const outputType = startOutputType === 'true' || startOutputType === 'false' ? startOutputType : null;
            isValid = this.validateConnection(startNodeId, nodeId, 'output', 'input', outputType);
        } else {
            // 입력 → 출력
            isValid = this.validateConnection(nodeId, startNodeId, 'input', 'output');
        }

        if (!isValid) {
            this.cancelClickConnection();
            return;
        }

        // 실제 연결 생성
        if (isFromOutput) {
            this.createNodeConnection(startNodeId, nodeId, startOutputType, connectorType);
        } else {
            this.createNodeConnection(nodeId, startNodeId, connectorType, 'input');
        }

        // 클릭 연결 정리
        this.cleanupClickConnection();

        log(`클릭 연결 완료: ${startNodeId}(${startOutputType}) → ${nodeId}(${connectorType})`);
    }

    /**
     * 클릭 연결 취소
     * ESC 또는 빈 캔버스 클릭 시 호출된다.
     */
    cancelClickConnection() {
        log('클릭 연결 취소');
        this.cleanupClickConnection();
    }

    /**
     * 클릭 연결 정리
     * 상태 및 UI를 초기화한다.
     */
    cleanupClickConnection() {
        this.isClickConnecting = false;

        // 시작 커넥터 비주얼 초기화
        if (this.clickConnectionStart && this.clickConnectionStart.connector) {
            this.updateConnectorVisualState(this.clickConnectionStart.connector, false);
        }

        // 임시 연결선 제거
        this.removeTempConnectionLine();

        // 모든 커넥터 비활성화
        this.deactivateAllConnectors();

        // 안내 메시지 제거
        this.hideClickConnectionMessage();

        // 상태 초기화
        this.clickConnectionStart = null;
    }

    /**
     * 클릭 연결 안내 메시지 표시
     * @param {string} text - 표시할 메시지
     */
    showClickConnectionMessage(text = '연결할 입력 커넥터를 클릭하세요.') {
        const existing = document.getElementById('click-connection-message');
        if (existing) {
            existing.remove();
        }

        const message = document.createElement('div');
        message.id = 'click-connection-message';
        message.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            font-size: 14px;
            z-index: 1001;
            pointer-events: none;
        `;
        message.textContent = text;

        document.body.appendChild(message);
    }

    /**
     * 클릭 연결 안내 메시지 숨기기
     */
    hideClickConnectionMessage() {
        const message = document.getElementById('click-connection-message');
        if (message) {
            message.remove();
        }
    }

    /**
     * 클릭 연결 진행 중 임시 연결선 업데이트
     * @param {MouseEvent} e
     */
    updateClickConnectionLine(e) {
        if (!this.isClickConnecting || !this.clickConnectionStart || !this.tempConnectionLine) {
            return;
        }

        const startConnector = this.clickConnectionStart.connector;
        const startPos = this.getConnectorPosition(startConnector);

        // 마우스 위치를 캔버스 기준 좌표로 변환
        const canvasRect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - canvasRect.left;
        const mouseY = e.clientY - canvasRect.top;

        // 임시 연결선 업데이트
        this.updateTempConnectionLine(startPos, { x: mouseX, y: mouseY });

        // 마그네틱 효과: 근처 입력 커넥터 하이라이트
        this.highlightNearbyInputConnector(mouseX, mouseY);
    }

    /**
     * 근처 입력 커넥터 하이라이트
     * @param {number} mouseX
     * @param {number} mouseY
     */
    highlightNearbyInputConnector(mouseX, mouseY) {
        // 모든 입력 커넥터 조회
        const inputConnectors = document.querySelectorAll('.node-input');
        let nearestConnector = null;
        let minDistance = this.magneticThreshold;

        inputConnectors.forEach((connector) => {
            const pos = this.getConnectorPosition(connector);
            const distance = Math.sqrt(Math.pow(mouseX - pos.x, 2) + Math.pow(mouseY - pos.y, 2));

            if (distance < minDistance) {
                minDistance = distance;
                nearestConnector = connector;
            }
        });

        // 기존 하이라이트 제거
        inputConnectors.forEach((connector) => {
            connector.classList.remove('magnetic-highlight');
        });

        // 가장 가까운 커넥터 하이라이트
        if (nearestConnector) {
            nearestConnector.classList.add('magnetic-highlight');
        }
    }

    /**
     * 커넥터 위치 계산
     * @param {HTMLElement} connector
     * @returns {{x:number,y:number}}
     */
    getConnectorPosition(connector) {
        // transform 기반 무한 캔버스 모드(canvas-content 존재)
        const canvasContent = document.getElementById('canvas-content');

        if (canvasContent) {
            const transform = canvasContent.style.transform;
            let transformX = 0,
                transformY = 0;

            if (transform && transform !== 'none') {
                const match = transform.match(/translate\(([^,]+)px,\s*([^)]+)px\)/);
                if (match) {
                    transformX = parseFloat(match[1]);
                    transformY = parseFloat(match[2]);
                }
            }

            const connectorRect = connector.getBoundingClientRect();
            const canvasRect = this.canvas.getBoundingClientRect();

            const relativeX = connectorRect.left - canvasRect.left + connectorRect.width / 2;
            const relativeY = connectorRect.top - canvasRect.top + connectorRect.height / 2;

            const actualX = relativeX - transformX;
            const actualY = relativeY - transformY;

            return { x: actualX, y: actualY };
        } else {
            // 일반 스크롤 기반 모드
            const rect = connector.getBoundingClientRect();
            const canvasRect = this.canvas.getBoundingClientRect();

            const relativeX = rect.left - canvasRect.left + rect.width / 2;
            const relativeY = rect.top - canvasRect.top + rect.height / 2;

            return { x: relativeX, y: relativeY };
        }
    }

    /**
     * 드래그 기반 연결 시작
     * @param {MouseEvent} e
     * @param {HTMLElement} outputConnector
     * @param {HTMLElement} nodeElement
     */
    startDragConnection(e, outputConnector, nodeElement) {
        log('드래그 연결 시작');

        const nodeId = nodeElement.dataset.nodeId;
        // .output-dot이 클릭된 경우 부모 요소(.true-output 또는 .false-output)를 확인
        const outputType =
            outputConnector.classList.contains('true-output') || outputConnector.closest('.true-output')
                ? 'true'
                : outputConnector.classList.contains('false-output') || outputConnector.closest('.false-output')
                  ? 'false'
                  : 'default';

        // 드래그 연결 상태 설정
        this.isDraggingConnection = true;
        this.dragConnectionStart = {
            nodeId,
            outputType,
            connector: outputConnector,
            // 시작 시점 커넥터 기준 캔버스 좌표를 고정해 둔다.
            ...(() => {
                const p = this.getConnectorPosition(outputConnector);
                return { startCanvasX: p.x, startCanvasY: p.y };
            })()
        };

        // 시작 커넥터 하이라이트
        outputConnector.style.backgroundColor = '#FF6B35';
        outputConnector.style.borderColor = '#FF6B35';
        outputConnector.style.boxShadow = '0 0 15px rgba(255, 107, 53, 0.8)';

        // 임시 연결선 생성
        this.createTempConnectionLine(this.dragConnectionStart.startCanvasX, this.dragConnectionStart.startCanvasY);

        // 전역 마우스 이벤트 등록
        document.addEventListener('mousemove', this.handleDragConnectionMove);
        document.addEventListener('mouseup', this.handleDragConnectionEnd);

        // 안내 메시지 표시
        this.showDragConnectionMessage();

        log(`드래그 연결 시작: ${nodeId} (${outputType})`);
    }

    /**
     * 드래그 연결 이동 처리
     */
    handleDragConnectionMove = (e) => {
        if (!this.isDraggingConnection) {
            return;
        }

        // 마우스 위치를 캔버스 기준 좌표로 변환
        const canvasRect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - canvasRect.left;
        const mouseY = e.clientY - canvasRect.top;

        // 임시 연결선 업데이트
        this.updateTempConnectionLine(
            { x: this.dragConnectionStart.startCanvasX, y: this.dragConnectionStart.startCanvasY },
            { x: mouseX, y: mouseY }
        );

        // 가까운 입력 커넥터 찾기(마그네틱 효과)
        const nearbyInputConnector = this.findNearbyInputConnector(e.clientX, e.clientY);

        // 기존 하이라이트 제거
        this.clearAllConnectorHighlights();

        // 가까운 입력 커넥터 하이라이트
        if (nearbyInputConnector) {
            this.highlightConnector(nearbyInputConnector);
        }
    };

    /**
     * 드래그 연결 종료 처리
     */
    handleDragConnectionEnd = (e) => {
        if (!this.isDraggingConnection) {
            return;
        }

        const nearbyInputConnector = this.findNearbyInputConnector(e.clientX, e.clientY);

        if (nearbyInputConnector) {
            // 연결 완료
            this.completeDragConnection(nearbyInputConnector);
        } else {
            // 연결 취소
            this.cancelDragConnection();
        }
    };

    /**
     * 마우스 기준 가장 가까운 입력 커넥터 찾기
     */
    findNearbyInputConnector(mouseX, mouseY) {
        const inputConnectors = this.canvas.querySelectorAll('.node-input');
        let closestConnector = null;
        let closestDistance = this.magneticThreshold;

        inputConnectors.forEach((connector) => {
            const rect = connector.getBoundingClientRect();
            const connectorX = rect.left + rect.width / 2;
            const connectorY = rect.top + rect.height / 2;

            const distance = Math.sqrt(Math.pow(mouseX - connectorX, 2) + Math.pow(mouseY - connectorY, 2));

            if (distance < closestDistance) {
                closestDistance = distance;
                closestConnector = connector;
            }
        });

        return closestConnector;
    }

    /**
     * 드래그 연결 완료
     */
    completeDragConnection(targetInputConnector) {
        if (!this.dragConnectionStart || !targetInputConnector) {
            return;
        }

        const targetNode = targetInputConnector.closest('.workflow-node');
        if (!targetNode) {
            return;
        }

        const targetNodeId = targetNode.dataset.nodeId;
        const startNodeId = this.dragConnectionStart.nodeId;
        const outputType = this.dragConnectionStart.outputType;

        log(`드래그 연결 완료: ${startNodeId}(${outputType}) → ${targetNodeId}(input)`);

        // 연결 유효성 검증
        const isValid = this.validateConnection(startNodeId, targetNodeId, outputType, 'input');
        if (!isValid) {
            this.cleanupDragConnection();
            return;
        }

        // 실제 연결 생성
        this.createNodeConnection(startNodeId, targetNodeId, outputType, 'input');

        // 드래그 연결 정리
        this.cleanupDragConnection();

        log('드래그 연결 처리 완료');
    }

    /**
     * 드래그 연결 취소
     */
    cancelDragConnection() {
        log('드래그 연결 취소');
        this.cleanupDragConnection();
    }

    /**
     * 드래그 연결 정리
     */
    cleanupDragConnection() {
        this.isDraggingConnection = false;

        // 시작 커넥터 비주얼 초기화
        if (this.dragConnectionStart && this.dragConnectionStart.connector) {
            this.updateConnectorVisualState(this.dragConnectionStart.connector, false);
        }

        // 전역 이벤트 해제
        document.removeEventListener('mousemove', this.handleDragConnectionMove);
        document.removeEventListener('mouseup', this.handleDragConnectionEnd);

        // 임시 연결선 제거
        this.removeTempConnectionLine();

        // 모든 커넥터 하이라이트 제거
        this.clearAllConnectorHighlights();

        // 안내 메시지 숨기기
        this.hideDragConnectionMessage();

        // 상태 초기화
        this.dragConnectionStart = null;
    }

    /**
     * 임시 연결선 생성 (SVG)
     */
    createTempConnectionLine(startX, startY) {
        // 기존 임시 연결선 제거
        this.removeTempConnectionLine();

        const canvasRect = this.canvas.getBoundingClientRect();

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = 'temp-connection-line';
        svg.style.cssText = `
            position: fixed;
            top: ${canvasRect.top}px;
            left: ${canvasRect.left}px;
            width: ${canvasRect.width}px;
            height: ${canvasRect.height}px;
            pointer-events: none;
            z-index: 1000;
        `;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('stroke', '#FF6B35');
        path.setAttribute('stroke-width', '3');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-dasharray', '5,5');
        path.setAttribute('d', `M ${startX} ${startY} L ${startX} ${startY}`);

        svg.appendChild(path);
        document.body.appendChild(svg);

        this.tempConnectionLine = { svg, path };
    }

    /**
     * 임시 연결선 업데이트
     */
    updateTempConnectionLine(startPos, endPos) {
        if (!this.tempConnectionLine) {
            return;
        }

        const startX = startPos.x;
        const startY = startPos.y;
        const currentX = endPos.x;
        const currentY = endPos.y;

        // 베지어 곡선을 이용해 부드러운 연결선 그리기
        const controlPoint1X = startX + (currentX - startX) * 0.5;
        const controlPoint1Y = startY;
        const controlPoint2X = startX + (currentX - startX) * 0.5;
        const controlPoint2Y = currentY;

        const pathData = `M ${startX} ${startY} C ${controlPoint1X} ${controlPoint1Y}, ${controlPoint2X} ${controlPoint2Y}, ${currentX} ${currentY}`;
        this.tempConnectionLine.path.setAttribute('d', pathData);
    }

    /**
     * 임시 연결선 제거
     */
    removeTempConnectionLine() {
        if (this.tempConnectionLine && this.tempConnectionLine.svg) {
            this.tempConnectionLine.svg.remove();
            this.tempConnectionLine = null;
        }
    }

    /**
     * 드래그 연결 안내 메시지 표시
     */
    showDragConnectionMessage() {
        const existing = document.getElementById('drag-connection-message');
        if (existing) {
            existing.remove();
        }

        const message = document.createElement('div');
        message.id = 'drag-connection-message';
        message.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            font-size: 14px;
            z-index: 1001;
            pointer-events: none;
        `;
        message.textContent = '입력 커넥터 쪽으로 드래그하여 연결하세요.';

        document.body.appendChild(message);
    }

    /**
     * 드래그 연결 안내 메시지 숨기기
     */
    hideDragConnectionMessage() {
        const message = document.getElementById('drag-connection-message');
        if (message) {
            message.remove();
        }
    }

    /**
     * 커넥터 더블클릭 처리
     * 연결점에서 더블클릭하면 해당 노드의 관련 연결을 삭제한다.
     */
    handleConnectorDoubleClick(connector, nodeElement, connectorType) {
        const nodeId = nodeElement.dataset.nodeId;

        try {
            // 출력 타입 감지 (조건 노드, 반복 노드의 경우)
            let outputType = null;
            if (connectorType === 'output' && connector) {
                if (connector.classList.contains('true-output') || connector.closest('.true-output')) {
                    outputType = 'true';
                } else if (connector.classList.contains('false-output') || connector.closest('.false-output')) {
                    outputType = 'false';
                } else if (
                    connector.classList.contains('node-bottom-output') ||
                    connector.closest('.node-bottom-output') ||
                    connector.classList.contains('bottom-output-dot') ||
                    connector.closest('.bottom-output-dot')
                ) {
                    // 반복 노드의 아래 연결점인 경우
                    outputType = 'bottom';
                }
                // 일반 출력 연결점인 경우 outputType은 null로 유지
            } else if (connectorType === 'bottom' && connector) {
                // 아래 연결점 타입인 경우
                outputType = 'bottom';
            }

            // 연결 목록 조회 (조건 노드, 반복 노드의 경우 outputType 고려)
            const connections = this.findConnectionsByNode(nodeId, connectorType, outputType);

            if (connections.length === 0) {
                log(`노드 ${nodeId} 의 ${connectorType} 커넥터에는 연결이 없습니다.`);
                this.showConnectorTooltip(connector, '연결이 없습니다.');
                setTimeout(() => this.hideConnectorTooltip(), 2000);
                return;
            }

            // 연결 삭제
            connections.forEach((connection) => {
                this.deleteConnectionByConnectionId(connection.id);
            });

            // 피드백
            this.showConnectionDeletedFeedback(connector, connections.length);

            // 커넥터 비주얼 상태 업데이트
            setTimeout(() => {
                this.updateAllConnectorsVisualState();
            }, 100);

            log(
                `노드 ${nodeId} 의 ${connectorType} 커넥터에서 연결 ${connections.length}개 삭제 (outputType: ${outputType || 'null'})`
            );
        } catch (error) {
            logError('연결 삭제 실패:', error);
        }
    }

    /**
     * 특정 노드의 커넥터에 연결된 연결들 조회
     * @param {string} nodeId - 노드 ID
     * @param {string} connectorType - 커넥터 타입 ('input' 또는 'output')
     * @param {string} outputType - 출력 타입 ('true', 'false', 또는 null) - 조건 노드의 경우에만 사용
     */
    findConnectionsByNode(nodeId, connectorType, outputType = null) {
        if (!this.connectionManager || !this.connectionManager.connections) {
            return [];
        }

        // 노드 타입 확인 (반복 노드의 경우 아래 연결점 제외 처리)
        const node = this.nodes.find((n) => n.id === nodeId);
        const nodeType = node ? this.nodeData[nodeId]?.type || node.element?.dataset?.nodeType : null;
        const isRepeatNode = nodeType === 'repeat';

        const connections = [];
        this.connectionManager.connections.forEach((connection, connectionId) => {
            if (connectorType === 'input' && connection.to === nodeId) {
                connections.push({ id: connectionId, ...connection });
            } else if (connectorType === 'output' && connection.from === nodeId) {
                // 조건 노드의 경우, 같은 outputType을 가진 연결만 반환
                if (outputType) {
                    if (connection.outputType === outputType) {
                        connections.push({ id: connectionId, ...connection });
                    }
                } else {
                    // 반복 노드의 경우, 일반 출력 연결점을 더블클릭하면 아래 연결점(bottom)은 제외
                    if (isRepeatNode) {
                        // 반복 노드에서 일반 출력 연결점을 더블클릭한 경우, 아래 연결점(bottom) 제외
                        if (connection.outputType !== 'bottom') {
                            connections.push({ id: connectionId, ...connection });
                        }
                    } else {
                        // 일반 노드의 경우, 모든 연결 반환
                        connections.push({ id: connectionId, ...connection });
                    }
                }
            } else if (connectorType === 'bottom' && connection.from === nodeId) {
                // 아래 연결점 타입인 경우, bottom 타입 연결만 반환
                if (connection.outputType === 'bottom') {
                    connections.push({ id: connectionId, ...connection });
                }
            }
        });

        return connections;
    }

    /**
     * 연결 ID로 연결 삭제
     */
    deleteConnectionByConnectionId(connectionId) {
        if (!this.connectionManager) {
            logWarn('연결 관리자가 초기화되지 않았습니다.');
            return;
        }

        try {
            if (typeof this.connectionManager.deleteConnection === 'function') {
                this.connectionManager.deleteConnection(connectionId);
            } else {
                logWarn('연결 관리자에 deleteConnection 메서드가 없습니다.');
            }
        } catch (error) {
            logError('연결 삭제 실패:', error);
        }
    }

    /**
     * 연결 삭제 피드백(애니메이션 + 토스트 느낌)
     */
    showConnectionDeletedFeedback(connector, deletedCount) {
        // 반복 노드의 아래 연결점인 경우, 실제 연결점 요소(.bottom-output-dot)를 찾아서 스타일 적용
        let targetElement = connector;
        if (connector.classList.contains('node-bottom-output')) {
            const bottomDot = connector.querySelector('.bottom-output-dot');
            if (bottomDot) {
                targetElement = bottomDot;
            }
        }

        // .connecting 클래스 제거 (혹시 남아있을 수 있음)
        targetElement.classList.remove('connecting');
        connector.classList.remove('connecting');

        targetElement.style.transform = 'scale(0.8)';
        targetElement.style.backgroundColor = '#FF3B30';
        targetElement.style.borderColor = '#FF3B30';

        this.showConnectorTooltip(connector, `${deletedCount}개의 연결이 삭제되었습니다.`);

        setTimeout(() => {
            targetElement.style.transform = '';
            targetElement.style.backgroundColor = '';
            targetElement.style.borderColor = '';
            this.hideConnectorTooltip();
        }, 300);
    }

    /**
     * 커넥터 비주얼 상태 업데이트
     * @param {HTMLElement} connector
     * @param {boolean} isConnected
     */
    updateConnectorVisualState(connector, isConnected) {
        if (isConnected) {
            // 연결된 상태: 초록색
            connector.classList.add('connected');
            connector.style.backgroundColor = '#34C759';
            connector.style.borderColor = '#34C759';
            connector.style.boxShadow = '0 0 8px rgba(52, 199, 89, 0.6)';
        } else {
            // 연결 없음: 기본 스타일
            connector.classList.remove('connected');
            connector.style.backgroundColor = '#ffffff';
            connector.style.borderColor = '#666';
            connector.style.boxShadow = 'none';
        }
    }

    /**
     * 모든 커넥터의 비주얼 상태를 전체 갱신
     */
    updateAllConnectorsVisualState() {
        const allNodes = this.canvas.querySelectorAll('.workflow-node');

        allNodes.forEach((node) => {
            const nodeId = node.dataset.nodeId;

            // 입력 커넥터
            const inputConnector = node.querySelector('.node-input');
            if (inputConnector) {
                const inputConnections = this.findConnectionsByNode(nodeId, 'input');
                this.updateConnectorVisualState(inputConnector, inputConnections.length > 0);
            }

            // 출력 커넥터(여러 개일 수 있음)
            const outputConnectors = node.querySelectorAll('.node-output');
            outputConnectors.forEach((outputConnector) => {
                const outputConnections = this.findConnectionsByNode(nodeId, 'output');
                this.updateConnectorVisualState(outputConnector, outputConnections.length > 0);
            });
        });
    }

    /**
     * 연결 모드 시작
     * (클래식 모드: 출력 클릭 후 입력 클릭 방식)
     */
    startConnection(nodeId, connectorType, outputType = 'default') {
        try {
            this.isConnecting = true;
            this.connectionStart = {
                nodeId,
                connectorType,
                outputType,
                timestamp: Date.now()
            };

            // UI 활성화
            this.activateConnectionMode();

            // 시작 커넥터 하이라이트
            this.highlightConnectionStart(nodeId, connectorType, outputType);

            log(`연결 모드 시작: ${nodeId} (${connectorType}, ${outputType})`);
        } catch (error) {
            logError('연결 모드 시작 실패:', error);
            this.cancelConnection();
        }
    }

    /**
     * 연결 완료 (클래식 모드)
     */
    completeConnection(nodeId, connectorType, outputType = 'default') {
        try {
            if (!this.isConnecting || !this.connectionStart) {
                logWarn('연결 모드가 활성화되어 있지 않습니다.');
                return;
            }

            const startNodeId = this.connectionStart.nodeId;
            const startConnectorType = this.connectionStart.connectorType;
            const startOutputType = this.connectionStart.outputType;

            // 유효성 검사 (조건 노드의 경우 outputType 전달)
            const outputType = startOutputType === 'true' || startOutputType === 'false' ? startOutputType : null;
            if (!this.validateConnection(startNodeId, nodeId, startConnectorType, connectorType, outputType)) {
                this.cancelConnection();
                return;
            }

            // 연결 생성
            this.createNodeConnection(startNodeId, nodeId, startOutputType, outputType);

            // 모드 종료
            this.finishConnection();

            log(`연결 완료: ${startNodeId} → ${nodeId}`);
        } catch (error) {
            logError('연결 완료 실패:', error);
            this.cancelConnection();
        }
    }

    /**
     * 연결 취소
     */
    cancelConnection() {
        this.isConnecting = false;
        this.connectionStart = null;

        // UI 비활성화
        this.deactivateConnectionMode();

        // 하이라이트 제거
        this.clearAllHighlights();

        log('연결 모드 취소');
    }

    /**
     * 연결 완료 후 처리
     */
    finishConnection() {
        this.isConnecting = false;
        this.connectionStart = null;

        this.deactivateConnectionMode();
        this.clearAllHighlights();
    }

    /**
     * 연결 유효성 검사
     * @param {string} fromNodeId - 시작 노드 ID
     * @param {string} toNodeId - 도착 노드 ID
     * @param {string} fromType - 시작 커넥터 타입 ('input' 또는 'output')
     * @param {string} toType - 도착 커넥터 타입 ('input' 또는 'output')
     * @param {string} outputType - 출력 타입 ('true', 'false', 또는 null) - 조건 노드의 경우에만 사용
     */
    validateConnection(fromNodeId, toNodeId, fromType, toType, outputType = null) {
        // 자기 자신과의 연결 방지
        if (fromNodeId === toNodeId) {
            logWarn('자기 자신과는 연결할 수 없습니다.');
            return false;
        }

        // 출력 → 입력, 입력 → 출력만 허용
        if (!((fromType === 'output' && toType === 'input') || (fromType === 'input' && toType === 'output'))) {
            logWarn('출력 → 입력 또는 입력 → 출력 방향으로만 연결할 수 있습니다.');
            return false;
        }

        // 입력 커넥터는 하나만 연결 허용
        if (this.hasExistingConnection(toNodeId, 'input')) {
            logWarn('이미 연결된 입력 커넥터입니다.');
            return false;
        }

        // 출력 커넥터 검증: 조건 노드가 아닌 경우 출력은 최대 1개만 연결 허용
        if (fromType === 'output') {
            const fromNode = this.nodes.find((n) => n.id === fromNodeId);
            const fromNodeType = fromNode
                ? this.nodeData[fromNodeId]?.type || fromNode.element?.dataset?.nodeType
                : null;

            // 조건 노드가 아니고 이미 출력 연결이 있는 경우
            if (fromNodeType !== 'condition' && this.hasExistingOutputConnection(fromNodeId, outputType)) {
                logWarn('조건 노드가 아닌 노드는 출력을 최대 1개만 연결할 수 있습니다.');
                return false;
            }
        }

        return true;
    }

    /**
     * 기존 연결 존재 여부 확인
     */
    hasExistingConnection(nodeId, connectorType) {
        if (!this.connectionManager || !this.connectionManager.connections) {
            return false;
        }

        return Array.from(this.connectionManager.connections.values()).some((connection) => {
            if (connectorType === 'input') {
                return connection.to === nodeId;
            } else if (connectorType === 'output') {
                return connection.from === nodeId;
            }
            return false;
        });
    }

    /**
     * 출력 연결 개수 확인
     * @param {string} nodeId - 노드 ID
     * @param {string} outputType - 출력 타입 ('true', 'false', 또는 null) - 조건 노드의 경우에만 사용
     * @returns {number} 출력 연결 개수
     */
    getOutputConnectionCount(nodeId, outputType = null) {
        if (!this.connectionManager || !this.connectionManager.connections) {
            return 0;
        }

        // 노드 타입 확인 (반복 노드의 경우 아래 연결점 제외)
        const node = this.nodes.find((n) => n.id === nodeId);
        const nodeType = node ? this.nodeData[nodeId]?.type || node.element?.dataset?.nodeType : null;
        const isRepeatNode = nodeType === 'repeat';

        let connections = Array.from(this.connectionManager.connections.values()).filter(
            (connection) => connection.from === nodeId
        );

        // 반복 노드인 경우, 아래 연결점(bottom)은 출력으로 카운트하지 않음
        if (isRepeatNode) {
            connections = connections.filter((connection) => connection.outputType !== 'bottom');
        }

        // 조건 노드인 경우, 같은 outputType을 가진 연결만 카운트
        if (outputType) {
            connections = connections.filter((connection) => connection.outputType === outputType);
        }

        return connections.length;
    }

    /**
     * 출력 연결이 이미 존재하는지 확인
     * @param {string} nodeId - 노드 ID
     * @param {string} outputType - 출력 타입 ('true', 'false', 또는 null) - 조건 노드의 경우에만 사용
     * @returns {boolean}
     */
    hasExistingOutputConnection(nodeId, outputType = null) {
        return this.getOutputConnectionCount(nodeId, outputType) > 0;
    }

    /**
     * 노드 간 연결 생성
     */
    createNodeConnection(fromNodeId, toNodeId, fromOutputType, toOutputType) {
        // 연결 관리자가 없으면 지연 초기화
        if (!this.connectionManager) {
            if (window.ConnectionManager) {
                this.connectionManager = new window.ConnectionManager(this.canvas);
                if (window.setConnectionManager) {
                    window.setConnectionManager(this.connectionManager);
                }
                log('연결 관리자 지연 초기화 완료');
            } else {
                logWarn('연결 관리자가 초기화되지 않았습니다.');
                return;
            }
        }

        // 입력 커넥터 다중 연결 방지 검증
        if (toOutputType === 'input') {
            const existingInputConnections = this.findConnectionsByNode(toNodeId, 'input');
            if (existingInputConnections.length > 0) {
                logWarn('이미 연결된 입력 커넥터입니다. 입력 커넥터는 하나의 연결만 허용됩니다.', {
                    toNodeId: toNodeId,
                    existingConnections: existingInputConnections.length,
                    existingConnectionIds: existingInputConnections.map((c) => c.id)
                });

                // 사용자에게 알림 표시
                if (window.ModalManager) {
                    const modalManager = window.ModalManager.getInstance();
                    if (modalManager) {
                        modalManager.showAlert(
                            '연결 불가',
                            '이미 연결된 입력 커넥터입니다. 입력 커넥터는 하나의 연결만 허용됩니다.'
                        );
                    }
                }
                return;
            }
        }

        // 출력 연결 개수 검증 (조건 노드, 반복 노드 제외)
        // 조건 노드의 경우 출력 타입 추출
        // 반복 노드의 경우 아래 연결점(bottom)은 출력으로 카운트하지 않음
        const outputType =
            fromOutputType === 'true' || fromOutputType === 'false'
                ? fromOutputType
                : fromOutputType === 'bottom'
                  ? 'bottom'
                  : null;

        if (fromOutputType === 'output' || outputType) {
            const fromNode = this.nodes.find((n) => n.id === fromNodeId);
            const fromNodeType = fromNode
                ? this.nodeData[fromNodeId]?.type || fromNode.element?.dataset?.nodeType
                : null;
            const isConditionNode = fromNodeType === 'condition';
            const isRepeatNode = fromNodeType === 'repeat';

            // 반복 노드의 아래 연결점은 출력으로 카운트하지 않음
            const countOutputType = isRepeatNode && outputType === 'bottom' ? null : outputType;
            const existingCount = this.getOutputConnectionCount(fromNodeId, countOutputType);

            log('[NodeManager] createNodeConnection 출력 연결 검증:', {
                fromNodeId: fromNodeId,
                fromNodeType: fromNodeType,
                isCondition: isConditionNode,
                isRepeat: isRepeatNode,
                outputType: outputType,
                countOutputType: countOutputType,
                existingCount: existingCount
            });

            // 조건 노드와 반복 노드가 아니고 이미 출력 연결이 있는 경우
            if (!isConditionNode && !isRepeatNode && existingCount >= 1) {
                logWarn('조건 노드가 아닌 노드는 출력을 최대 1개만 연결할 수 있습니다.', {
                    fromNodeId: fromNodeId,
                    fromNodeType: fromNodeType,
                    existingCount: existingCount
                });

                // 사용자에게 알림 표시
                if (window.ModalManager) {
                    const modalManager = window.ModalManager.getInstance();
                    if (modalManager) {
                        modalManager.showAlert(
                            '연결 불가',
                            '조건 노드가 아닌 노드는 출력을 최대 1개만 연결할 수 있습니다.'
                        );
                    }
                }
                return;
            }
        }

        try {
            const connectionData = {
                from: fromNodeId,
                to: toNodeId,
                fromOutputType,
                toOutputType,
                createdAt: new Date().toISOString()
            };

            // 조건 노드의 경우 출력 타입 전달 (이미 위에서 추출함)
            this.connectionManager.createConnection(fromNodeId, toNodeId, outputType);

            log('노드 연결 생성 완료:', connectionData);

            setTimeout(() => {
                this.updateAllConnectorsVisualState();
            }, 100);
        } catch (error) {
            logError('노드 연결 생성 실패:', error);
        }
    }

    // ==========================================
    // 연결 모드 UI 관련 메서드들
    // ==========================================

    /**
     * 연결 모드 UI 활성화
     */
    activateConnectionMode() {
        this.canvas.classList.add('connection-mode');

        // 입력 커넥터 활성화
        this.activateInputConnectors();

        // 안내 메시지 표시
        this.showConnectionModeMessage();
    }

    /**
     * 연결 모드 UI 비활성화
     */
    deactivateConnectionMode() {
        this.canvas.classList.remove('connection-mode');

        // 모든 커넥터 비활성화
        this.deactivateAllConnectors();

        // 안내 메시지 숨기기
        this.hideConnectionModeMessage();
    }

    /**
     * 입력 커넥터들을 활성 상태로 전환
     */
    activateInputConnectors() {
        const inputConnectors = this.canvas.querySelectorAll('.node-input');
        inputConnectors.forEach((connector) => {
            connector.classList.add('connection-active');
        });
    }

    /**
     * 출력 커넥터들을 활성 상태로 전환
     */
    activateOutputConnectors() {
        const outputConnectors = this.canvas.querySelectorAll('.node-output');
        outputConnectors.forEach((connector) => {
            connector.classList.add('connection-active');
        });
    }

    /**
     * 모든 커넥터를 비활성화
     */
    deactivateAllConnectors() {
        const allConnectors = this.canvas.querySelectorAll('.node-input, .node-output');
        allConnectors.forEach((connector) => {
            connector.classList.remove('connection-active', 'connection-highlight');
        });
    }

    /**
     * 연결 시작점 하이라이트
     */
    highlightConnectionStart(nodeId, connectorType, outputType) {
        const node = document.getElementById(nodeId);
        if (!node) {
            return;
        }

        let connector;
        if (connectorType === 'output') {
            if (outputType === 'true') {
                connector = node.querySelector('.true-output');
            } else if (outputType === 'false') {
                connector = node.querySelector('.false-output');
            } else {
                connector = node.querySelector('.node-output');
            }
        } else if (connectorType === 'input') {
            connector = node.querySelector('.node-input');
        }

        if (connector) {
            connector.classList.add('connection-highlight');
        }
    }

    /**
     * 모든 연결 하이라이트 제거
     */
    clearAllHighlights() {
        const highlightedConnectors = this.canvas.querySelectorAll('.connection-highlight');
        highlightedConnectors.forEach((connector) => {
            connector.classList.remove('connection-highlight');
        });
    }

    /**
     * 연결 모드 안내 메시지 표시
     */
    showConnectionModeMessage() {
        let message = document.getElementById('connection-mode-message');
        if (!message) {
            message = document.createElement('div');
            message.id = 'connection-mode-message';
            message.className = 'connection-mode-message';
            message.innerHTML = `
                <div class="message-content">
                    <span class="message-icon">🔗</span>
                    <span class="message-text">연결할 입력 커넥터를 클릭하세요.</span>
                    <span class="message-hint">ESC 로 취소</span>
                </div>
            `;
            document.body.appendChild(message);
        }

        message.classList.add('show');
    }

    /**
     * 연결 모드 안내 메시지 숨기기
     */
    hideConnectionModeMessage() {
        const message = document.getElementById('connection-mode-message');
        if (message) {
            message.classList.remove('show');
        }
    }

    /**
     * 커넥터 툴팁 표시
     */
    showConnectorTooltip(connector, text) {
        let tooltip = document.getElementById('connector-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'connector-tooltip';
            tooltip.className = 'connector-tooltip';
            document.body.appendChild(tooltip);
        }

        tooltip.textContent = text;

        const rect = connector.getBoundingClientRect();
        tooltip.style.left = rect.left + rect.width / 2 + 'px';
        tooltip.style.top = rect.top - 30 + 'px';

        tooltip.classList.add('show');
    }

    /**
     * 커넥터 툴팁 숨기기
     */
    hideConnectorTooltip() {
        const tooltip = document.getElementById('connector-tooltip');
        if (tooltip) {
            tooltip.classList.remove('show');
        }
    }

    /**
     * 특정 노드/커넥터의 연결 정보 로그 출력
     */
    showConnectionInfo(nodeId, connectorType) {
        const node = document.getElementById(nodeId);
        if (!node) {
            return;
        }

        const nodeTitle = node.querySelector('.node-title');
        const title = nodeTitle ? nodeTitle.textContent : nodeId;

        log(`연결 정보: ${title} (${connectorType})`);

        if (this.connectionManager && this.connectionManager.connections) {
            const connections = Array.from(this.connectionManager.connections.values());
            const relatedConnections = connections.filter((conn) => conn.from === nodeId || conn.to === nodeId);

            if (relatedConnections.length > 0) {
                log('연결 목록:', relatedConnections);
            }
        }
    }

    /**
     * HTML 이스케이프 처리
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 노드를 캔버스에 추가
     */
    addNodeToCanvas(nodeElement) {
        const canvasContent = document.getElementById('canvas-content');
        if (canvasContent) {
            canvasContent.appendChild(nodeElement);
            log(`노드 ${nodeElement.dataset.nodeId} 를 canvas-content 에 추가 완료`);
        } else {
            this.canvas.appendChild(nodeElement);
            log(`노드 ${nodeElement.dataset.nodeId} 를 캔버스에 직접 추가 완료 (canvas-content 없음)`);
        }
    }

    /**
     * 노드 크기 조정 (텍스트 길이에 따라)
     * 최대 5줄까지 높이 증가, 그 이상이면 가로 확장
     * @param {HTMLElement} nodeElement - 노드 요소
     */
    adjustNodeSize(nodeElement) {
        // DOM이 완전히 렌더링될 때까지 대기
        requestAnimationFrame(() => {
            const textArea = nodeElement.querySelector('.node-text-area');
            if (!textArea) {
                return;
            }

            const titleElement = textArea.querySelector('.node-title');
            const descriptionElement = textArea.querySelector('.node-description');

            // 텍스트 영역의 실제 높이 계산
            const titleHeight = titleElement ? titleElement.scrollHeight : 0;
            const descriptionHeight = descriptionElement ? descriptionElement.scrollHeight : 0;
            const totalTextHeight = titleHeight + descriptionHeight;

            // 한 줄 높이 (line-height 기준)
            const lineHeight = 1.4; // CSS에서 설정한 line-height
            const fontSize = 14; // 제목 폰트 크기
            const oneLineHeight = fontSize * lineHeight;
            const maxHeight = oneLineHeight * 5; // 최대 5줄 높이

            // 5줄을 넘으면 가로로 확장
            // 노드 크기 조정 후 아래 연결점 위치 업데이트
            this.adjustBottomOutputPosition(nodeElement);
            if (totalTextHeight > maxHeight) {
                nodeElement.classList.add('text-overflow');
                // 높이 제한 제거
                nodeElement.style.maxHeight = 'none';
                // 제목과 설명의 줄 제한 제거
                if (titleElement) {
                    titleElement.style.maxHeight = 'none';
                    titleElement.style.webkitLineClamp = 'none';
                }
                if (descriptionElement) {
                    descriptionElement.style.maxHeight = 'none';
                    descriptionElement.style.webkitLineClamp = 'none';
                }
            } else {
                // 5줄 이내면 높이 자동 조정
                nodeElement.style.height = 'auto';
            }

            // 노드 크기 조정 후 아래 연결점 위치 업데이트
            this.adjustBottomOutputPosition(nodeElement);
        });
    }

    /**
     * 아래 연결점 위치 동적 조정 (노드 크기에 따라 가운데 최하단에 배치)
     * @param {HTMLElement} nodeElement - 노드 요소
     */
    adjustBottomOutputPosition(nodeElement) {
        // DOM이 완전히 렌더링될 때까지 대기
        requestAnimationFrame(() => {
            const bottomOutput = nodeElement.querySelector('.node-bottom-output');
            if (!bottomOutput) {
                return; // 아래 연결점이 없는 노드는 스킵
            }

            // 노드의 실제 크기 측정 (패딩 포함)
            const nodeRect = nodeElement.getBoundingClientRect();
            const nodeWidth = nodeRect.width;
            const nodeHeight = nodeRect.height;

            // 노드의 스타일 정보 가져오기 (패딩 계산용)
            const nodeStyle = window.getComputedStyle(nodeElement);
            const nodePaddingBottom = parseFloat(nodeStyle.paddingBottom) || 0;
            const nodePaddingTop = parseFloat(nodeStyle.paddingTop) || 0;

            // 아래 연결점의 크기 측정
            const bottomOutputRect = bottomOutput.getBoundingClientRect();
            const bottomOutputHeight = bottomOutputRect.height || 30; // 기본값 (도트 + 라벨)

            // 노드의 실제 콘텐츠 높이 (패딩 제외)
            const contentHeight = nodeHeight - nodePaddingTop - nodePaddingBottom;

            // 아래 연결점을 노드 최하단에 배치
            // bottom: -(bottomOutputHeight/2 + 여유공간)로 설정하여 연결점 도트가 노드 하단 밖에 위치하도록
            // 더 아래로 배치하기 위해 여유공간을 더 크게 설정
            const offsetFromBottom = Math.max(21, bottomOutputHeight / 2 + 16); // 최소 20px, 연결점 높이의 절반 + 여유공간(16px)

            // 절대 위치로 설정 (노드의 상대 위치 기준)
            bottomOutput.style.position = 'absolute';
            bottomOutput.style.left = '50%'; // 가운데
            bottomOutput.style.bottom = `-${offsetFromBottom}px`; // 노드 하단 밖으로
            bottomOutput.style.right = 'auto'; // right 초기화
            bottomOutput.style.transform = 'translateX(-50%)'; // 정확한 가운데 정렬

            log(
                `[NodeManager] 아래 연결점 위치 조정: 노드 ${nodeElement.dataset.nodeId}, 노드 크기 (${nodeWidth}x${nodeHeight}), 콘텐츠 높이 (${contentHeight}), 연결점 높이 (${bottomOutputHeight}), 위치 (left: 50%, bottom: -${offsetFromBottom}px)`
            );
        });
    }

    /**
     * 노드 데이터 저장
     */
    saveNodeData(nodeData) {
        if (!this.nodeData) {
            this.nodeData = {};
        }
        this.nodeData[nodeData.id] = {
            ...nodeData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    }

    /**
     * 연결 관리자에 노드 등록
     */
    registerNodeWithConnectionManager(nodeElement) {
        if (!nodeElement) {
            return;
        }

        // ConnectionManager 초기화
        if (!this.connectionManager) {
            if (window.ConnectionManager) {
                this.connectionManager = new window.ConnectionManager(this.canvas);
                if (window.setConnectionManager) {
                    window.setConnectionManager(this.connectionManager);
                }
            } else {
                logWarn('[NodeManager] ConnectionManager를 찾을 수 없습니다.');
                return;
            }
        }

        // 즉시 커넥터 바인딩
        // bindNodeConnector는 async이지만 여기서는 await 불필요 (비동기 실행)
        this.connectionManager.bindNodeConnector(nodeElement).catch((err) => {
            console.warn('[Node] bindNodeConnector 실패:', err);
        });
    }

    /**
     * 노드 삭제
     * 선택된 노드를 캔버스와 내부 상태에서 제거한다.
     * @param {HTMLElement} node - 삭제할 노드 요소
     * @param {boolean} force - true이면 시작/종료 노드도 강제 삭제 (스크립트 전환 시 사용)
     */
    deleteNode(node, force = false) {
        const nodeId = node.dataset.nodeId || node.id;

        // 시작/종료 노드는 삭제 금지 (단, force가 true이면 허용)
        if (!force && nodeId === 'start') {
            logWarn('시작/종료 노드는 삭제할 수 없습니다.');
            return;
        }

        // DOM에서 제거
        node.remove();

        // 내부 배열/데이터에서 제거
        this.nodes = this.nodes.filter((n) => n.id !== nodeId);
        delete this.nodeData[nodeId];

        // 연결 제거
        if (this.connectionManager) {
            this.connectionManager.removeNodeConnections(nodeId);
        } else {
            logWarn('연결 매니저가 없어 연결 제거를 건너뜁니다.');
            if (window.ConnectionManager) {
                this.connectionManager = new window.ConnectionManager(this.canvas);
                if (window.setConnectionManager) {
                    window.setConnectionManager(this.connectionManager);
                }
                log('연결 매니저 지연 초기화 완료');
            }
        }

        // 선택 해제
        if (this.selectedNode === node) {
            this.selectedNode = null;
        }

        log('노드 삭제 완료:', nodeId);
    }

    /**
     * 노드 등장 애니메이션 (선택 사항)
     */
    animateNodeIn(nodeElement) {
        nodeElement.style.opacity = '0';
        nodeElement.style.transform = 'scale(0.8)';

        setTimeout(() => {
            nodeElement.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            nodeElement.style.opacity = '1';
            nodeElement.style.transform = 'scale(1)';
        }, 50);
    }

    /**
     * 현재 모든 노드 데이터 반환
     */
    getAllNodes() {
        return this.nodes.map((n) => {
            const nodeId = n.data.id;
            const nodeElement = n.element;

            // DOM에서 최신 제목 가져오기
            const titleElement = nodeElement.querySelector('.node-title');
            const latestTitle = titleElement ? titleElement.textContent.trim() : null;

            // nodeData에서 최신 정보 가져오기 (업데이트된 색상, 타입 등)
            const latestData = this.nodeData && this.nodeData[nodeId] ? this.nodeData[nodeId] : {};

            return {
                id: nodeId,
                title: latestTitle || latestData.title || n.data.title, // DOM 제목 우선 사용
                type: latestData.type || n.data.type,
                x: parseInt(nodeElement.style.left, 10),
                y: parseInt(nodeElement.style.top, 10)
            };
        });
    }

    /**
     * 현재 모든 연결 데이터 반환
     */
    getAllConnections() {
        if (this.connectionManager) {
            return this.connectionManager.getConnections();
        }
        return [];
    }

    /**
     * 롱터치 시작
     * 모바일/터치 환경에서 일정 시간 누르고 있으면 연결 그리기 모드로 진입한다.
     */
    startLongTouch(e, connector, nodeElement, connectorType) {
        log('롱터치 시작:', {
            connectorType,
            connector,
            nodeElement,
            delay: this.longTouchDelay
        });

        // 기존 타이머가 있으면 취소
        if (this.longTouchTimer) {
            clearTimeout(this.longTouchTimer);
            log('기존 롱터치 타이머 취소');
        }

        // 롱터치 타이머 시작
        this.longTouchTimer = setTimeout(() => {
            log('롱터치 타이머 만료 - 연결 그리기 모드 활성화');
            this.activateConnectionDrawingMode(e, connector, nodeElement, connectorType);
        }, this.longTouchDelay);

        log(`롱터치 타이머 시작 (${this.longTouchDelay}ms 후 활성화)`);
    }

    /**
     * 롱터치 취소
     */
    cancelLongTouch() {
        log('롱터치 취소 시도', {
            hasTimer: !!this.longTouchTimer,
            isDrawing: this.isDrawingConnection
        });

        if (this.longTouchTimer) {
            clearTimeout(this.longTouchTimer);
            this.longTouchTimer = null;
            log('롱터치 타이머 취소');
        }

        if (this.isDrawingConnection) {
            log('연결 그리기 모드 비활성화 시도...');
            this.deactivateConnectionDrawingMode();
        }
    }

    /**
     * 연결 그리기 모드 활성화 (롱터치 후)
     */
    activateConnectionDrawingMode(e, connector, nodeElement, connectorType) {
        log(`연결 그리기 모드 활성화: ${connectorType}`);

        this.isDrawingConnection = true;
        this.connectionStartConnector = connector;

        // 출력 타입 감지 (조건 노드의 경우)
        let outputType = null;
        if (connectorType === 'output' && connector) {
            if (connector.classList.contains('true-output') || connector.closest('.true-output')) {
                outputType = 'true';
            } else if (connector.classList.contains('false-output') || connector.closest('.false-output')) {
                outputType = 'false';
            }
        }

        this.connectionStartPoint = {
            x: e.clientX,
            y: e.clientY,
            nodeId: nodeElement.dataset.nodeId,
            connectorType,
            outputType
        };

        // 시작 커넥터 하이라이트
        connector.style.backgroundColor = '#FF6B35';
        connector.style.borderColor = '#FF6B35';
        connector.style.boxShadow = '0 0 15px rgba(255, 107, 53, 0.8)';

        // 캔버스에 마우스 이벤트 등록
        this.canvas.addEventListener('mousemove', this.handleConnectionDrawing);
        this.canvas.addEventListener('mouseup', this.handleConnectionComplete);

        // 안내 메시지 표시
        this.showConnectionDrawingMessage(connectorType);

        log('연결 그리기 모드 활성화 완료');
    }

    /**
     * 연결 그리기 모드 비활성화
     */
    deactivateConnectionDrawingMode() {
        log('연결 그리기 모드 비활성화');

        // 시작 커넥터 상태 초기화 (주의: this.connectionStartConnector 를 먼저 참조해야 함)
        if (this.connectionStartConnector) {
            this.updateConnectorVisualState(this.connectionStartConnector, false);
        }

        this.isDrawingConnection = false;
        this.connectionStartPoint = null;

        // 캔버스 이벤트 제거
        this.canvas.removeEventListener('mousemove', this.handleConnectionDrawing);
        this.canvas.removeEventListener('mouseup', this.handleConnectionComplete);

        // 안내 메시지 숨기기
        this.hideConnectionDrawingMessage();

        // 임시 연결선 제거
        if (this.connectionManager) {
            this.connectionManager.removeTempConnection?.();
        }

        // 모든 커넥터 하이라이트 제거
        this.clearAllConnectorHighlights();

        this.connectionStartConnector = null;

        log('연결 그리기 모드 비활성화 완료');
    }

    /**
     * 연결 그리기 처리 (마우스 이동)
     */
    handleConnectionDrawing = (e) => {
        if (!this.isDrawingConnection || !this.connectionStartPoint) {
            return;
        }

        // connectionManager 를 통해 임시 연결선 그리기
        if (this.connectionManager && typeof this.connectionManager.updateTempConnection === 'function') {
            this.connectionManager.updateTempConnection(
                this.connectionStartPoint.x,
                this.connectionStartPoint.y,
                e.clientX,
                e.clientY
            );
        }

        // 마그네틱 효과: 가까운 커넥터 찾기
        const nearbyConnector = this.findNearbyConnector(e.clientX, e.clientY);
        if (nearbyConnector) {
            this.highlightConnector(nearbyConnector);
        } else {
            this.clearAllConnectorHighlights();
        }
    };

    /**
     * 연결 그리기 완료 처리 (마우스 업)
     */
    handleConnectionComplete = (e) => {
        if (!this.isDrawingConnection || !this.connectionStartPoint) {
            return;
        }

        const nearbyConnector = this.findNearbyConnector(e.clientX, e.clientY);

        if (nearbyConnector) {
            this.completeConnectionToConnector(nearbyConnector);
        } else {
            this.deactivateConnectionDrawingMode();
        }
    };

    /**
     * 마우스 기준 가까운 커넥터 찾기 (입력/출력 모두)
     */
    findNearbyConnector(mouseX, mouseY) {
        const allConnectors = this.canvas.querySelectorAll('.node-input, .node-output');
        let closestConnector = null;
        let closestDistance = this.magneticThreshold;

        allConnectors.forEach((connector) => {
            const rect = connector.getBoundingClientRect();
            const connectorX = rect.left + rect.width / 2;
            const connectorY = rect.top + rect.height / 2;

            const distance = Math.sqrt(Math.pow(mouseX - connectorX, 2) + Math.pow(mouseY - connectorY, 2));

            if (distance < closestDistance) {
                closestDistance = distance;
                closestConnector = connector;
            }
        });

        return closestConnector;
    }

    /**
     * 커넥터 하이라이트 (마그네틱 효과)
     */
    highlightConnector(connector) {
        // 기존 하이라이트 제거
        this.clearAllConnectorHighlights();

        // 하이라이트 스타일
        connector.style.backgroundColor = '#34C759';
        connector.style.borderColor = '#34C759';
        connector.style.boxShadow = '0 0 15px rgba(52, 199, 89, 0.8)';
        connector.style.transform = 'scale(1.2)';
        connector.classList.add('magnetic-highlight');
    }

    /**
     * 모든 커넥터 하이라이트 제거
     */
    clearAllConnectorHighlights() {
        const highlightedConnectors = this.canvas.querySelectorAll('.magnetic-highlight');
        highlightedConnectors.forEach((connector) => {
            connector.style.backgroundColor = '';
            connector.style.borderColor = '';
            connector.style.boxShadow = '';
            connector.style.transform = '';
            connector.classList.remove('magnetic-highlight');
        });
    }

    /**
     * 특정 커넥터로 연결 완료
     */
    completeConnectionToConnector(targetConnector) {
        if (!this.connectionStartPoint || !targetConnector) {
            return;
        }

        const targetNode = targetConnector.closest('.workflow-node');
        if (!targetNode) {
            return;
        }

        const targetNodeId = targetNode.dataset.nodeId;
        const targetConnectorType = targetConnector.classList.contains('node-input') ? 'input' : 'output';

        log(
            `연결 완료: ${this.connectionStartPoint.nodeId}(${this.connectionStartPoint.connectorType}) → ` +
                `${targetNodeId}(${targetConnectorType})`
        );

        // 방향에 따라 연결 생성 (검증 포함)
        if (this.connectionStartPoint.connectorType === 'output' && targetConnectorType === 'input') {
            // 연결 유효성 검증 (조건 노드의 경우 outputType 전달)
            const outputType = this.connectionStartPoint.outputType || null;
            const isValid = this.validateConnection(
                this.connectionStartPoint.nodeId,
                targetNodeId,
                'output',
                'input',
                outputType
            );
            if (!isValid) {
                this.deactivateConnectionDrawingMode();
                return;
            }

            this.createNodeConnection(this.connectionStartPoint.nodeId, targetNodeId, outputType || 'output', 'input');
        } else if (this.connectionStartPoint.connectorType === 'input' && targetConnectorType === 'output') {
            // 입력에서 출력으로 연결하는 경우, 타겟 커넥터의 outputType 확인
            let outputType = null;
            if (targetConnector.classList.contains('true-output') || targetConnector.closest('.true-output')) {
                outputType = 'true';
            } else if (targetConnector.classList.contains('false-output') || targetConnector.closest('.false-output')) {
                outputType = 'false';
            }

            // 연결 유효성 검증
            const isValid = this.validateConnection(
                targetNodeId,
                this.connectionStartPoint.nodeId,
                'output',
                'input',
                outputType
            );
            if (!isValid) {
                this.deactivateConnectionDrawingMode();
                return;
            }

            this.createNodeConnection(targetNodeId, this.connectionStartPoint.nodeId, outputType || 'output', 'input');
        }

        this.deactivateConnectionDrawingMode();
    }

    /**
     * 연결 그리기 안내 메시지 표시
     */
    showConnectionDrawingMessage(connectorType) {
        const existing = document.getElementById('connection-drawing-message');
        if (existing) {
            existing.remove();
        }

        const message = document.createElement('div');
        message.id = 'connection-drawing-message';
        message.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            font-size: 14px;
            z-index: 1000;
            pointer-events: none;
        `;
        message.textContent = `${connectorType === 'output' ? '출력' : '입력'} 커넥터에서 드래그하여 연결선을 그려주세요.`;

        document.body.appendChild(message);
    }

    /**
     * 연결 그리기 안내 메시지 숨기기
     */
    hideConnectionDrawingMessage() {
        const message = document.getElementById('connection-drawing-message');
        if (message) {
            message.remove();
        }
    }
}

// 전역으로 노출 (하위 호환성을 위해)
window.NodeManager = NodeManager;

// ==== 노드 타입 정의 레지스트리(정적) ====
// 각 노드 타입별 커스텀 렌더링 기능을 등록하는 용도
NodeManager.nodeTypeDefinitions = {};

/**
 * 노드 타입 등록 함수
 * @param {string} type - 노드 타입(예: 'action', 'condition')
 * @param {Object} definition - 타입 정의 객체
 * @param {Function} definition.renderContent - 노드 innerHTML을 생성하는 함수
 */
NodeManager.registerNodeType = function (type, definition) {
    if (!NodeManager.nodeTypeDefinitions) {
        NodeManager.nodeTypeDefinitions = {};
    }
    NodeManager.nodeTypeDefinitions[type] = definition;
};

// 페이지 로드 완료 시 노드 매니저 인스턴스 생성
document.addEventListener('DOMContentLoaded', () => {
    log('DOM 로드 완료 - 노드 매니저 인스턴스 생성');
    window.nodeManager = new NodeManager();
    log('노드 매니저 인스턴스 생성 완료:', window.nodeManager);
});
