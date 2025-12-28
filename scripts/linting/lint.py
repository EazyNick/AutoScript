#!/usr/bin/env python3
"""
린팅 자동화 스크립트 (Python)
사용법: python scripts/linting/lint.py
"""

import os
import subprocess
import sys
from pathlib import Path

# Windows에서 UTF-8 인코딩 설정
if sys.platform == "win32":
    # 표준 출력/에러 스트림을 UTF-8로 설정
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    # 환경 변수 설정
    os.environ["PYTHONIOENCODING"] = "utf-8"

# 색상 출력
class Colors:
    RED = "\033[0;31m"
    GREEN = "\033[0;32m"
    YELLOW = "\033[1;33m"
    NC = "\033[0m"  # No Color


def print_color(message: str, color: str = Colors.NC) -> None:
    """색상이 있는 메시지 출력"""
    try:
        print(f"{color}{message}{Colors.NC}")
    except UnicodeEncodeError:
        # Windows cp949 인코딩 문제 해결: 유니코드 문자를 ASCII로 변환
        safe_message = message.replace("✓", "[OK]").replace("✗", "[FAIL]")
        print(f"{color}{safe_message}{Colors.NC}")


def find_venv_directories(project_root: Path) -> list[Path]:
    """프로젝트 루트에서 가상환경 디렉토리 찾기"""
    venv_dirs = []
    
    # 일반적인 가상환경 이름들
    common_names = ["venv", "env", "ENV"]
    
    # 일반적인 이름들 확인
    for name in common_names:
        venv_path = project_root / name
        if venv_path.exists() and venv_path.is_dir():
            venv_dirs.append(venv_path)
    
    # .으로 시작하는 모든 디렉토리 확인
    try:
        for item in project_root.iterdir():
            if item.is_dir() and item.name.startswith("."):
                # 가상환경인지 확인: Scripts/bin 디렉토리가 있는지 체크
                scripts_dir = item / ("Scripts" if sys.platform == "win32" else "bin")
                if scripts_dir.exists() and scripts_dir.is_dir():
                    # python 실행 파일이 있는지 확인 (가상환경의 특징)
                    python_exe = scripts_dir / ("python.exe" if sys.platform == "win32" else "python")
                    if python_exe.exists():
                        venv_dirs.append(item)
    except (PermissionError, OSError):
        # 디렉토리 접근 권한이 없는 경우 무시
        pass
    
    return venv_dirs


def find_command(command: str) -> str:
    """명령어의 전체 경로 찾기 (가상환경 포함)"""
    # 현재 스크립트의 디렉토리에서 프로젝트 루트 찾기
    script_dir = Path(__file__).parent
    project_root = script_dir.parent.parent
    
    # 가상환경 디렉토리 찾기
    venv_dirs = find_venv_directories(project_root)
    
    # Windows용 실행 파일 확장자
    exe_ext = ".exe" if sys.platform == "win32" else ""
    
    # 가상환경의 Scripts/bin 디렉토리에서 찾기
    for venv_path in venv_dirs:
        # Windows: Scripts, Linux/Mac: bin
        scripts_dir = venv_path / ("Scripts" if sys.platform == "win32" else "bin")
        command_path = scripts_dir / f"{command}{exe_ext}"
        if command_path.exists():
            return str(command_path)
    
    # 가상환경에서 찾지 못하면 시스템 PATH에서 찾기
    which_cmd = "where" if sys.platform == "win32" else "which"
    try:
        result = subprocess.run([which_cmd, command], capture_output=True, text=True, check=True)
        return result.stdout.strip().split("\n")[0]
    except (subprocess.CalledProcessError, FileNotFoundError):
        # 찾지 못하면 원래 명령어 반환 (에러 발생 시 명확한 메시지 표시)
        return command


def run_command(command: list[str], description: str) -> bool:
    """명령어 실행"""
    # 첫 번째 명령어의 경로 찾기
    if command:
        command[0] = find_command(command[0])
    
    print_color(f"[{description}] 실행 중...", Colors.YELLOW)
    try:
        result = subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        )
        # stdout 출력 (성공 메시지 등)
        if result.stdout:
            try:
                print(result.stdout, end="")
            except UnicodeEncodeError:
                # Windows 인코딩 문제 해결
                print(result.stdout.encode("utf-8", errors="replace").decode("utf-8", errors="replace"), end="")
        # stderr도 출력 (일부 도구는 stderr로 정보를 출력)
        if result.stderr:
            try:
                print(result.stderr, end="", file=sys.stderr)
            except UnicodeEncodeError:
                print(result.stderr.encode("utf-8", errors="replace").decode("utf-8", errors="replace"), end="", file=sys.stderr)
        print_color(f"[OK] {description} 완료", Colors.GREEN)
        return True
    except subprocess.CalledProcessError as e:
        print_color(f"[FAIL] {description} 실패", Colors.RED)
        # stdout 출력 (일부 도구는 stdout으로 에러 출력)
        if e.stdout:
            try:
                print(e.stdout, end="")
            except UnicodeEncodeError:
                print(e.stdout.encode("utf-8", errors="replace").decode("utf-8", errors="replace"), end="")
        # stderr 출력 (대부분의 도구는 stderr로 에러 출력)
        if e.stderr:
            try:
                print(e.stderr, end="", file=sys.stderr)
            except UnicodeEncodeError:
                print(e.stderr.encode("utf-8", errors="replace").decode("utf-8", errors="replace"), end="", file=sys.stderr)
        # stdout과 stderr가 모두 비어있으면 명령어와 exit code 출력
        if not e.stdout and not e.stderr:
            print(f"명령어: {' '.join(command)}")
            print(f"Exit code: {e.returncode}")
        return False
    except FileNotFoundError:
        print_color(f"[FAIL] {description} 실패: '{command[0]}' 명령어를 찾을 수 없습니다.", Colors.RED)
        print_color("가상환경이 활성화되어 있는지 확인하거나 ruff와 mypy가 설치되어 있는지 확인하세요.", Colors.YELLOW)
        return False


def main() -> int:
    """메인 함수"""
    # 현재 디렉토리 확인
    script_dir = Path(__file__).parent
    project_root = script_dir.parent.parent
    import os

    os.chdir(project_root)

    print_color("=== 린팅 시작 ===", Colors.GREEN)
    print(f"프로젝트 루트: {project_root}")
    print()

    # 1단계: Ruff 자동 수정
    if not run_command(["ruff", "check", "--fix", "server/"], "Ruff 자동 수정"):
        return 1
    print()

    # 2단계: Ruff 포매팅
    if not run_command(["ruff", "format", "server/"], "Ruff 포매팅"):
        return 1
    print()

    # 3단계: Ruff 검사
    if not run_command(["ruff", "check", "server/"], "Ruff 검사"):
        return 1
    print()

    # 4단계: Mypy 타입 체크
    # python -m mypy를 사용하여 현재 Python 환경의 mypy 사용
    mypy_command = [sys.executable, "-m", "mypy", "server/", "--show-error-codes"]
    if not run_command(mypy_command, "Mypy 타입 체크"):
        # mypy 에러가 발생했을 때 추가 정보 출력
        print()
        print_color("=== Mypy 에러 디버깅 정보 ===", Colors.YELLOW)
        print("다음 명령어를 직접 실행하여 에러를 확인하세요:")
        print(f"  python -m mypy server/ --show-error-codes")
        print()
        return 1
    print()

    print_color("=== 모든 린팅 검사 통과! ===", Colors.GREEN)
    return 0


if __name__ == "__main__":
    sys.exit(main())

