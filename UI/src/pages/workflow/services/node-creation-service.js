/**
 * 노드 생성 서비스
 * 노드 생성 및 초기 설정을 담당합니다.
 */

import { NODE_TYPES } from '../constants/node-types.js';

export class NodeCreationService {
    constructor(workflowPage) {
        this.workflowPage = workflowPage;
    }

    /**
     * 노드 데이터로부터 노드 생성
     * @param {Object} nodeData - 노드 데이터
     */
    createFromData(nodeData) {
        const nodeManager = this.workflowPage.getNodeManager();
        if (!nodeManager) {
            console.error('NodeManager를 찾을 수 없습니다.');
            return null;
        }

        const createdNode = nodeManager.createNode(nodeData);
        const nodeType = nodeData.type;

        // 이미지 터치 노드인 경우 이미지 개수 확인 및 표시
        if (nodeType === NODE_TYPES.IMAGE_TOUCH && nodeData.folder_path) {
            this.updateImageCountForNode(createdNode, nodeData, nodeManager);
        }

        return createdNode;
    }

    /**
     * 이미지 개수 업데이트
     */
    async updateImageCountForNode(nodeElement, nodeData, nodeManager) {
        try {
            const response = await fetch(
                `${window.API_BASE_URL || 'http://localhost:8000'}/api/images/list?folder_path=${encodeURIComponent(nodeData.folder_path)}`
            );
            const result = await response.json();

            // 변경된 응답 형식: {success: true, message: "...", data: [...], count: N}
            if (result.success && nodeElement) {
                const count = result.count || result.data?.length || 0;
                nodeData.image_count = count;

                // NodeManager의 노드 데이터에도 이미지 개수 저장
                if (nodeManager.nodeData && nodeManager.nodeData[nodeData.id]) {
                    nodeManager.nodeData[nodeData.id].image_count = count;
                }

                const infoElement = nodeElement.querySelector('.node-info');
                if (infoElement) {
                    infoElement.textContent = `${count}개 이미지`;
                } else if (count > 0) {
                    const contentElement = nodeElement.querySelector('.node-content');
                    if (contentElement) {
                        const info = document.createElement('div');
                        info.className = 'node-info';
                        info.textContent = `${count}개 이미지`;
                        contentElement.appendChild(info);
                    }
                }
            }
        } catch (e) {
            // 에러 무시 (선택적 기능)
        }
    }

    /**
     * 기본 경계 노드 생성
     */
    async createDefaultBoundaryNodes() {
        const nodeManager = this.workflowPage.getNodeManager();
        if (!nodeManager) {
            console.error('NodeManager를 찾을 수 없습니다.');
            return;
        }

        // 이미 start/end 노드가 있는지 확인
        // nodeElements: 모든 노드 요소 배열 (노드 요소만 추출)
        const nodeElements = nodeManager.nodes ? nodeManager.nodes.map((n) => n.element) : [];
        // nodeData: 노드 데이터 딕셔너리 (노드 타입 확인용)
        const nodeData = nodeManager.nodeData || {};

        // hasBoundaryNode: 경계 노드가 이미 존재하는지 여부
        // 여러 방법으로 경계 노드 확인
        const { isBoundaryNodeSync } = await import('../constants/node-types.js');
        const hasBoundaryNode = nodeElements.some((nodeElement) => {
            // nodeId: 노드 ID (id 속성 또는 dataset.nodeId에서 가져옴)
            const nodeId = nodeElement.id || nodeElement.dataset?.nodeId;
            // 노드 타입 가져오기
            const nodeType = nodeData[nodeId]?.type || this.workflowPage.getNodeType(nodeElement);
            // 경계 노드 확인
            return nodeType && isBoundaryNodeSync(nodeType);
        });

        const logger = this.workflowPage.getLogger();
        const log = logger.log;
        log(`[NodeCreationService] 기본 경계 노드 생성 시도 - 경계 노드 존재: ${hasBoundaryNode}`);

        // baseX, baseY: 기본 노드 위치 (좌표)
        const baseX = 0;
        const baseY = 0;

        // boundaryNodes: 생성할 경계 노드 목록 (start/end 노드)
        const boundaryNodes = [];

        // 경계 노드가 없을 때만 추가
        // hasBoundaryNode가 false이면 경계 노드 생성
        if (!hasBoundaryNode) {
            // 모든 경계 노드 타입 가져오기
            const registry = await import('../services/node-registry.js').then((m) => m.getNodeRegistry());
            const allConfigs = await registry.getAllConfigs();

            // 경계 노드 타입 찾기 (시작 노드 우선)
            const boundaryNodeTypes = Object.keys(allConfigs).filter((type) => {
                const config = allConfigs[type];
                return config?.isBoundary === true;
            });

            // 시작 노드 타입 찾기 (일반적으로 'start')
            const startNodeType = boundaryNodeTypes.find((type) => type === 'start') || boundaryNodeTypes[0];

            if (startNodeType) {
                const startConfig = allConfigs[startNodeType];
                boundaryNodes.push({
                    id: startNodeType === 'start' ? 'start' : `${startNodeType}_${Date.now()}`,
                    type: startNodeType,
                    title: startConfig?.title || startConfig?.label || '시작',
                    x: baseX - 200, // 시작 노드는 왼쪽에 배치
                    y: baseY
                });
            }
        }

        // boundaryNodes가 비어있으면 생성할 노드가 없으므로 종료
        if (boundaryNodes.length === 0) {
            log('[NodeCreationService] 이미 경계 노드가 존재하여 기본 경계 노드를 생성하지 않습니다.');
            return;
        }

        log(`[NodeCreationService] ${boundaryNodes.length}개의 경계 노드 생성 중...`);

        boundaryNodes.forEach((nodeData) => {
            try {
                nodeManager.createNode(nodeData);
                log(`[NodeCreationService] 경계 노드 생성 완료: ${nodeData.id}`);
            } catch (error) {
                console.error('노드 생성 실패:', error);
            }
        });

        // 연결선 매니저가 초기화되면 위치 업데이트
        setTimeout(() => {
            if (nodeManager && nodeManager.connectionManager) {
                nodeManager.connectionManager.updateAllConnections();
            }

            // 기본 노드들이 화면에 보이도록 뷰포트 조정
            this.workflowPage.fitNodesToView();
        }, 300);
    }
}
