/**
 * 로그 서비스 클래스
 * 로그 데이터 로드 및 관리 로직을 담당합니다.
 * ES6 모듈 방식으로 작성됨
 */

import { LogAPI } from '../../js/api/logapi.js';

/**
 * 로거 유틸리티 가져오기
 */
const getLogger = () => {
    return {
        log: window.log || (window.Logger ? window.Logger.log.bind(window.Logger) : console.log),
        warn: window.logWarn || (window.Logger ? window.Logger.warn.bind(window.Logger) : console.warn),
        error: window.logError || (window.Logger ? window.Logger.error.bind(window.Logger) : console.error)
    };
};

/**
 * LogService 클래스
 * 로그 데이터 로드, 통계 계산, 그룹화 등의 기능을 제공합니다.
 */
export class LogService {
    constructor() {
        this.logs = [];
    }

    /**
     * 로그 데이터 로드
     * @param {Object} filters - 필터 옵션 (script_id, status, limit)
     * @returns {Promise<void>}
     */
    async loadLogs(filters = {}) {
        const logger = getLogger();
        logger.log('[LogService] loadLogs() 호출됨');
        logger.log('[LogService] 필터 옵션:', filters);

        try {
            // LogAPI에 전달할 필터 준비 (status는 클라이언트 측에서 필터링)
            const apiFilters = {
                script_id: filters.script_id,
                limit: filters.limit || 100
            };

            // LogAPI를 통해 로그 가져오기
            let logs = await LogAPI.getNodeExecutionLogs(apiFilters);

            // status 필터 적용 (클라이언트 측 필터링)
            if (filters.status && filters.status !== 'all') {
                logs = logs.filter((log) => log.status === filters.status);
            }

            // 로그를 시간순으로 정렬 (최신순)
            logs.sort((a, b) => {
                const timeA = new Date(a.started_at || a.created_at || 0).getTime();
                const timeB = new Date(b.started_at || b.created_at || 0).getTime();
                return timeB - timeA;
            });

            this.logs = logs;
            logger.log(`[LogService] 로그 로드 완료: ${this.logs.length}개`);
        } catch (error) {
            logger.error('[LogService] 로그 로드 실패:', error);
            this.logs = [];
            throw error;
        }
    }

    /**
     * 통계 계산
     * @returns {Object} 통계 정보
     */
    calculateStats() {
        // 전체 스크립트 실행 개수 (execution_id 기준 고유 개수)
        const uniqueExecutionIds = new Set(this.logs.filter((log) => log.execution_id).map((log) => log.execution_id));
        const total = uniqueExecutionIds.size;

        const completed = this.logs.filter((log) => log.status === 'completed').length;
        const failed = this.logs.filter((log) => log.status === 'failed').length;

        // 평균 실행 시간 계산
        const executionTimes = this.logs
            .filter((log) => log.execution_time_ms && log.execution_time_ms > 0)
            .map((log) => log.execution_time_ms);

        const averageExecutionTime =
            executionTimes.length > 0 ? executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length : 0;

        return {
            total,
            completed,
            failed,
            averageExecutionTime: Math.round(averageExecutionTime)
        };
    }

    /**
     * 실행 ID별로 로그 그룹화
     * @returns {Object} 실행 ID를 키로 하는 로그 그룹 객체
     */
    groupLogsByExecutionId() {
        const grouped = {};

        this.logs.forEach((log) => {
            const executionId = log.execution_id || 'unknown';
            if (!grouped[executionId]) {
                grouped[executionId] = [];
            }
            grouped[executionId].push(log);
        });

        // 각 그룹 내에서 시간순 정렬 (시작 시간 기준)
        Object.keys(grouped).forEach((executionId) => {
            grouped[executionId].sort((a, b) => {
                const timeA = new Date(a.started_at || a.created_at || 0).getTime();
                const timeB = new Date(b.started_at || b.created_at || 0).getTime();
                return timeA - timeB;
            });
        });

        return grouped;
    }
}
