"""
실제 노드 종류 정의
노드 타입(대분류)별로 사용 가능한 실제 노드 종류를 정의합니다.
"""

from typing import Any

# 노드 타입별 실제 노드 종류 매핑
ACTION_NODE_TYPES: dict[str, dict[str, Any]] = {
    "action": {
        # 향후 추가될 액션 노드들:
        # "file-read": {...},
        # "file-write": {...},
        # "database-query": {...},
    },
    "condition": {
        # 조건 노드 종류들
    },
    "wait": {
        # 대기 노드 종류들
    },
}

# 모든 실제 노드 종류 목록
ALL_ACTION_NODE_TYPES = {}
for node_type, action_nodes in ACTION_NODE_TYPES.items():
    ALL_ACTION_NODE_TYPES[node_type] = action_nodes


def get_action_node_types(node_type: str) -> dict[str, Any]:
    """
    특정 노드 타입의 실제 노드 종류 목록을 가져옵니다.

    Args:
        node_type: 노드 타입 (예: "action")

    Returns:
        실제 노드 종류 딕셔너리
    """
    return ACTION_NODE_TYPES.get(node_type, {})


def get_action_node_config(node_type: str, action_node_type: str) -> dict[str, Any] | None:
    """
    특정 실제 노드 종류의 설정을 가져옵니다.

    Args:
        node_type: 노드 타입 (예: "action")
        action_node_type: 실제 노드 종류 (예: "http-api-request")

    Returns:
        노드 설정 딕셔너리 또는 None
    """
    action_nodes = ACTION_NODE_TYPES.get(node_type, {})
    return action_nodes.get(action_node_type)


def get_all_action_node_types() -> dict[str, Any]:
    """모든 노드 타입별 실제 노드 종류를 반환합니다."""
    return ALL_ACTION_NODE_TYPES.copy()
