import mimetypes
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
import uvicorn

from api import (
    action_node_router,
    action_router,
    config_router,
    dashboard_router,
    log_router,
    node_router,
    screenshot_router,
    script_router,
    state_router,
)
from config.server_config import settings
from db.database import db_manager
from log import log_manager

# 실행 명령어
# cd server
# python -m uvicorn main:app --reload --host 127.0.0.1 --port 8001

# Ensure correct MIME types (fix: .js/.mjs served as application/javascript)
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("application/javascript", ".mjs")

# 환경 변수 (config.py에서 관리)
ENVIRONMENT = settings.ENVIRONMENT  # 실행 환경 (development/production)
DEV_MODE = settings.DEV_MODE  # 개발 모드 여부

# 로거 초기화 (싱글톤 패턴)
logger = log_manager.logger
logger.info("=" * 60)
logger.info("서버 시작")
logger.info(f"환경: {ENVIRONMENT}")
logger.info(f"개발 모드: {DEV_MODE}")


def initialize_database() -> None:
    """
    데이터베이스 초기화 및 기본 데이터 생성
    서버 시작 시 한 번만 실행됩니다.
    """
    db_path = db_manager.connection.db_path
    is_new_db = not os.path.exists(db_path)  # 새 데이터베이스 여부

    try:
        # 모든 경우에 테이블 생성 및 마이그레이션 실행
        # (create_tables는 IF NOT EXISTS를 사용하므로 안전)
        db_manager.init_database()  # 테이블 생성 및 마이그레이션
        logger.info("✅ 데이터베이스 테이블 생성/마이그레이션 완료")

        if is_new_db:
            # 새 데이터베이스인 경우: 기본 데이터 삽입
            logger.info(f"새 데이터베이스 파일 생성됨: {db_path}")
            db_manager.seed_example_data(logger=logger)  # 예시 데이터 삽입
            logger.info("✅ 기본 데이터 삽입 완료")
        else:
            # 기존 데이터베이스인 경우: 설정값 확인 및 추가
            logger.info(f"기존 데이터베이스 파일 발견: {db_path}")
            scripts = db_manager.get_all_scripts()
            script_count = len(scripts)

            # 스크립트가 없으면 예시 데이터 생성
            if script_count == 0:
                logger.info("데이터베이스에 스크립트가 없습니다. 예시 데이터 생성 중...")
                db_manager.seed_example_data(logger=logger)
                logger.info("✅ 예시 데이터 생성 완료")
                scripts = db_manager.get_all_scripts()  # 생성된 스크립트 ID를 얻기 위해 재조회

            # 기본 설정값 확인 및 추가
            import json

            # 사이드바 너비 기본값 설정
            sidebar_width = db_manager.get_user_setting("sidebar-width")
            if sidebar_width is None:
                db_manager.save_user_setting("sidebar-width", "300")
                logger.info("✅ 기본 설정값 추가: sidebar-width")

            # 스크립트 순서 기본값 설정
            script_order = db_manager.get_user_setting("script-order")
            if script_order is None:
                if len(scripts) > 0:
                    # 기존 스크립트 ID 순서로 저장
                    script_ids = [script["id"] for script in scripts]
                    script_order_json = json.dumps(script_ids, ensure_ascii=False)
                else:
                    # 스크립트가 없으면 빈 배열
                    script_order_json = "[]"
                db_manager.save_user_setting("script-order", script_order_json)
                logger.info(f"✅ 기본 설정값 추가: script-order = {script_order_json}")

            # 스크린샷 기본 설정값 확인 및 추가
            auto_screenshot = db_manager.get_user_setting("screenshot.autoScreenshot")
            if auto_screenshot is None:
                db_manager.save_user_setting("screenshot.autoScreenshot", "true")
                logger.info("✅ 기본 설정값 추가: screenshot.autoScreenshot")

            screenshot_on_error = db_manager.get_user_setting("screenshot.screenshotOnError")
            if screenshot_on_error is None:
                db_manager.save_user_setting("screenshot.screenshotOnError", "true")
                logger.info("✅ 기본 설정값 추가: screenshot.screenshotOnError")

            screenshot_save_path = db_manager.get_user_setting("screenshot.savePath")
            if screenshot_save_path is None:
                db_manager.save_user_setting("screenshot.savePath", "./screenshots")
                logger.info("✅ 기본 설정값 추가: screenshot.savePath")

            screenshot_image_format = db_manager.get_user_setting("screenshot.imageFormat")
            if screenshot_image_format is None:
                db_manager.save_user_setting("screenshot.imageFormat", "PNG")
                logger.info("✅ 기본 설정값 추가: screenshot.imageFormat")

            # 언어 설정 기본값 확인 및 추가
            language = db_manager.get_user_setting("language")
            if language is None:
                db_manager.save_user_setting("language", "en")
                logger.info("✅ 기본 설정값 추가: language = en")

            # 포커스된 스크립트 ID 기본값 확인 및 추가
            focused_script_id = db_manager.get_user_setting("focused-script-id")
            if focused_script_id is None:
                if len(scripts) > 0:
                    # 첫 번째 스크립트 ID를 기본값으로 설정
                    first_script_id = scripts[0]["id"]
                    db_manager.save_user_setting("focused-script-id", str(first_script_id))
                    logger.info(f"✅ 기본 설정값 추가: focused-script-id = {first_script_id}")
                else:
                    # 스크립트가 없으면 빈 문자열로 설정 (나중에 스크립트가 생성되면 업데이트됨)
                    db_manager.save_user_setting("focused-script-id", "")
                    logger.info("✅ 기본 설정값 추가: focused-script-id = '' (스크립트 없음)")

            # 중복 설정 정리 (같은 setting_key에 대해 최신 것만 남기고 나머지 삭제)
            deleted_count = db_manager.user_settings.cleanup_duplicate_settings()
            if deleted_count > 0:
                logger.info(f"✅ 중복 설정 정리 완료: {deleted_count}개 행 삭제")
    except Exception as e:
        logger.error(f"❌ 데이터베이스 초기화 실패: {e}")
        raise e


app = FastAPI(title="AutoScript", description="API 서버", version="1.0.0")


# 서버 시작 시 데이터베이스 초기화
@app.on_event("startup")
async def startup_event() -> None:
    """서버 시작 시 실행되는 이벤트 핸들러"""
    logger.info("서버 시작 이벤트 실행 중...")
    initialize_database()
    logger.info("서버 시작 이벤트 완료")


# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 개발 환경에서는 모든 오리진 허용
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API 라우터 등록
app.include_router(action_router)
app.include_router(script_router)
app.include_router(state_router)
app.include_router(node_router)
app.include_router(config_router)
app.include_router(action_node_router)
app.include_router(dashboard_router)
app.include_router(log_router)
app.include_router(screenshot_router)

# 정적 파일 서빙 설정 (개발 환경)
ui_path = os.path.join(os.path.dirname(__file__), "..", "UI", "src")
if os.path.exists(ui_path):
    app.mount("/static", StaticFiles(directory=ui_path), name="static")
    logger.info(f"정적 파일 서빙 활성화: {ui_path}")
else:
    logger.warning("UI 경로를 찾을 수 없습니다. API만 사용 가능합니다.")


# HTML 파일에 클라이언트 설정 주입하는 헬퍼 함수
def inject_env_to_html(html_content: str) -> str:
    """
    HTML 내용에 클라이언트에 필요한 최소한의 설정만 주입

    보안: ENVIRONMENT 같은 서버 내부 정보는 클라이언트에 노출하지 않음
    """
    # 클라이언트에 필요한 최소한의 정보만 주입
    # 민감한 정보(ENVIRONMENT 등)는 제외
    dev_mode_value = "true" if DEV_MODE else "false"
    api_host = settings.API_HOST
    api_port = settings.API_PORT

    # API_HOST가 0.0.0.0이면 클라이언트에서는 localhost로 접근
    client_api_host = "localhost" if api_host == "0.0.0.0" else api_host

    script_tag = f"""
    <script>
        // 클라이언트에 필요한 최소한의 정보만 주입
        window.DEV_MODE = {dev_mode_value};
        window.API_HOST = '{client_api_host}';
        window.API_PORT = {api_port};
        console.log('[Server] 클라이언트 설정 주입됨:', {{
            DEV_MODE: window.DEV_MODE,
            API_HOST: window.API_HOST,
            API_PORT: window.API_PORT
        }});
    </script>
    """

    # </head> 태그 앞에 스크립트 삽입
    if "</head>" in html_content:
        html_content = html_content.replace("</head>", script_tag + "</head>")
    elif "<head>" in html_content:
        html_content = html_content.replace("<head>", "<head>" + script_tag)
    else:
        # head 태그가 없으면 body 앞에 추가
        html_content = html_content.replace("<body>", script_tag + "<body>")

    logger.debug(
        f"HTML에 클라이언트 설정 주입 완료: DEV_MODE={dev_mode_value}, API_HOST={client_api_host}, API_PORT={api_port}"
    )
    return html_content


# 기본 라우트 - 웹 UI 제공 (클라이언트 설정 주입)
@app.get("/")
async def root() -> Response:
    ui_file = os.path.join(ui_path, "index.html")
    if os.path.exists(ui_file):
        with open(ui_file, encoding="utf-8") as f:
            html_content = f.read()
        html_content = inject_env_to_html(html_content)
        return HTMLResponse(content=html_content)
    return JSONResponse(content={"message": "API 서버가 실행 중입니다."})


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "healthy", "service": "automation"}


if __name__ == "__main__":
    uvicorn.run(app, host=settings.API_HOST, port=settings.API_PORT)
