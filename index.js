(() => {
    'use strict';

    const STORAGE_KEY = 'st_mobile_draft_backup_v1';
    const THEME_KEY = 'st_mobile_draft_theme_v1';
    const TEXTAREA_SELECTOR = '#send_textarea';

    const PANEL_ID = 'st-draft-backup-panel';
    const BUTTON_ID = 'st-draft-backup-button';
    const STYLE_ID = 'st-draft-backup-style';

    const QR_MENU_SELECTOR = '#qr-assistant';
    const QR_LIST_SELECTOR = '#qr-list-right';

    const SAVE_DELAY = 400;
    const CHECK_DELAY = 500;

    let saveTimer = null;
    let lastText = null;
    let currentChatKey = null;
    let initialized = false;
    let qrObserverStarted = false;

    function injectStyle() {
        if (document.getElementById(STYLE_ID)) {
            return;
        }

        const style = document.createElement('style');
        style.id = STYLE_ID;

        style.textContent = `
            #${PANEL_ID} {
                display: none;
                position: fixed;
                inset: 0;
                z-index: 100000;
                padding: 18px;
                overflow-y: auto;
                background: #e9e9e9;
                color: #222;
                box-sizing: border-box;
            }

            #${PANEL_ID},
            #${PANEL_ID} * {
                box-sizing: border-box;
            }

            #st-draft-backup-box {
                width: min(100%, 640px);
                margin: 24px auto;
                padding: 18px;
                border: 1px solid #cfcfcf;
                border-radius: 14px;
                background: #ffffff;
                color: #222222;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
                font-family: inherit;
            }

            #st-draft-backup-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                margin-bottom: 14px;
            }

            #st-draft-backup-title {
                font-size: 18px;
                font-weight: 700;
                letter-spacing: 0.02em;
            }

            #st-draft-backup-theme-area {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                margin-bottom: 14px;
                padding: 12px;
                border: 1px solid #dddddd;
                border-radius: 10px;
                background: #f7f7f7;
            }

            #st-draft-backup-theme-area > span {
                font-size: 14px;
                color: #555;
            }

            .st-draft-backup-theme-buttons {
                display: flex;
                gap: 8px;
            }

            #st-draft-backup-status {
                margin-bottom: 12px;
                padding: 9px 10px;
                border: 1px solid #e2e2e2;
                border-radius: 9px;
                background: #fafafa;
                color: #666;
                font-size: 13px;
            }

            #st-draft-backup-list {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .st-draft-backup-empty {
                padding: 24px 12px;
                border: 1px solid #e0e0e0;
                border-radius: 10px;
                background: #fafafa;
                color: #777;
                text-align: center;
            }

            .st-draft-backup-card {
                padding: 13px;
                border: 1px solid #dcdcdc;
                border-radius: 11px;
                background: #fdfdfd;
                color: #222;
            }

            .st-draft-backup-card-name {
                font-weight: 700;
                color: #111;
                margin-bottom: 4px;
            }

            .st-draft-backup-card-time {
                margin-bottom: 8px;
                color: #888;
                font-size: 12px;
            }

            .st-draft-backup-card-preview {
                max-height: 96px;
                overflow: hidden;
                white-space: pre-wrap;
                word-break: break-word;
                color: #333;
                font-size: 13px;
                line-height: 1.45;
            }

            .st-draft-backup-card-actions {
                display: flex;
                gap: 8px;
                margin-top: 10px;
            }

            #st-draft-backup-footer {
                display: flex;
                gap: 8px;
                margin-top: 14px;
            }

            #${PANEL_ID} button {
                min-height: 34px;
                padding: 6px 12px;
                border: 1px solid #bfbfbf;
                border-radius: 8px;
                background: #eeeeee;
                color: #222222;
                font: inherit;
                cursor: pointer;
                transition:
                    background-color 0.15s ease,
                    border-color 0.15s ease,
                    transform 0.12s ease;
            }

            #${PANEL_ID} button:hover {
                border-color: #888888;
                background: #e3e3e3;
            }

            #${PANEL_ID} button:active {
                transform: scale(0.97);
            }

            #st-draft-backup-close {
                background: #ffffff;
            }

            #st-draft-backup-theme-light.is-active,
            #st-draft-backup-theme-dark.is-active {
                border-color: #222222;
                background: #222222;
                color: #ffffff;
            }

            #${PANEL_ID}[data-theme="dark"] {
                background: #050505;
                color: #f2f2f2;
            }

            #${PANEL_ID}[data-theme="dark"] #st-draft-backup-box {
                border-color: #333333;
                background: #111111;
                color: #f2f2f2;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.55);
            }

            #${PANEL_ID}[data-theme="dark"] #st-draft-backup-theme-area {
                border-color: #333333;
                background: #181818;
            }

            #${PANEL_ID}[data-theme="dark"] #st-draft-backup-theme-area > span {
                color: #cccccc;
            }

            #${PANEL_ID}[data-theme="dark"] #st-draft-backup-status {
                border-color: #333333;
                background: #181818;
                color: #bbbbbb;
            }

            #${PANEL_ID}[data-theme="dark"] .st-draft-backup-empty {
                border-color: #333333;
                background: #181818;
                color: #aaaaaa;
            }

            #${PANEL_ID}[data-theme="dark"] .st-draft-backup-card {
                border-color: #333333;
                background: #181818;
                color: #f2f2f2;
            }

            #${PANEL_ID}[data-theme="dark"] .st-draft-backup-card-name {
                color: #ffffff;
            }

            #${PANEL_ID}[data-theme="dark"] .st-draft-backup-card-time {
                color: #999999;
            }

            #${PANEL_ID}[data-theme="dark"] .st-draft-backup-card-preview {
                color: #dddddd;
            }

            #${PANEL_ID}[data-theme="dark"] button {
                border-color: #555555;
                background: #222222;
                color: #f2f2f2;
            }

            #${PANEL_ID}[data-theme="dark"] button:hover {
                border-color: #aaaaaa;
                background: #303030;
            }

            #${PANEL_ID}[data-theme="dark"] #st-draft-backup-close {
                background: #151515;
            }

            #${PANEL_ID}[data-theme="dark"] #st-draft-backup-theme-light.is-active,
            #${PANEL_ID}[data-theme="dark"] #st-draft-backup-theme-dark.is-active {
                border-color: #ffffff;
                background: #ffffff;
                color: #000000;
            }

            #${BUTTON_ID}.action-item {
                display: flex;
                align-items: center;
                justify-content: center;
            }

            @media (max-width: 600px) {
                #${PANEL_ID} {
                    padding: 10px;
                }

                #st-draft-backup-box {
                    margin: 10px auto;
                    padding: 14px;
                    border-radius: 12px;
                }

                #st-draft-backup-theme-area {
                    align-items: stretch;
                    flex-direction: column;
                }

                .st-draft-backup-theme-buttons {
                    width: 100%;
                }

                .st-draft-backup-theme-buttons button {
                    flex: 1;
                }

                #st-draft-backup-footer {
                    flex-direction: column;
                }
            }
        `;

        document.head.appendChild(style);
    }

    function getContext() {
        try {
            return window.SillyTavern?.getContext?.() || {};
        } catch {
            return {};
        }
    }

    function getTextarea() {
        return document.querySelector(TEXTAREA_SELECTOR);
    }

    function getDrafts() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        } catch {
            return {};
        }
    }

    function setDrafts(data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    function getChatInfo() {
        const context = getContext();

        let chatId =
            context.getCurrentChatId?.() ||
            context.chatId ||
            context.chat_id ||
            '';

        if (!chatId) {
            chatId = location.href;
        }

        const characterId =
            context.characterId ||
            context.character_id ||
            '';

        const groupId =
            context.groupId ||
            context.group_id ||
            '';

        let name = '';

        try {
            const character =
                context.characters?.[characterId] ||
                context.character ||
                null;

            name =
                character?.name ||
                character?.data?.name ||
                '';
        } catch {
            name = '';
        }

        if (!name) {
            name = groupId ? `群聊 ${groupId}` : '当前聊天';
        }

        const keyPrefix = groupId
            ? `group-${groupId}`
            : `character-${characterId || 'unknown'}`;

        return {
            key: `${keyPrefix}__chat-${String(chatId)}`,
            name,
            chatId: String(chatId),
            groupId: String(groupId || ''),
        };
    }

    function updateStatus(text) {
        const status = document.querySelector('#st-draft-backup-status');

        if (status) {
            status.textContent = text;
        }
    }

    function saveDraft(text) {
        const info = getChatInfo();
        const drafts = getDrafts();

        if (!text) {
            delete drafts[info.key];
            setDrafts(drafts);
            updateStatus('当前没有未发送草稿');
            return;
        }

        drafts[info.key] = {
            key: info.key,
            name: info.name,
            text,
            chatId: info.chatId,
            groupId: info.groupId,
            updatedAt: Date.now(),
        };

        setDrafts(drafts);
        updateStatus('已自动保存');
    }

    function scheduleSave(text) {
        clearTimeout(saveTimer);

        saveTimer = setTimeout(() => {
            saveDraft(text);
        }, SAVE_DELAY);
    }

    function restoreCurrentDraft(force = false) {
        const textarea = getTextarea();

        if (!textarea) {
            return;
        }

        const info = getChatInfo();
        const draft = getDrafts()[info.key];

        if (!draft?.text) {
            return;
        }

        if (!force && textarea.value) {
            return;
        }

        textarea.value = draft.text;

        textarea.dispatchEvent(new Event('input', {
            bubbles: true,
        }));

        lastText = textarea.value;
        updateStatus('已恢复当前聊天草稿');
    }

    function createTextElement(tag, className, text) {
        const element = document.createElement(tag);

        if (className) {
            element.className = className;
        }

        if (text !== undefined) {
            element.textContent = text;
        }

        return element;
    }

    function formatTime(timestamp) {
        if (!timestamp) {
            return '';
        }

        return new Date(timestamp).toLocaleString();
    }

    function createPanel() {
        injectStyle();

        if (document.getElementById(PANEL_ID)) {
            return;
        }

        const panel = document.createElement('div');
        panel.id = PANEL_ID;
        panel.dataset.theme = localStorage.getItem(THEME_KEY) || 'light';

        const box = document.createElement('div');
        box.id = 'st-draft-backup-box';

        const header = document.createElement('div');
        header.id = 'st-draft-backup-header';

        const title = createTextElement(
            'div',
            '',
            '输入框备份'
        );

        title.id = 'st-draft-backup-title';

        const closeButton = createTextElement(
            'button',
            '',
            '关闭'
        );

        closeButton.id = 'st-draft-backup-close';
        closeButton.type = 'button';

        header.appendChild(title);
        header.appendChild(closeButton);

        const themeArea = document.createElement('div');
        themeArea.id = 'st-draft-backup-theme-area';

        const themeLabel = createTextElement('span', '', '外观');

        const themeButtons = document.createElement('div');
        themeButtons.className = 'st-draft-backup-theme-buttons';

        const lightButton = createTextElement('button', '', '白色');
        lightButton.id = 'st-draft-backup-theme-light';
        lightButton.type = 'button';

        const darkButton = createTextElement('button', '', '黑色');
        darkButton.id = 'st-draft-backup-theme-dark';
        darkButton.type = 'button';

        themeButtons.appendChild(lightButton);
        themeButtons.appendChild(darkButton);

        themeArea.appendChild(themeLabel);
        themeArea.appendChild(themeButtons);

        const status = createTextElement(
            'div',
            '',
            '备份保存在当前浏览器'
        );

        status.id = 'st-draft-backup-status';

        const list = document.createElement('div');
        list.id = 'st-draft-backup-list';

        const footer = document.createElement('div');
        footer.id = 'st-draft-backup-footer';

        const refreshButton = createTextElement('button', '', '刷新列表');
        refreshButton.id = 'st-draft-backup-refresh';
        refreshButton.type = 'button';

        const clearButton = createTextElement('button', '', '删除全部');
        clearButton.id = 'st-draft-backup-clear-all';
        clearButton.type = 'button';

        footer.appendChild(refreshButton);
        footer.appendChild(clearButton);

        box.appendChild(header);
        box.appendChild(themeArea);
        box.appendChild(status);
        box.appendChild(list);
        box.appendChild(footer);

        panel.appendChild(box);
        document.body.appendChild(panel);

        closeButton.addEventListener('click', closePanel);

        panel.addEventListener('click', event => {
            if (event.target === panel) {
                closePanel();
            }
        });

        lightButton.addEventListener('click', () => {
            setTheme('light');
        });

        darkButton.addEventListener('click', () => {
            setTheme('dark');
        });

        refreshButton.addEventListener('click', renderList);

        clearButton.addEventListener('click', () => {
            const count = Object.keys(getDrafts()).length;

            if (!count) {
                updateStatus('没有可删除的备份');
                return;
            }

            if (!confirm(`确定删除全部 ${count} 条备份吗？`)) {
                return;
            }

            localStorage.removeItem(STORAGE_KEY);
            renderList();
            updateStatus('已删除全部备份');
        });

        list.addEventListener('click', event => {
            const restoreButton = event.target.closest('[data-restore-key]');
            const deleteButton = event.target.closest('[data-delete-key]');

            if (restoreButton) {
                restoreDraft(restoreButton.dataset.restoreKey);
            }

            if (deleteButton) {
                deleteDraft(deleteButton.dataset.deleteKey);
            }
        });

        refreshThemeButtons();
    }

    function setTheme(theme) {
        const panel = document.getElementById(PANEL_ID);

        if (!panel) {
            return;
        }

        const finalTheme = theme === 'dark' ? 'dark' : 'light';

        panel.dataset.theme = finalTheme;
        localStorage.setItem(THEME_KEY, finalTheme);

        refreshThemeButtons();

        updateStatus(
            finalTheme === 'dark'
                ? '已切换为黑色外观'
                : '已切换为白色外观'
        );
    }

    function refreshThemeButtons() {
        const panel = document.getElementById(PANEL_ID);
        const lightButton = document.getElementById('st-draft-backup-theme-light');
        const darkButton = document.getElementById('st-draft-backup-theme-dark');

        if (!panel || !lightButton || !darkButton) {
            return;
        }

        lightButton.classList.toggle(
            'is-active',
            panel.dataset.theme !== 'dark'
        );

        darkButton.classList.toggle(
            'is-active',
            panel.dataset.theme === 'dark'
        );
    }

    function openPanel() {
        createPanel();
        renderList();

        const panel = document.getElementById(PANEL_ID);

        if (!panel) {
            return;
        }

        panel.dataset.theme = localStorage.getItem(THEME_KEY) || 'light';
        refreshThemeButtons();

        panel.style.display = 'block';
    }

    function closePanel() {
        const panel = document.getElementById(PANEL_ID);

        if (panel) {
            panel.style.display = 'none';
        }
    }

    function renderList() {
        createPanel();

        const list = document.getElementById('st-draft-backup-list');

        if (!list) {
            return;
        }

        list.innerHTML = '';

        const drafts = Object.values(getDrafts())
            .sort((a, b) => {
                return (b.updatedAt || 0) - (a.updatedAt || 0);
            });

        if (!drafts.length) {
            list.appendChild(
                createTextElement(
                    'div',
                    'st-draft-backup-empty',
                    '暂时没有备份'
                )
            );
            return;
        }

        drafts.forEach(draft => {
            const card = createTextElement('div', 'st-draft-backup-card');

            const name = createTextElement(
                'div',
                'st-draft-backup-card-name',
                draft.name || '未命名聊天'
            );

            const time = createTextElement(
                'div',
                'st-draft-backup-card-time',
                formatTime(draft.updatedAt)
            );

            const preview = createTextElement(
                'div',
                'st-draft-backup-card-preview',
                draft.text || ''
            );

            const actions = createTextElement(
                'div',
                'st-draft-backup-card-actions'
            );

            const restoreButton = createTextElement('button', '', '恢复');
            restoreButton.type = 'button';
            restoreButton.dataset.restoreKey = draft.key;

            const deleteButton = createTextElement('button', '', '删除');
            deleteButton.type = 'button';
            deleteButton.dataset.deleteKey = draft.key;

            actions.appendChild(restoreButton);
            actions.appendChild(deleteButton);

            card.appendChild(name);
            card.appendChild(time);
            card.appendChild(preview);
            card.appendChild(actions);

            list.appendChild(card);
        });
    }

    function restoreDraft(key) {
        const draft = getDrafts()[key];

        if (!draft?.text) {
            updateStatus('找不到这条备份');
            return;
        }

        const textarea = getTextarea();

        if (!textarea) {
            updateStatus('找不到酒馆输入框');
            return;
        }

        textarea.value = draft.text;

        textarea.dispatchEvent(new Event('input', {
            bubbles: true,
        }));

        lastText = textarea.value;

        closePanel();
    }

    function deleteDraft(key) {
        const drafts = getDrafts();

        if (!drafts[key]) {
            return;
        }

        delete drafts[key];
        setDrafts(drafts);

        renderList();
        updateStatus('已删除备份');
    }

    function addButtonToQrAssistant() {
        const rightList = document.querySelector(QR_LIST_SELECTOR);

        if (!rightList) {
            return;
        }

        const oldButton = document.getElementById(BUTTON_ID);

        if (oldButton && !rightList.contains(oldButton)) {
            oldButton.remove();
        }

        if (rightList.querySelector(`#${BUTTON_ID}`)) {
            return;
        }

        const button = document.createElement('button');

        button.id = BUTTON_ID;
        button.type = 'button';
        button.className = 'action-item';
        button.dataset.label = '📦备份';
        button.title = '打开输入框备份';

        const span = document.createElement('span');
        span.textContent = '📦备份';

        button.appendChild(span);

        button.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            openPanel();
        });

        rightList.appendChild(button);
    }

    function watchQrAssistant() {
        const qrMenu = document.querySelector(QR_MENU_SELECTOR);

        if (!qrMenu) {
            return;
        }

        addButtonToQrAssistant();

        if (qrObserverStarted) {
            return;
        }

        qrObserverStarted = true;

        const observer = new MutationObserver(() => {
            addButtonToQrAssistant();
        });

        observer.observe(qrMenu, {
            childList: true,
            subtree: true,
        });
    }

    function checkInput() {
        const textarea = getTextarea();

        if (!textarea) {
            return;
        }

        const info = getChatInfo();

        if (info.key !== currentChatKey) {
            currentChatKey = info.key;
            initialized = false;
            lastText = textarea.value;

            if (!textarea.value) {
                setTimeout(() => {
                    restoreCurrentDraft();
                }, 300);
            }

            return;
        }

        if (!initialized) {
            initialized = true;
            lastText = textarea.value;
            return;
        }

        if (textarea.value !== lastText) {
            lastText = textarea.value;
            scheduleSave(textarea.value);
        }
    }

    document.addEventListener(
        'input',
        event => {
            const target = event.target;

            if (!(target instanceof HTMLTextAreaElement)) {
                return;
            }

            if (target.id !== 'send_textarea') {
                return;
            }

            lastText = target.value;
            scheduleSave(target.value);
        },
        true
    );

    window.addEventListener('beforeunload', () => {
        const textarea = getTextarea();

        if (!textarea) {
            return;
        }

        clearTimeout(saveTimer);
        saveDraft(textarea.value);
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            closePanel();
        }
    });

    function start() {
        injectStyle();
        createPanel();
        watchQrAssistant();
        checkInput();

        setInterval(() => {
            checkInput();
            watchQrAssistant();
        }, CHECK_DELAY);

        setTimeout(() => {
            restoreCurrentDraft();
        }, 1200);

        console.log('[输入框实时备份] 已启动：内置实心黑白主题版');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, {
            once: true,
        });
    } else {
        start();
    }
})();
