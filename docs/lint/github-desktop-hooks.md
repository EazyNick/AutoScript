# GitHub Desktop에서 Git Hooks 메시지 확인하기

## 개요

GitHub Desktop은 GUI 애플리케이션이므로 Git hooks의 출력 메시지를 직접 표시하지 않을 수 있습니다. 하지만 hook이 실패하면 에러 메시지가 표시됩니다.

## 메시지 확인 방법

### 1. 성공 시 (린팅 통과)

- **메시지 표시**: 일반적으로 메시지가 표시되지 않고 조용히 통과합니다
- **커밋 진행**: 커밋이 정상적으로 완료됩니다
- **확인 방법**: 커밋이 성공적으로 완료되면 린팅이 통과한 것입니다

### 2. 실패 시 (린팅 실패)

GitHub Desktop에서 hook이 실패하면:

1. **에러 다이얼로그 표시**
   - GitHub Desktop 하단에 빨간색 에러 메시지가 표시됩니다
   - "Commit failed" 또는 유사한 메시지가 나타납니다

2. **에러 메시지 내용**
   
   Python 린팅 실패 시:
   ```
   ========================================
   ✗ Python 린팅 검사 실패!
   ========================================
   
   커밋이 취소되었습니다.
   
   문제를 수정한 후 다시 커밋해주세요.
   
   --- 해결 방법 ---
   1. 터미널에서 다음 명령어를 실행하여 자세한 에러를 확인하세요:
      python scripts/linting/lint.py
   
   2. 문제를 수정한 후 다시 커밋하세요.
   ```
   
   JavaScript 린팅 실패 시:
   ```
   ========================================
   ✗ JavaScript 린팅 검사 실패!
   ========================================
   
   커밋이 취소되었습니다.
   
   문제를 수정한 후 다시 커밋해주세요.
   
   --- 해결 방법 ---
   1. 터미널에서 다음 명령어를 실행하여 자세한 에러를 확인하세요:
      python scripts/linting/lint-js.py
   
   2. 또는 UI 디렉토리에서 직접 실행:
      cd UI
      npm run lint:fix
      npm run format
      npm run lint
      npm run format:check
   
   3. 문제를 수정한 후 다시 커밋하세요.
   ```

3. **커밋 취소**
   - 커밋이 자동으로 취소됩니다
   - 변경사항은 staged 상태로 유지됩니다

### 3. 상세 메시지 확인 (터미널)

GitHub Desktop에서 메시지를 자세히 보려면:

#### 방법 1: 터미널에서 직접 실행
```bash
# 프로젝트 루트로 이동
cd C:\Users\User\Desktop\python\AutoScript

# 린팅 스크립트 실행
python scripts/linting/lint.py
```

#### 방법 2: Git Bash에서 커밋
```bash
# Git Bash 열기
# 프로젝트 루트로 이동
cd /c/Users/User/Desktop/python/AutoScript

# 커밋 (메시지가 터미널에 표시됨)
git commit -m "your message"
```

#### 방법 3: PowerShell에서 커밋
```powershell
# PowerShell 열기
cd C:\Users\User\Desktop\python\AutoScript

# 커밋 (메시지가 터미널에 표시됨)
git commit -m "your message"
```

## GitHub Desktop에서 Hook 동작 확인

### 커밋 시나리오

1. **커밋 버튼 클릭**
   - GitHub Desktop에서 "Commit to main" 버튼 클릭

2. **Hook 실행**
   - Pre-commit hook이 자동으로 실행됩니다
   - 린팅 검사가 진행됩니다 (보통 5-10초 소요)

3. **결과**
   - **성공**: 커밋이 완료되고 히스토리에 표시됩니다
   - **실패**: 에러 메시지가 표시되고 커밋이 취소됩니다

### Hook 비활성화 (비권장)

긴급한 경우에만 hook을 건너뛸 수 있습니다:

```bash
# 터미널에서 커밋 (hook 건너뛰기)
git commit --no-verify -m "your message"
```

⚠️ **주의**: 린팅을 건너뛰면 코드 품질 문제가 커밋될 수 있습니다.

## 문제 해결

### Hook이 실행되지 않는 경우

1. **권한 확인**
   ```bash
   # Windows (Git Bash)
   ls -la .git/hooks/pre-commit
   
   # 실행 권한이 있어야 합니다
   chmod +x .git/hooks/pre-commit
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

### 린팅 실패 시

1. **에러 메시지 확인**
   - GitHub Desktop 하단에 표시되는 에러 메시지 확인
   - Python 또는 JavaScript 중 어느 부분에서 실패했는지 확인
   - 터미널에서 다음 명령어를 실행하여 상세 내용 확인:
     ```bash
     # Python 린팅 상세 확인
     python scripts/linting/lint.py
     
     # JavaScript 린팅 상세 확인
     python scripts/linting/lint-js.py
     ```

2. **문제 수정**
   - 에러 메시지에 따라 코드 수정
   - 자동 수정이 안 되는 경우 수동으로 수정
   - Python: `ruff check --fix server/` 및 `ruff format server/`
   - JavaScript: `cd UI && npm run lint:fix && npm run format`

3. **다시 커밋**
   - 문제를 수정한 후 다시 커밋 시도
   - GitHub Desktop에서 "Commit to main" 버튼을 다시 클릭

## 참고

- Pre-commit hook은 커밋 전에만 실행됩니다
- 푸시 전 검사는 GitHub Actions 등을 사용하세요
- 자세한 린팅 설정은 `docs/dev/linting.md`를 참고하세요

