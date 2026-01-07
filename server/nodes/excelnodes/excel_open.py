"""
엑셀 열기 노드
win32를 사용하여 엑셀 파일을 여는 노드입니다.

주의사항:
- Windows 환경에서만 사용 가능합니다.
- pywin32 라이브러리가 필요합니다 (pip install pywin32).
"""

from typing import Any

from log import log_manager
from nodes.base_node import BaseNode
from nodes.excelnodes.excel_manager import open_excel_file, store_excel_objects
from nodes.node_executor_wrapper import NodeExecutor
from utils import create_failed_result, get_parameter

logger = log_manager.logger


class ExcelOpenNode(BaseNode):
    """
    엑셀 열기 노드 클래스

    Windows 환경에서만 동작하며, win32com을 사용하여 엑셀 파일을 엽니다.
    """

    @staticmethod
    @NodeExecutor("excel-open")
    async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
        """
        엑셀 파일을 엽니다.

        주의: Windows 환경에서만 사용 가능합니다. win32com을 사용하여 엑셀을 제어합니다.

        Args:
            parameters: 노드 파라미터
                - file_path: 엑셀 파일 경로 (필수)
                - visible: 엑셀 창 표시 여부 (기본값: True)

        Returns:
            실행 결과 딕셔너리
        """
        # 파라미터 추출
        # file_path: 엑셀 파일 경로 (필수)
        file_path = get_parameter(parameters, "file_path", default="")
        # visible: 엑셀 창 표시 여부 (기본값: True)
        visible = get_parameter(parameters, "visible", default=True)

        # visible 파라미터 디버깅 로그 (타입 확인용)
        logger.info(
            f"[ExcelOpenNode] 파라미터 수신 - file_path: {file_path}, visible: {visible} (type: {type(visible)})"
        )

        # execution_id 가져오기 (메타데이터에서)
        execution_id = parameters.get("_execution_id")
        if not execution_id:
            return create_failed_result(
                action="excel-open",
                reason="execution_id_required",
                message="execution_id가 필요합니다. 엑셀 객체를 저장할 수 없습니다.",
                output={"file_path": file_path, "visible": visible, "success": False},
            )

        try:
            # 공통 함수를 사용하여 엑셀 파일 열기
            excel_app, workbook = await open_excel_file(file_path, visible=bool(visible))

            # 출력에 execution_id 항상 포함 (다음 노드에서 사용 가능하도록)
            # 출력의 execution_id를 저장 키로 사용 (이전 노드 출력에서 가져온 execution_id와 일치시키기 위함)
            # 엑셀 객체를 두 개의 키로 저장: _execution_id와 출력 execution_id
            # 이렇게 하면 다음 노드가 어떤 execution_id를 사용하든 찾을 수 있음
            output_execution_id = execution_id

            # 엑셀 객체를 저장소에 저장 (출력 execution_id로 저장)
            store_excel_objects(output_execution_id, excel_app, workbook, file_path)
            logger.info(
                f"[ExcelOpenNode] 엑셀 객체 저장 완료 - execution_id: {output_execution_id} "
                f"(메타데이터 _execution_id: {execution_id})"
            )

            # 디버깅: 저장된 execution_id 목록 확인
            from nodes.excelnodes.excel_manager import _excel_objects

            logger.info(f"[ExcelOpenNode] 저장 후 execution_id 목록: {list(_excel_objects.keys())}")

            return {
                "action": "excel-open",
                "status": "completed",
                "output": {
                    "file_path": file_path,
                    "visible": bool(visible),
                    "success": True,
                    "execution_id": output_execution_id,  # 다음 노드에서 사용할 수 있도록 execution_id 항상 포함
                },
            }
        except ValueError as e:
            # 파일 경로 검증 오류
            return create_failed_result(
                action="excel-open",
                reason="file_validation_error",
                message=f"{e!s}",
                output={"file_path": file_path, "visible": visible, "success": False},
            )
        except RuntimeError as e:
            # win32com 관련 오류
            return create_failed_result(
                action="excel-open",
                reason="win32com_error",
                message=f"{e!s}",
                output={"file_path": file_path, "visible": visible, "success": False},
            )
        except Exception as e:
            # 기타 예외
            return create_failed_result(
                action="excel-open",
                reason="excel_open_error",
                message=f"엑셀 파일을 여는 중 오류가 발생했습니다: {e!s}",
                output={"file_path": file_path, "visible": visible, "success": False},
            )
