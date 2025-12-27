// node-process-focus.js
// 프로세스 포커스 노드 정의

(function () {
    if (!window.NodeManager) {
        return;
    }

    window.NodeManager.registerNodeType('process-focus', {
        renderContent(nodeData) {
            const icon = window.NodeIcons ? window.NodeIcons.getIcon('process-focus', nodeData) : '🖥️';
            const processName = nodeData.process_name || '프로세스 미선택';
            const windowTitle = nodeData.window_title || '';
            const displayText = windowTitle ? `${processName} - ${windowTitle}` : processName;

            return `
                <div class="node-input"></div>
                <div class="node-content">
                    <div class="node-icon-box">
                        <div class="node-icon">${icon}</div>
                    </div>
                    <div class="node-text-area">
                        <div class="node-title">${this.escapeHtml(nodeData.title || '프로세스 포커스')}</div>
                        <div class="node-description">${this.escapeHtml(displayText)}</div>
                    </div>
                </div>
                <div class="node-output"></div>
                <div class="node-settings" data-node-id="${nodeData.id}">⚙</div>
            `;
        }
    });
})();
