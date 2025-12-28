# 노드 출력 데이터 표준 형식

**최신 수정일자: 2025-12-24**

모든 노드는 n8n 스타일의 표준 출력 형식을 따라야 합니다. 이를 통해 프론트엔드에서 이전 노드의 출력 변수들을 일관되게 표시하고 사용자가 선택할 수 있습니다.

## 표준 출력 형식

모든 노드의 `execute` 메서드는 다음 형식의 딕셔너리를 반환해야 합니다:

```python
{
    "action": str,           # 노드 타입 (예: "click", "http-request")
    "status": str,           # "completed" 또는 "failed"
    "output": dict[str, Any], # 실제 출력 데이터 (키-값 쌍으로 구성)
    # 메타데이터 (v0.0.6 추가)
    "_execution_id": str,    # 워크플로우 실행 ID (선택적)
    "_script_id": int,       # 스크립트 ID (선택적)
    "_node_id": str,         # 노드 ID
    "_node_name": str        # 노드 이름 (선택적)
}
```

**v0.0.6 변경사항:** 
- 노드 실행 결과는 기존 형식 `{action, status, output}`을 그대로 유지합니다.
- 메타데이터 필드(`_execution_id`, `_script_id`, `_node_id`, `_node_name`)가 자동으로 추가됩니다.
- 다음 노드에서 이전 노드 결과를 참조할 때만 `outdata.`/`indata.` 경로를 사용합니다.

### 성공 시

```python
{
    "action": "click",
    "status": "completed",
    "output": {
        "x": 100,
        "y": 200,
        "success": True
    },
    "_execution_id": "20250101-120000-abc123",
    "_script_id": 1,
    "_node_id": "node1",
    "_node_name": "클릭 노드"
}
```

### 실패 시

```python
{
    "action": "click",
    "status": "failed",
    "output": {
        "success": False,
        "reason": "element_not_found"
    },
    "error": {
        "reason": "element_not_found",
        "message": "요소를 찾을 수 없습니다"
    },
    "_execution_id": "20250101-120000-abc123",
    "_script_id": 1,
    "_node_id": "node1",
    "_node_name": "클릭 노드"
}
```

## 핵심 규칙

### 1. `output` 필드는 반드시 dict 형식이어야 합니다

✅ **올바른 예시:**
```python
# 키-값 쌍으로 구성
return {
    "action": "click",
    "status": "completed",
    "output": {
        "x": 100,
        "y": 200
    }
}

# 단일 값도 dict로 래핑
return {
    "action": "get-text",
    "status": "completed",
    "output": {
        "text": "Hello World"
    }
}
```

❌ **잘못된 예시:**
```python
# output이 dict가 아님
return {
    "action": "get-text",
    "status": "completed",
    "output": "Hello World"  # ❌ dict가 아님
}

# output이 None
return {
    "action": "click",
    "status": "completed",
    "output": None  # ❌ None이면 빈 dict로 변환됨
}
```

### 2. 각 키는 프론트엔드에서 변수로 표시됩니다

`output` 딕셔너리의 각 키는 n8n처럼 태그 형태로 표시되어 사용자가 선택할 수 있습니다.

예를 들어, `output: {"title": "...", "link": "...", "author": "..."}` 형식이면:
- 프론트엔드에서 `title`, `link`, `author` 변수가 태그로 표시됨
- 사용자가 다음 노드의 입력에서 이 변수들을 선택할 수 있음

### 3. `normalize_result` 함수가 자동으로 변환합니다

`@NodeExecutor` 데코레이터가 자동으로 `normalize_result`를 호출하여:
- `output`이 dict가 아니면 `{"value": output}` 형식으로 변환
- `output`이 None이면 빈 dict `{}`로 변환
- 필수 필드(`action`, `status`, `output`)가 없으면 자동 추가
- **표준 형식이 아닌 dict는 자동으로 `output` 필드로 래핑**

따라서 노드 개발자는 다음 중 하나만 반환하면 됩니다:

```python
# 방법 1: 표준 형식으로 반환 (권장)
return {
    "action": "click",
    "status": "completed",
    "output": {"x": 100, "y": 200}
}

# 방법 2: output만 반환 (action, status는 자동 추가됨)
return {"output": {"x": 100, "y": 200}}

# 방법 3: 단순 dict 반환 (전체가 output으로 래핑됨)
return {"x": 100, "y": 200}
# → {"action": "click", "status": "completed", "output": {"x": 100, "y": 200}}

# 방법 4: 단순 값 반환 ({"value": ...}로 자동 변환됨)
return "Hello World"
# → {"action": "click", "status": "completed", "output": {"value": "Hello World"}}
```

#### `normalize_result` 변환 규칙 상세 예시

**규칙 3: dict이지만 표준 형식이 아닌 경우**

표준 형식이 아니면 result의 내용을 `output` 필드로 래핑합니다:

```python
# 예시 1: output 필드가 없는 경우
입력: {"x": 100, "y": 200}
출력: {
    "action": "click",
    "status": "completed",
    "output": {"x": 100, "y": 200}  # 전체가 output으로 래핑됨
}

# 예시 2: output 필드가 있지만 dict가 아닌 경우
입력: {"output": "string_value"}
출력: {
    "action": "click",
    "status": "completed",
    "output": {"value": "string_value"}  # dict가 아니므로 {"value": ...}로 변환
}

# 예시 3: output 필드가 있고 dict이지만 action이나 status가 없는 경우
입력: {"output": {"x": 100, "y": 200}}
출력: {
    "action": "click",  # 자동 추가
    "status": "completed",  # 자동 추가
    "output": {"x": 100, "y": 200}  # 그대로 사용
}

# 예시 4: 표준 필드와 데이터가 섞여 있는 경우
입력: {"x": 100, "y": 200, "action": "custom", "message": "test"}
출력: {
    "action": "custom",  # 입력의 action 사용
    "status": "completed",  # 자동 추가
    "output": {"x": 100, "y": 200}  # 표준 필드(action, status, output, error, message, meta) 제외
}
```

## 노드 구현 예시

### 예시 1: 클릭 노드

```python
from nodes.base_node import BaseNode
from nodes.node_executor_wrapper import NodeExecutor
from utils import get_parameter

class ClickNode(BaseNode):
    @staticmethod
    @NodeExecutor("click")
    async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
        x = get_parameter(parameters, "x", default=0)
        y = get_parameter(parameters, "y", default=0)
        
        # output을 dict로 반환 (각 키가 변수로 표시됨)
        # 메타데이터는 action_service.py에서 자동으로 추가됨
        return {
            "action": "click",
            "status": "completed",
            "output": {
                "x": x,
                "y": y,
                "clicked": True
            }
        }
        # 실제 반환 결과에는 메타데이터가 자동으로 추가됨:
        # {
        #     "action": "click",
        #     "status": "completed",
        #     "output": {"x": 100, "y": 200, "clicked": True},
        #     "_execution_id": "20250101-120000-abc123",
        #     "_script_id": 1,
        #     "_node_id": "node1",
        #     "_node_name": "클릭 노드"
        # }
```

### 예시 2: HTTP 요청 노드

```python
class HttpRequestNode(BaseNode):
    @staticmethod
    @NodeExecutor("http-request")
    async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
        url = get_parameter(parameters, "url")
        method = get_parameter(parameters, "method", default="GET")
        
        # HTTP 요청 실행...
        response_data = await make_request(url, method)
        
        # 응답 데이터를 키-값 쌍으로 구성
        return {
            "action": "http-request",
            "status": "completed",
            "output": {
                "status_code": response_data.status_code,
                "body": response_data.body,
                "headers": response_data.headers,
                "url": url
            }
        }
```

### 예시 3: RSS 피드 노드

```python
class RssFeedNode(BaseNode):
    @staticmethod
    @NodeExecutor("rss-feed")
    async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
        feed_url = get_parameter(parameters, "url")
        
        # RSS 피드 파싱...
        items = await parse_rss_feed(feed_url)
        
        # 첫 번째 아이템의 데이터를 키-값 쌍으로 반환
        if items:
            first_item = items[0]
            return {
                "action": "rss-feed",
                "status": "completed",
                "output": {
                    "title": first_item.title,
                    "link": first_item.link,
                    "pubDate": first_item.pub_date,
                    "author": first_item.author,
                    "id": first_item.id,
                    "isoDate": first_item.iso_date
                }
            }
        else:
            return {
                "action": "rss-feed",
                "status": "completed",
                "output": {}
            }
```

## 프론트엔드 연동

프론트엔드에서는 이전 노드들의 `output` 필드를 파싱하여:

1. **변수 목록 표시**: 각 키를 태그 형태로 표시
2. **변수 선택**: 사용자가 다음 노드의 입력에서 이 변수들을 선택
3. **값 미리보기**: 선택한 변수의 실제 값을 표시

예를 들어, 이전 노드가 다음을 반환했다면:
```json
{
    "action": "rss-feed",
    "status": "completed",
    "output": {
        "title": "나노바나나 무료 연결법 공개!",
        "link": "https://www.youtube.com/watch?v=...",
        "pubDate": "2025-09-06T03:00:56.000Z",
        "author": "시민개발자 구씨",
        "id": "yt:video:...",
        "isoDate": "2025-09-06T03:00:56.000Z"
    }
}
```

프론트엔드에서는 `title`, `link`, `pubDate`, `author`, `id`, `isoDate` 6개의 변수를 태그로 표시하고, 사용자가 다음 노드의 입력에서 이 중 하나를 선택할 수 있습니다.

## 마이그레이션 가이드

기존 노드가 표준 형식을 따르지 않는다면:

1. `output` 필드가 dict가 아닌 경우: `{"value": output}` 형식으로 변환됨 (자동)
2. `output` 필드가 None인 경우: 빈 dict `{}`로 변환됨 (자동)
3. 수동 수정이 필요한 경우: `output`을 명시적으로 dict로 구성

## 출력 스키마 정의 (`output_schema`)

노드 설정 파일(`server/config/nodes_config.py`)에 각 노드의 출력 스키마를 정의하여 출력 미리보기를 자동 생성할 수 있습니다.

### 스키마 구조

```python
"output_schema": {
    "action": {"type": "string", "description": "노드 타입"},
    "status": {"type": "string", "description": "실행 상태 (completed/failed)"},
    "output": {
        "type": "object",
        "description": "출력 데이터",
        "properties": {
            "field1": {"type": "string", "description": "필드 설명"},
            "field2": {"type": "number", "description": "필드 설명"},
            "field3": {"type": "boolean", "description": "필드 설명"}
        }
    }
}
```

### 스키마 기반 미리보기

프론트엔드에서 `output_schema`를 기반으로 출력 미리보기를 자동 생성합니다:

1. **필드명 기반 예시 값**: 필드명과 타입을 분석하여 의미있는 예시 값 생성
   - `file_path` → `"C:\\example\\path\\file.ext"`
   - `success` → `true`
   - `execution_id` → `"20250101-120000-abc123"`
   - `count` → `10`

2. **실제 파라미터 값 우선**: `nodeData`에 실제 값이 있으면 스키마 기반 예시 값 대신 실제 값을 사용

3. **자동 업데이트**: 노드 설정 모달에서 파라미터를 변경하면 출력 미리보기가 자동으로 업데이트됩니다 (300ms debounce)

### 예시: 엑셀 열기 노드

```python
"excel-open": {
    # ... 기타 설정 ...
    "output_schema": {
        "action": {"type": "string", "description": "노드 타입"},
        "status": {"type": "string", "description": "실행 상태 (completed/failed)"},
        "output": {
            "type": "object",
            "description": "출력 데이터",
            "properties": {
                "file_path": {"type": "string", "description": "열린 엑셀 파일 경로"},
                "visible": {"type": "boolean", "description": "엑셀 창 표시 여부"},
                "success": {"type": "boolean", "description": "성공 여부"},
                "execution_id": {"type": "string", "description": "스크립트 실행 ID (다음 노드에서 사용)"}
            }
        }
    }
}
```

이 스키마를 기반으로 출력 미리보기가 다음과 같이 생성됩니다:

```json
{
  "action": "excel-open",
  "status": "completed",
  "output": {
    "file_path": "C:\\example\\path\\file.ext",
    "visible": true,
    "success": true,
    "execution_id": "20250101-120000-abc123"
  }
}
```

## 이전 노드 출력 접근 (v0.0.6)

### 경로 형식

다음 노드에서 이전 노드의 출력을 사용할 때는 `outdata.` 경로를 사용합니다:

**기본 형식:**
- `outdata.output.field_name` - 이전 노드의 output 필드 접근
- `outdata.action` - 이전 노드의 action 값
- `outdata.status` - 이전 노드의 status 값
- `indata.parameter_name` - 현재 노드의 입력 파라미터 접근

**예시:**
```python
# 엑셀 열기 노드 실행 결과 (기존 형식 유지 + 메타데이터)
{
    "action": "excel-open",
    "status": "completed",
    "output": {
        "execution_id": "20250101-120000-abc123",
        "file_path": "C:/Users/User/Downloads/test.xlsx"
    },
    "_execution_id": "20250101-120000-abc123",
    "_script_id": 1,
    "_node_id": "node1",
    "_node_name": "엑셀 열기"
}

# 다음 노드(엑셀 시트 선택)에서 사용
# 경로 해석 시 내부적으로 outdata 구조로 래핑하여 처리
parameters = {
    "execution_id": "outdata.output.execution_id",  # 자동으로 "20250101-120000-abc123"로 해석됨
    "sheet_name": "Sheet1"
}
```

### 자동 경로 해석

`server/utils/field_path_resolver.py`가 모든 노드의 파라미터에서 경로 문자열을 자동으로 해석합니다:

1. 파라미터 값이 `outdata.` 또는 `indata.`로 시작하는지 확인
2. 이전 노드 결과에서 실제 값 추출
3. 파라미터 값을 실제 값으로 교체

이렇게 하면 엑셀 노드뿐만 아니라 모든 노드에서 이전 노드 출력을 자동으로 사용할 수 있습니다.

### 경로 형식 변경 이력

**v0.0.5 이하:**
- `output.data.execution_id`
- `output.execution_id`

**v0.0.6 이후:**
- `outdata.output.execution_id` ✅ - 이전 노드의 출력 데이터 접근
- `outdata.action` - 이전 노드의 action 값
- `outdata.status` - 이전 노드의 status 값
- `indata.parameter_name` - 이전 노드의 입력 파라미터 접근 (향후 지원)

**중요:** 노드 실행 결과 자체는 기존 형식 `{action, status, output}`을 그대로 유지합니다. 경로 해석 시에만 내부적으로 `outdata` 구조로 래핑하여 처리합니다.

## 참고

- `server/utils/field_path_resolver.py`: 경로 해석 유틸리티 (v0.0.6 추가)
- `server/utils/result_formatter.py`: 표준화 함수 구현
- `server/nodes/node_executor_wrapper.py`: 자동 정규화 로직
- `server/config/nodes_config.py`: 노드 스키마 정의
- `UI/src/pages/workflow/config/node-preview-generator.js`: 스키마 기반 미리보기 생성 로직
- `docs/dev/ui-ux/input-output-ux.md`: 전체 UX 가이드
- `docs/dev/ui-ux/input-output-preview.md`: 입출력 미리보기 시스템 상세 설명
