"""
엑셀 객체 관리 유틸리티
스크립트 실행 중 엑셀 애플리케이션과 워크북 객체를 관리합니다.
"""

import contextlib
from typing import Any

from log import log_manager

logger = log_manager.logger

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
