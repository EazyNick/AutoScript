# 스크립트 로드 워크플로우

## 개요

이 문서는 워크플로우 편집기에서 스크립트(워크플로우)를 로드하는 전체 프로세스를 설명합니다. 빠른 스크립트 전환 시 발생할 수 있는 race condition 문제를 해결하고, 노드가 정확하게 로드되도록 보장하는 메커니즘을 포함합니다.

## 목차

1. [아키텍처](#아키텍처)
2. [주요 컴포넌트](#주요-컴포넌트)
3. [로드 워크플로우](#로드-워크플로우)
4. [취소 메커니즘](#취소-메커니즘)
5. [노드 제거 프로세스](#노드-제거-프로세스)
6. [에러 처리](#에러-처리)
7. [성능 최적화](#성능-최적화)

---

## 아키텍처

### 전체 구조

```
┌─────────────────────────────────────────────────────────────┐
│                    사용자 액션                               │
│  (스크립트 클릭, 페이지 이동, 초기 로드)                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              SidebarScriptManager                           │
│  - 스크립트 선택 처리                                        │
│  - scriptChanged 이벤트 발생                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  WorkflowPage                                │
│  - onScriptChanged() 이벤트 핸들러                           │
│  - 노드 레지스트리 로딩 확인                                 │
│  - 이전 스크립트 저장                                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│            WorkflowLoadService                               │
│  - 로드 취소 메커니즘                                        │
│  - 노드 제거 및 렌더링                                       │
│  - 상태 관리                                                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              NodeManager / NodeRegistry                      │
│  - 노드 생성 및 관리                                         │
│  - 노드 타입 정의 로드                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 주요 컴포넌트

### 1. WorkflowLoadService

**위치**: `UI/src/pages/workflow/services/workflow-load-service.js`

**역할**: 스크립트 로드의 핵심 로직을 담당하는 서비스 클래스

**주요 속성**:
- `isLoading`: 현재 로드 중인지 여부
- `_lastLoadedScriptId`: 마지막으로 로드한 스크립트 ID
- `_currentLoadPromise`: 현재 진행 중인 로드 Promise
- `_currentLoadId`: 현재 로드의 고유 ID
- `_cancelledLoadIds`: 취소된 로드 ID 집합

**주요 메서드**:
- `load(script, forceReload)`: 스크립트 로드 시작
- `_performLoad(script, forceReload, loadId)`: 실제 로드 수행
- `clearExistingNodes(nodeManager)`: 기존 노드 제거
- `renderNodes(nodes, connections, nodeManager, loadId)`: 노드 렌더링

### 2. WorkflowPage

**위치**: `UI/src/pages/workflow/workflow.js`

**역할**: 워크플로우 페이지의 메인 컨트롤러

**주요 메서드**:
- `onScriptChanged(event)`: 스크립트 변경 이벤트 핸들러
- `loadScriptData(script, forceReload)`: 스크립트 데이터 로드

### 3. PageRouter

**위치**: `UI/src/pages/workflow/page-router.js`

**역할**: 페이지 전환 및 초기화 관리

**주요 메서드**:
- `initEditor()`: 스크립트 페이지 초기화

### 4. NodeRegistry

**위치**: `UI/src/pages/workflow/services/node-registry.js`

**역할**: 노드 타입 정의 및 스크립트 로드 관리

**주요 메서드**:
- `getNodeConfigs()`: 노드 설정 가져오기
- `loadNodeScript(nodeType)`: 노드 스크립트 동적 로드

---

## 로드 워크플로우

### 1. 초기 로드 시퀀스

```
1. 웹페이지 로드
   ↓
2. WorkflowPage.init()
   - 노드 레지스트리 초기화
   - 노드 스크립트 동적 로드
   - 서비스 인스턴스 생성
   ↓
3. PageRouter.initEditor()
   - 현재 스크립트 확인
   - 노드 레지스트리 로딩 완료 대기
   - 스크립트 로드 시작
```

### 2. 스크립트 변경 시퀀스

```
1. 사용자가 사이드바에서 스크립트 클릭
   ↓
2. SidebarScriptManager.selectScript()
   - 스크립트 활성화
   - scriptChanged 이벤트 발생
   ↓
3. WorkflowPage.onScriptChanged()
   - 노드 레지스트리 로딩 완료 대기
   - 중복 로드 방지 확인
   - 이전 스크립트 저장
   ↓
4. WorkflowLoadService.load()
   - 이전 로드 취소 (진행 중인 경우)
   - 노드 레지스트리 로딩 완료 대기
   - 고유 로드 ID 생성
   - _performLoad() 호출
   ↓
5. WorkflowLoadService._performLoad()
   - 로드 취소 확인
   - 연결선 매니저 초기화
   - 기존 노드 제거 (필요한 경우)
   - 서버에서 스크립트 데이터 가져오기
   - 노드 렌더링
```

### 3. 상세 로드 프로세스

#### 3.1 로드 시작 전 검증

```javascript
// 1. 유효성 검사
if (!script || !script.id) {
    return; // 로드 중단
}

// 2. 중복 로드 방지
if (!forceReload && this._lastLoadedScriptId === script.id) {
    return; // 이미 로드된 스크립트
}

// 3. 이전 로드 취소 (진행 중인 경우)
if (this.isLoading && this._currentLoadPromise) {
    // 이전 로드 취소 표시
    this._cancelledLoadIds.add(this._currentLoadId);
    // 노드 제거
    await this.clearExistingNodes(nodeManager);
}
```

#### 3.2 노드 레지스트리 로딩

```javascript
// 노드 레지스트리 로딩 완료 대기
const registry = getNodeRegistry();
await registry.getNodeConfigs();
```

**중요**: 노드 레지스트리가 로드되지 않으면 팔레트에 노드가 표시되지 않습니다.

#### 3.3 기존 노드 제거

```javascript
// 스크립트 변경 시에만 노드 제거
if (previousScriptId && previousScriptId !== script.id) {
    await this.clearExistingNodes(nodeManager);
    // DOM 업데이트 완료 대기
    await new Promise((resolve) => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                resolve();
            });
        });
    });
}
```

#### 3.4 서버에서 데이터 가져오기

```javascript
const response = await ScriptAPI.getScript(script.id);
const nodes = response.nodes || [];
const connections = response.connections || [];
```

#### 3.5 노드 렌더링

```javascript
// 노드 타입 필터링 (유효한 노드만)
const filteredNodes = nodes.filter((node) => {
    return validNodeTypes.has(node.type);
});

// 각 노드 생성
for (const nodeData of filteredNodes) {
    // 취소 확인
    if (this._cancelledLoadIds.has(loadId)) {
        // 이미 생성된 노드 제거
        return;
    }
    await this.createNodeFromServerData(nodeData, nodeManager);
}

// 연결선 복원
this.restoreConnections(filteredConnections, nodeManager);
```

---

## 취소 메커니즘

### 문제 상황

빠르게 여러 스크립트를 전환할 때:
- 이전 로드가 완료되기 전에 새 로드가 시작됨
- 여러 스크립트의 노드가 화면에 섞여 표시됨
- 불완전한 상태의 노드가 남음

### 해결 방법

#### 1. 고유 로드 ID

각 로드에 고유 ID를 부여하여 추적:

```javascript
const loadId = `${script.id}_${Date.now()}_${Math.random()}`;
this._currentLoadId = loadId;
```

#### 2. 취소 표시

이전 로드를 취소할 때:

```javascript
this._cancelledLoadIds.add(this._currentLoadId);
```

#### 3. 취소 확인 지점

로드 과정의 여러 지점에서 취소 확인:

```javascript
// 1. 로드 시작 시
if (this._cancelledLoadIds.has(loadId)) {
    return;
}

// 2. 노드 제거 전/후
if (this._cancelledLoadIds.has(loadId)) {
    return;
}

// 3. 서버 요청 전/후
if (this._cancelledLoadIds.has(loadId)) {
    return;
}

// 4. 노드 렌더링 전
if (this._cancelledLoadIds.has(loadId)) {
    return;
}

// 5. 각 노드 생성 중
for (const nodeData of filteredNodes) {
    if (this._cancelledLoadIds.has(loadId)) {
        // 이미 생성된 노드 제거
        return;
    }
    await this.createNodeFromServerData(nodeData, nodeManager);
}
```

#### 4. 부분 생성 노드 제거

취소 시 이미 생성된 노드를 제거:

```javascript
if (this._cancelledLoadIds.has(loadId)) {
    // 이미 생성된 노드들 찾기
    const createdNodes = nodeManager.nodes.filter((n) => {
        return filteredNodes.some((nd) => nd.id === n.id);
    });
    
    // 노드 제거
    createdNodes.forEach((n) => {
        if (n.element) {
            nodeManager.deleteNode(n.element, true);
        }
    });
    return;
}
```

---

## 노드 제거 프로세스

### clearExistingNodes() 메서드

기존 노드를 완전히 제거하는 비동기 프로세스:

```javascript
async clearExistingNodes(nodeManager) {
    // 1. 연결선 제거
    const allConnections = document.querySelectorAll('.connection-line');
    allConnections.forEach((conn) => conn.remove());
    
    // 2. NodeManager의 nodes 배열에서 제거
    const nodesToDelete = [...nodeManager.nodes];
    nodesToDelete.forEach((nodeObj) => {
        // 연결선 제거
        nodeManager.connectionManager.removeNodeConnections(nodeId);
        // 노드 제거
        nodeManager.deleteNode(nodeObj.element, true);
    });
    
    // 3. DOM에서 직접 제거 (혹시 남아있는 경우)
    const existingNodes = document.querySelectorAll('.workflow-node');
    existingNodes.forEach((node) => {
        node.remove();
    });
    
    // 4. nodeData 초기화
    Object.keys(nodeManager.nodeData).forEach((key) => {
        delete nodeManager.nodeData[key];
    });
    
    // 5. nodes 배열 초기화
    nodeManager.nodes.length = 0;
    
    // 6. DOM 업데이트 완료 대기
    await new Promise((resolve) => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                resolve();
            });
        });
    });
}
```

### 제거 순서

1. **연결선 먼저 제거**: 노드 삭제 전에 연결선을 제거하여 참조 오류 방지
2. **NodeManager에서 제거**: 내부 상태 정리
3. **DOM에서 제거**: 화면에서 완전히 제거
4. **데이터 초기화**: nodeData 및 nodes 배열 초기화
5. **DOM 업데이트 대기**: `requestAnimationFrame`을 두 번 호출하여 DOM 업데이트 완료 보장

---

## 에러 처리

### 1. 유효하지 않은 스크립트

```javascript
if (!script || !script.id) {
    logError('[WorkflowLoadService] ⚠️ 유효하지 않은 스크립트 정보');
    return;
}
```

### 2. 서버 요청 실패

```javascript
try {
    const response = await ScriptAPI.getScript(script.id);
    // ...
} catch (error) {
    logError('[WorkflowPage] ❌ 노드 데이터 로드 실패:', error);
    // 기본 시작 노드 생성
    await this.workflowPage.createDefaultBoundaryNodes();
}
```

### 3. 노드 레지스트리 로딩 실패

```javascript
try {
    await registry.getNodeConfigs();
} catch (error) {
    logError('[WorkflowLoadService] 노드 레지스트리 로딩 실패:', error);
    // 계속 진행 (폴백 설정 사용)
}
```

### 4. 노드 생성 실패

```javascript
try {
    await this.createNodeFromServerData(nodeData, nodeManager);
} catch (error) {
    log(`[WorkflowLoadService] 노드 생성 실패: ${error}`);
    // 계속 진행 (다음 노드 생성)
}
```

---

## 성능 최적화

### 1. 중복 로드 방지

```javascript
// 같은 스크립트를 다시 로드하려는 경우 방지
if (!forceReload && this._lastLoadedScriptId === script.id) {
    return;
}
```

### 2. 노드 레지스트리 캐싱

```javascript
// NodeRegistry에서 한 번 로드한 설정은 캐싱
if (!this.nodeConfigs) {
    await this.loadNodeConfigs();
}
return this.nodeConfigs;
```

### 3. 취소된 로드 ID 정리

```javascript
// 메모리 누수 방지를 위해 오래된 취소 ID 정리
if (this._cancelledLoadIds.size > 10) {
    this._cancelledLoadIds.clear();
}
```

### 4. 비동기 처리 최적화

```javascript
// 노드 제거와 생성 사이에 적절한 대기 시간
await this.clearExistingNodes(nodeManager);
// DOM 업데이트 완료 대기
await new Promise((resolve) => {
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            resolve();
        });
    });
});
```

---

## 주요 개선 사항

### 1. Race Condition 해결

**문제**: 빠른 스크립트 전환 시 노드가 섞여 표시됨

**해결**:
- 고유 로드 ID로 각 로드 추적
- 이전 로드 완전 취소 및 노드 제거
- 노드 제거 완료 후에만 새 노드 추가

### 2. 노드 레지스트리 로딩 보장

**문제**: 노드 레지스트리 로딩 전에 스크립트 로드 시 팔레트에 노드가 없음

**해결**:
- 스크립트 로드 전에 노드 레지스트리 로딩 완료 대기
- `WorkflowPage.onScriptChanged()`에서 확인
- `PageRouter.initEditor()`에서 확인
- `AddNodeModal.show()`에서 확인

### 3. 노드 제거 완료 보장

**문제**: 노드 제거가 완료되기 전에 새 노드가 추가됨

**해결**:
- `clearExistingNodes()`를 비동기 함수로 변경
- `requestAnimationFrame`을 두 번 호출하여 DOM 업데이트 완료 보장
- 노드 제거 완료 후에만 새 노드 추가

### 4. 취소 메커니즘 강화

**문제**: 취소된 로드의 노드가 남아있음

**해결**:
- 로드 과정의 여러 지점에서 취소 확인
- 부분적으로 생성된 노드도 제거
- 취소된 로드 ID 추적 및 정리

---

## 디버깅

### 로그 확인

스크립트 로드 과정은 상세한 로그를 출력합니다:

```javascript
// 로드 시작
log('[WorkflowLoadService] load() 호출됨:', { id, name, forceReload });

// 이전 로드 취소
log('[WorkflowLoadService] 기존 로드 취소하고 새 로드 시작');

// 노드 제거
log('[WorkflowPage] 기존 노드 제거 시작');

// 서버 응답
log('[WorkflowPage] ✅ 서버에서 스크립트 정보 받음:', response);

// 노드 렌더링
log('[WorkflowPage] 노드 데이터가 있음. 화면에 그리기 시작...');
```

### 일반적인 문제 해결

#### 1. 노드가 표시되지 않음

- 노드 레지스트리 로딩 확인
- 서버 응답 확인
- 브라우저 콘솔 에러 확인

#### 2. 노드가 섞여 표시됨

- 로드 취소 메커니즘 확인
- 노드 제거 완료 확인
- `_cancelledLoadIds` 상태 확인

#### 3. 로드가 느림

- 네트워크 요청 시간 확인
- 노드 개수 확인
- 브라우저 성능 프로파일링

---

## 관련 파일

- `UI/src/pages/workflow/services/workflow-load-service.js`: 로드 서비스 메인 로직
- `UI/src/pages/workflow/workflow.js`: 워크플로우 페이지 컨트롤러
- `UI/src/pages/workflow/page-router.js`: 페이지 라우터
- `UI/src/pages/workflow/services/node-registry.js`: 노드 레지스트리
- `UI/src/js/components/sidebar/sidebar-scripts.js`: 사이드바 스크립트 관리

---

## 참고 문서

- [워크플로우 구조](./workflow-structure.md)
- [노드 실행 플로우](../node-execution-flow.md)
- [노드 생성 가이드](../nodes/creating-nodes.md)
