# 스크립트 및 노드 패키징 가이드

**최신 수정일자: 2026-01-08**

## 목차

1. [개요](#개요)
2. [스크립트 패키징](#스크립트-패키징)
3. [스크립트 설치](#스크립트-설치)
4. [노드 패키징](#노드-패키징)
5. [노드 설치](#노드-설치)
6. [FAQ](#faq)

---

## 개요

AutoScript는 워크플로우(스크립트)와 커스텀 노드를 파일로 패키징하여 공유할 수 있는 시스템을 제공합니다.

### 패키징 시스템의 장점

- **간편한 공유**: ZIP 파일 하나로 모든 정보 포함
- **버전 관리**: 메타데이터에 버전 정보 포함
- **의존성 관리**: 필요한 커스텀 노드 목록 자동 감지
- **자동 설치**: 특정 폴더에 파일을 넣으면 자동으로 로드

### 패키지 형식

- **스크립트 패키지**: `.asscript.zip` (구현됨)
- **노드 패키지**: `.asnode.zip` (구현됨)

---

## 스크립트 패키징

### 1. 스크립트 패키징 개요

데이터베이스에 저장된 워크플로우(스크립트)를 ZIP 파일로 내보내어 다른 사용자와 공유할 수 있습니다.

### 2. 패키징 방법

#### 방법 1: 배치 파일 사용 (권장)

```bash
# 기본 사용 (exports/ 폴더에 저장)
scripts\package-script.bat 1

# 출력 디렉토리 지정
scripts\package-script.bat 1 "C:\output"
```

#### 방법 2: Python 스크립트 직접 실행

```bash
# 가상환경 활성화 후
python scripts/package-script.py 1

# 출력 디렉토리 지정
python scripts/package-script.py 1 -o "C:\output"
```

### 3. 패키징 과정

스크립트 패키징 시 다음 작업이 자동으로 수행됩니다:

1. **데이터베이스에서 스크립트 조회**
   - 스크립트 기본 정보 (이름, 설명 등)
   - 노드 목록
   - 연결 정보

2. **필요한 노드 감지**
   - 표준 노드가 아닌 커스텀 노드 자동 감지
   - `required_nodes` 목록에 추가

3. **패키지 구조 생성**
   ```
   {스크립트명}.asscript.zip
   ├── script.json          # 스크립트 데이터 (메타데이터, 노드, 연결)
   └── README.md            # 스크립트 설명 및 필요한 노드 목록
   ```

4. **ZIP 파일 생성**
   - `exports/` 폴더에 저장 (기본값)
   - 파일명: `{스크립트명}.asscript.zip`

### 4. 패키지 구조

#### script.json 구조

```json
{
  "version": "1.0.0",
  "format": "autoscript-script",
  "metadata": {
    "name": "로그인 자동화",
    "description": "사용자 로그인 프로세스를 자동화합니다",
    "author": "AutoScript User",
    "version": "1.0.0",
    "created_at": "2025-01-07T10:00:00Z",
    "tags": [],
    "node_count": 5,
    "required_nodes": ["my-custom-node"]
  },
  "script": {
    "id": null,
    "name": "로그인 자동화",
    "description": "사용자 로그인 프로세스를 자동화합니다",
    "active": true,
    "execution_order": null
  },
  "nodes": [
    {
      "id": "start",
      "type": "start",
      "position": {"x": 100, "y": 100},
      "parameters": {},
      "data": {}
    }
  ],
  "connections": [
    {
      "from": "start",
      "to": "node1",
      "outputType": "default"
    }
  ]
}
```

### 5. 필요한 노드 감지

패키징 시 스크립트에 사용된 노드 중 표준 노드가 아닌 커스텀 노드를 자동으로 감지합니다.

**표준 노드**: `server/config/nodes_config.py`에 정의된 노드
- `start`, `end`, `image-touch`, `wait`, `condition` 등

**커스텀 노드**: 표준 노드가 아닌 모든 노드 타입
- `my-custom-node`, `another-custom-node` 등

### 6. 예제

```bash
# 스크립트 ID 1을 패키징
scripts\package-script.bat 1

# 출력:
# [패키징 시작] 스크립트 ID: 1
# [패키징 완료] 파일 경로: C:\Users\User\Desktop\python\AutoScript\exports\로그인_자동화.asscript.zip
# ✅ 스크립트 패키징이 완료되었습니다.
```

---

## 스크립트 설치

### 1. 스크립트 설치 개요

패키징된 스크립트 ZIP 파일을 데이터베이스에 설치하여 사용할 수 있습니다.

### 2. 설치 방법

#### 방법 1: 배치 파일 사용 (권장)

```bash
# shared-scripts/ 폴더의 모든 ZIP 파일 설치
scripts\install-script.bat

# 특정 ZIP 파일 설치
scripts\install-script.bat "shared-scripts\로그인_자동화.asscript.zip"

# 다른 폴더 지정
scripts\install-script.bat -f "C:\my-scripts"
```

#### 방법 2: Python 스크립트 직접 실행

```bash
# 가상환경 활성화 후
# 폴더의 모든 파일 설치
python scripts/install-script.py

# 특정 파일 설치
python scripts/install-script.py "shared-scripts/로그인_자동화.asscript.zip"

# 다른 폴더 지정
python scripts/install-script.py -f "C:\my-scripts"
```

### 3. 설치 과정

스크립트 설치 시 다음 작업이 자동으로 수행됩니다:

1. **ZIP 파일 검증**
   - 유효한 ZIP 파일인지 확인
   - `script.json` 파일 존재 확인

2. **스크립트 데이터 검증**
   - 필수 필드 확인
   - 형식 검증 (`autoscript-script`)
   - 노드 및 연결 데이터 유효성 확인

3. **필요한 노드 확인**
   - `required_nodes` 목록 확인
   - 누락된 노드가 있으면 경고 표시

4. **중복 확인**
   - 같은 이름의 스크립트가 이미 있는지 확인
   - 중복 시 건너뛰기 (기본값) 또는 에러 발생

5. **데이터베이스에 저장**
   - 스크립트 생성
   - 노드 및 연결 정보 저장
   - 활성 상태 설정

### 4. 설치 폴더 구조

```
{프로젝트 루트}/
  shared-scripts/          # 공유 스크립트 폴더 (자동 감지)
    ├── 로그인_자동화.asscript.zip
    ├── 데이터_처리.asscript.zip
    └── ...
```

### 5. 중복 처리 옵션

기본적으로 중복 스크립트는 건너뜁니다. 덮어쓰려면:

```bash
# 중복 스크립트도 덮어쓰기
python scripts/install-script.py --no-skip-duplicate
```

### 6. 예제

```bash
# shared-scripts/ 폴더의 모든 ZIP 파일 설치
scripts\install-script.bat

# 출력:
# [설치 시작] 2개의 ZIP 파일 발견
# 
# [처리 중] 로그인_자동화.asscript.zip
#   ✅ 스크립트 '로그인 자동화'가 성공적으로 설치되었습니다.
# 
# [처리 중] 데이터_처리.asscript.zip
#   ✅ 스크립트 '데이터 처리'가 성공적으로 설치되었습니다.
# 
# [설치 완료]
#   ✅ 성공: 2개
#   ⏭️  건너뜀: 0개
#   ❌ 실패: 0개
```

### 7. 필요한 노드 누락 시

필요한 커스텀 노드가 설치되지 않은 경우:

```
⚠️  다음 노드가 설치되지 않았습니다: my-custom-node, another-custom-node
```

스크립트는 설치되지만, 누락된 노드가 있어 실행 시 오류가 발생할 수 있습니다.

---

## 노드 패키징

### 1. 노드 패키징 개요

커스텀 노드를 ZIP 파일로 내보내어 다른 사용자와 공유할 수 있습니다. 노드의 Python 파일, JavaScript 파일, 설정 정보가 모두 포함됩니다.

### 2. 패키징 방법

#### 방법 1: 배치 파일 사용 (권장)

```bash
# 기본 사용 (exports/ 폴더에 저장)
scripts\package-node.bat test-node

# 출력 디렉토리 지정
scripts\package-node.bat test-node "C:\output"

# 노드 목록 보기
scripts\package-node.bat
```

#### 방법 2: Python 스크립트 직접 실행

```bash
# 기본 사용
python scripts/package/package-node.py test-node

# 출력 디렉토리 지정
python scripts/package/package-node.py test-node -o "C:\output"

# 노드 목록 보기
python scripts/package/package-node.py --list
```

### 3. 패키지 구조

```
{노드명}.asnode.zip
├── manifest.json              # 노드 패키지 메타데이터 (필수)
├── node_config.json           # 노드 설정 (필수)
├── server/                    # 서버 측 파일 (Python 노드인 경우)
│   └── {node_name}.py        # Python 구현 파일
├── client/                    # 클라이언트 측 파일
│   └── node-{node_name}.js   # JavaScript 렌더링 파일
└── README.md                  # 노드 설명 (선택적)
```

### 4. 패키징 동작 흐름

1. **노드 확인**: `nodes_config.py`에서 노드 설정 확인
2. **파일 찾기**: Python 파일과 JavaScript 파일 자동 검색
3. **메타데이터 생성**: 노드 정보를 기반으로 `manifest.json` 생성
4. **설정 추출**: `node_config.json` 생성
5. **ZIP 파일 생성**: 모든 파일을 압축하여 `exports/` 폴더에 저장

### 5. 패키징 폴더 구조

```
{프로젝트 루트}/
  exports/                     # 패키징된 노드 저장 폴더 (자동 생성)
    ├── test-node.asnode.zip
    ├── my-custom-node.asnode.zip
    └── ...
```

---

## 노드 설치

### 1. 노드 설치 개요

ZIP 파일에서 노드를 자동으로 설치하여 시스템에 추가할 수 있습니다. Python 파일, JavaScript 파일, 설정 정보가 자동으로 복사되고 등록됩니다.

### 2. 설치 방법

#### 방법 1: 배치 파일 사용 (권장)

```bash
# shared-nodes/ 폴더의 모든 ZIP 파일 설치
scripts\install-node.bat

# 특정 ZIP 파일 설치
scripts\install-node.bat exports\test-node.asnode.zip

# 기존 노드 덮어쓰기
scripts\install-node.bat --no-skip-duplicate
```

#### 방법 2: Python 스크립트 직접 실행

```bash
# shared-nodes/ 폴더 스캔
python scripts/package/install-node.py

# 특정 ZIP 파일 설치
python scripts/package/install-node.py exports\test-node.asnode.zip

# 기존 노드 덮어쓰기
python scripts/package/install-node.py --no-skip-duplicate

# 다른 폴더 스캔
python scripts/package/install-node.py -f "C:\custom\nodes"
```

### 3. 설치 동작 흐름

1. **ZIP 파일 검증**: `manifest.json`과 `node_config.json` 확인
2. **중복 확인**: 같은 타입의 노드가 이미 있는지 확인
3. **파일 복사**:
   - Python 파일: `server/nodes/{category}/{node_name}.py`
   - JavaScript 파일: `UI/src/js/components/node/node-{node_name}.js`
4. **설정 추가**: `nodes_config.py`에 노드 설정 추가
5. **완료**: 서버 재시작 후 노드 사용 가능

### 4. 설치 폴더 구조

```
{프로젝트 루트}/
  shared-nodes/                # 설치할 노드 ZIP 파일 저장 폴더 (자동 생성)
    ├── test-node.asnode.zip
    ├── my-custom-node.asnode.zip
    └── ...
```

### 5. 중복 처리 옵션

기본적으로 중복 노드는 건너뜁니다. 덮어쓰려면:

```bash
# 중복 노드도 덮어쓰기
scripts\install-node.bat --no-skip-duplicate
```

### 6. 예제

```bash
# shared-nodes/ 폴더의 모든 ZIP 파일 설치
scripts\install-node.bat

# 출력:
# [Installation] Found 1 ZIP file(s)
# 
# [Processing] test-node.asnode.zip
#   [OK] Copied server file: ...\server\nodes\actionnodes\test_node.py
#   [OK] Copied client file: ...\UI\src\js\components\node\node-test-node.js
#   [OK] Added to nodes_config.py
#   [OK] Node 'test-node' installed successfully.
# 
# ============================================================
# [Installation Summary]
#   [OK] Success: 1
#   [SKIP] Skipped: 0
#   [ERROR] Failed: 0
# ============================================================
```

---

## FAQ

### 노드 패키징 관련

### Q1: 노드를 패키징했는데 파일을 찾을 수 없다고 나옵니다.

**A**: 노드가 `nodes_config.py`에 등록되어 있어야 합니다. `scripts/nodes/create-node.py` 스크립트로 생성한 노드는 자동으로 등록됩니다.

### Q2: 노드를 설치했는데 서버에서 인식하지 못합니다.

**A**: 서버를 재시작해야 합니다. 노드 파일과 설정이 추가되었지만, 서버는 시작 시에만 노드를 로드합니다.

### Q3: 기존 노드를 덮어쓰고 싶습니다.

**A**: `--no-skip-duplicate` 옵션을 사용하세요:
```bash
scripts\install-node.bat --no-skip-duplicate
```

### Q4: exports/ 폴더가 없어도 되나요?

**A**: 패키징 시 자동으로 생성됩니다. 없어도 문제없습니다.

### Q5: shared-nodes/ 폴더가 없어도 되나요?

**A**: 설치 시 자동으로 생성됩니다. 없어도 문제없습니다.

### 스크립트 패키징 관련

### Q6: 스크립트를 패키징했는데 필요한 노드가 없다고 나옵니다.

**A**: 스크립트에 사용된 커스텀 노드가 설치되어 있지 않습니다. 먼저 필요한 노드를 설치한 후 스크립트를 사용하세요.

### Q7: 같은 이름의 스크립트가 이미 있는데 설치할 수 있나요?

**A**: 기본적으로 중복 스크립트는 건너뜁니다. 덮어쓰려면 `--no-skip-duplicate` 옵션을 사용하세요. (주의: 기존 스크립트가 삭제됩니다)

### Q8: 패키징된 스크립트를 다른 컴퓨터에서 사용할 수 있나요?

**A**: 네, 가능합니다. ZIP 파일을 복사하여 `shared-scripts/` 폴더에 넣고 설치 스크립트를 실행하세요.

### Q9: 패키징된 스크립트의 버전을 업데이트하려면?

**A**: 스크립트를 수정한 후 다시 패키징하세요. 메타데이터의 `version` 필드가 자동으로 업데이트됩니다.

### Q10: 패키징된 스크립트에 포함된 노드 데이터는 무엇인가요?

**A**: 스크립트 패키지에는 노드의 구조와 연결 정보만 포함됩니다. 노드의 실행 코드는 포함되지 않으므로, 필요한 커스텀 노드는 별도로 설치해야 합니다.

### Q11: 패키징된 스크립트를 수정할 수 있나요?

**A**: ZIP 파일을 압축 해제하여 `script.json`을 수정한 후 다시 압축할 수 있습니다. 하지만 권장하지 않습니다. 원본 스크립트를 수정한 후 다시 패키징하는 것이 좋습니다.

---

## 관련 문서

- [스크립트 공유 시스템 설계](todo/03-script-sharing.md)
- [노드 생성 가이드](nodes/creating-nodes.md)
- [워크플로우 구조](workflow-structure.md)

---

## 문제 해결

### 패키징 실패

1. **스크립트 ID가 존재하지 않음**
   ```
   ValueError: 스크립트 ID 999를 찾을 수 없습니다.
   ```
   → 올바른 스크립트 ID를 확인하세요.

2. **데이터베이스 연결 실패**
   ```
   sqlite3.OperationalError: unable to open database file
   ```
   → 데이터베이스 파일 경로를 확인하세요. (`server/db/workflows.db`)

### 설치 실패

1. **ZIP 파일 형식 오류**
   ```
   ValueError: ZIP 파일에 'script.json'이 없습니다.
   ```
   → 올바른 스크립트 패키지 파일인지 확인하세요.

2. **스크립트 데이터 검증 실패**
   ```
   ValueError: 스크립트 데이터 검증 실패: 필수 필드 'nodes'가 없습니다.
   ```
   → 패키지 파일이 손상되었을 수 있습니다. 다시 패키징하세요.

3. **중복 스크립트**
   ```
   ValueError: 스크립트 '로그인 자동화'가 이미 존재합니다.
   ```
   → `--no-skip-duplicate` 옵션을 사용하거나, 기존 스크립트를 삭제하세요.

---

## 참고

- 스크립트 패키징 스크립트: `scripts/package-script.py`
- 스크립트 설치 스크립트: `scripts/install-script.py`
- 배치 파일: `scripts/package-script.bat`, `scripts/install-script.bat`
