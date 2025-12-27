/**
 * 워크플로우 저장 서비스
 * 워크플로우 데이터를 서버에 저장하는 로직을 담당합니다.
 */

import { getNodeRegistry } from './node-registry.js';
import { t } from '../../../js/utils/i18n.js';
import { getSimpleNodeIdentifier } from '../utils/node-identifier.js';

export class WorkflowSaveService {
    constructor(workflowPage) {
        this.workflowPage = workflowPage;
    }

    /**
     * 워크플로우 저장
     * @param {Object} options - 저장 옵션
     * @param {boolean} options.useToast - Toast 알림 사용 여부
     * @param {boolean} options.showAlert - 팝업 알림 표시 여부 (기본값: true)
     */
    async save(options = {}) {
        const sidebarManager = this.workflowPage.getSidebarManager();
        const currentScript = sidebarManager ? sidebarManager.getCurrentScript() : null;
        const modalManager = this.workflowPage.getModalManager();

        // currentScript가 없거나 id가 없으면 에러 표시
        if (!currentScript || !currentScript.id) {
            this.showError(t('common.noScriptSelected'), options.useToast);
            return;
        }

        try {
            // nodeManager: 노드 관리자 인스턴스 (노드 및 연결 정보 가져오기용)
            const nodeManager = this.workflowPage.getNodeManager();
            // nodes: 모든 노드 목록 (NodeManager 형식)
            const nodes = nodeManager ? nodeManager.getAllNodes() : [];
            // connections: 모든 연결 정보 (NodeManager 형식)
            const connections = nodeManager ? nodeManager.getAllConnections() : [];

            // NodeManager 형식을 API 형식으로 변환
            const nodesForAPI = await this.prepareNodesForAPI(nodes, nodeManager);
            const connectionsForAPI = this.prepareConnectionsForAPI(connections);

            // 백엔드 API에 저장
            const nodeAPI = this.workflowPage.getNodeAPI();
            if (nodeAPI) {
                const logger = this.workflowPage.getLogger();
                logger.log('[WorkflowPage] 저장 요청 시작:', {
                    scriptId: currentScript.id,
                    nodeCount: nodes.length,
                    connectionCount: connections.length
                });

                const response = await nodeAPI.updateNodesBatch(currentScript.id, nodesForAPI, connectionsForAPI);

                logger.log('[WorkflowPage] 저장 완료 응답:', response);

                this.showSuccess(t('common.workflowSaved'), options.useToast, options.showAlert);
            } else {
                // API를 사용할 수 없는 경우 로컬 스토리지에 저장 (fallback)
                this.workflowPage.saveWorkflowToLocalStorage();
            }
        } catch (error) {
            console.error('워크플로우 저장 실패:', error);
            this.showError(`${t('common.saveError')}: ${error.message}`, options.useToast, options.showAlert);
        }
    }

    /**
     * 노드 데이터를 API 형식으로 변환
     */
    async prepareNodesForAPI(nodes, nodeManager) {
        const registry = getNodeRegistry();
        const allConfigs = await registry.getNodeConfigs();

        // 연결 정보 계산: 경계 노드부터 시작하여 연결 순서 계산
        const connections = nodeManager ? nodeManager.getAllConnections() : [];
        const connectionInfoMap = await this.calculateConnectionInfo(nodes, connections, nodeManager);

        return nodes.map((node) => {
            // parameters 추출 (nodes_config.py에서 정의한 파라미터 동적 추출)
            const parameters = {};
            if (nodeManager && nodeManager.nodeData && nodeManager.nodeData[node.id]) {
                const nodeData = nodeManager.nodeData[node.id];
                const nodeType = nodeData.type || node.type;
                const config = allConfigs[nodeType];

                // nodes_config.py에서 정의한 파라미터 추출
                if (config) {
                    // 상세 노드 타입이 있으면 상세 노드 타입의 파라미터 우선 사용
                    // detailNodeType: 상세 노드 타입 (예: "http-api-request", "process-focus")
                    const detailNodeType = nodeData.action_node_type;
                    // parametersToExtract: 추출할 파라미터 정의 (상세 노드 타입 우선, 없으면 노드 레벨 파라미터)
                    let parametersToExtract = null;

                    // 상세 노드 타입의 파라미터가 있으면 우선 사용
                    if (detailNodeType && config.detailTypes?.[detailNodeType]?.parameters) {
                        parametersToExtract = config.detailTypes[detailNodeType].parameters;
                    } else if (config.parameters) {
                        // 상세 노드 타입 파라미터가 없으면 노드 레벨 파라미터 사용
                        parametersToExtract = config.parameters;
                    }

                    // 파라미터 정의에 따라 nodeData에서 값 추출
                    if (parametersToExtract) {
                        for (const [paramKey, paramConfig] of Object.entries(parametersToExtract)) {
                            // boolean 타입은 false도 유효한 값이므로 별도 처리
                            if (paramConfig.type === 'boolean') {
                                // boolean은 undefined, null이 아닌 경우 모두 저장 (false도 유효)
                                if (nodeData[paramKey] !== undefined && nodeData[paramKey] !== null) {
                                    parameters[paramKey] = Boolean(nodeData[paramKey]);
                                } else if (paramConfig.default !== undefined) {
                                    parameters[paramKey] = Boolean(paramConfig.default);
                                }
                            } else {
                                // 다른 타입은 기존 로직 사용
                                if (
                                    nodeData[paramKey] !== undefined &&
                                    nodeData[paramKey] !== null &&
                                    nodeData[paramKey] !== ''
                                ) {
                                    parameters[paramKey] = nodeData[paramKey];
                                }
                                // 값이 없고 기본값이 있으면 기본값 사용
                                else if (paramConfig.default !== undefined && paramConfig.default !== null) {
                                    parameters[paramKey] = paramConfig.default;
                                }
                            }
                        }
                    }

                    // 필수 파라미터 검증 (기본값 적용 후)
                    // parametersToExtract가 있으면 필수 파라미터 검증 수행
                    if (parametersToExtract) {
                        // missingRequiredParams: 누락된 필수 파라미터 목록
                        const missingRequiredParams = [];
                        // 각 파라미터 정의를 순회하며 필수 파라미터 확인
                        for (const [paramKey, paramConfig] of Object.entries(parametersToExtract)) {
                            // required가 true인 경우만 검증
                            if (paramConfig.required === true) {
                                // 기본값이 있으면 필수 파라미터 검증 통과 (기본값이 있으면 필수 조건 충족)
                                if (paramConfig.default !== undefined && paramConfig.default !== null) {
                                    continue; // 다음 파라미터로 넘어감
                                }
                                // 기본값이 없고 값도 없으면 에러 (필수 파라미터 누락)
                                if (
                                    parameters[paramKey] === undefined ||
                                    parameters[paramKey] === null ||
                                    parameters[paramKey] === ''
                                ) {
                                    missingRequiredParams.push(paramKey);
                                }
                            }
                        }
                        // 누락된 필수 파라미터가 있으면 에러 발생
                        if (missingRequiredParams.length > 0) {
                            throw new Error(
                                `노드 '${node.id}' (${nodeType})에 필수 파라미터가 없습니다: ${missingRequiredParams.join(', ')}`
                            );
                        }
                    }
                }
            }

            // description 추출
            let description = null;
            if (nodeManager && nodeManager.nodeData && nodeManager.nodeData[node.id]) {
                description = nodeManager.nodeData[node.id].description || null;
            }

            // data 필드에 파라미터도 포함 (하위 호환성 및 UI 표시용)
            const nodeDataForAPI = {
                title: node.title,
                ...node
            };

            // 파라미터를 data에도 포함 (UI에서 표시하기 위해)
            Object.assign(nodeDataForAPI, parameters);

            // 연결 정보 가져오기
            const connectionInfo = connectionInfoMap.get(node.id) || {
                is_connected: false,
                connection_sequence: null,
                node_identifier: null
            };

            return {
                id: node.id,
                type: node.type,
                position: {
                    x: node.x,
                    y: node.y
                },
                data: nodeDataForAPI,
                parameters: parameters,
                description: description,
                // 연결 정보 추가
                is_connected: connectionInfo.is_connected,
                connection_sequence: connectionInfo.connection_sequence,
                node_identifier: connectionInfo.node_identifier
            };
        });
    }

    /**
     * 연결 정보 계산: 경계 노드부터 시작하여 연결 순서 계산
     */
    async calculateConnectionInfo(nodes, connections, nodeManager) {
        const connectionInfoMap = new Map();

        // 노드 ID로 노드 찾기
        const nodeById = new Map();
        nodes.forEach((node) => {
            nodeById.set(node.id, node);
        });

        // 경계 노드 찾기
        const { isBoundaryNodeSync } = await import('../constants/node-types.js');
        let boundaryNodeId = null;
        for (const node of nodes) {
            const nodeType = node.type || nodeManager?.nodeData?.[node.id]?.type;
            if (nodeType && isBoundaryNodeSync(nodeType)) {
                boundaryNodeId = node.id;
                break;
            }
        }

        // 연결 맵 생성: from -> [to1, to2, ...]
        const nextMap = new Map();
        connections.forEach((conn) => {
            if (!nextMap.has(conn.from)) {
                nextMap.set(conn.from, []);
            }
            nextMap.get(conn.from).push(conn.to);
        });

        // 경계 노드부터 BFS로 순서 계산
        const ordered = [];
        const visited = new Set();
        const addedToOrdered = new Set();

        if (boundaryNodeId && nodeById.has(boundaryNodeId)) {
            ordered.push(nodeById.get(boundaryNodeId));
            addedToOrdered.add(boundaryNodeId);
        }

        const queue = boundaryNodeId ? [boundaryNodeId] : [];

        while (queue.length > 0) {
            const cur = queue.shift();

            if (visited.has(cur)) {
                continue;
            }

            visited.add(cur);

            if (nextMap.has(cur)) {
                const nextNodes = nextMap.get(cur);
                nextNodes.forEach((nextId) => {
                    if (nodeById.has(nextId) && !addedToOrdered.has(nextId)) {
                        ordered.push(nodeById.get(nextId));
                        addedToOrdered.add(nextId);
                        queue.push(nextId);
                    }
                });
            }
        }

        // 연결되지 않은 노드들도 추가 (순서는 null로 설정)
        nodes.forEach((node) => {
            if (!addedToOrdered.has(node.id)) {
                ordered.push(node);
            }
        });

        // 각 노드의 연결 정보 계산
        ordered.forEach((node, index) => {
            const nodeId = node.id;
            const hasInputConnection = connections.some((conn) => conn.to === nodeId);
            const isBoundary = index === 0 && boundaryNodeId === nodeId;

            // 노드 식별자 생성
            const nodeType = node.type || nodeManager?.nodeData?.[nodeId]?.type;
            const nodeData = nodeManager?.nodeData?.[nodeId] || node.data || {};
            const nodeName = nodeData?.title || nodeData?.name || null;
            const nodeIdentifier = getSimpleNodeIdentifier(
                { id: nodeId, type: nodeType, title: nodeName },
                isBoundary || hasInputConnection ? index : null,
                ordered.length
            );

            connectionInfoMap.set(nodeId, {
                is_connected: hasInputConnection || isBoundary,
                connection_sequence: isBoundary || hasInputConnection ? index : null,
                node_identifier: nodeIdentifier
            });
        });

        return connectionInfoMap;
    }

    /**
     * 연결 데이터를 API 형식으로 변환
     */
    prepareConnectionsForAPI(connections) {
        return connections.map((conn) => ({
            from: conn.from || conn.fromNodeId,
            to: conn.to || conn.toNodeId,
            outputType: conn.outputType || null // 조건 노드의 경우 'true' 또는 'false'
        }));
    }

    /**
     * 성공 메시지 표시
     */
    async showSuccess(message, useToast, showAlert = true) {
        if (useToast) {
            // 토스트 메시지 사용 (Ctrl+S, 자동 저장 등)
            const toastManager = this.workflowPage.getToastManager();
            if (toastManager) {
                toastManager.success(message);
            }
        } else if (showAlert) {
            // 모달 팝업 사용 (저장 버튼 클릭 시, showAlert가 true인 경우만)
            const modalManager = this.workflowPage.getModalManager();
            if (modalManager) {
                await modalManager.showCenterAlert(t('common.saveComplete'), message);
            }
        }
    }

    /**
     * 에러 메시지 표시
     */
    async showError(message, useToast, showAlert = true) {
        // useToast: 토스트 메시지 사용 여부 (Ctrl+S, 자동 저장 등)
        if (useToast) {
            // 토스트 메시지 사용 (Ctrl+S, 자동 저장 등)
            const toastManager = this.workflowPage.getToastManager();
            // toastManager가 있으면 에러 메시지 표시
            if (toastManager) {
                toastManager.error(message);
            }
        } else if (showAlert) {
            // 모달 팝업 사용 (저장 버튼 클릭 시, showAlert가 true인 경우만)
            // showAlert: 팝업 알림 표시 여부 (기본값: true)
            const modalManager = this.workflowPage.getModalManager();
            // modalManager가 있으면 중앙 알림 표시
            if (modalManager) {
                await modalManager.showCenterAlert(t('common.saveFailed'), message);
            }
        }
    }
}
