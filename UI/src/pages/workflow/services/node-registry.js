/**
 * 노드 레지스트리 서비스
 *
 * 서버에서 노드 설정을 가져와서 노드 타입을 동적으로 등록하고
 * 각 노드의 스크립트를 동적으로 로드합니다.
 */

// 폴백 설정 (서버에서 가져오기 실패 시 사용)
const FALLBACK_NODES_CONFIG = {
    start: {
        label: '시작 노드',
        title: '시작',
        description: '워크플로우의 시작점입니다.',
        script: 'node-start.js',
        isBoundary: true,
        category: 'system'
    }
};

export class NodeRegistry {
    constructor() {
        this.loadedScripts = new Set();
        this.nodeConfigs = null; // 서버에서 로드될 때까지 null
    }

    /**
     * 서버에서 노드 설정 가져오기
     * @returns {Promise<Object>}
     */
    async loadNodeConfigs() {
        try {
            const response = await fetch('/api/config/nodes');
            if (response.ok) {
                const result = await response.json();
                // 변경된 응답 형식: {success: true, message: "...", data: {nodes: {...}}}
                const nodes = result.data?.nodes || result.nodes || {};
                this.nodeConfigs = nodes;
                return this.nodeConfigs;
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.warn('[NodeRegistry] 서버에서 노드 설정 로드 실패, 폴백 사용:', error);
            this.nodeConfigs = FALLBACK_NODES_CONFIG;
            return this.nodeConfigs;
        }
    }

    /**
     * 노드 설정 가져오기 (로드되지 않았으면 로드)
     * @returns {Promise<Object>}
     */
    async getNodeConfigs() {
        if (!this.nodeConfigs) {
            await this.loadNodeConfigs();
        }
        return this.nodeConfigs;
    }

    /**
     * 모든 노드 스크립트 동적 로드
     * @returns {Promise<void>}
     */
    async loadAllNodeScripts() {
        const configs = await this.getNodeConfigs();
        const nodeTypes = Object.keys(configs);
        const loadPromises = nodeTypes.map((nodeType) => this.loadNodeScript(nodeType));
        await Promise.all(loadPromises);
    }

    /**
     * 경계 노드(시작/종료 노드) 스크립트만 먼저 로드
     * 성능 최적화: 시작 노드만 필요한 경우 모든 노드를 로드하지 않음
     * @returns {Promise<void>}
     */
    async loadBoundaryNodeScripts() {
        const configs = await this.getNodeConfigs();
        const boundaryNodeTypes = Object.keys(configs).filter((nodeType) => {
            const config = configs[nodeType];
            return config?.isBoundary === true;
        });
        const loadPromises = boundaryNodeTypes.map((nodeType) => this.loadNodeScript(nodeType));
        await Promise.all(loadPromises);
    }

    /**
     * 특정 노드 타입의 스크립트 로드
     *
     * 서버에서 정적 파일이 /static 경로로 마운트되어 있으므로,
     * 절대 경로를 사용하여 페이지 위치에 관계없이 올바른 경로로 요청합니다.
     *
     * @param {string} nodeType - 노드 타입
     * @returns {Promise<void>}
     */
    async loadNodeScript(nodeType) {
        const configs = await this.getNodeConfigs();
        const config = configs[nodeType];
        // script 필드: 서버의 nodes_config.py에서 정의된 JavaScript 파일명
        // 예: "script": "node-click.js" → /static/js/components/node/node-click.js 파일을 로드
        // 이 파일이 없으면 해당 노드를 UI에서 렌더링할 수 없음
        if (!config) {
            console.warn(
                `[NodeRegistry] 노드 타입 '${nodeType}'가 등록되지 않았습니다. ` +
                    '서버의 nodes_config.py에 노드 설정을 추가하세요.'
            );
            return;
        }
        if (!config.script) {
            console.warn(
                `[NodeRegistry] 노드 타입 '${nodeType}'의 'script' 필드가 설정되지 않았습니다. ` +
                    "서버의 nodes_config.py에서 'script' 필드를 확인하세요."
            );
            return;
        }

        // 이미 로드된 스크립트는 건너뛰기
        if (this.loadedScripts.has(config.script)) {
            return;
        }

        // 절대 경로 사용: 서버에서 /static으로 마운트된 정적 파일 경로
        // 상대 경로를 사용하면 페이지 위치(/workflow 등)에 따라 경로가 달라져서 404 에러 발생
        const scriptPath = `/static/js/components/node/${config.script}`;

        return new Promise((resolve, reject) => {
            // 동적 스크립트 로드
            const script = document.createElement('script');
            script.src = scriptPath;
            script.type = 'module'; // ES6 모듈로 로드

            script.onload = () => {
                this.loadedScripts.add(config.script);
                resolve();
            };

            script.onerror = (error) => {
                console.error(`[NodeRegistry] 노드 스크립트 로드 실패: ${config.script} (경로: ${scriptPath})`, error);
                // 스크립트가 없어도 계속 진행 (사용자가 아직 만들지 않은 경우)
                resolve();
            };

            document.head.appendChild(script);
        });
    }

    /**
     * 노드 설정 가져오기
     * @param {string} nodeType - 노드 타입
     * @returns {Promise<Object|null>}
     */
    async getConfig(nodeType) {
        const configs = await this.getNodeConfigs();
        return configs[nodeType] || null;
    }

    /**
     * 모든 노드 설정 가져오기
     * @returns {Promise<Object>}
     */
    async getAllConfigs() {
        return await this.getNodeConfigs();
    }

    /**
     * 노드 타입 목록 가져오기
     * @returns {Promise<string[]>}
     */
    async getNodeTypes() {
        const configs = await this.getNodeConfigs();
        return Object.keys(configs);
    }
}

// 싱글톤 인스턴스
let nodeRegistryInstance = null;

/**
 * 노드 레지스트리 인스턴스 가져오기
 * @returns {NodeRegistry}
 */
export function getNodeRegistry() {
    if (!nodeRegistryInstance) {
        nodeRegistryInstance = new NodeRegistry();
    }
    return nodeRegistryInstance;
}
