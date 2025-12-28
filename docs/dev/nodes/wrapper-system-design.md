# Wrapper 시스템 설계 문서

## 개요

노드 시스템을 4가지 wrapper로 분류하여 공통 로직을 재사용하고, 개발자가 쉽게 새로운 노드를 추가할 수 있도록 설계합니다.

## Wrapper 분류

### 1. 경계 노드 Wrapper (BoundaryNodeWrapper)

**목적**: 워크플로우의 시작/종료점 역할을 하는 노드

**대상 노드**: `start`, `end` (향후 추가 가능)

**특징**:
- 파라미터가 없거나 매우 단순함
- 이전 노드 출력을 받지 않음
- 워크플로우 실행 흐름의 경계점 역할

**공통 처리**:
- 파라미터 검증 최소화
- 단순 실행 및 결과 반환
- 시작/종료 시간 기록

**구현 예시**:
```python
from nodes.wrappers.boundary_wrapper import BoundaryNodeWrapper
from nodes.node_executor_wrapper import NodeExecutor

class StartNode(BoundaryNodeWrapper):
    """시작 노드"""
    
    @staticmethod
    @NodeExecutor("start")
    async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
        # 경계 노드 wrapper가 기본 처리 수행
        return await super().execute(parameters)
    
    async def _execute_boundary_action(self, parameters: dict[str, Any]) -> dict[str, Any]:
        """경계 노드의 실제 동작 구현"""
        from utils import get_korea_time_str
        time_str = get_korea_time_str()
        return {
            "time": time_str,
            "message": "워크플로우가 시작되었습니다."
        }
```

---

### 2. 기본 로직 Wrapper (LogicNodeWrapper)

**목적**: 워크플로우 실행 흐름을 제어하는 노드

**대상 노드**: `condition`, `repeat`

**특징**:
- 워크플로우 실행 흐름을 제어
- 특수한 실행 방식 (반복, 분기)
- 하위 노드 체인을 관리
- 실행 컨텍스트 정보 활용

**공통 처리**:
- 반복/조건 정보 메타데이터 관리
- 하위 노드 체인 수집 및 실행
- 반복/분기 결과 집계
- 실행 컨텍스트 전달

**구현 예시**:
```python
from nodes.wrappers.logic_wrapper import LogicNodeWrapper
from nodes.node_executor_wrapper import NodeExecutor

class ConditionNode(LogicNodeWrapper):
    """조건 노드"""
    
    @staticmethod
    @NodeExecutor("condition")
    async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
        return await super().execute(parameters)
    
    async def _evaluate_condition(
        self, 
        parameters: dict[str, Any],
        previous_output: dict[str, Any] | None
    ) -> bool:
        """조건 평가 로직 구현"""
        condition_type = parameters.get("condition_type", "equals")
        field_path = parameters.get("field_path", "")
        compare_value = parameters.get("compare_value", "")
        
        # 필드 경로 파싱
        value = self._parse_field_path(field_path, previous_output) if previous_output else None
        
        # 조건 평가
        return self._compare_values(value, compare_value, condition_type)
    
    def _compare_values(self, value: Any, compare_value: Any, condition_type: str) -> bool:
        """값 비교 로직"""
        # equals, not_equals, contains 등 구현
        ...
```

---

### 3. 기본 기능 Wrapper (BasicActionNodeWrapper)

**목적**: 단순하고 직접적인 액션을 수행하는 노드

**대상 노드**: `wait`, `click`, `process-focus` 등

**특징**:
- 기본적인 파라미터만 사용
- 복잡한 전처리/후처리 불필요
- 직접적인 액션 수행
- 빠른 실행

**공통 처리**:
- 기본 파라미터 검증
- 타입 변환 및 기본값 처리
- 단순 실행 및 결과 반환

**구현 예시**:
```python
from nodes.wrappers.basic_wrapper import BasicActionNodeWrapper
from nodes.node_executor_wrapper import NodeExecutor
from utils import get_parameter

class WaitNode(BasicActionNodeWrapper):
    """대기 노드"""
    
    @staticmethod
    @NodeExecutor("wait")
    async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
        return await super().execute(parameters)
    
    async def _execute_action(self, parameters: dict[str, Any]) -> dict[str, Any]:
        """대기 액션 실행"""
        import asyncio
        
        wait_time = get_parameter(parameters, "wait_time", default=1.0)
        wait_time = float(wait_time)
        
        await asyncio.sleep(wait_time)
        
        return {
            "wait_time": wait_time,
            "elapsed": wait_time
        }
```

---

### 4. 커스텀 노드 Wrapper (CustomNodeWrapper)

**목적**: 다른 개발자가 쉽게 새로운 노드를 구현할 수 있도록 하는 확장 가능한 wrapper

**대상 노드**: 모든 커스텀 노드 (파일 작업, HTTP 요청, 엑셀 작업 등)

**특징**:
- 최대한 유연한 구조
- 개발자가 필요한 기능만 구현
- 공통 유틸리티 제공
- 확장 가능한 파라미터 검증

**공통 처리**:
- 파라미터 스키마 검증 (선택적)
- 에러 처리 및 로깅
- 결과 정규화
- 확장 가능한 전처리/후처리 훅

**구현 예시**:
```python
from nodes.wrappers.custom_wrapper import CustomNodeWrapper
from nodes.node_executor_wrapper import NodeExecutor
from typing import Any

class FileReadNode(CustomNodeWrapper):
    """파일 읽기 노드 (커스텀)"""
    
    # 파라미터 스키마 정의 (선택적)
    PARAMETER_SCHEMA = {
        "file_path": {
            "type": str,
            "required": True,
            "validator": lambda x: os.path.exists(x) if isinstance(x, str) else False
        },
        "encoding": {
            "type": str,
            "required": False,
            "default": "utf-8"
        }
    }
    
    @staticmethod
    
    async def _validate_custom_parameters(self, parameters: dict[str, Any]) -> dict[str, Any]:
        """커스텀 파라미터 검증"""
        # PARAMETER_SCHEMA 기반 자동 검증 또는 수동 검증
        file_path = parameters.get("file_path")
        if not file_path or not os.path.exists(file_path):
            raise ValueError(f"파일 경로가 유효하지 않습니다: {file_path}")
        return parameters
    
    async def _execute_custom_action(self, parameters: dict[str, Any]) -> dict[str, Any]:
        """커스텀 액션 실행"""
        file_path = parameters["file_path"]
        encoding = parameters.get("encoding", "utf-8")
        
        with open(file_path, "r", encoding=encoding) as f:
            content = f.read()
        
        return {
            "file_path": file_path,
            "encoding": encoding,
            "content": content,
            "size": len(content.encode(encoding))
        }
    
    def _pre_execute_hook(self, parameters: dict[str, Any]) -> dict[str, Any]:
        """실행 전 훅 (선택적)"""
        # 파일 경로 정규화 등
        if "file_path" in parameters:
            parameters["file_path"] = os.path.abspath(parameters["file_path"])
        return parameters
    
    def _post_execute_hook(self, result: dict[str, Any]) -> dict[str, Any]:
        """실행 후 훅 (선택적)"""
        # 결과 후처리 등
        return result
```

---

## Wrapper 계층 구조

```
BaseNode (추상 클래스)
    │
    ├── BoundaryNodeWrapper
    │   └── StartNode, EndNode
    │
    ├── LogicNodeWrapper
    │   └── ConditionNode, RepeatNode
    │
    ├── BasicActionNodeWrapper
    │   └── WaitNode, ClickNode, ProcessFocusNode
    │
    └── CustomNodeWrapper
        └── FileReadNode, HttpApiRequestNode, ExcelOpenNode, ...
```

---

## Wrapper 구현 상세

### 1. BoundaryNodeWrapper

**위치**: `server/nodes/wrappers/boundary_wrapper.py`

**기본 구조**:
```python
from __future__ import annotations

from typing import TYPE_CHECKING, Any

from nodes.base_node import BaseNode

if TYPE_CHECKING:
    from collections.abc import Callable

class BoundaryNodeWrapper(BaseNode):
    """경계 노드 wrapper"""
    
    @staticmethod
    async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
        """경계 노드 실행 (템플릿 메서드)"""
        # 1. 파라미터 검증 (최소화)
        validated_params = self._validate_parameters(parameters)
        
        # 2. 경계 노드 액션 실행
        output = await self._execute_boundary_action(validated_params)
        
        # 3. 결과 반환
        return {
            "action": self._get_action_name(),
            "status": "completed",
            "output": output
        }
    
    async def _execute_boundary_action(self, parameters: dict[str, Any]) -> dict[str, Any]:
        """경계 노드의 실제 동작 (서브클래스에서 구현)"""
        raise NotImplementedError("서브클래스에서 구현해야 합니다")
    
    def _validate_parameters(self, parameters: dict[str, Any]) -> dict[str, Any]:
        """파라미터 검증 (최소화)"""
        return parameters or {}
    
    def _get_action_name(self) -> str:
        """액션 이름 반환"""
        return self.__class__.__name__.replace("Node", "").lower()
```

---

### 2. LogicNodeWrapper

**위치**: `server/nodes/wrappers/logic_wrapper.py`

**기본 구조**:
```python
from __future__ import annotations

from typing import TYPE_CHECKING, Any

from nodes.base_node import BaseNode

if TYPE_CHECKING:
    from collections.abc import Callable

class LogicNodeWrapper(BaseNode):
    """로직 노드 wrapper"""
    
    @staticmethod
    async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
        """로직 노드 실행 (템플릿 메서드)"""
        # 1. 파라미터 검증
        validated_params = self._validate_parameters(parameters)
        
        # 2. 이전 노드 출력 추출
        previous_output = self._extract_previous_output(validated_params)
        
        # 3. 로직 실행
        result = await self._execute_logic(validated_params, previous_output)
        
        # 4. 결과 반환
        return {
            "action": self._get_action_name(),
            "status": "completed",
            "output": result
        }
    
    async def _execute_logic(
        self, 
        parameters: dict[str, Any],
        previous_output: dict[str, Any] | None
    ) -> dict[str, Any]:
        """로직 실행 (서브클래스에서 구현)"""
        raise NotImplementedError("서브클래스에서 구현해야 합니다")
    
    def _extract_previous_output(self, parameters: dict[str, Any]) -> dict[str, Any] | None:
        """이전 노드 출력 추출"""
        return parameters.get("_previous_output")
    
    def _parse_field_path(self, field_path: str, data: dict[str, Any]) -> Any:
        """필드 경로 파싱 (예: "output.value" -> data["output"]["value"])"""
        if not field_path:
            return data
        
        keys = field_path.split(".")
        value = data
        for key in keys:
            if isinstance(value, dict) and key in value:
                value = value[key]
            else:
                return None
        return value
```

---

### 3. BasicActionNodeWrapper

**위치**: `server/nodes/wrappers/basic_wrapper.py`

**기본 구조**:
```python
from __future__ import annotations

from typing import TYPE_CHECKING, Any

from nodes.base_node import BaseNode
from utils import get_parameter

if TYPE_CHECKING:
    from collections.abc import Callable

class BasicActionNodeWrapper(BaseNode):
    """기본 액션 노드 wrapper"""
    
    @staticmethod
    async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
        """기본 액션 실행 (템플릿 메서드)"""
        # 1. 파라미터 검증 및 정규화
        validated_params = self._validate_parameters(parameters)
        
        # 2. 기본값 처리
        validated_params = self._apply_defaults(validated_params)
        
        # 3. 액션 실행
        output = await self._execute_action(validated_params)
        
        # 4. 결과 반환
        return {
            "action": self._get_action_name(),
            "status": "completed",
            "output": output
        }
    
    async def _execute_action(self, parameters: dict[str, Any]) -> dict[str, Any]:
        """액션 실행 (서브클래스에서 구현)"""
        raise NotImplementedError("서브클래스에서 구현해야 합니다")
    
    def _validate_parameters(self, parameters: dict[str, Any]) -> dict[str, Any]:
        """파라미터 검증"""
        return parameters or {}
    
    def _apply_defaults(self, parameters: dict[str, Any]) -> dict[str, Any]:
        """기본값 적용"""
        # 서브클래스에서 DEFAULT_PARAMETERS를 정의하면 자동 적용
        if hasattr(self, "DEFAULT_PARAMETERS"):
            for key, value in self.DEFAULT_PARAMETERS.items():
                if key not in parameters:
                    parameters[key] = value
        return parameters
```

---

### 4. CustomNodeWrapper

**위치**: `server/nodes/wrappers/custom_wrapper.py`

**기본 구조**:
```python
from __future__ import annotations

from typing import TYPE_CHECKING, Any

from nodes.base_node import BaseNode

if TYPE_CHECKING:
    from collections.abc import Callable

class CustomNodeWrapper(BaseNode):
    """커스텀 노드 wrapper (확장 가능)"""
    
    # 파라미터 스키마 (선택적, 서브클래스에서 정의)
    PARAMETER_SCHEMA: dict[str, dict[str, Any]] | None = None
    
    @staticmethod
    async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
        """커스텀 노드 실행 (템플릿 메서드)"""
        # 1. 전처리 훅
        parameters = self._pre_execute_hook(parameters or {})
        
        # 2. 커스텀 파라미터 검증
        validated_params = await self._validate_custom_parameters(parameters)
        
        # 3. 커스텀 액션 실행
        output = await self._execute_custom_action(validated_params)
        
        # 4. 후처리 훅
        result = {
            "action": self._get_action_name(),
            "status": "completed",
            "output": output
        }
        result = self._post_execute_hook(result)
        
        # 5. 결과 반환
        return result
    
    async def _validate_custom_parameters(self, parameters: dict[str, Any]) -> dict[str, Any]:
        """커스텀 파라미터 검증"""
        # PARAMETER_SCHEMA가 정의되어 있으면 자동 검증
        if self.PARAMETER_SCHEMA:
            return self._validate_with_schema(parameters)
        return parameters
    
    async def _execute_custom_action(self, parameters: dict[str, Any]) -> dict[str, Any]:
        """커스텀 액션 실행 (서브클래스에서 구현)"""
        raise NotImplementedError("서브클래스에서 구현해야 합니다")
    
    def _pre_execute_hook(self, parameters: dict[str, Any]) -> dict[str, Any]:
        """실행 전 훅 (서브클래스에서 오버라이드 가능)"""
        return parameters
    
    def _post_execute_hook(self, result: dict[str, Any]) -> dict[str, Any]:
        """실행 후 훅 (서브클래스에서 오버라이드 가능)"""
        return result
    
    def _validate_with_schema(self, parameters: dict[str, Any]) -> dict[str, Any]:
        """스키마 기반 파라미터 검증"""
        if not self.PARAMETER_SCHEMA:
            return parameters
        
        validated = {}
        for key, schema in self.PARAMETER_SCHEMA.items():
            if key in parameters:
                value = parameters[key]
                # 타입 검증
                if "type" in schema and not isinstance(value, schema["type"]):
                    raise TypeError(f"파라미터 '{key}'의 타입이 올바르지 않습니다")
                # 커스텀 검증
                if "validator" in schema and not schema["validator"](value):
                    raise ValueError(f"파라미터 '{key}'의 값이 유효하지 않습니다")
                validated[key] = value
            elif schema.get("required", False):
                raise ValueError(f"필수 파라미터 '{key}'가 누락되었습니다")
            elif "default" in schema:
                validated[key] = schema["default"]
        
        return validated
```

---

## 개발자 가이드

### 새로운 노드 추가하기

#### 1. 경계 노드 추가

```python
# server/nodes/boundarynodes/my_boundary.py
from nodes.wrappers.boundary_wrapper import BoundaryNodeWrapper
from nodes.node_executor_wrapper import NodeExecutor

class MyBoundaryNode(BoundaryNodeWrapper):
    @staticmethod
    @NodeExecutor("my-boundary")
    async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
        return await super().execute(parameters)
    
    async def _execute_boundary_action(self, parameters: dict[str, Any]) -> dict[str, Any]:
        # 경계 노드 로직 구현
        return {"message": "경계 노드 실행 완료"}
```

#### 2. 로직 노드 추가

```python
# server/nodes/logicnodes/my_logic.py
from nodes.wrappers.logic_wrapper import LogicNodeWrapper
from nodes.node_executor_wrapper import NodeExecutor

class MyLogicNode(LogicNodeWrapper):
    @staticmethod
    @NodeExecutor("my-logic")
    async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
        return await super().execute(parameters)
    
    async def _execute_logic(
        self, 
        parameters: dict[str, Any],
        previous_output: dict[str, Any] | None
    ) -> dict[str, Any]:
        # 로직 노드 로직 구현
        condition_result = self._evaluate_condition(parameters, previous_output)
        return {"result": condition_result}
```

#### 3. 기본 액션 노드 추가

```python
# server/nodes/actionnodes/my_action.py
from nodes.wrappers.basic_wrapper import BasicActionNodeWrapper
from nodes.node_executor_wrapper import NodeExecutor
from utils import get_parameter

class MyActionNode(BasicActionNodeWrapper):
    DEFAULT_PARAMETERS = {
        "timeout": 30
    }
    
    @staticmethod
    @NodeExecutor("my-action")
    async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
        return await super().execute(parameters)
    
    async def _execute_action(self, parameters: dict[str, Any]) -> dict[str, Any]:
        # 기본 액션 로직 구현
        timeout = get_parameter(parameters, "timeout", default=30)
        # ... 액션 수행
        return {"success": True, "timeout": timeout}
```

#### 4. 커스텀 노드 추가

```python
# server/nodes/customnodes/my_custom.py
from nodes.wrappers.custom_wrapper import CustomNodeWrapper
from nodes.node_executor_wrapper import NodeExecutor
import os

class MyCustomNode(CustomNodeWrapper):
    PARAMETER_SCHEMA = {
        "input_path": {
            "type": str,
            "required": True,
            "validator": lambda x: os.path.exists(x) if isinstance(x, str) else False
        },
        "output_path": {
            "type": str,
            "required": False,
            "default": "./output"
        }
    }
    
    @staticmethod
    @NodeExecutor("my-custom")
    async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
        return await super().execute(parameters)
    
    async def _execute_custom_action(self, parameters: dict[str, Any]) -> dict[str, Any]:
        # 커스텀 액션 로직 구현
        input_path = parameters["input_path"]
        output_path = parameters["output_path"]
        # ... 커스텀 로직 수행
        return {
            "input_path": input_path,
            "output_path": output_path,
            "processed": True
        }
    
    def _pre_execute_hook(self, parameters: dict[str, Any]) -> dict[str, Any]:
        # 경로 정규화 등 전처리
        if "input_path" in parameters:
            parameters["input_path"] = os.path.abspath(parameters["input_path"])
        return parameters
```

---

## 마이그레이션 계획

### 1단계: Wrapper 클래스 구현
- [ ] `BoundaryNodeWrapper` 구현
- [ ] `LogicNodeWrapper` 구현
- [ ] `BasicActionNodeWrapper` 구현
- [ ] `CustomNodeWrapper` 구현

### 2단계: 기존 노드 마이그레이션
- [ ] 경계 노드 마이그레이션 (`StartNode`)
- [ ] 로직 노드 마이그레이션 (`ConditionNode`, `RepeatNode`)
- [ ] 기본 액션 노드 마이그레이션 (`WaitNode`, `ClickNode`)
- [ ] 커스텀 노드 마이그레이션 (`FileReadNode`, `HttpApiRequestNode` 등)

### 3단계: 테스트 및 검증
- [ ] 각 wrapper별 단위 테스트 작성
- [ ] 통합 테스트 작성
- [ ] 성능 테스트

### 4단계: 문서화
- [ ] 개발자 가이드 작성
- [ ] 예제 코드 추가
- [ ] API 문서 업데이트

---

## 장점

1. **코드 재사용**: 공통 로직을 wrapper에 집중하여 중복 제거
2. **일관성**: 같은 카테고리의 노드들이 동일한 패턴으로 구현됨
3. **확장성**: 새로운 노드 추가 시 적절한 wrapper를 선택하여 빠르게 구현 가능
4. **유지보수성**: 각 wrapper별로 로직이 분리되어 유지보수 용이
5. **개발자 친화적**: 커스텀 노드 wrapper를 통해 외부 개발자도 쉽게 노드 추가 가능
6. **테스트 용이성**: 각 wrapper별로 독립적인 테스트 가능

---

## 참고 사항

- 모든 wrapper는 `BaseNode`를 상속받아 `NodeExecutor` 데코레이터와 호환됩니다
- Wrapper는 선택사항이며, 기존 방식(`BaseNode` 직접 상속)도 계속 사용 가능합니다
- Wrapper를 사용하면 공통 로직을 자동으로 처리하지만, 필요시 오버라이드 가능합니다
- 커스텀 노드 wrapper는 최대한 유연하게 설계되어 다양한 시나리오에 대응 가능합니다

