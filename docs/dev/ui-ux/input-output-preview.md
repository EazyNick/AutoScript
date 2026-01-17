# 노드 입출력 미리보기 시스템

## 개요

노드 설정 모달에서 노드의 입력과 출력을 미리보기하는 시스템입니다. n8n과 유사한 방식으로 **사용자가 직접 입력 데이터를 편집**하고, **이전 노드의 실제 데이터를 참조**할 수 있습니다.

## 설계 원칙

1. **편집 가능한 입력**: 사용자가 직접 입력 데이터를 JSON 형식으로 편집할 수 있습니다
2. **이전 노드 참조**: 이전 노드의 출력 데이터를 스키마 기반으로 가져와서 사용할 수 있습니다
3. **표현식 지원**: `{{$json.field}}` 같은 표현식을 사용하여 동적으로 값을 참조할 수 있습니다
4. **스키마 기반 출력**: 출력 미리보기는 스키마 기반으로 즉시 생성됩니다

## 아키텍처

### 1. 서버 측: 스키마 정의

노드 설정 파일(`server/config/nodes_config.py`)에 각 노드의 입력/출력 스키마를 정의합니다.

```python
"image-touch": {
    "label": "이미지 터치 노드",
    # ... 기타 설정 ...
    "input_schema": {
        "action": {"type": "string", "description": "이전 노드 타입"},
        "status": {"type": "string", "description": "이전 노드 실행 상태"},
        "output": {"type": "any", "description": "이전 노드 출력 데이터"}
    },
    "output_schema": {
        "action": {"type": "string", "description": "노드 타입"},
        "status": {"type": "string", "description": "실행 상태 (completed/failed)"},
        "output": {
            "type": "object",
            "description": "출력 데이터",
            "properties": {
                "success": {"type": "boolean", "description": "성공 여부"},
                "folder_path": {"type": "string", "description": "이미지 폴더 경로"},
                "total_images": {"type": "number", "description": "총 이미지 개수"},
                "results": {
                    "type": "array",
                    "description": "이미지 검색 결과",
                    "items": {
                        "type": "object",
                        "properties": {
                            "image": {"type": "string", "description": "이미지 파일명"},
                            "found": {"type": "boolean", "description": "발견 여부"},
                            "position": {"type": "array", "description": "위치 [x, y]"},
                            "touched": {"type": "boolean", "description": "터치 여부"}
                        }
                    }
                }
            }
        }
    }
}
```

### 2. 클라이언트 측: 미리보기 생성

`UI/src/pages/workflow/config/node-preview-generator.js`에서 스키마를 기반으로 미리보기를 생성합니다.

#### 주요 함수

- `generatePreviewFromSchema(schema, nodeData)`: 스키마를 기반으로 예시 데이터 생성
- `generateInputPreview(nodeType, nodeConfig, previousNodeOutput)`: 입력 미리보기 생성
- `generateOutputPreview(nodeType, nodeConfig, nodeData)`: 출력 미리보기 생성
- `collectPreviousNodeOutput(previousNodes, getNodeConfig)`: 이전 노드들의 출력 스키마 수집

### 3. 노드 설정 모달 통합

`UI/src/pages/workflow/modals/node-settings-modal.js`에서 입력/출력 미리보기를 관리합니다.

#### 입력 데이터 관리

- **편집 가능한 JSON 에디터**: 사용자가 직접 JSON 형식으로 입력 데이터를 편집할 수 있습니다 (`input_data` 필드)
- **이전 노드에서 가져오기**: "이전 노드에서 가져오기" 버튼을 클릭하면 이전 노드의 출력 스키마를 기반으로 입력 데이터를 자동 생성합니다 (`loadInputFromPreviousNode` 메서드)
- **표현식 사용**: `{{$json.field}}` 같은 표현식은 현재 구현되지 않았습니다. 향후 구현 예정입니다.

```javascript
// 입력 미리보기 업데이트 (편집 가능, n8n 스타일)
async updateInputPreview(nodeId, nodeElement) {
    // 저장된 입력 데이터가 있으면 사용
    if (nodeData?.input_data) {
        inputPreview.value = JSON.stringify(nodeData.input_data, null, 2);
        return;
    }
    
    // 저장된 데이터가 없으면 이전 노드의 출력 스키마 기반 예시 생성
    // ...
}

// 이전 노드에서 입력 데이터 가져오기
async loadInputFromPreviousNode(nodeId, nodeElement) {
    // 마지막 이전 노드의 출력 스키마 기반 데이터 생성
    // ...
}
```

#### 출력 미리보기

- **스키마 기반 생성**: 노드의 `output_schema`를 기반으로 즉시 미리보기를 생성합니다
- **편집 가능**: 사용자가 출력 값을 직접 수정할 수 있습니다 (output_override)

```javascript
// 출력 미리보기 업데이트 (스키마 기반, 즉시 표시)
async updateOutputPreview(nodeType, nodeData, nodeElement) {
    // 출력 미리보기 생성
    const displayValue = generateOutputPreview(nodeType, config, updatedNodeData);
    // ...
}
```

## 스키마 타입

### 지원하는 타입

- `string`: 문자열
- `number`: 숫자
- `boolean`: 불린 값
- `array`: 배열
- `object`: 객체
- `any`: 모든 타입

### 스키마 구조

```typescript
interface FieldSchema {
    type: "string" | "number" | "boolean" | "array" | "object" | "any";
    description?: string;  // 필드 설명
    properties?: {         // object 타입인 경우
        [key: string]: FieldSchema;
    };
    items?: FieldSchema;   // array 타입인 경우 아이템 스키마
}
```

## 예시 데이터 생성 규칙

### 필드명 기반 예시 값 생성

필드명과 타입을 분석하여 의미있는 예시 값을 자동 생성합니다:

- **경로 관련** (`path`, `file`, `folder`): `"C:\\example\\path\\file.ext"`
- **URL**: `"https://example.com/api/endpoint"`
- **ID 관련** (`id`, `execution`): 
  - `string`: `"20250101-120000-abc123"`
  - `number`: `12345`
- **개수/총계** (`count`, `total`, `number`): `10`
- **시간 관련** (`time`, `wait`, `elapsed`): `5`
- **성공/상태** (`success`, `found`, `touched`, `focused`, `completed`, `written`): `true`
- **이름/프로세스** (`name`, `process`): `"example_process.exe"`
- **내용/텍스트** (`content`, `text`, `message`, `result`): `"예시 내용"`
- **위치/좌표** (`position`, `coord`): `[100, 200]`
- **모드/인코딩** (`mode`, `encoding`, `type`): `"default"`
- **크기** (`bytes`, `size`): `1024`
- **조건** (`condition`): `'output.value == "test"'`

### 타입 기반 기본값 생성

필드명 패턴이 매칭되지 않으면 타입에 따라 기본값을 생성합니다:

- `string`: 필드명 기반 (`"예시_필드명"`) 또는 특수 필드 (`action` → `"node-type"`, `status` → `"completed"`)
- `number`: `0`
- `boolean`: `false`
- `array`: 스키마에 정의된 아이템 예시 또는 빈 배열 `[]`
- `object`: 스키마에 정의된 속성들 또는 빈 객체 `{}`
- `any`: `null`

### 실제 값 우선

`nodeData`에 실제 값이 있으면 스키마 기반 예시 값 대신 실제 값을 사용합니다.

### 자동 업데이트

노드 설정 모달에서 파라미터를 변경하면 출력 미리보기가 자동으로 업데이트됩니다 (300ms debounce 적용).

## 노드 추가 시 스키마 정의

새로운 노드를 추가할 때는 `server/config/nodes_config.py`에 스키마를 정의해야 합니다.

### 예시: 새 노드 추가

```python
"my-new-node": {
    "label": "새 노드",
    "title": "새 노드",
    "description": "새로운 노드입니다.",
    "script": "node-my-new-node.js",
    "is_boundary": False,
    "category": "action",
    "parameters": {
        # 파라미터 정의...
    },
    "input_schema": {
        "action": {"type": "string", "description": "이전 노드 타입"},
        "status": {"type": "string", "description": "이전 노드 실행 상태"},
        "output": {"type": "any", "description": "이전 노드 출력 데이터"}
    },
    "output_schema": {
        "action": {"type": "string", "description": "노드 타입"},
        "status": {"type": "string", "description": "실행 상태"},
        "output": {
            "type": "object",
            "description": "출력 데이터",
            "properties": {
                "result": {"type": "string", "description": "결과"},
                "data": {"type": "any", "description": "데이터"}
            }
        }
    }
}
```

## 이전 노드 출력 수집

입력 미리보기를 생성할 때, 이전 노드들의 출력 스키마를 수집하여 최종 출력 데이터를 생성합니다.

### 동작 방식

1. 이전 노드 체인을 순회
2. 각 노드의 `output_schema`를 가져옴
3. 마지막 노드의 출력 스키마를 기반으로 예시 데이터 생성
4. 생성된 데이터를 현재 노드의 입력으로 표시

## 사용 방법

### 입력 데이터 편집

1. **직접 입력**: 입력 데이터 필드에 JSON 형식으로 직접 입력할 수 있습니다
   ```json
   {
     "action": "start",
     "status": "completed",
     "output": {
       "value": "test"
     }
   }
   ```

2. **이전 노드에서 가져오기**: "이전 노드에서 가져오기" 버튼을 클릭하면 이전 노드의 출력 스키마를 기반으로 입력 데이터를 자동 생성합니다

3. **표현식 사용**: 표현식을 사용하여 동적으로 값을 참조할 수 있습니다
   ```json
   {
     "action": "process",
     "status": "completed",
     "output": {
       "value": "{{$json.output.value}}"
     }
   }
   ```

### 표현식 문법

- `{{$json.field}}`: 이전 노드의 출력에서 필드 참조
- `{{$json.output.value}}`: 중첩된 필드 참조
- `{{$node["Node Name"].json.field}}`: 특정 노드의 출력 참조

## 조건 노드 기본값 자동 설정

조건 노드를 생성할 때, 이전 노드가 연결되어 있으면 자동으로 기본값이 설정됩니다.

### 동작 방식

1. 조건 노드 생성 시 이전 노드 확인
2. 이전 노드의 출력 스키마를 기반으로 예시 값 생성
3. `field_path`에 `output.{key}` 형식으로 자동 설정 (예: `output.wait_time`)
4. `compare_value`에 해당 값 자동 설정

### 예시

대기 노드(`wait`) 다음에 조건 노드를 생성하면:

- 이전 노드 출력 스키마: `{"action": "wait", "status": "completed", "output": {"wait_time": 1.0}}`
- 자동 설정:
  - `field_path`: `"output.wait_time"`
  - `compare_value`: `"1.0"`

이렇게 설정되면 조건 노드는 `output.wait_time` 필드의 값이 `1.0`인지 확인합니다.

## 장점

1. **유연성**: 사용자가 원하는 대로 입력 데이터를 구성할 수 있습니다
2. **표현식 지원**: 동적으로 값을 참조하여 복잡한 워크플로우 구성 가능
3. **즉시 표시**: 출력 미리보기는 스키마 기반으로 즉시 표시됩니다
4. **일관성**: 스키마 기반으로 일관된 형식의 미리보기 제공
5. **유지보수성**: 스키마만 수정하면 미리보기 자동 업데이트

## 제한사항

1. **표현식 파싱**: 표현식은 실제 실행 시에만 파싱되므로, 미리보기에서는 표현식 그대로 표시됩니다.
2. **스키마 기반 예시**: 이전 노드에서 가져올 때는 스키마 기반 예시 데이터를 사용하므로, 실제 실행 결과와 다를 수 있습니다.
3. **파라미터 의존성**: 일부 노드는 파라미터에 따라 출력이 달라질 수 있지만, 현재는 기본 스키마만 사용합니다.

## 향후 개선 사항

1. **표현식 지원**: `{{$json.field}}` 같은 표현식 파싱 및 평가 기능 추가
2. **표현식 자동완성**: 입력 중 표현식 자동완성 기능 추가
3. **이전 노드 선택**: 여러 이전 노드가 있을 때 선택할 수 있는 UI 추가
4. **실제 실행 옵션**: 사용자가 원할 경우 실제 노드를 실행하여 결과를 보는 옵션
5. **표현식 검증**: 입력 시 표현식 문법 검증 기능 추가
6. **입력 데이터 실행 연동**: `input_data` 필드의 데이터를 실제 노드 실행 시 사용할 수 있도록 연동

## 관련 파일

- `server/config/nodes_config.py`: 노드 스키마 정의
- `UI/src/pages/workflow/config/node-preview-generator.js`: 미리보기 생성 로직
- `UI/src/pages/workflow/modals/node-settings-modal.js`: 미리보기 UI 통합
- `UI/src/pages/workflow/config/node-preview-outputs.js`: 레거시 예시 출력 (참고용)

