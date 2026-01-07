"""
액션 관련 API 라우터
"""

import os
import time
from typing import Any

from fastapi import APIRouter, HTTPException

from api.helpers import api_handler, error_response, list_response, success_response
from api.helpers.constants import API_CONSTANTS
from db.database import db_manager
from log import log_manager
from models import (
    ActionRequest,
    ActionResponse,
    NodeExecutionRequest,
    StandardResponseType,
    SuccessResponse,
)
from models.folder_path_models import FolderPathParams  # Pydantic 모델로 경로 검증 (경로 조작 공격 방지)
from models.process_focus_models import (
    ProcessFocusParams,  # Pydantic 모델로 입력 검증 (process_id 또는 hwnd 중 하나는 필수)
)
from models.response_models import ListResponse
from nodes.excelnodes.excel_manager import cleanup_excel_objects
from services import action_service
from services.node_execution_context import NodeExecutionContext
from utils.execution_id_generator import generate_execution_id

router = APIRouter(prefix="/api", tags=["actions"])
logger = log_manager.logger


@router.post("/action", response_model=ActionResponse)
@api_handler
async def execute_action(request: ActionRequest) -> ActionResponse:
    """
    단일 액션을 실행합니다.
    """
    parameters = request.parameters or {}
    result = await action_service.process_action(request.action_type, parameters)

    return ActionResponse(success=True, message=f"액션 '{request.action_type}' 실행 완료", data=result)


@router.post("/execute-nodes", response_model=ActionResponse)
@api_handler
async def execute_nodes(request: NodeExecutionRequest) -> ActionResponse:
    """
    노드 기반 워크플로우를 실행합니다.
    노드 간 데이터 전달을 지원합니다.
    """
    logger.info(f"[API] execute_nodes 호출됨 - 노드 개수: {len(request.nodes)}, 실행 모드: {request.execution_mode}")
    logger.debug(f"[API] 요청 데이터: {request}")

    # 실행 ID 생성 (같은 실행의 노드들을 그룹화)
    # 반복 노드 실행 시 클라이언트에서 전달된 execution_id 사용, 없으면 새로 생성
    execution_id = request.execution_id if request.execution_id else generate_execution_id()

    # 스크립트 ID 추출 (요청에서 가져오거나 None)
    # request.script_id가 None이 아닌 경우 그 값을 사용, None이면 getattr로 다시 확인
    script_id = request.script_id if request.script_id is not None else getattr(request, "script_id", None)

    # 실행 시작 시간 기록 (실행 시간 계산용)
    execution_start_time = time.time()
    # 실행 기록 ID 초기화 (DB에 저장된 실행 기록의 ID, 나중에 업데이트할 때 사용)
    execution_record_id = None

    # 스크립트 실행 기록 저장 (시작)
    # script_id가 있으면 DB에 실행 기록을 저장하고 execution_record_id를 받아옴
    if script_id:
        try:
            execution_record_id = db_manager.record_script_execution(
                script_id=script_id, status="running", error_message=None, execution_time_ms=None
            )
            logger.info(
                f"[API] 스크립트 실행 기록 저장 (시작) - 실행 ID: {execution_record_id}, 스크립트 ID: {script_id}"
            )
        except Exception as e:
            logger.warning(f"[API] 스크립트 실행 기록 저장 실패 (무시): {e!s}")

    # 노드 실행 컨텍스트 생성 (데이터 전달)
    # 노드 간 데이터 전달을 위한 컨텍스트 객체 (이전 노드의 출력을 다음 노드에 전달)
    context = NodeExecutionContext()

    # 클라이언트에서 전달된 이전 노드 결과가 있으면 컨텍스트에 추가
    # 반복 노드나 조건 노드에서 이전 반복/분기의 결과를 사용하기 위함
    if request.previous_node_result:
        prev_result = request.previous_node_result

        # 이전 노드 결과는 {action, status, output} 형식
        prev_node_id = prev_result.get("node_id") or prev_result.get("_node_id") or "previous"
        prev_node_name = prev_result.get("node_name") or prev_result.get("_node_name") or "이전 노드"
        context.add_node_result(prev_node_id, prev_node_name, prev_result)
        logger.debug(f"[API] 이전 노드 결과를 컨텍스트에 추가: {prev_node_id} - {prev_result.get('action', 'unknown')}")

    results = []
    has_error = False
    error_message = None

    if request.execution_mode == "sequential":
        logger.info(f"[API] 순차 실행 시작 - 실행 ID: {execution_id}")

        # 전체 노드 개수와 현재 순번 결정 (클라이언트에서 전달된 값 우선, 없으면 요청의 노드 개수 사용)
        # total_nodes: 전체 노드 개수 (진행률 표시용)
        total_nodes = request.total_nodes if request.total_nodes is not None else len(request.nodes)
        # start_index: 현재 노드 순번의 시작 인덱스 (반복 노드 내부에서 사용)
        start_index = request.current_node_index if request.current_node_index is not None else 0

        # 반복 정보 확인 및 처리
        # repeat_info가 있고 repeat_count가 있으면 반복 노드 실행 모드
        repeat_info = request.repeat_info
        if repeat_info and repeat_info.get("repeat_count"):
            # 반복 노드의 반복 연결점에 연결된 노드들을 반복 실행
            # current_iteration이 있으면 해당 반복만 실행 (프론트엔드에서 각 반복마다 요청)
            current_iteration = repeat_info.get("current_iteration")
            total_iterations = repeat_info.get("total_iterations")
            repeat_count = repeat_info.get("repeat_count", 1)
            repeat_node_id = repeat_info.get("repeat_node_id")

            # current_iteration이 있으면 해당 반복만 실행, 없으면 모든 반복 실행
            if current_iteration and total_iterations:
                # 프론트엔드에서 각 반복마다 요청을 보내는 경우
                logger.info(
                    f"[API] 반복 노드 실행 - 반복 {current_iteration}/{total_iterations}, 반복 노드 ID: {repeat_node_id}"
                )
                # 단일 반복 실행 (현재 반복만 실행)
                # iteration_results: 현재 반복의 실행 결과 리스트
                iteration_results = []
                # 요청된 노드들을 순차적으로 실행
                for i, node in enumerate(request.nodes):
                    node_id = node.get("id", f"node_{i}")
                    node_type = node.get("type", "unknown")
                    node_name = node.get("data", {}).get("title") or node.get("data", {}).get("name") or node_id

                    # 노드의 repeat_info 확인
                    node_repeat_info = node.get("repeat_info", {})
                    is_repeat_start = node_repeat_info.get("is_repeat_start", False)
                    is_repeat_end = node_repeat_info.get("is_repeat_end", False)

                    # 현재 노드 순번 계산 (전체 워크플로우에서의 순번)
                    # start_index: 이전에 실행된 노드 개수, i: 현재 반복 내 노드 인덱스
                    current_node_number = start_index + i + 1
                    logger.info(
                        f"[API] 반복 {current_iteration}/{total_iterations} - 노드 {current_node_number}/{total_nodes} 실행 시작 - "
                        f"ID: {node_id}, 타입: {node_type}, 이름: {node_name}, "
                        f"반복 시작: {is_repeat_start}, 반복 종료: {is_repeat_end}"
                    )

                    try:
                        # 반복 정보를 노드 데이터에 추가 (서버에서 사용할 수 있도록)
                        # 노드 객체를 복사하여 수정 (원본 변경 방지)
                        node_with_repeat = {**node}
                        # repeat_info가 없으면 빈 딕셔너리로 초기화
                        if not node_with_repeat.get("repeat_info"):
                            node_with_repeat["repeat_info"] = {}
                        # 현재 반복 번호와 전체 반복 횟수를 노드 데이터에 추가
                        node_with_repeat["repeat_info"]["current_iteration"] = current_iteration
                        node_with_repeat["repeat_info"]["total_iterations"] = total_iterations

                        # 실행 컨텍스트와 함께 노드 실행 (execution_id와 메타데이터 전달)
                        result = await action_service.process_node(
                            node_with_repeat, context, execution_id=execution_id, script_id=script_id
                        )

                        # 결과가 None이면 기본값으로 변환
                        if result is None:
                            result = {"action": node.get("type", "unknown"), "status": "completed", "output": None}

                        # 결과가 dict가 아니면 dict로 변환
                        if not isinstance(result, dict):
                            result = {"action": node.get("type", "unknown"), "status": "completed", "output": result}

                        # 결과의 status가 "failed"인지 확인 (NodeExecutor가 에러를 catch해서 dict로 반환하는 경우)
                        if result.get("status") == "failed" or result.get("error"):
                            # 에러 발생 플래그 설정
                            has_error = True
                            error_msg = result.get("error") or result.get("message") or "노드 실행 실패"
                            if not error_message:
                                error_message = error_msg
                            logger.error(
                                f"[API] 반복 {current_iteration}/{total_iterations} - 노드 {current_node_number}/{total_nodes} 실행 실패 (status: failed) - ID: {node_id}, 타입: {node_type}, 이름: {node_name}, 에러: {error_msg}"
                            )
                        else:
                            # 성공한 경우 로그 출력
                            logger.info(
                                f"[API] 반복 {current_iteration}/{total_iterations} - 노드 {current_node_number}/{total_nodes} 실행 성공 - ID: {node_id}, 타입: {node_type}, 이름: {node_name}, 상태: {result.get('status', 'completed')}"
                            )

                        # 실행 결과를 반복 결과 리스트에 추가
                        iteration_results.append(result)
                        logger.debug(
                            f"[API] 반복 {current_iteration}/{total_iterations} - 노드 {i + 1} 실행 결과: {result}"
                        )

                        # 에러 결과도 컨텍스트에 저장 (다음 노드에서 참조 가능)
                        # 에러가 발생해도 컨텍스트에 저장하여 다음 노드에서 참조할 수 있도록 함
                        context.add_node_result(node_id, node_name, result)

                    except Exception as node_error:
                        # 노드 실행 중 예외 발생 시 처리
                        logger.error(
                            f"[API] 반복 {current_iteration}/{total_iterations} - 노드 {current_node_number}/{total_nodes} 실행 실패 (예외 발생) - ID: {node_id}, 타입: {node_type}, 이름: {node_name}, 에러: {node_error}"
                        )
                        node_id = node.get("id", f"node_{i}")
                        node_name = node.get("data", {}).get("title") or node.get("data", {}).get("name")
                        error_msg = str(node_error)

                        # 에러 발생 플래그 설정
                        has_error = True
                        if not error_message:
                            error_message = error_msg

                        # 에러 결과도 항상 dict로 반환
                        error_result = {
                            "action": node.get("type", "unknown"),
                            "status": "failed",
                            "error": error_msg,
                            "node_id": node_id,
                            "output": None,
                        }
                        iteration_results.append(error_result)

                        # 에러 결과도 컨텍스트에 저장 (다음 노드에서 참조 가능)
                        context.add_node_result(node_id, node_name, error_result)

                results = iteration_results
                logger.info(f"[API] 반복 {current_iteration}/{total_iterations} 실행 완료 - {len(results)}개 노드 실행")
            else:
                # 서버에서 모든 반복을 한 번에 실행하는 경우 (레거시)
                logger.info(f"[API] 반복 노드 실행 시작 - 반복 횟수: {repeat_count}, 반복 노드 ID: {repeat_node_id}")
                # 반복 실행
                all_iteration_results = []
                for iteration in range(repeat_count):
                    logger.info(f"[API] 반복 실행 {iteration + 1}/{repeat_count} 시작")
                    # iteration_results: 현재 반복의 실행 결과 리스트
                    iteration_results = []

                    # 요청된 노드들을 순차적으로 실행
                    for i, node in enumerate(request.nodes):
                        node_id = node.get("id", f"node_{i}")
                        node_type = node.get("type", "unknown")
                        node_name = node.get("data", {}).get("title") or node.get("data", {}).get("name") or node_id

                        # 노드의 repeat_info 확인
                        node_repeat_info = node.get("repeat_info", {})
                        is_repeat_start = node_repeat_info.get("is_repeat_start", False)
                        is_repeat_end = node_repeat_info.get("is_repeat_end", False)

                        # 현재 노드 순번 계산
                        current_node_number = start_index + i + 1
                        logger.info(
                            f"[API] 반복 {iteration + 1}/{repeat_count} - 노드 {current_node_number}/{total_nodes} 실행 시작 - "
                            f"ID: {node_id}, 타입: {node_type}, 이름: {node_name}, "
                            f"반복 시작: {is_repeat_start}, 반복 종료: {is_repeat_end}"
                        )

                        try:
                            # 반복 정보를 노드 데이터에 추가 (서버에서 사용할 수 있도록)
                            node_with_repeat = {**node}
                            if not node_with_repeat.get("repeat_info"):
                                node_with_repeat["repeat_info"] = {}
                            node_with_repeat["repeat_info"]["current_iteration"] = iteration + 1
                            node_with_repeat["repeat_info"]["total_iterations"] = repeat_count

                            # 실행 컨텍스트와 함께 노드 실행 (execution_id와 메타데이터 전달)
                            result = await action_service.process_node(
                                node_with_repeat, context, execution_id=execution_id, script_id=script_id
                            )

                            # 결과가 None이면 기본값으로 변환
                            if result is None:
                                result = {"action": node.get("type", "unknown"), "status": "completed", "output": None}

                            # 결과가 dict가 아니면 dict로 변환
                            if not isinstance(result, dict):
                                result = {
                                    "action": node.get("type", "unknown"),
                                    "status": "completed",
                                    "output": result,
                                }

                            # 결과의 status가 "failed"인지 확인 (NodeExecutor가 에러를 catch해서 dict로 반환하는 경우)
                            if result.get("status") == "failed" or result.get("error"):
                                # 에러 발생 플래그 설정
                                has_error = True
                                error_msg = result.get("error") or result.get("message") or "노드 실행 실패"
                                if not error_message:
                                    error_message = error_msg
                                logger.error(
                                    f"[API] 반복 {iteration + 1}/{repeat_count} - 노드 {current_node_number}/{total_nodes} 실행 실패 (status: failed) - ID: {node_id}, 타입: {node_type}, 이름: {node_name}, 에러: {error_msg}"
                                )
                            else:
                                logger.info(
                                    f"[API] 반복 {iteration + 1}/{repeat_count} - 노드 {current_node_number}/{total_nodes} 실행 성공 - ID: {node_id}, 타입: {node_type}, 이름: {node_name}, 상태: {result.get('status', 'completed')}"
                                )

                            iteration_results.append(result)
                            logger.debug(
                                f"[API] 반복 {iteration + 1}/{repeat_count} - 노드 {i + 1} 실행 결과: {result}"
                            )

                            # 에러 결과도 컨텍스트에 저장 (다음 노드에서 참조 가능)
                            context.add_node_result(node_id, node_name, result)

                        except Exception as node_error:
                            logger.error(
                                f"[API] 반복 {iteration + 1}/{repeat_count} - 노드 {current_node_number}/{total_nodes} 실행 실패 (예외 발생) - ID: {node_id}, 타입: {node_type}, 이름: {node_name}, 에러: {node_error}"
                            )
                            node_id = node.get("id", f"node_{i}")
                            node_name = node.get("data", {}).get("title") or node.get("data", {}).get("name")
                            error_msg = str(node_error)

                            # 에러 발생 플래그 설정
                            has_error = True
                            if not error_message:
                                error_message = error_msg

                            # 에러 결과도 항상 dict로 반환
                            error_result = {
                                "action": node.get("type", "unknown"),
                                "status": "failed",
                                "error": error_msg,
                                "node_id": node_id,
                                "output": None,
                            }
                            iteration_results.append(error_result)

                            # 에러 결과도 컨텍스트에 저장 (다음 노드에서 참조 가능)
                            context.add_node_result(node_id, node_name, error_result)

                    # 반복 결과 저장
                    all_iteration_results.append({"iteration": iteration + 1, "results": iteration_results})
                    logger.info(f"[API] 반복 실행 {iteration + 1}/{repeat_count} 완료")

                # 모든 반복 결과를 results에 추가 (평탄화)
                results = []
                for iteration_data in all_iteration_results:
                    results.extend(iteration_data["results"])
                logger.info(
                    f"[API] 반복 노드 실행 완료 - 총 {repeat_count}회 반복, 각 반복당 {len(request.nodes)}개 노드 실행"
                )
        else:
            # 일반 노드 실행 (반복 정보가 없는 경우)
            for i, node in enumerate(request.nodes):
                node_id = node.get("id", f"node_{i}")
                node_type = node.get("type", "unknown")
                node_name = node.get("data", {}).get("title") or node.get("data", {}).get("name") or None
                # 현재 노드 순번 계산 (클라이언트에서 전달된 순번 + 루프 인덱스)
                current_node_number = start_index + i + 1

                # 노드 식별자 포맷팅
                node_identifier_parts = []
                if node_name:
                    node_identifier_parts.append(node_name)
                node_identifier_parts.append(f"({node_type})")
                node_identifier_parts.append(f"#{current_node_number}/{total_nodes}")
                if node_id and node_id != "start":
                    node_identifier_parts.append(f"ID:{node_id}")
                node_identifier = " ".join(node_identifier_parts)

                logger.info(f"[API] 노드 실행 시작: {node_identifier}")
                try:
                    # 실행 컨텍스트와 함께 노드 실행 (execution_id와 메타데이터 전달)
                    result = await action_service.process_node(
                        node, context, execution_id=execution_id, script_id=script_id
                    )

                    # 결과가 None이면 기본값으로 변환
                    if result is None:
                        result = {"action": node.get("type", "unknown"), "status": "completed", "output": None}

                    # 결과가 dict가 아니면 dict로 변환
                    if not isinstance(result, dict):
                        result = {"action": node.get("type", "unknown"), "status": "completed", "output": result}

                    # output 필드가 없으면 추가
                    if "output" not in result:
                        result["output"] = None

                    # 결과의 status가 "failed"인지 확인
                    if result.get("status") == "failed" or result.get("error"):
                        # 에러 발생 플래그 설정
                        has_error = True
                        error_msg = result.get("error") or result.get("message") or "노드 실행 실패"
                        if not error_message:
                            error_message = error_msg
                        logger.error(
                            f"[API] 노드 {current_node_number}/{total_nodes} 실행 실패 (status: failed) - ID: {node_id}, 타입: {node_type}, 이름: {node_name}, 에러: {error_msg}"
                        )
                    else:
                        logger.info(
                            f"[API] 노드 {current_node_number}/{total_nodes} 실행 성공 - ID: {node_id}, 타입: {node_type}, 이름: {node_name}, 상태: {result.get('status', 'completed')}"
                        )

                    results.append(result)
                    logger.debug(f"[API] 노드 {i + 1} 실행 결과: {result}")

                    # 컨텍스트에 결과 저장
                    context.add_node_result(node_id, node_name, result)
                except Exception as node_error:
                    logger.error(
                        f"[API] 노드 {current_node_number}/{total_nodes} 실행 실패 (예외 발생) - ID: {node_id}, 타입: {node_type}, 이름: {node_name}, 에러: {node_error}"
                    )
                    node_id = node.get("id", f"node_{i}")
                    node_name = node.get("data", {}).get("title") or node.get("data", {}).get("name")
                    error_msg = str(node_error)

                    # 에러 발생 플래그 설정
                    has_error = True
                    if not error_message:
                        error_message = error_msg

                    # 에러 결과도 항상 dict로 반환
                    error_result = {
                        "action": node.get("type", "unknown"),
                        "status": "failed",
                        "error": error_msg,
                        "node_id": node_id,
                        "output": None,
                    }
                    results.append(error_result)

                    # 에러 결과도 컨텍스트에 저장 (다음 노드에서 참조 가능)
                    context.add_node_result(node_id, node_name, error_result)

    # 실행 완료 로그 출력 (성공/실패 개수 계산)
    # 성공: status가 "failed"가 아니고 error 필드가 없는 결과
    # 실패: status가 "failed"이거나 error 필드가 있는 결과
    logger.info(
        f"[API] 모든 노드 실행 완료 - 총 {len(request.nodes)}개 노드, 성공: {len([r for r in results if r.get('status') != 'failed' and not r.get('error')])}개, 실패: {len([r for r in results if r.get('status') == 'failed' or r.get('error')])}개"
    )
    logger.debug(f"[API] 실행 결과 상세: {results}")

    # 엑셀 객체 정리 (엑셀 닫기 노드가 실행된 경우에만 정리)
    # 각 노드가 별도의 API 호출로 실행되므로, 엑셀 객체를 즉시 정리하면 안 됨
    # 엑셀 닫기 노드가 실행된 경우에만 정리하도록 함
    excel_close_executed = any(
        result.get("action") == "excel-close" and result.get("status") == "completed" for result in results
    )
    if excel_close_executed:
        try:
            cleanup_excel_objects(execution_id)
            logger.info(f"[API] 엑셀 닫기 노드 실행으로 인한 엑셀 객체 정리 완료 - execution_id: {execution_id}")
        except Exception as e:
            # 엑셀 객체 정리 실패해도 전체 실행에는 영향 없음 (경고만 출력)
            logger.warning(f"[API] 엑셀 객체 정리 중 오류 발생 (무시): {e!s}")
    else:
        logger.debug(f"[API] 엑셀 닫기 노드가 실행되지 않아 엑셀 객체를 유지합니다 - execution_id: {execution_id}")

    # 실행 완료 시간 계산 (밀리초 단위)
    # execution_start_time이 있으면 현재 시간과의 차이를 밀리초로 변환
    execution_time_ms = (
        int((time.time() - execution_start_time) * API_CONSTANTS.MILLISECONDS_PER_SECOND)
        if execution_start_time
        else None
    )

    # 스크립트 실행 기록 업데이트 (완료)
    # script_id와 execution_record_id가 모두 있으면 DB에 실행 결과 업데이트
    if script_id and execution_record_id:
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
        # 에러 발생 시에도 엑셀 객체는 유지 (다음 노드에서 사용할 수 있도록)
        # 엑셀 닫기 노드가 실행되지 않았으면 엑셀 객체를 정리하지 않음
        logger.debug(
            f"[API] 에러 발생했지만 엑셀 객체는 유지합니다 (다음 노드에서 사용 가능) - execution_id: {execution_id}"
        )

        logger.warning(f"[API] 노드 실행 중 오류 발생 - 에러 메시지: {error_message}")
        # 에러 응답 반환 (success: False, 에러 메시지와 결과 포함)
        return ActionResponse(
            success=False,
            message=f"노드 실행 중 오류 발생: {error_message}",
            data={
                "results": results,
                "context": context.to_dict(),  # 컨텍스트 정보도 반환 (디버깅용)
                "execution_id": execution_id,  # 실행 ID 반환 (로그 확인용)
            },
        )

    # 모든 노드 실행 성공 시 성공 응답 반환
    logger.info(f"[API] 모든 노드 실행 성공 - {len(request.nodes)}개 노드 모두 성공")
    return ActionResponse(
        success=True,
        message=f"{len(request.nodes)}개 노드 실행 완료",
        data={
            "results": results,
            "context": context.to_dict(),  # 컨텍스트 정보도 반환 (디버깅용)
            "execution_id": execution_id,  # 실행 ID 반환 (로그 확인용)
        },
    )


@router.post("/folder/select", response_model=SuccessResponse)
@api_handler
async def select_folder() -> StandardResponseType:
    """
    폴더 선택 다이얼로그를 띄우고 선택된 폴더 경로를 반환합니다.
    """
    import tkinter as tk
    from tkinter import filedialog

    # tkinter 루트 윈도우 생성 (숨김)
    root = tk.Tk()
    root.withdraw()  # 메인 윈도우 숨기기
    root.attributes("-topmost", True)  # 다른 창 위에 표시

    # 폴더 선택 다이얼로그
    folder_path = filedialog.askdirectory(title="이미지 폴더 선택", mustexist=True)

    root.destroy()  # 루트 윈도우 제거

    if not folder_path:
        return error_response("폴더가 선택되지 않았습니다.")

    return success_response({"folder_path": folder_path}, "폴더가 선택되었습니다.")


@router.post("/file/select", response_model=SuccessResponse)
@api_handler
async def select_file() -> StandardResponseType:
    """
    파일 선택 다이얼로그를 띄우고 선택된 파일 경로를 반환합니다.
    """
    import tkinter as tk
    from tkinter import filedialog

    # tkinter 루트 윈도우 생성 (숨김)
    # tkinter는 파일/폴더 선택 다이얼로그를 띄우기 위해 루트 윈도우가 필요함
    root = tk.Tk()
    root.withdraw()  # 메인 윈도우 숨기기 (다이얼로그만 표시)
    root.attributes("-topmost", True)  # 다른 창 위에 표시 (다이얼로그가 최상단에 표시되도록)

    # 파일 선택 다이얼로그
    # filetypes: 선택 가능한 파일 타입 목록 (필터 옵션)
    file_path = filedialog.askopenfilename(
        title="파일 선택",
        filetypes=[
            ("엑셀 파일", "*.xlsx *.xls *.xlsm"),
            ("모든 파일", "*.*"),
            ("텍스트 파일", "*.txt"),
            ("JSON 파일", "*.json"),
            ("CSV 파일", "*.csv"),
        ],
    )

    root.destroy()  # 루트 윈도우 제거 (리소스 정리)

    # 파일이 선택되지 않았으면 (사용자가 취소한 경우) 정상 응답 반환
    # 취소는 에러가 아닌 정상적인 사용자 동작이므로 success=False로 처리
    if not file_path:
        return success_response({"file_path": None, "cancelled": True}, "파일 선택이 취소되었습니다.")

    return success_response({"file_path": file_path}, "파일이 선택되었습니다.")


@router.get("/images/list", response_model=ListResponse)
@api_handler
async def get_image_list(folder_path: str) -> ListResponse:
    """
    특정 폴더의 이미지 파일 목록을 가져옵니다.
    파일 이름 순서대로 정렬하여 반환합니다.
    """
    # Pydantic 모델로 경로 검증 (경로 조작 공격 방지, 존재 여부 확인, 디렉토리 확인 포함)
    try:
        # FolderPathParams 모델로 경로 검증 (존재 여부, 디렉토리 여부 확인)
        params = FolderPathParams(folder_path=folder_path)
        validated_path = params.folder_path
    except Exception as e:
        # 경로 검증 실패 시 400 에러 반환
        raise HTTPException(status_code=400, detail=f"경로 검증 실패: {e!s}")

    # 지원하는 이미지 확장자 (set으로 빠른 조회)
    image_extensions = {".png", ".jpg", ".jpeg", ".bmp", ".gif", ".tiff", ".webp"}

    # 이미지 파일 목록 가져오기
    # image_files: 이미지 파일 정보 리스트 (filename, path, name 포함)
    image_files = []
    # 폴더 내 모든 파일 순회
    for filename in os.listdir(validated_path):
        file_path = os.path.join(validated_path, filename)
        # 파일인 경우만 처리 (디렉토리 제외)
        if os.path.isfile(file_path):
            # 파일 확장자 추출 (소문자로 변환하여 비교)
            _, ext = os.path.splitext(filename.lower())
            # 지원하는 이미지 확장자인 경우만 추가
            if ext in image_extensions:
                image_files.append(
                    {
                        "filename": filename,
                        "path": file_path,
                        "name": os.path.splitext(filename)[0],  # 확장자 제거한 이름
                    }
                )

    # 파일 이름 순서대로 정렬
    image_files.sort(key=lambda x: x["filename"])

    return list_response(
        image_files,
        "이미지 목록 조회 완료",
        folder_path=validated_path,
    )


@router.get("/processes/list", response_model=ListResponse)
@api_handler
async def get_process_list() -> ListResponse:
    """
    화면에 보이는 프로세스 목록을 가져옵니다.
    백그라운드 프로세스는 제외하고 실제 창이 있는 프로세스만 반환합니다.
    """
    try:
        import psutil
        import win32gui
        import win32process
    except ImportError:
        raise HTTPException(status_code=500, detail="Windows 전용 기능입니다. pywin32와 psutil 패키지가 필요합니다.")

    processes = []
    process_dict = {}  # 중복 제거용 (같은 프로세스 이름의 여러 창)

    def enum_window_callback(hwnd: int, extra: Any) -> None:
        """창 열거 콜백 함수"""
        if win32gui.IsWindowVisible(hwnd):
            window_text = win32gui.GetWindowText(hwnd)
            # 빈 창 제목 제외
            if window_text:
                try:
                    # 프로세스 ID 가져오기
                    _, pid = win32process.GetWindowThreadProcessId(hwnd)

                    # 프로세스 정보 가져오기
                    try:
                        proc = psutil.Process(pid)
                        process_name = proc.name()
                        exe_path = proc.exe() if hasattr(proc, "exe") else None

                        # 중복 제거: 같은 프로세스 이름이면 창 제목만 추가
                        if process_name not in process_dict:
                            process_dict[process_name] = {
                                "process_name": process_name,
                                "process_id": pid,
                                "exe_path": exe_path,
                                "windows": [],
                                "hwnd": hwnd,  # 첫 번째 창 핸들 저장
                            }

                        # 창 정보 추가
                        process_dict[process_name]["windows"].append({"title": window_text, "hwnd": hwnd})
                    except (psutil.NoSuchProcess, psutil.AccessDenied):
                        # 프로세스가 종료되었거나 접근 권한이 없는 경우 무시
                        pass
                except Exception:
                    # 창 정보를 가져올 수 없는 경우 무시
                    pass

    # 모든 창 열거
    win32gui.EnumWindows(enum_window_callback, None)

    # 딕셔너리를 리스트로 변환
    for _process_name, process_info in process_dict.items():
        processes.append(
            {
                "process_name": process_info["process_name"],
                "process_id": process_info["process_id"],
                "exe_path": process_info["exe_path"],
                "window_count": len(process_info["windows"]),
                "windows": process_info["windows"],
                "hwnd": process_info["hwnd"],  # 포커스용 핸들
            }
        )

    # 프로세스 이름으로 정렬
    processes.sort(key=lambda x: x["process_name"].lower())

    return list_response(processes, "프로세스 목록 조회 완료")


@router.post("/processes/focus", response_model=SuccessResponse)
@api_handler
async def focus_process(request: dict[str, Any]) -> SuccessResponse:
    """
    선택한 프로세스에 포커스를 줍니다.
    """
    try:
        import win32gui
        import win32process
    except ImportError:
        raise HTTPException(status_code=500, detail="Windows 전용 기능입니다. pywin32 패키지가 필요합니다.")

    try:
        params = ProcessFocusParams(**request)
        process_id = params.process_id
        hwnd = params.hwnd
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"파라미터 검증 실패: {e!s}")

    # hwnd가 있으면 직접 사용, 없으면 process_id로 찾기
    # hwnd: 창 핸들 (직접 지정된 경우)
    if hwnd:
        # hwnd가 있으면 그대로 사용
        target_hwnd = hwnd
    else:
        # process_id로 창 핸들 찾기
        # target_hwnd: 찾은 창 핸들 (콜백 함수에서 설정됨)
        target_hwnd = None

        def find_window_callback(hwnd: int, extra: Any) -> bool:
            """창 찾기 콜백 함수 (모든 창을 순회하며 process_id와 일치하는 창 찾기)"""
            nonlocal target_hwnd
            # 보이는 창만 확인
            if win32gui.IsWindowVisible(hwnd):
                # 창의 프로세스 ID 가져오기
                _, pid = win32process.GetWindowThreadProcessId(hwnd)
                # 프로세스 ID가 일치하면 target_hwnd 설정
                if pid == process_id:
                    target_hwnd = hwnd
                    return False  # 찾았으면 중단 (False 반환 시 EnumWindows 중단)
            return True  # 계속 찾기 (True 반환 시 계속 순회)

        # 모든 창을 열거하며 process_id와 일치하는 창 찾기
        win32gui.EnumWindows(find_window_callback, None)

        # 창을 찾지 못했으면 404 에러 반환
        if not target_hwnd:
            raise HTTPException(status_code=404, detail=f"프로세스 ID {process_id}에 해당하는 창을 찾을 수 없습니다.")

    # 창을 최상단으로 가져오기
    win32gui.ShowWindow(target_hwnd, 9)  # SW_RESTORE = 9
    win32gui.SetForegroundWindow(target_hwnd)
    win32gui.BringWindowToTop(target_hwnd)

    return success_response(
        {"process_id": process_id, "hwnd": target_hwnd},
        "프로세스에 포커스를 주었습니다.",
    )
