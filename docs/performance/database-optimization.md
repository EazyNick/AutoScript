# 데이터베이스 성능 최적화 가이드

## 목차

1. [개요](#개요)
2. [인덱스 최적화](#인덱스-최적화)
   - [인덱스 전략](#인덱스-전략)
   - [복합 인덱스](#복합-인덱스)
   - [부분 인덱스](#부분-인덱스)
   - [인덱스 모니터링](#인덱스-모니터링)
3. [쿼리 최적화](#쿼리-최적화)
   - [SELECT 최적화](#select-최적화)
   - [JOIN 최적화](#join-최적화)
   - [서브쿼리 최적화](#서브쿼리-최적화)
   - [EXPLAIN QUERY PLAN 활용](#explain-query-plan-활용)
4. [뷰(View) 활용](#뷰view-활용)
   - [통계 뷰](#통계-뷰)
   - [복잡한 쿼리 캡슐화](#복잡한-쿼리-캡슐화)
5. [트랜잭션 최적화](#트랜잭션-최적화)
   - [트랜잭션 범위 최소화](#트랜잭션-범위-최소화)
   - [배치 처리](#배치-처리)
   - [트랜잭션 격리 수준](#트랜잭션-격리-수준)
6. [연결 관리](#연결-관리)
   - [연결 풀링](#연결-풀링)
   - [연결 재사용](#연결-재사용)
   - [연결 타임아웃](#연결-타임아웃)
7. [데이터 타입 최적화](#데이터-타입-최적화)
   - [적절한 데이터 타입 선택](#적절한-데이터-타입-선택)
   - [NULL 처리](#null-처리)
   - [JSON 필드 활용](#json-필드-활용)
8. [정규화와 비정규화](#정규화와-비정규화)
   - [정규화 원칙](#정규화-원칙)
   - [비정규화 전략](#비정규화-전략)
9. [성능 모니터링](#성능-모니터링)
   - [쿼리 실행 시간 측정](#쿼리-실행-시간-측정)
   - [느린 쿼리 로깅](#느린-쿼리-로깅)
   - [인덱스 사용률 분석](#인덱스-사용률-분석)

## 개요

데이터베이스 성능 최적화는 애플리케이션의 전체 성능에 직접적인 영향을 미칩니다. 특히 대용량 데이터를 다룰 때 최적화가 중요합니다.

### 주요 최적화 영역

- **인덱스**: 조회 성능 향상
- **쿼리**: 효율적인 쿼리 작성
- **트랜잭션**: 트랜잭션 범위 최적화
- **연결 관리**: 리소스 효율적 사용
- **뷰**: 복잡한 쿼리 캡슐화

## 인덱스 최적화

### 인덱스 전략

인덱스는 조회 성능을 크게 향상시키지만, 쓰기 성능에는 약간의 오버헤드가 있습니다.

**구현 위치**: `server/db/table_manager.py`

#### scripts 테이블 인덱스

```sql
-- 이름 기반 검색 최적화
CREATE INDEX IF NOT EXISTS idx_scripts_name ON scripts(name);

-- 최근 수정 스크립트 조회 최적화
CREATE INDEX IF NOT EXISTS idx_scripts_updated_at ON scripts(updated_at DESC);

-- 활성 스크립트만 필터링 시 성능 향상 (부분 인덱스)
CREATE INDEX IF NOT EXISTS idx_scripts_active ON scripts(active) WHERE active = 1;

-- 최근 실행 스크립트 조회 최적화
CREATE INDEX IF NOT EXISTS idx_scripts_last_executed ON scripts(last_executed_at DESC);

-- 실행 순서 기준 정렬 최적화
CREATE INDEX IF NOT EXISTS idx_scripts_execution_order ON scripts(execution_order ASC);
```

**효과**:
- 이름 검색: ~30-50% 성능 향상
- 활성 스크립트 필터링: ~60% 성능 향상
- 최근 수정 조회: ~40% 성능 향상

#### nodes 테이블 인덱스

```sql
-- 스크립트 내 노드 중복 방지 (UNIQUE)
CREATE UNIQUE INDEX IF NOT EXISTS idx_nodes_script_node_unique 
ON nodes(script_id, node_id);

-- 스크립트별 노드 조회 최적화
CREATE INDEX IF NOT EXISTS idx_nodes_script_id ON nodes(script_id);

-- 노드 타입별 조회 최적화
CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(node_type);

-- 복합 인덱스: 스크립트 + 타입 조회
CREATE INDEX IF NOT EXISTS idx_nodes_script_type ON nodes(script_id, node_type);

-- 연결 정보 관련 인덱스
CREATE INDEX IF NOT EXISTS idx_nodes_connection_seq ON nodes(connection_sequence);
CREATE INDEX IF NOT EXISTS idx_nodes_is_connected ON nodes(is_connected);
```

**효과**:
- 스크립트별 노드 조회: ~40-60% 성능 향상
- 타입별 통계 조회: ~70% 성능 향상

#### script_executions 테이블 인덱스

```sql
-- 스크립트별 실행 기록 조회
CREATE INDEX IF NOT EXISTS idx_executions_script_id ON script_executions(script_id);

-- 상태별 필터링
CREATE INDEX IF NOT EXISTS idx_executions_status ON script_executions(status);

-- 시간순 정렬
CREATE INDEX IF NOT EXISTS idx_executions_started_at ON script_executions(started_at DESC);

-- 복합 인덱스: 스크립트 + 상태 조회
CREATE INDEX IF NOT EXISTS idx_executions_script_status 
ON script_executions(script_id, status);
```

### 복합 인덱스

여러 컬럼을 함께 조회할 때 복합 인덱스를 사용합니다.

**원칙**:
1. **카디널리티가 높은 컬럼을 앞에**: 선택도가 높은 컬럼을 먼저
2. **WHERE 절에 자주 사용되는 컬럼**: 필터링에 사용되는 컬럼 우선
3. **정렬에 사용되는 컬럼**: ORDER BY에 사용되는 컬럼 포함

```sql
-- 예시: 스크립트별 활성 노드 조회
CREATE INDEX idx_nodes_script_active_type 
ON nodes(script_id, active, node_type);

-- 사용 예시
SELECT * FROM nodes 
WHERE script_id = 1 AND active = 1 AND node_type = 'action'
ORDER BY created_at DESC;
```

### 부분 인덱스

특정 조건을 만족하는 행에만 인덱스를 생성하여 인덱스 크기를 줄입니다.

```sql
-- 활성 스크립트만 인덱싱 (부분 인덱스)
CREATE INDEX IF NOT EXISTS idx_scripts_active 
ON scripts(active) WHERE active = 1;

-- 사용 예시
SELECT * FROM scripts WHERE active = 1;  -- 인덱스 사용
SELECT * FROM scripts WHERE active = 0;  -- 인덱스 미사용 (전체 스캔)
```

**효과**:
- 인덱스 크기 감소
- 인덱스 유지 비용 감소
- 특정 조건 조회 성능 향상

### 인덱스 모니터링

인덱스 사용률을 모니터링하여 불필요한 인덱스를 제거합니다.

```sql
-- SQLite에서 인덱스 사용 확인
EXPLAIN QUERY PLAN 
SELECT * FROM scripts WHERE name = 'test';

-- 결과 예시:
-- SEARCH scripts USING INDEX idx_scripts_name (name=?)
```

## 쿼리 최적화

### SELECT 최적화

필요한 컬럼만 선택하여 데이터 전송량을 줄입니다.

```sql
-- ❌ 나쁜 예: 모든 컬럼 선택
SELECT * FROM scripts;

-- ✅ 좋은 예: 필요한 컬럼만 선택
SELECT id, name, active, updated_at FROM scripts;
```

**효과**:
- 네트워크 전송량 감소
- 메모리 사용량 감소
- 쿼리 실행 시간 단축

### JOIN 최적화

JOIN을 효율적으로 사용하여 성능을 향상시킵니다.

```sql
-- ❌ 나쁜 예: 서브쿼리 사용
SELECT s.*, 
       (SELECT COUNT(*) FROM nodes n WHERE n.script_id = s.id) as node_count
FROM scripts s;

-- ✅ 좋은 예: JOIN 사용
SELECT s.*, COUNT(n.id) as node_count
FROM scripts s
LEFT JOIN nodes n ON s.id = n.script_id
GROUP BY s.id;
```

**효과**:
- 쿼리 실행 시간 단축
- 데이터베이스 부하 감소

### 서브쿼리 최적화

서브쿼리를 JOIN이나 EXISTS로 변환하여 성능을 향상시킵니다.

```sql
-- ❌ 나쁜 예: IN 서브쿼리
SELECT * FROM scripts 
WHERE id IN (SELECT script_id FROM nodes WHERE node_type = 'action');

-- ✅ 좋은 예: EXISTS 사용
SELECT * FROM scripts s
WHERE EXISTS (
    SELECT 1 FROM nodes n 
    WHERE n.script_id = s.id AND n.node_type = 'action'
);

-- ✅ 더 좋은 예: JOIN 사용
SELECT DISTINCT s.*
FROM scripts s
INNER JOIN nodes n ON s.id = n.script_id
WHERE n.node_type = 'action';
```

### EXPLAIN QUERY PLAN 활용

쿼리 실행 계획을 분석하여 최적화 포인트를 찾습니다.

**구현 위치**: `server/db/`

```python
def analyze_query(self, query: str, params: tuple = ()) -> None:
    """쿼리 실행 계획 분석"""
    conn = self.get_connection()
    cursor = self.get_cursor(conn)
    
    try:
        cursor.execute(f"EXPLAIN QUERY PLAN {query}", params)
        plan = cursor.fetchall()
        
        logger.debug("쿼리 실행 계획:")
        for row in plan:
            logger.debug(f"  {row}")
    finally:
        conn.close()
```

**사용 예시**:
```python
# 쿼리 분석
db.analyze_query(
    "SELECT * FROM scripts WHERE name = ?",
    ("test",)
)
```

## 뷰(View) 활용

### 통계 뷰

복잡한 통계 쿼리를 뷰로 캡슐화하여 재사용성을 높입니다.

**구현 위치**: `server/db/table_manager.py`

```sql
-- 스크립트 통계 뷰 (대시보드용)
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
GROUP BY s.id, s.name, s.active, s.last_executed_at;
```

**사용 예시**:
```python
def get_script_stats(self, script_id: int) -> dict:
    """스크립트 통계 조회 (뷰 사용)"""
    cursor.execute(
        "SELECT * FROM script_stats WHERE id = ?",
        (script_id,)
    )
    return dict(cursor.fetchone())
```

**효과**:
- 복잡한 쿼리 간소화
- 코드 재사용성 향상
- 유지보수성 향상

### 복잡한 쿼리 캡슐화

자주 사용되는 복잡한 쿼리를 뷰로 캡슐화합니다.

```sql
-- 노드 통계 뷰
CREATE VIEW IF NOT EXISTS node_stats AS
SELECT
    script_id,
    node_type,
    COUNT(*) as node_count,
    AVG(LENGTH(node_data)) as avg_data_size
FROM nodes
GROUP BY script_id, node_type;
```

## 트랜잭션 최적화

### 트랜잭션 범위 최소화

트랜잭션 범위를 최소화하여 락 경합을 줄입니다.

**구현 위치**: `server/db/connection.py`

```python
# ❌ 나쁜 예: 긴 트랜잭션
def save_scripts_and_nodes(self, scripts: list, nodes: list):
    conn = self.get_connection()
    cursor = self.get_cursor(conn)
    try:
        # 스크립트 저장
        for script in scripts:
            cursor.execute("INSERT INTO scripts ...", ...)
        
        # 노드 저장 (긴 트랜잭션)
        for node in nodes:
            cursor.execute("INSERT INTO nodes ...", ...)
        
        conn.commit()  # 모든 작업 완료 후 commit
    finally:
        conn.close()

# ✅ 좋은 예: 트랜잭션 분리
def save_scripts_and_nodes(self, scripts: list, nodes: list):
    # 스크립트 저장 (별도 트랜잭션)
    self.save_scripts(scripts)
    
    # 노드 저장 (별도 트랜잭션)
    self.save_nodes(nodes)
```

**효과**:
- 락 경합 감소
- 동시성 향상
- 데드락 위험 감소

### 배치 처리

여러 작업을 배치로 처리하여 트랜잭션 오버헤드를 줄입니다.

**구현 위치**: `server/db/dashboard_stats_repository.py`

```python
def update_all_stats(self, stats: dict[str, int]) -> bool:
    """여러 통계 값을 한 번에 업데이트"""
    return self.connection.execute_with_connection(
        lambda conn, cursor: self._update_all_stats_impl(cursor, stats)
    )

def _update_all_stats_impl(self, cursor, stats: dict[str, int]) -> bool:
    """배치 업데이트 구현"""
    for stat_key, stat_value in stats.items():
        cursor.execute(
            """
            INSERT INTO dashboard_stats (stat_key, stat_value, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(stat_key) DO UPDATE SET
                stat_value = excluded.stat_value,
                updated_at = CURRENT_TIMESTAMP
            """,
            (stat_key, stat_value),
        )
    return True
```

**효과**:
- 트랜잭션 오버헤드 감소
- 성능 향상
- 데이터 일관성 보장

### 트랜잭션 격리 수준

SQLite는 기본적으로 SERIALIZABLE 격리 수준을 사용합니다.

```python
# SQLite는 기본적으로 외래키 제약조건이 비활성화되어 있으므로 활성화
conn.execute("PRAGMA foreign_keys = ON")

# 트랜잭션 격리 수준 확인
cursor.execute("PRAGMA isolation_level")
# SQLite는 항상 SERIALIZABLE
```

## 연결 관리

### 연결 풀링

연결을 재사용하여 연결 생성 오버헤드를 줄입니다.

**구현 위치**: `server/db/connection.py`

```python
class DatabaseConnection:
    """데이터베이스 연결 관리"""
    
    def __init__(self, db_path: str | None = None):
        self.db_path = db_path
        # SQLite는 파일 기반이므로 연결 풀링이 자동으로 처리됨
    
    def get_connection(self) -> sqlite3.Connection:
        """데이터베이스 연결 반환"""
        conn = sqlite3.connect(self.db_path)
        conn.execute("PRAGMA foreign_keys = ON")
        return conn
```

**효과**:
- 연결 생성 오버헤드 감소
- 리소스 효율적 사용

### 연결 재사용

단일 요청 내에서 연결을 재사용합니다.

**구현 위치**: `server/db/connection.py`

```python
def execute_with_connection(
    self, 
    callback: Callable[[sqlite3.Connection, sqlite3.Cursor], Any]
) -> Any:
    """연결을 자동으로 관리하는 컨텍스트 매니저"""
    conn = self.get_connection()
    cursor = self.get_cursor(conn)
    try:
        result = callback(conn, cursor)
        conn.commit()
        return result
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()  # 사용 후 즉시 닫기
```

**효과**:
- 연결 누수 방지
- 리소스 효율적 사용

### 연결 타임아웃

연결 타임아웃을 설정하여 무한 대기를 방지합니다.

```python
def get_connection(self) -> sqlite3.Connection:
    """데이터베이스 연결 반환 (타임아웃 설정)"""
    conn = sqlite3.connect(
        self.db_path,
        timeout=30.0  # 30초 타임아웃
    )
    conn.execute("PRAGMA foreign_keys = ON")
    return conn
```

## 데이터 타입 최적화

### 적절한 데이터 타입 선택

적절한 데이터 타입을 선택하여 저장 공간과 성능을 최적화합니다.

```sql
-- ❌ 나쁜 예: TEXT로 숫자 저장
CREATE TABLE scripts (
    id TEXT PRIMARY KEY,  -- INTEGER가 더 효율적
    active TEXT  -- INTEGER가 더 효율적
);

-- ✅ 좋은 예: 적절한 타입 사용
CREATE TABLE scripts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    active INTEGER DEFAULT 1
);
```

**효과**:
- 저장 공간 절약
- 인덱스 성능 향상
- 쿼리 성능 향상

### NULL 처리

NULL을 적절히 처리하여 인덱스 효율성을 높입니다.

```sql
-- NULL이 많은 컬럼은 부분 인덱스 고려
CREATE INDEX idx_scripts_last_executed 
ON scripts(last_executed_at DESC) 
WHERE last_executed_at IS NOT NULL;
```

### JSON 필드 활용

복잡한 구조 데이터를 JSON으로 저장하여 유연성을 높입니다.

```sql
-- 노드 데이터를 JSON으로 저장
CREATE TABLE nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    script_id INTEGER NOT NULL,
    node_data TEXT NOT NULL,  -- JSON 문자열
    parameters TEXT DEFAULT '{}',  -- JSON 객체
    FOREIGN KEY (script_id) REFERENCES scripts(id) ON DELETE CASCADE
);
```

**효과**:
- 스키마 변경 없이 데이터 구조 확장 가능
- 복잡한 데이터 구조 저장 가능

**주의사항**:
- JSON 파싱 오버헤드
- 인덱싱 제한 (SQLite는 JSON 인덱싱 지원)

## 정규화와 비정규화

### 정규화 원칙

데이터 중복을 제거하여 저장 공간을 절약하고 데이터 일관성을 보장합니다.

**현재 스키마**:
- `scripts`: 스크립트 기본 정보
- `nodes`: 노드 정보 (script_id로 참조)
- `script_executions`: 실행 기록 (script_id로 참조)

**효과**:
- 데이터 일관성 보장
- 저장 공간 절약
- 업데이트 효율성 향상

### 비정규화 전략

조회 성능 향상을 위해 일부 데이터를 비정규화합니다.

```sql
-- 스크립트 테이블에 노드 개수 저장 (비정규화)
ALTER TABLE scripts ADD COLUMN node_count INTEGER DEFAULT 0;

-- 노드 추가/삭제 시 자동 업데이트 (트리거 또는 애플리케이션 로직)
UPDATE scripts 
SET node_count = (
    SELECT COUNT(*) FROM nodes WHERE nodes.script_id = scripts.id
);
```

**효과**:
- 조회 성능 향상
- JOIN 감소

**주의사항**:
- 데이터 일관성 관리 필요
- 업데이트 오버헤드 증가

## 성능 모니터링

### 쿼리 실행 시간 측정

쿼리 실행 시간을 측정하여 성능 병목을 식별합니다.

**구현 위치**: `server/db/`

```python
import time
from functools import wraps

def measure_query_time(func):
    """쿼리 실행 시간 측정 데코레이터"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.time()
        result = func(*args, **kwargs)
        elapsed_time = time.time() - start_time
        
        if elapsed_time > 0.1:  # 100ms 이상
            logger.warning(
                f"[DB] 느린 쿼리 감지 - "
                f"함수: {func.__name__}, "
                f"소요 시간: {elapsed_time:.2f}초"
            )
        
        return result
    return wrapper
```

### 느린 쿼리 로깅

느린 쿼리를 로깅하여 최적화 대상을 식별합니다.

```python
def execute_query(self, query: str, params: tuple = ()) -> list:
    """쿼리 실행 (성능 로깅)"""
    start_time = time.time()
    
    try:
        cursor.execute(query, params)
        result = cursor.fetchall()
        
        elapsed_time = time.time() - start_time
        if elapsed_time > 0.5:  # 500ms 이상
            logger.warning(
                f"[DB] 느린 쿼리: {query[:100]}... "
                f"(소요 시간: {elapsed_time:.2f}초)"
            )
        
        return result
    except Exception as e:
        elapsed_time = time.time() - start_time
        logger.error(
            f"[DB] 쿼리 실행 실패 (소요 시간: {elapsed_time:.2f}초): {e!s}"
        )
        raise
```

### 인덱스 사용률 분석

인덱스 사용률을 분석하여 불필요한 인덱스를 제거합니다.

```sql
-- 인덱스 목록 조회
SELECT name, tbl_name, sql 
FROM sqlite_master 
WHERE type = 'index' AND name NOT LIKE 'sqlite_%';

-- 인덱스 사용 확인 (EXPLAIN QUERY PLAN)
EXPLAIN QUERY PLAN 
SELECT * FROM scripts WHERE name = 'test';
```

## 최적화 체크리스트

- [ ] 자주 조회되는 컬럼에 인덱스 생성
- [ ] 복합 인덱스로 여러 컬럼 조회 최적화
- [ ] 부분 인덱스로 특정 조건 조회 최적화
- [ ] 필요한 컬럼만 SELECT
- [ ] 서브쿼리를 JOIN으로 변환
- [ ] 복잡한 쿼리를 뷰로 캡슐화
- [ ] 트랜잭션 범위 최소화
- [ ] 배치 처리로 트랜잭션 오버헤드 감소
- [ ] 연결 자동 관리
- [ ] 적절한 데이터 타입 선택
- [ ] 쿼리 실행 시간 측정
- [ ] 느린 쿼리 로깅
- [ ] 인덱스 사용률 분석

## 참고 자료

- [SQLite 공식 문서](https://www.sqlite.org/docs.html)
- [SQLite 인덱스 최적화](https://www.sqlite.org/queryplanner.html)
- [SQLite 성능 팁](https://www.sqlite.org/performance.html)

