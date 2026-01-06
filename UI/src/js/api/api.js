/**
 * API 호출 공통 유틸리티
 * ES6 모듈 방식으로 작성됨
 */

/**
 * 로거 유틸리티 가져오기 (전역 fallback 포함)
 */
const getLogger = () => {
    return {
        log: window.log || (window.Logger ? window.Logger.log.bind(window.Logger) : console.log),
        error: window.logError || (window.Logger ? window.Logger.error.bind(window.Logger) : console.error)
    };
};

/**
 * API 기본 URL 동적 생성
 * window.API_HOST와 window.API_PORT를 사용 (서버에서 주입)
 * 기본값은 localhost:8000 (fallback)
 *
 * 주의: window.API_HOST, window.API_PORT는 서버에서 HTML에 주입되므로
 * 모듈 로드 시점에는 아직 없을 수 있습니다.
 * 따라서 함수로 만들어서 호출 시점에 동적으로 가져옵니다.
 */
function getApiBaseUrl() {
    if (typeof window === 'undefined') {
        return 'http://localhost:8000'; // 서버 사이드 렌더링 시 기본값
    }

    // window.API_HOST와 window.API_PORT가 주입되었는지 확인
    const host = window.API_HOST || 'localhost';
    const port = window.API_PORT || 8000;
    return `http://${host}:${port}`;
}

// 초기값 (나중에 동적으로 업데이트됨)
export let API_BASE_URL = getApiBaseUrl();

/**
 * API 호출 헬퍼 함수
 *
 * @param {string} endpoint - API 엔드포인트
 * @param {Object} options - 요청 옵션 (method, headers, body 등)
 * @returns {Promise<any>} API 응답 데이터
 */
export async function apiCall(endpoint, options = {}) {
    const logger = getLogger();
    const log = logger.log;
    const logError = logger.error;

    // 호출 시점에 동적으로 API URL 가져오기 (window.API_HOST, API_PORT가 주입되었을 수 있음)
    // apiBaseUrl: API 기본 URL (동적으로 가져옴)
    const apiBaseUrl = getApiBaseUrl();
    // url: 최종 요청 URL (apiBaseUrl + endpoint)
    const url = `${apiBaseUrl}${endpoint}`;
    // method: HTTP 메서드 (기본값: 'GET')
    const method = options.method || 'GET';

    log(`[apiCall] 요청 시작: ${method} ${url}`);

    // defaultOptions: 기본 요청 옵션 (Content-Type 헤더 포함)
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json'
        }
    };

    // config: 최종 요청 설정 (기본 옵션과 사용자 옵션 병합)
    const config = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...(options.headers || {}) // 사용자 헤더가 있으면 병합
        }
    };

    // 요청 본문이 있으면 로그 출력
    if (options.body) {
        log('[apiCall] 요청 본문:', options.body);
    }

    try {
        const startTime = performance.now();
        const response = await fetch(url, config);
        const endTime = performance.now();

        log(`[apiCall] 응답 받음: ${response.status} ${response.statusText}`);
        log(`[apiCall] 응답 시간: ${(endTime - startTime).toFixed(2)}ms`);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: response.statusText }));
            const errorMessage = errorData.detail || `HTTP error! status: ${response.status}`;

            // 404 에러 중 "찾을 수 없습니다"가 포함된 경우는 정보 로그로 출력 (정상적인 경우)
            // 예: 사용자 설정이 없는 경우 등
            if (
                response.status === 404 &&
                (errorMessage.includes('찾을 수 없습니다') ||
                    errorMessage.includes('Not Found') ||
                    errorData.detail?.includes('찾을 수 없습니다'))
            ) {
                // 404는 정상적인 경우이므로 정보 로그로 출력 (에러가 아님)
                log(`[apiCall] ⚠️ 리소스를 찾을 수 없음 (정상, 처음 사용 시): ${response.status} ${endpoint}`);
                // 404 에러를 특별한 에러 타입으로 throw (호출자가 정상 케이스로 처리할 수 있도록)
                const notFoundError = new Error(errorMessage);
                notFoundError.name = 'NotFoundError';
                notFoundError.status = 404;
                throw notFoundError;
            } else {
                logError(`[apiCall] ❌ HTTP 에러: ${response.status}`, errorData);
                throw new Error(errorMessage);
            }
        }

        const data = await response.json();
        log('[apiCall] ✅ 응답 데이터:', data);

        return data;
    } catch (error) {
        const errorMessage = error.message || '';

        // NotFoundError는 정보 로그로 처리 (정상적인 경우)
        // error.name이 'NotFoundError'이거나 404 에러이고 "찾을 수 없습니다"가 포함된 경우
        if (error.name === 'NotFoundError' || (error.status === 404 && errorMessage.includes('찾을 수 없습니다'))) {
            // 404는 정상적인 경우이므로 정보 로그로 출력
            log(`[apiCall] ⚠️ 리소스를 찾을 수 없음 (정상, 처음 사용 시): ${endpoint}`);
            // NotFoundError는 그대로 throw (호출자가 정상 케이스로 처리하도록)
            throw error;
        } else {
            // 그 외의 에러는 상세 로그 출력
            logError(`[apiCall] ❌ API 호출 실패 (${endpoint}):`, error);
            logError('[apiCall] 에러 타입:', error.constructor.name);
            logError('[apiCall] 에러 메시지:', error.message);

            // 네트워크 에러인 경우 추가 정보 출력
            // error.name이 'TypeError'이고 메시지에 'fetch'가 포함된 경우 네트워크 에러로 판단
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                logError('[apiCall] 네트워크 에러 가능성 - 서버가 실행 중인지 확인하세요.');
                logError('[apiCall] 서버 URL:', getApiBaseUrl());
            }
        }

        throw error;
    }
}

// 전역 호환성을 위한 설정 (다른 파일과의 호환성 유지)
// TODO: 다른 파일들이 ES6 모듈로 전환되면 제거
if (typeof window !== 'undefined') {
    window.apiCall = apiCall;
    // API_BASE_URL을 함수로 노출하여 동적으로 가져올 수 있도록 함
    window.getApiBaseUrl = getApiBaseUrl;
    // API_BASE_URL을 getter로 노출 (동적 값 반환)
    Object.defineProperty(window, 'API_BASE_URL', {
        get: getApiBaseUrl,
        configurable: true,
        enumerable: true
    });

    // 초기화 시점에 한 번 더 업데이트 (window.API_HOST, API_PORT가 주입된 후)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            API_BASE_URL = getApiBaseUrl();
        });
    } else {
        API_BASE_URL = getApiBaseUrl();
    }
}
