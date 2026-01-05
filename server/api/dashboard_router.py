"""
대시보드 관련 API 라우터
"""

from fastapi import APIRouter, Body, HTTPException, Request

from api.helpers import success_response
from db.database import db_manager
from log import log_manager
from models.response_models import SuccessResponse

router = APIRouter(prefix="/api", tags=["dashboard"])
logger = log_manager.logger


@router.get("/dashboard/stats", response_model=SuccessResponse)
async def get_dashboard_stats(request: Request, use_cache: bool = True) -> SuccessResponse:
    """
    대시보드 통계 조회

    Args:
        request: HTTP 요청 객체
        use_cache: 캐시 사용 여부 (기본값: True)
    """
    client_ip = request.client.host if request.client else "unknown"
    logger.info(f"[API] 대시보드 통계 조회 요청 - 클라이언트 IP: {client_ip}, 캐시 사용: {use_cache}")

    try:
        # 캐시 우선 조회 또는 강제 재계산
        stats = db_manager.get_dashboard_stats(use_cache=use_cache)
        logger.info(f"[API] 대시보드 통계 조회 성공: {stats}")
        return success_response(stats, "대시보드 통계 조회 완료")
    except Exception as e:
        logger.error(f"[API] 대시보드 통계 조회 실패: {e!s}")
        raise HTTPException(status_code=500, detail=f"대시보드 통계 조회 실패: {e!s}")


@router.post("/dashboard/execution-summary", response_model=SuccessResponse)
async def record_execution_summary(request: Request, summary: dict = Body(...)) -> SuccessResponse:
    """
    전체 실행 요약 정보 저장

    Args:
        request: HTTP 요청 객체
        summary: 실행 요약 정보 {total_executions: int, failed_count: int}
    """
    client_ip = request.client.host if request.client else "unknown"
    logger.info(f"[API] 전체 실행 요약 정보 저장 요청 - 클라이언트 IP: {client_ip}, 요약: {summary}")

    try:
        total_executions = summary.get("total_executions", 0)
        failed_count = summary.get("failed_count", 0)

        # 전체 실행 통계를 직접 저장 (오늘 기준이 아닌 전체 실행 기준)
        db_manager.set_all_execution_stats(total_executions, failed_count)

        logger.info(f"[API] 전체 실행 요약 정보 저장 완료 - 총 실행: {total_executions}, 실패: {failed_count}")
        return success_response(
            {"total_executions": total_executions, "failed_count": failed_count}, "전체 실행 요약 정보 저장 완료"
        )
    except Exception as e:
        logger.error(f"[API] 전체 실행 요약 정보 저장 실패: {e!s}")
        raise HTTPException(status_code=500, detail=f"전체 실행 요약 정보 저장 실패: {e!s}")


@router.post("/dashboard/increment-execution", response_model=SuccessResponse)
async def increment_execution_count(request: Request, data: dict = Body(...)) -> SuccessResponse:
    """
    전체 실행 횟수 증가 (각 스크립트 실행 후 호출)

    Args:
        request: HTTP 요청 객체
        data: {success: bool} - 성공 여부
    """
    client_ip = request.client.host if request.client else "unknown"
    logger.info(f"[API] 전체 실행 횟수 증가 요청 - 클라이언트 IP: {client_ip}, 성공: {data.get('success', False)}")

    try:
        is_success = data.get("success", True)
        current_stats = db_manager.get_dashboard_stats(use_cache=False)

        # 현재 통계 가져오기 (None 체크 및 타입 보장)
        current_executions = current_stats.get("all_executions", 0) or 0
        current_failed = current_stats.get("all_failed_scripts", 0) or 0

        # 타입 보장 (int로 변환)
        current_executions = int(current_executions)
        current_failed = int(current_failed)

        # 통계 증가
        new_executions = current_executions + 1
        new_failed = current_failed + (0 if is_success else 1)

        # 통계 업데이트
        db_manager.set_all_execution_stats(new_executions, new_failed)

        logger.info(f"[API] 전체 실행 횟수 증가 완료 - 총 실행: {new_executions}, 실패: {new_failed}")
        return success_response(
            {"all_executions": new_executions, "all_failed_scripts": new_failed}, "전체 실행 횟수 증가 완료"
        )
    except Exception as e:
        logger.error(f"[API] 전체 실행 횟수 증가 실패: {e!s}")
        raise HTTPException(status_code=500, detail=f"전체 실행 횟수 증가 실패: {e!s}")


@router.post("/dashboard/reset-execution-stats", response_model=SuccessResponse)
async def reset_execution_stats(request: Request) -> SuccessResponse:
    """
    전체 실행 통계 초기화 (전체 실행 시작 시 호출)

    Args:
        request: HTTP 요청 객체
    """
    client_ip = request.client.host if request.client else "unknown"
    logger.info(f"[API] 전체 실행 통계 초기화 요청 - 클라이언트 IP: {client_ip}")

    try:
        # 통계를 0으로 초기화
        db_manager.set_all_execution_stats(0, 0)

        logger.info("[API] 전체 실행 통계 초기화 완료")
        return success_response({"all_executions": 0, "all_failed_scripts": 0}, "전체 실행 통계 초기화 완료")
    except Exception as e:
        logger.error(f"[API] 전체 실행 통계 초기화 실패: {e!s}")
        raise HTTPException(status_code=500, detail=f"전체 실행 통계 초기화 실패: {e!s}")
