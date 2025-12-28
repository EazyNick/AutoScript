**최신 수정일자: 2025.12.21**

# Excel 제어 문서

이 디렉토리는 Excel 제어 관련 문서를 포함합니다.

## 문서 목록

### 📋 [Excel 제어 기능 목록](./excel-control-capabilities.md)
win32com을 사용하여 Excel을 제어할 수 있는 모든 기능을 정리한 문서입니다.
- 현재 구현된 노드 목록
- 구현 예정인 노드 목록 (카테고리별)
- 각 기능의 win32com 메서드/속성
- 우선순위 가이드
- 구현 가이드

### 🔍 [Excel 키워드 검색 및 작업 노드 설계](./excel-keyword-search-design.md)
키워드 기반 Excel 작업 노드들의 상세 설계 문서입니다.
- excel-find-keyword: 키워드 찾기
- excel-write-at-keyword: 키워드 위치에 쓰기
- excel-delete-at-keyword: 키워드 위치 삭제
- excel-write-range-at-keyword: 키워드 위치에 범위 쓰기
- 사용 시나리오 및 구현 가이드

### 📖 [Excel 노드 사용 가이드](../nodes/excel-nodes.md)
현재 구현된 Excel 노드의 사용 방법을 설명하는 문서입니다.
- excel-open (엑셀 열기)
- excel-select-sheet (엑셀 시트 선택)
- excel-close (엑셀 닫기)

## 빠른 시작

### 1. Excel 파일 열기
```
[시작] → [엑셀 열기] → [엑셀 시트 선택] → [엑셀 닫기]
```

### 2. 기본 워크플로우
1. **엑셀 열기**: Excel 파일을 열고 `execution_id`를 받습니다
2. **엑셀 시트 선택**: 원하는 시트를 선택합니다
3. **엑셀 닫기**: 작업 완료 후 Excel을 닫습니다

## 향후 계획

[Excel 제어 기능 목록](./excel-control-capabilities.md) 문서를 참고하여 다음 노드들을 순차적으로 구현할 예정입니다:

### 우선순위 높음
- excel-create (새 워크북 생성)
- excel-save (워크북 저장)
- excel-read-cell (셀 읽기)
- excel-write-cell (셀 쓰기)
- excel-read-range (범위 읽기)
- excel-write-range (범위 쓰기)
- excel-insert-row/column (행/열 삽입)
- excel-delete-row/column (행/열 삭제)
- excel-sort (정렬)
- excel-auto-filter (자동 필터)

### 우선순위 중간
- excel-add-sheet (시트 추가)
- excel-delete-sheet (시트 삭제)
- excel-rename-sheet (시트 이름 변경)
- excel-copy-cell/range (복사/붙여넣기)
- excel-set-formula (수식 입력)
- excel-print (인쇄)

## 관련 파일

### Python 구현
- `server/nodes/excelnodes/excel_open.py` - 엑셀 열기 노드
- `server/nodes/excelnodes/excel_select_sheet.py` - 엑셀 시트 선택 노드
- `server/nodes/excelnodes/excel_close.py` - 엑셀 닫기 노드
- `server/nodes/excelnodes/excel_manager.py` - Excel 인스턴스 관리

### JavaScript UI
- `UI/src/js/components/node/node-excel-open.js`
- `UI/src/js/components/node/node-excel-select-sheet.js`
- `UI/src/js/components/node/node-excel-close.js`

### 설정
- `server/config/nodes_config.py` - 노드 설정

## 참고

- 모든 Excel 노드는 Windows 환경에서만 동작합니다
- `pywin32` 라이브러리가 필요합니다
- Microsoft Excel이 설치되어 있어야 합니다

