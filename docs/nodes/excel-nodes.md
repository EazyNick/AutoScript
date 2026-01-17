# 엑셀 노드 (Excel Nodes)

엑셀 노드는 Microsoft Excel 파일을 열고 닫는 기능을 제공하는 노드입니다.

## 구현된 노드

### excel-open (엑셀 열기 노드)

Excel 파일을 열고 Excel 애플리케이션 인스턴스를 관리하는 노드입니다.

**파일 위치**: `server/nodes/excelnodes/excel_open.py`

**노드 타입**: `excel-open`

**설명**: Windows 환경에서 `win32com.client`를 사용하여 Excel 파일을 엽니다. 열린 Excel 인스턴스는 `ExcelManager`를 통해 관리되며, 메타데이터의 `execution_id`로 저장됩니다.

#### 파라미터

- `file_path` (string, 필수): 열 Excel 파일 경로
- `visible` (boolean, 기본값: true): Excel 창 표시 여부

> **참고**: `execution_id`는 파라미터가 아닙니다. 메타데이터(`_execution_id`)에서 자동으로 가져와서 사용됩니다.

#### 출력 스키마

```json
{
  "action": "excel-open",
  "status": "completed",
  "output": {
    "success": true,
    "file_path": "C:\\data\\example.xlsx",
    "visible": true,
    "execution_id": "exec-123"
  }
}
```

**출력 필드 설명:**
- `success`: 성공 여부 (boolean)
- `file_path`: 열린 엑셀 파일 경로 (string)
- `visible`: 엑셀 창 표시 여부 (boolean)
- `execution_id`: 엑셀 실행 ID (string, 다음 노드에서 사용)

#### 동작 방식

1. **execution_id 확인**: 메타데이터에서 `_execution_id`를 가져옵니다 (필수)
2. **파일 경로 검증**: 파일 경로가 제공되었는지 확인하고, 파일이 존재하는지 확인합니다
3. **엑셀 파일 열기**: `excel_manager.open_excel_file()` 공통 함수를 사용하여 엑셀 파일을 엽니다
   - `win32com.client`를 사용하여 Excel 애플리케이션을 엽니다
   - `visible` 파라미터에 따라 Excel 창을 표시하거나 숨깁니다
4. **인스턴스 저장**: `ExcelManager.store_excel_objects()`를 사용하여 Excel 인스턴스를 저장합니다
   - `execution_id`로 저장됩니다
   - 다음 노드에서 이 `execution_id`를 사용하여 엑셀 객체를 찾을 수 있습니다
5. **결과 반환**: 성공 여부, 파일 경로, visible, execution_id를 반환합니다

#### Excel 인스턴스 관리

`ExcelManager`는 열린 Excel 인스턴스들을 `execution_id`로 저장합니다:

```python
# ExcelManager 내부 구조 (개념적)
_excel_objects = {
    "exec-123": {
        "excel_app": excel_app,
        "workbook": workbook,
        "file_path": "..."
    },
    "exec-456": {...}
}
```

각 `execution_id`는 하나의 Excel 인스턴스(애플리케이션 + 워크북)를 저장합니다.

#### 코드 예시

```python
@NodeExecutor("excel-open")
async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
    # 파일 경로 추출
    file_path = get_parameter(parameters, "file_path", default="")
    visible = get_parameter(parameters, "visible", default=True)
    
    # execution_id 가져오기 (메타데이터에서)
    execution_id = parameters.get("_execution_id")
    if not execution_id:
        return create_failed_result(
            action="excel-open",
            reason="execution_id_required",
            message="execution_id가 필요합니다."
        )
    
    # 공통 함수를 사용하여 엑셀 파일 열기
    excel_app, workbook = await open_excel_file(file_path, visible=bool(visible))
    
    # 엑셀 객체 저장
    store_excel_objects(execution_id, excel_app, workbook, file_path)
    
    return {
        "action": "excel-open",
        "status": "completed",
        "output": {
            "success": True,
            "file_path": file_path,
            "visible": bool(visible),
            "execution_id": execution_id
        }
    }
```

---

### excel-close (엑셀 닫기 노드)

열린 Excel 파일을 닫고 Excel 애플리케이션을 종료하는 노드입니다.

**파일 위치**: `server/nodes/excelnodes/excel_close.py`

**노드 타입**: `excel-close`

**설명**: 지정된 `execution_id`에 해당하는 Excel 인스턴스를 닫고 종료합니다. 저장 여부를 선택할 수 있습니다.

#### 파라미터

- `execution_id` (string, 선택): 닫을 Excel 인스턴스들의 실행 ID
  - 이전 노드 출력에서 선택 가능 (기본값: `outdata.output.execution_id`)
  - 직접 입력하거나 이전 노드 출력에서 선택
- `save_changes` (boolean, 기본값: true): 변경사항 저장 여부
  - `true`: 변경사항을 저장하고 닫습니다
  - `false`: 변경사항을 저장하지 않고 닫습니다

> **참고**: `execution_id`가 제공되지 않으면 이전 노드 출력 또는 메타데이터에서 자동으로 가져옵니다.

#### 출력 스키마

```json
{
  "action": "excel-close",
  "status": "completed",
  "output": {
    "success": true,
    "save_changes": true
  }
}
```

**출력 필드 설명:**
- `success`: 성공 여부 (boolean)
- `save_changes`: 변경사항 저장 여부 (boolean)

#### 동작 방식

1. **execution_id 확인**: `execution_id`를 가져옵니다 (우선순위: 사용자 입력 > 이전 노드 출력 > 메타데이터)
2. **Excel 인스턴스 찾기**: `ExcelManager`에서 해당 `execution_id`의 Excel 인스턴스를 가져옵니다
3. **워크북 닫기**: 워크북을 닫습니다
   - `save_changes`가 `true`이면 변경사항을 저장하고 닫습니다
   - `save_changes`가 `false`이면 변경사항을 저장하지 않고 닫습니다
4. **Excel 애플리케이션 종료**: 워크북을 닫은 후 Excel 애플리케이션을 종료합니다
5. **인스턴스 제거**: `ExcelManager`에서 해당 인스턴스를 제거합니다
6. **결과 반환**: 성공 여부와 저장 여부를 반환합니다

#### 코드 예시

```python
@NodeExecutor("excel-close")
async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
    save_changes = get_parameter(parameters, "save_changes", default=False)
    
    # execution_id 가져오기 (우선순위: 사용자 입력 > 이전 노드 출력 > 메타데이터)
    execution_id = (
        get_parameter(parameters, "execution_id", default="")
        or parameters.get("_execution_id_from_prev")
        or parameters.get("_execution_id")
    )
    
    # Excel 인스턴스 가져오기
    excel_data = get_excel_objects(execution_id)
    if not excel_data:
        return create_failed_result(...)
    
    # 워크북 닫기
    success = close_excel_objects(execution_id, save_changes=bool(save_changes))
    
    return {
        "action": "excel-close",
        "status": "completed",
        "output": {
            "success": True,
            "save_changes": bool(save_changes)
        }
    }
```

---

### excel-select-sheet (엑셀 시트 선택 노드)

엑셀 열기 노드로 열린 워크북의 특정 시트를 선택하는 노드입니다.

**파일 위치**: `server/nodes/excelnodes/excel_select_sheet.py`

**노드 타입**: `excel-select-sheet`

**설명**: Windows 환경에서 `win32com.client`를 사용하여 엑셀 워크북의 특정 시트를 선택하고 활성화합니다. 엑셀 열기 노드 이후에 사용해야 합니다.

#### 파라미터

- `execution_id` (string, 필수): 엑셀 실행 ID (엑셀 열기 노드의 출력에서 선택 가능, 기본값: `outdata.output.execution_id`)
- `sheet_name` (string, 선택): 시트 이름 (sheet_index와 둘 중 하나는 필수)
- `sheet_index` (number, 선택): 시트 인덱스 (1부터 시작, sheet_name과 둘 중 하나는 필수)

#### 출력 스키마

```json
{
  "action": "excel-select-sheet",
  "status": "completed",
  "output": {
    "success": true,
    "execution_id": "exec-123",
    "sheet_name": "Sheet1",
    "sheet_index": 1,
    "selected_by": "name"
  }
}
```

#### 동작 방식

1. **execution_id 확인**: `execution_id`가 제공되었는지 확인합니다
2. **엑셀 객체 찾기**: `ExcelManager`에서 해당 `execution_id`의 엑셀 객체를 가져옵니다
   - 찾지 못한 경우 메타데이터의 `_execution_id`도 시도합니다
3. **시트 식별자 확인**: `sheet_name` 또는 `sheet_index` 중 하나가 제공되었는지 확인합니다
4. **시트 선택**:
   - `sheet_name`이 제공된 경우: 시트 이름으로 시트를 찾아 선택합니다
   - `sheet_index`가 제공된 경우: 시트 인덱스(1부터 시작)로 시트를 찾아 선택합니다
   - 시트 인덱스가 범위를 벗어나면 에러를 반환합니다
5. **시트 활성화**: 선택된 시트를 활성화합니다 (`Activate()`)
6. **결과 반환**: 선택된 시트 정보를 반환합니다

#### 코드 예시

```python
@NodeExecutor("excel-select-sheet")
async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
    execution_id = get_parameter(parameters, "execution_id", default="")
    sheet_name = get_parameter(parameters, "sheet_name", default="")
    sheet_index = get_parameter(parameters, "sheet_index")
    
    # execution_id 검증
    if not execution_id:
        # 메타데이터에서도 시도
        execution_id = parameters.get("_execution_id")
    
    # 엑셀 객체 가져오기
    excel_data = get_excel_objects(execution_id)
    if not excel_data:
        return create_failed_result(
            action="excel-select-sheet",
            reason="excel_objects_not_found",
            message="엑셀 열기 노드를 먼저 실행하세요."
        )
    
    workbook = excel_data.get("workbook")
    
    # 시트 선택
    if sheet_name:
        selected_sheet = workbook.Worksheets(sheet_name)
        actual_sheet_name = selected_sheet.Name
    elif sheet_index is not None:
        sheet_index_int = int(sheet_index)
        selected_sheet = workbook.Worksheets(sheet_index_int)
        actual_sheet_name = selected_sheet.Name
    else:
        return create_failed_result(
            action="excel-select-sheet",
            reason="sheet_identifier_required",
            message="시트 이름 또는 시트 인덱스 중 하나는 필수입니다."
        )
    
    # 시트 활성화
    selected_sheet.Activate()
    
    return {
        "action": "excel-select-sheet",
        "status": "completed",
        "output": {
            "success": True,
            "execution_id": execution_id,
            "sheet_name": actual_sheet_name,
            "sheet_index": sheet_index if sheet_index is not None else None,
            "selected_by": "name" if sheet_name else "index"
        }
    }
```

## 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────┐
│              엑셀 노드 실행 흐름                          │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │          엑셀 열기 노드 (excel-open)              │  │
│  │  ┌────────────────────────────────────────────┐  │  │
│  │  │  입력: {file_path, visible}                │  │  │
│  │  │  처리:                                      │  │  │
│  │  │    1. execution_id 확인 (메타데이터)        │  │  │
│  │  │    2. 파일 경로 검증                        │  │  │
│  │  │    3. open_excel_file() 공통 함수 사용     │  │  │
│  │  │    4. ExcelManager에 저장                  │  │  │
│  │  │  출력: {success, file_path, visible, execution_id}│  │  │
│  │  └────────────────────────────────────────────┘  │  │
│  └──────────────────┬───────────────────────────────┘  │
│                     │                                    │
│                     ▼                                    │
│  ┌──────────────────────────────────────────────────┐  │
│  │              ExcelManager                         │  │
│  │  ┌────────────────────────────────────────────┐  │  │
│  │  │  _excel_objects: dict[str, dict]          │  │  │
│  │  │    "exec-123": {                           │  │  │
│  │  │      excel_app, workbook, file_path        │  │  │
│  │  │    }                                        │  │  │
│  │  │    "exec-456": {...}                       │  │  │
│  │  └────────────────────────────────────────────┘  │  │
│  └──────────────────┬───────────────────────────────┘  │
│                     │                                    │
│                     ▼                                    │
│  ┌──────────────────────────────────────────────────┐  │
│  │      엑셀 시트 선택 노드 (excel-select-sheet)     │  │
│  │  ┌────────────────────────────────────────────┐  │  │
│  │  │  입력: {execution_id, sheet_name/index}   │  │  │
│  │  │  처리:                                      │  │  │
│  │  │    1. ExcelManager에서 엑셀 객체 가져오기  │  │  │
│  │  │    2. 시트 이름 또는 인덱스로 시트 찾기    │  │  │
│  │  │    3. 시트 활성화                          │  │  │
│  │  │  출력: {success, execution_id, sheet_name, sheet_index, selected_by}│  │  │
│  │  └────────────────────────────────────────────┘  │  │
│  └──────────────────┬───────────────────────────────┘  │
│                     │                                    │
│                     ▼                                    │
│  ┌──────────────────────────────────────────────────┐  │
│  │          엑셀 닫기 노드 (excel-close)              │  │
│  │  ┌────────────────────────────────────────────┐  │  │
│  │  │  입력: {execution_id(선택), save_changes}  │  │  │
│  │  │  처리:                                      │  │  │
│  │  │    1. execution_id 확인 (우선순위: 사용자 입력 > 이전 노드 출력 > 메타데이터)│  │  │
│  │  │    2. ExcelManager에서 인스턴스 가져오기    │  │  │
│  │  │    3. 워크북 닫기 (저장 여부 선택)          │  │  │
│  │  │    4. Excel 애플리케이션 종료               │  │  │
│  │  │    5. ExcelManager에서 제거                 │  │  │
│  │  │  출력: {success, save_changes}             │  │  │
│  │  └────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
└──────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│              외부 의존성                                 │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │  win32com.client (pywin32)                       │  │
│  │  - Dispatch("Excel.Application")                 │  │
│  │  - Workbooks.Open()                             │  │
│  │  - Workbook.Close()                             │  │
│  │  - Application.Quit()                            │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## 구현된 노드 목록

1. **excel-open** (엑셀 열기): Excel 파일을 열고 Excel 애플리케이션 인스턴스를 생성합니다
2. **excel-select-sheet** (엑셀 시트 선택): 열린 워크북의 특정 시트를 선택하고 활성화합니다
3. **excel-compare** (엑셀 비교): 두 개의 엑셀 파일을 비교하여 원본 엑셀의 값을 대상 엑셀에 복사합니다 (종합 노드)
4. **excel-close** (엑셀 닫기): 열린 Excel 파일을 닫고 Excel 애플리케이션을 종료합니다

## 특징

1. **Windows 전용**: `win32com.client`를 사용하므로 Windows 환경에서만 동작합니다
2. **인스턴스 관리**: `execution_id`로 Excel 인스턴스를 저장하고 관리합니다
4. **시트 선택 지원**: 시트 이름 또는 인덱스로 특정 시트를 선택할 수 있습니다
5. **자동 정리**: `excel-close` 노드로 모든 인스턴스를 한 번에 닫을 수 있습니다
6. **저장 제어**: 닫을 때 변경사항 저장 여부를 선택할 수 있습니다

## 사용 예시

### 워크플로우 예시

#### 기본 워크플로우

```
[시작] → [엑셀 열기] → [대기] → [엑셀 닫기]
         (file_path: C:\data\file1.xlsx)
                              (execution_id: 이전 노드 출력에서 선택)
```

이 워크플로우는:
1. 시작 노드로 워크플로우를 시작합니다
2. 엑셀 열기 노드가 `C:\data\file1.xlsx` 파일을 엽니다 (메타데이터의 `execution_id` 사용)
3. 대기 노드로 잠시 대기합니다
4. 엑셀 닫기 노드가 이전 노드 출력에서 `execution_id`를 가져와서 Excel 인스턴스를 닫습니다

#### 시트 선택 워크플로우

```
[시작] → [엑셀 열기] → [엑셀 시트 선택] → [엑셀 닫기]
         (file_path: C:\data\file1.xlsx)  (sheet_name: Sheet1)
                                           (execution_id: 이전 노드 출력에서 선택)
```

이 워크플로우는:
1. 시작 노드로 워크플로우를 시작합니다
2. 엑셀 열기 노드가 `C:\data\file1.xlsx` 파일을 엽니다 (메타데이터의 `execution_id` 사용)
3. 엑셀 시트 선택 노드가 `Sheet1` 시트를 선택합니다 (이전 노드 출력에서 `execution_id` 선택)
4. 엑셀 닫기 노드가 이전 노드 출력에서 `execution_id`를 가져와서 Excel 인스턴스를 닫습니다

### 여러 파일 열기 예시

```
[시작] → [엑셀 열기] → [엑셀 열기] → [엑셀 닫기] → [엑셀 닫기]
         (file1.xlsx)   (file2.xlsx)   (execution_id: 이전 노드 출력)
         (exec-123)     (exec-456)     (execution_id: 이전 노드 출력)
```

> **참고**: 현재 구현에서는 각 `execution_id`당 하나의 Excel 인스턴스만 저장됩니다. 여러 파일을 열려면 서로 다른 `execution_id`를 사용해야 하며, 각각 별도로 닫아야 합니다.

## 주의사항

1. **Windows 환경 필수**: Windows 환경에서만 동작합니다
2. **Excel 설치 필요**: Microsoft Excel이 설치되어 있어야 합니다
3. **인스턴스 관리**: `execution_id`는 메타데이터에서 자동으로 가져오거나 이전 노드 출력에서 선택할 수 있습니다
4. **파일 경로**: 파일 경로는 절대 경로를 사용하는 것이 안전합니다
5. **엑셀 객체 생명주기**: 엑셀 열기 노드 실행 후 엑셀 객체는 엑셀 닫기 노드가 실행될 때까지 유지됩니다. 각 노드가 별도의 API 호출로 실행되므로, 엑셀 객체는 즉시 정리되지 않습니다
6. **execution_id 전달**: 엑셀 열기 노드의 출력에서 `execution_id`를 가져와서 다음 노드(엑셀 시트 선택, 엑셀 닫기)에서 사용해야 합니다

### excel-compare (엑셀 비교 노드)

두 개의 엑셀 파일을 비교하여 원본 엑셀의 값을 대상 엑셀에 복사하는 종합 노드입니다.

**파일 위치**: `server/nodes/excelnodes/excel_compare.py`

**노드 타입**: `excel-compare`

**설명**: 엑셀 열기, 시트 선택, 비교, 닫기를 모두 수행하는 종합 노드입니다. 별도의 엑셀 열기/닫기 노드가 필요하지 않습니다.

#### 파라미터

- `source_file_path` (string, 필수): 원본 엑셀 파일 경로
- `target_file_path` (string, 필수): 대상 엑셀 파일 경로
- `source_sheet_name` (string, 선택, 기본값: "Sheet1"): 원본 엑셀 시트 이름
- `target_sheet_name` (string, 선택, 기본값: "Sheet1"): 대상 엑셀 시트 이름
- `visible` (boolean, 기본값: true): 엑셀 창 표시 여부
- `save_changes` (boolean, 기본값: true): 변경사항 저장 여부
- `match_columns` (array, 필수): 비교할 열 이름 배열 (기본값: ["level1"])
- `automation_column` (string, 필수, 기본값: "자동화/n메뉴얼"): 복사할 값을 가진 열 이름

#### 출력 스키마

```json
{
  "action": "excel-compare",
  "status": "completed",
  "output": {
    "success": true,
    "matched_count": 10,
    "updated_count": 10,
    "source_file_path": "C:\\data\\source.xlsx",
    "target_file_path": "C:\\data\\target.xlsx"
  }
}
```

**출력 필드 설명:**
- `success`: 성공 여부 (boolean)
- `matched_count`: 매칭된 행 개수 (number)
- `updated_count`: 업데이트된 행 개수 (number)
- `source_file_path`: 원본 엑셀 파일 경로 (string)
- `target_file_path`: 대상 엑셀 파일 경로 (string)

#### 동작 방식

1. **원본 엑셀 열기**: `source_file_path`로 원본 엑셀 파일을 엽니다 (`open_excel_file()` 공통 함수 사용)
2. **원본 시트 선택**: `source_sheet_name`으로 원본 시트를 선택합니다
3. **대상 엑셀 열기**: `target_file_path`로 대상 엑셀 파일을 엽니다 (`open_excel_file()` 공통 함수 사용)
4. **대상 시트 선택**: `target_sheet_name`으로 대상 시트를 선택합니다
5. **데이터 비교 및 복사**: 
   - 2행이 헤더, 3행부터 데이터입니다
   - `match_columns` 배열의 각 열 값을 합쳐서 키를 생성합니다 (예: "level1|level2|level3")
   - 원본 엑셀을 해시맵으로 인덱싱합니다
   - 대상 엑셀에서 매칭되는 행을 찾아 `automation_column` 값을 복사합니다
6. **엑셀 닫기**: 원본 엑셀은 저장하지 않고 닫고, 대상 엑셀은 `save_changes` 옵션에 따라 저장 후 닫습니다

#### 특징

- **종합 노드**: 엑셀 열기부터 닫기까지 모든 작업을 한 노드에서 처리
- **파일 경로 직접 입력**: `execution_id` 대신 파일 경로를 직접 입력
- **UI 파일 선택 지원**: 파라미터에 파일 선택 버튼이 표시되어 PC에서 직접 선택 가능

---

## 최근 변경사항

### v0.0.7 (2026-01-07)
- **엑셀 비교 노드 종합 노드화**: 파라미터로 파일 경로를 받아서 내부에서 열기, 비교, 닫기를 모두 수행하도록 변경
- **파일 선택 UI 추가**: 엑셀 비교 노드 파라미터에 파일 선택 버튼 추가
- **경고 메시지 제거**: "엑셀 열기 노드 필요" 경고 메시지 제거
- **엑셀 열기 로직 모듈화**: `excel_manager.open_excel_file()` 공통 함수로 엑셀 열기 로직 통합
- **코드 중복 제거**: 엑셀 열기 노드와 엑셀 비교 노드의 중복 코드 제거

### v0.0.6
- **execution_id 연결 개선**: 엑셀 열기 노드의 출력 `execution_id`를 저장 키로 사용하여, 엑셀 시트 선택 노드에서 정확한 엑셀 객체를 찾을 수 있도록 개선
- **엑셀 객체 생명주기 관리**: 엑셀 닫기 노드가 실행된 경우에만 엑셀 객체를 정리하도록 변경하여, 여러 노드에서 같은 엑셀 객체를 사용할 수 있도록 개선
- **엑셀 닫기 노드 성능 개선**: Excel 종료 대기 로직을 제거하여 엑셀 닫기 노드의 응답 속도 개선
