"""
스크린샷 관련 API 라우터
"""

from datetime import datetime
import os
from pathlib import Path
import re

import cv2
from fastapi import APIRouter, Body, HTTPException, Request

from api.helpers import api_handler, success_response
from automation.screen_capture import ScreenCapture
from log import log_manager
from models.response_models import SuccessResponse

router = APIRouter(prefix="/api", tags=["screenshots"])
logger = log_manager.logger
screen_capture = ScreenCapture()


@router.post("/screenshots/capture", response_model=SuccessResponse)
@api_handler
async def capture_and_save_screenshot(
    request: Request,
    filename: str = Body(..., embed=True),
    save_path: str = Body(..., embed=True),
    image_format: str = Body(default="PNG", embed=True),
    node_id: str = Body(default="", embed=True),
    node_type: str = Body(default="", embed=True),
    script_name: str = Body(default="", embed=True),
    node_name: str = Body(default="", embed=True),
    is_running_all_scripts: bool = Body(default=False, embed=True),
    execution_start_time: str = Body(default="", embed=True),
    script_execution_order: int = Body(default=None, embed=True),
) -> SuccessResponse:
    """
    화면을 캡처하고 저장합니다.

    Args:
        filename: 저장할 파일명
        save_path: 저장 경로 (상대 경로 또는 절대 경로)
        image_format: 이미지 형식 ('PNG' 또는 'JPEG')
        node_id: 노드 ID (메타데이터용)
        node_type: 노드 타입 (메타데이터용)
        script_name: 스크립트 이름 (메타데이터용)
        node_name: 노드 이름 (메타데이터용)
        is_running_all_scripts: 전체 실행 여부 (True: 전체 실행, False: 단일 실행)

    Returns:
        캡처 및 저장 성공 여부 및 파일 경로
    """
    client_ip = request.client.host if request.client else "unknown"
    logger.info(
        f"[API] 스크린샷 캡처 요청 - 파일명: {filename}, 경로: {save_path}, 스크립트: {script_name}, 노드: {node_name} (ID: {node_id}), 전체 실행: {is_running_all_scripts}, 실행 순서: {script_execution_order}, 클라이언트 IP: {client_ip}"
    )

    try:
        # 화면 캡처
        logger.info("[API] 화면 캡처 시작...")
        screenshot = screen_capture.capture_screen()
        logger.info(f"[API] 화면 캡처 완료 - 크기: {screenshot.shape}")

        # 저장 경로 처리
        if not save_path:
            save_path = "./screenshots"

        # 상대 경로인 경우 프로젝트 루트 기준으로 변환
        if not os.path.isabs(save_path):
            # 프로젝트 루트 디렉토리 찾기 (server/api/screenshot_router.py에서 상위 2단계)
            project_root = Path(__file__).resolve().parent.parent.parent
            save_path = project_root / save_path.lstrip("./")

        # 날짜+시간 폴더 생성 (YYYY-MM-DD_HH-MM-SS 형식)
        # 클라이언트에서 전달된 execution_start_time 사용 (전체 실행 시 모든 스크립트가 같은 시간 전달)
        if execution_start_time:
            try:
                # ISO 형식 문자열을 datetime으로 변환
                exec_start_dt = datetime.fromisoformat(execution_start_time.replace("Z", "+00:00"))
                # 로컬 시간으로 변환
                if exec_start_dt.tzinfo:
                    exec_start_dt = exec_start_dt.astimezone()
                folder_name = exec_start_dt.strftime("%Y-%m-%d_%H-%M-%S")
            except (ValueError, AttributeError):
                # 파싱 실패 시 현재 시간 사용
                folder_name = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        else:
            folder_name = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")

        date_time_dir = Path(save_path) / folder_name

        # 실행 모드에 따라 폴더 구조 결정
        if is_running_all_scripts:
            # 전체 실행인 경우: 날짜+시간 폴더 안에 스크립트별 폴더 생성
            # 스크립트 이름을 안전한 파일명으로 변환 (Windows에서 사용 불가능한 문자 제거)
            safe_script_name = re.sub(r'[<>:"/\\|?*]', "_", script_name).strip() if script_name else "Unknown"
            # 실행 순서가 있으면 폴더명에 포함 (예: "1. 로그인 테스트")
            if script_execution_order is not None and script_execution_order > 0:
                folder_name_with_order = f"{script_execution_order}. {safe_script_name}"
            else:
                folder_name_with_order = safe_script_name
            save_dir = date_time_dir / folder_name_with_order
        else:
            # 단일 실행인 경우: 날짜+시간 폴더에 직접 저장
            save_dir = date_time_dir

        # 디렉토리 생성
        save_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"[API] 저장 디렉토리 확인/생성 완료: {save_dir}")

        # 파일 경로 생성
        file_path = save_dir / filename

        # 이미지 형식에 따라 파일 확장자 확인
        file_ext = Path(filename).suffix.lower()
        if not file_ext:
            # 확장자가 없으면 형식에 따라 추가
            if image_format.upper() == "JPEG":
                file_path = file_path.with_suffix(".jpg")
            else:
                file_path = file_path.with_suffix(".png")

        # 이미지 형식에 따라 저장
        # Windows에서 한글 경로 문제를 해결하기 위해 cv2.imencode를 사용하여 바이너리 모드로 저장
        try:
            # 이미지 형식에 따라 인코딩
            if image_format.upper() == "JPEG":
                # JPEG 형식인 경우
                encode_param = [cv2.IMWRITE_JPEG_QUALITY, 95]
                success, encoded_img = cv2.imencode(".jpg", screenshot, encode_param)
            else:
                # PNG 형식 (기본값)
                success, encoded_img = cv2.imencode(".png", screenshot)

            if not success:
                raise Exception("이미지 인코딩 실패")

            # 바이너리 모드로 파일 저장 (한글 경로 지원)
            with open(file_path, "wb") as f:
                f.write(encoded_img.tobytes())

            # 파일이 실제로 저장되었는지 확인
            if not file_path.exists():
                raise Exception(f"파일 저장 후 확인 실패: {file_path}")

            logger.info(f"[API] 스크린샷 저장 완료 - 경로: {file_path}")

            # 메타데이터 저장 (선택사항)
            metadata = {
                "filename": file_path.name,
                "path": str(file_path),
                "node_id": node_id,
                "node_type": node_type,
                "script_name": script_name,
                "node_name": node_name,
                "saved_at": datetime.now().isoformat(),
                "image_format": image_format,
            }

            return success_response(metadata, "스크린샷 캡처 및 저장 완료")
        except Exception as e:
            logger.error(f"[API] 파일 저장 실패: {e!s}")
            raise HTTPException(status_code=500, detail=f"파일 저장 실패: {e!s}")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[API] 스크린샷 캡처 실패: {e!s}")
        raise HTTPException(status_code=500, detail=f"스크린샷 캡처 실패: {e!s}")
