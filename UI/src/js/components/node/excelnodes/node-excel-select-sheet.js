// node-excel-select-sheet.js
// 엑셀 시트 선택 노드 정의

(function () {
    if (!window.NodeManager) {
        return;
    }

    window.NodeManager.registerNodeType('excel-select-sheet', {
        /**
         * 엑셀 시트 선택 노드 내용 생성
         * @param {Object} nodeData
         */
        renderContent(nodeData) {
            // 노드 아이콘은 node-icons.config.js에서 중앙 관리
            const NodeIcons = window.NodeIcons || {};
            const icon = NodeIcons.getIcon('excel-select-sheet', nodeData) || NodeIcons.icons?.default || '📋';

            const sheetName = nodeData.sheet_name || nodeData.sheet_index || '시트 미선택';

            return `
                <div class="node-input"></div>
                <div class="node-content">
                    <div class="node-icon-box">
                        <div class="node-icon">${icon}</div>
                    </div>
                    <div class="node-text-area">
                        <div class="node-title">${this.escapeHtml(nodeData.title || '엑셀 시트 선택')}</div>
                        <div class="node-description">${this.escapeHtml(sheetName)}</div>
                    </div>
                </div>
                <div class="node-output"></div>
                <div class="node-settings" data-node-id="${nodeData.id}">⚙</div>
            `;
        }
    });
})();
