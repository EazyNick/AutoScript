/**
 * 노드 출력 파서 유틸리티
 *
 * 노드 실행 결과에서 output 필드를 파싱하여 변수 목록을 추출합니다.
 * 새로운 표준 형식: {action, status, output: {key1: value1, key2: value2, ...}}
 */

/**
 * 노드 실행 결과에서 output 변수 목록 추출
 *
 * @param {Object} nodeResult - 노드 실행 결과 (표준 형식: {action, status, output: {...}})
 * @returns {Array<{key: string, value: any, type: string}>} 변수 목록
 *
 * 예시:
 *   입력: {
 *     action: "rss-feed",
 *     status: "completed",
 *     output: {
 *       title: "나노바나나 무료 연결법 공개!",
 *       link: "https://www.youtube.com/watch?v=...",
 *       pubDate: "2025-09-06T03:00:56.000Z"
 *     }
 *   }
 *
 *   출력: [
 *     {key: "title", value: "나노바나나 무료 연결법 공개!", type: "string"},
 *     {key: "link", value: "https://www.youtube.com/watch?v=...", type: "string"},
 *     {key: "pubDate", value: "2025-09-06T03:00:56.000Z", type: "string"}
 *   ]
 */
export function extractOutputVariables(nodeResult) {
    if (!nodeResult) {
        return [];
    }

    // 표준 형식 확인: {action, status, output: {...}}
    // output: 추출할 output 객체 (표준 형식 또는 하위 호환 형식)
    let output = null;

    // 표준 형식: output 필드가 dict인 경우
    if (nodeResult.output && typeof nodeResult.output === 'object') {
        // 표준 형식: output 필드가 dict
        output = nodeResult.output;
    } else if (typeof nodeResult === 'object' && !nodeResult.action && !nodeResult.status) {
        // 하위 호환성: 전체가 output인 경우 (action, status 필드가 없으면 전체를 output으로 간주)
        output = nodeResult;
    }

    // output이 없거나 객체가 아니면 빈 배열 반환
    if (!output || typeof output !== 'object') {
        return [];
    }

    // output의 각 키-값 쌍을 변수로 변환
    const variables = [];

    // output.data가 있으면 data 안의 변수들을 추출 (buildPreviousNodeOutput에서 래핑한 경우)
    if (output.data && typeof output.data === 'object' && !Array.isArray(output.data)) {
        for (const [key, value] of Object.entries(output.data)) {
            // 표준 필드는 제외
            const standardFields = ['action', 'status', 'output', 'error', 'message', 'meta'];
            if (standardFields.includes(key)) {
                continue;
            }

            // 값의 타입 추정
            let type = 'unknown';
            if (value === null) {
                type = 'null';
            } else if (Array.isArray(value)) {
                type = 'array';
            } else if (typeof value === 'object') {
                type = 'object';
            } else {
                type = typeof value;
            }

            variables.push({
                key,
                value,
                type
            });
        }
    }

    // output의 최상위 레벨 변수들도 추출 (data가 없는 경우 또는 data 외의 변수)
    // output의 각 키-값 쌍을 순회하며 변수 추출
    for (const [key, value] of Object.entries(output)) {
        // data와 metadata는 이미 처리했거나 제외 (중복 방지)
        if (key === 'data' || key === 'metadata') {
            continue; // 다음 키로 넘어감
        }

        // 표준 필드는 제외 (action, status, error, message, meta 등은 변수로 표시하지 않음)
        const standardFields = ['action', 'status', 'output', 'error', 'message', 'meta'];
        if (standardFields.includes(key)) {
            continue; // 다음 키로 넘어감
        }

        // 값의 타입 추정
        // type: 변수 타입 (null, array, object, 또는 기본 타입)
        let type = 'unknown';
        if (value === null) {
            type = 'null';
        } else if (Array.isArray(value)) {
            type = 'array';
        } else if (typeof value === 'object') {
            type = 'object';
        } else {
            type = typeof value; // string, number, boolean 등
        }

        // variables에 변수 정보 추가
        variables.push({
            key,
            value,
            type
        });
    }

    return variables;
}

/**
 * 노드 데이터에서 실행 결과 가져오기
 *
 * @param {Object} nodeData - 노드 데이터 (getNodeData로 가져온 데이터)
 * @returns {Object|null} 노드 실행 결과 (표준 형식: {action, status, output: {...}})
 */
export function getNodeResult(nodeData) {
    if (!nodeData) {
        return null;
    }

    // 우선순위: 1) result 필드, 2) output 필드 (하위 호환성)
    if (nodeData.result) {
        // 표준 형식
        return nodeData.result;
    } else if (nodeData.output) {
        // 하위 호환성: output 필드가 직접 있는 경우
        return {
            action: nodeData.type || 'unknown',
            status: 'completed',
            output: nodeData.output
        };
    }

    return null;
}

/**
 * 이전 노드들의 출력 변수 목록 수집
 *
 * @param {Array} previousNodes - 이전 노드 목록 (getPreviousNodeChain 결과)
 * @returns {Array<{nodeId: string, nodeName: string, variables: Array}>} 노드별 변수 목록
 */
export function collectPreviousNodeVariables(previousNodes) {
    if (!previousNodes || previousNodes.length === 0) {
        return [];
    }

    // nodeVariables: 노드별 변수 목록 (각 노드의 변수들을 그룹화)
    const nodeVariables = [];

    // 각 이전 노드를 순회하며 변수 추출
    for (const node of previousNodes) {
        // nodeId: 노드 ID (id 또는 nodeId 필드에서 가져옴)
        const nodeId = node.id || node.nodeId;
        // nodeData: 노드 데이터 (data 필드 또는 빈 객체)
        const nodeData = node.data || {};
        // nodeName: 노드 이름 (title 또는 type 또는 nodeId)
        const nodeName = nodeData.title || node.type || nodeId;

        // 노드 실행 결과 가져오기
        // nodeResult: 노드 실행 결과 (표준 형식: {action, status, output: {...}})
        const nodeResult = getNodeResult(nodeData);

        // nodeResult가 있으면 변수 추출
        if (nodeResult) {
            // output 변수 추출
            // variables: 추출된 변수 목록 (key, value, type 포함)
            const variables = extractOutputVariables(nodeResult);

            // 변수가 있으면 nodeVariables에 추가
            if (variables.length > 0) {
                nodeVariables.push({
                    nodeId,
                    nodeName,
                    nodeType: node.type || node.nodeType,
                    variables
                });
            }
        }
    }

    return nodeVariables;
}
