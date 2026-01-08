"""
Test node
"""

import time
from typing import Any

from nodes.base_node import BaseNode
from nodes.node_executor_wrapper import NodeExecutor


class Test_nodeNode(BaseNode):
    """Test node"""

    @staticmethod
    @NodeExecutor("test-node")
    async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
        """
        Test node

        Args:
            parameters: 노드 파라미터


        Returns:
            실행 결과 딕셔너리
        """
        # ============================================
        # 예시 동작 (개발자가 확인하기 쉬운 기본 동작)
        # ============================================
        # 아래 코드는 테스트용 예시 동작입니다.
        # 실제 노드 동작을 구현할 때는 이 부분을 수정하세요.

        # 실행 시작 시간 기록
        start_time = time.time()

        # 파라미터 추출 (예시)

        # ============================================
        # TODO: 여기에 실제 노드 실행 로직을 구현하세요
        # ============================================
        # 예시:
        # - 파일 읽기/쓰기
        # - API 호출
        # - 데이터 처리
        # - 외부 프로그램 실행 등

        # 실행 시간 계산
        execution_time = time.time() - start_time

        # ============================================
        # 예시 출력 (개발자가 확인하기 쉬운 형식)
        # ============================================
        # 입력 파라미터와 실행 정보를 포함하여 반환
        output_data = {
            "message": "Test node 노드가 성공적으로 실행되었습니다.",
            "execution_time_seconds": round(execution_time, 3),
            "received_parameters": {k: v for k, v in parameters.items() if not k.startswith("_")},
            "node_type": "test-node",
            "timestamp": time.time(),
        }

        # 파라미터가 있으면 각각을 출력에 포함

        return {"action": "test-node", "status": "completed", "output": output_data}
