**최신 수정일자: 2025.12.00**

# 개발자 가이드

## 개발 환경 설정

### 1. 가상환경 생성 및 활성화

> **중요**: 가상환경 이름은 반드시 `venv`로 생성해야 합니다. 다른 이름을 사용하면 자동 스크립트(`start-server.bat`, `lint-all.bat` 등)가 가상환경을 찾지 못할 수 있습니다.

```bash
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac
```

### 2. 패키지 설치
```bash
# 프로덕션 의존성
pip install -r server/requirements.txt

# 개발 의존성 (린팅, 테스팅 등)
pip install -r server/requirements-dev.txt
```

### 3. 환경 변수 설정 (선택사항)

프로젝트 루트 디렉토리에 `.env` 파일을 생성하여 서버 설정을 변경할 수 있습니다:

**`.env` 파일 생성 방법:**

1. 프로젝트 루트 디렉토리에 `.env` 파일 생성
2. 다음 내용을 추가:

```env
# 환경 설정
ENVIRONMENT=dev  # dev: 개발 모드, prd: 프로덕션 모드 (기본값)

# API 설정
API_HOST=127.0.0.1  # 보안: 로컬호스트에서만 접근 가능 (기본값)
API_PORT=8001  # 서버 포트 (기본값: 8001)

# 로그 설정
LOG_LEVEL=INFO  # DEBUG, INFO, WARNING, ERROR (기본값: INFO)
```

> **참고**: 
> - `.env` 파일이 없어도 기본값으로 서버가 실행됩니다
> - `start-server.bat`가 `.env` 파일을 자동으로 읽어서 사용합니다
> - 자세한 설정 옵션은 [환경 변수 설정 가이드](environment.md)를 참고하세요

## 서버 실행

### 개발 모드
```bash
cd server
python main.py
# 또는
python -m uvicorn main:app --reload
```

### 프로덕션 모드
```bash
cd server
python -m uvicorn main:app
```

## 코드 품질 관리

코드 품질 관리를 위한 린팅 및 포매팅 설정에 대한 자세한 내용은 [린팅 가이드](linting.md)를 참고하세요.

## 유용한 명령어

```bash
# API 문서 확인
# 브라우저: http://localhost:8001/docs (기본 포트 8001)

# 포트 변경 (.env 파일 수정)
API_PORT=8001
```

## 관련 문서

- [프로젝트 구조](project-structure.md)
- [시스템 아키텍처](architecture.md)
- [환경 변수 설정](environment.md)
- [코드 린팅 가이드](linting.md)
- [다국어 지원 (i18n)](settings/i18n.md)

