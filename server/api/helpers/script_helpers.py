"""
스크립트 관련 헬퍼 함수들
스크립트 조회 및 저장 관련 공통 로직을 모아서 중복을 제거합니다.
"""

from fastapi import HTTPException

from api.helpers.constants import API_CONSTANTS
from db.database import db_manager


def get_script_or_raise(script_id: int) -> dict:
    """
    스크립트를 조회하고, 없으면 404 예외를 발생시킵니다.

    Args:
        script_id: 스크립트 ID

    Returns:
        스크립트 정보 딕셔너리

    Raises:
        HTTPException: 스크립트를 찾을 수 없을 때 (404)
    """
    script = db_manager.get_script(script_id)
    if not script:
        raise HTTPException(status_code=API_CONSTANTS.HTTP_NOT_FOUND, detail=API_CONSTANTS.ERROR_SCRIPT_NOT_FOUND)
    return script


def save_script_data_or_raise(
    script_id: int, nodes: list[dict], connections: list[dict], error_message: str | None = None
) -> None:
    """
    스크립트 데이터를 저장하고, 실패하면 500 예외를 발생시킵니다.

    Args:
        script_id: 스크립트 ID
        nodes: 노드 목록
        connections: 연결 목록
        error_message: 실패 시 에러 메시지 (None이면 기본 메시지 사용)

    Raises:
        HTTPException: 저장 실패 시 (500)
    """
    success = db_manager.save_script_data(script_id, nodes, connections)
    if not success:
        message = error_message or API_CONSTANTS.ERROR_SAVE_FAILED
        raise HTTPException(status_code=API_CONSTANTS.HTTP_INTERNAL_SERVER_ERROR, detail=message)
