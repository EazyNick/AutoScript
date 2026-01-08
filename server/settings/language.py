"""
언어 설정 관련 모듈
언어 설정을 조회하는 함수를 제공합니다.
"""

from db.database import db_manager
from log import log_manager

logger = log_manager.logger


def get_language(default: str = "en") -> str:
    """
    언어 설정을 조회합니다.

    Args:
        default: 기본 언어 값 (설정이 없을 때 반환할 값, 기본값: "en")

    Returns:
        언어 값 ("en", "ko" 등). 설정이 없으면 default 값 반환
    """
    try:
        # DB에서 설정 조회
        language = db_manager.get_user_setting("language", default)

        if language is None:
            logger.debug(f"[Settings] 언어 설정이 없어 기본값 사용: {default}")
            return default

        logger.debug(f"[Settings] 언어 조회 성공: {language}")
        return language
    except Exception as e:
        logger.error(f"[Settings] 언어 조회 중 오류 발생: {e}, 기본값 {default} 사용")
        return default
