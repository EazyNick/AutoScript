**최신 수정일자: 2026.01.17**

# Workflow 페이지 구조

## 디렉토리 구조

```
pages/workflow/
├── workflow.js              # 워크플로우 편집기 메인 컨트롤러
├── page-router.js           # SPA 페이지 라우팅 관리
├── dashboard.js             # 대시보드 페이지
├── history.js               # 실행 기록 페이지
├── settings.js              # 설정 페이지
├── config/                  # 설정 파일
│   ├── action-node-types.js      # 액션 노드 타입 정의
│   ├── node-defaults.js          # 노드 기본값 설정
│   ├── node-preview-generator.js # 노드 미리보기 생성기
│   └── node-preview-outputs.js   # 노드 타입별 예시 출력 정의
├── constants/               # 상수 정의
│   ├── index.js                  # 상수 통합 export
│   ├── node-types.js             # 노드 타입 상수
│   ├── size-constants.js         # 크기 및 거리 상수
│   ├── style-constants.js        # 스타일 상수
│   ├── timing-constants.js       # 타이밍 관련 상수
│   └── undo-redo-constants.js    # Undo/Redo 상수
├── modals/                  # 모달
│   ├── add-node-modal.js         # 노드 추가 모달
│   └── node-settings-modal.js    # 노드 설정 모달
├── services/                # 비즈니스 로직
│   ├── node-creation-service.js   # 노드 생성 서비스
│   ├── node-registry.js          # 노드 레지스트리
│   ├── node-update-service.js    # 노드 업데이트 서비스
│   ├── undo-redo-service.js      # Undo/Redo 서비스
│   ├── workflow-execution-service.js  # 워크플로우 실행 서비스
│   ├── workflow-load-service.js       # 워크플로우 로드 서비스
│   └── workflow-save-service.js       # 워크플로우 저장 서비스
└── utils/                   # 유틸리티
    ├── node-identifier.js          # 노드 식별자 유틸리티
    ├── node-output-parser.js      # 노드 출력 파서
    ├── node-utils.js              # 노드 관련 유틸리티
    ├── node-validation-utils.js   # 노드 검증 유틸리티
    ├── parameter-form-generator.js # 파라미터 폼 생성기
    ├── storage-utils.js           # 스토리지 유틸리티
    └── viewport-utils.js           # 뷰포트 유틸리티

styles/pages/workflow/
├── workflow.css             # 워크플로우 편집기 스타일
├── dashboard.css            # 대시보드 페이지 스타일
├── history.css              # 실행 기록 페이지 스타일
└── settings.css             # 설정 페이지 스타일
```

**참고**: 
- CSS 파일은 `styles/pages/workflow/` 디렉토리에 위치합니다.
- JavaScript 파일은 `pages/workflow/` 루트 디렉토리에 위치합니다 (기능별로 분리).

**참고**: `workflow.html`은 `index.html`로 통합되었습니다.

## 모듈 분리 원칙

- **config/**: 하드코딩된 데이터
- **constants/**: 상수 정의
- **modals/**: 모달 UI
- **services/**: 비즈니스 로직
- **utils/**: 재사용 가능한 함수

## 페이지 구조

### SPA (Single Page Application) 구조

모든 페이지는 `index.html`에 포함되어 있으며, `page-router.js`가 페이지 전환을 관리합니다:

- **대시보드 페이지** (`dashboard.js`): 스크립트 통계 및 관리
- **스크립트 페이지** (`workflow.js`): 워크플로우 편집기
- **실행 기록 페이지** (`history.js`): 실행 내역 확인 및 로그 관리
- **설정 페이지** (`settings.js`): 애플리케이션 설정 관리

### 페이지 라우팅

`PageRouter` 클래스가 다음을 담당합니다:
- 페이지 전환 관리
- 네비게이션 활성화 상태 업데이트
- 헤더 제목/설명 동적 변경
- 사이드바 스크립트 섹션 표시/숨김 제어
