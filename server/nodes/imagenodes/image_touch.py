"""
이미지 터치 노드
화면에서 이미지를 찾아 터치하는 노드입니다.
"""

import os
from typing import Any

from automation.input_handler import InputHandler
from automation.screen_capture import ScreenCapture
from log import log_manager
from nodes.base_node import BaseNode
from nodes.node_executor_wrapper import NodeExecutor
from utils import create_failed_result, get_parameter

logger = log_manager.logger


class ImageTouchNode(BaseNode):
    """이미지 터치 노드 클래스"""

    @staticmethod
    @NodeExecutor("image-touch")
    async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
        """
        화면에서 이미지를 찾아 터치합니다.

        Args:
            parameters: 노드 파라미터
                - folder_path: 이미지 폴더 경로 (필수)

        Returns:
            실행 결과 딕셔너리
        """
        logger.info(f"[ImageTouchNode] execute 호출됨, parameters: {parameters}")
        logger.info(f"[ImageTouchNode] parameters 키 목록: {list(parameters.keys()) if parameters else []}")

        # 파라미터 추출
        # folder_path: 이미지 폴더 경로 (필수)
        folder_path = get_parameter(parameters, "folder_path", default="")
        logger.info(f"[ImageTouchNode] folder_path 추출 결과: {folder_path}")

        # timeout: 이미지를 찾을 때까지 대기할 최대 시간 (초)
        # 파라미터에서 timeout 추출 (없으면 None)
        timeout_param = get_parameter(parameters, "timeout", default=None)
        timeout = None
        if timeout_param is not None:
            try:
                timeout = float(timeout_param)
                if timeout <= 0:
                    logger.warning(f"[ImageTouchNode] 잘못된 timeout 값: {timeout}, timeout 사용 안 함")
                    timeout = None
                else:
                    logger.debug(f"[ImageTouchNode] 파라미터에서 지정된 타임아웃 사용: {timeout}초")
            except (ValueError, TypeError):
                logger.warning(f"[ImageTouchNode] timeout 값 변환 실패: {timeout_param}, timeout 사용 안 함")
                timeout = None

        # folder_path가 없으면 실패로 반환
        if not folder_path:
            logger.error(f"[ImageTouchNode] ❌ folder_path가 없습니다! parameters 전체: {parameters}")
            return create_failed_result(
                action="image-touch", reason="no_folder", message="폴더 경로가 제공되지 않았습니다."
            )

        # 폴더 존재 여부 확인
        if not os.path.exists(folder_path):
            raise ValueError(f"폴더를 찾을 수 없습니다: {folder_path}")

        # 지원하는 이미지 확장자 (set으로 빠른 조회)
        image_extensions = {".png", ".jpg", ".jpeg", ".bmp", ".gif", ".tiff", ".webp"}

        # 이미지 파일 목록 가져오기 (이름 순서대로)
        # image_files: 이미지 파일 경로 리스트
        image_files = []
        # 폴더 내 모든 파일 순회
        for filename in os.listdir(folder_path):
            file_path = os.path.join(folder_path, filename)
            # 파일인 경우만 처리 (디렉토리 제외)
            if os.path.isfile(file_path):
                # 파일 확장자 추출 (소문자로 변환하여 비교)
                _, ext = os.path.splitext(filename.lower())
                # 지원하는 이미지 확장자인 경우만 추가
                if ext in image_extensions:
                    image_files.append(file_path)

        # 파일 이름 순서대로 정렬 (알파벳 순서)
        image_files.sort()

        # 이미지 파일이 없으면 에러 반환
        if not image_files:
            return create_failed_result(action="image-touch", reason="no_images", message="이미지 파일이 없습니다.")

        # 화면 캡처 및 입력 핸들러 초기화
        # screen_capture: 화면 캡처 및 이미지 찾기용 객체
        screen_capture = ScreenCapture()
        # input_handler: 마우스 클릭 등 입력 처리용 객체
        input_handler = InputHandler()

        # results: 각 이미지 처리 결과 리스트
        results = []
        # 각 이미지 파일을 순회하며 화면에서 찾고 터치 시도
        for i, image_path in enumerate(image_files):
            try:
                logger.debug(f"이미지 찾기 시도 {i + 1}/{len(image_files)}: {os.path.basename(image_path)}")

                # 이미지 찾기 (threshold를 0.7로 낮춤, 필요시 더 낮출 수 있음)
                # timeout 파라미터를 전달하여 기본 타임아웃 설정 사용
                # location: 찾은 이미지의 위치 (x, y, width, height) 또는 None
                location = screen_capture.find_template(image_path, threshold=0.7, timeout=timeout)

                # 이미지를 찾았으면 터치 시도
                if location:
                    # location에서 좌표와 크기 추출
                    x, y, w, h = location
                    # 이미지 중심점 계산 (클릭 위치)
                    center_x = x + w // 2
                    center_y = y + h // 2

                    logger.debug(f"이미지 찾기 성공! 클릭 위치: ({center_x}, {center_y})")

                    # 터치 (클릭)
                    # success: 클릭 성공 여부
                    success = input_handler.click(center_x, center_y)

                    # 결과에 추가 (찾음, 위치, 터치 성공 여부 포함)
                    results.append(
                        {
                            "image": os.path.basename(image_path),
                            "found": True,
                            "position": (center_x, center_y),
                            "touched": success,
                        }
                    )
                else:
                    # 이미지를 찾지 못한 경우
                    logger.debug(f"이미지 찾기 실패: {os.path.basename(image_path)}")
                    results.append(
                        {
                            "image": os.path.basename(image_path),
                            "found": False,
                            "message": "화면에서 이미지를 찾을 수 없습니다.",
                        }
                    )

            except Exception as e:
                # 이미지 처리 중 예외 발생 시 에러 로그 출력
                logger.error(f"이미지 처리 중 오류 발생 ({os.path.basename(image_path)}): {e}")
                import traceback

                # 스택 트레이스 출력 (디버깅용)
                logger.error(f"스택 트레이스: {traceback.format_exc()}")
                # 결과에 에러 정보 추가
                results.append({"image": os.path.basename(image_path), "error": str(e)})

        # 성공 여부 판단: 하나라도 이미지를 찾아서 터치했으면 성공
        # success: 전체 작업 성공 여부 (하나라도 found=True이고 touched=True이면 True)
        success = any(r.get("found", False) and r.get("touched", False) for r in results)

        return {
            "action": "image-touch",
            "status": "completed" if success else "failed",
            "output": {
                "success": success,
                "folder_path": folder_path,
                "total_images": len(image_files),
                "results": results,
            },
        }
