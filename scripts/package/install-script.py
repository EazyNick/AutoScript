"""
스크립트 설치 스크립트
shared-scripts/ 폴더의 ZIP 파일을 읽어서 데이터베이스에 설치합니다.
"""

import argparse
import hashlib
import json
import os
import sys
import zipfile
from pathlib import Path

# 프로젝트 루트 경로 추가 (package -> scripts -> project_root)
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root / "server"))

from db.database import DatabaseManager


def calculate_file_hash(file_path: Path) -> str:
    """파일 해시 계산"""
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def validate_script_data(script_data: dict) -> tuple[bool, str]:
    """
    스크립트 데이터 검증
    
    Returns:
        (성공 여부, 에러 메시지)
    """
    # 필수 필드 확인
    required_fields = ["version", "format", "metadata", "script", "nodes", "connections"]
    for field in required_fields:
        if field not in script_data:
            return False, f"필수 필드 '{field}'가 없습니다."
    
    # 형식 확인
    if script_data.get("format") != "autoscript-script":
        return False, "잘못된 형식입니다. 'autoscript-script' 형식이어야 합니다."
    
    # 노드 확인
    nodes = script_data.get("nodes", [])
    if not isinstance(nodes, list):
        return False, "'nodes'는 배열이어야 합니다."
    
    # 연결 확인
    connections = script_data.get("connections", [])
    if not isinstance(connections, list):
        return False, "'connections'는 배열이어야 합니다."
    
    return True, ""


def check_required_nodes(required_nodes: list[str], db_manager: DatabaseManager) -> list[str]:
    """
    필요한 노드가 설치되어 있는지 확인
    
    Args:
        required_nodes: 필요한 노드 타입 목록
        db_manager: 데이터베이스 관리자
        
    Returns:
        누락된 노드 목록
    """
    # TODO: 커스텀 노드 설치 여부 확인 로직 구현
    # 현재는 표준 노드만 확인
    from config.nodes_config import NODES_CONFIG
    
    standard_nodes = set(NODES_CONFIG.keys())
    missing_nodes = []
    
    for node_type in required_nodes:
        if node_type not in standard_nodes:
            # 커스텀 노드인 경우 (향후 구현)
            # shared_node_files 테이블에서 확인
            missing_nodes.append(node_type)
    
    return missing_nodes


def install_script_from_zip(zip_path: Path, skip_duplicate: bool = True) -> dict:
    """
    ZIP 파일에서 스크립트 설치
    
    Args:
        zip_path: ZIP 파일 경로
        skip_duplicate: 중복 스크립트 건너뛰기 여부
        
    Returns:
        설치 결과 딕셔너리
    """
    db_manager = DatabaseManager()
    
    # ZIP 파일 검증
    if not zip_path.exists():
        raise FileNotFoundError(f"ZIP 파일을 찾을 수 없습니다: {zip_path}")
    
    if not zip_path.suffix == ".zip":
        raise ValueError(f"ZIP 파일이 아닙니다: {zip_path}")
    
    # ZIP 파일 압축 해제
    temp_dir = project_root / "temp-script-install"
    temp_dir.mkdir(exist_ok=True)
    
    try:
        with zipfile.ZipFile(zip_path, "r") as zipf:
            # 파일 목록 확인
            file_list = zipf.namelist()
            if "script.json" not in file_list:
                raise ValueError("ZIP 파일에 'script.json'이 없습니다.")
            
            # 압축 해제
            zipf.extractall(temp_dir)
        
        # script.json 읽기
        script_json_path = temp_dir / "script.json"
        with open(script_json_path, "r", encoding="utf-8") as f:
            script_data = json.load(f)
        
        # 데이터 검증
        is_valid, error_msg = validate_script_data(script_data)
        if not is_valid:
            raise ValueError(f"스크립트 데이터 검증 실패: {error_msg}")
        
        metadata = script_data.get("metadata", {})
        script_info = script_data.get("script", {})
        nodes = script_data.get("nodes", [])
        connections = script_data.get("connections", [])
        required_nodes = metadata.get("required_nodes", [])
        
        script_name = script_info.get("name", metadata.get("name", "Unknown"))
        
        # 중복 확인
        all_scripts = db_manager.get_all_scripts()
        existing_script = next((s for s in all_scripts if s.get("name") == script_name), None)
        
        if existing_script:
            if skip_duplicate:
                return {
                    "success": False,
                    "message": f"스크립트 '{script_name}'가 이미 존재합니다. 건너뜁니다.",
                    "script_id": existing_script.get("id"),
                    "skipped": True
                }
            else:
                raise ValueError(f"스크립트 '{script_name}'가 이미 존재합니다.")
        
        # 필요한 노드 확인
        missing_nodes = check_required_nodes(required_nodes, db_manager)
        
        # 스크립트 생성
        description = script_info.get("description", metadata.get("description", ""))
        script_id = db_manager.create_script(script_name, description)
        
        # 노드 및 연결 저장
        db_manager.save_script_data(script_id, nodes, connections)
        
        # 활성 상태 설정
        active = script_info.get("active", True)
        if not active:
            db_manager.update_script_active(script_id, False)
        
        result = {
            "success": True,
            "message": f"스크립트 '{script_name}'가 성공적으로 설치되었습니다.",
            "script_id": script_id,
            "script_name": script_name,
            "nodes_count": len(nodes),
            "connections_count": len(connections),
            "missing_nodes": missing_nodes
        }
        
        if missing_nodes:
            result["warning"] = f"다음 노드가 설치되지 않았습니다: {', '.join(missing_nodes)}"
        
        return result
        
    finally:
        # 임시 디렉토리 정리
        if temp_dir.exists():
            import shutil
            shutil.rmtree(temp_dir)


def install_scripts_from_folder(folder_path: Path | None = None, skip_duplicate: bool = True) -> list[dict]:
    """
    폴더의 모든 ZIP 파일 설치
    
    Args:
        folder_path: 스크립트 폴더 경로 (기본값: shared-scripts/)
        skip_duplicate: 중복 스크립트 건너뛰기 여부
        
    Returns:
        설치 결과 목록
    """
    if folder_path is None:
        folder_path = project_root / "shared-scripts"
    else:
        folder_path = Path(folder_path)
    
    if not folder_path.exists():
        folder_path.mkdir(parents=True, exist_ok=True)
        return []
    
    results = []
    zip_files = list(folder_path.glob("*.asscript.zip"))
    
    if not zip_files:
        print(f"[알림] '{folder_path}' 폴더에 ZIP 파일이 없습니다.")
        return results
    
    print(f"[설치 시작] {len(zip_files)}개의 ZIP 파일 발견")
    
    for zip_file in zip_files:
        try:
            print(f"\n[처리 중] {zip_file.name}")
            result = install_script_from_zip(zip_file, skip_duplicate)
            results.append(result)
            
            if result.get("success"):
                print(f"  ✅ {result['message']}")
                if result.get("warning"):
                    print(f"  ⚠️  {result['warning']}")
            elif result.get("skipped"):
                print(f"  ⏭️  {result['message']}")
            else:
                print(f"  ❌ {result.get('message', '설치 실패')}")
        except Exception as e:
            error_result = {
                "success": False,
                "message": f"오류 발생: {str(e)}",
                "file": str(zip_file)
            }
            results.append(error_result)
            print(f"  ❌ {error_result['message']}")
    
    return results


def main():
    """메인 함수"""
    parser = argparse.ArgumentParser(description="스크립트 ZIP 파일을 데이터베이스에 설치합니다.")
    parser.add_argument("zip_file", type=str, nargs="?", help="설치할 ZIP 파일 경로 (지정하지 않으면 shared-scripts/ 폴더의 모든 파일 설치)")
    parser.add_argument("-f", "--folder", type=str, help="스크립트 폴더 경로 (기본값: shared-scripts/)")
    parser.add_argument("--no-skip-duplicate", action="store_true", help="중복 스크립트도 덮어쓰기 (기본값: 건너뛰기)")
    
    args = parser.parse_args()
    
    try:
        skip_duplicate = not args.no_skip_duplicate
        
        if args.zip_file:
            # 단일 파일 설치
            zip_path = Path(args.zip_file)
            if not zip_path.is_absolute():
                zip_path = project_root / zip_path
            
            print(f"[설치 시작] {zip_path.name}")
            result = install_script_from_zip(zip_path, skip_duplicate)
            
            if result.get("success"):
                print(f"✅ {result['message']}")
                if result.get("warning"):
                    print(f"⚠️  {result['warning']}")
                sys.exit(0)
            elif result.get("skipped"):
                print(f"⏭️  {result['message']}")
                sys.exit(0)
            else:
                print(f"❌ {result.get('message', '설치 실패')}")
                sys.exit(1)
        else:
            # 폴더의 모든 파일 설치
            results = install_scripts_from_folder(args.folder, skip_duplicate)
            
            success_count = sum(1 for r in results if r.get("success"))
            skipped_count = sum(1 for r in results if r.get("skipped"))
            failed_count = len(results) - success_count - skipped_count
            
            print(f"\n[설치 완료]")
            print(f"  ✅ 성공: {success_count}개")
            print(f"  ⏭️  건너뜀: {skipped_count}개")
            print(f"  ❌ 실패: {failed_count}개")
            
            if failed_count > 0:
                sys.exit(1)
    except Exception as e:
        print(f"❌ 오류 발생: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
