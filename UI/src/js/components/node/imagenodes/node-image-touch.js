// node-image-touch.js
// 이미지 터치 노드 정의

(function () {
    if (!window.NodeManager) {
        return;
    }

    window.NodeManager.registerNodeType('image-touch', {
        /**
         * 이미지 터치 노드 내용 생성
         * @param {Object} nodeData
         */
        renderContent(nodeData) {
            const icon = window.NodeIcons ? window.NodeIcons.getIcon('image-touch', nodeData) : '🖼️';
            const folderPath = nodeData.folder_path || '폴더 미선택';
            const imageCount = nodeData.image_count || 0;

            return `
                <div class="node-input"></div>
                <div class="node-content">
                    <div class="node-icon-box">
                        <div class="node-icon">${icon}</div>
                    </div>
                    <div class="node-text-area">
                        <div class="node-title">${this.escapeHtml(nodeData.title || '이미지 터치')}</div>
                        <div class="node-description">${this.escapeHtml(folderPath)}</div>
                        ${imageCount > 0 ? `<div class="node-info">${imageCount}개 이미지</div>` : ''}
                    </div>
                </div>
                <div class="node-output"></div>
                <div class="node-settings" data-node-id="${nodeData.id}">⚙</div>
            `;
        }
    });
})();
