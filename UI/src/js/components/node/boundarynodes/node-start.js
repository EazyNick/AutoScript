// node-start.js
// 시작 노드 정의 (출력만 있는 노드)

(function () {
    if (!window.NodeManager) {
        return;
    }

    window.NodeManager.registerNodeType('start', {
        renderContent(nodeData) {
            const icon = window.NodeIcons ? window.NodeIcons.getIcon('start', nodeData) : '▶';
            return `
                <div class="node-content">
                    <div class="node-icon-box">
                        <div class="node-icon">${icon}</div>
                    </div>
                    <div class="node-text-area">
                        <div class="node-title">${this.escapeHtml(nodeData.title || '시작')}</div>
                        <div class="node-description">워크플로우 시작점</div>
                    </div>
                </div>
                <div class="node-output"></div>
            `;
        }
    });
})();
