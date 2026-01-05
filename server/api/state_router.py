"""
애플리케이션 상태 관련 API 라우터
"""

from fastapi import APIRouter

from api.helpers import success_response
from models.response_models import SuccessResponse

router = APIRouter(prefix="/api", tags=["state"])


@router.get("/state", response_model=SuccessResponse)
async def get_application_state() -> SuccessResponse:
    """
    현재 애플리케이션 상태를 반환합니다.
    """
    return success_response(
        {"application_running": True, "current_scene": "main_menu", "status": "active"},
        "애플리케이션 상태 조회 완료",
    )
