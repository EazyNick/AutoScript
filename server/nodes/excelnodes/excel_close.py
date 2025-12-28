"""
엑셀 닫기 노드
열려있는 엑셀 파일을 닫는 노드입니다.

주의사항:
- Windows 환경에서만 사용 가능합니다.
- pywin32 라이브러리가 필요합니다 (pip install pywin32).
- 엑셀 열기 노드로 열린 엑셀 파일을 닫습니다.
"""

from typing import Any

from log import log_manager
from nodes.base_node import BaseNode
from nodes.excelnodes.excel_manager import close_excel_objects, get_excel_objects
from nodes.node_executor_wrapper import NodeExecutor
from utils import create_failed_result, get_parameter

logger = log_manager.logger

try:
    import win32com.client
except ImportError:
    win32com = None


class ExcelCloseNode(BaseNode):
    """
    엑셀 닫기 노드 클래스

    Windows 환경에서만 동작하며, win32com을 사용하여 엑셀 파일을 닫습니다.
    """

    @staticmethod
    @NodeExecutor("excel-close")
    async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
        """
        엑셀 파일을 닫습니다.

        주의: Windows 환경에서만 사용 가능합니다. win32com을 사용하여 엑셀을 제어합니다.

        Args:
            parameters: 노드 파라미터
                - save_changes: 변경사항 저장 여부 (기본값: False)

        Returns:
            실행 결과 딕셔너리
        """
        # win32com이 설치되어 있지 않은 경우
        if win32com is None:
            return create_failed_result(
                action="excel-close",
                reason="win32com_not_installed",
                message="pywin32가 설치되어 있지 않습니다. pip install pywin32를 실행하세요.",
                output={"success": False},
            )

        # 파라미터 추출
        # save_changes: 변경사항 저장 여부 (기본값: False)
        save_changes = get_parameter(parameters, "save_changes", default=False)

        # execution_id 가져오기 (우선순위: 사용자 입력 > 이전 노드 출력 > 메타데이터)
        # execution_id: 워크플로우 실행 ID (열려있는 엑셀 객체를 찾기 위해 필요)
        # 1순위: 사용자가 직접 입력한 execution_id (action_service에서 경로 문자열이 실제 값으로 변환됨)
        # 2순위: 이전 노드 출력에서 가져온 execution_id (_execution_id_from_prev, 하위 호환성)
        # 3순위: 메타데이터의 execution_id (_execution_id)
        execution_id = (
            get_parameter(parameters, "execution_id", default="")
            or parameters.get("_execution_id_from_prev")
            or parameters.get("_execution_id")
        )

        # execution_id가 없으면 에러 반환 (열려있는 엑셀 객체를 찾을 수 없음)
        if not execution_id:
            return create_failed_result(
                action="excel-close",
                reason="execution_id_not_found",
                message="execution_id를 찾을 수 없습니다. 이전 노드 출력에서 선택하거나 직접 입력하세요.",
                output={"success": False},
            )

        logger.info(
            f"[ExcelCloseNode] execution_id 사용: {execution_id} (소스: 사용자입력={bool(get_parameter(parameters, 'execution_id', default=''))}, 이전노드출력={bool(parameters.get('_execution_id_from_prev'))}, 메타데이터={bool(parameters.get('_execution_id') and not parameters.get('_execution_id_from_prev'))})"
        )

        # 저장된 엑셀 객체 확인
        # excel_data: 저장된 엑셀 객체 정보 (excel_app, workbook 등)
        excel_data = get_excel_objects(execution_id)
        # 엑셀 객체가 없으면 에러 반환 (엑셀 열기 노드가 먼저 실행되어야 함)
        if not excel_data:
            return create_failed_result(
                action="excel-close",
                reason="excel_not_open",
                message="열려있는 엑셀 파일을 찾을 수 없습니다. 엑셀 열기 노드가 먼저 실행되어야 합니다.",
                output={"success": False},
            )

        try:
            # 엑셀 객체 닫기
            # success: 닫기 성공 여부
            success = close_excel_objects(execution_id, save_changes=bool(save_changes))

            # 닫기 성공 시 성공 결과 반환
            if success:
                return {
                    "action": "excel-close",
                    "status": "completed",
                    "output": {
                        "success": True,
                        "save_changes": bool(save_changes),
                    },
                }
            return create_failed_result(
                action="excel-close",
                reason="close_failed",
                message="엑셀 파일을 닫는 중 오류가 발생했습니다.",
                output={"success": False},
            )
        except Exception as e:
            return create_failed_result(
                action="excel-close",
                reason="excel_close_error",
                message=f"엑셀 파일을 닫는 중 오류가 발생했습니다: {e!s}",
                output={"success": False},
            )
