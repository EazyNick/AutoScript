"""
Node packaging script
Packages a custom node into a ZIP file for sharing.
"""

import argparse
import json
import shutil
import sys
import tempfile
import zipfile
from datetime import datetime
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


def find_node_files(node_type: str) -> tuple[Path | None, Path | None, str | None]:
    """
    Find Python and JavaScript files for a node
    
    Returns:
        (python_file_path, js_file_path, category_dir_name)
    """
    server_dir = project_root / "server"
    ui_dir = project_root / "UI"
    
    # Check nodes_config.py for node configuration
    if node_type not in NODES_CONFIG:
        return None, None, None
    
    node_config = NODES_CONFIG[node_type]
    category = node_config.get("category", "action")
    
    # Map category to directory (create-node.py와 동일한 방식)
    if category in CATEGORY_MAP:
        category_dir = CATEGORY_MAP[category]
    else:
        # 새로운 카테고리인 경우 (create-node.py와 동일한 로직)
        category_dir = category.lower().replace("-", "_").replace(" ", "_") + "nodes"
    
    # Find Python file (create-node.py와 동일한 파일명 규칙)
    nodes_dir = server_dir / "nodes" / category_dir
    python_filename = to_snake_case(node_type) + ".py"
    python_path = nodes_dir / python_filename
    
    if not python_path.exists():
        # Try alternative locations (다른 카테고리 디렉토리에서 찾기)
        for subdir in (server_dir / "nodes").iterdir():
            if subdir.is_dir() and not subdir.name.startswith("__"):
                alt_path = subdir / python_filename
                if alt_path.exists():
                    python_path = alt_path
                    category_dir = subdir.name
                    break
    
    # Find JavaScript file
    js_filename = f"node-{node_type}.js"
    js_path = ui_dir / "src" / "js" / "components" / "node" / js_filename
    
    python_file = python_path if python_path.exists() else None
    js_file = js_path if js_path.exists() else None
    
    return python_file, js_file, category_dir


def package_node(node_type: str, output_dir: str | None = None) -> str:
    """
    Package a node into a ZIP file
    
    Args:
        node_type: Node type (e.g., "my-node")
        output_dir: Output directory (default: exports/)
        
    Returns:
        Path to created ZIP file
    """
    # Check if node exists in config
    if node_type not in NODES_CONFIG:
        raise ValueError(f"Node type '{node_type}' not found in nodes_config.py")
    
    node_config = NODES_CONFIG[node_type]
    
    # Find node files
    python_file, js_file, category_dir = find_node_files(node_type)
    
    if not python_file and not js_file:
        raise ValueError(f"Node files not found for '{node_type}'")
    
    # Determine node kind
    node_kind = "python" if python_file else "javascript"
    
    # Set output directory
    if output_dir is None:
        output_dir = project_root / "exports"
    else:
        output_dir = Path(output_dir)
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Create temporary directory
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        
        # Create manifest.json
        manifest = {
            "version": "1.0.0",
            "format": "autoscript-node",
            "node_type": node_type,
            "node_category": node_config.get("category", "action"),
            "node_kind": node_kind,
            "files": {
                "server": [],
                "client": []
            },
            "metadata": {
                "name": node_config.get("label", node_type),
                "author": "AutoScript User",
                "version": "1.0.0",
                "created_at": datetime.now().isoformat() + "Z",
                "description": node_config.get("description", ""),
                "tags": []
            }
        }
        
        # Copy Python file (create-node.py와 동일한 파일명 사용)
        if python_file:
            server_dir = temp_path / "server"
            server_dir.mkdir()
            # 원본 파일명 유지 (node.py가 아니라 실제 파일명)
            python_filename = python_file.name
            shutil.copy2(python_file, server_dir / python_filename)
            manifest["files"]["server"].append(f"server/{python_filename}")
        
        # Copy JavaScript file
        if js_file:
            client_dir = temp_path / "client"
            client_dir.mkdir()
            shutil.copy2(js_file, client_dir / js_file.name)
            manifest["files"]["client"].append(f"client/{js_file.name}")
        
        # Create node_config.json
        node_config_data = {
            "label": node_config.get("label", node_type),
            "title": node_config.get("title", node_config.get("label", node_type)),
            "description": node_config.get("description", ""),
            "script": node_config.get("script", f"node-{node_type}.js"),  # JavaScript file name
            "category": node_config.get("category", "action"),
            "is_boundary": node_config.get("is_boundary", False),
        }
        
        if "parameters" in node_config:
            node_config_data["parameters"] = node_config["parameters"]
        if "input_schema" in node_config:
            node_config_data["input_schema"] = node_config["input_schema"]
        if "output_schema" in node_config:
            node_config_data["output_schema"] = node_config["output_schema"]
        
        # Write manifest.json
        manifest_path = temp_path / "manifest.json"
        with open(manifest_path, "w", encoding="utf-8") as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)
        
        # Write node_config.json
        config_path = temp_path / "node_config.json"
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(node_config_data, f, ensure_ascii=False, indent=2)
        
        # Create README.md
        readme_content = f"""# {node_config.get("label", node_type)}

{node_config.get("description", "No description")}

## Metadata
- Node Type: {node_type}
- Category: {node_config.get("category", "action")}
- Kind: {node_kind}
- Author: {manifest["metadata"]["author"]}
- Version: {manifest["metadata"]["version"]}
- Created: {manifest["metadata"]["created_at"]}

## Files
"""
        if python_file:
            readme_content += f"- Server: server/node.py\n"
        if js_file:
            readme_content += f"- Client: client/{js_file.name}\n"
        
        readme_path = temp_path / "README.md"
        readme_path.write_text(readme_content, encoding="utf-8")
        
        # Create ZIP file
        safe_name = "".join(c if c.isalnum() or c in ("_", "-") else "_" for c in node_type)
        zip_filename = f"{safe_name}.asnode.zip"
        zip_path = output_dir / zip_filename
        
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
            # Add all files in temp directory
            for file_path in temp_path.rglob("*"):
                if file_path.is_file():
                    arcname = file_path.relative_to(temp_path)
                    zipf.write(file_path, arcname)
        
        return str(zip_path)


def list_nodes():
    """List all custom nodes (non-standard nodes)"""
    standard_nodes = set(NODES_CONFIG.keys())
    
    # Get all nodes from config
    all_nodes = list(NODES_CONFIG.keys())
    
    # Filter custom nodes (for now, show all nodes)
    print(f"\n[Node List] Total: {len(all_nodes)} nodes")
    print("-" * 60)
    print(f"{'Type':<30} {'Label':<30}")
    print("-" * 60)
    
    for node_type in sorted(all_nodes):
        node_config = NODES_CONFIG[node_type]
        label = node_config.get("label", node_type)
        print(f"{node_type:<30} {label:<30}")
    
    print("-" * 60)
    print("\nUsage: package-node.bat NODE_TYPE [OUTPUT_DIR]")


def main():
    """Main function"""
    parser = argparse.ArgumentParser(description="Package node into ZIP file")
    parser.add_argument("node_type", type=str, nargs="?", help="Node type to package")
    parser.add_argument("-o", "--output", type=str, help="Output directory (default: exports/)")
    parser.add_argument("-l", "--list", action="store_true", help="List all nodes")
    
    args = parser.parse_args()
    
    # List nodes if --list flag is set or no node_type provided
    if args.list or args.node_type is None:
        list_nodes()
        if args.node_type is None:
            sys.exit(0)
    
    try:
        print(f"[Packaging] Node type: {args.node_type}")
        zip_path = package_node(args.node_type, args.output)
        print(f"[Completed] File path: {zip_path}")
        print(f"[SUCCESS] Node packaging completed successfully.")
    except Exception as e:
        print(f"[ERROR] Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
