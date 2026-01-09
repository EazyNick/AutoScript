**최신 수정일자: 2026.01.08**

# 프로젝트 구조

## 프로젝트 루트 구조

```
AutoScript/
├── .env                    # 환경 변수 설정 파일 (선택사항)
├── .gitignore             # Git 제외 파일 목록
├── start-server.bat       # 서버 실행 배치 파일
├── scripts/               # 유틸리티 스크립트
│   ├── dev/               # 개발용 스크립트 (테스트 스크립트 생성/삭제)
│   ├── package/           # 패키징 관련 스크립트 (스크립트 패키징/설치)
│   ├── nodes/             # 노드 관련 스크립트 (노드 생성/삭제/검증)
│   └── *.bat              # 배치 파일들
├── server/                # 백엔드 서버 코드
├── UI/                    # 프론트엔드 UI 코드
├── docs/                  # 문서
└── ...
```

> **참고**: `.env` 파일은 프로젝트 루트에 생성하며, 서버 설정(호스트, 포트 등)을 관리합니다. 자세한 내용은 [환경 변수 설정 가이드](environment.md)를 참고하세요.

## 주요 디렉토리

### `server/`
- **api/**: REST API 라우터 (`@api_handler` 데코레이터 사용)
  - **api/helpers/**: 공통 헬퍼 함수 및 상수 (2026-01-05 추가)
    - `script_helpers.py`: 스크립트 조회/저장 헬퍼
    - `response_helpers.py`: 응답 생성 헬퍼
    - `router_wrapper.py`: 라우터 래퍼 데코레이터
    - `constants.py`: API 관련 상수 (HTTP 상태 코드, 에러 메시지, 제한값 등)
- **nodes/**: 노드 클래스 (`BaseNode` 상속, `@NodeExecutor` 데코레이터)
  - `boundarynodes/`: 경계 노드들 (시작 노드 등)
  - `conditionnodes/`: 조건 노드들
  - `excelnodes/`: 엑셀 노드들
  - `imagenodes/`: 이미지 노드들
  - `logicnodes/`: 로직 노드들 (반복 노드 등)
  - `processnodes/`: 프로세스 노드들 (프로세스 포커스 등)
  - `waitnodes/`: 대기 노드들
- **services/**: 비즈니스 로직
- **automation/**: 화면 캡처, 입력 처리, 워크플로우 실행
- **db/**: SQLite 데이터베이스 관리
  - `constants.py`: 데이터베이스 관련 상수 (2026-01-05 추가)
- **execution_logging/**: 노드 실행 로그 관련 모듈 통합
  - `execution_log_client.py`: 로그 전송 클라이언트
  - `execution_log_models.py`: 로그 모델
  - `execution_log_repository.py`: 로그 DB 리포지토리
- **log/**: 애플리케이션 로그 관리 (`log_manager.py`)
- **utils/**: 공통 유틸리티 (파라미터 검증, 결과 포맷팅 등)
- **config/**: 설정 관리 (`server_config.py`)

### `UI/src/`
- **js/api/**: API 클라이언트 (`window.API_BASE_URL` 사용)
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
- **js/utils/**: 유틸리티
  - `theme-manager.js`: 테마 관리 (라이트/다크/시스템)
  - `i18n.js`: 다국어 지원 (번역 시스템)
  - `toast.js`: 토스트 알림
  - `modal.js`: 모달 창
  - `result-modal.js`: 실행 결과 모달
- **pages/workflow/**: 워크플로우 편집기 및 페이지
  - **constants/**: 워크플로우 관련 상수 (2026-01-05 추가)
    - `timing-constants.js`: 타이밍 관련 상수
    - `size-constants.js`: 크기 및 거리 상수
    - `style-constants.js`: 스타일 상수
    - `undo-redo-constants.js`: Undo/Redo 상수
  - `page-router.js`: SPA 페이지 라우팅
  - `dashboard.js`: 대시보드 페이지
  - `history.js`: 실행 기록 페이지
  - `settings.js`: 설정 페이지
  - `workflow.js`: 워크플로우 편집기
  - **services/**: 저장/로드/실행 로직
  - **modals/**: 노드 추가/설정 모달
  - **config/**: 노드 설정 파일
    - `node-preview-outputs.js`: 노드 타입별 예시 출력 정의
- **logs/services/**: 로그 서비스
  - `log-service.js`: 로그 데이터 로드 및 통계 계산
- **styles/**: 스타일시트
  - `themes/dark/`: 다크 모드 스타일
  - `themes/light/`: 라이트 모드 스타일
  - `components/`: 컴포넌트별 스타일
  - `pages/workflow/`: 워크플로우 관련 페이지 스타일

### `scripts/`
- **package/**: 패키징 관련 스크립트
  - `package-script.py`: 스크립트를 ZIP 파일로 패키징
  - `install-script.py`: ZIP 파일에서 스크립트 설치
  - `package-node.py`: 노드를 ZIP 파일로 패키징
  - `install-node.py`: ZIP 파일에서 노드 설치
- **nodes/**: 노드 관련 스크립트
  - `create-node.py`: 노드 생성 (Python, JavaScript 파일 및 `nodes_config.py` 자동 추가)
  - `delete-node.py`: 노드 삭제
  - `validate-nodes.py`: 노드 검증
- **루트**: 배치 파일들 (`.bat`)
  - `package-script.bat`, `install-script.bat`: 스크립트 패키징 관련
  - `package-node.bat`, `install-node.bat`: 노드 패키징 관련
  - `create-test-node.bat`, `delete-node.bat`: 노드 개발 도구 (테스트용)
  - `find-venv-python.bat`: 가상환경 Python 찾기
  - `lint-all.bat`: 전체 코드 린팅

## 파일 명명 규칙

- **Python**: 스네이크 케이스 (`action_service.py`)
- **JavaScript**: 케밥 케이스 (`node-action.js`)

