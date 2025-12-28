/**
 * 노드 업데이트 서비스
 * 노드 설정 변경 및 DOM 업데이트를 담당합니다.
 */

import { NODE_TYPES } from '../constants/node-types.js';
import { NodeValidationUtils } from '../utils/node-validation-utils.js';
import { extractParameterValues } from '../utils/parameter-form-generator.js';
import { getNodeRegistry } from '../services/node-registry.js';

export class NodeUpdateService {
    constructor(workflowPage) {
        this.workflowPage = workflowPage;
    }

    /**
     * 노드 업데이트
     * @param {HTMLElement} nodeElement - 업데이트할 노드 요소
     * @param {string} nodeId - 노드 ID
     */
    async update(nodeElement, nodeId) {
        const logger = this.workflowPage.getLogger();
        const log = logger.log;
        const logError = logger.error;

        const nodeManager = this.workflowPage.getNodeManager();
        if (!nodeManager) {
            logError('NodeManager를 찾을 수 없습니다.');
            return;
        }

        // 폼에서 데이터 가져오기
        const formData = await this.extractFormData(nodeElement, nodeId, nodeManager);

        // NodeManager의 노드 데이터 업데이트
        this.updateNodeData(nodeId, formData, nodeManager);

        // 노드 DOM 업데이트
        this.updateNodeDOM(nodeElement, formData, nodeManager);

        // 이미지 터치 노드인 경우 추가 처리
        if (formData.type === NODE_TYPES.IMAGE_TOUCH && formData.folder_path) {
            this.updateImageTouchNode(nodeElement, nodeId, formData, nodeManager);
        }

        log(`[WorkflowPage] 노드 업데이트 완료: ${nodeId}`);

        // 서버에 저장
        try {
            const saveService = this.workflowPage.getSaveService();
            if (saveService) {
                log('[WorkflowPage] 서버에 노드 변경사항 저장 시작');
                await saveService.save({ useToast: false, showAlert: false }); // Toast 알림과 팝업 알림 모두 사용하지 않음
                log('[WorkflowPage] 서버에 노드 변경사항 저장 완료');

                // 저장 완료 알림 표시 (가운데 메시지)
                this.showSaveNotification();
            } else {
                logError('[WorkflowPage] SaveService를 찾을 수 없습니다.');
            }
        } catch (error) {
            logError(`[WorkflowPage] 서버 저장 실패: ${error.message}`);
            // 저장 실패해도 모달은 닫음 (로컬 업데이트는 완료되었으므로)
        }

        // 모달 닫기
        const modalManager = this.workflowPage.getModalManager();
        if (modalManager) {
            modalManager.close();
        }

        // 연결선 업데이트
        if (window.connectionManager) {
            setTimeout(() => {
                window.connectionManager.updateConnections();
            }, 100);
        }
    }

    /**
     * 폼에서 데이터 추출
     */
    async extractFormData(nodeElement, nodeId, nodeManager) {
        // 폼에서 제목 가져오기
        const newTitle = document.getElementById('edit-node-title').value;
        // currentType: 현재 노드 타입 (nodeData에서 가져오거나 dataset에서 가져옴)
        const currentType =
            nodeManager.nodeData && nodeManager.nodeData[nodeId]
                ? nodeManager.nodeData[nodeId].type || nodeElement.dataset.nodeType
                : nodeElement.dataset.nodeType;
        // isBoundary: 경계 노드 여부 (경계 노드는 타입 변경 불가)
        const { isBoundaryNodeSync } = await import('../constants/node-types.js');
        const isBoundary = isBoundaryNodeSync(currentType);
        // newType: 새로운 노드 타입 (경계 노드가 아니면 폼에서 가져옴, 경계 노드면 현재 타입 유지)
        let newType = isBoundary ? currentType : document.getElementById('edit-node-type')?.value || currentType;

        // 노드 타입 변경 시 검증 (경계 노드로 변경하려는 경우)
        // 경계 노드가 아니고 타입이 변경된 경우만 검증
        if (!isBoundary && newType !== currentType) {
            // validation: 타입 변경 검증 결과 (canChange, message 포함)
            const validation = NodeValidationUtils.validateNodeTypeChange(newType, nodeId, nodeManager);
            // 타입 변경이 불가능하면 에러 표시하고 원래 타입으로 되돌림
            if (!validation.canChange) {
                const modalManager = this.workflowPage.getModalManager();
                // modalManager가 있으면 모달로 알림 표시
                if (modalManager) {
                    modalManager.showAlert('타입 변경 불가', validation.message);
                } else {
                    // modalManager가 없으면 기본 alert 사용
                    alert(validation.message);
                }
                // 원래 타입으로 되돌리기 (폼의 select 요소 값도 되돌림)
                const nodeTypeSelect = document.getElementById('edit-node-type');
                if (nodeTypeSelect) {
                    nodeTypeSelect.value = currentType;
                }
                // newType을 원래 타입으로 설정 (타입 변경 취소)
                newType = currentType;
            }
        }

        // 상세 노드 타입 가져오기
        const detailNodeTypeSelect = document.getElementById('edit-detail-node-type');
        const newDetailNodeType = detailNodeTypeSelect ? detailNodeTypeSelect.value : null;

        const position = {
            x: parseFloat(nodeElement.style.left) || 0,
            y: parseFloat(nodeElement.style.top) || 0
        };

        const updatedNodeData = {
            id: nodeId,
            type: newType,
            title: newTitle,
            action_node_type: newDetailNodeType || undefined,
            x: position.x,
            y: position.y
        };

        // description 가져오기
        const description = document.getElementById('edit-node-description')?.value || '';
        if (description) {
            updatedNodeData.description = description;
        }

        // 입력 데이터 가져오기 (편집 가능한 입력 필드)
        const inputPreview = document.getElementById('node-input-preview');
        if (inputPreview) {
            const inputValue = inputPreview.value.trim();
            if (inputValue) {
                // JSON 파싱 시도
                try {
                    updatedNodeData.input_data = JSON.parse(inputValue);
                } catch (e) {
                    // JSON이 아니면 문자열로 저장
                    updatedNodeData.input_data = inputValue;
                }
            } else {
                // 빈 값이면 입력 데이터 제거
                updatedNodeData.input_data = null;
            }
        }

        // 출력 오버라이드 값 가져오기 (항상 편집 가능하므로 textarea 값이 있으면 저장)
        const outputOverrideTextarea = document.getElementById('edit-node-output-value');

        if (outputOverrideTextarea) {
            const outputValue = outputOverrideTextarea.value.trim();
            if (outputValue) {
                // JSON 파싱 시도
                try {
                    updatedNodeData.output_override = JSON.parse(outputValue);
                } catch (e) {
                    // JSON이 아니면 문자열로 저장
                    updatedNodeData.output_override = outputValue;
                }
            } else {
                // 빈 값이면 오버라이드 제거
                updatedNodeData.output_override = null;
            }
        } else {
            // textarea가 없으면 오버라이드 제거
            updatedNodeData.output_override = null;
        }

        // process-focus 노드의 경우 프로세스 선택 값 추가
        if (newType === 'process-focus') {
            const processIdInput = document.getElementById('edit-node-process-id');
            const processHwndInput = document.getElementById('edit-node-process-hwnd');
            const processNameInput = document.getElementById('edit-node-process-name');
            const windowTitleInput = document.getElementById('edit-node-window-title');

            if (processIdInput && processIdInput.value) {
                updatedNodeData.process_id = parseInt(processIdInput.value, 10) || null;
            }
            if (processHwndInput && processHwndInput.value) {
                updatedNodeData.hwnd = parseInt(processHwndInput.value, 10) || null;
            }
            if (processNameInput && processNameInput.value) {
                updatedNodeData.process_name = processNameInput.value;
            }
            if (windowTitleInput && windowTitleInput.value) {
                updatedNodeData.window_title = windowTitleInput.value;
            }
        }

        // 파라미터 기반 데이터 추출
        const registry = getNodeRegistry();
        const config = await registry.getConfig(newType);

        // 상세 노드 타입이 선택된 경우, 상세 노드 타입의 파라미터 우선 사용
        // newDetailNodeType: 선택된 상세 노드 타입 (예: "http-api-request")
        if (newDetailNodeType && config?.detailTypes?.[newDetailNodeType]?.parameters) {
            // detailConfig: 상세 노드 타입 설정 (파라미터 정의 포함)
            const detailConfig = config.detailTypes[newDetailNodeType];
            // paramValues: 폼에서 추출한 파라미터 값들
            const paramValues = extractParameterValues(detailConfig.parameters, 'edit-node-');
            console.log('[NodeUpdateService] 상세 노드 타입 파라미터 추출:', paramValues);
            // updatedNodeData에 파라미터 값들 병합
            Object.assign(updatedNodeData, paramValues);
        } else if (config?.parameters) {
            // 상세 노드 타입에 파라미터가 없으면 노드 레벨 파라미터 사용
            // paramValues: 폼에서 추출한 파라미터 값들
            const paramValues = extractParameterValues(config.parameters, 'edit-node-');
            // updatedNodeData에 파라미터 값들 병합
            Object.assign(updatedNodeData, paramValues);
        }

        return updatedNodeData;
    }

    /**
     * 노드 데이터 업데이트
     */
    updateNodeData(nodeId, nodeData, nodeManager) {
        if (nodeManager.nodeData) {
            if (!nodeManager.nodeData[nodeId]) {
                nodeManager.nodeData[nodeId] = {};
            }

            // description 저장
            if (nodeData.description) {
                nodeManager.nodeData[nodeId].description = nodeData.description;
            } else {
                nodeManager.nodeData[nodeId].description = null;
            }

            // 나머지 데이터 업데이트
            Object.assign(nodeManager.nodeData[nodeId], nodeData, {
                updatedAt: new Date().toISOString()
            });
        }
    }

    /**
     * 노드 DOM 업데이트
     */
    updateNodeDOM(nodeElement, nodeData, nodeManager) {
        // 노드 클래스 업데이트 (색상 클래스 제거)
        nodeElement.className = nodeElement.className.replace(/node-\w+/g, '');
        nodeElement.classList.add('workflow-node');

        // 노드 타입별 콘텐츠 재생성
        const nodeContent = nodeManager.generateNodeContent(nodeData);

        // generateNodeContent가 이미 전체 구조(입력, 콘텐츠, 출력, 설정)를 포함하는지 확인
        // 조건 노드 같은 경우 renderContent가 .node-outputs를 포함한 전체를 반환할 수 있음
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = nodeContent;

        // nodeContent에 이미 포함된 요소 확인
        const hasNodeInput = tempDiv.querySelector('.node-input') !== null;
        const hasOutputsContainer = tempDiv.querySelector('.node-outputs') !== null;
        const hasNodeOutput = tempDiv.querySelector('.node-output:not(.true-output):not(.false-output)') !== null;
        const hasNodeSettings = tempDiv.querySelector('.node-settings') !== null;

        // nodeContent가 이미 완전한 구조를 포함하는 경우 그대로 사용
        if (hasNodeInput && (hasOutputsContainer || hasNodeOutput) && hasNodeSettings) {
            console.log('[updateNodeDOM] nodeContent가 완전한 구조를 포함하므로 그대로 사용');
            nodeElement.innerHTML = nodeContent;
        } else {
            // 부분적으로만 포함된 경우 기존 요소와 병합

            const existingInput = nodeElement.querySelector('.node-input');
            const existingOutput = nodeElement.querySelector('.node-output:not(.true-output):not(.false-output)');
            const existingOutputsContainer = nodeElement.querySelector('.node-outputs');
            const existingSettings = nodeElement.querySelector('.node-settings');

            const inputConnector = existingInput ? existingInput.outerHTML : '<div class="node-input"></div>';
            let outputConnector = '';

            // nodeContent에 .node-outputs가 이미 포함되어 있으면 추가하지 않음
            if (!hasOutputsContainer && !hasNodeOutput) {
                // 조건 노드처럼 .node-outputs가 있는 경우
                if (existingOutputsContainer) {
                    outputConnector = existingOutputsContainer.outerHTML;
                } else if (existingOutput) {
                    outputConnector = existingOutput.outerHTML;
                } else {
                    outputConnector = '<div class="node-output"></div>';
                }
            }

            nodeElement.innerHTML = `
                ${inputConnector}
                ${nodeContent}
                ${outputConnector}
                ${existingSettings ? existingSettings.outerHTML : `<div class="node-settings" data-node-id="${nodeData.id}">⚙</div>`}
            `;
        }

        // 이벤트 리스너 다시 설정
        nodeManager.setupNodeEventListeners(nodeElement);

        // 노드 크기 조정 및 아래 연결점 위치 업데이트
        if (nodeManager.adjustNodeSize) {
            nodeManager.adjustNodeSize(nodeElement);
        }
        if (nodeManager.adjustBottomOutputPosition) {
            nodeManager.adjustBottomOutputPosition(nodeElement);
        }
        if (nodeManager.connectionHandler) {
            nodeManager.connectionHandler.setupConnectionEvents(nodeElement);
        }

        // ConnectionManager에 노드 커넥터 다시 바인딩
        nodeManager.registerNodeWithConnectionManager(nodeElement);

        // 드래그 컨트롤러 다시 연결
        if (nodeManager.dragController) {
            nodeManager.dragController.attachNode(nodeElement);
        }
    }

    /**
     * 이미지 터치 노드 업데이트
     */
    updateImageTouchNode(nodeElement, nodeId, nodeData, nodeManager) {
        // 이미지 개수 확인
        const apiBaseUrl = window.API_BASE_URL || 'http://localhost:8000';
        fetch(`${apiBaseUrl}/api/images/list?folder_path=${encodeURIComponent(nodeData.folder_path)}`)
            .then((response) => response.json())
            .then((result) => {
                // 변경된 응답 형식: {success: true, message: "...", data: [...], count: N}
                if (result.success) {
                    const count = result.count || result.data?.length || 0;
                    nodeData.image_count = count;

                    // NodeManager의 노드 데이터에도 이미지 개수 저장
                    if (nodeManager.nodeData && nodeManager.nodeData[nodeId]) {
                        nodeManager.nodeData[nodeId].image_count = count;
                    }

                    const descriptionElement = nodeElement.querySelector('.node-description');
                    const infoElement = nodeElement.querySelector('.node-info');

                    if (descriptionElement) {
                        descriptionElement.textContent = nodeData.folder_path;
                    }

                    if (infoElement) {
                        infoElement.textContent = `${count}개 이미지`;
                    } else if (count > 0) {
                        const contentElement = nodeElement.querySelector('.node-content');
                        if (contentElement) {
                            const info = document.createElement('div');
                            info.className = 'node-info';
                            info.textContent = `${count}개 이미지`;
                            contentElement.appendChild(info);
                        }
                    }
                }
            })
            .catch((e) => {
                console.warn('이미지 개수 조회 실패:', e);
            });
    }

    /**
     * 저장 완료 알림 표시 (가운데 메시지)
     */
    showSaveNotification() {
        // ToastManager 사용 (Ctrl+S와 동일한 방식, 사이드바 고려)
        const toastManager = this.workflowPage.getToastManager();
        if (toastManager) {
            const { t } = window.i18n || { t: (key) => key };
            toastManager.success(t('settings.settingsSaved') || '설정이 저장되었습니다.', 2000);
        }
    }
}
