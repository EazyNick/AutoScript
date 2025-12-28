# 조건 노드 (Condition Nodes)

조건 노드는 이전 노드의 출력을 평가하여 조건을 만족하는지 확인하고, 결과에 따라 워크플로우의 실행 경로를 분기하는 노드입니다.

## 구현된 노드

### condition (조건 노드)

이전 노드의 출력을 받아서 조건을 평가하고 결과를 반환하는 노드입니다. 조건 평가 결과에 따라 `true` 또는 `false` 출력 연결점으로 워크플로우가 분기됩니다.

**파일 위치**: `server/nodes/conditionnodes/condition.py`

**노드 타입**: `condition`

**설명**: 이전 노드의 출력 데이터를 받아 지정된 조건을 평가합니다. 다양한 조건 타입을 지원하며, 필드 경로를 사용하여 중첩된 객체의 특정 필드에 접근할 수 있습니다. 조건 평가 결과(`true` 또는 `false`)에 따라 프론트엔드에서 실행되지 않은 경로의 노드들을 제거하여 워크플로우를 분기합니다.

#### 파라미터

- `condition_type` (string, 기본값: "equals"): 조건 타입
  - `equals`: 값이 같음
  - `not_equals`: 값이 다름
  - `contains`: 문자열 포함 여부
  - `not_contains`: 문자열 미포함 여부
  - `greater_than`: 값이 더 큼
  - `less_than`: 값이 더 작음
  - `greater_than_or_equal`: 값이 크거나 같음
  - `less_than_or_equal`: 값이 작거나 같음
  - `is_empty`: 값이 비어있음
  - `is_not_empty`: 값이 비어있지 않음
- `field_path` (string, 기본값: ""): 이전 노드 출력에서 비교할 필드 경로 (예: "output.value", "output.status")
  - 빈 문자열이면 전체 출력을 비교합니다
  - 점(.)으로 구분하여 중첩된 필드에 접근할 수 있습니다
- `compare_value` (any, 기본값: ""): 비교할 값
- `previous_output` (object, 자동 주입): 이전 노드의 출력 (자동으로 주입됨)

#### 출력 스키마

```json
{
  "action": "condition",
  "status": "completed",
  "output": {
    "result": true,
    "condition_type": "equals",
    "field_path": "output.status",
    "compare_value": "completed",
    "actual_value": "completed"
  }
}
```

#### 동작 방식

조건 노드는 **서버**와 **프론트엔드**에서 협력하여 동작합니다:

**1. 서버 측 (condition.py)**
- 파라미터 추출: 조건 타입, 필드 경로, 비교값, 이전 노드 출력을 추출합니다
- 필드 값 추출: `field_path`를 사용하여 이전 노드 출력에서 비교할 값을 추출합니다
  - `field_path`가 빈 문자열이면 전체 출력을 사용합니다
  - 점(.)으로 구분하여 중첩된 필드에 접근합니다 (예: "output.value")
  - 필드 경로가 잘못되었거나 접근 불가능하면 `None`을 반환합니다
- 조건 평가: `condition_type`에 따라 조건을 평가합니다 (`_evaluate_condition` 메서드)
- 결과 반환: 평가 결과 (`true` 또는 `false`)와 관련 정보를 반환합니다

**2. 프론트엔드 측 (workflow-execution-service.js)**
- 조건 노드 실행 결과를 받아 `result` 값을 확인합니다 (`true` 또는 `false`)
- 조건 노드의 연결 정보를 확인합니다 (`true` 출력, `false` 출력)
- 실행되지 않은 경로의 노드들을 `workflowData.nodes`에서 제거합니다
- 재귀적으로 해당 경로의 모든 하위 노드도 제거합니다 (`_collectNodesToRemove` 메서드)
- 남은 경로의 노드들만 실행하여 워크플로우를 분기합니다

#### 상세 실행 흐름

```
1. 조건 노드 실행 요청
   ↓
2. 서버: 조건 평가 수행
   a. previous_output 확인 (없으면 False 반환)
   b. field_path로 값 추출
      - "output.status" → previous_output["output"]["status"]
   c. condition_type에 따라 평가
      - equals: str(actual) == str(compare)
      - contains: str(compare) in str(actual)
      - greater_than: float(actual) > float(compare)
      - ...
   d. 결과 반환
   {
     "action": "condition",
     "status": "completed",
     "output": {
       "result": true,  // 또는 false
       "condition_type": "equals",
       "field_path": "output.status",
       "actual_value": "completed",
       "compare_value": "completed"
     }
   }
   ↓
3. 프론트엔드: 조건 결과 확인
   - nodeData.type === 'condition' 확인
   - nodeResult.output.result 추출 (true/false)
   ↓
4. 연결 정보 확인
   - conditionConnections = connections.filter(
       c.from === nodeData.id
     )
   - true 출력 연결과 false 출력 연결 구분
   ↓
5. 실행되지 않은 경로 제거
   - result가 true면 false 경로 제거
   - result가 false면 true 경로 제거
   - _collectNodesToRemove()로 재귀적으로 하위 노드도 제거
   ↓
6. workflowData.nodes에서 제거
   - workflowData.nodes = workflowData.nodes.filter(
       node => !nodesToRemove.has(node.id)
     )
   ↓
7. 남은 경로의 노드들만 실행하여 워크플로우 분기
```

#### 지원하는 조건 타입

| 조건 타입 | 설명 | 예시 |
|---------|------|------|
| `equals` | 값이 같음 | `"completed" == "completed"` → `true` |
| `not_equals` | 값이 다름 | `"completed" != "failed"` → `true` |
| `contains` | 문자열 포함 여부 | `"hello world".contains("world")` → `true` |
| `not_contains` | 문자열 미포함 여부 | `"hello".not_contains("world")` → `true` |
| `greater_than` | 값이 더 큼 | `10 > 5` → `true` |
| `less_than` | 값이 더 작음 | `5 < 10` → `true` |
| `greater_than_or_equal` | 값이 크거나 같음 | `10 >= 10` → `true` |
| `less_than_or_equal` | 값이 작거나 같음 | `5 <= 10` → `true` |
| `is_empty` | 값이 비어있음 | `""`, `[]`, `{}`, `None` → `true` |
| `is_not_empty` | 값이 비어있지 않음 | `"hello"`, `[1]`, `{key: value}` → `true` |

#### 필드 경로 사용법

필드 경로는 점(.)으로 구분하여 중첩된 객체의 특정 필드에 접근할 수 있습니다:

```python
# 이전 노드 출력 예시
previous_output = {
    "action": "click",
    "status": "completed",
    "output": {
        "x": 100,
        "y": 200,
        "success": True
    }
}

# 필드 경로 예시
field_path = "output.success"  # → True
field_path = "status"           # → "completed"
field_path = "output.x"         # → 100
field_path = ""                 # → 전체 출력 객체
```

#### 코드 예시

```python
@NodeExecutor("condition")
async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
    condition_type = get_parameter(parameters, "condition_type", default="equals")
    field_path = get_parameter(parameters, "field_path", default="")
    compare_value = get_parameter(parameters, "compare_value", default="")
    previous_output = get_parameter(parameters, "previous_output", default=None)
    
    # 필드 값 추출
    if field_path:
        # 점으로 구분하여 중첩된 필드에 접근
        actual_value = get_nested_value(previous_output, field_path)
    else:
        # 전체 출력 사용
        actual_value = previous_output
    
    # 조건 평가
    result = evaluate_condition(condition_type, actual_value, compare_value)
    
    return {
        "action": "condition",
        "status": "completed",
        "output": {
            "result": result,
            "condition_type": condition_type,
            "field_path": field_path,
            "compare_value": compare_value,
            "actual_value": actual_value
        }
    }
```

## 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────────┐
│              조건 노드 실행 흐름 (전체)                        │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  1. 서버 측: 조건 평가 수행                            │  │
│  │     ┌────────────────────────────────────────────┐  │  │
│  │     │ ConditionNode.execute()                     │  │  │
│  │     │   a. 파라미터 추출                          │  │  │
│  │     │      - condition_type, field_path,          │  │  │
│  │     │        compare_value, previous_output        │  │  │
│  │     │                                            │  │  │
│  │     │   b. 필드 값 추출                           │  │  │
│  │     │      - field_path가 있으면:                 │  │  │
│  │     │        "output.status" →                     │  │  │
│  │     │        previous_output["output"]["status"]   │  │  │
│  │     │      - 없으면: 전체 출력 사용                │  │  │
│  │     │                                            │  │  │
│  │     │   c. 조건 평가                              │  │  │
│  │     │      _evaluate_condition(                  │  │  │
│  │     │        condition_type,                     │  │  │
│  │     │        actual_value,                        │  │  │
│  │     │        compare_value                        │  │  │
│  │     │      )                                      │  │  │
│  │     │                                            │  │  │
│  │     │   d. 결과 반환                             │  │  │
│  │     │      {                                      │  │  │
│  │     │        "result": true/false,               │  │  │
│  │     │        "condition_type": "...",            │  │  │
│  │     │        "field_path": "...",                │  │  │
│  │     │        "actual_value": ...,                │  │  │
│  │     │        "compare_value": ...                │  │  │
│  │     │      }                                      │  │  │
│  │     └──────────────┬─────────────────────────────┘  │  │
│  └────────────────────┼──────────────────────────────────┘  │
│                       │                                      │
│                       ▼                                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  2. 프론트엔드: 조건 결과 확인                          │  │
│  │     ┌────────────────────────────────────────────┐  │  │
│  │     │ WorkflowExecutionService.execute()         │  │  │
│  │     │   - nodeData.type === 'condition' 확인     │  │  │
│  │     │   - nodeResult.output.result 추출          │  │  │
│  │     │     (true 또는 false)                      │  │  │
│  │     └──────────────┬─────────────────────────────┘  │  │
│  └────────────────────┼──────────────────────────────────┘  │
│                       │                                      │
│                       ▼                                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  3. 연결 정보 확인 및 경로 분기                        │  │
│  │     ┌────────────────────────────────────────────┐  │  │
│  │     │ conditionConnections 확인                  │  │  │
│  │     │   - true 출력 연결                         │  │  │
│  │     │   - false 출력 연결                        │  │  │
│  │     │                                            │  │  │
│  │     │ 실행되지 않은 경로 결정                    │  │  │
│  │     │   - result === true → false 경로 제거      │  │  │
│  │     │   - result === false → true 경로 제거      │  │  │
│  │     │                                            │  │  │
│  │     │ 재귀적으로 하위 노드 수집                  │  │  │
│  │     │   _collectNodesToRemove(                   │  │  │
│  │     │     conn.to,                               │  │  │
│  │     │     connections,                            │  │  │
│  │     │     nodesToRemove,                         │  │  │
│  │     │     nodeData.id                            │  │  │
│  │     │   )                                        │  │  │
│  │     └──────────────┬─────────────────────────────┘  │  │
│  └────────────────────┼──────────────────────────────────┘  │
│                       │                                      │
│                       ▼                                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  4. workflowData.nodes에서 제거                        │  │
│  │     ┌────────────────────────────────────────────┐  │  │
│  │     │ workflowData.nodes =                      │  │  │
│  │     │   workflowData.nodes.filter(              │  │  │
│  │     │     node => !nodesToRemove.has(node.id)   │  │  │
│  │     │   )                                        │  │  │
│  │     └──────────────┬─────────────────────────────┘  │  │
│  └────────────────────┼──────────────────────────────────┘  │
│                       │                                      │
│                       ▼                                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  5. 남은 경로의 노드들만 실행하여 워크플로우 분기      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              조건 노드 워크플로우 분기 예시                   │
│                                                              │
│  [이전 노드]                                                 │
│     │                                                        │
│     ▼                                                        │
│  [조건 노드]                                                 │
│     │                                                        │
│     ├─→ [true 경로]  ← result === true면 이 경로만 실행     │
│     │     │                                                  │
│     │     ▼                                                  │
│     │   [노드 A]                                             │
│     │     │                                                  │
│     │     ▼                                                  │
│     │   [노드 B]                                             │
│     │                                                        │
│     └─→ [false 경로] ← result === false면 이 경로만 실행   │
│           │                                                  │
│           ▼                                                  │
│         [노드 C]                                             │
│           │                                                  │
│           ▼                                                  │
│         [노드 D]                                             │
│                                                              │
│  실행되지 않은 경로의 모든 노드 (A, B 또는 C, D)는          │
│  workflowData.nodes에서 제거되어 실행되지 않습니다.           │
└──────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│              조건 평가 예시                               │
│                                                          │
│  이전 노드 출력:                                         │
│  {                                                       │
│    "action": "click",                                    │
│    "status": "completed",                               │
│    "output": {"success": true}                          │
│  }                                                       │
│                                                          │
│  조건 설정:                                              │
│  - condition_type: "equals"                              │
│  - field_path: "status"                                  │
│  - compare_value: "completed"                            │
│                                                          │
│  평가 과정:                                              │
│  1. field_path "status"로 값 추출 → "completed"         │
│  2. "completed" == "completed" → true                    │
│                                                          │
│  결과:                                                   │
│  {                                                       │
│    "result": true,                                       │
│    "condition_type": "equals",                          │
│    "field_path": "status",                              │
│    "compare_value": "completed",                        │
│    "actual_value": "completed"                          │
│  }                                                       │
└──────────────────────────────────────────────────────────┘
```

## 특징

1. **서버-프론트엔드 협력**: 서버는 조건을 평가하고, 프론트엔드는 결과에 따라 워크플로우를 분기합니다
2. **동적 경로 제거**: 조건 결과에 따라 실행되지 않은 경로의 노드들을 `workflowData.nodes`에서 제거하여 분기를 구현합니다
3. **재귀적 하위 노드 제거**: 실행되지 않은 경로의 모든 하위 노드도 재귀적으로 제거하여 불필요한 실행을 방지합니다
4. **유연한 조건 평가**: 다양한 조건 타입을 지원합니다 (equals, contains, greater_than 등)
5. **중첩 필드 접근**: 필드 경로를 사용하여 중첩된 객체의 특정 필드에 접근할 수 있습니다
6. **자동 파라미터 주입**: 이전 노드의 출력이 자동으로 주입됩니다
7. **상세한 결과**: 평가 결과뿐만 아니라 사용된 조건과 값들을 반환합니다
8. **타입 안전성**: 다양한 타입(문자열, 숫자, 불린 등)을 지원하며, 타입 변환을 자동으로 처리합니다

## 사용 예시

### 워크플로우 예시

```
[시작] → [HTTP 요청] → [조건] → [대기]
                      (status == 200?)
```

이 워크플로우는:
1. 시작 노드로 워크플로우를 시작합니다
2. HTTP 요청 노드가 API를 호출합니다
3. 조건 노드가 응답 상태 코드가 200인지 확인합니다
4. 조건이 만족되면 대기 노드로 진행합니다

### 파라미터 설정 예시

```json
{
  "condition_type": "equals",
  "field_path": "output.status_code",
  "compare_value": 200
}
```

이 설정은 이전 노드의 `output.status_code`가 200인지 확인합니다.

### 중첩 필드 접근 예시

```json
{
  "condition_type": "contains",
  "field_path": "output.body.message",
  "compare_value": "success"
}
```

이 설정은 이전 노드의 `output.body.message`에 "success"가 포함되어 있는지 확인합니다.

## 주의사항

1. **이전 노드 필요**: 조건 노드는 이전 노드의 출력이 필요하므로 첫 번째 노드로 사용할 수 없습니다
2. **필드 경로 오류**: 존재하지 않는 필드 경로를 사용하면 `None`이 반환될 수 있습니다
3. **타입 변환**: 숫자 비교 시 문자열과 숫자가 자동으로 변환될 수 있습니다
4. **빈 값 처리**: `is_empty`와 `is_not_empty`는 빈 문자열, 빈 리스트, 빈 딕셔너리, `None`을 모두 빈 값으로 간주합니다
