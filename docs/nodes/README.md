# 노드 시스템 문서

이 폴더는 AutoScript의 노드 시스템에 대한 상세한 문서를 포함합니다.

## 문서 목록

- **[architecture.md](./architecture.md)**: 노드 시스템의 전체 아키텍처 구조 및 실행 흐름
- **[boundary-nodes.md](./boundary-nodes.md)**: 경계 노드 (시작 노드 등)
- **[image-nodes.md](./image-nodes.md)**: 이미지 노드 (이미지 터치)
- **[excel-nodes.md](./excel-nodes.md)**: 엑셀 노드 (엑셀 열기/닫기)
- **[condition-nodes.md](./condition-nodes.md)**: 조건 노드 (조건 평가)
- **[logic-nodes.md](./logic-nodes.md)**: 로직 노드 (반복 노드)
- **[wait-nodes.md](./wait-nodes.md)**: 대기 노드

## 노드 시스템 개요

AutoScript의 노드 시스템은 워크플로우를 구성하는 기본 단위입니다. 각 노드는 특정 작업을 수행하며, 노드들을 연결하여 복잡한 자동화 스크립트를 만들 수 있습니다.

### 주요 특징

- **표준화된 인터페이스**: 모든 노드는 `BaseNode`를 상속받아 `execute` 메서드를 구현합니다.
- **자동 핸들러 등록**: `NodeExecutor` 데코레이터를 통해 노드가 자동으로 시스템에 등록됩니다.
- **에러 처리**: 모든 노드 실행은 자동으로 에러를 처리하고 표준 형식의 결과를 반환합니다.
- **컨텍스트 관리**: 노드 간 데이터 전달은 `NodeExecutionContext`를 통해 관리됩니다.
- **로깅**: 모든 노드 실행은 자동으로 로그에 기록됩니다.

### 노드 실행 흐름

```
클라이언트 요청
    ↓
API 라우터 (action_router.py)
    ↓
ActionService.process_node()
    ↓
NodeExecutor 래퍼 (에러 처리, 로깅)
    ↓
노드의 execute() 메서드 실행
    ↓
표준 형식 결과 반환
```

자세한 내용은 [architecture.md](./architecture.md)를 참조하세요.
