"""
엑셀 열기 노드
win32를 사용하여 엑셀 파일을 여는 노드입니다.

주의사항:
- Windows 환경에서만 사용 가능합니다.
- pywin32 라이브러리가 필요합니다 (pip install pywin32).
"""

import os
from typing import Any

from log import log_manager
from nodes.base_node import BaseNode
from nodes.excelnodes.excel_manager import store_excel_objects
from nodes.node_executor_wrapper import NodeExecutor
from utils import create_failed_result, get_parameter

logger = log_manager.logger

try:
    import win32com.client
except ImportError:
    win32com = None


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
        # win32com이 설치되어 있지 않은 경우
        # win32com이 None이면 Windows 환경이 아니거나 pywin32가 설치되지 않은 경우
        if win32com is None:
            return create_failed_result(
                action="excel-open",
                reason="win32com_not_installed",
                message="pywin32가 설치되어 있지 않습니다. pip install pywin32를 실행하세요.",
                output={"file_path": None, "visible": None, "success": False},
            )

        # 파라미터 추출
        # file_path: 엑셀 파일 경로 (필수)
        file_path = get_parameter(parameters, "file_path", default="")
        # visible: 엑셀 창 표시 여부 (기본값: True)
        visible = get_parameter(parameters, "visible", default=True)

        # visible 파라미터 디버깅 로그 (타입 확인용)
        logger.info(
            f"[ExcelOpenNode] 파라미터 수신 - file_path: {file_path}, visible: {visible} (type: {type(visible)})"
        )

        # 파일 경로 검증
        # file_path가 없으면 에러 반환
        if not file_path:
            return create_failed_result(
                action="excel-open",
                reason="file_path_required",
                message="엑셀 파일 경로가 필요합니다.",
                output={"file_path": file_path, "visible": visible, "success": False},
            )

        # 파일 경로 정규화 (Windows 경로 처리)
        file_path = os.path.normpath(file_path)

        # 파일 존재 여부 확인
        if not os.path.exists(file_path):
            return create_failed_result(
                action="excel-open",
                reason="file_not_found",
                message=f"파일을 찾을 수 없습니다: {file_path}",
                output={"file_path": file_path, "visible": visible, "success": False},
            )

        # 파일 확장자 확인
        # 지원하는 엑셀 파일 확장자: .xlsx, .xls, .xlsm
        if not file_path.lower().endswith((".xlsx", ".xls", ".xlsm")):
            return create_failed_result(
                action="excel-open",
                reason="invalid_file_type",
                message=f"지원하지 않는 파일 형식입니다: {file_path}",
                output={"file_path": file_path, "visible": visible, "success": False},
            )

        try:
            import asyncio
            import time

            # execution_id 가져오기 (메타데이터에서) - 대기 로직 전에 먼저 확인
            # execution_id: 워크플로우 실행 ID (엑셀 객체를 저장하기 위해 필요)
            execution_id = parameters.get("_execution_id")
            # execution_id가 없으면 에러 반환 (엑셀 객체를 저장할 수 없음)
            if not execution_id:
                return create_failed_result(
                    action="excel-open",
                    reason="execution_id_required",
                    message="execution_id가 필요합니다. 엑셀 객체를 저장할 수 없습니다.",
                    output={"file_path": file_path, "visible": visible, "success": False},
                )

            # Excel 애플리케이션 객체 생성
            # win32com.client.Dispatch로 Excel COM 객체 생성
            excel_app = win32com.client.Dispatch("Excel.Application")

            # 엑셀 창 표시 여부 설정
            # visible 파라미터를 bool로 변환하여 설정
            excel_app.Visible = bool(visible)

            # 엑셀 파일 열기
            # Workbooks.Open으로 엑셀 파일 열기
            workbook = excel_app.Workbooks.Open(file_path)

            # Excel이 완전히 준비될 때까지 대기
            # workbook.Open()이 반환되어도 Excel이 완전히 로드되기 전에 다음 노드가 실행될 수 있음
            # max_wait_time: 최대 대기 시간 (30초)
            max_wait_time = 30
            # check_interval: 확인 간격 (0.1초마다 확인)
            check_interval = 0.1
            # start_time: 대기 시작 시간
            start_time = time.time()
            # excel_ready: Excel 준비 완료 여부 플래그
            excel_ready = False

            # 최대 대기 시간 동안 Excel 준비 상태 확인
            while (time.time() - start_time) < max_wait_time:
                try:
                    # Excel이 준비되었는지 확인
                    # Ready 속성 확인 및 간단한 속성 접근 시도 (workbook.Name)
                    # Ready가 True이고 workbook.Name에 접근 가능하면 준비 완료
                    if excel_app.Ready and workbook.Name:
                        excel_ready = True
                        break  # 준비 완료되면 루프 종료
                except Exception:
                    # 아직 준비되지 않았으면 계속 대기 (예외 무시)
                    pass

                # check_interval만큼 대기 후 다시 확인
                await asyncio.sleep(check_interval)

            # Excel이 준비되지 않았으면 경고 출력 (하지만 계속 진행)
            if not excel_ready:
                logger.warning(
                    f"[ExcelOpenNode] Excel 준비 확인 타임아웃 - execution_id: {execution_id}, 하지만 계속 진행합니다."
                )
            else:
                logger.info(f"[ExcelOpenNode] Excel 준비 완료 - execution_id: {execution_id}")

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
        except Exception as e:
            return create_failed_result(
                action="excel-open",
                reason="excel_open_error",
                message=f"엑셀 파일을 여는 중 오류가 발생했습니다: {e!s}",
                output={"file_path": file_path, "visible": visible, "success": False},
            )
