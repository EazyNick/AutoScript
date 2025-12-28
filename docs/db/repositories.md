# 데이터베이스 리포지토리 구조

데이터베이스 접근 계층(Repository Pattern) 구조에 대한 문서입니다.

## 개요

프로젝트는 Repository Pattern을 사용하여 데이터베이스 접근을 추상화합니다. 각 엔티티별로 전용 리포지토리를 제공하여 코드의 재사용성과 유지보수성을 향상시킵니다.

## 데이터베이스 구조 원칙

### 외래키 기반 계층 구조

프로젝트는 **큰 부모 테이블에서 작은 자식 테이블로 외래키를 사용하는 구조**를 따릅니다:

- **부모 테이블**: `scripts` (메인 엔티티)
- **자식 테이블**: `nodes`, `script_executions`, `script_tags` (외래키로 `scripts.id` 참조)
- **독립 테이블**: `tags`, `user_settings`, `dashboard_stats`

이 구조의 이점:
1. **데이터 무결성**: 외래키 제약조건으로 잘못된 참조 방지
2. **자동 삭제**: 부모 레코드 삭제 시 자식 레코드 자동 삭제 (CASCADE)
3. **일관성**: 모든 관련 데이터가 일관되게 관리됨
4. **성능**: 인덱스를 통한 효율적인 조회

## 리포지토리 목록

### 1. `ScriptRepository`

스크립트(워크플로우) 관련 데이터베이스 작업을 처리합니다.

**파일**: `server/db/script_repository.py`

**주요 메서드:**
- `create_script(name, description)`: 새 스크립트 생성
- `get_all_scripts()`: 모든 스크립트 목록 조회 (active, execution_order, last_executed_at 필드 포함)
- `get_script(script_id)`: 특정 스크립트 조회 (active, execution_order, last_executed_at 필드 포함)
- `update_script_timestamp(script_id)`: 스크립트 수정 시간 갱신
- `update_script_active(script_id, active)`: 스크립트 활성/비활성 상태 업데이트
- `update_script_order(script_orders)`: 스크립트 실행 순서 업데이트 (전체 실행 시 사용되는 순서)
- `delete_script(script_id)`: 스크립트 삭제

**사용 예시:**
```python
from server.db.script_repository import ScriptRepository
from server.db.connection import DatabaseConnection

conn = DatabaseConnection()
repo = ScriptRepository(conn)

# 스크립트 생성
script_id = repo.create_script("테스트 스크립트", "설명")

# 스크립트 조회
script = repo.get_script(script_id)
```

### 2. `NodeRepository`

노드 관련 데이터베이스 작업을 처리합니다.

**파일**: `server/db/node_repository.py`

**주요 메서드:**
- `get_nodes_by_script_id(script_id)`: 스크립트의 노드 목록 조회
- `save_nodes(script_id, nodes, connections)`: 노드 저장 (연결 정보 포함)
- `build_connections_from_nodes(nodes)`: 노드 목록에서 연결 정보 생성
- `validate_connections(nodes, connections)`: 연결 정보 검증
- `cleanup_duplicate_boundary_nodes(script_id, nodes)`: 중복 경계 노드 정리

**특징:**
- JSON 필드 자동 파싱 (`connected_to`, `connected_from`, `parameters`)
- 연결 정보 검증 (조건 노드가 아닌 노드는 출력 최대 1개)
- 중복 경계 노드 자동 정리

**사용 예시:**
```python
from server.db.node_repository import NodeRepository

repo = NodeRepository(conn)

# 노드 저장
nodes = [
    {
        "id": "start",
        "type": "start",
        "position": {"x": 0, "y": 0},
        "data": {"title": "시작"},
        "parameters": {}
    }
]
connections = []
repo.save_nodes(script_id, nodes, connections)

# 노드 조회
nodes = repo.get_nodes_by_script_id(script_id)
```

### 3. `UserSettingsRepository`

사용자 설정 관련 데이터베이스 작업을 처리합니다.

**파일**: `server/db/user_settings_repository.py`

**주요 메서드:**
- `get_setting(setting_key, default_value, user_id)`: 설정 조회
- `save_setting(setting_key, setting_value, user_id)`: 설정 저장 (UPSERT)
- `get_all_settings(user_id)`: 모든 설정 조회
- `delete_setting(setting_key, user_id)`: 설정 삭제

**특징:**
- UPSERT 지원 (INSERT OR UPDATE)
- 기본값 처리
- 다중 사용자 지원 (`user_id` 파라미터, NULL이면 전역 설정)

**사용 예시:**
```python
from server.db.user_settings_repository import UserSettingsRepository

repo = UserSettingsRepository(conn)

# 설정 저장
repo.save_setting("theme", "dark")

# 설정 조회
theme = repo.get_setting("theme", "light")
```

### 4. `DashboardStatsRepository`

대시보드 통계 관련 데이터베이스 작업을 처리합니다.

**파일**: `server/db/dashboard_stats_repository.py`

**주요 메서드:**
- `get_stat(stat_key, default_value)`: 특정 통계 값 조회
- `set_stat(stat_key, stat_value)`: 통계 값 설정 (UPSERT)
- `get_all_stats()`: 모든 통계 값 조회
- `update_all_stats(stats)`: 여러 통계 값을 한 번에 업데이트

**특징:**
- UPSERT 지원 (INSERT OR UPDATE)
- 통계 키 기반 조회
- 대시보드 성능 최적화를 위한 캐싱

**주요 통계 키:**
- `total_scripts`: 전체 스크립트 개수
- `today_executions`: 오늘 실행 횟수
- `today_failed`: 오늘 실패한 스크립트 개수
- `inactive_scripts`: 비활성 스크립트 개수

**사용 예시:**
```python
from server.db.dashboard_stats_repository import DashboardStatsRepository

repo = DashboardStatsRepository(conn)

# 통계 조회
total_scripts = repo.get_stat("total_scripts", 0)

# 통계 설정
repo.set_stat("total_scripts", 10)

# 모든 통계 조회
all_stats = repo.get_all_stats()
```

### 5. `NodeExecutionLogRepository`

노드 실행 로그 관련 데이터베이스 작업을 처리합니다.

**파일**: `server/execution_logging/execution_log_repository.py`

**주요 메서드:**
- `create_log(...)`: 노드 실행 로그 생성
- `get_logs_by_execution_id(execution_id)`: 실행 ID별 로그 조회
- `get_logs_by_script_id(script_id, limit, offset)`: 스크립트별 로그 조회
- `get_logs_by_node_id(node_id, limit, offset)`: 노드별 로그 조회
- `get_recent_logs(limit)`: 최근 로그 조회
- `get_failed_logs(script_id, limit)`: 실패한 로그 조회
- `delete_log(log_id)`: 개별 로그 삭제
- `delete_logs_by_execution_id(execution_id)`: 실행 ID별 모든 로그 삭제
- `delete_all_logs()`: 전체 로그 삭제

**특징:**
- JSON 필드 자동 파싱 (`parameters`, `result`)
- 다양한 조회 옵션 (실행 ID, 스크립트 ID, 노드 ID, 상태별)
- 페이징 지원 (limit, offset)
- 시간순 정렬 (최신순)

**사용 예시:**
```python
from execution_logging.execution_log_repository import NodeExecutionLogRepository

repo = NodeExecutionLogRepository(conn)

# 로그 생성
log_id = repo.create_log(
    execution_id="exec-123",
    script_id=1,
    node_id="node_1",
    node_type="image-touch",
    status="completed",
    # ... 기타 파라미터
)

# 실행 ID로 조회
logs = repo.get_logs_by_execution_id("exec-123")

# 스크립트별 조회
logs = repo.get_logs_by_script_id(script_id=1, limit=100)

# 실패한 로그만 조회
failed_logs = repo.get_failed_logs(script_id=1, limit=50)

# 개별 로그 삭제
deleted = repo.delete_log(log_id=123)

# 실행 ID별 로그 삭제
deleted_count = repo.delete_logs_by_execution_id("20240115-143025-a3f9b2")

# 전체 로그 삭제
deleted_count = repo.delete_all_logs()
```

자세한 내용은 [노드 실행 로그 시스템](node_execution_logs.md) 문서를 참고하세요.

## 통합 관리자

### `DatabaseManager`

모든 리포지토리를 통합 관리하는 클래스입니다.

**파일**: `server/db/database.py`

**주요 기능:**
- 모든 리포지토리 인스턴스 관리
- 데이터베이스 초기화
- 예시 데이터 생성
- 대시보드 통계 계산 및 업데이트 (`calculate_and_update_dashboard_stats()`)

**사용 예시:**
```python
from server.db.database import DatabaseManager

# 데이터베이스 초기화
db = DatabaseManager()

# 스크립트 생성
script_id = db.create_script("테스트", "설명")

# 노드 저장
db.save_script_data(script_id, nodes, connections)

# 설정 저장
db.save_user_setting("theme", "dark")
```

## 연결 관리

### `DatabaseConnection`

데이터베이스 연결을 관리하는 클래스입니다.

**파일**: `server/db/connection.py`

**주요 기능:**
- SQLite 연결 생성 및 관리
- 자동 커밋/롤백 처리
- 연결 자동 종료

**사용 예시:**
```python
from server.db.connection import DatabaseConnection

conn = DatabaseConnection()

# 직접 연결 사용
db_conn = conn.get_connection()
cursor = conn.get_cursor(db_conn)
cursor.execute("SELECT * FROM scripts")
db_conn.close()

# 자동 연결 관리
def callback(conn, cursor):
    cursor.execute("INSERT INTO scripts (name) VALUES (?)", ("테스트",))
    return cursor.lastrowid

script_id = conn.execute_with_connection(callback)
```

## 테이블 관리

### `TableManager`

데이터베이스 테이블 생성 및 마이그레이션을 관리합니다.

**파일**: `server/db/table_manager.py`

**주요 메서드:**
- `create_tables()`: 모든 테이블 생성
- `migrate_tables()`: 기존 테이블에 컬럼 추가
- `initialize()`: 테이블 생성 및 마이그레이션 실행

**사용 예시:**
```python
from server.db.table_manager import TableManager
from server.db.connection import DatabaseConnection

conn = DatabaseConnection()
table_manager = TableManager(conn)
table_manager.initialize()
```

## 아키텍처 패턴

### Repository Pattern

각 엔티티별로 전용 리포지토리를 제공하여:
- 데이터 접근 로직 캡슐화
- 테스트 용이성 향상
- 데이터 소스 변경 시 영향 범위 최소화

### Connection Management

- 연결 풀링 없음 (SQLite 특성상 단일 연결 사용)
- 각 작업마다 연결 생성 및 종료
- `execute_with_connection` 메서드로 자동 관리

### Transaction Management

- 각 리포지토리 메서드 내에서 자동 커밋
- 에러 발생 시 자동 롤백
- 명시적 트랜잭션 제어 불필요

## 모범 사례

### 1. 리포지토리 사용

```python
# ✅ 좋은 예: 리포지토리 사용
repo = ScriptRepository(conn)
script = repo.get_script(script_id)

# ❌ 나쁜 예: 직접 SQL 실행
cursor.execute("SELECT * FROM scripts WHERE id = ?", (script_id,))
```

### 2. 연결 관리

```python
# ✅ 좋은 예: execute_with_connection 사용
def save_data(conn, cursor):
    cursor.execute("INSERT INTO scripts (name) VALUES (?)", ("테스트",))
    return cursor.lastrowid

script_id = conn.execute_with_connection(save_data)

# ❌ 나쁜 예: 수동 연결 관리 (에러 처리 누락 가능)
conn = db.get_connection()
cursor = db.get_cursor(conn)
cursor.execute("INSERT INTO scripts (name) VALUES (?)", ("테스트",))
conn.commit()
conn.close()
```

### 3. JSON 필드 처리

```python
# ✅ 좋은 예: 리포지토리의 자동 파싱 사용
nodes = repo.get_nodes_by_script_id(script_id)
connected_to = nodes[0]['connected_to']  # 이미 파싱된 리스트

# ❌ 나쁜 예: 직접 JSON 파싱
import json
raw_data = cursor.fetchone()[0]
connected_to = json.loads(raw_data)
```

## 확장성

향후 v2.0 스키마 적용 시:
- 새로운 리포지토리 추가 (`ExecutionRepository`, `TagRepository` 등)
- 기존 리포지토리 확장
- `DatabaseManager`에 새로운 메서드 추가

