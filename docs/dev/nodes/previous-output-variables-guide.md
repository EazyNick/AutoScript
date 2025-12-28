# 이전 노드 출력 변수 사용 가이드

이 문서는 새로운 노드를 개발할 때, 이전 노드의 출력 값을 변수처럼 참조하여 파라미터에 사용하는 방법을 설명합니다.

## 개요

AutoScript는 이전 노드의 출력 값을 다음 노드의 파라미터로 사용할 수 있는 강력한 시스템을 제공합니다. 이를 통해 노드 간 데이터를 자동으로 전달하고, 워크플로우를 더욱 동적으로 만들 수 있습니다.

## 기본 개념

### 1. 필드 경로 (Field Path)

이전 노드의 출력에서 특정 값을 참조하기 위해 **필드 경로**를 사용합니다. 필드 경로는 점(`.`)으로 구분된 경로 문자열입니다.

**예시:**
```
output.execution_id        # output 객체의 execution_id 필드
output.data.value         # output.data 객체의 value 필드
output.results[0].title   # output.results 배열의 첫 번째 요소의 title 필드
```

### 2. 자동 경로 해석

서버 측에서 파라미터 값이 `"output."`으로 시작하는 경로 문자열이면 자동으로 이전 노드의 출력에서 값을 추출합니다.

**동작 방식:**
1. 사용자가 파라미터에 `"output.execution_id"` 입력
2. 서버에서 이전 노드 결과 확인
3. 경로를 따라 실제 값 추출: `previous_output["output"]["execution_id"]`
4. 추출된 값을 파라미터로 사용

## 파라미터 설정 방법

### 방법 1: `source: "previous_output"` 속성 사용 (권장)

파라미터에 `source: "previous_output"` 속성을 추가하면 UI에서 이전 노드 출력 변수를 선택할 수 있는 기능이 자동으로 활성화됩니다.

```python
"parameters": {
    "execution_id": {
        "type": "string",
        "label": "엑셀 실행 ID",
        "description": "엑셀 열기 노드의 출력에서 execution_id를 선택하거나 직접 입력하세요.",
        "default": "outdata.output.execution_id",
        "required": True,
        "placeholder": "이전 노드 출력에서 선택하거나 직접 입력",
        "source": "previous_output"  # 이전 노드 출력에서 선택 가능
    }
}
```

**특징:**
- 입력 필드 옆에 변수 선택 버튼(▼)이 자동으로 표시됩니다
- 버튼 클릭 시 이전 노드의 출력 변수 목록이 표시됩니다
- 변수 클릭 시 자동으로 필드 경로가 입력 필드에 삽입됩니다
- 직접 입력도 가능합니다 (필드 경로 또는 직접 값)

### 방법 2: `field_path` 파라미터 사용

조건 노드처럼 필드 경로를 직접 입력하는 파라미터의 경우, 자동으로 변수 선택 기능이 활성화됩니다.

```python
"parameters": {
    "field_path": {
        "type": "string",
        "label": "입력 필드",
        "description": "이전 노드 출력에서 비교할 필드 경로를 선택하거나 입력하세요.",
        "default": "",
        "required": False,
        "placeholder": "변수를 선택하거나 직접 입력하세요"
    }
}
```

**특징:**
- 파라미터 이름이 `field_path`이면 자동으로 변수 선택 UI가 활성화됩니다
- 자동완성 기능이 제공됩니다
- 이전 노드 출력 변수 목록이 자동완성 옵션으로 표시됩니다

## 실제 예시

### 예시 1: 엑셀 노드 (excel-select-sheet)

```python
"excel-select-sheet": {
    "label": "엑셀 시트 선택 노드",
    "title": "엑셀 시트 선택",
    "description": "엑셀 열기 노드로 열린 워크북의 특정 시트를 선택하는 노드입니다.",
    "script": "node-excel-select-sheet.js",
    "is_boundary": False,
    "category": "action",
    "parameters": {
        "execution_id": {
            "type": "string",
            "label": "엑셀 실행 ID",
            "description": "엑셀 열기 노드의 출력에서 execution_id를 선택하거나 직접 입력하세요.",
            "default": "outdata.output.execution_id",
            "required": True,
            "placeholder": "이전 노드 출력에서 선택하거나 직접 입력",
            "source": "previous_output"  # 이전 노드 출력에서 선택 가능
        },
        "sheet_name": {
            "type": "string",
            "label": "시트 이름",
            "description": "선택할 시트의 이름을 입력하세요.",
            "default": "",
            "required": False,
            "placeholder": "예: Sheet1"
        }
    }
}
```

**사용자 경험:**
1. 사용자가 노드 설정 모달을 엽니다
2. `execution_id` 필드 옆에 ▼ 버튼이 표시됩니다
3. 버튼을 클릭하면 이전 노드의 출력 변수 목록이 표시됩니다
4. 변수를 클릭하면 자동으로 `output.execution_id` 같은 경로가 입력됩니다
5. 직접 `output.execution_id`를 입력할 수도 있습니다

### 예시 2: 조건 노드 (condition)

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
                {"value": "not_equals", "label": "다름 (!=)"}
            ]
        },
        "field_path": {
            "type": "string",
            "label": "입력 필드",
            "description": "이전 노드 출력에서 비교할 필드 경로를 선택하거나 입력하세요.",
            "default": "",
            "required": False,
            "placeholder": "변수를 선택하거나 직접 입력하세요"
            # field_path는 자동으로 변수 선택 기능 활성화
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

**사용자 경험:**
1. `field_path` 필드에 자동완성 기능이 활성화됩니다
2. 입력 시 이전 노드의 출력 변수 목록이 제안됩니다
3. 변수를 선택하면 자동으로 필드 경로가 입력됩니다
4. 예: `output.wait_time`, `output.status` 등

## 서버 측 처리

### 자동 경로 해석

서버 측(`server/services/action_service.py`)에서 파라미터 값이 경로 문자열이면 자동으로 이전 노드 출력에서 값을 추출합니다.

```python
# server/services/action_service.py
if context:
    prev_result = context.get_previous_node_result()
    if prev_result and isinstance(prev_result, dict):
        # 이전 노드 결과를 outdata 구조로 래핑
        prev_result_wrapped = {"outdata": prev_result}
        
        # 범용 필드 경로 해석 유틸리티 사용
        from utils.field_path_resolver import resolve_parameter_paths
        
        # node_data의 모든 파라미터에서 경로 문자열 해석
        resolve_parameter_paths(node_data, prev_result_wrapped, current_indata)
```

### Python 노드에서 사용

Python 노드의 `execute` 메서드에서는 이미 해석된 실제 값이 전달됩니다.

```python
@NodeExecutor("my-node")
async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
    # 사용자가 "output.execution_id"를 입력했더라도
    # 이미 실제 값으로 해석되어 전달됨
    execution_id = get_parameter(parameters, "execution_id")
    # execution_id는 실제 값 (예: "20250101-120000-abc123")
    
    # 추가 처리...
    return {
        "action": "my-node",
        "status": "completed",
        "output": {"execution_id": execution_id}
    }
```

**중요:** Python 노드에서는 경로 문자열이 아닌 실제 값이 전달되므로, 별도의 경로 해석 로직이 필요 없습니다.

## UI 구현 세부사항

### 1. 변수 선택 버튼

`source: "previous_output"` 속성이 있으면 자동으로 변수 선택 버튼이 생성됩니다.

```javascript
// UI/src/pages/workflow/utils/parameter-form-generator.js
if (paramConfig.source === 'previous_output' || paramKey === 'field_path') {
    // 변수 선택 버튼이 있는 입력 필드 생성
    inputHtml = `
        <div style="position: relative; display: flex; gap: 8px;">
            <input 
                type="text" 
                id="${fieldId}"
                class="node-settings-input node-field-path-input"
                ...>
            <button 
                type="button" 
                id="${fieldId}-expand-btn"
                class="btn btn-small field-path-expand-btn">
                <span class="expand-icon">▼</span>
            </button>
        </div>
    `;
}
```

### 2. 변수 목록 표시

버튼 클릭 시 이전 노드의 출력 변수 목록이 표시됩니다.

```javascript
// UI/src/pages/workflow/modals/node-settings-modal.js
async updatePreviousNodeVariables(nodeId) {
    // 이전 노드 체인 가져오기
    const previousNodes = this.getPreviousNodeChain(nodeId);
    
    // 각 노드의 출력 변수 추출
    const nodeVariables = collectPreviousNodeVariables(previousNodes);
    
    // 변수 목록을 태그로 표시
    nodeVariables.forEach(({nodeName, variables}) => {
        variables.forEach((variable) => {
            // 변수 태그 생성 및 클릭 이벤트 바인딩
            // 클릭 시 입력 필드에 필드 경로 삽입
        });
    });
}
```

### 3. 자동완성

`field_path` 파라미터는 자동완성 기능이 제공됩니다.

```javascript
// 입력 시 이전 노드 출력 변수 목록을 datalist로 제공
const datalist = document.getElementById(`${fieldId}-datalist`);
nodeVariables.forEach(({variables}) => {
    variables.forEach((variable) => {
        const option = document.createElement('option');
        option.value = `output.${variable.key}`;
        datalist.appendChild(option);
    });
});
```

## 고급 사용법

### 1. 드롭다운 + 입력 하이브리드

`ui_type: "dropdown_input"` 속성을 추가하면 드롭다운으로 변수를 선택할 수 있습니다.

```python
"execution_id": {
    "type": "string",
    "label": "실행 ID",
    "source": "previous_output",
    "ui_type": "dropdown_input",  # 드롭다운 활성화
    "default": "outdata.output.execution_id"
}
```

**UI 특징:**
- 드롭다운에서 변수를 빠르게 선택
- 노드별로 그룹화되어 표시
- 변수 타입 아이콘 및 값 미리보기
- 직접 입력도 가능

### 2. 타입 검증 활성화

`validate_type: True`로 설정하면 타입 호환성 검증이 활성화됩니다.

```python
"count": {
    "type": "number",
    "label": "카운트",
    "source": "previous_output",
    "validate_type": True  # 타입 검증 활성화
}
```

**동작:**
- 호환되지 않는 타입의 변수는 자동으로 필터링
- 타입 불일치 시 경고 메시지 표시
- 실시간 타입 검증

### 3. 중첩된 필드 참조

점(`.`)을 사용하여 중첩된 객체의 필드에 접근할 수 있습니다.

```
output.data.execution_id
output.results[0].title
output.metadata.timestamp
```

### 4. 배열 요소 참조

배열 인덱스를 사용하여 배열 요소에 접근할 수 있습니다.

```
output.results[0]        # 첫 번째 요소
output.items[2].name     # 세 번째 요소의 name 필드
```

### 5. 기본값 설정

파라미터에 기본 경로를 설정할 수 있습니다.

```python
"execution_id": {
    "type": "string",
    "default": "outdata.output.execution_id",  # 기본 경로
    "source": "previous_output"
}
```

## 체크리스트

새로운 노드에서 이전 노드 출력 변수를 사용하려면:

- [ ] 파라미터에 `source: "previous_output"` 속성 추가 (또는 `field_path` 파라미터 사용)
- [ ] `description`에 사용 방법 설명 추가
- [ ] `placeholder`에 예시 경로 추가
- [ ] Python 노드에서 실제 값이 전달되는지 확인 (경로 해석은 자동)
- [ ] UI에서 변수 선택 버튼이 표시되는지 확인
- [ ] 변수 클릭 시 필드 경로가 올바르게 삽입되는지 확인
- [ ] 서버에서 경로가 올바르게 해석되는지 확인
- [ ] 실제 워크플로우에서 테스트

## 구현된 고급 기능

### 1. 드롭다운 + 입력 하이브리드 ✅

`ui_type: "dropdown_input"` 또는 `options_source: "previous_output"` 속성을 추가하면 드롭다운으로 변수를 선택할 수 있습니다.

```python
"execution_id": {
    "type": "string",
    "label": "엑셀 실행 ID",
    "source": "previous_output",
    "ui_type": "dropdown_input",  # 드롭다운 + 입력 하이브리드
    "options_source": "previous_output"  # 옵션을 이전 노드 출력에서 가져옴
}
```

**특징:**
- 드롭다운에서 변수를 빠르게 선택 가능
- 직접 입력도 가능
- 노드별로 그룹화되어 표시
- 변수 타입 아이콘 및 값 미리보기 표시

### 2. 변수 자동완성 개선 ✅

타입 기반 필터링과 값 미리보기가 구현되었습니다.

**구현된 기능:**
- ✅ 타입 기반 필터링: 파라미터 타입과 호환되는 변수만 제안
- ✅ 변수 값 미리보기: 드롭다운에서 변수 값 미리보기 표시
- ✅ 타입 아이콘: 변수 타입에 따른 아이콘 표시 (📝 문자열, 🔢 숫자, ✓ 불린 등)

### 4. 향후 개선 제안

#### 템플릿 변수 시스템

`{{variable_name}}` 같은 템플릿 문법을 지원할 수 있습니다.

```python
"message": {
    "type": "string",
    "label": "메시지",
    "description": "템플릿 변수를 사용할 수 있습니다.",
    "default": "Hello {{output.name}}!",
    "template_variables": True  # 템플릿 변수 지원 (향후 구현)
}
```

**사용 예시:**
```
"Hello {{output.name}}, your score is {{output.score}}"
```

#### 필드 경로 빌더

트리 형태로 필드 경로를 시각적으로 선택할 수 있는 UI를 제공할 수 있습니다.

**구현 아이디어:**
- 모달 또는 사이드 패널에 트리 뷰 표시
- 이전 노드 출력 구조를 트리로 표시
- 노드 클릭 시 필드 경로 자동 생성

### 3. 타입 검증 ✅

파라미터 타입과 이전 노드 출력 변수 타입을 자동으로 검증합니다.

```python
"count": {
    "type": "number",
    "label": "카운트",
    "source": "previous_output",
    "validate_type": True,  # 타입 검증 활성화 (기본값: true)
    "allowed_types": ["number", "integer"]  # 허용된 타입 (선택사항)
}
```

**구현된 기능:**
- ✅ 자동 타입 검증: 변수 선택 시 타입 호환성 자동 검사
- ✅ 경고 표시: 타입 불일치 시 노란색 경고 메시지 표시
- ✅ 타입 필터링: 호환되지 않는 타입의 변수는 자동으로 제외
- ✅ 실시간 검증: 입력 시 실시간으로 타입 검증

**타입 호환성 규칙:**
- `number` 타입: `number`, `integer` 변수 허용
- `string` 타입: 모든 타입 허용 (검증 비활성화)
- `boolean` 타입: `boolean` 변수만 허용
- `array` 타입: `array` 변수만 허용
- `object` 타입: `object` 변수만 허용

#### 다중 노드 참조

특정 노드의 출력을 명시적으로 참조할 수 있습니다.

```
node["엑셀 열기"].output.execution_id
node[0].output.value  # 첫 번째 노드
```

**구현 방법:**
- 노드 이름 또는 인덱스로 참조
- 자동완성에 노드 이름 포함

## 문제 해결

### 변수 선택 버튼이 표시되지 않는 경우

1. `source: "previous_output"` 속성이 올바르게 설정되었는지 확인
2. 파라미터 이름이 `field_path`인지 확인
3. 브라우저 콘솔에서 에러 확인

### 경로가 해석되지 않는 경우

1. 이전 노드가 연결되어 있는지 확인
2. 이전 노드가 실행되었는지 확인 (실행 결과가 있어야 함)
3. 경로 문자열이 올바른 형식인지 확인 (`output.`으로 시작)
4. 서버 로그에서 경로 해석 과정 확인

### 값이 전달되지 않는 경우

1. Python 노드에서 `get_parameter()` 사용 확인
2. 파라미터 키가 올바른지 확인
3. 서버 로그에서 실제 전달된 값 확인
4. 경로 해석이 성공했는지 확인

## 참고 자료

- [필드 경로 해석 유틸리티](../../../server/utils/field_path_resolver.py): 서버 측 경로 해석 로직
- [파라미터 폼 생성기](../../../UI/src/pages/workflow/utils/parameter-form-generator.js): UI 폼 생성 로직
- [노드 출력 파서](../../../UI/src/pages/workflow/utils/node-output-parser.js): 이전 노드 출력 변수 추출
- [노드 설정 모달](../../../UI/src/pages/workflow/modals/node-settings-modal.js): 변수 선택 UI 구현

