/**
 * 노드 타입 상수 정의
 * 서버에서 노드 설정을 가져와서 동적으로 생성됩니다.
 */

import { getNodeRegistry } from '../services/node-registry.js';

// 동적으로 생성되는 상수들 (서버에서 로드 후 초기화)
export let NODE_TYPES = {};
export let NODE_TYPE_LABELS = {};
// 경계 노드 타입 캐시 (동기적 체크용)
let BOUNDARY_NODE_TYPES = new Set();

/**
 * 서버에서 노드 설정을 가져와서 상수 초기화
 * @returns {Promise<void>}
 */
export async function initializeNodeTypes() {
    const registry = getNodeRegistry();
    const configs = await registry.getAllConfigs();
    const nodeTypes = Object.keys(configs);

    // NODE_TYPES 생성
    NODE_TYPES = {};
    nodeTypes.forEach((type) => {
        // 대문자 상수명 생성 (예: 'image-touch' -> 'IMAGE_TOUCH')
        const constantName = type.toUpperCase().replace(/-/g, '_');
        NODE_TYPES[constantName] = type;
    });

    // NODE_TYPE_LABELS 생성
    NODE_TYPE_LABELS = {};
    // BOUNDARY_NODE_TYPES 생성 (경계 노드 타입 캐시)
    BOUNDARY_NODE_TYPES = new Set();
    nodeTypes.forEach((type) => {
        const config = configs[type];
        NODE_TYPE_LABELS[type] = config?.label || type;
        // 경계 노드 타입 캐시에 추가
        if (config?.isBoundary) {
            BOUNDARY_NODE_TYPES.add(type);
        }
    });
}

/**
 * 시작/종료 노드인지 확인 (비동기)
 * @param {string} type - 노드 타입
 * @returns {Promise<boolean>}
 */
export async function isBoundaryNode(type) {
    const registry = getNodeRegistry();
    const config = await registry.getConfig(type);
    return config?.isBoundary || false;
}

/**
 * 시작/종료 노드인지 확인 (동기, 캐시 사용)
 * @param {string} type - 노드 타입
 * @returns {boolean}
 */
export function isBoundaryNodeSync(type) {
    return BOUNDARY_NODE_TYPES.has(type);
}

// 초기화 (모듈 로드 시 자동 실행)
initializeNodeTypes().catch((err) => {
    console.error('[node-types] 노드 타입 초기화 실패:', err);
});
