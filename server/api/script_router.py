"""
스크립트 관련 API 라우터
"""

from typing import Any

from fastapi import APIRouter, Body, HTTPException, Request

from api.response_helpers import error_response, list_response, success_response
from db.database import db_manager
from log import log_manager
from models import (
    BaseResponse,
    NodeExecutionRequest,
    ScriptCreateRequest,
    ScriptResponse,
    ScriptUpdateRequest,
    StandardResponseType,
)
from models.response_models import ListResponse, SuccessResponse
from services import action_service

router = APIRouter(prefix="/api", tags=["scripts"])
logger = log_manager.logger


@router.get("/scripts", response_model=ListResponse)
async def get_all_scripts(request: Request) -> ListResponse:
    """모든 스크립트 목록 조회"""
    client_ip = request.client.host if request.client else "unknown"
    logger.info(f"[API] 스크립트 목록 조회 요청 받음 - 클라이언트 IP: {client_ip}")

    try:
        logger.info("[DB 조회] 모든 스크립트 목록 조회 시작")
        scripts = db_manager.get_all_scripts()
        logger.info(f"[DB 조회] 스크립트 목록 조회 완료 - 스크립트 개수: {len(scripts)}개")
        logger.debug(f"[DB 조회] 스크립트 목록 상세: {[{'id': s.get('id'), 'name': s.get('name')} for s in scripts]}")
        logger.info(f"[API] 스크립트 목록 조회 성공 - 스크립트 개수: {len(scripts)}개")
        return list_response(scripts, "스크립트 목록 조회 완료")
    except Exception as e:
        logger.error(f"[API] 스크립트 목록 조회 실패: {e!s}")
        raise HTTPException(status_code=500, detail=f"스크립트 목록 조회 실패: {e!s}")


@router.get("/scripts/{script_id}", response_model=ScriptResponse)
async def get_script(script_id: int, request: Request) -> dict[str, Any]:
    """특정 스크립트 조회 (노드 및 연결 정보 포함)"""
    client_ip = request.client.host if request.client else "unknown"
    logger.info(f"[API] 스크립트 조회 요청 받음 - 스크립트 ID: {script_id}, 클라이언트 IP: {client_ip}")

    try:
        logger.info(f"[DB 조회] 스크립트 조회 시작 - 스크립트 ID: {script_id}")
        script = db_manager.get_script(script_id)
        if not script:
            logger.warning(f"[DB 조회] 스크립트를 찾을 수 없음 - 스크립트 ID: {script_id}")
            logger.warning(f"[API] 스크립트를 찾을 수 없음 - 스크립트 ID: {script_id}")
            raise HTTPException(status_code=404, detail="스크립트를 찾을 수 없습니다.")

        script_name = script.get("name", "N/A")
        nodes_count = len(script.get("nodes", []))
        connections_count = len(script.get("connections", []))

        logger.info(f"[DB 조회] 스크립트 조회 완료 - 스크립트 ID: {script_id}, 이름: {script_name}")
        logger.info(f"[DB 조회] 노드 개수: {nodes_count}개, 연결 개수: {connections_count}개")

        # 노드별 연결 정보 로그
        if script.get("nodes"):
            logger.debug(
                f"[DB 조회] 노드 목록: {[{'id': n.get('id'), 'type': n.get('type')} for n in script.get('nodes', [])]}"
            )
            nodes_with_connections = [
                n for n in script.get("nodes", []) if n.get("connected_to") or n.get("connected_from")
            ]
            if nodes_with_connections:
                logger.info(f"[DB 조회] 연결 정보가 있는 노드 개수: {len(nodes_with_connections)}개")
                for node in nodes_with_connections:
                    logger.debug(
                        f"[DB 조회] 노드 {node.get('id')}: connected_to={node.get('connected_to')}, connected_from={node.get('connected_from')}"
                    )

        if script.get("connections"):
            logger.debug(
                f"[DB 조회] 연결 목록: {[{'from': c.get('from'), 'to': c.get('to')} for c in script.get('connections', [])]}"
            )
        else:
            logger.warning("[DB 조회] ⚠️ 연결 목록이 비어있습니다.")

        logger.info(
            f"[API] 스크립트 조회 성공 - 스크립트 ID: {script_id}, 이름: {script_name}, 노드: {nodes_count}개, 연결: {connections_count}개"
        )
        return script
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[API] 스크립트 조회 실패 - 스크립트 ID: {script_id}, 에러: {e!s}")
        raise HTTPException(status_code=500, detail=f"스크립트 조회 실패: {e!s}")


@router.post("/scripts", response_model=SuccessResponse)
async def create_script(request: ScriptCreateRequest, http_request: Request) -> SuccessResponse:
    """새 스크립트 생성"""
    client_ip = http_request.client.host if http_request.client else "unknown"
    logger.info(
        f"[API] 스크립트 생성 요청 받음 - 이름: {request.name}, 설명: {request.description}, 클라이언트 IP: {client_ip}"
    )

    try:
        logger.info(f"[DB 저장] 스크립트 생성 시작 - 이름: {request.name}")
        description = request.description or ""
        script_id = db_manager.create_script(request.name, description)
        logger.info(f"[DB 저장] 스크립트 생성 완료 - 스크립트 ID: {script_id}, 이름: {request.name}")

        # 대시보드 통계 업데이트 (전체 워크플로우 개수)
        try:
            db_manager.update_stat("total_scripts")
            logger.info("[DB 통계] 전체 워크플로우 통계 업데이트 완료")
        except Exception as e:
            logger.warning(f"[DB 통계] 통계 업데이트 실패 (무시): {e!s}")

        # 생성된 스크립트 정보 조회 (클라이언트에서 목록에 추가하기 위해)
        logger.info(f"[DB 조회] 생성된 스크립트 정보 조회 시작 - 스크립트 ID: {script_id}")
        created_script = db_manager.get_script(script_id)
        if not created_script:
            logger.warning(f"[DB 조회] 생성된 스크립트를 찾을 수 없음 - 스크립트 ID: {script_id}")
            # 스크립트 정보가 없어도 기본 정보로 응답
            created_script = {
                "id": script_id,
                "name": request.name,
                "description": request.description,
                "created_at": None,
                "updated_at": None,
            }
        else:
            logger.info(
                f"[DB 조회] 생성된 스크립트 정보 조회 완료 - 스크립트 ID: {script_id}, 이름: {created_script.get('name', 'N/A')}"
            )

        logger.info(f"[API] 스크립트 생성 성공 - 스크립트 ID: {script_id}, 이름: {request.name}")
        return success_response(
            {
                "id": created_script.get("id", script_id),
                "name": created_script.get("name", request.name),
                "description": created_script.get("description", request.description),
                "created_at": created_script.get("created_at"),
                "updated_at": created_script.get("updated_at"),
            },
            "스크립트가 생성되었습니다.",
        )
    except ValueError as e:
        logger.error(f"[API] 스크립트 생성 실패 (중복 이름) - 이름: {request.name}, 에러: {e!s}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"[API] 스크립트 생성 실패 - 이름: {request.name}, 에러: {e!s}")
        raise HTTPException(status_code=500, detail=f"스크립트 생성 실패: {e!s}")


@router.put("/scripts/{script_id}", response_model=SuccessResponse)
async def update_script(script_id: int, request: ScriptUpdateRequest) -> SuccessResponse:
    """스크립트 업데이트"""
    try:
        # 스크립트 존재 확인
        logger.info(f"[DB 조회] 스크립트 조회 시작 - 스크립트 ID: {script_id}")
        script = db_manager.get_script(script_id)
        if not script:
            logger.warning(f"[DB 조회] 스크립트를 찾을 수 없음 - 스크립트 ID: {script_id}")
            raise HTTPException(status_code=404, detail="스크립트를 찾을 수 없습니다.")
        logger.info(f"[DB 조회] 스크립트 조회 완료 - 스크립트 ID: {script_id}")

        # 노드와 연결 정보 저장
        logger.info(
            f"[DB 저장] 스크립트 데이터 저장 시작 - 스크립트 ID: {script_id}, 노드 개수: {len(request.nodes)}, 연결 개수: {len(request.connections)}"
        )
        success = db_manager.save_script_data(script_id, request.nodes, request.connections)
        logger.info(f"[DB 저장] 스크립트 데이터 저장 완료 - 스크립트 ID: {script_id}")

        if success:
            return success_response(message="스크립트가 업데이트되었습니다.")
        raise HTTPException(status_code=500, detail="스크립트 업데이트 실패")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"스크립트 업데이트 실패: {e!s}")


@router.delete("/scripts/{script_id}", response_model=SuccessResponse)
async def delete_script(script_id: int, request: Request) -> SuccessResponse:
    """스크립트 삭제"""
    client_ip = request.client.host if request.client else "unknown"
    logger.info(f"[API] 스크립트 삭제 요청 받음 - 스크립트 ID: {script_id}, 클라이언트 IP: {client_ip}")

    try:
        # 삭제 전 스크립트 존재 확인
        logger.info(f"[DB 조회] 삭제 전 스크립트 조회 시작 - 스크립트 ID: {script_id}")
        script = db_manager.get_script(script_id)
        if not script:
            logger.warning(f"[DB 조회] 삭제할 스크립트를 찾을 수 없음 - 스크립트 ID: {script_id}")
            logger.warning(f"[API] 스크립트를 찾을 수 없음 - 스크립트 ID: {script_id}")
            raise HTTPException(status_code=404, detail="스크립트를 찾을 수 없습니다.")

        script_name = script.get("name", "N/A")
        logger.info(f"[DB 조회] 삭제할 스크립트 확인됨 - 스크립트 ID: {script_id}, 이름: {script_name}")

        # 스크립트 삭제
        logger.info(f"[DB 삭제] 스크립트 삭제 시작 - 스크립트 ID: {script_id}, 이름: {script_name}")
        success = db_manager.delete_script(script_id)

        if success:
            logger.info(f"[DB 삭제] 스크립트 삭제 완료 - 스크립트 ID: {script_id}, 이름: {script_name}")

            # 대시보드 통계 업데이트 (전체 워크플로우 개수)
            try:
                db_manager.update_stat("total_scripts")
                logger.info("[DB 통계] 전체 워크플로우 통계 업데이트 완료")
            except Exception as e:
                logger.warning(f"[DB 통계] 통계 업데이트 실패 (무시): {e!s}")

            logger.info(f"[API] 스크립트 삭제 성공 - 스크립트 ID: {script_id}, 이름: {script_name}")
            return success_response({"id": script_id}, "스크립트가 삭제되었습니다.")
        logger.warning(f"[DB 삭제] 스크립트 삭제 실패 - 스크립트 ID: {script_id}")
        raise HTTPException(status_code=404, detail="스크립트를 찾을 수 없습니다.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[API] 스크립트 삭제 실패 - 스크립트 ID: {script_id}, 에러: {e!s}")
        raise HTTPException(status_code=500, detail=f"스크립트 삭제 실패: {e!s}")


@router.put("/nodes/script/{script_id}/batch", response_model=SuccessResponse)
async def update_nodes_batch(
    script_id: int, http_request: Request, request: dict[str, Any] = Body(...)
) -> SuccessResponse:
    """노드 일괄 업데이트 (저장)"""
    client_ip = http_request.client.host if http_request.client else "unknown"
    logger.info(f"[API] 노드 일괄 업데이트 요청 받음 - 스크립트 ID: {script_id}, 클라이언트 IP: {client_ip}")

    try:
        # 스크립트 존재 확인
        logger.info(f"[DB 조회] 스크립트 조회 시작 - 스크립트 ID: {script_id}")
        script = db_manager.get_script(script_id)
        if not script:
            logger.warning(f"[DB 조회] 스크립트를 찾을 수 없음 - 스크립트 ID: {script_id}")
            logger.warning(f"[API] 스크립트를 찾을 수 없음 - 스크립트 ID: {script_id}")
            raise HTTPException(status_code=404, detail="스크립트를 찾을 수 없습니다.")

        script_name = script.get("name", "N/A")
        logger.info(f"[DB 조회] 스크립트 조회 완료 - 스크립트 ID: {script_id}, 이름: {script_name}")

        # 요청 데이터 추출
        nodes = request.get("nodes", [])
        connections = request.get("connections", [])

        logger.info(f"[API] 노드 일괄 업데이트 데이터 - 노드 개수: {len(nodes)}개, 연결 개수: {len(connections)}개")
        logger.debug(f"[API] 노드 목록: {[{'id': n.get('id'), 'type': n.get('type')} for n in nodes]}")
        logger.debug(f"[API] 연결 목록: {[{'from': c.get('from'), 'to': c.get('to')} for c in connections]}")

        # 노드와 연결 정보 저장
        logger.info(
            f"[DB 저장] 노드 일괄 업데이트 시작 - 스크립트 ID: {script_id}, 노드 개수: {len(nodes)}, 연결 개수: {len(connections)}"
        )
        success = db_manager.save_script_data(script_id, nodes, connections)

        if success:
            logger.info(f"[DB 저장] 노드 일괄 업데이트 완료 - 스크립트 ID: {script_id}")
            logger.info(
                f"[API] 노드 일괄 업데이트 성공 - 스크립트 ID: {script_id}, 이름: {script_name}, 노드: {len(nodes)}개, 연결: {len(connections)}개"
            )
            return success_response(
                {
                    "script_id": script_id,
                    "nodes_count": len(nodes),
                    "connections_count": len(connections),
                },
                "노드가 성공적으로 저장되었습니다.",
            )
        logger.error(f"[DB 저장] 노드 일괄 업데이트 실패 - 스크립트 ID: {script_id}")
        raise HTTPException(status_code=500, detail="노드 저장 실패")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[API] 노드 일괄 업데이트 실패 - 스크립트 ID: {script_id}, 에러: {e!s}")
        raise HTTPException(status_code=500, detail=f"노드 저장 실패: {e!s}")


@router.post("/scripts/{script_id}/execute", response_model=BaseResponse)
async def execute_script(script_id: int, request: NodeExecutionRequest) -> StandardResponseType:
    """스크립트 실행"""
    import time

    execution_start_time = time.time()
    execution_record_id = None

    try:
        # 스크립트 존재 확인
        logger.info(f"[DB 조회] 스크립트 조회 시작 - 스크립트 ID: {script_id}")
        script = db_manager.get_script(script_id)
        if not script:
            logger.warning(f"[DB 조회] 스크립트를 찾을 수 없음 - 스크립트 ID: {script_id}")
            raise HTTPException(status_code=404, detail="스크립트를 찾을 수 없습니다.")
        logger.info(f"[DB 조회] 스크립트 조회 완료 - 스크립트 ID: {script_id}, 이름: {script.get('name', 'N/A')}")

        # 스크립트 실행 기록 저장 (시작)
        try:
            execution_record_id = db_manager.record_script_execution(
                script_id=script_id, status="running", error_message=None, execution_time_ms=None
            )
            logger.info(
                f"[API] 스크립트 실행 기록 저장 (시작) - 실행 ID: {execution_record_id}, 스크립트 ID: {script_id}"
            )
        except Exception as e:
            logger.warning(f"[API] 스크립트 실행 기록 저장 실패 (무시): {e!s}")

        # 노드들 순차 실행
        results = []
        has_error = False
        error_message = None

        for node in request.nodes:
            try:
                # 실제 노드 실행 로직
                result = await action_service.process_action(node.get("type", "unknown"), node.get("data", {}))
                results.append(result)

            except Exception as e:
                # 노드 실행 중 에러 발생
                error_msg = str(e)
                results.append({"error": error_msg})
                has_error = True
                if not error_message:
                    error_message = error_msg
                logger.error(f"[API] 노드 실행 실패 - 노드 타입: {node.get('type', 'unknown')}, 에러: {error_msg}")

        # 실행 완료 시간 계산
        execution_time_ms = int((time.time() - execution_start_time) * 1000) if execution_start_time else None

        # 스크립트 실행 기록 업데이트 (완료)
        if execution_record_id:
            try:
                final_status = "error" if has_error else "success"
                db_manager.record_script_execution(
                    script_id=script_id,
                    status=final_status,
                    error_message=error_message,
                    execution_time_ms=execution_time_ms,
                    execution_id=execution_record_id,
                )
                logger.info(
                    f"[API] 스크립트 실행 기록 업데이트 (완료) - 실행 ID: {execution_record_id}, 상태: {final_status}"
                )
            except Exception as e:
                logger.warning(f"[API] 스크립트 실행 기록 업데이트 실패 (무시): {e!s}")

        # 에러가 발생했으면 success: False 반환
        if has_error:
            return error_response(
                f"스크립트 실행 중 오류 발생: {error_message}",
                error=error_message,
                error_code="SCRIPT_EXECUTION_ERROR",
            )

        return success_response({"results": results}, "스크립트 실행 완료")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"스크립트 실행 실패: {e!s}")


@router.patch("/scripts/{script_id}/active", response_model=SuccessResponse)
async def toggle_script_active(
    script_id: int, request: Request, active: bool = Body(..., embed=True)
) -> SuccessResponse:
    """스크립트 활성/비활성 상태 토글"""
    client_ip = request.client.host if request.client else "unknown"
    logger.info(
        f"[API] 스크립트 활성 상태 변경 요청 - 스크립트 ID: {script_id}, 활성: {active}, 클라이언트 IP: {client_ip}"
    )

    try:
        # 스크립트 존재 확인
        logger.info(f"[DB 조회] 스크립트 조회 시작 - 스크립트 ID: {script_id}")
        script = db_manager.get_script(script_id)
        if not script:
            logger.warning(f"[DB 조회] 스크립트를 찾을 수 없음 - 스크립트 ID: {script_id}")
            raise HTTPException(status_code=404, detail="스크립트를 찾을 수 없습니다.")

        script_name = script.get("name", "N/A")
        logger.info(f"[DB 조회] 스크립트 조회 완료 - 스크립트 ID: {script_id}, 이름: {script_name}")

        # 활성 상태 업데이트
        logger.info(f"[DB 저장] 스크립트 활성 상태 업데이트 시작 - 스크립트 ID: {script_id}, 활성: {active}")
        success = db_manager.update_script_active(script_id, active)

        if success:
            logger.info(f"[DB 저장] 스크립트 활성 상태 업데이트 완료 - 스크립트 ID: {script_id}, 활성: {active}")

            # 대시보드 통계 업데이트 (비활성 스크립트 개수)
            try:
                db_manager.update_stat("inactive_scripts")
                logger.info("[DB 통계] 비활성 스크립트 통계 업데이트 완료")
            except Exception as e:
                logger.warning(f"[DB 통계] 통계 업데이트 실패 (무시): {e!s}")

            logger.info(
                f"[API] 스크립트 활성 상태 변경 성공 - 스크립트 ID: {script_id}, 이름: {script_name}, 활성: {active}"
            )
            return success_response({"active": active}, "스크립트 활성 상태가 변경되었습니다.")
        logger.error(f"[DB 저장] 스크립트 활성 상태 업데이트 실패 - 스크립트 ID: {script_id}")
        raise HTTPException(status_code=500, detail="스크립트 활성 상태 변경 실패")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[API] 스크립트 활성 상태 변경 실패 - 스크립트 ID: {script_id}, 에러: {e!s}")
        raise HTTPException(status_code=500, detail=f"스크립트 활성 상태 변경 실패: {e!s}")


@router.post("/scripts/{script_id}/execution-record", response_model=SuccessResponse)
async def record_script_execution(
    script_id: int, request: Request, execution_data: dict = Body(...)
) -> SuccessResponse:
    """
    스크립트 실행 기록 저장 (프론트엔드에서 호출)

    Args:
        script_id: 스크립트 ID
        request: HTTP 요청 객체
        execution_data: 실행 데이터 {status: str, error_message: str | None, execution_time_ms: int | None}
    """
    client_ip = request.client.host if request.client else "unknown"
    logger.info(f"[API] 스크립트 실행 기록 저장 요청 - 스크립트 ID: {script_id}, 클라이언트 IP: {client_ip}")

    try:
        status = execution_data.get("status", "success")  # 'success' 또는 'error'
        error_message = execution_data.get("error_message")
        execution_time_ms = execution_data.get("execution_time_ms")

        # 실행 기록 저장
        execution_record_id = db_manager.record_script_execution(
            script_id=script_id, status=status, error_message=error_message, execution_time_ms=execution_time_ms
        )

        if execution_record_id:
            logger.info(
                f"[API] 스크립트 실행 기록 저장 완료 - 실행 ID: {execution_record_id}, 스크립트 ID: {script_id}, 상태: {status}"
            )
            return success_response(
                {"execution_id": execution_record_id, "script_id": script_id, "status": status},
                "스크립트 실행 기록 저장 완료",
            )
        logger.warning(f"[API] 스크립트 실행 기록 저장 실패 - 스크립트 ID: {script_id}")
        raise HTTPException(status_code=500, detail="스크립트 실행 기록 저장 실패")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[API] 스크립트 실행 기록 저장 실패 - 스크립트 ID: {script_id}, 에러: {e!s}")
        raise HTTPException(status_code=500, detail=f"스크립트 실행 기록 저장 실패: {e!s}")


@router.patch("/scripts/order", response_model=SuccessResponse)
async def update_script_order(request: Request, script_orders: list[dict[str, int]] = Body(...)) -> SuccessResponse:
    """스크립트 순서 업데이트"""
    client_ip = request.client.host if request.client else "unknown"
    logger.info(f"[API] 스크립트 순서 업데이트 요청 받음 - 클라이언트 IP: {client_ip}, 순서: {script_orders}")
    try:
        success = db_manager.update_script_order(script_orders)
        if success:
            logger.info(f"[API] 스크립트 순서 업데이트 성공 - 순서: {script_orders}")
            return success_response({"orders": script_orders}, "스크립트 순서가 업데이트되었습니다.")
        raise HTTPException(status_code=500, detail="스크립트 순서 업데이트 실패")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[API] 스크립트 순서 업데이트 실패 - 에러: {e!s}")
        raise HTTPException(status_code=500, detail=f"스크립트 순서 업데이트 실패: {e!s}")
