#!/usr/bin/env python3
"""
노드 생성 스크립트
새로운 노드를 빠르게 생성하기 위한 템플릿 생성 도구입니다.

사용법:
    python scripts/nodes/create-node.py --name my-node --category action --description "내 노드 설명"
"""

import argparse
import json
import re
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


def to_camel_case(name: str) -> str:
    """케밥 케이스를 카멜 케이스로 변환"""
    parts = name.split("-")
    return "".join(word.capitalize() for word in parts)


def to_kebab_case(name: str) -> str:
    """스네이크 케이스를 케밥 케이스로 변환"""
    return name.replace("_", "-")


def generate_python_node(
    node_name: str, node_type: str, description: str, category: str, parameters: dict[str, Any] | None = None
) -> str:
    """Python 노드 클래스 템플릿 생성"""
    class_name = to_camel_case(node_type.replace("-", "_")) + "Node"
    snake_name = to_snake_case(node_type)

    # 파라미터 추출 코드 생성
    param_code = ""
    if parameters:
        for param_name, param_config in parameters.items():
            param_type = param_config.get("type", "string")
            default = param_config.get("default", "")
            required = param_config.get("required", False)

            if param_type == "number":
                default_value = default if default != "" else 0
            elif param_type == "boolean":
                default_value = default if default != "" else False
            else:
                default_value = f'"{default}"' if default != "" else '""'

            if required:
                param_code += f'        {param_name} = get_parameter(parameters, "{param_name}")\n'
            else:
                param_code += f'        {param_name} = get_parameter(parameters, "{param_name}", default={default_value})\n'

    template = f'''"""
{description}
"""

import time
from typing import Any

from nodes.base_node import BaseNode
from nodes.node_executor_wrapper import NodeExecutor
from utils import get_parameter


class {class_name}(BaseNode):
    """{description}"""

    @staticmethod
    @NodeExecutor("{node_type}")
    async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
        """
        {description}

        Args:
            parameters: 노드 파라미터
{chr(10).join(f"                - {k}: {v.get('description', '')} (기본값: {v.get('default', '')})" for k, v in (parameters or {}).items())}

        Returns:
            실행 결과 딕셔너리
        """
        # ============================================
        # [SECTION 1] 파라미터 추출 및 이전 노드 값 사용
        # ============================================
        # 
        # 1. 파라미터 정의 (server/config/nodes_config.py)
        #    노드 설정에 "parameters" 섹션을 추가하면 자동으로 UI 폼이 생성됩니다.
        #
        #    예시:
        #    "{node_type}": {{
        #        "label": "{description}",
        #        "parameters": {{
        #            "file_path": {{
        #                "type": "string",
        #                "label": "파일 경로",
        #                "description": "파일 경로를 입력하세요.",
        #                "default": "",
        #                "required": True
        #            }},
        #            "timeout": {{
        #                "type": "number",
        #                "label": "타임아웃 (초)",
        #                "default": 30,
        #                "min": 1,
        #                "max": 300
        #            }}
        #        }}
        #    }}
        #
        # 2. 이전 노드 출력 값 사용하기
        #    파라미터에 "source": "previous_output" 속성을 추가하면
        #    UI에서 이전 노드의 출력 변수를 선택할 수 있는 버튼이 자동으로 생성됩니다.
        #
        #    예시:
        #    "execution_id": {{
        #        "type": "string",
        #        "label": "실행 ID",
        #        "description": "이전 노드의 execution_id를 선택하거나 직접 입력하세요.",
        #        "default": "outdata.output.execution_id",
        #        "source": "previous_output"  # 이 속성 추가 시 변수 선택 버튼 자동 생성
        #    }}
        #
        # 3. 파라미터 값 추출
        #    parameters 딕셔너리에는 다음이 포함됩니다:
        #    - "action": 이전 노드 타입
        #    - "status": 이전 노드 실행 상태
        #    - "output": 이전 노드의 출력 데이터 (dict)
        #    - 기타 nodes_config.py에서 정의한 파라미터들
        #
        #    사용자가 UI에서 "outdata.output.execution_id" 같은 경로를 입력하면,
        #    서버에서 자동으로 이전 노드의 실제 값으로 변환하여 전달합니다.
        #    따라서 여기서는 이미 변환된 실제 값이 전달됩니다.
        #
        #    예시:
        #    execution_id = get_parameter(parameters, "execution_id")
        #    # execution_id는 실제 값 (예: "20250101-120000-abc123")
        #    # 경로 문자열이 아닌 실제 값이 전달됨
        
{param_code if param_code else "        # 파라미터가 필요한 경우 여기에 추출 코드를 추가하세요.\n        # 예시: my_param = get_parameter(parameters, \"my_param\", default=\"default_value\")"}
        
        # ============================================
        # [SECTION 2] 노드 실행 로직 구현
        # ============================================
        # TODO: 여기에 실제 노드의 핵심 기능을 구현하세요.
        # 
        # 이 섹션에서 구현해야 할 내용:
        #   - 노드의 주요 비즈니스 로직
        #   - 파일 읽기/쓰기, API 호출, 데이터 처리 등
        #   - 외부 프로그램 실행, 시스템 명령 실행 등
        #   - 필요한 경우 예외 처리 및 에러 핸들링
        #
        # 예시:
        #   result = some_function(param1, param2)
        #   processed_data = process_data(result)
        #   save_to_file(processed_data, "output.txt")
        
        # [구현 시작] 아래에 실제 로직을 작성하세요
        pass  # TODO: 실제 로직 구현
        # [구현 끝]
        
        # ============================================
        # [SECTION 3] 출력 데이터 구성
        # ============================================
        # 노드 실행 결과를 다음 노드로 전달할 데이터를 구성합니다.
        # 반드시 다음 형식을 따라야 합니다:
        #   {{
        #       "action": "{node_type}",
        #       "status": "completed" 또는 "error",
        #       "output": {{ ... 실제 출력 데이터 ... }}
        #   }}
        
        output_data = {{
            "message": "{description} 노드가 성공적으로 실행되었습니다.",
            "node_type": "{node_type}",
            # TODO: 실제 실행 결과 데이터를 여기에 추가하세요
            # 예시: "result": result, "data": processed_data
        }}
        
        # 파라미터가 있으면 각각을 출력에 포함 (필요한 경우)
{chr(10).join(f'        if "{k}" in parameters:{chr(10)}            output_data["{k}"] = {k}' for k in (parameters.keys() if parameters else []))}

        return {{
            "action": "{node_type}",
            "status": "completed",
            "output": output_data
        }}
'''
    return template


def generate_javascript_node(node_type: str, label: str, description: str) -> str:
    """JavaScript 노드 렌더링 파일 템플릿 생성"""
    template = f'''// node-{node_type}.js
(function () {{
    if (!window.NodeManager) {{
        return;
    }}

    window.NodeManager.registerNodeType('{node_type}', {{
        /**
         * 노드 내용 생성
         * @param {{Object}} nodeData - 노드 데이터
         * 
         * nodeData 객체 구조:
         *   - id: 노드 고유 ID
         *   - type: 노드 타입 ('{node_type}')
         *   - title: 노드 제목
         *   - description: 노드 설명
         *   - x, y: 노드 위치 좌표
         *   - color: 노드 색상
         *   - [파라미터명]: nodes_config.py에서 정의한 파라미터 값들
         *     예: nodeData.file_path, nodeData.timeout 등
         */
        renderContent(nodeData) {{
            // ============================================
            // [SECTION 1] 파라미터 정의 및 접근 방법
            // ============================================
            // 
            // 1. 파라미터 정의 (server/config/nodes_config.py)
            //    노드 설정에 "parameters" 섹션을 추가하면 자동으로 UI 폼이 생성됩니다.
            //
            //    예시:
            //    "{node_type}": {{
            //        "label": "{label}",
            //        "parameters": {{
            //            "file_path": {{
            //                "type": "string",
            //                "label": "파일 경로",
            //                "description": "파일 경로를 입력하세요.",
            //                "default": "",
            //                "required": True,
            //                "placeholder": "예: C:\\\\path\\\\to\\\\file.txt"
            //            }},
            //            "timeout": {{
            //                "type": "number",
            //                "label": "타임아웃 (초)",
            //                "description": "대기 시간을 입력하세요.",
            //                "default": 30,
            //                "min": 1,
            //                "max": 300,
            //                "required": False
            //            }}
            //        }}
            //    }}
            //
            // 2. 이전 노드 출력 값 사용하기
            //    파라미터에 "source": "previous_output" 속성을 추가하면
            //    UI에서 이전 노드의 출력 변수를 선택할 수 있는 버튼이 자동으로 생성됩니다.
            //
            //    예시:
            //    "execution_id": {{
            //        "type": "string",
            //        "label": "실행 ID",
            //        "description": "이전 노드의 execution_id를 선택하거나 직접 입력하세요.",
            //        "default": "outdata.output.execution_id",
            //        "required": True,
            //        "source": "previous_output"  // 이 속성 추가 시 변수 선택 버튼 자동 생성
            //    }}
            //
            // 3. 파라미터 값 접근 (JavaScript)
            //    nodeData 객체를 통해 파라미터 값에 접근할 수 있습니다.
            //    예: const filePath = nodeData.file_path || '기본값';
            //    예: const timeout = nodeData.timeout || 30;
            //
            // 4. 이전 노드 출력 값 사용 (서버 측)
            //    사용자가 UI에서 "outdata.output.execution_id" 같은 경로를 입력하면,
            //    서버에서 자동으로 이전 노드의 실제 값으로 변환하여 전달합니다.
            //    Python 노드에서는 이미 변환된 실제 값이 parameters에 전달됩니다.
            
            // [파라미터 접근 예시]
            // const myParam = nodeData.my_param || '기본값';
            // const myNumber = nodeData.my_number || 0;
            // const myBoolean = nodeData.my_boolean || false;
            
            // ============================================
            // [SECTION 2] 노드 아이콘 설정
            // ============================================
            // 노드 아이콘은 node-icons.config.js에서 중앙 관리됩니다.
            // 커스텀 아이콘이 필요한 경우 node-icons.config.js를 수정하세요.
            const NodeIcons = window.NodeIcons || {{}};
            const icon = NodeIcons.getIcon('{node_type}', nodeData) || NodeIcons.icons?.default || '⚙';
            
            // ============================================
            // [SECTION 3] 노드 UI 렌더링
            // ============================================
            // TODO: 노드의 시각적 표현을 커스터마이징하려면 이 부분을 수정하세요.
            // 
            // 기본 구조:
            //   - node-input: 입력 포트 영역
            //   - node-content: 노드 본문 (아이콘, 제목, 설명 등)
            //   - node-output: 출력 포트 영역
            //   - node-settings: 설정 버튼 (클릭 시 파라미터 설정 모달 열림)
            //
            // 커스터마이징 예시:
            //   - 파라미터 값 표시: nodeData에서 파라미터 값을 읽어 화면에 표시
            //   - 동적 스타일 적용: 파라미터 값에 따라 스타일 변경
            //   - 조건부 렌더링: 특정 조건에 따라 다른 UI 표시
            //
            // 파라미터 값 표시 예시:
            //   const filePath = nodeData.file_path || '파일 미선택';
            //   <div class="node-description">${{this.escapeHtml(filePath)}}</div>
            
            // [구현 시작] 필요시 아래 HTML 템플릿을 수정하세요
            return `
                <div class="node-input"></div>
                <div class="node-content">
                    <div class="node-icon-box">
                        <div class="node-icon">${{icon}}</div>
                    </div>
                    <div class="node-text-area">
                        <div class="node-title">${{this.escapeHtml(nodeData.title || '{label}')}}</div>
                        <div class="node-description">${{this.escapeHtml(nodeData.description || '{description}')}}</div>
                        <!-- TODO: 파라미터 값을 표시하려면 여기에 추가하세요 -->
                        <!-- 예시: <div class="node-param">${{this.escapeHtml(nodeData.my_param || '')}}</div> -->
                    </div>
                </div>
                <div class="node-output"></div>
                <div class="node-settings" data-node-id="${{nodeData.id}}">⚙</div>
            `;
            // [구현 끝]
        }}
        
        // ============================================
        // [SECTION 4] 추가 메서드 구현 (선택사항)
        // ============================================
        // TODO: 노드에 추가 기능이 필요한 경우 여기에 메서드를 추가하세요.
        //
        // 사용 가능한 메서드 예시:
        //   - onNodeClick(nodeData): 노드 클릭 시 동작
        //   - onNodeDoubleClick(nodeData): 노드 더블클릭 시 동작
        //   - validateNode(nodeData): 노드 유효성 검사
        //   - getNodeData(nodeData): 노드 데이터 가져오기
        //
        // 예시:
        //   onNodeClick(nodeData) {{
        //       console.log('Node clicked:', nodeData);
        //       // 커스텀 동작 구현
        //   }}
    }});
}})();
'''
    return template


def generate_config_entry(
    node_type: str, label: str, description: str, category: str, parameters: dict[str, Any] | None = None
) -> dict[str, Any]:
    """nodes_config.py에 추가할 설정 딕셔너리 생성"""
    config = {
        "label": label,
        "title": label,
        "description": description,
        "script": f"node-{node_type}.js",
        "is_boundary": category == "boundary",
        "category": category,
        "input_schema": {
            "action": {"type": "string", "description": "이전 노드 타입"},
            "status": {"type": "string", "description": "이전 노드 실행 상태"},
            "output": {"type": "any", "description": "이전 노드 출력 데이터"},
        },
        "output_schema": {
            "action": {"type": "string", "description": "노드 타입"},
            "status": {"type": "string", "description": "실행 상태"},
            "output": {"type": "any", "description": "출력 데이터"},
        },
    }

    if parameters:
        config["parameters"] = parameters

    return config


def add_to_config(node_type: str, config_entry: dict[str, Any]) -> bool:
    """
    nodes_config.py에 노드 설정 추가
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
        
        # 이미 존재하는지 확인
        if f'"{node_type}":' in content or f"'{node_type}':" in content:
            print(f"⚠️  nodes_config.py에 '{node_type}' 설정이 이미 존재합니다.")
            return False
        
        # 딕셔너리 닫는 중괄호 찾기 (NODES_CONFIG의 닫는 중괄호)
        lines = content.split("\n")
        dict_close_line = None
        
        # NODES_CONFIG 딕셔너리의 닫는 중괄호 찾기
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
        
        if dict_close_line is None:
            print(f"⚠️  NODES_CONFIG 딕셔너리의 닫는 중괄호를 찾을 수 없습니다.")
            return False
        
        # 마지막 항목 뒤에 쉼표가 있는지 확인하고 추가
        insert_line = dict_close_line
        
        # 이전 줄들을 거꾸로 확인하여 마지막 항목 찾기
        for i in range(dict_close_line - 1, -1, -1):
            stripped = lines[i].strip()
            if stripped and not stripped.startswith("#"):
                # 마지막 항목의 닫는 중괄호 뒤에 쉼표가 있는지 확인
                # `},`로 끝나면 쉼표가 있는 것, `}`로 끝나면 쉼표 추가 필요
                if stripped.endswith("},"):
                    # 이미 쉼표가 있음
                    break
                elif stripped.endswith("}"):
                    # 쉼표가 없으므로 추가
                    lines[i] = lines[i].rstrip() + ","
                    break
                elif not stripped.endswith(","):
                    # 다른 형태의 줄이면 쉼표 추가
                    lines[i] = lines[i].rstrip() + ","
                    break
                break
        
        # 설정을 Python 딕셔너리 형식으로 포맷팅
        # JSON을 사용하되 Python 형식에 맞게 들여쓰기 조정
        config_str = json.dumps(config_entry, indent=4, ensure_ascii=False)
        # JSON의 true/false를 Python의 True/False로 변환
        config_str = config_str.replace(": true", ": True").replace(": false", ": False")
        # 들여쓰기 조정 (4칸 기본 + 4칸 추가 = 8칸)
        config_lines = [f'    "{node_type}": {{']
        for line in config_str.split("\n")[1:-1]:  # 첫 줄과 마지막 줄 제외
            # 각 줄에 4칸 들여쓰기 추가
            config_lines.append("    " + line)
        config_lines.append("    },")
        
        # 삽입할 내용 구성 (마지막 항목 뒤에 추가)
        insert_content = config_lines
        
        # 파일에 삽입
        lines[insert_line:insert_line] = insert_content
        
        # 파일 쓰기
        new_content = "\n".join(lines)
        CONFIG_FILE.write_text(new_content, encoding="utf-8")
        return True
        
    except Exception as e:
        print(f"❌ 설정 파일 수정 실패: {e}")
        print(f"   수동으로 nodes_config.py에 다음 설정을 추가해주세요:")
        print(f"\n{json.dumps({node_type: config_entry}, indent=4, ensure_ascii=False)}")
        return False


def main() -> None:
    parser = argparse.ArgumentParser(description="새로운 노드를 생성합니다.")
    parser.add_argument("--name", required=True, help="노드 타입 (예: my-node)")
    parser.add_argument(
        "--category",
        required=True,
        help="노드 카테고리 (기본: action, logic, wait, image, boundary 또는 새 카테고리 이름)",
    )
    parser.add_argument("--description", required=True, help="노드 설명")
    parser.add_argument("--label", help="노드 라벨 (기본값: name을 기반으로 생성)")
    parser.add_argument("--parameters", help="파라미터 JSON 파일 경로 (선택)")

    args = parser.parse_args()

    node_type = args.name
    category = args.category
    description = args.description
    label = args.label or node_type.replace("-", " ").title()

    # 파라미터 로드
    parameters = None
    if args.parameters:
        with open(args.parameters, "r", encoding="utf-8") as f:
            parameters = json.load(f)

    # 카테고리 디렉토리 확인 및 생성
    if category in CATEGORY_MAP:
        # 기존 카테고리 사용
        category_dir = CATEGORY_MAP[category]
    else:
        # 새로운 카테고리 생성
        # 카테고리 이름을 스네이크 케이스로 변환하여 디렉토리명 생성
        category_dir = category.lower().replace("-", "_").replace(" ", "_") + "nodes"
        print(f"ℹ️  새로운 카테고리 '{category}'를 사용합니다. 디렉토리: {category_dir}")

    # 카테고리 디렉토리 생성 (없는 경우)
    category_path = SERVER_DIR / "nodes" / category_dir
    if not category_path.exists():
        category_path.mkdir(parents=True, exist_ok=True)
        # __init__.py 파일 생성
        init_file = category_path / "__init__.py"
        if not init_file.exists():
            init_content = f'''"""
{category} 노드 모듈
{description} 노드들을 관리합니다.

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
            print(f"✅ 새 카테고리 디렉토리 생성: {category_path}")
            print(f"✅ __init__.py 파일 생성: {init_file}")
    node_dir = SERVER_DIR / "nodes" / category_dir
    js_dir = UI_DIR / "src" / "js" / "components" / "node"

    # 파일명 생성
    python_filename = to_snake_case(node_type) + ".py"
    js_filename = f"node-{node_type}.js"
    python_path = node_dir / python_filename
    js_path = js_dir / js_filename

    # 파일이 이미 존재하는지 확인
    python_exists = python_path.exists()
    js_exists = js_path.exists()
    
    if python_exists:
        print(f"⚠️  Python 파일이 이미 존재합니다: {python_path}")
        print(f"   기존 파일을 건너뜁니다.")
    
    if js_exists:
        print(f"⚠️  JavaScript 파일이 이미 존재합니다: {js_path}")
        print(f"   기존 파일을 건너뜁니다.")

    # 템플릿 생성
    python_code = generate_python_node(node_type, node_type, description, category, parameters)
    js_code = generate_javascript_node(node_type, label, description)
    config_entry = generate_config_entry(node_type, label, description, category, parameters)

    # 파일 생성 (존재하지 않는 경우에만)
    if not python_exists:
        python_path.write_text(python_code, encoding="utf-8")
        print(f"✅ Python 파일 생성: {python_path}")
    else:
        print(f"⏭️  Python 파일 건너뜀: {python_path}")
    
    if not js_exists:
        js_path.write_text(js_code, encoding="utf-8")
        print(f"✅ JavaScript 파일 생성: {js_path}")
    else:
        print(f"⏭️  JavaScript 파일 건너뜀: {js_path}")

    # nodes_config.py에 설정 추가 (항상 시도)
    config_added = add_to_config(node_type, config_entry)

    print(f"\n✅ 노드 생성 완료!")
    print(f"\n파일 상태:")
    if not python_exists:
        print(f"  ✅ Python: {python_path} (생성됨)")
    else:
        print(f"  ⏭️  Python: {python_path} (이미 존재)")
    if not js_exists:
        print(f"  ✅ JavaScript: {js_path} (생성됨)")
    else:
        print(f"  ⏭️  JavaScript: {js_path} (이미 존재)")
    if category not in CATEGORY_MAP:
        print(f"  ✅ 카테고리 디렉토리: {category_path}")
    
    if config_added:
        print(f"  ✅ 설정: nodes_config.py에 '{node_type}' 추가 완료")
    else:
        print(f"\n⚠️  nodes_config.py에 설정을 자동으로 추가하지 못했습니다.")
        print(f"   수동으로 다음 설정을 추가해주세요:")
        print(f"\n{json.dumps({node_type: config_entry}, indent=4, ensure_ascii=False)}")
    
    print(f"\n다음 단계:")
    if not python_exists:
        print(f"  1. {python_path} 파일을 열어 노드 실행 로직을 구현하세요.")
    if not config_added:
        step_num = 1 if python_exists else 2
        print(f"  {step_num}. server/config/nodes_config.py 파일에 위 설정을 추가하세요.")
    final_step = (2 if python_exists else 3) if not config_added else (1 if python_exists else 2)
    print(f"  {final_step}. 서버를 재시작하면 새 노드가 자동으로 인식됩니다.")


if __name__ == "__main__":
    main()
