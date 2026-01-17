# 데이터베이스 구조 문서

이 폴더에는 AutoScript 프로젝트의 데이터베이스 구조에 대한 상세 문서가 포함되어 있습니다.

## 문서 목록

- **[데이터베이스 스키마](schema.md)**: 현재 사용 중인 데이터베이스 스키마 (통합)
- **[리포지토리 구조](repositories.md)**: 데이터베이스 접근 계층 구조
- **[연결 관리](connection.md)**: 데이터베이스 연결 관리 방식
- **[노드 실행 로그 시스템](node_execution_logs.md)**: 노드 실행 로그 시스템 아키텍처 및 사용법

## 데이터베이스 파일

- **위치**: `server/db/workflows.db`
- **타입**: SQLite 3
- **인코딩**: UTF-8

## 빠른 시작

### 데이터베이스 초기화

```python
from server.db.database import DatabaseManager

# 데이터베이스 초기화 (테이블 생성)
db = DatabaseManager()
```

### 예시 데이터 생성

```python
from server.db.database import DatabaseManager
import logging

logger = logging.getLogger(__name__)
db = DatabaseManager()
db.seed_example_data(logger)
```

## 주요 테이블

### 부모 테이블
1. **scripts**: 워크플로우(스크립트) 정보 (활성화 상태 포함) - **메인 부모 테이블**

### 자식 테이블 (외래키로 `scripts` 참조)
2. **nodes**: 노드 정보 및 연결 관계 (`script_id` → `scripts.id`)
3. **node_execution_logs**: 노드 실행 로그 (`script_id` → `scripts.id`)
4. **script_executions**: 스크립트 실행 기록 (`script_id` → `scripts.id`)
5. **script_tags**: 스크립트-태그 관계 (`script_id` → `scripts.id`, `tag_id` → `tags.id`)

### 독립 테이블
6. **tags**: 태그 정보 (독립, `script_tags`를 통해 `scripts`와 연결)
7. **user_settings**: 사용자 설정 (키-값 쌍, 다중 사용자 지원)
8. **dashboard_stats**: 대시보드 통계 데이터
9. **log_stats**: 로그 통계 데이터 (실행 기록 페이지 통계)

### 외래키 구조
- **부모 → 자식**: `scripts` (부모) → `nodes`, `node_execution_logs`, `script_executions`, `script_tags` (자식)
- **CASCADE DELETE**: 부모 레코드 삭제 시 자식 레코드도 자동 삭제
- **외래키 제약조건**: 모든 연결에서 자동 활성화 (`PRAGMA foreign_keys = ON`)

## 주요 뷰

1. **script_stats**: 스크립트 통계 집계 뷰 (대시보드용)

## 빠른 시작

### 데이터베이스 초기화

```python
from server.db.database import DatabaseManager

# 데이터베이스 초기화 (테이블 생성 및 마이그레이션)
db = DatabaseManager()
db.init_database()  # 테이블 생성 및 마이그레이션 실행
```

> **참고**: 실제 서버 실행 시에는 `main.py`의 `startup_event`에서 자동으로 `init_database()`가 호출됩니다.

### 스크립트 생성 및 조회

```python
# 스크립트 생성
script_id = db.create_script("테스트 스크립트", "설명")

# 스크립트 조회
script = db.get_script(script_id)
```

자세한 내용은 각 문서를 참고하세요.

