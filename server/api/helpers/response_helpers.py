"""
API 응답 헬퍼 함수
일관된 응답 형식을 쉽게 생성하기 위한 유틸리티 함수들
"""

from typing import Any

from models.response_models import ErrorResponse, ListResponse, SuccessResponse


def success_response(
    data: Any = None,
    message: str | None = None,
    **kwargs: Any,
) -> SuccessResponse:
    """
    성공 응답 생성

    Args:
        data: 응답에 포함할 데이터 (dict, list, 또는 단일 값)
        message: 성공 메시지
        **kwargs: 추가 필드 (data가 dict인 경우 병합됨)

    Returns:
        SuccessResponse: 성공 응답 모델

    Examples:
        >>> success_response({"id": 1, "name": "test"}, "생성 완료")
        >>> success_response([1, 2, 3], "조회 완료")
        >>> success_response(message="업데이트 완료", updated_count=5)
    """
    if data is None:
        response_data = kwargs if kwargs else None
    elif isinstance(data, dict):
        # dict인 경우 kwargs와 병합
        response_data = {**data, **kwargs} if kwargs else data
    else:
        # 단일 값이나 list인 경우 result 필드에 포함
        response_data = {"result": data, **kwargs} if kwargs else {"result": data}

    return SuccessResponse(success=True, message=message, data=response_data)


def error_response(
    message: str,
    error: str | None = None,
    error_code: str | None = None,
) -> ErrorResponse:
    """
    에러 응답 생성 (비즈니스 로직 에러용)

    주의: HTTP 에러(4xx, 5xx)는 HTTPException을 사용해야 합니다.

    Args:
        message: 에러 메시지
        error: 상세 에러 정보
        error_code: 에러 코드

    Returns:
        ErrorResponse: 에러 응답 모델

    Examples:
        >>> error_response("노드 실행 실패", "타임아웃 발생", "NODE_TIMEOUT")
    """
    return ErrorResponse(
        success=False,
        message=message,
        error=error or message,
        error_code=error_code,
    )


def list_response(
    items: list[Any],
    message: str | None = None,
    **kwargs: Any,
) -> ListResponse:
    """
    리스트 응답 생성

    Args:
        items: 응답에 포함할 리스트 데이터
        message: 성공 메시지
        **kwargs: 추가 필드

    Returns:
        ListResponse: 리스트 응답 모델

    Examples:
        >>> list_response([{"id": 1}, {"id": 2}], "조회 완료")
        >>> list_response(scripts, "스크립트 목록", total=10)
    """
    return ListResponse(
        success=True,
        message=message,
        data=items,
        count=len(items),
        **kwargs,
    )
