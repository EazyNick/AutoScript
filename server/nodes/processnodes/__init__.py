"""
프로세스 노드 모듈
프로세스/시스템 제어 노드들을 관리합니다.

이 모듈은 자동으로 모든 노드 클래스를 감지하여 로드합니다.
새로운 노드를 추가할 때는 노드 파일만 생성하면 됩니다.
"""

import importlib
import inspect
from pathlib import Path

from nodes.base_node import BaseNode

# 자동으로 모든 노드 클래스를 감지하여 import
_imported_nodes = {}
_current_package = __package__ or "server.nodes.processnodes"
_current_dir = Path(__file__).parent

# 현재 디렉토리의 모든 .py 파일을 스캔
for file_path in _current_dir.glob("*.py"):
    # __init__.py는 제외
    if file_path.name == "__init__.py":
        continue

    module_name = file_path.stem
    try:
        # 모듈 import
        module = importlib.import_module(f".{module_name}", _current_package)

        # 모듈에서 BaseNode를 상속받은 모든 클래스 찾기
        for name, obj in inspect.getmembers(module, inspect.isclass):
            if issubclass(obj, BaseNode) and obj is not BaseNode and obj.__module__ == module.__name__:
                _imported_nodes[name] = obj
                # 전역 네임스페이스에 추가
                globals()[name] = obj
    except Exception as e:
        # 특정 모듈 import 실패 시 경고만 출력하고 계속 진행
        import warnings

        # stacklevel=2: 경고 메시지의 스택 트레이스 위치를 조정합니다.
        # - stacklevel=1 (기본값): warnings.warn이 호출된 위치(__init__.py의 이 줄)를 가리킴
        # - stacklevel=2: warnings.warn을 호출한 상위 레벨(이 루프를 실행한 코드)을 가리킴
        #   이렇게 하면 경고가 실제로 문제가 발생한 모듈 로드 위치를 정확히 표시합니다.
        warnings.warn(f"노드 모듈 '{module_name}' 로드 실패: {e}", ImportWarning, stacklevel=2)

# __all__에 자동으로 발견된 모든 노드들을 포함
__all__ = sorted(_imported_nodes.keys())
