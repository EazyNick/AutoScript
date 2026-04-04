/**
 * 워크플로우 페이지 메인 컨트롤러 클래스
 * ES6 모듈 방식으로 작성됨
 *
 * 이 클래스는 워크플로우 편집 페이지의 전체적인 흐름을 관리합니다.
 * 실제 동작 코드는 모두 서비스/모달/유틸리티로 분리되어 있습니다.
 */

// ES6 모듈 import - 명시적 의존성 관리
import { TIMING_CONSTANTS, STYLE_CONSTANTS } from './constants/index.js';
import { getSidebarInstance } from '../../js/components/sidebar/sidebar.js';
import { ConnectionManager, setConnectionManager } from '../../js/components/connection/connection.js';
import { getModalManagerInstance } from '../../js/utils/modal.js';
import { getToastManagerInstance } from '../../js/utils/toast.js';
import { NodeAPI } from '../../js/api/nodeapi.js';

// Workflow 페이지 모듈 import
import { AddNodeModal } from './modals/add-node-modal.js';
import { NodeSettingsModal } from './modals/node-settings-modal.js';
import { WorkflowSaveService } from './services/workflow-save-service.js';
import { WorkflowLoadService } from './services/workflow-load-service.js';
import { WorkflowExecutionService } from './services/workflow-execution-service.js';
import { NodeUpdateService } from './services/node-update-service.js';
import { NodeCreationService } from './services/node-creation-service.js';
import { UndoRedoService } from './services/undo-redo-service.js';
import { ViewportUtils } from './utils/viewport-utils.js';
import { StorageUtils } from './utils/storage-utils.js';
import { getNodeType, getNodeData, escapeHtml } from './utils/node-utils.js';
import { getNodeRegistry } from './services/node-registry.js';
import { getPageRouterInstance } from './page-router.js';

/**
 * 로거 유틸리티 가져오기 (전역 fallback 포함)
 */
const getLogger = () => {
    return {
        log: window.log || (window.Logger ? window.Logger.log.bind(window.Logger) : console.log),
        error: window.logError || (window.Logger ? window.Logger.error.bind(window.Logger) : console.error),
        warn: window.logWarn || (window.Logger ? window.Logger.warn.bind(window.Logger) : console.warn)
    };
};

/**
 * 의존성 관리 헬퍼 함수들
 */
const GlobalDependencies = {
    getNodeManager: () => window.nodeManager || null,
    getConnectionManagerInstance: () => window.connectionManager || null
};

const getNodeManager = () => GlobalDependencies.getNodeManager();
const getSidebarManager = () => getSidebarInstance();
const getModalManager = () => getModalManagerInstance();

// getSidebarManager를 전역으로 export (다른 모듈에서 사용)
window.getSidebarManager = getSidebarManager;
const getNodeAPI = () => NodeAPI;
const getConnectionManager = () => ConnectionManager;

/**
 * WorkflowPage 클래스
 * 워크플로우 편집 페이지의 전체적인 흐름을 관리합니다.
 */
export class WorkflowPage {
    /**
     * 워크플로우 페이지 관리 클래스
     * 노드 편집, 저장, 로드, 실행 등의 기능을 통합 관리합니다.
     */
    constructor() {
        // 모달 인스턴스
        this.addNodeModal = null; // 노드 추가 모달
        this.nodeSettingsModal = null; // 노드 설정 모달

        // 서비스 인스턴스
        this.saveService = null; // 워크플로우 저장 서비스
        this.loadService = null; // 워크플로우 로드 서비스
        this.executionService = null; // 워크플로우 실행 서비스
        this.updateService = null; // 노드 업데이트 서비스
        this.creationService = null; // 노드 생성 서비스
        this.undoRedoService = null; // Undo/Redo 서비스

        // 내부 상태 플래그
        this._initialized = false; // 중복 초기화 방지 플래그
        this._eventListenersSetup = false; // 이벤트 리스너 중복 등록 방지 플래그
        this._scriptChangedHandler = null; // scriptChanged 이벤트 핸들러 (중복 등록 방지용)
        // --- 아래 세 변수: "저장 버튼 안 눌러도 서버에 맞춰 두기" 기능용 (초보자용 설명) ---
        // 워크플로우는 DB에 있어서, 저장 안 하면 다른 화면 갔다 오면 예전 데이터가 보일 수 있음.
        this._workflowPersistTimer = null; // "800ms 뒤에 저장" 예약이 있으면 여기 들어감 → 취소할 때 사용
        this._workflowGraphListenersBound = false; // 캔버스에 같은 리스너를 두 번 붙이지 않기 위한 플래그
        this._visibilityPersistBound = false; // 브라우저 탭 전환 감지 리스너는 페이지당 한 번만

        // scriptChanged 이벤트 직렬화: 결론 — 저장·로드를 동시에 여러 번 돌리지 않고 큐(FIFO)로 한 건씩 처리한다.
        // 이유 — 연속 클릭 시 이전 스크립트 저장과 다음 스크립트 로드 순서가 뒤섞이면 캔버스와 DB가 어긋날 수 있다.
        this._scriptChangeQueue = [];
        this._scriptChangeDraining = false;

        this.init();
    }

    /**
     * 의존성 가져오기 메서드들 (서비스에서 사용)
     */
    getModalManager() {
        return getModalManager();
    }
    getToastManager() {
        return getToastManagerInstance();
    }
    getSidebarManager() {
        return getSidebarManager();
    }
    getNodeManager() {
        return getNodeManager();
    }
    getNodeAPI() {
        return getNodeAPI();
    }
    /**
     * 현재 선택된 스크립트 가져오기
     * @returns {Object|null} 현재 스크립트 객체 또는 null
     */
    getCurrentScript() {
        const sidebarManager = this.getSidebarManager();
        return sidebarManager ? sidebarManager.getCurrentScript() : null;
    }
    getLogger() {
        return getLogger();
    }
    getSaveService() {
        return this.saveService;
    }
    getLoadService() {
        return this.loadService;
    }
    getUndoRedoService() {
        return this.undoRedoService;
    }

    /**
     * 초기화 메서드
     */
    async init() {
        // 중복 초기화 방지
        if (this._initialized) {
            const logger = this.getLogger();
            logger.log('[WorkflowPage] 이미 초기화되었습니다. 중복 초기화 방지');
            return;
        }

        // 페이지 라우터 초기화
        const pageRouter = getPageRouterInstance();
        this.pageRouter = pageRouter;

        // 노드 로딩 오버레이 표시
        this.showNodeLoading();

        // 노드 레지스트리 초기화 및 노드 스크립트 동적 로드
        try {
            await this.loadNodeScripts();

            // 노드 기본값 초기화 (서버 설정 로드)
            const { initializeDefaults } = await import('./config/node-defaults.js');
            await initializeDefaults();
        } finally {
            // 노드 로딩 오버레이 숨김
            this.hideNodeLoading();
        }

        this.addNodeModal = new AddNodeModal(this);
        this.nodeSettingsModal = new NodeSettingsModal(this);
        this.saveService = new WorkflowSaveService(this);
        this.loadService = new WorkflowLoadService(this);
        this.executionService = new WorkflowExecutionService(this);
        this.updateService = new NodeUpdateService(this);
        this.creationService = new NodeCreationService(this);
        this.undoRedoService = new UndoRedoService(this);

        this.setupEventListeners();
        this.setupComponentEventListeners();
        this.setupComponentIntegration();
        this.setupKeyboardShortcuts();

        // 스크립트 로드는 page-router.js의 initEditor()에서 처리하므로 여기서는 호출하지 않음
        // (중복 로드 방지)

        this._initialized = true;
    }

    /**
     * 노드 로딩 오버레이 표시
     */
    showNodeLoading() {
        const overlay = document.getElementById('node-loading-overlay');
        if (overlay) {
            overlay.style.display = 'flex';
        }
    }

    /**
     * 노드 로딩 오버레이 숨김
     */
    hideNodeLoading() {
        const overlay = document.getElementById('node-loading-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    /**
     * 노드 스크립트 동적 로드
     * NodeManager가 로드된 후에 실행되어야 함
     * 성능 최적화: 경계 노드(시작/종료)만 먼저 로드하고 나머지는 지연 로드
     */
    async loadNodeScripts() {
        const logger = getLogger();
        const log = logger.log;

        // NodeManager가 로드될 때까지 대기 (최대 1초)
        const waitForNodeManager = () => {
            return new Promise((resolve) => {
                let attempts = 0;
                const maxAttempts = 20; // 최대 20번 시도 (약 1초)
                const check = () => {
                    if (window.NodeManager) {
                        log('[WorkflowPage] NodeManager 로드 완료, 노드 스크립트 로드 시작');
                        resolve();
                    } else if (attempts < maxAttempts) {
                        attempts++;
                        setTimeout(check, TIMING_CONSTANTS.DEFAULT_DELAY);
                    } else {
                        log('[WorkflowPage] NodeManager 로드 타임아웃, 경계 노드만 로드');
                        resolve(); // 타임아웃되어도 계속 진행
                    }
                };
                check();
            });
        };

        await waitForNodeManager();

        // 노드 레지스트리를 사용하여 경계 노드(시작/종료)만 먼저 로드
        const registry = getNodeRegistry();
        try {
            // 경계 노드만 먼저 로드 (시작 노드 표시를 위해)
            await registry.loadBoundaryNodeScripts();
            log('[WorkflowPage] 경계 노드 스크립트 로드 완료');

            // 나머지 노드는 백그라운드에서 지연 로드
            registry
                .loadAllNodeScripts()
                .then(() => {
                    log('[WorkflowPage] 모든 노드 스크립트 로드 완료 (지연 로드)');
                })
                .catch((error) => {
                    logger.error('[WorkflowPage] 나머지 노드 스크립트 로드 중 오류:', error);
                });
        } catch (error) {
            logger.error('[WorkflowPage] 경계 노드 스크립트 로드 중 오류:', error);
        }
    }

    /**
     * 이벤트 리스너 설정
     * 버튼 클릭 이벤트를 등록합니다.
     */
    setupEventListeners() {
        // 중복 등록 방지
        if (this._eventListenersSetup) {
            const logger = this.getLogger();
            logger.log('[WorkflowPage] 이벤트 리스너가 이미 등록되었습니다. 중복 등록 방지');
            return;
        }

        // 기본 버튼 이벤트 등록
        document.querySelector('.save-btn')?.addEventListener('click', () => this.saveWorkflow());
        document.querySelector('.add-node-btn')?.addEventListener('click', () => this.showAddNodeModal());
        document.querySelector('.run-btn')?.addEventListener('click', () => this.runWorkflow());

        // 전체 스크립트 실행 버튼 (헤더)
        const runAllBtn = document.querySelector('.header-right .run-all-scripts-btn');
        if (runAllBtn) {
            runAllBtn.addEventListener('click', async () => {
                const sidebarManager = this.getSidebarManager();
                if (sidebarManager && typeof sidebarManager.runAllScripts === 'function') {
                    await sidebarManager.runAllScripts();
                }
            });
        }

        this._eventListenersSetup = true;
    }

    /**
     * 컴포넌트 이벤트 리스너 설정
     */
    setupComponentEventListeners() {
        const logger = getLogger();
        const log = logger.log;

        // sidebar.js는 document에 이벤트를 dispatch하므로 document에 리스너 등록
        // 중복 등록 방지
        if (!this._scriptChangedHandler) {
            this._scriptChangedHandler = (e) => {
                log('[WorkflowPage] scriptChanged 이벤트 받음:', e.detail);
                this.onScriptChanged(e);
            };
            document.addEventListener('scriptChanged', this._scriptChangedHandler);
        }

        // 사용자가 크롬에서 다른 탭으로 갈 때: 이 앱의 "스크립트 편집" 화면이 잠깐 안 보이게 됨.
        // 그때도 한 번 서버에 저장해 두면, 탭 돌아왔을 때/새로고침 시 데이터가 덜 날아감.
        // (앱 안에서 대시보드로 가는 것과는 별개 동작임 — 그쪽은 page-router가 처리)
        if (!this._visibilityPersistBound) {
            this._visibilityPersistBound = true;
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState !== 'hidden') {
                    return;
                }
                const pr = window.pageRouter;
                if (!pr || pr.currentPage !== 'editor') {
                    return;
                }
                void window.workflowPage?.persistWorkflowToServerSilently?.();
            });
        }

        log('[WorkflowPage] ✅ 컴포넌트 이벤트 리스너 설정 완료');
    }

    /**
     * 컴포넌트 통합 설정
     * NodeManager와 WorkflowPage 간의 상호 참조를 설정합니다.
     */
    setupComponentIntegration() {
        // DOM 로드 완료 대기
        setTimeout(() => {
            const logger = this.getLogger();
            const log = logger.log;

            const nodeManager = getNodeManager();
            const sidebarManager = getSidebarManager();

            log('[WorkflowPage] setupComponentIntegration() 실행');

            // NodeManager에 WorkflowPage 인스턴스 설정 (양방향 참조)
            if (nodeManager) {
                nodeManager.setWorkflowPage(this);
                log('[WorkflowPage] ✅ NodeManager에 WorkflowPage 설정 완료');
                // 캔버스 DOM이 늦게 생기면 이벤트를 못 붙이므로, 준비될 때까지 재시도하며 "연결/이동 시 자동 저장" 연결
                this.tryBindWorkflowGraphAutoPersist(0);
            } else {
                log('[WorkflowPage] ⚠️ NodeManager를 찾을 수 없습니다');
            }
        }, 100);
    }

    /**
     * 캔버스에 "그래프가 바뀌었다"는 신호가 오면, 잠시 뒤 서버에 자동 저장하도록 연결합니다.
     *
     * - 연결 만들기/끊기 → ConnectionManager가 connectionCreated / connectionDeleted 이벤트 발생
     * - 노드 옮기기 / 노드 추가 → 코드에서 workflowGraphChanged 이벤트를 직접 발생 (node-drag, node-creation-service)
     */
    tryBindWorkflowGraphAutoPersist(attempt) {
        if (this._workflowGraphListenersBound) {
            return;
        }
        const nodeManager = getNodeManager();
        const canvas = nodeManager?.canvas;
        if (!canvas) {
            // 초기 로드 순서상 canvas가 아직 없을 수 있음 → 짧은 간격으로 재시도
            if (attempt < 40) {
                setTimeout(() => this.tryBindWorkflowGraphAutoPersist(attempt + 1), TIMING_CONSTANTS.DEFAULT_DELAY);
            }
            return;
        }
        this._workflowGraphListenersBound = true;
        const onGraphChange = () => this.scheduleDebouncedPersistWorkflowToServer();
        canvas.addEventListener('connectionCreated', onGraphChange);
        canvas.addEventListener('connectionDeleted', onGraphChange);
        canvas.addEventListener('workflowGraphChanged', onGraphChange);
    }

    /**
     * debounce(디바운스): 이벤트가 여러 번 연달아 와도, 마지막으로부터 800ms 조용해진 뒤에 한 번만 저장.
     * 비유: 연필로 글자 쓸 때마다 서버에 보내지 않고, 잠깐 멈췄을 때만 보내는 것.
     */
    scheduleDebouncedPersistWorkflowToServer() {
        if (this._workflowPersistTimer) {
            clearTimeout(this._workflowPersistTimer);
        }
        this._workflowPersistTimer = setTimeout(() => {
            this._workflowPersistTimer = null;
            void this.persistWorkflowToServerSilently();
        }, 800);
    }

    /**
     * 저장 버튼과 같은 API(서버의 노드 일괄 저장)를 쓰지만, 토스트/팝업은 띄우지 않음 = "조용한 자동 저장".
     *
     * 호출되는 경우 예시:
     * - 대시보드 등 다른 메뉴로 나가기 직전 (page-router)
     * - 브라우저 탭 전환 (visibilitychange)
     * - 노드 연결·이동·추가 후 800ms 뒤 (위 debounce)
     * - 사이드바에서 다른 스크립트 고르기 직전 (onScriptChanged) — 이때는 scriptIdOverride로 예전 스크립트 번호를 넘김
     *
     * @param {number|string|null} [scriptIdOverride] - 넘기면 "지금 사이드바 선택"이 아니라 이 ID로 저장 (스크립트 전환 순간용)
     */
    async persistWorkflowToServerSilently(scriptIdOverride = null) {
        const script = this.getCurrentScript();
        if (!this.saveService) {
            return;
        }
        // scriptIdOverride가 있으면 그게 저장 대상, 없으면 현재 사이드바에 맞는 스크립트
        const effectiveId = scriptIdOverride != null ? scriptIdOverride : script?.id;
        if (effectiveId == null) {
            return;
        }
        // Undo로 과거 상태를 되살리는 중에 서버 저장이 끼면 꼬일 수 있어서 건너뜀
        const undoRedo = this.getUndoRedoService?.();
        if (undoRedo?.isRestoring) {
            return;
        }
        const logger = this.getLogger();
        try {
            const opts = { useToast: false, showAlert: false };
            if (scriptIdOverride != null) {
                // WorkflowSaveService.save() 안에서 이 ID로 updateNodesBatch가 호출됨
                opts.scriptId = scriptIdOverride;
            }
            await this.saveService.save(opts);
        } catch (error) {
            logger.warn('[WorkflowPage] 자동 저장 실패:', error);
        }
    }

    /**
     * 초기 노드 생성
     */
    createInitialNodes() {
        const initNodes = () => {
            const nodeManager = getNodeManager();
            const ConnectionManager = getConnectionManager();

            if (nodeManager && nodeManager.canvas) {
                if (!nodeManager.connectionManager && ConnectionManager) {
                    nodeManager.connectionManager = new ConnectionManager(nodeManager.canvas);
                }
            } else {
                setTimeout(initNodes, TIMING_CONSTANTS.MEDIUM_DELAY);
            }
        };

        initNodes();
    }

    /**
     * 기본 시작/종료 노드 생성
     */
    async createDefaultBoundaryNodes() {
        if (this.creationService) {
            await this.creationService.createDefaultBoundaryNodes();
        }
    }

    /**
     * 모든 노드가 화면에 보이도록 뷰포트 조정
     */
    fitNodesToView() {
        ViewportUtils.fitNodesToView(this);
    }

    /**
     * 노드 추가 모달 표시
     */
    showAddNodeModal() {
        if (this.addNodeModal) {
            this.addNodeModal.show();
        }
    }

    /**
     * 노드 설정 모달 표시
     */
    showNodeSettingsModal(nodeElement) {
        if (this.nodeSettingsModal) {
            this.nodeSettingsModal.show(nodeElement);
        }
    }

    /**
     * 노드 업데이트
     */
    async updateNode(nodeElement, nodeId) {
        if (this.updateService) {
            await this.updateService.update(nodeElement, nodeId);
        }
    }

    /**
     * 노드 데이터로부터 노드 생성
     */
    createNodeFromData(nodeData) {
        if (this.creationService) {
            return this.creationService.createFromData(nodeData);
        }
        return null;
    }

    /**
     * 워크플로우 실행
     */
    async runWorkflow() {
        if (this.executionService) {
            // 실행 중인 경우 취소
            if (this.executionService.isExecuting) {
                this.executionService.cancel();
                return;
            }

            // 다른 버튼들 비활성화 및 실행 버튼 활성화
            this.setButtonsState('running', 'run-btn');

            try {
                // 단일 스크립트 실행은 executeSingleScript를 사용
                const sidebarManager = getSidebarManager();
                const currentScript = this.getCurrentScript();
                if (sidebarManager && sidebarManager.scriptManager && currentScript) {
                    await sidebarManager.scriptManager.executeSingleScript(currentScript, {
                        isRunningAllScripts: false
                    });
                } else {
                    // 폴백: 기존 방식 사용
                    await this.executionService.execute();
                }
            } finally {
                // 버튼 상태 복원
                this.setButtonsState('idle');
            }
        }
    }

    /**
     * 버튼 상태 설정
     * @param {string} state - 'idle' | 'running'
     * @param {string} activeButton - 실행 중인 버튼 클래스 ('run-btn' | 'run-all-scripts-btn')
     */
    setButtonsState(state, activeButton = null) {
        const buttons = {
            save: document.querySelector('.save-btn'),
            addNode: document.querySelector('.add-node-btn'),
            run: document.querySelector('.run-btn'),
            runAll: document.querySelector('.run-all-scripts-btn')
        };

        if (state === 'running') {
            // 모든 버튼 비활성화
            Object.values(buttons).forEach((btn) => {
                if (btn) {
                    btn.disabled = true;
                    btn.style.opacity = STYLE_CONSTANTS.OPACITY_DISABLED;
                    btn.style.cursor = 'not-allowed';
                    btn.classList.remove('executing');
                }
            });

            // 실행 중인 버튼만 활성화 및 실행 중 스타일 적용
            if (activeButton && buttons[activeButton === 'run-btn' ? 'run' : 'runAll']) {
                const activeBtn = buttons[activeButton === 'run-btn' ? 'run' : 'runAll'];
                activeBtn.disabled = false;
                activeBtn.style.opacity = STYLE_CONSTANTS.OPACITY_ENABLED;
                activeBtn.style.cursor = 'pointer';
                activeBtn.classList.add('executing');

                // 버튼 텍스트 변경
                const btnText = activeBtn.querySelector('.btn-text');
                if (btnText) {
                    activeBtn.dataset.originalText = btnText.textContent;
                    btnText.textContent = '취소';
                }
            }
        } else {
            // 모든 버튼 활성화
            Object.values(buttons).forEach((btn) => {
                if (btn) {
                    btn.disabled = false;
                    btn.style.opacity = STYLE_CONSTANTS.OPACITY_ENABLED;
                    btn.style.cursor = 'pointer';
                    btn.classList.remove('executing');

                    // 버튼 텍스트 복원
                    const btnText = btn.querySelector('.btn-text');
                    if (btnText && btn.dataset.originalText) {
                        btnText.textContent = btn.dataset.originalText;
                        delete btn.dataset.originalText;
                    }
                }
            });
        }
    }

    /**
     * 스크립트 데이터 로드
     * @param {Object} script - 스크립트 정보
     * @param {boolean} forceReload - 강제 재로드 여부
     */
    async loadScriptData(script, forceReload = false) {
        if (this.loadService) {
            return this.loadService.load(script, forceReload);
        }
    }

    /**
     * 워크플로우 저장
     */
    async saveWorkflow(options = {}) {
        if (this.saveService) {
            return this.saveService.save(options);
        }
    }

    /**
     * 현재 뷰포트 위치 가져오기
     */
    getCurrentViewportPosition() {
        return ViewportUtils.getCurrentViewportPosition();
    }

    /**
     * 뷰포트 위치 복원
     */
    restoreViewportPosition(viewportData) {
        ViewportUtils.restoreViewportPosition(viewportData);
    }

    /**
     * 워크플로우 데이터 준비
     */
    prepareWorkflowData(nodes) {
        if (this.executionService) {
            return this.executionService.prepareWorkflowData(nodes);
        }
        return { nodes: [], execution_mode: 'sequential' };
    }

    /**
     * 워크플로우 실행 애니메이션
     */
    animateWorkflowExecution(nodes) {
        if (this.executionService) {
            this.executionService.animateExecution(nodes);
        }
    }

    /**
     * 특정 스크립트의 워크플로우 저장
     */
    saveWorkflowForScript(script) {
        StorageUtils.saveToLocalStorage(this, script);
    }

    /**
     * 현재 워크플로우 자동 저장
     */
    autoSaveCurrentWorkflow() {
        StorageUtils.autoSave(this);
    }

    /**
     * 로컬 스토리지 상태 디버깅
     */
    debugStorageState() {
        StorageUtils.debugStorageState();
    }

    /**
     * 노드 타입 가져오기
     */
    getNodeType(node) {
        return getNodeType(node);
    }

    /**
     * 노드 데이터 가져오기
     */
    getNodeData(node) {
        return getNodeData(node);
    }

    /**
     * HTML 이스케이프 헬퍼
     */
    escapeHtml(text) {
        return escapeHtml(text);
    }

    /**
     * 스크립트 변경 처리 (사이드바 선택)
     *
     * 결론: detail을 큐에 넣고, 이미 처리 루프가 돌고 있으면 여기서는 return만 한다.
     * 이유: A→B→C를 빠르게 눌러도 applySingleScriptChange는 A→B, B→C 순으로만 실행되어 저장/로드가 겹치지 않는다.
     */
    async onScriptChanged(event) {
        this._scriptChangeQueue.push(event.detail);

        if (this._scriptChangeDraining) {
            return;
        }
        this._scriptChangeDraining = true;

        try {
            while (this._scriptChangeQueue.length > 0) {
                const detail = this._scriptChangeQueue.shift();
                await this.applySingleScriptChange(detail);
            }
        } finally {
            this._scriptChangeDraining = false;
        }
    }

    /**
     * 스크립트 한 번 바꿀 때의 실제 작업
     *
     * 순서: (1) 레지스트리 대기 (2) 이미 같은 스크립트면 생략 (3) 이전 스크립트 로컬+서버 저장 (4) loadScriptData
     */
    async applySingleScriptChange(detail) {
        const logger = this.getLogger();
        const log = logger.log;

        const { script, previousScript, forceReload = false } = detail;

        log('[WorkflowPage] applySingleScriptChange()', { script, previousScript, forceReload });

        if (!script || !script.id) {
            log('[WorkflowPage] ⚠️ 유효하지 않은 스크립트 정보. 건너뜀');
            return;
        }

        const registry = getNodeRegistry();
        try {
            await registry.getNodeConfigs();
        } catch (error) {
            logger.warn('[WorkflowPage] 노드 레지스트리 로딩 실패:', error);
        }

        if (this.loadService && !forceReload) {
            if (this.loadService.isScriptLoaded(script.id)) {
                log('[WorkflowPage] 같은 스크립트가 이미 로드됨. 건너뜀:', script.id);
                return;
            }
        }

        // 이전 스크립트: 결론 — 캔버스에 남아 있는 그래프를 반드시 previousScript.id로 서버에 남긴 뒤 새 스크립트를 연다.
        // (사이드바 선택은 이미 바뀐 뒤라 persistWorkflowToServerSilently에 id를 명시한다.)
        if (previousScript && previousScript.id) {
            if (this._workflowPersistTimer) {
                clearTimeout(this._workflowPersistTimer);
                this._workflowPersistTimer = null;
            }
            this.saveWorkflowForScript(previousScript);
            await this.persistWorkflowToServerSilently(previousScript.id);
            await new Promise((resolve) => setTimeout(resolve, 50));
        }

        await this.loadScriptData(script, forceReload);
    }

    /**
     * 연결선 매니저 초기화 보장
     */
    ensureConnectionManagerInitialized() {
        const nodeManager = getNodeManager();
        const ConnectionManager = getConnectionManager();

        if (!nodeManager) {
            console.warn('노드 매니저가 없습니다.');
            return;
        }

        const connectionManagerInstance = GlobalDependencies.getConnectionManagerInstance();
        if (!nodeManager.connectionManager || !connectionManagerInstance) {
            if (ConnectionManager && nodeManager.canvas) {
                nodeManager.connectionManager = new ConnectionManager(nodeManager.canvas);
                setConnectionManager(nodeManager.connectionManager);
            } else {
                console.warn('연결선 매니저 초기화 실패: ConnectionManager 클래스 또는 캔버스를 찾을 수 없습니다.');
            }
        }
    }

    /**
     * 키보드 단축키 설정
     */
    setupKeyboardShortcuts() {
        // capture 단계에서 이벤트를 처리하여 기본 동작을 먼저 막음
        document.addEventListener('keydown', (e) => {
            const nodeManager = getNodeManager();
            const modalManager = getModalManager();

            // Ctrl+S 또는 Cmd+S (Mac) - 워크플로우 저장
            if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                this.saveWorkflow({ useToast: true });
                return false;
            }

            // Ctrl+N - 노드 추가 모달 열기 (현재 포커스한 스크립트에서)
            if ((e.ctrlKey || e.metaKey) && (e.key === 'n' || e.key === 'N')) {
                e.preventDefault();
                // 현재 스크립트가 선택되어 있는지 확인
                const sidebarManager = this.getSidebarManager();
                const currentScript = sidebarManager ? sidebarManager.getCurrentScript() : null;
                if (currentScript && currentScript.id) {
                    this.showAddNodeModal();
                } else {
                    const logger = this.getLogger();
                    logger.log('[WorkflowPage] 현재 선택된 스크립트가 없어 노드 추가 모달을 열 수 없습니다.');
                }
            }

            if (e.key === 'F5' && !e.ctrlKey) {
                e.preventDefault();
                this.runWorkflow();
            }

            if (e.ctrlKey && e.key === 'r') {
                e.preventDefault();
                this.runWorkflow();
            }

            if (e.key === 'Delete' && nodeManager && nodeManager.selectedNode) {
                e.preventDefault();
                nodeManager.deleteNode(nodeManager.selectedNode).catch((error) => {
                    const logger = getLogger();
                    logger.error('[WorkflowPage] 노드 삭제 실패:', error);
                });
            }

            if (e.key === 'Escape') {
                if (modalManager && modalManager.isOpen()) {
                    modalManager.close();
                } else if (nodeManager && nodeManager.selectedNode) {
                    nodeManager.deselectNode();
                }
            }
        });
    }
}

/**
 * WorkflowPage 인스턴스 싱글톤
 */
let workflowPageInstance = null;

/**
 * WorkflowPage 인스턴스 가져오기
 */
export function getWorkflowPageInstance() {
    // 이미 인스턴스가 있으면 반환
    if (workflowPageInstance) {
        return workflowPageInstance;
    }

    // 없으면 새로 생성
    workflowPageInstance = new WorkflowPage();
    window.workflowPage = workflowPageInstance; // 전역 접근을 위해 window에 노출

    return workflowPageInstance;
}

/**
 * WorkflowPage 초기화
 */
export function initializeWorkflowPage(options = {}) {
    // 중복 초기화 방지
    if (workflowPageInstance && workflowPageInstance._initialized) {
        const logger = workflowPageInstance.getLogger();
        logger.log('[WorkflowPage] 이미 초기화된 인스턴스가 있습니다. 기존 인스턴스 반환');
        if (options.onReady) {
            options.onReady(workflowPageInstance);
        }
        return workflowPageInstance;
    }

    const workflowPage = new WorkflowPage();
    workflowPage.setupKeyboardShortcuts();

    workflowPageInstance = workflowPage;
    window.workflowPage = workflowPage; // 전역 접근을 위해 window에 노출

    if (options.onReady) {
        options.onReady(workflowPage);
    }

    return workflowPage;
}

/**
 * 자동 초기화 (기존 방식과의 호환성 유지)
 */
export function autoInitializeWorkflowPage() {
    // 이미 초기화되었으면 건너뛰기
    if (workflowPageInstance && workflowPageInstance._initialized) {
        return;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initializeWorkflowPage();
        });
    } else {
        initializeWorkflowPage();
    }
}

// 자동 초기화 실행 (ES6 모듈이 아닌 경우에만)
if (!window.__ES6_MODULE_LOADED__) {
    autoInitializeWorkflowPage();
}
