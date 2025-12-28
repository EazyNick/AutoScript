import os
from pathlib import Path

from dotenv import load_dotenv

# 프로젝트 루트 디렉토리의 .env 파일 경로 지정
# server/config/server_config.py에서 루트 디렉토리로 이동 (상위 디렉토리 2개)
env_path = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(dotenv_path=env_path)


class Settings:
    # 환경 설정
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "prd").lower()
    DEV_MODE: bool = os.getenv("ENVIRONMENT", "prd").lower() == "dev"

    # API 설정
    # 보안: 기본값을 127.0.0.1로 설정하여 로컬호스트에서만 접근 가능하도록 함
    # 내부망 접근을 차단하려면 .env 파일에서 API_HOST=127.0.0.1로 설정하거나 기본값 사용
    API_HOST: str = os.getenv("API_HOST", "127.0.0.1")
    API_PORT: int = int(os.getenv("API_PORT", "8000"))
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"

    # 애플리케이션 설정
    WINDOW_TITLE: str = os.getenv("WINDOW_TITLE", "")
    SCREEN_WIDTH: int = int(os.getenv("SCREEN_WIDTH", "1920"))
    SCREEN_HEIGHT: int = int(os.getenv("SCREEN_HEIGHT", "1080"))

    # automation 설정
    AUTO_CLICK_DELAY: float = float(os.getenv("AUTO_CLICK_DELAY", "0.5"))
    AUTO_MOVE_DELAY: float = float(os.getenv("AUTO_MOVE_DELAY", "1.0"))
    SCREENSHOT_INTERVAL: float = float(os.getenv("SCREENSHOT_INTERVAL", "0.1"))

    # 로그 설정
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    LOG_DIR: str = os.getenv("LOG_DIR", "log/logs")


settings = Settings()
