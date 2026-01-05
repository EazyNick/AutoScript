/**
 * 스타일 관련 상수
 * CSS 값, z-index, opacity 등을 정의합니다.
 */

export const STYLE_CONSTANTS = {
    // Opacity 값
    OPACITY_DISABLED: 0.5, // 비활성화된 요소의 투명도
    OPACITY_ENABLED: 1, // 활성화된 요소의 투명도

    // Z-index 레이어
    Z_INDEX_CANVAS: 1000, // 캔버스 레이어
    Z_INDEX_MODAL: 1001, // 모달 레이어
    Z_INDEX_TOOLTIP: 1002, // 툴팁 레이어

    // Padding 및 Spacing
    PADDING_SMALL: '10px 20px', // 작은 패딩
    PADDING_MEDIUM: '15px 30px', // 중간 패딩
    PADDING_LARGE: '20px 40px', // 큰 패딩

    // Border Radius
    BORDER_RADIUS_SMALL: '4px', // 작은 모서리 둥글기
    BORDER_RADIUS_MEDIUM: '5px', // 중간 모서리 둥글기
    BORDER_RADIUS_LARGE: '8px', // 큰 모서리 둥글기

    // Position
    CENTER_POSITION: '50%', // 중앙 위치
    CENTER_TRANSFORM: 'translateX(-50%)' // 중앙 정렬 transform
};
