# 노드 실행 로그 시스템

## 아키텍처 구조

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    노드 실행 로그 시스템 전체 아키텍처                      │
│        (서버 측 로그 수집 + 클라이언트 측 조회 및 삭제)                    │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                          [1] 로그 수집 단계 (서버 측)                      │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐
│  NodeExecutor   │  (server/nodes/node_executor_wrapper.py)
│   (Wrapper)     │
└────────┬────────┘
         │
         │ ① 노드 실행 시작/완료/실패 감지
         │    - 실행 시간 측정
         │    - 파라미터/결과 수집
         │    - 에러 정보 수집
         │
         ▼
┌─────────────────┐
│ExecutionLogClient│  (server/execution_logging/execution_log_client.py)
│   (유틸리티)     │
└────────┬────────┘
         │
         │ ② 비동기 로그 전송 (fire-and-forget)
         │    - HTTP POST 요청
         │    - 타임아웃 처리
         │    - 에러 무시 (노드 실행에 영향 없음)
         │
         ▼
┌─────────────────┐
│  Log Router     │  (server/api/log_router.py)
│  /api/logs/     │
└────────┬────────┘
         │
         │ ③ 로그 데이터 검증 및 저장 요청
         │    - Pydantic 모델 검증
         │
         ▼
┌─────────────────┐
│NodeExecutionLog│  (server/execution_logging/execution_log_repository.py)
│  Repository     │
└────────┬────────┘
         │
         │ ④ 데이터베이스에 로그 저장
         │    - JSON 직렬화
         │    - 트랜잭션 처리
         │
         ▼
┌─────────────────┐
│node_execution_  │  (SQLite 테이블)
│     logs        │
└─────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                          [2] 로그 조회 단계 (클라이언트 측)                  │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐
│ HistoryManager  │  (UI/src/pages/workflow/history.js)
│  (페이지 관리자)  │
└────────┬────────┘
         │
         │ ① 실행 기록 페이지 초기화
         │    - 필터 UI 설정
         │    - 이벤트 리스너 등록
         │    - 삭제 버튼 이벤트 등록
         │
         ▼
┌─────────────────┐
│  LogService     │  (UI/src/pages/logs/services/log-service.js)
│  (서비스 계층)   │
└────────┬────────┘
         │
         │ ② 로그 데이터 로드 요청
         │    - 필터 옵션 설정
         │    - 통계 계산 준비
         │
         ▼
┌─────────────────┐
│    LogAPI       │  (UI/src/js/api/logapi.js)
│  (API 클라이언트) │
└────────┬────────┘
         │
         │ ③ HTTP GET 요청
         │    - 쿼리 파라미터 생성
         │    - API 호출
         │
         ▼
┌─────────────────┐
│  Log Router     │  (server/api/log_router.py)
│  /api/logs/     │
└────────┬────────┘
         │
         │ ④ 로그 조회 요청 처리
         │    - 필터 파라미터 파싱
         │
         ▼
┌─────────────────┐
│NodeExecutionLog│  (server/execution_logging/execution_log_repository.py)
│  Repository     │
└────────┬────────┘
         │
         │ ⑤ 데이터베이스에서 로그 조회
         │    - 필터 조건 적용
         │    - 정렬 및 페이징
         │
         ▼
┌─────────────────┐
│node_execution_  │  (SQLite 테이블)
│     logs        │
└────────┬────────┘
         │
         │ ⑥ 조회된 로그 데이터 반환
         │
         ▼
┌─────────────────┐
│  LogService     │  (UI/src/pages/logs/services/log-service.js)
│  (서비스 계층)   │
└────────┬────────┘
         │
         │ ⑦ 데이터 처리 및 통계 계산
         │    - 로그 그룹화 (실행 ID별)
         │    - 통계 정보 계산
         │
         ▼
┌─────────────────┐
│  LogsManager    │  (UI/src/pages/logs/logs.js)
│  (페이지 관리자)  │
└────────┬────────┘
         │
         │ ⑧ UI 렌더링
         │    - 실행 그룹별 표시
         │    - 통계 카드 업데이트
         │    - 필터 UI 업데이트
         │
         ▼
┌─────────────────┐
│   로그 페이지     │  (UI - 브라우저 화면)
│   (사용자 화면)   │
└─────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                          데이터 흐름 상세                                 │
└─────────────────────────────────────────────────────────────────────────┘

[로그 수집 흐름]
    │
    ├─→ [노드 실행 시작]
    │   ├─→ NodeExecutor.wrapper() 호출
    │   ├─→ started_at 기록
    │   ├─→ ExecutionLogClient.send_log_async(status="running")
    │   └─→ 노드 실행 함수 호출
    │
    ├─→ [성공 시]
    │   ├─→ finished_at 기록
    │   ├─→ execution_time_ms 계산
    │   └─→ ExecutionLogClient.send_log_async(status="completed", result=...)
    │
    └─→ [실패 시]
        ├─→ finished_at 기록
        ├─→ execution_time_ms 계산
        ├─→ error_message, error_traceback 수집
        └─→ ExecutionLogClient.send_log_async(status="failed", error_message=...)

[로그 저장 흐름]
    │
    ├─→ ExecutionLogClient.send_log_async()
    │   ├─→ HTTP POST /api/logs/node-execution
    │   ├─→ 비동기 전송 (asyncio)
    │   └─→ 에러 발생 시 조용히 무시
    │
    └─→ Log Router
        ├─→ Pydantic 모델 검증
        ├─→ NodeExecutionLogRepository.create_log()
        └─→ DB 저장 (트랜잭션)

[로그 조회 흐름]
    │
    ├─→ [사용자 액션]
    │   ├─→ 로그 페이지 접속
    │   ├─→ 필터 변경
    │   └─→ 새로고침 버튼 클릭
    │
    ├─→ LogsManager.init() 또는 loadLogs()
    │   ├─→ LogService.loadLogs(filters)
    │   └─→ 필터 옵션 설정
    │
    ├─→ LogAPI.getNodeExecutionLogs(filters)
    │   ├─→ 쿼리 파라미터 생성
    │   └─→ HTTP GET /api/logs/node-execution?script_id=...&status=...
    │
    ├─→ Log Router
    │   ├─→ 필터 파라미터 파싱
    │   └─→ NodeExecutionLogRepository 메서드 호출
    │
    ├─→ Repository
    │   ├─→ SQL 쿼리 실행
    │   ├─→ 필터 조건 적용
    │   └─→ JSON 파싱 및 반환
    │
    ├─→ LogService
    │   ├─→ 데이터 수신
    │   ├─→ 그룹화 (실행 ID별)
    │   └─→ 통계 계산
    │
    └─→ LogsManager
        ├─→ renderLogs()
        ├─→ createExecutionGroup()
        ├─→ createLogItem()
        └─→ UI 업데이트

[로그 표시 구조]
    │
    ├─→ 실행 그룹 (Execution Group)
    │   ├─→ 실행 ID 헤더
    │   ├─→ 메타 정보 (시작/종료 시간, 노드 개수, 성공/실패 개수)
    │   └─→ 노드 로그 목록 (접을 수 있음)
    │
    └─→ 노드 로그 아이템 (Log Item)
        ├─→ 상태 표시 (완료/실패/실행 중)
        ├─→ 노드 정보 (이름, 타입, 실행 시간)
        ├─→ 삭제 버튼 (개별 로그 삭제)
        ├─→ 타임라인 (시작/종료 시간)
        ├─→ 파라미터 (JSON 형식)
        ├─→ 결과 (JSON 형식)
        └─→ 에러 정보 (에러 메시지, 스택 트레이스)

[로그 삭제 흐름]
    │
    ├─→ 전체 삭제
    │   ├─→ HistoryManager.deleteAllLogs()
    │   ├─→ LogAPI.deleteAllNodeExecutionLogs()
    │   ├─→ DELETE /api/logs/node-execution
    │   ├─→ NodeExecutionLogRepository.delete_all_logs()
    │   └─→ DB에서 모든 로그 삭제
    │
    ├─→ 실행 그룹 삭제
    │   ├─→ HistoryManager.deleteExecutionGroup()
    │   ├─→ LogAPI.deleteNodeExecutionLogsByExecutionId()
    │   ├─→ DELETE /api/logs/node-execution/execution/{execution_id}
    │   ├─→ NodeExecutionLogRepository.delete_logs_by_execution_id()
    │   └─→ DB에서 해당 execution_id의 모든 로그 삭제
    │
    └─→ 개별 로그 삭제
        ├─→ HistoryManager.deleteLogItem()
        ├─→ LogAPI.deleteNodeExecutionLog()
        ├─→ DELETE /api/logs/node-execution/{log_id}
        ├─→ NodeExecutionLogRepository.delete_log()
        └─→ DB에서 해당 로그 삭제
```

## 개요

노드 실행 로그 시스템은 각 노드의 실행 결과를 추적하고 저장하는 시스템입니다. 노드가 실행될 때마다 자동으로 로그가 생성되어 데이터베이스에 저장되며, 사용자는 프론트엔드 실행 기록 페이지를 통해 노드 실행 이력을 조회, 분석 및 삭제할 수 있습니다.

### 시스템 구성

1. **서버 측 (로그 수집)**
   - 노드 실행 시 자동으로 로그 수집 및 저장
   - 비동기 로그 전송으로 성능 영향 최소화

2. **클라이언트 측 (로그 조회 및 삭제)**
   - 실행 기록 페이지를 통한 시각적 조회
   - 필터링 및 통계 기능 제공
   - 실행 그룹별 상세 정보 표시 (헤더 전체 클릭 가능)
   - 로그 삭제 기능 (전체/실행 그룹/개별 삭제)

### 주요 특징

- **자동 로깅**: 노드 실행 시 자동으로 로그 생성 (서버 측)
- **비동기 전송**: 로그 전송이 노드 실행 성능에 영향을 주지 않음
- **상세 정보**: 실행 시간, 파라미터, 결과, 에러 정보 등 상세 기록
- **연결 정보 포함**: 노드 연결 여부, 연결 순서, 노드 식별자 정보 포함 (v0.0.6+)
- **그룹화**: `execution_id`를 통해 같은 워크플로우 실행의 노드들을 그룹화
- **다양한 조회**: 실행 ID, 스크립트 ID, 노드 ID, 상태별 조회 지원
- **시각적 표시**: 프론트엔드에서 실행 그룹별로 접을 수 있는 형태로 표시 (헤더 전체 클릭 가능)
- **실시간 통계**: 전체/완료/실패 개수, 평균 실행 시간 등 자동 계산
- **로그 삭제**: 전체/실행 그룹/개별 로그 삭제 기능 제공
- **읽기 쉬운 실행 ID**: 날짜시간 기반의 실행 ID로 실행 시점을 바로 확인 가능
- **오류 발생 시 로그 저장 확인 개선**: 오류 발생 시에도 로그 저장이 안정적으로 확인됨 (v0.0.6+)

## 테이블 구조

### `node_execution_logs` 테이블

노드 실행 로그를 저장하는 테이블입니다.

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
- `execution_id`: 워크플로우 실행 ID (같은 실행의 노드들을 그룹화, 날짜시간 기반 형식: `YYYYMMDD-HHMMSS-{랜덤}`)
- `script_id`: 스크립트 ID (선택사항, 외래키)
- `node_id`: 노드 ID (워크플로우 내 고유 식별자)
- `node_type`: 노드 타입 (start, end, action, condition, wait, image-touch 등)
- `node_name`: 노드 이름/제목 (사용자가 설정한 노드 이름)
- `status`: 실행 상태
  - `running`: 실행 중
  - `completed`: 실행 완료
  - `failed`: 실행 실패
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

**JSON 필드 형식:**

`parameters` 예시:
```json
{
    "folder_path": "C:/images",
    "threshold": 0.8,
    "wait_time": 2.0
}
```

`result` 예시 (성공):
```json
{
    "action": "image-touch",
    "status": "completed",
    "output": {
        "found": true,
        "coordinates": [100, 200]
    }
}
```

`result` 예시 (실패):
```json
{
    "action": "image-touch",
    "status": "failed",
    "error": "이미지를 찾을 수 없습니다",
    "output": {
        "error": "이미지를 찾을 수 없습니다"
    }
}
```

## 리포지토리

### `NodeExecutionLogRepository`

노드 실행 로그 관련 데이터베이스 작업을 처리하는 리포지토리입니다.

**파일**: `server/execution_logging/execution_log_repository.py`

**주요 메서드:**

#### `create_log(...)`

노드 실행 로그를 생성합니다.

```python
log_id = repo.create_log(
    execution_id="550e8400-e29b-41d4-a716-446655440000",
    script_id=1,
    node_id="node_1",
    node_type="image-touch",
    node_name="이미지 터치",
    status="completed",
    started_at="2024-01-01T10:00:00",
    finished_at="2024-01-01T10:00:01",
    execution_time_ms=1000,
    parameters={"folder_path": "C:/images"},
    result={"action": "image-touch", "status": "completed"},
    error_message=None,
    error_traceback=None
)
```

#### `get_logs_by_execution_id(execution_id)`

특정 실행 ID의 모든 로그를 조회합니다.

```python
logs = repo.get_logs_by_execution_id("550e8400-e29b-41d4-a716-446655440000")
# 반환: 같은 워크플로우 실행의 모든 노드 로그 (시간순 정렬)
```

#### `get_logs_by_script_id(script_id, limit, offset)`

특정 스크립트의 로그를 조회합니다.

```python
logs = repo.get_logs_by_script_id(script_id=1, limit=100, offset=0)
# 반환: 최근 100개의 로그 (시간 역순)
```

#### `get_logs_by_node_id(node_id, limit, offset)`

특정 노드의 로그를 조회합니다.

```python
logs = repo.get_logs_by_node_id("node_1", limit=50, offset=0)
# 반환: 해당 노드의 최근 50개 실행 로그
```

#### `get_recent_logs(limit)`

최근 로그를 조회합니다.

```python
logs = repo.get_recent_logs(limit=100)
# 반환: 전체 시스템의 최근 100개 로그
```

#### `get_failed_logs(script_id, limit)`

실패한 로그를 조회합니다.

```python
# 전체 실패 로그
failed_logs = repo.get_failed_logs(limit=50)

# 특정 스크립트의 실패 로그
failed_logs = repo.get_failed_logs(script_id=1, limit=50)
```

#### `delete_log(log_id)`

특정 로그를 삭제합니다.

```python
# 로그 ID로 삭제
deleted = repo.delete_log(log_id=123)
# 반환: True (삭제 성공) 또는 False (삭제 실패)
```

#### `delete_logs_by_execution_id(execution_id)`

특정 실행 ID의 모든 로그를 삭제합니다.

```python
# 실행 ID로 삭제
deleted_count = repo.delete_logs_by_execution_id("20240115-143025-a3f9b2")
# 반환: 삭제된 로그 개수
```

#### `delete_all_logs()`

모든 로그를 삭제합니다.

```python
# 전체 로그 삭제
deleted_count = repo.delete_all_logs()
# 반환: 삭제된 로그 개수
```

**사용 예시:**

```python
from server.db.database import db_manager

# 로그 생성
log_id = db_manager.node_execution_logs.create_log(
    execution_id="exec-123",
    script_id=1,
    node_id="node_1",
    node_type="image-touch",
    status="completed",
    # ... 기타 파라미터
)

# 실행 ID로 조회
logs = db_manager.node_execution_logs.get_logs_by_execution_id("exec-123")

# 스크립트별 조회
logs = db_manager.node_execution_logs.get_logs_by_script_id(script_id=1, limit=100)

# 실패한 로그만 조회
failed_logs = db_manager.node_execution_logs.get_failed_logs(script_id=1)

# 개별 로그 삭제
deleted = db_manager.node_execution_logs.delete_log(log_id=123)

# 실행 ID별 로그 삭제
deleted_count = db_manager.node_execution_logs.delete_logs_by_execution_id("20240115-143025-a3f9b2")

# 전체 로그 삭제
deleted_count = db_manager.node_execution_logs.delete_all_logs()
```

## API 엔드포인트

### POST `/api/logs/node-execution`

노드 실행 로그를 생성합니다.

**요청 본문:**

```json
{
    "execution_id": "550e8400-e29b-41d4-a716-446655440000",
    "script_id": 1,
    "node_id": "node_1",
    "node_type": "image-touch",
    "node_name": "이미지 터치",
    "status": "completed",
    "started_at": "2024-01-01T10:00:00",
    "finished_at": "2024-01-01T10:00:01",
    "execution_time_ms": 1000,
    "parameters": {
        "folder_path": "C:/images"
    },
    "result": {
        "action": "image-touch",
        "status": "completed",
        "output": {"found": true}
    }
}
```

**응답:**

```json
{
    "success": true,
    "message": "노드 실행 로그가 생성되었습니다.",
    "log_id": 123
}
```

### GET `/api/logs/node-execution`

노드 실행 로그를 조회합니다.

**쿼리 파라미터:**

- `execution_id` (선택): 워크플로우 실행 ID
- `script_id` (선택): 스크립트 ID
- `node_id` (선택): 노드 ID
- `limit` (선택, 기본값: 100): 조회할 최대 개수
- `offset` (선택, 기본값: 0): 건너뛸 개수

**예시:**

```bash
# 실행 ID로 조회
GET /api/logs/node-execution?execution_id=550e8400-e29b-41d4-a716-446655440000

# 스크립트 ID로 조회
GET /api/logs/node-execution?script_id=1&limit=50

# 노드 ID로 조회
GET /api/logs/node-execution?node_id=node_1&limit=20
```

**응답:**

```json
{
    "success": true,
    "message": "노드 실행 로그 조회 완료",
    "data": [
        {
            "id": 123,
            "execution_id": "550e8400-e29b-41d4-a716-446655440000",
            "script_id": 1,
            "node_id": "node_1",
            "node_type": "image-touch",
            "node_name": "이미지 터치",
            "status": "completed",
            "started_at": "2024-01-01T10:00:00",
            "finished_at": "2024-01-01T10:00:01",
            "execution_time_ms": 1000,
            "parameters": {"folder_path": "C:/images"},
            "result": {"action": "image-touch", "status": "completed"},
            "error_message": null,
            "error_traceback": null,
            "created_at": "2024-01-01T10:00:01"
        }
    ],
    "count": 1
}
```

### GET `/api/logs/node-execution/failed`

실패한 노드 실행 로그를 조회합니다.

**쿼리 파라미터:**

- `script_id` (선택): 스크립트 ID (None이면 전체)
- `limit` (선택, 기본값: 100): 조회할 최대 개수

**예시:**

```bash
# 전체 실패 로그
GET /api/logs/node-execution/failed?limit=50

# 특정 스크립트의 실패 로그
GET /api/logs/node-execution/failed?script_id=1&limit=20
```

### DELETE `/api/logs/node-execution/{log_id}`

특정 노드 실행 로그를 삭제합니다.

**경로 파라미터:**

- `log_id` (필수): 삭제할 로그 ID

**예시:**

```bash
DELETE /api/logs/node-execution/123
```

**응답:**

```json
{
    "success": true,
    "message": "노드 실행 로그가 삭제되었습니다.",
    "data": {
        "log_id": 123
    }
}
```

### DELETE `/api/logs/node-execution/execution/{execution_id}`

특정 실행 ID의 모든 노드 실행 로그를 삭제합니다.

**경로 파라미터:**

- `execution_id` (필수): 삭제할 실행 ID

**예시:**

```bash
DELETE /api/logs/node-execution/execution/20240115-143025-a3f9b2
```

**응답:**

```json
{
    "success": true,
    "message": "3개의 노드 실행 로그가 삭제되었습니다.",
    "data": {
        "execution_id": "20240115-143025-a3f9b2",
        "deleted_count": 3
    }
}
```

### DELETE `/api/logs/node-execution`

모든 노드 실행 로그를 삭제합니다.

**예시:**

```bash
DELETE /api/logs/node-execution
```

**응답:**

```json
{
    "success": true,
    "message": "모든 노드 실행 로그(150개)가 삭제되었습니다.",
    "data": {
        "deleted_count": 150
    }
}
```

## 로그 클라이언트

### `ExecutionLogClient`

노드 실행 로그를 서버로 전송하는 클라이언트 유틸리티입니다.

**파일**: `server/execution_logging/execution_log_client.py`

**주요 메서드:**

#### `send_log(...)`

노드 실행 로그를 동기적으로 전송합니다.

```python
from execution_logging.execution_log_client import get_log_client

log_client = get_log_client()
success = await log_client.send_log(
    execution_id="exec-123",
    script_id=1,
    node_id="node_1",
    node_type="image-touch",
    status="completed",
    # ... 기타 파라미터
)
```

#### `send_log_async(...)`

노드 실행 로그를 비동기적으로 전송합니다 (fire-and-forget).

```python
# 에러가 발생해도 예외를 발생시키지 않음
await log_client.send_log_async(
    execution_id="exec-123",
    script_id=1,
    node_id="node_1",
    node_type="image-touch",
    status="completed",
    # ... 기타 파라미터
)
```

**특징:**

- 비동기 전송: 노드 실행 성능에 영향을 주지 않음
- 타임아웃 처리: 5초 타임아웃 설정
- 에러 무시: 전송 실패 시 조용히 무시 (노드 실행에 영향 없음)
- 자동 URL 구성: 서버 설정에서 API URL 자동 구성

## 프론트엔드 로그 조회 시스템

### LogAPI (API 클라이언트)

프론트엔드에서 로그 API를 호출하는 클라이언트 모듈입니다.

**파일**: `UI/src/js/api/logapi.js`

**주요 메서드:**

#### `getNodeExecutionLogs(filters)`

노드 실행 로그를 조회합니다.

```javascript
import { LogAPI } from './js/api/logapi.js';

// 실행 ID로 조회
const logs = await LogAPI.getNodeExecutionLogs({
    execution_id: '550e8400-e29b-41d4-a716-446655440000'
});

// 스크립트 ID로 조회
const logs = await LogAPI.getNodeExecutionLogs({
    script_id: 1,
    limit: 100,
    offset: 0
});

// 상태별 조회
const logs = await LogAPI.getNodeExecutionLogs({
    status: 'failed',
    limit: 50
});
```

#### `getFailedNodeExecutionLogs(filters)`

실패한 노드 실행 로그를 조회합니다.

```javascript
// 전체 실패 로그
const failedLogs = await LogAPI.getFailedNodeExecutionLogs({ limit: 50 });

// 특정 스크립트의 실패 로그
const failedLogs = await LogAPI.getFailedNodeExecutionLogs({
    script_id: 1,
    limit: 50
});
```

#### `deleteNodeExecutionLog(logId)`

특정 노드 실행 로그를 삭제합니다.

```javascript
// 로그 ID로 삭제
await LogAPI.deleteNodeExecutionLog(123);
```

#### `deleteNodeExecutionLogsByExecutionId(executionId)`

특정 실행 ID의 모든 노드 실행 로그를 삭제합니다.

```javascript
// 실행 ID로 삭제
await LogAPI.deleteNodeExecutionLogsByExecutionId('20240115-143025-a3f9b2');
```

#### `deleteAllNodeExecutionLogs()`

모든 노드 실행 로그를 삭제합니다.

```javascript
// 전체 로그 삭제
await LogAPI.deleteAllNodeExecutionLogs();
```

### LogService (서비스 계층)

로그 데이터 로드 및 관리 로직을 담당하는 서비스입니다.

**파일**: `UI/src/pages/logs/services/log-service.js`

**주요 메서드:**

#### `loadLogs(filters)`

로그 데이터를 로드합니다.

```javascript
import { LogService } from './pages/logs/services/log-service.js';

const logService = new LogService();

// 필터 설정
logService.setFilters({
    script_id: 1,
    status: 'completed',
    limit: 100
});

// 로그 로드
const logs = await logService.loadLogs();
```

#### `calculateStats()`

통계 정보를 계산합니다.

```javascript
const stats = logService.calculateStats();
// 반환: {
//   total: 100,
//   completed: 85,
//   failed: 10,
//   running: 5,
//   totalExecutionTime: 50000,
//   averageExecutionTime: 588
// }
```

#### `groupLogsByExecutionId()`

실행 ID별로 로그를 그룹화합니다.

```javascript
const grouped = logService.groupLogsByExecutionId();
// 반환: {
//   'exec-123': [log1, log2, log3],
//   'exec-456': [log4, log5]
// }
```

### LogsManager (페이지 관리자)

로그 페이지의 데이터 로드 및 UI 업데이트를 담당하는 관리자입니다.

**파일**: `UI/src/pages/logs/logs.js`

**주요 기능:**

1. **페이지 초기화**: 로그 페이지 접속 시 자동으로 로그 로드
2. **필터링**: 스크립트별, 상태별 필터링 지원
3. **렌더링**: 실행 그룹별로 접을 수 있는 형태로 표시
4. **통계 표시**: 전체/완료/실패 개수, 평균 실행 시간 표시

**사용 예시:**

```javascript
import { getLogsManagerInstance } from './pages/logs/logs.js';

// 로그 페이지 초기화 (페이지 라우터에서 자동 호출)
const logsManager = getLogsManagerInstance();
await logsManager.init();
```

### 로그 페이지 UI 구조

```
로그 페이지
├── 필터 영역
│   ├── 스크립트 필터 (드롭다운)
│   ├── 상태 필터 (드롭다운: 전체/완료/실패/실행 중)
│   └── 새로고침 버튼
├── 통계 카드
│   ├── 전체 로그 개수
│   ├── 완료 개수
│   ├── 실패 개수
│   └── 평균 실행 시간
└── 로그 목록
    └── 실행 그룹 (접을 수 있음)
        ├── 그룹 헤더
        │   ├── 실행 ID
        │   ├── 시작/종료 시간
        │   ├── 노드 개수
        │   ├── 성공/실패 개수
        │   └── 총 실행 시간
        └── 노드 로그 목록
            └── 로그 아이템
                ├── 상태 표시
                ├── 노드 정보 (이름, 타입, 실행 시간)
                ├── 타임라인 (시작/종료 시간)
                ├── 파라미터 (JSON)
                ├── 결과 (JSON)
                └── 에러 정보 (에러 메시지, 스택 트레이스)
```

## 작동 방식

### 1. 노드 실행 시작

```python
# NodeExecutor.wrapper()에서 자동 호출
@NodeExecutor("image-touch")
async def execute(parameters):
    # wrapper가 자동으로:
    # 1. started_at 기록
    # 2. ExecutionLogClient.send_log_async(status="running") 호출
    # 3. 노드 실행 함수 호출
    pass
```

### 2. 노드 실행 완료

```python
# 성공 시
# wrapper가 자동으로:
# 1. finished_at 기록
# 2. execution_time_ms 계산
# 3. ExecutionLogClient.send_log_async(status="completed", result=...) 호출
```

### 3. 노드 실행 실패

```python
# 실패 시
# wrapper가 자동으로:
# 1. finished_at 기록
# 2. execution_time_ms 계산
# 3. error_message, error_traceback 수집
# 4. ExecutionLogClient.send_log_async(status="failed", error_message=...) 호출
```

### 4. 로그 전송

```python
# ExecutionLogClient.send_log_async()에서:
# 1. HTTP POST /api/logs/node-execution 요청
# 2. 비동기 전송 (asyncio)
# 3. 에러 발생 시 조용히 무시
```

### 5. 로그 저장

```python
# Log Router에서:
# 1. Pydantic 모델 검증
# 2. NodeExecutionLogRepository.create_log() 호출
# 3. DB 저장 (트랜잭션 처리)
```

## 실행 ID 생성

`execution_id`는 워크플로우 실행 시 자동으로 생성됩니다. 날짜시간 기반의 읽기 쉬운 형식으로 생성됩니다.

**형식**: `YYYYMMDD-HHMMSS-{랜덤6자리}`  
**예시**: `20240115-143025-a3f9b2`

```python
# action_router.py의 execute_nodes()에서
from utils.execution_id_generator import generate_execution_id

# 날짜시간 기반 실행 ID 생성
execution_id = generate_execution_id()  # 예: "20240115-143025-a3f9b2"

# 각 노드 실행 시 execution_id가 전달됨
result = await action_service.process_node(
    node, 
    context, 
    execution_id=execution_id,  # 전달
    script_id=script_id
)
```

**특징:**
- 날짜와 시간이 포함되어 실행 시점을 바로 확인 가능
- 사람이 읽기 쉬운 형식
- 랜덤 문자열로 고유성 보장
- 프론트엔드에서 `2024-01-15 14:30:25 (a3f9b2)` 형식으로 표시

같은 `execution_id`를 가진 로그들은 같은 워크플로우 실행의 노드들입니다.

## 메타데이터 전달

노드 실행 시 메타데이터가 파라미터에 자동으로 추가됩니다.

```python
# action_service.py의 process_node()에서
node_data["_execution_id"] = execution_id  # 내부 메타데이터
node_data["_script_id"] = script_id
node_data["_node_id"] = node_id
node_data["_node_name"] = node_name

# NodeExecutor.wrapper()에서 추출
node_id = validated_params.get("_node_id")
execution_id = validated_params.get("_execution_id")
script_id = validated_params.get("_script_id")
```

**주의**: `_` 접두사가 붙은 파라미터는 내부 메타데이터이므로 로그에 저장되지 않습니다.

## 사용 예시

### 1. 실행 ID로 로그 조회

```python
from server.db.database import db_manager

# 특정 워크플로우 실행의 모든 노드 로그 조회
execution_id = "550e8400-e29b-41d4-a716-446655440000"
logs = db_manager.node_execution_logs.get_logs_by_execution_id(execution_id)

for log in logs:
    print(f"노드: {log['node_name']}, 상태: {log['status']}, 시간: {log['execution_time_ms']}ms")
```

### 2. 스크립트별 실패 로그 조회

```python
# 특정 스크립트의 실패한 노드 로그만 조회
failed_logs = db_manager.node_execution_logs.get_failed_logs(script_id=1, limit=50)

for log in failed_logs:
    print(f"노드: {log['node_name']}, 에러: {log['error_message']}")
    if log['error_traceback']:
        print(f"스택 트레이스:\n{log['error_traceback']}")
```

### 3. 노드별 실행 이력 조회

```python
# 특정 노드의 실행 이력 조회
node_id = "node_1"
logs = db_manager.node_execution_logs.get_logs_by_node_id(node_id, limit=100)

for log in logs:
    print(f"실행 시간: {log['started_at']}, 상태: {log['status']}, 소요 시간: {log['execution_time_ms']}ms")
```

### 4. API를 통한 조회 (Python)

```python
import requests

# 실행 ID로 조회
response = requests.get(
    "http://localhost:8000/api/logs/node-execution",
    params={"execution_id": "550e8400-e29b-41d4-a716-446655440000"}
)
logs = response.json()["data"]

# 실패한 로그만 조회
response = requests.get(
    "http://localhost:8000/api/logs/node-execution/failed",
    params={"script_id": 1, "limit": 50}
)
failed_logs = response.json()["data"]
```

### 5. 프론트엔드에서 로그 조회 (JavaScript)

```javascript
import { LogAPI } from './js/api/logapi.js';

// 실행 ID로 조회
const logs = await LogAPI.getNodeExecutionLogs({
    execution_id: '550e8400-e29b-41d4-a716-446655440000'
});

// 스크립트별 조회
const logs = await LogAPI.getNodeExecutionLogs({
    script_id: 1,
    limit: 100
});

// 실패한 로그만 조회
const failedLogs = await LogAPI.getFailedNodeExecutionLogs({
    script_id: 1,
    limit: 50
});
```

### 6. 프론트엔드 실행 기록 페이지 사용

1. **실행 기록 페이지 접속**
   - 사이드바에서 "실행 기록" 메뉴 클릭
   - 자동으로 최근 로그 로드

2. **필터링**
   - 스크립트 필터: 특정 스크립트의 로그만 조회
   - 상태 필터: 완료/실패/실행 중 필터링

3. **실행 그룹 확인**
   - 실행 그룹 어디를 클릭해도 상세 정보 표시
   - 각 노드의 실행 결과, 파라미터, 에러 정보 확인

4. **통계 확인**
   - 전체 로그 개수
   - 완료/실패 개수
   - 평균 실행 시간

5. **로그 삭제**
   - 전체 삭제: 필터 영역의 "🗑️ 전체 삭제" 버튼으로 모든 로그 삭제
   - 실행 그룹 삭제: 각 실행 그룹 헤더 우측의 휴지통 버튼으로 해당 실행의 모든 로그 삭제
   - 개별 로그 삭제: 각 로그 아이템 우측의 휴지통 버튼으로 개별 로그 삭제
   - 삭제 전 확인 다이얼로그 표시
   - 삭제 후 자동으로 UI 및 통계 업데이트

## 성능 고려사항

### 1. 비동기 전송

로그 전송은 비동기로 처리되므로 노드 실행 성능에 영향을 주지 않습니다.

```python
# fire-and-forget 방식
await log_client.send_log_async(...)  # 블로킹 없음
```

### 2. 인덱스 최적화

자주 조회되는 컬럼에 인덱스를 추가하여 조회 성능을 최적화했습니다.

- `execution_id`: 같은 실행의 노드들을 빠르게 조회
- `script_id`: 스크립트별 로그 조회 최적화
- `node_id`: 노드별 실행 이력 조회 최적화
- `status`: 상태별 필터링 최적화
- `started_at`: 시간순 정렬 최적화

### 3. JSON 필드

`parameters`와 `result`는 JSON 문자열로 저장되며, 조회 시 자동으로 파싱됩니다.

### 4. 트랜잭션 처리

로그 저장 시 트랜잭션을 사용하여 데이터 무결성을 보장합니다.

## 외래키 관계

### 부모-자식 관계

```
scripts (부모)
  └── node_execution_logs (자식)
        └── script_id → scripts.id (CASCADE DELETE)
```

**CASCADE DELETE:**
- `scripts` 삭제 시 → `node_execution_logs`의 해당 레코드 자동 삭제

**주의:**
- `script_id`는 선택사항이므로 NULL일 수 있습니다 (단일 노드 실행 시)
- `execution_id`는 외래키가 아니므로 스크립트 삭제와 무관합니다

## 데이터 보존 정책

로그 삭제는 다음 방법으로 수행할 수 있습니다:

1. **프론트엔드에서 삭제**
   - 실행 기록 페이지에서 전체 삭제, 실행 그룹 삭제, 개별 로그 삭제 가능
   - 삭제 전 확인 다이얼로그 표시

2. **API를 통한 삭제**
   - `DELETE /api/logs/node-execution/{log_id}`: 개별 로그 삭제
   - `DELETE /api/logs/node-execution/execution/{execution_id}`: 실행 ID별 삭제
   - `DELETE /api/logs/node-execution`: 전체 로그 삭제

3. **Repository를 통한 삭제**
   - `delete_log(log_id)`: 개별 로그 삭제
   - `delete_logs_by_execution_id(execution_id)`: 실행 ID별 삭제
   - `delete_all_logs()`: 전체 로그 삭제

**향후 자동 삭제 기능:**
- 필요시 자동 삭제 기능을 추가할 수 있습니다.

```sql
-- 예시: 30일 이상 된 로그 삭제
DELETE FROM node_execution_logs
WHERE created_at < datetime('now', '-30 days');
```

## 확장 가능성

향후 추가 가능한 기능:

1. **로그 필터링**: 날짜 범위, 노드 타입별 필터링
2. **통계 집계**: 노드별 평균 실행 시간, 실패율 등
3. **알림**: 실패 로그 발생 시 알림
4. **로그 보존 정책**: 자동 삭제, 아카이빙
5. **로그 검색**: 키워드 검색, 고급 필터링
6. **로그 내보내기**: CSV, JSON 형식으로 로그 내보내기
7. **로그 아카이빙**: 오래된 로그를 별도 테이블로 이동

## 관련 문서

- [데이터베이스 스키마](schema.md): 전체 데이터베이스 스키마
- [리포지토리 구조](repositories.md): 리포지토리 패턴 구조
- [연결 관리](connection.md): 데이터베이스 연결 관리

