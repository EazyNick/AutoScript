// node-drag.js
// 노드 드래그 / 위치 업데이트 담당 컨트롤러
// ES6 모듈 방식으로 작성됨

import { TIMING_CONSTANTS } from '../../../pages/workflow/constants/timing-constants.js';

// Logger는 logger.js에서 로드됨
const log = window.Logger ? window.Logger.log.bind(window.Logger) : console.log;
const logError = window.Logger ? window.Logger.error.bind(window.Logger) : console.error;

export class NodeDragController {
    /**
     * @param {NodeManager} nodeManager
     */
    constructor(nodeManager) {
        this.nodeManager = nodeManager;
        this.canvas = nodeManager.canvas;

        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.draggedNode = null;
        this._snapshotSaveScheduled = false; // 스냅샷 저장 중복 실행 방지 플래그

        // 성능 최적화: 캔버스 바운딩 박스 캐싱
        // getBoundingClientRect()는 리플로우를 유발하므로 드래그 중에는 캐시된 값을 사용
        this.cachedCanvasRect = null;
        this.canvasRectCacheTime = 0;
        this.CANVAS_RECT_CACHE_DURATION = TIMING_CONSTANTS.CANVAS_RECT_CACHE_DURATION;

        // 성능 최적화: requestAnimationFrame을 사용한 업데이트 스로틀링
        // 매 mousemove마다 업데이트하지 않고, 브라우저 렌더링 주기에 맞춰 업데이트
        this.rafId = null;
        this.pendingPosition = null; // 다음 프레임에 적용할 위치

        // 성능 최적화: 연결선 업데이트 스로틀링
        // 드래그 중에는 연결선 업데이트를 최소화하고, 드래그 종료 시에만 완전히 업데이트
        this.lastConnectionUpdateTime = 0;
        this.CONNECTION_UPDATE_INTERVAL = TIMING_CONSTANTS.CONNECTION_UPDATE_INTERVAL;

        this.bindGlobalEvents();
        this.setupResizeListener();
    }

    /**
     * 전역 mousemove / mouseup 바인딩
     * 성능 최적화: requestAnimationFrame을 사용하여 업데이트를 브라우저 렌더링 주기에 맞춤
     */
    bindGlobalEvents() {
        document.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                // 마우스 위치를 즉시 저장 (이벤트 객체는 재사용되므로)
                this.pendingPosition = { x: e.clientX, y: e.clientY };

                // requestAnimationFrame이 이미 예약되지 않았을 때만 예약
                // 이렇게 하면 한 프레임에 한 번만 업데이트되어 성능이 향상됨
                if (this.rafId === null) {
                    this.rafId = requestAnimationFrame(() => {
                        this.handleDrag();
                        this.rafId = null;
                    });
                }
            }
        });

        document.addEventListener('mouseup', () => {
            if (this.isDragging) {
                // requestAnimationFrame 취소 (드래그 종료 시)
                if (this.rafId !== null) {
                    cancelAnimationFrame(this.rafId);
                    this.rafId = null;
                }
                this.endDrag();
            }
        });
    }

    /**
     * 리사이즈 이벤트 리스너 설정
     * 캔버스 크기가 변경되면 캐시된 바운딩 박스를 무효화
     */
    setupResizeListener() {
        window.addEventListener('resize', () => {
            // 캔버스 크기가 변경되면 캐시 무효화
            this.cachedCanvasRect = null;
        });
    }

    /**
     * 개별 노드에 드래그 관련 이벤트 바인딩
     */
    attachNode(node) {
        // 이미 바인딩되었는지 확인 (중복 방지)
        if (node.dataset.dragAttached === 'true') {
            return;
        }

        // 드래그 시작
        node.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
                // 왼쪽 버튼
                e.preventDefault();
                e.stopPropagation();
                this.startDrag(e, node);
            }
        });

        // 호버 시 살짝 떠오르는 효과
        node.addEventListener('mouseenter', () => {
            node.style.transform = 'translateY(-2px)';
        });

        node.addEventListener('mouseleave', () => {
            if (!this.isDragging) {
                node.style.transform = '';
            }
        });

        // 바인딩 완료 플래그 설정
        node.dataset.dragAttached = 'true';
    }

    /**
     * 드래그 시작
     */
    startDrag(e, node) {
        try {
            this.isDragging = true;
            this.draggedNode = node;

            // NodeManager 쪽 선택 상태도 맞춰줌
            if (this.nodeManager.selectionController) {
                this.nodeManager.selectionController.selectNode(node);
            } else if (typeof this.nodeManager.selectNode === 'function') {
                this.nodeManager.selectNode(node);
            }

            // Undo/Redo: 드래그 시작 전 스냅샷 저장
            // workflowPage를 여러 소스에서 찾기
            const workflowPage = this.nodeManager.workflowPage || window.workflowPage;
            const undoRedoService = workflowPage?.getUndoRedoService?.();
            if (undoRedoService && !undoRedoService.isRestoring) {
                this.dragStartSnapshot = undoRedoService.createSnapshot('move');
                if (!this.dragStartSnapshot) {
                    log('[NodeDragController] 경고: 드래그 시작 스냅샷 생성 실패');
                } else {
                    log('[NodeDragController] 드래그 시작 스냅샷 생성 성공');
                }
            } else {
                this.dragStartSnapshot = null;
                if (!workflowPage) {
                    log('[NodeDragController] 경고: workflowPage를 찾을 수 없습니다');
                }
            }

            this.calculateDragOffset(e, node);
            this.setDragState(node, true);

            log('드래그 시작:', node.id);
        } catch (error) {
            logError('드래그 시작 실패:', error);
            this.isDragging = false;
            this.draggedNode = null;
            this._snapshotSaveScheduled = false; // 플래그 초기화
        }
    }

    /**
     * 오프셋 계산
     * 드래그 시작 시 마우스 위치와 노드 위치의 차이를 계산하여 저장
     * 이 오프셋을 사용하여 드래그 중 노드의 새 위치를 계산함
     */
    calculateDragOffset(e, node) {
        // 성능 최적화: 캐시된 바운딩 박스 사용 또는 새로 계산
        const canvasRect = this.getCanvasRect();

        // 노드의 현재 위치 (style.left/top은 문자열이므로 parseInt 필요)
        const nodeX = parseInt(node.style.left) || 0;
        const nodeY = parseInt(node.style.top) || 0;

        // 마우스 위치를 캔버스 기준 좌표로 변환
        // e.clientX/Y는 화면 기준 좌표이므로, 캔버스의 왼쪽 상단 좌표를 빼서 변환
        const mouseX = e.clientX - canvasRect.left;
        const mouseY = e.clientY - canvasRect.top;

        // 드래그 오프셋 = 마우스 위치 - 노드 위치
        // 이 오프셋은 드래그 중에도 일정하게 유지되어, 노드가 마우스에 상대적으로 고정된 위치를 유지하게 함
        this.dragOffset = {
            x: mouseX - nodeX,
            y: mouseY - nodeY
        };

        log(`- 노드 위치: (${nodeX}, ${nodeY})`);
        log(`- 마우스 위치: (${mouseX}, ${mouseY})`);
        log(`- 드래그 오프셋: (${this.dragOffset.x}, ${this.dragOffset.y})`);
    }

    /**
     * 캔버스 바운딩 박스 가져오기 (캐싱 최적화)
     * getBoundingClientRect()는 리플로우를 유발하므로 캐싱하여 성능 향상
     *
     * @returns {DOMRect} 캔버스의 바운딩 박스
     */
    getCanvasRect() {
        const now = Date.now();

        // 캐시가 없거나 만료되었으면 새로 계산
        if (!this.cachedCanvasRect || now - this.canvasRectCacheTime > this.CANVAS_RECT_CACHE_DURATION) {
            this.cachedCanvasRect = this.nodeManager.canvas.getBoundingClientRect();
            this.canvasRectCacheTime = now;
        }

        return this.cachedCanvasRect;
    }

    /**
     * 드래그 CSS 상태
     */
    setDragState(node, isDragging) {
        if (isDragging) {
            node.classList.add('dragging');
        } else {
            node.classList.remove('dragging');
        }
    }

    /**
     * 드래그 중 처리 (requestAnimationFrame 콜백)
     * requestAnimationFrame을 통해 호출되므로 브라우저 렌더링 주기에 맞춰 실행됨
     * 이렇게 하면 불필요한 업데이트를 줄이고 부드러운 애니메이션을 보장함
     */
    handleDrag() {
        if (!this.isDragging || !this.draggedNode || !this.pendingPosition) {
            return;
        }

        try {
            // 저장된 마우스 위치 사용 (이벤트 객체는 재사용되므로)
            const pos = this.calculateNewPosition(this.pendingPosition);

            // 노드 위치 업데이트
            this.updateNodePosition(this.draggedNode, pos);

            // 연결선 업데이트 (스로틀링 적용)
            this.updateRelatedComponentsThrottled(this.draggedNode);
        } catch (error) {
            logError('드래그 처리 실패:', error);
        }
    }

    /**
     * 새 위치 계산
     * 마우스 위치와 드래그 오프셋을 사용하여 노드의 새 위치를 계산
     *
     * @param {Object} mousePos - 마우스 위치 { x, y } (화면 좌표)
     * @returns {Object} 노드의 새 위치 { x, y } (캔버스 좌표)
     */
    calculateNewPosition(mousePos) {
        // 성능 최적화: 캐시된 바운딩 박스 사용
        const canvasRect = this.getCanvasRect();

        // 화면 좌표를 캔버스 좌표로 변환
        const mouseX = mousePos.x - canvasRect.left;
        const mouseY = mousePos.y - canvasRect.top;

        // 노드의 새 위치 = 마우스 위치 - 드래그 오프셋
        // 드래그 오프셋은 드래그 시작 시 계산된 값으로, 노드가 마우스에 상대적으로 고정된 위치를 유지하게 함
        return {
            x: mouseX - this.dragOffset.x,
            y: mouseY - this.dragOffset.y
        };
    }

    /**
     * 실제 DOM 위치 갱신
     */
    updateNodePosition(node, position) {
        node.style.left = position.x + 'px';
        node.style.top = position.y + 'px';
    }

    /**
     * 연결선 등 관련 컴포넌트 업데이트 (스로틀링 적용)
     * 드래그 중에는 연결선 업데이트를 제한하여 성능 향상
     * 매 프레임마다 업데이트하지 않고, 일정 간격으로만 업데이트
     *
     * @param {HTMLElement} node - 업데이트할 노드 요소
     */
    updateRelatedComponentsThrottled(node) {
        const now = Date.now();
        const nodeId = node.dataset.nodeId || node.id;

        if (!this.nodeManager) {
            return;
        }

        // 마지막 업데이트로부터 일정 시간이 지났을 때만 업데이트
        // 이렇게 하면 드래그 중에도 부드러운 성능을 유지할 수 있음
        if (now - this.lastConnectionUpdateTime >= this.CONNECTION_UPDATE_INTERVAL) {
            // 드래그 중에는 연결선 매니저를 직접 호출하여 실시간 업데이트
            if (this.nodeManager.connectionManager) {
                // 특정 노드와 관련된 연결선만 즉시 업데이트
                this.nodeManager.connectionManager.updateNodeConnectionsImmediately(nodeId);
            } else if (window.connectionManager) {
                // 전역 connectionManager가 있으면 사용
                window.connectionManager.updateNodeConnectionsImmediately(nodeId);
            }

            this.lastConnectionUpdateTime = now;
        }
    }

    /**
     * 드래그 종료
     * 드래그가 끝나면 최종 위치를 저장하고 연결선을 완전히 업데이트
     */
    endDrag() {
        if (!this.isDragging || !this.draggedNode) {
            return;
        }

        try {
            const node = this.draggedNode;
            const nodeId = node.dataset.nodeId;

            // 최종 위치 저장 (nodeData에 반영)
            this.saveFinalPosition(node);

            // Undo/Redo: 드래그 종료 후 스냅샷 저장
            // workflowPage를 여러 소스에서 찾기
            const workflowPage = this.nodeManager.workflowPage || window.workflowPage;
            const undoRedoService = workflowPage?.getUndoRedoService?.();

            log(
                `[NodeDragController] 드래그 종료 처리 시작 - workflowPage: ${!!workflowPage}, undoRedoService: ${!!undoRedoService}, isRestoring: ${undoRedoService?.isRestoring}, dragStartSnapshot: ${!!this.dragStartSnapshot}`
            );

            if (undoRedoService && !undoRedoService.isRestoring) {
                // dragStartSnapshot이 없으면 지금 생성 (드래그 시작 시 생성 실패한 경우 대비)
                if (!this.dragStartSnapshot) {
                    log('[NodeDragController] 경고: 드래그 시작 스냅샷이 없어서 지금 생성합니다');
                    this.dragStartSnapshot = undoRedoService.createSnapshot('move');
                    if (!this.dragStartSnapshot) {
                        log('[NodeDragController] 오류: 드래그 시작 스냅샷 생성 실패');
                    }
                }

                if (this.dragStartSnapshot) {
                    // DOM 업데이트 완료를 기다린 후 스냅샷 저장
                    // 중복 실행 방지: 이미 스냅샷 저장이 예약되어 있으면 건너뜀
                    if (this._snapshotSaveScheduled) {
                        log('[NodeDragController] 스냅샷 저장이 이미 예약되어 있어 건너뜀');
                        return;
                    }
                    this._snapshotSaveScheduled = true;

                    setTimeout(() => {
                        // 중복 실행 방지: 드래그가 끝났는지 다시 확인
                        if (!this.dragStartSnapshot) {
                            this._snapshotSaveScheduled = false;
                            return;
                        }

                        log('[NodeDragController] 드래그 종료 스냅샷 생성 시작');
                        const dragEndSnapshot = undoRedoService.createSnapshot('move');
                        if (dragEndSnapshot) {
                            log('[NodeDragController] 드래그 종료 스냅샷 생성 성공, 저장 시작');
                            undoRedoService.saveMoveSnapshot(this.dragStartSnapshot, dragEndSnapshot);
                            log('[NodeDragController] 드래그 종료 스냅샷 저장 완료');
                        } else {
                            log('[NodeDragController] 경고: 드래그 종료 스냅샷 생성 실패');
                        }
                        this.dragStartSnapshot = null; // 스냅샷 초기화
                        this._snapshotSaveScheduled = false; // 플래그 초기화
                    }, 100); // 50ms -> 100ms로 증가 (DOM 업데이트 완료 대기)
                } else {
                    log('[NodeDragController] 경고: 드래그 시작 스냅샷을 생성할 수 없어 스냅샷 저장 건너뜀');
                }
            } else {
                if (!undoRedoService) {
                    log('[NodeDragController] 경고: undoRedoService를 찾을 수 없습니다');
                }
                if (undoRedoService?.isRestoring) {
                    log('[NodeDragController] 경고: 복원 중이어서 스냅샷 저장 건너뜀');
                }
            }

            // CSS 상태 정리 (dragging 클래스 제거)
            this.setDragState(node, false);

            // 성능 최적화: 드래그 종료 시에만 연결선을 완전히 업데이트
            // 드래그 중에는 스로틀링된 업데이트만 했으므로, 종료 시 정확한 위치로 업데이트
            if (typeof this.nodeManager.updateConnectionsImmediately === 'function') {
                this.nodeManager.updateConnectionsImmediately(nodeId);
            }

            // connectionManager.updateConnections() 호출 (기존 로직 유지)
            // 약간의 지연을 두어 DOM 업데이트가 완료된 후 연결선을 업데이트
            if (window.connectionManager) {
                setTimeout(() => {
                    window.connectionManager.updateConnections();
                }, TIMING_CONSTANTS.SHORT_DELAY);
            }

            // 캐시 무효화 (드래그 종료 시)
            this.cachedCanvasRect = null;
            this.pendingPosition = null;

            log(`드래그 종료: ${nodeId}`);
        } catch (error) {
            logError('드래그 종료 실패:', error);
        } finally {
            this.isDragging = false;
            this.draggedNode = null;
            this._snapshotSaveScheduled = false; // 플래그 초기화
            this.lastConnectionUpdateTime = 0; // 연결선 업데이트 시간 초기화
        }
    }

    /**
     * nodeData에 최종 위치 반영
     */
    saveFinalPosition(node) {
        const nodeId = node.dataset.nodeId;
        const finalX = parseInt(node.style.left) || 0;
        const finalY = parseInt(node.style.top) || 0;
        const data = this.nodeManager.nodeData && this.nodeManager.nodeData[nodeId];

        if (data) {
            data.x = finalX;
            data.y = finalY;
            data.updatedAt = new Date().toISOString();
        }
    }
}

// 전역으로 노출 (하위 호환성을 위해)
window.NodeDragController = NodeDragController;
