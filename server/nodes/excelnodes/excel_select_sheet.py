"""
엑셀 시트 선택 노드
win32를 사용하여 엑셀 워크북의 특정 시트를 선택하는 노드입니다.

주의사항:
- Windows 환경에서만 사용 가능합니다.
- pywin32 라이브러리가 필요합니다 (pip install pywin32).
- 엑셀 열기 노드 이후에 사용해야 합니다.
"""

from typing import Any

from log import log_manager
from nodes.base_node import BaseNode
from nodes.excelnodes.excel_manager import get_excel_objects
from nodes.node_executor_wrapper import NodeExecutor
from utils import create_failed_result, get_parameter

logger = log_manager.logger

try:
    import win32com.client
except ImportError:
    win32com = None


class ExcelSelectSheetNode(BaseNode):
    """
    엑셀 시트 선택 노드 클래스

    Windows 환경에서만 동작하며, win32com을 사용하여 엑셀 워크북의 특정 시트를 선택합니다.
    """

    @staticmethod
    @NodeExecutor("excel-select-sheet")
    async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
        """
        엑셀 워크북의 특정 시트를 선택합니다.

        주의: Windows 환경에서만 사용 가능합니다. win32com을 사용하여 엑셀을 제어합니다.

        Args:
            parameters: 노드 파라미터
                - execution_id: 엑셀 실행 ID (필수, 이전 노드 출력에서 선택 가능)
                - sheet_name: 시트 이름 (선택, sheet_index와 둘 중 하나는 필수)
                - sheet_index: 시트 인덱스 (선택, 1부터 시작, sheet_name과 둘 중 하나는 필수)

        Returns:
            실행 결과 딕셔너리
        """
        # win32com이 설치되어 있지 않은 경우
        if win32com is None:
            return create_failed_result(
                action="excel-select-sheet",
                reason="win32com_not_installed",
                message="pywin32가 설치되어 있지 않습니다. pip install pywin32를 실행하세요.",
                output={"success": False, "sheet_name": None, "sheet_index": None},
            )

        # 파라미터 추출
        execution_id = get_parameter(parameters, "execution_id", default="")
        sheet_name = get_parameter(parameters, "sheet_name", default="")
        sheet_index = get_parameter(parameters, "sheet_index")

        # execution_id 검증
        if not execution_id:
            return create_failed_result(
                action="excel-select-sheet",
                reason="execution_id_required",
                message="execution_id가 필요합니다. 엑셀 열기 노드의 출력에서 execution_id를 선택하세요.",
                output={"success": False, "sheet_name": sheet_name, "sheet_index": sheet_index},
            )

        # 디버깅: execution_id와 저장된 엑셀 객체 확인
        logger.info(
            f"[ExcelSelectSheetNode] execution_id 사용: {execution_id}, "
            f"파라미터 execution_id: {parameters.get('execution_id')}, "
            f"메타데이터 _execution_id: {parameters.get('_execution_id')}"
        )

        # sheet_name 또는 sheet_index 중 하나는 필수
        if not sheet_name and sheet_index is None:
            return create_failed_result(
                action="excel-select-sheet",
                reason="sheet_identifier_required",
                message="시트 이름(sheet_name) 또는 시트 인덱스(sheet_index) 중 하나는 필수입니다.",
                output={"success": False, "sheet_name": sheet_name, "sheet_index": sheet_index},
            )

        try:
            # 엑셀 객체 가져오기
            # execution_id가 없으면 메타데이터의 _execution_id 사용 (하위 호환성)
            if not execution_id:
                execution_id = parameters.get("_execution_id")
                logger.info(f"[ExcelSelectSheetNode] execution_id가 비어있어 메타데이터에서 가져옴: {execution_id}")

            # 디버깅: 저장된 모든 execution_id 확인
            from nodes.excelnodes.excel_manager import _excel_objects

            stored_ids = list(_excel_objects.keys())
            logger.info(
                f"[ExcelSelectSheetNode] 엑셀 객체 조회 시도 - 요청 execution_id: {execution_id}, "
                f"메타데이터 _execution_id: {parameters.get('_execution_id')}, "
                f"저장된 execution_id 목록: {stored_ids}"
            )

            excel_data = get_excel_objects(execution_id)

            # execution_id로 찾지 못했고, 메타데이터의 _execution_id가 다르면 그것도 시도
            # 엑셀 열기 노드가 _execution_id로 저장했을 수 있음
            if not excel_data and parameters.get("_execution_id") and parameters.get("_execution_id") != execution_id:
                alternative_execution_id = parameters.get("_execution_id")
                logger.info(f"[ExcelSelectSheetNode] 대체 execution_id로 시도: {alternative_execution_id}")
                excel_data = get_excel_objects(alternative_execution_id)
                if excel_data:
                    execution_id = alternative_execution_id
                    logger.info(f"[ExcelSelectSheetNode] 대체 execution_id로 엑셀 객체 찾음: {execution_id}")

            if not excel_data:
                return create_failed_result(
                    action="excel-select-sheet",
                    reason="excel_objects_not_found",
                    message=f"execution_id '{execution_id}'에 해당하는 엑셀 객체를 찾을 수 없습니다. 엑셀 열기 노드를 먼저 실행하세요.",
                    output={"success": False, "sheet_name": sheet_name, "sheet_index": sheet_index},
                )

            workbook = excel_data.get("workbook")
            if not workbook:
                return create_failed_result(
                    action="excel-select-sheet",
                    reason="workbook_not_found",
                    message="워크북 객체를 찾을 수 없습니다.",
                    output={"success": False, "sheet_name": sheet_name, "sheet_index": sheet_index},
                )

            # 시트 선택
            selected_sheet = None
            actual_sheet_name = None

            if sheet_name:
                # 시트 이름으로 선택
                try:
                    selected_sheet = workbook.Worksheets(sheet_name)
                    actual_sheet_name = selected_sheet.Name
                    logger.info(
                        f"[ExcelSelectSheetNode] 시트 선택 완료 (이름) - execution_id: {execution_id}, sheet_name: {sheet_name}"
                    )
                except Exception as e:
                    return create_failed_result(
                        action="excel-select-sheet",
                        reason="sheet_not_found_by_name",
                        message=f"시트를 찾을 수 없습니다: {sheet_name}. 오류: {e!s}",
                        output={"success": False, "sheet_name": sheet_name, "sheet_index": sheet_index},
                    )
            elif sheet_index is not None:
                # 시트 인덱스로 선택 (1부터 시작)
                try:
                    # sheet_index를 정수로 변환
                    sheet_index_int = int(sheet_index)
                    if sheet_index_int < 1:
                        return create_failed_result(
                            action="excel-select-sheet",
                            reason="invalid_sheet_index",
                            message="시트 인덱스는 1 이상이어야 합니다.",
                            output={"success": False, "sheet_name": sheet_name, "sheet_index": sheet_index},
                        )

                    # 시트 개수 확인
                    sheet_count = workbook.Worksheets.Count
                    if sheet_index_int > sheet_count:
                        return create_failed_result(
                            action="excel-select-sheet",
                            reason="sheet_index_out_of_range",
                            message=f"시트 인덱스가 범위를 벗어났습니다. (최대: {sheet_count}, 요청: {sheet_index_int})",
                            output={"success": False, "sheet_name": sheet_name, "sheet_index": sheet_index},
                        )

                    selected_sheet = workbook.Worksheets(sheet_index_int)
                    actual_sheet_name = selected_sheet.Name
                    logger.info(
                        f"[ExcelSelectSheetNode] 시트 선택 완료 (인덱스) - execution_id: {execution_id}, sheet_index: {sheet_index_int}, sheet_name: {actual_sheet_name}"
                    )
                except ValueError:
                    return create_failed_result(
                        action="excel-select-sheet",
                        reason="invalid_sheet_index_type",
                        message="시트 인덱스는 숫자여야 합니다.",
                        output={"success": False, "sheet_name": sheet_name, "sheet_index": sheet_index},
                    )
                except Exception as e:
                    return create_failed_result(
                        action="excel-select-sheet",
                        reason="sheet_not_found_by_index",
                        message=f"시트를 찾을 수 없습니다 (인덱스: {sheet_index}). 오류: {e!s}",
                        output={"success": False, "sheet_name": sheet_name, "sheet_index": sheet_index},
                    )

            # 시트 활성화
            if selected_sheet:
                selected_sheet.Activate()
                logger.info(
                    f"[ExcelSelectSheetNode] 시트 활성화 완료 - execution_id: {execution_id}, sheet_name: {actual_sheet_name}"
                )

            # 결과 반환
            return {
                "action": "excel-select-sheet",
                "status": "completed",
                "output": {
                    "success": True,
                    "execution_id": execution_id,
                    "sheet_name": actual_sheet_name or sheet_name,
                    "sheet_index": sheet_index if sheet_index is not None else None,
                    "selected_by": "name" if sheet_name else "index",
                },
            }

        except Exception as e:
            logger.error(f"[ExcelSelectSheetNode] 시트 선택 중 오류 발생 - execution_id: {execution_id}, error: {e}")
            return create_failed_result(
                action="excel-select-sheet",
                reason="sheet_selection_error",
                message=f"시트를 선택하는 중 오류가 발생했습니다: {e!s}",
                output={"success": False, "sheet_name": sheet_name, "sheet_index": sheet_index},
            )
