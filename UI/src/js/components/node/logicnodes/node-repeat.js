// node-repeat.js
// 반복 노드 정의 (아래 연결점 포함)

// NodeManager가 로드될 때까지 기다린 후 등록
(function registerRepeatNode() {
    // 번역 함수 가져오기 (동적 import)
    let t = null;
    (async () => {
        try {
            const i18nModule = await import('../../../utils/i18n.js');
            if (i18nModule && typeof i18nModule.t === 'function') {
                t = i18nModule.t;
            }
        } catch (e) {
            console.warn('[node-repeat] i18n 모듈 로드 실패:', e);
        }
    })();

    // 번역 텍스트 가져오기 헬퍼 함수
    const getText = (key, defaultValue) => {
        if (t && typeof t === 'function') {
            try {
                const translated = t(`node.repeat.${key}`);
                return translated && translated !== `node.repeat.${key}` ? translated : defaultValue;
            } catch (e) {
                return defaultValue;
            }
        }
        return defaultValue;
    };

    // window.NodeManager가 정의될 때까지 대기
    const checkAndRegister = () => {
        if (window.NodeManager && window.NodeManager.registerNodeType) {
            window.NodeManager.registerNodeType('repeat', {
                renderContent(nodeData) {
                    const icon = window.NodeIcons ? window.NodeIcons.getIcon('repeat', nodeData) : '🔄';
                    // 파라미터는 nodeData에 직접 저장됨 (nodeData.repeat_count)
                    const repeatCount = nodeData.repeat_count || nodeData.parameters?.repeat_count || 1;
                    const repeatCountLabel = getText('repeatCount', '반복 횟수');
                    const outputLabel = getText('outputLabel', '출력');
                    const repeatLabel = getText('repeatLabel', '반복');
                    const connectNodesBelow = getText('connectNodesBelow', '반복할 노드들을 연결');
                    const defaultDescription = getText('description', '반복 실행');

                    return `
                        <div class="node-input"></div>
                        <div class="node-content">
                            <div class="node-icon-box">
                                <div class="node-icon">${icon}</div>
                            </div>
                            <div class="node-text-area">
                                <div class="node-title">${this.escapeHtml(nodeData.title)}</div>
                                <div class="node-description">${this.escapeHtml(nodeData.description || defaultDescription)}</div>
                                <div class="node-parameter-display">${repeatCountLabel}: ${repeatCount}</div>
                            </div>
                        </div>
                        <div class="node-output" title="${outputLabel}"></div>
                        <div class="node-bottom-output" title="${connectNodesBelow}">
                            <div class="bottom-output-dot">
                                <span class="output-symbol">↓</span>
                            </div>
                            <span class="bottom-output-label">${repeatLabel}</span>
                        </div>
                        <div class="node-settings">⚙</div>
                    `;
                }
            });
            console.log('[node-repeat] 반복 노드 타입 등록 완료');
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
                        console.error('[node-repeat] NodeManager를 찾을 수 없습니다.');
                    }
                };
                retry();
            }
        }
    };

    // 즉시 시도
    checkAndRegister();
})();
