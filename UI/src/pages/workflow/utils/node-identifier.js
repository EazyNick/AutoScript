/**
 * 노드 식별자 유틸리티
 *
 * 노드를 명확하게 식별할 수 있는 식별자를 생성하고 포맷팅합니다.
 * 로그 출력 시 노드 타입, 이름, 순서, 연결 상태 등을 포함하여
 * 디버깅과 추적을 용이하게 합니다.
 */

/**
 * 노드 식별자 생성
 *
 * @param {Object} options - 노드 정보
 * @param {string} options.nodeId - 노드 ID
 * @param {string} options.nodeType - 노드 타입 (예: 'start', 'condition', 'image-touch')
 * @param {string} [options.nodeName] - 노드 이름/제목
 * @param {number} [options.sequence] - 실행 순서 (1부터 시작)
 * @param {number} [options.totalNodes] - 전체 노드 개수
 * @param {boolean} [options.isConnected] - 연결 여부
 * @param {string} [options.executionId] - 실행 ID (선택)
 * @returns {string} 포맷된 노드 식별자
 */
export function formatNodeIdentifier({
    nodeId,
    nodeType,
    nodeName = null,
    sequence = null,
    totalNodes = null,
    isConnected = null,
    executionId = null
}) {
    const parts = [];

    // 1. 노드 이름 (있으면 우선 표시)
    if (nodeName && nodeName.trim()) {
        parts.push(nodeName.trim());
    }

    // 2. 노드 타입 (항상 표시)
    const typeLabel = getNodeTypeLabel(nodeType);
    parts.push(`(${typeLabel})`);

    // 3. 순서 정보 (있으면 표시)
    if (sequence !== null && totalNodes !== null) {
        parts.push(`#${sequence}/${totalNodes}`);
    } else if (sequence !== null) {
        parts.push(`#${sequence}`);
    }

    // 4. 연결 상태 (명시적으로 표시)
    if (isConnected === false) {
        parts.push('[연결안됨]');
    } else if (isConnected === true) {
        parts.push('[연결됨]');
    }

    // 5. 노드 ID (원본 ID, 디버깅용)
    if (nodeId && nodeId !== 'start') {
        parts.push(`ID:${nodeId}`);
    }

    // 6. 실행 ID (있으면 표시, 짧은 형식)
    if (executionId) {
        const shortExecutionId = executionId.length > 12 ? executionId.substring(0, 12) + '...' : executionId;
        parts.push(`@${shortExecutionId}`);
    }

    return parts.join(' ');
}

/**
 * 노드 타입을 읽기 쉬운 라벨로 변환
 *
 * @param {string} nodeType - 노드 타입
 * @returns {string} 읽기 쉬운 라벨
 */
function getNodeTypeLabel(nodeType) {
    const typeLabels = {
        start: '시작',
        condition: '조건',
        repeat: '반복',
        wait: '대기',
        'image-touch': '이미지터치',
        'process-focus': '프로세스포커스',
        'excel-open': '엑셀열기',
        'excel-select-sheet': '엑셀시트선택',
        'excel-close': '엑셀닫기',
        testUIconfig: 'UI테스트'
    };

    return typeLabels[nodeType] || nodeType || '알수없음';
}

/**
 * 간단한 노드 식별자 생성 (로그용)
 *
 * @param {Object} nodeData - 노드 데이터
 * @param {number} [sequence] - 실행 순서
 * @param {number} [totalNodes] - 전체 노드 개수
 * @returns {string} 간단한 식별자
 */
export function getSimpleNodeIdentifier(nodeData, sequence = null, totalNodes = null) {
    const nodeId = nodeData?.id || 'unknown';
    const nodeType = nodeData?.type || nodeData?.nodeType || 'unknown';
    const nodeName = nodeData?.title || nodeData?.name || nodeData?.data?.title || nodeData?.data?.name;

    return formatNodeIdentifier({
        nodeId,
        nodeType,
        nodeName,
        sequence,
        totalNodes
    });
}

/**
 * 로그용 노드 식별자 생성
 *
 * @param {Object} nodeData - 노드 데이터
 * @param {Object} context - 실행 컨텍스트
 * @returns {string} 로그용 식별자
 */
export function getLogNodeIdentifier(nodeData, context = {}) {
    const nodeId = nodeData?.id || nodeData?.node_id || 'unknown';
    const nodeType = nodeData?.type || nodeData?.node_type || 'unknown';
    const nodeName =
        nodeData?.title || nodeData?.name || nodeData?.data?.title || nodeData?.data?.name || nodeData?.node_name;

    return formatNodeIdentifier({
        nodeId,
        nodeType,
        nodeName,
        sequence: context.sequence,
        totalNodes: context.totalNodes,
        isConnected: context.isConnected,
        executionId: context.executionId
    });
}
