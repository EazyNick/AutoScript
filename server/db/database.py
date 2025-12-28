"""통합 데이터베이스 관리자 모듈"""

from __future__ import annotations

import logging
import os
import sys
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from collections.abc import Callable
    from logging import Logger

# 로거 초기화
logger = logging.getLogger(__name__)

# 직접 실행 시와 모듈로 import 시 모두 지원
try:
    from execution_logging.execution_log_repository import NodeExecutionLogRepository

    from .connection import DatabaseConnection
    from .dashboard_stats_repository import DashboardStatsRepository
    from .log_stats_repository import LogStatsRepository
    from .node_repository import NodeRepository
    from .script_repository import ScriptRepository
    from .table_manager import TableManager
    from .user_settings_repository import UserSettingsRepository
except ImportError:
    # 직접 실행 시 절대 import 사용
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from execution_logging.execution_log_repository import NodeExecutionLogRepository

    from db.connection import DatabaseConnection
    from db.dashboard_stats_repository import DashboardStatsRepository
    from db.log_stats_repository import LogStatsRepository
    from db.node_repository import NodeRepository
    from db.script_repository import ScriptRepository
    from db.table_manager import TableManager
    from db.user_settings_repository import UserSettingsRepository


class DatabaseManager:
    """
    통합 데이터베이스 관리자 클래스
    모든 데이터베이스 작업을 통합 관리합니다.
    """

    def __init__(self, db_path: str | None = None) -> None:
        """
        DatabaseManager 초기화

        Args:
            db_path: 데이터베이스 파일 경로. None이면 기본 경로 사용
        """
        # 데이터베이스 연결 관리
        self.connection = DatabaseConnection(db_path)

        # 테이블 생성 및 마이그레이션 관리
        self.table_manager = TableManager(self.connection)

        # 리포지토리 인스턴스 (각 테이블별 데이터 접근)
        self.user_settings = UserSettingsRepository(self.connection)  # 사용자 설정
        self.scripts = ScriptRepository(self.connection)  # 스크립트
        self.nodes = NodeRepository(self.connection)  # 노드
        self.dashboard_stats = DashboardStatsRepository(self.connection)  # 대시보드 통계
        self.node_execution_logs = NodeExecutionLogRepository(self.connection)  # 노드 실행 로그
        self.log_stats = LogStatsRepository(self.connection)  # 로그 통계

        # 데이터베이스 초기화는 main.py의 startup_event에서 수행
        # (모듈 로드 시점에는 DB 파일이 없을 수 있으므로)

    def init_database(self) -> None:
        """데이터베이스 초기화"""
        self.table_manager.initialize()
        # 기존 로그가 있으면 통계 계산 및 저장
        self._initialize_log_stats()

    # 사용자 설정 메서드들 (기존 API 호환성 유지)
    def get_user_setting(self, setting_key: str, default_value: str | None = None) -> str | None:
        """사용자 설정 조회"""
        return self.user_settings.get_setting(setting_key, default_value)

    def save_user_setting(self, setting_key: str, setting_value: str) -> bool:
        """사용자 설정 저장"""
        return self.user_settings.save_setting(setting_key, setting_value)

    def get_all_user_settings(self) -> dict[str, str]:
        """모든 사용자 설정 조회"""
        return self.user_settings.get_all_settings()

    def delete_user_setting(self, setting_key: str) -> bool:
        """사용자 설정 삭제"""
        return self.user_settings.delete_setting(setting_key)

    # 스크립트 메서드들 (기존 API 호환성 유지)
    def create_script(self, name: str, description: str = "") -> int:
        """새 스크립트 생성"""
        return self.scripts.create_script(name, description)

    def get_all_scripts(self) -> list[dict[str, Any]]:
        """모든 스크립트 목록 조회"""
        return self.scripts.get_all_scripts()

    def get_script(self, script_id: int) -> dict[str, Any] | None:
        """
        특정 스크립트 조회 (노드 및 연결 정보 포함)

        Args:
            script_id: 스크립트 ID

        Returns:
            스크립트 정보 딕셔너리 (nodes, connections 포함) 또는 None
        """
        # 1. 기본 스크립트 정보 조회
        script_info = self.scripts.get_script(script_id)
        if not script_info:
            return None

        # 2. 노드 정보 조회
        nodes = self.nodes.get_nodes_by_script_id(script_id)

        # 3. 중복 경계 노드 정리 (start/end 노드 중복 방지)
        nodes = self.nodes.cleanup_duplicate_boundary_nodes(script_id, nodes)

        # 4. 연결 정보 생성 (노드의 connected_to에서)
        connections = self.nodes.build_connections_from_nodes(nodes)

        return {**script_info, "nodes": nodes, "connections": connections}

    def save_script_data(self, script_id: int, nodes: list[dict[str, Any]], connections: list[dict[str, Any]]) -> bool:
        """
        스크립트의 노드와 연결 정보 저장

        Args:
            script_id: 스크립트 ID
            nodes: 노드 목록
            connections: 연결 정보 목록

        Returns:
            저장 성공 여부
        """
        # 1. 노드 저장 (연결 정보도 함께 저장)
        success = self.nodes.save_nodes(script_id, nodes, connections)

        if success:
            # 2. 스크립트 업데이트 시간 갱신
            self.scripts.update_script_timestamp(script_id)

        return success

    def delete_script(self, script_id: int) -> bool:
        """스크립트 삭제"""
        return self.scripts.delete_script(script_id)

    def update_script_active(self, script_id: int, active: bool) -> bool:
        """스크립트 활성/비활성 상태 업데이트"""
        return self.scripts.update_script_active(script_id, active)

    def update_script_order(self, script_orders: list[dict[str, int]]) -> bool:
        """스크립트 순서 업데이트"""
        return self.scripts.update_script_order(script_orders)

    # 대시보드 통계 메서드들
    def get_dashboard_stats(self, use_cache: bool = True) -> dict[str, int | float | None]:
        """
        대시보드 통계 조회

        Args:
            use_cache: 캐시 사용 여부 (기본값: True, 현재는 사용하지 않음)

        Returns:
            통계 딕셔너리
        """
        # 항상 최신 데이터로 계산
        return self.calculate_and_update_dashboard_stats()

    def _is_cache_valid(self, cached_stats: dict[str, int]) -> bool:
        """
        캐시가 유효한지 확인

        Args:
            cached_stats: 캐시된 통계 딕셔너리

        Returns:
            캐시 유효 여부
        """
        if not cached_stats or len(cached_stats) == 0:
            return False

        # 모든 통계 키가 있는지 확인
        required_keys = ["total_scripts", "all_executions", "all_failed_scripts", "inactive_scripts"]
        if not all(key in cached_stats for key in required_keys):
            return False

        # updated_at 확인 (5분 이내 업데이트된 경우 유효)
        conn = self.connection.get_connection()
        cursor = self.connection.get_cursor(conn)

        try:
            cursor.execute(
                """
                SELECT MIN(updated_at) FROM dashboard_stats
                WHERE stat_key IN ('total_scripts', 'all_executions', 'all_failed_scripts', 'inactive_scripts')
                """
            )
            result = cursor.fetchone()
            if not result or not result[0]:
                return False

            # SQLite datetime 비교 (5분 = 300초)
            cursor.execute(
                """
                SELECT COUNT(*) FROM dashboard_stats
                WHERE stat_key IN ('total_scripts', 'all_executions', 'all_failed_scripts', 'inactive_scripts')
                AND datetime(updated_at) > datetime('now', '-5 minutes')
                """
            )
            count = cursor.fetchone()[0]
            return count > 0
        finally:
            conn.close()

    def update_dashboard_stats(self, stats: dict[str, int]) -> bool:
        """대시보드 통계 업데이트"""
        return self.dashboard_stats.update_all_stats(stats)

    def set_all_execution_stats(self, total_executions: int, failed_count: int) -> bool:
        """
        전체 실행 통계 설정 (전체 실행 기준)

        Args:
            total_executions: 전체 실행 시 실행된 스크립트 개수
            failed_count: 전체 실행 시 실패한 스크립트 개수

        Returns:
            성공 여부
        """
        stats = {"all_executions": total_executions, "all_failed_scripts": failed_count}
        return self.dashboard_stats.update_all_stats(stats)

    def update_stat(self, stat_key: str) -> bool:
        """
        특정 통계만 업데이트 (이벤트 기반)

        Args:
            stat_key: 통계 키 ('total_scripts', 'today_executions', 'today_failed_scripts', 'inactive_scripts')

        Returns:
            성공 여부
        """
        if stat_key == "total_scripts":
            # 전체 스크립트 개수
            all_scripts = self.get_all_scripts()
            total_scripts = len(all_scripts)
            return self.dashboard_stats.set_stat("total_scripts", total_scripts)

        if stat_key == "inactive_scripts":
            # 비활성 스크립트 개수
            all_scripts = self.get_all_scripts()
            inactive_scripts = sum(1 for script in all_scripts if not script.get("active", True))
            return self.dashboard_stats.set_stat("inactive_scripts", inactive_scripts)

        if stat_key == "today_executions":
            # 오늘 실행 횟수
            today_executions = self._get_today_executions_count()
            return self.dashboard_stats.set_stat("today_executions", today_executions)

        if stat_key == "today_failed_scripts":
            # 오늘 실패한 스크립트 개수
            today_failed = self._get_today_failed_scripts_count()
            logger.info(f"[DB 통계] today_failed_scripts 계산 결과: {today_failed}")
            result = self.dashboard_stats.set_stat("today_failed_scripts", today_failed)
            logger.info(f"[DB 통계] today_failed_scripts DB 저장 결과: {result}")
            return result

        return False

    def _get_today_executions_count(self) -> int:
        """오늘 실행 횟수 조회"""
        conn = self.connection.get_connection()
        cursor = self.connection.get_cursor(conn)

        try:
            # script_executions 테이블이 존재하는지 확인
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='script_executions'")
            table_exists = cursor.fetchone() is not None

            if table_exists:
                # 오늘 실행 횟수 (SQLite datetime 함수 사용, 타임존 고려)
                # date(started_at, 'localtime'): UTC로 저장된 started_at을 로컬 타임존으로 변환 후 날짜 추출
                # date('now', 'localtime'): 현재 로컬 날짜
                cursor.execute(
                    """
                    SELECT COUNT(*) FROM script_executions
                    WHERE date(started_at, 'localtime') = date('now', 'localtime')
                    """
                )
                result = cursor.fetchone()
                return result[0] if result else 0
            return 0
        finally:
            conn.close()

    def _get_today_failed_scripts_count(self) -> int:
        """오늘 실패한 스크립트 개수 조회"""
        conn = self.connection.get_connection()
        cursor = self.connection.get_cursor(conn)

        try:
            # script_executions 테이블이 존재하는지 확인
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='script_executions'")
            table_exists = cursor.fetchone() is not None

            if table_exists:
                # 디버깅: 오늘의 모든 실행 기록 확인
                cursor.execute(
                    """
                    SELECT script_id, status, started_at FROM script_executions
                    WHERE date(started_at, 'localtime') = date('now', 'localtime')
                    ORDER BY started_at DESC
                    """
                )
                all_today_executions = cursor.fetchall()
                logger.debug(f"[DB 통계] 오늘의 모든 실행 기록: {all_today_executions}")

                # 오늘 실패한 스크립트 개수 (고유 스크립트 수)
                cursor.execute(
                    """
                    SELECT COUNT(DISTINCT script_id) FROM script_executions
                    WHERE date(started_at, 'localtime') = date('now', 'localtime') AND status = 'error'
                    """
                )
                result = cursor.fetchone()
                failed_count = result[0] if result else 0

                # 디버깅: 실패한 스크립트 ID 목록 확인
                cursor.execute(
                    """
                    SELECT DISTINCT script_id FROM script_executions
                    WHERE date(started_at, 'localtime') = date('now', 'localtime') AND status = 'error'
                    """
                )
                failed_script_ids = [row[0] for row in cursor.fetchall()]
                logger.info(
                    f"[DB 통계] 오늘 실패한 스크립트 개수: {failed_count}, 스크립트 ID 목록: {failed_script_ids}"
                )

                return failed_count
            return 0
        finally:
            conn.close()

    def calculate_and_update_dashboard_stats(self) -> dict[str, int | float | None]:
        """
        대시보드 통계 계산 및 업데이트
        - 전체 스크립트 개수
        - 전체 실행 횟수 (전체 실행 시 실행된 스크립트 개수)
        - 전체 실패한 스크립트 개수 (전체 실행 시 실패한 스크립트 개수)
        - 비활성 스크립트 개수
        """
        # 전체 스크립트 개수
        all_scripts = self.get_all_scripts()
        total_scripts = len(all_scripts)

        # 비활성 스크립트 개수
        inactive_scripts = sum(1 for script in all_scripts if not script.get("active", True))

        # 전체 실행 통계 조회 (dashboard_stats 테이블에서)
        # 초기값이 없으면 0으로 설정 (마이그레이션 대비)
        all_executions = self.dashboard_stats.get_stat("all_executions", 0)
        all_failed_scripts = self.dashboard_stats.get_stat("all_failed_scripts", 0)

        stats = {
            "total_scripts": total_scripts,
            "all_executions": all_executions,  # 전체 실행 시 실행된 스크립트 개수
            "all_failed_scripts": all_failed_scripts,  # 전체 실행 시 실패한 스크립트 개수
            "inactive_scripts": inactive_scripts,
        }

        # 통계 업데이트 (초기값이 없으면 자동으로 생성됨)
        stats_to_cache = {
            "total_scripts": total_scripts,
            "all_executions": all_executions,
            "all_failed_scripts": all_failed_scripts,
            "inactive_scripts": inactive_scripts,
        }
        self.update_dashboard_stats(stats_to_cache)

        return stats

    def _initialize_log_stats(self) -> None:
        """
        서버 최초 실행 시 기존 로그가 있으면 통계를 계산하여 저장합니다.
        """
        try:
            # 기존 로그가 있는지 확인
            conn = self.connection.get_connection()
            cursor = self.connection.get_cursor(conn)
            try:
                cursor.execute("SELECT COUNT(*) FROM node_execution_logs")
                log_count = cursor.fetchone()[0] or 0
                if log_count > 0:
                    # 기존 로그가 있으면 통계 계산 및 저장
                    self.log_stats.calculate_and_update_stats()
            finally:
                conn.close()
        except Exception as e:
            logger.warning(f"로그 통계 초기화 실패 (무시됨): {e!s}")

    def record_script_execution(
        self,
        script_id: int,
        status: str,
        error_message: str | None = None,
        execution_time_ms: int | None = None,
        execution_id: int | None = None,
    ) -> int | None:
        """
        스크립트 실행 기록 저장 또는 업데이트

        Args:
            script_id: 스크립트 ID
            status: 실행 상태 ('running', 'success', 'error', 'cancelled')
            error_message: 에러 메시지 (실패 시)
            execution_time_ms: 실행 시간 (밀리초)
            execution_id: 실행 기록 ID (업데이트 시 필요, None이면 새로 생성)

        Returns:
            실행 기록 ID (실패 시 None)
        """
        conn = self.connection.get_connection()
        cursor = self.connection.get_cursor(conn)

        try:
            # script_executions 테이블이 존재하는지 확인
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='script_executions'")
            table_exists = cursor.fetchone() is not None

            if not table_exists:
                logger.warning("[DB] script_executions 테이블이 존재하지 않습니다. 실행 기록 저장 건너뜀")
                return None

            from datetime import datetime

            if execution_id is None:
                # 새 실행 기록 생성 (시작)
                started_at = datetime.now().isoformat()
                finished_at = None

                cursor.execute(
                    """
                    INSERT INTO script_executions
                    (script_id, status, started_at, finished_at, error_message, execution_time_ms)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (script_id, status, started_at, finished_at, error_message, execution_time_ms),
                )

                conn.commit()
                execution_id = cursor.lastrowid

                logger.info(
                    f"[DB] 스크립트 실행 기록 저장 (시작) - 실행 ID: {execution_id}, 스크립트 ID: {script_id}, 상태: {status}"
                )
            else:
                # 기존 실행 기록 업데이트 (완료)
                finished_at = datetime.now().isoformat()

                cursor.execute(
                    """
                    UPDATE script_executions
                    SET status = ?, finished_at = ?, error_message = ?, execution_time_ms = ?
                    WHERE id = ?
                    """,
                    (status, finished_at, error_message, execution_time_ms, execution_id),
                )

                conn.commit()

                logger.info(
                    f"[DB] 스크립트 실행 기록 업데이트 (완료) - 실행 ID: {execution_id}, 스크립트 ID: {script_id}, 상태: {status}"
                )

            # 통계 업데이트 (완료 상태일 때만)
            if status in ("success", "error", "cancelled"):
                try:
                    self.update_stat("today_executions")
                    if status == "error":
                        logger.info(f"[DB 통계] 실패한 스크립트 통계 업데이트 시작 - 스크립트 ID: {script_id}")
                        update_result = self.update_stat("today_failed_scripts")
                        if update_result:
                            # 업데이트 후 현재 실패한 스크립트 개수 확인
                            current_failed_count = self._get_today_failed_scripts_count()
                            logger.info(
                                f"[DB 통계] 실패한 스크립트 통계 업데이트 완료 - 현재 실패한 스크립트 개수: {current_failed_count}"
                            )
                        else:
                            logger.warning(f"[DB 통계] 실패한 스크립트 통계 업데이트 실패 - 스크립트 ID: {script_id}")
                    logger.debug("[DB 통계] 실행 기록 저장 후 통계 업데이트 완료")
                except Exception as e:
                    logger.warning(f"[DB 통계] 통계 업데이트 실패 (무시): {e!s}")

            return execution_id
        except Exception as e:
            logger.error(f"[DB] 스크립트 실행 기록 저장/업데이트 실패 - 스크립트 ID: {script_id}, 에러: {e!s}")
            conn.rollback()
            return None
        finally:
            conn.close()

    def seed_example_data(self, logger: Logger | None = None) -> None:
        """
        예시 데이터 생성

        Args:
            logger: 로거 객체 (선택사항). None이면 print 사용
        """
        conn = self.connection.get_connection()
        cursor = self.connection.get_cursor(conn)

        # 로거가 없으면 print 사용
        log_func: Callable[[str], None] = logger.info if logger else print

        try:
            # 기존 데이터 확인
            cursor.execute("SELECT COUNT(*) FROM scripts")
            existing_count = cursor.fetchone()[0]

            if existing_count > 0:
                msg = f"이미 {existing_count}개의 스크립트가 존재합니다. 예시 데이터 생성을 건너뜁니다."
                if logger:
                    logger.info(msg)
                else:
                    print(msg)
                conn.close()
                return

            log_func("예시 데이터 생성 시작...")

            # 스크립트 1: 로그인 테스트
            script1_id = self.scripts.create_script("로그인 테스트", "사용자 로그인 프로세스 검증")
            log_func(f"스크립트 1 생성: ID={script1_id}")

            script1_nodes = [
                {
                    "id": "start",
                    "type": "start",
                    "position": {"x": 0.0, "y": 0.0},
                    "data": {"title": "시작"},
                    "parameters": {},
                    "description": None,
                },
                {
                    "id": "node1",
                    "type": "wait",
                    "position": {"x": 300.0, "y": 0.0},
                    "data": {"title": "대기"},
                    "parameters": {"wait_time": 1.0},
                    "description": "처리 대기",
                },
                {
                    "id": "node2",
                    "type": "condition",
                    "position": {"x": 600.0, "y": 0.0},
                    "data": {"title": "로그인 성공 확인"},
                    "parameters": {"condition": "check_login_success"},
                    "description": "로그인 성공 여부 확인",
                },
            ]

            script1_connections = [
                {"from": "start", "to": "node1", "outputType": None},
                {"from": "node1", "to": "node2", "outputType": None},
            ]

            self.nodes.save_nodes(script1_id, script1_nodes, script1_connections)
            self.scripts.update_script_timestamp(script1_id)
            log_func(f"스크립트 1에 {len(script1_nodes)}개의 노드 추가 완료")

            # 스크립트 2: 이미지 터치 테스트
            script2_id = self.scripts.create_script("이미지 터치 테스트", "이미지 터치 노드를 사용한 자동화 테스트")
            log_func(f"스크립트 2 생성: ID={script2_id}")

            script2_nodes = [
                {
                    "id": "start",
                    "type": "start",
                    "position": {"x": 0.0, "y": 0.0},
                    "data": {"title": "시작"},
                    "parameters": {},
                },
                {
                    "id": "node1",
                    "type": "process-focus",
                    "position": {"x": 300.0, "y": 0.0},
                    "data": {"title": "화면 포커스"},
                    "parameters": {"process_id": 1234},
                },
                {
                    "id": "node2",
                    "type": "image-touch",
                    "position": {"x": 600.0, "y": 0.0},
                    "data": {"title": "이미지 터치"},
                    "parameters": {"folder_path": "C:/Users/User/Desktop/images", "image_count": 5},
                },
                {
                    "id": "node3",
                    "type": "wait",
                    "position": {"x": 900.0, "y": 0.0},
                    "data": {"title": "대기"},
                    "parameters": {"wait_time": 2.0},
                },
            ]

            script2_connections = [
                {"from": "start", "to": "node1", "outputType": None},
                {"from": "node1", "to": "node2", "outputType": None},
                {"from": "node2", "to": "node3", "outputType": None},
            ]

            self.nodes.save_nodes(script2_id, script2_nodes, script2_connections)
            self.scripts.update_script_timestamp(script2_id)
            log_func(f"스크립트 2에 {len(script2_nodes)}개의 노드 추가 완료")

            # 스크립트 3: 엑셀 테스트
            # 엑셀 관련 노드들을 테스트하기 위한 스크립트입니다.
            # 새로운 엑셀 노드를 추가할 때마다 이 스크립트에 노드를 추가하세요.
            script3_id = self.scripts.create_script("엑셀 테스트", "엑셀 노드를 사용한 자동화 테스트")
            log_func(f"스크립트 3 생성: ID={script3_id}")

            script3_nodes = [
                {
                    "id": "start",
                    "type": "start",
                    "position": {"x": 0.0, "y": 0.0},
                    "data": {"title": "시작"},
                    "parameters": {},
                },
                {
                    "id": "node1",
                    "type": "excel-open",
                    "position": {"x": 300.0, "y": 0.0},
                    "data": {"title": "엑셀 열기"},
                    "parameters": {
                        "file_path": "C:\\Users\\User\\Desktop\\test.xlsx",
                        "visible": True,
                    },
                    "description": "엑셀 파일 열기",
                },
                {
                    "id": "node2",
                    "type": "excel-select-sheet",
                    "position": {"x": 600.0, "y": 0.0},
                    "data": {"title": "엑셀 시트 선택"},
                    "parameters": {
                        "execution_id": "",  # 실행 시 이전 노드 출력에서 자동으로 가져옴
                        "sheet_name": "Sheet1",  # 시트 이름으로 선택
                        "sheet_index": None,
                    },
                    "description": "엑셀 시트 선택",
                },
                {
                    "id": "node3",
                    "type": "excel-close",
                    "position": {"x": 900.0, "y": 0.0},
                    "data": {"title": "엑셀 닫기"},
                    "parameters": {
                        "execution_id": "",  # 실행 시 이전 노드 출력에서 자동으로 가져옴
                        "save_changes": True,
                    },
                    "description": "엑셀 파일 닫기",
                },
                # TODO: 새로운 엑셀 노드를 추가할 때 여기에 노드를 추가하세요.
                # 예시:
                # {
                #     "id": "node3",
                #     "type": "excel-read-cell",  # 새로운 엑셀 노드 타입
                #     "position": {"x": 900.0, "y": 0.0},
                #     "data": {"title": "셀 읽기"},
                #     "parameters": {
                #         "sheet": "Sheet1",
                #         "cell": "A1",
                #     },
                #     "description": "엑셀 셀 읽기",
                # },
            ]

            script3_connections = [
                {"from": "start", "to": "node1", "outputType": None},
                {"from": "node1", "to": "node2", "outputType": None},
                {"from": "node2", "to": "node3", "outputType": None},
                # TODO: 새로운 엑셀 노드를 추가할 때 연결도 추가하세요.
                # 예시:
                # {"from": "node2", "to": "node3", "outputType": None},
            ]

            self.nodes.save_nodes(script3_id, script3_nodes, script3_connections)
            self.scripts.update_script_timestamp(script3_id)
            log_func(f"스크립트 3에 {len(script3_nodes)}개의 노드 추가 완료")

            # 스크립트 4: 반복 노드 테스트
            # 반복 노드를 사용한 자동화 테스트입니다.
            # 반복 노드의 아래 연결점에 연결된 노드들을 지정한 횟수만큼 반복 실행합니다.
            script4_id = self.scripts.create_script("반복 노드 테스트", "반복 노드를 사용한 자동화 테스트")
            log_func(f"스크립트 4 생성: ID={script4_id}")

            script4_nodes = [
                {
                    "id": "start",
                    "type": "start",
                    "position": {"x": 0.0, "y": 0.0},
                    "data": {"title": "시작"},
                    "parameters": {},
                    "description": None,
                },
                {
                    "id": "node1",
                    "type": "repeat",
                    "position": {"x": 300.0, "y": 0.0},
                    "data": {"title": "반복"},
                    "parameters": {
                        "repeat_count": 3,  # 3번 반복
                    },
                    "description": "아래 연결된 노드를 3번 반복 실행",
                },
                {
                    "id": "node2",
                    "type": "wait",
                    "position": {"x": 300.0, "y": 200.0},  # 반복 노드 아래에 배치
                    "data": {"title": "대기 (반복)"},
                    "parameters": {
                        "wait_time": 1.0,  # 1초 대기
                    },
                    "description": "반복 실행될 노드",
                },
                {
                    "id": "node3",
                    "type": "wait",
                    "position": {"x": 600.0, "y": 0.0},  # 반복 노드 오른쪽에 배치
                    "data": {"title": "완료 후 실행"},
                    "parameters": {
                        "wait_time": 0.5,  # 0.5초 대기
                    },
                    "description": "반복 완료 후 실행될 노드",
                },
            ]

            script4_connections = [
                {"from": "start", "to": "node1", "outputType": None},  # 시작 -> 반복 노드
                {"from": "node1", "to": "node2", "outputType": "bottom"},  # 반복 노드(아래 연결점) -> 대기 노드
                {"from": "node1", "to": "node3", "outputType": None},  # 반복 노드(오른쪽 출력) -> 완료 후 실행 노드
            ]

            self.nodes.save_nodes(script4_id, script4_nodes, script4_connections)
            self.scripts.update_script_timestamp(script4_id)
            log_func(f"스크립트 4에 {len(script4_nodes)}개의 노드 추가 완료")

            # 사용자 설정 예시 데이터 추가
            user_settings_to_save = [
                ("theme", "dark"),
                ("language", "en"),  # 언어 설정 (기본값: 영어)
                ("auto_save", "true"),
                ("sidebar-width", "300"),  # 기본 사이드바 너비
            ]

            import json

            script_order = json.dumps([script1_id, script2_id, script3_id, script4_id], ensure_ascii=False)
            user_settings_to_save.append(("script-order", script_order))  # 스크립트 순서

            # 첫 번째 스크립트 ID를 포커스된 스크립트로 설정
            user_settings_to_save.append(("focused-script-id", str(script1_id)))

            # 스크린샷 기본 설정값 추가
            screenshot_settings = [
                ("screenshot.autoScreenshot", "true"),
                ("screenshot.screenshotOnError", "true"),
                ("screenshot.savePath", "./screenshots"),
                ("screenshot.imageFormat", "PNG"),
            ]
            user_settings_to_save.extend(screenshot_settings)

            # 사용자 설정 저장
            for setting_key, setting_value in user_settings_to_save:
                self.user_settings.save_setting(setting_key, setting_value)

            log_func("사용자 설정 예시 데이터 추가 완료")

            # 생성된 스크립트 및 노드 개수 계산
            created_scripts = [script1_id, script2_id, script3_id, script4_id]
            total_scripts = len(created_scripts)
            total_nodes = len(script1_nodes) + len(script2_nodes) + len(script3_nodes) + len(script4_nodes)

            # 사용자 설정 개수 계산 (실제 저장된 설정 개수)
            user_settings_count = len(user_settings_to_save)

            log_func("✅ 예시 데이터 생성 완료!")
            log_func(f"   - 스크립트: {total_scripts}개")
            log_func(f"   - 노드: {total_nodes}개")
            log_func(f"   - 사용자 설정: {user_settings_count}개")
            log_func(f"   - 데이터베이스 경로: {self.connection.db_path}")

        except Exception as e:
            error_msg = f"❌ 예시 데이터 생성 실패: {e}"
            if logger:
                logger.error(error_msg)
            else:
                print(error_msg)
            raise e
        finally:
            conn.close()


# 전역 데이터베이스 매니저 인스턴스
db_manager = DatabaseManager()


# ============================================================================
# 테스트 코드
# ============================================================================
# DatabaseManager 클래스의 통합 기능을 테스트합니다.
#
# 테스트 항목:
# 1. DatabaseManager 초기화 (모든 리포지토리 통합)
# 2. 테이블 생성 확인 (scripts, nodes, user_settings)
# 3. 예시 데이터 생성 (스크립트, 노드, 사용자 설정 자동 생성)
# 4. 데이터 검증 (스크립트, 노드, 연결 정보 확인)
# 5. 사용자 설정 CRUD 테스트
# 6. 스크립트 CRUD 테스트
# 7. 노드 저장 및 조회 테스트
# 8. 통합 기능 테스트 (모든 모듈이 함께 작동하는지 확인)
# ============================================================================
if __name__ == "__main__":
    print("=" * 60)
    print("데이터베이스 초기화 및 테스트")
    print("=" * 60)

    # 테스트용 데이터베이스 경로 설정
    test_db_path = os.path.join(os.path.dirname(__file__), "test_workflows.db")

    # 기존 테스트 DB가 있으면 삭제
    if os.path.exists(test_db_path):
        os.remove(test_db_path)
        print(f"기존 테스트 데이터베이스 삭제: {test_db_path}")

    # DatabaseManager 인스턴스 생성
    print("\n[1] DatabaseManager 초기화 중...")
    db = DatabaseManager(test_db_path)
    print("✅ 데이터베이스 초기화 완료")

    # 테이블 생성 확인
    print("\n[2] 테이블 생성 확인 중...")
    conn = db.connection.get_connection()
    cursor = db.connection.get_cursor(conn)
    try:
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cursor.fetchall()]
        print(f"✅ 생성된 테이블: {', '.join(tables)}")
    finally:
        conn.close()

    # 예시 데이터 생성
    print("\n[3] 예시 데이터 생성 중...")
    db.seed_example_data()

    # 데이터 검증
    print("\n[4] 데이터 검증 중...")

    # 스크립트 목록 확인
    scripts = db.get_all_scripts()
    print(f"✅ 스크립트 개수: {len(scripts)}개")
    for script in scripts:
        print(f"   - ID: {script['id']}, 이름: {script['name']}, 설명: {script['description']}")

    # 각 스크립트의 노드 확인
    for script in scripts:
        script_data = db.get_script(script["id"])
        if script_data:
            print(f"\n   스크립트 '{script['name']}':")
            print(f"   - 노드 개수: {len(script_data['nodes'])}개")
            print(f"   - 연결 개수: {len(script_data['connections'])}개")
            for node in script_data["nodes"]:
                print(f"     * {node['id']} ({node['type']}): {node.get('description', '설명 없음')}")

    # 사용자 설정 확인
    settings = db.get_all_user_settings()
    print(f"\n✅ 사용자 설정 개수: {len(settings)}개")
    for key, value in settings.items():
        print(f"   - {key}: {value}")

    # 개별 설정 조회 테스트
    print("\n[5] 개별 설정 조회 테스트...")
    theme = db.get_user_setting("theme", "light")
    print(f"✅ 테마 설정: {theme}")

    # 설정 저장 테스트
    print("\n[6] 설정 저장 테스트...")
    db.save_user_setting("test_key", "test_value")
    test_value = db.get_user_setting("test_key")
    print(f"✅ 테스트 설정 저장 및 조회: {test_value}")

    # 설정 삭제 테스트
    print("\n[7] 설정 삭제 테스트...")
    deleted = db.delete_user_setting("test_key")
    print(f"✅ 테스트 설정 삭제: {deleted}")

    # 스크립트 생성 테스트
    print("\n[8] 스크립트 생성 테스트...")
    new_script_id = db.create_script("테스트 스크립트", "테스트용 스크립트입니다")
    print(f"✅ 새 스크립트 생성: ID={new_script_id}")

    # 노드 저장 테스트
    print("\n[9] 노드 저장 테스트...")
    test_nodes = [
        {
            "id": "start",
            "type": "start",
            "position": {"x": 0.0, "y": 0.0},
            "data": {"title": "시작"},
            "parameters": {},
        },
        {
            "id": "test_node",
            "type": "action",
            "position": {"x": 300.0, "y": 0.0},
            "data": {"title": "테스트 액션"},
            "parameters": {},
            "description": "테스트용 노드",
        },
    ]

    test_connections = [
        {"from": "start", "to": "test_node", "outputType": None},
    ]

    db.save_script_data(new_script_id, test_nodes, test_connections)
    print(f"✅ 노드 저장 완료: {len(test_nodes)}개 노드, {len(test_connections)}개 연결")

    # 저장된 스크립트 조회 테스트
    print("\n[10] 저장된 스크립트 조회 테스트...")
    saved_script = db.get_script(new_script_id)
    if saved_script:
        print(f"✅ 스크립트 조회 성공: {saved_script['name']}")
        print(f"   - 노드 개수: {len(saved_script['nodes'])}개")
        print(f"   - 연결 개수: {len(saved_script['connections'])}개")

    print("\n" + "=" * 60)
    print("✅ 모든 테스트 완료!")
    print(f"테스트 데이터베이스 경로: {test_db_path}")
    print("=" * 60)
