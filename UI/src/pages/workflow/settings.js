/**
 * 설정 페이지 관리 클래스
 * ES6 모듈 방식으로 작성됨
 */

import { getThemeManagerInstance } from '../../js/utils/theme-manager.js';
import { t, setLanguage, getLanguage } from '../../js/utils/i18n.js';
import { getToastManagerInstance } from '../../js/utils/toast.js';

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
 * SettingsManager 클래스
 * 설정 페이지의 데이터 로드 및 UI 업데이트를 담당합니다.
 */
export class SettingsManager {
    constructor() {
        // 테마 관리자에서 현재 테마 가져오기
        const themeManager = getThemeManagerInstance();
        const currentTheme = themeManager ? themeManager.getCurrentTheme() : 'dark';

        this.settings = {
            // 외관 설정
            appearance: {
                theme: currentTheme, // 'light', 'dark', 'system'
                language: 'en' // 'en', 'ko'
            },
            // 실행 설정
            execution: {
                defaultTimeout: 30, // 초
                retryCount: 3 // 회
            },
            // 스크린샷 설정
            screenshot: {
                autoScreenshot: true, // 자동 스크린샷
                screenshotOnError: true, // 오류 시 스크린샷
                savePath: './screenshots', // 저장 경로
                imageFormat: 'PNG' // 'PNG', 'JPEG'
            },
            // 알림 설정
            notifications: {
                completionNotification: true, // 완료 알림
                errorNotification: true, // 오류 알림
                notificationSound: true // 알림 소리
            }
        };
    }

    /**
     * 설정 페이지 초기화
     */
    async init() {
        const logger = getLogger();
        logger.log('[Settings] 설정 페이지 초기화 시작');

        await this.loadSettings();
        // 정적 텍스트 업데이트 (페이지 제목 및 부제목)
        this.updateStaticTexts();
        // 언어 로드 후 설정 페이지를 다시 렌더링하여 번역 적용
        this.renderSettings();
        this.setupEventListeners();
    }

    /**
     * HTML의 정적 텍스트 업데이트
     */
    updateStaticTexts() {
        // 페이지 제목 및 부제목
        const pageTitle = document.querySelector('#page-settings .page-title');
        if (pageTitle) {
            pageTitle.textContent = t('header.settings');
        }
        const pageSubtitle = document.querySelector('#page-settings .page-subtitle');
        if (pageSubtitle) {
            pageSubtitle.textContent = t('header.settingsSubtitle');
        }
    }

    /**
     * 설정 데이터 로드
     */
    async loadSettings() {
        const logger = getLogger();
        logger.log('[Settings] 설정 데이터 로드 시작');

        try {
            // 로컬 스토리지에서 설정 로드
            const savedSettings = localStorage.getItem('app-settings');
            if (savedSettings) {
                const parsed = JSON.parse(savedSettings);
                // 테마는 테마 관리자에서 가져오기
                const themeManager = getThemeManagerInstance();
                if (themeManager && parsed.appearance) {
                    parsed.appearance.theme = themeManager.getCurrentTheme();
                }
                // language 키가 있으면 appearance.language로 설정
                if (parsed.language && parsed.appearance) {
                    parsed.appearance.language = parsed.language;
                }
                this.settings = { ...this.settings, ...parsed };
            } else {
                // 테마 관리자에서 현재 테마 가져오기
                const themeManager = getThemeManagerInstance();
                if (themeManager) {
                    this.settings.appearance.theme = themeManager.getCurrentTheme();
                }
            }

            // 서버에서 설정 로드 (서버 설정이 우선)
            try {
                const { UserSettingsAPI } = await import('../../js/api/user-settings-api.js');
                if (UserSettingsAPI) {
                    // 언어 설정 로드
                    const language = await UserSettingsAPI.getSetting('language');
                    const currentLang = language !== null ? language : 'en';
                    this.settings.appearance.language = currentLang;
                    // i18n 언어 설정 (silent 모드로 호출하여 이벤트 발생 방지)
                    // 로컬 스토리지와 HTML lang 속성만 업데이트 (서버 저장 및 이벤트 발생 안 함)
                    await setLanguage(currentLang, true);

                    // 스크린샷 설정 로드
                    const autoScreenshot = await UserSettingsAPI.getSetting('screenshot.autoScreenshot');
                    const screenshotOnError = await UserSettingsAPI.getSetting('screenshot.screenshotOnError');
                    const savePath = await UserSettingsAPI.getSetting('screenshot.savePath');
                    const imageFormat = await UserSettingsAPI.getSetting('screenshot.imageFormat');

                    if (autoScreenshot !== null) {
                        this.settings.screenshot.autoScreenshot = autoScreenshot === 'true' || autoScreenshot === true;
                    }
                    if (screenshotOnError !== null) {
                        this.settings.screenshot.screenshotOnError =
                            screenshotOnError === 'true' || screenshotOnError === true;
                    }
                    if (savePath !== null) {
                        this.settings.screenshot.savePath = savePath;
                    }
                    if (imageFormat !== null) {
                        this.settings.screenshot.imageFormat = imageFormat;
                    }
                    logger.log('[Settings] 서버에서 설정 로드 완료');
                }
            } catch (serverError) {
                logger.warn('[Settings] 서버 설정 로드 실패 (로컬 설정 사용):', serverError);
            }
        } catch (error) {
            logger.error('[Settings] 설정 데이터 로드 실패:', error);
            // 테마 관리자에서 현재 테마 가져오기
            const themeManager = getThemeManagerInstance();
            if (themeManager) {
                this.settings.appearance.theme = themeManager.getCurrentTheme();
            }
        }
    }

    /**
     * 설정 페이지 렌더링
     */
    renderSettings() {
        const settingsContent = document.getElementById('settings-content');
        if (!settingsContent) {
            return;
        }

        const lang = getLanguage();
        settingsContent.innerHTML = `
            <!-- 외관 설정 -->
            <div class="settings-section">
                <div class="settings-section-header">
                    <h2 class="settings-section-title">${t('settings.appearance')}</h2>
                    <p class="settings-section-subtitle">${t('settings.appearanceSubtitle')}</p>
                </div>
                <div class="settings-section-content">
                    <!-- 테마 설정 -->
                    <div class="settings-item">
                        <div class="settings-item-info">
                            <div class="settings-item-icon">🖥️</div>
                            <div class="settings-item-text">
                                <div class="settings-item-label">${t('settings.theme')}</div>
                                <div class="settings-item-description">${t('settings.themeDescription')}</div>
                            </div>
                        </div>
                        <div class="settings-item-control">
                            <div class="theme-buttons">
                                <button class="theme-btn ${this.settings.appearance.theme === 'light' ? 'active' : ''}" data-theme="light">${t('settings.light')}</button>
                                <button class="theme-btn ${this.settings.appearance.theme === 'dark' ? 'active' : ''}" data-theme="dark">${t('settings.dark')}</button>
                                <button class="theme-btn ${this.settings.appearance.theme === 'system' ? 'active' : ''}" data-theme="system">${t('settings.system')}</button>
                            </div>
                        </div>
                    </div>

                    <!-- 언어 설정 -->
                    <div class="settings-item">
                        <div class="settings-item-info">
                            <div class="settings-item-icon">🌐</div>
                            <div class="settings-item-text">
                                <div class="settings-item-label">${t('settings.language')}</div>
                                <div class="settings-item-description">${t('settings.languageDescription')}</div>
                            </div>
                        </div>
                        <div class="settings-item-control">
                            <select class="settings-select" id="setting-language">
                                <option value="en" ${this.settings.appearance.language === 'en' ? 'selected' : ''}>English</option>
                                <option value="ko" ${this.settings.appearance.language === 'ko' ? 'selected' : ''}>한국어</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 실행 설정 -->
            <div class="settings-section">
                <div class="settings-section-header">
                    <h2 class="settings-section-title">${t('settings.execution')}</h2>
                    <p class="settings-section-subtitle">${t('settings.executionSubtitle')}</p>
                </div>
                <div class="settings-section-content">
                    <!-- 기본 타임아웃 -->
                    <div class="settings-item">
                        <div class="settings-item-info">
                            <div class="settings-item-icon">⏱️</div>
                            <div class="settings-item-text">
                                <div class="settings-item-label">${t('settings.defaultTimeout')}</div>
                                <div class="settings-item-description">${t('settings.defaultTimeoutDescription')}</div>
                            </div>
                        </div>
                        <div class="settings-item-control">
                            <div class="slider-container">
                                <input type="range" class="settings-slider" id="setting-timeout" min="5" max="120" value="${this.settings.execution.defaultTimeout}" />
                                <span class="slider-value" id="timeout-value">${this.settings.execution.defaultTimeout}${t('settings.seconds')}</span>
                            </div>
                        </div>
                    </div>

                    <!-- 재시도 횟수 -->
                    <div class="settings-item">
                        <div class="settings-item-info">
                            <div class="settings-item-icon">🔄</div>
                            <div class="settings-item-text">
                                <div class="settings-item-label">${t('settings.retryCount')}</div>
                                <div class="settings-item-description">${t('settings.retryCountDescription')}</div>
                            </div>
                        </div>
                        <div class="settings-item-control">
                            <select class="settings-select" id="setting-retry-count">
                                <option value="0" ${this.settings.execution.retryCount === 0 ? 'selected' : ''}>0${t('settings.times')}</option>
                                <option value="1" ${this.settings.execution.retryCount === 1 ? 'selected' : ''}>1${t('settings.times')}</option>
                                <option value="2" ${this.settings.execution.retryCount === 2 ? 'selected' : ''}>2${t('settings.times')}</option>
                                <option value="3" ${this.settings.execution.retryCount === 3 ? 'selected' : ''}>3${t('settings.times')}</option>
                                <option value="5" ${this.settings.execution.retryCount === 5 ? 'selected' : ''}>5${t('settings.times')}</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 스크린샷 설정 -->
            <div class="settings-section">
                <div class="settings-section-header">
                    <h2 class="settings-section-title">${t('settings.screenshot')}</h2>
                    <p class="settings-section-subtitle">${t('settings.screenshotSubtitle')}</p>
                </div>
                <div class="settings-section-content">
                    <!-- 자동 스크린샷 -->
                    <div class="settings-item">
                        <div class="settings-item-info">
                            <div class="settings-item-icon">📷</div>
                            <div class="settings-item-text">
                                <div class="settings-item-label">${t('settings.autoScreenshot')}</div>
                                <div class="settings-item-description">${t('settings.autoScreenshotDescription')}</div>
                            </div>
                        </div>
                        <div class="settings-item-control">
                            <label class="toggle-switch">
                                <input type="checkbox" id="setting-auto-screenshot" ${this.settings.screenshot.autoScreenshot ? 'checked' : ''} />
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                    </div>

                    <!-- 오류 발생 시 스크린샷 -->
                    <div class="settings-item">
                        <div class="settings-item-info">
                            <div class="settings-item-icon">📷</div>
                            <div class="settings-item-text">
                                <div class="settings-item-label">${t('settings.screenshotOnError')}</div>
                                <div class="settings-item-description">${t('settings.screenshotOnErrorDescription')}</div>
                            </div>
                        </div>
                        <div class="settings-item-control">
                            <label class="toggle-switch">
                                <input type="checkbox" id="setting-screenshot-on-error" ${this.settings.screenshot.screenshotOnError ? 'checked' : ''} />
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                    </div>

                    <!-- 저장 경로 -->
                    <div class="settings-item">
                        <div class="settings-item-info">
                            <div class="settings-item-icon">📁</div>
                            <div class="settings-item-text">
                                <div class="settings-item-label">${t('settings.savePath')}</div>
                                <div class="settings-item-description">${t('settings.savePathDescription')}</div>
                            </div>
                        </div>
                        <div class="settings-item-control">
                            <input type="text" class="settings-input" id="setting-screenshot-path" value="${this.settings.screenshot.savePath}" />
                        </div>
                    </div>

                    <!-- 이미지 형식 -->
                    <div class="settings-item">
                        <div class="settings-item-info">
                            <div class="settings-item-icon">🖼️</div>
                            <div class="settings-item-text">
                                <div class="settings-item-label">${t('settings.imageFormat')}</div>
                                <div class="settings-item-description">${t('settings.imageFormatDescription')}</div>
                            </div>
                        </div>
                        <div class="settings-item-control">
                            <select class="settings-select" id="setting-image-format">
                                <option value="PNG" ${this.settings.screenshot.imageFormat === 'PNG' ? 'selected' : ''}>PNG</option>
                                <option value="JPEG" ${this.settings.screenshot.imageFormat === 'JPEG' ? 'selected' : ''}>JPEG</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 알림 설정 -->
            <div class="settings-section">
                <div class="settings-section-header">
                    <h2 class="settings-section-title">${t('settings.notifications')}</h2>
                    <p class="settings-section-subtitle">${t('settings.notificationsSubtitle')}</p>
                </div>
                <div class="settings-section-content">
                    <!-- 완료 알림 -->
                    <div class="settings-item">
                        <div class="settings-item-info">
                            <div class="settings-item-icon">🔔</div>
                            <div class="settings-item-text">
                                <div class="settings-item-label">${t('settings.completionNotification')}</div>
                                <div class="settings-item-description">${t('settings.completionNotificationDescription')}</div>
                            </div>
                        </div>
                        <div class="settings-item-control">
                            <label class="toggle-switch">
                                <input type="checkbox" id="setting-completion-notification" ${this.settings.notifications.completionNotification ? 'checked' : ''} />
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                    </div>

                    <!-- 오류 알림 -->
                    <div class="settings-item">
                        <div class="settings-item-info">
                            <div class="settings-item-icon">🔔</div>
                            <div class="settings-item-text">
                                <div class="settings-item-label">${t('settings.errorNotification')}</div>
                                <div class="settings-item-description">${t('settings.errorNotificationDescription')}</div>
                            </div>
                        </div>
                        <div class="settings-item-control">
                            <label class="toggle-switch">
                                <input type="checkbox" id="setting-error-notification" ${this.settings.notifications.errorNotification ? 'checked' : ''} />
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                    </div>

                    <!-- 알림 소리 -->
                    <div class="settings-item">
                        <div class="settings-item-info">
                            <div class="settings-item-icon">🔊</div>
                            <div class="settings-item-text">
                                <div class="settings-item-label">${t('settings.notificationSound')}</div>
                                <div class="settings-item-description">${t('settings.notificationSoundDescription')}</div>
                            </div>
                        </div>
                        <div class="settings-item-control">
                            <label class="toggle-switch">
                                <input type="checkbox" id="setting-notification-sound" ${this.settings.notifications.notificationSound ? 'checked' : ''} />
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 키보드 단축키 -->
            <div class="settings-section">
                <div class="settings-section-header">
                    <h2 class="settings-section-title">${t('settings.shortcuts')}</h2>
                    <p class="settings-section-subtitle">${t('settings.shortcutsSubtitle')}</p>
                </div>
                <div class="settings-section-content">
                    <div class="shortcuts-list">
                        <div class="shortcut-item">
                            <span class="shortcut-label">${t('settings.save')}</span>
                            <span class="shortcut-keys"><kbd>Ctrl</kbd> + <kbd>S</kbd></span>
                        </div>
                        <div class="shortcut-item">
                            <span class="shortcut-label">${t('settings.undo')}</span>
                            <span class="shortcut-keys"><kbd>Ctrl</kbd> + <kbd>Z</kbd></span>
                        </div>
                        <div class="shortcut-item">
                            <span class="shortcut-label">${t('settings.deleteNode')}</span>
                            <span class="shortcut-keys"><kbd>Delete</kbd></span>
                        </div>
                        <div class="shortcut-item">
                            <span class="shortcut-label">${t('settings.runWorkflow')}</span>
                            <span class="shortcut-keys"><kbd>F5</kbd></span>
                        </div>
                        <div class="shortcut-item">
                            <span class="shortcut-label">${t('settings.stopExecution')}</span>
                            <span class="shortcut-keys"><kbd>Esc</kbd></span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 설정 저장 버튼 -->
            <div class="settings-footer">
                <button class="btn-save-settings" id="btn-save-settings">
                    ${t('settings.saveSettings')}
                </button>
            </div>
        `;
    }

    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 기존 이벤트 리스너 제거를 위해 클론하여 재등록
        // (테마 버튼은 매번 새로 생성되므로 중복 방지 불필요)

        // 테마 버튼 클릭
        const themeButtons = document.querySelectorAll('.theme-btn');
        themeButtons.forEach((btn) => {
            // 기존 리스너 제거 후 새로 등록
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', () => {
                const theme = newBtn.dataset.theme;
                this.setTheme(theme);
            });
        });

        // 타임아웃 슬라이더
        const timeoutSlider = document.getElementById('setting-timeout');
        const timeoutValue = document.getElementById('timeout-value');
        if (timeoutSlider && timeoutValue) {
            // 기존 리스너 제거를 위해 새 요소로 교체
            const newSlider = timeoutSlider.cloneNode(true);
            timeoutSlider.parentNode.replaceChild(newSlider, timeoutSlider);
            newSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                timeoutValue.textContent = `${value}${t('settings.seconds')}`;
                this.settings.execution.defaultTimeout = value;
            });
        }

        // 설정 저장 버튼
        const saveBtn = document.getElementById('btn-save-settings');
        if (saveBtn) {
            // 기존 리스너 제거를 위해 새 요소로 교체
            const newSaveBtn = saveBtn.cloneNode(true);
            saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
            newSaveBtn.addEventListener('click', () => {
                this.saveSettings();
            });
        }

        // 모든 설정 값 수집
        this.collectSettings();
    }

    /**
     * 설정 값 수집
     */
    collectSettings() {
        // 언어 - 기존 리스너 제거 후 새로 등록
        const language = document.getElementById('setting-language');
        if (language) {
            // 기존 리스너 제거를 위해 새 요소로 교체
            const newLanguage = language.cloneNode(true);
            language.parentNode.replaceChild(newLanguage, language);
            newLanguage.value = this.settings.appearance.language; // 현재 값 유지
            newLanguage.addEventListener('change', async (e) => {
                const newLang = e.target.value;
                this.settings.appearance.language = newLang;
                // 언어 변경 및 UI 업데이트 (이벤트 발생, 서버에 즉시 저장)
                await setLanguage(newLang, false);
                // 설정 페이지 다시 렌더링하여 번역 적용
                this.renderSettings();
                this.setupEventListeners();
            });
        }

        // 재시도 횟수
        const retryCount = document.getElementById('setting-retry-count');
        if (retryCount) {
            const newRetryCount = retryCount.cloneNode(true);
            retryCount.parentNode.replaceChild(newRetryCount, retryCount);
            newRetryCount.value = this.settings.execution.retryCount;
            newRetryCount.addEventListener('change', (e) => {
                this.settings.execution.retryCount = parseInt(e.target.value);
            });
        }

        // 자동 스크린샷
        const autoScreenshot = document.getElementById('setting-auto-screenshot');
        if (autoScreenshot) {
            const newAutoScreenshot = autoScreenshot.cloneNode(true);
            autoScreenshot.parentNode.replaceChild(newAutoScreenshot, autoScreenshot);
            newAutoScreenshot.checked = this.settings.screenshot.autoScreenshot;
            newAutoScreenshot.addEventListener('change', (e) => {
                this.settings.screenshot.autoScreenshot = e.target.checked;
            });
        }

        // 오류 시 스크린샷
        const screenshotOnError = document.getElementById('setting-screenshot-on-error');
        if (screenshotOnError) {
            const newScreenshotOnError = screenshotOnError.cloneNode(true);
            screenshotOnError.parentNode.replaceChild(newScreenshotOnError, screenshotOnError);
            newScreenshotOnError.checked = this.settings.screenshot.screenshotOnError;
            newScreenshotOnError.addEventListener('change', (e) => {
                this.settings.screenshot.screenshotOnError = e.target.checked;
            });
        }

        // 저장 경로
        const screenshotPath = document.getElementById('setting-screenshot-path');
        if (screenshotPath) {
            const newScreenshotPath = screenshotPath.cloneNode(true);
            screenshotPath.parentNode.replaceChild(newScreenshotPath, screenshotPath);
            newScreenshotPath.value = this.settings.screenshot.savePath;
            newScreenshotPath.addEventListener('change', (e) => {
                this.settings.screenshot.savePath = e.target.value;
            });
        }

        // 이미지 형식
        const imageFormat = document.getElementById('setting-image-format');
        if (imageFormat) {
            const newImageFormat = imageFormat.cloneNode(true);
            imageFormat.parentNode.replaceChild(newImageFormat, imageFormat);
            newImageFormat.value = this.settings.screenshot.imageFormat;
            newImageFormat.addEventListener('change', (e) => {
                this.settings.screenshot.imageFormat = e.target.value;
            });
        }

        // 완료 알림
        const completionNotification = document.getElementById('setting-completion-notification');
        if (completionNotification) {
            const newCompletionNotification = completionNotification.cloneNode(true);
            completionNotification.parentNode.replaceChild(newCompletionNotification, completionNotification);
            newCompletionNotification.checked = this.settings.notifications.completionNotification;
            newCompletionNotification.addEventListener('change', (e) => {
                this.settings.notifications.completionNotification = e.target.checked;
            });
        }

        // 오류 알림
        const errorNotification = document.getElementById('setting-error-notification');
        if (errorNotification) {
            const newErrorNotification = errorNotification.cloneNode(true);
            errorNotification.parentNode.replaceChild(newErrorNotification, errorNotification);
            newErrorNotification.checked = this.settings.notifications.errorNotification;
            newErrorNotification.addEventListener('change', (e) => {
                this.settings.notifications.errorNotification = e.target.checked;
            });
        }

        // 알림 소리
        const notificationSound = document.getElementById('setting-notification-sound');
        if (notificationSound) {
            const newNotificationSound = notificationSound.cloneNode(true);
            notificationSound.parentNode.replaceChild(newNotificationSound, notificationSound);
            newNotificationSound.checked = this.settings.notifications.notificationSound;
            newNotificationSound.addEventListener('change', (e) => {
                this.settings.notifications.notificationSound = e.target.checked;
            });
        }
    }

    /**
     * 테마 설정
     */
    setTheme(theme) {
        this.settings.appearance.theme = theme;

        // 테마 버튼 활성화 상태 업데이트
        const themeButtons = document.querySelectorAll('.theme-btn');
        themeButtons.forEach((btn) => {
            if (btn.dataset.theme === theme) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // 테마 관리자를 통해 테마 적용
        const themeManager = getThemeManagerInstance();
        if (themeManager) {
            themeManager.applyTheme(theme);
        }

        const logger = getLogger();
        logger.log('[Settings] 테마 변경:', theme);
    }

    /**
     * 설정 저장
     */
    async saveSettings() {
        const logger = getLogger();
        logger.log('[Settings] 설정 저장 시작:', this.settings);

        try {
            // 로컬 스토리지에 저장 (즉시 반영)
            const settingsToSave = { ...this.settings };
            // language를 최상위 레벨에도 저장
            if (settingsToSave.appearance && settingsToSave.appearance.language) {
                settingsToSave.language = settingsToSave.appearance.language;
            }
            localStorage.setItem('app-settings', JSON.stringify(settingsToSave));

            // 서버에도 설정 저장
            try {
                const { UserSettingsAPI } = await import('../../js/api/user-settings-api.js');
                if (UserSettingsAPI) {
                    // 언어 설정 저장
                    await UserSettingsAPI.saveSetting('language', this.settings.appearance.language);

                    // 스크린샷 설정을 서버에 저장
                    await UserSettingsAPI.saveSetting(
                        'screenshot.autoScreenshot',
                        this.settings.screenshot.autoScreenshot.toString()
                    );
                    await UserSettingsAPI.saveSetting(
                        'screenshot.screenshotOnError',
                        this.settings.screenshot.screenshotOnError.toString()
                    );
                    await UserSettingsAPI.saveSetting('screenshot.savePath', this.settings.screenshot.savePath);
                    await UserSettingsAPI.saveSetting('screenshot.imageFormat', this.settings.screenshot.imageFormat);
                    logger.log('[Settings] 설정 서버에 저장 완료');
                }
            } catch (serverError) {
                logger.warn('[Settings] 서버 저장 실패 (로컬 스토리지만 저장):', serverError);
            }

            logger.log('[Settings] 설정 저장 완료');

            // 저장 완료 알림 (간단한 토스트 메시지)
            this.showSaveNotification();
        } catch (error) {
            logger.error('[Settings] 설정 저장 실패:', error);
        }
    }

    /**
     * 저장 완료 알림 표시
     */
    showSaveNotification() {
        // ToastManager 사용 (Ctrl+S와 동일한 방식, 사이드바 고려)
        const toastManager = getToastManagerInstance();
        if (toastManager) {
            toastManager.success(t('settings.settingsSaved'), 2000);
        }
    }
}

/**
 * SettingsManager 인스턴스 가져오기
 */
let settingsManagerInstance = null;

export function getSettingsManagerInstance() {
    if (!settingsManagerInstance) {
        settingsManagerInstance = new SettingsManager();
    }
    return settingsManagerInstance;
}
