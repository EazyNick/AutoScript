# Python 린팅 가이드

이 프로젝트는 [Ruff](https://github.com/astral-sh/ruff)를 사용하여 Python 코드의 품질을 관리합니다. Ruff는 매우 빠르고 현대적인 Python 린터 및 포매터입니다.

## 목차

- [설치](#설치)
- [기본 사용법](#기본-사용법)
- [린팅 실행](#린팅-실행)
- [포매팅 실행](#포매팅-실행)
- [설정 파일](#설정-파일)
- [타입 체킹](#타입-체킹)
- [CI/CD 통합](#cicd-통합)
- [문제 해결](#문제-해결)
- [자동화](#자동화)

## 설치

### 개발 의존성 설치

```bash
pip install -r server/requirements-dev.txt
```

또는 Ruff만 설치하려면:

```bash
pip install ruff
```

## 기본 사용법

### 전체 프로젝트 검사

```bash
# 린팅 검사
ruff check server/

# 포매팅 검사 (변경하지 않음)
ruff format --check server/
```

### 자동 수정

```bash
# 린팅 문제 자동 수정
ruff check --fix server/

# 포매팅 적용
ruff format server/
```

## 린팅 실행

### 기본 린팅

```bash
# 전체 프로젝트 린팅
ruff check server/

# 특정 디렉토리만 확인
ruff check server/api/

# 특정 파일만 확인
ruff check server/main.py
```

### 자동 수정 가능한 문제 수정

```bash
# 자동 수정 가능한 문제를 자동으로 수정
ruff check --fix server/

# 특정 파일만 수정
ruff check --fix server/main.py
```

### 출력 형식

```bash
# 간단한 출력 형식
ruff check --output-format=concise server/

# JSON 형식으로 출력
ruff check --output-format=json server/
```

### 특정 규칙만 확인

```bash
# 특정 규칙만 확인 (예: unused imports)
ruff check --select F401 server/

# 특정 규칙 제외
ruff check --ignore E501 server/
```

## 포매팅 실행

### 기본 포매팅

```bash
# 전체 프로젝트 포매팅
ruff format server/

# 특정 파일만 포매팅
ruff format server/main.py

# 특정 디렉토리만 포매팅
ruff format server/api/
```

### 변경사항 미리보기

```bash
# 실제로 변경하지 않고 차이점만 확인
ruff format --check server/

# diff 형식으로 출력
ruff format --diff server/
```

## 설정 파일

프로젝트의 린팅 설정은 `pyproject.toml` 파일에 정의되어 있습니다.

### 주요 설정

- **target-version**: Python 3.10
- **line-length**: 120자
- **활성화된 규칙**: pycodestyle, pyflakes, isort, bugbear 등

### 설정 수정

`pyproject.toml` 파일의 `[tool.ruff]` 섹션에서 설정을 변경할 수 있습니다:

```toml
[tool.ruff]
line-length = 120
target-version = "py310"

[tool.ruff.lint]
select = ["E", "W", "F", "I", "B"]
ignore = ["E501"]  # 라인 길이 제한 무시
```

자세한 설정 옵션은 [Ruff 공식 문서](https://docs.astral.sh/ruff/)를 참고하세요.

## 타입 체킹

프로젝트는 선택적으로 [mypy](https://mypy.readthedocs.io/)를 사용한 타입 체킹을 지원합니다.

### mypy 실행

```bash
# 전체 프로젝트 타입 체크
mypy server/

# 특정 파일만 확인
mypy server/main.py
```

### 설정

타입 체킹 설정은 `pyproject.toml`의 `[tool.mypy]` 섹션에 정의되어 있습니다.

#### 주요 설정 항목

- **`disable_error_code`**: 특정 타입 체크 에러를 전역적으로 무시합니다.
  - `assignment`: 할당 타입 불일치 허용 (예: `pkgutil.iter_modules`의 타입 스텁 문제)
  - `arg-type`: 함수 인자 타입 불일치 허용
  - `return-value`: 반환 타입 불일치 허용
  - 기타 프로젝트 특성상 필요한 에러 코드들

#### 에러 코드 무시

일부 표준 라이브러리 함수(예: `pkgutil.iter_modules`)는 타입 스텁이 완벽하지 않아 타입 체크 에러가 발생할 수 있습니다. 이러한 경우 `pyproject.toml`의 `disable_error_code`에 해당 에러 코드를 추가하여 전역적으로 무시할 수 있습니다.

## CI/CD 통합

### GitHub Actions 예시

```yaml
name: Lint Python

on: [push, pull_request]

jobs:
  lint-python:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.10'
      - name: Install dependencies
        run: |
          pip install -r server/requirements-dev.txt
      - name: Run linter
        run: |
          ruff check server/
      - name: Check formatting
        run: |
          ruff format --check server/
      - name: Type check
        run: |
          mypy server/
```

### 로컬에서 CI 검사 실행

```bash
# 린팅 검사
ruff check server/

# 포매팅 검사
ruff format --check server/

# 둘 다 실행
ruff check server/ && ruff format --check server/
```

## 문제 해결

### 일반적인 문제

#### Import 정렬 문제

```bash
# isort를 사용하여 import 정렬
ruff check --select I --fix server/
```

#### 사용하지 않는 import 제거

```bash
# 사용하지 않는 import 자동 제거
ruff check --select F401 --fix server/
```

#### 긴 라인 처리

기본적으로 라인 길이는 120자로 설정되어 있습니다. 특정 파일이나 라인에서 무시하려면:

```python
# ruff: noqa: E501
very_long_line_that_exceeds_120_characters = "..."

# 또는 파일 전체에서 무시
# ruff: noqa
```

### 첫 실행 가이드

#### 1. 개발 의존성 설치 확인

```bash
# 가상환경 활성화 (Windows)
venv\Scripts\activate

# 개발 의존성 설치
pip install -r server/requirements-dev.txt
```

#### 2. 린팅 실행 순서

```bash
# 1단계: 자동 수정 가능한 문제 수정
ruff check --fix server/

# 2단계: 코드 포매팅
ruff format server/

# 3단계: 남은 문제 확인
ruff check server/

# 4단계: 타입 체크
mypy server/
```

#### 3. 문제 해결

- **ruff 에러**: `ruff check --fix server/`로 자동 수정 시도
- **타입 에러**: mypy가 지적한 부분에 타입 힌트 추가
- **포매팅 문제**: `ruff format server/`로 자동 포매팅

## 자동화

개발 중 매번 린팅 명령어를 입력하는 것을 자동화하기 위한 스크립트와 Git hook을 제공합니다.

### 1. 수동 실행 (스크립트 사용)

#### Windows (PowerShell)
```powershell
.\scripts\linting\lint.ps1
```

#### Linux/Mac (Bash)
```bash
chmod +x scripts/linting/lint.sh
./scripts/linting/lint.sh
```

#### Python (모든 플랫폼)
```bash
python scripts/linting/lint.py
```

### 2. 자동 실행 (Git Pre-commit Hook)

커밋 전에 자동으로 린팅 검사를 실행합니다.

#### 설정 방법

1. **Git hooks 디렉토리 확인**
   ```bash
   # Git 저장소가 초기화되어 있어야 합니다
   git init  # 아직 초기화하지 않았다면
   ```

2. **Pre-commit hook 활성화**
   ```bash
   # Windows (Git Bash)
   chmod +x .git/hooks/pre-commit
   
   # 또는 PowerShell에서
   icacls .git/hooks/pre-commit /grant Everyone:RX
   ```

3. **테스트**
   ```bash
   git add .
   git commit -m "test"
   # 자동으로 린팅 검사가 실행됩니다
   ```

#### Hook 비활성화 (필요시)

```bash
# 임시로 비활성화
mv .git/hooks/pre-commit .git/hooks/pre-commit.disabled

# 다시 활성화
mv .git/hooks/pre-commit.disabled .git/hooks/pre-commit
```

### 3. 통합 린팅 스크립트 (lint-all.bat)

Windows에서 Python과 JavaScript 린팅을 한 번에 실행할 수 있는 배치 파일이 제공됩니다.

#### 사용법

```bash
# 프로젝트 루트에서 실행
scripts\lint-all.bat

# 또는 scripts 폴더에서 실행
cd scripts
lint-all.bat
```

#### 실행 순서

스크립트는 다음 순서로 실행됩니다:

1. **[1/5] Python linting check and auto-fix**: `ruff check --fix server/`
2. **[2/5] Python formatting**: `ruff format server/`
3. **[3/5] Mypy type checking**: `mypy server/` (mypy가 설치되어 있는 경우)
4. **[4/5] JavaScript linting check and auto-fix**: `npm run lint:fix` (UI 폴더에서)
5. **[5/5] JavaScript formatting**: `npm run format` (UI 폴더에서)

#### 특징

- 가상환경 자동 감지 및 활성화 (`.venv`, `venv`, `env` 등)
- 프로젝트 루트 자동 탐색
- 각 단계별 성공/실패 메시지 표시
- mypy가 설치되어 있지 않으면 경고 후 다음 단계 진행

### 4. VS Code / Cursor 설정 (선택사항)

`.vscode/tasks.json` 파일을 생성하여 작업으로 등록할 수 있습니다:

```json
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "Lint",
            "type": "shell",
            "command": "python",
            "args": ["scripts/linting/lint.py"],
            "problemMatcher": [],
            "group": {
                "kind": "test",
                "isDefault": true
            }
        }
    ]
}
```

단축키 `Ctrl+Shift+P` → "Tasks: Run Task" → "Lint" 선택

### 실행되는 명령어

스크립트는 다음 순서로 실행됩니다:

1. **Ruff 자동 수정**: `ruff check --fix server/`
2. **Ruff 포매팅**: `ruff format server/`
3. **Ruff 검사**: `ruff check server/`
4. **Mypy 타입 체크**: `mypy server/`

모든 단계가 통과해야 커밋이 진행됩니다.

### 문제 해결

#### Pre-commit Hook이 실행되지 않는 경우

1. **권한 확인**
   ```bash
   ls -la .git/hooks/pre-commit
   # 실행 권한이 있어야 합니다 (x)
   ```

2. **수동 실행 테스트**
   ```bash
   .git/hooks/pre-commit
   ```

3. **Git 설정 확인**
   ```bash
   git config core.hooksPath
   # 비어있거나 .git/hooks를 가리켜야 합니다
   ```

#### 린팅 실패 시

- 에러 메시지를 확인하고 수정
- 자동 수정이 안 되는 경우 수동으로 수정
- `--no-verify` 플래그로 hook 건너뛰기 (권장하지 않음)
  ```bash
  git commit --no-verify -m "message"
  ```

#### 명령어를 찾을 수 없는 경우

스크립트는 자동으로 가상환경에서 `ruff`와 `mypy`를 찾습니다. 만약 찾지 못한다면:

1. **가상환경 확인**
   ```bash
   # 가상환경이 있는지 확인 (반드시 'venv' 이름 사용)
   ls -la venv  # Windows: dir venv
   ```

2. **가상환경 활성화 후 수동 실행**
   ```bash
   # Windows
   venv\Scripts\activate
   
   # Linux/Mac
   source venv/bin/activate
   
   # 그 후 스크립트 실행
   python scripts/linting/lint.py
   ```

> **중요**: 가상환경 이름은 반드시 `venv`로 생성해야 합니다. 다른 이름을 사용하면 자동 스크립트가 가상환경을 찾지 못할 수 있습니다.

3. **ruff와 mypy 설치 확인**
   ```bash
   pip list | grep ruff
   pip list | grep mypy
   ```

## 참고 자료

- [Ruff 공식 문서](https://docs.astral.sh/ruff/)
- [Ruff GitHub 저장소](https://github.com/astral-sh/ruff)
- [mypy 공식 문서](https://mypy.readthedocs.io/)
- [개발 린팅 가이드](../dev/linting.md) - 개발 환경 구축 및 빠른 시작
- [GitHub Desktop Hooks 가이드](github-desktop-hooks.md) - GitHub Desktop 사용 시 메시지 확인 방법

## 기여 전 체크리스트

Python 코드를 기여하기 전에 다음을 확인하세요:

- [ ] `ruff check --fix server/` 실행하여 자동 수정 가능한 문제 해결
- [ ] `ruff format server/` 실행하여 코드 포매팅
- [ ] `ruff check server/` 실행하여 남은 문제가 없는지 확인
- [ ] `ruff format --check server/` 실행하여 포매팅이 올바른지 확인
- [ ] `mypy server/` 실행하여 타입 체크 통과 확인
