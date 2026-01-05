/**
 * 타이밍 관련 상수
 * setTimeout, setInterval 등에서 사용하는 지연 시간을 정의합니다.
 */

export const TIMING_CONSTANTS = {
    // 일반적인 지연 시간 (ms)
    SHORT_DELAY: 10, // 매우 짧은 지연 (즉시 실행 직후)
    DEFAULT_DELAY: 50, // 기본 지연 시간
    MEDIUM_DELAY: 100, // 중간 지연 시간
    LONG_DELAY: 600, // 긴 지연 시간 (롱터치 등)

    // 캐시 및 업데이트 간격
    CANVAS_RECT_CACHE_DURATION: 100, // 캔버스 바운딩 박스 캐시 유지 시간 (ms)
    CONNECTION_UPDATE_INTERVAL: 16, // 연결선 업데이트 간격 (약 60fps)
    DOM_UPDATE_DELAY: 100, // DOM 업데이트 완료 대기 시간 (ms)

    // 재시도 및 확인
    MAX_RETRY_ATTEMPTS: 20, // 최대 재시도 횟수
    RETRY_CHECK_INTERVAL: 50, // 재시도 확인 간격 (ms)
    MAX_NODE_CHECK_ATTEMPTS: 20, // 노드 확인 최대 횟수 (약 1초)

    // 롱터치 및 제스처
    LONG_TOUCH_DELAY: 600 // 롱터치 인식 지연 시간 (ms)
};
