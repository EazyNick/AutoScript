"""
엑셀 객체 관리 유틸리티
스크립트 실행 중 엑셀 애플리케이션과 워크북 객체를 관리합니다.
"""

import asyncio
import contextlib
import os
import time
from typing import Any

from log import log_manager

logger = log_manager.logger

try:
    import win32com.client
except ImportError:
    win32com = None

# 전역 엑셀 객체 저장소: {execution_id: {"excel_app": excel_app, "workbook": workbook, "file_path": file_path}}
_excel_objects: dict[str, dict[str, Any]] = {}


def store_excel_objects(execution_id: str, excel_app: Any, workbook: Any, file_path: str) -> None:
    """
    엑셀 객체를 저장소에 저장합니다.

    Args:
        execution_id: 실행 ID
        excel_app: Excel 애플리케이션 객체
        workbook: 워크북 객체
        file_path: 파일 경로
    """
    _excel_objects[execution_id] = {
        "excel_app": excel_app,
        "workbook": workbook,
        "file_path": file_path,
    }
    logger.info(
        f"[ExcelManager] 엑셀 객체 저장 완료 - execution_id: {execution_id}, file_path: {file_path}, "
        f"현재 저장된 execution_id 목록: {list(_excel_objects.keys())}"
    )


def get_excel_objects(execution_id: str) -> dict[str, Any] | None:
    """
    저장된 엑셀 객체를 가져옵니다.

    Args:
        execution_id: 실행 ID

    Returns:
        엑셀 객체 딕셔너리 또는 None
    """
    result = _excel_objects.get(execution_id)
    if result is None:
        # 디버깅: 저장된 모든 execution_id 목록 로깅
        stored_ids = list(_excel_objects.keys())
        logger.warning(
            f"[ExcelManager] 엑셀 객체를 찾을 수 없음 - 요청 execution_id: {execution_id}, "
            f"저장된 execution_id 목록: {stored_ids}"
        )
    return result


def close_excel_objects(execution_id: str, save_changes: bool = False) -> bool:
    """
    저장된 엑셀 객체를 닫습니다.

    Args:
        execution_id: 실행 ID
        save_changes: 변경사항 저장 여부 (기본값: False)

    Returns:
        성공 여부
    """
    excel_data = _excel_objects.get(execution_id)
    if not excel_data:
        logger.warning(f"[ExcelManager] 엑셀 객체를 찾을 수 없음 - execution_id: {execution_id}")
        return False

    try:
        workbook = excel_data.get("workbook")
        excel_app = excel_data.get("excel_app")

        if workbook:
            # 워크북 닫기
            workbook.Close(SaveChanges=save_changes)
            logger.info(f"[ExcelManager] 워크북 닫기 완료 - execution_id: {execution_id}, save_changes: {save_changes}")

        if excel_app:
            # Excel 애플리케이션 종료
            try:
                excel_app.Quit()
                logger.info(f"[ExcelManager] Excel 애플리케이션 종료 요청 완료 - execution_id: {execution_id}")
            except Exception as e:
                # Excel 종료 중 오류 발생 (이미 종료되었을 수 있음)
                logger.warning(f"[ExcelManager] Excel 종료 중 오류 발생 (무시): {e}")

        # 저장소에서 제거
        del _excel_objects[execution_id]
        logger.info(f"[ExcelManager] 엑셀 객체 제거 완료 - execution_id: {execution_id}")

        return True
    except Exception as e:
        logger.error(f"[ExcelManager] 엑셀 객체 닫기 실패 - execution_id: {execution_id}, error: {e}")
        # 에러가 발생해도 저장소에서 제거
        _excel_objects.pop(execution_id, None)
        return False


def cleanup_excel_objects(execution_id: str) -> None:
    """
    실행 ID에 해당하는 엑셀 객체를 정리합니다.
    (에러 발생 시 강제 정리용)

    Args:
        execution_id: 실행 ID
    """
    if execution_id in _excel_objects:
        try:
            excel_data = _excel_objects[execution_id]
            workbook = excel_data.get("workbook")
            excel_app = excel_data.get("excel_app")

            if workbook:
                with contextlib.suppress(Exception):
                    workbook.Close(SaveChanges=False)

            if excel_app:
                with contextlib.suppress(Exception):
                    excel_app.Quit()
        except Exception as e:
            logger.warning(
                f"[ExcelManager] 엑셀 객체 강제 정리 중 에러 발생 - execution_id: {execution_id}, error: {e}"
            )
        finally:
            del _excel_objects[execution_id]
            logger.info(f"[ExcelManager] 엑셀 객체 강제 정리 완료 - execution_id: {execution_id}")


def has_excel_objects(execution_id: str) -> bool:
    """
    실행 ID에 해당하는 엑셀 객체가 있는지 확인합니다.

    Args:
        execution_id: 실행 ID

    Returns:
        엑셀 객체 존재 여부
    """
    return execution_id in _excel_objects


async def open_excel_file(
    file_path: str,
    visible: bool = True,
    max_wait_time: int = 30,
    check_interval: float = 0.1,
) -> tuple[Any, Any]:
    """
    엑셀 파일을 열고 Excel 애플리케이션과 워크북 객체를 반환합니다.
    Excel이 완전히 준비될 때까지 대기합니다.

    Args:
        file_path: 엑셀 파일 경로 (필수)
        visible: 엑셀 창 표시 여부 (기본값: True)
        max_wait_time: 최대 대기 시간 (초, 기본값: 30)
        check_interval: 확인 간격 (초, 기본값: 0.1)

    Returns:
        (excel_app, workbook) 튜플

    Raises:
        ValueError: 파일 경로가 없거나 파일이 존재하지 않는 경우
        RuntimeError: win32com이 사용 불가능하거나 Excel 열기 실패 시
    """
    # win32com 확인
    if win32com is None:
        raise RuntimeError("pywin32가 설치되어 있지 않습니다. pip install pywin32를 실행하세요.")

    # 파일 경로 검증
    if not file_path:
        raise ValueError("엑셀 파일 경로가 필요합니다.")

    # 파일 경로 정규화
    file_path = os.path.normpath(file_path)

    # 파일 존재 여부 확인
    if not os.path.exists(file_path):
        raise ValueError(f"파일을 찾을 수 없습니다: {file_path}")

    # 파일 확장자 확인
    if not file_path.lower().endswith((".xlsx", ".xls", ".xlsm")):
        raise ValueError(f"지원하지 않는 파일 형식입니다: {file_path}")

    # Excel 애플리케이션 객체 생성
    excel_app = win32com.client.Dispatch("Excel.Application")
    excel_app.Visible = bool(visible)

    # 엑셀 파일 열기
    workbook = excel_app.Workbooks.Open(file_path)

    # Excel이 완전히 준비될 때까지 대기
    start_time = time.time()
    excel_ready = False

    while (time.time() - start_time) < max_wait_time:
        try:
            if excel_app.Ready and workbook.Name:
                excel_ready = True
                break
        except Exception:
            pass
        await asyncio.sleep(check_interval)

    if not excel_ready:
        logger.warning(f"[ExcelManager] Excel 준비 확인 타임아웃 - file_path: {file_path}, 하지만 계속 진행합니다.")
    else:
        logger.info(f"[ExcelManager] Excel 준비 완료 - file_path: {file_path}")

    return excel_app, workbook
