// node-test-node.js
(function () {
    if (!window.NodeManager) {
        return;
    }

    window.NodeManager.registerNodeType('test-node', {
        /**
         * 노드 내용 생성
         * @param {Object} nodeData - 노드 데이터
         */
        renderContent(nodeData) {
            // 노드 아이콘은 node-icons.config.js에서 중앙 관리
            const NodeIcons = window.NodeIcons || {};
            const icon = NodeIcons.getIcon('test-node', nodeData) || NodeIcons.icons?.default || '⚙';

            return `
                <div class="node-input"></div>
                <div class="node-content">
                    <div class="node-icon-box">
                        <div class="node-icon">${icon}</div>
                    </div>
                    <div class="node-text-area">
                        <div class="node-title">${this.escapeHtml(nodeData.title || 'Test Node')}</div>
                        <div class="node-description">${this.escapeHtml(nodeData.description || 'Test node')}</div>
                    </div>
                </div>
                <div class="node-output"></div>
                <div class="node-settings" data-node-id="${nodeData.id}">⚙</div>
            `;
        }
    });
})();
