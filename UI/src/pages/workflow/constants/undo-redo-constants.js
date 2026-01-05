/**
 * Undo/Redo 관련 상수
 * 되돌리기 기능에서 사용하는 상수들을 정의합니다.
 */

export const UNDO_REDO_CONSTANTS = {
    // 스택 크기
    MAX_STACK_SIZE: 20, // 최대 Undo 스택 크기

    // 스냅샷 저장 지연
    SNAPSHOT_SAVE_DELAY: 100, // 스냅샷 저장 지연 시간 (ms)
    NODE_RESTORE_DELAY: 50 // 노드 복원 지연 시간 (ms)
};
