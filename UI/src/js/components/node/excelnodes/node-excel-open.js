// node-excel-open.js
// 엑셀 열기 노드 정의

(function () {
    if (!window.NodeManager) {
        return;
    }

    window.NodeManager.registerNodeType('excel-open', {
        /**
         * 엑셀 열기 노드 내용 생성
         * @param {Object} nodeData
         */
        renderContent(nodeData) {
            // 노드 아이콘은 node-icons.config.js에서 중앙 관리
            const NodeIcons = window.NodeIcons || {};
            const icon = NodeIcons.getIcon('excel-open', nodeData) || NodeIcons.icons?.default || '📊';

            const filePath = nodeData.file_path || '파일 미선택';

            return `
                <div class="node-input"></div>
                <div class="node-content">
                    <div class="node-icon-box">
                        <div class="node-icon">${icon}</div>
                    </div>
                    <div class="node-text-area">
                        <div class="node-title">${this.escapeHtml(nodeData.title || '엑셀 열기')}</div>
                        <div class="node-description">${this.escapeHtml(filePath)}</div>
                    </div>
                </div>
                <div class="node-output"></div>
                <div class="node-settings" data-node-id="${nodeData.id}">⚙</div>
            `;
        }
    });
})();
