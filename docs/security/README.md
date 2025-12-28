# 보안 가이드

이 문서는 AutoScript 프로젝트의 보안 취약점과 개선 방안을 설명합니다.

## 발견된 보안 취약점

### 🔴 높은 위험도

#### 1. CORS 설정이 너무 개방적
**위치**: `server/main.py:109`
```python
allow_origins=["*"],  # 모든 오리진 허용
```

**문제점**:
- 프로덕션 환경에서 모든 도메인에서 API 접근 가능
- CSRF 공격에 취약

**개선 방안**:
```python
# 프로덕션 환경에서는 특정 도메인만 허용
allow_origins=[
    "http://localhost:8000",
    "https://yourdomain.com"
] if ENVIRONMENT == "prd" else ["*"]
```

#### 2. 인증/인가 메커니즘 없음
**위치**: 모든 API 엔드포인트

**문제점**:
- 누구나 API에 접근하여 워크플로우 실행, 수정, 삭제 가능
- 민감한 데이터에 무단 접근 가능

**개선 방안**:
- JWT 토큰 기반 인증 구현
- API 키 또는 세션 기반 인증
- 역할 기반 접근 제어 (RBAC) 구현

#### 3. HTTP API 요청 노드의 URL 검증 부족
**참고**: 현재 HTTP API 요청 노드는 구현되지 않았습니다. 향후 구현 시 다음 사항을 고려해야 합니다.

**예상 문제점**:
- SSRF (Server-Side Request Forgery) 공격 가능
- 내부 네트워크에 접근 가능 (예: `http://localhost`, `http://127.0.0.1`)

**개선 방안** (향후 구현 시):
```python
# 허용된 도메인 화이트리스트
ALLOWED_DOMAINS = ["api.example.com", "external-api.com"]

# URL 검증
if not any(url.startswith(f"https://{domain}") for domain in ALLOWED_DOMAINS):
    return create_failed_result(...)
```

### 🟡 중간 위험도

#### 4. XSS (Cross-Site Scripting) 취약점
**위치**: `UI/src` - `innerHTML` 사용

**문제점**:
- `innerHTML`을 통한 동적 HTML 삽입 시 스크립트 실행 가능
- `escapeHtml` 함수 사용하지만 모든 곳에서 일관되게 사용되지 않을 수 있음

**개선 방안**:
- 가능한 한 `textContent` 사용
- `innerHTML` 사용 시 반드시 `escapeHtml` 적용
- Content Security Policy (CSP) 헤더 추가

#### 5. 환경 변수 노출
**위치**: `server/main.py:145-158`

**문제점**:
- HTML에 환경 변수를 주입하여 클라이언트에 노출
- 민감한 정보가 포함될 수 있음

**개선 방안**:
- 클라이언트에 필요한 최소한의 정보만 주입
- 민감한 정보는 서버에서만 관리

#### 6. 입력 검증 부족
**위치**: API 엔드포인트 전반

**문제점**:
- 사용자 입력에 대한 충분한 검증이 없을 수 있음
- SQL 인젝션, 명령어 인젝션 가능성

**개선 방안**:
- Pydantic 모델을 사용한 입력 검증 강화
- 파일 경로, SQL 쿼리 등에 대한 화이트리스트 검증

### 🟢 낮은 위험도

#### 7. 서버 접근 제어
**위치**: `server/config/server_config.py:18`

**현재 상태**: ✅ **해결됨**
- 기본값이 `127.0.0.1`로 설정되어 로컬호스트에서만 접근 가능
- 내부망에서 접근 불가능하도록 설정됨

**설정 방법**:
```python
# server/config/server_config.py
API_HOST: str = os.getenv("API_HOST", "127.0.0.1")  # 로컬호스트만 접근 가능
```

**주의사항**:
- `.env` 파일에서 `API_HOST=0.0.0.0`으로 설정하면 모든 네트워크 인터페이스에서 접근 가능해집니다.
- 내부망 접근을 차단하려면 기본값(`127.0.0.1`)을 사용하거나 `.env` 파일에 `API_HOST=127.0.0.1`을 명시하세요.

#### 8. 의존성 취약점
**위치**: `server/requirements.txt`

**문제점**:
- 오래된 패키지 버전 사용 시 알려진 취약점 존재 가능

**개선 방안**:
- 정기적으로 `pip-audit` 또는 `safety`로 의존성 검사
- 패키지 업데이트 시 보안 패치 확인

#### 9. 정적 파일 서빙 경로 검증
**위치**: `server/main.py:126`

**문제점**:
- 경로 조작 공격 가능성 (Path Traversal)

**개선 방안**:
- FastAPI의 `StaticFiles`는 기본적으로 경로 검증을 하지만, 추가 검증 권장

## 보안 개선 체크리스트

### 즉시 개선 필요

- [ ] CORS 설정을 환경별로 분리 (개발/프로덕션)
- [ ] 인증/인가 메커니즘 구현
- [ ] HTTP API 요청 노드에 URL 화이트리스트 추가
- [ ] Content Security Policy (CSP) 헤더 추가

### 단기 개선 (1-2주)

- [ ] 모든 `innerHTML` 사용처에 `escapeHtml` 적용 확인
- [ ] 입력 검증 강화 (Pydantic 모델 사용)
- [ ] 환경 변수 주입 최소화
- [ ] 의존성 취약점 스캔 도구 도입

### 장기 개선 (1-3개월)

- [ ] 역할 기반 접근 제어 (RBAC) 구현
- [ ] API Rate Limiting 구현
- [ ] 로깅 및 모니터링 시스템 구축
- [ ] 정기적인 보안 감사

## 보안 모범 사례

### 1. 입력 검증
```python
from pydantic import BaseModel, HttpUrl, validator

class HttpApiRequestParams(BaseModel):
    url: HttpUrl  # URL 자동 검증
    method: str = "GET"
    
    @validator('method')
    def validate_method(cls, v):
        allowed = ['GET', 'POST', 'PUT', 'DELETE']
        if v.upper() not in allowed:
            raise ValueError(f'Method must be one of {allowed}')
        return v.upper()
```

### 2. XSS 방지
```javascript
// ❌ 나쁜 예
element.innerHTML = userInput;

// ✅ 좋은 예
element.textContent = userInput;
// 또는
element.innerHTML = escapeHtml(userInput);
```

### 3. 인증 구현 예시
```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    # 토큰 검증 로직
    if not is_valid_token(token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    return token

@router.post("/api/scripts/save")
async def save_script(token: str = Depends(verify_token)):
    # 인증된 사용자만 접근 가능
    ...
```

### 4. CSP 헤더 추가
```python
from fastapi.middleware.trustedhost import TrustedHostMiddleware

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline'"
    )
    return response
```

## 구체적인 해결 방안

4가지 보안 취약점에 대한 상세한 해결 방안은 [보안 취약점 해결 방안](fixes.md) 문서를 참고하세요:

1. **환경 변수 노출 해결**: 클라이언트에 필요한 최소한의 정보만 주입
2. **입력 검증 강화**: Pydantic 모델을 사용한 입력 검증
3. **의존성 취약점 스캔**: pip-audit를 사용한 정기적인 스캔
4. **정적 파일 서빙 경로 검증**: 경로 조작 공격 방지 미들웨어

## 참고 자료

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [보안 취약점 해결 방안](fixes.md): 구체적인 구현 가이드

## 보안 이슈 신고

보안 취약점을 발견하셨다면, 이슈를 생성하지 마시고 직접 연락해주세요.

