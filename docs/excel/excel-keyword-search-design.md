**최신 수정일자: 2025.12.21**

# Excel 키워드 검색 및 작업 노드 설계

이 문서는 Excel에서 특정 행이나 열에 키워드를 찾아서 데이터를 작성하거나 삭제하는 노드들의 설계를 설명합니다.

## 개요

Excel 자동화에서 가장 일반적인 패턴 중 하나는 특정 키워드를 찾아서 그 위치를 기준으로 작업을 수행하는 것입니다. 예를 들어:
- "이름"이라는 키워드를 찾아서 그 옆 셀에 값을 작성
- "합계"라는 키워드를 찾아서 그 아래 셀에 값을 작성
- "삭제"라는 키워드가 있는 행을 삭제
- 특정 열에서 키워드를 찾아서 해당 열의 데이터를 수정

## 설계 원칙

1. **유연성**: 행/열 모두에서 검색 가능
2. **정확성**: 정확한 일치 또는 부분 일치 지원
3. **다중 결과 처리**: 여러 위치를 찾았을 때 처리 방법 선택
4. **확장성**: 다양한 작업 타입 지원 (쓰기, 삭제, 행/열 삭제 등)

---

## 노드 설계

### 1. excel-find-keyword (키워드 찾기 노드)

**목적**: 특정 키워드를 행 또는 열에서 찾아서 위치 정보를 반환합니다.

#### 파라미터

| 파라미터 | 타입 | 필수 | 설명 | 기본값 |
|---------|------|------|------|--------|
| `execution_id` | string | ✅ | 엑셀 실행 ID | - |
| `sheet_name` | string | ❌ | 시트 이름 (없으면 활성 시트) | - |
| `sheet_index` | number | ❌ | 시트 인덱스 (1부터 시작) | - |
| `search_keyword` | string | ✅ | 검색할 키워드 | - |
| `search_direction` | string | ✅ | 검색 방향: "row" (행), "column" (열) | "row" |
| `search_range` | string | ❌ | 검색 범위 (예: "A1:Z100", 없으면 전체 시트) | - |
| `match_type` | string | ❌ | 일치 타입: "exact" (정확), "partial" (부분), "contains" (포함) | "contains" |
| `case_sensitive` | boolean | ❌ | 대소문자 구분 | false |
| `find_all` | boolean | ❌ | 모든 결과 찾기 (true) 또는 첫 번째만 (false) | false |
| `start_row` | number | ❌ | 검색 시작 행 (1부터 시작) | 1 |
| `start_column` | number | ❌ | 검색 시작 열 (1부터 시작, A=1) | 1 |

#### 출력 스키마

```json
{
  "action": "excel-find-keyword",
  "status": "completed",
  "output": {
    "success": true,
    "execution_id": "exec-123",
    "sheet_name": "Sheet1",
    "keyword": "이름",
    "search_direction": "row",
    "found_count": 2,
    "positions": [
      {
        "row": 1,
        "column": 1,
        "cell_address": "A1",
        "value": "이름"
      },
      {
        "row": 5,
        "column": 1,
        "cell_address": "A5",
        "value": "이름"
      }
    ],
    "first_position": {
      "row": 1,
      "column": 1,
      "cell_address": "A1"
    }
  }
}
```

#### 동작 방식

1. **시트 선택**: `sheet_name` 또는 `sheet_index`로 시트 선택 (없으면 활성 시트)
2. **검색 범위 결정**: `search_range`가 있으면 해당 범위, 없으면 전체 시트
3. **검색 방향에 따른 검색**:
   - `search_direction = "row"`: 각 행을 순회하며 키워드 검색
   - `search_direction = "column"`: 각 열을 순회하며 키워드 검색
4. **일치 타입 확인**:
   - `exact`: 정확히 일치
   - `partial`: 부분 일치 (시작 또는 끝)
   - `contains`: 포함 (기본값)
5. **결과 수집**: `find_all = true`면 모든 결과, `false`면 첫 번째만
6. **결과 반환**: 찾은 위치 정보 반환

#### win32com 구현 예시

```python
# 행에서 검색
if search_direction == "row":
    for row in range(start_row, max_row + 1):
        for col in range(start_column, max_column + 1):
            cell_value = worksheet.Cells(row, col).Value
            if cell_value and match_keyword(str(cell_value), search_keyword, match_type, case_sensitive):
                positions.append({
                    "row": row,
                    "column": col,
                    "cell_address": get_cell_address(row, col),
                    "value": cell_value
                })
                if not find_all:
                    break
        if not find_all and positions:
            break

# 열에서 검색
elif search_direction == "column":
    for col in range(start_column, max_column + 1):
        for row in range(start_row, max_row + 1):
            cell_value = worksheet.Cells(row, col).Value
            if cell_value and match_keyword(str(cell_value), search_keyword, match_type, case_sensitive):
                positions.append({
                    "row": row,
                    "column": col,
                    "cell_address": get_cell_address(row, col),
                    "value": cell_value
                })
                if not find_all:
                    break
        if not find_all and positions:
            break
```

---

### 2. excel-write-at-keyword (키워드 위치에 쓰기 노드)

**목적**: 특정 키워드를 찾아서 그 위치를 기준으로 상대적 위치에 값을 작성합니다.

#### 파라미터

| 파라미터 | 타입 | 필수 | 설명 | 기본값 |
|---------|------|------|------|--------|
| `execution_id` | string | ✅ | 엑셀 실행 ID | - |
| `sheet_name` | string | ❌ | 시트 이름 | - |
| `sheet_index` | number | ❌ | 시트 인덱스 | - |
| `search_keyword` | string | ✅ | 검색할 키워드 | - |
| `search_direction` | string | ✅ | 검색 방향: "row", "column" | "row" |
| `write_value` | any | ✅ | 작성할 값 | - |
| `write_position` | string | ✅ | 작성 위치: "right", "left", "below", "above", "same" | "right" |
| `offset_row` | number | ❌ | 행 오프셋 (write_position과 함께 사용) | 0 |
| `offset_column` | number | ❌ | 열 오프셋 (write_position과 함께 사용) | 0 |
| `find_all` | boolean | ❌ | 모든 위치에 쓰기 (true) 또는 첫 번째만 (false) | false |
| `match_type` | string | ❌ | 일치 타입 | "contains" |
| `case_sensitive` | boolean | ❌ | 대소문자 구분 | false |
| `overwrite` | boolean | ❌ | 기존 값 덮어쓰기 | true |

#### 출력 스키마

```json
{
  "action": "excel-write-at-keyword",
  "status": "completed",
  "output": {
    "success": true,
    "execution_id": "exec-123",
    "keyword": "이름",
    "write_value": "홍길동",
    "write_position": "right",
    "written_count": 1,
    "written_cells": [
      {
        "row": 1,
        "column": 2,
        "cell_address": "B1",
        "old_value": null,
        "new_value": "홍길동"
      }
    ]
  }
}
```

#### 동작 방식

1. **키워드 검색**: `excel-find-keyword`와 동일한 로직으로 키워드 검색
2. **작성 위치 계산**:
   - `right`: 찾은 셀의 오른쪽 (열 +1)
   - `left`: 찾은 셀의 왼쪽 (열 -1)
   - `below`: 찾은 셀의 아래 (행 +1)
   - `above`: 찾은 셀의 위 (행 -1)
   - `same`: 찾은 셀과 동일 위치
3. **오프셋 적용**: `offset_row`, `offset_column` 추가
4. **값 작성**: 계산된 위치에 `write_value` 작성
5. **결과 반환**: 작성된 셀 정보 반환

#### win32com 구현 예시

```python
# 키워드 찾기
found_positions = find_keyword_positions(...)

# 각 위치에 값 작성
for pos in found_positions:
    target_row = pos["row"]
    target_col = pos["column"]
    
    # 작성 위치 계산
    if write_position == "right":
        target_col += 1
    elif write_position == "left":
        target_col -= 1
    elif write_position == "below":
        target_row += 1
    elif write_position == "above":
        target_row -= 1
    # "same"은 변경 없음
    
    # 오프셋 적용
    target_row += offset_row
    target_col += offset_column
    
    # 기존 값 확인
    old_value = worksheet.Cells(target_row, target_col).Value
    
    # 덮어쓰기 확인
    if not overwrite and old_value:
        continue  # 기존 값이 있으면 건너뛰기
    
    # 값 작성
    worksheet.Cells(target_row, target_col).Value = write_value
```

---

### 3. excel-delete-at-keyword (키워드 위치 삭제 노드)

**목적**: 특정 키워드를 찾아서 해당 셀, 행, 또는 열을 삭제합니다.

#### 파라미터

| 파라미터 | 타입 | 필수 | 설명 | 기본값 |
|---------|------|------|------|--------|
| `execution_id` | string | ✅ | 엑셀 실행 ID | - |
| `sheet_name` | string | ❌ | 시트 이름 | - |
| `sheet_index` | number | ❌ | 시트 인덱스 | - |
| `search_keyword` | string | ✅ | 검색할 키워드 | - |
| `search_direction` | string | ✅ | 검색 방향: "row", "column" | "row" |
| `delete_type` | string | ✅ | 삭제 타입: "cell", "row", "column" | "cell" |
| `find_all` | boolean | ❌ | 모든 위치 삭제 (true) 또는 첫 번째만 (false) | true |
| `match_type` | string | ❌ | 일치 타입 | "contains" |
| `case_sensitive` | boolean | ❌ | 대소문자 구분 | false |
| `shift_cells` | string | ❌ | 셀 삭제 시 이동 방향: "up", "left" | "up" |

#### 출력 스키마

```json
{
  "action": "excel-delete-at-keyword",
  "status": "completed",
  "output": {
    "success": true,
    "execution_id": "exec-123",
    "keyword": "삭제",
    "delete_type": "row",
    "deleted_count": 2,
    "deleted_items": [
      {
        "type": "row",
        "row": 5,
        "description": "Row 5"
      },
      {
        "type": "row",
        "row": 10,
        "description": "Row 10"
      }
    ]
  }
}
```

#### 동작 방식

1. **키워드 검색**: 키워드 위치 찾기
2. **삭제 타입에 따른 삭제**:
   - `cell`: 찾은 셀만 삭제 (위로/왼쪽으로 이동)
   - `row`: 찾은 셀이 있는 전체 행 삭제
   - `column`: 찾은 셀이 있는 전체 열 삭제
3. **다중 결과 처리**: `find_all = true`면 모든 위치 삭제
4. **결과 반환**: 삭제된 항목 정보 반환

#### win32com 구현 예시

```python
# 키워드 찾기
found_positions = find_keyword_positions(...)

# 역순으로 정렬 (삭제 시 인덱스 변경 방지)
if delete_type == "row":
    found_positions.sort(key=lambda x: x["row"], reverse=True)
elif delete_type == "column":
    found_positions.sort(key=lambda x: x["column"], reverse=True)

# 삭제 수행
for pos in found_positions:
    if delete_type == "cell":
        # 셀 삭제
        cell_range = worksheet.Cells(pos["row"], pos["column"])
        cell_range.Delete(Shift=win32com.client.constants.xlShiftUp if shift_cells == "up" else win32com.client.constants.xlShiftToLeft)
    elif delete_type == "row":
        # 행 삭제
        worksheet.Rows(pos["row"]).Delete()
    elif delete_type == "column":
        # 열 삭제
        worksheet.Columns(pos["column"]).Delete()
```

---

### 4. excel-write-range-at-keyword (키워드 위치에 범위 쓰기 노드)

**목적**: 특정 키워드를 찾아서 그 위치를 기준으로 여러 셀에 값을 작성합니다.

#### 파라미터

| 파라미터 | 타입 | 필수 | 설명 | 기본값 |
|---------|------|------|------|--------|
| `execution_id` | string | ✅ | 엑셀 실행 ID | - |
| `sheet_name` | string | ❌ | 시트 이름 | - |
| `sheet_index` | number | ❌ | 시트 인덱스 | - |
| `search_keyword` | string | ✅ | 검색할 키워드 | - |
| `search_direction` | string | ✅ | 검색 방향 | "row" |
| `write_position` | string | ✅ | 작성 시작 위치 | "right" |
| `data` | array | ✅ | 작성할 데이터 (2차원 배열 또는 객체 배열) | - |
| `data_format` | string | ❌ | 데이터 형식: "array" (2D 배열), "object" (객체 배열) | "array" |
| `find_all` | boolean | ❌ | 모든 위치에 쓰기 | false |
| `overwrite` | boolean | ❌ | 기존 값 덮어쓰기 | true |

#### 출력 스키마

```json
{
  "action": "excel-write-range-at-keyword",
  "status": "completed",
  "output": {
    "success": true,
    "execution_id": "exec-123",
    "keyword": "시작",
    "write_position": "below",
    "written_range": "A2:C4",
    "written_count": 9,
    "data_rows": 3,
    "data_columns": 3
  }
}
```

#### 동작 방식

1. **키워드 검색**: 키워드 위치 찾기
2. **작성 시작 위치 계산**: `write_position`에 따라 시작 셀 계산
3. **데이터 형식 변환**:
   - `array`: 2차원 배열을 그대로 사용
   - `object`: 객체 배열을 2차원 배열로 변환
4. **범위 작성**: `Range().Value`를 사용하여 한 번에 작성
5. **결과 반환**: 작성된 범위 정보 반환

#### win32com 구현 예시

```python
# 키워드 찾기
found_positions = find_keyword_positions(...)

for pos in found_positions:
    # 시작 위치 계산
    start_row, start_col = calculate_start_position(pos, write_position)
    
    # 데이터 준비
    if data_format == "object":
        # 객체 배열을 2차원 배열로 변환
        data_array = convert_objects_to_array(data)
    else:
        data_array = data
    
    # 범위 계산
    end_row = start_row + len(data_array) - 1
    end_col = start_col + len(data_array[0]) - 1
    
    # 범위 작성
    range_address = f"{get_column_letter(start_col)}{start_row}:{get_column_letter(end_col)}{end_row}"
    worksheet.Range(range_address).Value = data_array
```

---

## 사용 시나리오

### 시나리오 1: 헤더 행 찾아서 데이터 작성

```
워크플로우:
[엑셀 열기] → [키워드 찾기: "이름"] → [키워드 위치에 쓰기: write_position="below", write_value="홍길동"]
```

**설명**: "이름"이라는 헤더를 찾아서 그 아래 행에 "홍길동"을 작성합니다.

### 시나리오 2: 특정 키워드가 있는 행 삭제

```
워크플로우:
[엑셀 열기] → [키워드 위치 삭제: search_keyword="삭제", delete_type="row", find_all=true]
```

**설명**: "삭제"라는 키워드가 있는 모든 행을 삭제합니다.

### 시나리오 3: 열에서 키워드 찾아서 옆 열에 데이터 작성

```
워크플로우:
[엑셀 열기] → [키워드 위치에 쓰기: search_direction="column", search_keyword="합계", write_position="right", write_value=1000]
```

**설명**: "합계" 열을 찾아서 그 오른쪽 열에 1000을 작성합니다.

### 시나리오 4: 여러 데이터를 한 번에 작성

```
워크플로우:
[엑셀 열기] → [키워드 위치에 범위 쓰기: search_keyword="데이터 시작", write_position="below", data=[[1,2,3],[4,5,6]]]
```

**설명**: "데이터 시작"을 찾아서 그 아래에 2x3 데이터를 작성합니다.

---

## 구현 우선순위

### Phase 1 (높음)
1. **excel-find-keyword** - 키워드 찾기 (기본 기능)
2. **excel-write-at-keyword** - 키워드 위치에 단일 값 쓰기 (가장 일반적)

### Phase 2 (중간)
3. **excel-delete-at-keyword** - 키워드 위치 삭제 (셀/행/열)
4. **excel-write-range-at-keyword** - 키워드 위치에 범위 쓰기

### Phase 3 (낮음)
5. **excel-find-and-replace** - 키워드 찾아서 바꾸기 (기존 excel-replace와 통합 가능)
6. **excel-find-and-format** - 키워드 찾아서 서식 적용

---

## 공통 유틸리티 함수

다음 함수들은 여러 노드에서 공통으로 사용됩니다:

### `find_keyword_positions()`

```python
def find_keyword_positions(
    worksheet,
    search_keyword: str,
    search_direction: str,
    search_range: str | None = None,
    match_type: str = "contains",
    case_sensitive: bool = False,
    find_all: bool = False,
    start_row: int = 1,
    start_column: int = 1
) -> list[dict]:
    """
    키워드 위치 찾기
    
    Returns:
        list[dict]: 찾은 위치 리스트
        [
            {
                "row": 1,
                "column": 1,
                "cell_address": "A1",
                "value": "키워드"
            },
            ...
        ]
    """
    positions = []
    # 구현...
    return positions
```

### `match_keyword()`

```python
def match_keyword(
    cell_value: str,
    search_keyword: str,
    match_type: str,
    case_sensitive: bool
) -> bool:
    """
    키워드 일치 확인
    """
    if not case_sensitive:
        cell_value = cell_value.lower()
        search_keyword = search_keyword.lower()
    
    if match_type == "exact":
        return cell_value == search_keyword
    elif match_type == "partial":
        return cell_value.startswith(search_keyword) or cell_value.endswith(search_keyword)
    elif match_type == "contains":
        return search_keyword in cell_value
    
    return False
```

### `calculate_write_position()`

```python
def calculate_write_position(
    found_row: int,
    found_column: int,
    write_position: str,
    offset_row: int = 0,
    offset_column: int = 0
) -> tuple[int, int]:
    """
    작성 위치 계산
    
    Returns:
        tuple[int, int]: (target_row, target_column)
    """
    target_row = found_row
    target_column = found_column
    
    if write_position == "right":
        target_column += 1
    elif write_position == "left":
        target_column -= 1
    elif write_position == "below":
        target_row += 1
    elif write_position == "above":
        target_row -= 1
    # "same"은 변경 없음
    
    target_row += offset_row
    target_column += offset_column
    
    return (target_row, target_column)
```

### `get_cell_address()`

```python
def get_cell_address(row: int, column: int) -> str:
    """
    행/열 번호를 셀 주소로 변환 (예: 1,1 -> "A1")
    """
    # 구현...
    return "A1"
```

---

## 에러 처리

### 일반적인 에러 케이스

1. **키워드를 찾을 수 없음**
   - `reason: "keyword_not_found"`
   - `message: "키워드 '{keyword}'를 찾을 수 없습니다."`

2. **시트를 찾을 수 없음**
   - `reason: "sheet_not_found"`
   - `message: "시트 '{sheet_name}'를 찾을 수 없습니다."`

3. **작성 위치가 범위를 벗어남**
   - `reason: "position_out_of_range"`
   - `message: "작성 위치가 시트 범위를 벗어났습니다."`

4. **삭제할 항목이 없음**
   - `reason: "nothing_to_delete"`
   - `message: "삭제할 항목을 찾을 수 없습니다."`

---

## 테스트 시나리오

### 테스트 1: 기본 키워드 찾기
```
시트 데이터:
A1: 이름
B1: 나이
C1: 주소

검색: search_keyword="이름", search_direction="row"
예상 결과: A1 위치 반환
```

### 테스트 2: 행에서 키워드 찾아서 오른쪽에 쓰기
```
시트 데이터:
A1: 이름

작업: search_keyword="이름", write_position="right", write_value="홍길동"
예상 결과: B1에 "홍길동" 작성
```

### 테스트 3: 키워드가 있는 행 삭제
```
시트 데이터:
A1: 이름
A2: 삭제
A3: 주소

작업: search_keyword="삭제", delete_type="row"
예상 결과: 2행 삭제, A2는 "주소"가 됨
```

### 테스트 4: 여러 위치 찾기
```
시트 데이터:
A1: 합계
A5: 합계
A10: 합계

검색: search_keyword="합계", find_all=true
예상 결과: 3개 위치 반환
```

---

## 확장 가능성

### 향후 추가 가능한 기능

1. **정규식 지원**: `match_type="regex"`로 정규식 패턴 검색
2. **조건부 검색**: 여러 조건을 조합한 검색 (AND, OR)
3. **검색 결과 필터링**: 찾은 결과 중 일부만 선택
4. **배치 작업**: 여러 키워드에 대한 일괄 작업
5. **템플릿 기반 작성**: 템플릿을 사용한 복잡한 데이터 작성

---

## 참고

- [Excel 제어 기능 목록](./excel-control-capabilities.md)
- [Excel 노드 사용 가이드](../nodes/excel-nodes.md)
- [노드 생성 가이드](../dev/nodes/creating-nodes-python.md)

