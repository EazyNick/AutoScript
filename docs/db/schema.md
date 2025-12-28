# 데이터베이스 스키마

## 개요

AutoScript 프로젝트는 SQLite 3 데이터베이스를 사용합니다.

- **데이터베이스 파일**: `server/db/workflows.db`
- **인코딩**: UTF-8
- **외래키 제약조건**: 자동 활성화 (`PRAGMA foreign_keys = ON`)

## 테이블 구조

### 1. `scripts` 테이블

워크플로우(스크립트)의 기본 정보를 저장합니다.

```sql
CREATE TABLE scripts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    active INTEGER DEFAULT 1,
    execution_order INTEGER DEFAULT NULL,
    last_executed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

**컬럼 설명:**
- `id`: 스크립트 고유 ID (자동 증가)
- `name`: 스크립트 이름 (고유값)
- `description`: 스크립트 설명
- `active`: 스크립트 활성화 상태 (1: 활성, 0: 비활성, 기본값: 1)
- `execution_order`: 스크립트 실행 순서 (NULL이면 id 사용, '전체 실행' 시 이 순서대로 실행됨)
- `last_executed_at`: 마지막 실행 시간
- `created_at`: 생성 시간
- `updated_at`: 수정 시간

**인덱스:**
- PRIMARY KEY: `id`
- UNIQUE: `name`
- `idx_scripts_name`: 이름 검색 및 중복 체크 성능 향상
- `idx_scripts_updated_at`: 최근 수정 스크립트 조회 최적화 (DESC)
- `idx_scripts_active`: 활성 스크립트만 필터링 시 성능 향상 (부분 인덱스, WHERE active = 1)
- `idx_scripts_last_executed`: 최근 실행 순 정렬 최적화 (DESC)
- `idx_scripts_execution_order`: 실행 순서 기준 정렬 최적화 (ASC)

### 2. `nodes` 테이블

워크플로우 내 노드 정보와 연결 관계를 저장합니다.

```sql
CREATE TABLE nodes (
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
```

**컬럼 설명:**
- `id`: 노드 고유 ID (자동 증가)
- `script_id`: 소속 스크립트 ID (외래키)
- `node_id`: 노드 식별자 (워크플로우 내 고유)
- `node_type`: 노드 타입 (start, end, action, condition, wait, image-touch 등)
- `position_x`, `position_y`: 노드 위치 좌표
- `node_data`: 노드 데이터 (JSON 문자열)
- `connected_to`: 연결 대상 노드 목록 (JSON 배열)
- `connected_from`: 연결 출처 노드 목록 (JSON 배열)
- `parameters`: 노드 파라미터 (JSON 객체)
- `description`: 노드 설명
- `is_connected`: 노드가 다른 노드와 연결되어 있는지 여부 (0: 미연결, 1: 연결됨)
- `connection_sequence`: 연결된 노드 체인에서의 순서 (0부터 시작, NULL: 연결되지 않음)
- `node_identifier`: 노드 식별자 문자열 (로그 출력용, 예: "이미지 터치 (image-touch) #2/5 ID:node1")
- `updated_at`: 수정 시간
- `created_at`: 생성 시간

**인덱스:**
- PRIMARY KEY: `id`
- FOREIGN KEY: `script_id` → `scripts.id` (CASCADE DELETE)
- `idx_nodes_script_node_unique`: 스크립트 내 노드 중복 방지 (UNIQUE, script_id + node_id)
- `idx_nodes_script_id`: 스크립트별 노드 조회 최적화
- `idx_nodes_type`: 노드 타입별 조회 최적화
- `idx_nodes_script_type`: 스크립트 + 타입 복합 인덱스
- `idx_nodes_connection_seq`: 연결 순서별 조회 최적화
- `idx_nodes_is_connected`: 연결 상태별 필터링 최적화

**JSON 필드 형식:**

`connected_to` 예시:
```json
[
    {"to": "node2", "outputType": null},
    {"to": "node3", "outputType": "true"}
]
```

`connected_from` 예시:
```json
["node1", "node2"]
```

`parameters` 예시:
```json
{
    "folder_path": "C:/images",
    "threshold": 0.8
}
```

### 3. `user_settings` 테이블

사용자 설정을 키-값 쌍으로 저장합니다. 향후 다중 사용자 지원을 대비하여 `user_id` 필드를 포함합니다.

```sql
CREATE TABLE user_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT DEFAULT NULL,
    setting_key TEXT NOT NULL,
    setting_value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, setting_key)
)
```

**컬럼 설명:**
- `id`: 설정 고유 ID (자동 증가)
- `user_id`: 사용자 ID (향후 다중 사용자 지원, 현재는 NULL)
- `setting_key`: 설정 키
- `setting_value`: 설정 값
- `updated_at`: 수정 시간

**인덱스:**
- PRIMARY KEY: `id`
- UNIQUE: `(user_id, setting_key)`
- `idx_user_settings_user_id`: 사용자별 설정 조회 최적화
- `idx_user_settings_key`: 설정 키 기반 조회 최적화

**주요 설정 키:**
- `focused-script-id`: 마지막으로 포커스된 스크립트 ID
- `script-order`: 스크립트 목록 순서 (JSON 배열)
- `sidebar-width`: 사이드바 너비
- `theme`: 테마 설정 (dark/light)
- `language`: 언어 설정
- `screenshot.autoScreenshot`: 자동 스크린샷 활성화 여부 (true/false)
- `screenshot.screenshotOnError`: 오류 발생 시 스크린샷 저장 여부 (true/false)
- `screenshot.savePath`: 스크린샷 저장 경로
- `screenshot.imageFormat`: 스크린샷 이미지 형식 (PNG/JPEG)

### 4. `node_execution_logs` 테이블

각 노드의 실행 결과를 추적하고 저장합니다. 노드가 실행될 때마다 자동으로 로그가 생성됩니다.

```sql
CREATE TABLE node_execution_logs (
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
    is_connected INTEGER DEFAULT 0,
    connection_sequence INTEGER,
    node_identifier TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (script_id) REFERENCES scripts(id) ON DELETE CASCADE
)
```

**컬럼 설명:**
- `id`: 로그 고유 ID (자동 증가)
- `execution_id`: 워크플로우 실행 ID (같은 실행의 노드들을 그룹화, UUID 형식)
- `script_id`: 스크립트 ID (선택사항, 외래키)
- `node_id`: 노드 ID (워크플로우 내 고유 식별자)
- `node_type`: 노드 타입 (start, end, action, condition, wait, image-touch 등)
- `node_name`: 노드 이름/제목
- `status`: 실행 상태 (running, completed, failed)
- `started_at`: 실행 시작 시간 (ISO 형식 문자열)
- `finished_at`: 실행 종료 시간 (ISO 형식 문자열)
- `execution_time_ms`: 실행 시간 (밀리초)
- `parameters`: 입력 파라미터 (JSON 문자열)
- `result`: 실행 결과 (JSON 문자열)
- `error_message`: 에러 메시지 (실패 시)
- `error_traceback`: 에러 스택 트레이스 (실패 시)
- `is_connected`: 노드가 다른 노드와 연결되어 있는지 여부 (0: 미연결, 1: 연결됨)
- `connection_sequence`: 연결된 노드 체인에서의 순서 (0부터 시작, NULL: 연결되지 않음)
- `node_identifier`: 노드 식별자 문자열 (로그 출력용, 예: "이미지 터치 (image-touch) #2/5 ID:node1")
- `created_at`: 로그 생성 시간

**인덱스:**
- PRIMARY KEY: `id`
- FOREIGN KEY: `script_id` → `scripts.id` (CASCADE DELETE)
- `idx_node_logs_execution_id`: 실행 ID별 조회 최적화
- `idx_node_logs_script_id`: 스크립트별 조회 최적화
- `idx_node_logs_node_id`: 노드별 조회 최적화
- `idx_node_logs_status`: 상태별 필터링 최적화
- `idx_node_logs_started_at`: 시간순 정렬 최적화 (DESC)
- `idx_node_logs_script_started`: 스크립트 + 시간 복합 인덱스

자세한 내용은 [노드 실행 로그 시스템](node_execution_logs.md) 문서를 참고하세요.

### 5. `script_executions` 테이블

스크립트 실행 기록을 저장합니다.

```sql
CREATE TABLE script_executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    script_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'running',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP,
    error_message TEXT,
    execution_time_ms INTEGER,
    FOREIGN KEY (script_id) REFERENCES scripts(id) ON DELETE CASCADE
)
```

**컬럼 설명:**
- `id`: 실행 기록 고유 ID (자동 증가)
- `script_id`: 실행된 스크립트 ID (외래키)
- `status`: 실행 상태 (running, success, error, cancelled)
- `started_at`: 실행 시작 시간
- `finished_at`: 실행 종료 시간
- `error_message`: 에러 메시지 (실패 시)
- `execution_time_ms`: 실행 시간 (밀리초)

**인덱스:**
- PRIMARY KEY: `id`
- FOREIGN KEY: `script_id` → `scripts.id` (CASCADE DELETE)
- `idx_executions_script_id`: 스크립트별 실행 기록 조회
- `idx_executions_status`: 상태별 필터링
- `idx_executions_started_at`: 시간순 정렬 (DESC)
- `idx_executions_script_status`: 스크립트 + 상태 복합 인덱스

### 6. `tags` 테이블

태그 정보를 저장합니다. 스크립트 분류 및 검색에 사용됩니다.

```sql
CREATE TABLE tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

**컬럼 설명:**
- `id`: 태그 고유 ID (자동 증가)
- `name`: 태그 이름 (고유값)
- `color`: 태그 색상 (선택적)
- `created_at`: 생성 시간

**인덱스:**
- PRIMARY KEY: `id`
- UNIQUE: `name`
- `idx_tags_name`: 이름 기반 검색 최적화

### 7. `script_tags` 테이블

스크립트와 태그의 다대다 관계를 저장합니다.

```sql
CREATE TABLE script_tags (
    script_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (script_id, tag_id),
    FOREIGN KEY (script_id) REFERENCES scripts(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
)
```

**컬럼 설명:**
- `script_id`: 스크립트 ID (외래키)
- `tag_id`: 태그 ID (외래키)

**인덱스:**
- PRIMARY KEY: `(script_id, tag_id)`
- FOREIGN KEY: `script_id` → `scripts.id` (CASCADE DELETE)
- FOREIGN KEY: `tag_id` → `tags.id` (CASCADE DELETE)
- `idx_script_tags_script`: 스크립트별 태그 조회
- `idx_script_tags_tag`: 태그별 스크립트 조회

### 8. `dashboard_stats` 테이블

대시보드 통계 데이터를 저장합니다.

```sql
CREATE TABLE dashboard_stats (
    stat_key TEXT PRIMARY KEY,
    stat_value INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

**컬럼 설명:**
- `stat_key`: 통계 키 (PRIMARY KEY)
- `stat_value`: 통계 값
- `updated_at`: 수정 시간

**인덱스:**
- PRIMARY KEY: `stat_key`
- `idx_dashboard_stats_key`: 키 기반 조회 최적화

**주요 통계 키:**
- `total_scripts`: 전체 스크립트 개수
- `today_executions`: 오늘 실행 횟수
- `today_failed`: 오늘 실패 횟수
- `inactive_scripts`: 비활성 스크립트 개수

## 뷰(View)

### `script_stats` 뷰

스크립트 통계를 집계하는 뷰입니다. 대시보드에서 사용됩니다.

```sql
CREATE VIEW script_stats AS
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
```

**용도:**
- 대시보드 통계 조회
- 복잡한 집계 쿼리 간소화
- 성능 최적화

## 외래키 구조

### 부모-자식 관계

```
scripts (부모)
  ├── nodes (자식)
  ├── node_execution_logs (자식)
  ├── script_executions (자식)
  └── script_tags (자식)
        └── tags (독립)
```

**CASCADE DELETE:**
- `scripts` 삭제 시 → `nodes`, `node_execution_logs`, `script_executions`, `script_tags` 자동 삭제
- `tags` 삭제 시 → `script_tags` 자동 삭제

### 독립 테이블

- `user_settings`: 사용자 설정 (외래키 없음)
- `dashboard_stats`: 대시보드 통계 (외래키 없음)
- `tags`: 태그 정보 (외래키 없음, `script_tags`를 통해 연결)

## 데이터 무결성

### 외래키 제약조건

모든 데이터베이스 연결에서 자동으로 외래키 제약조건이 활성화됩니다:

```python
conn.execute("PRAGMA foreign_keys = ON")
```

**효과:**
- 잘못된 참조 방지
- 데이터 일관성 보장
- CASCADE DELETE 자동 처리

### UNIQUE 제약조건

- `scripts.name`: 스크립트 이름 중복 방지
- `tags.name`: 태그 이름 중복 방지
- `nodes(script_id, node_id)`: 스크립트 내 노드 ID 중복 방지
- `user_settings(user_id, setting_key)`: 사용자별 설정 키 중복 방지

## 성능 최적화

### 인덱스 전략

1. **자주 조회되는 컬럼**: `name`, `updated_at`, `active`
2. **정렬에 사용되는 컬럼**: `updated_at DESC`, `last_executed_at DESC`, `execution_order ASC`
3. **필터링에 사용되는 컬럼**: `active`, `status`, `node_type`
4. **복합 인덱스**: `(script_id, node_type)`, `(script_id, status)`
5. **부분 인덱스**: `WHERE active = 1` (활성 스크립트만 인덱싱)

### 뷰 활용

복잡한 집계 쿼리를 뷰로 캡슐화하여 성능을 최적화합니다.

자세한 내용은 [데이터베이스 성능 최적화 가이드](../performance/database-optimization.md)를 참고하세요.

## 마이그레이션

기존 테이블에 컬럼을 추가하는 마이그레이션이 자동으로 실행됩니다.

**마이그레이션 대상:**
- `nodes`: `connected_to`, `connected_from`, `parameters`, `description`, `updated_at`
- `scripts`: `active`, `last_executed_at`, `execution_order`
- `user_settings`: `user_id`
- `node_execution_logs`: 새 테이블 (자동 생성)

**마이그레이션 실행:**
```python
from server.db.database import DatabaseManager

db = DatabaseManager()  # 자동으로 마이그레이션 실행
```

## 사용 예시

### 데이터베이스 초기화

```python
from server.db.database import DatabaseManager

# 데이터베이스 초기화 (테이블 생성 및 마이그레이션)
db = DatabaseManager()
```

### 스크립트 생성

```python
# 스크립트 생성
script_id = db.create_script("테스트 스크립트", "설명")

# 스크립트 조회
script = db.get_script(script_id)
```

### 노드 저장

```python
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

db.save_script_data(script_id, nodes, connections)
```

자세한 내용은 [리포지토리 구조](repositories.md)와 [연결 관리](connection.md)를 참고하세요.

