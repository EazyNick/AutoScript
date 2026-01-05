# 프론트엔드 성능 최적화 가이드

## 목차

1. [개요](#개요)
2. [렌더링 최적화](#렌더링-최적화)
   - [requestAnimationFrame 활용](#requestanimationframe-활용)
   - [리플로우(Reflow) 최소화](#리플로우reflow-최소화)
   - [가상 스크롤링](#가상-스크롤링)
3. [이벤트 처리 최적화](#이벤트-처리-최적화)
   - [이벤트 위임(Event Delegation)](#이벤트-위임event-delegation)
   - [이벤트 스로틀링/디바운싱](#이벤트-스로틀링디바운싱)
   - [전역 이벤트 리스너 관리](#전역-이벤트-리스너-관리)
4. [노드 드래그 최적화](#노드-드래그-최적화)
   - [getBoundingClientRect 캐싱](#getboundingclientrect-캐싱)
   - [연결선 업데이트 스로틀링](#연결선-업데이트-스로틀링)
   - [드래그 위치 업데이트 최적화](#드래그-위치-업데이트-최적화)
5. [API 호출 최적화](#api-호출-최적화)
   - [응답 시간 측정](#응답-시간-측정)
   - [에러 처리 최적화](#에러-처리-최적화)
   - [캐싱 전략](#캐싱-전략)
6. [메모리 관리](#메모리-관리)
   - [이벤트 리스너 정리](#이벤트-리스너-정리)
   - [DOM 참조 관리](#dom-참조-관리)
7. [워크플로우 로딩 최적화](#워크플로우-로딩-최적화)
   - [비동기 노드 생성](#비동기-노드-생성)
   - [연결선 렌더링 최적화](#연결선-렌더링-최적화)

## 개요

프론트엔드 성능 최적화는 사용자 경험을 크게 향상시킵니다. 특히 워크플로우 편집기에서 많은 노드를 다룰 때 성능이 중요합니다.

### 주요 최적화 영역

- **렌더링 성능**: DOM 조작 최소화, 리플로우/리페인트 최소화
- **이벤트 처리**: 이벤트 위임, 스로틀링/디바운싱
- **메모리 관리**: 메모리 누수 방지, 불필요한 리스너 제거
- **API 호출**: 응답 시간 측정, 에러 처리 최적화

## 렌더링 최적화

### requestAnimationFrame 활용

브라우저의 렌더링 주기에 맞춰 업데이트를 수행하여 불필요한 렌더링을 방지합니다.

**구현 위치**: `UI/src/js/components/node/node-drag.js`

```javascript
// ❌ 나쁜 예: 매 mousemove마다 즉시 업데이트
document.addEventListener('mousemove', (e) => {
    if (this.isDragging) {
        this.updateNodePosition(e.clientX, e.clientY); // 매번 리플로우 발생
    }
});

// ✅ 좋은 예: requestAnimationFrame으로 렌더링 주기에 맞춤
document.addEventListener('mousemove', (e) => {
    if (this.isDragging) {
        this.pendingPosition = { x: e.clientX, y: e.clientY };
        
        // 이미 예약되지 않았을 때만 예약 (한 프레임에 한 번만 업데이트)
        if (this.rafId === null) {
            this.rafId = requestAnimationFrame(() => {
                this.handleDrag();
                this.rafId = null;
            });
        }
    }
});
```

**효과**:
- 드래그 중 60fps 유지
- CPU 사용량 감소
- 부드러운 애니메이션

### 리플로우(Reflow) 최소화

리플로우는 브라우저가 요소의 크기와 위치를 다시 계산하는 비용이 큰 작업입니다.

**브라우저 렌더링 과정:**
```
1. HTML 파싱 → DOM 트리 생성
2. CSS 파싱 → CSSOM 트리 생성
3. DOM + CSSOM → 렌더 트리(Render Tree) 생성
4. 레이아웃 계산 (Layout/Reflow) ← 여기서 리플로우 발생
5. 페인팅 (Paint/Repaint) ← 여기서 리페인트 발생
6. 합성 (Composite) → 최종 화면 표시
```

**리플로우가 발생하는 경우:**
- 요소의 크기 변경 (`width`, `height`)
- 요소의 위치 변경 (`left`, `top`, `margin`, `padding`)
- 요소 추가/제거 (`appendChild`, `removeChild`)
- 레이아웃 정보 읽기 (`offsetWidth`, `offsetHeight`, `getBoundingClientRect()`)
- 폰트 크기 변경
- 윈도우 리사이즈

**리플로우를 유발하는 JavaScript API:**
```javascript
// 레이아웃 정보 읽기 → 리플로우 발생
element.offsetWidth
element.offsetHeight
element.offsetTop
element.offsetLeft
element.clientWidth
element.clientHeight
element.scrollWidth
element.scrollHeight
element.getBoundingClientRect()
element.getComputedStyle()
window.getComputedStyle()
```

**최적화 전략**:

1. **레이아웃 정보 읽기 최소화**
   ```javascript
   // ❌ 나쁜 예: 매번 getBoundingClientRect() 호출
   for (let i = 0; i < 100; i++) {
       const rect = element.getBoundingClientRect(); // 리플로우 발생
       element.style.left = i + 'px';
   }
   
   // ✅ 좋은 예: 한 번만 읽고, 모든 변경을 한 번에 적용
   const rect = element.getBoundingClientRect(); // 한 번만 리플로우
   for (let i = 0; i < 100; i++) {
       element.style.left = i + 'px';
   }
   ```

2. **스타일 변경 배치 처리**
   ```javascript
   // ❌ 나쁜 예: 여러 번 스타일 변경
   element.style.left = '10px';
   element.style.top = '20px';
   element.style.width = '100px';
   
   // ✅ 좋은 예: 한 번에 변경
   element.style.cssText = 'left: 10px; top: 20px; width: 100px;';
   // 또는
   element.className = 'new-class';
   ```

### 가상 스크롤링

많은 노드를 렌더링할 때 화면에 보이는 노드만 렌더링하는 기법입니다.

**구현 고려사항**:
- 뷰포트 내 노드만 렌더링
- 스크롤 시 동적으로 노드 추가/제거
- 노드 위치 계산 최적화

## 이벤트 처리 최적화

### 이벤트 위임(Event Delegation)

많은 요소에 이벤트 리스너를 추가하는 대신, 부모 요소에 하나의 리스너를 추가합니다.

**구현 위치**: `UI/src/js/components/sidebar.js`

```javascript
// ❌ 나쁜 예: 각 요소마다 리스너 추가
scriptElements.forEach(element => {
    element.addEventListener('click', handleClick);
});

// ✅ 좋은 예: 부모 요소에 하나의 리스너
parentElement.addEventListener('click', (e) => {
    if (e.target.matches('.script-item')) {
        handleClick(e);
    }
});
```

**효과**:
- 메모리 사용량 감소
- 동적 요소 추가 시 자동으로 이벤트 처리
- 이벤트 리스너 관리 간소화

### 이벤트 스로틀링/디바운싱

빈번한 이벤트 발생을 제한하여 성능을 향상시킵니다.

**스로틀링 (Throttling)**: 일정 시간 간격으로 실행
**디바운싱 (Debouncing)**: 마지막 이벤트 후 일정 시간 대기 후 실행

**구현 위치**: `UI/src/js/components/node/node-drag.js`

```javascript
// 연결선 업데이트 스로틀링 (약 60fps)
this.lastConnectionUpdateTime = 0;
this.CONNECTION_UPDATE_INTERVAL = 16; // 16ms = 60fps

updateConnections() {
    const now = performance.now();
    if (now - this.lastConnectionUpdateTime >= this.CONNECTION_UPDATE_INTERVAL) {
        this.connectionManager.updateAllConnections();
        this.lastConnectionUpdateTime = now;
    }
}
```

### 전역 이벤트 리스너 관리

전역 이벤트 리스너는 필요한 경우에만 등록하고, 사용 후 정리합니다.

**구현 위치**: `UI/src/js/components/node/node-drag.js`

```javascript
bindGlobalEvents() {
    // 전역 이벤트는 한 번만 등록
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mouseup', this.handleMouseUp);
}

// 정리 메서드
cleanup() {
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
}
```

## 노드 드래그 최적화

### getBoundingClientRect 캐싱

`getBoundingClientRect()`는 리플로우를 유발하므로 드래그 중에는 캐시된 값을 사용합니다.

**구현 위치**: `UI/src/js/components/node/node-drag.js`

```javascript
constructor(nodeManager) {
    // 캔버스 바운딩 박스 캐싱
    this.cachedCanvasRect = null;
    this.canvasRectCacheTime = 0;
    this.CANVAS_RECT_CACHE_DURATION = 100; // 100ms 동안 캐시 유지
}

getCanvasRect() {
    const now = performance.now();
    
    // 캐시가 유효하면 재사용
    if (this.cachedCanvasRect && 
        (now - this.canvasRectCacheTime) < this.CANVAS_RECT_CACHE_DURATION) {
        return this.cachedCanvasRect;
    }
    
    // 캐시 무효화 시에만 다시 계산
    this.cachedCanvasRect = this.canvas.getBoundingClientRect();
    this.canvasRectCacheTime = now;
    return this.cachedCanvasRect;
}
```

**효과**:
- 드래그 중 리플로우 최소화
- 부드러운 드래그 경험

### 연결선 업데이트 스로틀링

드래그 중 연결선 업데이트를 제한하여 성능을 향상시킵니다.

**구현 위치**: `UI/src/js/components/node/node-drag.js`

```javascript
// 연결선 업데이트 스로틀링
this.lastConnectionUpdateTime = 0;
this.CONNECTION_UPDATE_INTERVAL = 16; // 약 60fps

handleDrag() {
    // 노드 위치 업데이트
    this.updateNodePosition();
    
    // 연결선은 드래그 종료 시에만 완전히 업데이트
    // 드래그 중에는 스로틀링 적용
    const now = performance.now();
    if (now - this.lastConnectionUpdateTime >= this.CONNECTION_UPDATE_INTERVAL) {
        this.connectionManager.updateConnectionsForNode(this.draggedNode.id);
        this.lastConnectionUpdateTime = now;
    }
}

endDrag() {
    // 드래그 종료 시 모든 연결선 완전히 업데이트
    this.connectionManager.updateAllConnections();
}
```

### 드래그 위치 업데이트 최적화

드래그 중 위치 업데이트를 최적화합니다.

**구현 위치**: `UI/src/js/components/node/node-drag.js`

```javascript
bindGlobalEvents() {
    document.addEventListener('mousemove', (e) => {
        if (this.isDragging) {
            // 마우스 위치를 즉시 저장 (이벤트 객체는 재사용되므로)
            this.pendingPosition = { x: e.clientX, y: e.clientY };
            
            // requestAnimationFrame이 이미 예약되지 않았을 때만 예약
            if (this.rafId === null) {
                this.rafId = requestAnimationFrame(() => {
                    this.handleDrag();
                    this.rafId = null;
                });
            }
        }
    });
}
```

### 캔버스 패닝/줌 최적화

캔버스 패닝과 줌 동작을 최적화합니다.

**구현 위치**: `UI/src/js/components/node/node-canvas.js`

#### canvasTransform 객체 활용

DOM 파싱 대신 메모리 객체를 사용하여 성능을 향상시킵니다.

```javascript
// ❌ 나쁜 예: 매번 DOM 파싱
const currentTransform = canvasContent.style.transform;
const translateMatch = currentTransform.match(/translate\(([^,]+)px,\s*([^)]+)px\)/);
const currentX = parseFloat(translateMatch[1]) || -50000;

// ✅ 좋은 예: 메모리 객체 사용
const currentX = this.canvasTransform.x;
```

**효과:**
- DOM 파싱 제거
- 정규식 처리 제거
- CPU 사용량 감소

## API 호출 최적화

### 응답 시간 측정

API 호출 성능을 모니터링하여 병목을 식별합니다.

**구현 위치**: `UI/src/js/api/scriptapi.js`

```javascript
async getAllScripts() {
    const logger = getLogger();
    
    try {
        const startTime = performance.now();
        const result = await apiCall('/api/scripts');
        const endTime = performance.now();
        
        logger.log(`[ScriptAPI] 응답 시간: ${(endTime - startTime).toFixed(2)}ms`);
        
        return result.data || result;
    } catch (error) {
        logger.error('[ScriptAPI] ❌ API 요청 실패:', error);
        throw error;
    }
}
```

**효과**:
- 성능 병목 식별
- 느린 API 엔드포인트 발견
- 사용자 경험 개선

### 에러 처리 최적화

에러 처리를 효율적으로 수행하여 불필요한 재시도를 방지합니다.

```javascript
async executeScript(scriptId, nodes) {
    try {
        const result = await apiCall(`/api/scripts/${scriptId}/execute`, {
            method: 'POST',
            body: JSON.stringify({ nodes })
        });
        
        if (!result.success) {
            // 비즈니스 로직 에러 처리
            throw new Error(result.message || '스크립트 실행 실패');
        }
        
        return result.data;
    } catch (error) {
        // 네트워크 에러와 비즈니스 로직 에러 구분
        if (error instanceof TypeError) {
            // 네트워크 에러
            logger.error('[ScriptAPI] 네트워크 에러:', error);
        } else {
            // 비즈니스 로직 에러
            logger.error('[ScriptAPI] 실행 실패:', error);
        }
        throw error;
    }
}
```

### 캐싱 전략

자주 조회되는 데이터를 캐싱하여 API 호출을 줄입니다.

```javascript
class ScriptCache {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5분
    }
    
    get(scriptId) {
        const cached = this.cache.get(scriptId);
        if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
            return cached.data;
        }
        return null;
    }
    
    set(scriptId, data) {
        this.cache.set(scriptId, {
            data,
            timestamp: Date.now()
        });
    }
    
    invalidate(scriptId) {
        this.cache.delete(scriptId);
    }
}
```

## 메모리 관리

### 이벤트 리스너 정리

컴포넌트가 제거될 때 이벤트 리스너를 정리하여 메모리 누수를 방지합니다.

```javascript
class Component {
    constructor() {
        this.boundHandleClick = this.handleClick.bind(this);
        document.addEventListener('click', this.boundHandleClick);
    }
    
    destroy() {
        // 컴포넌트 제거 시 리스너 정리
        document.removeEventListener('click', this.boundHandleClick);
    }
}
```

### DOM 참조 관리

DOM 요소 참조를 적절히 관리하여 메모리 누수를 방지합니다.

```javascript
class NodeManager {
    constructor() {
        this.nodes = new Map(); // WeakMap 사용 고려
        this.canvas = document.getElementById('canvas');
    }
    
    addNode(nodeData) {
        const nodeElement = this.createNodeElement(nodeData);
        this.nodes.set(nodeData.id, nodeElement);
        this.canvas.appendChild(nodeElement);
    }
    
    removeNode(nodeId) {
        const nodeElement = this.nodes.get(nodeId);
        if (nodeElement) {
            nodeElement.remove(); // DOM에서 제거
            this.nodes.delete(nodeId); // 참조 제거
        }
    }
}
```

## 워크플로우 로딩 최적화

### 노드 스크립트 지연 로딩 (2026-01-05 추가)

시작 노드만 필요한 경우 경계 노드(시작/종료)만 먼저 로드하고 나머지는 백그라운드에서 지연 로드합니다.

**구현 위치**: `UI/src/pages/workflow/workflow.js`, `UI/src/pages/workflow/services/node-registry.js`

```javascript
// 경계 노드만 먼저 로드
await registry.loadBoundaryNodeScripts();

// 나머지 노드는 백그라운드에서 지연 로드
registry.loadAllNodeScripts().then(() => {
    log('[WorkflowPage] 모든 노드 스크립트 로드 완료 (지연 로드)');
});
```

**효과**:
- 최초 실행 시 시작 노드 표시 속도 대폭 개선 (약 5초 → 즉시)
- 사용자 경험 향상

### 비동기 노드 생성

노드를 순차적으로 생성하여 UI 블로킹을 방지합니다.

**구현 위치**: `UI/src/pages/workflow/services/workflow-load-service.js`

```javascript
async renderNodes(nodes, connections, nodeManager) {
    // 노드들을 비동기로 생성
    for (let index = 0; index < nodes.length; index++) {
        const nodeData = nodes[index];
        await this.createNodeFromServerData(nodeData, nodeManager);
        
        // 진행 상황 로깅
        logger.log(`노드 ${index + 1}/${nodes.length} 생성 중`);
    }
    
    // 노드가 DOM에 완전히 렌더링될 때까지 대기
    requestAnimationFrame(() => {
        this.restoreConnections(connections, nodeManager);
        this.workflowPage.fitNodesToView();
    });
}
```

**효과**:
- UI 블로킹 방지
- 진행 상황 표시 가능
- 사용자 경험 개선

### 연결선 렌더링 최적화

연결선 렌더링을 최적화하여 성능을 향상시킵니다.

```javascript
restoreConnections(connections, nodeManager) {
    // 모든 노드가 렌더링된 후 연결선 복원
    requestAnimationFrame(() => {
        if (nodeManager && nodeManager.connectionManager) {
            // 연결선 일괄 업데이트
            nodeManager.connectionManager.updateAllConnections();
        }
    });
}
```

## 상수화 및 모듈화 (2026-01-05 추가)

하드코딩된 값들을 상수 파일로 분리하여 유지보수성을 향상시킵니다.

**구현 위치**: `UI/src/pages/workflow/constants/`

```javascript
// timing-constants.js
export const TIMING_CONSTANTS = {
    DEFAULT_DELAY: 50,
    MEDIUM_DELAY: 100,
    CONNECTION_UPDATE_INTERVAL: 16,
    // ...
};

// size-constants.js
export const SIZE_CONSTANTS = {
    INFINITE_CANVAS_WIDTH: 50000,
    MAGNETIC_THRESHOLD: 40,
    // ...
};
```

**효과**:
- 수치 변경 시 상수 파일만 수정하면 됨
- 코드 일관성 향상
- 가독성 개선

## 성능 측정 도구

### Performance API 활용

브라우저의 Performance API를 사용하여 성능을 측정합니다.

```javascript
// 마크 설정
performance.mark('node-creation-start');

// 노드 생성 작업
await createNodes();

// 마크 설정
performance.mark('node-creation-end');

// 측정
performance.measure('node-creation', 'node-creation-start', 'node-creation-end');

// 결과 조회
const measure = performance.getEntriesByName('node-creation')[0];
console.log(`노드 생성 시간: ${measure.duration}ms`);
```

### Chrome DevTools 활용

Chrome DevTools의 Performance 탭을 사용하여 성능을 분석합니다.

1. **Performance 탭 열기**
2. **Record 버튼 클릭**
3. **작업 수행** (예: 노드 드래그)
4. **Stop 버튼 클릭**
5. **프레임 분석**: FPS, 리플로우, 리페인트 확인

## 최적화 체크리스트

- [ ] `requestAnimationFrame` 사용하여 렌더링 최적화
- [ ] `getBoundingClientRect()` 호출 최소화 및 캐싱
- [ ] 이벤트 위임 사용
- [ ] 이벤트 스로틀링/디바운싱 적용
- [ ] 전역 이벤트 리스너 정리
- [ ] API 응답 시간 측정
- [ ] 메모리 누수 방지 (이벤트 리스너 정리)
- [ ] 비동기 노드 생성으로 UI 블로킹 방지
- [ ] 연결선 업데이트 스로틀링
- [ ] Performance API로 성능 측정

## 참고 자료

- [MDN: requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame)
- [MDN: Performance API](https://developer.mozilla.org/en-US/docs/Web/API/Performance)
- [Google: Web Performance Best Practices](https://web.dev/performance/)

