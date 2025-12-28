**최신 수정일자: 2025.12.00**

# 환경 변수 설정 가이드

## 기본 동작

`.env` 파일이 없으면 기본값으로 프로덕션 모드(`ENVIRONMENT=prd`)가 적용됩니다.

## .env 파일 생성 방법

### 1. 파일 생성

프로젝트 루트 디렉토리에 `.env` 파일을 생성합니다:

```bash
# Windows (PowerShell)
New-Item -Path .env -ItemType File

# Windows (CMD)
type nul > .env

# 또는 텍스트 에디터로 직접 생성
```

### 2. 설정 내용 추가

`.env` 파일에 다음 내용을 추가합니다:

```env
# 환경 설정
ENVIRONMENT=dev  # dev: 개발 모드 (모든 로그 출력), prd: 프로덕션 모드 (기본값)

# API 설정
API_HOST=127.0.0.1  # 보안: 로컬호스트에서만 접근 가능 (기본값)
API_PORT=8001  # 서버 포트 (기본값: 8001)

# 로그 설정
LOG_LEVEL=INFO  # DEBUG, INFO, WARNING, ERROR (기본값: INFO)
LOG_DIR=log/logs  # 로그 파일 저장 디렉토리 (기본값: log/logs)
```

### 3. 파일 위치 확인

`.env` 파일은 반드시 **프로젝트 루트 디렉토리**에 있어야 합니다:

```
AutoScript/
├── .env          ← 여기에 생성
├── server/
├── UI/
├── start-server.bat
└── ...
```

## 설정 값

### 필수 설정 (선택사항)

- `ENVIRONMENT`: 환경 모드
  - `dev`: 개발 모드 (모든 로그 출력)
  - `prd`: 프로덕션 모드 (에러만 출력, 기본값)

- `API_HOST`: 서버 호스트
  - 기본값: `127.0.0.1` (로컬호스트만 접근 가능)
  - `0.0.0.0`: 모든 네트워크 인터페이스에서 접근 가능 (보안 주의)

- `API_PORT`: 서버 포트
  - 기본값: `8001`
  - 다른 포트를 사용하려면 이 값을 변경하세요

### 추가 설정 (선택사항)

- `LOG_LEVEL`: 로그 레벨 (기본값: `INFO`)
  - `DEBUG`: 모든 로그 출력
  - `INFO`: 정보 로그 이상 출력
  - `WARNING`: 경고 로그 이상 출력
  - `ERROR`: 에러 로그만 출력

- `LOG_DIR`: 로그 파일 저장 디렉토리 (기본값: `log/logs`)

- `DEBUG`: 디버그 모드 (기본값: `False`)
  - `True`: 디버그 모드 활성화
  - `False`: 디버그 모드 비활성화

## 동작 원리

1. 서버가 `.env` 파일을 읽어 `window.API_HOST`, `window.API_PORT`, `window.DEV_MODE`를 HTML에 주입
2. 클라이언트 JavaScript가 `window.API_BASE_URL`로 동적 API URL 생성
3. `logger.js`가 `window.DEV_MODE`로 로그 출력 제어

