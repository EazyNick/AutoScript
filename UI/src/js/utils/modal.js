/**
 * 모달 유틸리티 클래스
 * 모달 창 (Modal)
 * 우측에서 슬라이드 인으로 표시되는 팝업
 * 배경이 어둡게 처리되어 뒤 콘텐츠가 비활성화됨
 * 사용자가 확인 버튼을 눌러야 닫힘
 * ES6 모듈 방식으로 작성됨
 */

// 번역 함수 동적 import (비동기)
let t = null;
async function getTranslationFunction() {
    if (!t) {
        const i18n = await import('./i18n.js');
        t = i18n.t;
    }
    return t;
}

/**
 * ModalManager 클래스
 * 모달 창을 관리하는 유틸리티 클래스입니다.
 */
export class ModalManager {
    constructor() {
        this.modal = document.getElementById('modal');
        this.modalContent = document.querySelector('.modal-content');
        this.modalBody = document.getElementById('modal-body');
        this.closeBtn = document.querySelector('.close');

        // 드래그 관련 변수
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.modalStartX = 0;
        this.modalStartY = 0;

        // 모달 내부에서 시작된 클릭 추적
        this.mouseDownInsideModal = false;

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupDragHandlers();
    }

    setupEventListeners() {
        // 모달 닫기 버튼
        this.closeBtn.addEventListener('click', () => {
            this.close();
        });

        // ESC 키로 모달 닫기
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen()) {
                this.close();
            }
        });

        // 모달 배경 클릭으로 닫기 (드래그 중이 아니고, 모달 내부에서 시작된 클릭이 아닐 때만)
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal && !this.isDragging && !this.mouseDownInsideModal) {
                this.close();
            }
            // 클릭 이벤트 처리 후 플래그 리셋
            this.mouseDownInsideModal = false;
        });

        // 모달 내부에서 mousedown 추적
        if (this.modalContent) {
            this.modalContent.addEventListener('mousedown', (e) => {
                // 모달 콘텐츠 내부에서 mousedown이 시작되었음을 표시
                this.mouseDownInsideModal = true;
            });
        }

        // 전역 mouseup 이벤트로 모달 밖에서 mouseup 시 플래그 리셋
        document.addEventListener('mouseup', () => {
            // 짧은 지연 후 플래그 리셋 (클릭 이벤트가 먼저 처리되도록)
            setTimeout(() => {
                this.mouseDownInsideModal = false;
            }, 0);
        });
    }

    setupDragHandlers() {
        // 모달 헤더 영역 생성 (드래그 핸들)
        if (!this.modalContent) {
            return;
        }

        // 헤더가 이미 있으면 제거하지 않음
        let modalHeader = this.modalContent.querySelector('.modal-header');
        if (!modalHeader) {
            modalHeader = document.createElement('div');
            modalHeader.className = 'modal-header';
            modalHeader.innerHTML = '<div class="modal-drag-handle"></div>';
            this.modalContent.insertBefore(modalHeader, this.modalBody);
        }

        const dragHandle = modalHeader.querySelector('.modal-drag-handle') || modalHeader;

        // 드래그 시작
        dragHandle.addEventListener('mousedown', (e) => {
            if (e.target === this.closeBtn || e.target.closest('.close')) {
                return; // 닫기 버튼 클릭은 무시
            }
            this.startDrag(e);
        });

        // 드래그 중
        document.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                this.onDrag(e);
            }
        });

        // 드래그 종료
        document.addEventListener('mouseup', (e) => {
            if (this.isDragging) {
                // 드래그 종료 직후 발생할 수 있는 클릭 이벤트를 방지하기 위해
                // mouseup 이벤트를 stopPropagation하여 배경 클릭 이벤트가 발생하지 않도록 함
                e.stopPropagation();
                this.endDrag();
            }
        });
    }

    startDrag(e) {
        this.isDragging = true;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;

        // 현재 모달 위치 가져오기 (right 기준으로 계산)
        const rect = this.modalContent.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        // right 기준으로 저장 (우측에서의 거리)
        this.modalStartX = windowWidth - rect.right;
        this.modalStartY = rect.top;

        // 드래그 중 커서 변경
        this.modalContent.style.cursor = 'grabbing';
        this.modalContent.style.userSelect = 'none';

        e.preventDefault();
    }

    onDrag(e) {
        if (!this.isDragging) {
            return;
        }

        // 이동 거리 계산
        const deltaX = e.clientX - this.dragStartX;
        const deltaY = e.clientY - this.dragStartY;

        // 새 위치 계산 (right 기준)
        const windowWidth = window.innerWidth;
        let newRight = this.modalStartX - deltaX; // right는 반대 방향
        let newY = this.modalStartY + deltaY;

        // 화면 경계 체크
        const sidebarWidth =
            parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width')) || 350;
        const modalWidth = this.modalContent.offsetWidth;
        const modalHeight = this.modalContent.offsetHeight;
        const windowHeight = window.innerHeight;

        // 좌우 경계 제한 (우측 정렬 기준)
        const remInPixels = 16; // 1rem = 16px
        const margin = remInPixels * 1; // 1rem 여백
        const minRight = 0; // 우측에 붙임
        const maxRight = windowWidth - sidebarWidth - modalWidth - margin; // 사이드바를 제외한 최대 right 값
        newRight = Math.max(minRight, Math.min(maxRight, newRight));

        // 상하 경계 제한
        const minY = 0;
        const maxY = windowHeight - modalHeight;
        newY = Math.max(minY, Math.min(maxY, newY));

        // 모달 위치 업데이트 (right 기준)
        this.modalContent.style.right = `${newRight}px`;
        this.modalContent.style.top = `${newY}px`;
        this.modalContent.style.left = 'auto'; // left 해제
        this.modalContent.style.transform = 'none'; // transform 제거
    }

    endDrag() {
        this.isDragging = false;
        this.modalContent.style.cursor = '';
        this.modalContent.style.userSelect = '';
    }

    show(content) {
        this.modalBody.innerHTML = content;
        this.modal.style.display = 'block';
        this.modal.classList.add('show');

        // 사이드바 너비를 CSS 변수로 설정 (드래그 경계 계산용)
        this.updateModalPosition();

        // 모달 위치 초기화 (드래그 후 다시 열 때 우측 상단으로)
        this.resetModalPosition();

        // 드래그 핸들 다시 설정 (동적으로 생성된 모달의 경우)
        this.setupDragHandlers();

        // 포커스 관리
        const firstInput = this.modalBody.querySelector('input, select, textarea');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 100);
        }
    }

    /**
     * 모달 위치를 우측 상단으로 초기화
     */
    resetModalPosition() {
        if (!this.modalContent) {
            return;
        }

        this.modalContent.style.right = '0';
        this.modalContent.style.top = '0';
        this.modalContent.style.bottom = 'auto';
        this.modalContent.style.left = 'auto';
        this.modalContent.style.transform = 'none';
    }

    /**
     * 사이드바 너비를 CSS 변수로 설정 (드래그 경계 계산용)
     */
    updateModalPosition() {
        const sidebar = document.querySelector('.sidebar');
        const sidebarWidth = sidebar ? sidebar.offsetWidth : 350; // 기본값 350px

        // CSS 변수로 사이드바 너비 설정
        document.documentElement.style.setProperty('--sidebar-width', `${sidebarWidth}px`);
    }

    close() {
        this.modal.classList.remove('show');
        this.modal.classList.add('hide');

        setTimeout(() => {
            this.modal.style.display = 'none';
            this.modal.classList.remove('hide');
        }, 300);
    }

    isOpen() {
        return this.modal.style.display === 'block';
    }

    // 일반적인 모달 템플릿들
    showConfirm(title, message, onConfirm, onCancel = null) {
        const content = `
            <h3>${title}</h3>
            <p>${message}</p>
            <div class="form-actions">
                <button id="confirm-btn" class="btn btn-primary">확인</button>
                <button id="cancel-btn" class="btn btn-secondary">취소</button>
            </div>
        `;

        this.show(content);

        document.getElementById('confirm-btn').addEventListener('click', () => {
            onConfirm();
            this.close();
        });

        document.getElementById('cancel-btn').addEventListener('click', () => {
            if (onCancel) {
                onCancel();
            }
            this.close();
        });
    }

    showAlert(title, message, onOk = null) {
        // 줄바꿈 문자(\n)를 <br> 태그로 변환
        const formattedMessage = message.replace(/\n/g, '<br>');
        const content = `
            <h3>${title}</h3>
            <p>${formattedMessage}</p>
            <div class="form-actions">
                <button id="ok-btn" class="btn btn-primary">확인</button>
            </div>
        `;

        this.show(content);

        document.getElementById('ok-btn').addEventListener('click', () => {
            if (onOk) {
                onOk();
            }
            this.close();
        });
    }

    showInput(title, label, placeholder = '', defaultValue = '') {
        return new Promise((resolve, reject) => {
            const content = `
                <h3>${title}</h3>
                <div class="form-group">
                    <label for="input-field">${label}:</label>
                    <input type="text" id="input-field" placeholder="${placeholder}" value="${defaultValue}">
                </div>
                <div class="form-actions">
                    <button id="submit-btn" class="btn btn-primary">확인</button>
                    <button id="cancel-btn" class="btn btn-secondary">취소</button>
                </div>
            `;

            this.show(content);

            document.getElementById('submit-btn').addEventListener('click', () => {
                const value = document.getElementById('input-field').value;
                resolve(value);
                this.close();
            });

            document.getElementById('cancel-btn').addEventListener('click', () => {
                reject(new Error('사용자가 취소했습니다.'));
                this.close();
            });
        });
    }

    /**
     * 중앙 확인 모달 표시 (가운데 팝업)
     * @param {string} title - 모달 제목
     * @param {string} message - 모달 메시지
     * @param {Function} onConfirm - 확인 버튼 클릭 시 실행할 함수
     * @param {Function} onCancel - 취소 버튼 클릭 시 실행할 함수 (선택적)
     */
    showCenterConfirm(title, message, onConfirm, onCancel = null) {
        const resultModal = document.getElementById('result-modal');
        const resultModalContent = resultModal.querySelector('.result-modal-content');

        // HTML 이스케이프 함수
        const escapeHtml = (text) => {
            if (text === null || text === undefined) {
                return '';
            }
            const div = document.createElement('div');
            div.textContent = String(text);
            return div.innerHTML;
        };

        const content = `
            <div class="result-modal-header">
                <h3 class="result-modal-title">${escapeHtml(title)}</h3>
                <span class="result-modal-close">&times;</span>
            </div>
            <div class="result-modal-body">
                <p>${escapeHtml(message)}</p>
            </div>
            <div class="result-modal-footer">
                <button id="center-confirm-btn" class="btn btn-primary">확인</button>
                <button id="center-cancel-btn" class="btn btn-secondary">취소</button>
            </div>
        `;

        resultModalContent.innerHTML = content;

        // 사이드바 너비를 CSS 변수로 설정 (중앙 정렬 계산용)
        const sidebar = document.querySelector('.sidebar');
        const sidebarWidth = sidebar ? sidebar.offsetWidth : 350;
        document.documentElement.style.setProperty('--sidebar-width', `${sidebarWidth}px`);

        // 모달 표시
        resultModal.style.display = 'block';
        setTimeout(() => {
            resultModal.classList.add('show');
        }, 10);

        // 닫기 함수
        const closeModal = () => {
            resultModal.classList.remove('show');
            resultModal.classList.add('hide');
            setTimeout(() => {
                resultModal.style.display = 'none';
                resultModal.classList.remove('hide');
            }, 200);
        };

        // 이벤트 리스너
        const confirmBtn = document.getElementById('center-confirm-btn');
        const cancelBtn = document.getElementById('center-cancel-btn');
        const closeBtn = resultModalContent.querySelector('.result-modal-close');

        confirmBtn.addEventListener('click', () => {
            closeModal();
            if (onConfirm) {
                onConfirm();
            }
        });

        cancelBtn.addEventListener('click', () => {
            closeModal();
            if (onCancel) {
                onCancel();
            }
        });

        closeBtn.addEventListener('click', closeModal);

        // 배경 클릭으로 닫기
        const bgClickHandler = (e) => {
            if (e.target === resultModal) {
                closeModal();
                if (onCancel) {
                    onCancel();
                }
                resultModal.removeEventListener('click', bgClickHandler);
            }
        };
        resultModal.addEventListener('click', bgClickHandler);

        // ESC 키로 닫기
        const escHandler = (e) => {
            if (e.key === 'Escape' && resultModal.classList.contains('show')) {
                closeModal();
                if (onCancel) {
                    onCancel();
                }
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }

    /**
     * 중앙 알림 모달 표시 (가운데 팝업)
     * @param {string} title - 모달 제목
     * @param {string} message - 모달 메시지
     * @param {Function} onOk - 확인 버튼 클릭 시 실행할 함수 (선택적)
     */
    async showCenterAlert(title, message, onOk = null) {
        const t = await getTranslationFunction();
        const resultModal = document.getElementById('result-modal');
        const resultModalContent = resultModal.querySelector('.result-modal-content');

        // HTML 이스케이프 함수
        const escapeHtml = (text) => {
            if (text === null || text === undefined) {
                return '';
            }
            const div = document.createElement('div');
            div.textContent = String(text);
            return div.innerHTML;
        };

        const content = `
            <div class="result-modal-header">
                <h3 class="result-modal-title">${escapeHtml(title)}</h3>
                <span class="result-modal-close">&times;</span>
            </div>
            <div class="result-modal-body">
                <p>${escapeHtml(message)}</p>
            </div>
            <div class="result-modal-footer">
                <button id="center-ok-btn" class="btn btn-primary">${escapeHtml(t('common.ok'))}</button>
            </div>
        `;

        resultModalContent.innerHTML = content;

        // 사이드바 너비를 CSS 변수로 설정 (중앙 정렬 계산용)
        const sidebar = document.querySelector('.sidebar');
        const sidebarWidth = sidebar ? sidebar.offsetWidth : 350;
        document.documentElement.style.setProperty('--sidebar-width', `${sidebarWidth}px`);

        // 모달 표시
        resultModal.style.display = 'block';
        setTimeout(() => {
            resultModal.classList.add('show');
        }, 10);

        // 닫기 함수
        const closeModal = () => {
            resultModal.classList.remove('show');
            resultModal.classList.add('hide');
            setTimeout(() => {
                resultModal.style.display = 'none';
                resultModal.classList.remove('hide');
            }, 200);
        };

        // 이벤트 리스너
        const okBtn = document.getElementById('center-ok-btn');
        const closeBtn = resultModalContent.querySelector('.result-modal-close');

        okBtn.addEventListener('click', () => {
            closeModal();
            if (onOk) {
                onOk();
            }
        });

        closeBtn.addEventListener('click', closeModal);

        // 배경 클릭으로 닫기
        const bgClickHandler = (e) => {
            if (e.target === resultModal) {
                closeModal();
                if (onOk) {
                    onOk();
                }
                resultModal.removeEventListener('click', bgClickHandler);
            }
        };
        resultModal.addEventListener('click', bgClickHandler);

        // ESC 키로 닫기
        const escHandler = (e) => {
            if (e.key === 'Escape' && resultModal.classList.contains('show')) {
                closeModal();
                if (onOk) {
                    onOk();
                }
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }

    /**
     * 실행 결과 모달 표시 (가운데 팝업)
     * @param {string} title - 모달 제목
     * @param {Object} resultData - 실행 결과 데이터
     * @param {number} resultData.successCount - 성공 노드 개수
     * @param {number} resultData.failCount - 실패 노드 개수
     * @param {number} resultData.cancelledCount - 중단 노드 개수
     * @param {Array} resultData.nodes - 노드 실행 결과 목록 (선택적)
     * @param {Function} onOk - 확인 버튼 클릭 시 실행할 함수 (선택적)
     */
    showExecutionResult(title, resultData, onOk = null) {
        // result-modal.js의 ResultModalManager를 사용
        if (window.resultModalManager) {
            window.resultModalManager.showExecutionResult(title, resultData, onOk);
        } else {
            // 동적 import 사용
            import('./result-modal.js').then((module) => {
                const resultModalManager = module.getResultModalManagerInstance();
                resultModalManager.showExecutionResult(title, resultData, onOk);
            });
        }
    }
}

/**
 * ModalManager 인스턴스 생성 및 export
 * 싱글톤 패턴으로 하나의 인스턴스만 사용
 */
let modalManagerInstance = null;

/**
 * ModalManager 인스턴스 가져오기
 * ES6 모듈에서 명시적으로 인스턴스를 가져올 수 있도록 제공
 *
 * @returns {ModalManager} ModalManager 인스턴스
 */
export function getModalManagerInstance() {
    if (!modalManagerInstance) {
        modalManagerInstance = new ModalManager();
    }
    return modalManagerInstance;
}

// 전역 호환성을 위한 설정 (다른 파일과의 호환성 유지)
// TODO: 다른 파일들이 ES6 모듈로 전환되면 제거
if (typeof window !== 'undefined') {
    window.modalManager = getModalManagerInstance();
}
