"""
API 라우터 래퍼
공통 에러 처리 및 응답 포맷팅을 제공합니다.
"""

from collections.abc import Awaitable, Callable
from functools import wraps
from typing import ParamSpec, TypeVar

from fastapi import HTTPException

from api.helpers.constants import API_CONSTANTS
from log import log_manager

logger = log_manager.logger

# 제네릭 타입 변수 정의
# P: ParamSpec - 함수의 매개변수 스펙(인자 타입, 키워드 인자 타입 등)을 나타냅니다.
#    데코레이터가 원본 함수의 매개변수 타입을 보존하기 위해 사용됩니다.
#    예: func(a: int, b: str) -> bool인 경우, P는 (int, str)을 나타냅니다.
# R: TypeVar - 함수의 반환 타입을 나타냅니다.
#    데코레이터가 원본 함수의 반환 타입을 보존하기 위해 사용됩니다.
#    예: func() -> Dict[str, Any]인 경우, R은 Dict[str, Any]를 나타냅니다.
P = ParamSpec("P")
R = TypeVar("R")


def api_handler(func: Callable[P, Awaitable[R]]) -> Callable[P, Awaitable[R]]:
    """
    API 엔드포인트 핸들러를 래핑하는 데코레이터

    공통 기능:
    - HTTPException 자동 재발생
    - 일반 예외를 HTTPException으로 변환
    - 에러 로깅

    Usage:
        @router.get("/endpoint")
        @api_handler
        async def my_endpoint():
            # 엔드포인트 로직
            return result
    """

    @wraps(func)
    async def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        try:
            return await func(*args, **kwargs)
        except HTTPException:
            # HTTPException은 그대로 재발생
            raise
        except Exception as e:
            # 일반 예외는 로깅 후 HTTPException으로 변환
            logger.error(f"API 엔드포인트 오류 ({func.__name__}): {e}")
            import traceback

            logger.error(f"스택 트레이스: {traceback.format_exc()}")
            raise HTTPException(
                status_code=API_CONSTANTS.HTTP_INTERNAL_SERVER_ERROR,
                detail=f"{API_CONSTANTS.ERROR_SERVER_INTERNAL_ERROR}: {e!s}",
            )

    return wrapper
