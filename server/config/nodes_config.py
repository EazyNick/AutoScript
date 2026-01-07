"""
노드 설정 파일

서버에서 관리하는 모든 노드의 메타데이터를 정의합니다.
클라이언트는 이 설정을 API를 통해 가져와서 사용합니다.
"""

from typing import Any

# 노드 타입 정의
NODES_CONFIG: dict[str, dict[str, Any]] = {
    # === 경계 노드 (Boundary Nodes) ===
    "start": {
        "label": "시작 노드",
        "title": "시작",
        "description": "워크플로우의 시작점입니다.",
        "script": "boundarynodes/node-start.js",
        "is_boundary": True,
        "category": "system",
        "input_schema": {},
        "output_schema": {
            "action": {"type": "string", "description": "노드 타입"},
            "status": {"type": "string", "description": "실행 상태"},
            "output": {
                "type": "object",
                "description": "출력 데이터",
                "properties": {
                    "message": {"type": "string", "description": "시작 메시지"},
                },
            },
        },
    },
    # === 액션 노드 (Action Nodes) ===
    # "action" 노드는 제거되었습니다.
    "image-touch": {
        "label": "이미지 터치 노드",
        "title": "이미지 터치",
        "description": "이미지를 찾아 터치하는 노드입니다.",
        "script": "imagenodes/node-image-touch.js",
        "is_boundary": False,
        "category": "action",
        "requires_folder_path": True,
        # 노드 레벨 파라미터 (모든 상세 타입에 공통으로 사용되는 파라미터)
        "parameters": {
            "folder_path": {
                "type": "string",
                "label": "이미지 폴더 경로",
                "description": "이미지 파일이 있는 폴더 경로를 입력하세요.",
                "default": "",
                "required": True,
                "placeholder": "예: C:\\images\\touch",
            },
            "timeout": {
                "type": "number",
                "label": "타임아웃 (초)",
                "description": "이미지를 찾을 때까지 대기할 최대 시간입니다.",
                "default": 30,
                "min": 1,
                "max": 300,
                "required": False,
            },
        },
        # 상세 노드 타입 정의
        "detail_types": {},
        "input_schema": {
            "action": {"type": "string", "description": "이전 노드 타입"},
            "status": {"type": "string", "description": "이전 노드 실행 상태"},
            "output": {"type": "any", "description": "이전 노드 출력 데이터"},
        },
        "output_schema": {
            "action": {"type": "string", "description": "노드 타입"},
            "status": {"type": "string", "description": "실행 상태 (completed/failed)"},
            "output": {
                "type": "object",
                "description": "출력 데이터",
                "properties": {
                    "success": {"type": "boolean", "description": "성공 여부"},
                    "folder_path": {"type": "string", "description": "이미지 폴더 경로"},
                    "total_images": {"type": "number", "description": "총 이미지 개수"},
                    "results": {
                        "type": "array",
                        "description": "이미지 검색 결과",
                        "items": {
                            "type": "object",
                            "properties": {
                                "image": {"type": "string", "description": "이미지 파일명"},
                                "found": {"type": "boolean", "description": "발견 여부"},
                                "position": {"type": "array", "description": "위치 [x, y]"},
                                "touched": {"type": "boolean", "description": "터치 여부"},
                            },
                        },
                    },
                },
            },
        },
    },
    "wait": {
        "label": "대기 노드",
        "title": "대기 노드",
        "description": "일정 시간 대기하는 노드입니다.",
        "script": "waitnodes/node-wait.js",
        "is_boundary": False,
        "category": "action",
        # 노드 레벨 파라미터
        "parameters": {
            "wait_time": {
                "type": "number",
                "label": "대기 시간 (초)",
                "description": "대기할 시간을 초 단위로 입력하세요.",
                "default": 1,
                "min": 0,
                "max": 3600,
                "required": True,
            },
        },
        # 상세 노드 타입 정의
        "detail_types": {},
        "input_schema": {
            "action": {"type": "string", "description": "이전 노드 타입"},
            "status": {"type": "string", "description": "이전 노드 실행 상태"},
            "output": {"type": "any", "description": "이전 노드 출력 데이터"},
        },
        "output_schema": {
            "action": {"type": "string", "description": "노드 타입"},
            "status": {"type": "string", "description": "실행 상태"},
            "output": {
                "type": "object",
                "description": "출력 데이터",
                "properties": {
                    "wait_time": {"type": "number", "description": "대기한 시간 (초)"},
                    "elapsed": {"type": "number", "description": "경과 시간"},
                },
            },
        },
    },
    "process-focus": {
        "label": "화면 포커스",
        "title": "화면 포커스",
        "description": "선택한 프로세스의 창을 화면 최상단에 포커스합니다.",
        "script": "processnodes/node-process-focus.js",
        "is_boundary": False,
        "category": "process",
        # 상세 노드 타입 정의
        "detail_types": {},
        "parameters": {
            "process_id": {
                "type": "number",
                "description": "프로세스 ID",
                "required": False,
                "default": None,
            },
            "hwnd": {
                "type": "number",
                "description": "창 핸들 (Window Handle)",
                "required": False,
                "default": None,
            },
            "process_name": {
                "type": "string",
                "description": "프로세스 이름",
                "required": False,
                "default": None,
            },
            "window_title": {
                "type": "string",
                "description": "창 제목",
                "required": False,
                "default": None,
            },
        },
        "input_schema": {
            "action": {"type": "string", "description": "이전 노드 타입"},
            "status": {"type": "string", "description": "이전 노드 실행 상태"},
            "output": {"type": "any", "description": "이전 노드 출력 데이터"},
        },
        "output_schema": {
            "action": {"type": "string", "description": "노드 타입"},
            "status": {"type": "string", "description": "실행 상태"},
            "output": {
                "type": "object",
                "description": "출력 데이터",
                "properties": {
                    "success": {"type": "boolean", "description": "포커스 성공 여부"},
                    "process_id": {"type": "number", "description": "프로세스 ID"},
                    "process_name": {"type": "string", "description": "프로세스 이름"},
                    "hwnd": {"type": "number", "description": "윈도우 핸들"},
                    "window_title": {"type": "string", "description": "창 제목"},
                },
            },
        },
    },
    # === 로직 노드 (Logic Nodes) ===
    "condition": {
        "label": "조건 노드",
        "title": "조건 노드",
        "description": "이전 노드의 출력을 받아서 조건을 평가하는 노드입니다.",
        "script": "conditionnodes/node-condition.js",
        "is_boundary": False,
        "category": "logic",
        # 노드 레벨 파라미터
        "parameters": {
            "condition_type": {
                "type": "options",
                "label": "조건 타입",
                "description": "평가할 조건의 타입을 선택하세요.",
                "default": "equals",
                "required": True,
                "options": [
                    {"value": "equals", "label": "같음 (=)"},
                    {"value": "not_equals", "label": "다름 (!=)"},
                    {"value": "contains", "label": "포함됨 (contains)"},
                    {"value": "not_contains", "label": "포함되지 않음 (!contains)"},
                    {"value": "greater_than", "label": "더 큼 (>)"},
                    {"value": "less_than", "label": "더 작음 (<)"},
                    {"value": "greater_or_equal", "label": "크거나 같음 (>=)"},
                    {"value": "less_or_equal", "label": "작거나 같음 (<=)"},
                    {"value": "is_empty", "label": "비어있음"},
                    {"value": "is_not_empty", "label": "비어있지 않음"},
                ],
            },
            "field_path": {
                "type": "string",
                "label": "입력 필드",
                "description": "이전 노드 출력에서 비교할 필드 경로를 선택하거나 입력하세요. (예: output.value, output.status) 비워두면 전체 출력을 비교합니다.",
                "default": "",
                "required": False,
                "placeholder": "변수를 선택하거나 직접 입력하세요",
            },
            "compare_value": {
                "type": "string",
                "label": "비교할 값",
                "description": "조건을 만족하는지 확인할 값을 입력하세요.",
                "default": "",
                "required": True,
                "placeholder": "비교할 값을 입력하세요",
            },
        },
        # 상세 노드 타입 정의
        "detail_types": {},
        "input_schema": {
            "action": {"type": "string", "description": "이전 노드 타입"},
            "status": {"type": "string", "description": "이전 노드 실행 상태"},
            "output": {"type": "any", "description": "이전 노드 출력 데이터"},
        },
        "output_schema": {
            "action": {"type": "string", "description": "노드 타입"},
            "status": {"type": "string", "description": "실행 상태"},
            "output": {
                "type": "object",
                "description": "출력 데이터",
                "properties": {
                    "condition": {"type": "string", "description": "조건 표현식"},
                    "result": {"type": "boolean", "description": "조건 평가 결과"},
                },
            },
        },
    },
    "repeat": {
        "label": "반복 노드",
        "title": "반복",
        "description": "아래에 연결된 노드들을 지정한 횟수만큼 반복 실행하는 노드입니다.",
        "script": "logicnodes/node-repeat.js",
        "is_boundary": False,
        "category": "logic",
        "has_bottom_output": True,  # 아래 연결점이 있음을 표시
        # 노드 레벨 파라미터
        "parameters": {
            "repeat_count": {
                "type": "number",
                "label": "반복 횟수",
                "description": "반복할 횟수를 설정합니다.",
                "default": 1,
                "min": 1,
                "max": 10000,
                "required": True,
            },
        },
        # 상세 노드 타입 정의
        "detail_types": {},
        "input_schema": {
            "action": {"type": "string", "description": "이전 노드 타입"},
            "status": {"type": "string", "description": "이전 노드 실행 상태"},
            "output": {"type": "any", "description": "이전 노드 출력 데이터"},
        },
        "output_schema": {
            "action": {"type": "string", "description": "노드 타입"},
            "status": {"type": "string", "description": "실행 상태"},
            "output": {
                "type": "object",
                "description": "출력 데이터",
                "properties": {
                    "repeat_count": {"type": "number", "description": "실행된 반복 횟수"},
                    "completed": {"type": "boolean", "description": "반복 완료 여부"},
                    "iterations": {
                        "type": "array",
                        "description": "각 반복의 실행 결과",
                        "items": {"type": "object"},
                    },
                },
            },
        },
    },
    # === 엑셀 노드 (Excel Nodes) ===
    "excel-open": {
        "label": "엑셀 열기 노드",
        "title": "엑셀 열기",
        "description": "win32를 사용하여 엑셀 파일을 열는 노드입니다. Windows 환경에서만 사용 가능합니다.",
        "script": "excelnodes/node-excel-open.js",
        "is_boundary": False,
        "category": "action",
        "parameters": {
            "file_path": {
                "type": "string",
                "label": "엑셀 파일 경로",
                "description": "열 엑셀 파일의 경로를 입력하세요.",
                "default": "",
                "required": True,
                "placeholder": "예: C:\\data\\file.xlsx",
            },
            "visible": {
                "type": "boolean",
                "label": "엑셀 창 표시",
                "description": "엑셀 창을 표시할지 여부입니다.",
                "default": True,
                "required": False,
            },
        },
        "input_schema": {
            "action": {"type": "string", "description": "이전 노드 타입"},
            "status": {"type": "string", "description": "이전 노드 실행 상태"},
            "output": {"type": "any", "description": "이전 노드 출력 데이터"},
        },
        "output_schema": {
            "action": {"type": "string", "description": "노드 타입"},
            "status": {"type": "string", "description": "실행 상태 (completed/failed)"},
            "output": {
                "type": "object",
                "description": "출력 데이터",
                "properties": {
                    "file_path": {"type": "string", "description": "열린 엑셀 파일 경로"},
                    "visible": {"type": "boolean", "description": "엑셀 창 표시 여부"},
                    "success": {"type": "boolean", "description": "성공 여부"},
                    "execution_id": {"type": "string", "description": "스크립트 실행 ID (다음 노드에서 사용)"},
                },
            },
        },
    },
    "excel-select-sheet": {
        "label": "엑셀 시트 선택 노드",
        "title": "엑셀 시트 선택",
        "description": "엑셀 열기 노드로 열린 워크북의 특정 시트를 선택하는 노드입니다. Windows 환경에서만 사용 가능합니다.",
        "script": "excelnodes/node-excel-select-sheet.js",
        "is_boundary": False,
        "category": "action",
        "parameters": {
            "execution_id": {
                "type": "string",
                "label": "엑셀 실행 ID",
                "description": "엑셀 열기 노드의 출력에서 execution_id를 선택하거나 직접 입력하세요.",
                "default": "outdata.output.execution_id",
                "required": True,
                "placeholder": "이전 노드 출력에서 선택하거나 직접 입력",
                "source": "previous_output",
            },
            "sheet_name": {
                "type": "string",
                "label": "시트 이름",
                "description": "선택할 시트의 이름을 입력하세요. 시트 인덱스와 둘 중 하나는 필수입니다.",
                "default": "",
                "required": False,
                "placeholder": "예: Sheet1",
            },
            "sheet_index": {
                "type": "number",
                "label": "시트 인덱스",
                "description": "선택할 시트의 인덱스를 입력하세요 (1부터 시작). 시트 이름과 둘 중 하나는 필수입니다.",
                "default": None,
                "required": False,
                "placeholder": "예: 1",
                "min": 1,
            },
        },
        "input_schema": {
            "action": {"type": "string", "description": "이전 노드 타입"},
            "status": {"type": "string", "description": "이전 노드 실행 상태"},
            "output": {"type": "any", "description": "이전 노드 출력 데이터"},
        },
        "output_schema": {
            "action": {"type": "string", "description": "노드 타입"},
            "status": {"type": "string", "description": "실행 상태 (completed/failed)"},
            "output": {
                "type": "object",
                "description": "출력 데이터",
                "properties": {
                    "success": {"type": "boolean", "description": "성공 여부"},
                    "execution_id": {"type": "string", "description": "엑셀 실행 ID"},
                    "sheet_name": {"type": "string", "description": "선택된 시트 이름"},
                    "sheet_index": {"type": "number", "description": "선택된 시트 인덱스 (없으면 null)"},
                    "selected_by": {"type": "string", "description": "선택 방식 (name 또는 index)"},
                },
            },
        },
    },
    "excel-close": {
        "label": "엑셀 닫기 노드",
        "title": "엑셀 닫기",
        "description": "엑셀 열기 노드로 열린 엑셀 파일을 닫는 노드입니다. Windows 환경에서만 사용 가능합니다.",
        "script": "excelnodes/node-excel-close.js",
        "is_boundary": False,
        "category": "action",
        "parameters": {
            "execution_id": {
                "type": "string",
                "label": "엑셀 실행 ID",
                "description": "엑셀 열기 노드의 출력에서 execution_id를 선택하거나 직접 입력하세요.",
                "default": "outdata.output.execution_id",
                "required": False,
                "placeholder": "이전 노드 출력에서 선택하거나 직접 입력",
                "source": "previous_output",  # 이전 노드 출력에서 선택 가능하도록 표시
            },
            "save_changes": {
                "type": "boolean",
                "label": "변경사항 저장",
                "description": "엑셀 파일을 닫을 때 변경사항을 저장할지 여부입니다.",
                "default": True,
                "required": False,
            },
        },
        "input_schema": {
            "action": {"type": "string", "description": "이전 노드 타입"},
            "status": {"type": "string", "description": "이전 노드 실행 상태"},
            "output": {"type": "any", "description": "이전 노드 출력 데이터"},
        },
        "output_schema": {
            "action": {"type": "string", "description": "노드 타입"},
            "status": {"type": "string", "description": "실행 상태 (completed/failed)"},
            "output": {
                "type": "object",
                "description": "출력 데이터",
                "properties": {
                    "success": {"type": "boolean", "description": "성공 여부"},
                    "save_changes": {"type": "boolean", "description": "변경사항 저장 여부"},
                },
            },
        },
    },
    "excel-compare": {
        "label": "엑셀 비교 노드",
        "title": "엑셀 비교",
        "description": "두 개의 엑셀 파일을 비교하여 원본 엑셀의 값을 대상 엑셀에 복사합니다. 엑셀 열기, 비교, 닫기를 모두 수행하는 종합 노드입니다. 1~2행은 헤더, 3행부터 데이터입니다.",
        "script": "excelnodes/node-excel-compare.js",
        "is_boundary": False,
        "category": "action",
        "parameters": {
            "source_file_path": {
                "type": "string",
                "label": "원본 엑셀 파일 경로",
                "description": "원본 엑셀 파일의 경로를 입력하세요.",
                "default": "",
                "required": True,
                "placeholder": "예: C:\\Users\\User\\Desktop\\source.xlsx",
            },
            "target_file_path": {
                "type": "string",
                "label": "대상 엑셀 파일 경로",
                "description": "대상 엑셀 파일의 경로를 입력하세요.",
                "default": "",
                "required": True,
                "placeholder": "예: C:\\Users\\User\\Desktop\\target.xlsx",
            },
            "source_sheet_name": {
                "type": "string",
                "label": "원본 엑셀 시트 이름",
                "description": "원본 엑셀에서 사용할 시트 이름을 입력하세요.",
                "default": "Sheet1",
                "required": False,
                "placeholder": "예: Sheet1",
            },
            "target_sheet_name": {
                "type": "string",
                "label": "대상 엑셀 시트 이름",
                "description": "대상 엑셀에서 사용할 시트 이름을 입력하세요.",
                "default": "Sheet1",
                "required": False,
                "placeholder": "예: Sheet1",
            },
            "visible": {
                "type": "boolean",
                "label": "엑셀 창 표시",
                "description": "엑셀 창을 표시할지 여부입니다.",
                "default": True,
                "required": False,
            },
            "save_changes": {
                "type": "boolean",
                "label": "변경사항 저장",
                "description": "대상 엑셀 파일의 변경사항을 저장할지 여부입니다.",
                "default": True,
                "required": False,
            },
            "match_columns": {
                "type": "array",
                "label": "비교할 열 이름",
                "description": "행을 매칭하기 위해 사용할 열 이름들을 추가하세요. + 버튼을 눌러 여러 열을 추가할 수 있습니다.",
                "default": ["level1"],
                "required": True,
                "item_type": "string",
                "addable": True,
            },
            "automation_column": {
                "type": "string",
                "label": "자동화 메뉴얼 열 이름",
                "description": "복사할 값을 가진 열 이름을 입력하세요.",
                "default": "자동화/n메뉴얼",
                "required": True,
                "placeholder": "예: 자동화/n메뉴얼",
            },
        },
        "input_schema": {
            "action": {"type": "string", "description": "이전 노드 타입"},
            "status": {"type": "string", "description": "이전 노드 실행 상태"},
            "output": {"type": "any", "description": "이전 노드 출력 데이터"},
        },
        "output_schema": {
            "action": {"type": "string", "description": "노드 타입"},
            "status": {"type": "string", "description": "실행 상태 (completed/failed)"},
            "output": {
                "type": "object",
                "description": "출력 데이터",
                "properties": {
                    "success": {"type": "boolean", "description": "성공 여부"},
                    "matched_count": {"type": "number", "description": "매칭된 행 개수"},
                    "updated_count": {"type": "number", "description": "업데이트된 행 개수"},
                    "source_execution_id": {"type": "string", "description": "원본 엑셀 실행 ID"},
                    "target_execution_id": {"type": "string", "description": "대상 엑셀 실행 ID"},
                },
            },
        },
    },
    # === UI 테스트 노드 (UI Test Node) ===
    "testUIconfig": {
        "label": "UI 테스트 노드",
        "title": "UI 테스트",
        "description": "UI만 테스트하는 테스트 노드 설정입니다.",
        "script": "node-test-ui-config.js",
        "is_boundary": False,
        "category": "action",
        "input_schema": {
            "action": {"type": "string", "description": "이전 노드 타입"},
            "status": {"type": "string", "description": "이전 노드 실행 상태"},
            "output": {"type": "any", "description": "이전 노드 출력 데이터"},
        },
        "output_schema": {
            "action": {"type": "string", "description": "노드 타입"},
            "status": {"type": "string", "description": "실행 상태"},
            "output": {
                "type": "object",
                "description": "출력 데이터",
                "properties": {
                    "test_value": {"type": "string", "description": "테스트 값"},
                    "test_number": {"type": "number", "description": "테스트 숫자"},
                    "test_boolean": {"type": "boolean", "description": "테스트 옵션"},
                    "result": {"type": "string", "description": "테스트 결과"},
                },
            },
        },
        "parameters": {
            "test_value": {
                "type": "string",
                "label": "테스트 값",
                "description": "테스트용 값을 입력하세요.",
                "default": "기본값",
                "required": True,
                "placeholder": "테스트 값을 입력하세요",
            },
            "test_number": {
                "type": "number",
                "label": "테스트 숫자",
                "description": "테스트용 숫자를 입력하세요.",
                "default": 10,
                "required": False,
                "min": 0,
                "max": 100,
            },
            "test_boolean": {
                "type": "boolean",
                "label": "테스트 옵션",
                "description": "테스트용 옵션입니다.",
                "default": True,
                "required": False,
            },
        },
    },
}


def get_node_config(node_type: str) -> dict[str, Any] | None:
    """노드 설정 가져오기"""
    return NODES_CONFIG.get(node_type)


def get_all_node_types() -> list[str]:
    """모든 노드 타입 목록 가져오기"""
    return list(NODES_CONFIG.keys())


def get_action_node_types() -> list[str]:
    """액션 노드 타입 목록 가져오기 (검증용)"""
    return [
        node_type
        for node_type, config in NODES_CONFIG.items()
        if config.get("category") == "action" and not config.get("is_boundary", False)
    ]


def is_boundary_node(node_type: str) -> bool:
    """경계 노드인지 확인"""
    config = get_node_config(node_type)
    return config.get("is_boundary", False) if config else False


def get_node_label(node_type: str) -> str:
    """노드 라벨 가져오기"""
    config = get_node_config(node_type)
    return config.get("label", node_type) if config else node_type
