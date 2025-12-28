**최신 수정일자: 2025.12.00**

# 코드 린팅 가이드

이 프로젝트는 Python과 JavaScript 코드의 품질을 관리합니다:
- **Python**: [Ruff](https://github.com/astral-sh/ruff) - 매우 빠르고 현대적인 Python 린터 및 포매터
- **JavaScript**: [ESLint](https://eslint.org/) + [Prettier](https://prettier.io/) - JavaScript 린터 및 포매터

## 빠른 시작

### 개발 환경 구축

#### 설치 명령어 (한 줄)

```bash
pip install -r server/requirements-dev.txt  # Python 린팅 도구 (Ruff, mypy)
cd UI && npm install                        # JavaScript 린팅 도구 (ESLint, Prettier)
```

#### 상세 설정

**Python 린팅 환경 설정**

> **중요**: 가상환경 이름은 반드시 `venv`로 생성해야 합니다. 다른 이름을 사용하면 자동 스크립트(`lint-all.bat` 등)가 가상환경을 찾지 못할 수 있습니다.

```bash
# 가상환경 생성 (아직 없다면)
python -m venv venv

# 가상환경 활성화 (Windows)
venv\Scripts\activate

# 개발 의존성 설치
pip install -r server/requirements-dev.txt
```

**JavaScript 린팅 환경 설정**

```bash
# UI 디렉토리로 이동
cd UI

# 의존성 설치
npm install
```

## 린팅 테스트

### 자동 린팅 스크립트 사용 (권장) ⚡

프로젝트 루트에서 `scripts/lint-all.bat` 파일을 실행하면 Python과 JavaScript 코드의 린팅과 포매팅을 자동으로 실행합니다:

```bash
scripts\lint-all.bat
```

**자동 린팅 스크립트 기능:**
- Python 린팅 및 포매팅 (ruff)
- Python 타입 체크 (mypy)
- JavaScript 린팅 및 포매팅 (ESLint, Prettier)
- 가상환경 자동 감지 및 활성화 (`venv` 폴더 우선 검색)
- 프로젝트 루트 자동 감지

> **중요**: 가상환경 이름은 반드시 `venv`로 생성해야 합니다. `lint-all.bat`가 `venv` 폴더를 우선적으로 찾습니다.

### 수동 린팅 실행

#### Python 린팅 테스트

```bash
# 린팅 검사
ruff check server/

# 자동 수정
ruff check --fix server/

# 포매팅 적용
ruff format server/

# 포매팅 확인
ruff format --check server/

# 타입 체크
mypy server/
```

#### JavaScript 린팅 테스트

```bash
# UI 디렉토리로 이동
cd UI

# 린팅 검사
npm run lint

# 자동 수정
npm run lint:fix

# 포매팅 적용
npm run format

# 포매팅 확인
npm run format:check
```

## 상세 가이드

자세한 내용은 각 언어별 린팅 가이드를 참고하세요:

- **[Python 린팅 가이드](../lint/python-linting.md)** - Python 린팅 상세 가이드
- **[JavaScript 린팅 가이드](../lint/javascript-linting.md)** - JavaScript 린팅 상세 가이드

## 기여 전 체크리스트

코드를 기여하기 전에 다음을 확인하세요:

### 빠른 방법 (권장) ⚡
- [ ] `scripts\lint-all.bat` 실행하여 모든 린팅 및 포매팅 자동 실행

### 수동 방법

#### Python 코드
- [ ] `ruff check --fix server/` 실행하여 자동 수정 가능한 문제 해결
- [ ] `ruff format server/` 실행하여 코드 포매팅
- [ ] `ruff check server/` 실행하여 남은 문제가 없는지 확인
- [ ] `ruff format --check server/` 실행하여 포매팅이 올바른지 확인
- [ ] `mypy server/` 실행하여 타입 체크 통과 확인

자세한 내용은 [Python 린팅 가이드](../lint/python-linting.md)를 참고하세요.

#### JavaScript 코드
- [ ] `cd UI && npm install` 실행하여 의존성 설치 (최초 1회만)
- [ ] `cd UI && npm run lint:fix` 실행하여 자동 수정 가능한 문제 해결
- [ ] `cd UI && npm run format` 실행하여 코드 포매팅
- [ ] `cd UI && npm run lint` 실행하여 남은 문제가 없는지 확인
- [ ] `cd UI && npm run format:check` 실행하여 포매팅이 올바른지 확인

자세한 내용은 [JavaScript 린팅 가이드](../lint/javascript-linting.md)를 참고하세요.
