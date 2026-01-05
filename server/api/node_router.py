"""
노드 관련 API 라우터
"""

from typing import Any

from fastapi import APIRouter, HTTPException

from api.helpers import api_handler, get_script_or_raise, save_script_data_or_raise, success_response
from api.helpers.constants import API_CONSTANTS
from models.response_models import SuccessResponse

router = APIRouter(prefix="/api/nodes", tags=["nodes"])


@router.get("/script/{script_id}", response_model=SuccessResponse)
@api_handler
async def get_nodes_by_script(script_id: int) -> SuccessResponse:
    """특정 스크립트의 모든 노드 조회"""
    script = get_script_or_raise(script_id)

    return success_response(
        {
            "script_id": script_id,
            "nodes": script.get("nodes", []),
            "connections": script.get("connections", []),
        },
        "노드 목록 조회 완료",
    )


@router.post("/script/{script_id}", response_model=SuccessResponse)
@api_handler
async def create_node(script_id: int, node_data: dict[str, Any]) -> SuccessResponse:
    """새 노드 생성"""
    # 스크립트 존재 확인
    script = get_script_or_raise(script_id)

    # 노드 데이터 검증
    required_fields = ["id", "type", "position", "data"]
    for field in required_fields:
        if field not in node_data:
            raise HTTPException(status_code=API_CONSTANTS.HTTP_BAD_REQUEST, detail=f"필수 필드 '{field}'가 없습니다.")

    # 기존 노드 목록 가져오기
    nodes = script.get("nodes", [])

    # 새 노드 추가
    nodes.append(
        {"id": node_data["id"], "type": node_data["type"], "position": node_data["position"], "data": node_data["data"]}
    )

    # 데이터베이스에 저장
    connections = script.get("connections", [])
    save_script_data_or_raise(script_id, nodes, connections, "노드 생성 실패")

    return success_response({"node": node_data}, "노드가 생성되었습니다.")


@router.put("/script/{script_id}/batch", response_model=SuccessResponse)
@api_handler
async def update_nodes_batch(
    script_id: int, nodes: list[dict[str, Any]], connections: list[dict[str, Any]] | None = None
) -> SuccessResponse:
    """여러 노드를 일괄 업데이트"""
    # 스크립트 존재 확인
    script = get_script_or_raise(script_id)

    # 연결 정보가 없으면 기존 연결 유지
    if connections is None:
        connections = script.get("connections", [])

    # 데이터베이스에 저장
    save_script_data_or_raise(script_id, nodes, connections, "노드 업데이트 실패")

    return success_response(
        {"node_count": len(nodes), "connection_count": len(connections)},
        "노드들이 업데이트되었습니다.",
    )


@router.delete("/script/{script_id}/node/{node_id}", response_model=SuccessResponse)
@api_handler
async def delete_node(script_id: int, node_id: str) -> SuccessResponse:
    """노드 삭제"""
    # 스크립트 존재 확인
    script = get_script_or_raise(script_id)

    # 노드 목록에서 해당 노드 제거
    nodes = script.get("nodes", [])
    nodes = [n for n in nodes if n["id"] != node_id]

    # 연결 목록에서 해당 노드 관련 연결 제거
    connections = script.get("connections", [])
    connections = [c for c in connections if c["from"] != node_id and c["to"] != node_id]

    # 데이터베이스에 저장
    save_script_data_or_raise(script_id, nodes, connections, "노드 삭제 실패")

    return success_response({"node_id": node_id}, "노드가 삭제되었습니다.")


@router.put("/script/{script_id}/node/{node_id}", response_model=SuccessResponse)
@api_handler
async def update_node(script_id: int, node_id: str, node_data: dict[str, Any]) -> SuccessResponse:
    """노드 업데이트"""
    # 스크립트 존재 확인
    script = get_script_or_raise(script_id)

    # 노드 목록에서 해당 노드 찾아서 업데이트
    nodes = script.get("nodes", [])
    node_found = False
    updated_node = None

    for i, node in enumerate(nodes):
        if node["id"] == node_id:
            # 노드 데이터 업데이트
            updated_node = {
                "id": node_id,
                "type": node_data.get("type", node["type"]),
                "position": node_data.get("position", node["position"]),
                "data": node_data.get("data", node["data"]),
            }
            nodes[i] = updated_node
            node_found = True
            break

    if not node_found:
        raise HTTPException(status_code=API_CONSTANTS.HTTP_NOT_FOUND, detail=API_CONSTANTS.ERROR_NODE_NOT_FOUND)

    # 데이터베이스에 저장
    connections = script.get("connections", [])
    save_script_data_or_raise(script_id, nodes, connections, API_CONSTANTS.ERROR_NODE_UPDATE_FAILED)

    return success_response({"node": updated_node}, "노드가 업데이트되었습니다.")
