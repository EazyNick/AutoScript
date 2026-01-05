/**
 * Undo/Redo 서비스
 * 노드 위치 변경에 대한 되돌리기 기능을 제공합니다.
 */

import { TIMING_CONSTANTS } from '../constants/timing-constants.js';
import { UNDO_REDO_CONSTANTS } from '../constants/undo-redo-constants.js';

const log = window.Logger ? window.Logger.log.bind(window.Logger) : console.log;
const logError = window.Logger ? window.Logger.error.bind(window.Logger) : console.error;

export class UndoRedoService {
    /**
     * @param {WorkflowPage} workflowPage - WorkflowPage 인스턴스
     */
    constructor(workflowPage) {
        this.workflowPage = workflowPage;
        this.undoStacks = new Map(); // 스크립트별 되돌리기 스택 (scriptId -> stack)
        this.currentScriptId = null; // 현재 스크립트 ID
        this.maxStackSize = UNDO_REDO_CONSTANTS.MAX_STACK_SIZE;
        this.isRestoring = false; // 복원 중 플래그 (무한 루프 방지)
        this.isProcessing = false; // Undo 처리 중 플래그 (중복 실행 방지)

        this.setupKeyboardListeners();
    }

    /**
     * 현재 스크립트의 Undo 스택 가져오기
     * @returns {Array} 현재 스크립트의 Undo 스택
     */
    getCurrentUndoStack() {
        if (!this.currentScriptId) {
            return [];
        }
        if (!this.undoStacks.has(this.currentScriptId)) {
            this.undoStacks.set(this.currentScriptId, []);
        }
        return this.undoStacks.get(this.currentScriptId);
    }

    /**
     * 스크립트 전환 (스크립트 로드 시 호출)
     * @param {number|string} scriptId - 전환할 스크립트 ID
     */
    switchScript(scriptId) {
        if (this.currentScriptId === scriptId) {
            return; // 같은 스크립트면 전환 불필요
        }

        log(`[UndoRedoService] 스크립트 전환: ${this.currentScriptId} -> ${scriptId}`);
        this.currentScriptId = scriptId;

        // 새 스크립트의 스택이 없으면 생성
        if (!this.undoStacks.has(scriptId)) {
            this.undoStacks.set(scriptId, []);
        } else {
            // 기존 스택이 있으면 초기화 (스크립트 로드 시 이전 작업 기록 제거)
            const existingStack = this.undoStacks.get(scriptId);
            if (existingStack && existingStack.length > 0) {
                log(
                    `[UndoRedoService] 스크립트(${scriptId}) 전환 시 기존 Undo 스택 ${existingStack.length}개 항목 초기화`
                );
                existingStack.length = 0;
            }
        }
    }

    /**
     * 키보드 이벤트 리스너 설정
     */
    setupKeyboardListeners() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+Z: 되돌리기
            if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.undo();
            }
        });
    }

    /**
     * 스냅샷 생성 (DB 스키마 기반 노드 정보 저장)
     * @param {string} type - 스냅샷 타입 ('move')
     * @returns {Object} 스냅샷 객체
     */
    createSnapshot(type = 'move') {
        if (this.isRestoring) {
            return null; // 복원 중에는 스냅샷 생성 안 함
        }

        const nodeManager = this.workflowPage?.getNodeManager();
        if (!nodeManager) {
            return null;
        }

        // 스크립트 ID 가져오기 및 업데이트
        const scriptId = this._getOrUpdateScriptId();
        if (!scriptId) {
            log('[UndoRedoService] 경고: 스크립트 ID를 찾을 수 없습니다. 스냅샷은 생성되지만 스크립트 ID 없음');
        }

        // 모든 노드의 정보 수집 (DB 스키마 기반)
        const nodesState = {};
        const canvasContent = document.getElementById('canvas-content');
        if (canvasContent) {
            const nodeElements = canvasContent.querySelectorAll('.workflow-node');
            nodeElements.forEach((nodeElement) => {
                const nodeId = nodeElement.dataset.nodeId || nodeElement.id;
                if (nodeId) {
                    const x = parseFloat(nodeElement.style.left) || 0;
                    const y = parseFloat(nodeElement.style.top) || 0;

                    // nodeData에서 노드 정보 가져오기
                    const nodeData = nodeManager.nodeData?.[nodeId] || {};

                    // 연결 정보 가져오기
                    const connectedTo = [];
                    const connectedFrom = [];
                    if (nodeManager.connectionManager) {
                        const connections = nodeManager.getAllConnections();
                        connections.forEach((conn) => {
                            if (conn.from === nodeId) {
                                connectedTo.push({
                                    to: conn.to,
                                    outputType: conn.outputType || null
                                });
                            }
                            if (conn.to === nodeId) {
                                connectedFrom.push(conn.from);
                            }
                        });
                    }

                    // DB 스키마 기반 노드 정보 저장
                    nodesState[nodeId] = {
                        // 기본 정보 (DB: node_id, node_type)
                        id: nodeId,
                        type: nodeData.type || nodeElement.dataset.nodeType || 'unknown',

                        // 위치 정보 (DB: position_x, position_y)
                        position: {
                            x: x,
                            y: y
                        },

                        // 노드 데이터 (DB: node_data)
                        data: nodeData.data || nodeData || {},

                        // 파라미터 (DB: parameters)
                        parameters: nodeData.parameters || {},

                        // 설명 (DB: description)
                        description: nodeData.description || null,

                        // 연결 정보 (DB: connected_to, connected_from)
                        connected_to: connectedTo,
                        connected_from: connectedFrom,

                        // 연결 메타데이터 (DB: is_connected, connection_sequence, node_identifier)
                        is_connected: nodeData.is_connected || connectedTo.length > 0 || connectedFrom.length > 0,
                        connection_sequence: nodeData.connection_sequence || null,
                        node_identifier: nodeData.node_identifier || null
                    };
                }
            });
        }

        const snapshot = {
            type: type,
            timestamp: Date.now(),
            nodesState: nodesState,
            scriptId: scriptId // 현재 스크립트 ID 저장
        };

        return snapshot;
    }

    /**
     * 스냅샷 저장 (되돌리기 스택에 추가)
     * @param {Object} beforeSnapshot - 이전 상태 스냅샷
     * @param {Object} afterSnapshot - 이후 상태 스냅샷
     */
    saveSnapshot(beforeSnapshot, afterSnapshot) {
        if (this.isRestoring) {
            log('[UndoRedoService] 복원 중이어서 스냅샷 저장 건너뜀');
            return;
        }

        if (!beforeSnapshot) {
            log('[UndoRedoService] 경고: beforeSnapshot이 없어서 스냅샷 저장 건너뜀');
            return;
        }

        if (!afterSnapshot) {
            log('[UndoRedoService] 경고: afterSnapshot이 없어서 스냅샷 저장 건너뜀');
            return;
        }

        const undoStack = this.getCurrentUndoStack();
        const snapshotType = afterSnapshot.type || 'unknown';

        // Undo 스택에 추가
        undoStack.push({
            before: beforeSnapshot,
            after: afterSnapshot
        });

        // 스택 크기 제한 적용 (모든 작업 공통으로 20번 제한)
        this._limitStackSize(undoStack, this.maxStackSize);

        log(
            `[UndoRedoService] 스냅샷 저장 완료: ${snapshotType} (스크립트: ${this.currentScriptId}, 스택 크기: ${undoStack.length}/${this.maxStackSize})`
        );
    }

    /**
     * 스크립트 ID 가져오기 또는 업데이트 (여러 소스에서 시도)
     * @returns {number|string|null} 스크립트 ID
     */
    _getOrUpdateScriptId() {
        // 이미 currentScriptId가 있으면 반환
        if (this.currentScriptId) {
            return this.currentScriptId;
        }

        let scriptId = null;

        // 1. loadService에서 가져오기
        const loadService = this.workflowPage?.getLoadService?.();
        if (loadService) {
            scriptId = loadService.getLastLoadedScriptId();
        }

        // 2. 여전히 없으면 sidebarManager에서 가져오기
        if (!scriptId) {
            const sidebarManager = this.workflowPage?.getSidebarManager?.();
            if (sidebarManager) {
                const currentScript = sidebarManager.getCurrentScript?.();
                if (currentScript && currentScript.id) {
                    scriptId = currentScript.id;
                }
            }
        }

        // 스크립트 ID를 찾았으면 currentScriptId 업데이트
        if (scriptId) {
            this.currentScriptId = scriptId;
            // 스택이 없으면 생성
            if (!this.undoStacks.has(scriptId)) {
                this.undoStacks.set(scriptId, []);
            }
        }

        return scriptId;
    }

    /**
     * 스택 크기 제한 적용
     * @param {Array} stack - 제한할 스택
     * @param {number} maxSize - 최대 크기
     */
    _limitStackSize(stack, maxSize) {
        if (stack.length > maxSize) {
            const removeCount = stack.length - maxSize;
            stack.splice(0, removeCount);
        }
    }

    /**
     * 되돌리기 실행
     */
    undo() {
        // 중복 실행 방지
        if (this.isProcessing || this.isRestoring) {
            log('[UndoRedoService] 이미 처리 중입니다. 중복 실행 방지');
            return;
        }

        // 스크립트 ID 확인 (없으면 여러 소스에서 가져오기)
        if (!this.currentScriptId) {
            const scriptId = this._getOrUpdateScriptId();
            if (scriptId) {
                this.switchScript(scriptId);
            } else {
                log('[UndoRedoService] 스크립트 ID를 찾을 수 없습니다. 되돌리기 건너뜀');
                return;
            }
        }

        const undoStack = this.getCurrentUndoStack();

        if (undoStack.length === 0) {
            log(`[UndoRedoService] 되돌리기할 항목이 없습니다. (스크립트: ${this.currentScriptId})`);
            return;
        }

        this.isProcessing = true;

        try {
            const snapshotPair = undoStack.pop();
            const beforeSnapshot = snapshotPair.before;
            const afterSnapshot = snapshotPair.after;

            // 스크립트 ID 확인
            if (beforeSnapshot.scriptId !== this.currentScriptId) {
                log(
                    `[UndoRedoService] 다른 스크립트의 스냅샷입니다. 되돌리기 건너뜀 (스냅샷 스크립트: ${beforeSnapshot.scriptId}, 현재 스크립트: ${this.currentScriptId})`
                );
                this.isProcessing = false;
                return;
            }

            // 이전 상태로 복원
            this.restoreSnapshot(beforeSnapshot);

            this.isProcessing = false;
            log(`[UndoRedoService] 되돌리기 실행: ${afterSnapshot.type}`);
        } catch (error) {
            logError('[UndoRedoService] 되돌리기 실패:', error);
            this.isProcessing = false;
        }
    }

    /**
     * 스냅샷 복원 (노드 위치 복원 및 삭제된 노드 복원, DB 스키마 기반)
     * @param {Object} snapshot - 복원할 스냅샷
     */
    restoreSnapshot(snapshot) {
        if (!snapshot || !snapshot.nodesState) {
            return;
        }

        // 스크립트 ID 확인
        if (snapshot.scriptId !== this.currentScriptId) {
            log('[UndoRedoService] 다른 스크립트의 스냅샷입니다. 복원 건너뜀');
            return;
        }

        this.isRestoring = true;

        try {
            const nodeManager = this.workflowPage?.getNodeManager();
            if (!nodeManager) {
                this.isRestoring = false;
                return;
            }

            const canvasContent = document.getElementById('canvas-content');
            if (!canvasContent) {
                this.isRestoring = false;
                return;
            }

            const nodesState = snapshot.nodesState;
            const snapshotType = snapshot.type || 'move';

            // delete 타입의 경우: 삭제된 노드를 복원해야 함
            if (snapshotType === 'delete') {
                this._restoreDeletedNodes(nodesState, nodeManager, canvasContent, snapshot);
            } else {
                // move 타입의 경우: 기존 노드 위치만 복원
                this._restoreNodePositions(nodesState, nodeManager, canvasContent);
            }

            // 연결선 업데이트
            if (nodeManager.connectionManager) {
                setTimeout(() => {
                    nodeManager.connectionManager.updateAllConnections();
                }, TIMING_CONSTANTS.DEFAULT_DELAY);
            }

            // DB 저장
            setTimeout(() => {
                this.saveToDatabase();
                this.isRestoring = false;
            }, TIMING_CONSTANTS.MEDIUM_DELAY);
        } catch (error) {
            logError('[UndoRedoService] 스냅샷 복원 실패:', error);
            this.isRestoring = false;
        }
    }

    /**
     * 노드 요소 찾기 헬퍼 메서드
     * @param {string} nodeId - 노드 ID
     * @param {HTMLElement} canvasContent - 캔버스 컨텐츠 요소
     * @returns {HTMLElement|null} 노드 요소
     */
    _findNodeElement(nodeId, canvasContent) {
        return document.getElementById(nodeId) || canvasContent.querySelector(`[data-node-id="${nodeId}"]`);
    }

    /**
     * 노드 위치 복원 헬퍼 메서드
     * @param {HTMLElement} nodeElement - 노드 요소
     * @param {Object} nodeState - 노드 상태
     * @param {NodeManager} nodeManager - 노드 매니저
     */
    _restoreNodePosition(nodeElement, nodeState, nodeManager) {
        const position = nodeState.position || { x: nodeState.x || 0, y: nodeState.y || 0 };
        nodeElement.style.left = `${position.x}px`;
        nodeElement.style.top = `${position.y}px`;
        this._updateNodeData(nodeManager, nodeState.id, nodeState, position);
    }

    /**
     * 노드 위치 복원 (move 타입용)
     * @param {Object} nodesState - 노드 상태 객체
     * @param {NodeManager} nodeManager - 노드 매니저
     * @param {HTMLElement} canvasContent - 캔버스 컨텐츠 요소
     */
    _restoreNodePositions(nodesState, nodeManager, canvasContent) {
        Object.keys(nodesState).forEach((nodeId) => {
            const nodeState = nodesState[nodeId];
            if (!nodeState) {
                return;
            }

            const nodeElement = this._findNodeElement(nodeId, canvasContent);
            if (!nodeElement) {
                return;
            }

            // 노드가 현재 캔버스에 존재하는지 확인
            if (!canvasContent.contains(nodeElement)) {
                return;
            }

            // 위치 복원
            this._restoreNodePosition(nodeElement, nodeState, nodeManager);
        });
    }

    /**
     * 삭제된 노드 복원 (delete 타입용)
     * @param {Object} nodesState - 노드 상태 객체
     * @param {NodeManager} nodeManager - 노드 매니저
     * @param {HTMLElement} canvasContent - 캔버스 컨텐츠 요소
     * @param {Object} snapshot - 전체 스냅샷 (연결 정보 복원용)
     */
    _restoreDeletedNodes(nodesState, nodeManager, canvasContent, snapshot) {
        Object.keys(nodesState).forEach((nodeId) => {
            const nodeState = nodesState[nodeId];
            if (!nodeState) {
                return;
            }

            // 노드가 이미 존재하는지 확인
            const existingNode = this._findNodeElement(nodeId, canvasContent);

            if (existingNode) {
                // 노드가 이미 존재하면 위치만 복원
                this._restoreNodePosition(existingNode, nodeState, nodeManager);
            } else {
                // 노드가 없으면 새로 생성
                this._recreateNodeFromSnapshot(nodeState, nodeManager, snapshot);
            }
        });
    }

    /**
     * 스냅샷에서 노드 재생성
     * @param {Object} nodeState - 노드 상태
     * @param {NodeManager} nodeManager - 노드 매니저
     * @param {Object} snapshot - 전체 스냅샷 (연결 정보 복원용)
     */
    _recreateNodeFromSnapshot(nodeState, nodeManager, snapshot) {
        try {
            const position = nodeState.position || { x: 0, y: 0 };

            // 노드 데이터 구성
            const nodeData = {
                id: nodeState.id,
                type: nodeState.type,
                title: nodeState.data?.title || nodeState.data?.label || '노드',
                x: position.x,
                y: position.y,
                data: nodeState.data || {},
                parameters: nodeState.parameters || {},
                description: nodeState.description || null
            };

            // 노드 생성
            const nodeElement = nodeManager.createNode(nodeData);

            // nodeData에 모든 정보 저장
            if (nodeManager.nodeData) {
                if (!nodeManager.nodeData[nodeState.id]) {
                    nodeManager.nodeData[nodeState.id] = {};
                }
                this._updateNodeData(nodeManager, nodeState.id, nodeState, position);
            }

            // 연결 정보 복원 (connected_to와 connected_from 모두 복원)
            if (nodeManager.connectionManager) {
                setTimeout(() => {
                    // connected_to 복원 (이 노드에서 나가는 연결)
                    if (nodeState.connected_to && nodeState.connected_to.length > 0) {
                        nodeState.connected_to.forEach((conn) => {
                            try {
                                // 대상 노드가 존재하는지 확인
                                const canvasContent = document.getElementById('canvas-content');
                                const targetNode = canvasContent ? this._findNodeElement(conn.to, canvasContent) : null;
                                if (targetNode) {
                                    nodeManager.connectionManager.createConnection(
                                        nodeState.id,
                                        conn.to,
                                        conn.outputType || null
                                    );
                                }
                            } catch (error) {
                                logError(`[UndoRedoService] 연결 복원 실패: ${nodeState.id} -> ${conn.to}`, error);
                            }
                        });
                    }

                    // connected_from 복원 (이 노드로 들어오는 연결)
                    if (nodeState.connected_from && nodeState.connected_from.length > 0) {
                        nodeState.connected_from.forEach((fromNodeId) => {
                            try {
                                // 소스 노드가 존재하는지 확인
                                const canvasContent = document.getElementById('canvas-content');
                                const sourceNode = canvasContent
                                    ? this._findNodeElement(fromNodeId, canvasContent)
                                    : null;
                                if (sourceNode) {
                                    // connected_to 정보에서 outputType 찾기
                                    const sourceNodeState = snapshot?.nodesState?.[fromNodeId];
                                    let outputType = null;
                                    if (sourceNodeState && sourceNodeState.connected_to) {
                                        const conn = sourceNodeState.connected_to.find((c) => c.to === nodeState.id);
                                        if (conn) {
                                            outputType = conn.outputType || null;
                                        }
                                    }
                                    nodeManager.connectionManager.createConnection(
                                        fromNodeId,
                                        nodeState.id,
                                        outputType
                                    );
                                }
                            } catch (error) {
                                logError(`[UndoRedoService] 연결 복원 실패: ${fromNodeId} -> ${nodeState.id}`, error);
                            }
                        });
                    }
                }, 100);
            }

            log(`[UndoRedoService] 노드 복원 완료: ${nodeState.id}`);
        } catch (error) {
            logError(`[UndoRedoService] 노드 재생성 실패: ${nodeState.id}`, error);
        }
    }

    /**
     * nodeData 업데이트 헬퍼 메서드
     * @param {NodeManager} nodeManager - 노드 매니저
     * @param {string} nodeId - 노드 ID
     * @param {Object} nodeState - 노드 상태
     * @param {Object} position - 위치 정보
     */
    _updateNodeData(nodeManager, nodeId, nodeState, position) {
        if (!nodeManager.nodeData) {
            return;
        }

        if (!nodeManager.nodeData[nodeId]) {
            nodeManager.nodeData[nodeId] = {};
        }

        // 위치 정보 업데이트
        nodeManager.nodeData[nodeId].x = position.x;
        nodeManager.nodeData[nodeId].y = position.y;

        // 기타 정보도 업데이트 (복원 시 일관성 유지)
        if (nodeState.type) {
            nodeManager.nodeData[nodeId].type = nodeState.type;
        }
        if (nodeState.data) {
            nodeManager.nodeData[nodeId].data = { ...nodeState.data };
        }
        if (nodeState.parameters) {
            nodeManager.nodeData[nodeId].parameters = { ...nodeState.parameters };
        }
        if (nodeState.description !== undefined) {
            nodeManager.nodeData[nodeId].description = nodeState.description;
        }
        if (nodeState.is_connected !== undefined) {
            nodeManager.nodeData[nodeId].is_connected = nodeState.is_connected;
        }
        if (nodeState.connection_sequence !== undefined) {
            nodeManager.nodeData[nodeId].connection_sequence = nodeState.connection_sequence;
        }
        if (nodeState.node_identifier !== undefined) {
            nodeManager.nodeData[nodeId].node_identifier = nodeState.node_identifier;
        }
    }

    /**
     * 노드 이동 스냅샷 저장
     * @param {Object} beforeSnapshot - 이동 전 스냅샷
     * @param {Object} afterSnapshot - 이동 후 스냅샷
     */
    saveMoveSnapshot(beforeSnapshot, afterSnapshot) {
        this.saveSnapshot(beforeSnapshot, afterSnapshot);
    }

    /**
     * 노드 삭제 스냅샷 저장
     * @param {Object} beforeSnapshot - 삭제 전 스냅샷
     * @param {Object} afterSnapshot - 삭제 후 스냅샷
     */
    saveDeleteSnapshot(beforeSnapshot, afterSnapshot) {
        this.saveSnapshot(beforeSnapshot, afterSnapshot);
    }

    /**
     * DB에 저장
     * 되돌리기 후 변경사항을 DB에 반영합니다.
     */
    async saveToDatabase() {
        try {
            // 현재 스크립트 ID 확인
            if (!this.currentScriptId) {
                return;
            }

            const saveService = this.workflowPage?.getSaveService();
            if (saveService) {
                // 명시적으로 스크립트 ID를 전달하여 다른 스크립트에 저장되는 것을 방지
                await saveService.save({
                    useToast: false,
                    showAlert: false,
                    scriptId: this.currentScriptId
                });
                log(`[UndoRedoService] DB 저장 완료 (스크립트: ${this.currentScriptId})`);
            }
        } catch (error) {
            logError('[UndoRedoService] DB 저장 실패:', error);
        }
    }
}
