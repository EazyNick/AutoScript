"""
로그 관련 API 라우터
"""

from execution_logging.execution_log_models import NodeExecutionLogRequest, NodeExecutionLogResponse
from fastapi import APIRouter, HTTPException, Query, Request

from api.response_helpers import list_response, success_response
from api.router_wrapper import api_handler
from db.database import db_manager
from log import log_manager
from models.response_models import ListResponse, SuccessResponse

router = APIRouter(prefix="/api/logs", tags=["logs"])
logger = log_manager.logger


@router.post("/node-execution", response_model=NodeExecutionLogResponse)
@api_handler
async def create_node_execution_log(request: NodeExecutionLogRequest, api_request: Request) -> NodeExecutionLogResponse:
    """
    노드 실행 로그를 생성합니다.
    wrapper에서 각 노드 실행 시 호출됩니다.
    """
    client_ip = api_request.client.host if api_request.client else "unknown"
    logger.debug(
        f"[API] 노드 실행 로그 생성 요청 - 노드 ID: {request.node_id}, 타입: {request.node_type}, 상태: {request.status}, 클라이언트 IP: {client_ip}"
    )

    try:
        log_id = db_manager.node_execution_logs.create_log(
            execution_id=request.execution_id,
            script_id=request.script_id,
            node_id=request.node_id,
            node_type=request.node_type,
            node_name=request.node_name,
            status=request.status,
            started_at=request.started_at,
            finished_at=request.finished_at,
            execution_time_ms=request.execution_time_ms,
            parameters=request.parameters,
            result=request.result,
            error_message=request.error_message,
            error_traceback=request.error_traceback,
            is_connected=request.is_connected,
            connection_sequence=request.connection_sequence,
            node_identifier=request.node_identifier,
        )

        # 통계 업데이트 (completed 또는 failed 상태일 때만, running은 제외)
        # running 상태는 나중에 completed/failed로 업데이트되므로 중복 카운팅 방지
        if request.status in ("completed", "failed"):
            try:
                db_manager.log_stats.calculate_and_update_stats()
            except Exception as stats_error:
                logger.warning(f"[API] 로그 통계 업데이트 실패 (무시): {stats_error!s}")

        logger.info(
            f"[API] 노드 실행 로그 생성 성공 - 로그 ID: {log_id}, 노드 ID: {request.node_id}, 상태: {request.status}"
        )

        return NodeExecutionLogResponse(success=True, message="노드 실행 로그가 생성되었습니다.", log_id=log_id)
    except Exception as e:
        logger.error(f"[API] 노드 실행 로그 생성 실패: {e!s}")
        raise HTTPException(status_code=500, detail=f"로그 생성 실패: {e!s}")


@router.get("/node-execution", response_model=ListResponse)
@api_handler
async def get_node_execution_logs(
    http_request: Request,
    execution_id: str | None = Query(None, description="워크플로우 실행 ID"),
    script_id: int | None = Query(None, description="스크립트 ID"),
    node_id: str | None = Query(None, description="노드 ID"),
    limit: int = Query(100, ge=1, le=1000, description="조회할 최대 개수"),
    offset: int = Query(0, ge=0, description="건너뛸 개수"),
) -> ListResponse:
    """
    노드 실행 로그를 조회합니다.
    """
    client_ip = http_request.client.host if http_request.client else "unknown"
    logger.debug(
        f"[API] 노드 실행 로그 조회 요청 - execution_id: {execution_id}, script_id: {script_id}, node_id: {node_id}, 클라이언트 IP: {client_ip}"
    )

    try:
        if execution_id:
            logs = db_manager.node_execution_logs.get_logs_by_execution_id(execution_id)
        elif script_id:
            logs = db_manager.node_execution_logs.get_logs_by_script_id(script_id, limit=limit, offset=offset)
        elif node_id:
            logs = db_manager.node_execution_logs.get_logs_by_node_id(node_id, limit=limit, offset=offset)
        else:
            logs = db_manager.node_execution_logs.get_recent_logs(limit=limit)

        logger.info(f"[API] 노드 실행 로그 조회 성공 - 로그 개수: {len(logs)}개")

        return list_response(logs, "노드 실행 로그 조회 완료")
    except Exception as e:
        logger.error(f"[API] 노드 실행 로그 조회 실패: {e!s}")
        raise HTTPException(status_code=500, detail=f"로그 조회 실패: {e!s}")


@router.get("/node-execution/failed", response_model=ListResponse)
@api_handler
async def get_failed_node_execution_logs(
    http_request: Request,
    script_id: int | None = Query(None, description="스크립트 ID (선택사항)"),
    limit: int = Query(100, ge=1, le=1000, description="조회할 최대 개수"),
) -> ListResponse:
    """
    실패한 노드 실행 로그를 조회합니다.
    """
    client_ip = http_request.client.host if http_request.client else "unknown"
    logger.debug(f"[API] 실패한 노드 실행 로그 조회 요청 - script_id: {script_id}, 클라이언트 IP: {client_ip}")

    try:
        logs = db_manager.node_execution_logs.get_failed_logs(script_id=script_id, limit=limit)

        logger.info(f"[API] 실패한 노드 실행 로그 조회 성공 - 로그 개수: {len(logs)}개")

        return list_response(logs, "실패한 노드 실행 로그 조회 완료")
    except Exception as e:
        logger.error(f"[API] 실패한 노드 실행 로그 조회 실패: {e!s}")
        raise HTTPException(status_code=500, detail=f"로그 조회 실패: {e!s}")


@router.delete("/node-execution/{log_id}", response_model=SuccessResponse)
@api_handler
async def delete_node_execution_log(log_id: int, http_request: Request) -> SuccessResponse:
    """
    특정 노드 실행 로그를 삭제합니다.
    """
    client_ip = http_request.client.host if http_request.client else "unknown"
    logger.debug(f"[API] 노드 실행 로그 삭제 요청 - 로그 ID: {log_id}, 클라이언트 IP: {client_ip}")

    try:
        deleted = db_manager.node_execution_logs.delete_log(log_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="로그를 찾을 수 없습니다.")

        # 통계 업데이트
        stats = db_manager.log_stats.calculate_and_update_stats()

        logger.info(f"[API] 노드 실행 로그 삭제 성공 - 로그 ID: {log_id}")
        return success_response(
            {"log_id": log_id, "stats": stats},
            "노드 실행 로그가 삭제되었습니다.",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[API] 노드 실행 로그 삭제 실패: {e!s}")
        raise HTTPException(status_code=500, detail=f"로그 삭제 실패: {e!s}")


@router.delete("/node-execution/execution/{execution_id}", response_model=SuccessResponse)
@api_handler
async def delete_node_execution_logs_by_execution_id(execution_id: str, http_request: Request) -> SuccessResponse:
    """
    특정 실행 ID의 모든 노드 실행 로그를 삭제합니다.
    """
    client_ip = http_request.client.host if http_request.client else "unknown"
    logger.debug(f"[API] 실행 ID별 노드 실행 로그 삭제 요청 - execution_id: {execution_id}, 클라이언트 IP: {client_ip}")

    try:
        deleted_count = db_manager.node_execution_logs.delete_logs_by_execution_id(execution_id)

        # 통계 업데이트
        stats = db_manager.log_stats.calculate_and_update_stats()

        logger.info(
            f"[API] 실행 ID별 노드 실행 로그 삭제 성공 - execution_id: {execution_id}, 삭제된 개수: {deleted_count}"
        )
        return success_response(
            {"execution_id": execution_id, "deleted_count": deleted_count, "stats": stats},
            f"{deleted_count}개의 노드 실행 로그가 삭제되었습니다.",
        )
    except Exception as e:
        logger.error(f"[API] 실행 ID별 노드 실행 로그 삭제 실패: {e!s}")
        raise HTTPException(status_code=500, detail=f"로그 삭제 실패: {e!s}")


@router.delete("/node-execution", response_model=SuccessResponse)
@api_handler
async def delete_all_node_execution_logs(http_request: Request) -> SuccessResponse:
    """
    모든 노드 실행 로그를 삭제합니다.
    """
    client_ip = http_request.client.host if http_request.client else "unknown"
    logger.debug(f"[API] 전체 노드 실행 로그 삭제 요청 - 클라이언트 IP: {client_ip}")

    try:
        deleted_count = db_manager.node_execution_logs.delete_all_logs()

        # 통계 업데이트
        stats = db_manager.log_stats.calculate_and_update_stats()

        logger.info(f"[API] 전체 노드 실행 로그 삭제 성공 - 삭제된 개수: {deleted_count}")
        return success_response(
            {"deleted_count": deleted_count, "stats": stats},
            f"모든 노드 실행 로그({deleted_count}개)가 삭제되었습니다.",
        )
    except Exception as e:
        logger.error(f"[API] 전체 노드 실행 로그 삭제 실패: {e!s}")
        raise HTTPException(status_code=500, detail=f"로그 삭제 실패: {e!s}")


@router.get("/node-execution/check-ready", response_model=SuccessResponse)
@api_handler
async def check_logs_ready(
    http_request: Request,
    execution_id: str = Query(..., description="워크플로우 실행 ID"),
    expected_status: str | None = Query(None, description="예상 상태 (completed 또는 failed)"),
) -> SuccessResponse:
    """
    execution_id의 로그가 저장 완료되었는지 확인합니다.
    서버에서 로그 저장이 완료될 때까지 대기하고 완료되면 응답합니다.
    """
    client_ip = http_request.client.host if http_request.client else "unknown"
    logger.debug(
        f"[API] 로그 저장 완료 확인 요청 - execution_id: {execution_id}, expected_status: {expected_status}, 클라이언트 IP: {client_ip}"
    )

    try:
        import asyncio
        from datetime import datetime

        # 최대 10초 대기 (재시도 포함 로그 저장 완료 대기)
        max_wait_time = 10
        check_interval = 0.2  # 0.2초마다 확인 (더 빠른 응답)
        start_time = datetime.now()
        check_count = 0

        while (datetime.now() - start_time).total_seconds() < max_wait_time:
            logs = db_manager.node_execution_logs.get_logs_by_execution_id(execution_id)
            check_count += 1

            if logs and len(logs) > 0:
                # expected_status가 지정된 경우 해당 상태의 로그 확인
                if expected_status:
                    has_expected_status = any(log.get("status") == expected_status for log in logs)
                    if has_expected_status:
                        logger.info(
                            f"[API] 로그 저장 완료 확인 성공 - execution_id: {execution_id}, 상태: {expected_status}, 로그 개수: {len(logs)}, 확인 횟수: {check_count}"
                        )
                        return success_response(
                            {
                                "execution_id": execution_id,
                                "ready": True,
                                "logs_count": len(logs),
                                "status": expected_status,
                            },
                            "로그 저장이 완료되었습니다.",
                        )
                    # expected_status가 'failed'인 경우, failed 상태 로그가 없어도 다른 최종 상태 로그가 있으면 확인
                    if expected_status == "failed":
                        # failed 로그가 없지만 최소한 다른 최종 상태 로그가 있으면, 실행이 진행 중이거나 완료된 것으로 간주
                        has_any_final = any(log.get("status") in ("completed", "failed") for log in logs)
                        if has_any_final:
                            # 최소한 로그가 저장되었으므로, failed 로그가 나중에 저장될 수 있지만 일단 완료로 간주
                            logger.info(
                                f"[API] 로그 저장 확인 (failed 로그 대기 중) - execution_id: {execution_id}, 로그 개수: {len(logs)}, 확인 횟수: {check_count}"
                            )
                else:
                    # expected_status가 없으면 로그가 있으면 완료로 간주
                    # 단, 모든 로그가 running 상태가 아닌지 확인
                    has_final_status = any(log.get("status") in ("completed", "failed") for log in logs)
                    if has_final_status:
                        logger.info(
                            f"[API] 로그 저장 완료 확인 성공 - execution_id: {execution_id}, 로그 개수: {len(logs)}, 확인 횟수: {check_count}"
                        )
                        return success_response(
                            {"execution_id": execution_id, "ready": True, "logs_count": len(logs)},
                            "로그 저장이 완료되었습니다.",
                        )

            # 아직 로그가 저장되지 않았으면 잠시 대기 후 재확인
            await asyncio.sleep(check_interval)

        # 타임아웃 (15초 내에 로그 저장이 완료되지 않음)
        logger.warning(
            f"[API] 로그 저장 완료 확인 타임아웃 (15초) - execution_id: {execution_id}, 확인 횟수: {check_count}, expected_status: {expected_status}"
        )
        # 타임아웃 발생 시 최종 확인: 로그가 있으면 저장된 것으로 간주, 없으면 저장 실패
        final_logs = db_manager.node_execution_logs.get_logs_by_execution_id(execution_id)
        if final_logs and len(final_logs) > 0:
            # expected_status가 지정된 경우 해당 상태의 로그 확인
            if expected_status:
                has_expected_status = any(log.get("status") == expected_status for log in final_logs)
                if has_expected_status:
                    logger.info(
                        f"[API] 로그 저장 완료 (타임아웃 내) - execution_id: {execution_id}, 상태: {expected_status}, 로그 개수: {len(final_logs)}"
                    )
                    return success_response(
                        {
                            "execution_id": execution_id,
                            "ready": True,
                            "logs_count": len(final_logs),
                            "status": expected_status,
                            "timeout": True,
                        },
                        "로그 저장이 완료되었습니다.",
                    )
                # expected_status가 'failed'인 경우, failed 로그가 없어도 다른 최종 상태 로그가 있으면 확인
                if expected_status == "failed":
                    # failed 로그가 없지만 최소한 다른 로그가 저장되었으므로, 로그 저장이 진행 중이거나 완료된 것으로 간주
                    has_any_final = any(log.get("status") in ("completed", "failed") for log in final_logs)
                    if has_any_final:
                        logger.info(
                            f"[API] 로그 저장 확인 (failed 로그 대기 중, 타임아웃) - execution_id: {execution_id}, 로그 개수: {len(final_logs)}"
                        )
                        return success_response(
                            {
                                "execution_id": execution_id,
                                "ready": True,
                                "logs_count": len(final_logs),
                                "status": "failed",
                                "timeout": True,
                                "note": "failed 로그가 아직 저장되지 않았을 수 있지만, 다른 로그가 저장되어 실행이 진행되었음을 확인",
                            },
                            "로그 저장이 완료되었습니다.",
                        )
            else:
                # expected_status가 없으면 최종 상태 로그 확인
                has_final_status = any(log.get("status") in ("completed", "failed") for log in final_logs)
                if has_final_status:
                    logger.info(
                        f"[API] 로그 저장 완료 (타임아웃 내) - execution_id: {execution_id}, 로그 개수: {len(final_logs)}"
                    )
                    return success_response(
                        {
                            "execution_id": execution_id,
                            "ready": True,
                            "logs_count": len(final_logs),
                            "timeout": True,
                        },
                        "로그 저장이 완료되었습니다.",
                    )
            # 로그는 있지만 expected_status와 일치하지 않거나 최종 상태가 없는 경우
            logger.warning(
                f"[API] 로그 저장 실패 (예상 상태 불일치) - execution_id: {execution_id}, 로그 개수: {len(final_logs)}, expected_status: {expected_status}"
            )
            return success_response(
                {
                    "execution_id": execution_id,
                    "ready": False,
                    "logs_count": len(final_logs),
                    "timeout": True,
                },
                "로그 저장이 완료되지 않았습니다. (예상 상태와 일치하지 않음)",
            )
        # 로그가 전혀 없는 경우
        logger.warning(f"[API] 로그 저장 실패 (로그 없음) - execution_id: {execution_id}")
        return success_response(
            {"execution_id": execution_id, "ready": False, "timeout": True},
            "로그 저장이 완료되지 않았습니다. (로그가 저장되지 않음)",
        )
    except Exception as e:
        logger.error(f"[API] 로그 저장 완료 확인 실패: {e!s}")
        raise HTTPException(status_code=500, detail=f"로그 저장 확인 실패: {e!s}")
