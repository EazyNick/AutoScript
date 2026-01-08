"""
스크립트 실행 간격 설정 관련 모듈
각 스크립트 간의 실행 간격을 조회하는 함수를 제공합니다.
"""

from db.database import db_manager
from log import log_manager

logger = log_manager.logger


def get_execution_interval() -> float:
    """
    스크립트 실행 간격 설정을 조회합니다.

    스크립트 실행 간격(execution interval)은 각 스크립트 실행 사이에
    대기할 시간을 설정합니다. 이는 여러 스크립트를 연속으로 실행할 때
    각 스크립트 사이에 일정한 간격을 두어 시스템 부하를 줄이고
    안정적인 실행을 보장합니다.
    예를 들어:
    - 전체 실행 시 여러 스크립트를 순차 실행할 때 각 스크립트 사이에 간격 적용
    - 워크플로우 실행 시 노드 간 간격 적용

    Returns:
        스크립트 실행 간격 값 (초 단위, float). 설정이 없으면 0.1초 반환
    """
    try:
        # DB에서 설정 조회
        interval_str = db_manager.get_user_setting("execution.scriptInterval")

        if interval_str is None:
            # 설정이 없으면 기본값 0.1초 반환
            logger.debug("[Settings] 스크립트 실행 간격 설정이 없어 기본값 0.1초 사용")
            return 0.1

        # 문자열을 float로 변환
        try:
            interval = float(interval_str)
            # 음수나 0 이하 값은 기본값으로 처리
            if interval <= 0:
                logger.warning(f"[Settings] 잘못된 스크립트 실행 간격 값: {interval}, 기본값 0.1초 사용")
                return 0.1
            logger.debug(f"[Settings] 스크립트 실행 간격 조회 성공: {interval}초")
            return interval
        except (ValueError, TypeError):
            logger.warning(f"[Settings] 스크립트 실행 간격 값 변환 실패: {interval_str}, 기본값 0.1초 사용")
            return 0.1
    except Exception as e:
        logger.error(f"[Settings] 스크립트 실행 간격 조회 중 오류 발생: {e}, 기본값 0.1초 사용")
        return 0.1
