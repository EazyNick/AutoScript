"""
기본 노드 클래스
모든 노드의 공통 기능을 제공하는 추상 클래스
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from logging import Logger

from log import log_manager
from utils import validate_parameters


# ABC (Abstract Base Class): 추상 기본 클래스
# - Python의 abc 모듈에서 제공하는 추상 클래스입니다
# - ABC를 상속받으면 추상 메서드(@abstractmethod)를 정의할 수 있습니다
# - 추상 메서드를 구현하지 않은 자식 클래스는 인스턴스를 생성할 수 없습니다 (TypeError 발생)
# - 이를 통해 모든 노드가 execute 메서드를 반드시 구현하도록 강제할 수 있습니다
#
class BaseNode(ABC):
    """
    모든 노드의 기본 클래스

    공통 프로퍼티와 메서드를 제공하며, 각 노드는 execute 메서드를 구현해야 합니다.
    """

    # 공통 로거 프로퍼티
    @property
    def logger(self) -> Logger:
        """노드에서 사용할 로거 인스턴스"""
        return log_manager.logger

    @staticmethod
    @abstractmethod
    async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
        """
        노드를 실행합니다.

        Args:
            parameters: 노드 파라미터 딕셔너리

        Returns:
            실행 결과 딕셔너리
        """

    @staticmethod
    def _validate_and_normalize_parameters(parameters: dict[str, Any] | None) -> dict[str, Any]:
        """
        파라미터를 검증하고 정규화합니다.

        Args:
            parameters: 검증할 파라미터

        Returns:
            검증된 파라미터 딕셔너리
        """
        return validate_parameters(parameters)

    @staticmethod
    def _create_result(
        action: str, status: str = "completed", output: Any = None, message: str | None = None
    ) -> dict[str, Any]:
        """
        표준화된 결과 딕셔너리를 생성합니다.

        Args:
            action: 액션 이름
            status: 상태 ("completed" 또는 "failed")
            output: 출력 데이터
            message: 메시지 (선택)

        Returns:
            표준화된 결과 딕셔너리
        """
        result = {"action": action, "status": status, "output": output}

        if message:
            result["message"] = message

        return result
