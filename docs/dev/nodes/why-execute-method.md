# execute 메서드를 사용하는 이유

## 개요

현재 코드베이스에서 모든 노드가 `execute` 메서드를 사용하는 이유와 그 메커니즘을 설명합니다.

---

## execute 메서드를 사용하는 이유

### 1. 추상 메서드로 강제 (일관성 보장)

**BaseNode의 추상 메서드 정의**:
```python
class BaseNode(ABC):
    @staticmethod
    @abstractmethod
    async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
        """노드를 실행합니다."""
```

**효과**:
- 모든 노드가 반드시 `execute` 메서드를 구현해야 함
- `execute` 메서드를 구현하지 않으면 인스턴스 생성 시 `TypeError` 발생
- 일관된 인터페이스 보장

**예시**:
```python
# 올바른 구현
class MyNode(BaseNode):
    @staticmethod
    async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
        return {"action": "my-action", "status": "completed", "output": {}}

# 잘못된 구현 (execute 없음)
class BadNode(BaseNode):
    pass  # TypeError: Can't instantiate abstract class BadNode with abstract method execute
```

---

### 2. 자동 핸들러 등록 시스템

**ActionService의 핸들러 등록 로직**:
```python
def _register_node_handlers(self) -> None:
    for _name, obj in inspect.getmembers(nodes):
        # 1. BaseNode를 상속받은 클래스인지 확인
        if inspect.isclass(obj) and issubclass(obj, BaseNode):
            # 2. execute 메서드가 있는지 확인
            if hasattr(obj, "execute"):
                execute_method = obj.execute
                # 3. NodeExecutor가 추가한 action_name 속성 확인
                if hasattr(execute_method, "action_name"):
                    action_name = execute_method.action_name
                    # 4. 핸들러로 등록
                    self.node_handlers[action_name] = execute_method
```

**핵심 포인트**:
- `hasattr(obj, "execute")`로 execute 메서드 존재 확인
- `execute_method.action_name`으로 노드 타입 식별
- `node_handlers[action_name] = execute_method`로 자동 등록

**실행 흐름**:
```
1. 서버 시작 시 ActionService 초기화
   ↓
2. _register_node_handlers() 호출
   ↓
3. nodes 모듈의 모든 클래스 스캔
   ↓
4. BaseNode를 상속받고 execute 메서드가 있는 클래스 찾기
   ↓
5. execute 메서드에 action_name 속성이 있는지 확인
   ↓
6. node_handlers 딕셔너리에 등록
   {
     "start": StartNode.execute,
     "wait": WaitNode.execute,
     "condition": ConditionNode.execute,
     ...
   }
```

---

### 3. NodeExecutor의 action_name 속성 추가

**NodeExecutor의 동작**:
```python
class NodeExecutor:
    def __call__(self, func):
        @wraps(func)
        async def wrapper(parameters):
            # ... 래핑 로직 ...
            return result
        
        # 핵심: 래핑된 함수에 action_name 속성 추가
        wrapper.action_name = self.action_name
        return wrapper
```

**사용 예시**:
```python
class StartNode(BaseNode):
    @staticmethod
    @NodeExecutor("start")  # action_name = "start"
    async def execute(parameters):
        return {...}

# 실행 후:
# StartNode.execute.action_name == "start"
# ActionService가 이 속성을 읽어서 핸들러 등록
```

**왜 action_name이 필요한가?**:
- 노드 클래스 이름(`StartNode`)과 실제 노드 타입(`"start"`)이 다를 수 있음
- `@NodeExecutor("start")`로 명시적으로 노드 타입 지정
- ActionService가 노드 타입으로 핸들러를 찾을 수 있음

---

### 4. 표준 인터페이스로 통일된 호출

**모든 노드가 동일한 방식으로 호출됨**:
```python
# ActionService.process_action()에서
handler = self.node_handlers.get(action_type)  # execute 메서드
result = await handler(parameters)  # 모든 노드가 동일한 시그니처
```

**장점**:
- 모든 노드를 동일한 방식으로 호출 가능
- 타입 안정성 보장
- 다형성(polymorphism) 활용 가능

---

## execute 메서드가 없으면?

### 시나리오 1: execute 메서드 없이 다른 이름 사용

```python
class MyNode(BaseNode):
    @NodeExecutor("my-action")
    async def run(parameters):  # execute 대신 run 사용
        return {...}
```

**문제점**:
1. **추상 메서드 위반**: `TypeError` 발생 (인스턴스 생성 불가)
2. **자동 등록 실패**: `hasattr(obj, "execute")`가 `False`이므로 핸들러 등록 안 됨
3. **일관성 부족**: 다른 노드와 다른 인터페이스

---

### 시나리오 2: execute 메서드에 @NodeExecutor 없이 사용

```python
class MyNode(BaseNode):
    @staticmethod
    async def execute(parameters):
        return {...}
```

**문제점**:
1. **자동 등록 실패**: `execute_method.action_name`이 없으므로 핸들러 등록 안 됨
2. **공통 기능 누락**: 로깅, 에러 처리, 파라미터 검증 등이 자동으로 수행되지 않음
3. **수동 등록 필요**: ActionService에 수동으로 핸들러 등록해야 함

---

## execute 메서드의 시그니처

### 필수 시그니처

```python
@staticmethod
@NodeExecutor("node-type")
async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
    """노드 실행 로직"""
    return {
        "action": "node-type",
        "status": "completed",
        "output": {...}
    }
```

**요구사항**:
1. `@staticmethod`: 클래스 메서드로 정의 (인스턴스 생성 불필요)
2. `async`: 비동기 함수 (다른 노드와의 호환성)
3. `parameters: dict[str, Any]`: 파라미터 딕셔너리
4. `-> dict[str, Any]`: 표준 형식의 결과 딕셔너리 반환
5. `@NodeExecutor("node-type")`: 자동 핸들러 등록을 위한 데코레이터

---

## execute 메서드 호출 체인

```
1. 클라이언트 요청
   POST /api/execute-nodes
   {
     "nodes": [
       {"id": "node1", "type": "start", "parameters": {}}
     ]
   }
   ↓
2. action_router.execute_nodes()
   ↓
3. ActionService.process_node()
   ↓
4. node_handlers에서 핸들러 찾기
   handler = self.node_handlers.get("start")  # StartNode.execute
   ↓
5. NodeExecutor.wrapper() 호출
   result = await handler(parameters)
   ↓
6. NodeExecutor 내부 처리
   ├─ 파라미터 검증
   ├─ 로깅 시작
   ├─ StartNode.execute() 호출 (실제 노드 로직)
   ├─ 결과 정규화
   ├─ 로깅 완료
   └─ 결과 반환
   ↓
7. 결과를 클라이언트에 반환
```

---

## 왜 다른 이름을 사용하지 않는가?

### 대안 1: run() 메서드 사용

```python
class MyNode(BaseNode):
    async def run(parameters):
        return {...}
```

**문제점**:
- BaseNode의 추상 메서드가 아니므로 강제되지 않음
- ActionService가 `hasattr(obj, "execute")`로 찾지 못함
- 일관성 부족

---

### 대안 2: 클래스 메서드로 호출

```python
class MyNode(BaseNode):
    @classmethod
    async def run(cls, parameters):
        return {...}
```

**문제점**:
- `@staticmethod`가 아니므로 `cls` 파라미터 필요
- 기존 시스템과 호환되지 않음
- ActionService의 등록 로직과 맞지 않음

---

### 대안 3: 인스턴스 메서드로 호출

```python
class MyNode(BaseNode):
    async def run(self, parameters):
        return {...}
```

**문제점**:
- 매번 인스턴스 생성 필요 (비효율적)
- 상태 관리 복잡도 증가
- 현재 시스템은 정적 메서드 기반

---

## execute 메서드의 설계 철학

### 1. 명확성 (Clarity)
- 메서드 이름이 노드의 역할을 명확히 표현
- "execute"는 "실행하다"라는 의미로 직관적

### 2. 일관성 (Consistency)
- 모든 노드가 동일한 메서드 이름 사용
- 개발자가 예측 가능한 구조

### 3. 자동화 (Automation)
- ActionService가 자동으로 노드를 찾아 등록
- 수동 등록 불필요

### 4. 확장성 (Extensibility)
- 새로운 노드 추가 시 execute만 구현하면 자동 등록
- 시스템 변경 없이 노드 추가 가능

---

## 결론

`execute` 메서드를 사용하는 이유:

1. **추상 메서드 강제**: BaseNode가 모든 노드가 execute를 구현하도록 강제
2. **자동 핸들러 등록**: ActionService가 execute 메서드를 찾아서 자동 등록
3. **NodeExecutor 연동**: NodeExecutor가 execute에 action_name을 추가하여 등록 가능
4. **표준 인터페이스**: 모든 노드를 동일한 방식으로 호출 가능
5. **일관성**: 모든 노드가 동일한 패턴 사용

**핵심**: `execute`는 단순한 메서드 이름이 아니라, **전체 노드 시스템의 자동화와 일관성을 보장하는 핵심 인터페이스**입니다.

