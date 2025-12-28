# 노드 시스템 아키텍처

이 문서는 AutoScript의 노드 시스템의 전체 아키텍처 구조와 실행 흐름을 설명합니다.

## 목차

1. [시스템 개요](#시스템-개요)
2. [아키텍처 다이어그램](#아키텍처-다이어그램)
3. [핵심 컴포넌트](#핵심-컴포넌트)
4. [노드 실행 흐름](#노드-실행-흐름)
5. [노드 등록 메커니즘](#노드-등록-메커니즘)
6. [데이터 흐름](#데이터-흐름)

## 시스템 개요

노드 시스템은 워크플로우 실행의 핵심입니다. 각 노드는 독립적인 작업 단위이며, 노드들을 연결하여 복잡한 자동화 스크립트를 구성할 수 있습니다.

### 주요 설계 원칙

1. **단일 책임 원칙**: 각 노드는 하나의 명확한 작업만 수행합니다.
2. **표준화된 인터페이스**: 모든 노드는 동일한 인터페이스를 따릅니다.
3. **자동 등록**: 노드는 자동으로 시스템에 등록되어 사용 가능합니다.
4. **에러 격리**: 노드 실행 중 발생한 에러는 해당 노드에만 영향을 미칩니다.
5. **컨텍스트 공유**: 노드 간 데이터는 `NodeExecutionContext`를 통해 공유됩니다.

## 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────────────┐
│                        클라이언트 (UI)                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ 워크플로우    │  │ 노드 설정     │  │ 실행 모니터링 │         │
│  │ 편집기        │  │ 모달          │  │              │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
└─────────┼──────────────────┼──────────────────┼─────────────────┘
          │                  │                  │
          │ HTTP Request     │                  │
          │ (POST /api/      │                  │
          │  execute-nodes)  │                  │
          │                  │                  │
          └──────────────────┴──────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FastAPI 서버 (Backend)                         │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              action_router.py                            │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │  @router.post("/execute-nodes")                    │  │   │
│  │  │  async def execute_nodes(request)                  │  │   │
│  │  │    - 요청 검증                                      │  │   │
│  │  │    - 노드 순차 실행                                 │  │   │
│  │  │    - 결과 수집 및 반환                              │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  └───────────────────────┬──────────────────────────────────┘   │
│                          │                                       │
│                          ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              ActionService                                │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │  process_node(node, context)                       │  │   │
│  │  │    - 노드 타입 확인                                 │  │   │
│  │  │    - 핸들러 찾기 (node_handlers)                   │  │   │
│  │  │    - 핸들러 실행                                    │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  │                                                          │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │  node_handlers: dict[str, Callable]                │  │   │
│  │  │    "start" → StartNode.execute                     │  │   │
│  │  │    "click" → ClickNode.execute                     │  │   │
│  │  │    "wait" → WaitNode.execute                       │  │   │
│  │  │    "condition" → ConditionNode.execute             │  │   │
│  │  │    "repeat" → RepeatNode.execute                   │  │   │
│  │  │    "image-touch" → ImageTouchNode.execute          │  │   │
│  │  │    "excel-open" → ExcelOpenNode.execute            │  │   │
│  │  │    ...                                             │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  └───────────────────────┬──────────────────────────────────┘   │
│                          │                                       │
│                          ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              NodeExecutor (데코레이터)                     │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │  wrapper(parameters)                               │  │   │
│  │  │    - 파라미터 검증 및 정규화                         │  │   │
│  │  │    - 실행 시작 로그 전송                            │  │   │
│  │  │    - 노드 execute() 실행                            │  │   │
│  │  │    - 결과 정규화                                    │  │   │
│  │  │    - 실행 완료 로그 전송                            │  │   │
│  │  │    - 에러 처리 (예외 발생 시)                        │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  └───────────────────────┬──────────────────────────────────┘   │
│                          │                                       │
│                          ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              노드 구현 (BaseNode 상속)                    │   │
│  │                                                          │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │   │
│  │  │ StartNode    │  │ ClickNode    │  │ WaitNode     │ │   │
│  │  │              │  │              │  │              │ │   │
│  │  │ @NodeExecutor│  │ @NodeExecutor│  │ @NodeExecutor│ │   │
│  │  │ ("start")    │  │ ("click")    │  │ ("wait")     │ │   │
│  │  │              │  │              │  │              │ │   │
│  │  │ async def    │  │ async def    │  │ async def    │ │   │
│  │  │ execute()    │  │ execute()    │  │ execute()    │ │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘ │   │
│  │                                                          │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │   │
│  │  │ ConditionNode│  │ RepeatNode   │  │ ImageTouch   │ │   │
│  │  │              │  │              │  │ Node         │ │   │
│  │  │ ...          │  │ ...          │  │ ...          │ │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘ │   │
│  └──────────────────────────────────────────────────────────┘   │
│                          │                                       │
│                          ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              NodeExecutionContext                         │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │  node_results: dict[str, dict]                    │  │   │
│  │  │    - 노드별 실행 결과 저장                         │  │   │
│  │  │                                                      │  │   │
│  │  │  node_name_map: dict[str, str]                    │  │   │
│  │  │    - 노드 이름 → 노드 ID 매핑                       │  │   │
│  │  │                                                      │  │   │
│  │  │  execution_order: list[str]                       │  │   │
│  │  │    - 노드 실행 순서                                │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    외부 시스템/라이브러리                          │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ ScreenCapture│  │ InputHandler │  │ Excel Manager│         │
│  │ (화면 캡처)   │  │ (입력 제어)   │  │ (엑셀 제어)   │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐                            │
│  │ HTTP Client  │  │ Win32 API    │                            │
│  │ (aiohttp)    │  │ (win32com)   │                            │
│  └──────────────┘  └──────────────┘                            │
└───────────────────────────────────────────────────────────────────┘
```

## 핵심 컴포넌트

### 1. BaseNode (기본 노드 클래스)

모든 노드의 기본 클래스입니다. 추상 클래스로 구현되어 모든 노드가 `execute` 메서드를 구현하도록 강제합니다.

**위치**: `server/nodes/base_node.py`

**주요 메서드**:
- `execute(parameters)`: 노드 실행 메서드 (추상 메서드, 반드시 구현 필요)
- `_validate_and_normalize_parameters()`: 파라미터 검증 및 정규화
- `_create_result()`: 표준 형식의 결과 딕셔너리 생성

### 2. NodeExecutor (노드 실행 래퍼)

노드 실행을 래핑하는 데코레이터입니다. 공통 기능(에러 처리, 로깅, 파라미터 검증)을 제공합니다.

**위치**: `server/nodes/node_executor_wrapper.py`

**주요 기능**:
- 파라미터 검증 및 정규화
- 실행 시작/완료 로그 전송
- 에러 처리 및 실패 결과 반환
- 결과 정규화 (None이거나 dict가 아니면 표준 형식으로 변환)
- `action_name` 속성 추가 (자동 핸들러 등록용)

### 3. ActionService (액션 서비스)

노드 실행을 관리하는 서비스 클래스입니다. 노드 핸들러를 자동으로 등록하고, 노드 실행을 처리합니다.

**위치**: `server/services/action_service.py`

**주요 메서드**:
- `_register_node_handlers()`: 모든 노드 클래스를 스캔하여 핸들러 자동 등록
- `process_action()`: 노드 타입에 따라 적절한 핸들러를 찾아 실행
- `process_node()`: 노드 실행 컨텍스트와 함께 노드 실행

**핸들러 저장소**:
- `node_handlers`: 노드 타입 → execute 메서드 매핑
- `action_node_handlers`: action_node_type → execute 메서드 매핑

### 4. NodeExecutionContext (노드 실행 컨텍스트)

노드 간 데이터 전달을 관리하는 컨텍스트 클래스입니다.

**위치**: `server/services/node_execution_context.py`

**주요 속성**:
- `node_results`: 노드별 실행 결과 저장 (`{node_id: result}`)
- `node_name_map`: 노드 이름 → 노드 ID 매핑
- `execution_order`: 노드 실행 순서 (리스트)
- `current_node_id`: 현재 실행 중인 노드 ID
- `workflow_data`: 워크플로우 전체 데이터 (글로벌 변수 등)

**주요 메서드**:
- `add_node_result()`: 노드 실행 결과 추가
- `get_node_result()`: 특정 노드의 실행 결과 가져오기
- `get_previous_node_result()`: 이전 노드의 실행 결과 가져오기
- `get_node_result_by_name()`: 노드 이름으로 실행 결과 가져오기

### 5. API 라우터 (action_router.py)

클라이언트 요청을 받아 노드 실행을 처리하는 API 엔드포인트입니다.

**위치**: `server/api/action_router.py`

**주요 엔드포인트**:
- `POST /api/execute-nodes`: 노드 리스트를 받아 순차 실행

**처리 흐름**:
1. 요청 검증
2. `NodeExecutionContext` 생성
3. 각 노드를 순차적으로 실행 (`ActionService.process_node()`)
4. 실행 결과 수집
5. 최종 결과 반환

## 노드 실행 흐름

### 1. 클라이언트 요청

클라이언트는 워크플로우를 구성한 노드 리스트를 API에 전송합니다.

```json
{
  "nodes": [
    {"id": "node1", "type": "start", "name": "시작", "parameters": {}},
    {"id": "node2", "type": "wait", "name": "대기", "parameters": {"wait_time": 2}},
    {"id": "node3", "type": "click", "name": "클릭", "parameters": {"x": 100, "y": 200}}
  ],
  "execution_id": "exec-123",
  "script_id": "script-456"
}
```

### 2. API 라우터 처리

`action_router.py`의 `execute_nodes` 함수가 요청을 받아 처리합니다.

```python
# 1. 요청 검증
# 2. NodeExecutionContext 생성
context = NodeExecutionContext()

# 3. 각 노드를 순차 실행
for node in nodes:
    result = await action_service.process_node(node, context, ...)
    context.add_node_result(node["id"], node["name"], result)
```

### 3. ActionService 처리

`ActionService.process_node()`가 노드 타입에 따라 적절한 핸들러를 찾아 실행합니다.

```python
# 1. 노드 타입 확인
node_type = node["type"]

# 2. 핸들러 찾기
handler = self.node_handlers.get(node_type)

# 3. 파라미터 준비 (이전 노드 결과 포함)
parameters = prepare_parameters(node, context)

# 4. 핸들러 실행
result = await handler(parameters)
```

### 4. NodeExecutor 래핑

`NodeExecutor` 데코레이터가 노드 실행을 래핑하여 공통 기능을 제공합니다.

```python
# 1. 파라미터 검증 및 정규화
validated_params = validate_parameters(parameters)

# 2. 실행 시작 로그 전송
log_client.send_log_async(status="running", ...)

# 3. 노드 execute() 실행
try:
    result = await func(validated_params)
    normalized_result = normalize_result(result, action_name)
    # 실행 완료 로그 전송
    log_client.send_log_async(status="completed", ...)
    return normalized_result
except Exception as e:
    # 에러 처리 및 실패 로그 전송
    error_result = create_failed_result(...)
    log_client.send_log_async(status="failed", ...)
    return error_result
```

### 5. 노드 실행

각 노드의 `execute()` 메서드가 실제 작업을 수행합니다.

```python
@NodeExecutor("click")
async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
    x = get_parameter(parameters, "x", default=0)
    y = get_parameter(parameters, "y", default=0)
    # 실제 클릭 작업 수행
    return {"action": "click", "status": "completed", "output": {...}}
```

### 6. 결과 반환

표준 형식의 결과가 반환됩니다 (메타데이터 포함).

```json
{
  "action": "click",
  "status": "completed",
  "output": {"x": 100, "y": 200},
  "_execution_id": "20250101-120000-abc123",
  "_script_id": 1,
  "_node_id": "node1",
  "_node_name": "클릭 노드"
}
```

**v0.0.6 변경사항:** 
- 메타데이터 필드 자동 추가 (`_execution_id`, `_script_id`, `_node_id`, `_node_name`)
- 다음 노드에서 이전 노드 결과를 참조할 때는 `outdata.`/`indata.` 경로를 사용합니다.
  - `outdata.output.execution_id` - 이전 노드의 출력 데이터
  - `indata.parameter_name` - 이전 노드의 입력 파라미터

## 노드 등록 메커니즘

노드는 자동으로 시스템에 등록됩니다. 새로운 노드를 추가하려면:

1. `BaseNode`를 상속받는 클래스 생성
2. `@NodeExecutor("노드타입")` 데코레이터로 `execute` 메서드 장식
3. `server/nodes/` 폴더의 적절한 하위 폴더에 파일 추가

`ActionService`는 초기화 시 `_register_node_handlers()` 메서드를 호출하여:

1. `nodes` 모듈의 모든 클래스를 스캔
2. `BaseNode`를 상속받고 `execute` 메서드가 있는 클래스 찾기
3. `execute` 메서드의 `action_name` 속성 확인 (NodeExecutor가 추가)
4. `node_handlers` 딕셔너리에 등록

이렇게 하면 코드를 수정하지 않고도 새로운 노드를 추가할 수 있습니다.

## 데이터 흐름

### 노드 간 데이터 전달

노드는 `NodeExecutionContext`를 통해 이전 노드의 결과에 접근할 수 있습니다.

```python
# 이전 노드 결과 가져오기
previous_result = context.get_previous_node_result()

# 특정 노드 결과 가져오기
node_result = context.get_node_result("node-id")

# 노드 이름으로 결과 가져오기
node_result = context.get_node_result_by_name("노드 이름")
```

### 파라미터 주입

`ActionService.process_node()`는 노드 실행 전에 파라미터를 준비합니다:

1. 노드의 기본 파라미터
2. 이전 노드의 출력 (`previous_output`) - v0.0.6: `outdata.` 경로로 자동 해석
3. **자동 경로 해석 (v0.0.6)**: 파라미터 값이 `outdata.` 또는 `indata.`로 시작하면 자동으로 실제 값으로 변환

**경로 해석 예시:**
```python
# 파라미터에 경로 문자열이 있는 경우
parameters = {
    "execution_id": "outdata.output.execution_id",  # 경로 문자열
    "sheet_name": "Sheet1"
}

# 자동 해석 후 (이전 노드 결과를 outdata 구조로 래핑하여 해석)
parameters = {
    "execution_id": "20250101-120000-abc123",  # 실제 값
    "sheet_name": "Sheet1"
}
```

이렇게 준비된 파라미터가 노드의 `execute()` 메서드에 전달됩니다.

### 결과 저장

노드 실행 후 결과는 `NodeExecutionContext`에 저장됩니다:

```python
context.add_node_result(node_id, node_name, result)
```

이 결과는 다음 노드에서 `previous_output`으로 접근할 수 있습니다.

## 노드 타입별 상세 설명

각 노드 타입에 대한 상세한 설명은 다음 문서를 참조하세요:

- [경계 노드](./boundary-nodes.md)
- [액션 노드](./action-nodes.md)
- [이미지 노드](./image-nodes.md)
- [엑셀 노드](./excel-nodes.md)
- [조건 노드](./condition-nodes.md)
- [로직 노드](./logic-nodes.md)
- [대기 노드](./wait-nodes.md)
