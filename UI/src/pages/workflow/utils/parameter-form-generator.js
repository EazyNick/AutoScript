/**
 * 파라미터 기반 폼 생성 유틸리티
 *
 * nodes_config.py에서 정의한 파라미터 구조를 기반으로
 * 동적으로 HTML 폼을 생성합니다.
 */

import { escapeHtml } from './node-utils.js';

/**
 * 파라미터 정의를 기반으로 HTML 입력 필드 생성
 *
 * @param {string} paramKey - 파라미터 키 (예: "file_path")
 * @param {Object} paramConfig - 파라미터 설정 객체
 * @param {string} prefix - 입력 필드 ID 접두사 (예: "node-", "edit-node-")
 * @param {any} currentValue - 현재 값 (기존 노드 수정 시 사용)
 * @returns {Object} {html: string, buttonId: string|null, paramKey: string} 생성된 HTML과 버튼 정보
 */
export function generateParameterInput(paramKey, paramConfig, prefix = 'node-', currentValue = undefined) {
    const {
        type,
        label,
        description,
        default: defaultValue,
        required = false,
        placeholder = '',
        min,
        max,
        options
    } = paramConfig;

    // 현재 값이 없으면 기본값 사용
    // value: 최종적으로 사용할 값 (currentValue 우선, 없으면 defaultValue, 없으면 빈 문자열)
    const value = currentValue !== undefined ? currentValue : defaultValue !== undefined ? defaultValue : '';

    // 필드 ID 생성
    // fieldId: 입력 필드의 고유 ID (prefix + paramKey)
    const fieldId = `${prefix}${paramKey}`;

    // 필수 표시
    // requiredMark: 필수 표시 마크 (required가 true이면 빨간 별표 표시)
    const requiredMark = required ? ' <span style="color: red;">*</span>' : '';
    // requiredAttr: HTML required 속성 (required가 true이면 'required' 문자열)
    const requiredAttr = required ? 'required' : '';

    // inputHtml: 생성할 입력 필드 HTML (타입에 따라 다르게 생성됨)
    let inputHtml = '';

    // 파라미터 타입에 따라 다른 입력 필드 생성
    switch (type) {
        case 'number':
            inputHtml = `
                <input 
                    type="number" 
                    id="${fieldId}" 
                    value="${escapeHtml(value)}" 
                    ${min !== undefined ? `min="${min}"` : ''} 
                    ${max !== undefined ? `max="${max}"` : ''} 
                    step="${type === 'number' && (min !== undefined || max !== undefined) ? 'any' : '1'}"
                    ${requiredAttr}
                    placeholder="${escapeHtml(placeholder)}"
                    class="node-settings-input"
                    style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            `;
            break;

        case 'string':
        case 'options':
            // options가 있으면 select, 없으면 text input
            // options: 선택 옵션 배열 (있으면 select, 없으면 text input)
            if (options && Array.isArray(options)) {
                // optionsHtml: select 옵션 HTML 문자열
                const optionsHtml = options
                    .map((opt) => {
                        // 옵션이 객체 형태인지 문자열인지 확인
                        // optValue: 옵션 값 (객체면 value 속성, 문자열이면 그대로)
                        const optValue = typeof opt === 'object' && opt !== null ? opt.value : opt;
                        // optLabel: 옵션 레이블 (객체면 label 속성, 문자열이면 그대로)
                        const optLabel = typeof opt === 'object' && opt !== null ? opt.label : opt;
                        // selected: 현재 값과 일치하면 selected 속성 추가
                        const selected = value === optValue ? 'selected' : '';
                        return `<option value="${escapeHtml(optValue)}" ${selected}>${escapeHtml(optLabel)}</option>`;
                    })
                    .join('');
                inputHtml = `
                    <select 
                        id="${fieldId}" 
                        ${requiredAttr}
                        class="node-settings-select"
                        style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        ${optionsHtml}
                    </select>
                `;
            } else {
                // textarea가 필요한 경우 (긴 텍스트)
                // isLongText: 긴 텍스트인지 여부 (body, content, headers 포함 여부)
                const isLongText =
                    paramKey.toLowerCase().includes('body') ||
                    paramKey.toLowerCase().includes('content') ||
                    paramKey.toLowerCase().includes('headers');
                // 긴 텍스트면 textarea 사용
                if (isLongText) {
                    inputHtml = `
                            <textarea 
                                id="${fieldId}" 
                                rows="${paramKey.toLowerCase().includes('body') ? '4' : '3'}"
                                ${requiredAttr}
                                placeholder="${escapeHtml(placeholder)}"
                                class="node-settings-textarea"
                                style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-family: monospace; resize: vertical;">${escapeHtml(value)}</textarea>
                        `;
                } else {
                    // folder_path 또는 file_path 파라미터인 경우 파일/폴더 선택 버튼 추가
                    const isPathParameter =
                        paramKey.toLowerCase() === 'folder_path' || paramKey.toLowerCase() === 'file_path';

                    if (isPathParameter) {
                        const buttonText = paramKey.toLowerCase() === 'folder_path' ? '폴더 선택' : '파일 선택';
                        const buttonId = `${fieldId}-browse-btn`;
                        inputHtml = `
                                <div style="display: flex; gap: 8px;">
                                    <input 
                                        type="text" 
                                        id="${fieldId}" 
                                        value="${escapeHtml(value)}" 
                                        ${requiredAttr}
                                        placeholder="${escapeHtml(placeholder)}"
                                        class="node-settings-input"
                                        style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                                    <button 
                                        type="button" 
                                        id="${buttonId}" 
                                        class="btn btn-secondary"
                                        style="white-space: nowrap;">
                                        ${buttonText}
                                    </button>
                                </div>
                            `;
                    } else {
                        // field_path 또는 execution_id 파라미터인 경우 자동완성 입력 필드 생성
                        // source가 "previous_output"인 경우도 포함
                        // isFieldPath: 필드 경로 파라미터인지 여부 (field_path, execution_id, 또는 source가 previous_output)
                        const isFieldPath =
                            paramKey.toLowerCase() === 'field_path' ||
                            paramKey.toLowerCase() === 'execution_id' ||
                            paramConfig.source === 'previous_output';

                        // 필드 경로 파라미터면 자동완성 입력 필드 생성
                        if (isFieldPath) {
                            // 드롭다운 + 입력 하이브리드 지원 여부 확인
                            const useDropdownInput =
                                paramConfig.ui_type === 'dropdown_input' ||
                                paramConfig.options_source === 'previous_output';

                            // datalistId: datalist 요소 ID (자동완성 옵션 목록)
                            const datalistId = `${fieldId}-datalist`;
                            // autocompleteId: 자동완성 미리보기 요소 ID (회색 미리보기 표시용)
                            const autocompleteId = `${fieldId}-autocomplete`;
                            // dropdownId: 드롭다운 select 요소 ID
                            const dropdownId = `${fieldId}-dropdown`;
                            // typeWarningId: 타입 경고 메시지 요소 ID
                            const typeWarningId = `${fieldId}-type-warning`;

                            if (useDropdownInput) {
                                // 드롭다운 + 입력 하이브리드 UI
                                inputHtml = `
                                    <div style="position: relative;">
                                        <div style="display: flex; gap: 8px; align-items: center;">
                                            <div style="flex: 0 0 200px; position: relative;">
                                                <select 
                                                    id="${dropdownId}"
                                                    class="node-settings-select node-variable-dropdown"
                                                    style="width: 100%; padding: 8px; padding-left: 32px; border: 1px solid #ddd; border-radius: 4px; background-color: #f8f9fa;"
                                                    title="이전 노드 출력 변수 선택">
                                                    <option value="">← 이전 노드에서 선택...</option>
                                                    <!-- 이전 노드 출력 변수 목록이 여기에 동적으로 추가됨 -->
                                                </select>
                                                <span style="position: absolute; left: 8px; top: 50%; transform: translateY(-50%); pointer-events: none; color: #2673ea; font-size: 14px;">🔗</span>
                                            </div>
                                            <div style="position: relative; flex: 1;">
                                                <input 
                                                    type="text" 
                                                    id="${fieldId}" 
                                                    list="${datalistId}"
                                                    value="${escapeHtml(value)}" 
                                                    ${requiredAttr}
                                                    placeholder="${escapeHtml(placeholder || '이전 노드 출력에서 선택하거나 직접 입력')}"
                                                    class="node-settings-input node-field-path-input"
                                                    style="width: 100%; padding: 8px; padding-left: 28px; border: 1px solid #ddd; border-left: 3px solid #2673ea; border-radius: 4px;"
                                                    autocomplete="off">
                                                <span style="position: absolute; left: 8px; top: 50%; transform: translateY(-50%); pointer-events: none; color: #2673ea; font-size: 14px; font-weight: 600; z-index: 3;">←</span>
                                                <div 
                                                    id="${autocompleteId}"
                                                    class="field-path-autocomplete-preview"
                                                    style="position: absolute; left: 28px; top: 8px; right: 8px; pointer-events: none; color: #999; z-index: 1; white-space: pre; font-size: inherit; font-family: inherit; line-height: inherit;">
                                                </div>
                                            </div>
                                            <button 
                                                type="button" 
                                                id="${fieldId}-expand-btn"
                                                class="btn btn-small field-path-expand-btn"
                                                style="white-space: nowrap; padding: 8px 12px; font-size: 12px; flex-shrink: 0; min-width: 40px;"
                                                title="이전 노드 출력 변수 목록 보기">
                                                <span style="margin-right: 4px;">🔗</span>
                                                <span class="expand-icon">▼</span>
                                            </button>
                                        </div>
                                        <datalist id="${datalistId}">
                                            <!-- 이전 노드 출력 변수 목록이 여기에 동적으로 추가됨 -->
                                        </datalist>
                                        <div 
                                            id="${typeWarningId}"
                                            class="node-parameter-type-warning"
                                            style="display: none; margin-top: 4px; padding: 4px 8px; background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; color: #856404; font-size: 12px;">
                                        </div>
                                    </div>
                                `;
                            } else {
                                // 기존 방식: 입력 필드 + 버튼
                                const defaultPlaceholder =
                                    placeholder ||
                                    '이전 노드 출력에서 선택하거나 직접 입력 (예: outdata.output.execution_id)';
                                inputHtml = `
                                    <div style="position: relative; display: flex; gap: 8px; align-items: center;">
                                        <div style="position: relative; flex: 1;">
                                            <input 
                                                type="text" 
                                                id="${fieldId}" 
                                                list="${datalistId}"
                                                value="${escapeHtml(value)}" 
                                                ${requiredAttr}
                                                placeholder="${escapeHtml(defaultPlaceholder)}"
                                                class="node-settings-input node-field-path-input"
                                                style="width: 100%; padding: 8px; padding-left: 28px; padding-right: 8px; position: relative; z-index: 2; border-left: 3px solid #2673ea;"
                                                autocomplete="off">
                                            <span style="position: absolute; left: 8px; top: 50%; transform: translateY(-50%); pointer-events: none; color: #2673ea; font-size: 14px; font-weight: 600; z-index: 3;">←</span>
                                            <div 
                                                id="${autocompleteId}"
                                                class="field-path-autocomplete-preview"
                                                style="position: absolute; left: 28px; top: 8px; right: 8px; pointer-events: none; color: #999; z-index: 1; white-space: pre; font-size: inherit; font-family: inherit; line-height: inherit;">
                                            </div>
                                        </div>
                                        <datalist id="${datalistId}">
                                            <!-- 이전 노드 출력 변수 목록이 여기에 동적으로 추가됨 -->
                                        </datalist>
                                        <button 
                                            type="button" 
                                            id="${fieldId}-expand-btn"
                                            class="btn btn-small field-path-expand-btn"
                                            style="white-space: nowrap; padding: 8px 12px; font-size: 12px; flex-shrink: 0; min-width: 50px; background-color: #e3f2fd; border-color: #2673ea; color: #2673ea;"
                                            title="이전 노드 출력 변수 목록 보기">
                                            <span style="margin-right: 4px;">🔗</span>
                                            <span class="expand-icon">▼</span>
                                        </button>
                                        <div 
                                            id="${typeWarningId}"
                                            class="node-parameter-type-warning"
                                            style="display: none; margin-top: 4px; padding: 4px 8px; background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; color: #856404; font-size: 12px;">
                                        </div>
                                    </div>
                                `;
                            }
                        } else {
                            inputHtml = `
                                <input 
                                    type="text" 
                                    id="${fieldId}" 
                                    value="${escapeHtml(value)}" 
                                    ${requiredAttr}
                                    placeholder="${escapeHtml(placeholder)}"
                                    class="node-settings-input"
                                    style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                            `;
                        }
                    }
                }
            }
            break;

        case 'boolean':
            // boolean 타입은 레이블과 체크박스를 분리하여 표시
            // 설명이 있으면 설명을 먼저 표시하고, 레이블과 체크박스를 한 줄에 배치
            inputHtml = `
                <div class="node-settings-boolean-group">
                    <div class="node-settings-boolean-label-wrapper">
                        <label for="${fieldId}" class="node-settings-boolean-label">
                            ${escapeHtml(label)}${requiredMark}
                        </label>
                        ${description ? `<small class="node-settings-help-text node-settings-boolean-help">${escapeHtml(description)}</small>` : ''}
                    </div>
                    <label class="node-settings-checkbox-wrapper">
                        <input 
                            type="checkbox" 
                            id="${fieldId}" 
                            ${value ? 'checked' : ''}
                            class="node-settings-checkbox">
                        <span class="node-settings-checkbox-slider"></span>
                    </label>
                </div>
            `;
            break;

        default:
            // 기본적으로 text input으로 처리
            inputHtml = `
                <input 
                    type="text" 
                    id="${fieldId}" 
                    value="${escapeHtml(value)}" 
                    ${requiredAttr}
                    placeholder="${escapeHtml(placeholder)}"
                    class="node-settings-input"
                    style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            `;
    }

    // folder_path 또는 file_path 파라미터인 경우 버튼 ID 저장 (이벤트 리스너 설정용)
    const buttonId =
        paramKey.toLowerCase() === 'folder_path' || paramKey.toLowerCase() === 'file_path'
            ? `${fieldId}-browse-btn`
            : null;

    // boolean 타입은 inputHtml에 이미 레이블과 설명이 포함되어 있으므로 외부 label과 description 불필요
    const labelHtml =
        type === 'boolean'
            ? ''
            : `<label for="${fieldId}" class="node-settings-label">${escapeHtml(label)}${requiredMark}:</label>`;

    const html = `
        <div class="form-group node-settings-form-group">
            ${labelHtml}
            ${inputHtml}
            ${type !== 'boolean' && description ? `<small class="node-settings-help-text">${escapeHtml(description)}</small>` : ''}
        </div>
    `;

    return {
        html: html,
        buttonId: buttonId,
        paramKey: paramKey
    };
}

/**
 * 파라미터 객체를 기반으로 전체 폼 HTML 생성
 *
 * @param {Object} parameters - 파라미터 정의 객체 (key: paramKey, value: paramConfig)
 * @param {string} prefix - 입력 필드 ID 접두사
 * @param {Object} currentValues - 현재 값 객체 (기존 노드 수정 시 사용)
 * @returns {Object} {html: string, buttons: Array<{buttonId: string, paramKey: string, type: 'folder'|'file'}>} 생성된 HTML과 버튼 정보
 */
export function generateParameterForm(parameters, prefix = 'node-', currentValues = {}, options = {}) {
    if (!parameters || Object.keys(parameters).length === 0) {
        return { html: '', buttons: [] };
    }

    // 제외할 파라미터 목록 (options.excludeParams)
    const excludeParams = options.excludeParams || [];

    const buttons = [];
    const formGroups = Object.entries(parameters)
        .filter(([paramKey]) => !excludeParams.includes(paramKey)) // 제외할 파라미터 필터링
        .map(([paramKey, paramConfig]) => {
            const currentValue = currentValues[paramKey];
            const result = generateParameterInput(paramKey, paramConfig, prefix, currentValue);

            // 버튼이 있는 경우 정보 저장
            if (result.buttonId) {
                const isFolder = paramKey.toLowerCase() === 'folder_path';
                buttons.push({
                    buttonId: result.buttonId,
                    fieldId: `${prefix}${paramKey}`,
                    paramKey: paramKey,
                    type: isFolder ? 'folder' : 'file'
                });
            }

            return result.html;
        });

    return {
        html: formGroups.join(''),
        buttons: buttons
    };
}

/**
 * 폼에서 파라미터 값 추출
 *
 * @param {Object} parameters - 파라미터 정의 객체
 * @param {string} prefix - 입력 필드 ID 접두사
 * @returns {Object} 추출된 파라미터 값 객체
 */
export function extractParameterValues(parameters, prefix = 'node-') {
    if (!parameters || Object.keys(parameters).length === 0) {
        console.log('[extractParameterValues] 파라미터 없음');
        return {};
    }

    console.log('[extractParameterValues] 파라미터 추출 시작:', {
        parameters: Object.keys(parameters),
        prefix
    });

    // values: 추출된 파라미터 값 객체 (key: paramKey, value: 추출된 값)
    const values = {};
    // 각 파라미터를 순회하며 폼에서 값 추출
    for (const [paramKey, paramConfig] of Object.entries(parameters)) {
        // fieldId: 입력 필드 ID (prefix + paramKey)
        const fieldId = `${prefix}${paramKey}`;
        // fieldElement: 입력 필드 DOM 요소
        const fieldElement = document.getElementById(fieldId);

        // 필드 요소가 없으면 경고 출력하고 다음 파라미터로 넘어감
        if (!fieldElement) {
            console.warn(`[extractParameterValues] 필드 요소를 찾을 수 없음: ${fieldId}`);
            continue;
        }

        // type: 파라미터 타입 (number, boolean, string 등)
        const { type } = paramConfig;
        // value: 추출된 값 (타입에 따라 다르게 추출)
        let value;

        // 파라미터 타입에 따라 값 추출 방법이 다름
        switch (type) {
            case 'number':
                // 숫자 타입: parseFloat로 변환, 값이 없으면 기본값 또는 0 사용
                value = fieldElement.value ? parseFloat(fieldElement.value) : paramConfig.default || 0;
                break;
            case 'boolean':
                // 체크박스는 input 요소이므로 checked 속성 사용
                // 중첩된 label 안에 있어도 getElementById로 찾을 수 있음
                if (fieldElement.type === 'checkbox') {
                    // 체크박스의 checked 속성으로 boolean 값 추출
                    value = fieldElement.checked;
                    console.log(
                        `[extractParameterValues] boolean 파라미터 추출: ${paramKey} = ${value} (checked: ${fieldElement.checked})`
                    );
                } else {
                    // 예외 처리: 체크박스가 아닌 경우 (기본값 false)
                    console.warn(
                        `[extractParameterValues] boolean 타입이지만 체크박스가 아님: ${fieldId}`,
                        fieldElement
                    );
                    value = false;
                }
                break;
            case 'string':
                // 문자열 타입: SELECT, TEXTAREA, INPUT 모두 value 속성 사용
                if (fieldElement.tagName === 'SELECT') {
                    value = fieldElement.value;
                } else if (fieldElement.tagName === 'TEXTAREA') {
                    value = fieldElement.value;
                } else {
                    value = fieldElement.value;
                }
                break;
            default:
                // 기본적으로 value 속성 사용
                value = fieldElement.value;
        }

        // 기본값이 있고 값이 비어있으면 기본값 사용
        // value가 빈 문자열, null, undefined이고 기본값이 있으면 기본값 사용
        if ((value === '' || value === null || value === undefined) && paramConfig.default !== undefined) {
            value = paramConfig.default;
        }

        console.log(`[extractParameterValues] ${paramKey}:`, {
            fieldId,
            value,
            elementType: fieldElement.tagName,
            elementValue: fieldElement.value
        });

        values[paramKey] = value;
    }

    console.log('[extractParameterValues] 추출된 값:', values);
    return values;
}
