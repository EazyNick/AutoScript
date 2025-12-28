# 현재 Wrapper 사용 현황 분석

## 개요

현재 코드베이스에서 wrapper가 어떻게 사용되고 있는지 분석한 문서입니다. 새로운 wrapper 설계와 비교하여 개선점을 파악하기 위한 참고 자료입니다.

**작성일**: 2025-01-XX  
**분석 대상**: `server/nodes/` 디렉토리의 모든 노드

---

## 현재 Wrapper 구조

### 1. NodeExecutor 데코레이터

**위치**: `server/nodes/node_executor_wrapper.py`

**역할**: 모든 노드의 `execute` 메서드를 래핑하여 공통 기능 제공

**제공 기능**:
1. **파라미터 검증 및 정규화**
   - `None` 파라미터를 빈 딕셔너리로 변환
   - `validate_parameters()` 호출

2. **로깅**
   - 실행 시작/완료/실패 로그 자동 전송
   - 실행 시간 측정
   - 로그 클라이언트를 통한 비동기 로그 전송

3. **에러 처리**
   - 예외 발생 시 자동으로 실패 결과 반환
   - 스택 트레이스 기록
   - `create_failed_result()` 사용

4. **결과 정규화**
   - `None` 또는 dict가 아닌 결과를 표준 형식으로 변환
   - `normalize_result()` 사용

5. **자동 핸들러 등록**
   - `wrapper.action_name` 속성 추가
   - ActionService에서 자동으로 핸들러 등록

**사용 패턴**:
```python
class MyNode(BaseNode):
    @staticmethod
    @NodeExecutor("my-action")
    async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
        # 노드 로직 구현
        return {"action": "my-action", "status": "completed", "output": {...}}
```

---

### 2. BaseNode 추상 클래스

**위치**: `server/nodes/base_node.py`

**역할**: 모든 노드의 기본 클래스

**제공 기능**:
1. **추상 메서드 강제**
   - `execute()` 메서드를 반드시 구현하도록 강제
   - `@abstractmethod` 데코레이터 사용

2. **공통 유틸리티 메서드**
   - `_validate_and_normalize_parameters()`: 파라미터 검증
   - `_create_result()`: 표준 형식 결과 생성

3. **로거 프로퍼티**
   - `self.logger`: 노드에서 사용할 로거 인스턴스

**사용 패턴**:
```python
class MyNode(BaseNode):
    @staticmethod
    @NodeExecutor("my-action")
    async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
        # BaseNode의 유틸리티 사용 가능
        validated = BaseNode._validate_and_normalize_parameters(parameters)
        return BaseNode._create_result("my-action", "completed", {...})
```

---

## 현재 노드 구현 패턴 분석

### 패턴 1: 경계 노드 (Boundary Nodes)

**대상**: `StartNode`

**특징**:
- 파라미터가 없거나 매우 단순
- 이전 노드 출력을 받지 않음
- 단순 실행 및 결과 반환

**현재 구현**:
```python
class StartNode(BaseNode):
    @staticmethod
    @NodeExecutor("start")
    async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
        time_str = get_korea_time_str()
        logger.info(f"[StartNode] 워크플로우 시작 - 시작 시간: {time_str}")
        
        return {
            "action": "start",
            "status": "completed",
            "output": {"time": time_str, "message": "워크플로우가 시작되었습니다."},
        }
```

**공통 패턴**:
- 파라미터 검증 없음 (또는 최소화)
- 직접 결과 딕셔너리 반환
- 로깅은 수동으로 수행

---

### 패턴 2: 로직 노드 (Logic Nodes)

**대상**: `ConditionNode`, `RepeatNode`

**특징**:
- 워크플로우 실행 흐름 제어
- 이전 노드 출력 활용
- 복잡한 조건 평가 또는 반복 로직

**현재 구현 - ConditionNode**:
```python
class ConditionNode(BaseNode):
    @staticmethod
    @NodeExecutor("condition")
    async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
        # 파라미터 추출
        condition_type = get_parameter(parameters, "condition_type", default="equals")
        field_path = get_parameter(parameters, "field_path", default="")
        compare_value = get_parameter(parameters, "compare_value", default="")
        previous_output = get_parameter(parameters, "previous_output", default=None)
        
        # 필드 경로 파싱 (수동 구현)
        actual_value = previous_output
        if field_path:
            keys = field_path.split(".")
            for key in keys:
                if isinstance(actual_value, dict):
                    actual_value = actual_value.get(key)
                else:
                    actual_value = None
                    break
        
        # 조건 평가
        result = ConditionNode._evaluate_condition(condition_type, actual_value, compare_value)
        
        return {
            "action": "condition",
            "status": "completed",
            "output": {"result": result, ...}
        }
```

**현재 구현 - RepeatNode**:
```python
class RepeatNode(BaseNode):
    @staticmethod
    @NodeExecutor("repeat")
    async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
        # 파라미터 추출 및 검증
        repeat_count = get_parameter(parameters, "repeat_count", default=1)
        if not isinstance(repeat_count, (int, float)) or repeat_count < 1:
            logger.warning(f"[RepeatNode] 잘못된 반복 횟수: {repeat_count}, 기본값 1 사용")
            repeat_count = 1
        repeat_count = int(repeat_count)
        
        return {
            "action": "repeat",
            "status": "completed",
            "output": {
                "repeat_count": repeat_count,
                "completed": True,
                "iterations": []
            }
        }
```

**공통 패턴**:
- `get_parameter()`로 파라미터 추출
- 이전 노드 출력 파싱 로직이 각 노드에 중복
- 필드 경로 파싱이 ConditionNode에만 구현됨
- 파라미터 검증 로직이 각 노드에 분산

---

### 패턴 3: 기본 액션 노드 (Basic Action Nodes)

**대상**: `WaitNode`, `ClickNode`, `ProcessFocusNode`

**특징**:
- 기본적인 파라미터만 사용
- 단순하고 직접적인 액션 수행
- 빠른 실행

**현재 구현 - WaitNode**:
```python
class WaitNode(BaseNode):
    @staticmethod
    @NodeExecutor("wait")
    async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
        # 파라미터 추출 및 검증
        wait_time_raw = get_parameter(parameters, "wait_time", default=1)
        if wait_time_raw is None:
            wait_time_raw = 1
        try:
            wait_time = float(wait_time_raw)
            if wait_time < 0:
                wait_time = 0
        except (ValueError, TypeError):
            wait_time = 1
        
        logger.info(f"[WaitNode] {wait_time}초 대기 시작")
        await asyncio.sleep(wait_time)
        logger.info(f"[WaitNode] {wait_time}초 대기 완료")
        
        return {
            "action": "wait",
            "wait_time": wait_time,
            "status": "completed",
            "message": f"{wait_time}초 대기 완료",
            "output": {"wait_time": wait_time}
        }
```

**현재 구현 - ClickNode**:
```python
class ClickNode(BaseNode):
    @staticmethod
    @NodeExecutor("click")
    async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
        x = get_parameter(parameters, "x", default=0)
        y = get_parameter(parameters, "y", default=0)
        
        return {"action": "click", "status": "completed", "output": {"x": x, "y": y}}
```

**공통 패턴**:
- `get_parameter()`로 파라미터 추출
- 기본값 처리 로직이 각 노드에 분산
- 타입 변환 및 검증 로직이 각 노드에 중복
- 매우 단순한 노드는 거의 로직 없음

---

### 패턴 4: 커스텀 노드 (Custom Nodes)

**대상**: `HttpApiRequestNode`, `ImageTouchNode`, `ExcelOpenNode`, `ExcelCloseNode`

**특징**:
- 복잡한 파라미터 검증
- 외부 라이브러리 사용
- 에러 처리 로직이 복잡
- 전처리/후처리 필요

**현재 구현 - HttpApiRequestNode**:
```python
class HttpApiRequestNode(BaseNode):
    @staticmethod
    @NodeExecutor("http-api-request")
    async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
        # Pydantic 모델로 입력 검증
        try:
            validated_params = HttpApiRequestParams(**parameters)
        except Exception as e:
            return create_failed_result(
                action="http-api-request",
                reason="validation_error",
                message=f"파라미터 검증 실패: {e!s}",
            )
        
        # 검증된 파라미터 사용
        url = validated_params.url
        method = validated_params.method
        # ... HTTP 요청 수행
        
        return {
            "action": "http-api-request",
            "status": "completed" if success else "failed",
            "output": {...}
        }
```

**현재 구현 - ImageTouchNode**:
```python
class ImageTouchNode(BaseNode):
    @staticmethod
    @NodeExecutor("image-touch")
    async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
        # 파라미터 추출
        folder_path = get_parameter(parameters, "folder_path", default="")
        
        # 파라미터 검증
        if not folder_path:
            return create_failed_result(
                action="image-touch",
                reason="no_folder",
                message="폴더 경로가 제공되지 않았습니다."
            )
        
        if not os.path.exists(folder_path):
            raise ValueError(f"폴더를 찾을 수 없습니다: {folder_path}")
        
        # 이미지 파일 목록 가져오기
        image_files = []
        for filename in os.listdir(folder_path):
            # ... 이미지 파일 필터링
        
        # 이미지 찾기 및 터치 로직
        # ...
        
        return {
            "action": "image-touch",
            "status": "completed" if success else "failed",
            "output": {...}
        }
```

**현재 구현 - ExcelOpenNode**:
```python
class ExcelOpenNode(BaseNode):
    @staticmethod
    @NodeExecutor("excel-open")
    async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
        # win32com 설치 확인
        if win32com is None:
            return create_failed_result(...)
        
        # 파라미터 추출
        file_path = get_parameter(parameters, "file_path", default="")
        visible = get_parameter(parameters, "visible", default=True)
        
        # 파일 경로 검증
        if not file_path:
            return create_failed_result(...)
        
        file_path = os.path.normpath(file_path)
        
        if not os.path.exists(file_path):
            return create_failed_result(...)
        
        # 엑셀 파일 열기
        # ...
        
        return {
            "action": "excel-open",
            "status": "completed",
            "output": {...}
        }
```

**현재 구현 - ExcelCloseNode**:
```python
class ExcelCloseNode(BaseNode):
    @staticmethod
    @NodeExecutor("excel-close")
    async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
        # 파라미터 추출
        save_changes = get_parameter(parameters, "save_changes", default=False)
        
        # execution_id 추출 (우선순위: 사용자 입력 > 이전 노드 출력 > 메타데이터)
        execution_id = (
            get_parameter(parameters, "execution_id", default="")
            or parameters.get("_execution_id_from_prev")
            or parameters.get("_execution_id")
        )
        
        if not execution_id:
            return create_failed_result(...)
        
        # 엑셀 객체 가져오기 및 닫기
        # ...
        
        return {
            "action": "excel-close",
            "status": "completed",
            "output": {...}
        }
```

**공통 패턴**:
- 파라미터 검증 로직이 각 노드에 중복
- 파일 경로 검증이 여러 노드에 반복
- `create_failed_result()`를 수동으로 호출
- 에러 처리 로직이 각 노드에 분산
- 전처리/후처리 로직이 execute 메서드 내부에 혼재

---

## 공통 유틸리티 사용 현황

### 1. get_parameter()

**위치**: `server/utils/parameter_validator.py`

**사용 빈도**: 거의 모든 노드에서 사용

**사용 예시**:
```python
# 기본값과 함께 사용
wait_time = get_parameter(parameters, "wait_time", default=1.0)

# 기본값 없이 사용 (None 가능)
previous_output = get_parameter(parameters, "previous_output", default=None)
```

**패턴**:
- 모든 노드에서 파라미터 추출 시 사용
- 기본값 처리를 위해 필수
- 타입 검증은 각 노드에서 수동으로 수행

---

### 2. create_failed_result()

**위치**: `server/utils/result_formatter.py`

**사용 빈도**: 커스텀 노드에서 주로 사용

**사용 예시**:
```python
if not folder_path:
    return create_failed_result(
        action="image-touch",
        reason="no_folder",
        message="폴더 경로가 제공되지 않았습니다."
    )
```

**패턴**:
- 파라미터 검증 실패 시 사용
- 파일/리소스 없음 시 사용
- 외부 라이브러리 미설치 시 사용

---

### 3. validate_parameters()

**위치**: `server/utils/parameter_validator.py`

**사용 빈도**: NodeExecutor에서 자동 호출

**역할**:
- `None` 파라미터를 빈 딕셔너리로 변환
- 노드에서 직접 호출하는 경우는 거의 없음

---

### 4. normalize_result()

**위치**: `server/utils/result_formatter.py`

**사용 빈도**: NodeExecutor에서 자동 호출

**역할**:
- `None` 또는 dict가 아닌 결과를 표준 형식으로 변환
- 노드에서 직접 호출하는 경우는 거의 없음

---

## 현재 구조의 장단점

### 장점

1. **단순성**
   - 모든 노드가 동일한 패턴 사용
   - BaseNode + NodeExecutor 조합으로 일관성 유지

2. **유연성**
   - 각 노드가 자유롭게 로직 구현 가능
   - 제약이 적어 다양한 시나리오 대응 가능

3. **자동화**
   - NodeExecutor가 로깅, 에러 처리, 결과 정규화 자동 수행
   - 개발자가 신경 쓸 부분 최소화

4. **명확성**
   - 각 노드의 execute 메서드만 보면 전체 로직 파악 가능
   - 추상화 레벨이 낮아 디버깅 용이

---

### 단점

1. **코드 중복**
   - 파라미터 검증 로직이 각 노드에 중복
   - 필드 경로 파싱이 ConditionNode에만 구현
   - 파일 경로 검증이 여러 노드에 반복

2. **일관성 부족**
   - 같은 패턴의 노드들이 서로 다른 방식으로 구현
   - 에러 처리 방식이 노드마다 다름

3. **확장성 제한**
   - 새로운 노드 추가 시 매번 전체 로직 구현 필요
   - 공통 로직을 재사용하기 어려움

4. **유지보수 어려움**
   - 공통 로직 변경 시 모든 노드 수정 필요
   - 버그 수정 시 여러 파일 수정 필요

---

## 노드별 구현 패턴 요약

| 노드 타입 | 노드 예시 | 파라미터 검증 | 에러 처리 | 공통 로직 재사용 |
|----------|----------|--------------|----------|----------------|
| **경계 노드** | StartNode | 없음 | NodeExecutor | 없음 |
| **로직 노드** | ConditionNode, RepeatNode | 수동 | NodeExecutor | 없음 (필드 경로 파싱 중복) |
| **기본 액션** | WaitNode, ClickNode | 수동 | NodeExecutor | 없음 (기본값 처리 중복) |
| **커스텀** | HttpApiRequestNode, ImageTouchNode | Pydantic 또는 수동 | 수동 + NodeExecutor | 없음 (파일 경로 검증 중복) |

---

## 현재 구조의 실행 흐름

```
1. ActionService.process_node()
   ↓
2. NodeExecutor.wrapper() (데코레이터)
   ├─ 파라미터 검증 (validate_parameters)
   ├─ 로깅 시작 (send_log_async)
   ├─ 노드 실행 (노드의 execute 메서드)
   │  ├─ 파라미터 추출 (get_parameter)
   │  ├─ 파라미터 검증 (수동)
   │  ├─ 비즈니스 로직 실행
   │  └─ 결과 반환
   ├─ 결과 정규화 (normalize_result)
   ├─ 로깅 완료 (send_log_async)
   └─ 결과 반환
```

---

## 개선이 필요한 부분

### 1. 파라미터 검증 중복

**현재 문제**:
- 파일 경로 검증이 `ImageTouchNode`, `ExcelOpenNode` 등에 중복
- 숫자 파라미터 검증이 `WaitNode`, `RepeatNode` 등에 중복
- 필수 파라미터 체크가 각 노드에 분산

**개선 방향**:
- Wrapper에서 공통 검증 로직 제공
- 파라미터 스키마 기반 자동 검증

---

### 2. 필드 경로 파싱 중복

**현재 문제**:
- `ConditionNode`에만 필드 경로 파싱 로직 존재
- 다른 노드에서 이전 노드 출력 파싱 시 재구현 필요

**개선 방향**:
- LogicNodeWrapper에서 공통 유틸리티 제공
- `_parse_field_path()` 메서드 공유

---

### 3. 에러 처리 일관성 부족

**현재 문제**:
- 일부 노드는 `create_failed_result()` 사용
- 일부 노드는 예외 발생 후 NodeExecutor가 처리
- 에러 메시지 형식이 노드마다 다름

**개선 방향**:
- Wrapper에서 일관된 에러 처리 제공
- 공통 에러 타입 정의

---

### 4. 기본값 처리 중복

**현재 문제**:
- 각 노드에서 기본값 처리 로직이 중복
- 타입 변환 로직이 각 노드에 분산

**개선 방향**:
- Wrapper에서 기본값 자동 적용
- 타입 변환 유틸리티 제공

---

## 현재 vs 새로운 설계 비교

| 항목 | 현재 구조 | 새로운 설계 (제안) |
|------|----------|-------------------|
| **Wrapper 종류** | NodeExecutor (단일) | 4가지 Wrapper (Boundary, Logic, Basic, Custom) |
| **파라미터 검증** | 각 노드에서 수동 | Wrapper에서 자동 또는 스키마 기반 |
| **공통 로직 재사용** | 제한적 | Wrapper별 공통 로직 제공 |
| **코드 중복** | 많음 | 최소화 |
| **확장성** | 낮음 | 높음 (CustomNodeWrapper) |
| **일관성** | 낮음 | 높음 (Wrapper별 패턴) |
| **학습 곡선** | 낮음 | 중간 (Wrapper 선택 필요) |

---

## 마이그레이션 시 고려사항

### 1. 기존 노드 호환성

- 현재 모든 노드는 `BaseNode` + `NodeExecutor` 조합
- 새로운 Wrapper는 선택사항으로 제공
- 기존 노드는 그대로 유지 가능

### 2. 점진적 마이그레이션

- 한 번에 모든 노드를 마이그레이션하지 않음
- 노드별로 필요에 따라 선택적 마이그레이션
- 새로운 노드는 Wrapper 사용 권장

### 3. 공통 로직 추출

- 기존 노드에서 공통 패턴 식별
- Wrapper로 공통 로직 이동
- 기존 노드는 Wrapper 사용하도록 리팩토링

---

## 결론

현재 구조는 **단순하고 유연**하지만, **코드 중복과 일관성 부족** 문제가 있습니다. 새로운 Wrapper 설계는 이러한 문제를 해결하면서도 **기존 구조의 장점을 유지**할 수 있도록 설계되었습니다.

**권장 사항**:
1. 새로운 노드는 적절한 Wrapper 사용
2. 기존 노드는 점진적으로 Wrapper로 마이그레이션
3. 공통 로직은 Wrapper로 이동하여 재사용성 향상

