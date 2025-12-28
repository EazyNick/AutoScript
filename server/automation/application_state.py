import json
import time
from typing import Any

from log import log_manager

logger = log_manager.logger


class ApplicationState:
    """애플리케이션 상태 관리 클래스"""

    def __init__(self) -> None:
        self.state = {
            "is_running": False,
            "last_action": None,
            "last_action_time": None,
            "session_start_time": time.time(),
            "actions_performed": 0,
            "errors_count": 0,
        }

    def update_state(self, key: str, value: Any) -> None:
        """애플리케이션 상태를 업데이트합니다."""
        self.state[key] = value
        self.state["last_action_time"] = time.time()

    def get_state(self, key: str | None = None) -> Any:
        """애플리케이션 상태를 반환합니다."""
        if key:
            return self.state.get(key)
        return self.state.copy()

    def record_action(self, action: str, success: bool = True) -> None:
        """수행된 액션을 기록합니다."""
        self.update_state("last_action", action)
        actions_performed: Any = self.state.get("actions_performed", 0)
        self.update_state("actions_performed", int(actions_performed) + 1)

        if not success:
            errors_count: Any = self.state.get("errors_count", 0)
            self.update_state("errors_count", int(errors_count) + 1)

    def get_session_stats(self) -> dict[str, Any]:
        """세션 통계를 반환합니다."""
        start_time: Any = self.state.get("session_start_time", time.time())
        session_duration = time.time() - float(start_time)

        actions_performed: Any = self.state.get("actions_performed", 0)
        errors_count: Any = self.state.get("errors_count", 0)

        return {
            "session_duration": session_duration,
            "actions_performed": int(actions_performed),
            "errors_count": int(errors_count),
            "success_rate": self._calculate_success_rate(),
            "actions_per_minute": self._calculate_actions_per_minute(session_duration),
        }

    def _calculate_success_rate(self) -> float:
        """성공률을 계산합니다."""
        total_actions: Any = self.state.get("actions_performed", 0)
        errors: Any = self.state.get("errors_count", 0)

        total = int(total_actions)
        if total == 0:
            return 100.0

        return ((total - int(errors)) / total) * 100

    def _calculate_actions_per_minute(self, session_duration: float) -> float:
        """분당 액션 수를 계산합니다."""
        if session_duration == 0:
            return 0.0

        actions: Any = self.state.get("actions_performed", 0)
        return (int(actions) / session_duration) * 60

    def reset_session(self) -> None:
        """세션을 리셋합니다."""
        self.state.update(
            {
                "session_start_time": time.time(),
                "actions_performed": 0,
                "errors_count": 0,
                "last_action": None,
                "last_action_time": None,
            }
        )

    def save_state_to_file(self, filename: str) -> bool:
        """애플리케이션 상태를 파일로 저장합니다."""
        try:
            with open(filename, "w", encoding="utf-8") as f:
                json.dump(self.state, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            logger.error(f"상태 저장 실패: {e}")
            return False

    def load_state_from_file(self, filename: str) -> bool:
        """파일에서 애플리케이션 상태를 로드합니다."""
        try:
            with open(filename, encoding="utf-8") as f:
                loaded_state = json.load(f)
                self.state.update(loaded_state)
            return True
        except Exception as e:
            logger.error(f"상태 로드 실패: {e}")
            return False

    def is_running(self) -> bool:
        """애플리케이션이 실행 중인지 확인합니다."""
        running: Any = self.state.get("is_running", False)
        return bool(running)

    def set_running(self, running: bool) -> None:
        """애플리케이션 실행 상태를 설정합니다."""
        self.update_state("is_running", running)
