/**
 * 워크플로우 실행 서비스
 * 워크플로우 실행 및 애니메이션을 담당합니다.
 */

import { getResultModalManagerInstance } from '../../../js/utils/result-modal.js';
import { getNodeRegistry } from './node-registry.js';
import { getDashboardManagerInstance } from '../dashboard.js';
import { captureAndSaveScreenshot } from '../../../js/api/screenshot-api.js';
import { t } from '../../../js/utils/i18n.js';
import { getLogNodeIdentifier, getSimpleNodeIdentifier } from '../utils/node-identifier.js';

export class WorkflowExecutionService {
    constructor(workflowPage) {
        this.workflowPage = workflowPage;
        this.isCancelled = false; // 실행 취소 플래그
        this.isRunningAllScripts = false; // 전체 스크립트 실행 중인지 여부
        this.executionStartTime = null; // 실행 시작 시간
        this.allScriptsExecutionStartTime = null; // 전체 실행 시작 시간 (전체 실행 시 모든 스크립트가 공유)
        this.scriptExecutionOrder = null; // 전체 실행 시 스크립트 실행 순서 (1부터 시작)
    }

    /**
     * 실행 취소
     */
    cancel() {
        this.isCancelled = true;
        const logger = this.workflowPage.getLogger();
        logger.log('[WorkflowExecutionService] 실행 취소 요청됨');
    }

    /**
     * 취소 플래그 초기화
     */
    resetCancelFlag() {
        this.isCancelled = false;
    }

    /**
     * 워크플로우 실행
     * 시작 노드부터 연결된 순서대로 노드를 하나씩 순차적으로 실행합니다.
     * 각 노드마다 클라이언트에서 먼저 실행 UI를 표시한 후 서버에 API 요청을 보냅니다.
     */
    async execute() {
        const toastManager = this.workflowPage.getToastManager();
        const modalManager = this.workflowPage.getModalManager();
        const nodes = document.querySelectorAll('.workflow-node');

        // 실행 시작 시간 기록
        this.executionStartTime = Date.now();

        // 노드가 없으면 실행 불가
        if (nodes.length === 0) {
            // toastManager가 있으면 경고 메시지 표시
            if (toastManager) {
                toastManager.warning('실행할 노드가 없습니다.');
            }
            return;
        }

        // 노드 데이터를 FastAPI 형식으로 변환
        // prepareWorkflowData: DOM 노드들을 서버 API 형식으로 변환
        const workflowData = await this.prepareWorkflowData(nodes);

        // 실행할 노드가 없으면 종료
        // workflowData.nodes가 없거나 비어있으면 실행 불가
        if (!workflowData.nodes || workflowData.nodes.length === 0) {
            // toastManager가 있으면 경고 메시지 표시
            if (toastManager) {
                toastManager.warning('실행할 노드가 없습니다. 시작 노드에서 연결된 노드가 있는지 확인하세요.');
            }
            return;
        }

        // 엑셀 관련 노드 검증: 엑셀 열기 노드가 필요한 노드들이 이전 노드 체인에 excel-open이 있는지 확인
        const excelValidationError = await this.validateExcelNodes(workflowData.nodes);
        if (excelValidationError) {
            // 검증 실패 시 에러 메시지 표시하고 실행 중단
            if (toastManager) {
                toastManager.error(excelValidationError.message);
            }
            // 노드에 에러 표시
            if (excelValidationError.nodeId) {
                const errorNode = document.getElementById(excelValidationError.nodeId);
                if (errorNode) {
                    this.showNodeError(errorNode);
                }
            }
            // 실행 중단
            this.isExecuting = false;
            return;
        }

        // 전체 노드 개수 계산 (시작 노드 포함)
        const totalNodesCount = nodes.length; // 화면의 모든 노드 개수 (시작 노드 포함)

        // 실행 중 플래그 설정 (중복 실행 방지)
        // isExecuting: 현재 실행 중인지 여부 (중복 실행 방지용)
        if (this.isExecuting) {
            // 실행 중인 경우 취소 처리
            // toastManager가 있으면 취소 메시지 표시
            if (toastManager) {
                toastManager.info('실행을 취소합니다...');
            }
            // 실행 취소 요청
            this.cancel();
            return;
        }
        // 실행 시작 플래그 설정
        this.isExecuting = true;
        // 취소 플래그 초기화 (새 실행 시작 시 취소 상태 해제)
        this.isCancelled = false;
        // 마지막 실행 ID 저장 (로그 확인용, 나중에 업데이트됨)
        this.lastExecutionId = null;

        // 전체 노드 개수 계산 (start 포함)
        // prepareWorkflowData에서 start를 제외하므로, 실제 화면의 모든 노드 개수를 계산
        const allNodes = document.querySelectorAll('.workflow-node');

        // 조건 노드의 분기 경로 중 실행되지 않은 경로 노드들을 제외한 실제 실행 가능한 노드 수 계산
        // 조건 노드에서 분기가 일어나면 한 경로만 실행되므로, 실행 안 된 경로는 카운팅하지 않음
        const executedNodeIds = new Set(); // 실행 대상 노드 ID
        workflowData.nodes.forEach((node) => {
            executedNodeIds.add(node.id);
        });

        // 조건 노드의 분기 경로 중 실행 안 된 경로 노드 찾기
        const conditionBranchNodes = new Set(); // 조건 노드의 실행 안 된 분기 경로 노드 ID
        const nodeManager = this.workflowPage.getNodeManager();
        const connections =
            nodeManager && nodeManager.connectionManager ? nodeManager.connectionManager.getConnections() : [];

        // 모든 노드에서 조건 노드 찾기
        allNodes.forEach((node) => {
            const nodeId = node.id || node.dataset.nodeId;
            const nodeType = this.workflowPage.getNodeType(node);

            if (nodeType === 'condition') {
                // 조건 노드에서 나가는 모든 연결 찾기
                const branchConnections = connections.filter((c) => c.from === nodeId);
                branchConnections.forEach((conn) => {
                    // 실행 대상에 포함되지 않은 분기 경로 노드
                    if (!executedNodeIds.has(conn.to)) {
                        conditionBranchNodes.add(conn.to);
                    }
                });
            }
        });

        // 전체 노드 수에서 조건 노드의 실행 안 된 분기 경로 노드만 제외
        // 조건 분기 노드는 제외하고 카운팅 (실제로 실행되지 않는 노드는 제외)
        // totalNodeCount: 실제 실행될 노드 개수 (조건 분기 제외)
        const totalNodeCount = allNodes.length - conditionBranchNodes.size;

        // 디버깅: 노드 카운팅 정보 로깅
        const logger = this.workflowPage.getLogger();
        logger.log('[WorkflowExecutionService] 노드 카운팅 초기화:', {
            전체노드수: allNodes.length,
            조건분기제외: conditionBranchNodes.size,
            최종노드수: totalNodeCount,
            실행대상노드: executedNodeIds.size,
            조건분기노드목록: Array.from(conditionBranchNodes)
        });

        // 실행 통계 변수 초기화
        // successCount: 성공한 노드 개수
        let successCount = 0;
        // failCount: 실패한 노드 개수
        let failCount = 0;
        // cancelledCount: 취소된 노드 개수
        let cancelledCount = 0;
        // currentNodeIndex: 현재 실행 중인 노드 인덱스 추적 (진행률 표시용)
        let currentNodeIndex = -1;

        // 경계 노드는 항상 성공으로 카운팅 (실행은 하지만 성공으로 간주)
        // 경계 노드가 실행 목록에 포함되어 있으면 카운팅
        const { isBoundaryNodeSync } = await import('../constants/node-types.js');
        if (
            workflowData.nodes.some((node) => {
                const nodeType = node.type || (node.id === 'start' ? 'start' : null);
                return nodeType && isBoundaryNodeSync(nodeType);
            })
        ) {
            successCount = 1;
        }

        // 노드 실행 결과 수집 (실행 결과 모달 표시용)
        const nodeResults = [];

        // 이전 노드의 실행 결과를 저장 (다음 노드 실행 시 전달)
        let previousNodeResult = null;

        try {
            // 노드를 순차적으로 실행
            for (let i = 0; i < workflowData.nodes.length; i++) {
                currentNodeIndex = i; // 현재 노드 인덱스 업데이트
                // 취소 플래그 체크
                if (this.isCancelled) {
                    const logger = this.workflowPage.getLogger();
                    logger.log('[WorkflowExecutionService] 실행이 취소되었습니다.');
                    // 남은 노드 개수를 중단 개수로 계산
                    cancelledCount = totalNodeCount - successCount - failCount;
                    // 전체 스크립트 실행 중이면 토스트만 표시
                    if (this.isRunningAllScripts) {
                        if (toastManager) {
                            toastManager.warning(
                                `실행 취소 (성공 노드: ${successCount}개, 실패 노드: ${failCount}개, 중단 노드: ${cancelledCount}개)`
                            );
                        }
                    } else {
                        // 실행 취소 시 남은 노드들을 중단으로 표시
                        // 남은 노드들을 순회하며 중단 상태로 표시
                        for (let j = i + 1; j < workflowData.nodes.length; j++) {
                            // remainingNode: 실행되지 않은 남은 노드
                            const remainingNode = workflowData.nodes[j];
                            // remainingNodeTitle: 노드 제목 (data.title 또는 type 또는 id)
                            const remainingNodeTitle =
                                remainingNode.data?.title || remainingNode.type || remainingNode.id;
                            // nodeResults에 중단 상태로 추가
                            nodeResults.push({
                                name: remainingNodeTitle,
                                status: 'cancelled',
                                message: t('common.cancelledDueToCancellation')
                            });
                        }

                        // modalManager가 있으면 실행 결과 모달 표시
                        if (modalManager) {
                            const resultModalManager = getResultModalManagerInstance();
                            resultModalManager.showExecutionResult(t('common.executionCancelled'), {
                                successCount,
                                failCount,
                                cancelledCount,
                                nodes: nodeResults,
                                summaryLabel: t('common.nodes')
                            });
                        } else if (toastManager) {
                            // modalManager가 없으면 toastManager로 경고 메시지 표시
                            toastManager.warning(t('common.executionCancelledMessage'));
                        }
                    }
                    break;
                }
                const nodeData = workflowData.nodes[i];
                const nodeElement =
                    document.getElementById(nodeData.id) || document.querySelector(`[data-node-id="${nodeData.id}"]`);

                if (!nodeElement) {
                    const nodeIdentifier = getSimpleNodeIdentifier(nodeData, i + 1, totalNodesCount);
                    console.warn(`[WorkflowExecutionService] 노드 요소를 찾을 수 없습니다: ${nodeIdentifier}`);
                    continue;
                }

                // 1. 클라이언트에서 먼저 실행 UI 표시 (깜빡깜빡 애니메이션)
                this.showNodeExecuting(nodeElement);

                // 2. 서버에 단일 노드 실행 요청
                try {
                    const apiBaseUrl = window.API_BASE_URL || 'http://localhost:8000';
                    const response = await fetch(`${apiBaseUrl}/api/execute-nodes`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            nodes: [nodeData],
                            execution_mode: 'sequential',
                            total_nodes: totalNodesCount, // 전체 노드 개수 (시작 노드 포함)
                            current_node_index: i, // 현재 노드 순번 (0부터 시작)
                            previous_node_result: previousNodeResult // 이전 노드의 실행 결과
                        })
                    });

                    const result = await response.json();

                    // execution_id 저장 (로그 확인용)
                    if (result.data?.execution_id) {
                        this.lastExecutionId = result.data.execution_id;
                    }

                    // 3. 실행 완료 UI 표시
                    const nodeResult = result.data?.results?.[0];

                    // 노드 실행 완료 후 스크린샷 캡처 (비동기, 백그라운드 실행)
                    // 모든 노드에 대해 스크린샷 캡처 (실패한 노드도 포함)
                    // 스크립트 이름과 노드 이름 가져오기
                    const currentScript = this.workflowPage?.getCurrentScript();
                    const scriptName = currentScript?.name || 'Unknown';
                    const nodeName = nodeData.data?.title || nodeData.type || nodeData.id;
                    const isRunningAllScripts = this.isRunningAllScripts || false;
                    // 실행 시작 시간을 ISO 형식으로 변환 (날짜+시간 폴더 생성용)
                    // 전체 실행인 경우 전체 실행 시작 시간을 우선 사용, 없으면 현재 스크립트 실행 시작 시간 사용
                    const executionStartTime =
                        this.isRunningAllScripts && this.allScriptsExecutionStartTime
                            ? this.allScriptsExecutionStartTime
                            : this.executionStartTime
                              ? new Date(this.executionStartTime).toISOString()
                              : new Date().toISOString();
                    // 전체 실행 시 스크립트 실행 순서 전달
                    const scriptExecutionOrder = this.isRunningAllScripts ? this.scriptExecutionOrder : null;

                    // 스크린샷 캡처는 비동기로 실행하여 노드 실행 흐름을 차단하지 않음
                    captureAndSaveScreenshot(
                        nodeData.id,
                        nodeData.type,
                        scriptName,
                        nodeName,
                        isRunningAllScripts,
                        executionStartTime,
                        scriptExecutionOrder
                    ).catch((error) => {
                        const logger = this.workflowPage.getLogger();
                        logger.warn('[WorkflowExecutionService] 스크린샷 캡처 실패 (무시):', error);
                    });

                    // 노드 실행 결과를 DOM에 저장 (새로운 표준 형식: {action, status, output: {...}})
                    if (nodeResult) {
                        // nodeManager에 실행 결과 저장
                        const nodeManager = this.workflowPage.getNodeManager();
                        if (nodeManager && nodeManager.nodeData) {
                            const nodeId = nodeData.id;
                            if (!nodeManager.nodeData[nodeId]) {
                                nodeManager.nodeData[nodeId] = {};
                            }
                            // 실행 결과 저장 (표준 형식: {action, status, output: {...}})
                            nodeManager.nodeData[nodeId].result = nodeResult;
                            // output 필드가 dict인지 확인하고 저장
                            if (nodeResult.output && typeof nodeResult.output === 'object') {
                                nodeManager.nodeData[nodeId].output = nodeResult.output;
                            }
                        }

                        // condition 노드인 경우 결과에 따라 다음 노드 동적으로 선택
                        if (
                            nodeData.type === 'condition' &&
                            nodeResult &&
                            nodeResult.output &&
                            typeof nodeResult.output.result === 'boolean'
                        ) {
                            const conditionResult = nodeResult.output.result;
                            const logger = this.workflowPage.getLogger();
                            const nodeIdentifier = getSimpleNodeIdentifier(nodeData, i + 1, totalNodesCount);
                            logger.log(
                                `[WorkflowExecutionService] Condition 노드 결과: ${nodeIdentifier} → ${conditionResult ? 'TRUE' : 'FALSE'}`
                            );

                            // condition 노드의 연결 정보 가져오기
                            const connectionManager = nodeManager?.connectionManager;
                            if (connectionManager) {
                                const connections = connectionManager.getConnections();
                                const conditionConnections = connections.filter((c) => c.from === nodeData.id);

                                // 실행되지 않은 경로의 노드들을 workflowData.nodes에서 제거
                                const outputTypeToKeep = conditionResult ? 'true' : 'false';
                                const outputTypeToRemove = conditionResult ? 'false' : 'true';

                                // 제거할 노드 ID 찾기 (실행되지 않은 경로)
                                const nodesToRemove = new Set();
                                conditionConnections.forEach((conn) => {
                                    if (conn.outputType === outputTypeToRemove) {
                                        nodesToRemove.add(conn.to);
                                        // 재귀적으로 해당 경로의 모든 하위 노드도 제거
                                        this._collectNodesToRemove(conn.to, connections, nodesToRemove, nodeData.id);
                                    }
                                });

                                // workflowData.nodes에서 제거할 노드들 필터링
                                if (nodesToRemove.size > 0) {
                                    logger.log(
                                        `[WorkflowExecutionService] Condition 결과에 따라 제거할 노드: ${Array.from(nodesToRemove).join(', ')}`
                                    );
                                    workflowData.nodes = workflowData.nodes.filter(
                                        (node) => !nodesToRemove.has(node.id)
                                    );
                                }
                            }
                        }

                        // repeat 노드인 경우 아래 연결된 노드들을 서버로 전송하여 반복 실행
                        if (
                            nodeData.type === 'repeat' &&
                            nodeResult.output &&
                            typeof nodeResult.output.repeat_count === 'number'
                        ) {
                            const repeatCount = nodeResult.output.repeat_count;
                            const logger = this.workflowPage.getLogger();
                            const nodeIdentifier = getSimpleNodeIdentifier(nodeData, i + 1, totalNodesCount);
                            logger.log(
                                `[WorkflowExecutionService] Repeat 노드 실행: ${nodeIdentifier} - 반복 횟수: ${repeatCount}`
                            );

                            // 반복 노드의 연결 정보 가져오기
                            const connectionManager = nodeManager?.connectionManager;
                            if (connectionManager) {
                                const connections = connectionManager.getConnections();

                                // 아래 연결점(bottom-output)에 연결된 노드들 찾기
                                const bottomConnections = connections.filter(
                                    (c) => c.from === nodeData.id && c.outputType === 'bottom'
                                );

                                if (bottomConnections.length > 0) {
                                    // 아래 연결된 첫 번째 노드 찾기 (반복 연결점에는 노드 하나만 연결됨)
                                    const bottomNodeId = bottomConnections[0].to;

                                    // 반복 연결점에 연결된 노드부터 시작해서 출력 연결을 따라가며 체인 구성
                                    // 끝 노드의 출력이 아무것도 연결되지 않으면 거기서 반복 블록 종료
                                    const nodesToRepeat = [];
                                    const visited = new Set(); // 순환 방지
                                    let currentNodeId = bottomNodeId;

                                    while (currentNodeId && !visited.has(currentNodeId)) {
                                        visited.add(currentNodeId);

                                        // 현재 노드를 workflowData에서 찾기
                                        const currentNode = workflowData.nodes.find((n) => n.id === currentNodeId);
                                        if (!currentNode) {
                                            break;
                                        }

                                        nodesToRepeat.push(currentNode);

                                        // 현재 노드의 출력 연결 찾기 (일반 출력만, 조건 노드의 true/false는 제외)
                                        // 반복 노드로 돌아가는 연결은 제외 (순환 방지)
                                        const nextConnections = connections.filter(
                                            (c) =>
                                                c.from === currentNodeId &&
                                                (!c.outputType || c.outputType === 'output') &&
                                                c.to !== nodeData.id // 반복 노드로 돌아가는 연결 제외
                                        );

                                        if (nextConnections.length > 0) {
                                            // 첫 번째 출력 연결을 따라감
                                            currentNodeId = nextConnections[0].to;
                                        } else {
                                            // 더 이상 출력 연결이 없으면 반복 블록의 끝
                                            break;
                                        }
                                    }

                                    if (nodesToRepeat.length > 0) {
                                        logger.log(
                                            `[WorkflowExecutionService] 반복할 노드 체인: ${nodesToRepeat.map((n) => n.id).join(' → ')}`
                                        );

                                        // 반복 노드 실행 UI 표시
                                        const repeatNodeElement =
                                            document.getElementById(nodeData.id) ||
                                            document.querySelector(`[data-node-id="${nodeData.id}"]`);

                                        // 각 반복마다 서버로 요청을 보내서 실시간 UI 업데이트
                                        const apiBaseUrl = window.API_BASE_URL || 'http://localhost:8001';
                                        const allIterationResults = [];

                                        try {
                                            // 반복 연결점에 연결된 노드들에 반복 정보 메타데이터 추가
                                            const nodesWithRepeatInfo = nodesToRepeat.map((node, index) => {
                                                const nodeCopy = { ...node };
                                                // 반복 정보 메타데이터 추가
                                                nodeCopy.repeat_info = {
                                                    repeat_count: repeatCount,
                                                    is_repeat_start: index === 0,
                                                    is_repeat_end: index === nodesToRepeat.length - 1,
                                                    node_index_in_repeat: index,
                                                    total_nodes_in_repeat: nodesToRepeat.length
                                                };
                                                return nodeCopy;
                                            });

                                            // 각 반복마다 실행
                                            for (let iteration = 0; iteration < repeatCount; iteration++) {
                                                // 취소 체크
                                                if (this.isCancelled) {
                                                    break;
                                                }

                                                logger.log(
                                                    `[WorkflowExecutionService] 반복 실행 ${iteration + 1}/${repeatCount} 시작`
                                                );

                                                // 1. 각 반복 시작 시 반복 노드를 실행 중 상태로 표시
                                                if (repeatNodeElement) {
                                                    this.showNodeExecuting(repeatNodeElement);
                                                }

                                                // 2. 반복 연결점에 연결된 노드들을 기본 상태로 리셋 (이전 반복의 상태 제거)
                                                nodesToRepeat.forEach((node) => {
                                                    const nodeElement =
                                                        document.getElementById(node.id) ||
                                                        document.querySelector(`[data-node-id="${node.id}"]`);
                                                    if (nodeElement) {
                                                        // 이전 상태 제거
                                                        nodeElement.classList.remove('executing', 'completed', 'error');
                                                    }
                                                });

                                                // 3. 각 노드를 순차적으로 개별 실행하여 실시간 UI 업데이트
                                                const iterationResults = [];
                                                let currentPreviousResult = previousNodeResult;

                                                for (let nodeIndex = 0; nodeIndex < nodesToRepeat.length; nodeIndex++) {
                                                    // 취소 체크
                                                    if (this.isCancelled) {
                                                        break;
                                                    }

                                                    const node = nodesToRepeat[nodeIndex];
                                                    const nodeWithRepeatInfo = nodesWithRepeatInfo[nodeIndex];

                                                    // 4. 각 노드 실행 전에 실행 중 상태로 표시
                                                    const nodeElement =
                                                        document.getElementById(node.id) ||
                                                        document.querySelector(`[data-node-id="${node.id}"]`);
                                                    if (nodeElement) {
                                                        this.showNodeExecuting(nodeElement);
                                                    }

                                                    // 5. 각 노드를 개별적으로 서버로 요청
                                                    try {
                                                        const nodeResponse = await fetch(
                                                            `${apiBaseUrl}/api/execute-nodes`,
                                                            {
                                                                method: 'POST',
                                                                headers: {
                                                                    'Content-Type': 'application/json'
                                                                },
                                                                body: JSON.stringify({
                                                                    nodes: [nodeWithRepeatInfo],
                                                                    execution_mode: 'sequential',
                                                                    total_nodes: totalNodesCount,
                                                                    current_node_index: i + nodeIndex,
                                                                    previous_node_result: currentPreviousResult,
                                                                    repeat_info: {
                                                                        repeat_count: 1,
                                                                        current_iteration: iteration + 1,
                                                                        total_iterations: repeatCount,
                                                                        repeat_node_id: nodeData.id
                                                                    },
                                                                    execution_id: this.lastExecutionId,
                                                                    script_id: this.workflowPage.getCurrentScriptId?.()
                                                                })
                                                            }
                                                        );

                                                        const nodeResult = await nodeResponse.json();

                                                        if (
                                                            nodeResult.success &&
                                                            nodeResult.data?.results &&
                                                            nodeResult.data.results.length > 0
                                                        ) {
                                                            const result = nodeResult.data.results[0];
                                                            iterationResults.push(result);

                                                            // 6. 노드 실행 완료 후 UI 업데이트
                                                            if (nodeElement) {
                                                                if (result.status === 'failed' || result.error) {
                                                                    this.showNodeError(nodeElement);
                                                                } else {
                                                                    this.showNodeCompleted(nodeElement, result);
                                                                }
                                                            }

                                                            // 다음 노드를 위한 이전 노드 결과 업데이트
                                                            currentPreviousResult = {
                                                                ...result,
                                                                node_id: node.id,
                                                                node_name: node.data?.title || node.type || node.id
                                                            };
                                                        } else {
                                                            // 노드 실행 실패
                                                            const errorResult = {
                                                                status: 'failed',
                                                                error: nodeResult.error || '노드 실행 실패',
                                                                node_id: node.id
                                                            };
                                                            iterationResults.push(errorResult);

                                                            if (nodeElement) {
                                                                this.showNodeError(nodeElement);
                                                            }
                                                        }
                                                    } catch (nodeError) {
                                                        logger.error(
                                                            `[WorkflowExecutionService] 반복 ${iteration + 1}/${repeatCount} - 노드 ${nodeIndex + 1} 실행 중 오류:`,
                                                            nodeError
                                                        );
                                                        const errorResult = {
                                                            status: 'failed',
                                                            error: String(nodeError),
                                                            node_id: node.id
                                                        };
                                                        iterationResults.push(errorResult);

                                                        if (nodeElement) {
                                                            this.showNodeError(nodeElement);
                                                        }
                                                    }
                                                }

                                                // 7. 각 반복의 결과 저장
                                                allIterationResults.push(...iterationResults);

                                                // 8. 각 반복 완료 시 반복 노드를 완료 상태로 표시 (마지막 반복이 아닌 경우)
                                                if (iteration < repeatCount - 1) {
                                                    // 마지막 반복이 아니면 잠시 완료 상태로 표시 후 다음 반복 시작
                                                    logger.log(
                                                        `[WorkflowExecutionService] 반복 실행 ${iteration + 1}/${repeatCount} 종료`
                                                    );
                                                    if (repeatNodeElement) {
                                                        this.showNodeCompleted(repeatNodeElement);
                                                        // 다음 반복 시작 전에 잠시 대기
                                                        await new Promise((resolve) => setTimeout(resolve, 300));
                                                    }
                                                } else {
                                                    // 마지막 반복 종료
                                                    logger.log(
                                                        `[WorkflowExecutionService] 반복 실행 ${iteration + 1}/${repeatCount} 종료 (마지막 반복)`
                                                    );
                                                }

                                                // 마지막 노드 결과를 이전 노드 결과로 업데이트 (다음 반복을 위해)
                                                if (iterationResults.length > 0) {
                                                    const lastResult = iterationResults[iterationResults.length - 1];
                                                    previousNodeResult = {
                                                        ...lastResult,
                                                        node_id: nodesToRepeat[nodesToRepeat.length - 1]?.id,
                                                        node_name:
                                                            nodesToRepeat[nodesToRepeat.length - 1]?.data?.title ||
                                                            nodesToRepeat[nodesToRepeat.length - 1]?.type ||
                                                            nodesToRepeat[nodesToRepeat.length - 1]?.id
                                                    };
                                                }
                                            }

                                            // 모든 반복 결과를 노드 결과에 저장
                                            nodeResult.output.iterations = allIterationResults;
                                            logger.log(
                                                `[WorkflowExecutionService] 반복 노드 실행 완료 - 총 ${allIterationResults.length}개 노드 실행 (${repeatCount}회 반복 × ${nodesToRepeat.length}개 노드)`
                                            );

                                            // 실행 완료 UI 표시
                                            if (repeatNodeElement) {
                                                this.showNodeCompleted(repeatNodeElement, nodeResult);
                                            }

                                            // 반복 노드의 오른쪽 출력 연결점(output)에 연결된 노드 찾기 (제거 전에 먼저 찾기)
                                            const repeatNodeId = nodeData.id; // 반복 노드의 ID 저장
                                            const outputConnections = connections.filter(
                                                (c) =>
                                                    c.from === repeatNodeId &&
                                                    (!c.outputType || c.outputType === 'output')
                                            );

                                            logger.log(
                                                `[WorkflowExecutionService] 반복 노드의 출력 연결점 연결 정보: ${JSON.stringify(outputConnections.map((c) => ({ from: c.from, to: c.to, outputType: c.outputType })))}`
                                            );
                                            logger.log(
                                                `[WorkflowExecutionService] 현재 workflowData.nodes의 노드 ID 목록: ${workflowData.nodes.map((n) => n.id).join(', ')}`
                                            );

                                            // 반복 노드의 출력 연결점에 연결된 노드 정보 저장 변수
                                            // outputNodeId: 출력 연결점에 연결된 노드의 ID (반복 완료 후 실행할 노드)
                                            let outputNodeId = null;
                                            // outputNodeIndex: 출력 연결점에 연결된 노드의 workflowData.nodes 내 인덱스 (제거 후 인덱스 재계산용)
                                            let outputNodeIndex = -1;

                                            if (outputConnections.length > 0) {
                                                // 출력 연결점에 연결된 첫 번째 노드 찾기
                                                outputNodeId = outputConnections[0].to;

                                                logger.log(
                                                    `[WorkflowExecutionService] 출력 연결점에 연결된 노드 ID: ${outputNodeId}`
                                                );

                                                // 출력 연결점에 연결된 노드가 반복 연결점에 연결된 노드 체인에 포함되어 있는지 확인
                                                const isOutputNodeInRepeatChain = nodesToRepeat.some(
                                                    (n) => n.id === outputNodeId
                                                );

                                                logger.log(
                                                    `[WorkflowExecutionService] 출력 연결점 노드가 반복 연결점 체인에 포함되어 있는지: ${isOutputNodeInRepeatChain}`
                                                );

                                                if (isOutputNodeInRepeatChain) {
                                                    logger.warn(
                                                        `[WorkflowExecutionService] 반복 노드의 출력 연결점에 연결된 노드가 반복 연결점에 연결된 노드 체인에 포함되어 있습니다: ${outputNodeId}`
                                                    );
                                                    outputNodeId = null; // 출력 노드를 null로 설정하여 스킵
                                                } else {
                                                    // 출력 연결점에 연결된 노드의 인덱스 찾기 (제거 전)
                                                    outputNodeIndex = workflowData.nodes.findIndex(
                                                        (n) => n.id === outputNodeId
                                                    );

                                                    if (outputNodeIndex === -1) {
                                                        // workflowData.nodes에 없으면 DOM에서 직접 찾아서 추가
                                                        const outputNodeElement =
                                                            document.getElementById(outputNodeId) ||
                                                            document.querySelector(`[data-node-id="${outputNodeId}"]`);

                                                        if (outputNodeElement) {
                                                            logger.log(
                                                                `[WorkflowExecutionService] 출력 연결점 노드를 DOM에서 찾아 workflowData.nodes에 추가: ${outputNodeId}`
                                                            );

                                                            // 노드 데이터 준비
                                                            const nodeManager = this.workflowPage.getNodeManager();
                                                            const outputNodeData =
                                                                this.workflowPage.getNodeData(outputNodeElement);
                                                            const outputNodeType =
                                                                this.workflowPage.getNodeType(outputNodeElement);

                                                            // workflowData.nodes에 추가 (반복 노드 다음에 추가)
                                                            const repeatNodeIndexInWorkflow =
                                                                workflowData.nodes.findIndex(
                                                                    (n) => n.id === repeatNodeId
                                                                );

                                                            const newNodeData = {
                                                                id: outputNodeId,
                                                                type: outputNodeType,
                                                                data: outputNodeData,
                                                                ...outputNodeData
                                                            };

                                                            // 반복 노드 다음에 삽입
                                                            if (repeatNodeIndexInWorkflow !== -1) {
                                                                workflowData.nodes.splice(
                                                                    repeatNodeIndexInWorkflow + 1,
                                                                    0,
                                                                    newNodeData
                                                                );
                                                                outputNodeIndex = repeatNodeIndexInWorkflow + 1;
                                                            } else {
                                                                // 반복 노드를 찾을 수 없으면 현재 반복 노드 위치 다음에 추가
                                                                const currentRepeatNodeIndex = i; // 현재 반복 노드의 인덱스
                                                                if (
                                                                    currentRepeatNodeIndex !== -1 &&
                                                                    currentRepeatNodeIndex < workflowData.nodes.length
                                                                ) {
                                                                    workflowData.nodes.splice(
                                                                        currentRepeatNodeIndex + 1,
                                                                        0,
                                                                        newNodeData
                                                                    );
                                                                    outputNodeIndex = currentRepeatNodeIndex + 1;
                                                                } else {
                                                                    // 반복 노드를 찾을 수 없으면 맨 끝에 추가
                                                                    workflowData.nodes.push(newNodeData);
                                                                    outputNodeIndex = workflowData.nodes.length - 1;
                                                                }
                                                            }

                                                            logger.log(
                                                                `[WorkflowExecutionService] 출력 연결점 노드 추가 완료: ${outputNodeId} (인덱스: ${outputNodeIndex})`
                                                            );
                                                        } else {
                                                            logger.warn(
                                                                `[WorkflowExecutionService] 반복 노드의 출력 연결점에 연결된 노드를 DOM에서도 찾을 수 없습니다: ${outputNodeId}`
                                                            );
                                                            outputNodeId = null; // 출력 노드를 null로 설정하여 스킵
                                                        }
                                                    } else {
                                                        logger.log(
                                                            `[WorkflowExecutionService] 반복 노드의 출력 연결점에 연결된 노드 찾음: ${outputNodeId} (인덱스: ${outputNodeIndex})`
                                                        );
                                                    }
                                                }
                                            } else {
                                                logger.log(
                                                    '[WorkflowExecutionService] 반복 노드의 출력 연결점에 연결된 노드가 없습니다. 반복 노드 실행 완료.'
                                                );
                                            }

                                            // 반복 연결점에 연결된 노드들을 workflowData.nodes에서 제거하여 다시 실행되지 않도록 함
                                            const nodesToRepeatIds = new Set(nodesToRepeat.map((n) => n.id));
                                            const originalNodesLength = workflowData.nodes.length;

                                            // 출력 연결점에 연결된 노드가 있으면 제거 대상에서 제외
                                            if (outputNodeId) {
                                                nodesToRepeatIds.delete(outputNodeId);
                                            }

                                            workflowData.nodes = workflowData.nodes.filter(
                                                (n) => !nodesToRepeatIds.has(n.id)
                                            );
                                            logger.log(
                                                `[WorkflowExecutionService] 반복 연결점에 연결된 노드들을 workflowData.nodes에서 제거: ${nodesToRepeatIds.size}개 노드 제거 (${originalNodesLength} → ${workflowData.nodes.length})`
                                            );

                                            // 출력 연결점에 연결된 노드로 진행
                                            if (outputNodeId && outputNodeIndex !== -1) {
                                                // 제거 후 인덱스 재계산 (제거된 노드들 때문에 인덱스가 변경될 수 있음)
                                                const newOutputNodeIndex = workflowData.nodes.findIndex(
                                                    (n) => n.id === outputNodeId
                                                );

                                                if (newOutputNodeIndex !== -1) {
                                                    logger.log(
                                                        `[WorkflowExecutionService] 반복 노드 실행 완료 후 출력 연결점에 연결된 노드로 진행: ${outputNodeId} (인덱스: ${newOutputNodeIndex})`
                                                    );

                                                    // 다음 노드 인덱스를 현재 인덱스로 설정하여 출력 연결점에 연결된 노드가 실행되도록 함
                                                    // i를 newOutputNodeIndex - 1로 설정하면 다음 루프에서 newOutputNodeIndex가 실행됨
                                                    i = newOutputNodeIndex - 1;

                                                    // 반복 노드 실행 후 다음 노드로 진행하므로, 반복 노드 실행 루프를 종료
                                                    // 다음 노드는 메인 루프에서 실행됨
                                                } else {
                                                    logger.error(
                                                        `[WorkflowExecutionService] 반복 노드의 출력 연결점에 연결된 노드를 제거 후 workflowData에서 찾을 수 없습니다: ${outputNodeId}`
                                                    );
                                                }
                                            }
                                        } catch (error) {
                                            logger.error('[WorkflowExecutionService] 반복 노드 실행 중 오류:', error);
                                            const repeatNodeElement =
                                                document.getElementById(nodeData.id) ||
                                                document.querySelector(`[data-node-id="${nodeData.id}"]`);
                                            if (repeatNodeElement) {
                                                this.showNodeError(repeatNodeElement);
                                            }
                                        }
                                    } else {
                                        logger.warn(
                                            '[WorkflowExecutionService] 반복 연결점에 연결된 노드 체인을 찾을 수 없습니다.'
                                        );
                                    }
                                }
                            }
                        }

                        // 이전 노드 결과 업데이트 (다음 노드 실행 시 전달)
                        // nodeResult는 이미 outdata/indata 구조이므로 그대로 사용
                        previousNodeResult = {
                            ...nodeResult,
                            node_id: nodeData.id,
                            node_name: nodeData.data?.title || nodeData.type || nodeData.id
                        };
                    }

                    // 노드 결과에서 에러 확인 (status가 "failed"이거나 error 필드가 있는 경우)
                    const isNodeFailed =
                        nodeResult?.status === 'failed' ||
                        nodeResult?.error ||
                        (nodeResult?.output && nodeResult.output.error);

                    // 서버 레벨 에러 또는 노드 레벨 에러 확인
                    if (result.success === false || isNodeFailed) {
                        // 에러 발생 시
                        this.showNodeError(nodeElement);

                        const nodeTitle = nodeData.data?.title || nodeData.type || nodeData.id;
                        let errorMessage = '알 수 없는 오류';

                        // 에러 메시지 추출 헬퍼 함수
                        const extractErrorMessage = (errorObj) => {
                            if (!errorObj) {
                                return null;
                            }
                            // 문자열이면 그대로 반환
                            if (typeof errorObj === 'string') {
                                return errorObj;
                            }
                            // 객체인 경우 message, reason, detail 등을 우선순위로 추출
                            if (typeof errorObj === 'object') {
                                return (
                                    errorObj.message || errorObj.reason || errorObj.detail || JSON.stringify(errorObj)
                                );
                            }
                            // 그 외의 경우 문자열로 변환
                            return String(errorObj);
                        };

                        // 에러 메시지 추출 (우선순위: nodeResult.error > nodeResult.output.error > nodeResult.message > result.message)
                        if (nodeResult?.error) {
                            errorMessage = extractErrorMessage(nodeResult.error) || '알 수 없는 오류';
                        } else if (nodeResult?.output?.error) {
                            errorMessage = extractErrorMessage(nodeResult.output.error) || '알 수 없는 오류';
                        } else if (nodeResult?.message) {
                            errorMessage = extractErrorMessage(nodeResult.message) || '알 수 없는 오류';
                        } else if (result.message) {
                            errorMessage = extractErrorMessage(result.message) || '알 수 없는 오류';
                        } else if (result.detail) {
                            errorMessage = extractErrorMessage(result.detail) || '알 수 없는 오류';
                        }

                        // 에러 발생 시 실행 중단 (에러를 throw하여 상위로 전파)
                        // failCount는 catch 블록에서 증가시키므로 여기서는 증가시키지 않음
                        throw new Error(`노드 "${nodeTitle}" 실행 실패: ${errorMessage}`);
                    } else {
                        // 성공 시
                        successCount++;
                        this.showNodeCompleted(nodeElement);

                        // 노드 실행 결과 수집
                        const nodeTitle = nodeData.data?.title || nodeData.type || nodeData.id;
                        nodeResults.push({
                            name: nodeTitle,
                            status: 'success',
                            message: t('common.executionCompletedSuccessfully')
                        });
                    }
                } catch (error) {
                    // 네트워크 에러 또는 서버 에러 등
                    // 노드 실행 실패는 여기서 한 번만 카운팅
                    const logger = this.workflowPage.getLogger();
                    const nodeIdentifier = getSimpleNodeIdentifier(nodeData, i + 1, totalNodesCount);
                    logger.error(`[WorkflowExecutionService] 노드 실행 오류: ${nodeIdentifier}`, error);
                    this.showNodeError(nodeElement);

                    // 에러 발생 시에도 스크린샷 캡처 (에러 상황 기록용)
                    const currentScript = this.workflowPage?.getCurrentScript();
                    const scriptName = currentScript?.name || 'Unknown';
                    const nodeName = nodeData.data?.title || nodeData.type || nodeData.id;
                    const isRunningAllScripts = this.isRunningAllScripts || false;
                    // 전체 실행인 경우 전체 실행 시작 시간을 우선 사용, 없으면 현재 스크립트 실행 시작 시간 사용
                    const executionStartTime =
                        this.isRunningAllScripts && this.allScriptsExecutionStartTime
                            ? this.allScriptsExecutionStartTime
                            : this.executionStartTime
                              ? new Date(this.executionStartTime).toISOString()
                              : new Date().toISOString();
                    // 전체 실행 시 스크립트 실행 순서 전달
                    const scriptExecutionOrder = this.isRunningAllScripts ? this.scriptExecutionOrder : null;

                    captureAndSaveScreenshot(
                        nodeData.id,
                        nodeData.type,
                        scriptName,
                        nodeName,
                        isRunningAllScripts,
                        executionStartTime,
                        scriptExecutionOrder
                    ).catch((screenshotError) => {
                        logger.warn(
                            '[WorkflowExecutionService] 에러 발생 시 스크린샷 캡처 실패 (무시):',
                            screenshotError
                        );
                    });

                    const nodeTitle = nodeData.data?.title || nodeData.type || nodeData.id;
                    const errorMessage = error.message || '알 수 없는 오류';

                    // 노드 실행 결과 수집 (실패)
                    nodeResults.push({
                        name: nodeTitle,
                        status: 'failed',
                        error: errorMessage,
                        message: errorMessage
                    });

                    // 노드 실행 실패 카운팅 (한 번만 증가)
                    failCount++;
                    throw error; // 원본 에러를 그대로 전파
                }

                // 취소 플래그 체크
                if (this.isCancelled) {
                    const logger = this.workflowPage.getLogger();
                    logger.log('[WorkflowExecutionService] 실행이 취소되었습니다.');
                    // 남은 노드 개수를 중단 개수로 계산
                    cancelledCount = totalNodeCount - successCount - failCount;
                    // 전체 스크립트 실행 중이면 토스트만 표시
                    if (this.isRunningAllScripts) {
                        if (toastManager) {
                            toastManager.warning(
                                `실행 취소 (성공 노드: ${successCount}개, 실패 노드: ${failCount}개, 중단 노드: ${cancelledCount}개)`
                            );
                        }
                    } else {
                        if (modalManager) {
                            modalManager.showAlert(
                                '실행 취소',
                                `실행이 취소되었습니다.\n\n성공 노드: ${successCount}개\n실패 노드: ${failCount}개\n중단 노드: ${cancelledCount}개`
                            );
                        } else if (toastManager) {
                            toastManager.warning('실행이 취소되었습니다.');
                        }
                    }
                    break;
                }

                // 노드 간 대기 시간 (선택적, 필요시 조정)
                await new Promise((resolve) => setTimeout(resolve, 100));
            }

            // 중단된 노드 개수 계산 (취소되지 않았으면 0)
            if (!this.isCancelled) {
                cancelledCount = totalNodeCount - successCount - failCount;
            }

            // 모든 노드 실행 완료 (0개여도 모두 표시)
            // 전체 스크립트 실행 중이면 토스트만 표시, 단일 실행이면 모달 표시
            if (this.isRunningAllScripts) {
                // 전체 스크립트 실행 중: 토스트만 표시 (노드 개수)
                if (toastManager) {
                    const statusMessage = this.isCancelled
                        ? `${t('common.executionCancelled')} (${t('common.successNodes')}: ${successCount}, ${t('common.failedNodes')}: ${failCount}, ${t('common.cancelledNodes')}: ${cancelledCount})`
                        : `${t('common.executionCompleted')} (${t('common.successNodes')}: ${successCount}, ${t('common.failedNodes')}: ${failCount}, ${t('common.cancelledNodes')}: ${cancelledCount})`;
                    if (this.isCancelled) {
                        toastManager.warning(statusMessage);
                    } else if (failCount > 0) {
                        toastManager.error(statusMessage);
                    } else {
                        toastManager.success(statusMessage);
                    }
                }
            } else {
                // 단일 스크립트 실행: 실행 결과 모달 표시 (가운데 팝업)
                if (modalManager) {
                    const title = this.isCancelled ? t('common.executionCancelled') : t('common.executionCompleted');
                    const resultModalManager = getResultModalManagerInstance();
                    resultModalManager.showExecutionResult(title, {
                        successCount,
                        failCount,
                        cancelledCount,
                        nodes: nodeResults,
                        summaryLabel: t('common.nodes')
                    });
                } else if (toastManager) {
                    toastManager.success(
                        `${t('common.workflowExecutionCompleted')} (${workflowData.nodes.length} ${t('common.nodes')})`
                    );
                }

                // 폴백 경로에서 실행 기록 페이지에 로그 업데이트 알림 (성공 시)
                // (executeSingleScript를 사용하지 않는 경우에만)
                const currentScript = this.workflowPage?.getCurrentScript();
                if (currentScript && currentScript.id && !this.isRunningAllScripts) {
                    document.dispatchEvent(
                        new CustomEvent('logsUpdated', {
                            detail: {
                                type: 'workflowExecutionCompleted',
                                scriptId: currentScript.id,
                                scriptName: currentScript.name
                            }
                        })
                    );
                }
            }
        } catch (error) {
            console.error('워크플로우 실행 오류:', error);
            // 중단된 노드 개수 계산
            // 에러가 발생한 노드는 이미 failCount에 포함되어 있음
            // 성공한 노드 + 실패한 노드 + 중단된 노드 = 총 노드 수
            // 따라서: 중단 노드 = 총 노드 수 - 성공 노드 - 실패 노드
            cancelledCount = totalNodeCount - successCount - failCount;

            // 디버깅: 계산 결과 확인
            const logger = this.workflowPage.getLogger();
            logger.log('[WorkflowExecutionService] 노드 카운팅 계산:', {
                totalNodeCount: `전체 노드(Start 포함): ${totalNodeCount}`,
                successCount: successCount,
                failCount,
                cancelledCount: `실행 안 된 노드들: ${cancelledCount}`,
                currentNodeIndex,
                계산: `${totalNodeCount} - ${successCount} - ${failCount} = ${cancelledCount}`
            });

            // 단일 스크립트 실행 시 예외 발생 시에도 실행 기록 저장 및 로그 업데이트는 executeSingleScript에서 처리
            // (전체 실행이 아닐 때만 executeSingleScript가 호출되므로 여기서는 제거)

            // 전체 스크립트 실행 중이면 토스트만 표시하고 에러를 다시 throw하여 상위로 전파
            if (this.isRunningAllScripts) {
                if (toastManager) {
                    toastManager.error(
                        `${t('common.executionInterrupted')} (${t('common.successNodes')}: ${successCount}, ${t('common.failedNodes')}: ${failCount}, ${t('common.cancelledNodes')}: ${cancelledCount}) - ${error.message}`
                    );
                }
                // 전체 스크립트 실행 중이면 에러를 다시 throw하여 sidebar에서 실패로 처리
                throw error;
            } else {
                // 단일 스크립트 실행 중 에러 발생 시: 남은 노드들을 중단으로 표시
                // failedNodeIndex: 에러가 발생한 노드의 인덱스 (없으면 0부터 시작)
                const failedNodeIndex = currentNodeIndex || 0;
                // 에러 발생 노드 이후의 모든 노드를 중단 상태로 표시
                for (let j = failedNodeIndex + 1; j < workflowData.nodes.length; j++) {
                    // 현재 순회 중인 남은 노드
                    const remainingNode = workflowData.nodes[j];
                    // 노드 제목 추출 (우선순위: data.title > type > id)
                    const remainingNodeTitle = remainingNode.data?.title || remainingNode.type || remainingNode.id;
                    // 이미 nodeResults에 추가된 노드인지 확인 (중복 방지)
                    const alreadyAdded = nodeResults.some((r) => r.name === remainingNodeTitle);
                    // 중복되지 않은 경우에만 중단 상태로 추가
                    if (!alreadyAdded) {
                        nodeResults.push({
                            name: remainingNodeTitle,
                            status: 'cancelled',
                            message: t('common.cancelledDueToError')
                        });
                    }
                }

                // 폴백 경로에서 실행 기록 페이지에 로그 업데이트 알림 (실패 시)
                const currentScript = this.workflowPage?.getCurrentScript();
                if (currentScript && currentScript.id) {
                    document.dispatchEvent(
                        new CustomEvent('logsUpdated', {
                            detail: {
                                type: 'workflowExecutionFailed',
                                scriptId: currentScript.id,
                                scriptName: currentScript.name
                            }
                        })
                    );
                }

                if (modalManager) {
                    const resultModalManager = getResultModalManagerInstance();
                    resultModalManager.showExecutionResult(t('common.executionInterrupted'), {
                        successCount,
                        failCount,
                        cancelledCount,
                        nodes: nodeResults,
                        summaryLabel: t('common.nodes')
                    });
                } else if (toastManager) {
                    toastManager.error(`${t('common.workflowExecutionError')}: ${error.message}`);
                }
                // 단일 스크립트 실행 중이면 에러를 다시 throw
                throw error;
            }
        } finally {
            // 실행 중 플래그 해제
            this.isExecuting = false;
            // 전체 스크립트 실행 플래그는 sidebar에서 관리하므로 여기서는 초기화하지 않음
        }
    }

    /**
     * 노드 실행 중 UI 표시 (깜빡깜빡 애니메이션)
     */
    showNodeExecuting(nodeElement) {
        nodeElement.classList.add('executing');
        nodeElement.classList.remove('completed', 'error');
    }

    /**
     * 노드 실행 완료 UI 표시
     */
    showNodeCompleted(nodeElement) {
        nodeElement.classList.remove('executing');
        nodeElement.classList.add('completed');

        // 1초 후 완료 상태 제거
        setTimeout(() => {
            nodeElement.classList.remove('completed');
        }, 1000);
    }

    /**
     * 노드 실행 에러 UI 표시
     */
    showNodeError(nodeElement) {
        nodeElement.classList.remove('executing');
        nodeElement.classList.add('error');

        // 2초 후 에러 상태 제거
        setTimeout(() => {
            nodeElement.classList.remove('error');
        }, 2000);
    }

    /**
     * 실행된 노드 순서대로 DOM 요소 가져오기
     */
    getOrderedNodeElements(executedNodes) {
        const nodeElements = [];
        executedNodes.forEach((nodeData) => {
            const element =
                document.getElementById(nodeData.id) || document.querySelector(`[data-node-id="${nodeData.id}"]`);
            if (element) {
                nodeElements.push(element);
            }
        });
        return nodeElements;
    }

    /**
     * 워크플로우 데이터 준비
     * 시작 노드부터 연결된 순서대로 노드를 정렬합니다.
     * 조건 노드의 분기는 현재는 첫 번째 연결만 따라갑니다 (향후 조건 평가 로직 추가 필요).
     */
    async prepareWorkflowData(nodes) {
        const nodeList = Array.from(nodes);
        const byId = new Map(nodeList.map((n) => [n.id || n.dataset.nodeId, n]));

        let ordered = [];
        const nodeManager = this.workflowPage.getNodeManager();
        const connections =
            nodeManager && nodeManager.connectionManager ? nodeManager.connectionManager.getConnections() : [];

        // 경계 노드가 있고 연결이 있으면 연결 순서대로 정렬
        // 경계 노드 찾기 (시작 노드 등)
        const { isBoundaryNodeSync } = await import('../constants/node-types.js');
        let boundaryNodeId = null;
        for (const [nodeId, nodeElement] of byId.entries()) {
            const nodeType = this.workflowPage.getNodeType(nodeElement);
            if (isBoundaryNodeSync(nodeType)) {
                boundaryNodeId = nodeId;
                break;
            }
        }

        if (boundaryNodeId && connections && connections.length > 0) {
            // 연결 맵 생성: from -> [to1, to2, ...] (여러 분기 지원)
            const nextMap = new Map(); // Map<from, Array<{to, outputType}>>

            connections.forEach((c) => {
                if (!nextMap.has(c.from)) {
                    nextMap.set(c.from, []);
                }
                nextMap.get(c.from).push({
                    to: c.to,
                    outputType: c.outputType || null
                });
            });

            // 경계 노드부터 순차적으로 탐색
            const visited = new Set();
            const addedToOrdered = new Set(); // ordered에 추가된 노드 ID 추적 (중복 방지)
            const queue = [boundaryNodeId]; // BFS를 위한 큐

            // 경계 노드를 ordered에 먼저 추가
            if (byId.has(boundaryNodeId)) {
                const boundaryElement = byId.get(boundaryNodeId);
                ordered.push(boundaryElement);
                addedToOrdered.add(boundaryNodeId);
            }

            while (queue.length > 0) {
                const cur = queue.shift();

                // 이미 방문한 노드는 건너뛰기 (순환 방지)
                if (visited.has(cur)) {
                    continue;
                }

                visited.add(cur);

                // 현재 노드에서 나가는 연결이 있으면
                if (nextMap.has(cur)) {
                    const nextNodes = nextMap.get(cur);

                    // 현재 노드의 타입 확인
                    const currentNodeElement = byId.get(cur);
                    const currentNodeType = currentNodeElement?.dataset?.nodeType || nodeManager?.nodeData?.[cur]?.type;
                    const isRepeatNode = currentNodeType === 'repeat';

                    // 노드 타입에 따라 연결 처리 방식이 다름
                    // 반복 노드인 경우: bottom 연결점과 output 연결점 모두 처리
                    // 조건 노드가 아닌 경우: 첫 번째 연결만 따라감
                    // 조건 노드인 경우: 향후 조건 평가 결과에 따라 분기 (현재는 첫 번째 연결만)
                    if (isRepeatNode) {
                        // 반복 노드의 경우 모든 연결점 처리
                        // bottom 연결점에 연결된 노드들 (반복할 노드들)
                        // output 연결점에 연결된 노드 (반복 완료 후 실행할 노드)
                        nextNodes.forEach((nextNode) => {
                            // 연결 정보가 있고, 목적지 노드가 존재하는지 확인
                            if (nextNode && byId.has(nextNode.to)) {
                                // 목적지 노드 요소 가져오기
                                const nextElement = byId.get(nextNode.to);
                                // 노드 ID 추출 (id 속성 또는 dataset.nodeId)
                                const nextId = nextElement.id || nextElement.dataset.nodeId;

                                // 아직 ordered에 추가되지 않은 노드만 추가 (중복 방지)
                                if (!addedToOrdered.has(nextId)) {
                                    // ordered 배열에 추가
                                    ordered.push(nextElement);
                                    // 추가된 노드 ID 기록 (중복 방지용)
                                    addedToOrdered.add(nextId);
                                    // BFS 큐에 추가하여 다음 탐색 대상으로 설정
                                    queue.push(nextId);
                                }
                            }
                        });
                    } else {
                        // 일반 노드의 경우 첫 번째 연결만 따라감 (현재는 단일 경로만 지원)
                        const nextNode = nextNodes[0]; // 현재는 첫 번째 연결만 사용

                        // 연결 정보가 있고, 목적지 노드가 존재하는지 확인
                        if (nextNode && byId.has(nextNode.to)) {
                            // 목적지 노드 요소 가져오기
                            const nextElement = byId.get(nextNode.to);
                            // 노드 ID 추출 (id 속성 또는 dataset.nodeId)
                            const nextId = nextElement.id || nextElement.dataset.nodeId;

                            // 아직 ordered에 추가되지 않은 노드만 추가 (중복 방지)
                            if (!addedToOrdered.has(nextId)) {
                                // ordered 배열에 추가
                                ordered.push(nextElement);
                                // 추가된 노드 ID 기록 (중복 방지용)
                                addedToOrdered.add(nextId);
                                // BFS 큐에 추가하여 다음 탐색 대상으로 설정
                                queue.push(nextId);
                            }
                        }
                    }
                }
            }
        }

        // 연결이 없거나 시작 노드가 없으면 X 좌표 순서로 정렬
        if (ordered.length === 0) {
            ordered = nodeList.sort((a, b) => parseInt(a.style.left) - parseInt(b.style.left));
        }

        // 모든 노드를 실행 대상에 포함 (시작 노드도 포함)
        const executableNodes = ordered;

        // parameters 추출을 위한 설정 가져오기 (nodeManager는 이미 위에서 선언됨)
        const registry = getNodeRegistry();
        const allConfigs = await registry.getNodeConfigs();

        // 연결 정보 계산: 각 노드의 연결 상태와 순서 계산
        const connectionInfoMap = new Map();
        const nodeIdToIndex = new Map();

        // 경계 노드부터 시작하여 연결 순서 계산 (0부터 시작)
        executableNodes.forEach((node, index) => {
            const nodeId = node.id || node.dataset.nodeId;
            nodeIdToIndex.set(nodeId, index);

            // 연결 여부 확인: 이전 노드로부터 연결이 있는지 확인
            const hasInputConnection = connections.some((conn) => conn.to === nodeId);
            const isBoundary = index === 0; // 첫 번째 노드는 경계 노드

            // 노드 식별자 생성
            const nodeType = this.workflowPage.getNodeType(node);
            const nodeData = this.workflowPage.getNodeData(node);
            const nodeName = nodeData?.title || nodeData?.name || null;
            const nodeIdentifier = getSimpleNodeIdentifier(
                { id: nodeId, type: nodeType, title: nodeName },
                index,
                executableNodes.length
            );

            connectionInfoMap.set(nodeId, {
                is_connected: hasInputConnection || isBoundary, // 경계 노드는 연결된 것으로 간주
                connection_sequence: index, // 0부터 시작
                node_identifier: nodeIdentifier
            });
        });

        // 각 노드에 대해 parameters 추출 (workflow-save-service.js와 동일한 로직)
        const nodesWithParameters = await Promise.all(
            executableNodes.map(async (node) => {
                const nodeId = node.id || node.dataset.nodeId;
                const nodeType = this.workflowPage.getNodeType(node);
                const nodeData = this.workflowPage.getNodeData(node);

                // parameters 추출
                const parameters = {};
                // nodeManager.nodeData에서 실제 노드 데이터 가져오기 (메모리상의 최신 데이터)
                const managerNodeData =
                    nodeManager && nodeManager.nodeData && nodeManager.nodeData[nodeId]
                        ? nodeManager.nodeData[nodeId]
                        : null;
                // nodeData는 DOM에서 가져온 데이터, managerNodeData는 메모리상의 데이터 (우선순위 높음)
                const actualNodeData = managerNodeData || nodeData || {};

                if (nodeManager && nodeManager.nodeData && nodeManager.nodeData[nodeId]) {
                    const config = allConfigs[nodeType];

                    if (config) {
                        // 상세 노드 타입이 있으면 상세 노드 타입의 파라미터 우선 사용
                        const detailNodeType = actualNodeData?.action_node_type;
                        let parametersToExtract = null;

                        if (detailNodeType && config.detailTypes?.[detailNodeType]?.parameters) {
                            parametersToExtract = config.detailTypes[detailNodeType].parameters;
                        } else if (config.parameters) {
                            parametersToExtract = config.parameters;
                        }

                        // 파라미터 정의에 따라 actualNodeData에서 값 추출
                        if (parametersToExtract) {
                            // 각 파라미터 정의를 순회하며 값 추출
                            for (const [paramKey, paramConfig] of Object.entries(parametersToExtract)) {
                                // boolean 타입은 false도 유효한 값이므로 별도 처리
                                if (paramConfig.type === 'boolean') {
                                    // boolean은 undefined, null이 아닌 경우 모두 저장 (false도 유효)
                                    if (
                                        actualNodeData &&
                                        actualNodeData[paramKey] !== undefined &&
                                        actualNodeData[paramKey] !== null
                                    ) {
                                        // actualNodeData에 값이 있으면 Boolean으로 변환하여 저장
                                        parameters[paramKey] = Boolean(actualNodeData[paramKey]);
                                    } else if (paramConfig.default !== undefined) {
                                        // 값이 없고 기본값이 있으면 기본값을 Boolean으로 변환하여 저장
                                        parameters[paramKey] = Boolean(paramConfig.default);
                                    }
                                } else {
                                    // boolean이 아닌 다른 타입은 기존 로직 사용
                                    // 값이 존재하고 빈 문자열이 아닌 경우에만 저장
                                    if (
                                        actualNodeData &&
                                        actualNodeData[paramKey] !== undefined &&
                                        actualNodeData[paramKey] !== null &&
                                        actualNodeData[paramKey] !== ''
                                    ) {
                                        // actualNodeData의 값을 그대로 저장
                                        parameters[paramKey] = actualNodeData[paramKey];
                                    }
                                    // 값이 없고 기본값이 있으면 기본값 사용
                                    else if (paramConfig.default !== undefined && paramConfig.default !== null) {
                                        // 기본값 저장
                                        parameters[paramKey] = paramConfig.default;
                                    }
                                }
                            }
                        }

                        // 필수 파라미터 검증 (기본값 적용 후)
                        if (parametersToExtract) {
                            // 누락된 필수 파라미터 목록
                            const missingRequiredParams = [];
                            // 각 파라미터 정의를 순회하며 필수 파라미터 검증
                            for (const [paramKey, paramConfig] of Object.entries(parametersToExtract)) {
                                // 필수 파라미터인 경우에만 검증
                                if (paramConfig.required === true) {
                                    // 기본값이 있으면 필수 파라미터 검증 통과 (기본값으로 대체 가능)
                                    if (paramConfig.default !== undefined && paramConfig.default !== null) {
                                        continue; // 다음 파라미터로 넘어감
                                    }
                                    // 기본값이 없고 값도 없으면 에러 목록에 추가
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
                                    `노드 '${nodeId}' (${nodeType})에 필수 파라미터가 없습니다: ${missingRequiredParams.join(', ')}`
                                );
                            }
                        }
                    }
                }

                // 연결 정보 가져오기
                const connectionInfo = connectionInfoMap.get(nodeId) || {
                    is_connected: false,
                    connection_sequence: null,
                    node_identifier: null
                };

                return {
                    id: nodeId,
                    type: nodeType,
                    data: nodeData || {},
                    parameters: parameters,
                    // 연결 정보 추가
                    is_connected: connectionInfo.is_connected,
                    connection_sequence: connectionInfo.connection_sequence,
                    node_identifier: connectionInfo.node_identifier
                };
            })
        );

        return {
            nodes: nodesWithParameters,
            execution_mode: 'sequential'
        };
    }

    /**
     * 실행 애니메이션
     */
    animateExecution(nodes) {
        const nodeList = Array.from(nodes);
        nodeList.forEach((node, index) => {
            setTimeout(() => {
                node.classList.add('executing');
                setTimeout(() => {
                    node.classList.remove('executing');
                }, 500);
            }, index * 300);
        });
    }

    /**
     * 엑셀 관련 노드 검증: 엑셀 열기 노드가 필요한 노드들이 이전 노드 체인에 excel-open이 있는지 확인
     * @param {Array} nodes - 실행할 노드 목록
     * @returns {Promise<Object|null>} 검증 실패 시 에러 정보, 성공 시 null
     */
    async validateExcelNodes(nodes) {
        // 노드 레지스트리에서 엑셀 관련 노드 목록 동적으로 가져오기
        const { getNodeRegistry } = await import('../services/node-registry.js');
        const registry = getNodeRegistry();
        const allConfigs = await registry.getAllConfigs();

        // excel-로 시작하는 노드 타입들을 찾되, excel-open과 excel-compare는 제외
        // excel-compare는 종합 노드로 내부에서 엑셀을 열고 닫기 때문에 검증 불필요
        const excelNodesRequiringOpen = Object.keys(allConfigs).filter(
            (nodeType) => nodeType.startsWith('excel-') && nodeType !== 'excel-open' && nodeType !== 'excel-compare'
        );

        const nodeManager = this.workflowPage.getNodeManager();
        if (!nodeManager || !nodeManager.connectionManager) {
            return null; // 연결 정보가 없으면 검증 불가 (무시)
        }

        const connections = nodeManager.connectionManager.getConnections();
        if (!connections || connections.length === 0) {
            return null; // 연결이 없으면 검증 불가 (무시)
        }

        // 각 노드를 순회하며 엑셀 관련 노드인지 확인
        for (const node of nodes) {
            const nodeType = node.type;
            const nodeId = node.id;
            const nodeName = node.data?.title || nodeType || nodeId;

            // 엑셀 관련 노드가 아니면 건너뛰기
            if (!excelNodesRequiringOpen.includes(nodeType)) {
                continue;
            }

            // 이전 노드 체인 가져오기
            const previousNodes = await this.getPreviousNodeChainForValidation(nodeId, connections);

            // 이전 노드 체인에 excel-open이 있는지 확인
            const hasExcelOpen = previousNodes.some((prevNode) => prevNode.type === 'excel-open');

            if (!hasExcelOpen) {
                // 검증 실패: 엑셀 열기 노드가 없음
                const nodeLabel = nodeName || nodeType;
                return {
                    nodeId: nodeId,
                    nodeName: nodeLabel,
                    message: `'${nodeLabel}' 노드를 실행하려면 이전 노드 체인에 '엑셀 열기' 노드가 필요합니다. 엑셀 열기 노드를 추가하거나 이 노드 앞에 연결해주세요.`
                };
            }
        }

        return null; // 검증 통과
    }

    /**
     * 이전 노드 체인 가져오기 (워크플로우 실행 검증용)
     * @param {string} nodeId - 현재 노드 ID
     * @param {Array} connections - 연결 정보 목록
     * @returns {Promise<Array>} 이전 노드 체인
     */
    async getPreviousNodeChainForValidation(nodeId, connections) {
        const nodeChain = [];
        let currentNodeId = nodeId;

        while (currentNodeId) {
            // 현재 노드로 들어오는 연결 찾기
            const inputConnection = connections.find((conn) => conn.to === currentNodeId);
            if (!inputConnection) {
                break;
            }

            const previousNodeId = inputConnection.from;
            if (previousNodeId === currentNodeId) {
                break;
            }

            const previousNodeElement = document.getElementById(previousNodeId);
            if (!previousNodeElement) {
                break;
            }

            const nodeType = this.workflowPage.getNodeType(previousNodeElement);

            // 이전 노드 정보 추가
            nodeChain.unshift({
                id: previousNodeId,
                type: nodeType
            });

            // 경계 노드에 도달하면 종료
            const { isBoundaryNodeSync } = await import('../constants/node-types.js');
            if (nodeType && isBoundaryNodeSync(nodeType)) {
                break;
            }

            currentNodeId = previousNodeId;
        }

        return nodeChain;
    }

    /**
     * 재귀적으로 제거할 노드 수집 (condition 노드의 실행되지 않은 경로)
     * @param {string} nodeId - 시작 노드 ID
     * @param {Array} connections - 모든 연결 정보
     * @param {Set} nodesToRemove - 제거할 노드 ID 집합
     * @param {string} conditionNodeId - condition 노드 ID (순환 방지용)
     */
    _collectNodesToRemove(nodeId, connections, nodesToRemove, conditionNodeId) {
        // 이미 추가된 노드는 건너뛰기
        if (nodesToRemove.has(nodeId) || nodeId === conditionNodeId) {
            return;
        }

        nodesToRemove.add(nodeId);

        // 해당 노드에서 나가는 연결 찾기
        const outgoingConnections = connections.filter((c) => c.from === nodeId);
        outgoingConnections.forEach((conn) => {
            // 재귀적으로 수집
            if (!nodesToRemove.has(conn.to)) {
                this._collectNodesToRemove(conn.to, connections, nodesToRemove, conditionNodeId);
            }
        });
    }
}
