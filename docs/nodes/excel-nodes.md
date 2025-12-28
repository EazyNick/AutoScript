# 엑셀 노드 (Excel Nodes)

엑셀 노드는 Microsoft Excel 파일을 열고 닫는 기능을 제공하는 노드입니다.

## 구현된 노드

### excel-open (엑셀 열기 노드)

Excel 파일을 열고 Excel 애플리케이션 인스턴스를 관리하는 노드입니다.

**파일 위치**: `server/nodes/excelnodes/excel_open.py`

**노드 타입**: `excel-open`

**설명**: Windows 환경에서 `win32com.client`를 사용하여 Excel 파일을 엽니다. 열린 Excel 인스턴스는 `ExcelManager`를 통해 관리되며, `execution_id`로 그룹화됩니다.

#### 파라미터

- `file_path` (string, 필수): 열 Excel 파일 경로
- `visible` (boolean, 기본값: true): Excel 창 표시 여부
- `execution_id` (string, 선택): 실행 ID (같은 실행 ID의 Excel 인스턴스를 그룹화)

#### 출력 스키마

```json
{
  "action": "excel-open",
  "status": "completed",
  "output": {
    "success": true,
    "file_path": "C:\\data\\example.xlsx",
    "execution_id": "exec-123",
    "workbook_count": 1
  }
}
```

#### 동작 방식

1. **환경 확인**: `win32com.client`가 사용 가능한지 확인합니다 (Windows 환경)
2. **파일 경로 검증**: 파일 경로가 제공되었는지 확인하고, 파일이 존재하는지 확인합니다
3. **Excel 애플리케이션 열기**: `win32com.client.Dispatch("Excel.Application")`를 사용하여 Excel 애플리케이션을 엽니다
4. **Excel 창 표시 설정**: `visible` 파라미터에 따라 Excel 창을 표시하거나 숨깁니다
5. **워크북 열기**: `Workbooks.Open()`을 사용하여 지정된 파일을 엽니다
6. **인스턴스 저장**: `ExcelManager.store_excel_objects()`를 사용하여 Excel 인스턴스를 저장합니다
   - `execution_id`로 그룹화되어 저장됩니다
   - 같은 `execution_id`의 Excel 인스턴스들은 함께 관리됩니다
7. **결과 반환**: 성공 여부와 파일 정보를 반환합니다

#### Excel 인스턴스 관리

`ExcelManager`는 열린 Excel 인스턴스들을 `execution_id`로 그룹화하여 관리합니다:

```python
# ExcelManager 내부 구조 (개념적)
excel_instances = {
    "exec-123": [
        {"app": excel_app, "workbook": workbook, "file_path": "..."},
        ...
    ],
    "exec-456": [...]
}
```

이렇게 하면 같은 워크플로우 실행에서 열린 여러 Excel 파일들을 함께 관리할 수 있습니다.

#### 코드 예시

```python
@NodeExecutor("excel-open")
async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
    # win32com 확인
    if win32com is None:
        return create_failed_result(
            action="excel-open",
            reason="win32com_not_available",
            message="Windows 환경에서만 사용 가능합니다."
        )
    
    # 파일 경로 추출
    file_path = get_parameter(parameters, "file_path", default="")
    visible = get_parameter(parameters, "visible", default=True)
    execution_id = get_parameter(parameters, "execution_id")
    
    # Excel 애플리케이션 열기
    excel_app = win32com.client.Dispatch("Excel.Application")
    excel_app.Visible = visible
    
    # 워크북 열기
    workbook = excel_app.Workbooks.Open(file_path)
    
    # 인스턴스 저장
    store_excel_objects(execution_id, excel_app, workbook, file_path)
    
    return {
        "action": "excel-open",
        "status": "completed",
        "output": {
            "success": True,
            "file_path": file_path,
            "execution_id": execution_id,
            "workbook_count": 1
        }
    }
```

---

### excel-close (엑셀 닫기 노드)

열린 Excel 파일을 닫고 Excel 애플리케이션을 종료하는 노드입니다.

**파일 위치**: `server/nodes/excelnodes/excel_close.py`

**노드 타입**: `excel-close`

**설명**: 지정된 `execution_id`에 해당하는 모든 Excel 인스턴스를 닫고 종료합니다. 저장 여부를 선택할 수 있습니다.

#### 파라미터

- `execution_id` (string, 필수): 닫을 Excel 인스턴스들의 실행 ID
- `save_changes` (boolean, 기본값: true): 변경사항 저장 여부

#### 출력 스키마

```json
{
  "action": "excel-close",
  "status": "completed",
  "output": {
    "success": true,
    "execution_id": "exec-123",
    "closed_count": 2
  }
}
```

#### 동작 방식

1. **execution_id 확인**: `execution_id`가 제공되었는지 확인합니다
2. **Excel 인스턴스 찾기**: `ExcelManager`에서 해당 `execution_id`의 모든 Excel 인스턴스를 가져옵니다
3. **워크북 닫기**: 각 워크북을 닫습니다
   - `save_changes`가 `true`이면 변경사항을 저장하고 닫습니다
   - `save_changes`가 `false`이면 변경사항을 저장하지 않고 닫습니다
4. **Excel 애플리케이션 종료**: 모든 워크북을 닫은 후 Excel 애플리케이션을 종료합니다
5. **인스턴스 제거**: `ExcelManager`에서 해당 인스턴스들을 제거합니다
6. **결과 반환**: 닫은 인스턴스 개수를 반환합니다

#### 코드 예시

```python
@NodeExecutor("excel-close")
async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
    execution_id = get_parameter(parameters, "execution_id", default="")
    save_changes = get_parameter(parameters, "save_changes", default=True)
    
    # Excel 인스턴스 가져오기
    excel_instances = get_excel_objects(execution_id)
    
    closed_count = 0
    for instance in excel_instances:
        workbook = instance["workbook"]
        excel_app = instance["app"]
        
        # 워크북 닫기
        workbook.Close(SaveChanges=save_changes)
        closed_count += 1
    
    # Excel 애플리케이션 종료
    if excel_instances:
        excel_app = excel_instances[0]["app"]
        excel_app.Quit()
    
    # 인스턴스 제거
    remove_excel_objects(execution_id)
    
    return {
        "action": "excel-close",
        "status": "completed",
        "output": {
            "success": True,
            "execution_id": execution_id,
            "closed_count": closed_count
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
    elif sheet_index is not None:
        selected_sheet = workbook.Worksheets(sheet_index)
    
    # 시트 활성화
    selected_sheet.Activate()
    
    return {
        "action": "excel-select-sheet",
        "status": "completed",
        "output": {
            "success": True,
            "execution_id": execution_id,
            "sheet_name": selected_sheet.Name,
            "sheet_index": sheet_index,
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
│  │  │  입력: {file_path, visible, execution_id} │  │  │
│  │  │  처리:                                      │  │  │
│  │  │    1. win32com 확인                        │  │  │
│  │  │    2. 파일 경로 검증                        │  │  │
│  │  │    3. Excel 애플리케이션 열기               │  │  │
│  │  │    4. 워크북 열기                          │  │  │
│  │  │    5. ExcelManager에 저장                  │  │  │
│  │  │  출력: {success, file_path, execution_id}  │  │  │
│  │  └────────────────────────────────────────────┘  │  │
│  └──────────────────┬───────────────────────────────┘  │
│                     │                                    │
│                     ▼                                    │
│  ┌──────────────────────────────────────────────────┐  │
│  │              ExcelManager                         │  │
│  │  ┌────────────────────────────────────────────┐  │  │
│  │  │  excel_instances: dict[str, list]          │  │  │
│  │  │    "exec-123": [                           │  │  │
│  │  │      {app, workbook, file_path},           │  │  │
│  │  │      {app, workbook, file_path},           │  │  │
│  │  │      ...                                   │  │  │
│  │  │    ]                                        │  │  │
│  │  │    "exec-456": [...]                       │  │  │
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
│  │  │  출력: {success, sheet_name, sheet_index}  │  │  │
│  │  └────────────────────────────────────────────┘  │  │
│  └──────────────────┬───────────────────────────────┘  │
│                     │                                    │
│                     ▼                                    │
│  ┌──────────────────────────────────────────────────┐  │
│  │          엑셀 닫기 노드 (excel-close)              │  │
│  │  ┌────────────────────────────────────────────┐  │  │
│  │  │  입력: {execution_id, save_changes}        │  │  │
│  │  │  처리:                                      │  │  │
│  │  │    1. ExcelManager에서 인스턴스 가져오기    │  │  │
│  │  │    2. 각 워크북 닫기 (저장 여부 선택)        │  │  │
│  │  │    3. Excel 애플리케이션 종료               │  │  │
│  │  │    4. ExcelManager에서 제거                 │  │  │
│  │  │  출력: {success, execution_id, closed_count}│  │  │
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
3. **excel-close** (엑셀 닫기): 열린 Excel 파일을 닫고 Excel 애플리케이션을 종료합니다

## 특징

1. **Windows 전용**: `win32com.client`를 사용하므로 Windows 환경에서만 동작합니다
2. **인스턴스 관리**: `execution_id`로 Excel 인스턴스들을 그룹화하여 관리합니다
3. **여러 파일 지원**: 같은 `execution_id`로 여러 Excel 파일을 열 수 있습니다
4. **시트 선택 지원**: 시트 이름 또는 인덱스로 특정 시트를 선택할 수 있습니다
5. **자동 정리**: `excel-close` 노드로 모든 인스턴스를 한 번에 닫을 수 있습니다
6. **저장 제어**: 닫을 때 변경사항 저장 여부를 선택할 수 있습니다

## 사용 예시

### 워크플로우 예시

#### 기본 워크플로우

```
[시작] → [엑셀 열기] → [대기] → [엑셀 닫기]
         (file_path: C:\data\file1.xlsx)
                              (execution_id: exec-123)
```

이 워크플로우는:
1. 시작 노드로 워크플로우를 시작합니다
2. 엑셀 열기 노드가 `C:\data\file1.xlsx` 파일을 엽니다 (`execution_id: exec-123`)
3. 대기 노드로 잠시 대기합니다
4. 엑셀 닫기 노드가 `exec-123`에 해당하는 모든 Excel 인스턴스를 닫습니다

#### 시트 선택 워크플로우

```
[시작] → [엑셀 열기] → [엑셀 시트 선택] → [엑셀 닫기]
         (file_path: C:\data\file1.xlsx)  (sheet_name: Sheet1)
         (execution_id: exec-123)         (execution_id: exec-123)
                                          (execution_id: exec-123)
```

이 워크플로우는:
1. 시작 노드로 워크플로우를 시작합니다
2. 엑셀 열기 노드가 `C:\data\file1.xlsx` 파일을 엽니다 (`execution_id: exec-123`)
3. 엑셀 시트 선택 노드가 `Sheet1` 시트를 선택합니다 (`execution_id: exec-123`)
4. 엑셀 닫기 노드가 `exec-123`에 해당하는 모든 Excel 인스턴스를 닫습니다

### 여러 파일 열기 예시

```
[시작] → [엑셀 열기] → [엑셀 열기] → [엑셀 닫기]
         (file1.xlsx)   (file2.xlsx)   (모두 닫기)
         (exec-123)     (exec-123)     (exec-123)
```

같은 `execution_id`를 사용하면 여러 파일을 열고, `excel-close` 노드 하나로 모두 닫을 수 있습니다.

## 주의사항

1. **Windows 환경 필수**: Windows 환경에서만 동작합니다
2. **Excel 설치 필요**: Microsoft Excel이 설치되어 있어야 합니다
3. **인스턴스 관리**: `execution_id`를 올바르게 설정하지 않으면 Excel 인스턴스가 정리되지 않을 수 있습니다
4. **파일 경로**: 파일 경로는 절대 경로를 사용하는 것이 안전합니다
5. **동시 실행**: 같은 `execution_id`로 여러 Excel 파일을 열 수 있지만, 같은 파일을 중복으로 열면 에러가 발생할 수 있습니다
6. **엑셀 객체 생명주기**: 엑셀 열기 노드 실행 후 엑셀 객체는 엑셀 닫기 노드가 실행될 때까지 유지됩니다. 각 노드가 별도의 API 호출로 실행되므로, 엑셀 객체는 즉시 정리되지 않습니다.

## 최근 변경사항 (v0.0.6)
- **execution_id 연결 개선**: 엑셀 열기 노드의 출력 `execution_id`를 저장 키로 사용하여, 엑셀 시트 선택 노드에서 정확한 엑셀 객체를 찾을 수 있도록 개선
- **엑셀 객체 생명주기 관리**: 엑셀 닫기 노드가 실행된 경우에만 엑셀 객체를 정리하도록 변경하여, 여러 노드에서 같은 엑셀 객체를 사용할 수 있도록 개선
- **엑셀 닫기 노드 성능 개선**: Excel 종료 대기 로직을 제거하여 엑셀 닫기 노드의 응답 속도 개선
