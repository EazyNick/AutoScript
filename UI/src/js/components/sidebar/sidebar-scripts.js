/**
 * SidebarManager 스크립트 관리
 *
 * 이 모듈은 사이드바의 스크립트 관련 모든 비즈니스 로직을 담당합니다.
 * - 스크립트 CRUD 작업 (생성, 조회, 수정, 삭제)
 * - 스크립트 목록 로드 및 순서 관리
 * - 스크립트 실행 (단일 및 전체 실행)
 * - 스크립트 선택 및 포커스 관리
 *
 * @module sidebar-scripts
 */

import { ScriptAPI } from '../../api/scriptapi.js';
import { UserSettingsAPI } from '../../api/user-settings-api.js';
import { getModalManagerInstance } from '../../utils/modal.js';
import { getLogger, formatDate } from './sidebar-utils.js';
import { getDashboardManagerInstance } from '../../../pages/workflow/dashboard.js';
import { LogAPI } from '../../api/logapi.js';
import { t } from '../../utils/i18n.js';
import { getPageRouterInstance } from '../../../pages/workflow/page-router.js';

/**
 * 스크립트 관리 클래스
 *
 * SidebarManager의 스크립트 관련 기능을 담당하는 클래스입니다.
 * 서버와의 통신, 스크립트 데이터 관리, 실행 로직 등을 처리합니다.
 *
 * @class SidebarScriptManager
 */
export class SidebarScriptManager {
    /**
     * SidebarScriptManager 생성자
     *
     * @param {SidebarManager} sidebarManager - 부모 SidebarManager 인스턴스
     */
    constructor(sidebarManager) {
        this.sidebarManager = sidebarManager;
        this.scriptAPI = ScriptAPI;
        this.userSettingsAPI = UserSettingsAPI;
    }

    /**
     * 서버에서 스크립트 목록을 가져와서 로드
     *
     * 서버의 스크립트 목록을 조회하여 사이드바에 표시할 형식으로 변환합니다.
     * 저장된 포커스된 스크립트 ID를 복원하여 이전 선택 상태를 유지합니다.
     *
     * @returns {Promise<void>}
     * @throws {Error} 서버 통신 실패 시
     */
    async loadScriptsFromServer() {
        const logger = getLogger();
        const log = logger.log;
        const logWarn = logger.warn;
        const logError = logger.error;

        log('[Scripts] loadScriptsFromServer() 시작');
        log('[Scripts] ScriptAPI 상태:', this.scriptAPI !== undefined ? '존재' : '없음');
        log('[Scripts] apiCall 상태:', typeof window.apiCall);

        try {
            // ScriptAPI는 이미 import되었으므로 바로 사용 가능
            if (this.scriptAPI && typeof this.scriptAPI.getAllScripts === 'function') {
                log('[Scripts] ✅ ScriptAPI.getAllScripts() 호출 준비 완료');
                log('[Scripts] 서버에 스크립트 목록 요청 전송...');

                const scripts = await this.scriptAPI.getAllScripts();

                log('[Scripts] ✅ 서버에서 스크립트 목록 받음:', scripts);
                log(`[Scripts] 받은 스크립트 개수: ${scripts.length}개`);

                // 서버에서 이미 execution_order 기준으로 정렬되어 반환되므로 별도 정렬 불필요

                // 서버 데이터를 사이드바 형식으로 변환
                // DB의 active 필드를 유지 (서버에서 받은 active 값 사용)
                this.sidebarManager.scripts = scripts.map((script, index) => ({
                    id: script.id,
                    name: script.name,
                    description: script.description || '',
                    date: formatDate(script.updated_at || script.created_at),
                    active: index === 0, // 첫 번째 스크립트를 기본 선택 (로컬 선택 상태)
                    dbActive: script.active !== undefined ? script.active : true // DB의 active 필드 (실제 활성화 상태)
                }));

                // DB에서 받은 순서가 이미 execution_order로 정렬되어 있으므로 별도 순서 적용 불필요
                // (서버에서 ORDER BY execution_order로 정렬하여 반환)

                // 저장된 포커스된 스크립트 ID 복원
                let focusedScriptIndex = 0; // 기본값: 첫 번째 스크립트
                try {
                    const focusedScriptId = await this.userSettingsAPI.getSetting('focused-script-id');
                    if (focusedScriptId) {
                        const scriptId = parseInt(focusedScriptId, 10);
                        const foundIndex = this.sidebarManager.scripts.findIndex((script) => script.id === scriptId);
                        if (foundIndex !== -1) {
                            focusedScriptIndex = foundIndex;
                            log(`[Scripts] 저장된 포커스된 스크립트 복원: ID=${scriptId}, Index=${foundIndex}`);
                        } else {
                            log(
                                `[Scripts] 저장된 포커스된 스크립트를 찾을 수 없음: ID=${scriptId}, 첫 번째 스크립트 선택`
                            );
                        }
                    }
                } catch (error) {
                    log('[Scripts] 포커스된 스크립트 복원 실패 (첫 번째 스크립트 선택):', error);
                }

                // 포커스된 스크립트 활성화
                if (this.sidebarManager.scripts.length > 0) {
                    this.sidebarManager.currentScriptIndex = focusedScriptIndex;
                    // 선택된 스크립트 활성화 (selectScript 호출하지 않고 직접 설정하여 중복 저장 방지)
                    this.sidebarManager.scripts.forEach((script, idx) => {
                        script.active = idx === focusedScriptIndex;
                    });
                    this.sidebarManager.uiManager.updateHeader();
                }

                // UI 업데이트
                this.sidebarManager.uiManager.loadScripts();

                // 포커스된 스크립트 선택 이벤트 발생
                if (this.sidebarManager.scripts.length > 0) {
                    this.sidebarManager.dispatchScriptChangeEvent();
                }
            } else {
                logWarn('[Scripts] ⚠️ ScriptAPI를 사용할 수 없습니다. 기본 스크립트를 사용합니다.');
                logWarn('[Scripts] ScriptAPI:', this.scriptAPI);
                logWarn('[Scripts] window.apiCall:', window.apiCall);
                // API가 없을 때의 폴백 (개발용)
                this.sidebarManager.scripts = [
                    {
                        id: 1,
                        name: '로그인 테스트',
                        description: '사용자 로그인 프로세스 검증',
                        date: '2024. 1. 1.',
                        active: true
                    }
                ];
                this.sidebarManager.uiManager.loadScripts();
            }
        } catch (error) {
            logError('[Scripts] ❌ 스크립트 목록 로드 실패:', error);
            logError('[Scripts] 에러 상세:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            // 에러 발생 시 빈 목록 또는 기본값 표시
            this.sidebarManager.scripts = [];
            this.sidebarManager.uiManager.loadScripts();
        }
    }

    /**
     * 스크립트 순서 변경
     */
    reorderScripts(fromIndex, toIndex) {
        const logger = getLogger();
        const log = logger.log;

        // 인덱스 범위 확인
        if (
            fromIndex < 0 ||
            fromIndex >= this.sidebarManager.scripts.length ||
            toIndex < 0 ||
            toIndex > this.sidebarManager.scripts.length
        ) {
            log(`[Scripts] ⚠️ 유효하지 않은 인덱스 - fromIndex: ${fromIndex}, toIndex: ${toIndex}`);
            return;
        }

        // 같은 위치면 변경하지 않음
        if (fromIndex === toIndex) {
            return;
        }

        log(`[Scripts] 스크립트 순서 변경 - ${fromIndex} -> ${toIndex}`);

        // 배열에서 항목 이동
        const [movedScript] = this.sidebarManager.scripts.splice(fromIndex, 1);

        // toIndex가 배열 길이를 초과하지 않도록 조정
        const adjustedToIndex = Math.min(toIndex, this.sidebarManager.scripts.length);
        this.sidebarManager.scripts.splice(adjustedToIndex, 0, movedScript);

        // 현재 선택된 스크립트 인덱스 업데이트
        if (this.sidebarManager.currentScriptIndex === fromIndex) {
            // 이동한 스크립트가 현재 선택된 스크립트인 경우
            this.sidebarManager.currentScriptIndex = adjustedToIndex;
        } else if (fromIndex < adjustedToIndex) {
            // 아래로 이동한 경우
            if (
                this.sidebarManager.currentScriptIndex > fromIndex &&
                this.sidebarManager.currentScriptIndex <= adjustedToIndex
            ) {
                this.sidebarManager.currentScriptIndex--;
            }
        } else {
            // 위로 이동한 경우
            if (
                this.sidebarManager.currentScriptIndex >= adjustedToIndex &&
                this.sidebarManager.currentScriptIndex < fromIndex
            ) {
                this.sidebarManager.currentScriptIndex++;
            }
        }

        // UI 업데이트
        this.sidebarManager.uiManager.loadScripts();

        // 순서 저장 (비동기) - DB에 execution_order 업데이트
        this.saveScriptOrderToDB().catch((error) => {
            const logger = getLogger();
            logger.error('[Scripts] 스크립트 실행 순서 DB 저장 실패:', error);
        });

        log('[Scripts] ✅ 스크립트 순서 변경 완료');
    }

    /**
     * 스크립트 실행 순서를 DB에 저장 (execution_order 업데이트)
     */
    async saveScriptOrderToDB() {
        const logger = getLogger();
        const log = logger.log;
        const logWarn = logger.warn;
        const logError = logger.error;

        // 현재 순서대로 execution_order 설정 (0부터 시작)
        // 이 순서는 '전체 실행' 시에도 사용됨
        const scriptOrders = this.sidebarManager.scripts.map((script, index) => ({
            id: script.id,
            order: index
        }));

        try {
            // ScriptAPI를 통해 DB에 실행 순서 업데이트
            if (this.scriptAPI && typeof this.scriptAPI.updateScriptOrder === 'function') {
                await this.scriptAPI.updateScriptOrder(scriptOrders);
                log('[Scripts] 스크립트 실행 순서 DB에 저장됨:', scriptOrders);
            } else {
                logWarn('[Scripts] ScriptAPI.updateScriptOrder를 사용할 수 없습니다.');
            }
        } catch (error) {
            logError('[Scripts] 스크립트 실행 순서 DB 저장 실패:', error);
            throw error;
        }
    }

    /**
     * 스크립트 순서를 서버에 저장 (기존 방식 - 호환성 유지)
     */
    async saveScriptOrder() {
        const logger = getLogger();
        const log = logger.log;
        const logError = logger.error;

        const order = this.sidebarManager.scripts.map((script) => script.id);

        try {
            // 서버에 저장 시도
            if (this.userSettingsAPI) {
                await this.userSettingsAPI.saveSetting('script-order', JSON.stringify(order));
                log('[Scripts] 스크립트 순서 서버에 저장됨:', order);
            } else {
                // 폴백: 로컬 스토리지에 저장
                localStorage.setItem('script-order', JSON.stringify(order));
                log('[Scripts] 스크립트 순서 로컬 스토리지에 저장됨:', order);
            }
        } catch (error) {
            logError('[Scripts] 서버 저장 실패, 로컬 스토리지에 저장:', error);
            // 서버 저장 실패 시 로컬 스토리지에 저장 (폴백)
            localStorage.setItem('script-order', JSON.stringify(order));
        }
    }

    /**
     * 서버에서 스크립트 순서 로드
     */
    async loadScriptOrder() {
        const logger = getLogger();
        const log = logger.log;
        const logError = logger.error;

        try {
            let savedOrder = null;

            // 서버에서 로드 시도
            if (this.userSettingsAPI) {
                try {
                    const orderStr = await this.userSettingsAPI.getSetting('script-order');
                    if (orderStr) {
                        savedOrder = JSON.parse(orderStr);
                        log('[Scripts] 스크립트 순서 서버에서 로드됨:', savedOrder);
                    }
                } catch (error) {
                    log('[Scripts] 서버에서 설정을 찾을 수 없음, 로컬 스토리지 확인');
                }
            }

            // 서버에 없으면 로컬 스토리지에서 로드
            if (!savedOrder) {
                const orderStr = localStorage.getItem('script-order');
                if (orderStr) {
                    savedOrder = JSON.parse(orderStr);
                    log('[Scripts] 스크립트 순서 로컬 스토리지에서 로드됨:', savedOrder);
                }
            }

            return savedOrder;
        } catch (error) {
            logError('[Scripts] 스크립트 순서 로드 실패:', error);
            return null;
        }
    }

    /**
     * 저장된 순서대로 스크립트 배열 재정렬
     */
    applyScriptOrder(savedOrder) {
        if (!savedOrder || savedOrder.length === 0) {
            return;
        }

        const logger = getLogger();
        const log = logger.log;

        // ID를 키로 하는 맵 생성
        const scriptMap = new Map(this.sidebarManager.scripts.map((script) => [script.id, script]));

        // 저장된 순서대로 재정렬
        const orderedScripts = [];
        const usedIds = new Set();

        // 저장된 순서대로 추가
        for (const id of savedOrder) {
            if (scriptMap.has(id)) {
                orderedScripts.push(scriptMap.get(id));
                usedIds.add(id);
            }
        }

        // 저장된 순서에 없는 새 스크립트들을 끝에 추가
        for (const script of this.sidebarManager.scripts) {
            if (!usedIds.has(script.id)) {
                orderedScripts.push(script);
            }
        }

        this.sidebarManager.scripts = orderedScripts;
        log('[Scripts] 저장된 순서 적용 완료');
    }

    /**
     * 스크립트 선택
     * @param {number} index - 선택할 스크립트 인덱스
     * @param {boolean} forceReload - 강제로 다시 로드할지 여부 (기본값: false)
     */
    async selectScript(index, forceReload = false) {
        // 이전 스크립트 정보 저장 (스크립트 변경 전에)
        const previousScript = this.sidebarManager.getCurrentScript();
        this.sidebarManager.previousScript = previousScript;

        // 모든 스크립트 비활성화
        this.sidebarManager.scripts.forEach((script) => (script.active = false));

        // 선택된 스크립트 활성화
        this.sidebarManager.scripts[index].active = true;
        this.sidebarManager.currentScriptIndex = index;

        // 포커스된 스크립트 ID 저장 (비동기, 에러 무시)
        const selectedScript = this.sidebarManager.scripts[index];
        if (selectedScript && selectedScript.id) {
            try {
                await this.userSettingsAPI.saveSetting('focused-script-id', selectedScript.id.toString());
                const logger = getLogger();
                logger.log(`[Scripts] 포커스된 스크립트 ID 저장됨: ${selectedScript.id}`);
            } catch (error) {
                // 에러는 무시 (설정 저장 실패해도 스크립트 선택은 계속 진행)
                const logger = getLogger();
                logger.log('[Scripts] 포커스된 스크립트 ID 저장 실패 (무시):', error);
            }
        }

        // UI 업데이트
        this.sidebarManager.uiManager.loadScripts();

        // 헤더 업데이트
        this.sidebarManager.uiManager.updateHeader();

        // 이벤트 발생 (강제 재로드 플래그 전달)
        this.sidebarManager.dispatchScriptChangeEvent(forceReload);

        const logger = getLogger();
        logger.log('스크립트 선택됨:', this.sidebarManager.scripts[index].name, forceReload ? '(강제 재로드)' : '');
    }

    /**
     * 스크립트 추가 모달 표시
     */
    showAddScriptModal() {
        const content = `
            <h3>새 스크립트 추가</h3>
            <div class="form-group">
                <label for="script-name">스크립트 이름:</label>
                <input type="text" id="script-name" placeholder="스크립트 이름을 입력하세요">
            </div>
            <div class="form-group">
                <label for="script-description">설명:</label>
                <textarea id="script-description" placeholder="스크립트 설명을 입력하세요"></textarea>
            </div>
            <div class="form-actions">
                <button id="add-script-confirm" class="btn btn-primary">추가</button>
                <button id="add-script-cancel" class="btn btn-secondary">취소</button>
            </div>
        `;

        const modalManager = getModalManagerInstance();
        modalManager.show(content);

        // 이벤트 리스너 추가
        document.getElementById('add-script-confirm').addEventListener('click', () => {
            this.addScript();
        });

        document.getElementById('add-script-cancel').addEventListener('click', () => {
            modalManager.close();
        });
    }

    /**
     * 스크립트 추가
     */
    async addScript() {
        const logger = getLogger();
        const log = logger.log;
        const logError = logger.error;
        const scriptName = document.getElementById('script-name').value;
        const scriptDescription = document.getElementById('script-description').value;

        const modalManager = getModalManagerInstance();

        log('[Scripts] addScript() 호출됨');
        log('[Scripts] 입력된 스크립트 이름:', scriptName);
        log('[Scripts] 입력된 스크립트 설명:', scriptDescription);

        if (!scriptName.trim()) {
            log('[Scripts] ⚠️ 스크립트 이름이 비어있음');
            modalManager.showAlert('오류', '스크립트 이름을 입력해주세요.');
            return;
        }

        try {
            if (this.scriptAPI) {
                log('[Scripts] 서버에 스크립트 생성 요청 전송...');
                // 서버에 스크립트 생성 요청
                const result = await this.scriptAPI.createScript(scriptName, scriptDescription || '');
                log('[Scripts] ✅ 서버에서 스크립트 생성 성공 응답 받음:', result);
                log('[Scripts] 생성된 스크립트 ID:', result.id);
                log('[Scripts] 생성된 스크립트 이름:', result.name);

                // 클라이언트에서 목록에 추가 (효율적인 방식)
                log('[Scripts] 클라이언트에서 스크립트 목록 업데이트 시작');
                const newScript = {
                    id: result.id,
                    name: result.name,
                    description: result.description || '',
                    date: formatDate(result.updated_at || result.created_at),
                    active: false
                };

                // 목록 맨 앞에 추가 (최신 스크립트가 위에 오도록)
                this.sidebarManager.scripts.unshift(newScript);
                log('[Scripts] 스크립트 목록에 추가됨 - ID:', result.id, '이름:', result.name);

                // 순서 저장 (비동기)
                this.saveScriptOrder().catch((error) => {
                    logger.error('[Scripts] 스크립트 순서 저장 실패:', error);
                });

                // UI 업데이트
                this.sidebarManager.uiManager.loadScripts();

                // 새로 생성된 스크립트를 선택 (맨 앞에 추가했으므로 인덱스 0)
                log('[Scripts] 새로 생성된 스크립트 선택 - 인덱스: 0');
                await this.selectScript(0);

                // 헤더 업데이트
                this.sidebarManager.uiManager.updateHeader();

                log('[Scripts] ✅ 스크립트 추가 완료');
                log('[Scripts] 현재 스크립트 개수:', this.sidebarManager.scripts.length);
            } else {
                log('[Scripts] ⚠️ ScriptAPI를 사용할 수 없음. 로컬 폴백 사용');
                // API가 없을 때의 폴백
                const newScript = {
                    id: Date.now(),
                    name: scriptName,
                    description: scriptDescription || '설명 없음',
                    date: new Date().toLocaleDateString('ko-KR'),
                    active: false
                };

                this.sidebarManager.scripts.push(newScript);
                this.sidebarManager.uiManager.loadScripts();
            }

            modalManager.close();
        } catch (error) {
            logError('[Scripts] ❌ 스크립트 추가 실패:', error);
            logError('[Scripts] 에러 상세:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            modalManager.showAlert('오류', `스크립트 추가 실패: ${error.message}`);
        }
    }

    /**
     * 스크립트 삭제
     */
    async deleteScript(index) {
        if (index < 0 || index >= this.sidebarManager.scripts.length) {
            const logger = getLogger();
            logger.log('[Scripts] ⚠️ 유효하지 않은 스크립트 인덱스:', index);
            return;
        }

        const script = this.sidebarManager.scripts[index];

        const logger = getLogger();
        const log = logger.log;
        const logError = logger.error;
        const modalManager = getModalManagerInstance();

        log('[Scripts] deleteScript() 호출됨');
        log('[Scripts] 삭제 대상 스크립트:', { id: script.id, name: script.name, index: index });

        // 사용자 확인 모달 표시 (사용자 경험 향상)
        modalManager.showConfirm(
            '스크립트 삭제',
            `<div style="text-align: center; padding: 10px 0;">
                <p style="font-size: 16px; margin-bottom: 10px; color: #e2e8f0;">
                    <strong>"${script.name}"</strong> 스크립트를 삭제하시겠습니까?
                </p>
                <p style="font-size: 14px; color: #a0aec0; margin-top: 10px;">
                    이 작업은 되돌릴 수 없습니다.
                </p>
            </div>`,
            async () => {
                log('[Scripts] 사용자가 삭제 확인함');

                try {
                    if (this.scriptAPI) {
                        log('[Scripts] 서버에 스크립트 삭제 요청 전송...');
                        // 서버에 삭제 요청
                        const result = await this.scriptAPI.deleteScript(script.id);
                        log('[Scripts] ✅ 서버에서 스크립트 삭제 성공 응답 받음:', result);

                        // 클라이언트에서 목록에서 삭제 (효율적인 방식)
                        log('[Scripts] 클라이언트에서 스크립트 목록 업데이트 시작');
                        const deletedIndex = this.sidebarManager.scripts.findIndex((s) => s.id === script.id);
                        if (deletedIndex >= 0) {
                            this.sidebarManager.scripts.splice(deletedIndex, 1);
                            log('[Scripts] 스크립트 목록에서 삭제됨 - 인덱스:', deletedIndex);
                        }

                        // 현재 선택된 스크립트 인덱스 조정
                        if (this.sidebarManager.currentScriptIndex >= deletedIndex && deletedIndex >= 0) {
                            this.sidebarManager.currentScriptIndex = Math.max(
                                0,
                                this.sidebarManager.currentScriptIndex - 1
                            );
                        }

                        // 순서 저장 (비동기)
                        this.saveScriptOrder().catch((error) => {
                            logger.error('[Scripts] 스크립트 순서 저장 실패:', error);
                        });

                        // UI 업데이트
                        this.sidebarManager.uiManager.loadScripts();

                        // 삭제된 스크립트가 현재 선택된 스크립트였던 경우
                        if (this.sidebarManager.scripts.length > 0) {
                            // 첫 번째 스크립트 선택
                            log('[Scripts] 첫 번째 스크립트 선택');
                            await this.selectScript(0);
                        } else {
                            // 스크립트가 모두 삭제된 경우
                            log('[Scripts] 모든 스크립트가 삭제됨');
                            this.sidebarManager.currentScriptIndex = -1;
                            this.sidebarManager.uiManager.updateHeader();
                            // 헤더 초기화
                            const titleEl = document.querySelector('.script-title');
                            const descEl = document.querySelector('.script-description');
                            if (titleEl) {
                                titleEl.textContent = '스크립트 없음';
                            }
                            if (descEl) {
                                descEl.textContent = '새 스크립트를 추가하세요.';
                            }
                        }

                        log('[Scripts] ✅ 스크립트 삭제 완료:', script.name);
                        log('[Scripts] 남은 스크립트 개수:', this.sidebarManager.scripts.length);

                        // 성공 메시지 표시
                        modalManager.showAlert('삭제 완료', `"${script.name}" 스크립트가 삭제되었습니다.`);
                    } else {
                        log('[Scripts] ⚠️ ScriptAPI를 사용할 수 없음. 로컬 폴백 사용');
                        // API가 없을 때의 폴백
                        this.sidebarManager.scripts.splice(index, 1);

                        // 현재 선택된 스크립트가 삭제된 경우
                        if (this.sidebarManager.currentScriptIndex >= index) {
                            this.sidebarManager.currentScriptIndex = Math.max(
                                0,
                                this.sidebarManager.currentScriptIndex - 1
                            );
                        }

                        this.sidebarManager.uiManager.loadScripts();
                        this.sidebarManager.uiManager.updateHeader();
                        this.sidebarManager.dispatchScriptChangeEvent();

                        log('[Scripts] 로컬에서 스크립트 삭제됨:', script.name);
                    }
                } catch (error) {
                    logError('[Scripts] ❌ 스크립트 삭제 실패:', error);
                    logError('[Scripts] 에러 상세:', {
                        name: error.name,
                        message: error.message,
                        stack: error.stack
                    });
                    modalManager.showAlert('삭제 실패', `스크립트 삭제 중 오류가 발생했습니다: ${error.message}`);
                }
            },
            () => {
                log('[Scripts] 사용자가 삭제 취소함');
            }
        );
    }

    /**
     * 모든 스크립트를 순차적으로 실행
     * 최상단 스크립트부터 차례대로 하나씩 실행합니다.
     * 각 스크립트를 선택하고, 기존 실행 방식대로 노드 하나씩 서버에 요청을 보냅니다.
     */
    /**
     * 단일 스크립트 실행 (핵심 로직 통합)
     * 스크립트 선택, 실행, 기록 저장, 이벤트 발생 등 모든 핵심 로직을 포함합니다.
     *
     * @param {Object} script - 실행할 스크립트 객체
     * @param {Object} options - 실행 옵션
     * @param {boolean} options.isRunningAllScripts - 전체 실행 중인지 여부
     * @returns {Promise<Object>} 실행 결과 {success: boolean, message: string, error?: string}
     */
    async executeSingleScript(script, options = {}) {
        const logger = getLogger();
        const log = logger.log;
        const logError = logger.error;
        const logWarn = logger.warn;

        const {
            isRunningAllScripts = false,
            allScriptsExecutionStartTime = null,
            scriptExecutionOrder = null
        } = options;

        // getWorkflowPage 함수 정의 (메서드 전체에서 사용 가능하도록 상단에 정의)
        const getWorkflowPage = () => {
            if (window.workflowPage) {
                return window.workflowPage;
            }
            if (window.getWorkflowPageInstance) {
                return window.getWorkflowPageInstance();
            }
            return null;
        };

        log(`[Scripts] 단일 스크립트 실행 시작: ${script.name} (ID: ${script.id})`);

        try {
            // 0. 워크플로우 페이지로 자동 이동 (전체 실행 중이 아닌 경우에만)
            if (!isRunningAllScripts) {
                const pageRouter = getPageRouterInstance();
                if (pageRouter && pageRouter.currentPage !== 'editor') {
                    log('[Scripts] 워크플로우 페이지로 자동 이동');
                    pageRouter.showPage('editor');
                    // 페이지 전환 후 로드 대기
                    await new Promise((resolve) => setTimeout(resolve, 300));
                }
            }

            // 1. 스크립트 선택 (포커스)
            const allScripts = this.sidebarManager.scripts;
            const localIndex = allScripts.findIndex((s) => s.id === script.id);

            if (localIndex === -1) {
                // 로컬에 없으면 서버에서 다시 로드
                await this.loadScriptsFromServer();
                const newLocalIndex = this.sidebarManager.scripts.findIndex((s) => s.id === script.id);
                if (newLocalIndex === -1) {
                    logWarn(`[Scripts] 스크립트 "${script.name}" (ID: ${script.id})를 찾을 수 없습니다.`);
                    return {
                        success: false,
                        message: `스크립트를 찾을 수 없습니다: ${script.name}`,
                        error: 'SCRIPT_NOT_FOUND'
                    };
                }
                await this.selectScript(newLocalIndex);
            } else {
                await this.selectScript(localIndex);
            }

            // 2. 스크립트 로드 완료 대기 (노드들이 화면에 렌더링될 때까지)
            await new Promise((resolve) => setTimeout(resolve, 500));

            // 3. WorkflowPage 인스턴스 가져오기
            const workflowPage = getWorkflowPage();
            if (!workflowPage || !workflowPage.executionService) {
                logWarn('[Scripts] WorkflowPage 또는 ExecutionService를 찾을 수 없습니다.');
                return {
                    success: false,
                    message: '워크플로우 실행 서비스를 찾을 수 없습니다.',
                    error: 'EXECUTION_SERVICE_NOT_FOUND'
                };
            }

            // 4. 현재 화면의 노드들이 있는지 확인
            const nodes = document.querySelectorAll('.workflow-node');
            if (nodes.length === 0) {
                logWarn(`[Scripts] 스크립트 "${script.name}"에 실행할 노드가 없습니다.`);
                return {
                    success: true,
                    message: '실행할 노드가 없음'
                };
            }

            log(`[Scripts] 스크립트 "${script.name}" 실행 시작 - 노드 개수: ${nodes.length}개`);

            // 5. 대시보드에 실행 시작 이벤트 전달
            document.dispatchEvent(
                new CustomEvent('scriptExecutionStarted', {
                    detail: { scriptId: script.id, scriptName: script.name }
                })
            );

            // 6. 실행 서비스에 플래그 설정
            workflowPage.executionService.isCancelled = this.sidebarManager.isCancelled;
            workflowPage.executionService.isRunningAllScripts = isRunningAllScripts;

            // 전체 실행 시작 시간 설정 (전체 실행인 경우)
            if (isRunningAllScripts && allScriptsExecutionStartTime) {
                workflowPage.executionService.allScriptsExecutionStartTime = allScriptsExecutionStartTime;
            } else if (!isRunningAllScripts) {
                // 단일 실행인 경우 전체 실행 시작 시간 초기화
                workflowPage.executionService.allScriptsExecutionStartTime = null;
            }

            // 전체 실행 시 스크립트 실행 순서 설정
            if (isRunningAllScripts && scriptExecutionOrder !== null) {
                workflowPage.executionService.scriptExecutionOrder = scriptExecutionOrder;
            } else if (!isRunningAllScripts) {
                // 단일 실행인 경우 실행 순서 초기화
                workflowPage.executionService.scriptExecutionOrder = null;
            }

            // 7. 워크플로우 실행
            await workflowPage.executionService.execute();

            // 8. 취소되었는지 확인
            if (this.sidebarManager.isCancelled || workflowPage.executionService.isCancelled) {
                log('[Scripts] 실행이 취소되었습니다.');
                return {
                    success: false,
                    message: '실행이 취소되었습니다.',
                    error: 'CANCELLED'
                };
            }

            // 9. 실행 기록 저장
            const executionStartTime = workflowPage.executionService?.executionStartTime;
            const executionTimeMs = executionStartTime ? Date.now() - executionStartTime : null;

            try {
                const dashboardManager = getDashboardManagerInstance();
                if (dashboardManager && typeof dashboardManager.recordScriptExecution === 'function') {
                    await dashboardManager.recordScriptExecution(script.id, {
                        status: 'success',
                        error_message: null,
                        execution_time_ms: executionTimeMs
                    });
                    log(`[Scripts] 스크립트 실행 기록 저장 완료 - 스크립트 ID: ${script.id}`);
                }
            } catch (recordError) {
                logWarn(`[Scripts] 스크립트 실행 기록 저장 실패 (무시): ${recordError.message}`);
            }

            // 10. 대시보드에 실행 완료 이벤트 전달
            document.dispatchEvent(
                new CustomEvent('scriptExecutionCompleted', {
                    detail: { scriptId: script.id, scriptName: script.name, status: 'success' }
                })
            );

            // 11. 실행 기록 페이지에 로그 업데이트 알림 (단일 실행 완료 시)
            // 서버에서 로그가 저장될 때까지 확인 후 이벤트 dispatch
            if (!isRunningAllScripts) {
                await this.waitForLogsAndDispatch(script.id, script.name, 'workflowExecutionCompleted');
            }

            log(`[Scripts] ✅ 스크립트 "${script.name}" 실행 완료`);
            return {
                success: true,
                message: t('common.executionCompletedSuccessfully')
            };
        } catch (execError) {
            logError(`[Scripts] ❌ 스크립트 "${script.name}" 실행 중 오류 발생:`, execError);
            logError('[Scripts] 에러 상세:', {
                name: execError.name,
                message: execError.message,
                stack: execError.stack
            });

            // 실행 기록 저장 (실패)
            try {
                const workflowPage = getWorkflowPage();
                const executionStartTime = workflowPage?.executionService?.executionStartTime;
                const executionTimeMs = executionStartTime ? Date.now() - executionStartTime : null;

                const dashboardManager = getDashboardManagerInstance();
                if (dashboardManager && typeof dashboardManager.recordScriptExecution === 'function') {
                    await dashboardManager.recordScriptExecution(script.id, {
                        status: 'error',
                        error_message: execError.message,
                        execution_time_ms: executionTimeMs
                    });
                    log(`[Scripts] 스크립트 실행 기록 저장 완료 (실패) - 스크립트 ID: ${script.id}`);
                }
            } catch (recordError) {
                logWarn(`[Scripts] 스크립트 실행 기록 저장 실패 (무시): ${recordError.message}`);
            }

            // 대시보드에 실행 실패 이벤트 전달
            document.dispatchEvent(
                new CustomEvent('scriptExecutionCompleted', {
                    detail: {
                        scriptId: script.id,
                        scriptName: script.name,
                        status: 'failed',
                        error: execError.message
                    }
                })
            );

            // 실행 기록 페이지에 로그 업데이트 알림 (실패 시)
            // 서버에서 로그가 저장될 때까지 확인 후 이벤트 dispatch
            if (!isRunningAllScripts) {
                await this.waitForLogsAndDispatch(script.id, script.name, 'workflowExecutionFailed');
            }

            return {
                success: false,
                message: execError.message,
                error: execError.message
            };
        }
    }

    async runAllScripts() {
        const logger = getLogger();
        const log = logger.log;
        const logError = logger.error;
        const logWarn = logger.warn;

        log('[Scripts] runAllScripts() 호출됨');

        // 실행 중 플래그 설정 (중복 실행 방지 / 취소 처리)
        if (this.sidebarManager.isRunningAllScripts === true) {
            // 실행 중인 경우 취소 처리
            log('[Scripts] 실행 취소 요청');
            this.sidebarManager.cancelExecution();
            return;
        }

        this.sidebarManager.isRunningAllScripts = true;
        this.sidebarManager.isCancelled = false; // 취소 플래그 초기화

        // 버튼 상태 설정 (다른 버튼 비활성화, 실행 중인 버튼 활성화)
        this.sidebarManager.setButtonsState('running', 'run-all-scripts-btn');

        // 서버에서 최신 스크립트 목록 조회 (DB의 active 필드 기준)
        log('[Scripts] 서버에서 최신 스크립트 목록 조회 중...');
        let allScripts = [];
        try {
            if (this.scriptAPI && typeof this.scriptAPI.getAllScripts === 'function') {
                allScripts = await this.scriptAPI.getAllScripts();
                log(`[Scripts] 서버에서 ${allScripts.length}개 스크립트 조회 완료`);
            } else {
                logWarn('[Scripts] ScriptAPI를 사용할 수 없습니다. 로컬 스크립트 목록 사용');
                allScripts = this.sidebarManager.scripts;
            }
        } catch (error) {
            logError('[Scripts] 스크립트 목록 조회 실패, 로컬 스크립트 목록 사용:', error);
            allScripts = this.sidebarManager.scripts;
        }

        // DB의 active 필드를 기준으로 활성화된 스크립트만 필터링
        // active가 true이거나 undefined인 경우 활성으로 간주 (기본값 1)
        const activeScripts = allScripts.filter((script) => {
            const isActive = script.active !== undefined ? script.active : true;
            return isActive === true || isActive === 1;
        });

        if (activeScripts.length === 0) {
            logWarn('[Scripts] 실행할 활성화된 스크립트가 없습니다.');
            const modalManager = getModalManagerInstance();
            if (modalManager) {
                modalManager.showAlert('알림', '실행할 활성화된 스크립트가 없습니다.');
            }
            this.sidebarManager.isRunningAllScripts = false;
            this.sidebarManager.setButtonsState('idle');
            return;
        }

        // 워크플로우 페이지로 자동 이동
        const pageRouter = getPageRouterInstance();
        if (pageRouter && pageRouter.currentPage !== 'editor') {
            log('[Scripts] 전체 실행: 워크플로우 페이지로 자동 이동');
            pageRouter.showPage('editor');
            // 페이지 전환 후 로드 대기
            await new Promise((resolve) => setTimeout(resolve, 300));
        }

        // 스크립트 개수 기준 카운터 (try-catch 블록 밖에서 선언)
        let successCount = 0;
        let failCount = 0;
        const totalCount = activeScripts.length;

        // 스크립트 실행 결과 수집 (실행 결과 모달 표시용)
        const scriptResults = [];

        // 모든 스크립트의 execution_id 수집 (로그 저장 완료 확인용)
        const executionIds = [];

        // 전체 실행 시작 시간 저장 (모든 스크립트가 같은 날짜+시간 폴더 사용)
        const allScriptsExecutionStartTime = new Date().toISOString();

        // WorkflowPage 인스턴스 가져오기 (finally 블록에서도 접근 가능하도록 밖에서 정의)
        const getWorkflowPage = () => {
            // window에서 직접 접근 시도
            if (window.workflowPage) {
                return window.workflowPage;
            }
            // 모듈에서 가져오기 시도
            if (window.getWorkflowPageInstance) {
                return window.getWorkflowPageInstance();
            }
            return null;
        };

        // 전체 실행 시작 시 통계 초기화
        try {
            const dashboardManager = getDashboardManagerInstance();
            if (dashboardManager && typeof dashboardManager.resetExecutionStats === 'function') {
                await dashboardManager.resetExecutionStats();
                log('[Scripts] 전체 실행 통계 초기화 완료');
            }
        } catch (resetError) {
            logWarn(`[Scripts] 전체 실행 통계 초기화 실패 (무시): ${resetError.message}`);
        }

        try {
            const modalManager = getModalManagerInstance();

            log(`[Scripts] 총 ${totalCount}개 활성화된 스크립트 실행 시작`);

            // 최상단 스크립트부터 순차적으로 실행 (활성화된 스크립트만)
            for (let i = 0; i < activeScripts.length; i++) {
                // 취소 플래그 체크
                if (this.sidebarManager.isCancelled) {
                    log('[Scripts] 실행이 취소되었습니다.');
                    // 실행 취소 시 남은 스크립트들을 중단으로 표시
                    for (let j = i + 1; j < activeScripts.length; j++) {
                        const remainingScript = activeScripts[j];
                        scriptResults.push({
                            name: remainingScript.name || remainingScript.id || t('common.unknownScript'),
                            status: 'cancelled',
                            message: t('common.cancelledDueToCancellation')
                        });
                    }
                    // modalManager 인스턴스가 있는경우 실행 취소 모달 표시
                    if (modalManager) {
                        const { getResultModalManagerInstance } = await import('../../utils/result-modal.js');
                        const resultModalManager = getResultModalManagerInstance();
                        resultModalManager.showExecutionResult(t('common.executionCancelled'), {
                            successCount,
                            failCount,
                            cancelledCount: activeScripts.length - successCount - failCount,
                            scripts: scriptResults,
                            summaryLabel: t('sidebar.scripts')
                        });
                    }
                    break;
                }

                const script = activeScripts[i];
                log(`[Scripts] 스크립트 ${i + 1}/${activeScripts.length} 실행 중: ${script.name} (ID: ${script.id})`);

                // 대시보드에 실행 시작 이벤트 전달 (인덱스 정보 포함)
                document.dispatchEvent(
                    new CustomEvent('scriptExecutionStarted', {
                        detail: { scriptId: script.id, scriptName: script.name, index: i, total: activeScripts.length }
                    })
                );

                // executeSingleScript를 사용하여 스크립트 실행 (전체 실행 모드)
                // 전체 실행 시작 시간을 전달하여 모든 스크립트가 같은 날짜+시간 폴더 사용
                // 실행 순서도 전달하여 폴더명에 포함
                const result = await this.executeSingleScript(script, {
                    isRunningAllScripts: true,
                    allScriptsExecutionStartTime: allScriptsExecutionStartTime,
                    scriptExecutionOrder: i + 1 // 1부터 시작하는 실행 순서
                });

                // execution_id 수집 (로그 저장 완료 확인용)
                const workflowPage = getWorkflowPage();
                if (workflowPage?.executionService?.lastExecutionId) {
                    executionIds.push(workflowPage.executionService.lastExecutionId);
                }

                // 마지막 스크립트가 아니면 실행 간격 대기
                if (i < activeScripts.length - 1) {
                    try {
                        // 스크립트 실행 간격 설정 가져오기
                        const scriptInterval = await UserSettingsAPI.getSetting('execution.scriptInterval');
                        const interval = scriptInterval !== null ? parseFloat(scriptInterval) : 0.5; // 기본값 0.5초

                        if (interval > 0 && !isNaN(interval)) {
                            log(`[Scripts] 스크립트 실행 간격 대기: ${interval}초`);
                            await new Promise((resolve) => setTimeout(resolve, interval * 1000));
                            log('[Scripts] 스크립트 실행 간격 대기 완료');
                        }
                    } catch (intervalError) {
                        logWarn(
                            `[Scripts] 스크립트 실행 간격 설정 조회 실패 (기본값 0.5초 사용): ${intervalError.message}`
                        );
                        // 기본값 0.5초 사용
                        await new Promise((resolve) => setTimeout(resolve, 500));
                    }
                }

                // 결과 처리 및 즉시 통계 업데이트
                if (result.success) {
                    successCount++;
                    scriptResults.push({
                        name: script.name || script.id || t('common.unknownScript'),
                        status: 'success',
                        message: result.message || t('common.executionCompletedSuccessfully')
                    });

                    // 성공 시 즉시 통계 업데이트
                    try {
                        const dashboardManager = getDashboardManagerInstance();
                        if (dashboardManager && typeof dashboardManager.incrementExecutionCount === 'function') {
                            await dashboardManager.incrementExecutionCount(true);
                            log(`[Scripts] 전체 실행 횟수 증가 완료 (성공) - 스크립트: ${script.name}`);
                        }
                    } catch (incrementError) {
                        logWarn(`[Scripts] 전체 실행 횟수 증가 실패 (무시): ${incrementError.message}`);
                    }
                } else {
                    failCount++;
                    scriptResults.push({
                        name: script.name || script.id || '알 수 없는 스크립트',
                        status: result.error === 'CANCELLED' ? 'cancelled' : 'failed',
                        error: result.error,
                        message: result.message
                    });

                    // 실패 시 즉시 통계 업데이트 (취소가 아닌 경우만)
                    if (result.error !== 'CANCELLED') {
                        try {
                            const dashboardManager = getDashboardManagerInstance();
                            if (dashboardManager && typeof dashboardManager.incrementExecutionCount === 'function') {
                                await dashboardManager.incrementExecutionCount(false);
                                log(`[Scripts] 전체 실행 횟수 증가 완료 (실패) - 스크립트: ${script.name}`);
                            }
                        } catch (incrementError) {
                            logWarn(`[Scripts] 전체 실행 횟수 증가 실패 (무시): ${incrementError.message}`);
                        }
                    }

                    // 취소된 경우 루프 종료
                    if (result.error === 'CANCELLED') {
                        log('[Scripts] 실행이 취소되었습니다.');
                        // 남은 스크립트들을 중단으로 표시
                        for (let j = i + 1; j < activeScripts.length; j++) {
                            const remainingScript = activeScripts[j];
                            scriptResults.push({
                                name: remainingScript.name || remainingScript.id || t('common.unknownScript'),
                                status: 'cancelled',
                                message: t('common.cancelledDueToCancellation')
                            });
                        }
                        break;
                    }
                }
            }

            log(`[Scripts] 모든 스크립트 실행 완료 - 성공: ${successCount}개, 실패: ${failCount}개`);

            // 전체 실행 요약 정보 저장
            try {
                const dashboardManager = getDashboardManagerInstance();
                if (dashboardManager && typeof dashboardManager.recordExecutionSummary === 'function') {
                    await dashboardManager.recordExecutionSummary({
                        total_executions: activeScripts.length,
                        failed_count: failCount
                    });
                    log(
                        `[Scripts] 전체 실행 요약 정보 저장 완료 - 총 실행: ${activeScripts.length}, 실패: ${failCount}`
                    );
                }
            } catch (summaryError) {
                logWarn(`[Scripts] 전체 실행 요약 정보 저장 실패 (무시): ${summaryError.message}`);
            }

            // 대시보드에 전체 실행 완료 이벤트 전달
            document.dispatchEvent(
                new CustomEvent('allScriptsExecutionCompleted', {
                    detail: { successCount, failCount, totalCount: activeScripts.length }
                })
            );

            // 실행 결과 모달 표시 (가운데 팝업)
            if (modalManager) {
                const title = this.sidebarManager.isCancelled
                    ? t('common.executionCancelled')
                    : t('common.executionCompleted');
                const cancelledCount = activeScripts.length - successCount - failCount;
                const { getResultModalManagerInstance } = await import('../../utils/result-modal.js');
                const resultModalManager = getResultModalManagerInstance();
                resultModalManager.showExecutionResult(title, {
                    successCount,
                    failCount,
                    cancelledCount,
                    scripts: scriptResults,
                    summaryLabel: t('sidebar.scripts')
                });
            }
        } catch (error) {
            // 대시보드에 전체 실행 실패 이벤트 전달
            document.dispatchEvent(
                new CustomEvent('allScriptsExecutionCompleted', {
                    detail: {
                        successCount: 0,
                        failCount: activeScripts.length,
                        totalCount: activeScripts.length,
                        error: error.message
                    }
                })
            );

            logError('[Scripts] ❌ 모든 스크립트 실행 중 오류 발생:', error);
            logError('[Scripts] 에러 상세:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });

            const modalManager = getModalManagerInstance();
            if (modalManager) {
                const cancelledCount = activeScripts.length - successCount - failCount;
                const { getResultModalManagerInstance } = await import('../../utils/result-modal.js');
                const resultModalManager = getResultModalManagerInstance();
                resultModalManager.showExecutionResult('실행 오류', {
                    successCount,
                    failCount,
                    cancelledCount,
                    scripts: scriptResults,
                    summaryLabel: '스크립트'
                });
            }
        } finally {
            // 로딩 오버레이 표시 (모든 로그 저장 완료 대기)
            this.showLoadingOverlay();

            try {
                // 모든 execution_id의 로그 저장 완료 확인
                if (executionIds.length > 0) {
                    log(`[Scripts] 전체 실행 완료 - ${executionIds.length}개 스크립트의 로그 저장 완료 대기 중...`);

                    // 모든 execution_id에 대해 로그 저장 완료 확인 (병렬 처리)
                    const checkPromises = executionIds.map(async (executionId) => {
                        try {
                            // completed 또는 failed 상태의 로그가 저장될 때까지 대기
                            await LogAPI.checkLogsReady(executionId, null);
                            log(`[Scripts] 로그 저장 완료 확인 - execution_id: ${executionId}`);
                        } catch (error) {
                            logWarn(
                                `[Scripts] 로그 저장 완료 확인 실패 - execution_id: ${executionId}: ${error.message}`
                            );
                        }
                    });

                    // 모든 로그 저장 완료 대기
                    await Promise.all(checkPromises);
                    log('[Scripts] 모든 로그 저장 완료 확인됨');
                } else {
                    logWarn('[Scripts] execution_id를 찾을 수 없어 로그 저장 완료 확인 건너뜀');
                }
            } catch (error) {
                logWarn(`[Scripts] 로그 저장 완료 확인 중 오류 발생: ${error.message}`);
            } finally {
                // 로딩 오버레이 숨기기
                this.hideLoadingOverlay();
            }

            // 실행 기록 페이지에 로그 업데이트 알림 (성공/실패 모두)
            // 모든 로그 저장이 완료된 후 이벤트 dispatch
            try {
                document.dispatchEvent(
                    new CustomEvent('logsUpdated', {
                        detail: {
                            type: 'allScriptsExecutionCompleted',
                            successCount,
                            failCount,
                            totalCount: activeScripts.length
                        }
                    })
                );
            } catch (logError) {
                logWarn(`[Scripts] 로그 업데이트 이벤트 전송 실패 (무시): ${logError.message}`);
            }

            // 실행 중 플래그 해제
            this.sidebarManager.isRunningAllScripts = false;
            this.sidebarManager.isCancelled = false;

            // executionService의 전체 실행 플래그도 초기화
            const workflowPage = getWorkflowPage();
            if (workflowPage && workflowPage.executionService) {
                workflowPage.executionService.isRunningAllScripts = false;
            }

            // 버튼 상태 복원
            this.sidebarManager.setButtonsState('idle');
        }
    }

    /**
     * 스크립트 변경 전 현재 워크플로우 저장
     * 노드가 삭제되기 전에 현재 상태를 저장합니다.
     */
    saveCurrentWorkflowBeforeSwitch() {
        const logger = getLogger();
        const log = logger.log;

        // 현재 스크립트 정보 가져오기
        const currentScript = this.sidebarManager.getCurrentScript();
        if (!currentScript) {
            log('현재 스크립트 정보가 없어서 저장 건너뜀');
            return;
        }

        // 현재 노드와 연결선 정보 가져오기
        const currentNodes = window.nodeManager ? window.nodeManager.getAllNodes() : [];
        const currentConnections = window.nodeManager ? window.nodeManager.getAllConnections() : [];

        log('사이드바에서 스크립트 전환 전 저장할 데이터:', {
            script: currentScript.name,
            scriptId: currentScript.id,
            nodes: currentNodes.length,
            connections: currentConnections.length
        });

        // 노드 데이터 상세 로그
        if (currentNodes.length > 0) {
            log('저장할 노드 데이터:', currentNodes);
        }

        // 노드가 없어도 저장 (초기 상태도 보존)
        log('사이드바에서 노드 개수:', currentNodes.length, '연결선 개수:', currentConnections.length);

        // 현재 캔버스 뷰포트 위치 가져오기
        const viewportPosition = this.sidebarManager.getCurrentViewportPosition();

        const workflowData = {
            script: currentScript,
            nodes: currentNodes,
            connections: currentConnections,
            viewport: viewportPosition,
            timestamp: new Date().toISOString()
        };

        // 로컬 스토리지에 저장 (기존 데이터 업데이트 방식)
        const savedWorkflows = JSON.parse(localStorage.getItem('workflows') || '[]');
        const scriptId = currentScript.id;

        // 기존 스크립트 데이터가 있으면 업데이트, 없으면 새로 추가
        const existingIndex = savedWorkflows.findIndex((w) => w.script && w.script.id === scriptId);
        if (existingIndex >= 0) {
            savedWorkflows[existingIndex] = workflowData;
            log('사이드바에서 기존 스크립트 데이터 업데이트:', scriptId);
        } else {
            savedWorkflows.push(workflowData);
            log('사이드바에서 새 스크립트 데이터 추가:', scriptId);
        }

        localStorage.setItem('workflows', JSON.stringify(savedWorkflows));
        log('사이드바에서 스크립트 전환 전 저장 완료:', workflowData);
    }

    /**
     * 스크립트 데이터 저장/로드
     */
    saveScripts() {
        localStorage.setItem('workflow-scripts', JSON.stringify(this.sidebarManager.scripts));
    }

    loadScriptsFromStorage() {
        const saved = localStorage.getItem('workflow-scripts');
        if (saved) {
            try {
                this.sidebarManager.scripts = JSON.parse(saved);
                this.sidebarManager.uiManager.loadScripts();
                this.sidebarManager.uiManager.updateHeader();
            } catch (error) {
                console.error('스크립트 로드 실패:', error);
            }
        }
    }

    /**
     * 로딩 오버레이 표시
     */
    showLoadingOverlay() {
        let overlay = document.getElementById('logs-loading-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'logs-loading-overlay';
            overlay.innerHTML = `
                <div class="loading-overlay-content">
                    <div class="loading-spinner-container">
                        <div class="loading-spinner"></div>
                    </div>
                    <div class="loading-text">
                        ${t('common.savingLogs')}<span class="loading-dots">...</span>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            // dots 애니메이션 효과
            const dotsElement = overlay.querySelector('.loading-dots');
            if (dotsElement) {
                let dotCount = 0;
                this.loadingDotsInterval = setInterval(() => {
                    dotCount = (dotCount % 3) + 1;
                    dotsElement.textContent = '.'.repeat(dotCount);
                }, 500);
            }
        } else {
            overlay.style.display = 'flex';
            // dots 애니메이션 재시작
            const dotsElement = overlay.querySelector('.loading-dots');
            if (dotsElement && !this.loadingDotsInterval) {
                let dotCount = 0;
                this.loadingDotsInterval = setInterval(() => {
                    dotCount = (dotCount % 3) + 1;
                    dotsElement.textContent = '.'.repeat(dotCount);
                }, 500);
            }
        }
    }

    /**
     * 로딩 오버레이 숨기기
     */
    hideLoadingOverlay() {
        const overlay = document.getElementById('logs-loading-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
        // dots 애니메이션 정리
        if (this.loadingDotsInterval) {
            clearInterval(this.loadingDotsInterval);
            this.loadingDotsInterval = null;
        }
    }

    /**
     * 서버에서 로그가 저장될 때까지 대기한 후 logsUpdated 이벤트 dispatch
     * @param {number} scriptId - 스크립트 ID
     * @param {string} scriptName - 스크립트 이름
     * @param {string} eventType - 이벤트 타입 ('workflowExecutionCompleted' | 'workflowExecutionFailed')
     */
    async waitForLogsAndDispatch(scriptId, scriptName, eventType) {
        const logger = getLogger();
        const log = logger.log;
        const logWarn = logger.warn;

        // getWorkflowPage 함수 정의
        const getWorkflowPage = () => {
            if (window.workflowPage) {
                return window.workflowPage;
            }
            if (window.getWorkflowPageInstance) {
                return window.getWorkflowPageInstance();
            }
            return null;
        };

        try {
            // execution_id 가져오기 (workflow-execution-service에서)
            const workflowPage = getWorkflowPage();
            const executionId = workflowPage?.executionService?.lastExecutionId;

            if (!executionId) {
                logWarn('[Scripts] execution_id를 찾을 수 없음, 즉시 이벤트 dispatch');
                // execution_id가 없으면 즉시 이벤트 dispatch
                document.dispatchEvent(
                    new CustomEvent('logsUpdated', {
                        detail: {
                            type: eventType,
                            scriptId: scriptId,
                            scriptName: scriptName
                        }
                    })
                );
                return;
            }

            // 로딩 오버레이 표시
            this.showLoadingOverlay();

            try {
                // 서버에서 로그 저장 완료 신호 대기
                const expectedStatus = eventType === 'workflowExecutionFailed' ? 'failed' : 'completed';
                const result = await LogAPI.checkLogsReady(executionId, expectedStatus);

                if (result && result.data && result.data.ready) {
                    log(`[Scripts] 로그 저장 완료 확인 - execution_id: ${executionId}, 상태: ${expectedStatus}`);
                } else {
                    logWarn(`[Scripts] 로그 저장 확인 타임아웃 또는 실패 - execution_id: ${executionId}`);
                }
            } catch (error) {
                logWarn(`[Scripts] 로그 저장 완료 확인 실패: ${error.message}`);
            } finally {
                // 로딩 오버레이 숨기기
                this.hideLoadingOverlay();
            }

            // 이벤트 dispatch
            document.dispatchEvent(
                new CustomEvent('logsUpdated', {
                    detail: {
                        type: eventType,
                        scriptId: scriptId,
                        scriptName: scriptName
                    }
                })
            );
        } catch (error) {
            logWarn(`[Scripts] 로그 확인 중 오류 발생, 이벤트 dispatch: ${error.message}`);
            // 로딩 오버레이 숨기기
            this.hideLoadingOverlay();
            // 오류 발생 시에도 이벤트 dispatch (폴백)
            document.dispatchEvent(
                new CustomEvent('logsUpdated', {
                    detail: {
                        type: eventType,
                        scriptId: scriptId,
                        scriptName: scriptName
                    }
                })
            );
        }
    }

    /**
     * script_id로 최신 로그가 저장될 때까지 대기 (execution_id가 없는 경우)
     * 이 메서드는 더 이상 사용되지 않지만, 호환성을 위해 유지
     * @param {number} scriptId - 스크립트 ID
     * @param {string} scriptName - 스크립트 이름
     * @param {string} eventType - 이벤트 타입
     */
    async waitForLogsByScriptId(scriptId, scriptName, eventType) {
        // execution_id가 없는 경우 즉시 이벤트 dispatch
        const logger = getLogger();
        logger.warn('[Scripts] execution_id가 없어 즉시 이벤트 dispatch');
        document.dispatchEvent(
            new CustomEvent('logsUpdated', {
                detail: {
                    type: eventType,
                    scriptId: scriptId,
                    scriptName: scriptName
                }
            })
        );
    }
}
