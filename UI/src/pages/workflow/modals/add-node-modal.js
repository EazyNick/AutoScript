/**
 * 노드 추가 모달 관리
 * 노드 추가 모달의 UI 생성 및 이벤트 처리를 담당합니다.
 */

import { NODE_TYPES, NODE_TYPE_LABELS } from '../constants/node-types.js';
import { getDefaultTitle, getDefaultDescription } from '../config/node-defaults.js';
import { NodeValidationUtils } from '../utils/node-validation-utils.js';
import { getNodeRegistry } from '../services/node-registry.js';
import { getDetailNodeTypes, getDetailNodeConfig } from '../config/action-node-types.js';
import { generateParameterForm, extractParameterValues } from '../utils/parameter-form-generator.js';
import { generatePreviewFromSchema, collectPreviousNodeOutput } from '../config/node-preview-generator.js';

export class AddNodeModal {
    constructor(workflowPage) {
        this.workflowPage = workflowPage;
    }

    /**
     * 노드 추가 모달 표시
     */
    async show() {
        const modalManager = this.workflowPage.getModalManager();
        if (!modalManager) {
            console.error('ModalManager를 사용할 수 없습니다.');
            return;
        }

        // 로딩 UI 표시
        const loadingContent = `
            <h3>노드 추가</h3>
            <div class="node-loading-container" style="text-align: center; padding: 40px 20px;">
                <div class="loading-spinner" style="display: inline-block; width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <p style="margin-top: 20px; color: #666;">노드 목록을 불러오는 중...</p>
            </div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;
        modalManager.show(loadingContent);

        try {
            const content = await this.generateModalContent();
            modalManager.show(content);
            this.setupEventListeners();
        } catch (error) {
            console.error('[AddNodeModal] 노드 목록 로드 실패:', error);
            const errorContent = `
                <h3>노드 추가</h3>
                <div style="text-align: center; padding: 40px 20px;">
                    <p style="color: #e74c3c;">노드 목록을 불러오는 중 오류가 발생했습니다.</p>
                    <button id="retry-load-nodes" class="btn btn-primary" style="margin-top: 20px;">다시 시도</button>
                    <button id="close-modal-on-error" class="btn btn-secondary" style="margin-top: 10px;">닫기</button>
                </div>
            `;
            modalManager.show(errorContent);

            // 다시 시도 버튼 이벤트
            document.getElementById('retry-load-nodes')?.addEventListener('click', () => {
                this.show();
            });
            document.getElementById('close-modal-on-error')?.addEventListener('click', () => {
                modalManager.hide();
            });
        }
    }

    /**
     * 모달 HTML 콘텐츠 생성
     */
    async generateModalContent() {
        const registry = getNodeRegistry();
        const nodeTypeOptionsPromises = Object.entries(NODE_TYPE_LABELS).map(async ([value, label]) => {
            const config = await registry.getConfig(value);
            // 경계 노드는 선택 목록에서 제외 (자동 생성되므로)
            if (config && config.isBoundary) {
                return '';
            }
            return `<option value="${value}">${label}</option>`;
        });
        const nodeTypeOptions = (await Promise.all(nodeTypeOptionsPromises)).filter((opt) => opt !== '').join('');

        return `
            <h3>노드 추가</h3>
            <div class="form-group">
                <label for="node-type">노드 타입:</label>
                <select id="node-type">
                    ${nodeTypeOptions}
                </select>
            </div>
            <div class="form-group" id="detail-node-type-group" style="display: block;">
                <label for="detail-node-type">상세 노드 타입:</label>
                <select id="detail-node-type">
                    <option value="" selected>없음 (기본 동작)</option>
                </select>
                <small style="color: #666; font-size: 12px; display: block; margin-top: 4px;">이 노드가 수행할 상세 동작을 선택하세요.</small>
            </div>
            <div class="form-group">
                <label for="node-title">노드 제목:</label>
                <input type="text" id="node-title" placeholder="노드 제목을 입력하세요">
            </div>
            <div class="form-group">
                <label for="node-description">설명:</label>
                <textarea id="node-description" rows="3" placeholder="노드에 대한 설명을 입력하세요 (선택사항)" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"></textarea>
            </div>
            <div class="form-group" id="node-custom-settings" style="display: none;">
                <!-- 동적으로 생성되는 노드별 특수 설정 영역 -->
            </div>
            <div class="form-actions">
                <button id="add-node-confirm" class="btn btn-primary">추가</button>
                <button id="add-node-cancel" class="btn btn-secondary">취소</button>
            </div>
        `;
    }

    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        const modalManager = this.workflowPage.getModalManager();
        const nodeTypeSelect = document.getElementById('node-type');
        const customSettings = document.getElementById('node-custom-settings');
        const registry = getNodeRegistry();

        // 상세 노드 타입 선택 그룹
        const detailNodeTypeGroup = document.getElementById('detail-node-type-group');
        const detailNodeTypeSelect = document.getElementById('detail-node-type');

        // 노드 타입 변경 시 특수 설정 표시/숨김 (먼저 정의하여 다른 함수에서 사용 가능하도록)
        let updateCustomSettings = null;
        if (nodeTypeSelect && customSettings) {
            updateCustomSettings = async () => {
                console.log('[AddNodeModal] updateCustomSettings 호출됨');
                const selectedType = nodeTypeSelect.value;
                console.log('[AddNodeModal] selectedType:', selectedType);

                const config = await registry.getConfig(selectedType);

                // 디버깅: config 확인
                console.log('[AddNodeModal] updateCustomSettings:', {
                    selectedType,
                    hasConfig: !!config,
                    configKeys: config ? Object.keys(config) : [],
                    hasParameters: !!config?.parameters,
                    parameters: config?.parameters,
                    configFull: config
                });

                // 상세 노드 타입 설정이 있는지 확인
                const currentDetailNodeType = detailNodeTypeSelect ? detailNodeTypeSelect.value : '';
                const tempDiv = document.createElement('div');
                const detailNodeTypeSettings = await this.updateDetailNodeTypeSettings(
                    selectedType,
                    currentDetailNodeType,
                    tempDiv
                );

                // process-focus 노드의 경우 파라미터 폼을 생성하지 않고 프로세스 선택 UI만 표시
                if (selectedType === 'process-focus') {
                    // 프로세스 포커스 노드: 프로세스 선택 UI
                    const processFocusHtml = `
                        <label for="node-process-select">프로세스 선택:</label>
                        <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                            <select id="node-process-select" style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                                <option value="">프로세스를 선택하세요</option>
                            </select>
                            <button type="button" id="refresh-processes-btn" class="btn btn-secondary">새로고침</button>
                        </div>
                        <input type="hidden" id="node-process-id">
                        <input type="hidden" id="node-process-hwnd">
                        <input type="hidden" id="node-process-name">
                        <input type="hidden" id="node-window-title">
                        <small style="color: #666; font-size: 12px;">화면에 보이는 프로세스만 표시됩니다. 선택한 프로세스가 실행 시 화면 최상단에 포커스됩니다.</small>
                    `;
                    customSettings.innerHTML = detailNodeTypeSettings + processFocusHtml;
                    customSettings.style.display = 'block';

                    // 프로세스 목록 로드
                    this.loadProcessListForAddModal();

                    // 새로고침 버튼 이벤트
                    const refreshBtn = document.getElementById('refresh-processes-btn');
                    if (refreshBtn) {
                        refreshBtn.addEventListener('click', () => {
                            refreshBtn.disabled = true;
                            refreshBtn.textContent = '새로고침 중...';
                            this.loadProcessListForAddModal().finally(() => {
                                refreshBtn.disabled = false;
                                refreshBtn.textContent = '새로고침';
                            });
                        });
                    }

                    // 프로세스 선택 이벤트
                    const processSelect = document.getElementById('node-process-select');
                    if (processSelect) {
                        processSelect.addEventListener('change', (e) => {
                            const selectedValue = e.target.value;
                            if (selectedValue) {
                                const [processId, hwnd] = selectedValue.split('|');
                                const option = e.target.options[e.target.selectedIndex];
                                const processName = option.dataset.processName || '';
                                const windowTitle = option.dataset.windowTitle || '';

                                document.getElementById('node-process-id').value = processId;
                                document.getElementById('node-process-hwnd').value = hwnd;
                                document.getElementById('node-process-name').value = processName;
                                document.getElementById('node-window-title').value = windowTitle;
                            } else {
                                document.getElementById('node-process-id').value = '';
                                document.getElementById('node-process-hwnd').value = '';
                                document.getElementById('node-process-name').value = '';
                                document.getElementById('node-window-title').value = '';
                            }
                        });
                    }
                    return; // process-focus 노드는 여기서 종료
                }

                // 파라미터 기반 폼 생성
                let parameterFormHtml = '';

                // 상세 노드 타입이 선택된 경우, 상세 노드 타입의 파라미터 우선 사용
                let parametersToUse = null;
                if (
                    currentDetailNodeType &&
                    config &&
                    config.detailTypes &&
                    config.detailTypes[currentDetailNodeType]
                ) {
                    const detailConfig = config.detailTypes[currentDetailNodeType];
                    if (detailConfig.parameters) {
                        parametersToUse = detailConfig.parameters;
                    }
                }

                // 상세 노드 타입에 파라미터가 없으면 노드 레벨 파라미터 사용
                if (!parametersToUse && config && config.parameters) {
                    parametersToUse = config.parameters;
                }

                let parameterFormResult = { html: '', buttons: [] };
                if (parametersToUse) {
                    // excel-close 노드의 execution_id 기본값 설정
                    const defaultValues = {};
                    if (selectedType === 'excel-close' && parametersToUse.execution_id) {
                        // 이전 노드가 있는지 확인하고 기본값 설정
                        const nodeManager = this.workflowPage.getNodeManager();
                        if (nodeManager) {
                            const allNodes = nodeManager.getAllNodes();
                            // 마지막 노드가 엑셀 열기 노드인지 확인
                            if (allNodes.length > 0) {
                                const lastNode = allNodes[allNodes.length - 1];
                                const lastNodeData = nodeManager.nodeData?.[lastNode.id];
                                if (lastNodeData?.type === 'excel-open') {
                                    defaultValues.execution_id = 'outdata.output.execution_id';
                                } else {
                                    // 이전 노드가 없거나 엑셀 열기 노드가 아니어도 기본값 설정
                                    defaultValues.execution_id = 'outdata.output.execution_id';
                                }
                            } else {
                                // 노드가 없어도 기본값 설정
                                defaultValues.execution_id = 'outdata.output.execution_id';
                            }
                        } else {
                            // nodeManager가 없어도 기본값 설정
                            defaultValues.execution_id = 'outdata.output.execution_id';
                        }
                    }
                    parameterFormResult = generateParameterForm(parametersToUse, 'node-', defaultValues, {});
                    parameterFormHtml = parameterFormResult.html;
                    console.log('[AddNodeModal] 파라미터 폼 생성:', {
                        nodeType: selectedType,
                        parametersToUse: Object.keys(parametersToUse),
                        formHtmlLength: parameterFormHtml.length,
                        buttons: parameterFormResult.buttons
                    });
                } else {
                    console.log('[AddNodeModal] 파라미터 없음:', {
                        nodeType: selectedType,
                        hasConfig: !!config,
                        hasParameters: !!config?.parameters,
                        hasDetailTypes: !!config?.detailTypes,
                        currentDetailNodeType
                    });
                }

                // 파라미터 폼이 있으면 무조건 표시 (최우선)
                if (parameterFormHtml) {
                    customSettings.innerHTML = detailNodeTypeSettings + parameterFormHtml;
                    customSettings.style.display = 'block';

                    // 파일/폴더 선택 버튼 이벤트 리스너 설정
                    if (parameterFormResult.buttons && parameterFormResult.buttons.length > 0) {
                        // DOM이 업데이트된 후에 버튼을 찾아야 하므로 약간의 지연
                        setTimeout(() => {
                            parameterFormResult.buttons.forEach(({ buttonId, fieldId, type }) => {
                                const btn = document.getElementById(buttonId);
                                if (btn) {
                                    console.log(
                                        '[AddNodeModal] 버튼 찾음:',
                                        buttonId,
                                        'fieldId:',
                                        fieldId,
                                        'type:',
                                        type
                                    );
                                    // 기존 이벤트 리스너 제거 후 새로 추가
                                    const newBtn = btn.cloneNode(true);
                                    btn.parentNode.replaceChild(newBtn, btn);
                                    newBtn.addEventListener('click', () => {
                                        console.log('[AddNodeModal] 버튼 클릭:', buttonId, 'type:', type);
                                        if (type === 'folder') {
                                            this.handleFolderSelection(fieldId);
                                        } else {
                                            this.handleFileSelection(fieldId);
                                        }
                                    });
                                } else {
                                    console.warn('[AddNodeModal] 버튼을 찾을 수 없음:', buttonId);
                                }
                            });
                        }, 50); // 지연 시간 증가
                    }
                    return; // 파라미터 폼이 있으면 여기서 종료
                } else {
                    // 파라미터 폼도 없고 특수 노드도 아닌 경우
                    if (detailNodeTypeSettings) {
                        customSettings.innerHTML = detailNodeTypeSettings;
                        customSettings.style.display = 'block';
                    } else {
                        customSettings.innerHTML = '';
                        customSettings.style.display = 'none';
                    }
                }

                // 기본 제목 설정 (서버의 nodes_config.py의 title 사용)
                const titleInput = document.getElementById('node-title');
                if (titleInput && config) {
                    // 노드 타입 변경 시 항상 서버 설정의 title로 초기화
                    titleInput.value = config.title || getDefaultTitle(selectedType);
                } else if (titleInput) {
                    // config가 없어도 기본값 설정
                    titleInput.value = getDefaultTitle(selectedType);
                }

                // 기본 설명 설정 (서버의 nodes_config.py의 description 사용)
                const descriptionInput = document.getElementById('node-description');
                if (descriptionInput && config) {
                    // 노드 타입 변경 시 항상 서버 설정의 description으로 초기화
                    descriptionInput.value = config.description || getDefaultDescription(selectedType);
                } else if (descriptionInput) {
                    // config가 없어도 기본값 설정
                    descriptionInput.value = getDefaultDescription(selectedType);
                }
            };

            nodeTypeSelect.addEventListener('change', updateCustomSettings);
            // 초기 설정
            updateCustomSettings().catch((err) => console.error('updateCustomSettings error:', err));
        }

        // 노드 타입 변경 시 상세 노드 타입 선택란 업데이트
        if (nodeTypeSelect && detailNodeTypeGroup && detailNodeTypeSelect) {
            const updateDetailNodeTypeSelect = async () => {
                const selectedType = nodeTypeSelect.value;
                const registry = getNodeRegistry();
                const config = await registry.getConfig(selectedType);

                // 경계 노드(start, end)는 상세 노드 타입 선택란을 표시하지 않음
                if (config && config.isBoundary) {
                    detailNodeTypeGroup.style.display = 'none';
                    return;
                }

                // 경계 노드가 아니면 항상 상세 노드 타입 선택란 표시
                detailNodeTypeGroup.style.display = 'block';

                const detailNodeTypes = await getDetailNodeTypes(selectedType);
                const detailNodeKeys = Object.keys(detailNodeTypes);

                // 상세 노드 타입 옵션 생성 (항상 "없음" 옵션 포함, 기본 선택)
                detailNodeTypeSelect.innerHTML = '<option value="" selected>없음 (기본 동작)</option>';

                // 상세 노드 타입이 있으면 추가
                detailNodeKeys.forEach((key) => {
                    const detailConfig = detailNodeTypes[key];
                    const label = detailConfig.label || key;
                    const icon = detailConfig.icon || '';
                    const option = document.createElement('option');
                    option.value = key;
                    option.textContent = `${icon} ${label}`;
                    detailNodeTypeSelect.appendChild(option);
                });

                // 기본값으로 "없음" 선택 보장
                detailNodeTypeSelect.value = '';
            };

            // 상세 노드 타입 변경 시 특수 설정 업데이트
            const handleDetailNodeTypeChange = () => {
                // updateCustomSettings를 다시 호출하여 상세 노드 타입 설정을 반영
                if (updateCustomSettings) {
                    updateCustomSettings().catch((err) => console.error('updateCustomSettings error:', err));
                }
            };

            nodeTypeSelect.addEventListener('change', () => {
                updateDetailNodeTypeSelect().catch((err) => console.error('updateDetailNodeTypeSelect error:', err));
                // 노드 타입 변경 시 상세 노드 타입도 초기화
                detailNodeTypeSelect.value = '';
                // updateCustomSettings 호출
                if (updateCustomSettings) {
                    updateCustomSettings().catch((err) => console.error('updateCustomSettings error:', err));
                }
            });

            detailNodeTypeSelect.addEventListener('change', handleDetailNodeTypeChange);

            // 초기 설정
            updateDetailNodeTypeSelect().catch((err) => console.error('updateDetailNodeTypeSelect error:', err));
        }

        // 폴더 선택 버튼은 동적으로 생성되므로 updateCustomSettings에서 처리됨

        // 확인 버튼
        const confirmBtn = document.getElementById('add-node-confirm');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                this.handleAddNode();
            });
        }

        // 취소 버튼
        const cancelBtn = document.getElementById('add-node-cancel');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                if (modalManager) {
                    modalManager.close();
                }
            });
        }
    }

    /**
     * 폴더 선택 처리
     * @param {string} fieldId - 폴더 경로 입력 필드 ID
     */
    async handleFolderSelection(fieldId) {
        if (!fieldId) {
            console.warn('[AddNodeModal] fieldId가 제공되지 않았습니다.');
            return;
        }
        const btn = document.getElementById(`${fieldId}-browse-btn`);
        if (!btn) {
            console.warn(`폴더 선택 버튼을 찾을 수 없습니다: ${fieldId}-browse-btn`);
            return;
        }
        const originalText = btn.textContent;

        try {
            btn.disabled = true;
            btn.textContent = '폴더 선택 중...';

            const apiBaseUrl = window.API_BASE_URL || 'http://localhost:8000';
            const response = await fetch(`${apiBaseUrl}/api/folder/select`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const result = await response.json();

            // 변경된 응답 형식: {success: true/false, message: "...", data: {folder_path: "..."}}
            if (result.success && result.data?.folder_path) {
                const folderPath = result.data.folder_path;
                const inputField = document.getElementById(fieldId);
                if (inputField) {
                    inputField.value = folderPath;

                    // 이미지 개수 확인 (folder_path인 경우만)
                    if (fieldId.includes('folder_path')) {
                        try {
                            const imageListResponse = await fetch(
                                `${apiBaseUrl}/api/images/list?folder_path=${encodeURIComponent(folderPath)}`
                            );
                            const imageListResult = await imageListResponse.json();
                            // 변경된 응답 형식: {success: true, message: "...", data: [...], count: N}
                            if (imageListResult.success) {
                                const count = imageListResult.count || imageListResult.data?.length || 0;
                                const infoText = count > 0 ? `${count}개 이미지 파일 발견` : '이미지 파일 없음';
                                inputField.title = infoText;
                            }
                        } catch (e) {
                            console.warn('이미지 목록 조회 실패:', e);
                        }
                    }
                }
                // 성공 시 팝업 표시하지 않음
            } else if (!result.success) {
                // 실패 시에만 팝업 표시
                const errorMsg = result.message || '폴더 선택에 실패했습니다.';
                alert(errorMsg);
            }
        } catch (error) {
            console.error('폴더 선택 실패:', error);
            alert('폴더 선택에 실패했습니다. 서버가 실행 중인지 확인하세요.');
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }

    /**
     * 파일 선택 처리
     * @param {string} fieldId - 파일 경로 입력 필드 ID
     */
    async handleFileSelection(fieldId) {
        const btn = document.getElementById(`${fieldId}-browse-btn`);
        if (!btn) {
            console.warn(`파일 선택 버튼을 찾을 수 없습니다: ${fieldId}-browse-btn`);
            return;
        }
        const originalText = btn.textContent;

        try {
            btn.disabled = true;
            btn.textContent = '파일 선택 중...';

            const apiBaseUrl = window.API_BASE_URL || 'http://localhost:8000';
            const response = await fetch(`${apiBaseUrl}/api/file/select`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const result = await response.json();

            // 변경된 응답 형식: {success: true/false, message: "...", data: {file_path: "..."}}
            if (result.success && result.data?.file_path) {
                const filePath = result.data.file_path;
                const inputField = document.getElementById(fieldId);
                if (inputField) {
                    inputField.value = filePath;
                }
                // 성공 시 팝업 표시하지 않음
            } else if (!result.success) {
                // 실패 시에만 팝업 표시
                const errorMsg = result.message || '파일 선택에 실패했습니다.';
                alert(errorMsg);
            }
        } catch (error) {
            console.error('파일 선택 실패:', error);
            alert('파일 선택에 실패했습니다. 서버가 실행 중인지 확인하세요.');
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }

    /**
     * 노드 추가 처리
     */
    async handleAddNode() {
        const nodeType = document.getElementById('node-type').value;
        const nodeManager = this.workflowPage.getNodeManager();

        // 시작/종료 노드 개수 검증
        const validation = NodeValidationUtils.validateBoundaryNodeCount(nodeType, nodeManager);
        if (!validation.canAdd) {
            const modalManager = this.workflowPage.getModalManager();
            if (modalManager) {
                modalManager.showAlert('노드 추가 불가', validation.message);
            } else {
                alert(validation.message);
            }
            return;
        }

        let nodeTitle = document.getElementById('node-title').value.trim();
        let nodeDescription = document.getElementById('node-description').value.trim();

        // 서버의 nodes_config.py에서 기본 제목 가져오기
        const registry = getNodeRegistry();
        const config = await registry.getConfig(nodeType);
        const defaultTitle = config?.title || getDefaultTitle(nodeType);
        const defaultDescription = config?.description || getDefaultDescription(nodeType);

        // 제목이 비어있으면 서버 설정의 title 사용
        if (!nodeTitle) {
            nodeTitle = defaultTitle;
        }

        // 설명이 비어있으면 서버 설정의 description 사용
        if (!nodeDescription) {
            nodeDescription = defaultDescription;
        }

        // 상세 노드 타입 가져오기
        const detailNodeTypeSelect = document.getElementById('detail-node-type');
        const detailNodeType = detailNodeTypeSelect ? detailNodeTypeSelect.value : '';

        // 경계 노드인지 확인하여 ID 생성
        const { isBoundaryNodeSync } = await import('../constants/node-types.js');
        const isBoundary = isBoundaryNodeSync(nodeType);

        // 노드 ID 생성: 타입과 타임스탬프를 포함하여 더 명확하게 식별 가능하도록
        let nodeId;
        if (isBoundary) {
            if (nodeType === 'start') {
                nodeId = 'start';
            } else {
                // 경계 노드: 타입_타임스탬프 형식
                nodeId = `${nodeType}_${Date.now()}`;
            }
        } else {
            // 일반 노드: 타입_타임스탬프 형식으로 생성하여 타입을 바로 알 수 있도록
            const shortType = nodeType.replace(/-/g, '_'); // 하이픈을 언더스코어로 변환
            nodeId = `${shortType}_${Date.now()}`;
        }

        const nodeData = {
            id: nodeId,
            type: nodeType,
            title: nodeTitle,
            description: nodeDescription,
            x: Math.random() * 400 + 100,
            y: Math.random() * 300 + 100
        };

        // 상세 노드 타입이 선택된 경우 추가
        if (detailNodeType) {
            nodeData.action_node_type = detailNodeType;

            // 상세 노드 타입의 파라미터 추출
            const detailConfig = config?.detailTypes?.[detailNodeType];
            if (detailConfig?.parameters) {
                const paramValues = extractParameterValues(detailConfig.parameters, 'node-');
                Object.assign(nodeData, paramValues);
            }
        }

        // 노드 레벨 파라미터 추출 (상세 노드 타입이 없거나 상세 노드 타입에 파라미터가 없는 경우)
        if (config?.parameters && (!detailNodeType || !config?.detailTypes?.[detailNodeType]?.parameters)) {
            const paramValues = extractParameterValues(config.parameters, 'node-');
            Object.assign(nodeData, paramValues);
        }

        // WorkflowPage의 createNodeFromData 메서드 호출
        const createdNodeElement = this.workflowPage.createNodeFromData(nodeData);

        // 조건 노드인 경우 이전 노드의 출력을 compare_value에 설정
        if (nodeType === 'condition' && createdNodeElement) {
            await this.setConditionNodeDefaultValue(createdNodeElement, nodeData);
        }

        const modalManager = this.workflowPage.getModalManager();
        if (modalManager) {
            modalManager.close();
        }

        // 노드 생성 후 자동 저장
        try {
            await this.workflowPage.saveWorkflow({ useToast: true });
        } catch (error) {
            console.error('노드 생성 후 자동 저장 실패:', error);
            // 저장 실패해도 노드는 생성되었으므로 사용자에게 알리지 않음
        }
    }

    /**
     * 조건 노드의 기본값 설정 (이전 노드의 출력을 compare_value에 설정)
     */
    async setConditionNodeDefaultValue(nodeElement, nodeData) {
        try {
            const nodeManager = this.workflowPage.getNodeManager();
            if (!nodeManager || !nodeManager.connectionManager) {
                return;
            }

            const connections = nodeManager.connectionManager.getConnections();
            if (!connections || connections.length === 0) {
                return;
            }

            // 현재 노드로 들어오는 연결 찾기 (이전 노드 찾기)
            const nodeId = nodeData.id;
            const inputConnections = connections.filter((conn) => conn.to === nodeId);

            if (inputConnections.length === 0) {
                // 이전 노드가 없으면 기본값 유지
                return;
            }

            // 첫 번째 이전 노드 가져오기
            const previousNodeId = inputConnections[0].from;
            const previousNodeElement = document.getElementById(previousNodeId);

            if (!previousNodeElement) {
                return;
            }

            // 이전 노드의 타입과 데이터 가져오기
            const previousNodeType = this.workflowPage.getNodeType(previousNodeElement);
            const previousNodeData = this.workflowPage.getNodeData(previousNodeElement);

            // 이전 노드의 출력 스키마 기반 예시 값 생성
            const registry = getNodeRegistry();
            const previousNodeConfig = await registry.getConfig(previousNodeType);

            if (!previousNodeConfig?.output_schema) {
                return;
            }

            // 이전 노드의 출력 스키마 기반 예시 데이터 생성
            // output_schema는 표준 형식: {action, status, output: {type: "object", properties: {...}}}
            let previousOutput = {};
            if (previousNodeConfig.output_schema.output && previousNodeConfig.output_schema.output.properties) {
                // 표준 형식: output_schema.output.properties를 사용
                previousOutput = generatePreviewFromSchema(
                    previousNodeConfig.output_schema.output.properties,
                    previousNodeData || {}
                );
            } else {
                // 하위 호환성: output_schema가 직접 properties를 정의한 경우
                previousOutput = generatePreviewFromSchema(previousNodeConfig.output_schema, previousNodeData || {});
            }

            // compare_value에 설정할 값 결정
            // output.value 형식으로 필드 경로를 설정하고, output 객체의 첫 번째 값을 compare_value로 설정
            let compareValue = '';
            let fieldPath = '';

            if (previousOutput && typeof previousOutput === 'object') {
                if (previousOutput.output && typeof previousOutput.output === 'object') {
                    // output 객체의 첫 번째 키와 값을 가져오기
                    const outputKeys = Object.keys(previousOutput.output);
                    if (outputKeys.length > 0) {
                        const firstKey = outputKeys[0];
                        const firstValue = previousOutput.output[firstKey];
                        // field_path에 "output.{key}" 형식으로 설정
                        fieldPath = `outdata.output.${firstKey}`;
                        // compare_value에 첫 번째 값 설정 (객체/배열이면 JSON 문자열로, 아니면 그대로)
                        compareValue = typeof firstValue === 'object' ? JSON.stringify(firstValue) : String(firstValue);
                    } else {
                        // output이 비어있으면 field_path만 "outdata.output"으로 설정
                        fieldPath = 'outdata.output';
                        compareValue = JSON.stringify(previousOutput);
                    }
                } else {
                    // output 필드가 없으면 전체 출력의 첫 번째 값을 사용
                    const keys = Object.keys(previousOutput);
                    if (keys.length > 0) {
                        const firstKey = keys[0];
                        const firstValue = previousOutput[firstKey];
                        fieldPath = firstKey;
                        compareValue = typeof firstValue === 'object' ? JSON.stringify(firstValue) : String(firstValue);
                    }
                }
            } else if (previousOutput !== null && previousOutput !== undefined) {
                compareValue = String(previousOutput);
            }

            // compare_value와 field_path가 설정되었으면 노드 데이터 업데이트
            if (compareValue) {
                // 노드 데이터 업데이트
                const updatedNodeData = {
                    ...nodeData,
                    compare_value: compareValue
                };

                // field_path도 설정 (output.value 형식)
                if (fieldPath) {
                    updatedNodeData.field_path = fieldPath;
                }

                // nodeManager의 nodeData 업데이트
                if (nodeManager.nodeData) {
                    nodeManager.nodeData[nodeId] = updatedNodeData;
                }

                // 노드 요소의 데이터 속성 업데이트
                if (nodeElement) {
                    nodeElement.dataset.nodeData = JSON.stringify(updatedNodeData);
                }

                console.log(
                    `[AddNodeModal] 조건 노드 ${nodeId}의 compare_value를 이전 노드 출력으로 설정: ${compareValue}`
                );
            }
        } catch (error) {
            console.error('[AddNodeModal] 조건 노드 기본값 설정 실패:', error);
            // 에러가 발생해도 노드 생성은 계속 진행
        }
    }

    /**
     * 노드 추가 모달용 프로세스 목록 로드
     */
    async loadProcessListForAddModal() {
        const selectElement = document.getElementById('node-process-select');
        if (!selectElement) {
            return;
        }

        try {
            const apiBaseUrl = window.API_BASE_URL || 'http://localhost:8000';
            const response = await fetch(`${apiBaseUrl}/api/processes/list`);
            const result = await response.json();

            // 변경된 응답 형식: {success: true, message: "...", data: [...], count: N}
            const processes = result.data || result.processes || [];
            if (result.success && processes.length > 0) {
                // 기존 옵션 제거 (첫 번째 옵션 제외)
                while (selectElement.options.length > 1) {
                    selectElement.remove(1);
                }

                // 프로세스 목록 추가
                processes.forEach((process) => {
                    process.windows.forEach((window, index) => {
                        const option = document.createElement('option');
                        const value = `${process.process_id}|${window.hwnd}`;
                        option.value = value;
                        option.dataset.processName = process.process_name;
                        option.dataset.windowTitle = window.title;

                        // 표시 텍스트: 프로세스명 - 창제목 (여러 창이면 인덱스 표시)
                        const displayText =
                            process.window_count > 1
                                ? `${process.process_name} - ${window.title} (${index + 1})`
                                : `${process.process_name} - ${window.title}`;
                        option.textContent = displayText;

                        selectElement.appendChild(option);
                    });
                });
            } else {
                console.error('프로세스 목록 로드 실패:', result);
            }
        } catch (error) {
            console.error('프로세스 목록 로드 중 오류:', error);
            alert('프로세스 목록을 불러오는데 실패했습니다. 서버가 실행 중인지 확인하세요.');
        }
    }

    /**
     * 상세 노드 타입 변경 시 특수 설정 HTML 생성
     *
     * 이 메서드는 상세 노드 타입에 따른 설정 HTML을 생성하여 반환합니다.
     * customSettings 요소에 직접 설정하거나, 다른 설정과 병합할 수 있도록 HTML 문자열을 반환합니다.
     *
     * @param {string} nodeType - 노드 타입 (예: "action")
     * @param {string} detailNodeType - 상세 노드 타입 (예: "http-api-request")
     * @param {HTMLElement} customSettings - 특수 설정 컨테이너 (HTML을 설정하거나 읽기용)
     * @returns {Promise<string>} 생성된 HTML 문자열 (detailNodeType이 없으면 빈 문자열)
     */
    async updateDetailNodeTypeSettings(nodeType, detailNodeType, customSettings) {
        if (!detailNodeType || !customSettings) {
            // 상세 노드 타입이 선택되지 않았거나 "없음"인 경우 빈 문자열 반환
            return '';
        }

        const config = await getDetailNodeConfig(nodeType, detailNodeType);
        if (!config) {
            return '';
        }

        // 파라미터가 정의되어 있으면 빈 문자열 반환
        // (파라미터 기반 폼이 자동으로 생성되므로)
        if (config.parameters) {
            return '';
        }

        // 다른 상세 노드 타입의 경우 빈 문자열 반환
        return '';
    }
}
