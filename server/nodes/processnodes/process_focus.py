"""
프로세스 포커스 노드
특정 프로세스/창에 포커스를 주는 노드입니다.
"""

import ctypes
import time
from typing import Any

import pygetwindow as gw
import win32con
import win32gui
import win32process

from log import log_manager
from nodes.base_node import BaseNode
from nodes.node_executor_wrapper import NodeExecutor
from utils import create_failed_result, get_parameter

logger = log_manager.logger


class ProcessFocusNode(BaseNode):
    """프로세스 포커스 노드 클래스"""

    @staticmethod
    def _force_foreground_window(hwnd: int) -> bool:
        """
        강제로 창을 포그라운드로 가져오는 헬퍼 함수
        AttachThreadInput을 사용하여 Windows 보안 제한을 우회합니다.
        """
        try:
            # 현재 포그라운드 창의 스레드 ID 가져오기
            foreground_hwnd = win32gui.GetForegroundWindow()
            if foreground_hwnd:
                foreground_thread_id = win32process.GetWindowThreadProcessId(foreground_hwnd)[0]
            else:
                foreground_thread_id = None

            # 대상 창의 스레드 ID 가져오기
            target_thread_id = win32process.GetWindowThreadProcessId(hwnd)[0]

            # 스레드 입력 연결 (AttachThreadInput)
            if foreground_thread_id and foreground_thread_id != target_thread_id:
                ctypes.windll.user32.AttachThreadInput(foreground_thread_id, target_thread_id, True)

            # 창 복원 및 표시
            if win32gui.IsIconic(hwnd):
                win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
                time.sleep(0.1)

            # 여러 방법으로 창 활성화 시도
            win32gui.ShowWindow(hwnd, win32con.SW_SHOW)
            win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
            win32gui.SetWindowPos(hwnd, win32con.HWND_TOP, 0, 0, 0, 0, win32con.SWP_NOMOVE | win32con.SWP_NOSIZE)
            win32gui.BringWindowToTop(hwnd)

            # AllowSetForegroundWindow 권한 부여
            ctypes.windll.user32.AllowSetForegroundWindow(-1)
            time.sleep(0.05)

            # SetForegroundWindow 시도
            try:
                win32gui.SetForegroundWindow(hwnd)
                win32gui.SetActiveWindow(hwnd)
            except Exception as e:
                logger.warning(f"SetForegroundWindow 실패: {e}")

            # 스레드 입력 연결 해제
            if foreground_thread_id and foreground_thread_id != target_thread_id:
                ctypes.windll.user32.AttachThreadInput(foreground_thread_id, target_thread_id, False)

            return True
        except Exception as e:
            logger.warning(f"_force_foreground_window 실패: {e}")
            # 실패해도 기본 방법 시도
            try:
                if win32gui.IsIconic(hwnd):
                    win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
                win32gui.ShowWindow(hwnd, win32con.SW_SHOW)
                win32gui.SetWindowPos(hwnd, win32con.HWND_TOP, 0, 0, 0, 0, win32con.SWP_NOMOVE | win32con.SWP_NOSIZE)
                win32gui.BringWindowToTop(hwnd)
            except Exception:
                pass
            return False

    @staticmethod
    @NodeExecutor("process-focus")
    async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
        """
        특정 프로세스/창에 포커스를 줍니다.

        Args:
            parameters: 노드 파라미터
                - process_id: 프로세스 ID (선택)
                - hwnd: 창 핸들 (선택)
                - window_title: 창 제목 (선택)
                - process_name: 프로세스 이름 (선택)

        Returns:
            실행 결과 딕셔너리
        """
        process_id = get_parameter(parameters, "process_id")
        hwnd = get_parameter(parameters, "hwnd")
        window_title = get_parameter(parameters, "window_title", default="")
        process_name = get_parameter(parameters, "process_name", default="")

        if not process_id and not hwnd:
            # process_id와 hwnd가 없으면 실패로 반환
            return create_failed_result(
                action="process-focus", reason="no_target", message="process_id 또는 hwnd가 제공되지 않았습니다."
            )

        # pygetwindow를 사용하여 창 찾기 (가장 안정적인 방법)
        target_window = None

        # 방법 1: window_title로 찾기 (가장 정확)
        if window_title:
            try:
                windows = gw.getWindowsWithTitle(window_title)
                if windows:
                    target_window = windows[0]
                    logger.debug(f"window_title로 창 찾기 성공: {window_title}")
            except Exception as e:
                logger.warning(f"window_title로 창 찾기 실패: {e}")

        # 방법 2: process_name으로 찾기
        if not target_window and process_name:
            try:
                windows = gw.getWindowsWithTitle(process_name)
                if windows:
                    # 정확한 창 제목이 있으면 매칭
                    if window_title:
                        for win in windows:
                            if win.title == window_title:
                                target_window = win
                                break
                    if not target_window:
                        target_window = windows[0]
                    logger.debug(f"process_name으로 창 찾기 성공: {process_name}")
            except Exception as e:
                logger.warning(f"process_name으로 창 찾기 실패: {e}")

        # 방법 3: hwnd로 직접 찾기
        if not target_window and hwnd:
            try:
                target_hwnd = int(hwnd)
                # 모든 창을 열거하여 hwnd로 찾기
                all_windows = gw.getAllWindows()
                for win in all_windows:
                    if hasattr(win, "_hWnd") and win._hWnd == target_hwnd:
                        target_window = win
                        logger.debug(f"hwnd로 창 찾기 성공: {hwnd}")
                        break
            except Exception as e:
                logger.warning(f"hwnd로 창 찾기 실패: {e}")

        # 방법 4: win32gui로 직접 처리 (최후의 수단)
        if not target_window:
            if hwnd:
                target_hwnd = int(hwnd)
            else:
                # process_id로 창 핸들 찾기
                target_hwnd = None

                def find_window_callback(hwnd: int, extra: Any) -> bool:
                    nonlocal target_hwnd
                    if win32gui.IsWindowVisible(hwnd):
                        _, pid = win32process.GetWindowThreadProcessId(hwnd)
                        if pid == process_id:
                            target_hwnd = hwnd
                            return False
                    return True

                win32gui.EnumWindows(find_window_callback, None)

                if not target_hwnd:
                    raise ValueError(f"프로세스 ID {process_id}에 해당하는 창을 찾을 수 없습니다.")

            # win32gui로 직접 처리 (강제 포커스 방법 사용)
            try:
                ProcessFocusNode._force_foreground_window(target_hwnd)

                return {
                    "action": "process-focus",
                    "status": "completed",
                    "message": "프로세스에 포커스를 주었습니다.",
                    "output": {"success": True, "process_id": process_id, "hwnd": target_hwnd},
                }
            except Exception as e:
                # 기본 작업 실패 시 에러 발생
                raise ValueError(f"창 포커스 실패: {e}")

        # pygetwindow로 창 포커스 시도 (실패 시 win32gui로 대체)
        if target_window:
            try:
                # 창이 최소화되어 있으면 복원
                if target_window.isMinimized:
                    target_window.restore()
                    time.sleep(0.1)

                # 창 활성화 및 포커스 시도
                try:
                    target_window.activate()
                    time.sleep(0.05)
                    target_window.restore()  # 다시 복원하여 최상단으로
                    logger.debug(f"pygetwindow로 창 포커스 성공: {target_window.title}")

                    return {
                        "action": "process-focus",
                        "status": "completed",
                        "message": f"프로세스 '{target_window.title}'에 포커스를 주었습니다.",
                        "output": {
                            "success": True,
                            "process_id": process_id,
                            "hwnd": target_window._hWnd if hasattr(target_window, "_hWnd") else None,
                            "window_title": target_window.title,
                        },
                    }
                except Exception as activate_error:
                    logger.warning(f"pygetwindow.activate() 실패, win32gui로 대체: {activate_error}")
                    # pygetwindow 실패 시 win32gui로 대체
                    target_hwnd = target_window._hWnd if hasattr(target_window, "_hWnd") else None
                    if not target_hwnd:
                        raise ValueError("창 핸들을 가져올 수 없습니다.")

                    # win32gui로 직접 처리 (강제 포커스 방법 사용)
                    ProcessFocusNode._force_foreground_window(target_hwnd)

                    logger.debug(f"win32gui로 창 포커스 성공: {target_window.title}")

                    return {
                        "action": "process-focus",
                        "status": "completed",
                        "message": f"프로세스 '{target_window.title}'에 포커스를 주었습니다.",
                        "output": {
                            "success": True,
                            "process_id": process_id,
                            "hwnd": target_hwnd,
                            "window_title": target_window.title,
                        },
                    }
            except Exception as e:
                logger.warning(f"pygetwindow 처리 실패: {e}")
                # 최후의 수단: win32gui로 직접 처리
                target_hwnd = target_window._hWnd if hasattr(target_window, "_hWnd") else None
                if not target_hwnd and hwnd:
                    target_hwnd = int(hwnd)

                if not target_hwnd:
                    raise ValueError(f"창 핸들을 가져올 수 없습니다: {e}")

                # win32gui로 직접 처리 (강제 포커스 방법 사용)
                ProcessFocusNode._force_foreground_window(target_hwnd)

                logger.debug("win32gui로 창 포커스 완료 (대체 방법)")

                return {
                    "action": "process-focus",
                    "status": "completed",
                    "message": "프로세스에 포커스를 주었습니다.",
                    "output": {"success": True, "process_id": process_id, "hwnd": target_hwnd},
                }

        # 창을 찾을 수 없는 경우
        return create_failed_result(action="process-focus", reason="window_not_found", message="창을 찾을 수 없습니다.")
