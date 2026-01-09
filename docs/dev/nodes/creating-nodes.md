# 노드 추가 가이드

## 1. 노드 타입 선택

**Python 노드** (권장): 파일 시스템, 데이터베이스 접근 등 서버 측 작업
- [Python 노드 생성 가이드](./creating-nodes-python.md) 참고

**JavaScript 노드**: 브라우저 API, DOM 조작 등 클라이언트 측 작업
- [JavaScript 노드 생성 가이드](./creating-nodes-javascript.md) 참고

## 2. 노드 생성

**Python 노드:**
```bash
python scripts/nodes/create-node.py --name my-node --category action --description "내 노드"
```

**JavaScript 노드:**
1. `server/config/nodes_config.py`에 노드 설정 추가
2. `UI/src/js/components/node/node-{이름}.js` 파일 생성

## 3. 기능 구현

생성된 파일의 주석을 따라 실제 로직을 구현하세요.

> **참고**: 모든 파일은 자동으로 로드됩니다. 서버 재시작 후 사용 가능합니다.
