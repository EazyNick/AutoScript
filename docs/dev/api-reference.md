**최신 수정일자: 2025.12.00**

# API 참조 문서

## 기본 정보

- **Base URL**: `.env` 파일의 `API_HOST:API_PORT` (기본값: `localhost:8001`)
- **Content-Type**: `application/json`
- **API 문서**: `http://{API_HOST}:{API_PORT}/docs` (Swagger UI)

> **참고**: `.env` 파일이 없으면 기본값(`127.0.0.1:8001`)을 사용합니다. `.env` 파일 생성 방법은 [환경 변수 설정 가이드](environment.md)를 참고하세요.

## API 응답 형식

모든 API 엔드포인트는 일관된 응답 형식을 사용합니다.

### 성공 응답 (SuccessResponse)

```json
{
  "success": true,
  "message": "작업이 완료되었습니다.",
  "data": {
    // 실제 데이터
  }
}
```

### 리스트 응답 (ListResponse)

```json
{
  "success": true,
  "message": "조회 완료",
  "data": [
    // 리스트 데이터
  ],
  "count": 10
}
```

### 에러 응답 (ErrorResponse)

비즈니스 로직 에러의 경우:

```json
{
  "success": false,
  "message": "에러 메시지",
  "error": "상세 에러 정보",
  "error_code": "ERROR_CODE"
}
```

HTTP 에러(4xx, 5xx)의 경우 FastAPI의 기본 형식:

```json
{
  "detail": "에러 메시지"
}
```

## 주요 엔드포인트

### 1. 노드 실행

#### 단일 액션 실행
```http
POST /api/action
Content-Type: application/json

{
  "action_type": "image-touch",
  "parameters": {
    "folder_path": "C:/images",
    "image_name": "button.png"
  }
}
```

**응답 (ActionResponse)**:
```json
{
  "success": true,
  "message": "액션 'image-touch' 실행 완료",
  "data": {
    "result": "..."
  }
}
```

#### 스크립트 실행
```http
POST /api/scripts/{script_id}/execute
Content-Type: application/json

{
  "nodes": [
    {
      "id": "node1",
      "type": "image-touch",
      "data": {
        "title": "이미지 터치",
        "folder_path": "C:/images"
      }
    },
    {
      "id": "node2",
      "type": "wait",
      "data": {
        "title": "대기",
        "wait_time": 2
      }
    }
  ]
}
```

**응답 (성공)**:
```json
{
  "success": true,
  "message": "2개 노드 실행 완료",
  "data": {
    "results": [
      {
        "action": "image-touch",
        "status": "completed",
        "output": {...}
      },
      {
        "action": "wait",
        "status": "completed",
        "output": {...}
      }
    ],
    "context": {...}
  }
}
```

**응답 (실패)**:
```json
{
  "success": false,
  "message": "노드 실행 중 오류 발생: 폴더를 찾을 수 없습니다",
  "data": {
    "results": [
      {
        "action": "image-touch",
        "status": "failed",
        "error": "폴더를 찾을 수 없습니다: ...",
        "node_id": "node1",
        "output": null
      }
    ],
    "context": {...}
  }
}
```

### 2. 스크립트 관리

#### 스크립트 목록 조회
```http
GET /api/scripts
```

**응답 (ListResponse)**:
```json
{
  "success": true,
  "message": "스크립트 목록 조회 완료",
  "data": [
    {
      "id": 1,
      "name": "테스트 스크립트",
      "description": "설명",
      "active": true,
      "execution_order": 1,
      "last_executed_at": "2025-01-01T00:00:00",
      "created_at": "2025-01-01T00:00:00",
      "updated_at": "2025-01-01T00:00:00"
    }
  ],
  "count": 1
}
```

#### 스크립트 조회
```http
GET /api/scripts/{script_id}
```

**응답 (ScriptResponse)**:
```json
{
  "id": 1,
  "name": "테스트 스크립트",
  "description": "설명",
  "created_at": "2025-01-01T00:00:00",
  "updated_at": "2025-01-01T00:00:00",
  "nodes": [
    {
      "id": "start",
      "type": "start",
      "position": {"x": 100, "y": 100},
      "data": {"title": "시작"},
      "connected_to": [...],
      "parameters": {...}
    }
  ],
  "connections": [
    {
      "from": "start",
      "to": "node1",
      "outputType": null
    }
  ]
}
```

#### 스크립트 생성
```http
POST /api/scripts
Content-Type: application/json

{
  "name": "새 스크립트",
  "description": "설명"
}
```

**응답 (SuccessResponse)**:
```json
{
  "success": true,
  "message": "스크립트가 생성되었습니다.",
  "data": {
    "id": 1,
    "name": "새 스크립트",
    "description": "설명",
    "created_at": "2025-01-01T00:00:00",
    "updated_at": "2025-01-01T00:00:00"
  }
}
```

#### 스크립트 업데이트
```http
PUT /api/scripts/{script_id}
Content-Type: application/json

{
  "name": "수정된 이름",
  "description": "수정된 설명",
  "nodes": [...],
  "connections": [...]
}
```

**응답 (SuccessResponse)**:
```json
{
  "success": true,
  "message": "스크립트가 업데이트되었습니다.",
  "data": null
}
```

#### 스크립트 삭제
```http
DELETE /api/scripts/{script_id}
```

**응답 (SuccessResponse)**:
```json
{
  "success": true,
  "message": "스크립트가 삭제되었습니다.",
  "data": {
    "id": 1
  }
}
```

#### 스크립트 활성/비활성 상태 변경
```http
PATCH /api/scripts/{script_id}/active
Content-Type: application/json

{
  "active": true
}
```

**응답 (SuccessResponse)**:
```json
{
  "success": true,
  "message": "스크립트 활성 상태가 변경되었습니다.",
  "data": {
    "active": true
  }
}
```

#### 스크립트 순서 업데이트
```http
PATCH /api/scripts/order
Content-Type: application/json

{
  "script_orders": [
    {"id": 1, "order": 0},
    {"id": 2, "order": 1}
  ]
}
```

**응답 (SuccessResponse)**:
```json
{
  "success": true,
  "message": "스크립트 순서가 업데이트되었습니다.",
  "data": {
    "orders": [
      {"id": 1, "order": 0},
      {"id": 2, "order": 1}
    ]
  }
}
```

#### 스크립트 실행
```http
POST /api/scripts/{script_id}/execute
Content-Type: application/json

{
  "nodes": [
    {
      "id": "node1",
      "type": "image-touch",
      "data": {
        "title": "이미지 터치",
        "folder_path": "C:/images"
      }
    }
  ],
  "execution_mode": "sequential"
}
```

**응답 (성공, StandardResponseType)**:
```json
{
  "success": true,
  "message": "스크립트 실행 완료",
  "data": {
    "results": [
      {
        "action": "image-touch",
        "status": "completed",
        "output": {...}
      }
    ]
  }
}
```

**응답 (실패, StandardResponseType)**:
```json
{
  "success": false,
  "message": "스크립트 실행 중 오류 발생: 폴더를 찾을 수 없습니다",
  "error": "폴더를 찾을 수 없습니다",
  "error_code": "SCRIPT_EXECUTION_ERROR"
}
```

### 3. 대시보드 통계

#### 대시보드 통계 조회
```http
GET /api/dashboard/stats
```

**응답 (SuccessResponse)**:
```json
{
  "success": true,
  "message": "대시보드 통계 조회 완료",
  "data": {
    "total_scripts": 10,
    "today_executions": 5,
    "today_failed_scripts": 1,
    "inactive_scripts": 2
  }
}
```

### 4. 파일 및 프로세스 관리

#### 폴더 선택
```http
POST /api/folder/select
```

**응답 (StandardResponseType)**:
```json
{
  "success": true,
  "message": "폴더가 선택되었습니다.",
  "data": {
    "folder_path": "C:/images"
  }
}
```

**에러 응답**:
```json
{
  "success": false,
  "message": "폴더가 선택되지 않았습니다.",
  "error": "폴더가 선택되지 않았습니다."
}
```

#### 이미지 목록 조회
```http
GET /api/images/list?folder_path={folder_path}
```

**응답 (ListResponse)**:
```json
{
  "success": true,
  "message": "이미지 목록 조회 완료",
  "data": [
    {
      "filename": "button.png",
      "path": "C:/images/button.png",
      "name": "button"
    }
  ],
  "count": 1,
  "folder_path": "C:/images"
}
```

#### 프로세스 목록 조회
```http
GET /api/processes/list
```

**응답 (ListResponse)**:
```json
{
  "success": true,
  "message": "프로세스 목록 조회 완료",
  "data": [
    {
      "process_name": "notepad.exe",
      "process_id": 1234,
      "exe_path": "C:/Windows/notepad.exe",
      "window_count": 1,
      "windows": [
        {
          "title": "메모장",
          "hwnd": 123456
        }
      ],
      "hwnd": 123456
    }
  ],
  "count": 1
}
```

#### 프로세스 포커스
```http
POST /api/processes/focus
Content-Type: application/json

{
  "process_id": 1234,
  "hwnd": 123456
}
```

**응답 (SuccessResponse)**:
```json
{
  "success": true,
  "message": "프로세스에 포커스를 주었습니다.",
  "data": {
    "process_id": 1234,
    "hwnd": 123456
  }
}
```

### 5. 애플리케이션 상태

#### 애플리케이션 상태 조회
```http
GET /api/state
```

**응답 (SuccessResponse)**:
```json
{
  "success": true,
  "message": "애플리케이션 상태 조회 완료",
  "data": {
    "application_running": true,
    "current_scene": "main_menu",
    "status": "active"
  }
}
```

### 6. 노드 관리

#### 스크립트의 노드 조회
```http
GET /api/nodes/script/{script_id}
```

**응답 (SuccessResponse)**:
```json
{
  "success": true,
  "message": "노드 목록 조회 완료",
  "data": {
    "script_id": 1,
    "nodes": [...],
    "connections": [...]
  }
}
```

#### 노드 생성
```http
POST /api/nodes/script/{script_id}
Content-Type: application/json

{
  "id": "node1",
  "type": "image-touch",
  "position": {"x": 100, "y": 100},
  "data": {
    "title": "이미지 터치"
  }
}
```

**응답 (SuccessResponse)**:
```json
{
  "success": true,
  "message": "노드가 생성되었습니다.",
  "data": {
    "node": {
      "id": "node1",
      "type": "image-touch",
      "position": {"x": 100, "y": 100},
      "data": {
        "title": "이미지 터치"
      }
    }
  }
}
```

#### 노드 업데이트
```http
PUT /api/nodes/script/{script_id}/node/{node_id}
Content-Type: application/json

{
  "type": "image-touch",
  "position": {"x": 200, "y": 200},
  "data": {
    "title": "수정된 이미지 터치"
  }
}
```

**응답 (SuccessResponse)**:
```json
{
  "success": true,
  "message": "노드가 업데이트되었습니다.",
  "data": {
    "node": {
      "id": "node1",
      "type": "image-touch",
      "position": {"x": 200, "y": 200},
      "data": {
        "title": "수정된 이미지 터치"
      }
    }
  }
}
```

#### 노드 삭제
```http
DELETE /api/nodes/script/{script_id}/node/{node_id}
```

**응답 (SuccessResponse)**:
```json
{
  "success": true,
  "message": "노드가 삭제되었습니다.",
  "data": {
    "node_id": "node1"
  }
}
```

#### 노드 일괄 업데이트
```http
PUT /api/nodes/script/{script_id}/batch
Content-Type: application/json

{
  "nodes": [...],
  "connections": [...]
}
```

**응답 (SuccessResponse)**:
```json
{
  "success": true,
  "message": "노드들이 업데이트되었습니다.",
  "data": {
    "node_count": 5,
    "connection_count": 4
  }
}
```

### 7. 설정 관리

#### 서버 설정 조회
```http
GET /api/config/
```

**응답 (SuccessResponse)**:
```json
{
  "success": true,
  "message": "설정 조회 완료",
  "data": {
    "dev_mode": true
  }
}
```

#### 노드 설정 조회
```http
GET /api/config/nodes
```

**응답 (SuccessResponse)**:
```json
{
  "success": true,
  "message": "노드 설정 조회 완료",
  "data": {
    "nodes": {
      "start": {
        "label": "시작",
        "title": "시작",
        "description": "...",
        "script": "node-start.js",
        "isBoundary": true,
        "category": "boundary"
      }
    }
  }
}
```

#### 사용자 설정 조회 (전체)
```http
GET /api/config/user-settings
```

**응답 (SuccessResponse)**:
```json
{
  "success": true,
  "message": "사용자 설정 조회 완료",
  "data": {
    "sidebar-width": "300",
    "script-order": "[1,2,3]",
    "focused-script": "1"
  }
}
```

#### 사용자 설정 조회 (단일)
```http
GET /api/config/user-settings/{setting_key}
```

**응답 (SuccessResponse)**:
```json
{
  "success": true,
  "message": "사용자 설정 조회 완료",
  "data": {
    "key": "sidebar-width",
    "value": "300"
  }
}
```

#### 사용자 설정 저장
```http
PUT /api/config/user-settings/{setting_key}
Content-Type: application/json

{
  "value": "350"
}
```

**응답 (SuccessResponse)**:
```json
{
  "success": true,
  "message": "설정이 저장되었습니다.",
  "data": {
    "key": "sidebar-width",
    "value": "350"
  }
}
```

#### 사용자 설정 삭제
```http
DELETE /api/config/user-settings/{setting_key}
```

**응답 (SuccessResponse)**:
```json
{
  "success": true,
  "message": "설정이 삭제되었습니다.",
  "data": {
    "key": "sidebar-width"
  }
}
```

## 에러 응답

### 비즈니스 로직 에러 (ErrorResponse)

일부 엔드포인트는 비즈니스 로직 에러의 경우 `ErrorResponse` 형식을 반환합니다:

```json
{
  "success": false,
  "message": "에러 메시지",
  "error": "상세 에러 정보",
  "error_code": "ERROR_CODE"
}
```

예시:
- `/api/folder/select`: 폴더가 선택되지 않은 경우
- `/api/scripts/{script_id}/execute`: 스크립트 실행 중 오류 발생 시

### HTTP 에러 (HTTPException)

대부분의 에러는 FastAPI의 기본 에러 응답 형식을 사용합니다:

```json
{
  "detail": "에러 메시지"
}
```

### HTTP 상태 코드

- `200`: 성공
- `400`: 잘못된 요청 (Bad Request)
- `404`: 리소스를 찾을 수 없음 (Not Found)
- `500`: 서버 내부 오류 (Internal Server Error)
- `501`: 미구현 기능 (Not Implemented)

## 지원 노드 타입

- **경계 노드**: `start`, `end`
- **액션 노드**: `image-touch`, `process-focus`
- **대기 노드**: `wait`
- **조건 노드**: `condition`
- **반복 노드**: `repeat`

## 관련 문서

- [시스템 아키텍처](architecture.md)
- [개발 환경 설정](development.md)
- [프로젝트 구조](project-structure.md)
