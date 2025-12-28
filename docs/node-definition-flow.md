# 노드 정의 및 불러오기 흐름

이 문서는 프론트엔드부터 백엔드, 데이터베이스까지 노드가 어떻게 정의되고 불러와지는지 전체 흐름을 설명합니다.

## 목차
1. [노드 정의 구조](#1-노드-정의-구조)
2. [서버 측 노드 설정](#2-서버-측-노드-설정)
3. [API 엔드포인트](#3-api-엔드포인트)
4. [데이터베이스 스키마](#4-데이터베이스-스키마)
5. [프론트엔드 노드 로드](#5-프론트엔드-노드-로드)
6. [노드 저장 흐름](#6-노드-저장-흐름)
7. [노드 불러오기 흐름](#7-노드-불러오기-흐름)

---

## 1. 노드 정의 구조

### 1.1 서버 측 노드 정의 (`server/config/nodes_config.py`)

서버에서 모든 노드 타입의 메타데이터를 Python 딕셔너리로 정의합니다.

```python
NODES_CONFIG: dict[str, dict[str, Any]] = {
    "repeat": {
        "label": "반복 노드",              # UI에 표시될 라벨
        "title": "반복",               # 기본 제목
        "description": "아래에 연결된 노드들을 지정한 횟수만큼 반복 실행하는 노드입니다.",  # 설명
        "script": "node-repeat.js",          # 프론트엔드에서 로드할 JS 파일명
        "is_boundary": False,              # 경계 노드 여부 (start/end)
        "category": "logic",               # 카테고리 (system/action/logic)
        "detail_types": {                  # 상세 노드 타입 (하위 카테고리)
            "loop-start": {
                "label": "반복 시작",
                "description": "반복 블록의 시작점입니다.",
                "icon": "▶",
                "parameters": {            # 파라미터 정의
                    "loop_count": {
                        "type": "number",
                        "label": "반복 횟수",
                        "description": "반복할 횟수를 설정합니다.",
                        "default": 1,
                        "min": 1,
                        "max": 10000,
                        "required": True
                    }
                }
            },
            "loop-end": {
                "label": "반복 종료",
                "description": "반복 블록의 종료점입니다.",
                "icon": "■",
                "parameters": {
                    "loop_count": {
                        "type": "number",
                        "label": "반복 횟수",
                        "description": "반복할 횟수를 설정합니다.",
                        "default": 1,
                        "min": 1,
                        "max": 10000,
                        "required": True
                    }
                }
            }
        }
    }
}
```

### 1.2 노드 설정 객체 구조

**메인 노드 타입 설정:**
```typescript
interface NodeConfig {
    label: string;              // UI 표시 라벨
    title: string;               // 기본 제목
    description: string;         // 설명
    script: string;              // JS 파일명 (예: "node-repeat.js")
    isBoundary: boolean;        // 경계 노드 여부
    category: string;            // "system" | "action" | "logic"
    requiresFolderPath?: boolean; // 폴더 경로 필요 여부 (image-touch 등)
    parameters?: {              // 노드 레벨 파라미터 (선택사항)
        [key: string]: ParameterConfig;
    };
    detailTypes?: {             // 상세 노드 타입
        [detailType: string]: DetailTypeConfig;
    };
}
```

**상세 노드 타입 설정:**
```typescript
interface DetailTypeConfig {
    label: string;              // 상세 타입 라벨
    description: string;         // 설명
    icon: string;               // 아이콘 (이모지 또는 텍스트)
    parameters?: {              // 상세 타입별 파라미터
        [key: string]: ParameterConfig;
    };
}
```

**파라미터 설정:**
```typescript
interface ParameterConfig {
    type: "number" | "string" | "boolean";  // 파라미터 타입
    label: string;                          // UI 표시 라벨
    description: string;                    // 설명
    default?: any;                         // 기본값
    min?: number;                          // 최소값 (number 타입)
    max?: number;                          // 최대값 (number 타입)
    required?: boolean;                    // 필수 여부
    placeholder?: string;                   // 플레이스홀더 (string 타입)
}
```

---

## 2. 서버 측 노드 설정

### 2.1 설정 파일 위치
- **파일**: `server/config/nodes_config.py`
- **변수명**: `NODES_CONFIG`
- **타입**: `dict[str, dict[str, Any]]`

### 2.2 API로 변환 (`server/api/config_router.py`)

서버는 Python의 `snake_case`를 JavaScript의 `camelCase`로 변환하여 클라이언트에 제공합니다.

**변환 규칙:**
- `is_boundary` → `isBoundary`
- `requires_folder_path` → `requiresFolderPath`
- `detail_types` → `detailTypes`

**API 응답 형식:**
```json
{
    "success": true,
    "message": "노드 설정 조회 완료",
    "data": {
        "nodes": {
            "loop": {
                "label": "반복 노드",
                "title": "반복 노드",
                "description": "노드 블록을 반복 실행하는 노드입니다.",
                "script": "node-loop.js",
                "isBoundary": false,
                "category": "logic",
                "detailTypes": {
                    "loop-start": {
                        "label": "반복 시작",
                        "description": "반복 블록의 시작점입니다.",
                        "icon": "▶",
                        "parameters": {
                            "loop_count": {
                                "type": "number",
                                "label": "반복 횟수",
                                "description": "반복할 횟수를 설정합니다.",
                                "default": 1,
                                "min": 1,
                                "max": 10000,
                                "required": true
                            }
                        }
                    },
                    "loop-end": {
                        "label": "반복 종료",
                        "description": "반복 블록의 종료점입니다.",
                        "icon": "■",
                        "parameters": {
                            "loop_count": {
                                "type": "number",
                                "label": "반복 횟수",
                                "description": "반복할 횟수를 설정합니다.",
                                "default": 1,
                                "min": 1,
                                "max": 10000,
                                "required": true
                            }
                        }
                    }
                }
            }
        }
    }
}
```

---

## 3. API 엔드포인트

### 3.1 노드 설정 조회 API

**엔드포인트**: `GET /api/config/nodes`

**구현 위치**: `server/api/config_router.py`

**응답 형식**:
```typescript
interface ApiResponse {
    success: boolean;
    message: string;
    data: {
        nodes: {
            [nodeType: string]: NodeConfig;
        };
    };
}
```

---

## 4. 데이터베이스 스키마

### 4.1 nodes 테이블 구조

**테이블명**: `nodes`

**컬럼 정의**:

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | 내부 DB ID |
| `script_id` | INTEGER | NOT NULL, FOREIGN KEY | 스크립트 ID (scripts 테이블 참조) |
| `node_id` | TEXT | NOT NULL | 노드 고유 ID (예: "loop_start", "node_123") |
| `node_type` | TEXT | NOT NULL | 노드 타입 (예: "repeat", "wait", "action") |
| `position_x` | REAL | NOT NULL | X 좌표 |
| `position_y` | REAL | NOT NULL | Y 좌표 |
| `node_data` | TEXT | NOT NULL | 노드 데이터 (JSON 문자열) |
| `connected_to` | TEXT | DEFAULT '[]' | 연결된 노드 목록 (JSON 배열) |
| `connected_from` | TEXT | DEFAULT '[]' | 이 노드로 연결된 노드 목록 (JSON 배열) |
| `parameters` | TEXT | DEFAULT '{}' | 파라미터 (JSON 객체) |
| `description` | TEXT | NULL | 설명 |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 수정 시간 |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 생성 시간 |

**인덱스**:
- `idx_nodes_script_node_unique`: `(script_id, node_id)` UNIQUE
- `idx_nodes_script_id`: `script_id`
- `idx_nodes_type`: `node_type`
- `idx_nodes_script_type`: `(script_id, node_type)`

### 4.2 node_data 컬럼 구조 (JSON)

`node_data` 컬럼에는 다음 구조의 JSON이 저장됩니다:

```json
{
    "title": "반복 시작 (3회)",
    "repeat_count": 3,
    "folder_path": "...",  // image-touch 노드인 경우
    "process_id": 123,     // process-focus 노드인 경우
    // ... 기타 노드별 데이터
}
```

### 4.3 parameters 컬럼 구조 (JSON)

`parameters` 컬럼에는 실행에 필요한 핵심 파라미터만 저장됩니다:

```json
{
    "repeat_count": 3,           // repeat 노드
    "wait_time": 0.5,          // wait 노드
    "folder_path": "C:\\...",  // image-touch 노드
    "condition": "...",         // condition 노드
    "process_id": 123,         // process-focus 노드
    "hwnd": 456,
    "process_name": "...",
    "window_title": "..."
}
```

### 4.4 connected_to / connected_from 컬럼 구조 (JSON 배열)

```json
// connected_to 예시
["node_123", "node_456"]

// connected_from 예시
["start"]
```

---

## 5. 프론트엔드 노드 로드

### 5.1 노드 설정 로드 (`UI/src/pages/workflow/services/node-registry.js`)

**클래스**: `NodeRegistry`

**주요 메서드**:
- `loadNodeConfigs()`: 서버에서 노드 설정 가져오기
- `getNodeConfigs()`: 캐시된 설정 반환 (없으면 로드)
- `getConfig(nodeType)`: 특정 노드 타입 설정 가져오기
- `loadNodeScript(nodeType)`: 노드 렌더링 스크립트 동적 로드

**로드 흐름**:
```javascript
// 1. API 호출
const response = await fetch('/api/config/nodes');
const result = await response.json();

// 2. 노드 설정 저장
this.nodeConfigs = result.data.nodes;

// 3. 노드 스크립트 동적 로드
const scriptPath = `/static/js/components/node/${config.script}`;
const script = document.createElement('script');
script.src = scriptPath;
document.head.appendChild(script);
```

### 5.2 노드 타입 상수 초기화 (`UI/src/pages/workflow/constants/node-types.js`)

**초기화 함수**: `initializeNodeTypes()`

```javascript
// 서버에서 노드 설정 로드
const configs = await registry.getAllConfigs();

// NODE_TYPES 생성 (대문자 상수)
NODE_TYPES = {
    REPEAT: "repeat",
    WAIT: "wait",
    // ...
};

// NODE_TYPE_LABELS 생성
NODE_TYPE_LABELS = {
    "repeat": "반복 노드",
    "wait": "대기 노드",
    // ...
};
```

---

## 6. 노드 저장 흐름

### 6.1 프론트엔드 → API 변환 (`UI/src/pages/workflow/services/workflow-save-service.js`)

**메서드**: `prepareNodesForAPI(nodes, nodeManager)`

**변환 로직**:
```javascript
// 프론트엔드 노드 객체
{
    id: "loop_start",
    type: "loop",
    title: "반복 시작 (3회)",
    x: 300,
    y: 0,
    // nodeManager.nodeData[repeat_node]에 저장된 데이터
    repeat_count: 3
}

// ↓ 변환

// API 전송 형식
{
    id: "repeat_node",
    type: "repeat",
    position: { x: 300, y: 0 },
    data: {
        title: "반복 (3회)",
        repeat_count: 3
    },
    parameters: {
        repeat_count: 3  // 실행에 필요한 핵심 파라미터만
    },
    description: "반복 횟수: 3회"
}
```

### 6.2 API → DB 저장 (`server/db/node_repository.py`)

**메서드**: `save_nodes(script_id, nodes, connections)`

**저장 로직**:
```python
# API에서 받은 노드 데이터
node = {
    "id": "repeat_node",
    "type": "repeat",
    "position": {"x": 300.0, "y": 0.0},
    "data": {
        "title": "반복 (3회)",
        "repeat_count": 3
    },
    "parameters": {
        "repeat_count": 3
    },
    "description": "반복 횟수: 3회"
}

# ↓ 변환하여 DB에 저장

# SQL INSERT
INSERT INTO nodes (
    script_id,      # 1
    node_id,        # "repeat_node"
    node_type,      # "repeat"
    position_x,     # 300.0
    position_y,     # 0.0
    node_data,      # JSON: {"title": "...", "action_node_type": "loop-start", ...}
    connected_to,   # JSON: ["wait_node"]
    connected_from, # JSON: ["start"]
    parameters,     # JSON: {"loop_count": 3}
    description     # "반복 횟수: 3회"
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
```

**DB 저장 예시**:
```sql
-- 실제 DB 레코드
id: 5
script_id: 1
node_id: "loop_start"
node_type: "loop"
position_x: 300.0
position_y: 0.0
node_data: '{"title":"반복 시작 (3회)","action_node_type":"loop-start","loop_count":3}'
connected_to: '["wait_node"]'
connected_from: '["start"]'
parameters: '{"loop_count":3}'
description: "반복 횟수: 3회"
updated_at: "2024-01-15 10:30:00"
created_at: "2024-01-15 10:30:00"
```

---

## 7. 노드 불러오기 흐름

### 7.1 DB → API 응답 (`server/db/node_repository.py`)

**메서드**: `get_nodes_by_script_id(script_id)`

**조회 SQL**:
```sql
SELECT 
    id,                    -- 0: DB 내부 ID
    node_id,               -- 1: 노드 고유 ID
    node_type,             -- 2: 노드 타입
    position_x,            -- 3: X 좌표
    position_y,            -- 4: Y 좌표
    node_data,             -- 5: 노드 데이터 (JSON)
    connected_to,          -- 6: 연결된 노드 목록 (JSON)
    connected_from,        -- 7: 이 노드로 연결된 노드 목록 (JSON)
    COALESCE(parameters, '{}') as parameters,  -- 8: 파라미터 (JSON)
    description            -- 9: 설명
FROM nodes
WHERE script_id = ?
ORDER BY id
```

**파싱 로직**:
```python
# DB에서 조회한 row
row = (5, "repeat_node", "repeat", 300.0, 0.0, 
       '{"title":"반복 (3회)","repeat_count":3}',
       '["wait_node"]', '["start"]', '{"repeat_count":3}', "반복 횟수: 3회")

# ↓ 파싱

# 반환 객체
{
    "id": "repeat_node",
    "type": "repeat",
    "position": {"x": 300.0, "y": 0.0},
    "data": {
        "title": "반복 (3회)",
        "repeat_count": 3
    },
    "connected_to": ["wait_node"],
    "connected_from": ["start"],
    "parameters": {
        "repeat_count": 3
    },
    "description": "반복 횟수: 3회",
    "_db_id": 5  # 내부적으로 사용
}
```

### 7.2 API → 프론트엔드 변환 (`UI/src/pages/workflow/services/workflow-load-service.js`)

**메서드**: `createNodeFromServerData(nodeData, nodeManager)`

**변환 로직**:
```javascript
// API에서 받은 노드 데이터
const nodeData = {
    id: "repeat_node",
    type: "repeat",
    position: { x: 300.0, y: 0.0 },
    data: {
        title: "반복 (3회)",
        repeat_count: 3
    },
    parameters: {
        repeat_count: 3
    },
    description: "반복 횟수: 3회"
};

// ↓ 변환

// NodeManager 형식
const nodeDataForManager = {
    id: "loop_start",
    title: "반복 시작 (3회)",
    type: "loop",
    x: 300.0,
    y: 0.0,
    action_node_type: "loop-start",
    loop_count: 3,
    description: "반복 횟수: 3회"
};

// nodeManager.nodeData에 저장
nodeManager.nodeData["loop_start"] = {
    type: "loop",
    action_node_type: "loop-start",
    loop_count: 3,
    description: "반복 횟수: 3회"
};
```

### 7.3 화면 렌더링

**메서드**: `nodeManager.createNode(nodeDataForManager)`

**렌더링 과정**:
1. 노드 DOM 요소 생성
2. `nodeManager.generateNodeContent(nodeData)` 호출
3. 노드 타입별 렌더러 (`node-repeat.js` 등)에서 HTML 생성
4. DOM에 추가 및 이벤트 리스너 설정

---

## 8. 전체 흐름 다이어그램

```
┌─────────────────────────────────────────────────────────────┐
│ 1. 서버 시작 시 노드 정의 로드                                │
│    server/config/nodes_config.py                             │
│    NODES_CONFIG = { "repeat": {...}, "wait": {...}, ... }      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. 프론트엔드 초기화                                          │
│    NodeRegistry.loadNodeConfigs()                            │
│    → GET /api/config/nodes                                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. API 응답 변환                                              │
│    config_router.py: get_nodes_config()                      │
│    snake_case → camelCase 변환                                │
│    detail_types → detailTypes                                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. 프론트엔드에 노드 설정 저장                                │
│    NodeRegistry.nodeConfigs = {...}                          │
│    NODE_TYPE_LABELS 초기화                                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. 사용자가 노드 생성/수정                                    │
│    AddNodeModal / NodeSettingsModal                           │
│    → nodeManager.nodeData에 저장                              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. 노드 저장 요청                                             │
│    WorkflowSaveService.save()                                │
│    → prepareNodesForAPI() 변환                                │
│    → POST /api/scripts/{script_id}/nodes                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. DB에 저장                                                  │
│    NodeRepository.save_nodes()                                │
│    → INSERT INTO nodes (...)                                  │
│    node_data: JSON 문자열                                     │
│    parameters: JSON 문자열                                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 8. 노드 불러오기 요청                                         │
│    GET /api/scripts/{script_id}                              │
│    → NodeRepository.get_nodes_by_script_id()                  │
│    → SELECT * FROM nodes WHERE script_id = ?                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 9. JSON 파싱 및 API 응답 형식으로 변환                        │
│    node_data, parameters, connected_to 파싱                  │
│    → API 응답 객체 생성                                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 10. 프론트엔드에서 노드 복원                                  │
│     WorkflowLoadService.createNodeFromServerData()            │
│     → nodeManager.nodeData에 복원                             │
│     → nodeManager.createNode()로 화면 렌더링                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. 주요 객체 구조 요약

### 9.1 서버 측 노드 정의 객체
```python
{
    "repeat": {
        "label": "반복 노드",
        "title": "반복",
        "description": "아래에 연결된 노드들을 지정한 횟수만큼 반복 실행하는 노드입니다.",
        "script": "node-repeat.js",
        "is_boundary": False,
        "category": "logic",
        "has_bottom_output": True,
        "parameters": {
            "repeat_count": {
                "type": "number",
                "label": "반복 횟수",
                "description": "반복할 횟수를 설정합니다.",
                "default": 1,
                "min": 1,
                "max": 10000,
                "required": True
            }
        }
    }
}
```

### 9.2 DB 저장 객체
```sql
-- nodes 테이블 레코드
id: 5
script_id: 1
node_id: "loop_start"
node_type: "loop"
position_x: 300.0
position_y: 0.0
node_data: '{"title":"반복 시작 (3회)","action_node_type":"loop-start","loop_count":3}'
connected_to: '["wait_node"]'
connected_from: '["start"]'
parameters: '{"loop_count":3}'
description: "반복 횟수: 3회"
```

### 9.3 API 응답 객체
```json
{
    "id": "repeat_node",
    "type": "repeat",
    "position": {"x": 300.0, "y": 0.0},
    "data": {
        "title": "반복 (3회)",
        "repeat_count": 3
    },
    "connected_to": ["wait_node"],
    "connected_from": ["start"],
    "parameters": {
        "repeat_count": 3
    },
    "description": "반복 횟수: 3회"
}
```

### 9.4 프론트엔드 NodeManager 객체
```javascript
{
    id: "repeat_node",
    title: "반복 (3회)",
    type: "repeat",
    x: 300.0,
    y: 0.0,
    repeat_count: 3,
    description: "반복 횟수: 3회"
}

// nodeManager.nodeData["repeat_node"]
{
    type: "repeat",
    repeat_count: 3,
    description: "반복 횟수: 3회"
}
```

---

## 10. 참고사항

### 10.1 파라미터 저장 위치
- **node_data**: UI 표시용 데이터 (title, action_node_type 등)
- **parameters**: 실행에 필요한 핵심 파라미터만 (repeat_count, wait_time 등)

### 10.3 JSON 필드 파싱
- DB의 `node_data`, `parameters`, `connected_to`, `connected_from`는 모두 JSON 문자열
- Python: `json.loads()` / `json.dumps()`
- JavaScript: `JSON.parse()` / `JSON.stringify()`

### 10.4 노드 스크립트 로드
- 서버의 `script` 필드에 정의된 파일명으로 동적 로드
- 경로: `/static/js/components/node/{script}`
- 예: `node-repeat.js` → `/static/js/components/node/node-repeat.js`

---

**작성일**: 2024-01-15  
**최종 수정일**: 2024-01-15

