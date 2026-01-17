# JavaScript 린팅 가이드

이 프로젝트는 [ESLint](https://eslint.org/)와 [Prettier](https://prettier.io/)를 사용하여 JavaScript 코드의 품질을 관리합니다.

## 목차

- [설치](#설치)
- [기본 사용법](#기본-사용법)
- [린팅 실행](#린팅-실행)
- [포매팅 실행](#포매팅-실행)
- [린팅 규칙](#린팅-규칙)
- [CI/CD 통합](#cicd-통합)
- [자동 실행](#자동-실행)
- [문제 해결](#문제-해결)

## 설치

### 개발 의존성 설치

```bash
cd UI
npm install
```

이 명령어는 `package.json`에 정의된 ESLint와 Prettier를 설치합니다.

## 기본 사용법

### 전체 프로젝트 검사

```bash
cd UI

# 린팅 검사
npm run lint

# 포매팅 검사 (변경하지 않음)
npm run format:check
```

### 자동 수정

```bash
cd UI

# 린팅 문제 자동 수정
npm run lint:fix

# 포매팅 적용
npm run format
```

## 린팅 실행

### 기본 린팅

```bash
cd UI

# 전체 프로젝트 린팅
npm run lint

# 특정 디렉토리만 확인
npx eslint src/js/api/

# 특정 파일만 확인
npx eslint src/js/api/api.js
```

### 자동 수정 가능한 문제 수정

```bash
cd UI

# 자동 수정 가능한 문제를 자동으로 수정
npm run lint:fix

# 특정 파일만 수정
npx eslint --fix src/js/api/api.js
```

### 출력 형식

```bash
cd UI

# JSON 형식으로 출력
npx eslint --format json src/**/*.js

# HTML 형식으로 출력
npx eslint --format html -o report.html src/**/*.js
```

## 포매팅 실행

### 기본 포매팅

```bash
cd UI

# 전체 프로젝트 포매팅
npm run format

# 특정 파일만 포매팅
npx prettier --write src/js/api/api.js

# 특정 디렉토리만 포매팅
npx prettier --write src/js/api/
```

### 변경사항 미리보기

```bash
cd UI

# 실제로 변경하지 않고 차이점만 확인
npm run format:check

# diff 형식으로 출력
npx prettier --check --list-different src/**/*.js
```

## 린팅 규칙

### 주요 규칙

- **들여쓰기**: 4칸 스페이스
- **따옴표**: 작은따옴표 (`'`)
- **세미콜론**: 필수
- **변수 선언**: `var` 사용 금지 (`let`, `const` 사용)
- **비교 연산자**: `==` 사용 금지 (`===` 사용)
- **최대 라인 길이**: 120자
- **줄바꿈**: Windows/Linux 모두 허용 (CRLF/LF)

### 설정 파일

프로젝트의 린팅 설정은 다음 파일에 정의되어 있습니다:

- **ESLint 설정**: `UI/.eslintrc.json`
- **Prettier 설정**: `UI/.prettierrc.json`
- **제외 파일**: `UI/.eslintignore`, `UI/.prettierignore`

### 설정 수정

`UI/.eslintrc.json` 파일에서 규칙을 변경할 수 있습니다:

```json
{
  "rules": {
    "indent": ["error", 4],
    "quotes": ["error", "single"],
    "semi": ["error", "always"],
    "max-len": ["warn", { "code": 120 }]
  }
}
```

자세한 설정 옵션은 [ESLint 공식 문서](https://eslint.org/docs/latest/use/configure/)를 참고하세요.

## CI/CD 통합

### GitHub Actions 예시

```yaml
name: Lint JavaScript

on: [push, pull_request]

jobs:
  lint-javascript:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: |
          cd UI
          npm install
      - name: Run ESLint
        run: |
          cd UI
          npm run lint
      - name: Check Prettier formatting
        run: |
          cd UI
          npm run format:check
```

### 로컬에서 CI 검사 실행

```bash
cd UI

# 린팅 검사
npm run lint

# 포매팅 검사
npm run format:check

# 둘 다 실행
npm run lint && npm run format:check
```

## 자동 실행

### 1. 수동 실행 (스크립트 사용)

#### Python 스크립트 (모든 플랫폼)
```bash
# 프로젝트 루트에서 실행
python scripts/linting/lint-js.py
```

#### npm 직접 실행
```bash
# UI 디렉토리로 이동
cd UI

# 전체 린팅 프로세스 실행
npm run lint:fix    # ESLint 자동 수정
npm run format      # Prettier 포매팅
npm run lint        # ESLint 검사
npm run format:check # Prettier 포매팅 확인
```

### 2. 통합 린팅 스크립트 (lint-all.bat)

Windows에서 Python과 JavaScript 린팅을 한 번에 실행할 수 있는 배치 파일이 제공됩니다.

#### 사용법
```bash
# 프로젝트 루트에서 실행
scripts\lint-all.bat
```

#### 실행 순서
스크립트는 다음 순서로 실행됩니다:

1. **[1/5] Python linting check and auto-fix**: `ruff check --fix server/`
2. **[2/5] Python formatting**: `ruff format server/`
3. **[3/5] Mypy type checking**: `mypy server/` 또는 `python -m mypy server/` (mypy가 설치되어 있는 경우)
4. **[4/5] JavaScript linting check and auto-fix**: `npm run lint:fix` (UI 폴더에서)
5. **[5/5] JavaScript formatting**: `npm run format` (UI 폴더에서)

> **참고**: `lint-all.bat`는 JavaScript 포매팅 확인(`format:check`)을 실행하지 않습니다. 수동으로 확인하려면 `cd UI && npm run format:check`를 실행하세요.

### 3. 자동 실행 (Git Pre-commit Hook)

커밋 전에 자동으로 JavaScript 린팅 검사를 실행합니다.

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
   # 자동으로 Python과 JavaScript 린팅 검사가 실행됩니다
   ```

#### Hook 비활성화 (필요시)

```bash
# 임시로 비활성화
mv .git/hooks/pre-commit .git/hooks/pre-commit.disabled

# 다시 활성화
mv .git/hooks/pre-commit.disabled .git/hooks/pre-commit
```

### 4. VS Code / Cursor 설정 (선택사항)

`.vscode/tasks.json` 파일을 생성하여 작업으로 등록할 수 있습니다:

```json
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "Lint JavaScript",
            "type": "shell",
            "command": "npm",
            "args": ["run", "lint:fix"],
            "options": {
                "cwd": "${workspaceFolder}/UI"
            },
            "problemMatcher": [],
            "group": {
                "kind": "test",
                "isDefault": false
            }
        },
        {
            "label": "Format JavaScript",
            "type": "shell",
            "command": "npm",
            "args": ["run", "format"],
            "options": {
                "cwd": "${workspaceFolder}/UI"
            },
            "problemMatcher": [],
            "group": {
                "kind": "test",
                "isDefault": false
            }
        }
    ]
}
```

단축키 `Ctrl+Shift+P` → "Tasks: Run Task" → "Lint JavaScript" 또는 "Format JavaScript" 선택

### 실행되는 명령어

Pre-commit hook은 다음 순서로 실행됩니다:

1. **ESLint 자동 수정**: `npm run lint:fix`
2. **Prettier 포매팅**: `npm run format`
3. **ESLint 검사**: `npm run lint`
4. **Prettier 포매팅 확인**: `npm run format:check`

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

스크립트는 자동으로 `npm`을 찾습니다 (Windows에서는 `npm.cmd` 사용). 만약 찾지 못한다면:

1. **npm 설치 확인**
   ```bash
   npm --version
   ```

2. **node_modules 확인**
   ```bash
   # UI 디렉토리로 이동
   cd UI
   
   # 의존성 설치
   npm install
   ```

3. **수동 실행**
   ```bash
   cd UI
   npm run lint:fix
   npm run format
   npm run lint
   npm run format:check
   ```

자세한 내용은 [GitHub Desktop Hooks 가이드](../lint/github-desktop-hooks.md)를 참고하세요.

## 문제 해결

### 일반적인 문제

#### 사용하지 않는 변수 경고

```javascript
// 경고 발생
const unusedVar = 'test';

// 해결 방법 1: 변수 제거
// 해결 방법 2: _ 접두사 사용 (경고 무시)
const _unusedVar = 'test';
```

#### 긴 라인 처리

기본적으로 라인 길이는 120자로 설정되어 있습니다. 특정 라인에서 무시하려면:

```javascript
// eslint-disable-next-line max-len
const veryLongLine = 'This is a very long line that exceeds 120 characters...';

// 또는 파일 전체에서 무시
/* eslint-disable max-len */
```

#### 특정 파일/폴더 제외

`.eslintignore` 파일에 제외할 경로를 추가하세요:

```
# 예시
node_modules/
dist/
*.config.js
```

### 첫 실행 가이드

#### 1. 개발 의존성 설치 확인

```bash
# UI 디렉토리로 이동
cd UI

# 의존성 설치
npm install
```

#### 2. 린팅 실행 순서

```bash
cd UI

# 1단계: 자동 수정 가능한 문제 수정
npm run lint:fix

# 2단계: 코드 포매팅
npm run format

# 3단계: 남은 문제 확인
npm run lint

# 4단계: 포매팅 확인
npm run format:check
```

#### 3. 문제 해결

- **ESLint 에러**: `npm run lint:fix`로 자동 수정 시도
- **포매팅 문제**: `npm run format`로 자동 포매팅
- **특정 파일 제외**: `.eslintignore` 파일에 경로 추가
- **전역 변수 인식 문제**: `.eslintrc.json`의 `globals` 섹션에 추가

## 참고 자료

- [ESLint 공식 문서](https://eslint.org/)
- [Prettier 공식 문서](https://prettier.io/)
- [ESLint 규칙 목록](https://eslint.org/docs/latest/rules/)
- [Prettier 옵션](https://prettier.io/docs/en/options.html)

## 기여 전 체크리스트

JavaScript 코드를 기여하기 전에 다음을 확인하세요:

- [ ] `cd UI && npm install` 실행하여 의존성 설치 (최초 1회만)
- [ ] `cd UI && npm run lint:fix` 실행하여 자동 수정 가능한 문제 해결
- [ ] `cd UI && npm run format` 실행하여 코드 포매팅
- [ ] `cd UI && npm run lint` 실행하여 남은 문제가 없는지 확인
- [ ] `cd UI && npm run format:check` 실행하여 포매팅이 올바른지 확인

> **참고**: Pre-commit hook이 활성화되어 있으면 커밋 시 자동으로 린팅 검사가 실행됩니다. 하지만 커밋 전에 수동으로 확인하는 것을 권장합니다.

