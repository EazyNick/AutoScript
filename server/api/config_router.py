"""
설정 관련 API 라우터
환경 변수 및 서버 설정 정보 제공
사용자 설정 저장/로드 기능 포함
"""

from typing import Any

from fastapi import APIRouter, Body, HTTPException, Request

from api.helpers import success_response
from config.nodes_config import NODES_CONFIG
from config.server_config import settings
from db.database import db_manager
from log import log_manager
from models.response_models import SuccessResponse

router = APIRouter(prefix="/api/config", tags=["config"])
logger = log_manager.logger


@router.get("/", response_model=SuccessResponse)
async def get_config() -> SuccessResponse:
    """서버 설정 정보 조회 (server_config 기반)"""
    logger.info(f"[API] 설정 조회 요청 - DEV_MODE: {settings.DEV_MODE}")

    # 보안: ENVIRONMENT는 서버 내부 정보이므로 클라이언트에 노출하지 않음
    return success_response({"dev_mode": settings.DEV_MODE}, "설정 조회 완료")


@router.get("/nodes", response_model=SuccessResponse)
async def get_nodes_config() -> SuccessResponse:
    """노드 설정 정보 조회"""
    logger.info("[API] 노드 설정 조회 요청")

    # 클라이언트용으로 변환 (snake_case -> camelCase)
    nodes_config_client = {}
    for node_type, config in NODES_CONFIG.items():
        nodes_config_client[node_type] = {
            "label": config.get("label"),
            "title": config.get("title"),
            "description": config.get("description"),
            "script": config.get("script"),
            "isBoundary": config.get("is_boundary", False),
            "category": config.get("category"),
        }
        # 추가 속성이 있으면 포함
        if "requires_folder_path" in config:
            nodes_config_client[node_type]["requiresFolderPath"] = config["requires_folder_path"]

        # 노드 레벨 파라미터가 있으면 포함
        if "parameters" in config:
            nodes_config_client[node_type]["parameters"] = config["parameters"]

        # 입력/출력 스키마 포함 (미리보기 생성에 필요, 클라이언트 코드가 snake_case를 사용하므로 그대로 전달)
        if "input_schema" in config:
            nodes_config_client[node_type]["input_schema"] = config["input_schema"]
        if "output_schema" in config:
            nodes_config_client[node_type]["output_schema"] = config["output_schema"]

        # 상세 노드 타입이 있으면 포함 (대분류 노드 타입 아래의 하위 카테고리)
        if "detail_types" in config:
            detail_types_client = {}
            for detail_type_key, detail_type_config in config["detail_types"].items():
                detail_types_client[detail_type_key] = {
                    "label": detail_type_config.get("label"),
                    "description": detail_type_config.get("description"),
                    "icon": detail_type_config.get("icon", ""),
                }
                # 상세 노드 타입 레벨 파라미터가 있으면 포함
                if "parameters" in detail_type_config:
                    detail_types_client[detail_type_key]["parameters"] = detail_type_config["parameters"]
            nodes_config_client[node_type]["detailTypes"] = detail_types_client

    return success_response({"nodes": nodes_config_client}, "노드 설정 조회 완료")


@router.get("/user-settings", response_model=SuccessResponse)
async def get_user_settings(request: Request) -> SuccessResponse:
    """모든 사용자 설정 조회"""
    client_ip = request.client.host if request.client else "unknown"
    logger.info(f"[API] 사용자 설정 조회 요청 - 클라이언트 IP: {client_ip}")

    try:
        user_settings = db_manager.get_all_user_settings()
        logger.info(f"[API] 사용자 설정 조회 성공 - 설정 개수: {len(user_settings)}개")
        return success_response(user_settings, "사용자 설정 조회 완료")
    except Exception as e:
        logger.error(f"[API] 사용자 설정 조회 실패: {e!s}")
        raise HTTPException(status_code=500, detail=f"사용자 설정 조회 실패: {e!s}")


@router.get("/user-settings/{setting_key}", response_model=SuccessResponse)
async def get_user_setting(setting_key: str, request: Request) -> SuccessResponse:
    """특정 사용자 설정 조회"""
    client_ip = request.client.host if request.client else "unknown"
    logger.info(f"[API] 사용자 설정 조회 요청 - 키: {setting_key}, 클라이언트 IP: {client_ip}")

    try:
        value = db_manager.get_user_setting(setting_key)
        if value is None:
            # 설정이 없는 것은 정상적인 경우이므로 info 레벨로 로깅
            logger.info(f"[API] 사용자 설정을 찾을 수 없음 (처음 사용 시) - 키: {setting_key}")
            raise HTTPException(status_code=404, detail=f"설정 '{setting_key}'를 찾을 수 없습니다.")

        logger.info(f"[API] 사용자 설정 조회 성공 - 키: {setting_key}")
        return success_response({"key": setting_key, "value": value}, "사용자 설정 조회 완료")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[API] 사용자 설정 조회 실패 - 키: {setting_key}, 에러: {e!s}")
        raise HTTPException(status_code=500, detail=f"사용자 설정 조회 실패: {e!s}")


@router.put("/user-settings/{setting_key}", response_model=SuccessResponse)
async def save_user_setting(setting_key: str, request: Request, body: dict[str, Any] = Body(...)) -> SuccessResponse:
    """사용자 설정 저장"""
    client_ip = request.client.host if request.client else "unknown"
    setting_value = body.get("value", "")

    logger.info(f"[API] 사용자 설정 저장 요청 - 키: {setting_key}, 값: {setting_value}, 클라이언트 IP: {client_ip}")

    try:
        # 값이 문자열이 아니면 JSON으로 변환
        if not isinstance(setting_value, str):
            import json

            setting_value = json.dumps(setting_value, ensure_ascii=False)

        success = db_manager.save_user_setting(setting_key, setting_value)
        if success:
            logger.info(f"[API] 사용자 설정 저장 성공 - 키: {setting_key}")
            return success_response({"key": setting_key, "value": setting_value}, "설정이 저장되었습니다.")
        raise HTTPException(status_code=500, detail="설정 저장 실패")
    except Exception as e:
        logger.error(f"[API] 사용자 설정 저장 실패 - 키: {setting_key}, 에러: {e!s}")
        raise HTTPException(status_code=500, detail=f"사용자 설정 저장 실패: {e!s}")


@router.delete("/user-settings/{setting_key}", response_model=SuccessResponse)
async def delete_user_setting(setting_key: str, request: Request) -> SuccessResponse:
    """사용자 설정 삭제"""
    client_ip = request.client.host if request.client else "unknown"
    logger.info(f"[API] 사용자 설정 삭제 요청 - 키: {setting_key}, 클라이언트 IP: {client_ip}")

    try:
        success = db_manager.delete_user_setting(setting_key)
        if success:
            logger.info(f"[API] 사용자 설정 삭제 성공 - 키: {setting_key}")
            return success_response({"key": setting_key}, "설정이 삭제되었습니다.")
        raise HTTPException(status_code=404, detail=f"설정 '{setting_key}'를 찾을 수 없습니다.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[API] 사용자 설정 삭제 실패 - 키: {setting_key}, 에러: {e!s}")
        raise HTTPException(status_code=500, detail=f"사용자 설정 삭제 실패: {e!s}")
