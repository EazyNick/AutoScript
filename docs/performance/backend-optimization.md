# 백엔드 성능 최적화 가이드

## 목차

1. [개요](#개요)
2. [API 응답 최적화](#api-응답-최적화)
   - [표준화된 응답 형식](#표준화된-응답-형식)
   - [응답 헬퍼 함수](#응답-헬퍼-함수)
   - [Pydantic 모델 활용](#pydantic-모델-활용)
3. [에러 처리 최적화](#에러-처리-최적화)
   - [공통 에러 핸들러](#공통-에러-핸들러)
   - [에러 로깅 최적화](#에러-로깅-최적화)
   - [HTTPException 활용](#httpexception-활용)
4. [비동기 처리](#비동기-처리)
   - [async/await 패턴](#asyncawait-패턴)
   - [동시성 제어](#동시성-제어)
   - [비동기 I/O 최적화](#비동기-io-최적화)
5. [데이터베이스 접근 최적화](#데이터베이스-접근-최적화)
   - [연결 관리](#연결-관리)
   - [트랜잭션 최적화](#트랜잭션-최적화)
   - [배치 처리](#배치-처리)
6. [로깅 최적화](#로깅-최적화)
   - [구조화된 로깅](#구조화된-로깅)
   - [로그 레벨 관리](#로그-레벨-관리)
   - [성능 로깅](#성능-로깅)
7. [서비스 레이어 최적화](#서비스-레이어-최적화)
   - [리포지토리 패턴](#리포지토리-패턴)
   - [의존성 주입](#의존성-주입)
   - [캐싱 전략](#캐싱-전략)
8. [FastAPI 최적화](#fastapi-최적화)
   - [의존성 주입 활용](#의존성-주입-활용)
   - [응답 모델 최적화](#응답-모델-최적화)
   - [미들웨어 최적화](#미들웨어-최적화)

## 개요

백엔드 성능 최적화는 API 응답 시간, 처리량, 리소스 사용량을 개선하여 전체 시스템 성능을 향상시킵니다.

### 주요 최적화 영역

- **API 응답**: 표준화된 응답 형식, Pydantic 모델 활용
- **에러 처리**: 공통 에러 핸들러, 구조화된 에러 응답
- **비동기 처리**: async/await 패턴, 동시성 제어
- **데이터베이스**: 연결 관리, 트랜잭션 최적화
- **로깅**: 구조화된 로깅, 로그 레벨 관리

## API 응답 최적화

### 표준화된 응답 형식

모든 API 엔드포인트에서 일관된 응답 형식을 사용하여 클라이언트 처리 효율성을 높입니다.

**구현 위치**: `server/models/response_models.py`

```python
from pydantic import BaseModel
from typing import Any, Literal

class BaseResponse(BaseModel):
    """기본 응답 모델 - 모든 응답의 공통 필드"""
    success: bool
    message: str | None = None

class SuccessResponse(BaseResponse):
    """성공 응답 모델"""
    success: Literal[True] = True
    data: dict[str, Any] | None = None

class ErrorResponse(BaseResponse):
    """에러 응답 모델"""
    success: Literal[False] = False
    error: str | None = None
    error_code: str | None = None

class ListResponse(BaseResponse):
    """리스트 응답 모델"""
    success: bool = True
    data: list[Any]
    count: int | None = None
```

**효과**:
- 클라이언트에서 일관된 응답 처리
- 타입 안정성 향상
- API 문서 자동 생성 (FastAPI)

### 응답 헬퍼 함수

공통 응답 생성 로직을 헬퍼 함수로 분리하여 코드 중복을 제거합니다.

**구현 위치**: `server/api/response_helpers.py`

```python
from models.response_models import SuccessResponse, ErrorResponse, ListResponse

def success_response(
    data: Any = None,
    message: str | None = None,
    **kwargs: Any,
) -> SuccessResponse:
    """성공 응답 생성"""
    response_data = data if isinstance(data, dict) else ({"value": data} if data is not None else None)
    if kwargs:
        response_data = response_data or {}
        response_data.update(kwargs)
    return SuccessResponse(success=True, message=message, data=response_data)

def error_response(
    message: str,
    error: str | None = None,
    error_code: str | None = None,
) -> ErrorResponse:
    """에러 응답 생성"""
    return ErrorResponse(
        success=False,
        message=message,
        error=error or message,
        error_code=error_code,
    )

def list_response(
    items: list[Any],
    message: str | None = None,
    **kwargs: Any,
) -> ListResponse:
    """리스트 응답 생성"""
    return ListResponse(
        success=True,
        message=message,
        data=items,
        count=len(items),
        **kwargs,
    )
```

**사용 예시**:
```python
@router.get("/scripts", response_model=ListResponse)
async def get_all_scripts() -> ListResponse:
    scripts = db_manager.get_all_scripts()
    return list_response(scripts, "스크립트 목록 조회 완료")
```

**효과**:
- 코드 중복 제거
- 일관된 응답 형식 보장
- 유지보수성 향상

### Pydantic 모델 활용

Pydantic 모델을 사용하여 요청/응답 검증과 직렬화를 최적화합니다.

**구현 위치**: `server/models/`

```python
from pydantic import BaseModel, Field

class ScriptCreateRequest(BaseModel):
    """스크립트 생성 요청 모델"""
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = Field(None, max_length=500)

class ScriptResponse(BaseModel):
    """스크립트 응답 모델"""
    id: int
    name: str
    description: str | None
    nodes: list[dict[str, Any]]
    connections: dict[str, list[dict[str, Any]]]
```

**효과**:
- 자동 요청 검증
- 타입 안정성
- API 문서 자동 생성

## 에러 처리 최적화

### 공통 에러 핸들러

모든 API 엔드포인트에서 공통 에러 처리를 수행하는 데코레이터를 사용합니다.

**구현 위치**: `server/api/router_wrapper.py`

```python
from functools import wraps
from typing import ParamSpec, TypeVar
from collections.abc import Awaitable, Callable
from fastapi import HTTPException

P = ParamSpec("P")
R = TypeVar("R")

def api_handler(func: Callable[P, Awaitable[R]]) -> Callable[P, Awaitable[R]]:
    """API 엔드포인트 핸들러 래퍼 데코레이터"""
    
    @wraps(func)
    async def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        try:
            return await func(*args, **kwargs)
        except HTTPException:
            # HTTPException은 그대로 재발생
            raise
        except Exception as e:
            # 일반 예외는 로깅 후 HTTPException으로 변환
            logger.error(f"API 엔드포인트 오류 ({func.__name__}): {e}")
            logger.error(f"스택 트레이스: {traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=f"서버 내부 오류: {e!s}")
    
    return wrapper
```

**사용 예시**:
```python
@router.post("/folder/select", response_model=BaseResponse)
@api_handler
async def select_folder() -> StandardResponseType:
    # 엔드포인트 로직
    return success_response({"folder_path": folder_path})
```

**효과**:
- 일관된 에러 처리
- 에러 로깅 자동화
- 코드 중복 제거

### 에러 로깅 최적화

에러 발생 시 상세한 정보를 로깅하여 디버깅을 용이하게 합니다.

```python
try:
    result = await process_action()
except Exception as e:
    logger.error(
        f"[API] 액션 처리 실패 - 액션 타입: {action_type}, "
        f"파라미터: {parameters}, 에러: {e!s}"
    )
    logger.error(f"스택 트레이스: {traceback.format_exc()}")
    raise
```

**효과**:
- 빠른 문제 진단
- 에러 추적 용이
- 운영 모니터링 개선

### HTTPException 활용

비즈니스 로직 에러와 시스템 에러를 구분하여 처리합니다.

```python
# 비즈니스 로직 에러 (클라이언트가 수정 가능)
if not script:
    return error_response(
        "스크립트를 찾을 수 없습니다.",
        error_code="SCRIPT_NOT_FOUND"
    )

# 시스템 에러 (HTTPException 사용)
if not db_connection:
    raise HTTPException(
        status_code=500,
        detail="데이터베이스 연결 실패"
    )
```

## 비동기 처리

### async/await 패턴

I/O 작업을 비동기로 처리하여 동시성을 향상시킵니다.

**구현 위치**: `server/api/script_router.py`

```python
@router.get("/scripts", response_model=ListResponse)
async def get_all_scripts() -> ListResponse:
    """모든 스크립트 목록 조회"""
    # 비동기로 데이터베이스 조회
    scripts = db_manager.get_all_scripts()
    return list_response(scripts, "스크립트 목록 조회 완료")
```

**효과**:
- 동시 요청 처리 능력 향상
- 리소스 효율적 사용
- 응답 시간 개선

### 동시성 제어

여러 작업을 동시에 처리할 때 동시성을 제어합니다.

```python
import asyncio

async def execute_nodes_parallel(nodes: list[dict]) -> list[dict]:
    """노드를 병렬로 실행"""
    tasks = [process_node(node) for node in nodes]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # 에러 처리
    processed_results = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            processed_results.append({
                "node_id": nodes[i]["id"],
                "status": "failed",
                "error": str(result)
            })
        else:
            processed_results.append(result)
    
    return processed_results
```

### 비동기 I/O 최적화

데이터베이스 쿼리와 외부 API 호출을 비동기로 처리합니다.

```python
async def get_script_with_nodes(script_id: int) -> dict:
    """스크립트와 노드 정보를 비동기로 조회"""
    # 병렬로 조회 가능한 경우
    script_task = asyncio.create_task(get_script(script_id))
    nodes_task = asyncio.create_task(get_nodes(script_id))
    
    script, nodes = await asyncio.gather(script_task, nodes_task)
    
    return {
        **script,
        "nodes": nodes
    }
```

## 데이터베이스 접근 최적화

### 연결 관리

데이터베이스 연결을 효율적으로 관리하여 리소스를 절약합니다.

**구현 위치**: `server/db/connection.py`

```python
class DatabaseConnection:
    """데이터베이스 연결 관리"""
    
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
            conn.close()
```

**사용 예시**:
```python
def create_script(self, name: str, description: str) -> int:
    """스크립트 생성"""
    return self.connection.execute_with_connection(
        lambda conn, cursor: self._create_script_impl(cursor, name, description)
    )
```

**효과**:
- 연결 누수 방지
- 트랜잭션 자동 관리
- 에러 처리 자동화

### 트랜잭션 최적화

트랜잭션 범위를 최적화하여 성능을 향상시킵니다.

```python
# ❌ 나쁜 예: 여러 개의 작은 트랜잭션
for node in nodes:
    db.execute("INSERT INTO nodes ...")  # 각각 트랜잭션

# ✅ 좋은 예: 하나의 큰 트랜잭션
def save_nodes_batch(self, nodes: list[dict]) -> None:
    self.connection.execute_with_connection(
        lambda conn, cursor: self._save_nodes_impl(cursor, nodes)
    )

def _save_nodes_impl(self, cursor, nodes: list[dict]) -> None:
    for node in nodes:
        cursor.execute("INSERT INTO nodes ...", (node["id"], ...))
    # 한 번에 commit
```

**효과**:
- 트랜잭션 오버헤드 감소
- 데이터 일관성 보장
- 성능 향상

### 배치 처리

여러 작업을 배치로 처리하여 데이터베이스 호출을 최소화합니다.

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

## 로깅 최적화

### 구조화된 로깅

구조화된 로깅을 사용하여 로그 분석을 용이하게 합니다.

**구현 위치**: `server/log/log_manager.py`

```python
logger.info(
    f"[API] 스크립트 목록 조회 요청 받음 - "
    f"클라이언트 IP: {client_ip}"
)

logger.info(
    f"[DB 조회] 스크립트 목록 조회 완료 - "
    f"스크립트 개수: {len(scripts)}개"
)

logger.debug(
    f"[DB 조회] 스크립트 목록 상세: "
    f"{[{'id': s.get('id'), 'name': s.get('name')} for s in scripts]}"
)
```

**효과**:
- 로그 분석 용이
- 디버깅 시간 단축
- 모니터링 개선

### 로그 레벨 관리

환경에 따라 로그 레벨을 조정하여 성능을 최적화합니다.

**구현 위치**: `server/config/server_config.py`

```python
class Settings:
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "prd").lower()
    DEV_MODE: bool = ENVIRONMENT == "dev"
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
```

**효과**:
- 프로덕션에서 불필요한 로그 제거
- 성능 향상
- 로그 저장 공간 절약

### 성능 로깅

성능 병목을 식별하기 위해 중요한 작업의 실행 시간을 로깅합니다.

```python
import time

async def get_all_scripts() -> ListResponse:
    start_time = time.time()
    
    try:
        scripts = db_manager.get_all_scripts()
        
        elapsed_time = time.time() - start_time
        logger.info(f"[API] 스크립트 목록 조회 완료 - 소요 시간: {elapsed_time:.2f}초")
        
        return list_response(scripts, "스크립트 목록 조회 완료")
    except Exception as e:
        elapsed_time = time.time() - start_time
        logger.error(f"[API] 스크립트 목록 조회 실패 (소요 시간: {elapsed_time:.2f}초): {e!s}")
        raise
```

## 코드 모듈화 및 상수화 (2026-01-05 추가)

### 헬퍼 함수 분리

공통 로직을 헬퍼 함수로 분리하여 코드 중복을 제거합니다.

**구현 위치**: `server/api/helpers/`

```python
# script_helpers.py
def get_script_or_raise(script_id: int) -> dict:
    """스크립트를 조회하고, 없으면 404 예외를 발생시킵니다."""
    script = db_manager.get_script(script_id)
    if not script:
        raise HTTPException(
            status_code=API_CONSTANTS.HTTP_NOT_FOUND,
            detail=API_CONSTANTS.ERROR_SCRIPT_NOT_FOUND
        )
    return script
```

**효과**:
- 코드 중복 제거
- 유지보수성 향상
- 일관된 에러 처리

### 상수 정의

하드코딩된 값들을 상수로 정의하여 유지보수성을 향상시킵니다.

**구현 위치**: `server/api/helpers/constants.py`, `server/db/constants.py`

```python
class API_CONSTANTS:
    HTTP_NOT_FOUND = 404
    HTTP_INTERNAL_SERVER_ERROR = 500
    DEFAULT_LOG_LIMIT = 100
    MAX_LOG_LIMIT = 1000
    ERROR_SCRIPT_NOT_FOUND = "스크립트를 찾을 수 없습니다."
    # ...
```

**효과**:
- 수치 변경 시 상수 파일만 수정하면 됨
- 코드 일관성 향상
- 에러 메시지 통일

## 서비스 레이어 최적화

### 리포지토리 패턴

데이터 접근 로직을 리포지토리로 분리하여 유지보수성을 향상시킵니다.

**구현 위치**: `server/db/`

```python
class ScriptRepository:
    """스크립트 데이터 접근 리포지토리"""
    
    def __init__(self, connection: DatabaseConnection):
        self.connection = connection
    
    def get_all_scripts(self) -> list[dict[str, Any]]:
        """모든 스크립트 조회"""
        return self.connection.execute_with_connection(
            lambda conn, cursor: self._get_all_scripts_impl(cursor)
        )
    
    def _get_all_scripts_impl(self, cursor) -> list[dict[str, Any]]:
        """스크립트 조회 구현"""
        cursor.execute("SELECT * FROM scripts ORDER BY updated_at DESC")
        # ...
```

**효과**:
- 데이터 접근 로직 분리
- 테스트 용이성 향상
- 코드 재사용성 향상

### 의존성 주입

의존성을 주입하여 결합도를 낮추고 테스트를 용이하게 합니다.

```python
class DatabaseManager:
    """통합 데이터베이스 관리자"""
    
    def __init__(self, db_path: str | None = None):
        self.connection = DatabaseConnection(db_path)
        self.scripts = ScriptRepository(self.connection)
        self.nodes = NodeRepository(self.connection)
        # ...
```

**효과**:
- 결합도 감소
- 테스트 용이성 향상
- 유연한 구조

### 캐싱 전략

자주 조회되는 데이터를 캐싱하여 데이터베이스 부하를 줄입니다.

```python
from functools import lru_cache
from typing import Any

class ConfigService:
    """설정 서비스 (캐싱 적용)"""
    
    @lru_cache(maxsize=128)
    def get_node_config(self, node_type: str) -> dict[str, Any] | None:
        """노드 설정 조회 (캐싱)"""
        return NODES_CONFIG.get(node_type)
```

**효과**:
- 데이터베이스 부하 감소
- 응답 시간 단축
- 리소스 효율적 사용

## FastAPI 최적화

### 의존성 주입 활용

FastAPI의 의존성 주입을 활용하여 코드를 간결하게 만듭니다.

```python
from fastapi import Depends

def get_db_manager() -> DatabaseManager:
    """데이터베이스 관리자 의존성"""
    return db_manager

@router.get("/scripts", response_model=ListResponse)
async def get_all_scripts(
    db: DatabaseManager = Depends(get_db_manager)
) -> ListResponse:
    scripts = db.get_all_scripts()
    return list_response(scripts)
```

**효과**:
- 코드 간결성
- 테스트 용이성
- 의존성 관리 개선

### 응답 모델 최적화

Pydantic 모델을 활용하여 응답 검증과 직렬화를 최적화합니다.

```python
@router.get("/scripts/{script_id}", response_model=ScriptResponse)
async def get_script(script_id: int) -> ScriptResponse:
    """특정 스크립트 조회"""
    script = db_manager.get_script(script_id)
    if not script:
        raise HTTPException(status_code=404, detail="스크립트를 찾을 수 없습니다.")
    return ScriptResponse(**script)
```

**효과**:
- 자동 응답 검증
- 타입 안정성
- API 문서 자동 생성

### 미들웨어 최적화

미들웨어를 최적화하여 요청 처리 성능을 향상시킵니다.

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# CORS 미들웨어 최적화
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 프로덕션에서는 특정 도메인만 허용
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## 성능 측정

### 프로파일링

성능 병목을 식별하기 위해 프로파일링을 수행합니다.

```python
import cProfile
import pstats

def profile_endpoint(func):
    """엔드포인트 프로파일링 데코레이터"""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        profiler = cProfile.Profile()
        profiler.enable()
        result = await func(*args, **kwargs)
        profiler.disable()
        
        stats = pstats.Stats(profiler)
        stats.sort_stats('cumulative')
        stats.print_stats(10)  # 상위 10개 함수 출력
        
        return result
    return wrapper
```

### 모니터링

성능 지표를 모니터링하여 문제를 조기에 발견합니다.

```python
import time
from functools import wraps

def monitor_performance(func):
    """성능 모니터링 데코레이터"""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        start_time = time.time()
        try:
            result = await func(*args, **kwargs)
            elapsed_time = time.time() - start_time
            
            # 느린 요청 로깅
            if elapsed_time > 1.0:  # 1초 이상
                logger.warning(
                    f"[PERF] 느린 요청 감지 - "
                    f"함수: {func.__name__}, "
                    f"소요 시간: {elapsed_time:.2f}초"
                )
            
            return result
        except Exception as e:
            elapsed_time = time.time() - start_time
            logger.error(
                f"[PERF] 요청 실패 - "
                f"함수: {func.__name__}, "
                f"소요 시간: {elapsed_time:.2f}초, "
                f"에러: {e!s}"
            )
            raise
    return wrapper
```

## 최적화 체크리스트

- [ ] 표준화된 API 응답 형식 사용
- [ ] 응답 헬퍼 함수 활용
- [ ] Pydantic 모델로 요청/응답 검증
- [ ] 공통 에러 핸들러 데코레이터 사용
- [ ] async/await 패턴 적용
- [ ] 데이터베이스 연결 자동 관리
- [ ] 트랜잭션 범위 최적화
- [ ] 배치 처리 구현
- [ ] 구조화된 로깅
- [ ] 로그 레벨 환경별 관리
- [ ] 리포지토리 패턴 적용
- [ ] 의존성 주입 활용
- [ ] 성능 모니터링 구현

## 참고 자료

- [FastAPI 공식 문서](https://fastapi.tiangolo.com/)
- [Pydantic 공식 문서](https://docs.pydantic.dev/)
- [Python asyncio 공식 문서](https://docs.python.org/3/library/asyncio.html)

