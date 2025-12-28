"""
로그 관련 모델들
"""

from typing import Any

from pydantic import BaseModel, Field


class NodeExecutionLogRequest(BaseModel):
    """노드 실행 로그 요청 모델"""

    execution_id: str | None = Field(None, description="워크플로우 실행 ID (같은 실행의 노드들을 그룹화)")
    script_id: int | None = Field(None, description="스크립트 ID (선택사항)")
    node_id: str = Field(..., min_length=1, description="노드 ID")
    node_type: str = Field(..., min_length=1, description="노드 타입")
    node_name: str | None = Field(None, description="노드 이름/제목")
    status: str = Field(..., description="실행 상태 (running, completed, failed)")
    started_at: str | None = Field(None, description="시작 시간 (ISO 형식 문자열)")
    finished_at: str | None = Field(None, description="종료 시간 (ISO 형식 문자열)")
    execution_time_ms: int | None = Field(None, description="실행 시간 (밀리초)")
    parameters: dict[str, Any] | None = Field(None, description="입력 파라미터")
    result: dict[str, Any] | None = Field(None, description="실행 결과")
    error_message: str | None = Field(None, description="에러 메시지 (실패 시)")
    error_traceback: str | None = Field(None, description="에러 스택 트레이스 (실패 시)")
    # 연결 정보 필드
    is_connected: bool | None = Field(None, description="다른 노드와 연결되어 있는지 여부")
    connection_sequence: int | None = Field(None, description="시작 노드(0번째)를 기준으로 한 연결 순서")
    node_identifier: str | None = Field(None, description="노드 식별자 (이름, 타입, 순서 등을 포함한 읽기 쉬운 형식)")


class NodeExecutionLogResponse(BaseModel):
    """노드 실행 로그 응답 모델"""

    success: bool
    message: str
    log_id: int | None = None
