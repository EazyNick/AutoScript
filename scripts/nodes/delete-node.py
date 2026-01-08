#!/usr/bin/env python3
"""
노드 삭제 스크립트
생성된 노드를 안전하게 삭제하는 도구입니다.

사용법:
    python scripts/nodes/delete-node.py --name my-node
    python scripts/nodes/delete-node.py --name my-node --force  # 확인 없이 삭제
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Any

# 프로젝트 루트 디렉토리 (nodes -> scripts -> project_root)
PROJECT_ROOT = Path(__file__).parent.parent.parent
SERVER_DIR = PROJECT_ROOT / "server"
UI_DIR = PROJECT_ROOT / "UI"
CONFIG_FILE = SERVER_DIR / "config" / "nodes_config.py"

# 카테고리별 디렉토리 매핑
CATEGORY_MAP = {
    "action": "actionnodes",
    "logic": "conditionnodes",
    "wait": "waitnodes",
    "image": "imagenodes",
    "boundary": "boundarynodes",
}


def to_snake_case(name: str) -> str:
    """케밥 케이스를 스네이크 케이스로 변환"""
    return name.replace("-", "_")


def find_node_category(node_type: str) -> tuple[str | None, Path | None]:
    """
    노드 타입으로 카테고리와 파일 경로 찾기
    
    Returns:
        (category_dir, python_file_path) 튜플
    """
    nodes_dir = SERVER_DIR / "nodes"
    
    # 모든 서브모듈 디렉토리에서 찾기
    for submodule_dir in nodes_dir.iterdir():
        if not submodule_dir.is_dir() or submodule_dir.name.startswith("__"):
            continue
        
        python_filename = to_snake_case(node_type) + ".py"
        python_path = submodule_dir / python_filename
        
        if python_path.exists():
            return submodule_dir.name, python_path
    
    return None, None


def get_node_config_category(node_type: str) -> str | None:
    """nodes_config.py에서 노드의 카테고리 가져오기"""
    try:
        sys.path.insert(0, str(SERVER_DIR))
        from config.nodes_config import NODES_CONFIG
        
        if node_type in NODES_CONFIG:
            return NODES_CONFIG[node_type].get("category")
    except Exception:
        pass
    
    return None


def delete_from_config(node_type: str) -> bool:
    """
    nodes_config.py에서 노드 설정 제거
    주의: 파일을 직접 수정하므로 백업을 권장합니다.
    
    Returns:
        성공 여부
    """
    if not CONFIG_FILE.exists():
        print(f"⚠️  설정 파일이 없습니다: {CONFIG_FILE}")
        return False
    
    try:
        # 파일 읽기
        content = CONFIG_FILE.read_text(encoding="utf-8")
        
        # 노드 설정 찾기 (딕셔너리 키 매칭)
        lines = content.split("\n")
        new_lines = []
        in_node_config = False
        brace_count = 0
        node_start_line = None
        
        for i, line in enumerate(lines):
            stripped = line.strip()
            
            # 노드 설정 시작 찾기: "node_type": { 또는 'node_type': {
            if (stripped.startswith(f'"{node_type}":') or stripped.startswith(f"'{node_type}':")) and "{" in line:
                in_node_config = True
                node_start_line = i
                brace_count = line.count("{") - line.count("}")
                # 이 줄은 건너뛰기 (삭제)
                continue
            
            if in_node_config:
                brace_count += line.count("{") - line.count("}")
                
                # 닫는 중괄호를 만나면 설정 끝
                if brace_count <= 0:
                    # 이전 줄의 쉼표 제거
                    if new_lines and new_lines[-1].rstrip().endswith(","):
                        new_lines[-1] = new_lines[-1].rstrip()[:-1]
                    in_node_config = False
                    node_start_line = None
                    # 이 줄도 건너뛰기 (닫는 중괄호)
                    continue
                
                # 노드 설정 내부는 건너뛰기
                continue
            
            new_lines.append(line)
        
        # 변경사항이 없으면 노드를 찾지 못한 것
        if len(new_lines) == len(lines):
            print(f"⚠️  nodes_config.py에서 '{node_type}' 설정을 찾을 수 없습니다.")
            return False
        
        # 파일 쓰기
        new_content = "\n".join(new_lines)
        CONFIG_FILE.write_text(new_content, encoding="utf-8")
        return True
        
    except Exception as e:
        print(f"❌ 설정 파일 수정 실패: {e}")
        print(f"   수동으로 nodes_config.py에서 '{node_type}' 설정을 제거해주세요.")
        return False


def is_category_empty(category_dir: Path) -> bool:
    """카테고리 디렉토리가 비어있는지 확인 (__init__.py 제외)"""
    if not category_dir.exists():
        return True
    
    py_files = [f for f in category_dir.glob("*.py") if f.name != "__init__.py"]
    return len(py_files) == 0


def main() -> None:
    parser = argparse.ArgumentParser(description="노드를 삭제합니다.")
    parser.add_argument("--name", required=True, help="삭제할 노드 타입 (예: my-node)")
    parser.add_argument(
        "--force",
        action="store_true",
        help="확인 없이 삭제 (주의: 되돌릴 수 없습니다)",
    )
    parser.add_argument(
        "--keep-config",
        action="store_true",
        help="nodes_config.py에서 설정을 제거하지 않음",
    )

    args = parser.parse_args()

    node_type = args.name

    print(f"🔍 노드 '{node_type}' 검색 중...\n")

    # 노드 파일 찾기
    category_dir_name, python_path = find_node_category(node_type)
    
    if not python_path or not python_path.exists():
        print(f"❌ 노드 파일을 찾을 수 없습니다: {node_type}")
        print(f"   예상 경로: server/nodes/*/{to_snake_case(node_type)}.py")
        return

    # JavaScript 파일 경로
    js_filename = f"node-{node_type}.js"
    js_path = UI_DIR / "src" / "js" / "components" / "node" / js_filename

    # 카테고리 디렉토리 경로
    category_path = python_path.parent

    # 삭제할 파일 목록 표시
    print("삭제할 파일:")
    print(f"  - Python: {python_path}")
    if js_path.exists():
        print(f"  - JavaScript: {js_path}")
    else:
        print(f"  - JavaScript: {js_path} (파일 없음)")
    
    if not args.keep_config:
        print(f"  - 설정: nodes_config.py에서 '{node_type}' 제거")
    
    if category_dir_name and category_dir_name not in CATEGORY_MAP.values():
        # 새로 만든 카테고리인 경우
        if is_category_empty(category_path):
            print(f"  - 카테고리 디렉토리: {category_path} (비어있음)")
            print(f"  - __init__.py: {category_path / '__init__.py'}")

    # 확인
    if not args.force:
        print("\n⚠️  위 파일들이 삭제됩니다. 계속하시겠습니까? (y/N): ", end="")
        response = input().strip().lower()
        if response not in ["y", "yes"]:
            print("❌ 삭제가 취소되었습니다.")
            return

    # 삭제 실행
    deleted_files = []
    errors = []

    # Python 파일 삭제
    try:
        python_path.unlink()
        deleted_files.append(f"Python: {python_path}")
        print(f"✅ Python 파일 삭제: {python_path}")
    except Exception as e:
        errors.append(f"Python 파일 삭제 실패: {e}")

    # JavaScript 파일 삭제
    if js_path.exists():
        try:
            js_path.unlink()
            deleted_files.append(f"JavaScript: {js_path}")
            print(f"✅ JavaScript 파일 삭제: {js_path}")
        except Exception as e:
            errors.append(f"JavaScript 파일 삭제 실패: {e}")

    # nodes_config.py에서 설정 제거
    if not args.keep_config:
        if delete_from_config(node_type):
            print(f"✅ nodes_config.py에서 '{node_type}' 설정 제거 완료")
        else:
            errors.append("nodes_config.py 설정 제거 실패 (수동으로 제거해주세요)")

    # 카테고리 디렉토리 삭제 (새로 만든 카테고리이고 비어있는 경우)
    if category_dir_name and category_dir_name not in CATEGORY_MAP.values():
        if is_category_empty(category_path):
            try:
                init_file = category_path / "__init__.py"
                if init_file.exists():
                    init_file.unlink()
                    print(f"✅ __init__.py 삭제: {init_file}")
                
                category_path.rmdir()
                print(f"✅ 카테고리 디렉토리 삭제: {category_path}")
            except Exception as e:
                errors.append(f"카테고리 디렉토리 삭제 실패: {e}")

    # 결과 출력
    print("\n" + "=" * 60)
    if errors:
        print("\n⚠️  일부 작업 실패:")
        for error in errors:
            print(f"  - {error}")
    else:
        print("\n✅ 노드 삭제 완료!")
    
    print("\n다음 단계:")
    print("  1. 서버를 재시작하면 변경사항이 반영됩니다.")
    if not args.keep_config:
        print("  2. nodes_config.py 파일을 확인하여 설정이 올바르게 제거되었는지 확인하세요.")


if __name__ == "__main__":
    main()
