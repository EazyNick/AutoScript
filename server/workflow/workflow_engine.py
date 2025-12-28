import asyncio
from enum import Enum
import time

# Any: 모든 타입을 허용하는 타입 힌트
from typing import TYPE_CHECKING, Any

# TYPE_CHECKING: 타입 체커(mypy 등)가 코드를 분석할 때만 True가 됨
# 실행 시에는 False이므로 이 블록의 코드는 실행되지 않음 (타입 체크용으로만 사용)
if TYPE_CHECKING:
    # Callable: 함수 타입을 나타내는 타입 힌트 (node_handlers의 값 타입으로 사용)
    from collections.abc import Callable


class NodeType(Enum):
    """노드 타입 열거형
    워크플로우에서 사용할 수 있는 노드의 타입을 정의합니다.
    각 노드는 이 타입 중 하나를 가져야 합니다.
    """

    # CLICK: 마우스 클릭을 수행하는 노드 타입
    CLICK = "click"
    # WAIT: 지정된 시간만큼 대기하는 노드 타입
    WAIT = "wait"
    # CONDITION: 조건을 평가하여 분기를 결정하는 노드 타입
    CONDITION = "condition"
    # LOOP: 지정된 횟수만큼 반복 실행하는 노드 타입
    LOOP = "loop"
    # CUSTOM: 사용자 정의 커스텀 액션을 수행하는 노드 타입
    CUSTOM = "custom"


class ExecutionMode(Enum):
    """실행 모드 열거형
    워크플로우를 실행하는 방식을 정의합니다.
    """

    # SEQUENTIAL: 모든 노드를 순서대로 실행하는 모드 (조건 없이 순차 실행)
    SEQUENTIAL = "sequential"
    # CONDITIONAL: 조건 노드를 만나면 조건을 평가하여 분기 실행하는 모드
    CONDITIONAL = "conditional"


class NodeStatus(Enum):
    """노드 상태 열거형
    노드의 현재 실행 상태를 나타냅니다.
    노드는 실행 과정에서 이 상태들 중 하나를 가집니다.
    """

    # PENDING: 노드가 아직 실행되지 않았고 대기 중인 상태 (초기 상태)
    PENDING = "pending"
    # RUNNING: 노드가 현재 실행 중인 상태
    RUNNING = "running"
    # COMPLETED: 노드가 정상적으로 실행 완료된 상태
    COMPLETED = "completed"
    # FAILED: 노드 실행 중 에러가 발생하여 실패한 상태
    FAILED = "failed"
    # SKIPPED: 조건부 실행에서 조건을 만족하지 않아 건너뛴 상태
    SKIPPED = "skipped"


class WorkflowNode:
    """워크플로우 노드 클래스
    워크플로우를 구성하는 개별 노드를 나타내는 클래스입니다.
    각 노드는 고유한 ID, 타입, 데이터를 가지며 실행 상태를 추적합니다.
    """

    def __init__(self, node_id: str, node_type: NodeType, data: dict[str, Any]) -> None:
        """워크플로우 노드 초기화

        Args:
            node_id: 노드의 고유 식별자 (예: "node_1", "start", "click_123")
            node_type: 노드의 타입 (CLICK, WAIT, CONDITION, LOOP, CUSTOM 중 하나)
            data: 노드 실행에 필요한 파라미터 데이터 (예: 클릭 좌표, 대기 시간 등)
        """
        # node_id: 노드의 고유 식별자 (예: "node_1", "start", "click_123")
        self.id = node_id
        # node_type: 노드의 타입 (CLICK, WAIT, CONDITION, LOOP, CUSTOM 중 하나)
        self.type = node_type
        # data: 노드 실행에 필요한 파라미터 데이터 (예: 클릭 좌표, 대기 시간 등)
        self.data = data
        # status: 노드의 현재 실행 상태 (초기값: PENDING - 대기 중)
        self.status = NodeStatus.PENDING
        # start_time: 노드 실행 시작 시간 (타임스탬프, 초기값: None)
        self.start_time: float | None = None
        # end_time: 노드 실행 종료 시간 (타임스탬프, 초기값: None)
        self.end_time: float | None = None
        # error_message: 노드 실행 실패 시 에러 메시지 (초기값: None)
        self.error_message: str | None = None
        # result: 노드 실행 결과 데이터 (초기값: None)
        self.result: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        """노드를 딕셔너리로 변환합니다.
        노드의 모든 정보를 딕셔너리 형태로 반환합니다.
        주로 실행 결과를 JSON으로 직렬화하거나 저장할 때 사용됩니다.

        Returns:
            노드의 모든 속성을 포함한 딕셔너리
        """
        return {
            "id": self.id,  # 노드 ID
            "type": self.type.value,  # 노드 타입 (문자열 값)
            "data": self.data,  # 노드 데이터
            "status": self.status.value,  # 노드 상태 (문자열 값)
            "start_time": self.start_time,  # 실행 시작 시간
            "end_time": self.end_time,  # 실행 종료 시간
            "error_message": self.error_message,  # 에러 메시지 (있을 경우)
            "result": self.result,  # 실행 결과 (있을 경우)
        }


class WorkflowEngine:
    """워크플로우 실행 엔진
    워크플로우를 구성하는 노드들을 관리하고 실행하는 엔진 클래스입니다.
    노드들을 순차적으로 또는 조건부로 실행하며, 실행 상태와 결과를 추적합니다.
    """

    def __init__(self) -> None:
        """워크플로우 엔진 초기화
        모든 변수를 초기값으로 설정하고 노드 타입별 핸들러를 등록합니다.
        """
        # nodes: 워크플로우에 포함된 모든 노드 리스트 (WorkflowNode 객체들의 리스트)
        self.nodes: list[WorkflowNode] = []
        # execution_mode: 실행 모드 (순차 실행 또는 조건부 실행)
        # ExecutionMode.SEQUENTIAL: 기본값으로 순차 실행 모드 설정
        self.execution_mode = ExecutionMode.SEQUENTIAL
        # current_node_index: 현재 실행 중인 노드의 인덱스 (0부터 시작)
        self.current_node_index = 0
        # is_running: 워크플로우 실행 중 여부 플래그 (True: 실행 중, False: 대기 중)
        self.is_running = False
        # start_time: 워크플로우 실행 시작 시간 (타임스탬프, 초기값: None)
        self.start_time: float | None = None
        # end_time: 워크플로우 실행 종료 시간 (타임스탬프, 초기값: None)
        self.end_time: float | None = None
        # results: 각 노드의 실행 결과 리스트 (각 노드 실행 후 결과를 저장)
        self.results: list[dict[str, Any]] = []

        # 노드 핸들러 등록: 노드 타입별 실행 함수 매핑
        # node_handlers: 노드 타입을 키로 하고 해당 노드 타입의 실행 함수를 값으로 하는 딕셔너리
        #   - 키: NodeType 열거형 값 (예: NodeType.CLICK)
        #   - 값: 해당 노드 타입을 처리하는 함수 (예: self._handle_click_node)
        self.node_handlers: dict[NodeType, Callable] = {
            # CLICK 타입 노드는 _handle_click_node 함수로 처리
            NodeType.CLICK: self._handle_click_node,
            # WAIT 타입 노드는 _handle_wait_node 함수로 처리
            NodeType.WAIT: self._handle_wait_node,
            # CONDITION 타입 노드는 _handle_condition_node 함수로 처리
            NodeType.CONDITION: self._handle_condition_node,
            # LOOP 타입 노드는 _handle_loop_node 함수로 처리
            NodeType.LOOP: self._handle_loop_node,
            # CUSTOM 타입 노드는 _handle_custom_node 함수로 처리
            NodeType.CUSTOM: self._handle_custom_node,
        }

    def add_node(self, node: WorkflowNode) -> None:
        """노드를 추가합니다.
        워크플로우에 새로운 노드를 추가합니다.

        Args:
            node: 추가할 노드 객체
        """
        # nodes 리스트에 노드 추가 (워크플로우에 포함시킴)
        self.nodes.append(node)

    def add_nodes_from_dict(self, nodes_data: list[dict[str, Any]]) -> None:
        """딕셔너리 리스트에서 노드들을 추가합니다.
        딕셔너리 형태의 노드 데이터 리스트를 받아서 WorkflowNode 객체로 변환하여 추가합니다.

        Args:
            nodes_data: 노드 데이터 딕셔너리 리스트 (각 딕셔너리는 id, type, data 키를 가짐)
        """
        # 각 노드 데이터를 순회하며 WorkflowNode 객체 생성 및 추가
        # node_data: 현재 처리 중인 노드 데이터 딕셔너리
        for node_data in nodes_data:
            # WorkflowNode 객체 생성
            # node_id: 노드 ID (없으면 자동 생성: "node_0", "node_1", ...)
            #   - node_data.get("id"): 딕셔너리에서 "id" 키의 값 가져오기
            #   - f"node_{len(self.nodes)}": id가 없으면 현재 노드 개수를 사용하여 자동 생성
            # node_type: 노드 타입 (없으면 기본값 "click")
            #   - NodeType(): 문자열을 NodeType 열거형으로 변환
            #   - node_data.get("type", "click"): "type" 키가 없으면 "click" 기본값 사용
            # data: 노드 데이터 (없으면 빈 딕셔너리)
            #   - node_data.get("data", {}): "data" 키가 없으면 빈 딕셔너리 {} 사용
            node = WorkflowNode(
                node_id=node_data.get("id", f"node_{len(self.nodes)}"),
                node_type=NodeType(node_data.get("type", "click")),
                data=node_data.get("data", {}),
            )
            # 생성된 노드를 워크플로우에 추가 (nodes 리스트에 추가)
            self.add_node(node)

    def set_execution_mode(self, mode: ExecutionMode) -> None:
        """실행 모드를 설정합니다.
        워크플로우의 실행 방식을 설정합니다 (순차 실행 또는 조건부 실행).

        Args:
            mode: 실행 모드 (ExecutionMode.SEQUENTIAL 또는 ExecutionMode.CONDITIONAL)
        """
        # execution_mode: 실행 모드를 설정 (나중에 execute_workflow에서 사용됨)
        self.execution_mode = mode

    async def execute_workflow(self) -> dict[str, Any]:
        """워크플로우를 실행합니다.
        등록된 모든 노드를 실행 모드에 따라 순차적으로 또는 조건부로 실행합니다.

        Returns:
            실행 요약 정보를 포함한 딕셔너리 (성공 여부, 실행 시간, 노드별 결과 등)
        """
        # is_running: 워크플로우 실행 중 플래그를 True로 설정 (다른 곳에서 실행 상태 확인 가능)
        self.is_running = True
        # start_time: 워크플로우 실행 시작 시간 기록 (현재 시간의 타임스탬프)
        self.start_time = time.time()
        # current_node_index: 현재 실행 중인 노드 인덱스를 0으로 초기화 (첫 번째 노드부터 시작)
        self.current_node_index = 0
        # results: 실행 결과 리스트를 빈 리스트로 초기화 (각 노드의 실행 결과를 저장할 공간)
        self.results = []

        try:
            # 실행 모드에 따라 적절한 실행 함수 호출
            # SEQUENTIAL: 모든 노드를 순서대로 실행 (조건 없이)
            if self.execution_mode == ExecutionMode.SEQUENTIAL:
                await self._execute_sequential()
            # CONDITIONAL: 조건 노드를 만나면 조건을 평가하여 분기 실행
            elif self.execution_mode == ExecutionMode.CONDITIONAL:
                await self._execute_conditional()

            # end_time: 워크플로우 실행 종료 시간 기록 (정상 완료 시)
            self.end_time = time.time()
            # 실행 요약 정보 반환 (성공 여부, 실행 시간, 노드별 결과 등)
            return self._get_execution_summary()

        except Exception as e:
            # 예외 발생 시에도 종료 시간 기록 (에러 발생 시점 기록)
            self.end_time = time.time()
            # 에러 정보를 포함한 실행 결과 반환
            return {
                "success": False,  # 실행 실패 표시
                "error": str(e),  # 에러 메시지
                "execution_time": self.end_time - self.start_time,  # 실행 시간 (에러 발생까지의 시간)
                "results": self.results,  # 지금까지 실행된 노드들의 결과
            }
        finally:
            # 성공/실패 관계없이 항상 실행되는 블록
            # is_running: 워크플로우 실행 완료 플래그를 False로 설정 (실행 종료 표시)
            self.is_running = False

    async def _execute_sequential(self) -> None:
        """순차 실행
        모든 노드를 순서대로 하나씩 실행합니다.
        노드가 실패하면 stop_on_failure 설정에 따라 중단할 수 있습니다.
        """
        # 모든 노드를 순차적으로 실행
        # i: 현재 노드의 인덱스 (0부터 시작)
        # node: 현재 실행할 노드 객체
        for i, node in enumerate(self.nodes):
            # current_node_index: 현재 실행 중인 노드 인덱스 업데이트 (진행 상황 추적용)
            self.current_node_index = i
            # 현재 노드 실행 (비동기 함수이므로 await 필요)
            result = await self._execute_node(node)
            # 실행 결과를 results 리스트에 추가 (나중에 실행 요약에 사용됨)
            self.results.append(result)

            # 실패한 경우 중단 여부 확인
            # 노드 상태가 FAILED이고 stop_on_failure가 True인 경우 실행 중단
            # node.status == NodeStatus.FAILED: 노드 실행이 실패했는지 확인
            # node.data.get("stop_on_failure", True): 노드 데이터에서 stop_on_failure 설정 확인 (기본값: True)
            if node.status == NodeStatus.FAILED and node.data.get("stop_on_failure", True):
                # 루프 종료 (남은 노드들은 실행하지 않음)
                # break: for 루프를 즉시 종료하여 다음 노드들을 실행하지 않음
                break

    async def _execute_conditional(self) -> None:
        """조건부 실행
        조건 노드를 만나면 조건을 평가하여 분기 실행합니다.
        조건이 False이면 해당 노드를 스킵하고 다음 노드로 진행합니다.
        """
        # 모든 노드를 순차적으로 순회
        # i: 현재 노드의 인덱스
        # node: 현재 처리할 노드 객체
        for i, node in enumerate(self.nodes):
            # current_node_index: 현재 노드 인덱스 업데이트
            self.current_node_index = i

            # 조건 노드인 경우 조건 확인
            # node.type == NodeType.CONDITION: 현재 노드가 조건 노드인지 확인
            if node.type == NodeType.CONDITION:
                # condition_result: 조건 평가 결과 (True 또는 False)
                condition_result = await self._evaluate_condition(node)
                # 조건이 False인 경우 (조건을 만족하지 않음)
                if not condition_result:
                    # node.status: 노드 상태를 SKIPPED로 설정 (실행하지 않고 건너뜀)
                    node.status = NodeStatus.SKIPPED
                    # results: 스킵된 노드 정보를 결과 리스트에 추가
                    self.results.append(node.to_dict())
                    # continue: 다음 노드로 넘어감 (현재 노드는 실행하지 않음)
                    continue

            # 조건 노드가 아니거나 조건이 True인 경우 노드 실행
            result = await self._execute_node(node)
            # 실행 결과를 results 리스트에 추가
            self.results.append(result)

    async def _execute_node(self, node: WorkflowNode) -> dict[str, Any]:
        """개별 노드를 실행합니다.
        노드의 타입에 맞는 핸들러 함수를 찾아 실행하고, 실행 결과를 반환합니다.

        Args:
            node: 실행할 노드 객체

        Returns:
            노드 실행 결과를 포함한 딕셔너리
        """
        # 노드 상태를 RUNNING으로 설정 (실행 중 상태 표시)
        node.status = NodeStatus.RUNNING
        # 노드 실행 시작 시간 기록 (실행 시간 측정을 위해)
        node.start_time = time.time()

        try:
            # 노드 타입에 해당하는 핸들러 함수 가져오기
            # handler: 노드 타입에 맞는 실행 함수 (예: _handle_click_node, _handle_wait_node 등)
            handler = self.node_handlers.get(node.type)
            # 핸들러가 없는 경우 (지원하지 않는 노드 타입) 에러 발생
            # node.type이 node_handlers 딕셔너리에 없는 경우 None이 반환됨
            if not handler:
                # ValueError 예외 발생: 지원하지 않는 노드 타입이라는 에러 메시지와 함께
                raise ValueError(f"지원하지 않는 노드 타입: {node.type}")

            # 핸들러 함수 실행 (노드 타입별 실행 로직)
            # result: 핸들러 함수가 반환한 실행 결과 딕셔너리
            result = await handler(node)
            # 실행 성공 시 노드 상태를 COMPLETED로 설정 (정상 완료 표시)
            node.status = NodeStatus.COMPLETED
            # 실행 결과를 노드에 저장 (나중에 조회 가능하도록)
            node.result = result

        except Exception as e:
            # 예외 발생 시 노드 상태를 FAILED로 설정 (실패 표시)
            node.status = NodeStatus.FAILED
            # 에러 메시지 저장 (에러 원인 파악을 위해)
            node.error_message = str(e)
            # 에러 정보를 포함한 결과 생성 (에러 발생 시에도 결과 반환)
            result = {"error": str(e)}

        finally:
            # 성공/실패 관계없이 노드 실행 종료 시간 기록 (실행 시간 측정을 위해)
            node.end_time = time.time()

        # 노드 정보를 딕셔너리로 변환하여 반환 (상태, 결과, 시간 등 모든 정보 포함)
        return node.to_dict()

    async def _handle_click_node(self, node: WorkflowNode) -> dict[str, Any]:
        """클릭 노드 처리
        클릭 노드를 실행합니다. 노드 데이터에서 클릭 좌표와 버튼 정보를 가져와 클릭을 수행합니다.

        Args:
            node: 클릭 노드 객체 (data에 x, y, button, clicks 정보 포함)

        Returns:
            클릭 실행 결과 딕셔너리
        """
        # x: 클릭할 X 좌표 (기본값: 0)
        x = node.data.get("x", 0)
        # y: 클릭할 Y 좌표 (기본값: 0)
        y = node.data.get("y", 0)
        # button: 클릭할 마우스 버튼 ("left", "right", "middle" 중 하나, 기본값: "left")
        button = node.data.get("button", "left")
        # clicks: 클릭 횟수 (기본값: 1)

        clicks = node.data.get("clicks", 1)

        # 실제 클릭 로직 구현
        # 현재는 시뮬레이션으로 0.1초 대기 (실제 구현에서는 마우스 클릭 수행)
        await asyncio.sleep(0.1)  # 시뮬레이션

        # 클릭 실행 결과 반환
        return {"action": "click", "coordinates": (x, y), "button": button, "clicks": clicks, "success": True}

    async def _handle_wait_node(self, node: WorkflowNode) -> dict[str, Any]:
        """대기 노드 처리
        대기 노드를 실행합니다. 지정된 시간만큼 실행을 일시 중지합니다.

        Args:
            node: 대기 노드 객체 (data에 duration 정보 포함)

        Returns:
            대기 실행 결과 딕셔너리
        """
        # duration: 대기 시간(초) (기본값: 1.0초)
        # node.data.get("duration", 1.0): 노드 데이터에서 duration 가져오기 (없으면 1.0초)
        duration = node.data.get("duration", 1.0)

        # 지정된 시간만큼 대기
        # asyncio.sleep(): 비동기적으로 지정된 시간만큼 대기 (다른 작업을 블로킹하지 않음)
        await asyncio.sleep(duration)

        # 대기 완료 결과 반환
        return {"action": "wait", "duration": duration, "success": True}

    async def _handle_condition_node(self, node: WorkflowNode) -> dict[str, Any]:
        """조건 노드 처리"""
        condition_type = node.data.get("condition_type", "always_true")

        # 조건 평가 로직 구현
        result = await self._evaluate_condition(node)

        return {"action": "condition", "condition_type": condition_type, "result": result, "success": True}

    async def _handle_loop_node(self, node: WorkflowNode) -> dict[str, Any]:
        """루프 노드 처리
        루프 노드를 실행합니다. 지정된 횟수만큼 루프 내부 노드들을 반복 실행합니다.

        Args:
            node: 루프 노드 객체 (data에 loop_count와 nodes 정보 포함)

        Returns:
            루프 실행 결과 딕셔너리 (모든 반복의 실행 결과 포함)
        """
        # loop_count: 반복 횟수 (기본값: 1)
        loop_count = node.data.get("loop_count", 1)
        # loop_nodes: 루프 내부에서 실행할 노드 데이터 리스트 (기본값: 빈 리스트)
        loop_nodes = node.data.get("nodes", [])

        # results: 모든 반복의 실행 결과를 저장할 리스트 (각 반복의 각 노드 결과를 저장)
        results = []
        # 지정된 횟수만큼 반복 실행
        # i: 현재 반복 횟수 (0부터 시작, 예: 0, 1, 2, ...)
        for i in range(loop_count):
            # 루프 내부 노드들 실행
            # loop_node_data: 루프 내부에서 실행할 각 노드의 데이터 딕셔너리
            for loop_node_data in loop_nodes:
                # 각 반복마다 새로운 WorkflowNode 객체 생성 (고유한 ID 부여)
                # node_id: 고유한 ID 생성 (예: "loop_1_loop_0_click_1")
                #   - f"{node.id}_loop_{i}_{loop_node_data.get('id', 'unknown')}":
                #     루프 노드 ID + 반복 횟수 + 내부 노드 ID 조합
                loop_node = WorkflowNode(
                    node_id=f"{node.id}_loop_{i}_{loop_node_data.get('id', 'unknown')}",
                    node_type=NodeType(loop_node_data.get("type", "click")),
                    data=loop_node_data.get("data", {}),
                )
                # 루프 내부 노드 실행 (비동기 함수이므로 await 필요)
                result = await self._execute_node(loop_node)
                # 실행 결과를 results 리스트에 추가 (나중에 반환할 때 사용)
                results.append(result)

        # 루프 실행 완료 결과 반환
        return {"action": "loop", "loop_count": loop_count, "results": results, "success": True}

    async def _handle_custom_node(self, node: WorkflowNode) -> dict[str, Any]:
        """커스텀 노드 처리
        커스텀 노드를 실행합니다. 사용자 정의 액션을 수행할 수 있는 노드입니다.

        Args:
            node: 커스텀 노드 객체 (data에 custom_action 정보 포함)

        Returns:
            커스텀 노드 실행 결과 딕셔너리
        """
        # custom_action: 커스텀 액션 이름 (기본값: "unknown")
        # node.data.get("custom_action", "unknown"): 노드 데이터에서 custom_action 가져오기 (없으면 "unknown")
        custom_action = node.data.get("custom_action", "unknown")

        # 커스텀 액션 로직 구현
        # 현재는 시뮬레이션으로 0.5초 대기 (실제 구현에서는 custom_action에 따라 다른 동작 수행)
        await asyncio.sleep(0.5)  # 시뮬레이션 (실제 구현에서는 커스텀 액션 수행)

        # 커스텀 노드 실행 결과 반환
        return {"action": "custom", "custom_action": custom_action, "success": True}

    async def _evaluate_condition(self, node: WorkflowNode) -> bool:
        """조건을 평가합니다.
        노드의 condition_type에 따라 조건 평가 결과를 반환합니다.

        Args:
            node: 조건 노드 객체

        Returns:
            조건 평가 결과 (True 또는 False)
        """
        # condition_type: 조건 타입 (기본값: "always_true")
        condition_type = node.data.get("condition_type", "always_true")

        # 조건 타입에 따라 평가 결과 반환
        # always_true: 항상 True 반환 (조건을 항상 만족)
        if condition_type == "always_true":
            return True
        # always_false: 항상 False 반환 (조건을 항상 만족하지 않음)
        if condition_type == "always_false":
            return False
        # random: 랜덤하게 True 또는 False 반환 (확률적으로 조건 만족)
        if condition_type == "random":
            import random

            # random.choice: [True, False] 리스트에서 랜덤하게 하나 선택
            return random.choice([True, False])

        # 알 수 없는 조건 타입인 경우 기본값으로 True 반환 (안전한 기본값)
        return True

    def _get_execution_summary(self) -> dict[str, Any]:
        """실행 요약을 반환합니다.
        워크플로우 실행 결과를 요약하여 통계 정보를 반환합니다.

        Returns:
            실행 요약 정보 딕셔너리 (성공 여부, 실행 시간, 노드별 통계 등)
        """
        # total_nodes: 전체 노드 개수 (워크플로우에 포함된 모든 노드 수)
        total_nodes = len(self.nodes)
        # completed_nodes: 완료된 노드 개수 (COMPLETED 상태인 노드들)
        # [n for n in self.nodes if n.status == NodeStatus.COMPLETED]:
        #   모든 노드 중에서 상태가 COMPLETED인 노드들만 필터링하여 리스트 생성
        # len(): 필터링된 리스트의 길이 = 완료된 노드 개수
        completed_nodes = len([n for n in self.nodes if n.status == NodeStatus.COMPLETED])
        # failed_nodes: 실패한 노드 개수 (FAILED 상태인 노드들)
        # [n for n in self.nodes if n.status == NodeStatus.FAILED]:
        #   모든 노드 중에서 상태가 FAILED인 노드들만 필터링하여 리스트 생성
        failed_nodes = len([n for n in self.nodes if n.status == NodeStatus.FAILED])
        # skipped_nodes: 스킵된 노드 개수 (SKIPPED 상태인 노드들)
        # [n for n in self.nodes if n.status == NodeStatus.SKIPPED]:
        #   모든 노드 중에서 상태가 SKIPPED인 노드들만 필터링하여 리스트 생성
        skipped_nodes = len([n for n in self.nodes if n.status == NodeStatus.SKIPPED])

        # execution_time: 실행 시간 계산 (종료 시간 - 시작 시간)
        # end_time과 start_time이 모두 존재하는 경우에만 계산, 없으면 0
        # self.end_time and self.start_time: 둘 다 None이 아니면 True
        #   - True인 경우: self.end_time - self.start_time 계산
        #   - False인 경우: 0 반환 (시간 정보가 없으면 0초로 표시)
        execution_time = self.end_time - self.start_time if self.end_time and self.start_time else 0

        # 실행 요약 정보 반환
        return {
            # success: 실패한 노드가 없으면 True (모든 노드가 성공적으로 완료)
            # failed_nodes == 0: 실패한 노드가 0개이면 True (성공)
            "success": failed_nodes == 0,
            # execution_time: 총 실행 시간(초) (워크플로우 시작부터 종료까지의 시간)
            "execution_time": execution_time,
            # total_nodes: 전체 노드 개수
            "total_nodes": total_nodes,
            # completed_nodes: 완료된 노드 개수 (정상적으로 실행 완료된 노드 수)
            "completed_nodes": completed_nodes,
            # failed_nodes: 실패한 노드 개수 (실행 중 에러가 발생한 노드 수)
            "failed_nodes": failed_nodes,
            # skipped_nodes: 스킵된 노드 개수 (조건부 실행에서 조건을 만족하지 않아 건너뛴 노드 수)
            "skipped_nodes": skipped_nodes,
            # success_rate: 성공률 (완료된 노드 / 전체 노드 * 100), 전체 노드가 0이면 0
            # total_nodes > 0: 전체 노드가 0개보다 크면 True (0으로 나누기 방지)
            #   - True인 경우: (completed_nodes / total_nodes * 100) 계산 (백분율)
            #   - False인 경우: 0 반환 (노드가 없으면 성공률 0%)
            "success_rate": (completed_nodes / total_nodes * 100) if total_nodes > 0 else 0,
            # results: 각 노드의 실행 결과 리스트 (각 노드의 실행 결과가 순서대로 저장됨)
            "results": self.results,
        }

    def stop_execution(self) -> None:
        """실행을 중지합니다.
        워크플로우 실행을 강제로 중지합니다.
        실행 중인 노드가 완료되면 다음 노드를 실행하지 않고 종료됩니다.
        """
        # is_running: 실행 중 플래그를 False로 설정 (실행 중단 신호)
        self.is_running = False

    def get_current_status(self) -> dict[str, Any]:
        """현재 상태를 반환합니다.
        워크플로우 엔진의 현재 실행 상태 정보를 반환합니다.

        Returns:
            현재 상태 정보를 포함한 딕셔너리
        """
        return {
            # is_running: 워크플로우가 현재 실행 중인지 여부 (True: 실행 중, False: 대기 중)
            "is_running": self.is_running,
            # current_node_index: 현재 실행 중인 노드의 인덱스 (0부터 시작)
            "current_node_index": self.current_node_index,
            # total_nodes: 전체 노드 개수
            "total_nodes": len(self.nodes),
            # execution_mode: 실행 모드 ("sequential" 또는 "conditional")
            "execution_mode": self.execution_mode.value,
            # start_time: 워크플로우 실행 시작 시간 (타임스탬프)
            "start_time": self.start_time,
            # current_time: 현재 시간 (타임스탬프, 실행 시간 계산에 사용)
            "current_time": time.time(),
        }
