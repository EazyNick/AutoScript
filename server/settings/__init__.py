"""
설정 관련 모듈
사용자 설정을 읽어서 사용하는 헬퍼 함수들을 제공합니다.
"""

from .execution_interval import get_execution_interval
from .language import get_language
from .theme import get_theme

__all__ = [
    "get_execution_interval",
    "get_language",
    "get_theme",
]
