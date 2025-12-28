/**
 * 노드 타입별 출력 미리보기 예시 정의
 * 각 노드 타입에 대한 예시 출력을 생성하는 함수들을 정의합니다.
 */

/**
 * 노드 타입별 예시 출력 생성 함수
 * @param {string} nodeType - 노드 타입
 * @param {Object} nodeData - 노드 데이터 (파라미터 값 포함)
 * @returns {string} JSON 형식의 예시 출력 문자열
 */
export function generatePreviewOutput(nodeType, nodeData) {
    switch (nodeType) {
        case 'image-touch':
            return generateImageTouchOutput(nodeData);

        case 'click':
            return generateClickOutput(nodeData);

        case 'process-focus':
            return generateProcessFocusOutput(nodeData);

        case 'condition':
            return generateConditionOutput(nodeData);

        default:
            return generateDefaultOutput(nodeType);
    }
}

/**
 * 이미지 터치 노드 예시 출력
 */
function generateImageTouchOutput(nodeData) {
    const folderPath = nodeData?.folder_path || 'C:/images/example';
    return JSON.stringify(
        {
            success: true,
            folder_path: folderPath,
            total_images: 3,
            results: [
                {
                    image: 'image1.png',
                    found: true,
                    position: [100, 200],
                    touched: true
                },
                {
                    image: 'image2.png',
                    found: true,
                    position: [300, 400],
                    touched: true
                },
                {
                    image: 'image3.png',
                    found: false,
                    message: '화면에서 이미지를 찾을 수 없습니다.'
                }
            ]
        },
        null,
        2
    );
}

/**
 * 클릭 노드 예시 출력
 */
function generateClickOutput(nodeData) {
    return JSON.stringify(
        {
            action: 'click',
            status: 'completed',
            output: {
                x: nodeData?.x || 100,
                y: nodeData?.y || 200,
                clicked: true
            }
        },
        null,
        2
    );
}

/**
 * 프로세스 포커스 노드 예시 출력
 */
function generateProcessFocusOutput(nodeData) {
    return JSON.stringify(
        {
            action: 'process-focus',
            status: 'completed',
            output: {
                success: true,
                process_id: nodeData?.process_id || 1234,
                process_name: nodeData?.process_name || 'example.exe',
                hwnd: nodeData?.hwnd || 5678,
                window_title: nodeData?.window_title || 'Example Window'
            }
        },
        null,
        2
    );
}

/**
 * 조건 노드 예시 출력
 */
function generateConditionOutput(nodeData) {
    const condition = nodeData?.condition || '${variable} > 10';
    return JSON.stringify(
        {
            action: 'condition',
            status: 'completed',
            output: {
                condition: condition,
                result: true
            }
        },
        null,
        2
    );
}

/**
 * 기본 노드 예시 출력
 */
function generateDefaultOutput(nodeType) {
    return JSON.stringify(
        {
            action: nodeType,
            status: 'completed',
            output: '정상 실행 시 출력 예시'
        },
        null,
        2
    );
}
