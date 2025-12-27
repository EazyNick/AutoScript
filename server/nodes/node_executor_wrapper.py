"""
노드 실행 래퍼
노드 실행 시 공통 처리(에러 처리, 로깅, 파라미터 검증 등)를 담당합니다.

사용 예시:
    # 예시 1: 기본 사용법
    class ClickNode(BaseNode):
        @staticmethod
        @NodeExecutor("click")
        async def execute(parameters: Dict[str, Any]) -> Dict[str, Any]:
            x = parameters.get("x", 0)
            y = parameters.get("y", 0)
            return {
                "action": "click",
                "status": "completed",
                "output": {"x": x, "y": y}
            }

    # 예시 2: 파라미터가 None이어도 자동으로 빈 딕셔너리로 변환됨
    result = await ClickNode.execute(None)  # 자동으로 {}로 변환되어 처리됨

    # 예시 3: 에러 발생 시 자동으로 에러 결과 반환
    class MyNode(BaseNode):
        @staticmethod
        @NodeExecutor("my-action")
        async def execute(parameters: Dict[str, Any]) -> Dict[str, Any]:
            # 에러가 발생하면 자동으로 에러 결과 반환
            raise ValueError("에러 발생!")
            # 반환: {"action": "my-action", "status": "failed", "message": "...", ...}

    # 예시 4: 결과가 None이거나 dict가 아니어도 자동으로 정규화됨
    class SimpleNode(BaseNode):
        @staticmethod
        @NodeExecutor("simple")
        async def execute(parameters: Dict[str, Any]) -> Dict[str, Any]:
            return None  # 자동으로 {"action": "simple", "status": "completed", "output": None}로 변환
"""

import asyncio
from collections.abc import Callable
from datetime import datetime
from functools import wraps
import time
import traceback
from typing import Any, ParamSpec, TypeVar
import uuid

from log import log_manager
from utils import create_failed_result, normalize_result, validate_parameters
from utils.log_client import get_log_client

logger = log_manager.logger

P = ParamSpec("P")
R = TypeVar("R")


class NodeExecutor:
    """
    노드 execute 메서드를 래핑하는 클래스 기반 데코레이터

    공통 기능:
    - 파라미터 검증 및 정규화 (None이면 빈 딕셔너리로 변환)
    - 에러 처리 및 로깅 (에러 발생 시 자동으로 실패 결과 반환)
    - 결과 정규화 (None이거나 dict가 아니면 자동으로 표준 형식으로 변환)

    사용 예시:
        # 기본 사용법
        class ClickNode(BaseNode):
            @staticmethod
            @NodeExecutor("click")
            async def execute(parameters: Dict[str, Any]) -> Dict[str, Any]:
                x = parameters.get("x", 0)
                y = parameters.get("y", 0)
                return {
                    "action": "click",
                    "status": "completed",
                    "output": {"x": x, "y": y}
                }

        # 파라미터가 None이어도 자동 처리
        result = await ClickNode.execute(None)  # 자동으로 {}로 변환

        # 에러 발생 시 자동으로 에러 결과 반환
        # 에러가 발생하면 {"action": "click", "status": "failed", ...} 형식으로 반환
    """

    def __init__(self, action_name: str) -> None:
        """
        NodeExecutor 초기화

        Args:
            action_name: 액션 이름 (결과에 포함됨)
        """
        self.action_name = action_name

    def __call__(self, func: Callable[[dict[str, Any]], Any]) -> Callable[[dict[str, Any] | None], Any]:
        """
        데코레이터로 사용될 때 호출되는 메서드

        Args:
            func: 래핑할 함수 (노드의 execute 메서드)

        Returns:
            래핑된 함수
        """

        @wraps(func)
        async def wrapper(parameters: dict[str, Any] | None) -> dict[str, Any]:
            # 파라미터 검증 및 정규화
            validated_params = validate_parameters(parameters)

            # 로그 전송을 위한 정보 추출
            node_id = (
                validated_params.get("_node_id") or validated_params.get("node_id") or f"node_{uuid.uuid4().hex[:8]}"
            )
            node_name = validated_params.get("_node_name") or validated_params.get("node_name")
            script_id = validated_params.get("_script_id")
            execution_id = validated_params.get("_execution_id")
            # 연결 정보 추출
            is_connected = validated_params.get("is_connected")
            connection_sequence = validated_params.get("connection_sequence")
            node_identifier = validated_params.get("node_identifier")

            # 로그 전송용 파라미터 (내부 메타데이터 제외)
            log_parameters = {k: v for k, v in validated_params.items() if not k.startswith("_")}

            # 실행 시작 시간
            started_at = datetime.now()
            start_time_ms = time.time() * 1000

            # 로그 클라이언트 가져오기
            log_client = get_log_client()

            # 실행 시작 로그 전송 (비동기, fire-and-forget - 백그라운드에서 실행)
            _ = asyncio.create_task(  # noqa: RUF006
                log_client.send_log_async(
                    execution_id=execution_id,
                    script_id=script_id,
                    node_id=node_id,
                    node_type=self.action_name,
                    node_name=node_name,
                    status="running",
                    started_at=started_at,
                    parameters=log_parameters,
                    is_connected=is_connected,
                    connection_sequence=connection_sequence,
                    node_identifier=node_identifier,
                )
            )

            try:
                logger.debug(f"[{self.action_name}] 노드 실행 시작 - 파라미터: {validated_params}")

                # 노드 실행
                result = await func(validated_params)

                # 결과 정규화
                normalized_result = normalize_result(result, self.action_name)

                # 실행 종료 시간
                finished_at = datetime.now()
                execution_time_ms = int((time.time() * 1000) - start_time_ms)

                logger.debug(f"[{self.action_name}] 노드 실행 완료 - 결과: {normalized_result}")

                # 실행 완료 로그 전송 (비동기, fire-and-forget - 백그라운드에서 실행)
                _ = asyncio.create_task(  # noqa: RUF006
                    log_client.send_log_async(
                        execution_id=execution_id,
                        script_id=script_id,
                        node_id=node_id,
                        node_type=self.action_name,
                        node_name=node_name,
                        status="completed",
                        started_at=started_at,
                        finished_at=finished_at,
                        execution_time_ms=execution_time_ms,
                        parameters=log_parameters,
                        result=normalized_result,
                        is_connected=is_connected,
                        connection_sequence=connection_sequence,
                        node_identifier=node_identifier,
                    )
                )

                return normalized_result

            except Exception as e:
                # 실행 종료 시간
                finished_at = datetime.now()
                execution_time_ms = int((time.time() * 1000) - start_time_ms)
                error_trace = traceback.format_exc()

                logger.error(f"[{self.action_name}] 노드 실행 실패: {e}")
                logger.error(f"[{self.action_name}] 스택 트레이스: {error_trace}")

                # 에러 결과 생성
                error_result = create_failed_result(
                    action=self.action_name,
                    reason="execution_error",
                    message=f"노드 실행 중 오류 발생: {e!s}",
                    output={"error": str(e)},
                )

                # 실행 실패 로그 전송 (비동기, fire-and-forget - 백그라운드에서 실행)
                _ = asyncio.create_task(  # noqa: RUF006
                    log_client.send_log_async(
                        execution_id=execution_id,
                        script_id=script_id,
                        node_id=node_id,
                        node_type=self.action_name,
                        node_name=node_name,
                        status="failed",
                        started_at=started_at,
                        finished_at=finished_at,
                        execution_time_ms=execution_time_ms,
                        parameters=log_parameters,
                        result=error_result,
                        error_message=str(e),
                        error_traceback=error_trace,
                        is_connected=is_connected,
                        connection_sequence=connection_sequence,
                        node_identifier=node_identifier,
                    )
                )

                return error_result

        # 래핑된 함수에 action_name 속성 추가 (자동 핸들러 등록을 위해)
        wrapper.action_name = self.action_name
        return wrapper
