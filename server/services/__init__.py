"""
서비스 패키지 초기화 파일
"""

from .action_service import ActionService

# 싱글톤 인스턴스 생성 (애플리케이션 시작 시 한 번만 생성)
action_service = ActionService()

__all__ = ["ActionService", "action_service"]
