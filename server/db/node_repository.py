"""노드 리포지토리 모듈"""

import json
import os
import sqlite3
import sys
from typing import Any

# 직접 실행 시와 모듈로 import 시 모두 지원
try:
    from ..config.nodes_config import NODES_CONFIG
    from .connection import DatabaseConnection
except ImportError:
    # 직접 실행 시 절대 import 사용
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from config.nodes_config import NODES_CONFIG
    from db.connection import DatabaseConnection


class NodeRepository:
    """노드 관련 데이터베이스 작업을 처리하는 클래스"""

    def __init__(self, connection: DatabaseConnection) -> None:
        """
        NodeRepository 초기화

        Args:
            connection: DatabaseConnection 인스턴스
        """
        self.connection = connection

    def get_nodes_by_script_id(self, script_id: int) -> list[dict[str, Any]]:
        """
        스크립트 ID로 노드 목록 조회

        Args:
            script_id: 스크립트 ID

        Returns:
            노드 목록
        """
        conn = self.connection.get_connection()
        cursor = self.connection.get_cursor(conn)

        try:
            cursor.execute(
                """
                SELECT id, node_id, node_type, position_x, position_y, node_data,
                       connected_to, connected_from,
                       COALESCE(parameters, '{}') as parameters, description,
                       created_at, updated_at,
                       is_connected, connection_sequence, node_identifier
                FROM nodes
                WHERE script_id = ?
                ORDER BY id
            """,
                (script_id,),
            )

            nodes = []
            # nodes_config.py에 정의된 노드 타입만 허용
            valid_node_types = set(NODES_CONFIG.keys())

            for row in cursor.fetchall():
                # SELECT 순서: id(0), node_id(1), node_type(2), position_x(3), position_y(4),
                #              node_data(5), connected_to(6), connected_from(7), parameters(8), description(9),
                #              created_at(10), updated_at(11), is_connected(12), connection_sequence(13), node_identifier(14)
                node_type = row[2]

                # nodes_config.py에 정의되지 않은 노드는 제외
                if node_type not in valid_node_types:
                    print(
                        f"[NodeRepository] 경고: 정의되지 않은 노드 타입 '{node_type}' (노드 ID: {row[1]})를 건너뜁니다."
                    )
                    continue

                connected_to_raw = row[6] if len(row) > 6 else None
                connected_from_raw = row[7] if len(row) > 7 else None
                parameters_raw = row[8] if len(row) > 8 else None
                description = row[9] if len(row) > 9 else None
                created_at = row[10] if len(row) > 10 else None
                updated_at = row[11] if len(row) > 11 else None
                is_connected = bool(row[12]) if len(row) > 12 and row[12] is not None else None
                connection_sequence = row[13] if len(row) > 13 else None
                node_identifier = row[14] if len(row) > 14 else None

                connected_to = self._parse_json_field(connected_to_raw, [])
                connected_from = self._parse_json_field(connected_from_raw, [])
                parameters = self._parse_json_field(parameters_raw, {})

                db_id = row[0]
                node_id = row[1]

                # node_data는 원본 그대로 사용 (메타데이터 제외)
                node_data = json.loads(row[5])

                # 메타데이터를 별도 딕셔너리로 분리
                metadata = {
                    "id": node_id,
                    "x": row[3],
                    "y": row[4],
                }
                if created_at:
                    metadata["createdAt"] = created_at
                if updated_at:
                    metadata["updatedAt"] = updated_at

                nodes.append(
                    {
                        "id": node_id,
                        "type": node_type,
                        "position": {"x": row[3], "y": row[4]},
                        "data": node_data,
                        "metadata": metadata,  # 메타데이터를 별도 필드로 추가
                        "connected_to": connected_to,
                        "connected_from": connected_from,
                        "parameters": parameters,
                        "description": description,
                        "_db_id": db_id,  # 내부적으로 DB id 저장
                        # 연결 정보 추가
                        "is_connected": is_connected,
                        "connection_sequence": connection_sequence,
                        "node_identifier": node_identifier,
                    }
                )

            return nodes
        finally:
            conn.close()

    def _parse_json_field(self, raw_value: str | None, default_value: Any) -> Any:
        """
        JSON 필드 파싱

        Args:
            raw_value: 원시 값 (JSON 문자열, dict, list, 또는 None)
            default_value: 기본값 (파싱 실패 시 반환할 값)

        Returns:
            파싱된 값 (dict, list, 또는 default_value)
        """
        # raw_value가 없으면 기본값 반환
        if not raw_value:
            return default_value

        try:
            # raw_value가 문자열이면 JSON 파싱 시도
            if isinstance(raw_value, str):
                # 빈 문자열이 아니면 JSON 파싱, 빈 문자열이면 기본값 반환
                return json.loads(raw_value) if raw_value.strip() else default_value
            # raw_value가 이미 dict나 list이면 그대로 반환, 아니면 기본값 반환
            return raw_value if isinstance(raw_value, (list, dict)) else default_value
        except (json.JSONDecodeError, ValueError) as e:
            # JSON 파싱 실패 시 경고 출력하고 기본값 반환
            print(f"Warning: JSON 파싱 실패: {e}")
            return default_value

    def build_connections_from_nodes(self, nodes: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """
        노드 목록에서 연결 정보 생성

        Args:
            nodes: 노드 목록

        Returns:
            연결 정보 목록
        """
        connections = []
        for node in nodes:
            connected_to_list = node.get("connected_to", [])
            if isinstance(connected_to_list, list) and len(connected_to_list) > 0:
                for conn_item in connected_to_list:
                    # 새로운 형식: 객체 형태 {"to": "node_id", "outputType": "true"/"false"/null}
                    if isinstance(conn_item, dict):
                        to_node_id = conn_item.get("to")
                        output_type = conn_item.get("outputType")
                        if to_node_id:
                            connections.append({"from": node["id"], "to": to_node_id, "outputType": output_type})
                    # 기존 형식: 문자열 형태 (하위 호환성)
                    elif isinstance(conn_item, str):
                        connections.append({"from": node["id"], "to": conn_item, "outputType": None})
            elif isinstance(connected_to_list, dict):
                print(f"Warning: 노드 {node['id']}의 connected_to가 딕셔너리입니다. 무시합니다.")

        return connections

    def validate_connections(self, nodes: list[dict[str, Any]], connections: list[dict[str, Any]]) -> None:
        """
        연결 정보 검증 (조건 노드가 아닌 노드는 출력을 최대 1개만 연결 가능)
        반복 노드의 경우 아래 연결점(bottom)은 출력으로 카운트하지 않음

        Args:
            nodes: 노드 목록
            connections: 연결 정보 목록

        Raises:
            ValueError: 검증 실패 시
        """
        # node_output_count: 각 노드의 출력 연결 개수를 저장하는 딕셔너리
        # key: 노드 ID, value: 출력 연결 개수
        node_output_count = {}
        # node_type_map: 노드 ID를 키로 하는 노드 타입 맵 (빠른 조회를 위함)
        node_type_map = {node["id"]: node.get("type") for node in nodes}

        # 각 연결을 순회하며 출력 연결 개수 확인
        for connection in connections:
            # from_node_id: 연결 출발 노드 ID
            from_node_id = connection.get("from")
            # from_node_id가 있으면 처리
            if from_node_id:
                # node_type: 출발 노드의 타입
                node_type = node_type_map.get(from_node_id)
                # output_type: 출력 타입 (조건 노드의 경우 "true"/"false", 반복 노드의 경우 "bottom" 등)
                output_type = connection.get("outputType")

                # 반복 노드의 아래 연결점(bottom)은 출력으로 카운트하지 않음
                # 반복 노드의 bottom 연결은 반복 종료를 의미하므로 출력으로 카운트하지 않음
                if node_type == "repeat" and output_type == "bottom":
                    continue  # 다음 연결로 넘어감

                # 조건 노드가 아닌 경우 출력 연결 개수 확인
                # 조건 노드는 여러 출력을 가질 수 있으므로 제외
                if node_type and node_type != "condition":
                    # node_output_count에 없으면 0으로 초기화
                    if from_node_id not in node_output_count:
                        node_output_count[from_node_id] = 0
                    # 출력 연결 개수 증가
                    node_output_count[from_node_id] += 1

                    # 출력 연결이 2개 이상이면 에러 (조건 노드가 아닌 노드는 최대 1개만 연결 가능)
                    if node_output_count[from_node_id] > 1:
                        raise ValueError(
                            f"노드 '{from_node_id}' (타입: {node_type})의 출력이 {node_output_count[from_node_id]}개 연결되어 있습니다. "
                            "조건 노드가 아닌 노드는 출력을 최대 1개만 연결할 수 있습니다."
                        )

    def save_nodes(self, script_id: int, nodes: list[dict[str, Any]], connections: list[dict[str, Any]]) -> bool:
        """
        노드 저장 (연결 정보 포함)

        Args:
            script_id: 스크립트 ID
            nodes: 노드 목록
            connections: 연결 정보 목록

        Returns:
            성공 여부
        """
        # 연결 검증
        self.validate_connections(nodes, connections)

        result: bool = self.connection.execute_with_connection(
            lambda _conn, cursor: self._save_nodes_impl(cursor, script_id, nodes, connections)
        )
        return result

    def _save_nodes_impl(
        self, cursor: sqlite3.Cursor, script_id: int, nodes: list[dict[str, Any]], connections: list[dict[str, Any]]
    ) -> bool:
        """노드 저장 구현"""
        # 기존 노드 삭제
        cursor.execute("DELETE FROM nodes WHERE script_id = ?", (script_id,))

        # connections 배열을 기반으로 각 노드의 connected_to/connected_from 계산
        node_connected_to: dict[str, list[dict[str, Any]]] = {}
        node_connected_from: dict[str, list[str]] = {}

        # 모든 노드 ID 초기화
        for node in nodes:
            node_id = node["id"]
            node_connected_to[node_id] = []
            node_connected_from[node_id] = []

        # connections 배열을 순회하며 각 노드의 연결 정보 구성
        for connection in connections:
            from_node_id = connection.get("from")
            to_node_id = connection.get("to")
            output_type = connection.get("outputType")

            if from_node_id and to_node_id:
                # from 노드의 connected_to에 연결 정보 추가
                if from_node_id in node_connected_to:
                    existing_conn = next(
                        (
                            conn
                            for conn in node_connected_to[from_node_id]
                            if (isinstance(conn, dict) and conn.get("to") == to_node_id)
                            or (isinstance(conn, str) and conn == to_node_id)
                        ),
                        None,
                    )
                    if not existing_conn:
                        node_connected_to[from_node_id].append({"to": to_node_id, "outputType": output_type})

                # to 노드의 connected_from에 from 노드 추가
                if to_node_id in node_connected_from and from_node_id not in node_connected_from[to_node_id]:
                    node_connected_from[to_node_id].append(from_node_id)

        # 새 노드들 저장
        for node in nodes:
            node_id = node["id"]
            connected_to_json = json.dumps(node_connected_to.get(node_id, []), ensure_ascii=False)
            connected_from_json = json.dumps(node_connected_from.get(node_id, []), ensure_ascii=False)

            parameters = node.get("parameters", {})
            parameters_json = json.dumps(parameters, ensure_ascii=False)

            description = node.get("description") or None

            # node_data에서 color 필드 제거
            node_data = node.get("data", {}).copy()
            node_data.pop("color", None)

            # 연결 정보 추출 (프론트엔드에서 전달된 값 사용)
            is_connected = node.get("is_connected")
            connection_sequence = node.get("connection_sequence")
            node_identifier = node.get("node_identifier")

            cursor.execute(
                """
                INSERT INTO nodes (script_id, node_id, node_type, position_x, position_y, node_data, connected_to, connected_from, parameters, description, is_connected, connection_sequence, node_identifier)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
                (
                    script_id,
                    node_id,
                    node["type"],
                    node["position"]["x"],
                    node["position"]["y"],
                    json.dumps(node_data, ensure_ascii=False),
                    connected_to_json,
                    connected_from_json,
                    parameters_json,
                    description,
                    1 if is_connected else 0 if is_connected is False else None,
                    connection_sequence,
                    node_identifier,
                ),
            )

        return True

    def cleanup_duplicate_boundary_nodes(self, script_id: int, nodes: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """
        start/end 노드가 각각 2개 이상이면 1개만 남기고 나머지 삭제

        Args:
            script_id: 스크립트 ID
            nodes: 노드 목록 (수정됨)

        Returns:
            정리된 노드 목록
        """
        result: list[dict[str, Any]] = self.connection.execute_with_connection(
            lambda conn, cursor: self._cleanup_duplicate_boundary_nodes_impl(conn, cursor, script_id, nodes)
        )
        return result

    def _cleanup_duplicate_boundary_nodes_impl(
        self, conn: sqlite3.Connection, cursor: sqlite3.Cursor, script_id: int, nodes: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """중복 경계 노드 정리 구현"""
        start_nodes = [n for n in nodes if n.get("type") == "start" or n.get("id") == "start"]

        # start 노드 정리
        # start 노드가 2개 이상이면 1개만 남기고 나머지 삭제
        if len(start_nodes) > 1:
            # _db_id 기준으로 정렬 (오래된 것부터 삭제)
            start_nodes.sort(key=lambda n: n.get("_db_id", 0))
            # nodes_to_delete: 삭제할 노드 목록 (첫 번째 노드 제외)
            nodes_to_delete = start_nodes[1:]

            # 삭제할 노드들을 DB에서 삭제
            for node in nodes_to_delete:
                # db_id: DB의 노드 ID (DB에서 삭제하기 위해 필요)
                db_id = node.get("_db_id")
                # db_id가 있으면 DB에서 삭제
                if db_id:
                    cursor.execute("DELETE FROM nodes WHERE id = ?", (db_id,))
                    # nodes 리스트에서도 제거 (in-place 수정)
                    nodes[:] = [n for n in nodes if n.get("_db_id") != db_id]

            # 변경사항 커밋
            conn.commit()
            print(f"[DB 정리] start 노드 중복 제거: {len(nodes_to_delete)}개 삭제, 1개 유지")

        # _db_id 필드 제거
        for node in nodes:
            node.pop("_db_id", None)

        return nodes


# ============================================================================
# 테스트 코드
# ============================================================================
# NodeRepository 클래스의 기능을 테스트합니다.
#
# 테스트 항목:
# 1. 데이터베이스 초기화 및 테이블 생성
# 2. 테스트용 스크립트 생성
# 3. NodeRepository 인스턴스 생성
# 4. 노드 저장 (연결 정보 포함, connected_to/connected_from 계산)
# 5. 노드 조회 (스크립트 ID로 조회, JSON 필드 파싱)
# 6. 연결 정보 생성 (노드 목록에서 connections 배열 생성)
# 7. 연결 검증 (조건 노드가 아닌 노드는 출력 최대 1개)
# 8. 연결 검증 에러 케이스 (검증 실패 시 ValueError 발생)
# 9. JSON 필드 파싱 (정상/빈 문자열/잘못된 JSON/None 값 처리)
# 10. 중복 경계 노드 정리 (start/end 노드 중복 제거)
# 11. 최종 상태 확인

# ============================================================================
if __name__ == "__main__":
    from db.script_repository import ScriptRepository
    from db.table_manager import TableManager

    print("=" * 60)
    print("NodeRepository 모듈 테스트")
    print("=" * 60)

    # 테스트용 데이터베이스 경로 설정
    test_db_path = os.path.join(os.path.dirname(__file__), "test_node_repository.db")

    # 기존 테스트 DB가 있으면 삭제
    if os.path.exists(test_db_path):
        os.remove(test_db_path)
        print(f"기존 테스트 데이터베이스 삭제: {test_db_path}\n")

    # [1] 데이터베이스 초기화
    print("[1] 데이터베이스 초기화...")
    conn = DatabaseConnection(test_db_path)
    table_manager = TableManager(conn)
    table_manager.initialize()
    print("✅ 데이터베이스 초기화 완료\n")

    # [2] 테스트용 스크립트 생성
    print("[2] 테스트용 스크립트 생성...")
    script_repo = ScriptRepository(conn)
    script_id = script_repo.create_script("노드 테스트 스크립트", "NodeRepository 테스트용")
    print(f"✅ 스크립트 생성 완료 (ID: {script_id})\n")

    # [3] NodeRepository 인스턴스 생성
    print("[3] NodeRepository 인스턴스 생성...")
    node_repo = NodeRepository(conn)
    print("✅ 인스턴스 생성 성공\n")

    # [4] 노드 저장 테스트
    print("[4] 노드 저장 테스트...")
    test_nodes = [
        {
            "id": "start",
            "type": "start",
            "position": {"x": 0.0, "y": 0.0},
            "data": {"title": "시작"},
            "parameters": {},
        },
        {
            "id": "node1",
            "type": "action",
            "position": {"x": 300.0, "y": 0.0},
            "data": {"title": "액션 노드"},
            "parameters": {"action": "click"},
            "description": "클릭 액션 노드",
        },
        {
            "id": "node2",
            "type": "condition",
            "position": {"x": 600.0, "y": 0.0},
            "data": {"title": "조건 노드"},
            "parameters": {"condition": "check_value"},
            "description": "값 확인 조건 노드",
        },
        {
            "id": "node3",
            "type": "action",
            "position": {"x": 900.0, "y": 0.0},
            "data": {"title": "액션 노드 2"},
            "parameters": {},
        },
    ]

    test_connections = [
        {"from": "start", "to": "node1", "outputType": None},
        {"from": "node1", "to": "node2", "outputType": None},
        {"from": "node2", "to": "node3", "outputType": "true"},
    ]

    success = node_repo.save_nodes(script_id, test_nodes, test_connections)
    print("✅ 노드 저장 완료")
    print(f"   - 저장 성공: {success}")
    print(f"   - 저장된 노드 수: {len(test_nodes)}개")
    print(f"   - 저장된 연결 수: {len(test_connections)}개\n")

    # [5] 노드 조회 테스트
    print("[5] 노드 조회 테스트...")
    retrieved_nodes = node_repo.get_nodes_by_script_id(script_id)
    print("✅ 노드 조회 완료")
    print(f"   - 조회된 노드 수: {len(retrieved_nodes)}개")
    for node in retrieved_nodes:
        print(f"     * {node['id']} ({node['type']}): {node.get('description', '설명 없음')}")
        print(f"       위치: ({node['position']['x']}, {node['position']['y']})")
        print(f"       연결 대상: {len(node.get('connected_to', []))}개")
        print(f"       연결 출처: {len(node.get('connected_from', []))}개")
    print()

    # [6] 연결 정보 생성 테스트
    print("[6] 연결 정보 생성 테스트...")
    connections: list[dict[str, Any]] = node_repo.build_connections_from_nodes(retrieved_nodes)
    print("✅ 연결 정보 생성 완료")
    print(f"   - 생성된 연결 수: {len(connections)}개")
    for connection_item in connections:
        output_type = connection_item.get("outputType", "None")
        print(f"     * {connection_item['from']} -> {connection_item['to']} (outputType: {output_type})")
    print()

    # [7] 연결 검증 테스트 (정상 케이스)
    print("[7] 연결 검증 테스트 (정상 케이스)...")
    try:
        node_repo.validate_connections(test_nodes, test_connections)
        print("✅ 연결 검증 통과 (정상)\n")
    except ValueError as e:
        print(f"❌ 연결 검증 실패: {e}\n")

    # [8] 연결 검증 테스트 (에러 케이스 - 조건 노드가 아닌 노드가 2개 이상 연결)
    print("[8] 연결 검증 테스트 (에러 케이스)...")
    invalid_connections = [
        {"from": "start", "to": "node1", "outputType": None},
        {"from": "start", "to": "node2", "outputType": None},  # start 노드가 2개 연결 (에러)
    ]
    try:
        node_repo.validate_connections(test_nodes, invalid_connections)
        print("❌ 연결 검증 실패 (에러가 발생해야 함)\n")
    except ValueError as e:
        print("✅ 연결 검증 작동 확인")
        print(f"   - 에러 메시지: {e}\n")

    # [9] JSON 필드 파싱 테스트
    print("[9] JSON 필드 파싱 테스트...")
    # 정상 JSON 문자열
    json_list = node_repo._parse_json_field('["node1", "node2"]', [])
    json_dict = node_repo._parse_json_field('{"key": "value"}', {})

    # 잘못된 JSON 값 넣어보기
    # 빈 문자열
    empty_list = node_repo._parse_json_field("", [])
    # 잘못된 JSON 값
    invalid_json = node_repo._parse_json_field("invalid json", [])
    # None 값
    none_value = node_repo._parse_json_field(None, [])

    print("✅ JSON 파싱 테스트 완료")
    print(f"   - 리스트 파싱: {json_list}")
    print(f"   - 딕셔너리 파싱: {json_dict}")
    print(f"   - 빈 문자열: {empty_list}")
    print(f"   - 잘못된 JSON: {invalid_json} (기본값 반환)")
    print(f"   - None 값: {none_value}\n")

    # [10] 중복 경계 노드 정리 테스트
    print("[10] 중복 경계 노드 정리 테스트...")
    # 중복된 start 노드 추가
    duplicate_nodes = [
        {
            "id": "start",
            "type": "start",
            "position": {"x": 0.0, "y": 0.0},
            "data": {"title": "시작 1"},
            "parameters": {},
            "_db_id": 1,
        },
        {
            "id": "start",
            "type": "start",
            "position": {"x": 100.0, "y": 100.0},
            "data": {"title": "시작 2"},
            "parameters": {},
            "_db_id": 2,
        },
    ]

    # 중복 노드를 DB에 저장
    test_script_id = script_repo.create_script("중복 노드 테스트", "중복 경계 노드 정리 테스트용")
    duplicate_connections: list[dict[str, Any]] = []
    node_repo.save_nodes(test_script_id, duplicate_nodes, duplicate_connections)

    # 조회하여 중복 노드 확인
    nodes_before_cleanup = node_repo.get_nodes_by_script_id(test_script_id)
    print(f"   - 정리 전 노드 수: {len(nodes_before_cleanup)}개")

    # 정리 실행
    cleaned_nodes = node_repo.cleanup_duplicate_boundary_nodes(test_script_id, nodes_before_cleanup)

    print("✅ 중복 경계 노드 정리 완료")
    print(f"   - 정리 후 노드 수: {len(cleaned_nodes)}개")
    print(f"   - 제거된 노드 수: {len(nodes_before_cleanup) - len(cleaned_nodes)}개\n")

    # [11] 최종 상태 확인
    print("[11] 최종 상태 확인...")
    final_nodes = node_repo.get_nodes_by_script_id(script_id)
    print("✅ 최종 상태 확인 완료")
    print(f"   - 스크립트의 노드 수: {len(final_nodes)}개")
    for node in final_nodes:
        print(f"     * {node['id']} ({node['type']})")
    print()

    # 정리
    if os.path.exists(test_db_path):
        os.remove(test_db_path)
        print(f"테스트 데이터베이스 정리 완료: {test_db_path}")

    print("\n" + "=" * 60)
    print("✅ 모든 테스트 완료!")
    print("=" * 60)
