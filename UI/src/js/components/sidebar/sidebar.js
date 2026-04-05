/**
 * 사이드바 컴포넌트 메인 클래스
 *
 * 이 모듈은 워크플로우 편집기의 사이드바를 관리하는 핵심 클래스입니다.
 * 모듈화된 구조로 설계되어 유지보수성과 확장성을 높였습니다.
 *
 * @module sidebar
 */

import { ScriptAPI } from '../../api/scriptapi.js';
import { UserSettingsAPI } from '../../api/user-settings-api.js';
import { getModalManagerInstance } from '../../utils/modal.js';
import { getLogger, formatDate as formatDateUtil } from './sidebar-utils.js';
import { SidebarUIManager } from './sidebar-ui.js';
import { SidebarEventHandler } from './sidebar-events.js';
import { SidebarScriptManager } from './sidebar-scripts.js';

/**
 * SidebarManager 클래스
 *
 * 사이드바의 스크립트 목록 관리 및 UI 제어를 담당하는 메인 클래스입니다.
 * 하위 모듈들을 조합하여 사용하며, 각 모듈의 책임을 명확히 분리했습니다.
 *
 * **모듈 구조:**
 * - `SidebarUIManager`: UI 렌더링 및 업데이트
 * - `SidebarEventHandler`: 이벤트 바인딩 및 처리
 * - `SidebarScriptManager`: 스크립트 로드 및 실행 관리
 * - `sidebar-utils`: 공통 유틸리티 함수
 *
 * **주요 기능:**
 * - 스크립트 목록 표시 및 관리
 * - 스크립트 선택 및 포커스 관리
 * - 스크립트 CRUD 작업 (생성, 삭제, 순서 변경)
 * - 전체 스크립트 순차 실행
 * - 사이드바 리사이즈 기능
 *
 * @class SidebarManager
 */
export class SidebarManager {
    /**
     * SidebarManager 생성자 (Constructor)
     *
     * Constructor란?
     * 클래스 인스턴스가 생성될 때 자동으로 호출되는 메서드입니다.
     * 사이드바의 초기 상태를 설정하고, DOM이 준비되면 초기화 작업을 시작합니다.
     *
     * 주요 역할:
     * 1. 인스턴스 변수 초기화 (스크립트 목록, 현재 선택 인덱스 등)
     * 2. DOM 로드 상태 확인 후 init() 메서드 호출
     * 3. 서버에서 스크립트 목록을 불러오는 작업 시작
     */
    constructor() {
        // 스크립트 목록 배열 초기화 (서버에서 로드된 스크립트들을 저장)
        this.scripts = []; // 초기값은 빈 배열, 서버에서 로드

        // 현재 선택된 스크립트의 인덱스 (0부터 시작)
        this.currentScriptIndex = 0;

        // 이전에 선택했던 스크립트 정보 저장 (변경 감지 등에 사용)
        this.previousScript = null; // 이전 스크립트 정보 저장

        // 전체 스크립트 실행 중 플래그 초기화
        this.isRunningAllScripts = false;
        this.isCancelled = false; // 실행 취소 플래그

        // API 참조 저장
        this.scriptAPI = ScriptAPI;
        this.userSettingsAPI = UserSettingsAPI;

        // 하위 모듈 초기화
        this.uiManager = new SidebarUIManager(this);
        this.eventHandler = new SidebarEventHandler(this);
        this.scriptManager = new SidebarScriptManager(this);

        // DOM 로드 상태에 따라 초기화 시점 결정
        // document.readyState가 'loading'이면 아직 DOM이 로드 중이므로
        // DOMContentLoaded 이벤트를 기다린 후 init() 호출
        if (document.readyState === 'loading') {
            // DOM이 완전히 로드될 때까지 대기
            document.addEventListener('DOMContentLoaded', () => {
                // 이벤트 루프의 다음 틱에서 실행 (다른 스크립트들이 먼저 로드되도록)
                setTimeout(() => this.init(), 0);
            });
        } else {
            // DOM이 이미 로드된 상태라면 즉시 init() 호출
            // setTimeout을 사용하여 이벤트 루프의 다음 틱에서 실행
            setTimeout(() => this.init(), 0);
        }
    }

    async init() {
        this.eventHandler.setupEventListeners();
        this.uiManager.setupPaginationEvents(); // 페이지 네비게이션 이벤트 설정 (페이징 기능 활성화)
        await this.scriptManager.loadScriptsFromServer();
    }

    /**
     * 서버에서 스크립트 목록을 가져와서 로드
     *
     * SidebarScriptManager에 위임하여 스크립트 목록을 서버에서 로드합니다.
     *
     * @returns {Promise<void>}
     * @see SidebarScriptManager.loadScriptsFromServer
     */
    async loadScriptsFromServer() {
        return this.scriptManager.loadScriptsFromServer();
    }

    /**
     * 날짜 포맷팅
     *
     * sidebar-utils의 formatDate 함수에 위임합니다.
     *
     * @param {string} dateString - ISO 날짜 문자열
     * @returns {string} 포맷된 날짜 문자열
     * @see formatDate
     */
    formatDate(dateString) {
        return formatDateUtil(dateString);
    }

    /**
     * 이벤트 리스너 설정
     *
     * SidebarEventHandler에 위임하여 사이드바의 모든 이벤트를 바인딩합니다.
     *
     * @returns {void}
     * @see SidebarEventHandler.setupEventListeners
     */
    setupEventListeners() {
        return this.eventHandler.setupEventListeners();
    }

    /**
     * 사이드바 리사이즈 핸들 설정
     *
     * SidebarEventHandler에 위임하여 사이드바 너비 조절 기능을 설정합니다.
     *
     * @returns {void}
     * @see SidebarEventHandler.setupResizeHandle
     */
    setupResizeHandle() {
        return this.eventHandler.setupResizeHandle();
    }

    /**
     * 사이드바 너비 변경 시 관련 요소들도 함께 조정
     *
     * SidebarUIManager에 위임하여 사이드바 너비 변경 시 레이아웃을 조정합니다.
     *
     * @param {number} width - 새로운 사이드바 너비 (픽셀)
     * @param {boolean} [isResizing=false] - 현재 리사이즈 중인지 여부
     * @returns {void}
     * @see SidebarUIManager.adjustLayoutForSidebarWidth
     */
    adjustLayoutForSidebarWidth(width, isResizing = false) {
        return this.uiManager.adjustLayoutForSidebarWidth(width, isResizing);
    }

    /**
     * 사이드바 너비를 서버에 저장
     *
     * SidebarUIManager에 위임하여 사용자가 설정한 사이드바 너비를 서버에 저장합니다.
     *
     * @param {number} width - 저장할 사이드바 너비 (픽셀)
     * @returns {Promise<void>}
     * @see SidebarUIManager.saveSidebarWidth
     */
    async saveSidebarWidth(width) {
        return this.uiManager.saveSidebarWidth(width);
    }

    /**
     * 서버에서 사이드바 너비 로드
     *
     * SidebarUIManager에 위임하여 저장된 사이드바 너비를 서버에서 로드합니다.
     *
     * @returns {Promise<void>}
     * @see SidebarUIManager.loadSidebarWidth
     */
    async loadSidebarWidth() {
        return this.uiManager.loadSidebarWidth();
    }

    /**
     * 스크립트 목록 렌더링
     *
     * SidebarUIManager에 위임하여 현재 스크립트 목록을 DOM에 렌더링합니다.
     *
     * @returns {void}
     * @see SidebarUIManager.loadScripts
     */
    loadScripts() {
        return this.uiManager.loadScripts();
    }

    /**
     * 드래그 앤 드롭 기능 설정 (위임)
     */
    setupDragAndDrop(scriptItem, index) {
        return this.eventHandler.setupDragAndDrop(scriptItem, index);
    }

    /**
     * 스크립트 순서 변경 (위임)
     */
    reorderScripts(fromIndex, toIndex) {
        return this.scriptManager.reorderScripts(fromIndex, toIndex);
    }

    /**
     * 스크립트 실행 순서를 DB에 저장 (위임)
     */
    async saveScriptOrderToDB() {
        return this.scriptManager.saveScriptOrderToDB();
    }

    /**
     * 스크립트 순서를 서버에 저장 (위임)
     */
    async saveScriptOrder() {
        return this.scriptManager.saveScriptOrder();
    }

    /**
     * 서버에서 스크립트 순서 로드 (위임)
     */
    async loadScriptOrder() {
        return this.scriptManager.loadScriptOrder();
    }

    /**
     * 저장된 순서대로 스크립트 배열 재정렬 (위임)
     */
    applyScriptOrder(savedOrder) {
        return this.scriptManager.applyScriptOrder(savedOrder);
    }

    /**
     * 스크립트 선택 (위임)
     */
    async selectScript(index) {
        return this.scriptManager.selectScript(index);
    }

    /**
     * 헤더 업데이트 (위임)
     */
    updateHeader() {
        return this.uiManager.updateHeader();
    }

    /**
     * 스크립트 추가 모달 표시 (위임)
     */
    showAddScriptModal() {
        return this.scriptManager.showAddScriptModal();
    }

    /**
     * 스크립트 추가 (위임)
     */
    async addScript() {
        return this.scriptManager.addScript();
    }

    /**
     * 스크립트 삭제 (위임)
     */
    async deleteScript(index) {
        return this.scriptManager.deleteScript(index);
    }

    /**
     * 현재 스크립트 가져오기
     */
    getCurrentScript() {
        return this.scripts[this.currentScriptIndex];
    }

    /**
     * 이전 스크립트 가져오기
     */
    getPreviousScript() {
        return this.previousScript || null;
    }

    /**
     * 스크립트 변경 전 현재 워크플로우 저장 (위임)
     */
    saveCurrentWorkflowBeforeSwitch() {
        return this.scriptManager.saveCurrentWorkflowBeforeSwitch();
    }

    /**
     * 현재 캔버스 뷰포트 위치 가져오기
     */
    getCurrentViewportPosition() {
        const canvasContent = document.getElementById('canvas-content');

        if (canvasContent) {
            // Transform 기반 패닝 (피그마 방식)
            const transform = canvasContent.style.transform || 'translate(-50000px, -50000px) scale(1)';

            // Transform 파싱
            let x = -50000,
                y = -50000,
                scale = 1;

            const translateMatch = transform.match(/translate\(([^,]+)px,\s*([^)]+)px\)/);
            if (translateMatch) {
                x = parseFloat(translateMatch[1]) || -50000;
                y = parseFloat(translateMatch[2]) || -50000;
            }

            const scaleMatch = transform.match(/scale\(([^)]+)\)/);
            if (scaleMatch) {
                scale = parseFloat(scaleMatch[1]) || 1;
            }

            return { x, y, scale, mode: 'transform' };
        } else {
            // 스크롤 기반 패닝 (전통적 방식)
            const canvas = document.getElementById('workflow-canvas');
            if (canvas) {
                const x = canvas.scrollLeft || 0;
                const y = canvas.scrollTop || 0;
                return { x, y, scale: 1, mode: 'scroll' };
            }
        }

        // 기본값 반환
        return { x: -50000, y: -50000, scale: 1, mode: 'transform' };
    }

    /**
     * 모든 스크립트 가져오기
     */
    getAllScripts() {
        return this.scripts;
    }

    /**
     * 스크립트 변경 이벤트 발생
     */
    dispatchScriptChangeEvent(forceReload = false) {
        const logger = getLogger();
        const log = logger.log;

        const currentScript = this.getCurrentScript();
        const previousScript = this.getPreviousScript();

        log('[Sidebar] dispatchScriptChangeEvent() 호출됨');
        log('[Sidebar] 현재 스크립트:', currentScript);
        log('[Sidebar] 이전 스크립트:', previousScript);
        log('[Sidebar] 강제 재로드:', forceReload);

        const event = new CustomEvent('scriptChanged', {
            detail: {
                script: currentScript,
                previousScript: previousScript,
                index: this.currentScriptIndex,
                forceReload: forceReload
            }
        });

        log('[Sidebar] scriptChanged 이벤트 dispatch 시작');
        document.dispatchEvent(event);
        log('[Sidebar] ✅ scriptChanged 이벤트 dispatch 완료');
    }

    /**
     * 스크립트 데이터 저장 (위임)
     */
    saveScripts() {
        return this.scriptManager.saveScripts();
    }

    /**
     * 스크립트 데이터 로드 (위임)
     */
    loadScriptsFromStorage() {
        return this.scriptManager.loadScriptsFromStorage();
    }

    /**
     * 모든 스크립트를 순차적으로 실행 (위임)
     */
    async runAllScripts() {
        return this.scriptManager.runAllScripts();
    }

    /**
     * 실행 취소
     */
    cancelExecution() {
        const logger = getLogger();
        logger.log('[Sidebar] 실행 취소 요청');
        this.isCancelled = true;

        // WorkflowPage의 executionService도 취소
        const getWorkflowPage = () => {
            if (window.workflowPage) {
                return window.workflowPage;
            }
            if (window.getWorkflowPageInstance) {
                return window.getWorkflowPageInstance();
            }
            return null;
        };

        const workflowPage = getWorkflowPage();
        if (workflowPage && workflowPage.executionService) {
            workflowPage.executionService.cancel();
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
                    btn.style.opacity = '0.5';
                    btn.style.cursor = 'not-allowed';
                    btn.classList.remove('executing');
                }
            });

            // 실행 중인 버튼만 활성화 및 실행 중 스타일 적용
            const activeBtn = activeButton === 'run-btn' ? buttons.run : buttons.runAll;
            if (activeBtn) {
                activeBtn.disabled = false;
                activeBtn.style.opacity = '1';
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
                    btn.style.opacity = '1';
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
}

/**
 * 사이드바 초기화 함수
 * ES6 모듈에서 export하여 외부에서 호출 가능
 *
 * @param {Object} options - 초기화 옵션
 * @param {Function} options.onReady - 초기화 완료 콜백
 * @returns {Promise<SidebarManager>} 초기화된 SidebarManager 인스턴스
 */
export async function initializeSidebar(options = {}) {
    const logger = getLogger();
    const log = logger.log;
    const logError = logger.error;

    log('[sidebar.js] Sidebar 초기화 시작');
    log(
        '[sidebar.js] 현재 상태 - apiCall:',
        window.apiCall !== undefined ? '존재' : '없음',
        'ScriptAPI:',
        ScriptAPI !== undefined ? '존재' : '없음'
    );

    /**
     * 스크립트 로딩 확인 함수
     * 브라우저 전용 애플리케이션이므로 window는 항상 존재합니다.
     * ScriptAPI는 이미 import되었으므로 항상 존재합니다.
     */
    function checkScriptsLoaded() {
        const apiLoaded = window.apiCall !== undefined;
        // ScriptAPI는 이미 import되었으므로 항상 존재
        const scriptApiLoaded = ScriptAPI !== undefined;

        log('[sidebar.js] 스크립트 로딩 상태 확인:', {
            apiCall: apiLoaded ? '로드됨' : '로드 안됨',
            ScriptAPI: scriptApiLoaded ? '로드됨' : '로드 안됨',
            window_apiCall: window.apiCall,
            ScriptAPIObject: ScriptAPI
        });

        return apiLoaded && scriptApiLoaded;
    }

    // apiCall이 로드될 때까지 기다리기 (ScriptAPI는 이미 import되었으므로 대기 불필요)
    let attempts = 0;
    const maxAttempts = 10; // 최대 0.5초 대기

    while (!checkScriptsLoaded() && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        attempts++;

        // 10번마다 로그 출력
        if (attempts % 10 === 0) {
            log(`[sidebar.js] 초기화 대기 중... (${attempts}/${maxAttempts})`);
            checkScriptsLoaded();
        }
    }

    if (window.apiCall === undefined) {
        logError('[sidebar.js] ❌ apiCall이 로드되지 않았습니다.');
        logError('[sidebar.js] api.js 파일이 로드되었는지 브라우저 개발자 도구의 Network 탭에서 확인하세요.');
    } else {
        log('[sidebar.js] ✅ apiCall 로드 확인됨');
    }

    // ScriptAPI는 이미 import되었으므로 항상 존재
    log('[sidebar.js] ✅ ScriptAPI 로드 확인됨 (import)');

    // 이제 SidebarManager 인스턴스 생성
    const sidebarManager = new SidebarManager();
    window.sidebarManager = sidebarManager; // 전역 호환성 유지
    log('[sidebar.js] SidebarManager 인스턴스 생성 완료');

    if (options.onReady) {
        options.onReady(sidebarManager);
    }

    return sidebarManager;
}

/**
 * SidebarManager 인스턴스 가져오기
 * ES6 모듈에서 명시적으로 인스턴스를 가져올 수 있도록 제공
 *
 * @returns {SidebarManager|null} SidebarManager 인스턴스 또는 null
 */
export function getSidebarInstance() {
    // 먼저 전역 변수 확인 (기존 코드 호환성)
    if (window.sidebarManager) {
        return window.sidebarManager;
    }

    // 인스턴스가 없으면 null 반환
    // 호출하는 쪽에서 필요시 initializeSidebar()를 호출해야 함
    return null;
}

/**
 * 자동 초기화 (기존 IIFE 방식과의 호환성 유지)
 * 페이지 로드 완료 후 자동으로 사이드바를 초기화합니다.
 */
export function autoInitializeSidebar() {
    const logger = getLogger();
    const log = logger.log;

    log('[sidebar.js] 스크립트 파일 로드됨');

    // 모든 스크립트가 로드된 후 초기화
    if (document.readyState === 'complete') {
        // 이미 로드 완료된 경우 약간의 지연 후 실행 (스크립트 실행 완료 대기)
        setTimeout(() => initializeSidebar(), 200);
    } else {
        // window.onload는 모든 리소스(이미지, 스크립트 등)가 로드된 후 실행
        window.addEventListener('load', () => {
            log('[sidebar.js] window.onload 이벤트 발생');
            // 추가로 약간의 지연을 두어 스크립트 실행이 완료되도록 함
            setTimeout(() => initializeSidebar(), 200);
        });
    }
}

// 자동 초기화 실행 (기존 IIFE 방식과 동일한 동작)
// ES6 모듈이 아닌 경우에만 실행 (스크립트 태그로 로드된 경우)
// 주의: ES6 모듈로 사용할 때는 명시적으로 import하여 사용해야 합니다.
// 브라우저 전용 애플리케이션이므로 window는 항상 존재합니다.
if (!window.__ES6_MODULE_LOADED__) {
    autoInitializeSidebar();
}
