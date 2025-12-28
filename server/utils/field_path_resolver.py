"""
필드 경로 해석 유틸리티
이전 노드 출력에서 경로 문자열을 실제 값으로 변환하는 유틸리티 함수

경로 형식:
- outdata.output.execution_id: 이전 노드의 전체 결과에서 output.execution_id 접근
- outdata.action: 이전 노드의 action 필드 접근
- indata.parameter_name: 현재 노드의 입력 파라미터 접근 (향후 지원)
"""

from typing import Any

from log import log_manager

logger = log_manager.logger


def resolve_field_path(field_path: str, previous_output: dict[str, Any] | None) -> Any | None:
    """
    필드 경로 문자열을 이전 노드 출력에서 실제 값으로 변환합니다.

    Args:
        field_path: 필드 경로 문자열
            - "outdata.output.execution_id": 이전 노드의 output.execution_id
            - "outdata.action": 이전 노드의 action 필드
            - "outdata.output": 이전 노드의 전체 output 객체
            - "indata.parameter_name": 이전 노드의 입력 파라미터
        previous_output: 경로 해석용 래핑 구조
            - {"outdata": {"action": "...", "status": "...", "output": {...}}, "indata": {...}}
            - outdata: 이전 노드의 실행 결과 {action, status, output}
            - indata: 이전 노드의 입력 파라미터

    Returns:
        해석된 실제 값 또는 None

    Examples:
        >>> previous_output = {
        ...     "outdata": {
        ...         "action": "excel-open",
        ...         "status": "completed",
        ...         "output": {"execution_id": "123", "file_path": "test.xlsx"}
        ...     },
        ...     "indata": {"file_path": "test.xlsx", "visible": True}
        ... }
        >>> resolve_field_path("outdata.output.execution_id", previous_output)
        "123"
        >>> resolve_field_path("outdata.action", previous_output)
        "excel-open"
        >>> resolve_field_path("outdata.output", previous_output)
        {"execution_id": "123", "file_path": "test.xlsx"}
        >>> resolve_field_path("indata.file_path", previous_output)
        "test.xlsx"
    """
    if not field_path or not isinstance(field_path, str):
        return None

    if not previous_output or not isinstance(previous_output, dict):
        return None

    # outdata. 또는 indata.으로 시작하는 경로만 처리
    if not field_path.startswith(("outdata.", "indata.")):
        return None

    try:
        if field_path.startswith("outdata."):
            # "outdata." 제거
            path = field_path[8:]  # "outdata." 길이만큼 제거

            # previous_output에서 outdata 가져오기
            if "outdata" not in previous_output:
                return None

            resolved_value = previous_output["outdata"]

            # 경로가 비어있으면 전체 outdata 반환
            if not path:
                return resolved_value

            # 경로를 점(.)으로 분리하여 중첩된 딕셔너리 접근
            keys = path.split(".")
            for key in keys:
                if isinstance(resolved_value, dict):
                    resolved_value = resolved_value.get(key)
                else:
                    # dict가 아니면 더 이상 접근 불가능하므로 None 반환
                    return None

            return resolved_value

        if field_path.startswith("indata."):
            # "indata." 제거
            path = field_path[7:]  # "indata." 길이만큼 제거

            # previous_output에서 indata 가져오기
            if "indata" not in previous_output:
                return None

            resolved_value = previous_output["indata"]

            # 경로가 비어있으면 전체 indata 반환
            if not path:
                return resolved_value

            # 경로를 점(.)으로 분리하여 중첩된 딕셔너리 접근
            keys = path.split(".")
            for key in keys:
                if isinstance(resolved_value, dict):
                    resolved_value = resolved_value.get(key)
                else:
                    # dict가 아니면 더 이상 접근 불가능하므로 None 반환
                    return None

            return resolved_value

        # 위의 조건에 해당하지 않는 경우 (이론적으로 도달 불가능)
        return None

    except Exception as e:
        logger.warning(f"[FieldPathResolver] 경로 해석 실패: {field_path}, 오류: {e!s}")
        return None


def resolve_parameter_paths(
    node_data: dict[str, Any], previous_output: dict[str, Any] | None, current_indata: dict[str, Any] | None = None
) -> dict[str, Any]:
    """
    노드 데이터의 모든 파라미터에서 경로 문자열을 실제 값으로 변환합니다.

    Args:
        node_data: 노드 데이터 딕셔너리 (파라미터 포함)
        previous_output: 이전 노드의 결과 딕셔너리 (outdata 구조 또는 직접 구조)
        current_indata: 현재 노드의 입력 데이터 (indata 구조)

    Returns:
        경로가 해석된 노드 데이터 딕셔너리 (원본 수정)

    Examples:
        >>> node_data = {"execution_id": "outdata.output.execution_id", "sheet_name": "Sheet1"}
        >>> previous_output = {
        ...     "outdata": {
        ...         "action": "excel-open",
        ...         "status": "completed",
        ...         "output": {"execution_id": "123"}
        ...     }
        ... }
        >>> resolve_parameter_paths(node_data, previous_output)
        {"execution_id": "123", "sheet_name": "Sheet1"}
    """
    if not previous_output or not isinstance(previous_output, dict):
        return node_data

    # previous_output을 outdata 구조로 통일 (indata 포함)
    wrapped_output = previous_output.copy()
    if current_indata:
        wrapped_output["indata"] = current_indata

    # node_data의 모든 키-값 쌍을 순회
    for key, value in node_data.items():
        # 값이 문자열이고 경로 문자열인 경우
        if isinstance(value, str):
            # 새로운 형식: outdata. 또는 indata.로 시작
            if value.startswith(("outdata.", "indata.")):
                # 경로 해석
                resolved_value = resolve_field_path(value, wrapped_output)
                if resolved_value is not None:
                    # 경로가 성공적으로 해석되었으면 실제 값으로 교체
                    node_data[key] = resolved_value
                    logger.debug(f"[FieldPathResolver] 파라미터 '{key}' 경로 해석: '{value}' -> {resolved_value}")
            # 이전 형식: output.data. 또는 output.으로 시작 (하위 호환성)
            elif value.startswith("output."):
                # 이전 형식을 새로운 형식으로 변환
                # "output.data.output.execution_id" -> "outdata.output.execution_id" (중복 output 제거)
                # "output.data.execution_id" -> "outdata.output.execution_id"
                # "output.execution_id" -> "outdata.output.execution_id"
                normalized_path = value
                if normalized_path.startswith("output.data.output."):
                    # "output.data.output." 제거 후 "outdata.output." 추가 (중복 output 제거)
                    normalized_path = "outdata.output." + normalized_path[19:]
                elif normalized_path.startswith("output.data."):
                    # "output.data." 제거 후 "outdata.output." 추가
                    normalized_path = "outdata.output." + normalized_path[12:]
                elif normalized_path.startswith("output."):
                    # "output." 제거 후 "outdata.output." 추가
                    normalized_path = "outdata.output." + normalized_path[7:]

                # 변환된 경로로 해석
                resolved_value = resolve_field_path(normalized_path, wrapped_output)
                if resolved_value is not None:
                    # 경로가 성공적으로 해석되었으면 실제 값으로 교체
                    node_data[key] = resolved_value
                    logger.debug(
                        f"[FieldPathResolver] 파라미터 '{key}' 경로 해석 (이전 형식 변환): '{value}' -> '{normalized_path}' -> {resolved_value}"
                    )

    return node_data
