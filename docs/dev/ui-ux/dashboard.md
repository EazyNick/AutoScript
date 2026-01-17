**최신 수정일자: 2025.12.21**

# 대시보드 통계 데이터 설계

## 개요

대시보드에 표시되는 4가지 통계 항목을 DB에 저장하고 불러오는 방식으로 설계합니다.

### 통계 항목

1. **전체 워크플로우** (Total Workflows)
   - 시스템에 등록된 전체 스크립트 개수
   - `scripts` 테이블의 전체 레코드 수

2. **전체 실행 횟수** (All Executions)
   - 전체 실행 시 실행된 스크립트 개수 (오늘 기준이 아닌 전체 실행 기준)
   - `dashboard_stats` 테이블의 `all_executions` 값

3. **전체 실패한 스크립트** (All Failed Scripts)
   - 전체 실행 시 실패한 스크립트 개수 (오늘 기준이 아닌 전체 실행 기준)
   - `dashboard_stats` 테이블의 `all_failed_scripts` 값

4. **비활성 스크립트** (Inactive Scripts)
   - 현재 비활성화된 스크립트 개수
   - `scripts` 테이블에서 `active = 0`인 레코드 수

> **참고**: 현재 구현은 "오늘 실행 횟수"가 아닌 "전체 실행 시 실행된 스크립트 개수"를 표시합니다. `dashboard_stats` 테이블에 `today_executions`, `today_failed_scripts` 키도 지원하지만, 대시보드 UI에서는 `all_executions`, `all_failed_scripts`를 사용합니다.

## DB 테이블 설계

### 1. `dashboard_stats` 테이블 (기존 테이블 활용)

통계 값을 키-값 형태로 저장하는 테이블입니다.

```sql
CREATE TABLE IF NOT EXISTS dashboard_stats (
    stat_key TEXT PRIMARY KEY,           -- 통계 키 (예: 'total_scripts', 'today_executions')
    stat_value INTEGER NOT NULL DEFAULT 0, -- 통계 값
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 마지막 업데이트 시간
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP  -- 생성 시간
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_dashboard_stats_updated_at 
ON dashboard_stats(updated_at);
```

**저장되는 통계 키:**
- `total_scripts`: 전체 워크플로우 개수
- `all_executions`: 전체 실행 시 실행된 스크립트 개수 (대시보드에서 사용)
- `all_failed_scripts`: 전체 실행 시 실패한 스크립트 개수 (대시보드에서 사용)
- `today_executions`: 오늘 실행 횟수 (서버에서 지원하지만 대시보드 UI에서는 미사용)
- `today_failed_scripts`: 오늘 실패한 스크립트 개수 (서버에서 지원하지만 대시보드 UI에서는 미사용)
- `inactive_scripts`: 비활성 스크립트 개수

### 2. `script_executions` 테이블 (기존 테이블 활용)

스크립트 실행 기록을 저장하는 테이블입니다. 오늘 실행 횟수와 실패한 스크립트 개수를 계산하는 데 사용됩니다.

```sql
CREATE TABLE IF NOT EXISTS script_executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    script_id INTEGER NOT NULL,              -- 실행된 스크립트 ID
    status TEXT NOT NULL,                    -- 실행 상태 ('success', 'error', 'cancelled')
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 실행 시작 시간
    completed_at TIMESTAMP,                   -- 실행 완료 시간
    error_message TEXT,                      -- 에러 메시지 (실패 시)
    FOREIGN KEY (script_id) REFERENCES scripts(id) ON DELETE CASCADE
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_script_executions_script_id 
ON script_executions(script_id);

CREATE INDEX IF NOT EXISTS idx_script_executions_started_at 
ON script_executions(started_at);

CREATE INDEX IF NOT EXISTS idx_script_executions_status 
ON script_executions(status);
```

### 3. `scripts` 테이블 (기존 테이블 활용)

스크립트 정보를 저장하는 테이블입니다. 전체 워크플로우 개수와 비활성 스크립트 개수를 계산하는 데 사용됩니다.

```sql
CREATE TABLE IF NOT EXISTS scripts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    active INTEGER DEFAULT 1,               -- 활성화 여부 (1: 활성, 0: 비활성)
    execution_order INTEGER DEFAULT 0,      -- 실행 순서
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_scripts_active 
ON scripts(active);
```

## 데이터 업데이트 전략

### 1. 실시간 계산 + 캐시 방식 (하이브리드)

통계 값을 실시간으로 계산하되, 결과를 `dashboard_stats` 테이블에 캐시하여 저장합니다.

**장점:**
- 정확한 실시간 데이터 제공
- 자주 조회되는 통계를 캐시하여 성능 향상
- 이벤트 기반 업데이트로 효율적

**단점:**
- 이벤트 발생 시 업데이트 로직 필요
- 캐시 무효화 관리 필요

### 2. 업데이트 트리거

다음 이벤트 발생 시 통계를 업데이트합니다:

#### 2.1 스크립트 생성/삭제 시
- **전체 워크플로우** 업데이트
- `scripts` 테이블 변경 시 트리거

#### 2.2 스크립트 실행 시
- **전체 실행 횟수** 업데이트 (`all_executions`)
- `/api/dashboard/increment-execution` API 호출 시 업데이트

#### 2.3 스크립트 실행 실패 시
- **전체 실패한 스크립트** 업데이트 (`all_failed_scripts`)
- `/api/dashboard/increment-execution` API 호출 시 `success: false`인 경우 업데이트

#### 2.4 스크립트 활성/비활성 토글 시
- **비활성 스크립트** 업데이트
- `scripts` 테이블의 `active` 필드 변경 시 트리거

#### 2.5 일일 자동 갱신
- 매일 자정에 오늘 날짜 관련 통계 초기화
- **오늘 실행 횟수**, **오늘 실패한 스크립트** 재계산

## 구현 방법

### 1. 백엔드 구현

#### 1.1 통계 계산 및 업데이트

```python
# server/db/database.py

def calculate_and_update_dashboard_stats(self) -> dict[str, int]:
    """
    대시보드 통계 계산 및 업데이트
    
    Returns:
        통계 딕셔너리
    """
    stats = {}
    
    # 1. 전체 워크플로우 개수
    total_scripts = self.get_scripts_count()
    stats['total_scripts'] = total_scripts
    self.dashboard_stats_repo.set_stat('total_scripts', total_scripts)
    
    # 2. 전체 실행 횟수 (dashboard_stats 테이블에서 조회)
    all_executions = self.dashboard_stats.get_stat('all_executions', 0)
    stats['all_executions'] = all_executions
    
    # 3. 전체 실패한 스크립트 개수 (dashboard_stats 테이블에서 조회)
    all_failed_scripts = self.dashboard_stats.get_stat('all_failed_scripts', 0)
    stats['all_failed_scripts'] = all_failed_scripts
    
    # 4. 비활성 스크립트 개수
    inactive_scripts = self.get_inactive_scripts_count()
    stats['inactive_scripts'] = inactive_scripts
    self.dashboard_stats_repo.set_stat('inactive_scripts', inactive_scripts)
    
    return stats
```

#### 1.2 통계 조회 (캐시 우선)

```python
# server/db/database.py

def get_dashboard_stats(self, use_cache: bool = True) -> dict[str, int]:
    """
    대시보드 통계 조회
    
    Args:
        use_cache: 캐시 사용 여부 (기본값: True)
    
    Returns:
        통계 딕셔너리
    """
    if use_cache:
        # 캐시에서 조회
        cached_stats = self.dashboard_stats_repo.get_all_stats()
        
        # 캐시가 최신인지 확인 (예: 5분 이내 업데이트된 경우)
        if self._is_cache_valid(cached_stats):
            return cached_stats
    
    # 캐시가 없거나 오래된 경우 재계산
    return self.calculate_and_update_dashboard_stats()
```

#### 1.3 이벤트 기반 업데이트

```python
# server/services/script_service.py

def create_script(self, script_data: dict) -> dict:
    """스크립트 생성"""
    # 스크립트 생성 로직
    script = self.script_repo.create(script_data)
    
    # 통계 업데이트
    self.db_manager.update_stat('total_scripts')
    
    return script

def delete_script(self, script_id: int) -> bool:
    """스크립트 삭제"""
    # 스크립트 삭제 로직
    success = self.script_repo.delete(script_id)
    
    # 통계 업데이트
    if success:
        self.db_manager.update_stat('total_scripts')
    
    return success

def toggle_script_active(self, script_id: int) -> bool:
    """스크립트 활성/비활성 토글"""
    # 토글 로직
    success = self.script_repo.toggle_active(script_id)
    
    # 통계 업데이트
    if success:
        self.db_manager.update_stat('inactive_scripts')
    
    return success
```

```python
# server/services/execution_service.py

def record_execution(self, script_id: int, status: str, error_message: str = None):
    """스크립트 실행 기록"""
    # 실행 기록 저장
    execution = self.execution_repo.create({
        'script_id': script_id,
        'status': status,
        'error_message': error_message
    })
    
    # 통계 업데이트 (실제로는 /api/dashboard/increment-execution API를 통해 업데이트)
    # 이 메서드는 현재 구현되지 않았으며, 실행 기록 저장 시 자동으로 통계가 업데이트되지 않음
    # 대신 프론트엔드에서 실행 완료 후 `/api/dashboard/increment-execution` API를 호출하여 통계 업데이트
    
    return execution
```

### 2. 프론트엔드 구현

#### 2.1 통계 데이터 로드

```javascript
// UI/src/pages/workflow/dashboard.js

async loadDashboardStats() {
    const logger = getLogger();
    logger.log('[Dashboard] 대시보드 통계 데이터 로드 시작');

    try {
        const apiHost = window.API_HOST || 'localhost';
        const apiPort = window.API_PORT || 8001;
        const response = await fetch(`http://${apiHost}:${apiPort}/api/dashboard/stats`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        logger.log('[Dashboard] 대시보드 통계 데이터 로드 완료:', result);

        const stats = result.data || result;

        // 통계 데이터 설정
        this.executionStats = {
            totalScripts: stats.total_scripts || 0,
            allExecutions: stats.all_executions || 0, // 전체 실행 시 실행된 스크립트 개수
            allFailed: stats.all_failed_scripts || 0, // 전체 실행 시 실패한 스크립트 개수
            inactiveScripts: stats.inactive_scripts || 0
        };
        
        // UI 업데이트
        this.updateStatsDisplay();
    } catch (error) {
        logger.error('[Dashboard] 대시보드 통계 데이터 로드 실패:', error);
        // 실패 시 기본값 사용
        this.executionStats = {
            totalScripts: 0,
            allExecutions: 0,
            allFailed: 0,
            inactiveScripts: 0
        };
    }
}
```

## API 엔드포인트

### GET `/api/dashboard/stats`

대시보드 통계 조회

**요청:**
```
GET /api/dashboard/stats?use_cache=true
```

**쿼리 파라미터:**
- `use_cache` (boolean, 선택): 캐시 사용 여부 (기본값: true)

**응답:**
```json
{
    "success": true,
    "message": "대시보드 통계 조회 완료",
    "data": {
        "total_scripts": 3,
        "all_executions": 12,
        "all_failed_scripts": 1,
        "inactive_scripts": 0
    }
}
```

## 캐시 무효화 전략

### 1. 시간 기반 무효화

- 캐시된 통계가 5분 이상 지난 경우 재계산
- 일일 통계는 자정에 자동 무효화

### 2. 이벤트 기반 무효화

- 스크립트 생성/삭제 시 → `total_scripts` 무효화
- 스크립트 실행 시 → `today_executions` 무효화
- 스크립트 실행 실패 시 → `today_failed_scripts` 무효화
- 스크립트 활성/비활성 토글 시 → `inactive_scripts` 무효화

### 3. 수동 갱신

- API 요청 시 `use_cache=false` 파라미터로 강제 재계산

## 성능 최적화

### 1. 인덱스 활용

- `scripts.active` 인덱스로 비활성 스크립트 개수 빠른 계산
- `script_executions.started_at` 인덱스로 오늘 실행 횟수 빠른 계산
- `script_executions.status` 인덱스로 실패한 스크립트 빠른 필터링

### 2. 배치 업데이트

- 여러 통계를 한 번에 업데이트하여 DB 쿼리 최소화
- `dashboard_stats_repo.update_all_stats()` 사용

### 3. 캐시 활용

- 자주 조회되는 통계를 메모리 캐시에 저장 (선택사항)
- Redis 등 외부 캐시 시스템 활용 가능 (향후 확장)

## 일일 자동 갱신

### 스케줄러 구현

```python
# server/services/scheduler_service.py

import schedule
import time
from datetime import datetime

def reset_daily_stats():
    """일일 통계 초기화 (자정 실행)"""
    db_manager = DatabaseManager()
    
    # 오늘 실행 횟수 초기화
    db_manager.dashboard_stats_repo.set_stat('today_executions', 0)
    
    # 오늘 실패한 스크립트 초기화
    db_manager.dashboard_stats_repo.set_stat('today_failed_scripts', 0)
    
    logger.info('[Scheduler] 일일 통계 초기화 완료')

# 매일 자정에 실행
schedule.every().day.at("00:00:00").do(reset_daily_stats)
```

## 마이그레이션

기존 코드와의 호환성을 위해 점진적으로 마이그레이션합니다:

1. **1단계**: `dashboard_stats` 테이블 생성 및 통계 저장 로직 추가
2. **2단계**: 이벤트 기반 업데이트 로직 추가
3. **3단계**: 캐시 우선 조회 로직 추가
4. **4단계**: 일일 자동 갱신 스케줄러 추가

## 구현 완료 사항

### ✅ 완료된 구현

1. **`database.py`**:
   - `get_dashboard_stats(use_cache=True)`: 캐시 우선 조회 로직
   - `_is_cache_valid()`: 캐시 유효성 검사 (5분 기준)
   - `update_stat(stat_key)`: 개별 통계 업데이트 메서드
   - `_get_today_executions_count()`: 오늘 실행 횟수 조회 (로컬 타임존 기준)
   - `_get_today_failed_scripts_count()`: 오늘 실패한 스크립트 개수 조회 (로컬 타임존 기준)
   - `calculate_and_update_dashboard_stats()`: 통계 계산 및 업데이트 (키 이름 통일: `today_failed_scripts`)

2. **`dashboard_router.py`**:
   - `get_dashboard_stats(use_cache=True)`: 캐시 우선 조회 API 엔드포인트

3. **`script_router.py`**:
   - 스크립트 생성 시: `total_scripts` 통계 업데이트
   - 스크립트 삭제 시: `total_scripts` 통계 업데이트
   - 스크립트 활성/비활성 토글 시: `inactive_scripts` 통계 업데이트

4. **`table_manager.py`**:
   - `dashboard_stats` 테이블에 `created_at` 컬럼 추가

5. **`dashboard.js`** (프론트엔드):
   - `today_failed_scripts` 키 이름 지원 (하위 호환성 유지)

### ⏳ 향후 구현 필요

1. **일일 자동 갱신 스케줄러**:
   - 매일 자정에 `today_executions`, `today_failed_scripts` 초기화
   - `server/services/scheduler_service.py` 생성 필요
   - 현재는 `all_executions`, `all_failed_scripts`만 사용하므로 우선순위 낮음

2. **일일 자동 갱신 스케줄러**:
   - 매일 자정에 `today_executions`, `today_failed_scripts` 초기화
   - `server/services/scheduler_service.py` 생성 필요

## 스크립트 편집 및 재로드

### 스크립트 편집 버튼
대시보드의 각 스크립트 카드에는 "편집" 버튼이 있습니다. 이 버튼을 클릭하면:
1. 스크립트 페이지(에디터)로 전환
2. 해당 스크립트가 자동으로 선택됨
3. 스크립트의 노드들이 로드되어 표시됨

### 스크립트 재로드 기능
현재 포커스된 스크립트를 대시보드에서 다시 클릭하면:
- 중복 로드 방지 로직을 우회하여 강제로 노드를 다시 로드
- `forceReload` 플래그를 통한 강제 재로드 지원
- 스크립트 변경 없이 최신 노드 상태 확인 가능
- 서버에서 최신 노드 데이터를 다시 가져와 화면에 표시

**사용 사례:**
- 다른 사용자나 프로세스가 스크립트를 수정한 경우
- 노드 상태가 동기화되지 않은 경우
- 최신 노드 데이터를 확인하고 싶은 경우

## 참고 파일

- `server/db/database.py`: 통계 계산 로직
- `server/db/dashboard_stats_repository.py`: 통계 저장/조회 리포지토리
- `server/api/dashboard_router.py`: 대시보드 API 엔드포인트
- `server/api/script_router.py`: 스크립트 생성/삭제/활성 토글 API
- `UI/src/pages/workflow/dashboard.js`: 프론트엔드 대시보드 관리
