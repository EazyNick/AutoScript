/**
 * 대시보드 페이지 관리 클래스
 * ES6 모듈 방식으로 작성됨
 */

import { ScriptAPI } from '../../js/api/scriptapi.js';
import { apiCall } from '../../js/api/api.js';
import { getSidebarInstance } from '../../js/components/sidebar/sidebar.js';
import { t } from '../../js/utils/i18n.js';

const getSidebarManager = () => getSidebarInstance();

/**
 * 로거 유틸리티 가져오기
 */
const getLogger = () => {
    return {
        log: window.log || (window.Logger ? window.Logger.log.bind(window.Logger) : console.log),
        warn: window.logWarn || (window.Logger ? window.Logger.warn.bind(window.Logger) : console.warn),
        error: window.logError || (window.Logger ? window.Logger.error.bind(window.Logger) : console.error)
    };
};

/**
 * DashboardManager 클래스
 * 대시보드 페이지의 데이터 로드 및 UI 업데이트를 담당합니다.
 */
export class DashboardManager {
    constructor() {
        this.scripts = [];
        this.currentPage = 1; // 대시보드 스크립트 그리드의 현재 페이지
        this.itemsPerPage = 12; // 초기값, 이후 화면 크기에 따라 동적 계산
        this.minDashboardCardWidth = 320; // CSS minmax(320px, 1fr)와 일치
        this.dashboardRowGap = 20; // CSS grid row-gap 값
        this.dashboardResizeDebounce = null;
        this.executionStats = {
            totalScripts: 0,
            allExecutions: 0, // 전체 실행 시 실행된 스크립트 개수
            allFailed: 0, // 전체 실행 시 실패한 스크립트 개수
            inactiveScripts: 0
        };
        this.runningScriptId = null; // 현재 실행 중인 스크립트 ID
        this.setupExecutionEventListeners();
    }

    /**
     * 대시보드 초기화
     *
     * 초기화 과정:
     * 1. 언어 설정 로드 및 적용
     * 2. HTML 정적 텍스트 번역 적용
     * 3. CSS 실행 중 텍스트 변수 설정
     * 4. 페이지 네비게이션 이벤트 핸들러 설정 (페이징 기능 활성화)
     * 5. 대시보드 데이터 로드 및 UI 렌더링
     */
    async init() {
        const logger = getLogger();
        logger.log('[Dashboard] 대시보드 초기화 시작');

        // 언어 설정 확인 및 적용
        try {
            const { getLanguage, setLanguage } = await import('../../js/utils/i18n.js');
            const { UserSettingsAPI } = await import('../../js/api/user-settings-api.js');

            // 서버에서 언어 설정 로드
            const savedLanguage = await UserSettingsAPI.getSetting('language');
            const currentLanguage = getLanguage();
            const language = savedLanguage || 'en';

            // 언어가 다르면 적용 (초기 로드 시에는 silent=true로 설정)
            if (currentLanguage !== language) {
                await setLanguage(language, true);
                logger.log(`[Dashboard] 언어 설정 적용: ${language}`);
            }
        } catch (error) {
            logger.warn('[Dashboard] 언어 설정 로드 실패:', error);
        }

        // HTML의 정적 텍스트 업데이트
        this.updateStaticTexts();

        // CSS 변수 업데이트 (실행 중 텍스트 번역)
        this.updateRunningTextCSS();

        // 페이지 네비게이션 이벤트 설정 (페이징 기능 활성화)
        this.setupDashboardPaginationEvents();

        // 화면 크기 변경 및 브라우저 확대/축소(zoom) 시 재계산
        window.addEventListener('resize', () => this.handleResize());
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', () => this.handleResize());
        }

        await this.loadDashboardData();
        this.renderDashboard();
    }

    /**
     * 스크립트 실행 이벤트 리스너 설정
     */
    setupExecutionEventListeners() {
        // 스크립트 실행 시작 이벤트
        document.addEventListener('scriptExecutionStarted', (event) => {
            const { scriptId } = event.detail;
            this.setScriptRunning(scriptId, true);
        });

        // 스크립트 실행 완료 이벤트
        document.addEventListener('scriptExecutionCompleted', (event) => {
            const { scriptId, status } = event.detail;
            this.setScriptRunning(scriptId, false);
            // 실행 완료 후 잠시 성공/실패 상태 표시
            if (status === 'success') {
                this.setScriptStatus(scriptId, 'success');
                setTimeout(() => this.setScriptStatus(scriptId, null), 2000);
            } else if (status === 'failed') {
                // 실패한 스크립트는 팝업이 뜰 때까지 빨간색으로 유지
                this.setScriptStatus(scriptId, 'failed');
                if (!this.failedScriptIds) {
                    this.failedScriptIds = new Set();
                }
                this.failedScriptIds.add(scriptId);
            }
        });

        // 전체 실행 완료 이벤트
        document.addEventListener('allScriptsExecutionCompleted', () => {
            // 모든 스크립트의 실행 중 상태 제거 (실패 상태는 유지)
            this.clearAllRunningStates();
        });

        // 실행 결과 모달 표시 이벤트 (팝업이 뜬 후 실패 상태 제거)
        // this 컨텍스트 보존을 위한 참조
        const self = this;
        document.addEventListener('executionResultModalShown', () => {
            // 실패한 스크립트들의 상태 제거
            if (self && typeof self.clearFailedStates === 'function') {
                self.clearFailedStates();
            }
        });
    }

    /**
     * 스크립트 카드 찾기 (헬퍼 함수)
     * @param {number} scriptId - 스크립트 ID
     * @returns {HTMLElement|null} 찾은 카드 요소
     */
    findScriptCard(scriptId) {
        // 1. data-script-id로 직접 찾기
        let card = document.querySelector(`.script-card[data-script-id="${scriptId}"]`);
        if (card) {
            return card;
        }

        // 2. 버튼의 data-script-id로 찾기
        const runBtn = document.querySelector(`.btn-run[data-script-id="${scriptId}"]`);
        if (runBtn) {
            card = runBtn.closest('.script-card');
            if (card) {
                // data-script-id 속성 설정 (다음 조회를 위해)
                card.setAttribute('data-script-id', scriptId);
                return card;
            }
        }

        // 3. 모든 카드를 순회하며 버튼으로 찾기
        const allCards = document.querySelectorAll('.script-card');
        for (const c of allCards) {
            const btn = c.querySelector(`.btn-run[data-script-id="${scriptId}"]`);
            if (btn) {
                c.setAttribute('data-script-id', scriptId);
                return c;
            }
        }

        return null;
    }

    /**
     * 스크립트 실행 중 상태 설정
     */
    setScriptRunning(scriptId, isRunning) {
        const logger = getLogger();
        logger.log(`[Dashboard] 스크립트 실행 상태 변경: ${scriptId}, 실행 중: ${isRunning}`);

        this.runningScriptId = isRunning ? scriptId : null;

        const card = this.findScriptCard(scriptId);
        if (card) {
            this.updateScriptCardState(card, isRunning);
        }
    }

    /**
     * 스크립트 카드 상태 업데이트 (실행 중)
     */
    updateScriptCardState(card, isRunning) {
        if (isRunning) {
            card.classList.add('executing');
            // data-script-id가 없으면 설정
            if (!card.getAttribute('data-script-id')) {
                const scriptId = card.querySelector('.btn-run')?.dataset?.scriptId;
                if (scriptId) {
                    card.setAttribute('data-script-id', scriptId);
                }
            }
        } else {
            card.classList.remove('executing');
        }
    }

    /**
     * 스크립트 상태 설정 (성공/실패)
     */
    setScriptStatus(scriptId, status) {
        const logger = getLogger();
        logger.log(`[Dashboard] setScriptStatus 호출: scriptId=${scriptId}, status=${status}`);

        const card = this.findScriptCard(scriptId);
        if (card) {
            logger.log(`[Dashboard] 스크립트 카드 찾음: ${scriptId}`);
            this.updateScriptCardStatus(card, status);
        } else {
            logger.warn(`[Dashboard] 스크립트 카드를 찾을 수 없음: ${scriptId}`);
        }
    }

    /**
     * 스크립트 카드 상태 업데이트 (성공/실패)
     */
    updateScriptCardStatus(card, status) {
        const logger = getLogger();
        logger.log(`[Dashboard] updateScriptCardStatus 호출: status=${status}`);

        // 기존 상태 클래스 제거
        card.classList.remove('execution-success', 'execution-failed');

        if (status === 'success') {
            card.classList.add('execution-success');
            logger.log('[Dashboard] execution-success 클래스 추가됨');
        } else if (status === 'failed') {
            card.classList.add('execution-failed');
            logger.log('[Dashboard] execution-failed 클래스 추가됨');
        } else if (status === null) {
            // 상태 제거
            logger.log('[Dashboard] 상태 클래스 제거됨');
        }
    }

    /**
     * 모든 실행 중 상태 제거 (실패 상태는 유지)
     */
    clearAllRunningStates() {
        const logger = getLogger();
        logger.log('[Dashboard] 모든 실행 중 상태 제거 (실패 상태는 유지)');

        const executingCards = document.querySelectorAll('.script-card.executing');
        executingCards.forEach((card) => {
            card.classList.remove('executing');
        });

        // 성공 상태만 제거 (실패 상태는 유지)
        const successCards = document.querySelectorAll('.script-card.execution-success');
        successCards.forEach((card) => {
            card.classList.remove('execution-success');
        });

        this.runningScriptId = null;
    }

    /**
     * 실패한 스크립트 상태 제거 (팝업 표시 후 호출)
     */
    clearFailedStates() {
        const logger = getLogger();
        logger.log('[Dashboard] 실패한 스크립트 상태 제거');

        // failedScriptIds가 없으면 초기화
        if (!this.failedScriptIds) {
            this.failedScriptIds = new Set();
            return;
        }

        // 실패한 스크립트 ID 목록을 순회하며 상태 제거
        if (this.failedScriptIds.size > 0) {
            this.failedScriptIds.forEach((scriptId) => {
                this.setScriptStatus(scriptId, null);
            });
        }

        // 실패한 스크립트 ID 목록 초기화
        this.failedScriptIds.clear();
    }

    /**
     * HTML의 정적 텍스트 업데이트
     */
    updateStaticTexts() {
        // 페이지 제목 및 부제목
        const dashboardTitle = document.querySelector('.dashboard-title');
        if (dashboardTitle) {
            dashboardTitle.textContent = t('header.dashboard');
        }
        const dashboardSubtitle = document.querySelector('.dashboard-subtitle');
        if (dashboardSubtitle) {
            dashboardSubtitle.textContent = t('header.dashboardSubtitle');
        }

        // 새 워크플로우 버튼
        const newWorkflowBtn = document.querySelector('.btn-new-workflow .btn-text');
        if (newWorkflowBtn) {
            newWorkflowBtn.textContent = t('sidebar.newWorkflow');
        }

        // 통계 카드 레이블
        const statLabels = document.querySelectorAll('.stat-label');
        if (statLabels.length >= 4) {
            statLabels[0].textContent = t('dashboard.totalWorkflows');
            statLabels[1].textContent = t('dashboard.totalExecutions');
            statLabels[2].textContent = t('dashboard.failedScripts');
            statLabels[3].textContent = t('dashboard.inactiveScripts');
        }

        // 섹션 제목
        const sectionTitle = document.querySelector('.dashboard-scripts .section-title');
        if (sectionTitle) {
            sectionTitle.textContent = t('dashboard.scripts');
        }
    }

    /**
     * CSS 변수 업데이트 (실행 중 텍스트 번역)
     */
    updateRunningTextCSS() {
        const runningText = ` ${t('common.running')}...`;
        document.documentElement.style.setProperty('--running-text', `'${runningText}'`);
    }

    /**
     * 대시보드 데이터 로드
     */
    async loadDashboardData() {
        const logger = getLogger();
        logger.log('[Dashboard] 대시보드 데이터 로드 시작');

        try {
            // 스크립트 목록 로드
            if (ScriptAPI && typeof ScriptAPI.getAllScripts === 'function') {
                // 서버에서 이미 execution_order 기준으로 정렬되어 반환되므로 별도 정렬 불필요
                this.scripts = await ScriptAPI.getAllScripts();
                logger.log('[Dashboard] 스크립트 목록 로드 완료:', this.scripts.length);
            } else {
                logger.warn('[Dashboard] ScriptAPI를 사용할 수 없습니다.');
                this.scripts = [];
            }

            // 대시보드 통계 데이터 로드
            await this.loadDashboardStats();
        } catch (error) {
            logger.error('[Dashboard] 데이터 로드 실패:', error);
            this.scripts = [];
            this.calculateStats();
        }
    }

    /**
     * 대시보드 통계 데이터 로드
     */
    async loadDashboardStats() {
        const logger = getLogger();
        logger.log('[Dashboard] 대시보드 통계 데이터 로드 시작');

        try {
            const apiHost = window.API_HOST || 'localhost';
            const apiPort = window.API_PORT || 8001;
            // 실행 기록 저장 후에는 캐시를 사용하지 않고 최신 데이터 조회
            const response = await fetch(`http://${apiHost}:${apiPort}/api/dashboard/stats?use_cache=false`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            logger.log('[Dashboard] 대시보드 통계 데이터 로드 완료:', result);

            // 변경된 응답 형식: {success: true, message: "...", data: {...}}
            const stats = result.data || result; // 하위 호환성 유지

            // 통계 데이터 설정
            this.executionStats = {
                totalScripts: stats.total_scripts || 0,
                allExecutions: stats.all_executions || 0, // 전체 실행 시 실행된 스크립트 개수
                allFailed: stats.all_failed_scripts || 0, // 전체 실행 시 실패한 스크립트 개수
                inactiveScripts: stats.inactive_scripts || 0
            };
        } catch (error) {
            logger.error('[Dashboard] 대시보드 통계 데이터 로드 실패:', error);
            // 실패 시 로컬 계산
            this.calculateStats();
        }
    }

    /**
     * 통계 데이터 계산
     */
    calculateStats() {
        this.executionStats.totalScripts = this.scripts.length;
        // 전체 실행 통계는 서버에서 관리하므로 로컬에서 초기화하지 않음 (기존 값 유지)
        // this.executionStats.allExecutions와 allFailed는 서버에서 로드한 값을 유지
        // 비활성 스크립트 개수 계산
        this.executionStats.inactiveScripts = this.scripts.filter((script) => !script.active).length;
    }

    /**
     * 대시보드 렌더링
     */
    renderDashboard() {
        this.updateItemsPerPage();
        const totalPages = Math.max(1, Math.ceil(this.scripts.length / this.itemsPerPage));
        if (this.currentPage > totalPages) {
            this.currentPage = totalPages;
        }
        this.updateStats();
        this.renderScripts();
    }

    /**
     * 화면 크기 변경 시 페이지당 표시 개수 재계산
     *
     * 리사이즈 이벤트가 빠르게 발생할 수 있기 때문에 debounce 처리합니다.
     */
    handleResize() {
        if (this.dashboardResizeDebounce) {
            clearTimeout(this.dashboardResizeDebounce);
        }
        this.dashboardResizeDebounce = window.setTimeout(() => {
            const previousItemsPerPage = this.itemsPerPage;
            this.updateItemsPerPage();
            if (this.itemsPerPage !== previousItemsPerPage) {
                this.currentPage = 1;
                this.renderDashboard();
            }
        }, 100);
    }

    /**
     * 페이지당 표시할 스크립트 개수를 화면 크기에 따라 계산
     *
     * 원리:
     * 1. 현재 그리드 너비로 가능한 열 수를 계산
     * 2. 카드 높이를 측정하여 가능 행 수를 계산
     * 3. 행 수 × 열 수로 itemsPerPage를 결정
     *
     * 브라우저 확대/축소(zoom)도 반영됩니다.
     * getBoundingClientRect()는 렌더된 레이아웃 크기를 기준으로 계산하므로,
     * zoom 변화가 있으면 resize/visualViewport resize 이벤트로 재계산됩니다.
     */
    updateItemsPerPage() {
        const scriptsGrid = document.getElementById('dashboard-scripts-grid');
        const pagination = document.getElementById('dashboard-pagination');
        if (!scriptsGrid) {
            return;
        }

        const gridStyles = window.getComputedStyle(scriptsGrid);
        const rowGap = parseFloat(gridStyles.rowGap) || this.dashboardRowGap;
        const gridRect = scriptsGrid.getBoundingClientRect();

        const paginationRect = pagination ? pagination.getBoundingClientRect() : null;
        const paginationStyles = pagination ? window.getComputedStyle(pagination) : null;
        const paginationMarginTop = paginationStyles ? parseFloat(paginationStyles.marginTop) || 0 : 0;

        const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        const paginationHeight = paginationRect ? paginationRect.height + paginationMarginTop : 0;
        const availableHeight = Math.max(0, viewportHeight - gridRect.top - paginationHeight - 10);

        if (availableHeight <= 0) {
            return;
        }

        const columns = Math.max(1, Math.floor((gridRect.width + rowGap) / (this.minDashboardCardWidth + rowGap)));

        const cardWidth = Math.max(0, (gridRect.width - rowGap * (columns - 1)) / columns);
        const cardHeight = this.measureDashboardCardHeight(cardWidth);
        if (cardHeight <= 0) {
            return;
        }

        const rowHeight = cardHeight + rowGap;
        const rows = Math.max(1, Math.floor((availableHeight + rowGap) / rowHeight));
        this.itemsPerPage = rows * columns;
    }

    /**
     * 스크립트 카드 높이를 실제 스타일로 측정
     */
    measureDashboardCardHeight(width) {
        const dummyScript = {
            id: -1,
            name: '테스트 제목',
            description: '설명 테스트 텍스트',
            active: true,
            last_executed_at: null
        };
        const dummyCard = this.createScriptCard(dummyScript);
        dummyCard.style.position = 'absolute';
        dummyCard.style.visibility = 'hidden';
        dummyCard.style.left = '-9999px';
        dummyCard.style.top = '-9999px';
        dummyCard.style.width = `${width}px`;
        document.body.appendChild(dummyCard);

        const height = dummyCard.getBoundingClientRect().height;
        document.body.removeChild(dummyCard);
        return height;
    }

    /**
     * 통계 카드 업데이트
     */
    updateStats() {
        const stats = this.executionStats;

        // 전체 스크립트 카드
        const totalScriptsCard = document.querySelector('.stat-card:nth-child(1)');
        if (totalScriptsCard) {
            const valueEl = totalScriptsCard.querySelector('.stat-value');
            if (valueEl) {
                valueEl.textContent = stats.totalScripts;
            }
        }

        // 전체 실행 횟수 카드
        const allExecutionsCard = document.querySelector('.stat-card:nth-child(2)');
        if (allExecutionsCard) {
            const valueEl = allExecutionsCard.querySelector('.stat-value');
            if (valueEl) {
                valueEl.textContent = stats.allExecutions;
            }
        }

        // 전체 실행 실패한 스크립트 카드
        const allFailedCard = document.querySelector('.stat-card:nth-child(3)');
        if (allFailedCard) {
            const valueEl = allFailedCard.querySelector('.stat-value');
            if (valueEl) {
                valueEl.textContent = stats.allFailed;
            }
        }

        // 비활성 스크립트 카드
        const inactiveScriptsCard = document.querySelector('.stat-card:nth-child(4)');
        if (inactiveScriptsCard) {
            const valueEl = inactiveScriptsCard.querySelector('.stat-value');
            if (valueEl) {
                valueEl.textContent = stats.inactiveScripts;
            }
        }
    }

    /**
     * 스크립트 목록 렌더링 (페이징 적용)
     *
     * 대시보드 페이징 알고리즘:
     * 1. startIndex = (currentPage - 1) * itemsPerPage로 시작 인덱스 계산
     * 2. endIndex = Math.min(startIndex + itemsPerPage, totalScripts)로 끝 인덱스 계산
     * 3. scripts.slice(startIndex, endIndex)로 현재 페이지 스크립트 추출
     * 4. 추출된 스크립트만 그리드에 렌더링
     * 5. updateDashboardPagination()으로 페이지 네비게이션 상태 업데이트
     */
    renderScripts() {
        const scriptsGrid = document.getElementById('dashboard-scripts-grid');
        if (!scriptsGrid) {
            return;
        }

        scriptsGrid.innerHTML = '';

        if (this.scripts.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-message';
            emptyMessage.textContent = t('dashboard.noScripts');
            scriptsGrid.appendChild(emptyMessage);
            this.updateDashboardPagination();
            return;
        }

        // 현재 페이지의 스크립트 범위 계산
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = Math.min(startIndex + this.itemsPerPage, this.scripts.length);
        const scriptsToShow = this.scripts.slice(startIndex, endIndex);

        scriptsToShow.forEach((script) => {
            const scriptCard = this.createScriptCard(script);
            scriptsGrid.appendChild(scriptCard);
        });

        this.updateDashboardPagination();
    }

    /**
     * 스크립트 카드 생성
     */
    createScriptCard(script) {
        const card = document.createElement('div');
        card.className = 'script-card';
        card.setAttribute('data-script-id', script.id);

        // active 필드가 있으면 사용, 없으면 기본값 true
        const isActive = script.active !== undefined ? script.active : true;
        const status = isActive ? 'active' : 'inactive';
        const statusText = isActive ? t('dashboard.active') : t('dashboard.inactive');

        // 마지막 실행 시간 포맷팅 (last_executed_at 필드 사용)
        const lastRun = script.last_executed_at ? this.formatLastRun(script.last_executed_at) : null;

        card.innerHTML = `
            <div class="script-card-header">
                <div class="script-card-icon">📄</div>
                <div class="script-card-content">
                    <h3 class="script-card-title">${this.escapeHtml(script.name)}</h3>
                    <p class="script-card-description">${this.escapeHtml(script.description || '')}</p>
                    <div class="script-card-meta">
                        <button class="btn-toggle-active ${status}" data-script-id="${script.id}" data-active="${isActive}">
                            ${statusText}
                        </button>
                        ${lastRun ? `<span class="script-card-last-run">🕐 ${lastRun}</span>` : ''}
                    </div>
                </div>
            </div>
            <div class="script-card-footer">
                <div class="script-card-actions">
                    <button class="btn-edit" data-script-id="${script.id}">${t('dashboard.edit')}</button>
                    <button class="btn-run" data-script-id="${script.id}">
                        <span class="btn-run-icon">▶</span>
                        <span class="btn-run-text">${t('dashboard.run')}</span>
                    </button>
                </div>
            </div>
        `;

        // 편집 버튼 클릭 이벤트
        const editBtn = card.querySelector('.btn-edit');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                this.switchToEditor(script.id);
            });
        }

        // 실행 버튼 클릭 이벤트
        const runBtn = card.querySelector('.btn-run');
        if (runBtn) {
            runBtn.addEventListener('click', () => {
                this.runScript(script.id);
            });
        }

        // 활성/비활성 토글 버튼 클릭 이벤트
        const toggleBtn = card.querySelector('.btn-toggle-active');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', async () => {
                await this.toggleScriptActive(script.id, !isActive);
            });
        }

        return card;
    }

    /**
     * 스크립트 활성/비활성 상태 토글
     */
    async toggleScriptActive(scriptId, newActive) {
        const logger = getLogger();
        logger.log('[Dashboard] 스크립트 활성 상태 토글:', scriptId, newActive);

        try {
            if (ScriptAPI && typeof ScriptAPI.toggleScriptActive === 'function') {
                await ScriptAPI.toggleScriptActive(scriptId, newActive);

                // 로컬 스크립트 데이터 업데이트
                const script = this.scripts.find((s) => s.id === scriptId);
                if (script) {
                    script.active = newActive;
                }

                // 대시보드 다시 렌더링 (통계 초기화 없이)
                this.calculateStats();
                // 전체 실행 통계는 서버에서 다시 로드하여 유지
                await this.loadDashboardStats();
                this.renderDashboard();

                // 사이드바의 스크립트 목록도 업데이트하여 즉시 반영
                if (window.sidebarManager && window.sidebarManager.scriptManager) {
                    logger.log('[Dashboard] 사이드바 스크립트 목록 업데이트 중...');
                    await window.sidebarManager.scriptManager.loadScriptsFromServer();
                    logger.log('[Dashboard] 사이드바 스크립트 목록 업데이트 완료');
                } else {
                    logger.warn(
                        '[Dashboard] 사이드바 매니저를 찾을 수 없습니다. 스크립트 페이지로 이동 시 상태가 업데이트됩니다.'
                    );
                }
            } else {
                logger.warn('[Dashboard] ScriptAPI.toggleScriptActive를 사용할 수 없습니다.');
            }
        } catch (error) {
            logger.error('[Dashboard] 스크립트 활성 상태 토글 실패:', error);
            // 에러 메시지 표시 (선택사항)
        }
    }

    /**
     * 스크립트 페이지로 전환
     */
    switchToEditor(scriptId) {
        const logger = getLogger();

        // 현재 포커스된 스크립트 확인
        const sidebarManager = window.sidebarManager;
        const currentScript = sidebarManager ? sidebarManager.getCurrentScript() : null;
        const isCurrentScript = currentScript && currentScript.id === scriptId;

        // 페이지 라우터로 전환
        if (window.pageRouter) {
            window.pageRouter.showPage('editor');
        } else {
            // 폴백: 네비게이션 메뉴 클릭
            const editorNav = document.querySelector('.nav-item[data-page="editor"]');
            if (editorNav) {
                editorNav.click();
            }
        }

        // 스크립트 선택 (현재 포커스된 스크립트인 경우 강제 재로드)
        if (sidebarManager) {
            const scripts = sidebarManager.getAllScripts();
            const scriptIndex = scripts.findIndex((s) => s.id === scriptId);
            if (scriptIndex >= 0) {
                setTimeout(() => {
                    // 현재 포커스된 스크립트를 다시 클릭한 경우 강제로 다시 로드
                    const forceReload = isCurrentScript;
                    if (forceReload) {
                        logger.log(
                            '[Dashboard] 현재 포커스된 스크립트를 다시 클릭하여 강제로 다시 로드합니다:',
                            scriptId
                        );
                    }
                    sidebarManager.scriptManager.selectScript(scriptIndex, forceReload);
                }, 100);
            }
        }
    }

    /**
     * 스크립트 실행
     */
    async runScript(scriptId) {
        const logger = getLogger();
        logger.log('[Dashboard] 스크립트 실행:', scriptId);

        // 스크립트 페이지로 전환 후 실행
        this.switchToEditor(scriptId);

        // 잠시 후 실행 (에디터 로드 대기)
        setTimeout(async () => {
            // 단일 스크립트 실행은 executeSingleScript를 사용
            const sidebarManager = getSidebarManager();
            const workflowPage = window.workflowPage;
            const currentScript = workflowPage?.getCurrentScript();
            if (sidebarManager && sidebarManager.scriptManager && currentScript) {
                await sidebarManager.scriptManager.executeSingleScript(currentScript, { isRunningAllScripts: false });
            } else if (workflowPage && workflowPage.executionService) {
                // 폴백: 기존 방식 사용
                await workflowPage.executionService.execute();
            }
        }, 500);
    }

    /**
     * 마지막 실행 시간 포맷팅
     */
    formatLastRun(timestamp) {
        if (!timestamp) {
            return null;
        }

        const now = new Date();
        const lastRun = new Date(timestamp);
        const diffMs = now - lastRun;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) {
            return t('dashboard.justNow');
        } else if (diffMins < 60) {
            return t('dashboard.minutesAgo', { minutes: diffMins });
        } else if (diffHours < 24) {
            return t('dashboard.hoursAgo', { hours: diffHours });
        } else if (diffDays < 7) {
            return t('dashboard.daysAgo', { days: diffDays });
        } else {
            const lang = document.documentElement.lang || 'en';
            const locale = lang === 'en' ? 'en-US' : 'ko-KR';
            return lastRun.toLocaleDateString(locale);
        }
    }

    /**
     * HTML 이스케이프
     */
    escapeHtml(text) {
        if (!text) {
            return '';
        }
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 스크립트 실행 기록 저장
     * @param {number} scriptId - 스크립트 ID
     * @param {Object} executionData - 실행 데이터 {status: string, error_message?: string, execution_time_ms?: number}
     * @returns {Promise<Object>} 저장 결과
     */
    async recordScriptExecution(scriptId, executionData) {
        const logger = getLogger();
        logger.log('[Dashboard] recordScriptExecution() 호출됨');
        logger.log('[Dashboard] 스크립트 ID:', scriptId);
        logger.log('[Dashboard] 실행 데이터:', executionData);

        try {
            const result = await apiCall(`/api/scripts/${scriptId}/execution-record`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(executionData)
            });

            logger.log('[Dashboard] ✅ 스크립트 실행 기록 저장 완료:', result);

            // 실행 기록 저장 후 대시보드 통계 즉시 업데이트
            await this.loadDashboardStats();
            this.updateStats();

            return result;
        } catch (error) {
            logger.error('[Dashboard] ❌ 스크립트 실행 기록 저장 실패:', error);
            throw error;
        }
    }

    /**
     * 전체 실행 요약 정보 저장
     * @param {Object} summary - 실행 요약 정보 {total_executions: number, failed_count: number}
     * @returns {Promise<Object>} 저장 결과
     */
    async recordExecutionSummary(summary) {
        const logger = getLogger();
        logger.log('[Dashboard] recordExecutionSummary() 호출됨');
        logger.log('[Dashboard] 실행 요약 정보:', summary);

        try {
            const result = await apiCall('/api/dashboard/execution-summary', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(summary)
            });

            logger.log('[Dashboard] ✅ 전체 실행 요약 정보 저장 완료:', result);

            // 실행 요약 저장 후 대시보드 통계 즉시 업데이트
            await this.loadDashboardStats();
            this.updateStats();

            return result;
        } catch (error) {
            logger.error('[Dashboard] ❌ 전체 실행 요약 정보 저장 실패:', error);
            throw error;
        }
    }

    /**
     * 전체 실행 횟수 증가 (각 스크립트 실행 후 호출)
     * @param {boolean} success - 성공 여부
     * @returns {Promise<Object>} 업데이트 결과
     */
    async incrementExecutionCount(success = true) {
        const logger = getLogger();
        logger.log('[Dashboard] incrementExecutionCount() 호출됨');
        logger.log('[Dashboard] 성공 여부:', success);

        try {
            const result = await apiCall('/api/dashboard/increment-execution', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ success })
            });

            logger.log('[Dashboard] ✅ 전체 실행 횟수 증가 완료:', result);

            // 통계 즉시 업데이트
            if (result.data) {
                this.executionStats.allExecutions = result.data.all_executions || 0;
                this.executionStats.allFailed = result.data.all_failed_scripts || 0;
                this.updateStats();
            } else {
                // 폴백: 서버에서 다시 로드
                await this.loadDashboardStats();
                this.updateStats();
            }

            return result;
        } catch (error) {
            logger.error('[Dashboard] ❌ 전체 실행 횟수 증가 실패:', error);
            throw error;
        }
    }

    /**
     * 전체 실행 통계 초기화 (전체 실행 시작 시 호출)
     * @returns {Promise<Object>} 초기화 결과
     */
    async resetExecutionStats() {
        const logger = getLogger();
        logger.log('[Dashboard] resetExecutionStats() 호출됨');

        try {
            const result = await apiCall('/api/dashboard/reset-execution-stats', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            logger.log('[Dashboard] ✅ 전체 실행 통계 초기화 완료:', result);

            // 통계 즉시 업데이트
            this.executionStats.allExecutions = 0;
            this.executionStats.allFailed = 0;
            this.updateStats();

            return result;
        } catch (error) {
            logger.error('[Dashboard] ❌ 전체 실행 통계 초기화 실패:', error);
            throw error;
        }
    }
    /**
     * 대시보드 페이지 네비게이션 업데이트
     *
     * 원리:
     * 1. 전체 스크립트 개수를 itemsPerPage(12개)로 나누어 총 페이지 수 계산
     * 2. 현재 페이지 정보를 "현재페이지 / 전체페이지" 형식으로 표시
     * 3. 이전 버튼: currentPage > 1일 때만 활성화
     * 4. 다음 버튼: currentPage < totalPages일 때만 활성화
     */
    updateDashboardPagination() {
        const totalPages = Math.ceil(this.scripts.length / this.itemsPerPage);
        const paginationInfo = document.getElementById('dashboard-pagination-info');
        const prevBtn = document.getElementById('dashboard-prev-page-btn');
        const nextBtn = document.getElementById('dashboard-next-page-btn');

        if (paginationInfo) {
            paginationInfo.textContent = `${this.currentPage} / ${totalPages || 1}`;
        }

        if (prevBtn) {
            prevBtn.disabled = this.currentPage <= 1;
        }

        if (nextBtn) {
            nextBtn.disabled = this.currentPage >= totalPages;
        }
    }

    /**
     * 대시보드 다음 페이지로 이동
     *
     * 원리:
     * 1. 총 페이지 수 계산
     * 2. 현재 페이지가 총 페이지 수보다 작으면 currentPage 증가
     * 3. renderScripts()로 새 페이지 렌더링
     */
    nextDashboardPage() {
        const totalPages = Math.ceil(this.scripts.length / this.itemsPerPage);
        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.renderScripts();
        }
    }

    /**
     * 대시보드 이전 페이지로 이동
     *
     * 원리:
     * 1. 현재 페이지가 1보다 크면 currentPage 감소
     * 2. renderScripts()로 새 페이지 렌더링
     */
    prevDashboardPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.renderScripts();
        }
    }

    /**
     * 대시보드 페이지 네비게이션 이벤트 핸들러 설정
     *
     * 원리:
     * 1. 이전/다음 버튼 DOM 요소 찾기
     * 2. 각 버튼에 클릭 이벤트 리스너 등록
     * 3. 클릭 시 nextDashboardPage() 또는 prevDashboardPage() 호출
     */
    setupDashboardPaginationEvents() {
        const prevBtn = document.getElementById('dashboard-prev-page-btn');
        const nextBtn = document.getElementById('dashboard-next-page-btn');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.prevDashboardPage());
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.nextDashboardPage());
        }
    }
}

/**
 * DashboardManager 인스턴스 가져오기
 */
let dashboardManagerInstance = null;

export function getDashboardManagerInstance() {
    if (!dashboardManagerInstance) {
        dashboardManagerInstance = new DashboardManager();
    }
    return dashboardManagerInstance;
}
