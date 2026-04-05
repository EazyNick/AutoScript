/**
 * SidebarManager UI 관련 기능
 * UI 렌더링 및 업데이트를 담당
 */

import { getLogger } from './sidebar-utils.js';
import { UserSettingsAPI } from '../../api/user-settings-api.js';

/**
 * UI 관리 클래스
 */
export class SidebarUIManager {
    constructor(sidebarManager) {
        this.sidebarManager = sidebarManager;
        this.currentPage = 1; // 현재 표시 중인 페이지 번호 (1부터 시작)
        this.itemsPerPage = 10; // 한 페이지에 표시할 스크립트 개수
        this.minSidebarItemHeight = 70; // 최소 항목 높이 추정값
        this.sidebarResizeDebounce = null;
        this.sidebarResizeObserver = null;
        this.isRendering = false; // 렌더링 중 플래그

        if (typeof window !== 'undefined') {
            window.addEventListener('resize', () => this.handleResize());
            if (window.visualViewport) {
                window.visualViewport.addEventListener('resize', () => this.handleResize());
            }

            if (typeof ResizeObserver !== 'undefined') {
                this.sidebarResizeObserver = new ResizeObserver(() => this.handleResize());
            }
        }
    }

    /**
     * 스크립트 목록 렌더링 (페이징 적용)
     *
     * 원리:
     * 1. 스크립트 목록을 itemsPerPage(10개)씩 나누어 페이지별 표시
     * 2. currentPage를 1로 초기화하여 첫 페이지부터 시작
     * 3. renderScriptsPage()로 실제 렌더링 수행
     * 4. updatePagination()으로 페이지 네비게이션 상태 업데이트
     */
    loadScripts() {
        this.currentPage = 1; // 스크립트 로드 시 첫 페이지로 초기화
        this.updateItemsPerPage();
        this.renderScriptsPage();
        this.updatePagination();

        // ResizeObserver를 sidebar-scripts-section에 연결 (더 안정적)
        const scriptsSection = document.querySelector('.sidebar-scripts-section');
        if (scriptsSection && this.sidebarResizeObserver) {
            this.sidebarResizeObserver.observe(scriptsSection);
        }
    }

    /**
     * 화면 크기 또는 브라우저 확대/축소 시 페이지당 항목 개수 재계산
     */
    handleResize() {
        // 렌더링 중에는 리사이즈 이벤트를 무시
        if (this.isRendering) {
            return;
        }

        if (this.sidebarResizeDebounce) {
            clearTimeout(this.sidebarResizeDebounce);
        }
        this.sidebarResizeDebounce = window.setTimeout(() => {
            window.requestAnimationFrame(() => {
                const previousItemsPerPage = this.itemsPerPage;
                this.updateItemsPerPage();
                if (this.itemsPerPage !== previousItemsPerPage) {
                    this.currentPage = 1;
                    this.renderScriptsPage();
                    this.updatePagination();
                }
            });
        }, 100);
    }

    /**
     * 사이드바에 표시할 항목 개수를 현재 스크롤 영역 높이에 맞춰 계산
     */
    updateItemsPerPage() {
        const section = document.querySelector('.sidebar-scripts-section');
        const scriptList = document.querySelector('.script-list');
        const header = section ? section.querySelector('.sidebar-header') : null;
        const pagination = document.getElementById('script-pagination');

        if (!section || !scriptList) {
            return;
        }

        const sectionRect = section.getBoundingClientRect();
        const headerRect = header ? header.getBoundingClientRect() : { bottom: sectionRect.top };
        const paginationRect = pagination ? pagination.getBoundingClientRect() : { top: sectionRect.bottom };

        const scriptListStyles = window.getComputedStyle(scriptList);
        const listPaddingTop = parseFloat(scriptListStyles.paddingTop) || 0;
        const listPaddingBottom = parseFloat(scriptListStyles.paddingBottom) || 0;

        // 실제로 스크립트 항목이 보이는 영역은 헤더 바로 아래부터
        // 페이지 네비게이션 바로 위까지의 공간입니다.
        const availableHeight = Math.max(
            0,
            paginationRect.top - headerRect.bottom - listPaddingTop - listPaddingBottom
        );

        if (availableHeight <= 0) {
            return;
        }

        let itemHeight = this.minSidebarItemHeight;
        const firstRenderedItem = scriptList.querySelector('.script-item');
        if (firstRenderedItem) {
            itemHeight = firstRenderedItem.getBoundingClientRect().height;
        } else {
            const width = scriptList.getBoundingClientRect().width;
            if (width > 0) {
                itemHeight = this.measureSidebarItemHeight(scriptList, width);
            }
        }

        const estimatedHeight = itemHeight > 0 ? itemHeight : this.minSidebarItemHeight;
        // CSS 스타일링, 브라우저 렌더링, 서브픽셀 계산 등의 오차를 보정하기 위해
        // 191px(약 2.7개 아이템 높이)만큼 추가하여 공간을 확보합니다.
        // 이 값은 실제 테스트를 통해 스크립트가 꽉 차게 표시되도록 조정된 경험적 보정값입니다.
        this.itemsPerPage = Math.max(1, Math.floor((availableHeight + 191) / estimatedHeight));
    }

    /**
     * 사이드바 항목 높이를 실제 스타일로 측정
     */
    measureSidebarItemHeight(container, width) {
        const dummy = document.createElement('div');
        dummy.className = 'script-item';
        dummy.style.position = 'absolute';
        dummy.style.visibility = 'hidden';
        dummy.style.pointerEvents = 'none';
        dummy.style.left = '-9999px';
        dummy.style.top = '0';
        dummy.style.width = `${width}px`;
        dummy.style.boxSizing = 'border-box';
        dummy.innerHTML = `
            <div class="script-drag-handle">⋮⋮</div>
            <div class="script-icon">📄</div>
            <div class="script-info">
                <div class="script-name">테스트 제목</div>
                <div class="script-desc">설명 테스트</div>
                <div class="script-date">
                    <span class="date-icon">🕐</span>
                    <span class="date-text">2026-01-01</span>
                </div>
            </div>
            <button class="script-delete-btn" title="스크립트 삭제">
                <span class="delete-icon">🗑️</span>
            </button>
        `;
        container.appendChild(dummy);
        const height = dummy.getBoundingClientRect().height;
        container.removeChild(dummy);
        return height;
    }

    /**
     * 현재 페이지의 스크립트 목록 렌더링
     *
     * 페이징 알고리즘:
     * 1. startIndex = (currentPage - 1) * itemsPerPage로 시작 인덱스 계산
     * 2. endIndex = Math.min(startIndex + itemsPerPage, totalScripts)로 끝 인덱스 계산
     * 3. scripts.slice(startIndex, endIndex)로 현재 페이지 스크립트 추출
     * 4. 추출된 스크립트만 DOM에 렌더링
     * 5. 각 스크립트의 globalIndex를 계산하여 이벤트 핸들러에 전달
     */
    renderScriptsPage() {
        this.isRendering = true; // 렌더링 시작 플래그 설정
        const logger = getLogger();
        const log = logger.log;
        const logError = logger.error;

        log('[Sidebar] renderScriptsPage() 호출됨');
        log(
            `[Sidebar] 렌더링할 스크립트 개수: ${this.sidebarManager.scripts.length}개, 현재 페이지: ${this.currentPage}`
        );

        const scriptList = document.querySelector('.script-list');
        if (!scriptList) {
            logError('[Sidebar] ❌ .script-list 요소를 찾을 수 없습니다!');
            logError('[Sidebar] DOM 상태 확인 필요');
            return;
        }

        log('[Sidebar] ✅ .script-list 요소 찾음');
        scriptList.innerHTML = '';

        if (this.sidebarManager.scripts.length === 0) {
            // 스크립트가 없을 때 메시지 표시
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'script-empty-message';
            emptyMessage.style.cssText = 'padding: 20px; text-align: center; color: #a0aec0; font-size: 14px;';
            emptyMessage.textContent = '스크립트가 없습니다. + 버튼을 눌러 새 스크립트를 추가하세요.';
            scriptList.appendChild(emptyMessage);
            log('[Sidebar] 빈 스크립트 목록 메시지 표시');
            this.isRendering = false;
            return;
        }

        // 현재 페이지의 스크립트 범위 계산
        const totalPages = Math.max(1, Math.ceil(this.sidebarManager.scripts.length / this.itemsPerPage));
        if (this.currentPage > totalPages) {
            this.currentPage = totalPages;
        }

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = Math.min(startIndex + this.itemsPerPage, this.sidebarManager.scripts.length);
        const scriptsToShow = this.sidebarManager.scripts.slice(startIndex, endIndex);

        log(`[Sidebar] 페이지 ${this.currentPage}: ${startIndex} ~ ${endIndex - 1} 범위 렌더링`);

        scriptsToShow.forEach((script, index) => {
            const globalIndex = startIndex + index;
            log(`[Sidebar] 스크립트 ${globalIndex + 1} 렌더링 중: ${script.name}`);

            const scriptItem = document.createElement('div');
            // DB의 active 필드를 기준으로 비활성화 클래스 추가
            const isDbActive = script.dbActive !== undefined ? script.dbActive : true;
            const isDbActiveValue = isDbActive === true || isDbActive === 1;
            scriptItem.className = `script-item ${script.active ? 'active' : ''} ${!isDbActiveValue ? 'inactive' : ''}`;
            scriptItem.draggable = true;
            scriptItem.dataset.scriptIndex = globalIndex;

            scriptItem.innerHTML = `
                <div class="script-drag-handle">⋮⋮</div>
                <div class="script-icon">📄</div>
                <div class="script-info">
                    <div class="script-name">${script.name}</div>
                    <div class="script-desc">${script.description}</div>
                    <div class="script-date">
                        <span class="date-icon">🕐</span>
                        <span class="date-text">${script.date}</span>
                    </div>
                </div>
                <button class="script-delete-btn" title="스크립트 삭제" data-script-index="${globalIndex}">
                    <span class="delete-icon">🗑️</span>
                </button>
            `;

            // 드래그 앤 드롭 이벤트 핸들러
            this.sidebarManager.eventHandler.setupDragAndDrop(scriptItem, globalIndex);

            // 스크립트 항목 클릭 이벤트 (삭제 버튼 제외)
            scriptItem.addEventListener('click', (e) => {
                // 삭제 버튼이나 드래그 핸들 클릭 시에는 선택 이벤트 발생하지 않도록
                if (e.target.closest('.script-delete-btn') || e.target.closest('.script-drag-handle')) {
                    return;
                }
                log('사이드바 스크립트 클릭됨:', script.name, '인덱스:', globalIndex);
                this.sidebarManager.selectScript(globalIndex);
            });

            // 삭제 버튼 클릭 이벤트
            const deleteBtn = scriptItem.querySelector('.script-delete-btn');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // 스크립트 선택 이벤트 방지
                log('[Sidebar] 삭제 버튼 클릭됨 - 스크립트:', script.name, '인덱스:', globalIndex);
                this.sidebarManager.deleteScript(globalIndex);
            });

            scriptList.appendChild(scriptItem);
        });

        log(`[Sidebar] ✅ 스크립트 목록 렌더링 완료: ${scriptsToShow.length}개 항목 (페이지 ${this.currentPage})`);

        this.isRendering = false; // 렌더링 완료 플래그 해제
    }

    /**
     * 헤더 업데이트
     */
    updateHeader() {
        // 에디터 페이지일 때만 헤더 업데이트
        if (window.pageRouter && window.pageRouter.currentPage === 'editor') {
            const selectedScript = this.sidebarManager.scripts[this.sidebarManager.currentScriptIndex];
            if (selectedScript) {
                const titleEl = document.querySelector('.script-title');
                const descEl = document.querySelector('.script-description');
                if (titleEl) {
                    titleEl.textContent = selectedScript.name || '스크립트';
                }
                if (descEl) {
                    descEl.textContent = selectedScript.description || '워크플로우를 편집하세요';
                }
            }
        }
    }

    /**
     * 사이드바 너비 변경 시 관련 요소들도 함께 조정
     */
    adjustLayoutForSidebarWidth(width, isResizing = false) {
        // 좌측 최상단 프로필 영역 너비 조정
        const topProfile = document.querySelector('.top-left-profile');
        if (topProfile) {
            // 리사이즈 중일 때는 transition 비활성화 및 클래스 추가
            if (isResizing) {
                topProfile.classList.add('resizing');
                topProfile.style.transition = 'none';
            } else {
                topProfile.classList.remove('resizing');
                topProfile.style.transition = '';
            }
            topProfile.style.width = `${width}px`;
        }

        // 헤더의 left 값 조정
        const header = document.querySelector('.top-header');
        if (header) {
            if (isResizing) {
                header.style.transition = 'none';
            } else {
                header.style.transition = '';
            }
            header.style.left = `${width}px`;
        }

        // 메인 컨텐츠의 left와 width 조정
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            if (isResizing) {
                mainContent.style.transition = 'none';
            } else {
                mainContent.style.transition = '';
            }
            mainContent.style.left = `${width}px`;
            mainContent.style.width = `calc(100vw - ${width}px)`;
        }

        // CSS 변수로 사이드바 너비 설정 (토스트/모달 위치 계산용)
        document.documentElement.style.setProperty('--sidebar-width', `${width}px`);

        // 토스트 위치 업데이트
        if (window.toastManager && typeof window.toastManager.updatePosition === 'function') {
            window.toastManager.updatePosition();
        }
    }

    /**
     * 사이드바 너비를 서버에 저장
     */
    async saveSidebarWidth(width) {
        const logger = getLogger();
        const log = logger.log;
        const logError = logger.error;

        try {
            // 서버에 저장 시도
            if (UserSettingsAPI) {
                await UserSettingsAPI.saveSetting('sidebar-width', width.toString());
                log(`[Sidebar] 사이드바 너비 서버에 저장됨: ${width}px`);
            } else {
                // 폴백: 로컬 스토리지에 저장
                localStorage.setItem('sidebar-width', width.toString());
                log(`[Sidebar] 사이드바 너비 로컬 스토리지에 저장됨: ${width}px`);
            }
        } catch (error) {
            logError('[Sidebar] 서버 저장 실패, 로컬 스토리지에 저장:', error);
            // 서버 저장 실패 시 로컬 스토리지에 저장 (폴백)
            localStorage.setItem('sidebar-width', width.toString());
        }
    }

    /**
     * 서버에서 사이드바 너비 로드
     */
    async loadSidebarWidth() {
        const logger = getLogger();
        const log = logger.log;
        const logError = logger.error;

        try {
            let savedWidth = null;

            // 서버에서 로드 시도
            if (UserSettingsAPI) {
                try {
                    savedWidth = await UserSettingsAPI.getSetting('sidebar-width');
                    if (savedWidth) {
                        log(`[Sidebar] 사이드바 너비 서버에서 로드됨: ${savedWidth}px`);
                    }
                } catch (error) {
                    log('[Sidebar] 서버에서 설정을 찾을 수 없음, 로컬 스토리지 확인');
                }
            }

            // 서버에 없으면 로컬 스토리지에서 로드
            if (!savedWidth) {
                savedWidth = localStorage.getItem('sidebar-width');
                if (savedWidth) {
                    log(`[Sidebar] 사이드바 너비 로컬 스토리지에서 로드됨: ${savedWidth}px`);
                }
            }

            if (savedWidth) {
                const width = parseInt(savedWidth);
                if (width && width >= 250 && width <= 600) {
                    const sidebar = document.querySelector('.sidebar');
                    if (sidebar) {
                        sidebar.style.width = `${width}px`;
                        log(`[Sidebar] 사이드바 너비 적용됨: ${width}px`);
                        // 관련 요소들도 함께 조정
                        this.adjustLayoutForSidebarWidth(width);
                    }
                }
            }
        } catch (error) {
            logError('[Sidebar] 사이드바 너비 로드 실패:', error);
        }
    }

    /**
     * 페이지 네비게이션 업데이트
     *
     * 원리:
     * 1. 전체 스크립트 개수를 itemsPerPage로 나누어 총 페이지 수 계산
     * 2. 현재 페이지 정보를 "현재페이지 / 전체페이지" 형식으로 표시
     * 3. 이전 버튼: currentPage > 1일 때만 활성화
     * 4. 다음 버튼: currentPage < totalPages일 때만 활성화
     */
    updatePagination() {
        const totalPages = Math.ceil(this.sidebarManager.scripts.length / this.itemsPerPage);
        const paginationInfo = document.getElementById('pagination-info');
        const prevBtn = document.getElementById('prev-page-btn');
        const nextBtn = document.getElementById('next-page-btn');

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
     * 다음 페이지로 이동
     *
     * 원리:
     * 1. 총 페이지 수 계산
     * 2. 현재 페이지가 총 페이지 수보다 작으면 currentPage 증가
     * 3. renderScriptsPage()로 새 페이지 렌더링
     * 4. updatePagination()으로 버튼 상태 업데이트
     */
    nextPage() {
        const totalPages = Math.ceil(this.sidebarManager.scripts.length / this.itemsPerPage);
        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.renderScriptsPage();
            this.updatePagination();
        }
    }

    /**
     * 이전 페이지로 이동
     *
     * 원리:
     * 1. 현재 페이지가 1보다 크면 currentPage 감소
     * 2. renderScriptsPage()로 새 페이지 렌더링
     * 3. updatePagination()으로 버튼 상태 업데이트
     */
    prevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.renderScriptsPage();
            this.updatePagination();
        }
    }

    /**
     * 페이지 네비게이션 이벤트 핸들러 설정
     *
     * 원리:
     * 1. 이전/다음 버튼 DOM 요소 찾기
     * 2. 각 버튼에 클릭 이벤트 리스너 등록
     * 3. 클릭 시 nextPage() 또는 prevPage() 호출
     */
    setupPaginationEvents() {
        const prevBtn = document.getElementById('prev-page-btn');
        const nextBtn = document.getElementById('next-page-btn');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.prevPage());
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.nextPage());
        }
    }
}
