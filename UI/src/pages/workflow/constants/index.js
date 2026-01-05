/**
 * 워크플로우 관련 상수 모음
 * 모든 상수를 한 곳에서 export하여 사용합니다.
 */

import { TIMING_CONSTANTS } from './timing-constants.js';
import { SIZE_CONSTANTS } from './size-constants.js';
import { STYLE_CONSTANTS } from './style-constants.js';
import { UNDO_REDO_CONSTANTS } from './undo-redo-constants.js';

// 모든 상수를 re-export
export { TIMING_CONSTANTS, SIZE_CONSTANTS, STYLE_CONSTANTS, UNDO_REDO_CONSTANTS };

// 모든 상수를 하나의 객체로도 export (선택적 사용)
export const CONSTANTS = {
    TIMING: TIMING_CONSTANTS,
    SIZE: SIZE_CONSTANTS,
    STYLE: STYLE_CONSTANTS,
    UNDO_REDO: UNDO_REDO_CONSTANTS
};
