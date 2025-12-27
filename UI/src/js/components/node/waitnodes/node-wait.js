// node-wait.js
// 대기 노드 정의 (타이머/딜레이용)

(function () {
    if (!window.NodeManager) {
        return;
    }

    window.NodeManager.registerNodeType('wait', {
        renderContent(nodeData) {
            const icon = window.NodeIcons ? window.NodeIcons.getIcon('wait', nodeData) : '🕐';
            return `
                <div class="node-input"></div>
                <div class="node-content">
                    <div class="node-icon-box">
                        <div class="node-icon">${icon}</div>
                    </div>
                    <div class="node-text-area">
                        <div class="node-title">${this.escapeHtml(nodeData.title || '대기')}</div>
                        <div class="node-description">지정된 시간 대기</div>
                    </div>
                </div>
                <div class="node-output"></div>
                <div class="node-settings">⚙</div>
            `;
        }
    });
})();
