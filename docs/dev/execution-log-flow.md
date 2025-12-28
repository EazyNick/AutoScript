# 실행 로그 저장 흐름

## 개요

워크플로우 실행 시 생성되는 로그는 크게 세 가지 유형으로 구분됩니다:

1. **노드 실행 로그**: 각 노드의 실행 결과를 자동으로 기록
2. **스크립트 실행 기록**: 스크립트 단위의 실행 성공/실패 기록
3. **전체 실행 요약**: 여러 스크립트를 한 번에 실행한 경우의 요약 정보

## 아키텍처 다이어그램

```
[사용자 액션]
    │
    ├─→ [단일 스크립트 실행]
    │   │
    │   ├─→ [노드 실행] (각 노드마다)
    │   │   ├─→ NodeExecutor.wrapper() 호출
    │   │   ├─→ ExecutionLogClient.send_log_async(status="running")
    │   │   ├─→ 노드 실행 함수 실행
    │   │   ├─→ ExecutionLogClient.send_log_async(status="completed"/"failed")
    │   │   └─→ /api/logs/node-execution → DB 저장
    │   │
    │   ├─→ [스크립트 실행 완료]
    │   │   ├─→ dashboard.recordScriptExecution()
    │   │   ├─→ /api/scripts/{id}/execution-record → DB 저장
    │   │   └─→ logsUpdated 이벤트 dispatch
    │   │
    │   └─→ [실행 기록 페이지 업데이트]
    │       └─→ history.js에서 logsUpdated 이벤트 수신 → 로그 새로고침
    │
    └─→ [전체 스크립트 실행]
        │
        ├─→ [각 스크립트 실행] (위와 동일)
        │
        ├─→ [전체 실행 완료]
        │   ├─→ dashboard.recordExecutionSummary()
        │   ├─→ /api/dashboard/execution-summary → DB 저장
        │   └─→ logsUpdated 이벤트 dispatch (finally 블록)
        │
        └─→ [실행 기록 페이지 업데이트]
            └─→ history.js에서 logsUpdated 이벤트 수신 → 로그 새로고침
```

## 1. 노드 실행 로그 (자동 생성)

### 흐름

노드 실행 로그는 서버 측에서 자동으로 생성되며, 프론트엔드에서 명시적으로 호출할 필요가 없습니다.

#### 1.1 노드 실행 시작

**위치**: `server/nodes/node_executor_wrapper.py`

```python
# NodeExecutor 데코레이터가 노드 실행 함수를 래핑
@NodeExecutor("condition")
async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
    # 노드 실행 로직
    pass
```

**실행 시점**:
- 노드 실행 함수가 호출되기 전
- `NodeExecutor.wrapper()` 메서드 내부에서 자동 실행

**처리 과정**:
1. 실행 시작 시간 기록 (`started_at`)
2. `ExecutionLogClient.send_log_async()` 호출 (비동기, fire-and-forget)
3. 상태: `"running"`

```python
# 실행 시작 로그 전송 (비동기, fire-and-forget)
_ = asyncio.create_task(
    log_client.send_log_async(
        execution_id=execution_id,
        script_id=script_id,
        node_id=node_id,
        node_type=self.action_name,
        node_name=node_name,
        status="running",
        started_at=started_at,
        parameters=log_parameters,
    )
)
```

#### 1.2 노드 실행 완료/실패

**실행 시점**:
- 노드 실행 함수가 성공적으로 완료되거나 예외가 발생한 후
- `NodeExecutor.wrapper()` 메서드 내부에서 자동 실행

**처리 과정**:

**성공 시**:
```python
# 실행 완료 로그 전송
_ = asyncio.create_task(
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
    )
)
```

**실패 시**:
```python
# 실행 실패 로그 전송
_ = asyncio.create_task(
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
    )
)
```

#### 1.3 로그 전송 및 저장

**위치**: `server/execution_logging/execution_log_client.py`

```python
async def send_log_async(...):
    """비동기 로그 전송 (fire-and-forget)"""
    try:
        await self.send_log(...)  # HTTP POST 요청
    except Exception as e:
        # 에러 발생 시 조용히 무시 (노드 실행에 영향 없음)
        logger.debug(f"[ExecutionLogClient] 로그 전송 실패 (무시됨): {e!s}")
```

**API 엔드포인트**: `POST /api/logs/node-execution`

**위치**: `server/api/log_router.py`

```python
@router.post("/node-execution")
async def create_node_execution_log(request: NodeExecutionLogRequest):
    # 1. DB에 로그 저장
    log_id = db_manager.node_execution_logs.create_log(...)
    
    # 2. 통계 업데이트 (completed/failed일 때만)
    if request.status in ("completed", "failed"):
        db_manager.log_stats.calculate_and_update_stats()
    
    return NodeExecutionLogResponse(success=True, log_id=log_id)
```

#### 1.4 로그 업데이트 로직

**위치**: `server/execution_logging/execution_log_repository.py`

**중요**: 중복 로그 방지를 위한 업데이트 로직

```python
def create_log(...):
    # completed 또는 failed 상태일 때는 기존 running 로그를 찾아서 업데이트
    if status in ("completed", "failed") and execution_id and node_id:
        # 같은 execution_id와 node_id를 가진 running 상태 로그 찾기
        existing_log = cursor.execute(
            "SELECT id FROM node_execution_logs "
            "WHERE execution_id = ? AND node_id = ? AND status = 'running' "
            "ORDER BY id DESC LIMIT 1",
            (execution_id, node_id)
        ).fetchone()
        
        if existing_log:
            # 기존 로그 업데이트 (중복 방지)
            cursor.execute(
                "UPDATE node_execution_logs SET status = ?, finished_at = ?, ... "
                "WHERE id = ?",
                (status, finished_at, ..., existing_log[0])
            )
            return existing_log[0]
    
    # running 상태이거나 기존 로그를 찾지 못한 경우 새로 생성
    cursor.execute("INSERT INTO node_execution_logs ...")
```

**결과**: 
- `running` 상태: 새 로그 생성
- `completed`/`failed` 상태: 기존 `running` 로그를 찾아서 업데이트 (없으면 새로 생성)
- **중복 로그 방지**: 하나의 노드 실행당 하나의 로그만 존재

## 2. 스크립트 실행 기록 (프론트엔드 호출)

### 흐름

스크립트 실행 기록은 프론트엔드에서 명시적으로 호출하여 저장합니다.

#### 2.1 단일 스크립트 실행 성공

**위치**: `UI/src/js/components/sidebar/sidebar-scripts.js`

**실행 시점**: `executeSingleScript()` 메서드에서 스크립트 실행이 성공적으로 완료된 후

```javascript
// 9. 실행 기록 저장
try {
    const dashboardManager = getDashboardManagerInstance();
    if (dashboardManager && typeof dashboardManager.recordScriptExecution === 'function') {
        await dashboardManager.recordScriptExecution(script.id, {
            status: 'success',
            error_message: null,
            execution_time_ms: executionTimeMs
        });
    }
} catch (recordError) {
    logWarn(`[Scripts] 스크립트 실행 기록 저장 실패 (무시): ${recordError.message}`);
}
```

**API 호출**: `UI/src/pages/workflow/dashboard.js`

```javascript
async recordScriptExecution(scriptId, executionData) {
    const result = await apiCall(`/api/scripts/${scriptId}/execution-record`, {
        method: 'POST',
        body: JSON.stringify(executionData)
    });
    
    // 대시보드 통계 즉시 업데이트
    await this.loadDashboardStats();
    this.updateStats();
    
    return result;
}
```

**서버 엔드포인트**: `POST /api/scripts/{script_id}/execution-record`

**위치**: `server/api/script_router.py`

```python
@router.post("/scripts/{script_id}/execution-record")
async def record_script_execution(script_id: int, execution_data: dict):
    # DB에 스크립트 실행 기록 저장
    db_manager.record_script_execution(
        script_id=script_id,
        status=execution_data.get("status"),  # "success" or "error"
        error_message=execution_data.get("error_message"),
        execution_time_ms=execution_data.get("execution_time_ms")
    )
    
    # 대시보드 통계 업데이트
    db_manager.calculate_and_update_dashboard_stats()
    
    return success_response(message="스크립트 실행 기록이 저장되었습니다.")
```

#### 2.2 단일 스크립트 실행 실패

**위치**: `UI/src/js/components/sidebar/sidebar-scripts.js`

**실행 시점**: `executeSingleScript()` 메서드의 catch 블록에서

```javascript
catch (execError) {
    // 실행 기록 저장 (실패)
    try {
        const dashboardManager = getDashboardManagerInstance();
        if (dashboardManager && typeof dashboardManager.recordScriptExecution === 'function') {
            await dashboardManager.recordScriptExecution(script.id, {
                status: 'error',
                error_message: execError.message,
                execution_time_ms: executionTimeMs
            });
        }
    } catch (recordError) {
        logWarn(`[Scripts] 스크립트 실행 기록 저장 실패 (무시): ${recordError.message}`);
    }
}
```

**API 호출 및 서버 처리**: 성공 시와 동일

#### 2.3 로그 업데이트 이벤트

**위치**: `UI/src/js/components/sidebar/sidebar-scripts.js`

**실행 시점**: 스크립트 실행 완료/실패 후 (단일 실행일 때만)

```javascript
// 11. 실행 기록 페이지에 로그 업데이트 알림 (단일 실행 완료 시)
if (!isRunningAllScripts) {
    document.dispatchEvent(
        new CustomEvent('logsUpdated', {
            detail: {
                type: 'workflowExecutionCompleted',  // 또는 'workflowExecutionFailed'
                scriptId: script.id,
                scriptName: script.name
            }
        })
    );
}
```

**이벤트 수신**: `UI/src/pages/workflow/history.js`

```javascript
// 중복 이벤트 방지를 위한 플래그
let isRefreshing = false;
let lastEventTime = 0;

document.addEventListener('logsUpdated', async (e) => {
    // 실행 기록 페이지가 현재 표시 중인지 확인
    const historyPage = document.getElementById('page-history');
    if (!historyPage || historyPage.style.display === 'none') {
        return;
    }

    // 중복 이벤트 방지 (같은 이벤트가 500ms 이내에 여러 번 발생하면 무시)
    const currentTime = Date.now();
    if (isRefreshing || (currentTime - lastEventTime < 500)) {
        return;
    }

    isRefreshing = true;
    lastEventTime = currentTime;

    // 서버에서 로그 저장이 완료된 후 이벤트가 dispatch되므로 즉시 로그 조회
    // (sidebar-scripts.js의 waitForLogsAndDispatch에서 로그 저장 확인 완료)
    try {
        await this.loadLogs();
        this.renderLogs();
    } catch (error) {
        logger.error('[HistoryManager] 로그 새로고침 실패:', error);
    } finally {
        isRefreshing = false;
    }
});
```

**로그 저장 확인**: `UI/src/js/components/sidebar/sidebar-scripts.js`

```javascript
async waitForLogsAndDispatch(scriptId, scriptName, eventType) {
    // execution_id로 로그가 저장될 때까지 재시도
    const executionId = workflowPage?.executionService?.lastExecutionId;
    
    // execution_id로 최신 로그 확인 (최대 10번 재시도, 500ms 간격)
    let retryCount = 0;
    const maxRetries = 10;
    
    while (retryCount < maxRetries) {
        const logs = await LogAPI.getNodeExecutionLogs({
            execution_id: executionId,
            limit: 1
        });
        
        if (logs && logs.length > 0) {
            // 로그 저장 확인 완료 → 이벤트 dispatch
            document.dispatchEvent(new CustomEvent('logsUpdated', {...}));
            return;
        }
        
        retryCount++;
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // 타임아웃 후에도 이벤트 dispatch (폴백)
    document.dispatchEvent(new CustomEvent('logsUpdated', {...}));
}
```

## 3. 전체 실행 요약 (프론트엔드 호출)

### 흐름

여러 스크립트를 한 번에 실행한 경우의 요약 정보를 저장합니다.

#### 3.1 전체 스크립트 실행 완료

**위치**: `UI/src/js/components/sidebar/sidebar-scripts.js`

**실행 시점**: `runAllScripts()` 메서드에서 모든 스크립트 실행이 완료된 후

```javascript
// 전체 실행 요약 정보 저장
try {
    const dashboardManager = getDashboardManagerInstance();
    if (dashboardManager && typeof dashboardManager.recordExecutionSummary === 'function') {
        await dashboardManager.recordExecutionSummary({
            total_executions: activeScripts.length,
            failed_count: failCount
        });
    }
} catch (summaryError) {
    logWarn(`[Scripts] 전체 실행 요약 정보 저장 실패 (무시): ${summaryError.message}`);
}
```

**API 호출**: `UI/src/pages/workflow/dashboard.js`

```javascript
async recordExecutionSummary(summary) {
    const result = await apiCall('/api/dashboard/execution-summary', {
        method: 'POST',
        body: JSON.stringify(summary)
    });
    
    // 대시보드 통계 즉시 업데이트
    await this.loadDashboardStats();
    this.updateStats();
    
    return result;
}
```

**서버 엔드포인트**: `POST /api/dashboard/execution-summary`

**위치**: `server/api/dashboard_router.py`

```python
@router.post("/dashboard/execution-summary")
async def record_execution_summary(summary: dict):
    # DB에 전체 실행 요약 정보 저장
    db_manager.record_execution_summary(
        total_executions=summary.get("total_executions"),
        failed_count=summary.get("failed_count")
    )
    
    # 대시보드 통계 업데이트
    db_manager.calculate_and_update_dashboard_stats()
    
    return success_response(message="실행 요약 정보가 저장되었습니다.")
```

#### 3.2 로그 업데이트 이벤트 (finally 블록)

**위치**: `UI/src/js/components/sidebar/sidebar-scripts.js`

**실행 시점**: `runAllScripts()` 메서드의 finally 블록에서 (성공/실패/취소 모든 경우)

```javascript
} finally {
    // 실행 기록 페이지에 로그 업데이트 알림 (성공/실패 모두)
    try {
        document.dispatchEvent(
            new CustomEvent('logsUpdated', {
                detail: {
                    type: 'allScriptsExecutionCompleted',
                    successCount,
                    failCount,
                    totalCount: activeScripts.length
                }
            })
        );
    } catch (logError) {
        logWarn(`[Scripts] 로그 업데이트 이벤트 전송 실패 (무시): ${logError.message}`);
    }
    
    // 실행 중 플래그 해제
    this.sidebarManager.isRunningAllScripts = false;
    // ...
}
```

**이벤트 수신**: `UI/src/pages/workflow/history.js` (단일 실행과 동일)

## 4. 데이터베이스 스키마

### 4.1 노드 실행 로그 테이블

**테이블명**: `node_execution_logs`

**주요 필드**:
- `id`: 로그 ID (PRIMARY KEY)
- `execution_id`: 워크플로우 실행 ID (같은 실행의 노드들을 그룹화)
- `script_id`: 스크립트 ID (FOREIGN KEY)
- `node_id`: 노드 ID
- `node_type`: 노드 타입
- `node_name`: 노드 이름/제목
- `status`: 실행 상태 (`running`, `completed`, `failed`)
- `started_at`: 시작 시간
- `finished_at`: 종료 시간
- `execution_time_ms`: 실행 시간 (밀리초)
- `parameters`: 입력 파라미터 (JSON)
- `result`: 실행 결과 (JSON)
- `error_message`: 에러 메시지 (실패 시)
- `error_traceback`: 에러 스택 트레이스 (실패 시)

**인덱스**:
- `idx_node_logs_execution_id`: `execution_id` 기준 조회
- `idx_node_logs_script_id`: `script_id` 기준 조회
- `idx_node_logs_status`: `status` 기준 조회
- `idx_node_logs_started_at`: 시간순 정렬

### 4.2 로그 통계 테이블

**테이블명**: `log_stats`

**주요 필드**:
- `total`: 전체 스크립트 실행 개수 (`execution_id` 기준 고유 개수)
- `completed`: 완료된 노드 로그 개수
- `failed`: 실패한 노드 로그 개수
- `average_execution_time`: 평균 실행 시간 (밀리초)

**업데이트 시점**: 
- 노드 로그가 `completed` 또는 `failed` 상태로 저장될 때
- 로그 삭제 시

### 4.3 대시보드 통계 테이블

**테이블명**: `dashboard_stats`

**주요 필드**:
- `all_executions`: 전체 스크립트 실행 횟수
- `all_failed_scripts`: 실패한 스크립트 개수

**업데이트 시점**:
- 스크립트 실행 기록 저장 시
- 전체 실행 요약 저장 시

## 5. 예외 처리 및 안정성

### 5.1 노드 실행 로그

- **비동기 전송**: `asyncio.create_task()`로 비동기 전송 (fire-and-forget)
- **에러 무시**: 로그 전송 실패 시 노드 실행에 영향 없음
- **타임아웃**: 5초 타임아웃 설정
- **중복 방지**: `running` 로그를 `completed`/`failed`로 업데이트하여 중복 방지

### 5.2 스크립트 실행 기록

- **try-catch**: 저장 실패 시 경고 로그만 출력하고 계속 진행
- **대시보드 통계**: 저장 후 즉시 대시보드 통계 업데이트

### 5.3 로그 업데이트 이벤트

- **finally 블록**: 성공/실패/취소 모든 경우에 실행 보장
- **예외 처리**: 이벤트 전송 실패 시 경고 로그만 출력
- **로그 저장 확인**: 서버에서 로그가 저장될 때까지 확인 후 이벤트 dispatch
  - `execution_id`로 최신 로그 확인 (최대 10번 재시도, 500ms 간격)
  - `execution_id`가 없으면 `script_id`로 최신 로그 확인
  - 로그 저장 확인 완료 후 `logsUpdated` 이벤트 dispatch
- **즉시 로그 조회**: `history.js`에서는 이벤트 수신 후 즉시 로그 조회 (지연 시간 없음)
- **중복 이벤트 방지**: 500ms 이내 중복 이벤트 무시

## 6. 성능 최적화

### 6.1 비동기 처리

- 노드 실행 로그는 비동기로 전송하여 노드 실행 성능에 영향 없음
- `asyncio.create_task()`로 백그라운드에서 실행

### 6.2 통계 업데이트

- `completed`/`failed` 상태일 때만 통계 업데이트 (running 제외)
- 중복 카운팅 방지

### 6.3 이벤트 기반 업데이트

- 실행 기록 페이지는 이벤트 기반으로 업데이트
- 페이지가 표시 중일 때만 새로고침 (성능 최적화)

## 7. 주요 파일 위치

### 프론트엔드

- **스크립트 실행 관리**: `UI/src/js/components/sidebar/sidebar-scripts.js`
- **대시보드 API 호출**: `UI/src/pages/workflow/dashboard.js`
- **실행 기록 페이지**: `UI/src/pages/workflow/history.js`
- **워크플로우 실행 서비스**: `UI/src/pages/workflow/services/workflow-execution-service.js`

### 서버

- **노드 실행 래퍼**: `server/nodes/node_executor_wrapper.py`
- **로그 클라이언트**: `server/execution_logging/execution_log_client.py`
- **로그 모델**: `server/execution_logging/execution_log_models.py`
- **로그 API 라우터**: `server/api/log_router.py`
- **스크립트 API 라우터**: `server/api/script_router.py`
- **대시보드 API 라우터**: `server/api/dashboard_router.py`
- **로그 리포지토리**: `server/execution_logging/execution_log_repository.py`
- **로그 통계 리포지토리**: `server/db/log_stats_repository.py`

## 8. 체크리스트

### 노드 실행 로그
- [x] 노드 실행 시작 시 `running` 로그 자동 생성
- [x] 노드 실행 완료 시 `completed` 로그로 업데이트
- [x] 노드 실행 실패 시 `failed` 로그로 업데이트
- [x] 중복 로그 방지 (running → completed/failed 업데이트)
- [x] 비동기 전송으로 성능 영향 없음
- [x] 통계 업데이트 (completed/failed일 때만)

### 스크립트 실행 기록
- [x] 단일 스크립트 실행 성공 시 기록 저장
- [x] 단일 스크립트 실행 실패 시 기록 저장
- [x] 예외 처리 (저장 실패 시 경고만 출력)
- [x] 대시보드 통계 즉시 업데이트

### 전체 실행 요약
- [x] 전체 스크립트 실행 완료 시 요약 저장
- [x] 예외 처리 (저장 실패 시 경고만 출력)
- [x] 대시보드 통계 즉시 업데이트

### 로그 업데이트 이벤트
- [x] 단일 스크립트 실행 완료 시 이벤트 dispatch (로그 저장 확인 후)
- [x] 단일 스크립트 실행 실패 시 이벤트 dispatch (로그 저장 확인 후)
- [x] 전체 스크립트 실행 완료 시 이벤트 dispatch (finally 블록)
- [x] 실행 기록 페이지에서 이벤트 수신 및 즉시 새로고침 (지연 시간 없음)
- [x] 페이지 표시 중일 때만 새로고침 (성능 최적화)
- [x] 서버 로그 저장 완료 확인 후 이벤트 dispatch (하드코딩된 지연 시간 제거)
