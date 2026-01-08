"""
Node installation script
Installs nodes from .asnode.zip files in shared-nodes/ folder.
"""

import argparse
import json
import shutil
import sys
import zipfile
from pathlib import Path

# Project root path (package -> scripts -> project_root)
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root / "server"))

from config.nodes_config import NODES_CONFIG

# 카테고리별 디렉토리 매핑 (create-node.py와 동일)
CATEGORY_MAP = {
    "action": "actionnodes",
    "logic": "conditionnodes",
    "condition": "conditionnodes",
    "wait": "waitnodes",
    "image": "imagenodes",
    "boundary": "boundarynodes",
}


def to_snake_case(name: str) -> str:
    """Convert kebab-case to snake_case"""
    return name.replace("-", "_")


def validate_node_data(manifest: dict, node_config: dict) -> tuple[bool, str]:
    """
    Validate node package data
    
    Returns:
        (success, error_message)
    """
    # Check required fields in manifest
    required_manifest_fields = ["version", "format", "node_type", "node_category", "node_kind"]
    for field in required_manifest_fields:
        if field not in manifest:
            return False, f"Required field '{field}' missing in manifest.json"
    
    # Check format
    if manifest.get("format") != "autoscript-node":
        return False, "Invalid format. Must be 'autoscript-node'"
    
    # Check required fields in node_config
    required_config_fields = ["label", "category"]
    for field in required_config_fields:
        if field not in node_config:
            return False, f"Required field '{field}' missing in node_config.json"
    
    return True, ""


def install_node_from_zip(zip_path: Path, skip_duplicate: bool = True) -> dict:
    """
    Install node from ZIP file
    
    Args:
        zip_path: ZIP file path
        skip_duplicate: Skip if node already exists
        
    Returns:
        Installation result dictionary
    """
    server_dir = project_root / "server"
    ui_dir = project_root / "UI"
    
    # Validate ZIP file
    if not zip_path.exists():
        raise FileNotFoundError(f"ZIP file not found: {zip_path}")
    
    if not zip_path.suffix == ".zip":
        raise ValueError(f"Not a ZIP file: {zip_path}")
    
    # Extract ZIP file
    temp_dir = project_root / "temp-node-install"
    temp_dir.mkdir(exist_ok=True)
    
    try:
        with zipfile.ZipFile(zip_path, "r") as zipf:
            # Check required files
            file_list = zipf.namelist()
            if "manifest.json" not in file_list:
                raise ValueError("ZIP file missing 'manifest.json'")
            if "node_config.json" not in file_list:
                raise ValueError("ZIP file missing 'node_config.json'")
            
            # Extract
            zipf.extractall(temp_dir)
        
        # Read manifest.json
        manifest_path = temp_dir / "manifest.json"
        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)
        
        # Read node_config.json
        config_path = temp_dir / "node_config.json"
        with open(config_path, "r", encoding="utf-8") as f:
            node_config = json.load(f)
        
        # Validate data
        is_valid, error_msg = validate_node_data(manifest, node_config)
        if not is_valid:
            raise ValueError(f"Node data validation failed: {error_msg}")
        
        node_type = manifest["node_type"]
        node_category = manifest["node_category"]
        node_kind = manifest["node_kind"]
        
        # Check if node already exists
        if node_type in NODES_CONFIG:
            if skip_duplicate:
                return {
                    "success": False,
                    "message": f"Node '{node_type}' already exists. Skipping.",
                    "node_type": node_type,
                    "skipped": True
                }
            else:
                # --no-skip-duplicate 옵션이 있으면 덮어쓰기 진행
                print(f"  [INFO] Node '{node_type}' already exists. Overwriting...")
        
        # Copy server file (if Python node) - create-node.py와 동일한 위치에 설치
        if node_kind == "python" and "server" in manifest.get("files", {}):
            server_files = manifest["files"]["server"]
            if server_files:
                # Map category to directory (create-node.py와 동일한 방식)
                if node_category in CATEGORY_MAP:
                    category_dir = CATEGORY_MAP[node_category]
                else:
                    # 새로운 카테고리인 경우 (create-node.py와 동일한 로직)
                    category_dir = node_category.lower().replace("-", "_").replace(" ", "_") + "nodes"
                
                # Install to category directory (create-node.py와 동일)
                nodes_dir = server_dir / "nodes" / category_dir
                nodes_dir.mkdir(parents=True, exist_ok=True)
                
                # Copy server file (create-node.py와 동일한 파일명 규칙 사용)
                server_file = temp_dir / server_files[0]
                if server_file.exists():
                    # create-node.py와 동일한 파일명 규칙: {node_type}.py (스네이크 케이스)
                    target_filename = to_snake_case(node_type) + ".py"
                    target_file = nodes_dir / target_filename
                    shutil.copy2(server_file, target_file)
                    print(f"  [OK] Copied server file: {target_file}")
                    
                    # 카테고리 디렉토리에 __init__.py가 없으면 생성 (create-node.py와 동일)
                    init_file = nodes_dir / "__init__.py"
                    if not init_file.exists():
                        init_content = f'''"""
{node_category} 노드 모듈
{node_config.get("description", "")} 노드들을 관리합니다.

이 모듈은 자동으로 모든 노드 클래스를 감지하여 로드합니다.
새로운 노드를 추가할 때는 노드 파일만 생성하면 됩니다.
"""

import importlib
import inspect
from pathlib import Path

from nodes.base_node import BaseNode

# 자동으로 모든 노드 클래스를 감지하여 import
_imported_nodes = {{}}
_current_package = __package__ or "server.nodes.{category_dir}"
_current_dir = Path(__file__).parent

# 현재 디렉토리의 모든 .py 파일을 스캔
for file_path in _current_dir.glob("*.py"):
    # __init__.py는 제외
    if file_path.name == "__init__.py":
        continue

    module_name = file_path.stem
    try:
        # 모듈 import
        module = importlib.import_module(f".{{module_name}}", _current_package)

        # 모듈에서 BaseNode를 상속받은 모든 클래스 찾기
        for name, obj in inspect.getmembers(module, inspect.isclass):
            if (
                issubclass(obj, BaseNode)
                and obj is not BaseNode
                and obj.__module__ == module.__name__
            ):
                _imported_nodes[name] = obj
                # 전역 네임스페이스에 추가
                globals()[name] = obj
    except Exception as e:
        # 특정 모듈 import 실패 시 경고만 출력하고 계속 진행
        import warnings

        warnings.warn(f"노드 모듈 '{{module_name}}' 로드 실패: {{e}}", ImportWarning)

# __all__에 자동으로 발견된 모든 노드들을 포함
__all__ = sorted(_imported_nodes.keys())
'''
                        init_file.write_text(init_content, encoding="utf-8")
                        print(f"  [OK] Created __init__.py: {init_file}")
        
        # Copy client files (JavaScript)
        if "client" in manifest.get("files", {}):
            client_files = manifest["files"]["client"]
            client_dir = ui_dir / "src" / "js" / "components" / "node"
            client_dir.mkdir(parents=True, exist_ok=True)
            
            for client_file_path in client_files:
                source_file = temp_dir / client_file_path
                if source_file.exists():
                    target_file = client_dir / source_file.name
                    shutil.copy2(source_file, target_file)
                    print(f"  [OK] Copied client file: {target_file}")
        
        # Add to nodes_config.py (create-node.py와 동일한 방식)
        config_file = server_dir / "config" / "nodes_config.py"
        
        if config_file.exists():
            # Read current config
            content = config_file.read_text(encoding="utf-8")
            
            # Check if node already in config
            if f'"{node_type}":' in content or f"'{node_type}':" in content:
                print(f"  [WARN] Node '{node_type}' already in nodes_config.py (skipping)")
            else:
                # Find NODES_CONFIG closing brace (create-node.py와 동일한 로직)
                lines = content.split("\n")
                dict_close_line = None
                brace_count = 0
                in_nodes_config = False
                
                for i, line in enumerate(lines):
                    stripped = line.strip()
                    if stripped.startswith("NODES_CONFIG:") and "{" in line:
                        in_nodes_config = True
                        brace_count = line.count("{") - line.count("}")
                    elif in_nodes_config:
                        brace_count += line.count("{") - line.count("}")
                        if brace_count <= 0 and "}" in line:
                            dict_close_line = i
                            break
                
                if dict_close_line is not None:
                    # Format node config as Python dict (create-node.py와 동일한 방식)
                    # Ensure script field is included
                    node_config_with_script = node_config.copy()
                    if "script" not in node_config_with_script:
                        node_config_with_script["script"] = f"node-{node_type}.js"
                    
                    config_str = json.dumps({node_type: node_config_with_script}, indent=4, ensure_ascii=False)
                    config_str = config_str.replace(": true", ": True").replace(": false", ": False")
                    
                    # Add indentation (create-node.py와 동일)
                    config_lines = [f'    "{node_type}": {{']
                    for line in config_str.split("\n")[1:-1]:
                        config_lines.append("    " + line)
                    config_lines.append("    },")
                    
                    # 마지막 항목 뒤에 쉼표가 있는지 확인 (create-node.py와 동일)
                    insert_line = dict_close_line
                    for i in range(dict_close_line - 1, -1, -1):
                        stripped = lines[i].strip()
                        if stripped and not stripped.startswith("#"):
                            if stripped.endswith("},"):
                                break
                            elif stripped.endswith("}"):
                                lines[i] = lines[i].rstrip() + ","
                                break
                            elif not stripped.endswith(","):
                                lines[i] = lines[i].rstrip() + ","
                                break
                            break
                    
                    # Insert before closing brace
                    lines[insert_line:insert_line] = config_lines
                    new_content = "\n".join(lines)
                    config_file.write_text(new_content, encoding="utf-8")
                    print(f"  [OK] Added to nodes_config.py")
                else:
                    print(f"  [WARN] Could not find NODES_CONFIG closing brace. Please add manually:")
                    print(f"     {json.dumps({node_type: node_config}, indent=4, ensure_ascii=False)}")
        else:
            print(f"  [WARN] nodes_config.py not found: {config_file}")
            print(f"     Please add manually:")
            print(f"     {json.dumps({node_type: node_config}, indent=4, ensure_ascii=False)}")
        
        return {
            "success": True,
            "message": f"Node '{node_type}' installed successfully.",
            "node_type": node_type,
            "node_category": node_category,
            "node_kind": node_kind
        }
        
    finally:
        # Clean up temp directory
        if temp_dir.exists():
            shutil.rmtree(temp_dir)


def main():
    """Main function"""
    parser = argparse.ArgumentParser(description="Install nodes from ZIP files")
    parser.add_argument("zip_file", type=str, nargs="?", help="ZIP file path (or scan shared-nodes/ folder)")
    parser.add_argument("-f", "--folder", type=str, help="Folder to scan for ZIP files (default: shared-nodes/)")
    parser.add_argument("--no-skip-duplicate", action="store_true", help="Overwrite existing nodes")
    
    args = parser.parse_args()
    
    skip_duplicate = not args.no_skip_duplicate
    
    # Determine folder to scan
    if args.folder:
        scan_folder = Path(args.folder)
    else:
        scan_folder = project_root / "shared-nodes"
    
    results = {
        "success": [],
        "skipped": [],
        "failed": []
    }
    
    # If specific ZIP file provided
    if args.zip_file:
        zip_path = Path(args.zip_file)
        if not zip_path.is_absolute():
            zip_path = project_root / zip_path
        
        try:
            print(f"\n[Processing] {zip_path.name}")
            result = install_node_from_zip(zip_path, skip_duplicate)
            
            if result.get("success"):
                results["success"].append(result)
                print(f"  [OK] {result['message']}")
            elif result.get("skipped"):
                results["skipped"].append(result)
                print(f"  [SKIP] {result['message']}")
        except Exception as e:
            results["failed"].append({"file": zip_path.name, "error": str(e)})
            print(f"  [ERROR] Error: {e}")
    else:
        # Scan folder for ZIP files
        if not scan_folder.exists():
            scan_folder.mkdir(parents=True, exist_ok=True)
            print(f"[INFO] Created folder: {scan_folder}")
            print(f"[INFO] Place .asnode.zip files in this folder and run again.")
            return
        
        zip_files = list(scan_folder.glob("*.asnode.zip"))
        
        if not zip_files:
            print(f"[INFO] No .asnode.zip files found in {scan_folder}")
            print(f"[INFO] Place .asnode.zip files in this folder and run again.")
            return
        
        print(f"[Installation] Found {len(zip_files)} ZIP file(s)")
        print()
        
        for zip_path in zip_files:
            try:
                print(f"[Processing] {zip_path.name}")
                result = install_node_from_zip(zip_path, skip_duplicate)
                
                if result.get("success"):
                    results["success"].append(result)
                    print(f"  [OK] {result['message']}")
                elif result.get("skipped"):
                    results["skipped"].append(result)
                    print(f"  [SKIP] {result['message']}")
                print()
            except Exception as e:
                results["failed"].append({"file": zip_path.name, "error": str(e)})
                print(f"  [ERROR] Error: {e}")
                print()
    
    # Summary
    print("=" * 60)
    print("[Installation Summary]")
    print(f"  [OK] Success: {len(results['success'])}")
    print(f"  [SKIP] Skipped: {len(results['skipped'])}")
    print(f"  [ERROR] Failed: {len(results['failed'])}")
    print("=" * 60)
    
    if results["failed"]:
        print("\nFailed installations:")
        for failed in results["failed"]:
            print(f"  - {failed['file']}: {failed['error']}")
        sys.exit(1)


if __name__ == "__main__":
    main()
