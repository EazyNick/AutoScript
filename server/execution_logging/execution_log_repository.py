"""노드 실행 로그 리포지토리 모듈"""

import json
import os
import sys
from typing import Any

# 직접 실행 시와 모듈로 import 시 모두 지원
try:
    from db.connection import DatabaseConnection
except ImportError:
    # 직접 실행 시 절대 import 사용
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from db.connection import DatabaseConnection


class NodeExecutionLogRepository:
    """노드 실행 로그 관련 데이터베이스 작업을 처리하는 클래스"""

    def __init__(self, connection: DatabaseConnection) -> None:
        """
        NodeExecutionLogRepository 초기화

        Args:
            connection: DatabaseConnection 인스턴스
        """
        self.connection = connection

    def create_log(
        self,
        execution_id: str | None,
        script_id: int | None,
        node_id: str,
        node_type: str,
        node_name: str | None,
        status: str,
        started_at: str | None = None,
        finished_at: str | None = None,
        execution_time_ms: int | None = None,
        parameters: dict[str, Any] | None = None,
        result: dict[str, Any] | None = None,
        error_message: str | None = None,
        error_traceback: str | None = None,
        is_connected: bool | None = None,
        connection_sequence: int | None = None,
        node_identifier: str | None = None,
    ) -> int:
        """
        노드 실행 로그 생성 또는 업데이트

        - running 상태: 같은 execution_id와 node_id의 기존 running 로그를 삭제하고 새로 생성
          (단, 이미 completed/failed 로그가 있으면 생성하지 않음)
        - completed/failed 상태: 같은 execution_id와 node_id의 running 로그를 찾아서 업데이트
          (없으면 새로 생성)

        Args:
            execution_id: 워크플로우 실행 ID (같은 실행의 노드들을 그룹화)
            script_id: 스크립트 ID (선택사항)
            node_id: 노드 ID
            node_type: 노드 타입
            node_name: 노드 이름/제목
            status: 실행 상태 (running, completed, failed)
            started_at: 시작 시간 (ISO 형식 문자열)
            finished_at: 종료 시간 (ISO 형식 문자열)
            execution_time_ms: 실행 시간 (밀리초)
            parameters: 입력 파라미터
            result: 실행 결과
            error_message: 에러 메시지 (실패 시)
            error_traceback: 에러 스택 트레이스 (실패 시)

        Returns:
            생성/업데이트된 로그 ID
        """
        conn = self.connection.get_connection()
        cursor = self.connection.get_cursor(conn)

        try:
            # JSON 직렬화
            parameters_json = json.dumps(parameters) if parameters else "{}"
            result_json = json.dumps(result) if result else "{}"

            # execution_id와 node_id가 있는 경우에만 중복 방지 로직 적용
            if execution_id and node_id:
                if status == "running":
                    # running 상태: 이미 completed/failed 로그가 있으면 생성하지 않음
                    cursor.execute(
                        """
                        SELECT id FROM node_execution_logs
                        WHERE execution_id = ? AND node_id = ? AND status IN ('completed', 'failed')
                        ORDER BY id DESC
                        LIMIT 1
                        """,
                        (execution_id, node_id),
                    )
                    completed_log = cursor.fetchone()
                    if completed_log:
                        conn.commit()
                        return completed_log[0]

                    # 기존 running 로그 삭제 (중복 방지)
                    cursor.execute(
                        """
                        DELETE FROM node_execution_logs
                        WHERE execution_id = ? AND node_id = ? AND status = 'running'
                        """,
                        (execution_id, node_id),
                    )

                elif status in ("completed", "failed"):
                    # completed/failed 상태: running 로그를 찾아서 업데이트
                    cursor.execute(
                        """
                        SELECT id FROM node_execution_logs
                        WHERE execution_id = ? AND node_id = ? AND status = 'running'
                        ORDER BY id DESC
                        LIMIT 1
                        """,
                        (execution_id, node_id),
                    )
                    running_log = cursor.fetchone()

                    if running_log:
                        # running 로그를 completed/failed로 업데이트
                        log_id_to_update = running_log[0]
                        # 연결 정보는 running 상태에서 이미 설정되므로 업데이트 시에는 유지
                        # 필요시 파라미터로 받아서 업데이트할 수 있도록 함
                        cursor.execute(
                            """
                            UPDATE node_execution_logs
                            SET status = ?,
                                finished_at = ?,
                                execution_time_ms = ?,
                                result = ?,
                                error_message = ?,
                                error_traceback = ?,
                                is_connected = COALESCE(?, is_connected),
                                connection_sequence = COALESCE(?, connection_sequence),
                                node_identifier = COALESCE(?, node_identifier)
                            WHERE id = ?
                            """,
                            (
                                status,
                                finished_at,
                                execution_time_ms,
                                result_json,
                                error_message,
                                error_traceback,
                                1 if is_connected else 0 if is_connected is False else None,
                                connection_sequence,
                                node_identifier,
                                log_id_to_update,
                            ),
                        )

                        # 남아있는 모든 running 로그 삭제 (중복 방지)
                        cursor.execute(
                            """
                            DELETE FROM node_execution_logs
                            WHERE execution_id = ? AND node_id = ? AND status = 'running'
                            """,
                            (execution_id, node_id),
                        )

                        conn.commit()
                        return log_id_to_update

                    # running 로그가 없고 이미 completed/failed 로그가 있으면 기존 로그 반환
                    cursor.execute(
                        """
                        SELECT id FROM node_execution_logs
                        WHERE execution_id = ? AND node_id = ? AND status IN ('completed', 'failed')
                        ORDER BY id DESC
                        LIMIT 1
                        """,
                        (execution_id, node_id),
                    )
                    existing_log = cursor.fetchone()
                    if existing_log:
                        conn.commit()
                        return existing_log[0]

            # 새 로그 생성
            cursor.execute(
                """
                INSERT INTO node_execution_logs (
                    execution_id, script_id, node_id, node_type, node_name,
                    status, started_at, finished_at, execution_time_ms,
                    parameters, result, error_message, error_traceback,
                    is_connected, connection_sequence, node_identifier
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
                (
                    execution_id,
                    script_id,
                    node_id,
                    node_type,
                    node_name,
                    status,
                    started_at,
                    finished_at,
                    execution_time_ms,
                    parameters_json,
                    result_json,
                    error_message,
                    error_traceback,
                    1 if is_connected else 0 if is_connected is False else None,
                    connection_sequence,
                    node_identifier,
                ),
            )

            log_id = cursor.lastrowid
            if log_id is None:
                raise ValueError("로그 생성 실패: lastrowid가 None입니다")

            conn.commit()
            return log_id
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()

    def get_logs_by_execution_id(self, execution_id: str) -> list[dict[str, Any]]:
        """
        특정 실행 ID의 모든 로그 조회

        Args:
            execution_id: 워크플로우 실행 ID

        Returns:
            로그 목록
        """
        conn = self.connection.get_connection()
        cursor = self.connection.get_cursor(conn)

        try:
            cursor.execute(
                """
                SELECT
                    id, execution_id, script_id, node_id, node_type, node_name,
                    status, started_at, finished_at, execution_time_ms,
                    parameters, result, error_message, error_traceback, created_at,
                    is_connected, connection_sequence, node_identifier
                FROM node_execution_logs
                WHERE execution_id = ?
                ORDER BY started_at ASC
            """,
                (execution_id,),
            )

            logs = []
            for row in cursor.fetchall():
                log = {
                    "id": row[0],
                    "execution_id": row[1],
                    "script_id": row[2],
                    "node_id": row[3],
                    "node_type": row[4],
                    "node_name": row[5],
                    "status": row[6],
                    "started_at": row[7],
                    "finished_at": row[8],
                    "execution_time_ms": row[9],
                    "parameters": json.loads(row[10]) if row[10] else {},
                    "result": json.loads(row[11]) if row[11] else {},
                    "error_message": row[12],
                    "error_traceback": row[13],
                    "created_at": row[14],
                    "is_connected": bool(row[15]) if row[15] is not None else None,
                    "connection_sequence": row[16],
                    "node_identifier": row[17],
                }
                logs.append(log)

            return logs
        finally:
            conn.close()

    def get_logs_by_script_id(self, script_id: int, limit: int = 100, offset: int = 0) -> list[dict[str, Any]]:
        """
        특정 스크립트의 로그 조회

        Args:
            script_id: 스크립트 ID
            limit: 조회할 최대 개수
            offset: 건너뛸 개수

        Returns:
            로그 목록
        """
        conn = self.connection.get_connection()
        cursor = self.connection.get_cursor(conn)

        try:
            cursor.execute(
                """
                SELECT
                    id, execution_id, script_id, node_id, node_type, node_name,
                    status, started_at, finished_at, execution_time_ms,
                    parameters, result, error_message, error_traceback, created_at,
                    is_connected, connection_sequence, node_identifier
                FROM node_execution_logs
                WHERE script_id = ?
                ORDER BY started_at DESC
                LIMIT ? OFFSET ?
            """,
                (script_id, limit, offset),
            )

            logs = []
            for row in cursor.fetchall():
                log = {
                    "id": row[0],
                    "execution_id": row[1],
                    "script_id": row[2],
                    "node_id": row[3],
                    "node_type": row[4],
                    "node_name": row[5],
                    "status": row[6],
                    "started_at": row[7],
                    "finished_at": row[8],
                    "execution_time_ms": row[9],
                    "parameters": json.loads(row[10]) if row[10] else {},
                    "result": json.loads(row[11]) if row[11] else {},
                    "error_message": row[12],
                    "error_traceback": row[13],
                    "created_at": row[14],
                    "is_connected": bool(row[15]) if row[15] is not None else None,
                    "connection_sequence": row[16],
                    "node_identifier": row[17],
                }
                logs.append(log)

            return logs
        finally:
            conn.close()

    def get_logs_by_node_id(self, node_id: str, limit: int = 100, offset: int = 0) -> list[dict[str, Any]]:
        """
        특정 노드의 로그 조회

        Args:
            node_id: 노드 ID
            limit: 조회할 최대 개수
            offset: 건너뛸 개수

        Returns:
            로그 목록
        """
        conn = self.connection.get_connection()
        cursor = self.connection.get_cursor(conn)

        try:
            cursor.execute(
                """
                SELECT
                    id, execution_id, script_id, node_id, node_type, node_name,
                    status, started_at, finished_at, execution_time_ms,
                    parameters, result, error_message, error_traceback, created_at,
                    is_connected, connection_sequence, node_identifier
                FROM node_execution_logs
                WHERE node_id = ?
                ORDER BY started_at DESC
                LIMIT ? OFFSET ?
            """,
                (node_id, limit, offset),
            )

            logs = []
            for row in cursor.fetchall():
                log = {
                    "id": row[0],
                    "execution_id": row[1],
                    "script_id": row[2],
                    "node_id": row[3],
                    "node_type": row[4],
                    "node_name": row[5],
                    "status": row[6],
                    "started_at": row[7],
                    "finished_at": row[8],
                    "execution_time_ms": row[9],
                    "parameters": json.loads(row[10]) if row[10] else {},
                    "result": json.loads(row[11]) if row[11] else {},
                    "error_message": row[12],
                    "error_traceback": row[13],
                    "created_at": row[14],
                    "is_connected": bool(row[15]) if row[15] is not None else None,
                    "connection_sequence": row[16],
                    "node_identifier": row[17],
                }
                logs.append(log)

            return logs
        finally:
            conn.close()

    def get_recent_logs(self, limit: int = 100) -> list[dict[str, Any]]:
        """
        최근 로그 조회

        Args:
            limit: 조회할 최대 개수

        Returns:
            로그 목록
        """
        conn = self.connection.get_connection()
        cursor = self.connection.get_cursor(conn)

        try:
            cursor.execute(
                """
                SELECT
                    id, execution_id, script_id, node_id, node_type, node_name,
                    status, started_at, finished_at, execution_time_ms,
                    parameters, result, error_message, error_traceback, created_at,
                    is_connected, connection_sequence, node_identifier
                FROM node_execution_logs
                ORDER BY started_at DESC
                LIMIT ?
            """,
                (limit,),
            )

            logs = []
            for row in cursor.fetchall():
                log = {
                    "id": row[0],
                    "execution_id": row[1],
                    "script_id": row[2],
                    "node_id": row[3],
                    "node_type": row[4],
                    "node_name": row[5],
                    "status": row[6],
                    "started_at": row[7],
                    "finished_at": row[8],
                    "execution_time_ms": row[9],
                    "parameters": json.loads(row[10]) if row[10] else {},
                    "result": json.loads(row[11]) if row[11] else {},
                    "error_message": row[12],
                    "error_traceback": row[13],
                    "created_at": row[14],
                    "is_connected": bool(row[15]) if row[15] is not None else None,
                    "connection_sequence": row[16],
                    "node_identifier": row[17],
                }
                logs.append(log)

            return logs
        finally:
            conn.close()

    def get_failed_logs(self, script_id: int | None = None, limit: int = 100) -> list[dict[str, Any]]:
        """
        실패한 로그 조회

        Args:
            script_id: 스크립트 ID (선택사항, None이면 전체)
            limit: 조회할 최대 개수

        Returns:
            로그 목록
        """
        conn = self.connection.get_connection()
        cursor = self.connection.get_cursor(conn)

        try:
            if script_id is not None:
                cursor.execute(
                    """
                    SELECT
                        id, execution_id, script_id, node_id, node_type, node_name,
                        status, started_at, finished_at, execution_time_ms,
                        parameters, result, error_message, error_traceback, created_at,
                        is_connected, connection_sequence, node_identifier
                    FROM node_execution_logs
                    WHERE status = 'failed' AND script_id = ?
                    ORDER BY started_at DESC
                    LIMIT ?
                """,
                    (script_id, limit),
                )
            else:
                cursor.execute(
                    """
                    SELECT
                        id, execution_id, script_id, node_id, node_type, node_name,
                        status, started_at, finished_at, execution_time_ms,
                        parameters, result, error_message, error_traceback, created_at,
                        is_connected, connection_sequence, node_identifier
                    FROM node_execution_logs
                    WHERE status = 'failed'
                    ORDER BY started_at DESC
                    LIMIT ?
                """,
                    (limit,),
                )

            logs = []
            for row in cursor.fetchall():
                log = {
                    "id": row[0],
                    "execution_id": row[1],
                    "script_id": row[2],
                    "node_id": row[3],
                    "node_type": row[4],
                    "node_name": row[5],
                    "status": row[6],
                    "started_at": row[7],
                    "finished_at": row[8],
                    "execution_time_ms": row[9],
                    "parameters": json.loads(row[10]) if row[10] else {},
                    "result": json.loads(row[11]) if row[11] else {},
                    "error_message": row[12],
                    "error_traceback": row[13],
                    "created_at": row[14],
                    "is_connected": bool(row[15]) if row[15] is not None else None,
                    "connection_sequence": row[16],
                    "node_identifier": row[17],
                }
                logs.append(log)

            return logs
        finally:
            conn.close()

    def delete_log(self, log_id: int) -> bool:
        """
        특정 로그 삭제

        Args:
            log_id: 로그 ID

        Returns:
            삭제 성공 여부
        """
        conn = self.connection.get_connection()
        cursor = self.connection.get_cursor(conn)

        try:
            cursor.execute("DELETE FROM node_execution_logs WHERE id = ?", (log_id,))
            deleted_count = cursor.rowcount
            conn.commit()
            return deleted_count > 0
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()

    def delete_logs_by_execution_id(self, execution_id: str) -> int:
        """
        특정 실행 ID의 모든 로그 삭제

        Args:
            execution_id: 워크플로우 실행 ID

        Returns:
            삭제된 로그 개수
        """
        conn = self.connection.get_connection()
        cursor = self.connection.get_cursor(conn)

        try:
            cursor.execute("DELETE FROM node_execution_logs WHERE execution_id = ?", (execution_id,))
            deleted_count = cursor.rowcount
            conn.commit()
            return deleted_count
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()

    def delete_all_logs(self) -> int:
        """
        모든 로그 삭제

        Returns:
            삭제된 로그 개수
        """
        conn = self.connection.get_connection()
        cursor = self.connection.get_cursor(conn)

        try:
            cursor.execute("DELETE FROM node_execution_logs")
            deleted_count = cursor.rowcount
            conn.commit()
            return deleted_count
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()
