"""
API 상수 정의
유지보수를 위해 하드코딩된 수치들을 상수로 정의합니다.
"""


class API_CONSTANTS:
    """API 관련 상수"""

    # HTTP 상태 코드
    HTTP_NOT_FOUND = 404
    HTTP_INTERNAL_SERVER_ERROR = 500

    # 로그 조회 제한
    DEFAULT_LOG_LIMIT = 100
    MIN_LOG_LIMIT = 1
    MAX_LOG_LIMIT = 1000

    # 대시보드 통계 캐시 시간 (분)
    DASHBOARD_STATS_CACHE_MINUTES = 5

    # HTTP 상태 코드 - 클라이언트 에러
    HTTP_BAD_REQUEST = 400

    # 로그 저장 확인 대기 시간 (초)
    LOG_SAVE_CHECK_MAX_WAIT_TIME = 10
    LOG_SAVE_CHECK_INTERVAL = 0.2  # 0.2초마다 확인

    # 실행 시간 계산 (밀리초 변환)
    MILLISECONDS_PER_SECOND = 1000

    # 에러 메시지
    ERROR_SCRIPT_NOT_FOUND = "스크립트를 찾을 수 없습니다."
    ERROR_NODE_NOT_FOUND = "노드를 찾을 수 없습니다."
    ERROR_SAVE_FAILED = "저장 실패"
    ERROR_NODE_CREATE_FAILED = "노드 생성 실패"
    ERROR_NODE_UPDATE_FAILED = "노드 업데이트 실패"
    ERROR_NODE_DELETE_FAILED = "노드 삭제 실패"
    ERROR_NODE_SAVE_FAILED = "노드 저장 실패"
    ERROR_SCRIPT_UPDATE_FAILED = "스크립트 업데이트 실패"
    ERROR_SCRIPT_DELETE_FAILED = "스크립트 삭제 실패"
    ERROR_SCRIPT_LIST_FAILED = "스크립트 목록 조회 실패"
    ERROR_SCRIPT_GET_FAILED = "스크립트 조회 실패"
    ERROR_SCRIPT_CREATE_FAILED = "스크립트 생성 실패"
    ERROR_SCRIPT_EXECUTE_FAILED = "스크립트 실행 실패"
    ERROR_SCRIPT_ACTIVE_STATE_FAILED = "스크립트 활성 상태 변경 실패"
    ERROR_SCRIPT_EXECUTION_RECORD_FAILED = "스크립트 실행 기록 저장 실패"
    ERROR_SCRIPT_ORDER_UPDATE_FAILED = "스크립트 순서 업데이트 실패"
    ERROR_LOG_CREATE_FAILED = "로그 생성 실패"
    ERROR_LOG_GET_FAILED = "로그 조회 실패"
    ERROR_LOG_DELETE_FAILED = "로그 삭제 실패"
    ERROR_LOG_SAVE_CHECK_FAILED = "로그 저장 확인 실패"
    ERROR_SERVER_INTERNAL_ERROR = "서버 내부 오류"
