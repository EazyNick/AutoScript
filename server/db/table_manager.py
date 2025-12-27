"""테이블 생성 및 마이그레이션 관리 모듈"""

import contextlib
import os
import sqlite3
import sys

# 직접 실행 시와 모듈로 import 시 모두 지원
try:
    from .connection import DatabaseConnection
except ImportError:
    # 직접 실행 시 절대 import 사용
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from db.connection import DatabaseConnection


class TableManager:
    """데이터베이스 테이블 생성 및 마이그레이션을 관리하는 클래스"""

    def __init__(self, connection: DatabaseConnection) -> None:
        """
        TableManager 초기화

        Args:
            connection: DatabaseConnection 인스턴스
        """
        self.connection = connection

    def create_tables(self) -> None:
        """모든 테이블 생성"""
        conn = self.connection.get_connection()
        cursor = self.connection.get_cursor(conn)

        try:
            # 스크립트 테이블 생성
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS scripts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    description TEXT,
                    active INTEGER DEFAULT 1,
                    execution_order INTEGER DEFAULT NULL,
                    last_executed_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            # 스크립트 인덱스 추가
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_scripts_name ON scripts(name)"
            )  # 이름 검색 및 중복 체크 성능 향상
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_scripts_updated_at ON scripts(updated_at DESC)"
            )  # ORDER BY updated_at DESC 정렬 최적화 (현재 사용 중)
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_scripts_active ON scripts(active) WHERE active = 1"
            )  # 활성 스크립트만 필터링 시 성능 향상
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_scripts_last_executed ON scripts(last_executed_at DESC)"
            )  # 최근 실행 순 정렬 최적화 (대시보드용)
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_scripts_execution_order ON scripts(execution_order ASC)"
            )  # 실행 순서 기준 정렬 최적화 (전체 실행 시 사용)

            # 노드 테이블 생성
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS nodes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    script_id INTEGER NOT NULL,
                    node_id TEXT NOT NULL,
                    node_type TEXT NOT NULL,
                    position_x REAL NOT NULL,
                    position_y REAL NOT NULL,
                    node_data TEXT NOT NULL,
                    connected_to TEXT DEFAULT '[]',
                    connected_from TEXT DEFAULT '[]',
                    parameters TEXT DEFAULT '{}',
                    description TEXT,
                    is_connected INTEGER DEFAULT 0,
                    connection_sequence INTEGER,
                    node_identifier TEXT,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (script_id) REFERENCES scripts (id) ON DELETE CASCADE
                )
            """)
            # 노드 인덱스 및 제약조건 추가
            cursor.execute(
                "CREATE UNIQUE INDEX IF NOT EXISTS idx_nodes_script_node_unique ON nodes(script_id, node_id)"
            )
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_nodes_script_id ON nodes(script_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(node_type)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_nodes_script_type ON nodes(script_id, node_type)")

            # 연결 정보 필드 마이그레이션 (기존 테이블에 컬럼 추가)
            # 기존 데이터와의 호환성을 위해 NULL 허용
            with contextlib.suppress(Exception):
                cursor.execute("ALTER TABLE nodes ADD COLUMN is_connected INTEGER DEFAULT 0")

            with contextlib.suppress(Exception):
                cursor.execute("ALTER TABLE nodes ADD COLUMN connection_sequence INTEGER")

            with contextlib.suppress(Exception):
                cursor.execute("ALTER TABLE nodes ADD COLUMN node_identifier TEXT")

            # 연결 정보 인덱스 추가 (조회 최적화)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_nodes_connection_seq ON nodes(connection_sequence)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_nodes_is_connected ON nodes(is_connected)")

            # 사용자 설정 테이블 생성 (개선: 향후 인증 시스템 대비)
            # 사용자별 설정을 키-값 쌍으로 저장
            # 주요 설정 키:
            #   - focused-script-id: 마지막으로 포커스된 스크립트 ID
            #   - script-order: 스크립트 목록 순서 (JSON 배열)
            #   - sidebar-width: 사이드바 너비
            #   - theme: 테마 설정 (dark/light)
            #   - language: 언어 설정
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_settings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT DEFAULT NULL,
                    setting_key TEXT NOT NULL,
                    setting_value TEXT NOT NULL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, setting_key)
                )
            """)
            # 사용자 설정 인덱스 추가
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_settings_key ON user_settings(setting_key)")

            # 실행 기록 테이블 생성 (실행 로그 관리용)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS script_executions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    script_id INTEGER NOT NULL,
                    status TEXT NOT NULL DEFAULT 'running',
                    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    finished_at TIMESTAMP,
                    error_message TEXT,
                    execution_time_ms INTEGER,
                    FOREIGN KEY (script_id) REFERENCES scripts(id) ON DELETE CASCADE
                )
            """)
            # 실행 기록 인덱스 추가
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_executions_script_id ON script_executions(script_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_executions_status ON script_executions(status)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_executions_started_at ON script_executions(started_at DESC)")
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_executions_script_status ON script_executions(script_id, status)"
            )

            # 노드 실행 로그 테이블 생성 (각 노드의 실행 결과 추적)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS node_execution_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    execution_id TEXT,
                    script_id INTEGER,
                    node_id TEXT NOT NULL,
                    node_type TEXT NOT NULL,
                    node_name TEXT,
                    status TEXT NOT NULL DEFAULT 'running',
                    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    finished_at TIMESTAMP,
                    execution_time_ms INTEGER,
                    parameters TEXT DEFAULT '{}',
                    result TEXT DEFAULT '{}',
                    error_message TEXT,
                    error_traceback TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    is_connected INTEGER DEFAULT 0,
                    connection_sequence INTEGER,
                    node_identifier TEXT,
                    FOREIGN KEY (script_id) REFERENCES scripts(id) ON DELETE CASCADE
                )
            """)
            # 노드 실행 로그 인덱스 추가
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_node_logs_execution_id ON node_execution_logs(execution_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_node_logs_script_id ON node_execution_logs(script_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_node_logs_node_id ON node_execution_logs(node_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_node_logs_status ON node_execution_logs(status)")
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_node_logs_started_at ON node_execution_logs(started_at DESC)"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_node_logs_script_started ON node_execution_logs(script_id, started_at DESC)"
            )

            # 연결 정보 필드 마이그레이션 (기존 테이블에 컬럼 추가)
            # 기존 데이터와의 호환성을 위해 NULL 허용
            with contextlib.suppress(Exception):
                cursor.execute("ALTER TABLE node_execution_logs ADD COLUMN is_connected INTEGER DEFAULT 0")

            with contextlib.suppress(Exception):
                cursor.execute("ALTER TABLE node_execution_logs ADD COLUMN connection_sequence INTEGER")

            with contextlib.suppress(Exception):
                cursor.execute("ALTER TABLE node_execution_logs ADD COLUMN node_identifier TEXT")

            # 연결 정보 인덱스 추가 (조회 최적화)
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_node_logs_connection_seq ON node_execution_logs(connection_sequence)"
            )
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_node_logs_is_connected ON node_execution_logs(is_connected)")

            # 로그 통계 테이블 생성 (실행 기록 페이지 통계)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS log_stats (
                    stat_key TEXT PRIMARY KEY,
                    stat_value INTEGER NOT NULL DEFAULT 0,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_log_stats_key ON log_stats(stat_key)")

            # 로그 통계 초기값 설정
            # total: 전체 로그 개수
            # completed: 완료된 로그 개수
            # failed: 실패한 로그 개수
            # average_execution_time: 평균 실행 시간 (밀리초)
            cursor.execute("""
                INSERT OR IGNORE INTO log_stats (stat_key, stat_value, updated_at, created_at)
                VALUES
                    ('total', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
                    ('completed', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
                    ('failed', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
                    ('average_execution_time', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """)

            # 태그 테이블 생성 (스크립트 분류 및 검색용)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS tags (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    color TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name)")

            # 스크립트-태그 관계 테이블
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS script_tags (
                    script_id INTEGER NOT NULL,
                    tag_id INTEGER NOT NULL,
                    PRIMARY KEY (script_id, tag_id),
                    FOREIGN KEY (script_id) REFERENCES scripts(id) ON DELETE CASCADE,
                    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
                )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_script_tags_script ON script_tags(script_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_script_tags_tag ON script_tags(tag_id)")

            # 대시보드 통계 테이블 생성
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS dashboard_stats (
                    stat_key TEXT PRIMARY KEY,
                    stat_value INTEGER NOT NULL DEFAULT 0,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_dashboard_stats_key ON dashboard_stats(stat_key)")

            # 대시보드 통계 초기값 설정
            # all_executions: 전체 실행 시 실행된 스크립트 개수
            # all_failed_scripts: 전체 실행 시 실패한 스크립트 개수
            cursor.execute("""
                INSERT OR IGNORE INTO dashboard_stats (stat_key, stat_value, updated_at, created_at)
                VALUES
                    ('all_executions', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
                    ('all_failed_scripts', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
                    ('total_scripts', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
                    ('inactive_scripts', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """)

            # 통계 뷰 생성 (대시보드용)
            self._create_views(cursor)

            conn.commit()
        finally:
            conn.close()

    def _create_views(self, cursor: sqlite3.Cursor) -> None:
        """성능 최적화를 위한 뷰 생성"""
        # 스크립트 통계 뷰 (대시보드용)
        cursor.execute("""
            CREATE VIEW IF NOT EXISTS script_stats AS
            SELECT
                s.id,
                s.name,
                s.active,
                s.last_executed_at,
                COUNT(e.id) AS total_executions,
                SUM(CASE WHEN e.status = 'success' THEN 1 ELSE 0 END) AS success_count,
                SUM(CASE WHEN e.status = 'error' THEN 1 ELSE 0 END) AS error_count,
                AVG(e.execution_time_ms) AS avg_execution_time_ms,
                MAX(e.started_at) AS last_execution_at
            FROM scripts s
            LEFT JOIN script_executions e ON s.id = e.script_id
            GROUP BY s.id, s.name, s.active, s.last_executed_at
        """)

    def migrate_tables(self) -> None:
        """기존 테이블에 컬럼 추가 (마이그레이션)"""
        conn = self.connection.get_connection()
        cursor = self.connection.get_cursor(conn)

        try:
            # nodes 테이블 마이그레이션
            with contextlib.suppress(sqlite3.OperationalError):
                cursor.execute("ALTER TABLE nodes ADD COLUMN connected_to TEXT DEFAULT '[]'")
            with contextlib.suppress(sqlite3.OperationalError):
                cursor.execute("ALTER TABLE nodes ADD COLUMN connected_from TEXT DEFAULT '[]'")
            with contextlib.suppress(sqlite3.OperationalError):
                cursor.execute("ALTER TABLE nodes ADD COLUMN parameters TEXT DEFAULT '{}'")
            with contextlib.suppress(sqlite3.OperationalError):
                cursor.execute("ALTER TABLE nodes ADD COLUMN description TEXT DEFAULT NULL")
            with contextlib.suppress(sqlite3.OperationalError):
                cursor.execute("ALTER TABLE nodes ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")

            # scripts 테이블 마이그레이션
            with contextlib.suppress(sqlite3.OperationalError):
                cursor.execute("ALTER TABLE scripts ADD COLUMN active INTEGER DEFAULT 1")
            with contextlib.suppress(sqlite3.OperationalError):
                cursor.execute("ALTER TABLE scripts ADD COLUMN last_executed_at TIMESTAMP")
            with contextlib.suppress(sqlite3.OperationalError):
                # display_order를 execution_order로 변경 (기존 컬럼이 있으면 이름 변경)
                cursor.execute("ALTER TABLE scripts ADD COLUMN execution_order INTEGER DEFAULT NULL")
                # 기존 display_order가 있으면 execution_order로 데이터 이전
                with contextlib.suppress(sqlite3.OperationalError):
                    cursor.execute(
                        "UPDATE scripts SET execution_order = display_order WHERE execution_order IS NULL AND display_order IS NOT NULL"
                    )
                # 기존 스크립트의 execution_order를 id로 초기화
                cursor.execute("UPDATE scripts SET execution_order = id WHERE execution_order IS NULL")
            # execution_order 인덱스 추가
            with contextlib.suppress(sqlite3.OperationalError):
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_scripts_execution_order ON scripts(execution_order ASC)")

            # user_settings 테이블 마이그레이션
            with contextlib.suppress(sqlite3.OperationalError):
                cursor.execute("ALTER TABLE user_settings ADD COLUMN user_id TEXT DEFAULT NULL")
                # 기존 UNIQUE 제약조건 제거 후 새로운 복합 제약조건 추가
                # SQLite는 ALTER TABLE로 UNIQUE 제약조건을 직접 수정할 수 없으므로
                # 인덱스를 통해 처리 (이미 create_tables에서 처리됨)

            # 인덱스 마이그레이션 (기존 테이블에 인덱스 추가)
            with contextlib.suppress(sqlite3.OperationalError):
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_scripts_name ON scripts(name)")
            with contextlib.suppress(sqlite3.OperationalError):
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_scripts_updated_at ON scripts(updated_at DESC)")
            with contextlib.suppress(sqlite3.OperationalError):
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_scripts_active ON scripts(active) WHERE active = 1")
            with contextlib.suppress(sqlite3.OperationalError):
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_scripts_last_executed ON scripts(last_executed_at DESC)")
            with contextlib.suppress(sqlite3.OperationalError):
                cursor.execute(
                    "CREATE UNIQUE INDEX IF NOT EXISTS idx_nodes_script_node_unique ON nodes(script_id, node_id)"
                )
            with contextlib.suppress(sqlite3.OperationalError):
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_nodes_script_id ON nodes(script_id)")
            with contextlib.suppress(sqlite3.OperationalError):
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(node_type)")
            with contextlib.suppress(sqlite3.OperationalError):
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_nodes_script_type ON nodes(script_id, node_type)")
            with contextlib.suppress(sqlite3.OperationalError):
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id)")
            with contextlib.suppress(sqlite3.OperationalError):
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_settings_key ON user_settings(setting_key)")

            # 대시보드 통계 초기값 마이그레이션 (기존 DB에 all_executions, all_failed_scripts가 없으면 추가)
            with contextlib.suppress(sqlite3.OperationalError):
                cursor.execute("""
                    INSERT OR IGNORE INTO dashboard_stats (stat_key, stat_value, updated_at, created_at)
                    VALUES
                        ('all_executions', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
                        ('all_failed_scripts', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """)

            # 로그 통계 테이블 마이그레이션 (기존 DB에 log_stats 테이블이 없으면 생성)
            with contextlib.suppress(sqlite3.OperationalError):
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS log_stats (
                        stat_key TEXT PRIMARY KEY,
                        stat_value INTEGER NOT NULL DEFAULT 0,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_log_stats_key ON log_stats(stat_key)")

                # 로그 통계 초기값 설정
                cursor.execute("""
                    INSERT OR IGNORE INTO log_stats (stat_key, stat_value, updated_at, created_at)
                    VALUES
                        ('total', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
                        ('completed', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
                        ('failed', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
                        ('average_execution_time', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """)

            conn.commit()
        finally:
            conn.close()

    def initialize(self) -> None:
        """테이블 생성 및 마이그레이션 실행"""
        self.create_tables()
        self.migrate_tables()


# ============================================================================
# 테스트 코드
# ============================================================================
# TableManager 클래스의 기능을 테스트합니다.
#
# 테스트 항목:
# 1. DatabaseConnection 및 TableManager 인스턴스 생성
# 2. 테이블 생성 (scripts, nodes, user_settings)
# 3. 테이블 구조 확인 (컬럼 정보)
# 4. 마이그레이션 테스트 (기존 테이블에 컬럼 추가)
# 5. initialize 메서드 (전체 초기화 프로세스)
# 6. 외래키 제약조건 테스트 (데이터 무결성 확인)
# ============================================================================
if __name__ == "__main__":
    print("=" * 60)
    print("TableManager 모듈 테스트")
    print("=" * 60)

    # 테스트용 데이터베이스 경로 설정
    test_db_path = os.path.join(os.path.dirname(__file__), "test_table_manager.db")

    # 기존 테스트 DB가 있으면 삭제
    if os.path.exists(test_db_path):
        os.remove(test_db_path)
        print(f"기존 테스트 데이터베이스 삭제: {test_db_path}\n")

    # [1] DatabaseConnection 및 TableManager 인스턴스 생성
    print("[1] DatabaseConnection 및 TableManager 인스턴스 생성...")
    conn = DatabaseConnection(test_db_path)
    table_manager = TableManager(conn)
    print("✅ 인스턴스 생성 성공\n")

    # [2] 테이블 생성 테스트
    print("[2] 테이블 생성 테스트...")
    table_manager.create_tables()
    print("✅ 테이블 생성 완료")

    # 생성된 테이블 확인
    db_conn = conn.get_connection()
    cursor = conn.get_cursor(db_conn)
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    tables = [row[0] for row in cursor.fetchall()]

    # 생성된 뷰 확인
    cursor.execute("SELECT name FROM sqlite_master WHERE type='view' ORDER BY name")
    views = [row[0] for row in cursor.fetchall()]
    db_conn.close()
    print(f"   - 생성된 테이블: {', '.join(tables)}")
    if views:
        print(f"   - 생성된 뷰: {', '.join(views)}")
    print()

    # [3] 각 테이블의 구조 확인
    print("[3] 테이블 구조 확인 테스트...")
    db_conn = conn.get_connection()
    cursor = conn.get_cursor(db_conn)

    # scripts 테이블 구조 확인
    cursor.execute("PRAGMA table_info(scripts)")
    scripts_columns = cursor.fetchall()
    print("   - scripts 테이블 컬럼:")
    for col in scripts_columns:
        print(f"     * {col[1]} ({col[2]})")

    # nodes 테이블 구조 확인
    cursor.execute("PRAGMA table_info(nodes)")
    nodes_columns = cursor.fetchall()
    print("   - nodes 테이블 컬럼:")
    for col in nodes_columns:
        print(f"     * {col[1]} ({col[2]})")

    # user_settings 테이블 구조 확인
    cursor.execute("PRAGMA table_info(user_settings)")
    settings_columns = cursor.fetchall()
    print("   - user_settings 테이블 컬럼:")
    for col in settings_columns:
        print(f"     * {col[1]} ({col[2]})")

    db_conn.close()
    print()

    # [4] 마이그레이션 테스트 (컬럼 추가)
    print("[4] 마이그레이션 테스트 (컬럼 추가)...")

    # 먼저 기존 nodes 테이블에서 일부 컬럼 제거 시뮬레이션 (실제로는 하지 않음)
    # 마이그레이션은 이미 존재하는 컬럼에 대해 에러를 무시하므로 안전하게 실행 가능
    table_manager.migrate_tables()
    print("✅ 마이그레이션 실행 완료")

    # 마이그레이션 후 컬럼 확인
    db_conn = conn.get_connection()
    cursor = conn.get_cursor(db_conn)
    cursor.execute("PRAGMA table_info(nodes)")
    nodes_columns_after = cursor.fetchall()
    db_conn.close()

    # connected_to, connected_from, parameters, description, updated_at 컬럼 확인
    column_names = [col[1] for col in nodes_columns_after]
    expected_columns = ["connected_to", "connected_from", "parameters", "description", "updated_at"]
    print("   - 마이그레이션 후 nodes 테이블 컬럼 확인:")
    for col_name in expected_columns:
        if col_name in column_names:
            print(f"     ✅ {col_name} 컬럼 존재")
        else:
            print(f"     ❌ {col_name} 컬럼 없음")

    # scripts 테이블 마이그레이션 확인
    cursor.execute("PRAGMA table_info(scripts)")
    scripts_columns_after = cursor.fetchall()
    scripts_column_names = [col[1] for col in scripts_columns_after]
    expected_scripts_columns = ["active", "last_executed_at"]
    print("   - 마이그레이션 후 scripts 테이블 컬럼 확인:")
    for col_name in expected_scripts_columns:
        if col_name in scripts_column_names:
            print(f"     ✅ {col_name} 컬럼 존재")
        else:
            print(f"     ❌ {col_name} 컬럼 없음")

    # user_settings 테이블 마이그레이션 확인
    cursor.execute("PRAGMA table_info(user_settings)")
    settings_columns_after = cursor.fetchall()
    settings_column_names = [col[1] for col in settings_columns_after]
    if "user_id" in settings_column_names:
        print("   - 마이그레이션 후 user_settings 테이블:")
        print("     ✅ user_id 컬럼 존재")
    else:
        print("   - 마이그레이션 후 user_settings 테이블:")
        print("     ❌ user_id 컬럼 없음")
    print()

    # [5] initialize 메서드 테스트 (전체 초기화)
    print("[5] initialize 메서드 테스트 (전체 초기화)...")
    # 새로운 DB로 테스트
    test_db_path2 = os.path.join(os.path.dirname(__file__), "test_table_manager2.db")
    if os.path.exists(test_db_path2):
        os.remove(test_db_path2)

    conn2 = DatabaseConnection(test_db_path2)
    table_manager2 = TableManager(conn2)
    table_manager2.initialize()

    # 초기화 확인
    db_conn2 = conn2.get_connection()
    cursor2 = conn2.get_cursor(db_conn2)
    cursor2.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables2 = [row[0] for row in cursor2.fetchall()]
    db_conn2.close()

    print("✅ initialize 실행 완료")
    print(f"   - 생성된 테이블: {', '.join(tables2)}\n")

    # [6] 데이터 삽입 테스트 (외래키 제약조건 확인)
    print("[6] 데이터 삽입 테스트...")
    db_conn = conn.get_connection()
    cursor = conn.get_cursor(db_conn)

    try:
        # 외래키 제약조건 활성화 (SQLite는 기본적으로 비활성화)
        cursor.execute("PRAGMA foreign_keys = ON")

        # 스크립트 생성
        cursor.execute("INSERT INTO scripts (name, description) VALUES (?, ?)", ("테스트 스크립트", "외래키 테스트용"))
        script_id = cursor.lastrowid

        # 노드 생성 (정상 케이스)
        cursor.execute(
            """
            INSERT INTO nodes (script_id, node_id, node_type, position_x, position_y, node_data)
            VALUES (?, ?, ?, ?, ?, ?)
        """,
            (script_id, "node1", "action", 100.0, 200.0, '{"title": "테스트"}'),
        )
        print("✅ 데이터 삽입 성공 (정상 케이스)")

        # 잘못된 script_id로 노드 생성 시도 (에러 발생해야 함)
        try:
            cursor.execute(
                """
                INSERT INTO nodes (script_id, node_id, node_type, position_x, position_y, node_data)
                VALUES (?, ?, ?, ?, ?, ?)
            """,
                (99999, "node2", "action", 100.0, 200.0, '{"title": "테스트"}'),
            )
            print("⚠️  외래키 제약조건이 작동하지 않음 (SQLite 설정 확인 필요)")
        except sqlite3.IntegrityError:
            print("✅ 외래키 제약조건 작동 확인 (에러 발생 정상)")

        db_conn.commit()
    finally:
        db_conn.close()
    print()

    # 정리 (모든 연결 닫기)
    import gc
    import time

    gc.collect()
    time.sleep(0.1)

    try:
        if os.path.exists(test_db_path):
            os.remove(test_db_path)
        if os.path.exists(test_db_path2):
            os.remove(test_db_path2)
        print("테스트 데이터베이스 정리 완료")
    except PermissionError:
        print("⚠️  테스트 데이터베이스 삭제 실패 (파일이 사용 중)")
        print("   수동으로 삭제해주세요.")

    print("\n" + "=" * 60)
    print("✅ 모든 테스트 완료!")
    print("=" * 60)
