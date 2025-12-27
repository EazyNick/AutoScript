// node-condition.js
// 조건 노드 정의 (True / False 출력 두 개)

// NodeManager가 로드될 때까지 기다린 후 등록
(function registerConditionNode() {
    // window.NodeManager가 정의될 때까지 대기
    const checkAndRegister = () => {
        if (window.NodeManager && window.NodeManager.registerNodeType) {
            window.NodeManager.registerNodeType('condition', {
                renderContent(nodeData) {
                    const icon = window.NodeIcons ? window.NodeIcons.getIcon('condition', nodeData) : '🔐';
                    return `
                        <div class="node-input"></div>
                        <div class="node-content">
                            <div class="node-icon-box">
                                <div class="node-icon">${icon}</div>
                            </div>
                            <div class="node-text-area">
                                <div class="node-title">${this.escapeHtml(nodeData.title)}</div>
                                <div class="node-description">${this.escapeHtml(nodeData.description || '조건을 확인합니다')}</div>
                            </div>
                        </div>
                        <div class="node-outputs">
                            <div class="node-output true-output" title="True - 조건이 참일 때 실행">
                                <div class="output-dot true-dot">
                                    <span class="output-symbol">T</span>
                                </div>
                                <span class="output-label">True</span>
                            </div>
                            <div class="node-output false-output" title="False - 조건이 거짓일 때 실행">
                                <div class="output-dot false-dot">
                                    <span class="output-symbol">F</span>
                                </div>
                                <span class="output-label">False</span>
                            </div>
                        </div>
                        <div class="node-settings">⚙</div>
                    `;
                }
            });
            console.log('[node-condition] 조건 노드 타입 등록 완료');
        } else {
            // NodeManager가 아직 로드되지 않았으면 재시도
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', checkAndRegister);
            } else {
                // DOM이 이미 로드되었으면 짧은 지연 후 재시도 (최대 10번)
                let retryCount = 0;
                const maxRetries = 10;
                const retry = () => {
                    if (window.NodeManager && window.NodeManager.registerNodeType) {
                        checkAndRegister();
                    } else if (retryCount < maxRetries) {
                        retryCount++;
                        setTimeout(retry, 100);
                    } else {
                        console.error('[node-condition] NodeManager를 찾을 수 없습니다.');
                    }
                };
                retry();
            }
        }
    };

    // 즉시 시도
    checkAndRegister();
})();
