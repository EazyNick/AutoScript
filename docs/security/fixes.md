# 보안 취약점 해결 방안

이 문서는 보안 취약점에 대한 구체적인 해결 방안을 제공합니다.

> ✅ **완료**: 
> - 환경 변수 노출 문제는 이미 해결되었습니다. (`server/main.py`, `server/api/config_router.py`, `UI/src/js/utils/logger.js`)
> - 입력 검증 강화는 이미 해결되었습니다. (`server/models/action_models.py`, `server/api/action_router.py`)

## 1. 의존성 취약점 스캔

### 문제점
오래된 패키지 버전에 알려진 보안 취약점이 있을 수 있습니다.

### 해결 방안

#### 3.1 pip-audit 설치 및 실행

```bash
# pip-audit 설치
pip install pip-audit

# 취약점 스캔 실행
pip-audit -r server/requirements.txt

# 자동 수정 가능한 취약점 수정
pip-audit -r server/requirements.txt --fix
```

#### 3.2 safety 사용 (대안)

```bash
# safety 설치
pip install safety

# 취약점 스캔
safety check -r server/requirements.txt

# JSON 형식으로 출력
safety check -r server/requirements.txt --json
```

#### 3.3 CI/CD에 통합

**파일**: `.github/workflows/security-scan.yml` (새 파일)

```yaml
name: Security Scan

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]
  schedule:
    - cron: '0 0 * * 0'  # 매주 일요일

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.10'
      
      - name: Install pip-audit
        run: pip install pip-audit
      
      - name: Run security scan
        run: |
          pip-audit -r server/requirements.txt
          pip-audit -r server/requirements-dev.txt
```

#### 3.4 requirements.txt 업데이트 스크립트

**파일**: `scripts/security/check-dependencies.py` (새 파일)

```python
#!/usr/bin/env python3
"""
의존성 취약점 스캔 스크립트
"""

import subprocess
import sys
from pathlib import Path

def run_pip_audit(requirements_file: Path) -> bool:
    """pip-audit 실행"""
    print(f"스캔 중: {requirements_file}")
    try:
        result = subprocess.run(
            ["pip-audit", "-r", str(requirements_file)],
            capture_output=True,
            text=True,
            check=True
        )
        print(result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        print(f"취약점 발견: {e.stdout}")
        return False
    except FileNotFoundError:
        print("pip-audit가 설치되지 않았습니다. 'pip install pip-audit' 실행하세요.")
        return False

def main():
    project_root = Path(__file__).parent.parent.parent
    requirements_files = [
        project_root / "server" / "requirements.txt",
        project_root / "server" / "requirements-dev.txt"
    ]
    
    all_passed = True
    for req_file in requirements_files:
        if req_file.exists():
            if not run_pip_audit(req_file):
                all_passed = False
        else:
            print(f"파일을 찾을 수 없습니다: {req_file}")
    
    sys.exit(0 if all_passed else 1)

if __name__ == "__main__":
    main()
```

**사용법**:
```bash
python scripts/security/check-dependencies.py
```

---

## 2. 정적 파일 서빙 경로 검증

### 문제점
정적 파일 서빙 시 경로 조작 공격 가능성

### 해결 방안

**파일**: `server/main.py`

```python
from fastapi import Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import Response
import os

# 정적 파일 서빙 설정 (개발 환경)
ui_path = os.path.join(os.path.dirname(__file__), "..", "UI", "src")
if os.path.exists(ui_path):
    # 기본 StaticFiles는 경로 검증을 하지만, 추가 검증 미들웨어 추가
    static_files = StaticFiles(directory=ui_path)
    
    @app.middleware("http")
    async def validate_static_path(request: Request, call_next):
        """정적 파일 경로 검증 미들웨어"""
        if request.url.path.startswith("/static/"):
            # 경로 조작 공격 방지
            import urllib.parse
            
            # URL 디코딩
            decoded_path = urllib.parse.unquote(request.url.path)
            
            # 위험한 패턴 차단
            dangerous_patterns = [
                '..',  # 상위 디렉토리 접근
                '~',   # 홈 디렉토리
                '//',  # 절대 경로 시도
                '\\',  # Windows 경로 구분자
            ]
            
            for pattern in dangerous_patterns:
                if pattern in decoded_path:
                    logger.warning(f"위험한 경로 패턴 감지: {decoded_path}")
                    return Response(
                        content="Forbidden: Invalid path",
                        status_code=403
                    )
            
            # UI 디렉토리 외부 접근 차단
            requested_file = os.path.normpath(
                os.path.join(ui_path, decoded_path.replace("/static/", ""))
            )
            
            # 실제 파일이 UI 디렉토리 내에 있는지 확인
            if not requested_file.startswith(os.path.abspath(ui_path)):
                logger.warning(f"UI 디렉토리 외부 접근 시도: {requested_file}")
                return Response(
                    content="Forbidden: Access outside UI directory",
                    status_code=403
                )
        
        return await call_next(request)
    
    app.mount("/static", static_files, name="static")
    logger.info(f"정적 파일 서빙 활성화: {ui_path}")
else:
    logger.warning("UI 경로를 찾을 수 없습니다. API만 사용 가능합니다.")
```

**추가 보안 헤더**:

```python
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """보안 헤더 추가"""
    response = await call_next(request)
    
    # 정적 파일에 대한 보안 헤더
    if request.url.path.startswith("/static/"):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
    
    return response
```

---

## 구현 체크리스트

### 1. 의존성 취약점 스캔
- [ ] `pip-audit` 설치
- [ ] `scripts/security/check-dependencies.py` 스크립트 생성
- [ ] CI/CD에 보안 스캔 통합 (선택사항)
- [ ] 정기적인 스캔 실행 (주 1회 권장)

### 2. 정적 파일 서빙 경로 검증
- [ ] 경로 검증 미들웨어 추가
- [ ] 위험한 패턴 차단 로직 구현
- [ ] 보안 헤더 추가
- [ ] 테스트: `http://localhost:8000/static/../../server/main.py` 접근 시도

---

## 테스트 방법

### 1. 의존성 취약점 테스트
```bash
python scripts/security/check-dependencies.py
# 취약점이 없으면 exit code 0
```

### 2. 정적 파일 경로 검증 테스트
```bash
# 경로 조작 공격 시도
curl http://localhost:8000/static/../../server/main.py
# 403 Forbidden 반환되어야 함
```

---

## 참고 자료

- [Pydantic 문서](https://docs.pydantic.dev/)
- [pip-audit 문서](https://pypi.org/project/pip-audit/)
- [OWASP Path Traversal](https://owasp.org/www-community/attacks/Path_Traversal)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)

