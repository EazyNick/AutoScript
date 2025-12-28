/**
 * 노드 아이콘 설정 파일
 * 모든 노드 타입의 아이콘을 중앙에서 관리합니다.
 * 아이콘을 변경하려면 이 파일만 수정하면 됩니다.
 */

// 노드 아이콘 매핑 객체
const NODE_ICONS = {
    // 시스템 노드
    start: '▶', // 시작 노드: 재생 아이콘
    end: '■', // 종료 노드: 정사각형 아이콘

    // 액션 노드
    action: '⚙', // 기본 액션 노드: 기어 아이콘
    'action-click': '🖱️', // 클릭 액션 노드: 마우스 아이콘
    wait: '🕐', // 대기 노드: 시계 아이콘
    'image-touch': '🖼️', // 이미지 터치 노드: 이미지 아이콘
    'process-focus': '🖥️', // 프로세스 포커스 노드: 모니터 아이콘
    'excel-open': '📊', // 엑셀 열기 노드: 차트 아이콘
    'excel-select-sheet': '📋', // 엑셀 시트 선택 노드: 클립보드 아이콘
    'excel-close': '📕', // 엑셀 닫기 노드: 책 아이콘

    // 로직 노드
    condition: '🔐', // 조건 노드: 자물쇠 아이콘
    loop: '🔁', // 반복 노드: 반복 아이콘

    // 기본/폴백
    default: '⚙' // 기본 노드: 기어 아이콘
};

/**
 * 노드 타입에 따른 아이콘 가져오기
 * @param {string} nodeType - 노드 타입
 * @param {Object} nodeData - 노드 데이터 (선택적, 클릭 노드 판별용)
 * @returns {string} 아이콘 문자
 */
function getNodeIcon(nodeType, nodeData = {}) {
    // 클릭 노드인 경우 특별 처리
    if (nodeType === 'action') {
        const isClickNode = nodeData.title && (nodeData.title.includes('클릭') || nodeData.title.includes('Click'));
        if (isClickNode) {
            return NODE_ICONS['action-click'];
        }
    }

    // 노드 타입에 맞는 아이콘 반환
    return NODE_ICONS[nodeType] || NODE_ICONS.default;
}

// 전역으로 노출 (동적 로드된 스크립트에서 사용 가능하도록)
window.NodeIcons = {
    getIcon: getNodeIcon,
    icons: NODE_ICONS
};

// ES6 모듈로도 export (모듈 방식으로 로드되는 경우)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NODE_ICONS, getNodeIcon };
}
