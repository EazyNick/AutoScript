"""
Script packaging script
Reads script from database and packages it into a ZIP file.
"""

import argparse
import json
import os
import sys
import zipfile
from datetime import datetime
from pathlib import Path

# 프로젝트 루트 경로 추가 (package -> scripts -> project_root)
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root / "server"))

from config.nodes_config import NODES_CONFIG
from db.database import DatabaseManager


def get_standard_node_types() -> set[str]:
    """표준 노드 타입 목록 반환"""
    return set(NODES_CONFIG.keys())


def detect_required_nodes(nodes: list[dict]) -> list[str]:
    """
    Detect custom node types used in script
    
    Args:
        nodes: Node list
        
    Returns:
        List of required custom node types
    """
    standard_nodes = get_standard_node_types()
    required_nodes = []
    
    for node in nodes:
        node_type = node.get("type", "")
        if node_type and node_type not in standard_nodes:
            if node_type not in required_nodes:
                required_nodes.append(node_type)
    
    return required_nodes


def package_script(script_id: int, output_dir: str | None = None) -> str:
    """
    Package script into ZIP file
    
    Args:
        script_id: Script ID
        output_dir: Output directory (default: exports/)
        
    Returns:
        Path to created ZIP file
    """
    # Connect to database
    db_manager = DatabaseManager()
    
    # Get script
    script = db_manager.get_script(script_id)
    if not script:
        raise ValueError(f"Script ID {script_id} not found.")
    
    script_name = script.get("name", f"script_{script_id}")
    nodes = script.get("nodes", [])
    connections = script.get("connections", [])
    
    # Detect required nodes
    required_nodes = detect_required_nodes(nodes)
    
    # Create metadata
    metadata = {
        "name": script_name,
        "description": script.get("description", ""),
        "author": "AutoScript User",
        "version": "1.0.0",
        "created_at": datetime.now().isoformat() + "Z",
        "tags": [],
        "node_count": len(nodes),
        "required_nodes": required_nodes
    }
    
    # 스크립트 데이터 구조 생성
    script_data = {
        "version": "1.0.0",
        "format": "autoscript-script",
        "metadata": metadata,
        "script": {
            "id": None,  # Auto-generated on load
            "name": script_name,
            "description": script.get("description", ""),
            "active": bool(script.get("active", True)),
            "execution_order": None
        },
        "nodes": nodes,
        "connections": connections
    }
    
    # Set output directory
    if output_dir is None:
        output_dir = project_root / "exports"
    else:
        output_dir = Path(output_dir)
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate filename (remove special characters)
    safe_name = "".join(c if c.isalnum() or c in ("_", "-", " ") else "_" for c in script_name)
    zip_filename = f"{safe_name}.asscript.zip"
    zip_path = output_dir / zip_filename
    
    # Create ZIP file
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        # Add JSON file
        json_data = json.dumps(script_data, ensure_ascii=False, indent=2)
        zipf.writestr("script.json", json_data.encode("utf-8"))
        
        # Add README file (optional)
        readme_content = f"""# {script_name}

{script.get("description", "No description")}

## Metadata
- Author: {metadata['author']}
- Version: {metadata['version']}
- Created: {metadata['created_at']}
- Node Count: {metadata['node_count']} nodes

## Required Nodes
"""
        if required_nodes:
            readme_content += "\n".join(f"- {node}" for node in required_nodes)
        else:
            readme_content += "None (standard nodes only)"
        
        zipf.writestr("README.md", readme_content.encode("utf-8"))
    
    return str(zip_path)


def list_scripts():
    """Print script list"""
    db_manager = DatabaseManager()
    scripts = db_manager.get_all_scripts()
    
    if not scripts:
        print("No scripts found in database.")
        return
    
    print(f"\n[Script List] Total: {len(scripts)} scripts")
    print("-" * 60)
    print(f"{'ID':<6} {'Name':<30} {'Description':<20}")
    print("-" * 60)
    
    for script in scripts:
        script_id = script.get("id")
        name = script.get("name", "N/A")
        description = (script.get("description", "") or "")[:20]  # Limit to 20 chars
        print(f"{script_id:<6} {name:<30} {description:<20}")
    
    print("-" * 60)
    print("\nUsage: package-script.bat SCRIPT_ID [OUTPUT_DIR]")


def main():
    """메인 함수"""
    parser = argparse.ArgumentParser(description="Package script to ZIP file")
    parser.add_argument("script_id", type=int, nargs="?", help="Script ID to package")
    parser.add_argument("-o", "--output", type=str, help="Output directory (default: exports/)")
    parser.add_argument("-l", "--list", action="store_true", help="List all scripts")
    
    args = parser.parse_args()
    
    # List scripts if --list flag is set or no script_id provided
    if args.list or args.script_id is None:
        list_scripts()
        if args.script_id is None:
            sys.exit(0)
    
    try:
        print(f"[Packaging] Script ID: {args.script_id}")
        zip_path = package_script(args.script_id, args.output)
        print(f"[Completed] File path: {zip_path}")
        print(f"✅ Script packaging completed successfully.")
    except Exception as e:
        print(f"❌ Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
