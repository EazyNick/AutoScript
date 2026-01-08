#!/usr/bin/env python3
"""
노드 검증 스크립트
노드 설정과 구현이 일치하는지 검증합니다.

사용법:
    python scripts/nodes/validate-nodes.py
"""

import ast
import importlib
import inspect
from pathlib import Path
from typing import Any

# 프로젝트 루트 디렉토리 (nodes -> scripts -> project_root)
PROJECT_ROOT = Path(__file__).parent.parent.parent
SERVER_DIR = PROJECT_ROOT / "server"
UI_DIR = PROJECT_ROOT / "UI"


def get_node_executor_action_name(file_path: Path) -> str | None:
    """Python 파일에서 @NodeExecutor 데코레이터의 action_name 추출"""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        tree = ast.parse(content, filename=str(file_path))

        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                # @NodeExecutor("action-name") 형태 찾기
                if isinstance(node.func, ast.Name) and node.func.id == "NodeExecutor":
                    if node.args and isinstance(node.args[0], ast.Constant):
                        return node.args[0].value
                # @NodeExecutor(action_name="action-name") 형태 찾기
                elif isinstance(node.func, ast.Name) and node.func.id == "NodeExecutor":
                    for keyword in node.keywords:
                        if keyword.arg == "action_name" and isinstance(keyword.value, ast.Constant):
                            return keyword.value.value

    except Exception as e:
        print(f"  ⚠️  파일 파싱 실패: {e}")
        return None

    return None


def find_all_node_files() -> dict[str, dict[str, Any]]:
    """모든 노드 파일 찾기"""
    nodes = {}
    nodes_dir = SERVER_DIR / "nodes"

    # 각 서브모듈 디렉토리 스캔
    for submodule_dir in nodes_dir.iterdir():
        if not submodule_dir.is_dir() or submodule_dir.name.startswith("__"):
            continue

        for py_file in submodule_dir.glob("*.py"):
            if py_file.name == "__init__.py":
                continue

            action_name = get_node_executor_action_name(py_file)
            if action_name:
                nodes[action_name] = {
                    "file": py_file,
                    "submodule": submodule_dir.name,
                }

    return nodes


def get_config_nodes() -> dict[str, Any]:
    """nodes_config.py에서 노드 설정 가져오기"""
    try:
        import sys

        sys.path.insert(0, str(SERVER_DIR))
        from config.nodes_config import NODES_CONFIG

        return NODES_CONFIG
    except Exception as e:
        print(f"❌ nodes_config.py 로드 실패: {e}")
        return {}


def check_js_file_exists(script_name: str) -> bool:
    """JavaScript 파일 존재 확인"""
    js_file = UI_DIR / "src" / "js" / "components" / "node" / script_name
    return js_file.exists()


def validate_nodes() -> bool:
    """노드 검증"""
    print("🔍 노드 검증 시작...\n")

    # 노드 파일 찾기
    node_files = find_all_node_files()
    config_nodes = get_config_nodes()

    errors = []
    warnings = []

    # 1. nodes_config.py에 정의된 노드가 실제로 구현되어 있는지 확인
    print("1️⃣  nodes_config.py와 구현 일치 확인...")
    for node_type, config in config_nodes.items():
        is_boundary = config.get("is_boundary", False)
        if node_type not in node_files:
            # 경계 노드는 Python 구현이 없을 수 있음 (예: start 노드)
            if is_boundary:
                print(f"  ⚠️  '{node_type}': 경계 노드 (Python 구현 불필요)")
            else:
                errors.append(f"❌ '{node_type}': nodes_config.py에 정의되어 있지만 구현 파일이 없습니다.")
        else:
            print(f"  ✅ '{node_type}': 구현 파일 존재")

    # 2. 구현된 노드가 nodes_config.py에 정의되어 있는지 확인
    print("\n2️⃣  구현 파일과 nodes_config.py 일치 확인...")
    for action_name, node_info in node_files.items():
        if action_name not in config_nodes:
            warnings.append(
                f"⚠️  '{action_name}': 구현 파일이 있지만 nodes_config.py에 정의되어 있지 않습니다. ({node_info['file']})"
            )
        else:
            print(f"  ✅ '{action_name}': nodes_config.py에 정의됨")

    # 3. JavaScript 파일 존재 확인
    print("\n3️⃣  JavaScript 파일 존재 확인...")
    for node_type, config in config_nodes.items():
        script_name = config.get("script")
        if script_name:
            if check_js_file_exists(script_name):
                print(f"  ✅ '{node_type}': JavaScript 파일 존재 ({script_name})")
            else:
                errors.append(f"❌ '{node_type}': JavaScript 파일이 없습니다. ({script_name})")
        else:
            warnings.append(f"⚠️  '{node_type}': script 필드가 없습니다.")

    # 4. @NodeExecutor의 action_name과 nodes_config.py의 노드 타입 일치 확인
    print("\n4️⃣  @NodeExecutor action_name과 노드 타입 일치 확인...")
    for node_type, config in config_nodes.items():
        if node_type in node_files:
            # 이미 위에서 확인했으므로 일치함
            print(f"  ✅ '{node_type}': action_name 일치")
        # else는 이미 위에서 에러로 처리됨

    # 결과 출력
    print("\n" + "=" * 60)
    if errors:
        print("\n❌ 검증 실패:")
        for error in errors:
            print(f"  {error}")
    else:
        print("\n✅ 모든 검증 통과!")

    if warnings:
        print("\n⚠️  경고:")
        for warning in warnings:
            print(f"  {warning}")

    return len(errors) == 0


if __name__ == "__main__":
    success = validate_nodes()
    exit(0 if success else 1)
