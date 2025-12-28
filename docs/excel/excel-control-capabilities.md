**최신 수정일자: 2025.12.21**

# Excel 제어 기능 목록 (win32com 기반)

이 문서는 win32com을 사용하여 Excel을 제어할 수 있는 모든 기능을 정리한 것입니다. 각 기능은 향후 노드로 구현될 수 있습니다.

## 현재 구현된 노드

### ✅ 구현 완료

1. **excel-open** (엑셀 열기)
   - Excel 파일 열기
   - Excel 애플리케이션 인스턴스 관리
   - 파일 경로: `server/nodes/excelnodes/excel_open.py`

2. **excel-select-sheet** (엑셀 시트 선택)
   - 워크북의 특정 시트 선택 및 활성화
   - 시트 이름 또는 인덱스로 선택
   - 파일 경로: `server/nodes/excelnodes/excel_select_sheet.py`

3. **excel-close** (엑셀 닫기)
   - 열린 Excel 파일 닫기
   - 변경사항 저장 옵션
   - 파일 경로: `server/nodes/excelnodes/excel_close.py`

---

## 키워드 검색 및 작업 노드 (Keyword Search & Operation Nodes)

### 📋 설계 문서

**[excel-keyword-search-design.md](./excel-keyword-search-design.md)**: 키워드 검색 기반 노드들의 상세 설계 문서
- excel-find-keyword: 키워드 찾기
- excel-write-at-keyword: 키워드 위치에 쓰기
- excel-delete-at-keyword: 키워드 위치 삭제
- excel-write-range-at-keyword: 키워드 위치에 범위 쓰기

---

## 1. 파일 관리 (File Management)

### 1.1 워크북 관련

| 기능 | 설명 | win32com 메서드/속성 | 우선순위 | 상태 |
|------|------|---------------------|----------|------|
| **excel-open** | Excel 파일 열기 | `Workbooks.Open()` | ✅ 완료 | ✅ |
| **excel-create** | 새 워크북 생성 | `Workbooks.Add()` | 높음 | ⏳ 예정 |
| **excel-save** | 워크북 저장 | `Workbook.Save()` | 높음 | ⏳ 예정 |
| **excel-save-as** | 다른 이름으로 저장 | `Workbook.SaveAs()` | 높음 | ⏳ 예정 |
| **excel-close** | 워크북 닫기 | `Workbook.Close()` | ✅ 완료 | ✅ |
| **excel-get-info** | 워크북 정보 가져오기 | `Workbook.Name`, `Workbook.Path`, `Workbook.FullName` | 중간 | ⏳ 예정 |

### 1.2 파일 속성

| 기능 | 설명 | win32com 메서드/속성 | 우선순위 | 상태 |
|------|------|---------------------|----------|------|
| **excel-check-file-exists** | 파일 존재 여부 확인 | `os.path.exists()` | 낮음 | ⏳ 예정 |
| **excel-get-file-properties** | 파일 속성 가져오기 | `Workbook.BuiltinDocumentProperties` | 낮음 | ⏳ 예정 |

---

## 2. 시트 관리 (Sheet Management)

### 2.1 시트 기본 작업

| 기능 | 설명 | win32com 메서드/속성 | 우선순위 | 상태 |
|------|------|---------------------|----------|------|
| **excel-select-sheet** | 시트 선택 및 활성화 | `Worksheets(sheet_name).Activate()` | ✅ 완료 | ✅ |
| **excel-add-sheet** | 새 시트 추가 | `Worksheets.Add()` | 높음 | ⏳ 예정 |
| **excel-delete-sheet** | 시트 삭제 | `Worksheet.Delete()` | 높음 | ⏳ 예정 |
| **excel-rename-sheet** | 시트 이름 변경 | `Worksheet.Name = "new_name"` | 높음 | ⏳ 예정 |
| **excel-copy-sheet** | 시트 복사 | `Worksheet.Copy()` | 중간 | ⏳ 예정 |
| **excel-move-sheet** | 시트 이동 | `Worksheet.Move()` | 중간 | ⏳ 예정 |
| **excel-get-sheet-list** | 시트 목록 가져오기 | `Worksheets.Count`, `Worksheets(i).Name` | 중간 | ⏳ 예정 |
| **excel-get-sheet-count** | 시트 개수 가져오기 | `Worksheets.Count` | 낮음 | ⏳ 예정 |

### 2.2 시트 속성

| 기능 | 설명 | win32com 메서드/속성 | 우선순위 | 상태 |
|------|------|---------------------|----------|------|
| **excel-set-sheet-visible** | 시트 표시/숨김 | `Worksheet.Visible` | 중간 | ⏳ 예정 |
| **excel-set-sheet-tab-color** | 시트 탭 색상 설정 | `Worksheet.Tab.Color` | 낮음 | ⏳ 예정 |
| **excel-protect-sheet** | 시트 보호 | `Worksheet.Protect()` | 중간 | ⏳ 예정 |
| **excel-unprotect-sheet** | 시트 보호 해제 | `Worksheet.Unprotect()` | 중간 | ⏳ 예정 |

---

## 3. 셀 데이터 작업 (Cell Data Operations)

### 3.1 셀 읽기/쓰기

| 기능 | 설명 | win32com 메서드/속성 | 우선순위 | 상태 |
|------|------|---------------------|----------|------|
| **excel-read-cell** | 셀 값 읽기 | `Cells(row, col).Value` 또는 `Range("A1").Value` | 높음 | ⏳ 예정 |
| **excel-write-cell** | 셀 값 쓰기 | `Cells(row, col).Value = value` | 높음 | ⏳ 예정 |
| **excel-read-range** | 범위 값 읽기 | `Range("A1:C3").Value` | 높음 | ⏳ 예정 |
| **excel-write-range** | 범위 값 쓰기 | `Range("A1:C3").Value = data` | 높음 | ⏳ 예정 |
| **excel-clear-cell** | 셀 내용 지우기 | `Range("A1").Clear()` | 중간 | ⏳ 예정 |
| **excel-clear-range** | 범위 내용 지우기 | `Range("A1:C3").Clear()` | 중간 | ⏳ 예정 |
| **excel-delete-cell** | 셀 삭제 (위로/왼쪽으로 이동) | `Range("A1").Delete()` | 중간 | ⏳ 예정 |

### 3.2 셀 찾기/바꾸기

| 기능 | 설명 | win32com 메서드/속성 | 우선순위 | 상태 |
|------|------|---------------------|----------|------|
| **excel-find-keyword** | 키워드 찾기 (행/열 검색) | `Range.Find()`, `Cells()` 순회 | 높음 | ⏳ 예정 |
| **excel-find** | 값 찾기 | `Range.Find()` | 높음 | ⏳ 예정 |
| **excel-find-all** | 모든 값 찾기 | `Range.FindNext()` | 중간 | ⏳ 예정 |
| **excel-replace** | 값 바꾸기 | `Range.Replace()` | 높음 | ⏳ 예정 |
| **excel-write-at-keyword** | 키워드 위치에 쓰기 | `Cells().Value` | 높음 | ⏳ 예정 |
| **excel-delete-at-keyword** | 키워드 위치 삭제 | `Range.Delete()`, `Rows.Delete()`, `Columns.Delete()` | 높음 | ⏳ 예정 |
| **excel-write-range-at-keyword** | 키워드 위치에 범위 쓰기 | `Range().Value` | 중간 | ⏳ 예정 |

### 3.3 셀 복사/붙여넣기

| 기능 | 설명 | win32com 메서드/속성 | 우선순위 | 상태 |
|------|------|---------------------|----------|------|
| **excel-copy-cell** | 셀 복사 | `Range("A1").Copy()` | 높음 | ⏳ 예정 |
| **excel-copy-range** | 범위 복사 | `Range("A1:C3").Copy()` | 높음 | ⏳ 예정 |
| **excel-paste** | 붙여넣기 | `Range("B1").Paste()` | 높음 | ⏳ 예정 |
| **excel-paste-special** | 선택적 붙여넣기 | `Range("B1").PasteSpecial()` | 중간 | ⏳ 예정 |
| **excel-cut** | 잘라내기 | `Range("A1").Cut()` | 중간 | ⏳ 예정 |

---

## 4. 행/열 작업 (Row/Column Operations)

### 4.1 행 작업

| 기능 | 설명 | win32com 메서드/속성 | 우선순위 | 상태 |
|------|------|---------------------|----------|------|
| **excel-insert-row** | 행 삽입 | `Rows(row).Insert()` | 높음 | ⏳ 예정 |
| **excel-insert-rows** | 여러 행 삽입 | `Rows("2:5").Insert()` | 높음 | ⏳ 예정 |
| **excel-delete-row** | 행 삭제 | `Rows(row).Delete()` | 높음 | ⏳ 예정 |
| **excel-delete-rows** | 여러 행 삭제 | `Rows("2:5").Delete()` | 높음 | ⏳ 예정 |
| **excel-hide-row** | 행 숨기기 | `Rows(row).Hidden = True` | 중간 | ⏳ 예정 |
| **excel-unhide-row** | 행 표시 | `Rows(row).Hidden = False` | 중간 | ⏳ 예정 |
| **excel-set-row-height** | 행 높이 설정 | `Rows(row).RowHeight = height` | 중간 | ⏳ 예정 |
| **excel-get-row-height** | 행 높이 가져오기 | `Rows(row).RowHeight` | 낮음 | ⏳ 예정 |
| **excel-auto-fit-row** | 행 높이 자동 조정 | `Rows(row).AutoFit()` | 중간 | ⏳ 예정 |

### 4.2 열 작업

| 기능 | 설명 | win32com 메서드/속성 | 우선순위 | 상태 |
|------|------|---------------------|----------|------|
| **excel-insert-column** | 열 삽입 | `Columns(col).Insert()` | 높음 | ⏳ 예정 |
| **excel-insert-columns** | 여러 열 삽입 | `Columns("B:D").Insert()` | 높음 | ⏳ 예정 |
| **excel-delete-column** | 열 삭제 | `Columns(col).Delete()` | 높음 | ⏳ 예정 |
| **excel-delete-columns** | 여러 열 삭제 | `Columns("B:D").Delete()` | 높음 | ⏳ 예정 |
| **excel-hide-column** | 열 숨기기 | `Columns(col).Hidden = True` | 중간 | ⏳ 예정 |
| **excel-unhide-column** | 열 표시 | `Columns(col).Hidden = False` | 중간 | ⏳ 예정 |
| **excel-set-column-width** | 열 너비 설정 | `Columns(col).ColumnWidth = width` | 중간 | ⏳ 예정 |
| **excel-get-column-width** | 열 너비 가져오기 | `Columns(col).ColumnWidth` | 낮음 | ⏳ 예정 |
| **excel-auto-fit-column** | 열 너비 자동 조정 | `Columns(col).AutoFit()` | 중간 | ⏳ 예정 |

---

## 5. 셀 서식 (Cell Formatting)

### 5.1 텍스트 서식

| 기능 | 설명 | win32com 메서드/속성 | 우선순위 | 상태 |
|------|------|---------------------|----------|------|
| **excel-set-font-name** | 글꼴 이름 설정 | `Range("A1").Font.Name = "Arial"` | 중간 | ⏳ 예정 |
| **excel-set-font-size** | 글꼴 크기 설정 | `Range("A1").Font.Size = 12` | 중간 | ⏳ 예정 |
| **excel-set-font-bold** | 글꼴 굵게 | `Range("A1").Font.Bold = True` | 중간 | ⏳ 예정 |
| **excel-set-font-italic** | 글꼴 기울임 | `Range("A1").Font.Italic = True` | 중간 | ⏳ 예정 |
| **excel-set-font-underline** | 글꼴 밑줄 | `Range("A1").Font.Underline = True` | 중간 | ⏳ 예정 |
| **excel-set-font-color** | 글꼴 색상 설정 | `Range("A1").Font.Color = RGB(255,0,0)` | 중간 | ⏳ 예정 |
| **excel-set-cell-alignment** | 셀 정렬 설정 | `Range("A1").HorizontalAlignment`, `VerticalAlignment` | 중간 | ⏳ 예정 |

### 5.2 셀 배경/테두리

| 기능 | 설명 | win32com 메서드/속성 | 우선순위 | 상태 |
|------|------|---------------------|----------|------|
| **excel-set-cell-background** | 셀 배경색 설정 | `Range("A1").Interior.Color = RGB(255,255,0)` | 중간 | ⏳ 예정 |
| **excel-set-cell-border** | 셀 테두리 설정 | `Range("A1").Borders.LineStyle` | 중간 | ⏳ 예정 |
| **excel-apply-number-format** | 숫자 형식 적용 | `Range("A1").NumberFormat = "0.00"` | 중간 | ⏳ 예정 |
| **excel-apply-date-format** | 날짜 형식 적용 | `Range("A1").NumberFormat = "yyyy-mm-dd"` | 중간 | ⏳ 예정 |

### 5.3 조건부 서식

| 기능 | 설명 | win32com 메서드/속성 | 우선순위 | 상태 |
|------|------|---------------------|----------|------|
| **excel-add-conditional-format** | 조건부 서식 추가 | `Range("A1:C10").FormatConditions.Add()` | 낮음 | ⏳ 예정 |
| **excel-remove-conditional-format** | 조건부 서식 제거 | `Range("A1:C10").FormatConditions.Delete()` | 낮음 | ⏳ 예정 |

---

## 6. 데이터 작업 (Data Operations)

### 6.1 정렬 및 필터

| 기능 | 설명 | win32com 메서드/속성 | 우선순위 | 상태 |
|------|------|---------------------|----------|------|
| **excel-sort** | 데이터 정렬 | `Range("A1:C10").Sort()` | 높음 | ⏳ 예정 |
| **excel-auto-filter** | 자동 필터 적용 | `Range("A1:C10").AutoFilter()` | 높음 | ⏳ 예정 |
| **excel-remove-filter** | 필터 제거 | `Range("A1:C10").AutoFilterMode = False` | 중간 | ⏳ 예정 |
| **excel-advanced-filter** | 고급 필터 적용 | `Range("A1:C10").AdvancedFilter()` | 낮음 | ⏳ 예정 |

### 6.2 데이터 유효성 검사

| 기능 | 설명 | win32com 메서드/속성 | 우선순위 | 상태 |
|------|------|---------------------|----------|------|
| **excel-add-data-validation** | 데이터 유효성 검사 추가 | `Range("A1").Validation.Add()` | 중간 | ⏳ 예정 |
| **excel-remove-data-validation** | 데이터 유효성 검사 제거 | `Range("A1").Validation.Delete()` | 중간 | ⏳ 예정 |

### 6.3 데이터 가져오기/내보내기

| 기능 | 설명 | win32com 메서드/속성 | 우선순위 | 상태 |
|------|------|---------------------|----------|------|
| **excel-import-csv** | CSV 파일 가져오기 | `Workbook.OpenText()` | 중간 | ⏳ 예정 |
| **excel-export-csv** | CSV 파일로 내보내기 | `Workbook.SaveAs(FileFormat=6)` | 중간 | ⏳ 예정 |
| **excel-import-text** | 텍스트 파일 가져오기 | `Workbook.OpenText()` | 낮음 | ⏳ 예정 |

---

## 7. 차트 작업 (Chart Operations)

### 7.1 차트 생성 및 수정

| 기능 | 설명 | win32com 메서드/속성 | 우선순위 | 상태 |
|------|------|---------------------|----------|------|
| **excel-create-chart** | 차트 생성 | `Shapes.AddChart2()` | 중간 | ⏳ 예정 |
| **excel-set-chart-data** | 차트 데이터 범위 설정 | `Chart.SetSourceData()` | 중간 | ⏳ 예정 |
| **excel-set-chart-title** | 차트 제목 설정 | `Chart.ChartTitle.Text` | 중간 | ⏳ 예정 |
| **excel-set-chart-type** | 차트 타입 설정 | `Chart.ChartType` | 중간 | ⏳ 예정 |
| **excel-delete-chart** | 차트 삭제 | `Chart.Delete()` | 낮음 | ⏳ 예정 |

---

## 8. 피벗 테이블 (Pivot Table)

| 기능 | 설명 | win32com 메서드/속성 | 우선순위 | 상태 |
|------|------|---------------------|----------|------|
| **excel-create-pivot-table** | 피벗 테이블 생성 | `PivotCaches().Create()` | 낮음 | ⏳ 예정 |
| **excel-update-pivot-table** | 피벗 테이블 업데이트 | `PivotTable.RefreshTable()` | 낮음 | ⏳ 예정 |
| **excel-delete-pivot-table** | 피벗 테이블 삭제 | `PivotTable.Delete()` | 낮음 | ⏳ 예정 |

---

## 9. 매크로 및 VBA (Macro & VBA)

| 기능 | 설명 | win32com 메서드/속성 | 우선순위 | 상태 |
|------|------|---------------------|----------|------|
| **excel-run-macro** | 매크로 실행 | `Application.Run("MacroName")` | 중간 | ⏳ 예정 |
| **excel-check-macro-enabled** | 매크로 사용 가능 여부 확인 | `Workbook.HasVBProject` | 낮음 | ⏳ 예정 |

---

## 10. 인쇄 및 페이지 설정 (Print & Page Setup)

### 10.1 인쇄 설정

| 기능 | 설명 | win32com 메서드/속성 | 우선순위 | 상태 |
|------|------|---------------------|----------|------|
| **excel-print** | 인쇄 | `Worksheet.PrintOut()` | 중간 | ⏳ 예정 |
| **excel-print-preview** | 인쇄 미리보기 | `Worksheet.PrintPreview()` | 낮음 | ⏳ 예정 |
| **excel-set-print-area** | 인쇄 영역 설정 | `Worksheet.PageSetup.PrintArea` | 중간 | ⏳ 예정 |
| **excel-set-page-orientation** | 용지 방향 설정 | `Worksheet.PageSetup.Orientation` | 중간 | ⏳ 예정 |
| **excel-set-page-size** | 용지 크기 설정 | `Worksheet.PageSetup.PaperSize` | 중간 | ⏳ 예정 |
| **excel-set-margins** | 여백 설정 | `Worksheet.PageSetup.LeftMargin`, `RightMargin`, etc. | 중간 | ⏳ 예정 |
| **excel-set-header-footer** | 머리글/바닥글 설정 | `Worksheet.PageSetup.LeftHeader`, `CenterHeader`, etc. | 낮음 | ⏳ 예정 |

---

## 11. 보기 및 창 관리 (View & Window Management)

### 11.1 보기 설정

| 기능 | 설명 | win32com 메서드/속성 | 우선순위 | 상태 |
|------|------|---------------------|----------|------|
| **excel-split-window** | 창 분할 | `Window.Split` | 낮음 | ⏳ 예정 |
| **excel-freeze-panes** | 창 고정 | `Window.FreezePanes` | 중간 | ⏳ 예정 |
| **excel-set-zoom** | 확대/축소 설정 | `Window.Zoom` | 낮음 | ⏳ 예정 |
| **excel-hide-gridlines** | 눈금선 숨기기 | `Window.DisplayGridlines = False` | 낮음 | ⏳ 예정 |
| **excel-hide-headings** | 행/열 머리글 숨기기 | `Window.DisplayHeadings = False` | 낮음 | ⏳ 예정 |

---

## 12. 수식 및 함수 (Formulas & Functions)

### 12.1 수식 작업

| 기능 | 설명 | win32com 메서드/속성 | 우선순위 | 상태 |
|------|------|---------------------|----------|------|
| **excel-set-formula** | 수식 입력 | `Range("A1").Formula = "=SUM(B1:B10)"` | 높음 | ⏳ 예정 |
| **excel-get-formula** | 수식 가져오기 | `Range("A1").Formula` | 높음 | ⏳ 예정 |
| **excel-calculate** | 수식 계산 | `Worksheet.Calculate()` 또는 `Application.Calculate()` | 중간 | ⏳ 예정 |
| **excel-set-calculation-mode** | 계산 모드 설정 | `Application.Calculation = xlCalculationManual` | 낮음 | ⏳ 예정 |

---

## 13. 이름 관리 (Name Management)

| 기능 | 설명 | win32com 메서드/속성 | 우선순위 | 상태 |
|------|------|---------------------|----------|------|
| **excel-create-named-range** | 이름 정의된 범위 생성 | `Names.Add()` | 중간 | ⏳ 예정 |
| **excel-delete-named-range** | 이름 정의된 범위 삭제 | `Names("RangeName").Delete()` | 중간 | ⏳ 예정 |
| **excel-get-named-ranges** | 이름 정의된 범위 목록 가져오기 | `Names.Count`, `Names(i).Name` | 낮음 | ⏳ 예정 |

---

## 14. 하이퍼링크 (Hyperlinks)

| 기능 | 설명 | win32com 메서드/속성 | 우선순위 | 상태 |
|------|------|---------------------|----------|------|
| **excel-add-hyperlink** | 하이퍼링크 추가 | `Range("A1").Hyperlinks.Add()` | 낮음 | ⏳ 예정 |
| **excel-remove-hyperlink** | 하이퍼링크 제거 | `Range("A1").Hyperlinks.Delete()` | 낮음 | ⏳ 예정 |

---

## 15. 보안 및 보호 (Security & Protection)

| 기능 | 설명 | win32com 메서드/속성 | 우선순위 | 상태 |
|------|------|---------------------|----------|------|
| **excel-protect-workbook** | 워크북 보호 | `Workbook.Protect()` | 중간 | ⏳ 예정 |
| **excel-unprotect-workbook** | 워크북 보호 해제 | `Workbook.Unprotect()` | 중간 | ⏳ 예정 |
| **excel-protect-sheet** | 시트 보호 | `Worksheet.Protect()` | 중간 | ⏳ 예정 |
| **excel-unprotect-sheet** | 시트 보호 해제 | `Worksheet.Unprotect()` | 중간 | ⏳ 예정 |

---

## 16. 이벤트 및 알림 (Events & Alerts)

| 기능 | 설명 | win32com 메서드/속성 | 우선순위 | 상태 |
|------|------|---------------------|----------|------|
| **excel-disable-alerts** | 경고창 비활성화 | `Application.DisplayAlerts = False` | 중간 | ⏳ 예정 |
| **excel-enable-alerts** | 경고창 활성화 | `Application.DisplayAlerts = True` | 중간 | ⏳ 예정 |
| **excel-disable-screen-updating** | 화면 업데이트 비활성화 | `Application.ScreenUpdating = False` | 중간 | ⏳ 예정 |
| **excel-enable-screen-updating** | 화면 업데이트 활성화 | `Application.ScreenUpdating = True` | 중간 | ⏳ 예정 |

---

## 우선순위 가이드

### 높음 (High Priority)
- 파일 관리: excel-create, excel-save, excel-save-as
- 셀 작업: excel-read-cell, excel-write-cell, excel-read-range, excel-write-range
- 행/열 작업: excel-insert-row, excel-delete-row, excel-insert-column, excel-delete-column
- 데이터 작업: excel-sort, excel-auto-filter
- 수식: excel-set-formula, excel-get-formula

### 중간 (Medium Priority)
- 시트 관리: excel-add-sheet, excel-delete-sheet, excel-rename-sheet
- 셀 서식: excel-set-font-*, excel-set-cell-background
- 복사/붙여넣기: excel-copy-cell, excel-paste
- 인쇄: excel-print, excel-set-print-area
- 보호: excel-protect-sheet, excel-unprotect-sheet

### 낮음 (Low Priority)
- 차트 작업
- 피벗 테이블
- 하이퍼링크
- 고급 필터
- 보기 설정

---

## 구현 가이드

각 노드를 구현할 때는 다음 가이드를 참고하세요:

1. **노드 생성 가이드**: `docs/dev/nodes/creating-nodes-python.md`
2. **기존 노드 예시**: 
   - `server/nodes/excelnodes/excel_open.py`
   - `server/nodes/excelnodes/excel_select_sheet.py`
   - `server/nodes/excelnodes/excel_close.py`
3. **ExcelManager 사용**: `server/nodes/excelnodes/excel_manager.py`의 `get_excel_objects()` 사용

### 공통 패턴

```python
from nodes.excelnodes.excel_manager import get_excel_objects

# execution_id로 엑셀 객체 가져오기
excel_data = get_excel_objects(execution_id)
if not excel_data:
    return create_failed_result(...)

workbook = excel_data.get("workbook")
worksheet = workbook.Worksheets("Sheet1")

# 작업 수행
# ...

# 결과 반환
return {
    "action": "excel-xxx",
    "status": "completed",
    "output": {...}
}
```

---

## 참고 자료

- [Microsoft Excel VBA Object Model](https://docs.microsoft.com/en-us/office/vba/api/overview/excel/object-model)
- [win32com Excel Programming](https://docs.microsoft.com/en-us/previous-versions/office/developer/office-xp/aa140060(v=office.10))
- [Python win32com Excel Examples](https://pbpython.com/windows-com.html)

---

## 업데이트 이력

- **2025.12.21**: 초기 문서 작성, 현재 구현된 노드 3개 정리, 가능한 모든 기능 목록 작성

