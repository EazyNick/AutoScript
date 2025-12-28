**최신 수정일자: 2025.12.28**

# 시스템 아키텍처

## 전체 구조

```
클라이언트 (브라우저) ←→ FastAPI 서버 ←→ SQLLite(DB)
```

## 백엔드

### 주요 모듈
- **api/**: REST API 라우터 (`@api_handler` 데코레이터 사용)
- **nodes/**: 노드 클래스 (`BaseNode` 상속, `@NodeExecutor` 데코레이터)
- **services/**: 비즈니스 로직
- **automation/**: 화면 캡처, 입력 처리, 워크플로우 실행
- **db/**: SQLite 데이터베이스 관리
- **execution_logging/**: 노드 실행 로그 관련 모듈 통합 (클라이언트, 모델, 리포지토리)
- **log/**: 애플리케이션 로그 관리
- **utils/**: 공통 유틸리티 (파라미터 검증, 결과 포맷팅 등)

### 노드 시스템
- 모든 노드는 `BaseNode` 상속
- `@NodeExecutor("action-name")` 데코레이터로 공통 기능 처리
- 파라미터 검증: `get_parameter()` 사용
- 노드 설정은 `server/config/nodes_config.py`에서 중앙 관리
- 노드별 예시 출력은 `UI/src/pages/workflow/config/node-preview-outputs.js`에서 관리

## 프론트엔드

### 주요 모듈
- **js/api/**: API 클라이언트 (`window.API_BASE_URL` 동적 사용)
- **js/components/node/**: 노드 렌더링 컴포넌트
  - `node-icons.config.js`: 노드 아이콘 중앙 관리
- **js/components/connection/**: 노드 간 연결선 관리
  - `connection.js`: 메인 ConnectionManager 클래스
  - `connection-utils.js`: 로거 및 경로 생성 유틸리티
  - `connection-svg.js`: SVG 초기화 및 연결선 그리기
  - `connection-events.js`: 이벤트 바인딩 및 처리
  - `connection-coordinates.js`: 커넥터 위치 계산
- **js/components/sidebar/**: 사이드바 관리
  - `sidebar.js`: 메인 SidebarManager 클래스
  - `sidebar-utils.js`: 로거 및 날짜 포맷팅 유틸리티
  - `sidebar-ui.js`: UI 렌더링 및 업데이트
  - `sidebar-events.js`: 이벤트 바인딩 및 처리
  - `sidebar-scripts.js`: 스크립트 로드 및 실행 관리
- **pages/workflow/**: 워크플로우 편집기 및 페이지 라우팅
  - `page-router.js`: SPA 페이지 라우팅 관리
  - `dashboard.js`: 대시보드 페이지
  - `settings.js`: 설정 페이지
  - `workflow.js`: 워크플로우 편집기
  - **services/**: 저장/로드/실행 로직
  - **modals/**: 노드 추가/설정 모달
- **js/utils/**: 유틸리티
  - `theme-manager.js`: 라이트/다크 모드 테마 관리
  - `toast.js`: 토스트 알림 관리
  - `modal.js`: 모달 창 관리
  - `result-modal.js`: 실행 결과 모달 관리
- **logs/services/**: 로그 서비스 계층
  - `log-service.js`: 로그 데이터 로드, 통계 계산, 그룹화
- **styles/**: 스타일시트
  - `themes/dark/`: 다크 모드 스타일
  - `themes/light/`: 라이트 모드 스타일
  - `pages/workflow/`: 워크플로우 관련 페이지 스타일

## 설정

- **환경 변수**: `.env` 파일에서 `API_HOST`, `API_PORT`, `ENVIRONMENT` 로드
- **서버 설정**: `server/config/server_config.py`에서 중앙 관리
- **클라이언트**: `window.API_HOST`, `window.API_PORT`로 동적 API URL 생성

## API 응답 형식

모든 API 엔드포인트는 일관된 응답 형식을 사용합니다:

- **성공 응답** (`SuccessResponse`): `{success: true, message: string | null, data: object | null}`
- **에러 응답** (`ErrorResponse`): `{success: false, message: string | null, error: string | null, error_code: string | null}`
- **리스트 응답** (`ListResponse`): `{success: true, message: string | null, data: array, count: number | null}`
- **페이지네이션 응답** (`PaginatedResponse`): `ListResponse` + `{page, page_size, total, total_pages}`

자세한 내용은 [API 참조 문서](api-reference.md)를 참고하세요.

## 데이터 흐름

1. **저장**: 클라이언트 → `PUT /api/scripts/{id}` → DB
2. **실행**: 클라이언트 → `POST /api/scripts/{id}/execute` → 노드 실행 → Windows API
3. **로드**: 클라이언트 → `GET /api/scripts/{id}` → DB → 클라이언트
4. **통계**: 클라이언트 → `GET /api/dashboard/stats` → DB → 클라이언트

## 기술 스택

- **백엔드**: FastAPI, SQLite, OpenCV, PyAutoGUI
- **프론트엔드**: 순수 JavaScript (ES6+), HTML5, CSS3

