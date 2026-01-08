"""
테마 설정 관련 모듈
테마 설정을 조회하는 함수를 제공합니다.
"""

from db.database import db_manager
from log import log_manager

logger = log_manager.logger


def get_theme(default: str = "dark") -> str:
    """
    테마 설정을 조회합니다.

    Args:
        default: 기본 테마 값 (설정이 없을 때 반환할 값, 기본값: "dark")

    Returns:
        테마 값 ("light", "dark", "system" 중 하나). 설정이 없으면 default 값 반환
    """
    try:
        # DB에서 설정 조회
        theme = db_manager.get_user_setting("theme", default)

        if theme is None:
            logger.debug(f"[Settings] 테마 설정이 없어 기본값 사용: {default}")
            return default

        # 유효한 테마 값인지 확인
        valid_themes = ["light", "dark", "system"]
        if theme not in valid_themes:
            logger.warning(f"[Settings] 잘못된 테마 값: {theme}, 기본값 {default} 사용")
            return default

        logger.debug(f"[Settings] 테마 조회 성공: {theme}")
        return theme
    except Exception as e:
        logger.error(f"[Settings] 테마 조회 중 오류 발생: {e}, 기본값 {default} 사용")
        return default
