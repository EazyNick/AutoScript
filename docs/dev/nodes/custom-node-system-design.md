# 사용자 정의 노드 시스템 기획서

## 1. 개요

사용자가 UI에서 직접 노드 기능을 구현할 수 있는 시스템을 구축합니다.
기존의 하드코딩된 액션 함수들을 제거하고, 동적으로 실행 가능한 노드 시스템으로 전환합니다.

## 2. 핵심 개념

### 2.1 노드 타입 분류

#### A. 기본 노드 (Built-in Nodes)
- **시작 노드**: 워크플로우의 시작점 (종료 노드는 더 이상 사용되지 않음)
- **코드 실행 노드**: 사용자가 Python/JavaScript 코드를 직접 작성

#### B. 사용자 정의 노드 (Custom Nodes)
- **함수 노드**: 간단한 로직을 함수로 작성
- **HTTP 요청 노드**: 외부 API 호출
- **파일 처리 노드**: 파일 읽기/쓰기
- **데이터 변환 노드**: 데이터 포맷 변환

### 2.2 노드 실행 구조

```
노드 실행 흐름:
1. 노드 타입 확인
2. 노드 타입이 "code"인 경우 → 코드 실행 엔진 사용
3. 노드 타입이 "custom"인 경우 → 사용자 정의 핸들러 실행
4. 결과를 표준 형식으로 반환
```

## 3. 시스템 아키텍처

### 3.1 백엔드 구조

```
ActionService
├── CodeExecutor (코드 실행 엔진)
│   ├── PythonExecutor
│   └── JavaScriptExecutor
├── CustomNodeRegistry (사용자 정의 노드 레지스트리)
│   └── 동적 핸들러 로드
└── NodeExecutionEngine (노드 실행 엔진)
    └── 통합 실행 관리
```

### 3.2 프론트엔드 구조

```
NodeEditor
├── CodeEditor (코드 편집기)
│   ├── Monaco Editor 또는 CodeMirror
│   ├── 문법 하이라이팅
│   └── 자동완성
├── NodeTemplateManager (노드 템플릿 관리)
│   ├── 템플릿 저장/불러오기
│   └── 템플릿 공유
└── NodePreview (실시간 미리보기)
    └── 실행 결과 표시
```

## 4. 주요 기능

### 4.1 코드 실행 노드 (Code Node)

**기능:**
- Python 또는 JavaScript 코드 작성
- 이전 노드의 출력을 `$input` 또는 `$json`으로 접근
- 결과를 `return` 또는 `output` 변수에 할당

**예시:**
```python
# Python 코드 예시
x = $json.get('x', 0)
y = $json.get('y', 0)
result = x + y
return {"sum": result}
```

```javascript
// JavaScript 코드 예시
const x = $json.x || 0;
const y = $json.y || 0;
const sum = x + y;
return { sum };
```

### 4.2 사용자 정의 노드 생성

**프로세스:**
1. 노드 설정 모달에서 "사용자 정의 노드" 선택
2. 노드 이름, 설명, 아이콘 설정
3. 코드 작성 (Python/JavaScript)
4. 입력/출력 스키마 정의
5. 저장 및 재사용

**노드 메타데이터:**
```json
{
  "id": "custom-node-1",
  "name": "이미지 찾기",
  "description": "화면에서 이미지를 찾습니다",
  "code": "def execute(input_data):\n    ...",
  "language": "python",
  "inputs": [
    {"name": "image_path", "type": "string", "required": true}
  ],
  "outputs": [
    {"name": "found", "type": "boolean"},
    {"name": "position", "type": "object"}
  ]
}
```

### 4.3 노드 템플릿 시스템

**기능:**
- 자주 사용하는 패턴을 템플릿으로 저장
- 커뮤니티에서 템플릿 공유
- 템플릿 마켓플레이스

**템플릿 예시:**
- 이미지 인식 템플릿
- API 호출 템플릿
- 데이터 변환 템플릿
- 조건 분기 템플릿

## 5. 구현 단계

### Phase 1: 기본 코드 실행 노드
- [ ] Python 코드 실행 엔진 구현
- [ ] JavaScript 코드 실행 엔진 구현 (선택적)
- [ ] 안전한 샌드박스 환경 구축
- [ ] 코드 편집기 통합 (Monaco Editor)

### Phase 2: 사용자 정의 노드 시스템
- [ ] 노드 메타데이터 저장소 (DB)
- [ ] 노드 CRUD API
- [ ] 노드 실행 엔진
- [ ] 노드 설정 UI

### Phase 3: 고급 기능
- [ ] 노드 템플릿 시스템
- [ ] 노드 공유 기능
- [ ] 노드 마켓플레이스
- [ ] 노드 버전 관리

### Phase 4: 최적화 및 보안
- [ ] 코드 실행 시간 제한
- [ ] 리소스 사용량 제한
- [ ] 보안 감사 로그
- [ ] 코드 검증 및 린팅

## 6. 기술 스택 제안

### 백엔드
- **Python 실행**: `exec()` 또는 `subprocess` (보안 고려)
- **JavaScript 실행**: `PyExecJS` 또는 `js2py`
- **코드 검증**: `ast` 모듈로 문법 검사
- **샌드박스**: `restrictedpython` (Python용)

### 프론트엔드
- **코드 편집기**: Monaco Editor (VS Code 에디터)
- **문법 하이라이팅**: Prism.js 또는 highlight.js
- **자동완성**: 커스텀 자동완성 엔진

## 7. 보안 고려사항

### 7.1 코드 실행 제한
- 파일 시스템 접근 제한
- 네트워크 접근 제한 (선택적)
- 시스템 명령어 실행 제한
- 실행 시간 제한
- 메모리 사용량 제한

### 7.2 코드 검증
- 위험한 함수/모듈 사용 금지
- 문법 오류 검사
- 정적 코드 분석

### 7.3 사용자 권한
- 관리자만 시스템 노드 수정 가능
- 일반 사용자는 자신의 노드만 수정
- 공유 노드는 읽기 전용

## 8. 사용자 경험 (UX)

### 8.1 노드 편집 UI

```
┌─────────────────────────────────────┐
│ 노드 설정: [이미지 찾기]            │
├─────────────────────────────────────┤
│ 설명: 화면에서 이미지를 찾습니다    │
│                                     │
│ 코드 언어: [Python ▼]              │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ def execute(input_data):        │ │
│ │     image_path = input_data... │ │
│ │     # 코드 작성...              │ │
│ │     return {"found": True}     │ │
│ └─────────────────────────────────┘ │
│                                     │
│ 입력 스키마:                        │
│ - image_path (string, 필수)        │
│                                     │
│ 출력 스키마:                        │
│ - found (boolean)                  │
│ - position (object)                │
│                                     │
│ [실행 테스트] [저장] [취소]         │
└─────────────────────────────────────┘
```

### 8.2 코드 편집기 기능
- 문법 하이라이팅
- 자동 들여쓰기
- 코드 폴딩
- 에러 표시
- 자동완성 (이전 노드 출력 자동완성)
- 미니맵

### 8.3 실시간 미리보기
- 코드 작성 중 실시간 실행 (디바운스)
- 입력 데이터 시뮬레이션
- 출력 결과 미리보기
- 에러 메시지 표시

## 9. 데이터베이스 스키마

### custom_nodes 테이블
```sql
CREATE TABLE custom_nodes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    code TEXT NOT NULL,
    language TEXT NOT NULL,  -- 'python' or 'javascript'
    inputs_schema TEXT,  -- JSON
    outputs_schema TEXT,  -- JSON
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_public BOOLEAN DEFAULT FALSE,
    version INTEGER DEFAULT 1
);
```

### node_templates 테이블
```sql
CREATE TABLE node_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    code TEXT NOT NULL,
    language TEXT NOT NULL,
    description TEXT,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 10. API 설계

### 10.1 노드 관리 API

```
POST /api/custom-nodes
  - 사용자 정의 노드 생성

GET /api/custom-nodes
  - 노드 목록 조회

GET /api/custom-nodes/{id}
  - 특정 노드 조회

PUT /api/custom-nodes/{id}
  - 노드 수정

DELETE /api/custom-nodes/{id}
  - 노드 삭제

POST /api/custom-nodes/{id}/execute
  - 노드 실행 (미리보기용)

POST /api/custom-nodes/{id}/test
  - 노드 테스트 실행
```

### 10.2 코드 실행 API

```
POST /api/execute-code
  {
    "language": "python",
    "code": "...",
    "input_data": {...},
    "context": {...}
  }
```

## 11. 마이그레이션 전략

### 11.1 기존 노드 처리
1. 기존 액션 함수들을 코드 노드로 변환
2. 사용자가 기존 노드를 사용할 수 있도록 유지
3. 점진적으로 사용자 정의 노드로 전환

### 11.2 호환성 유지
- 기존 워크플로우가 계속 작동하도록 보장
- 기존 노드 타입은 "legacy"로 표시
- 마이그레이션 도구 제공

## 12. 확장 가능성

### 12.1 플러그인 시스템
- 외부 플러그인으로 노드 추가
- npm/pip 패키지처럼 노드 패키지 관리
- 버전 관리 및 의존성 해결

### 12.2 AI 통합
- AI가 코드 자동 생성
- 자연어로 노드 생성
- 코드 리팩토링 제안

### 12.3 시각적 프로그래밍
- 블록 기반 코드 편집기 (Scratch 스타일)
- 드래그 앤 드롭으로 로직 구성
- 코드와 시각적 표현 동기화

## 13. 성능 고려사항

### 13.1 코드 실행 최적화
- 코드 캐싱
- 컴파일된 코드 재사용
- 병렬 실행 지원

### 13.2 UI 성능
- 코드 편집기 가상화 (긴 코드 처리)
- 점진적 로딩
- 워커 스레드 활용

## 14. 모니터링 및 디버깅

### 14.1 실행 로그
- 각 노드 실행 시간 기록
- 입력/출력 데이터 로깅
- 에러 스택 트레이스 저장

### 14.2 디버깅 도구
- 브레이크포인트 설정
- 단계별 실행
- 변수 값 확인
- 실행 히스토리 추적

## 15. 사용 예시

### 예시 1: 간단한 계산 노드
```python
# 사용자가 작성한 코드
x = $json.get('x', 0)
y = $json.get('y', 0)
result = x * y + 10
return {"result": result}
```

### 예시 2: 이미지 찾기 노드
```python
# 사용자가 작성한 코드
from automation.screen_capture import ScreenCapture

image_path = $json.get('image_path')
if not image_path:
    return {"success": False, "reason": "no_image_path"}

screen = ScreenCapture()
location = screen.find_template(image_path, threshold=0.8)

if location:
    x, y, w, h = location
    return {
        "success": True,
        "position": {"x": x + w//2, "y": y + h//2}
    }
else:
    return {"success": False, "reason": "not_found"}
```

### 예시 3: 조건 분기 노드
```python
# 사용자가 작성한 코드
value = $json.get('value', 0)
threshold = $json.get('threshold', 50)

if value > threshold:
    return {"result": True, "branch": "high"}
else:
    return {"result": False, "branch": "low"}
```

## 16. 다음 단계

1. **프로토타입 개발**: 기본 코드 실행 노드 구현
2. **사용자 테스트**: 초기 사용자 피드백 수집
3. **기능 확장**: 템플릿 시스템, 공유 기능 추가
4. **최적화**: 성능 및 보안 강화
5. **문서화**: 사용자 가이드 및 API 문서 작성

