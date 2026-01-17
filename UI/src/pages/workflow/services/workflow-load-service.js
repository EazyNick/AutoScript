/**
 * 워크플로우 로드 서비스
 * 서버에서 워크플로우 데이터를 가져와 화면에 표시하는 로직을 담당합니다.
 */

import { TIMING_CONSTANTS } from '../constants/timing-constants.js';
import { getDefaultDescription } from '../config/node-defaults.js';
import { NODE_TYPES } from '../constants/node-types.js';
import { ScriptAPI } from '../../../js/api/scriptapi.js';
import { getNodeRegistry } from './node-registry.js';

export class WorkflowLoadService {
    /**
     * 워크플로우 로드 서비스
     * 서버에서 스크립트 데이터를 가져와 화면에 렌더링합니다.
     */
    constructor(workflowPage) {
        this.workflowPage = workflowPage; // WorkflowPage 인스턴스 참조
        this.isLoading = false; // 중복 로드 방지 플래그
        this._lastLoadedScriptId = null; // 마지막으로 로드한 스크립트 ID (중복 로드 방지용)
        this._currentLoadPromise = null; // 현재 로드 중인 Promise (취소용)
        this._currentLoadId = null; // 현재 로드 ID (취소 확인용)
        this._loadQueue = []; // 로드 대기 큐
        this._isProcessingQueue = false; // 큐 처리 중 플래그
        this._cancelledLoadIds = new Set(); // 취소된 로드 ID 집합
    }

    /**
     * 마지막으로 로드한 스크립트 ID 가져오기
     * @returns {string|null} 마지막으로 로드한 스크립트 ID
     */
    getLastLoadedScriptId() {
        return this._lastLoadedScriptId;
    }

    /**
     * 특정 스크립트가 이미 로드되었는지 확인
     * @param {string} scriptId - 확인할 스크립트 ID
     * @returns {boolean} 이미 로드되었으면 true
     */
    isScriptLoaded(scriptId) {
        return this._lastLoadedScriptId === scriptId;
    }

    /**
     * 스크립트 데이터 로드
     * 서버에서 노드 및 연결 정보를 가져와 화면에 표시합니다.
     * @param {Object} script - 스크립트 정보 {id, name, description}
     * @param {boolean} forceReload - 강제 재로드 여부
     */
    async load(script, forceReload = false) {
        const logger = this.workflowPage.getLogger();
        const log = logger.log;
        const logError = logger.error;

        log('[WorkflowLoadService] load() 호출됨:', { id: script?.id, name: script?.name, forceReload });

        // 유효성 검사
        if (!script || !script.id) {
            logError('[WorkflowLoadService] ⚠️ 유효하지 않은 스크립트 정보:', script);
            return;
        }

        // 같은 스크립트를 다시 로드하려는 경우 방지 (강제 재로드가 아닌 경우에만)
        if (!forceReload && script && script.id && this._lastLoadedScriptId === script.id) {
            log('[WorkflowLoadService] 같은 스크립트가 이미 로드되었습니다. 중복 로드 방지:', script.id);
            return;
        }

        // 현재 로딩 중이면 이전 로드 취소하고 새 로드 시작
        if (this.isLoading && this._currentLoadPromise && this._currentLoadId) {
            log('[WorkflowLoadService] 기존 로드 취소하고 새 로드 시작');
            // 이전 로드를 취소 표시
            this._cancelledLoadIds.add(this._currentLoadId);
            const previousLoadId = this._currentLoadId;

            // 노드 제거가 완료되도록 기존 노드 강제 제거
            const nodeManager = this.workflowPage.getNodeManager();
            if (nodeManager) {
                log('[WorkflowLoadService] 취소된 로드의 노드 제거 시작');
                await this.clearExistingNodes(nodeManager);
            }

            // 이전 로드가 완료될 때까지 짧게 대기
            try {
                await Promise.race([this._currentLoadPromise, new Promise((resolve) => setTimeout(resolve, 100))]);
            } catch (error) {
                // 에러는 무시 (취소된 로드의 에러)
            }

            // 취소된 로드 ID 정리 (오래된 것만)
            if (this._cancelledLoadIds.size > 10) {
                this._cancelledLoadIds.clear();
            }
        }

        // 노드 레지스트리 로딩 완료 대기
        const registry = getNodeRegistry();
        try {
            log('[WorkflowLoadService] 노드 레지스트리 로딩 완료 대기...');
            await registry.getNodeConfigs();
            log('[WorkflowLoadService] 노드 레지스트리 로딩 완료');
        } catch (error) {
            logError('[WorkflowLoadService] 노드 레지스트리 로딩 실패:', error);
            // 계속 진행 (폴백 설정 사용)
        }

        // 로딩 시작
        this.isLoading = true;

        // 고유 로드 ID 생성
        const loadId = `${script.id}_${Date.now()}_${Math.random()}`;
        this._currentLoadId = loadId;

        // 현재 로드 Promise 생성 (취소 가능하도록)
        const loadPromise = this._performLoad(script, forceReload, loadId);
        this._currentLoadPromise = loadPromise;

        try {
            await loadPromise;
        } finally {
            // 로드 완료 후 정리 (현재 로드인 경우에만)
            if (this._currentLoadId === loadId) {
                this._currentLoadPromise = null;
                this._currentLoadId = null;
            }
        }
    }

    /**
     * 실제 로드 수행
     * @param {Object} script - 스크립트 정보
     * @param {boolean} forceReload - 강제 재로드 여부
     * @param {string} loadId - 로드 ID (취소 확인용)
     */
    async _performLoad(script, forceReload, loadId) {
        const logger = this.workflowPage.getLogger();
        const log = logger.log;
        const logError = logger.error;

        // 로드가 취소되었는지 확인
        if (this._cancelledLoadIds.has(loadId)) {
            log('[WorkflowLoadService] 로드가 취소되었습니다:', loadId);
            return;
        }

        // 노드 로딩 오버레이 표시
        if (this.workflowPage && typeof this.workflowPage.showNodeLoading === 'function') {
            this.workflowPage.showNodeLoading();
        }

        // 1. 연결선 매니저 초기화 확인
        this.workflowPage.ensureConnectionManagerInitialized();

        const nodeManager = this.workflowPage.getNodeManager();

        // 2. 기존 노드들 제거 (스크립트 전환 시)
        // 같은 스크립트를 다시 로드하는 경우가 아니면 기존 노드 제거
        // previousScriptId: 이전에 로드한 스크립트 ID (스크립트 변경 여부 확인용)
        const previousScriptId = this._lastLoadedScriptId;

        // 로드가 취소되었는지 확인
        if (this._cancelledLoadIds.has(loadId)) {
            log('[WorkflowLoadService] 로드가 취소되었습니다 (노드 제거 전):', loadId);
            return;
        }

        // 이전 스크립트가 있고 다른 스크립트로 변경하는 경우
        if (previousScriptId && previousScriptId !== script.id) {
            log('[WorkflowLoadService] 기존 노드 제거 시작 (스크립트 변경)');
            await this.clearExistingNodes(nodeManager);
        } else if (!previousScriptId) {
            // 첫 로드인 경우 (이전 스크립트가 없음)
            log('[WorkflowLoadService] 첫 로드이므로 기존 노드 제거 건너뜀');
        } else {
            // 같은 스크립트를 다시 로드하는 경우 (강제 재로드)
            if (forceReload) {
                log('[WorkflowLoadService] 강제 재로드: 기존 노드 제거');
                await this.clearExistingNodes(nodeManager);
            } else {
                log('[WorkflowLoadService] 같은 스크립트이므로 기존 노드 제거 건너뜀');
            }
        }

        // 로드가 취소되었는지 다시 확인 (노드 제거 후)
        if (this._cancelledLoadIds.has(loadId)) {
            log('[WorkflowLoadService] 로드가 취소되었습니다 (노드 제거 후):', loadId);
            return;
        }

        // 스크립트 ID 저장 (노드 제거 후에 저장)
        this._lastLoadedScriptId = script.id;

        // Undo/Redo 서비스에 스크립트 전환 알림
        const undoRedoService = this.workflowPage?.getUndoRedoService?.();
        if (undoRedoService && script.id) {
            undoRedoService.switchScript(script.id);
        }

        try {
            // 로드가 취소되었는지 확인 (서버 요청 전)
            if (this._cancelledLoadIds.has(loadId)) {
                log('[WorkflowLoadService] 로드가 취소되었습니다 (서버 요청 전):', loadId);
                return;
            }

            if (ScriptAPI && script.id) {
                const response = await ScriptAPI.getScript(script.id);

                // 로드가 취소되었는지 확인 (서버 응답 후)
                if (this._cancelledLoadIds.has(loadId)) {
                    log('[WorkflowLoadService] 로드가 취소되었습니다 (서버 응답 후):', loadId);
                    return;
                }

                log('[WorkflowPage] ✅ 서버에서 스크립트 정보 받음:', response);

                const nodes = response.nodes || [];
                // 서버에서 connections 배열을 직접 받거나, 없으면 노드의 connected_to에서 생성
                let connections = response.connections || [];

                // connections가 없으면 노드의 connected_to에서 생성 (하위 호환성)
                if (connections.length === 0) {
                    connections = this.buildConnectionsFromNodes(nodes);
                }

                log(`[WorkflowPage] 서버에서 받은 노드 개수: ${nodes.length}개`);
                log(`[WorkflowPage] 연결 개수: ${connections.length}개`);
                log('[WorkflowPage] 연결 정보:', connections);

                // 노드가 있으면 화면에 렌더링
                if (nodes.length > 0) {
                    // 서버에서 불러온 노드에 경계 노드가 포함되어 있는지 확인
                    // hasBoundaryNode: 경계 노드가 포함되어 있는지 여부
                    const { isBoundaryNodeSync } = await import('../constants/node-types.js');
                    const hasBoundaryNode = nodes.some((n) => {
                        const nodeType = n.type || (n.id === 'start' ? 'start' : null);
                        return nodeType && isBoundaryNodeSync(nodeType);
                    });

                    log(`[WorkflowPage] 서버 노드 확인 - 경계 노드: ${hasBoundaryNode}`);

                    // 로드가 취소되었는지 확인 (노드 렌더링 전)
                    if (this._cancelledLoadIds.has(loadId)) {
                        log('[WorkflowLoadService] 로드가 취소되었습니다 (노드 렌더링 전):', loadId);
                        return;
                    }

                    // 노드들을 화면에 렌더링
                    await this.renderNodes(nodes, connections, nodeManager, loadId);
                } else {
                    // 노드가 없을 때만 기본 시작 노드 생성
                    log('[WorkflowPage] 노드가 없어 기본 시작 노드 생성');
                    await this.workflowPage.createDefaultBoundaryNodes();
                }
            } else {
                logError('[WorkflowPage] ⚠️ ScriptAPI를 사용할 수 없거나 script.id가 없습니다.');
                await this.workflowPage.createDefaultBoundaryNodes();
            }
        } catch (error) {
            logError('[WorkflowPage] ❌ 노드 데이터 로드 실패:', error);
            await this.workflowPage.createDefaultBoundaryNodes();
        } finally {
            // 로딩 완료
            this.isLoading = false;

            // 노드 로딩 오버레이 숨김
            if (this.workflowPage && typeof this.workflowPage.hideNodeLoading === 'function') {
                this.workflowPage.hideNodeLoading();
            }

            // 스크립트 ID는 유지 (같은 스크립트 중복 로드 방지)
        }
    }

    /**
     * 현재 로드 취소
     */
    cancelCurrentLoad() {
        if (this.isLoading) {
            const logger = this.workflowPage.getLogger();
            logger.log('[WorkflowLoadService] 현재 로드 취소');
            this._lastLoadedScriptId = null;
        }
    }

    /**
     * 기존 노드들 제거
     * 스크립트 전환 시 화면의 모든 노드를 제거합니다.
     * @param {NodeManager} nodeManager - 노드 관리자 인스턴스
     * @returns {Promise<void>} 노드 제거 완료 Promise
     */
    async clearExistingNodes(nodeManager) {
        const logger = this.workflowPage.getLogger();
        const log = logger.log;

        log('[WorkflowPage] 기존 노드 제거 시작');

        if (!nodeManager) {
            log('[WorkflowPage] ⚠️ NodeManager를 찾을 수 없습니다.');
            return;
        }

        // 1. 연결선 먼저 제거 (노드 삭제 전에 연결선 제거)
        if (nodeManager.connectionManager) {
            try {
                // 모든 연결선 제거
                const allConnections = document.querySelectorAll('.connection-line');
                allConnections.forEach((conn) => conn.remove());
                log('[WorkflowPage] 연결선 제거 완료');
            } catch (error) {
                log(`[WorkflowPage] 연결선 제거 중 오류: ${error}`);
            }
        }

        // 2. NodeManager의 nodes 배열에서 제거
        if (nodeManager.nodes && nodeManager.nodes.length > 0) {
            const nodesToDelete = [...nodeManager.nodes]; // 배열 복사 (반복 중 수정 방지)
            log(`[WorkflowPage] NodeManager에서 제거할 노드 개수: ${nodesToDelete.length}개`);

            // 각 노드의 연결선 먼저 제거
            nodesToDelete.forEach((nodeObj) => {
                if (nodeObj && nodeObj.element && nodeManager.connectionManager) {
                    const nodeId = nodeObj.element.id || nodeObj.element.dataset?.nodeId || nodeObj.id;
                    if (nodeId) {
                        try {
                            nodeManager.connectionManager.removeNodeConnections(nodeId);
                        } catch (error) {
                            log(`[WorkflowPage] 연결선 제거 중 오류: ${error}`);
                        }
                    }
                }
            });

            // 노드 제거
            nodesToDelete.forEach((nodeObj) => {
                if (nodeObj && nodeObj.element) {
                    try {
                        // true: 시작 노드도 포함하여 강제 삭제
                        nodeManager.deleteNode(nodeObj.element, true);
                    } catch (error) {
                        log(`[WorkflowPage] 노드 삭제 중 오류: ${error}`);
                        // deleteNode가 실패하면 직접 DOM에서 제거
                        try {
                            nodeObj.element.remove();
                        } catch (removeError) {
                            log(`[WorkflowPage] DOM 직접 제거 중 오류: ${removeError}`);
                        }
                    }
                }
            });
        }

        // 3. DOM에서 직접 제거 (혹시 남아있는 경우)
        // 단, NodeManager의 nodes 배열에 없는 노드만 제거 (이미 위에서 제거된 노드는 건너뛰기)
        const existingNodes = document.querySelectorAll('.workflow-node');
        if (existingNodes.length > 0) {
            const remainingNodeIds = new Set(
                nodeManager.nodes ? nodeManager.nodes.map((n) => n.id || n.element?.id) : []
            );
            const nodesToRemove = Array.from(existingNodes).filter((node) => {
                const nodeId = node.id || node.dataset?.nodeId;
                return !remainingNodeIds.has(nodeId);
            });

            if (nodesToRemove.length > 0) {
                log(`[WorkflowPage] DOM에서 추가로 제거할 노드 개수: ${nodesToRemove.length}개`);
                nodesToRemove.forEach((node) => {
                    try {
                        // 연결선 제거
                        if (nodeManager.connectionManager) {
                            const nodeId = node.id || node.dataset?.nodeId;
                            if (nodeId) {
                                nodeManager.connectionManager.removeNodeConnections(nodeId);
                            }
                        }
                        // 노드 제거
                        node.remove();
                    } catch (error) {
                        log(`[WorkflowPage] DOM 노드 삭제 중 오류: ${error}`);
                    }
                });
            }
        }

        // 4. nodeData 초기화
        if (nodeManager.nodeData) {
            // 기존 nodeData를 완전히 새 객체로 교체하지 않고, 키만 삭제
            const keysToDelete = Object.keys(nodeManager.nodeData);
            keysToDelete.forEach((key) => {
                delete nodeManager.nodeData[key];
            });
            log('[WorkflowPage] nodeData 초기화 완료');
        }

        // 5. NodeManager의 nodes 배열 초기화 (배열은 유지하되 요소만 제거)
        if (nodeManager.nodes && Array.isArray(nodeManager.nodes)) {
            nodeManager.nodes.length = 0; // 배열 길이를 0으로 설정하여 요소만 제거
            log('[WorkflowPage] NodeManager.nodes 배열 초기화 완료');
        }

        // DOM 업데이트 완료 대기 (노드 제거가 완전히 반영되도록)
        await new Promise((resolve) => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    resolve();
                });
            });
        });

        log('[WorkflowPage] ✅ 기존 노드 제거 완료');
    }

    /**
     * 노드들의 연결 정보로부터 connections 배열 생성
     * 하위 호환성을 위해 노드의 connected_to 필드에서 연결 정보를 추출합니다.
     * @param {Array} nodes - 노드 배열
     * @returns {Array} connections 배열
     */
    buildConnectionsFromNodes(nodes) {
        const logger = this.workflowPage.getLogger();
        const log = logger.log;

        const connections = [];

        nodes.forEach((node) => {
            let connectedTo = node.connected_to;

            // connected_to가 문자열인 경우 JSON 파싱
            if (typeof connectedTo === 'string') {
                try {
                    connectedTo = JSON.parse(connectedTo);
                } catch (e) {
                    log(`[WorkflowPage] ⚠️ 노드 ${node.id}의 connected_to 파싱 실패: ${e.message}`);
                    connectedTo = [];
                }
            }

            // 배열이 아니거나 비어있으면 건너뛰기
            if (!Array.isArray(connectedTo) || connectedTo.length === 0) {
                return;
            }

            // 각 연결에 대해 connections 배열에 추가
            // 새로운 형식: {"to": "node_id", "outputType": "true"/"false"/null}
            // 기존 형식: "node_id" (문자열)
            connectedTo.forEach((connItem) => {
                if (!connItem) {
                    return;
                }

                // 새로운 형식 (객체)
                if (typeof connItem === 'object' && connItem.to) {
                    connections.push({
                        from: node.id,
                        to: connItem.to,
                        outputType: connItem.outputType || null
                    });
                    log(
                        `[WorkflowPage] 연결 추가: ${node.id} → ${connItem.to} (outputType: ${connItem.outputType || 'null'})`
                    );
                }
                // 기존 형식 (문자열) - 하위 호환성
                else if (typeof connItem === 'string') {
                    connections.push({
                        from: node.id,
                        to: connItem,
                        outputType: null
                    });
                    log(`[WorkflowPage] 연결 추가: ${node.id} → ${connItem}`);
                }
            });
        });

        log(`[WorkflowPage] ✅ 생성된 연결 개수: ${connections.length}개`);
        return connections;
    }

    /**
     * 노드들을 화면에 렌더링
     * @param {Array} nodes - 노드 배열
     * @param {Array} connections - 연결 배열
     * @param {NodeManager} nodeManager - 노드 관리자
     * @param {string} loadId - 로드 ID (취소 확인용)
     */
    async renderNodes(nodes, connections, nodeManager, loadId) {
        const logger = this.workflowPage.getLogger();
        const log = logger.log;

        // 로드가 취소되었는지 확인
        if (loadId && this._cancelledLoadIds.has(loadId)) {
            log('[WorkflowLoadService] 로드가 취소되었습니다 (renderNodes 시작):', loadId);
            return;
        }

        log('[WorkflowPage] 노드 데이터가 있음. 화면에 그리기 시작...');
        log(
            '[WorkflowPage] 노드 목록:',
            nodes.map((n) => ({ id: n.id, type: n.type }))
        );

        // nodes_config.py에 정의된 노드만 필터링
        const registry = getNodeRegistry();
        const nodeConfigs = await registry.getNodeConfigs();
        const validNodeTypes = new Set(Object.keys(nodeConfigs));

        const filteredNodes = nodes.filter((node) => {
            const nodeType = node.type;
            if (!validNodeTypes.has(nodeType)) {
                log(`[WorkflowPage] 경고: 정의되지 않은 노드 타입 '${nodeType}' (노드 ID: ${node.id})를 건너뜁니다.`);
                return false;
            }
            return true;
        });

        if (filteredNodes.length < nodes.length) {
            log(`[WorkflowPage] 필터링: ${nodes.length}개 노드 중 ${filteredNodes.length}개만 유효합니다.`);
        }

        // 연결 정보도 필터링 (정의되지 않은 노드로 연결된 연결선 제거)
        // validNodeIds: 유효한 노드 ID 집합 (빠른 조회를 위해 Set 사용)
        const validNodeIds = new Set(filteredNodes.map((n) => n.id));
        // filteredConnections: 필터링된 연결 목록 (유효한 노드로만 연결된 연결선만 포함)
        const filteredConnections = connections.filter((conn) => {
            // fromValid: 출발 노드가 유효한지 여부
            const fromValid = validNodeIds.has(conn.from);
            // toValid: 대상 노드가 유효한지 여부
            const toValid = validNodeIds.has(conn.to);
            // 출발 노드나 대상 노드가 유효하지 않으면 제외
            if (!fromValid || !toValid) {
                log(
                    `[WorkflowPage] 경고: 정의되지 않은 노드로 연결된 연결선을 건너뜁니다. (${conn.from} -> ${conn.to})`
                );
                return false; // 필터링에서 제외
            }
            return true; // 필터링에서 포함
        });

        if (filteredConnections.length < connections.length) {
            log(`[WorkflowPage] 필터링: ${connections.length}개 연결 중 ${filteredConnections.length}개만 유효합니다.`);
        }

        // 노드 생성 (비동기 처리)
        // setTimeout 제거하고 바로 실행 (타이밍 문제 방지)
        log('[WorkflowPage] 노드 생성 시작');

        // 노드들 생성 (비동기 처리)
        for (let index = 0; index < filteredNodes.length; index++) {
            // 각 노드 생성 전에 취소 확인
            if (loadId && this._cancelledLoadIds.has(loadId)) {
                log('[WorkflowLoadService] 로드가 취소되었습니다 (노드 생성 중):', loadId);
                // 이미 생성된 노드들 제거
                const createdNodes = nodeManager.nodes.filter((n) => {
                    const nodeId = n.id || n.element?.id;
                    return filteredNodes.slice(0, index).some((nd) => nd.id === nodeId);
                });
                createdNodes.forEach((n) => {
                    if (n.element) {
                        try {
                            nodeManager.deleteNode(n.element, true);
                        } catch (error) {
                            log(`[WorkflowLoadService] 노드 제거 중 오류: ${error}`);
                        }
                    }
                });
                return;
            }

            const nodeData = filteredNodes[index];
            await this.createNodeFromServerData(nodeData, nodeManager);

            log(`[WorkflowPage] 노드 ${index + 1}/${filteredNodes.length} 생성 중:`, {
                id: nodeData.id,
                type: nodeData.type
            });
        }

        // 모든 노드 생성 후 최종 취소 확인
        if (loadId && this._cancelledLoadIds.has(loadId)) {
            log('[WorkflowLoadService] 로드가 취소되었습니다 (모든 노드 생성 후):', loadId);
            // 생성된 모든 노드 제거
            const createdNodes = nodeManager.nodes.filter((n) => {
                const nodeId = n.id || n.element?.id;
                return filteredNodes.some((nd) => nd.id === nodeId);
            });
            createdNodes.forEach((n) => {
                if (n.element) {
                    try {
                        nodeManager.deleteNode(n.element, true);
                    } catch (error) {
                        log(`[WorkflowLoadService] 노드 제거 중 오류: ${error}`);
                    }
                }
            });
            return;
        }

        log('[WorkflowPage] 모든 노드 생성 완료');

        // 노드가 DOM에 완전히 렌더링되고 위치가 설정될 때까지 대기
        // (createNodeFromServerData에서 이미 각 노드가 DOM에 추가될 때까지 대기했으므로, 여기서는 짧게 대기)
        await new Promise((resolve) => {
            // 노드 생성이 완료되었으므로 짧은 대기 후 연결 복원 및 뷰포트 조정
            requestAnimationFrame(() => {
                this.restoreConnections(filteredConnections, nodeManager);

                // 뷰포트 조정 전에 한 번 더 대기 (노드 위치가 완전히 적용될 때까지)
                setTimeout(() => {
                    this.workflowPage.fitNodesToView();

                    // 뷰포트 조정 후 연결선 위치를 다시 한 번 업데이트
                    setTimeout(() => {
                        if (nodeManager && nodeManager.connectionManager && filteredConnections.length > 0) {
                            log('[WorkflowPage] 뷰포트 조정 후 연결선 위치 최종 업데이트');
                            nodeManager.connectionManager.updateAllConnections();
                        }
                        log('[WorkflowPage] ✅ 스크립트 데이터 로드 및 화면 그리기 완료');
                        resolve();
                    }, 150);
                }, 100);
            });
        });
    }

    /**
     * 서버 데이터로부터 노드 생성
     * 서버에서 받은 노드 데이터를 NodeManager 형식으로 변환하여 생성합니다.
     * @param {Object} nodeData - 서버에서 받은 노드 데이터
     * @param {NodeManager} nodeManager - 노드 관리자 인스턴스
     */
    async createNodeFromServerData(nodeData, nodeManager) {
        const originalX = nodeData.position?.x || 0;
        const originalY = nodeData.position?.y || 0;

        // API 응답 형식을 NodeManager 형식으로 변환
        // nodeData.data에서 메타데이터 필드 제거
        const nodeDataClean = { ...(nodeData.data || {}) };
        const metadataFields = ['id', 'x', 'y', 'createdAt', 'updatedAt'];
        metadataFields.forEach((field) => {
            delete nodeDataClean[field];
        });

        const nodeDataForManager = {
            id: nodeData.id,
            title: nodeData.data?.title || nodeData.id,
            type: nodeData.type,
            x: originalX,
            y: originalY,
            ...nodeDataClean, // 메타데이터가 제거된 data만 포함
            // 메타데이터를 별도 필드로 저장
            metadata: nodeData.metadata || {
                id: nodeData.id,
                x: originalX,
                y: originalY,
                createdAt: null,
                updatedAt: null
            }
        };

        // parameters 복원 (nodes_config.py에서 정의한 파라미터 동적 복원)
        if (nodeData.parameters && Object.keys(nodeData.parameters).length > 0) {
            if (nodeManager && nodeManager.nodeData) {
                if (!nodeManager.nodeData[nodeData.id]) {
                    nodeManager.nodeData[nodeData.id] = {};
                }

                const nodeType = nodeData.type;
                const registry = getNodeRegistry();
                const config = await registry.getConfig(nodeType);

                // nodes_config.py에서 정의한 파라미터 동적 복원
                if (config) {
                    // 상세 노드 타입이 있으면 상세 노드 타입의 파라미터 우선 사용
                    const detailNodeType = nodeData.action_node_type;
                    let parametersToRestore = null;

                    if (detailNodeType && config.detailTypes?.[detailNodeType]?.parameters) {
                        parametersToRestore = config.detailTypes[detailNodeType].parameters;
                    } else if (config.parameters) {
                        parametersToRestore = config.parameters;
                    }

                    // 파라미터 정의에 따라 parameters에서 값 복원
                    if (parametersToRestore) {
                        for (const [paramKey, paramConfig] of Object.entries(parametersToRestore)) {
                            if (nodeData.parameters[paramKey] !== undefined && nodeData.parameters[paramKey] !== null) {
                                nodeManager.nodeData[nodeData.id][paramKey] = nodeData.parameters[paramKey];
                                nodeDataForManager[paramKey] = nodeData.parameters[paramKey];
                            }
                        }
                    }
                }
            }
        }

        // description 복원
        if (nodeData.description) {
            if (nodeManager && nodeManager.nodeData) {
                if (!nodeManager.nodeData[nodeData.id]) {
                    nodeManager.nodeData[nodeData.id] = {};
                }
                nodeManager.nodeData[nodeData.id].description = nodeData.description;
                nodeDataForManager.description = nodeData.description;
            }
        }

        // 타입 및 메타데이터 저장
        if (nodeManager && nodeManager.nodeData && nodeManager.nodeData[nodeData.id]) {
            nodeManager.nodeData[nodeData.id].type = nodeData.type;
            // 메타데이터 저장
            if (nodeData.metadata) {
                nodeManager.nodeData[nodeData.id].metadata = nodeData.metadata;
            }
        }

        if (nodeManager) {
            // 노드 생성
            nodeManager.createNode(nodeDataForManager);

            // 노드가 DOM에 추가되고 위치가 설정될 때까지 대기 (최대 1초)
            await new Promise((resolve) => {
                let checkCount = 0;
                const maxChecks = TIMING_CONSTANTS.MAX_NODE_CHECK_ATTEMPTS;

                const checkNode = () => {
                    const nodeElement =
                        document.getElementById(nodeDataForManager.id) ||
                        document.querySelector(`[data-node-id="${nodeDataForManager.id}"]`);
                    if (nodeElement) {
                        // 노드가 DOM에 추가되었는지 확인
                        const hasPosition = nodeElement.style.left && nodeElement.style.top;
                        if (hasPosition) {
                            resolve();
                            return;
                        }
                    }

                    // 최대 체크 횟수에 도달하면 강제로 resolve (무한 대기 방지)
                    if (checkCount >= maxChecks) {
                        const logger = this.workflowPage.getLogger();
                        logger.log(`[WorkflowLoadService] 노드 ${nodeDataForManager.id} 위치 확인 타임아웃, 계속 진행`);
                        resolve();
                        return;
                    }

                    checkCount++;
                    requestAnimationFrame(checkNode);
                };
                requestAnimationFrame(checkNode);
            });

            // 프로세스 포커스 노드인 경우, 노드 생성 후 내용 업데이트
            if (nodeData.type === 'process-focus' && nodeManager.nodeData[nodeData.id]) {
                const processData = nodeManager.nodeData[nodeData.id];
                if (processData.process_name || processData.process_id) {
                    // 노드가 생성된 후 내용 업데이트
                    setTimeout(() => {
                        const nodeElement =
                            document.getElementById(nodeData.id) ||
                            document.querySelector(`[data-node-id="${nodeData.id}"]`);
                        if (nodeElement && nodeManager.generateNodeContent) {
                            // generateNodeContent는 전체 HTML(커넥터 포함)을 반환하므로 그대로 사용
                            const updatedContent = nodeManager.generateNodeContent({
                                ...nodeDataForManager,
                                ...processData
                            });

                            // 전체 innerHTML 업데이트
                            nodeElement.innerHTML = updatedContent;

                            // 이벤트 리스너 재설정
                            if (nodeManager.setupNodeEventListeners) {
                                nodeManager.setupNodeEventListeners(nodeElement);
                            }

                            // ConnectionManager에 노드 커넥터 다시 바인딩
                            if (nodeManager.registerNodeWithConnectionManager) {
                                nodeManager.registerNodeWithConnectionManager(nodeElement);
                            }

                            // 드래그 컨트롤러 다시 연결
                            if (nodeManager.dragController) {
                                nodeManager.dragController.attachNode(nodeElement);
                            }

                            // 노드 크기 조정 및 아래 연결점 위치 업데이트
                            if (nodeManager.adjustNodeSize) {
                                nodeManager.adjustNodeSize(nodeElement);
                            }
                            if (nodeManager.adjustBottomOutputPosition) {
                                nodeManager.adjustBottomOutputPosition(nodeElement);
                            }
                        }
                    }, TIMING_CONSTANTS.MEDIUM_DELAY);
                }
            }
        }
    }

    /**
     * 연결선 복원
     * 저장된 연결 정보를 화면에 다시 그립니다.
     * @param {Array} connections - 연결 정보 배열 [{from, to, outputType}, ...]
     * @param {NodeManager} nodeManager - 노드 관리자 인스턴스
     */
    restoreConnections(connections, nodeManager) {
        const logger = this.workflowPage.getLogger();
        const log = logger.log;

        log('[WorkflowPage] 연결선 복원 준비');
        log(`[WorkflowPage] connections.length: ${connections.length}`);

        if (connections.length > 0) {
            if (nodeManager && nodeManager.connectionManager) {
                log('[WorkflowPage] 연결선 복원 시작');

                const formattedConnections = connections.map((conn) => ({
                    from: conn.from,
                    to: conn.to,
                    outputType: conn.outputType || null // 조건 노드의 출력 타입 복원
                }));

                log('[WorkflowPage] 연결선 데이터:', formattedConnections);

                try {
                    nodeManager.connectionManager.setConnections(formattedConnections);
                    log('[WorkflowPage] ✅ setConnections 호출 완료');

                    setTimeout(() => {
                        log('[WorkflowPage] 연결선 위치 재계산 및 업데이트 시작');
                        try {
                            nodeManager.connectionManager.updateAllConnections();
                            log('[WorkflowPage] ✅ 연결선 복원 완료');
                        } catch (error) {
                            log(`[WorkflowPage] ❌ updateAllConnections 실패: ${error.message}`);
                            console.error(error);
                        }
                    }, TIMING_CONSTANTS.MEDIUM_DELAY);
                } catch (error) {
                    log(`[WorkflowPage] ❌ setConnections 실패: ${error.message}`);
                    console.error(error);
                }
            } else {
                log('[WorkflowPage] ⚠️ 연결선 매니저가 없습니다.');
            }
        } else {
            log('[WorkflowPage] ⚠️ 연결이 없어서 연결선을 그릴 수 없습니다.');
        }
    }

    /**
     * 프로세스 포커스 노드 복원 및 검증
     * 저장된 프로세스가 현재 프로세스 목록에 있는지 확인하고, 없으면 선택 안된 상태로 처리
     */
    async restoreProcessFocusNode(nodeData, nodeManager, nodeDataForManager) {
        const logger = this.workflowPage.getLogger();
        const log = logger.log;

        const params = nodeData.parameters || {};
        const savedProcessId = params.process_id;
        const savedHwnd = params.hwnd;
        const savedProcessName = params.process_name;
        const savedWindowTitle = params.window_title;

        // 프로세스 정보가 없으면 저장하지 않음
        if (!savedProcessId && !savedHwnd) {
            log(`[WorkflowPage] 프로세스 포커스 노드 ${nodeData.id}: 저장된 프로세스 정보 없음`);
            return;
        }

        try {
            // 현재 프로세스 목록 가져오기
            const apiBaseUrl = window.API_BASE_URL || 'http://localhost:8000';
            const response = await fetch(`${apiBaseUrl}/api/processes/list`);
            const responseData = await response.json();

            // 변경된 응답 형식: {success: true, message: "...", data: [...], count: N}
            const processes = responseData.data || responseData.processes || [];
            if (!responseData.success || processes.length === 0) {
                log('[WorkflowPage] 프로세스 목록 조회 실패, 프로세스 정보 저장 안 함');
                return;
            }

            // 저장된 프로세스가 현재 목록에 있는지 확인
            let foundProcess = null;
            let foundWindow = null;

            for (const process of processes) {
                // process_id로 매칭
                if (savedProcessId && process.process_id === savedProcessId) {
                    // hwnd로도 매칭 확인
                    if (savedHwnd) {
                        foundWindow = process.windows.find((w) => w.hwnd === savedHwnd);
                        if (foundWindow) {
                            foundProcess = process;
                            break;
                        }
                    } else {
                        // hwnd가 없으면 프로세스명과 창 제목으로 매칭
                        if (savedProcessName && savedWindowTitle) {
                            foundWindow = process.windows.find((w) => w.title === savedWindowTitle);
                            if (foundWindow) {
                                foundProcess = process;
                                break;
                            }
                        } else {
                            // 첫 번째 창 사용
                            if (process.windows && process.windows.length > 0) {
                                foundProcess = process;
                                foundWindow = process.windows[0];
                                break;
                            }
                        }
                    }
                }
            }

            if (foundProcess && foundWindow) {
                // 프로세스를 찾았으면 정보 저장
                nodeManager.nodeData[nodeData.id].process_id = foundProcess.process_id;
                nodeManager.nodeData[nodeData.id].hwnd = foundWindow.hwnd;
                nodeManager.nodeData[nodeData.id].process_name = foundProcess.process_name;
                nodeManager.nodeData[nodeData.id].window_title = foundWindow.title;

                nodeDataForManager.process_id = foundProcess.process_id;
                nodeDataForManager.hwnd = foundWindow.hwnd;
                nodeDataForManager.process_name = foundProcess.process_name;
                nodeDataForManager.window_title = foundWindow.title;

                log(
                    `[WorkflowPage] 프로세스 포커스 노드 ${nodeData.id}: 프로세스 복원 성공 - ${foundProcess.process_name} (${foundWindow.title})`
                );
            } else {
                // 프로세스를 찾지 못했으면 선택 안된 상태로 처리
                log(
                    `[WorkflowPage] 프로세스 포커스 노드 ${nodeData.id}: 저장된 프로세스를 찾을 수 없음 (${savedProcessName || savedProcessId}), 선택 안된 상태로 처리`
                );
                // 프로세스 정보는 저장하지 않음 (선택 안된 상태)
            }
        } catch (error) {
            log(`[WorkflowPage] 프로세스 목록 조회 중 오류: ${error.message}, 프로세스 정보 저장 안 함`);
        }
    }
}
