# 파라미터 선택 옵션 가이드

이 문서는 새로운 노드를 개발할 때, UI에서 사용자가 파라미터를 선택할 수 있도록 하는 방법을 설명합니다.

## 개요

AutoScript의 노드 시스템은 `nodes_config.py`에서 정의한 파라미터 설정을 기반으로 자동으로 UI 폼을 생성합니다. 파라미터에 `options` 배열을 추가하면 자동으로 드롭다운 선택 메뉴가 생성됩니다.

## 기본 구조

파라미터 선택 옵션은 `server/config/nodes_config.py` 파일의 `parameters` 섹션에서 정의합니다.

```python
"parameters": {
    "parameter_name": {
        "type": "options",  # 또는 "string" (options가 있으면 자동으로 select로 변환)
        "label": "파라미터 이름",
        "description": "파라미터 설명",
        "default": "기본값",
        "required": True,
        "options": [
            {"value": "option1", "label": "옵션 1"},
            {"value": "option2", "label": "옵션 2"},
            {"value": "option3", "label": "옵션 3"}
        ]
    }
}
```

## 파라미터 타입

### 1. `options` 타입 (드롭다운 선택)

사용자가 미리 정의된 옵션 중에서 선택할 수 있는 드롭다운 메뉴를 생성합니다.

```python
"condition_type": {
    "type": "options",
    "label": "조건 타입",
    "description": "평가할 조건의 타입을 선택하세요.",
    "default": "equals",
    "required": True,
    "options": [
        {"value": "equals", "label": "같음 (=)"},
        {"value": "not_equals", "label": "다름 (!=)"},
        {"value": "contains", "label": "포함됨 (contains)"},
        {"value": "not_contains", "label": "포함되지 않음 (!contains)"},
        {"value": "greater_than", "label": "더 큼 (>)"},
        {"value": "less_than", "label": "더 작음 (<)"},
        {"value": "greater_or_equal", "label": "크거나 같음 (>=)"},
        {"value": "less_or_equal", "label": "작거나 같음 (<=)"},
        {"value": "is_empty", "label": "비어있음"},
        {"value": "is_not_empty", "label": "비어있지 않음"}
    ]
}
```

**특징:**
- `type`을 `"options"`로 설정하거나 `"string"`으로 설정하고 `options` 배열을 추가하면 됩니다
- `options` 배열이 있으면 자동으로 `<select>` 드롭다운으로 렌더링됩니다
- 각 옵션은 `{"value": "실제값", "label": "표시할 텍스트"}` 형태의 객체입니다
- 옵션이 문자열 배열인 경우도 지원됩니다: `["option1", "option2"]`

### 2. `string` 타입 + `options` 배열

`type`이 `"string"`이어도 `options` 배열이 있으면 자동으로 드롭다운으로 변환됩니다.

```python
"encoding": {
    "type": "string",
    "label": "인코딩",
    "description": "파일 인코딩을 선택하세요.",
    "default": "utf-8",
    "required": False,
    "options": ["utf-8", "utf-16", "ascii", "latin-1"]
}
```

**간단한 옵션 (문자열 배열):**
옵션이 단순한 문자열 배열인 경우, `value`와 `label`이 동일하게 사용됩니다.

```python
"mode": {
    "type": "string",
    "label": "작성 모드",
    "description": "파일 작성 모드를 선택하세요.",
    "default": "write",
    "required": False,
    "options": ["write", "append"]  # value와 label이 동일
}
```

### 3. `number` 타입 (숫자 범위)

숫자 입력 필드에 `min`과 `max`를 설정하여 범위를 제한할 수 있습니다.

```python
"wait_time": {
    "type": "number",
    "label": "대기 시간 (초)",
    "description": "대기할 시간을 초 단위로 입력하세요.",
    "default": 1,
    "min": 0,
    "max": 3600,
    "required": True
}
```

### 4. `boolean` 타입 (체크박스)

체크박스로 표시됩니다.

```python
"visible": {
    "type": "boolean",
    "label": "엑셀 창 표시",
    "description": "엑셀 창을 표시할지 여부입니다.",
    "default": True,
    "required": False
}
```

## 실제 예시

### 예시 1: 조건 노드 (condition)

```python
"condition": {
    "label": "조건 노드",
    "title": "조건 노드",
    "description": "이전 노드의 출력을 받아서 조건을 평가하는 노드입니다.",
    "script": "node-condition.js",
    "is_boundary": False,
    "category": "logic",
    "parameters": {
        "condition_type": {
            "type": "options",
            "label": "조건 타입",
            "description": "평가할 조건의 타입을 선택하세요.",
            "default": "equals",
            "required": True,
            "options": [
                {"value": "equals", "label": "같음 (=)"},
                {"value": "not_equals", "label": "다름 (!=)"},
                {"value": "contains", "label": "포함됨 (contains)"},
                {"value": "not_contains", "label": "포함되지 않음 (!contains)"},
                {"value": "greater_than", "label": "더 큼 (>)"},
                {"value": "less_than", "label": "더 작음 (<)"},
                {"value": "greater_or_equal", "label": "크거나 같음 (>=)"},
                {"value": "less_or_equal", "label": "작거나 같음 (<=)"},
                {"value": "is_empty", "label": "비어있음"},
                {"value": "is_not_empty", "label": "비어있지 않음"}
            ]
        },
        "field_path": {
            "type": "string",
            "label": "입력 필드",
            "description": "이전 노드 출력에서 비교할 필드 경로를 선택하거나 입력하세요.",
            "default": "",
            "required": False,
            "placeholder": "변수를 선택하거나 직접 입력하세요"
        },
        "compare_value": {
            "type": "string",
            "label": "비교할 값",
            "description": "조건을 만족하는지 확인할 값을 입력하세요.",
            "default": "",
            "required": True,
            "placeholder": "비교할 값을 입력하세요"
        }
    }
}
```

### 예시 2: 엑셀 열기 노드 (excel-open)

```python
"excel-open": {
    "label": "엑셀 열기 노드",
    "title": "엑셀 열기",
    "description": "win32를 사용하여 엑셀 파일을 열는 노드입니다.",
    "script": "node-excel-open.js",
    "is_boundary": False,
    "category": "action",
    "parameters": {
        "file_path": {
            "type": "string",
            "label": "엑셀 파일 경로",
            "description": "열 엑셀 파일의 경로를 입력하세요.",
            "default": "",
            "required": True,
            "placeholder": "예: C:\\data\\file.xlsx"
        },
        "visible": {
            "type": "boolean",
            "label": "엑셀 창 표시",
            "description": "엑셀 창을 표시할지 여부입니다.",
            "default": True,
            "required": False
        }
    }
}
```

## 옵션 형식

### 형식 1: 객체 배열 (권장)

각 옵션에 `value`(실제 값)와 `label`(표시할 텍스트)을 분리하여 사용할 수 있습니다.

```python
"options": [
    {"value": "internal_value", "label": "사용자에게 보이는 텍스트"},
    {"value": "another_value", "label": "다른 옵션 텍스트"}
]
```

**장점:**
- 내부적으로 사용하는 값과 사용자에게 보이는 텍스트를 분리할 수 있습니다
- 코드에서 사용하는 값이 사용자 친화적이지 않아도 됩니다
- 다국어 지원이 용이합니다

### 형식 2: 문자열 배열

옵션이 단순한 문자열 배열인 경우, `value`와 `label`이 동일하게 사용됩니다.

```python
"options": ["option1", "option2", "option3"]
```

**장점:**
- 간단하고 직관적입니다
- 값과 표시 텍스트가 동일한 경우에 적합합니다

## UI 렌더링

파라미터 폼은 `UI/src/pages/workflow/utils/parameter-form-generator.js`에서 자동으로 생성됩니다.

### 자동 변환 규칙

1. **`type: "options"` 또는 `options` 배열이 있는 경우:**
   - 자동으로 `<select>` 드롭다운으로 렌더링됩니다
   - 각 옵션은 `<option>` 태그로 변환됩니다

2. **`type: "string"` + `options` 배열:**
   - `options` 배열이 있으면 자동으로 드롭다운으로 변환됩니다
   - `options` 배열이 없으면 텍스트 입력 필드로 렌더링됩니다

3. **`type: "number"` + `min`/`max`:**
   - 숫자 입력 필드에 `min`과 `max` 속성이 추가됩니다
   - HTML5 `number` 입력 필드로 렌더링됩니다

4. **`type: "boolean"`:**
   - 체크박스로 렌더링됩니다

### 생성되는 HTML 예시

```html
<!-- options 타입 파라미터 -->
<div class="form-group node-settings-form-group">
    <label for="node-condition_type">
        조건 타입 <span style="color: red;">*</span>
    </label>
    <select 
        id="node-condition_type" 
        required
        class="node-settings-select"
        style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
        <option value="equals" selected>같음 (=)</option>
        <option value="not_equals">다름 (!=)</option>
        <option value="contains">포함됨 (contains)</option>
        <!-- ... -->
    </select>
    <small class="node-settings-help-text">
        평가할 조건의 타입을 선택하세요.
    </small>
</div>
```

## 파라미터 값 추출

노드 설정 모달에서 사용자가 선택한 값은 자동으로 추출되어 노드 데이터에 저장됩니다.

### 값 추출 과정

1. 사용자가 드롭다운에서 옵션을 선택합니다
2. `extractParameterValues()` 함수가 폼에서 값을 추출합니다
3. 추출된 값이 노드의 `parameters` 객체에 저장됩니다

### 저장되는 형식

```javascript
{
    "id": "node-123",
    "type": "condition",
    "parameters": {
        "condition_type": "equals",  // 선택된 옵션의 value
        "field_path": "output.status",
        "compare_value": "completed"
    }
}
```

## Python 노드에서 파라미터 사용

Python 노드의 `execute` 메서드에서 파라미터를 받을 때, 선택된 옵션의 `value`가 전달됩니다.

```python
@NodeExecutor("my-node")
async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
    # options에서 선택된 value가 전달됨
    condition_type = get_parameter(parameters, "condition_type", default="equals")
    # condition_type은 "equals", "not_equals" 등의 실제 값
    
    # 옵션에 따라 분기 처리
    if condition_type == "equals":
        # ...
    elif condition_type == "not_equals":
        # ...
    
    return {
        "action": "my-node",
        "status": "completed",
        "output": {"condition_type": condition_type}
    }
```

## 고급 기능

### 1. 동적 옵션 (향후 지원 예정)

현재는 정적 옵션만 지원하지만, 향후 동적으로 옵션을 생성하는 기능이 추가될 수 있습니다.

### 2. 조건부 파라미터 표시

특정 옵션을 선택했을 때만 다른 파라미터를 표시하는 기능은 현재 지원되지 않습니다. 필요하다면 JavaScript에서 직접 처리해야 합니다.

### 3. 이전 노드 출력에서 선택

`source: "previous_output"` 속성을 사용하면 이전 노드의 출력에서 값을 선택할 수 있습니다.

```python
"execution_id": {
    "type": "string",
    "label": "엑셀 실행 ID",
    "description": "엑셀 열기 노드의 출력에서 execution_id를 선택하거나 직접 입력하세요.",
    "default": "outdata.output.execution_id",
    "required": True,
    "placeholder": "이전 노드 출력에서 선택하거나 직접 입력",
    "source": "previous_output"  # 이전 노드 출력에서 선택 가능
}
```

## 체크리스트

새로운 노드를 개발할 때 파라미터 선택 옵션을 추가하려면:

- [ ] `server/config/nodes_config.py`에 노드 설정 추가
- [ ] `parameters` 섹션에 파라미터 정의
- [ ] 선택 옵션이 필요한 파라미터에 `options` 배열 추가
- [ ] 각 옵션에 `value`와 `label` 설정 (또는 문자열 배열 사용)
- [ ] `default` 값 설정 (옵션 중 하나여야 함)
- [ ] Python 노드에서 선택된 `value` 처리 로직 구현
- [ ] 테스트: UI에서 드롭다운이 올바르게 표시되는지 확인
- [ ] 테스트: 선택한 값이 노드 데이터에 올바르게 저장되는지 확인
- [ ] 테스트: Python 노드에서 선택된 값이 올바르게 전달되는지 확인

## 이전 노드 출력 변수 사용

파라미터에 이전 노드의 출력 값을 변수처럼 사용하고 싶다면, [이전 노드 출력 변수 사용 가이드](./previous-output-variables-guide.md)를 참고하세요.

**간단한 예시:**
```python
"execution_id": {
    "type": "string",
    "label": "실행 ID",
    "source": "previous_output",  # 이전 노드 출력에서 선택 가능
    "default": "outdata.output.execution_id"
}
```

이렇게 설정하면 UI에서 이전 노드의 출력 변수를 선택할 수 있는 버튼이 자동으로 표시됩니다.

## 참고 자료

- [노드 생성 가이드](./creating-nodes-python.md): 노드 생성 전체 프로세스
- [이전 노드 출력 변수 사용 가이드](./previous-output-variables-guide.md): 이전 노드 출력을 변수로 사용하는 방법
- [파라미터 폼 생성기](../../../UI/src/pages/workflow/utils/parameter-form-generator.js): UI 폼 생성 로직
- [노드 설정 파일](../../../server/config/nodes_config.py): 실제 노드 설정 예시

## 문제 해결

### 드롭다운이 표시되지 않는 경우

1. `options` 배열이 올바르게 정의되었는지 확인
2. `type`이 `"options"` 또는 `"string"`인지 확인
3. 브라우저 콘솔에서 에러 확인

### 선택한 값이 저장되지 않는 경우

1. `extractParameterValues()` 함수가 올바르게 호출되는지 확인
2. 파라미터 키가 올바른지 확인
3. 노드 데이터 구조 확인

### Python에서 값이 전달되지 않는 경우

1. 노드 실행 시 전달되는 `parameters` 객체 확인
2. `get_parameter()` 함수 사용 확인
3. 서버 로그에서 실제 전달된 값 확인

