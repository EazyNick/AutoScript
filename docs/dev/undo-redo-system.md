# Undo/Redo 시스템

노드 위치 변경에 대한 되돌리기 기능을 제공하는 시스템입니다.

## 개요

워크플로우 편집 중 노드를 드래그하여 이동한 후, `Ctrl+Z`를 눌러 이전 위치로 되돌릴 수 있는 기능입니다. 각 스크립트별로 독립적인 Undo 스택을 관리하여, 다른 스크립트의 작업 기록에 영향을 주지 않습니다.

## 주요 기능

- **노드 이동 되돌리기**: 노드를 드래그하여 이동한 후 `Ctrl+Z`로 이전 위치로 복원
- **스크립트별 독립 스택**: 각 스크립트마다 별도의 Undo 스택 관리
- **자동 DB 동기화**: 되돌리기 후 변경사항이 자동으로 데이터베이스에 저장
- **최대 50개 작업 기록**: 최근 50개의 노드 이동 작업까지 되돌리기 가능

## 아키텍처

### 시스템 구조도

```
┌─────────────────────────────────────────────────────────────────┐
│                         WorkflowPage                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              UndoRedoService                             │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │ undoStacks: Map<scriptId, Array<SnapshotPair>>    │  │  │
│  │  │   ├── scriptId: 1 → [{before, after}, ...]       │  │  │
│  │  │   ├── scriptId: 2 → [{before, after}, ...]       │  │  │
│  │  │   └── scriptId: 4 → [{before, after}, ...]       │  │  │
│  │  │                                                      │  │  │
│  │  │ currentScriptId: 4                                  │  │  │
│  │  │ maxStackSize: 50                                    │  │  │
│  │  │ isRestoring: false                                  │  │  │
│  │  │ isProcessing: false                                 │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  │  Methods:                                                 │  │
│  │  ├── createSnapshot(type)                                │  │
│  │  ├── saveSnapshot(before, after)                         │  │
│  │  ├── restoreSnapshot(snapshot)                            │  │
│  │  ├── undo()                                              │  │
│  │  └── switchScript(scriptId)                              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              NodeManager                                 │  │
│  │  ├── nodes: Array                                       │  │
│  │  ├── nodeData: Object                                   │  │
│  │  └── connectionManager: ConnectionManager              │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ 참조
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NodeDragController                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Properties:                                               │  │
│  │  ├── nodeManager: NodeManager                            │  │
│  │  ├── isDragging: boolean                                 │  │
│  │  └── dragStartSnapshot: Snapshot | null                 │  │
│  │                                                           │  │
│  │ Methods:                                                  │  │
│  │  ├── startDrag(e, node)                                  │  │
│  │  │   └── createSnapshot('move')                          │  │
│  │  └── endDrag()                                            │  │
│  │      └── createSnapshot('move')                           │  │
│  │      └── saveMoveSnapshot(before, after)                  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 컴포넌트 상호작용 다이어그램

```
┌─────────────┐
│   사용자    │
└──────┬──────┘
       │
       │ 1. 노드 드래그 시작
       ▼
┌─────────────────────┐
│ NodeDragController  │
│   startDrag()       │
└──────┬──────────────┘
       │
       │ 2. createSnapshot('move')
       ▼
┌─────────────────────┐
│  UndoRedoService    │
│  createSnapshot()    │──┐
└─────────────────────┘  │
                          │ beforeSnapshot 저장
                          │
       │ 3. 노드 드래그 종료
       ▼
┌─────────────────────┐
│ NodeDragController  │
│    endDrag()        │
└──────┬──────────────┘
       │
       │ 4. createSnapshot('move')
       │ 5. saveMoveSnapshot()
       ▼
┌─────────────────────┐
│  UndoRedoService    │
│  saveSnapshot()     │──┐
└─────────────────────┘  │
                          │ undoStack.push({before, after})
                          │
       │ 6. Ctrl+Z 입력
       ▼
┌─────────────────────┐
│  UndoRedoService    │
│      undo()         │
└──────┬──────────────┘
       │
       │ 7. undoStack.pop()
       │ 8. restoreSnapshot(beforeSnapshot)
       ▼
┌─────────────────────┐
│  UndoRedoService    │
│ restoreSnapshot()   │──┐
└──────┬──────────────┘  │
       │                  │ 노드 위치 복원
       │                  │
       │ 9. saveToDatabase()
       ▼                  │
┌─────────────────────┐  │
│ WorkflowSaveService │  │
│      save()         │◄─┘
└─────────────────────┘
```

### 데이터 흐름도

```
┌─────────────────────────────────────────────────────────────┐
│                    드래그 시작 시퀀스                        │
└─────────────────────────────────────────────────────────────┘

사용자: 노드 드래그 시작
    │
    ▼
NodeDragController.startDrag()
    │
    ├─► workflowPage.getUndoRedoService()
    │
    ▼
UndoRedoService.createSnapshot('move')
    │
    ├─► 현재 모든 노드 상태 수집
    │   ├─ 노드 ID, 타입, 위치
    │   ├─ 노드 데이터, 파라미터
    │   ├─ 연결 정보
    │   └─ 스크립트 ID
    │
    ▼
beforeSnapshot 생성
    │
    ▼
dragStartSnapshot에 저장


┌─────────────────────────────────────────────────────────────┐
│                    드래그 종료 시퀀스                        │
└─────────────────────────────────────────────────────────────┘

사용자: 마우스 버튼 해제
    │
    ▼
NodeDragController.endDrag()
    │
    ├─► saveFinalPosition() (nodeData 업데이트)
    │
    ├─► UndoRedoService.createSnapshot('move')
    │   └─ 새로운 노드 위치로 afterSnapshot 생성
    │
    ▼
UndoRedoService.saveMoveSnapshot(before, after)
    │
    ├─► getCurrentUndoStack() (현재 스크립트의 스택)
    │
    ├─► undoStack.push({ before, after })
    │
    └─► 스택 크기 제한 (maxStackSize: 50)


┌─────────────────────────────────────────────────────────────┐
│                      Undo 시퀀스                             │
└─────────────────────────────────────────────────────────────┘

사용자: Ctrl+Z 입력
    │
    ▼
UndoRedoService.undo()
    │
    ├─► 중복 실행 방지 체크 (isProcessing, isRestoring)
    │
    ├─► 스크립트 ID 확인 (없으면 loadService에서 가져오기)
    │
    ├─► getCurrentUndoStack()
    │
    ├─► undoStack.pop() → { before, after }
    │
    ▼
UndoRedoService.restoreSnapshot(beforeSnapshot)
    │
    ├─► 스크립트 ID 검증
    │
    ├─► 각 노드의 위치 복원
    │   ├─ nodeElement.style.left/top 업데이트
    │   └─ nodeManager.nodeData 업데이트
    │
    ├─► connectionManager.updateAllConnections()
    │
    ▼
UndoRedoService.saveToDatabase()
    │
    ├─► WorkflowSaveService.save()
    │
    └─► DB에 변경사항 저장
```

### 스크립트별 스택 관리 구조

```
UndoRedoService
│
├── undoStacks: Map
│   │
│   ├── [scriptId: 1]
│   │   └── Array<SnapshotPair>
│   │       ├── [{before: {...}, after: {...}}]  ← 최신
│   │       ├── [{before: {...}, after: {...}}]
│   │       └── [{before: {...}, after: {...}}]  ← 오래된 것
│   │
│   ├── [scriptId: 2]
│   │   └── Array<SnapshotPair>
│   │       └── [{before: {...}, after: {...}}]
│   │
│   └── [scriptId: 4]  ← currentScriptId
│       └── Array<SnapshotPair>
│           ├── [{before: {...}, after: {...}}]  ← undo() 시 pop()
│           └── [{before: {...}, after: {...}}]
│
└── currentScriptId: 4
```

### 스냅샷 데이터 구조

```
Snapshot
│
├── type: 'move'
├── timestamp: 1234567890
├── scriptId: 4
│
└── nodesState: Object
    │
    ├── ['node1']: NodeState
    │   ├── id: 'node1'
    │   ├── type: 'wait'
    │   ├── position: { x: 100, y: 200 }
    │   ├── data: { title: '대기', ... }
    │   ├── parameters: { wait_time: 1.0 }
    │   ├── description: '처리 대기'
    │   ├── connected_to: [{ to: 'node2', outputType: null }]
    │   ├── connected_from: ['start']
    │   ├── is_connected: true
    │   ├── connection_sequence: 1
    │   └── node_identifier: 'wait_1'
    │
    ├── ['node2']: NodeState
    │   └── ...
    │
    └── ['node3']: NodeState
        └── ...
```

## 작동 방식

### 1. 스냅샷 생성

노드 드래그가 시작되면 현재 모든 노드의 상태를 스냅샷으로 저장합니다.

**스냅샷에 포함되는 정보:**
- 노드 ID (`id`)
- 노드 타입 (`type`)
- 위치 정보 (`position.x`, `position.y`)
- 노드 데이터 (`data`)
- 파라미터 (`parameters`)
- 설명 (`description`)
- 연결 정보 (`connected_to`, `connected_from`)
- 연결 메타데이터 (`is_connected`, `connection_sequence`, `node_identifier`)
- 스크립트 ID (`scriptId`)

### 2. 스냅샷 저장

드래그가 종료되면 새로운 스냅샷을 생성하고, 이전 스냅샷과 함께 Undo 스택에 저장합니다.

```javascript
undoStack.push({
    before: beforeSnapshot,  // 드래그 시작 전 상태
    after: afterSnapshot     // 드래그 종료 후 상태
});
```

### 3. 되돌리기 실행

`Ctrl+Z`를 누르면:
1. 현재 스크립트의 Undo 스택에서 가장 최근 항목을 가져옵니다
2. `beforeSnapshot`을 사용하여 노드 위치를 복원합니다
3. 복원 후 데이터베이스에 변경사항을 저장합니다

### 4. 스크립트 전환

다른 스크립트로 전환하면:
1. `switchScript(scriptId)`가 호출됩니다
2. 해당 스크립트의 Undo 스택이 활성화됩니다
3. 기존 스택이 있으면 초기화됩니다 (새로 로드할 때마다)

## 주요 메서드

### `createSnapshot(type)`
현재 모든 노드의 상태를 스냅샷으로 생성합니다.

**파라미터:**
- `type`: 스냅샷 타입 (현재는 `'move'`만 지원)

**반환값:**
- 스냅샷 객체 또는 `null` (생성 실패 시)

### `saveSnapshot(beforeSnapshot, afterSnapshot)`
스냅샷 쌍을 Undo 스택에 저장합니다.

**파라미터:**
- `beforeSnapshot`: 이전 상태 스냅샷
- `afterSnapshot`: 이후 상태 스냅샷

### `restoreSnapshot(snapshot)`
스냅샷에 저장된 상태로 노드 위치를 복원합니다.

**파라미터:**
- `snapshot`: 복원할 스냅샷 객체

### `undo()`
가장 최근 작업을 되돌립니다.

### `switchScript(scriptId)`
현재 활성 스크립트를 전환합니다.

**파라미터:**
- `scriptId`: 전환할 스크립트 ID

## 데이터 구조

### 스냅샷 객체

```javascript
{
    type: 'move',
    timestamp: 1234567890,
    nodesState: {
        'node1': {
            id: 'node1',
            type: 'wait',
            position: { x: 100, y: 200 },
            data: { ... },
            parameters: { ... },
            description: '...',
            connected_to: [...],
            connected_from: [...],
            is_connected: true,
            connection_sequence: 1,
            node_identifier: '...'
        },
        // ... 다른 노드들
    },
    scriptId: 4
}
```

### Undo 스택 항목

```javascript
{
    before: snapshot,  // 이전 상태
    after: snapshot    // 이후 상태
}
```

## 사용 방법

### 기본 사용

1. 노드를 드래그하여 이동합니다
2. 마우스를 떼면 자동으로 스냅샷이 저장됩니다
3. `Ctrl+Z`를 눌러 이전 위치로 되돌립니다

### 스크립트 전환

- 다른 스크립트를 선택하면 해당 스크립트의 Undo 스택이 활성화됩니다
- 각 스크립트는 독립적인 Undo 히스토리를 가집니다

## 제한사항

### 현재 지원하는 기능
- ✅ 노드 위치 변경 (드래그)

### 지원하지 않는 기능
- ❌ 노드 생성/삭제
- ❌ 노드 파라미터 수정
- ❌ 연결선 생성/삭제
- ❌ Redo 기능 (Ctrl+Shift+Z)

## 구현 세부사항

### 스크립트 ID 관리

스크립트 ID는 다음 순서로 찾습니다:
1. `currentScriptId` (현재 활성 스크립트)
2. `loadService.getLastLoadedScriptId()` (마지막 로드한 스크립트)
3. `sidebarManager.getCurrentScript()?.id` (사이드바에서 선택된 스크립트)

### 무한 루프 방지

- `isRestoring` 플래그로 복원 중에는 새로운 스냅샷을 생성하지 않습니다
- `isProcessing` 플래그로 중복 Undo 실행을 방지합니다

### DB 동기화

되돌리기 후 자동으로 데이터베이스에 저장됩니다:
- `restoreSnapshot()` 완료 후 `saveToDatabase()` 호출
- 현재 스크립트의 노드와 연결 정보만 저장

## 파일 위치

- **서비스**: `UI/src/pages/workflow/services/undo-redo-service.js`
- **드래그 컨트롤러**: `UI/src/js/components/node/node-drag.js`
- **워크플로우 페이지**: `UI/src/pages/workflow/workflow.js`

## 향후 개선 사항

- 노드 생성/삭제에 대한 Undo 지원
- Redo 기능 추가
- 연결선 변경에 대한 Undo 지원
- 노드 파라미터 수정에 대한 Undo 지원 (선택적)

