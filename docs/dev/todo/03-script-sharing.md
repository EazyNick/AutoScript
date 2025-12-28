**최신 수정일자: 2025.12.00**

# Script Sharing

## Tasks
- User script sharing system
- Public/private script visibility
- Script marketplace
- Share permissions
- Script rating/review

---

## 설계 문서: 파일 기반 노드 및 스크립트 공유 시스템

### 1. 개요

**핵심 아이디어**: 노드와 스크립트를 파일로 내보내고, 특정 폴더에 넣으면 자동으로 로드되는 간단한 공유 시스템

- **노드 공유**: 커스텀 노드 Python 파일을 ZIP으로 내보내기 → 특정 폴더에 압축 해제 → 자동으로 로드
- **스크립트 공유**: 스크립트 구조를 JSON으로 내보내기 → 특정 폴더에 복사 → 자동으로 로드 (노드는 이미 설치되어 있어야 함)

**중요**: 노드 공유가 먼저 선행되어야 함. 스크립트는 노드가 설치된 후에 공유 가능

---

## 노드 공유 워크플로우 다이어그램

### 1. 노드 개발 및 패키징 (개발자 측)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1단계: 노드 개발                                                 │
└─────────────────────────────────────────────────────────────────┘

개발자가 새 노드를 개발:
  ├── server/config/nodes_config.py          (노드 설정 추가)
  ├── server/nodes/actionnodes/my_node.py     (Python 구현)
  ├── UI/src/js/components/node/node-my-node.js  (JavaScript 렌더링)
  └── UI/src/index.html                      (스크립트 태그 추가)

┌─────────────────────────────────────────────────────────────────┐
│ 2단계: 노드 패키징 스크립트 실행                                │
└─────────────────────────────────────────────────────────────────┘

사용자가 패키징 스크립트 실행:
  $ python scripts/package-node.py my-node

또는 배치 파일:
  $ scripts\package-node.bat my-node

┌─────────────────────────────────────────────────────────────────┐
│ 3단계: 자동 파일 수집 및 패키징                                  │
└─────────────────────────────────────────────────────────────────┘

스크립트가 자동으로 수행:
  1. 노드 타입 확인 (nodes_config.py에서)
  2. 관련 파일 자동 수집:
     ├── server/nodes/actionnodes/my_node.py
     ├── UI/src/js/components/node/node-my-node.js
     └── nodes_config.py에서 해당 노드 설정 추출
  3. 임시 폴더에 파일 복사:
     temp-package/
       ├── manifest.json          (자동 생성: 노드 메타데이터)
       ├── node_config.json       (자동 생성: nodes_config.py에서 추출)
       ├── server/
       │   └── node.py            (my_node.py에서 복사)
       └── client/
           └── node-my-node.js    (복사)
  4. ZIP 파일 생성:
     my-node.asnode.zip           (최종 패키지)

┌─────────────────────────────────────────────────────────────────┐
│ 4단계: 패키지 파일 생성 완료                                     │
└─────────────────────────────────────────────────────────────────┘

생성된 파일:
  project-root/
    └── exports/
        └── my-node.asnode.zip    (공유 가능한 패키지)

개발자는 이 파일을:
  - 이메일로 공유
  - 클라우드 스토리지에 업로드
  - GitHub에 업로드
  - 기타 파일 공유 방법으로 배포
```

### 2. 노드 설치 및 통합 (사용자 측)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1단계: 패키지 파일 다운로드                                      │
└─────────────────────────────────────────────────────────────────┘

사용자가 패키지 파일을 받음:
  my-node.asnode.zip

┌─────────────────────────────────────────────────────────────────┐
│ 2단계: 노드 플러그인 폴더에 배치                                 │
└─────────────────────────────────────────────────────────────────┘

사용자가 ZIP 파일을 특정 폴더에 복사:
  project-root/
    └── shared-nodes/              (노드 플러그인 폴더)
        └── my-node.asnode.zip     (복사)

┌─────────────────────────────────────────────────────────────────┐
│ 3단계: 설치 스크립트 실행                                        │
└─────────────────────────────────────────────────────────────────┘

사용자가 설치 스크립트 실행:
  $ python scripts/install-node.py

또는 배치 파일:
  $ scripts\install-node.bat

┌─────────────────────────────────────────────────────────────────┐
│ 4단계: 자동 압축 해제 및 파일 분산                               │
└─────────────────────────────────────────────────────────────────┘

스크립트가 자동으로 수행:
  1. shared-nodes/ 폴더 스캔
  2. .asnode.zip 파일 감지
  3. 각 ZIP 파일 압축 해제:
     shared-nodes/my-node/
       ├── manifest.json
       ├── node_config.json
       ├── server/
       │   └── node.py
       └── client/
           └── node-my-node.js
  4. 파일 검증 (manifest.json, node_config.json 확인)
  5. 파일을 적절한 위치에 복사:
     ├── server/nodes/customnodes/my-node/
     │   └── node.py              (server/node.py에서 복사)
     ├── UI/src/js/components/node/
     │   └── node-my-node.js      (client/node-my-node.js에서 복사)
     └── server/config/custom_nodes_config.json
         └── (node_config.json 내용 추가)

┌─────────────────────────────────────────────────────────────────┐
│ 5단계: 자동 통합 및 등록                                         │
└─────────────────────────────────────────────────────────────────┘

시스템이 자동으로 수행:
  1. Python 모듈 동적 로드 (importlib)
  2. JavaScript 파일 동적 로드 (서버 API를 통해 클라이언트에 알림)
  3. 노드 설정 통합 (custom_nodes_config.json에 추가)
  4. 서버 재시작 없이 노드 사용 가능

┌─────────────────────────────────────────────────────────────────┐
│ 6단계: 노드 사용 가능                                            │
└─────────────────────────────────────────────────────────────────┘

사용자는 즉시 새 노드를 사용할 수 있음:
  - 워크플로우 에디터에서 노드 추가 시 새 노드가 목록에 표시
  - 노드 설정 모달에서 파라미터 설정 가능
  - 워크플로우 실행 시 정상 작동
```

### 3. 전체 워크플로우 요약 다이어그램

```
┌─────────────────────────────────────────────────────────────────┐
│                    노드 공유 전체 워크플로우                     │
└─────────────────────────────────────────────────────────────────┘

[개발자 측]                                    [사용자 측]
     │                                              │
     │ 1. 노드 개발                                 │
     │    - Python 파일 작성                        │
     │    - JavaScript 파일 작성                    │
     │    - nodes_config.py 설정 추가               │
     │                                              │
     ▼                                              │
     │ 2. 패키징 스크립트 실행                      │
     │    $ package-node.py my-node                 │
     │                                              │
     ▼                                              │
     │ 3. 자동 파일 수집                            │
     │    - 관련 파일 자동 탐지                     │
     │    - manifest.json 생성                      │
     │    - node_config.json 생성                   │
     │                                              │
     ▼                                              │
     │ 4. ZIP 패키지 생성                           │
     │    my-node.asnode.zip                        │
     │                                              │
     ▼                                              │
     │ 5. 파일 공유                                 │
     │    ────────────────────────────────────────> │
     │                                              │ 1. 패키지 다운로드
     │                                              │    my-node.asnode.zip
     │                                              │
     │                                              ▼
     │                                              │ 2. 플러그인 폴더에 배치
     │                                              │    shared-nodes/
     │                                              │
     │                                              ▼
     │                                              │ 3. 설치 스크립트 실행
     │                                              │    $ install-node.py
     │                                              │
     │                                              ▼
     │                                              │ 4. 자동 압축 해제
     │                                              │    - ZIP 파일 압축 해제
     │                                              │    - 파일 검증
     │                                              │
     │                                              ▼
     │                                              │ 5. 파일 자동 분산
     │                                              │    - Python 파일 복사
     │                                              │    - JavaScript 파일 복사
     │                                              │    - 설정 파일 통합
     │                                              │
     │                                              ▼
     │                                              │ 6. 자동 등록 및 로드
     │                                              │    - Python 모듈 동적 로드
     │                                              │    - JavaScript 동적 로드
     │                                              │    - 설정 통합
     │                                              │
     │                                              ▼
     │                                              │ 7. 노드 사용 가능
     │                                              │    (서버 재시작 불필요)
     │                                              │
```

### 4. 패키징 스크립트 동작 상세

```
┌─────────────────────────────────────────────────────────────────┐
│ package-node.py 실행 흐름                                        │
└─────────────────────────────────────────────────────────────────┘

입력: 노드 타입 (예: "my-node")

1. 노드 설정 확인
   └──> nodes_config.py에서 노드 타입 검색
        ├── 설정 존재 확인
        └── script 필드에서 JavaScript 파일명 확인

2. Python 파일 찾기
   └──> 노드 카테고리별로 검색
        ├── server/nodes/actionnodes/
        ├── server/nodes/conditionnodes/
        ├── server/nodes/waitnodes/
        └── server/nodes/imagenodes/
        └──> {node_type}.py 또는 {node_type_snake_case}.py 찾기

3. JavaScript 파일 찾기
   └──> UI/src/js/components/node/
        └──> node-{node_type}.js 찾기

4. manifest.json 생성
   └──> 노드 메타데이터 수집
        ├── node_type: "my-node"
        ├── node_kind: "python" 또는 "javascript"
        ├── files: [수집된 파일 목록]
        └── metadata: [nodes_config.py에서 추출]

5. node_config.json 생성
   └──> nodes_config.py에서 해당 노드 설정 추출
        ├── label, title, description
        ├── parameters
        ├── input_schema
        └── output_schema

6. 임시 폴더에 파일 복사
   temp-package/
     ├── manifest.json
     ├── node_config.json
     ├── server/node.py
     └── client/node-my-node.js

7. ZIP 파일 생성
   └──> exports/my-node.asnode.zip

8. 임시 폴더 정리
   └──> temp-package/ 삭제

출력: exports/my-node.asnode.zip
```

### 5. 설치 스크립트 동작 상세

```
┌─────────────────────────────────────────────────────────────────┐
│ install-node.py 실행 흐름                                       │
└─────────────────────────────────────────────────────────────────┘

1. shared-nodes/ 폴더 스캔
   └──> .asnode.zip 파일 찾기

2. 각 ZIP 파일 처리
   └──> for each .asnode.zip:
        ├── 압축 해제
        │   └──> shared-nodes/{node-name}/
        │
        ├── manifest.json 검증
        │   ├── 필수 필드 확인
        │   └── 파일 목록 확인
        │
        ├── node_config.json 검증
        │   └── 스키마 검증
        │
        ├── Python 파일 검증 (Python 노드인 경우)
        │   ├── 문법 검증
        │   ├── 필수 클래스 확인
        │   └── NodeExecutor 데코레이터 확인
        │
        ├── JavaScript 파일 검증
        │   └── 문법 검증
        │
        ├── 중복 확인
        │   ├── 같은 node_type이 이미 있는지 확인
        │   └── 버전 비교 (있는 경우)
        │
        ├── 파일 복사
        │   ├── server/node.py
        │   │   └──> server/nodes/customnodes/{node-type}/node.py
        │   │
        │   └── client/node-*.js
        │       └──> UI/src/js/components/node/node-*.js
        │
        ├── 설정 통합
        │   └──> custom_nodes_config.json에 추가
        │
        ├── Python 모듈 동적 로드
        │   └──> importlib로 모듈 로드
        │
        └── JavaScript 동적 로드 알림
            └──> 서버 API를 통해 클라이언트에 알림

3. 설치 완료 알림
   └──> 설치된 노드 목록 표시
```

---

## Part 1: 노드 공유 시스템

### 1.1 노드 공유 개요

**핵심 아이디어**: 커스텀 노드를 ZIP 파일로 내보내고, 특정 폴더에 압축 해제하면 자동으로 로드되는 시스템

- **공유하는 사람**: 커스텀 노드의 모든 파일을 ZIP으로 내보내기 → 파일 공유
- **공유받는 사람**: ZIP 파일 다운로드 → 특정 폴더에 압축 해제 → 자동으로 로드됨

**중요**: 현재 노드 생성 방법은 여러 파일에 분산되어 있어 공유가 복잡함. 노드 패키지 구조를 표준화하여 모든 파일을 하나의 패키지로 묶어야 함.

### 1.2 현재 노드 생성 방법의 문제점

현재 노드 생성 시 다음 파일들이 분산되어 있음:

**Python 노드의 경우**:
1. `server/config/nodes_config.py` - 노드 설정 (하드코딩)
2. `server/nodes/{카테고리}/{이름}.py` - Python 구현 파일
3. `UI/src/js/components/node/node-{이름}.js` - JavaScript 렌더링 파일
4. `UI/src/pages/workflow/config/node-preview-outputs.js` - 예시 출력 함수 (선택)

**참고**: 
- JavaScript 파일은 `NodeRegistry`를 통해 **자동으로 로드**됩니다. `index.html` 수정이 필요 없습니다.
- `nodes_config.py`의 `script` 필드만 올바르게 설정하면 자동으로 로드됩니다.

**JavaScript 노드의 경우**:
1. `server/config/nodes_config.py` - 노드 설정 (하드코딩)
2. `UI/src/js/components/node/node-{이름}.js` - JavaScript 구현 파일
3. `UI/src/pages/workflow/config/node-preview-outputs.js` - 예시 출력 함수 (선택)

**참고**: 
- JavaScript 파일은 `NodeRegistry`를 통해 **자동으로 로드**됩니다. `index.html` 수정이 필요 없습니다.
- `nodes_config.py`의 `script` 필드만 올바르게 설정하면 자동으로 로드됩니다.

**문제점**:
- 노드가 여러 파일에 분산되어 있어 공유 시 모든 파일을 찾아야 함
- `nodes_config.py`에 하드코딩되어 있어 동적 로드 불가 (커스텀 노드의 경우)
- 노드 설치 시 여러 위치에 파일을 복사해야 함

### 1.3 개선된 노드 패키지 구조

노드 공유를 위해 노드 패키지 구조를 표준화:

```
{노드명}.asnode.zip
├── manifest.json              # 노드 패키지 메타데이터 (필수)
├── node_config.json           # 노드 설정 (필수)
├── server/                    # 서버 측 파일 (Python 노드인 경우)
│   └── node.py                # Python 구현 파일
├── client/                    # 클라이언트 측 파일
│   ├── node-{이름}.js         # JavaScript 렌더링/실행 파일
│   └── preview-output.js      # 예시 출력 함수 (선택)
├── README.md                  # 노드 설명 및 사용법 (선택적)
└── requirements.txt           # Python 의존성 (선택적)
```

#### manifest.json 구조

```json
{
  "version": "1.0.0",
  "format": "autoscript-node",
  "node_type": "my-custom-node",
  "node_category": "action",  // "action", "condition", "wait", "image", "boundary", "custom"
  "node_kind": "python",      // "python" 또는 "javascript"
  "files": {
    "server": ["server/node.py"],  // 서버 측 파일 목록
    "client": [                    // 클라이언트 측 파일 목록
      "client/node-my-custom-node.js",
      "client/preview-output.js"
    ]
  },
  "metadata": {
    "name": "커스텀 노드",
    "author": "홍길동",
    "version": "1.0.0",
    "created_at": "2025-12-14T10:00:00Z",
    "description": "사용자 정의 커스텀 노드입니다",
    "tags": ["custom", "automation"]
  }
}
```

#### node_config.json 구조

```json
{
  "label": "커스텀 노드",
  "title": "커스텀 노드",
  "description": "사용자 정의 커스텀 노드입니다",
  "script": "node-my-custom-node.js",  // 클라이언트 JS 파일명
  "is_boundary": false,
  "category": "custom",
  "parameters": {
    "param1": {
      "type": "string",
      "label": "파라미터 1",
      "description": "첫 번째 파라미터",
      "default": "",
      "required": true
    }
  },
  "input_schema": {
    "action": {"type": "string", "description": "이전 노드 타입"},
    "status": {"type": "string", "description": "이전 노드 실행 상태"},
    "output": {"type": "any", "description": "이전 노드 출력 데이터"}
  },
  "output_schema": {
    "action": {"type": "string", "description": "노드 타입"},
    "status": {"type": "string", "description": "실행 상태"},
    "output": {"type": "object", "description": "출력 데이터"}
  }
}
```

#### server/node.py 구조 (Python 노드인 경우)

```python
"""
커스텀 노드 구현
"""
from typing import Any
from nodes.base_node import BaseNode
from nodes.node_executor_wrapper import NodeExecutor

class MyCustomNode(BaseNode):
    @staticmethod
    @NodeExecutor("my-custom-node")
    async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
        # 커스텀 노드 로직
        param1 = parameters.get("param1", "")
        
        # 노드 실행 로직
        result = {"processed": param1}
        
        return {
            "action": "my-custom-node",
            "status": "completed",
            "output": result
        }
```

#### client/node-{이름}.js 구조

```javascript
// node-my-custom-node.js
(function () {
    if (!window.NodeManager) {
        const checkAndRegister = () => {
            if (window.NodeManager && window.NodeManager.registerNodeType) {
                registerNode();
            } else {
                setTimeout(checkAndRegister, 50);
            }
        };
        checkAndRegister();
        return;
    }

    function registerNode() {
        window.NodeManager.registerNodeType('my-custom-node', {
            renderContent(nodeData) {
                // 렌더링 로직
                return `...`;
            },
            async execute(nodeData) {
                // 실행 로직 (선택)
            }
        });
    }

    if (window.NodeManager && window.NodeManager.registerNodeType) {
        registerNode();
    }
})();
```

#### client/preview-output.js 구조 (선택)

```javascript
// preview-output.js
// node-preview-outputs.js에 자동으로 통합됨
export function generateMyCustomNodeOutput(nodeData) {
    const param1 = nodeData?.param1 || '기본값';
    return JSON.stringify({
        action: "my-custom-node",
        status: "completed",
        output: {
            param1: param1,
            result: "성공"
        }
    }, null, 2);
}
```

#### node_config.json 구조

```json
{
  "version": "1.0.0",
  "format": "autoscript-node",
  "node_type": "my-custom-node",
  "metadata": {
    "name": "커스텀 노드",
    "label": "커스텀 노드",
    "title": "커스텀 노드",
    "description": "사용자 정의 커스텀 노드입니다",
    "author": "홍길동",
    "version": "1.0.0",
    "created_at": "2025-12-14T10:00:00Z",
    "category": "custom",
    "tags": ["custom", "automation"]
  },
  "config": {
    "label": "커스텀 노드",
    "title": "커스텀 노드",
    "description": "사용자 정의 커스텀 노드입니다",
    "is_boundary": false,
    "category": "custom",
    "parameters": {
      "param1": {
        "type": "string",
        "label": "파라미터 1",
        "description": "첫 번째 파라미터",
        "default": "",
        "required": true
      }
    },
    "input_schema": {
      "action": {"type": "string", "description": "이전 노드 타입"},
      "status": {"type": "string", "description": "이전 노드 실행 상태"},
      "output": {"type": "any", "description": "이전 노드 출력 데이터"}
    },
    "output_schema": {
      "action": {"type": "string", "description": "노드 타입"},
      "status": {"type": "string", "description": "실행 상태"},
      "output": {"type": "object", "description": "출력 데이터"}
    }
  }
}
```

#### node.py 구조

```python
"""
커스텀 노드 구현
"""
from typing import Any
from nodes.base_node import BaseNode
from nodes.node_executor_wrapper import NodeExecutor

class MyCustomNode(BaseNode):
    @staticmethod
    @NodeExecutor("my-custom-node")
    async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
        # 커스텀 노드 로직
        param1 = parameters.get("param1", "")
        
        # 노드 실행 로직
        result = {"processed": param1}
        
        return {
            "action": "my-custom-node",
            "status": "completed",
            "output": result
        }
```

### 1.3 노드 공유 폴더 구조

```
{프로젝트 루트}/
  shared-nodes/                # 공유 노드 폴더 (자동 감지)
    ├── my-custom-node.asnode.zip
    ├── another-node.asnode.zip
    └── ...
```

**또는 압축 해제된 구조**:
```
{프로젝트 루트}/
  shared-nodes/
    ├── my-custom-node/         # 압축 해제된 폴더
    │   ├── node.py
    │   ├── node_config.json
    │   └── README.md
    └── ...
```

### 1.4 데이터베이스 스키마 확장

```sql
-- 공유 노드 메타데이터 (파일 기반)
CREATE TABLE shared_node_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL UNIQUE,  -- 파일 경로
    file_name TEXT NOT NULL,  -- 파일명
    file_hash TEXT NOT NULL,  -- 파일 해시 (중복 감지용)
    node_type TEXT NOT NULL UNIQUE,  -- 노드 타입 (예: "my-custom-node")
    metadata_name TEXT,  -- 파일의 metadata.name
    metadata_author TEXT,  -- 파일의 metadata.author
    metadata_version TEXT,  -- 파일의 metadata.version
    installed_path TEXT,  -- 설치된 Python 파일 경로
    is_enabled BOOLEAN DEFAULT 1,  -- 활성화 여부
    last_loaded_at TIMESTAMP,  -- 마지막 로드 시간
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 노드 변경 감지 로그
CREATE TABLE shared_node_file_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL,
    change_type TEXT NOT NULL,  -- 'added', 'modified', 'deleted'
    file_hash TEXT,
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 1.4 노드 생성 방법 개선 (선택적, 권장)

현재 노드 생성 방법을 개선하여 공유를 용이하게 할 수 있음:

**개선 방향**:
1. **노드 패키지 구조 표준화**: 모든 노드 파일을 하나의 폴더에 묶기
2. **동적 설정 로드**: `nodes_config.py` 대신 JSON 파일로 설정 관리
3. **동적 스크립트 로드**: `index.html` 수정 없이 JavaScript 파일 동적 로드
4. **노드 패키지 메타데이터**: 노드 타입, 파일 목록 등을 명시하는 manifest 파일

**새로운 노드 생성 워크플로우 (권장)**:
1. `server/nodes/customnodes/{node_type}/` 폴더 생성
2. `manifest.json` 작성 (노드 메타데이터)
3. `node_config.json` 작성 (노드 설정)
4. `server/node.py` 작성 (Python 노드인 경우)
5. `client/node-{이름}.js` 작성 (JavaScript 렌더링/실행)
6. `client/preview-output.js` 작성 (선택, 예시 출력)
7. 서버가 자동으로 감지하여 로드

**기존 노드와의 호환성**:
- 기존 노드도 계속 작동 (하위 호환성 유지)
- 기존 노드를 새 구조로 마이그레이션하는 도구 제공 (선택적)

### 1.5 노드 내보내기 (Export)

**UI 위치**: 노드 설정 모달 또는 별도 노드 관리 페이지

**동작 흐름**:
1. 사용자가 "노드 내보내기" 버튼 클릭
2. **노드 파일 수집**:
   - **새 구조인 경우**: `server/nodes/customnodes/{node_type}/` 폴더에서 모든 파일 수집
   - **기존 구조인 경우**: 
     - Python 파일: `server/nodes/{카테고리}/{node_type}.py` 찾기
     - JavaScript 파일: `UI/src/js/components/node/node-{node_type}.js` 찾기
     - 설정: `nodes_config.py`에서 해당 노드 타입 정보 추출
     - 예시 출력: `node-preview-outputs.js`에서 해당 함수 추출 (있는 경우)
3. **노드 패키지 생성**:
   - `manifest.json` 생성 (노드 메타데이터)
   - `node_config.json` 생성 (노드 설정)
   - `server/node.py` 복사 (Python 노드인 경우)
   - `client/node-{이름}.js` 복사
   - `client/preview-output.js` 복사 (있는 경우)
   - `README.md` 복사 (있는 경우)
   - `requirements.txt` 복사 (있는 경우)
   - ZIP 파일로 압축
4. 브라우저 다운로드 다이얼로그 표시
5. ZIP 파일 저장

**구현 위치**:
- `server/api/node_router.py`에 내보내기 API 추가
- `UI/src/pages/workflow/modals/node-settings-modal.js`에 버튼 추가
- 또는 별도 노드 관리 페이지 생성

### 1.6 노드 자동 로드 (Import)

**동작 흐름**:
1. 서버 시작 시 `shared-nodes/` 폴더 스캔
2. `.asnode.zip` 파일 또는 압축 해제된 폴더 감지
3. **ZIP 파일 처리**:
   - ZIP 파일이면 압축 해제 (`shared-nodes/{노드명}/`)
   - 압축 해제된 폴더면 그대로 사용
4. **manifest.json 검증**:
   - `manifest.json` 파일 존재 확인
   - 필수 필드 검증 (`node_type`, `node_kind`, `files`)
5. **노드 설치**:
   - **서버 측 파일 설치**:
     - `server/node.py` 파일을 `server/nodes/customnodes/{node_type}/node.py`로 복사
     - 또는 기존 구조 유지: `server/nodes/{카테고리}/{node_type}.py`로 복사
     - `__init__.py` 파일 생성/업데이트 (필요시)
     - Python 모듈 동적 로드 (importlib 사용)
   - **클라이언트 측 파일 설치**:
     - `client/node-{이름}.js` 파일을 `UI/src/js/components/node/`로 복사
     - JavaScript 파일 동적 로드 (서버 API를 통해 클라이언트에 알림)
     - `client/preview-output.js` 파일을 `node-preview-outputs.js`에 통합 (있는 경우)
   - **노드 설정 등록**:
     - `node_config.json` 파싱
     - 동적 설정 파일 (`server/config/custom_nodes_config.json`)에 추가
     - 또는 `nodes_config.py`에 동적 추가 (런타임 메모리)
6. 파일 해시 계산 (중복 체크)
7. DB에 노드 메타데이터 저장
8. 노드 타입 등록 (서버 재시작 없이 사용 가능하도록)

**노드 설치 로직**:
- 노드 파일을 적절한 위치에 복사
- 중복 노드 타입 처리: 같은 타입이 이미 있으면 버전 비교 또는 사용자 선택
- 노드 설정 등록: 동적 설정 파일 또는 메모리 기반 설정 관리
- 서버 재시작 없이 동적 로드 (importlib 사용)
- 클라이언트 JavaScript 파일 동적 로드 (서버 API를 통해 클라이언트에 스크립트 태그 추가 알림)

**동적 설정 관리**:
- `server/config/custom_nodes_config.json`: 커스텀 노드 설정 파일 (동적 관리)
- 서버 시작 시 `nodes_config.py`와 `custom_nodes_config.json` 병합
- API를 통해 클라이언트에 통합된 설정 제공

**동적 JavaScript 로드**:
- 서버가 노드 설치 시 클라이언트에 WebSocket 또는 API를 통해 알림
- 클라이언트가 동적으로 `<script>` 태그 생성하여 JavaScript 파일 로드
- 또는 서버가 통합된 JavaScript 번들을 제공하여 동적 로드

**파일 감시 (File Watcher)**:
- Python: `watchdog` 라이브러리 사용
- ZIP 파일 추가/수정/삭제 실시간 감지
- 변경 시 자동으로 재로드 및 재설치

**동적 설정 관리 상세**:

1. **설정 파일 구조**:
   ```
   server/config/
     ├── nodes_config.py              # 표준 노드 설정 (하드코딩)
     └── custom_nodes_config.json     # 커스텀 노드 설정 (동적 관리)
   ```

2. **설정 병합 로직**:
   - 서버 시작 시 `nodes_config.py`의 `NODES_CONFIG` 로드
   - `custom_nodes_config.json` 파일 읽기 (있는 경우)
   - 두 설정을 병합하여 메모리에 저장
   - API 엔드포인트 `/api/nodes/config`에서 통합된 설정 제공

3. **설정 업데이트**:
   - 노드 설치 시 `custom_nodes_config.json`에 노드 설정 추가
   - 노드 삭제 시 `custom_nodes_config.json`에서 노드 설정 제거
   - 서버 재시작 없이 메모리 기반 설정 업데이트

**JavaScript 동적 로드 상세**:

> **참고**: 현재 시스템은 이미 동적 JavaScript 로드를 지원합니다. `NodeRegistry`가 서버의 `/api/config/nodes` API에서 노드 설정을 가져와 자동으로 JavaScript 파일을 로드합니다.

1. **서버 측** (현재 구현됨):
   - `/api/config/nodes` API에서 모든 노드 설정 제공 (표준 노드 + 커스텀 노드)
   - 각 노드 설정에 `script` 필드 포함
   - 커스텀 노드 설치 시 `custom_nodes_config.json`에 추가

2. **클라이언트 측** (현재 구현됨):
   - `NodeRegistry`가 페이지 로드 시 `/api/config/nodes` 호출
   - 각 노드의 `script` 필드를 확인하여 JavaScript 파일 동적 로드
   - `/static/js/components/node/{script}` 경로에서 파일 로드
   - `WorkflowPage` 초기화 시 `loadAllNodeScripts()` 자동 호출

3. **실시간 업데이트** (향후 구현):
   - WebSocket 또는 Server-Sent Events를 통해 노드 설치/삭제 알림
   - 클라이언트가 알림을 받으면 해당 노드의 JavaScript 파일 동적 로드/제거
   - 현재는 페이지 새로고침 시 자동으로 새 노드가 로드됨

**구현 위치**:
- `server/services/shared_node_loader.py` (신규) - 노드 파일 로드 서비스
- `server/services/custom_node_installer.py` (신규) - 노드 설치 서비스
- `server/services/custom_node_config_manager.py` (신규) - 동적 설정 관리
- `server/services/custom_node_script_loader.py` (신규) - JavaScript 동적 로드 관리
- `server/api/node_router.py` (신규 또는 확장) - 노드 관련 API
- `server/main.py`에서 서버 시작 시 초기화

### 1.7 노드 중복 방지 로직

- **파일 해시 기반**: SHA-256 해시로 동일 파일 감지
- **노드 타입 기반**: 같은 타입의 노드가 있으면 버전 비교
- **사용자 선택**: 중복 발견 시 사용자에게 선택권 제공 (덮어쓰기/건너뛰기/새 이름으로)

### 1.8 노드 공유 API 설계

```python
# GET /api/nodes/{node_type}/export
# 노드를 ZIP 파일로 내보내기
Response:
    - Content-Type: application/zip
    - Content-Disposition: attachment; filename="{node_type}.asnode.zip"
    - ZIP 파일 다운로드

# GET /api/nodes/config
# 통합된 노드 설정 조회 (표준 노드 + 커스텀 노드)
Response: {
    "nodes": {
        "start": {...},  // 표준 노드
        "my-custom-node": {...}  // 커스텀 노드
    }
}

# GET /api/nodes/scripts
# 설치된 커스텀 노드의 JavaScript 파일 목록 조회
Response: {
    "scripts": [
        {
            "node_type": "my-custom-node",
            "script_path": "/static/js/components/node/node-my-custom-node.js",
            "preview_output_path": "/static/js/components/node/preview-outputs.js"  // 선택적
        }
    ]
}

# GET /api/shared-nodes/files
# 공유 폴더의 노드 파일 목록 조회
Response: {
    "files": [
        {
            "file_path": "shared-nodes/my-custom-node.asnode.zip",
            "file_name": "my-custom-node.asnode.zip",
            "node_type": "my-custom-node",
            "metadata": {
                "name": "커스텀 노드",
                "author": "홍길동",
                "version": "1.0.0"
            },
            "is_loaded": true,
            "installed_path": "server/nodes/customnodes/my-custom-node/node.py",
            "last_loaded_at": "2025-12-14T10:00:00Z"
        }
    ]
}

# POST /api/shared-nodes/files/load
# 특정 노드 파일 강제 로드
Request: {
    "file_path": "shared-nodes/my-custom-node.asnode.zip"
}
Response: {
    "node_type": "my-custom-node",
    "installed_path": "server/nodes/customnodes/my-custom-node/node.py",
    "script_path": "/static/js/components/node/node-my-custom-node.js",
    "warnings": []  # 경고 메시지 (예: 노드 충돌)
}

# POST /api/shared-nodes/files/reload-all
# 모든 공유 노드 파일 재로드

# DELETE /api/shared-nodes/files/{file_id}
# 공유 노드 파일 비활성화 (파일은 유지, DB에서만 제거)

# GET /api/shared-nodes/installed
# 설치된 커스텀 노드 목록 조회
Response: {
    "custom_nodes": [
        {
            "node_type": "my-custom-node",
            "node_kind": "python",
            "server_path": "server/nodes/customnodes/my-custom-node/node.py",
            "client_script": "node-my-custom-node.js",
            "installed_from": "shared-nodes/my-custom-node.asnode.zip",
            "version": "1.0.0",
            "metadata": {...}
        }
    ]
}

# POST /api/nodes/{node_type}/reload
# 특정 노드 재로드 (서버 재시작 없이)
Request: {}
Response: {
    "node_type": "my-custom-node",
    "status": "reloaded"
}
```

### 1.9 노드 검증 및 보안

#### 검증 항목

1. **패키지 구조 검증**:
   - `manifest.json` 파일 존재 및 유효성 확인
   - 필수 필드 검증 (`node_type`, `node_kind`, `files`)
   - 파일 목록과 실제 파일 일치 확인

2. **ZIP 파일 검증**:
   - 유효한 ZIP 파일인지 확인
   - ZIP 파일 내부 경로 검증 (상위 디렉토리 접근 방지, `../` 경로 차단)

3. **JSON 형식 검증**:
   - `manifest.json` 유효성 확인
   - `node_config.json` 유효성 확인
   - 필수 필드 존재 확인

4. **Python 파일 검증** (Python 노드인 경우):
   - Python 문법 검증 (AST 파싱)
   - 필수 클래스 및 메서드 존재 확인
   - `NodeExecutor` 데코레이터 사용 확인
   - `BaseNode` 상속 확인
   - 위험한 함수 사용 감지 (`eval`, `exec`, `__import__`, `compile` 등)
   - 파일 시스템 접근 패턴 감지 (`open`, `os.system`, `subprocess` 등)
   - 네트워크 접근 패턴 감지 (`requests`, `urllib`, `socket` 등)

5. **JavaScript 파일 검증**:
   - JavaScript 문법 검증
   - `registerNodeType` 함수 호출 확인
   - 위험한 함수 사용 감지 (`eval`, `Function`, `setTimeout` with string 등)

6. **노드 타입 중복 확인**:
   - 같은 타입의 노드가 이미 있는지 확인
   - 버전 비교 (새 버전이면 업데이트, 아니면 경고)

7. **의존성 확인**:
   - `requirements.txt`의 패키지 설치 가능 여부
   - 의존성 충돌 확인

#### 보안 고려사항

1. **파일 시스템 보안**:
   - 파일 경로 검증 (Path Traversal 방지)
   - 파일 확장자 검증 (`.asnode.zip`만 허용)
   - ZIP 파일 내부 경로 검증 (상위 디렉토리 접근 방지)
   - 설치 경로 검증 (시스템 디렉토리 접근 방지)

2. **코드 실행 보안**:
   - Python 코드 검증 (위험한 함수 사용 감지)
   - JavaScript 코드 검증 (XSS, 코드 인젝션 방지)
   - 샌드박스 실행 환경 (선택적, 고급 보안)
   - 권한 제한 (파일 시스템 접근, 네트워크 접근 제한)

3. **네트워크 보안**:
   - 외부 리소스 로드 제한 (선택적)
   - HTTPS 통신 강제 (선택적)

4. **데이터 보안**:
   - 노드 패키지 서명 및 검증 (선택적)
   - 해시 검증 (파일 무결성 확인)

### 1.10 노드 생성 방법 개선 요약

**현재 문제점**:
- 노드가 여러 파일에 분산되어 있음
- `nodes_config.py`에 하드코딩되어 동적 로드 불가
- `index.html`에 수동으로 스크립트 태그 추가 필요

**개선 방안**:
1. **표준화된 노드 패키지 구조**: 모든 노드 파일을 하나의 패키지로 묶기
2. **동적 설정 관리**: JSON 파일 기반 설정으로 전환
3. **동적 JavaScript 로드**: 서버 API를 통해 클라이언트에 스크립트 목록 제공
4. **manifest.json**: 노드 메타데이터 및 파일 목록 명시

**구현 우선순위**:
1. **Phase 1**: 노드 패키지 구조 표준화 및 내보내기 기능
2. **Phase 2**: 동적 설정 관리 및 동적 JavaScript 로드
3. **Phase 3**: 기존 노드 마이그레이션 도구 (선택적)

---

## Part 2: 스크립트 공유 시스템

### 2.1 스크립트 공유 개요

**핵심 아이디어**: 스크립트를 JSON 파일로 내보내고, 특정 폴더에 넣으면 자동으로 로드되는 간단한 공유 시스템

- **공유하는 사람**: 스크립트를 JSON 파일로 내보내기 → 파일 공유 (이메일, 클라우드, GitHub 등)
- **공유받는 사람**: 파일을 다운로드 → 특정 폴더에 복사 → 자동으로 로드됨

**중요**: 스크립트 공유 시 커스텀 노드는 포함하지 않음. 노드는 별도로 공유되어야 하며, 스크립트를 사용하려면 필요한 노드가 먼저 설치되어 있어야 함.

### 2.2 스크립트 파일 구조

```json
{
  "version": "1.0.0",
  "format": "autoscript-script",
  "metadata": {
    "name": "로그인 자동화",
    "description": "사용자 로그인 프로세스를 자동화합니다",
    "author": "홍길동",
    "version": "1.0.0",
    "created_at": "2025-12-14T10:00:00Z",
    "tags": ["login", "automation", "web"],
    "node_count": 5,
    "required_nodes": ["my-custom-node", "another-custom-node"]  // 필요한 커스텀 노드 목록
  },
  "script": {
    "id": null,  // 로드 시 자동 생성
    "name": "로그인 자동화",
    "description": "사용자 로그인 프로세스를 자동화합니다",
    "active": true,
    "execution_order": null
  },
  "nodes": [
    {
      "id": "start",
      "type": "start",
      "position": {"x": 100, "y": 100},
      "parameters": {},
      "data": {}
    },
    {
      "id": "custom-1",
      "type": "my-custom-node",  // 커스텀 노드 타입 (이미 설치되어 있어야 함)
      "position": {"x": 200, "y": 100},
      "parameters": {},
      "data": {}
    },
    // ... 기타 노드들
  ],
  "connections": [
    {
      "from": "start",
      "to": "custom-1",
      "outputType": "default"
    },
    // ... 기타 연결선들
  ]
}
```

#### 2.3 파일 명명 규칙

- **스크립트 파일**: `{스크립트명}.asscript.json`
- **예시**: `로그인_자동화.asscript.json`
- 파일명에 특수문자 제한 (파일 시스템 호환성)

### 2.4 스크립트 공유 폴더 구조

```
{프로젝트 루트}/
  shared-scripts/          # 공유 스크립트 폴더 (자동 감지)
    ├── 로그인_자동화.asscript.json
    ├── 데이터_처리.asscript.json
    └── ...
```

### 2.5 데이터베이스 스키마 확장

```sql
-- 공유 스크립트 메타데이터 (파일 기반)
CREATE TABLE shared_script_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL UNIQUE,  -- 파일 경로
    file_name TEXT NOT NULL,  -- 파일명
    file_hash TEXT NOT NULL,  -- 파일 해시 (중복 감지용)
    script_id INTEGER,  -- 로드된 스크립트 ID (NULL이면 아직 로드 안됨)
    metadata_name TEXT,  -- 파일의 metadata.name
    metadata_author TEXT,  -- 파일의 metadata.author
    metadata_version TEXT,  -- 파일의 metadata.version
    required_nodes TEXT,  -- JSON 배열: 필요한 커스텀 노드 목록
    is_enabled BOOLEAN DEFAULT 1,  -- 활성화 여부
    last_loaded_at TIMESTAMP,  -- 마지막 로드 시간
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 파일 변경 감지 로그
CREATE TABLE shared_script_file_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL,
    change_type TEXT NOT NULL,  -- 'added', 'modified', 'deleted'
    file_hash TEXT,
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2.6 스크립트 내보내기 (Export)

**UI 위치**: 스크립트 카드 또는 에디터 상단에 "내보내기" 버튼

**동작 흐름**:
1. 사용자가 "내보내기" 버튼 클릭
2. 현재 스크립트 데이터 수집 (노드, 연결선, 메타데이터)
3. **필요한 노드 감지**: 스크립트에 사용된 노드 중 표준 노드가 아닌 것들 찾기
4. **JSON 파일 생성**:
   - 스크립트 구조 저장
   - 필요한 커스텀 노드 목록 포함
5. 브라우저 다운로드 다이얼로그 표시
6. JSON 파일 저장

**필요한 노드 감지 로직**:
- `nodes_config.py`에 정의된 노드 = 표준 노드 (제외)
- 그 외의 노드 타입 = 커스텀 노드 (필요한 노드 목록에 추가)

**구현 위치**:
- `UI/src/pages/workflow/services/script-export-service.js` (신규)
- `server/api/script_router.py`에 내보내기 API 추가
- 또는 `UI/src/js/components/sidebar/sidebar-scripts.js`에 메서드 추가

### 2.7 스크립트 자동 로드 (Import)

**동작 흐름**:
1. 서버 시작 시 `shared-scripts/` 폴더 스캔
2. `.asscript.json` 파일 감지
3. 파일 해시 계산 (중복 체크)
4. **필요한 노드 확인**:
   - `required_nodes` 목록 확인
   - 각 노드가 설치되어 있는지 확인
   - 누락된 노드가 있으면 경고 표시 (로드는 계속 진행)
5. DB에 파일 메타데이터 저장
6. `script.json` 파싱 및 검증
7. DB에 스크립트 생성 (중복 방지)
8. 파일 변경 감지 (File Watcher)

**필요한 노드 확인 로직**:
- `required_nodes` 목록을 순회하며 각 노드 타입 확인
- `shared_node_files` 테이블에서 `node_type`으로 조회
- 설치되지 않은 노드가 있으면 경고 메시지 생성
- 스크립트는 로드하되, 누락된 노드가 있으면 사용 불가 상태로 표시

**파일 감시 (File Watcher)**:
- Python: `watchdog` 라이브러리 사용
- JSON 파일 추가/수정/삭제 실시간 감지
- 변경 시 자동으로 재로드

**구현 위치**:
- `server/services/shared_script_loader.py` (신규)
- `server/main.py`에서 서버 시작 시 초기화

### 2.8 스크립트 중복 방지 로직

- **파일 해시 기반**: SHA-256 해시로 동일 파일 감지
- **스크립트 이름 기반**: 같은 이름의 스크립트가 있으면 업데이트 또는 건너뛰기
- **사용자 선택**: 중복 발견 시 사용자에게 선택권 제공 (덮어쓰기/건너뛰기/새 이름으로)

### 2.9 스크립트 공유 API 설계

```python
# GET /api/scripts/{script_id}/export
# 스크립트를 JSON 파일로 내보내기
Response:
    - Content-Type: application/json
    - Content-Disposition: attachment; filename="{script_name}.asscript.json"
    - JSON 파일 다운로드

# GET /api/shared-scripts/files
# 공유 폴더의 스크립트 파일 목록 조회
Response: {
    "files": [
        {
            "file_path": "shared-scripts/로그인_자동화.asscript.json",
            "file_name": "로그인_자동화.asscript.json",
            "metadata": {
                "name": "로그인 자동화",
                "author": "홍길동",
                "version": "1.0.0",
                "required_nodes": ["my-custom-node"]  # 필요한 커스텀 노드 목록
            },
            "is_loaded": true,
            "script_id": 123,
            "missing_nodes": [],  # 누락된 노드 목록
            "last_loaded_at": "2025-12-14T10:00:00Z"
        }
    ]
}

# POST /api/shared-scripts/files/load
# 특정 파일 강제 로드
Request: {
    "file_path": "shared-scripts/로그인_자동화.asscript.json"
}
Response: {
    "script_id": 123,
    "missing_nodes": ["my-custom-node"],  # 누락된 노드 목록
    "warnings": ["필요한 노드 'my-custom-node'가 설치되지 않았습니다."]
}

# POST /api/shared-scripts/files/reload-all
# 모든 공유 스크립트 파일 재로드

# DELETE /api/shared-scripts/files/{file_id}
# 공유 스크립트 파일 비활성화 (파일은 유지, DB에서만 제거)
```

### 2.10 스크립트 검증

- **JSON 형식 검증**: 유효한 JSON인지 확인
- **스키마 검증**: 필수 필드 존재 확인
- **노드 무결성 검증**: 
  - 필수 노드 존재 (start, end)
  - 연결선 유효성 확인
  - 순환 참조 방지
- **필요한 노드 확인**: `required_nodes`에 명시된 노드가 설치되어 있는지 확인
- **파일 크기 제한**: 최대 10MB (설정 가능)

---

## Part 3: 통합 사용자 경험

### 3.1 노드 공유 UI

1. **노드 관리 페이지** (신규)
   - 사이드바에 "노드 관리" 메뉴 추가
   - 설치된 커스텀 노드 목록 표시
   - 노드 내보내기 버튼
   - 공유 폴더의 노드 목록 표시
   - 수동 로드 버튼

2. **노드 설정 모달에서 내보내기**
   - 커스텀 노드 설정 모달에 "내보내기" 버튼 추가
   - 클릭 시 ZIP 파일 다운로드

### 3.2 스크립트 공유 UI

1. **에디터에서 내보내기**
   - 상단 툴바에 "내보내기" 버튼 추가
   - 클릭 시 JSON 파일 다운로드
   - 필요한 노드 목록 표시

2. **대시보드에서 내보내기**
   - 스크립트 카드에 "내보내기" 아이콘 추가
   - 클릭 시 JSON 파일 다운로드

3. **공유 스크립트 페이지**
   - 사이드바에 "공유 스크립트" 메뉴 추가
   - 공유 폴더의 스크립트 목록 표시
   - 각 스크립트의 상태 표시 (로드됨/미로드, 필요한 노드 누락 여부)
   - 수동 로드 버튼
   - 전체 재로드 버튼

### 3.3 자동 로드 알림

- **노드**: 새 노드 파일 감지 시 알림 표시, 로드 성공/실패 알림
- **스크립트**: 새 스크립트 파일 감지 시 알림 표시, 필요한 노드 누락 시 경고
- **중복 파일**: 중복 발견 시 선택 다이얼로그

---

## Part 4: 구현 우선순위

### Phase 1: 노드 패키지 구조 표준화 및 내보내기 (v0.1.0)
1. **노드 패키지 구조 정의**
   - `manifest.json` 스키마 정의
   - 노드 패키지 구조 문서화
   
2. **노드 내보내기 기능**
   - 기존 노드 파일 수집 (Python, JavaScript, 설정)
   - `manifest.json` 생성
   - `node_config.json` 생성
   - ZIP 패키지 생성
   - 다운로드 기능

3. **기본 노드 검증**
   - ZIP 파일 검증
   - JSON 형식 검증
   - 필수 파일 존재 확인

### Phase 2: 동적 설정 관리 및 노드 설치 (v0.2.0)
1. **동적 설정 관리**
   - `custom_nodes_config.json` 파일 생성 및 관리
   - 설정 병합 로직 구현
   - API 엔드포인트 `/api/nodes/config` 구현
   
2. **수동 노드 로드**
   - ZIP 파일 선택 다이얼로그
   - 압축 해제
   - `manifest.json` 파싱 및 검증
   - 노드 설치 (서버/클라이언트 파일 복사)
   - 노드 설정 등록
   - 노드 타입 등록

3. **Python 노드 동적 로드**
   - importlib를 사용한 동적 모듈 로드
   - 서버 재시작 없이 노드 사용 가능

### Phase 3: 동적 JavaScript 로드 (v0.3.0)
1. **JavaScript 파일 동적 로드**
   - API 엔드포인트 `/api/nodes/scripts` 구현
   - 클라이언트에서 동적 스크립트 로드
   - `index.html` 수정 없이 노드 사용 가능

2. **예시 출력 통합**
   - `preview-output.js` 파일 자동 통합
   - `node-preview-outputs.js`에 동적 추가

### Phase 4: 노드 자동 로드 (v0.4.0)
1. **공유 폴더 자동 감지**
   - 서버 시작 시 `shared-nodes/` 폴더 스캔
   - 파일 목록 DB 저장
   
2. **파일 감시 (File Watcher)**
   - 파일 추가/수정/삭제 감지
   - 자동 재로드

### Phase 5: 고급 검증 및 보안 (v0.5.0)
1. **Python 코드 검증 강화**
   - AST 파싱을 통한 위험한 함수 감지
   - 파일 시스템 접근 패턴 감지
   - 네트워크 접근 패턴 감지

2. **JavaScript 코드 검증**
   - 위험한 함수 사용 감지
   - XSS, 코드 인젝션 방지

3. **노드 패키지 서명 및 검증** (선택적)
   - 노드 패키지 서명
   - 서명 검증

### Phase 3: 스크립트 공유 기본 기능 (v0.3.0)
1. 스크립트 내보내기 기능
   - 스크립트 데이터 수집
   - 필요한 노드 목록 생성
   - JSON 파일 생성
   - 다운로드 기능
   
2. 수동 스크립트 로드
   - JSON 파일 선택 다이얼로그
   - 파일 파싱 및 검증
   - 필요한 노드 확인
   - 스크립트 생성

### Phase 4: 스크립트 자동 로드 (v0.4.0)
1. 공유 폴더 자동 감지
2. 파일 감시 및 자동 재로드

### Phase 5: UI 개선 (v0.5.0)
1. 노드 관리 페이지
2. 공유 스크립트 관리 페이지
3. 자동 로드 알림 시스템
4. 중복 처리 UI

---

## Part 5: 파일 구조

```
server/
  services/
    shared_node_loader.py              # 노드 파일 로드 서비스
    shared_node_watcher.py             # 노드 파일 감시 서비스
    shared_script_loader.py             # 스크립트 파일 로드 서비스
    shared_script_watcher.py            # 스크립트 파일 감시 서비스
    custom_node_installer.py           # 커스텀 노드 설치 서비스
    custom_node_validator.py           # 커스텀 노드 검증 서비스
    custom_node_config_manager.py       # 동적 설정 관리 서비스 (신규)
    custom_node_script_loader.py        # JavaScript 동적 로드 관리 서비스 (신규)
  api/
    shared_node_router.py              # 공유 노드 API
    shared_script_router.py            # 공유 스크립트 API
    node_router.py                     # 노드 관련 API (신규 또는 확장)
  config/
    nodes_config.py                    # 표준 노드 설정 (하드코딩)
    custom_nodes_config.json           # 커스텀 노드 설정 (동적 관리, 신규)
  nodes/
    customnodes/                       # 커스텀 노드 설치 폴더
      ├── __init__.py
      ├── {node_type}/                 # 새 구조: 노드별 폴더
      │   ├── node.py
      │   └── ...
      └── {user_custom_node}.py        # 기존 구조: 직접 파일 (하위 호환)

UI/src/
  pages/workflow/
    services/
      script-export-service.js         # 스크립트 내보내기 서비스
      node-export-service.js           # 노드 내보내기 서비스 (신규)
    node-management.js                 # 노드 관리 페이지 (신규)
    shared-scripts.js                  # 공유 스크립트 관리 페이지
  js/
    api/
      shared-node-api.js               # 공유 노드 API 클라이언트 (신규)
      shared-script-api.js              # 공유 스크립트 API 클라이언트
      node-api.js                       # 노드 API 클라이언트 (신규)
    components/node/
      node-{name}.js                   # 동적으로 로드되는 노드 파일들
    utils/
      dynamic-script-loader.js         # 동적 스크립트 로더 (신규)

shared-nodes/                      # 공유 노드 폴더 (루트에 생성)
  ├── {노드명}.asnode.zip
  └── {노드명}/                    # 압축 해제된 폴더 (선택적)
      ├── node.py
      └── node_config.json

shared-scripts/                    # 공유 스크립트 폴더 (루트에 생성)
  ├── {스크립트명}.asscript.json
  └── ...
```

---

## Part 6: 설정

```python
# config/settings.py 또는 .env
SHARED_NODES_DIR = "shared-nodes"              # 공유 노드 폴더 경로
SHARED_NODES_AUTO_LOAD = True                  # 노드 자동 로드 활성화
SHARED_NODES_WATCH = True                      # 노드 파일 감시 활성화
SHARED_SCRIPTS_DIR = "shared-scripts"          # 공유 스크립트 폴더 경로
SHARED_SCRIPTS_AUTO_LOAD = True                # 스크립트 자동 로드 활성화
SHARED_SCRIPTS_WATCH = True                    # 스크립트 파일 감시 활성화
SHARED_SCRIPTS_MAX_SIZE = 10 * 1024 * 1024     # 최대 파일 크기 (10MB)
```

---

## Part 7: 에러 처리

### 노드 관련
- **ZIP 파일 읽기 실패**: 로그 기록, 사용자 알림
- **압축 해제 실패**: 상세 에러 메시지 표시
- **JSON 파싱 실패**: 상세 에러 메시지 표시
- **Python 문법 오류**: 라인 번호와 함께 표시
- **노드 타입 중복**: 사용자에게 선택권 제공
- **의존성 오류**: 누락된 패키지 목록 표시

### 스크립트 관련
- **JSON 파일 읽기 실패**: 로그 기록, 사용자 알림
- **JSON 파싱 실패**: 상세 에러 메시지 표시
- **스키마 검증 실패**: 어떤 필드가 문제인지 명시
- **필요한 노드 누락**: 누락된 노드 목록과 설치 방법 안내
- **중복 파일**: 사용자에게 선택권 제공
- **권한 오류**: 파일 읽기/쓰기 권한 안내

---

## Part 8: 성능 고려사항

- **대용량 파일**: 스트리밍 파싱 고려
- **많은 파일**: 배치 로드, 진행률 표시
- **파일 감시**: 폴더당 하나의 watcher, 효율적인 이벤트 처리
- **노드 동적 로드**: importlib를 사용한 효율적인 모듈 로드

---

## Part 9: 확장 가능성

- **노드 버전 관리**: 같은 노드 타입의 여러 버전 관리
- **노드 의존성**: 노드 간 의존성 관리
- **스크립트 템플릿**: 자주 사용하는 스크립트를 템플릿으로 저장
- **자동 업데이트**: 원본 파일이 업데이트되면 알림
- **Git 연동**: 버전 관리 시스템 연동 (선택적)
- **노드 마켓플레이스**: 온라인 노드 공유 플랫폼 (선택적)

---

## 참고: n8n의 공유 방식

### n8n 커뮤니티 노드 공유 방식

n8n은 다음과 같은 방식으로 커스텀 노드를 공유합니다:

1. **npm 패키지 기반 공유**:
   - 커스텀 노드를 npm 패키지로 패키징
   - 패키지명 규칙: `n8n-nodes-{이름}` 또는 `@<scope>/n8n-nodes-{이름}`
   - `package.json`의 `n8n` 속성에 노드 정보 정의
   - npm에 publish하여 공유

2. **로컬 파일 기반 공유**:
   - `.n8n/custom` 디렉토리에 노드 파일 복사
   - `N8N_CUSTOM_EXTENSIONS` 환경 변수로 커스텀 경로 지정 가능
   - 서버 재시작 시 자동 로드

3. **UI를 통한 설치** (n8n v0.187+):
   - Settings > Community Nodes에서 npm 패키지명으로 설치
   - 검증된 커뮤니티 노드는 n8n Creator Portal에서 검증 가능

4. **워크플로우 공유**:
   - JSON 형식으로 export/import
   - n8n 워크플로우 마켓플레이스 (선택적)

### 우리 시스템과의 비교

**n8n 방식의 장점**:
- npm 생태계 활용 (패키지 관리, 버전 관리)
- 검증 시스템 (Creator Portal)
- UI를 통한 쉬운 설치

**우리 시스템의 장점**:
- 파일 기반으로 더 간단 (npm 계정 불필요)
- ZIP 패키지로 모든 파일 포함 (의존성 포함)
- 로컬 파일 복사만으로 설치 가능

**개선 가능한 점**:
- npm 패키지 방식도 지원 (선택적)
- 검증 시스템 도입 (선택적)
- UI를 통한 노드 설치 (향후)

---

## 요약: 노드 공유 시스템 설계

### 핵심 개선사항

1. **노드 패키지 구조 표준화**
   - 모든 노드 파일을 하나의 패키지로 묶기
   - `manifest.json`으로 노드 메타데이터 및 파일 목록 명시
   - 표준화된 폴더 구조 (`server/`, `client/`)

2. **동적 설정 관리**
   - `nodes_config.py` 하드코딩에서 JSON 파일 기반으로 전환
   - `custom_nodes_config.json`으로 커스텀 노드 설정 동적 관리
   - 서버 재시작 없이 노드 추가/삭제 가능

3. **동적 JavaScript 로드**
   - `index.html` 수정 없이 노드 JavaScript 파일 동적 로드
   - 서버 API를 통해 설치된 노드의 스크립트 목록 제공
   - 클라이언트에서 동적으로 스크립트 태그 생성

4. **기존 노드와의 호환성**
   - 기존 노드 구조도 계속 작동 (하위 호환성 유지)
   - 기존 노드를 새 구조로 마이그레이션하는 도구 제공 (선택적)

### 구현 단계

1. **Phase 1-2**: 노드 패키지 구조 표준화 및 기본 공유 기능
2. **Phase 3**: 동적 설정 관리 및 JavaScript 동적 로드
3. **Phase 4**: 자동 로드 및 파일 감시
4. **Phase 5**: 고급 검증 및 보안

### 노드 공유 워크플로우

**공유하는 사람**:
1. 노드 개발 (새 구조 또는 기존 구조)
2. "노드 내보내기" 클릭
3. ZIP 파일 다운로드
4. 파일 공유 (이메일, 클라우드, GitHub 등)

**공유받는 사람**:
1. ZIP 파일 다운로드
2. `shared-nodes/` 폴더에 압축 해제 또는 복사
3. 서버가 자동으로 감지하여 설치
4. 노드 사용 가능 (서버 재시작 불필요)
