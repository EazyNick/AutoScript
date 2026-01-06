/**
 * 다국어 지원 (i18n) 유틸리티
 * 언어 설정에 따라 텍스트를 번역합니다.
 */

// 번역 데이터
const translations = {
    ko: {
        // 설정 페이지
        settings: {
            appearance: '외관',
            appearanceSubtitle: '테마와 디스플레이 설정을 변경합니다',
            theme: '테마',
            themeDescription: '앱의 전체 테마를 선택합니다',
            light: '라이트',
            dark: '다크',
            system: '시스템',
            language: '언어',
            languageDescription: '인터페이스 언어를 선택합니다',
            execution: '실행 설정',
            executionSubtitle: '테스트 실행 관련 설정을 변경합니다',
            scriptInterval: '스크립트 실행 간격',
            scriptIntervalDescription: '각 스크립트 간의 실행 간격 (초)',
            screenshot: '스크린샷',
            screenshotSubtitle: '스크린샷 캡처 설정을 변경합니다',
            autoScreenshot: '자동 스크린샷',
            autoScreenshotDescription: '각 스텝 실행 후 자동으로 스크린샷을 저장합니다',
            screenshotOnError: '오류 발생 시 스크린샷',
            screenshotOnErrorDescription: '테스트 실패 시 스크린샷을 저장합니다',
            savePath: '저장 경로',
            savePathDescription: '스크린샷이 저장될 폴더',
            imageFormat: '이미지 형식',
            imageFormatDescription: '스크린샷 파일 형식',
            shortcuts: '키보드 단축키',
            shortcutsSubtitle: '자주 사용하는 기능의 단축키입니다',
            save: '저장',
            undo: '실행 취소',
            redo: '다시 실행',
            deleteNode: '노드 삭제',
            runWorkflow: '워크플로우 실행',
            stopExecution: '실행 중지',
            saveSettings: '설정 저장',
            settingsSaved: '설정이 저장되었습니다',
            workflowSaved: '워크플로우가 성공적으로 저장되었습니다.',
            saveComplete: '저장 완료',
            saveFailed: '저장 실패',
            noScriptSelected: '저장할 스크립트가 선택되지 않았습니다.',
            saveError: '저장 중 오류가 발생했습니다',
            times: '회',
            seconds: '초'
        },
        // 공통
        common: {
            ok: '확인',
            cancel: '취소',
            save: '저장',
            delete: '삭제',
            edit: '편집',
            close: '닫기',
            loading: '로딩 중...',
            success: '성공',
            error: '오류',
            warning: '경고',
            user: '사용자',
            runAll: '전체 실행',
            addNode: '노드 추가',
            run: '실행',
            runAllTitle: '모든 스크립트 실행',
            node: '노드',
            nodes: '노드',
            workflowSaved: '워크플로우가 저장되었습니다.',
            saveComplete: '저장되었습니다',
            saveFailed: '저장 실패',
            noScriptSelected: '저장할 스크립트가 선택되지 않았습니다.',
            saveError: '저장 중 오류가 발생했습니다',
            executionCancelled: '실행 취소',
            executionCompleted: '실행 완료',
            executionCancelledMessage: '실행이 취소되었습니다.',
            cancelledDueToCancellation: '실행 취소로 인해 실행되지 않음',
            cancelledDueToError: '오류로 인해 실행되지 않음',
            workflowExecutionCompleted: '워크플로우 실행 완료',
            successNodes: '성공 노드',
            failedNodes: '실패 노드',
            cancelledNodes: '중단 노드',
            savingLogs: '로그 저장 중',
            running: '실행 중',
            executionSummary: '실행 요약',
            successLabel: '성공',
            failedLabel: '실패',
            cancelledLabel: '중단',
            unit: '개',
            nodeExecutionResults: '노드 실행 결과',
            scriptExecutionResults: '스크립트 실행 결과',
            executionCompletedSuccessfully: '정상 실행 완료',
            unknownNode: '알 수 없는 노드',
            unknownScript: '알 수 없는 스크립트'
        },
        // 사이드바
        sidebar: {
            dashboard: '대시보드',
            scripts: '스크립트',
            history: '실행 기록',
            settings: '설정',
            newWorkflow: '새 워크플로우',
            scriptsTitle: '스크립트'
        },
        // 페이지 헤더
        header: {
            dashboard: '대시보드',
            dashboardSubtitle: '워크플로우 현황을 확인하세요',
            scripts: '스크립트',
            scriptsSubtitle: '워크플로우를 편집하세요',
            history: '실행 기록',
            historySubtitle: '과거 실행 내역 및 노드 실행 로그를 확인하세요',
            settings: '설정',
            settingsSubtitle: '애플리케이션 설정을 관리하세요'
        },
        // 실행 기록 페이지
        history: {
            noLogs: '실행 기록이 없습니다.',
            start: '시작:',
            end: '종료:',
            nodes: '노드:',
            nodesUnit: '개',
            success: '성공:',
            successUnit: '개',
            failed: '실패:',
            failedUnit: '개',
            totalTime: '총 시간:',
            deleteExecution: '이 실행 기록 삭제',
            unknown: '알 수 없음',
            inProgress: '진행 중',
            parameters: '파라미터:',
            result: '결과:',
            error: '에러:',
            stackTrace: '스택 트레이스',
            deleteLog: '로그 삭제',
            deleteLogConfirm: '이 로그를 삭제하시겠습니까?',
            deleteExecutionConfirm: '이 실행 기록의 모든 로그를 삭제하시겠습니까?',
            deleteAllLogs: '전체 로그 삭제',
            deleteAllLogsConfirm: '모든 로그를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
            deleteLogFailed: '로그 삭제에 실패했습니다.',
            deleteExecutionFailed: '실행 기록 삭제에 실패했습니다.',
            deleteAllLogsFailed: '전체 로그 삭제에 실패했습니다.',
            statusCompleted: '완료',
            statusFailed: '실패',
            statusRunning: '실행 중',
            statusUnknown: '알 수 없음',
            allScripts: '전체 스크립트',
            script: '스크립트',
            status: '상태',
            all: '전체',
            refresh: '새로고침',
            deleteAll: '전체 삭제',
            totalLogs: '전체 로그',
            averageExecutionTime: '평균 실행 시간',
            ms: 'ms',
            seconds: '초',
            minutes: '분',
            justNow: '방금 전',
            minutesAgo: '{{minutes}}분 전',
            hoursAgo: '{{hours}}시간 전',
            daysAgo: '{{days}}일 전'
        },
        // 대시보드 페이지
        dashboard: {
            noScripts: '스크립트가 없습니다. 새 워크플로우를 생성하세요.',
            active: '활성',
            inactive: '비활성',
            edit: '편집',
            run: '실행',
            scripts: '스크립트',
            totalWorkflows: '전체 워크플로우',
            totalExecutions: '전체 실행',
            failedScripts: '실패한 스크립트',
            inactiveScripts: '비활성 스크립트',
            justNow: '방금 전',
            minutesAgo: '{{minutes}}분 전',
            hoursAgo: '{{hours}}시간 전',
            daysAgo: '{{days}}일 전'
        },
        // 노드 관련
        node: {
            repeat: {
                title: '반복',
                description: '반복 실행',
                repeatCount: '반복 횟수',
                repeatLabel: '반복',
                outputLabel: '출력',
                connectNodesBelow: '반복할 노드들을 연결',
                repeatComplete: '반복 완료 후 실행'
            }
        }
    },
    en: {
        // 설정 페이지
        settings: {
            appearance: 'Appearance',
            appearanceSubtitle: 'Change theme and display settings',
            theme: 'Theme',
            themeDescription: 'Select the overall theme of the app',
            light: 'Light',
            dark: 'Dark',
            system: 'System',
            language: 'Language',
            languageDescription: 'Select interface language',
            execution: 'Execution Settings',
            executionSubtitle: 'Change test execution related settings',
            scriptInterval: 'Script Execution Interval',
            scriptIntervalDescription: 'Execution interval between each script (seconds)',
            screenshot: 'Screenshot',
            screenshotSubtitle: 'Change screenshot capture settings',
            autoScreenshot: 'Auto Screenshot',
            autoScreenshotDescription: 'Automatically save screenshots after each step execution',
            screenshotOnError: 'Screenshot on Error',
            screenshotOnErrorDescription: 'Save screenshots when tests fail',
            savePath: 'Save Path',
            savePathDescription: 'Folder where screenshots will be saved',
            imageFormat: 'Image Format',
            imageFormatDescription: 'Screenshot file format',
            shortcuts: 'Keyboard Shortcuts',
            shortcutsSubtitle: 'Shortcuts for frequently used features',
            save: 'Save',
            undo: 'Undo',
            redo: 'Redo',
            deleteNode: 'Delete Node',
            runWorkflow: 'Run Workflow',
            stopExecution: 'Stop Execution',
            saveSettings: 'Save Settings',
            settingsSaved: 'Settings saved',
            times: 'times',
            seconds: 'seconds'
        },
        // 공통
        common: {
            ok: 'OK',
            cancel: 'Cancel',
            save: 'Save',
            delete: 'Delete',
            edit: 'Edit',
            close: 'Close',
            loading: 'Loading...',
            success: 'Success',
            error: 'Error',
            warning: 'Warning',
            user: 'User',
            runAll: 'Run All',
            addNode: 'Add Node',
            run: 'Run',
            runAllTitle: 'Run all scripts',
            node: 'Node',
            nodes: 'Nodes',
            workflowSaved: 'Workflow has been saved.',
            saveComplete: 'Saved',
            saveFailed: 'Save Failed',
            noScriptSelected: 'No script selected to save.',
            saveError: 'An error occurred while saving',
            executionCancelled: 'Execution Cancelled',
            executionCompleted: 'Execution Completed',
            executionCancelledMessage: 'Execution has been cancelled.',
            cancelledDueToCancellation: 'Not executed due to cancellation',
            cancelledDueToError: 'Not executed due to error',
            workflowExecutionCompleted: 'Workflow execution completed',
            executionInterrupted: 'Execution Interrupted',
            workflowExecutionError: 'An error occurred during workflow execution',
            successNodes: 'Success Nodes',
            failedNodes: 'Failed Nodes',
            cancelledNodes: 'Cancelled Nodes',
            savingLogs: 'Saving logs',
            running: 'Running',
            executionSummary: 'Execution Summary',
            successLabel: 'Success',
            failedLabel: 'Failed',
            cancelledLabel: 'Cancelled',
            unit: '',
            nodeExecutionResults: 'Node Execution Results',
            scriptExecutionResults: 'Script Execution Results',
            executionCompletedSuccessfully: 'Completed successfully',
            unknownNode: 'Unknown Node',
            unknownScript: 'Unknown Script'
        },
        // 사이드바
        sidebar: {
            dashboard: 'Dashboard',
            scripts: 'Scripts',
            history: 'Execution History',
            settings: 'Settings',
            newWorkflow: 'New Workflow',
            scriptsTitle: 'Scripts'
        },
        // 페이지 헤더
        header: {
            dashboard: 'Dashboard',
            dashboardSubtitle: 'Check workflow status',
            scripts: 'Scripts',
            scriptsSubtitle: 'Edit workflow',
            history: 'Execution History',
            historySubtitle: 'Check past execution history and node execution logs',
            settings: 'Settings',
            settingsSubtitle: 'Manage application settings',
            appTitle: 'Automation Tool'
        },
        // 실행 기록 페이지
        history: {
            noLogs: 'No execution history.',
            start: 'Start:',
            end: 'End:',
            nodes: 'Nodes:',
            nodesUnit: '',
            success: 'Success:',
            successUnit: '',
            failed: 'Failed:',
            failedUnit: '',
            totalTime: 'Total Time:',
            deleteExecution: 'Delete this execution record',
            unknown: 'Unknown',
            inProgress: 'In Progress',
            parameters: 'Parameters:',
            result: 'Result:',
            error: 'Error:',
            stackTrace: 'Stack Trace',
            deleteLog: 'Delete Log',
            deleteLogConfirm: 'Are you sure you want to delete this log?',
            deleteExecutionConfirm: 'Are you sure you want to delete all logs in this execution record?',
            deleteAllLogs: 'Delete All Logs',
            deleteAllLogsConfirm: 'Are you sure you want to delete all logs? This action cannot be undone.',
            deleteLogFailed: 'Failed to delete log.',
            deleteExecutionFailed: 'Failed to delete execution record.',
            deleteAllLogsFailed: 'Failed to delete all logs.',
            statusCompleted: 'Completed',
            statusFailed: 'Failed',
            statusRunning: 'Running',
            statusUnknown: 'Unknown',
            allScripts: 'All Scripts',
            script: 'Script',
            status: 'Status',
            all: 'All',
            refresh: 'Refresh',
            deleteAll: 'Delete All',
            totalLogs: 'Total Logs',
            averageExecutionTime: 'Average Execution Time',
            ms: 'ms',
            seconds: 'seconds',
            minutes: 'minutes'
        },
        // 대시보드 페이지
        dashboard: {
            noScripts: 'No scripts. Create a new workflow.',
            active: 'Active',
            inactive: 'Inactive',
            edit: 'Edit',
            run: 'Run',
            scripts: 'Scripts',
            totalWorkflows: 'Total Workflows',
            totalExecutions: 'Total Executions',
            failedScripts: 'Failed Scripts',
            inactiveScripts: 'Inactive Scripts',
            justNow: 'Just now',
            minutesAgo: '{{minutes}} minutes ago',
            hoursAgo: '{{hours}} hours ago',
            daysAgo: '{{days}} days ago'
        },
        // 노드 관련
        node: {
            repeat: {
                title: 'Repeat',
                description: 'Repeat execution',
                repeatCount: 'Repeat Count',
                repeatLabel: 'Repeat',
                outputLabel: 'Output',
                connectNodesBelow: 'Connect nodes to repeat',
                repeatComplete: 'Execute after repeat completion'
            }
        }
    }
};

/**
 * 현재 언어 가져오기
 */
function getCurrentLanguage() {
    // 로컬 스토리지에서 언어 설정 확인
    const savedSettings = localStorage.getItem('app-settings');
    if (savedSettings) {
        try {
            const parsed = JSON.parse(savedSettings);
            if (parsed.language) {
                return parsed.language;
            }
        } catch (e) {
            // 파싱 실패 시 기본값 사용
        }
    }
    // 기본값은 한국어
    return 'en';
}

/**
 * 번역 함수
 * @param {string} key - 번역 키 (예: 'settings.appearance')
 * @param {object} params - 파라미터 객체 (선택사항)
 * @returns {string} 번역된 텍스트
 */
export function t(key, params = {}) {
    const lang = getCurrentLanguage();
    const keys = key.split('.');
    let value = translations[lang];

    for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
            value = value[k];
        } else {
            // 번역을 찾을 수 없으면 키 반환
            console.warn(`[i18n] Translation not found for key: ${key} (lang: ${lang})`);
            return key;
        }
    }

    // 파라미터 치환
    if (typeof value === 'string' && Object.keys(params).length > 0) {
        return value.replace(/\{\{(\w+)\}\}/g, (match, paramKey) => {
            return params[paramKey] !== undefined ? params[paramKey] : match;
        });
    }

    return value || key;
}

/**
 * 언어 변경
 * @param {string} lang - 언어 코드 ('en' 또는 'ko')
 * @param {boolean} silent - 이벤트를 발생시키지 않을지 여부 (기본값: false)
 */
export async function setLanguage(lang, silent = false) {
    if (!translations[lang]) {
        console.warn(`[i18n] Unsupported language: ${lang}`);
        return;
    }

    // 로컬 스토리지에 저장
    const savedSettings = localStorage.getItem('app-settings');
    let settings = {};
    if (savedSettings) {
        try {
            settings = JSON.parse(savedSettings);
        } catch (e) {
            // 파싱 실패 시 빈 객체 사용
        }
    }

    // language 키로 저장
    settings.language = lang;
    localStorage.setItem('app-settings', JSON.stringify(settings));

    // 서버에도 저장 (silent 모드가 아닐 때만)
    if (!silent) {
        try {
            const { UserSettingsAPI } = await import('../api/user-settings-api.js');
            if (UserSettingsAPI) {
                await UserSettingsAPI.saveSetting('language', lang);
            }
        } catch (error) {
            console.warn('[i18n] Failed to save language to server:', error);
        }
    }

    // HTML lang 속성 업데이트
    document.documentElement.lang = lang;

    // 언어 변경 이벤트 발생 (silent 모드가 아닐 때만)
    if (!silent) {
        document.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: lang } }));
    }
}

/**
 * 현재 언어 가져오기 (외부에서 사용)
 */
export function getLanguage() {
    return getCurrentLanguage();
}

// 전역으로 내보내기 (기존 코드 호환성)
window.i18n = {
    t,
    setLanguage,
    getLanguage
};
