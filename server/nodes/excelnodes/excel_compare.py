"""
엑셀 비교 노드
두 개의 엑셀 파일을 비교하여 원본 엑셀의 값을 대상 엑셀에 복사합니다.

엑셀 열기, 시트 선택, 비교, 닫기를 모두 수행하는 종합 노드입니다.

1~2행은 헤더, 3행부터 데이터입니다.
2행 헤더에 level1, level2, level3 컬럼이 있고, 이 3개 값을 합친 키로 행을 매칭합니다.
원본 엑셀에서 같은 키를 가진 행의 자동화/n메뉴얼 값을 가져와서,
대상 엑셀에서 동일 키 행의 자동화/n메뉴얼 셀에 그대로 써넣습니다.
대용량 처리를 위해 해시맵으로 원본을 인덱싱합니다.
"""

from typing import Any

from log import log_manager
from nodes.base_node import BaseNode
from nodes.excelnodes.excel_manager import open_excel_file
from nodes.node_executor_wrapper import NodeExecutor
from utils import create_failed_result, get_parameter

logger = log_manager.logger


class ExcelCompareNode(BaseNode):
    """
    엑셀 비교 노드 클래스

    두 개의 엑셀 파일을 비교하여 원본 엑셀의 값을 대상 엑셀에 복사합니다.
    """

    @staticmethod
    @NodeExecutor("excel-compare")
    async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
        """
        두 개의 엑셀 파일을 비교하여 원본 엑셀의 값을 대상 엑셀에 복사합니다.
        엑셀 열기, 시트 선택, 비교, 닫기를 모두 수행하는 종합 노드입니다.

        Args:
            parameters: 노드 파라미터
                - source_file_path: 원본 엑셀 파일 경로 (필수)
                - target_file_path: 대상 엑셀 파일 경로 (필수)
                - source_sheet_name: 원본 엑셀 시트 이름 (기본값: "Sheet1")
                - target_sheet_name: 대상 엑셀 시트 이름 (기본값: "Sheet1")
                - visible: 엑셀 창 표시 여부 (기본값: True)
                - save_changes: 변경사항 저장 여부 (기본값: True)
                - match_columns: 비교할 열 이름 배열 (기본값: ["level1"])
                - automation_column: 자동화/n메뉴얼 컬럼명 (기본값: "자동화/n메뉴얼")

        Returns:
            실행 결과 딕셔너리
        """
        # 파라미터 추출
        source_file_path = get_parameter(parameters, "source_file_path", default="")
        target_file_path = get_parameter(parameters, "target_file_path", default="")
        source_sheet_name = get_parameter(parameters, "source_sheet_name", default="Sheet1")
        target_sheet_name = get_parameter(parameters, "target_sheet_name", default="Sheet1")
        visible = get_parameter(parameters, "visible", default=True)
        save_changes = get_parameter(parameters, "save_changes", default=True)
        match_columns = get_parameter(parameters, "match_columns", default=["level1"])
        automation_col = get_parameter(parameters, "automation_column", default="자동화/n메뉴얼")

        # match_columns가 문자열이면 리스트로 변환
        if isinstance(match_columns, str):
            match_columns = [match_columns]
        elif not isinstance(match_columns, list):
            match_columns = ["level1"]

        # 빈 리스트 체크
        if not match_columns or len(match_columns) == 0:
            return create_failed_result(
                action="excel-compare",
                reason="match_columns_required",
                message="비교할 열 이름이 최소 1개 이상 필요합니다.",
                output={"success": False, "matched_count": 0, "updated_count": 0},
            )

        # 파일 경로 검증
        if not source_file_path:
            return create_failed_result(
                action="excel-compare",
                reason="source_file_path_required",
                message="원본 엑셀 파일 경로가 필요합니다.",
                output={"success": False, "matched_count": 0, "updated_count": 0},
            )

        if not target_file_path:
            return create_failed_result(
                action="excel-compare",
                reason="target_file_path_required",
                message="대상 엑셀 파일 경로가 필요합니다.",
                output={"success": False, "matched_count": 0, "updated_count": 0},
            )

        source_excel_app = None
        target_excel_app = None
        source_workbook = None
        target_workbook = None

        try:
            # 1. 원본 엑셀 열기 (공통 함수 사용)
            logger.info(f"[ExcelCompareNode] 원본 엑셀 열기: {source_file_path}")
            try:
                source_excel_app, source_workbook = await open_excel_file(source_file_path, visible=bool(visible))
            except ValueError as e:
                return create_failed_result(
                    action="excel-compare",
                    reason="source_file_error",
                    message=f"원본 엑셀 파일 오류: {e!s}",
                    output={"success": False, "matched_count": 0, "updated_count": 0},
                )
            except RuntimeError as e:
                return create_failed_result(
                    action="excel-compare",
                    reason="win32com_not_installed",
                    message=f"{e!s}",
                    output={"success": False, "matched_count": 0, "updated_count": 0},
                )

            # 원본 시트 선택
            try:
                source_sheet = source_workbook.Sheets(source_sheet_name)
                source_sheet.Activate()
            except Exception as e:
                return create_failed_result(
                    action="excel-compare",
                    reason="source_sheet_not_found",
                    message=f"원본 엑셀에서 시트를 찾을 수 없습니다: {source_sheet_name}, 오류: {e!s}",
                    output={"success": False, "matched_count": 0, "updated_count": 0},
                )

            # 2. 대상 엑셀 열기 (공통 함수 사용)
            logger.info(f"[ExcelCompareNode] 대상 엑셀 열기: {target_file_path}")
            try:
                target_excel_app, target_workbook = await open_excel_file(target_file_path, visible=bool(visible))
            except ValueError as e:
                return create_failed_result(
                    action="excel-compare",
                    reason="target_file_error",
                    message=f"대상 엑셀 파일 오류: {e!s}",
                    output={"success": False, "matched_count": 0, "updated_count": 0},
                )
            except RuntimeError as e:
                return create_failed_result(
                    action="excel-compare",
                    reason="win32com_not_installed",
                    message=f"{e!s}",
                    output={"success": False, "matched_count": 0, "updated_count": 0},
                )

            # 대상 시트 선택
            try:
                target_sheet = target_workbook.Sheets(target_sheet_name)
                target_sheet.Activate()
            except Exception as e:
                return create_failed_result(
                    action="excel-compare",
                    reason="target_sheet_not_found",
                    message=f"대상 엑셀에서 시트를 찾을 수 없습니다: {target_sheet_name}, 오류: {e!s}",
                    output={"success": False, "matched_count": 0, "updated_count": 0},
                )

            if not source_sheet or not target_sheet:
                return create_failed_result(
                    action="excel-compare",
                    reason="sheet_not_found",
                    message="활성 시트를 찾을 수 없습니다.",
                    output={"success": False, "matched_count": 0, "updated_count": 0},
                )

            logger.info(f"[ExcelCompareNode] 엑셀 비교 시작 - 원본: {source_file_path}, 대상: {target_file_path}")

            # 1. 원본 엑셀을 해시맵으로 인덱싱
            # 2행 헤더에서 컬럼 위치 찾기
            source_header_row = 2  # 2행이 헤더
            source_data_start_row = 3  # 3행부터 데이터

            # 헤더에서 컬럼 인덱스 찾기
            def find_column_index(sheet: Any, header_row: int, column_name: str) -> int | None:
                """헤더 행에서 컬럼명으로 컬럼 인덱스를 찾습니다 (1부터 시작)."""
                last_col = sheet.UsedRange.Columns.Count
                for col in range(1, last_col + 1):
                    cell_value = str(sheet.Cells(header_row, col).Value or "").strip()
                    if cell_value == column_name:
                        return col
                return None

            # 동적 열 이름 처리: match_columns 배열에서 각 열의 인덱스 찾기
            source_match_cols = []
            for col_name in match_columns:
                col_idx = find_column_index(source_sheet, source_header_row, col_name)
                if col_idx is None:
                    return create_failed_result(
                        action="excel-compare",
                        reason="column_not_found_in_source",
                        message=f"원본 엑셀에서 컬럼을 찾을 수 없습니다: {col_name}",
                        output={"success": False, "matched_count": 0, "updated_count": 0},
                    )
                source_match_cols.append(col_idx)

            source_automation_col = find_column_index(source_sheet, source_header_row, automation_col)
            if source_automation_col is None:
                return create_failed_result(
                    action="excel-compare",
                    reason="automation_column_not_found_in_source",
                    message=f"원본 엑셀에서 자동화 메뉴얼 컬럼을 찾을 수 없습니다: {automation_col}",
                    output={"success": False, "matched_count": 0, "updated_count": 0},
                )

            # 원본 데이터를 해시맵으로 인덱싱
            # {key: automation_value} 형태로 저장
            source_data_map: dict[str, str] = {}
            source_last_row = source_sheet.UsedRange.Rows.Count

            logger.info(f"[ExcelCompareNode] 원본 엑셀 데이터 인덱싱 시작 - 총 {source_last_row - 2}행")

            for row in range(source_data_start_row, source_last_row + 1):
                # 동적 열 이름 처리: match_columns 배열의 각 열에서 값 읽기
                key_parts = []
                for col_idx in source_match_cols:
                    val = str(source_sheet.Cells(row, col_idx).Value or "").strip()
                    key_parts.append(val)

                # 키 생성 (모든 열 값을 |로 연결)
                key = "|".join(key_parts)

                # 빈 키는 건너뛰기 (모든 값이 비어있는 경우)
                if not key or key == "|" * (len(key_parts) - 1):
                    continue

                automation_val = str(source_sheet.Cells(row, source_automation_col).Value or "").strip()
                source_data_map[key] = automation_val

            logger.info(f"[ExcelCompareNode] 원본 엑셀 인덱싱 완료 - {len(source_data_map)}개 키")

            # 2. 대상 엑셀에서 매칭하여 값 쓰기
            target_header_row = 2
            target_data_start_row = 3
            target_last_row = target_sheet.UsedRange.Rows.Count

            # 대상 엑셀에서도 동적 열 이름 처리
            target_match_cols = []
            for col_name in match_columns:
                col_idx = find_column_index(target_sheet, target_header_row, col_name)
                if col_idx is None:
                    return create_failed_result(
                        action="excel-compare",
                        reason="column_not_found_in_target",
                        message=f"대상 엑셀에서 컬럼을 찾을 수 없습니다: {col_name}",
                        output={"success": False, "matched_count": 0, "updated_count": 0},
                    )
                target_match_cols.append(col_idx)

            target_automation_col = find_column_index(target_sheet, target_header_row, automation_col)
            if target_automation_col is None:
                return create_failed_result(
                    action="excel-compare",
                    reason="automation_column_not_found_in_target",
                    message=f"대상 엑셀에서 자동화 메뉴얼 컬럼을 찾을 수 없습니다: {automation_col}",
                    output={"success": False, "matched_count": 0, "updated_count": 0},
                )

            logger.info(f"[ExcelCompareNode] 대상 엑셀 매칭 시작 - 총 {target_last_row - 2}행")

            matched_count = 0
            updated_count = 0

            for row in range(target_data_start_row, target_last_row + 1):
                # 동적 열 이름 처리: match_columns 배열의 각 열에서 값 읽기
                key_parts = []
                for col_idx in target_match_cols:
                    val = str(target_sheet.Cells(row, col_idx).Value or "").strip()
                    key_parts.append(val)

                # 키 생성 (모든 열 값을 |로 연결)
                key = "|".join(key_parts)

                # 빈 키는 건너뛰기 (모든 값이 비어있는 경우)
                if not key or key == "|" * (len(key_parts) - 1):
                    continue

                # 원본에서 매칭되는 값 찾기
                if key in source_data_map:
                    matched_count += 1
                    automation_value = source_data_map[key]

                    # 대상 엑셀에 값 쓰기
                    target_sheet.Cells(row, target_automation_col).Value = automation_value
                    updated_count += 1

            logger.info(f"[ExcelCompareNode] 엑셀 비교 완료 - 매칭: {matched_count}개, 업데이트: {updated_count}개")

            # 3. 엑셀 닫기
            try:
                # 원본 엑셀 닫기 (변경사항 저장 안 함)
                if source_workbook:
                    source_workbook.Close(SaveChanges=False)
                if source_excel_app:
                    source_excel_app.Quit()
                logger.info("[ExcelCompareNode] 원본 엑셀 닫기 완료")

                # 대상 엑셀 닫기 (변경사항 저장 여부에 따라)
                if target_workbook:
                    target_workbook.Close(SaveChanges=bool(save_changes))
                if target_excel_app:
                    target_excel_app.Quit()
                logger.info(f"[ExcelCompareNode] 대상 엑셀 닫기 완료 (저장: {save_changes})")
            except Exception as e:
                logger.warning(f"[ExcelCompareNode] 엑셀 닫기 중 오류 발생 (무시): {e!s}")

            return {
                "action": "excel-compare",
                "status": "completed",
                "output": {
                    "success": True,
                    "matched_count": matched_count,
                    "updated_count": updated_count,
                    "source_file_path": source_file_path,
                    "target_file_path": target_file_path,
                },
            }

        except Exception as e:
            logger.error(f"[ExcelCompareNode] 엑셀 비교 중 오류 발생: {e}")

            # 오류 발생 시 엑셀 닫기 시도
            try:
                if source_workbook:
                    source_workbook.Close(SaveChanges=False)
                if source_excel_app:
                    source_excel_app.Quit()
                if target_workbook:
                    target_workbook.Close(SaveChanges=False)
                if target_excel_app:
                    target_excel_app.Quit()
            except Exception:
                pass

            return create_failed_result(
                action="excel-compare",
                reason="compare_error",
                message=f"엑셀 비교 중 오류가 발생했습니다: {e!s}",
                output={"success": False, "matched_count": 0, "updated_count": 0},
            )
