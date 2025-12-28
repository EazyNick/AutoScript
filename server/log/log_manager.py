"""
LogManager Module

싱글톤 패턴으로 설계되어 로그 설정을 중앙에서 관리하며, 다음과 같은 주요 기능을 포함합니다:

- 로그 파일 생성 및 관리
- 컬러 로그 포맷 지원
- 오래된 로그 파일 자동 정리

사용 예시:

    from log import log_manager

    log_manager.logger.info("This is an info message")
    log_manager.logger.debug("This is a debug message")
    log_manager.logger.hr("Section Start", level=2)
"""

from __future__ import annotations

from datetime import datetime
import glob
import logging
import os
from pathlib import Path
import sys
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from logging import Logger

import colorlog


class LogManager:
    """
    로그 관리 클래스

    싱글톤 패턴으로 설계되었으며, 컬러 로그 포맷 및 로그 파일 정리를 지원합니다.
    """

    _instance: LogManager | None = None
    logger: Logger

    def __new__(cls, *args: object, **kwargs: object) -> LogManager:
        if not cls._instance:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self, directory: str | None = None, max_files: int = 10) -> None:
        """
        LogManager 초기화

        Args:
            directory (str, optional): 로그 파일을 저장할 디렉토리. None이면 server/log/logs 사용
            max_files (int): 유지할 최대 로그 파일 개수 (기본값: 10)
        """
        if not hasattr(self, "initialized"):  # 이 인스턴스가 초기화되었는지 확인
            # directory가 지정되지 않으면 server/log/logs 디렉토리 사용
            if directory is None:
                # 현재 파일의 위치가 이미 server/log/log_manager.py이므로
                # server/log/logs 디렉토리를 사용
                current_file_dir = os.path.dirname(os.path.abspath(__file__))
                self.directory = os.path.join(current_file_dir, "logs")  # server/log/logs 디렉토리
            else:
                self.directory = directory

            # 디렉토리가 없으면 생성
            log_path = Path(self.directory)
            if not log_path.exists():
                os.makedirs(log_path)

            # server_config에서 로그 레벨 읽기
            from config.server_config import settings

            log_level_str = settings.LOG_LEVEL
            self.log_level = getattr(logging, log_level_str.upper(), logging.INFO)

            self.max_files = max_files
            self._timestamp = self._init_timestamp()
            self.logger = self._init_logger()
            self._bind_hr_to_logger()
            self.clean_up_logs()
            self.initialized = True

    def _init_timestamp(self) -> str:
        """타임스탬프 초기화"""
        return datetime.now().strftime("%Y%m%d-%H%M%S")

    def _init_logger(self) -> Logger:
        """로거 초기화"""
        logger = logging.getLogger("Automation")

        # 기존 핸들러가 있으면 제거 (중복 방지)
        logger.handlers.clear()

        log_colors_config = {
            "DEBUG": "cyan",
            "INFO": "green",
            "WARNING": "yellow",
            "ERROR": "red",
            "CRITICAL": "red,bg_white",
        }

        formatter = colorlog.ColoredFormatter(
            "[%(log_color)s%(asctime)s.%(msecs)03d][%(levelname).1s][%(filename)s(%(funcName)s):%(lineno)d] %(message)s",
            log_colors=log_colors_config,
            datefmt="%Y-%m-%d %H:%M:%S",
            reset=True,
            secondary_log_colors={},
        )

        # 콘솔 핸들러 (컬러 로그)
        stream_handler = logging.StreamHandler()
        stream_handler.setFormatter(formatter)
        logger.addHandler(stream_handler)

        # 로그 파일명 생성
        script_name = os.path.basename(sys.argv[0]) if sys.argv else "unknown"
        logfile = f"{self._timestamp}_{script_name}.log"
        logpath = Path(self.directory)

        # 파일 핸들러
        file_handler = logging.FileHandler(logpath / logfile, encoding="utf-8")
        file_handler.setFormatter(formatter)
        file_handler.setLevel(logging.DEBUG)
        logger.addHandler(file_handler)

        logger.propagate = False
        # 설정된 로그 레벨 적용
        logger.setLevel(self.log_level)
        stream_handler.setLevel(self.log_level)
        logger.debug("Logger initialized")

        return logger

    def hr(self, message: str = "", level: int = 1) -> None:
        """
        구분선을 출력하는 메서드.

        Args:
            message (str): 구분선 위에 출력할 메시지 (기본값: 빈 문자열)
            level (int): 구분선 길이 조정 (기본값: 1)
        """
        line = "=" * (level * 20)  # 구분선 길이 설정
        if message:
            self.logger.info(f"\n{line}\n{message}\n{line}")
        else:
            self.logger.info(f"\n{line}")

    def _bind_hr_to_logger(self) -> None:
        """
        hr 메서드를 logger 객체에 동적으로 추가합니다.
        """
        self.logger.hr = self.hr  # logger 객체에 hr 메서드 바인딩

    def get_timestamp(self) -> str:
        """시작 타임스탬프 반환"""
        return self._timestamp

    def clean_up_logs(self) -> None:
        """
        오래된 로그 파일 정리

        설정된 디렉토리에서 최대 파일 개수를 초과하는 오래된 로그 파일을 삭제합니다.
        """
        try:
            # 디렉토리 내의 특정 패턴의 파일 목록을 가져옵니다.
            files = glob.glob(os.path.join(self.directory, "*.log"))

            if not files:
                return

            # 파일을 생성 시간에 따라 정렬합니다.
            files.sort(key=os.path.getmtime)

            # 지정된 개수를 초과하는 파일이 있다면, 가장 오래된 파일부터 삭제합니다.
            while len(files) > self.max_files:
                file_to_remove = files.pop(0)
                try:
                    os.remove(file_to_remove)
                    self.logger.debug(f"오래된 로그 파일 삭제: {os.path.basename(file_to_remove)}")
                except OSError as e:
                    self.logger.warning(f"로그 파일 삭제 실패: {file_to_remove}, 에러: {e}")
        except Exception as e:
            # clean_up_logs에서 에러가 발생해도 로거 초기화는 계속 진행
            print(f"[WARNING] 로그 정리 중 에러 발생: {e}")


if __name__ == "__main__":
    # 테스트 코드
    log_manager = LogManager()
    log_manager.logger.info("This is an info message for testing purposes.")
    log_manager.logger.debug("This is a debug message for testing purposes.")
    log_manager.logger.warning("경고 메시지")
    log_manager.logger.error("This is an error message for testing purposes.")
    log_manager.logger.hr("Section Start", level=2)
    print(f"Timestamp: {log_manager.get_timestamp()}")
