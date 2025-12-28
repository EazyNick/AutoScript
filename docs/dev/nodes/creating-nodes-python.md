**최신 수정일자: 2025.12.21**

> **참고**: 반복 노드(Repeat Node)는 특수한 연결점과 실행 로직을 가진 노드의 예시입니다. 특수 기능이 필요한 노드를 만들 때는 "6. 특수 기능 노드 구현" 섹션을 참고하세요.

# Python 노드 생성 가이드

Python (서버)에서 커스텀 노드를 만드는 방법을 설명합니다.

## 빠른 시작

새로운 노드를 추가하는 방법은 두 가지가 있습니다:

### 방법 1: 스크립트 사용 (권장) ⚡

노드 생성 스크립트를 사용하면 자동으로 템플릿 파일을 생성합니다:

```bash
python scripts/create-node.py --name my-node --category action --description "내 노드 설명"
```

#### 파라미터 설명

- **`--name`** (필수): 노드 타입 이름 (케밥 케이스, 예: `my-node`)
  - Python 파일명은 스네이크 케이스로 변환됩니다 (`my_node.py`)
  - JavaScript 파일명은 `node-{name}.js` 형식으로 생성됩니다 (`node-my-node.js`)
  - `@NodeExecutor` 데코레이터와 `nodes_config.py`의 노드 타입으로 사용됩니다

- **`--category`** (필수): 노드 카테고리
  - 기본 카테고리: `action`, `logic`, `wait`, `image`, `boundary`
  - 각 기본 카테고리는 다음 디렉토리에 생성됩니다:
    - `action` → `server/nodes/actionnodes/`
    - `logic` → `server/nodes/conditionnodes/`
    - `wait` → `server/nodes/waitnodes/`
    - `image` → `server/nodes/imagenodes/`
    - `boundary` → `server/nodes/boundarynodes/`
  - **새 카테고리 생성**: 기본 카테고리 외의 이름을 입력하면 자동으로 새 카테고리 디렉토리를 생성합니다
    - 예: `--category test` → `server/nodes/testnodes/` 디렉토리 생성
    - 새 카테고리 디렉토리와 `__init__.py` 파일이 자동으로 생성됩니다
    - 카테고리 이름은 자동으로 스네이크 케이스로 변환되어 디렉토리명에 사용됩니다

- **`--description`** (필수): 노드 설명
  - 노드의 기능을 설명하는 텍스트
  - Python 클래스 docstring과 JavaScript 파일에 사용됩니다

- **`--label`** (선택): 노드 라벨
  - UI에 표시될 노드 이름 (기본값: `--name`을 기반으로 자동 생성)
  - 예: `--name my-node` → 기본 라벨: "My Node"

- **`--parameters`** (선택): 파라미터 JSON 파일 경로
  - 노드 파라미터를 정의한 JSON 파일 경로
  - 파일 형식:
    ```json
    {
      "param_name": {
        "type": "string",
        "label": "파라미터 라벨",
        "description": "파라미터 설명",
        "default": "기본값",
        "required": true
      }
    }
    ```
  - 이 파일을 제공하면 Python 템플릿에 파라미터 추출 코드가 자동으로 생성됩니다

#### 사용 예시

```bash
# 기본 사용법
python scripts/create-node.py --name file-read --category action --description "파일을 읽는 노드"

# 라벨 지정
python scripts/create-node.py --name file-read --category action --description "파일을 읽는 노드" --label "파일 읽기"

# 파라미터 파일 포함
python scripts/create-node.py --name file-read --category action --description "파일을 읽는 노드" --parameters parameters.json

# 새 카테고리 생성
python scripts/create-node.py --name test-node --category test --description "테스트 노드"
# → server/nodes/testnodes/ 디렉토리와 __init__.py가 자동 생성됨
```

이 명령어는 다음을 자동으로 생성합니다:
- Python 노드 클래스 파일 (`server/nodes/actionnodes/my_node.py`)
- JavaScript 렌더링 파일 (`UI/src/js/components/node/node-my-node.js`)
- `nodes_config.py`에 설정 **자동 추가** (수동 추가 불필요)

> **참고**: 파일이 이미 존재하는 경우에도 스크립트는 계속 진행하여 `nodes_config.py`에 설정을 추가합니다. 기존 파일은 건너뛰고 설정만 추가됩니다.

### 방법 2: 수동 생성

다음 **3가지만** 수행하면 됩니다:

1. **노드 설정 추가**: `server/config/nodes_config.py`에 노드 정보 추가 (필수: `input_schema`, `output_schema` 포함)
2. **노드 클래스 생성**: `server/nodes/{카테고리}/{이름}.py` 파일 생성
3. **JavaScript 렌더링 파일 생성**: `UI/src/js/components/node/node-{이름}.js` 파일 생성

> **자동화된 기능**: 
> - ✅ 서브모듈의 `__init__.py`가 **자동으로 노드를 감지**하여 로드합니다. 수동으로 import하거나 `__all__`에 추가할 필요가 없습니다.
> - ✅ `nodes/__init__.py`가 **자동으로 모든 노드를 감지**하여 export합니다. 수동으로 추가할 필요가 없습니다.
> - ✅ 노드 핸들러는 **자동으로 등록**되어 `action_service.py`에서 사용됩니다. 수동으로 추가할 필요가 없습니다.
> - ✅ JavaScript 파일은 **자동으로 로드**됩니다. `index.html`을 수정할 필요가 없습니다. `nodes_config.py`의 `script` 필드만 올바르게 설정하면 `NodeRegistry`가 자동으로 스크립트를 로드합니다.

## 1. 노드 설정 추가

`server/config/nodes_config.py`의 `NODES_CONFIG` 딕셔너리에 노드 정보를 추가하세요:

```python
NODES_CONFIG: dict[str, dict[str, Any]] = {
    # ... 기존 노드들 ...
    "my-node": {
        "label": "내 노드",
        "title": "내 노드",
        "description": "노드 설명",
        "script": "node-my-node.js",  # 클라이언트 JS 파일명
        "is_boundary": False,          # 경계 노드 여부
        "category": "action",          # 노드 카테고리: "action", "logic", "system" 등
        "parameters": {                # 사용자 설정 파라미터 (선택)
            "value": {
                "type": "string",
                "label": "값",
                "description": "설정할 값",
                "default": "",
                "required": True,
                "placeholder": "값을 입력하세요"
            }
        },
        "detail_types": {},            # 상세 노드 타입 정의 (선택)
        "input_schema": {              # 입력 스키마 (필수)
            "action": {"type": "string", "description": "이전 노드 타입"},
            "status": {"type": "string", "description": "이전 노드 실행 상태"},
            "output": {"type": "any", "description": "이전 노드 출력 데이터"}
        },
        "output_schema": {             # 출력 스키마 (필수)
            "action": {"type": "string", "description": "노드 타입"},
            "status": {"type": "string", "description": "실행 상태"},
            "output": {
                "type": "object",
                "description": "출력 데이터",
                "properties": {
                    "value": {"type": "string", "description": "입력받은 값"},
                    "result": {"type": "string", "description": "처리 결과"}
                }
            }
        }
    }
}
```

### 필수 필드

- **`input_schema`**: 노드의 입력 형식을 정의합니다. 노드 설정 모달의 입력 미리보기에 사용됩니다.
- **`output_schema`**: 노드의 출력 형식을 정의합니다. 노드 설정 모달의 출력 미리보기에 사용됩니다.
  - 표준 형식: `{action, status, output: {type: "object", properties: {...}}}`
  - 스키마 기반으로 출력 미리보기가 자동 생성되며, 필드명과 타입에 맞는 의미있는 예시 값이 생성됩니다
  - 파라미터 변경 시 출력 미리보기가 자동으로 업데이트됩니다

### 파라미터 타입

- **string**: 텍스트 입력 필드
- **number**: 숫자 입력 필드 (min, max 옵션 가능)
- **boolean**: 체크박스
- **options**: 선택 옵션이 있는 경우 `options` 배열 추가

```python
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
    }
}
```

> **자세한 내용**: UI에서 사용자가 파라미터를 선택할 수 있도록 하는 방법은 [파라미터 선택 옵션 가이드](./parameter-choices-guide.md)를 참고하세요.

### 특수 파라미터

- **folder_path**: 폴더 선택 버튼이 자동으로 추가됩니다
- **file_path**: 파일 선택 버튼이 자동으로 추가됩니다

```python
"parameters": {
    "folder_path": {
        "type": "string",
        "label": "이미지 폴더 경로",
        "description": "이미지 파일이 있는 폴더를 선택하세요",
        "default": "",
        "required": True,
        "placeholder": "C:\\images\\touch"
    }
}
```

### 특수 속성

- **`requires_folder_path`**: `True`로 설정하면 폴더 경로가 필수임을 표시합니다 (예: `image-touch` 노드)

## 2. 필요한 라이브러리 설치

노드에서 외부 라이브러리를 사용하는 경우, 다음 단계를 따라야 합니다:

### 2.1 requirements.txt에 라이브러리 추가

노드에서 사용하는 모든 외부 라이브러리를 `server/requirements.txt` 파일에 추가하세요:

```txt
# 예시: win32 관련 라이브러리
pywin32>=306
```

### 2.2 라이브러리 설치

`requirements.txt`에 추가한 후 다음 명령어로 설치하세요:

```bash
pip install -r server/requirements.txt
```

또는 특정 라이브러리만 설치하려면:

```bash
pip install pywin32
```

### 2.3 노드 코드에서 라이브러리 import

노드 코드에서 라이브러리를 import할 때는 에러 처리를 포함하세요:

```python
try:
    import win32com.client
except ImportError:
    win32com = None

# 노드 실행 시 라이브러리 확인
if win32com is None:
    return create_failed_result(
        action="my-node",
        reason="library_not_installed",
        message="필요한 라이브러리가 설치되어 있지 않습니다. pip install pywin32를 실행하세요.",
        output={"success": False}
    )
```

### 실제 예시: 엑셀 열기 노드

엑셀 파일을 열기 위해 `pywin32` 라이브러리를 사용하는 노드 예시:

**1. requirements.txt에 추가** (이미 추가되어 있음):
```txt
pywin32>=306
```

**2. 노드 코드에서 사용** (`server/nodes/actionnodes/excel_open.py`):
```python
try:
    import win32com.client
except ImportError:
    win32com = None

@NodeExecutor("excel-open")
async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
    if win32com is None:
        return create_failed_result(
            action="excel-open",
            reason="win32com_not_installed",
            message="pywin32가 설치되어 있지 않습니다. pip install pywin32를 실행하세요.",
            output={"success": False}
        )
    
    # 엑셀 파일 열기 로직
    excel_app = win32com.client.Dispatch("Excel.Application")
    # ...
```

### 주의사항

- **Windows 전용 라이브러리**: `pywin32`와 같은 Windows 전용 라이브러리는 Windows 환경에서만 동작합니다.
- **의존성 관리**: 노드를 배포하거나 다른 개발자와 공유할 때는 `requirements.txt`에 모든 의존성을 명시해야 합니다.
- **버전 고정**: 특정 버전이 필요한 경우 버전을 명시하세요 (예: `pywin32>=306`).
- **에러 처리**: 라이브러리가 설치되지 않은 경우를 대비해 항상 try-except로 감싸고 적절한 에러 메시지를 반환하세요.

## 3. 노드 클래스 생성

노드 타입에 따라 적절한 디렉토리에 Python 파일을 생성하세요:

- **액션 노드**: `server/nodes/actionnodes/my_node.py`
- **조건 노드**: `server/nodes/conditionnodes/my_node.py`
- **대기 노드**: `server/nodes/waitnodes/my_node.py`
- **이미지 노드**: `server/nodes/imagenodes/my_node.py`
- **경계 노드**: `server/nodes/boundarynodes/my_node.py`

> **자동화**: 노드 파일만 생성하면 됩니다! 서브모듈의 `__init__.py`는 자동으로 노드를 감지하여 로드합니다. 수동으로 import하거나 `__all__`에 추가할 필요가 없습니다.

### 기본 템플릿

```python
# server/nodes/actionnodes/my_node.py
"""
내 노드
노드 설명을 작성하세요.
"""

from typing import Any

from nodes.base_node import BaseNode
from nodes.node_executor_wrapper import NodeExecutor
from utils import create_failed_result, get_parameter


class MyNode(BaseNode):
    """내 노드 클래스"""

    @staticmethod
    @NodeExecutor("my-node")
    async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
        """
        노드 실행 로직

        Args:
            parameters: 노드 파라미터
                - value: 값 (기본값: "")

        Returns:
            실행 결과 딕셔너리
        """
        value = get_parameter(parameters, "value", default="")

        # 노드 실행 로직 작성
        # ...

        return {
            "action": "my-node",
            "status": "completed",
            "output": {"value": value}
        }
```

### 파라미터 추출

`get_parameter()` 함수를 사용하여 파라미터를 안전하게 추출합니다:

```python
from utils import get_parameter

# 필수 파라미터 (없으면 에러 발생)
value = get_parameter(parameters, "value")

# 기본값이 있는 파라미터
count = get_parameter(parameters, "count", default=1)

# 타입 변환
timeout = get_parameter(parameters, "timeout", default=30)
if timeout is not None:
    timeout = float(timeout)
```

### 반환 형식

노드는 항상 다음 형식의 딕셔너리를 반환해야 합니다:

```python
{
    "action": "my-node",           # 노드 타입
    "status": "completed",         # "completed" 또는 "failed"
    "output": {                    # 출력 데이터
        "result": "success",
        "data": {...}
    }
}
```

### 에러 처리

에러 발생 시 `create_failed_result()` 함수를 사용하세요:

```python
from utils import create_failed_result

# 에러 발생 시
if not some_condition:
    return create_failed_result(
        action="my-node",
        reason="error_type",
        message="에러 메시지",
        output={"error": "상세 정보"}
    )
```

실제 예시 (`server/nodes/waitnodes/wait.py`):

```python
return {
    "action": "wait",
    "status": "completed",
    "output": {"wait_time": wait_time}
}
```

## 4. JavaScript 렌더링 파일 생성

Python 노드도 클라이언트에서 렌더링하기 위해 JavaScript 파일이 필요합니다.

`UI/src/js/components/node/node-my-node.js` 파일을 생성하세요:

```javascript
// node-my-node.js
(function () {
    if (!window.NodeManager) {
        return;
    }

    window.NodeManager.registerNodeType('my-node', {
        /**
         * 노드 내용 생성
         * @param {Object} nodeData - 노드 데이터
         */
        renderContent(nodeData) {
            // 노드 아이콘은 node-icons.config.js에서 중앙 관리
            const NodeIcons = window.NodeIcons || {};
            const icon = NodeIcons.getIcon('my-node', nodeData) || NodeIcons.icons?.default || '⚙';
            
            return `
                <div class="node-input"></div>
                <div class="node-content">
                    <div class="node-icon-box">
                        <div class="node-icon">${icon}</div>
                    </div>
                    <div class="node-text-area">
                        <div class="node-title">${this.escapeHtml(nodeData.title || '내 노드')}</div>
                        <div class="node-description">${this.escapeHtml(nodeData.description || '')}</div>
                    </div>
                </div>
                <div class="node-output"></div>
                <div class="node-settings" data-node-id="${nodeData.id}">⚙</div>
            `;
        }
    });
})();
```

## 5. 자동 스크립트 로드 (Import)

**중요**: JavaScript 파일은 **자동으로 로드**됩니다. `index.html`을 수정할 필요가 없습니다.

### 자동 로드 동작 원리

1. **서버 시작 시**: 서버가 `nodes_config.py`의 모든 노드 설정을 `/api/config/nodes` API로 제공합니다.
2. **클라이언트 로드 시**: `WorkflowPage`가 초기화되면 `NodeRegistry`가 자동으로:
   - 서버에서 노드 설정 목록을 가져옵니다
   - 각 노드의 `script` 필드를 확인합니다
   - 해당 JavaScript 파일을 동적으로 로드합니다 (`/static/js/components/node/{script}`)
3. **노드 등록**: JavaScript 파일이 로드되면 `registerNodeType`이 자동으로 호출되어 노드가 등록됩니다.

### 필요한 작업

- ✅ `nodes_config.py`에 `script` 필드 설정 (예: `"script": "node-my-node.js"`)
- ✅ `UI/src/js/components/node/node-my-node.js` 파일 생성
- ❌ `index.html` 수정 **불필요** (자동으로 로드됨)

### 동적 로드 확인

브라우저 개발자 도구 콘솔에서 다음 메시지를 확인할 수 있습니다:

```
[NodeRegistry] 서버에서 노드 설정 로드 완료: X개
[NodeRegistry] 노드 스크립트 로드 완료: node-my-node.js
[node-my-node] 노드 타입 등록 완료
```

## 6. 특수 기능 노드 구현

일부 노드는 특수한 연결점이나 실행 로직을 가질 수 있습니다. 반복 노드(Repeat Node)를 예시로 설명합니다.

### 6.1 아래 연결점 (Bottom Output) 구현

반복 노드처럼 노드 하단에 특별한 연결점이 필요한 경우:

**1. `nodes_config.py`에 플래그 추가**:
```python
"repeat": {
    "has_bottom_output": True,  # 아래 연결점이 있음을 표시
    # ... 기타 설정
}
```

**2. JavaScript 렌더링에 아래 연결점 추가** (`node-repeat.js`):
```javascript
renderContent(nodeData) {
    return `
        <div class="node-input"></div>
        <div class="node-content">
            <!-- 노드 내용 -->
        </div>
        <div class="node-output" title="출력"></div>
        <div class="node-bottom-output" title="반복할 노드들을 연결">
            <div class="bottom-output-dot">
                <span class="output-symbol">↓</span>
            </div>
            <span class="bottom-output-label">반복</span>
        </div>
        <div class="node-settings">⚙</div>
    `;
}
```

**3. 연결 관리**: `ConnectionManager`가 `has_bottom_output` 플래그를 확인하여 아래 연결점을 자동으로 처리합니다.

### 6.2 특수 실행 로직 구현

반복 노드처럼 특수한 실행 로직이 필요한 경우:

**1. 서버 측**: 노드 클래스는 기본 실행만 수행하고, 실제 반복 로직은 워크플로우 실행 엔진에서 처리합니다.
```python
@NodeExecutor("repeat")
async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
    # 기본 검증만 수행
    repeat_count = get_parameter(parameters, "repeat_count", default=1)
    return {
        "action": "repeat",
        "status": "completed",
        "output": {
            "repeat_count": repeat_count,
            "completed": True,
            "iterations": [],  # 실제 반복 결과는 엔진에서 채움
        },
    }
```

**2. 프론트엔드**: `workflow-execution-service.js`에서 노드 타입을 확인하여 특수 로직을 처리합니다.
```javascript
if (nodeData.type === 'repeat') {
    // 반복 노드 특수 처리 로직
    // - 반복 블록 정의
    // - 각 반복마다 개별 API 요청
    // - 실시간 UI 업데이트
}
```

**3. 서버 API**: `action_router.py`에서 `repeat_info`를 확인하여 반복 실행을 처리합니다.
```python
if repeat_info and repeat_info.get("repeat_count"):
    current_iteration = repeat_info.get("current_iteration")
    total_iterations = repeat_info.get("total_iterations")
    # 단일 반복 실행
```

### 6.3 메타데이터 전달

반복 블록 내 노드에 메타데이터를 추가하여 서버에서 활용할 수 있습니다:
```javascript
nodeCopy.repeat_info = {
    repeat_count: repeatCount,
    is_repeat_start: index === 0,
    is_repeat_end: index === nodesToRepeat.length - 1,
    current_iteration: iteration + 1,
    total_iterations: repeatCount
};
```

서버에서는 이 메타데이터를 사용하여 로깅이나 특수 처리를 수행할 수 있습니다.

## 7. 노드 등록

노드는 **완전 자동으로 등록**됩니다. 별도의 등록 코드는 필요하지 않습니다.

### 자동 등록 프로세스

1. **서브모듈 자동 로드**: 각 서브모듈의 `__init__.py`가 해당 폴더의 모든 `.py` 파일을 스캔하여 `BaseNode`를 상속받은 클래스를 자동으로 찾아 import합니다.
2. **노드 클래스 감지**: `nodes/__init__.py`가 모든 서브모듈을 자동으로 스캔하여 `__all__`에 있는 모든 노드를 export합니다.
3. **노드 핸들러 등록**: `action_service.py`가 시작 시 모든 노드 클래스를 스캔하여 `@NodeExecutor` 데코레이터의 `action_name`을 추출하고 핸들러를 자동으로 등록합니다.
4. **액션 노드 타입 매칭**: `action_node_types.py`의 `handler` 필드와 자동으로 매칭하여 `action_node_handlers`에도 등록됩니다.

### 개발자가 해야 할 일

- ✅ 노드 클래스를 적절한 서브모듈 폴더에 생성
- ❌ 서브모듈의 `__init__.py` 수정 **불필요** (자동으로 감지됨)
- ❌ `nodes/__init__.py` 수정 **불필요** (자동으로 감지됨)
- ❌ `action_service.py` 수정 **불필요** (자동으로 등록됨)

### 서버 재시작

서버를 재시작하면 새 노드가 자동으로 인식되고 등록됩니다.

## 노드 삭제

생성된 노드를 삭제하려면 다음 스크립트를 사용하세요:

```bash
# 확인 후 삭제
python scripts/delete-node.py --name my-node

# 확인 없이 삭제 (주의: 되돌릴 수 없습니다)
python scripts/delete-node.py --name my-node --force

# 설정 파일은 유지하고 파일만 삭제
python scripts/delete-node.py --name my-node --keep-config
```

이 스크립트는 다음을 삭제합니다:
- ✅ Python 노드 파일 (`server/nodes/{카테고리}/{node_name}.py`)
- ✅ JavaScript 렌더링 파일 (`UI/src/js/components/node/node-{node_name}.js`)
- ✅ `nodes_config.py`에서 노드 설정 제거 (기본 동작)
- ✅ 빈 카테고리 디렉토리 삭제 (새로 만든 카테고리인 경우)

> **주의**: 
> - 삭제된 파일은 복구할 수 없습니다. 필요시 Git을 사용하여 복구하세요.
> - `--keep-config` 옵션을 사용하면 `nodes_config.py`의 설정은 유지됩니다.
> - 기본 카테고리(`action`, `logic` 등)의 디렉토리는 삭제되지 않습니다.

## 노드 검증

노드 설정과 구현이 일치하는지 검증하려면 다음 스크립트를 실행하세요:

```bash
python scripts/validate-nodes.py
```

이 스크립트는 다음을 확인합니다:
- ✅ `nodes_config.py`에 정의된 노드가 실제로 구현되어 있는지
- ✅ 구현된 노드가 `nodes_config.py`에 정의되어 있는지
- ✅ JavaScript 파일이 존재하는지 (`script` 필드의 실제 파일명 사용)
- ✅ `@NodeExecutor`의 `action_name`과 노드 타입이 일치하는지
- ✅ 경계 노드(예: `start`)는 Python 구현이 없어도 정상으로 처리

> **참고**: 검증 스크립트는 `nodes_config.py`의 `script` 필드에 정의된 실제 파일명을 사용하여 JavaScript 파일을 확인합니다. 예를 들어 `testUIconfig` 노드는 `node-test-ui-config.js` 파일을 확인합니다.

## 참고 파일

### Python (서버)
- `server/config/nodes_config.py`: 노드 설정 파일 (실제 예시)
- `server/nodes/waitnodes/wait.py`: 대기 노드 구현 예시 (간단한 로직)
- `server/nodes/processnodes/process_focus.py`: 프로세스 포커스 노드 구현 예시 (복잡한 로직)
- `server/nodes/base_node.py`: 기본 노드 클래스
- `server/nodes/node_executor_wrapper.py`: 노드 실행 래퍼 (자동 에러 처리, 로깅 등)
- `server/utils/__init__.py`: 유틸리티 함수 (`get_parameter`, `create_failed_result` 등)

### JavaScript (클라이언트)
- `UI/src/js/components/node/node-example.js`: 노드 생성 템플릿
- `UI/src/js/components/node/node-process-focus.js`: 프로세스 포커스 노드 렌더링 예시

### 개발 도구
- `scripts/create-node.py`: 노드 템플릿 생성 스크립트 (Python, JavaScript 파일 생성 및 `nodes_config.py` 자동 추가)
- `scripts/delete-node.py`: 노드 삭제 스크립트 (파일 및 설정 자동 제거)
- `scripts/validate-nodes.py`: 노드 검증 스크립트 (설정과 구현 일치 여부 확인)

## 주의사항

1. **노드 이름 일치**: 
   - `nodes_config.py`의 노드 타입 (예: `"my-node"`)
   - `@NodeExecutor` 데코레이터의 액션 이름 (예: `@NodeExecutor("my-node")`)
   - `registerNodeType`의 노드 타입 (예: `'my-node'`)
   - `script` 필드의 파일명 (예: `"node-my-node.js"`)
   - 이 네 가지가 모두 일치해야 합니다.

2. **파일명 규칙**: 
   - Python: 스네이크 케이스 (`my_node.py`)
   - JavaScript: 케밥 케이스 (`node-my-node.js`)
   - JavaScript 파일은 `UI/src/js/components/node/` 디렉토리에 위치해야 합니다.

3. **노드 카테고리**: 적절한 디렉토리에 노드를 생성하세요. 노드 파일만 생성하면 자동으로 감지됩니다.

4. **스키마 정의**: `input_schema`와 `output_schema`는 필수입니다. 노드 설정 모달의 미리보기에 사용됩니다.

6. **서버 재시작**: 새 노드를 추가한 후 서버를 재시작하면 자동으로 인식되고 등록됩니다.

7. **자동 등록**: 
   - 서브모듈의 `__init__.py`를 수정할 필요가 없습니다. 자동으로 해당 폴더의 모든 노드를 감지하여 로드합니다.
   - `nodes/__init__.py`를 수정할 필요가 없습니다. 자동으로 모든 서브모듈을 스캔하여 노드를 감지합니다.
   - `action_service.py`를 수정할 필요가 없습니다. 자동으로 모든 노드 핸들러를 등록합니다.

8. **자동 로드**: 
   - `index.html`을 수정할 필요가 없습니다. `nodes_config.py`의 `script` 필드만 올바르게 설정하면 자동으로 로드됩니다.
   - JavaScript 파일만 수정한 경우 브라우저 새로고침만으로 반영됩니다 (자동 로드 시스템이 다시 로드함).
