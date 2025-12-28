"""
로그 클라이언트 유틸리티
wrapper에서 서버로 로그를 전송하는 기능을 제공합니다.
"""

import asyncio
from datetime import datetime
from typing import Any

import aiohttp

from config.server_config import settings
from log import log_manager

logger = log_manager.logger


class ExecutionLogClient:
    """로그 서버로 전송하는 클라이언트"""

    def __init__(self, base_url: str | None = None) -> None:
        """
        ExecutionLogClient 초기화

        Args:
            base_url: API 서버 기본 URL (None이면 설정에서 가져옴)
        """
        if base_url:
            self.base_url = base_url.rstrip("/")
        else:
            api_host = settings.API_HOST
            api_port = settings.API_PORT
            # API_HOST가 0.0.0.0이면 localhost로 접근
            if api_host == "0.0.0.0":
                api_host = "localhost"
            self.base_url = f"http://{api_host}:{api_port}"

        self.log_endpoint = f"{self.base_url}/api/logs/node-execution"
        self.enabled = True  # 로그 전송 활성화 여부

    async def send_log(
        self,
        execution_id: str | None,
        script_id: int | None,
        node_id: str,
        node_type: str,
        node_name: str | None,
        status: str,
        started_at: datetime | str | None = None,
        finished_at: datetime | str | None = None,
        execution_time_ms: int | None = None,
        parameters: dict[str, Any] | None = None,
        result: dict[str, Any] | None = None,
        error_message: str | None = None,
        error_traceback: str | None = None,
        is_connected: bool | None = None,
        connection_sequence: int | None = None,
        node_identifier: str | None = None,
    ) -> bool:
        """
        노드 실행 로그를 서버로 전송합니다.

        Args:
            execution_id: 워크플로우 실행 ID
            script_id: 스크립트 ID
            node_id: 노드 ID
            node_type: 노드 타입
            node_name: 노드 이름/제목
            status: 실행 상태 (running, completed, failed)
            started_at: 시작 시간 (datetime 또는 ISO 형식 문자열)
            finished_at: 종료 시간 (datetime 또는 ISO 형식 문자열)
            execution_time_ms: 실행 시간 (밀리초)
            parameters: 입력 파라미터
            result: 실행 결과
            error_message: 에러 메시지
            error_traceback: 에러 스택 트레이스

        Returns:
            전송 성공 여부
        """
        if not self.enabled:
            return False

        # datetime을 ISO 형식 문자열로 변환
        if isinstance(started_at, datetime):
            started_at = started_at.isoformat()
        if isinstance(finished_at, datetime):
            finished_at = finished_at.isoformat()

        payload = {
            "execution_id": execution_id,
            "script_id": script_id,
            "node_id": node_id,
            "node_type": node_type,
            "node_name": node_name,
            "status": status,
            "started_at": started_at,
            "finished_at": finished_at,
            "execution_time_ms": execution_time_ms,
            "parameters": parameters,
            "result": result,
            "error_message": error_message,
            "error_traceback": error_traceback,
            "is_connected": is_connected,
            "connection_sequence": connection_sequence,
            "node_identifier": node_identifier,
        }

        try:
            # 각 시도는 2초 타임아웃 (전체 10초 내에 3회 시도 가능하도록)
            async with (
                aiohttp.ClientSession() as session,
                session.post(self.log_endpoint, json=payload, timeout=aiohttp.ClientTimeout(total=2)) as response,
            ):
                if response.status == 200:
                    logger.debug(f"[ExecutionLogClient] 로그 전송 성공 - 노드 ID: {node_id}, 상태: {status}")
                    return True
                error_text = await response.text()
                logger.warning(
                    f"[ExecutionLogClient] 로그 전송 실패 - 상태 코드: {response.status}, 응답: {error_text}"
                )
                return False
        except asyncio.TimeoutError:
            logger.warning(f"[ExecutionLogClient] 로그 전송 타임아웃 (2초) - 노드 ID: {node_id}, 상태: {status}")
            return False
        except Exception as e:
            logger.warning(
                f"[ExecutionLogClient] 로그 전송 중 오류 발생 - 노드 ID: {node_id}, 상태: {status}, 오류: {e!s}"
            )
            return False

    async def send_log_async(
        self,
        execution_id: str | None,
        script_id: int | None,
        node_id: str,
        node_type: str,
        node_name: str | None,
        status: str,
        started_at: datetime | str | None = None,
        finished_at: datetime | str | None = None,
        execution_time_ms: int | None = None,
        parameters: dict[str, Any] | None = None,
        result: dict[str, Any] | None = None,
        error_message: str | None = None,
        error_traceback: str | None = None,
        is_connected: bool | None = None,
        connection_sequence: int | None = None,
        node_identifier: str | None = None,
    ) -> None:
        """
        노드 실행 로그를 비동기로 전송합니다 (fire-and-forget).
        에러가 발생해도 예외를 발생시키지 않습니다.
        전체 작업(재시도 포함)은 10초 내에 완료되어야 합니다.

        Args:
            execution_id: 워크플로우 실행 ID
            script_id: 스크립트 ID
            node_id: 노드 ID
            node_type: 노드 타입
            node_name: 노드 이름/제목
            status: 실행 상태 (running, completed, failed)
            started_at: 시작 시간 (datetime 또는 ISO 형식 문자열)
            finished_at: 종료 시간 (datetime 또는 ISO 형식 문자열)
            execution_time_ms: 실행 시간 (밀리초)
            parameters: 입력 파라미터
            result: 실행 결과
            error_message: 에러 메시지
            error_traceback: 에러 스택 트레이스
        """
        try:
            # 전체 작업(재시도 포함)을 10초로 제한
            success = await asyncio.wait_for(
                self._send_log_with_retry(
                    execution_id=execution_id,
                    script_id=script_id,
                    node_id=node_id,
                    node_type=node_type,
                    node_name=node_name,
                    status=status,
                    started_at=started_at,
                    finished_at=finished_at,
                    execution_time_ms=execution_time_ms,
                    parameters=parameters,
                    result=result,
                    error_message=error_message,
                    error_traceback=error_traceback,
                    is_connected=is_connected,
                    connection_sequence=connection_sequence,
                    node_identifier=node_identifier,
                ),
                timeout=10.0,
            )
            if not success:
                # 로그 전송 실패 시 경고 로그 출력 (특히 실패한 노드의 경우)
                logger.warning(
                    f"[ExecutionLogClient] 로그 전송 실패 - 노드 ID: {node_id}, 노드 타입: {node_type}, 상태: {status}"
                )
        except asyncio.TimeoutError:
            # 전체 타임아웃(10초) 초과 시 경고 로그 출력
            logger.warning(
                f"[ExecutionLogClient] 로그 전송 전체 타임아웃 (10초) - 노드 ID: {node_id}, 노드 타입: {node_type}, 상태: {status}"
            )
        except Exception as e:
            # 로그 전송 실패는 노드 실행에 영향을 주지 않도록 조용히 처리하되, 경고 로그 출력
            logger.warning(
                f"[ExecutionLogClient] 로그 전송 중 예외 발생 (무시됨) - 노드 ID: {node_id}, 노드 타입: {node_type}, 상태: {status}, 오류: {e!s}"
            )

    async def _send_log_with_retry(
        self,
        execution_id: str | None,
        script_id: int | None,
        node_id: str,
        node_type: str,
        node_name: str | None,
        status: str,
        started_at: datetime | str | None = None,
        finished_at: datetime | str | None = None,
        execution_time_ms: int | None = None,
        parameters: dict[str, Any] | None = None,
        result: dict[str, Any] | None = None,
        error_message: str | None = None,
        error_traceback: str | None = None,
        is_connected: bool | None = None,
        connection_sequence: int | None = None,
        node_identifier: str | None = None,
    ) -> bool:
        """
        로그 전송을 재시도하며 시도합니다.
        최대 3회 시도하며, 각 시도 간 0.3초 대기합니다.
        전체 작업은 10초 내에 완료되어야 합니다 (send_log_async에서 타임아웃 관리).

        Returns:
            전송 성공 여부
        """
        max_retries = 3
        retry_delay = 0.3  # 초 (더 빠른 재시도)

        for attempt in range(max_retries):
            success = await self.send_log(
                execution_id=execution_id,
                script_id=script_id,
                node_id=node_id,
                node_type=node_type,
                node_name=node_name,
                status=status,
                started_at=started_at,
                finished_at=finished_at,
                execution_time_ms=execution_time_ms,
                parameters=parameters,
                result=result,
                error_message=error_message,
                error_traceback=error_traceback,
            )

            if success:
                if attempt > 0:
                    logger.debug(f"[ExecutionLogClient] 로그 전송 성공 (재시도 {attempt}회 후) - 노드 ID: {node_id}")
                return True

            # 마지막 시도가 아니면 재시도 전 대기
            if attempt < max_retries - 1:
                await asyncio.sleep(retry_delay)
                logger.debug(
                    f"[ExecutionLogClient] 로그 전송 재시도 ({attempt + 1}/{max_retries}) - 노드 ID: {node_id}"
                )

        # 모든 재시도 실패
        return False


# 전역 로그 클라이언트 인스턴스
_log_client: ExecutionLogClient | None = None


def get_log_client() -> ExecutionLogClient:
    """
    전역 로그 클라이언트 인스턴스를 반환합니다.

    Returns:
        ExecutionLogClient 인스턴스
    """
    global _log_client
    if _log_client is None:
        _log_client = ExecutionLogClient()
    return _log_client
