(() => {
    'use strict';

    const STORAGE_KEY = 'st_mobile_draft_backup_v1';
    const THEME_KEY = 'st_mobile_draft_theme';
    const TEXTAREA_SELECTOR = '#send_textarea';
    const QR_MENU_SELECTOR = '#qr-assistant';
    const QR_LIST_SELECTOR = '#qr-list-right';
    const BACKUP_BUTTON_ID = 'st-draft-backup-button';
    const PANEL_ID = 'st-draft-backup-panel';

    const SAVE_DELAY = 400;
    const CHECK_DELAY = 500;

    let saveTimer = null;
    let lastText = null;
    let currentChatKey = null;
    let inputInitialized = false;
    let qrObserverStarted = false;
    let qrRetryTimer = null;

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

    function getDraftData() {
        try {
            return JSON.parse(
                localStorage.getItem(STORAGE_KEY) || '{}'
            );
        } catch {
            return {};
        }
    }

    function saveDraftData(data) {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(data)
        );
    }

    function getCurrentChatInfo() {
        const context = getContext();

        let chatId = '';

        try {
            chatId =
                context.getCurrentChatId?.() ||
                context.chatId ||
                context.chat_id ||
                '';
        } catch {
            chatId = '';
        }

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

        let characterName = '';

        try {
            const character =
                context.characters?.[characterId] ||
                context.character ||
                null;

            characterName =
                character?.name ||
                character?.data?.name ||
                '';
        } catch {
            characterName = '';
        }

        if (!characterName) {
            characterName = groupId
                ? `群聊 ${groupId}`
                : '当前聊天';
        }

        const keyPrefix = groupId
            ? `group-${groupId}`
            : `character-${characterId || 'unknown'}`;

        return {
            key: `${keyPrefix}__chat-${String(chatId)}`,
            name: characterName,
            chatId: String(chatId),
            groupId: String(groupId || ''),
        };
    }

    function updateStatus(text) {
        const status = document.querySelector(
            '#st-draft-backup-status'
        );

        if (status) {
            status.textContent = text;
        }
    }

    function saveCurrentDraft(text) {
        const info = getCurrentChatInfo();
        const drafts = getDraftData();

        /*
         * 输入框为空时，删除当前聊天的草稿。
         * 发送消息后酒馆通常会清空输入框，
         * 这样旧草稿不会在下次打开时重复出现。
         */
        if (!text) {
            delete drafts[info.key];
            saveDraftData(drafts);
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

        saveDraftData(drafts);
        updateStatus('已自动保存');
    }

    function scheduleSave(text) {
        clearTimeout(saveTimer);

        saveTimer = setTimeout(() => {
            saveCurrentDraft(text);
        }, SAVE_DELAY);
    }

    function restoreCurrentDraft(force = false) {
        const textarea = getTextarea();

        if (!textarea) {
            return;
        }

        const info = getCurrentChatInfo();
        const drafts = getDraftData();
        const draft = drafts[info.key];

        if (!draft?.text) {
            return;
        }

        /*
         * 默认不覆盖用户当前已经输入的内容。
         */
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

    function formatTime(timestamp) {
        if (!timestamp) {
            return '';
        }

        try {
            return new Date(timestamp).toLocaleString();
        } catch {
            return '';
        }
    }

    function createElement(tag, className, text) {
        const element = document.createElement(tag);

        if (className) {
            element.className = className;
        }

        if (text !== undefined) {
            element.textContent = text;
        }

        return element;
    }

    function createBackupPanel() {
        if (document.querySelector(`#${PANEL_ID}`)) {
            return;
        }

        const panel = document.createElement('div');
        panel.id = PANEL_ID;
        panel.dataset.theme =
            localStorage.getItem(THEME_KEY) || 'light';

        const box = document.createElement('div');
        box.id = 'st-draft-backup-box';

        const header = document.createElement('div');
        header.id = 'st-draft-backup-header';

        const title = createElement(
            'strong',
            'st-draft-backup-title',
            '输入框备份'
        );

        const closeButton = createElement(
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

        const themeLabel = createElement(
            'span',
            '',
            '外观'
        );

        const themeButtons = document.createElement('div');
        themeButtons.className = 'st-draft-backup-theme-buttons';

        const lightButton = createElement(
            'button',
            '',
            '白色'
        );

        lightButton.id = 'st-draft-backup-theme-light';
        lightButton.type = 'button';

        const darkButton = createElement(
            'button',
            '',
            '黑色'
        );

        darkButton.id = 'st-draft-backup-theme-dark';
        darkButton.type = 'button';

        themeButtons.appendChild(lightButton);
        themeButtons.appendChild(darkButton);

        themeArea.appendChild(themeLabel);
        themeArea.appendChild(themeButtons);

        const status = createElement(
            'div',
            '',
            '备份保存在当前浏览器'
        );

        status.id = 'st-draft-backup-status';

        const list = document.createElement('div');
        list.id = 'st-draft-backup-list';

        const footer = document.createElement('div');
        footer.id = 'st-draft-backup-footer';

        const refreshButton = createElement(
            'button',
            '',
            '刷新列表'
        );

        refreshButton.id = 'st-draft-backup-refresh';
        refreshButton.type = 'button';

        const clearButton = createElement(
            'button',
            '',
            '删除全部'
        );

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

        closeButton.addEventListener('click', () => {
            closeBackupPanel();
        });

        panel.addEventListener('click', event => {
            if (event.target === panel) {
                closeBackupPanel();
            }
        });

        lightButton.addEventListener('click', () => {
            setBackupTheme('light');
        });

        darkButton.addEventListener('click', () => {
            setBackupTheme('dark');
        });

        refreshButton.addEventListener('click', () => {
            renderBackupList();
        });

        clearButton.addEventListener('click', () => {
            const drafts = getDraftData();
            const count = Object.keys(drafts).length;

            if (!count) {
                updateStatus('没有可删除的备份');
                return;
            }

            if (!confirm(`确定删除全部 ${count} 条备份吗？`)) {
                return;
            }

            localStorage.removeItem(STORAGE_KEY);
            renderBackupList();
            updateStatus('已删除全部备份');
        });

        list.addEventListener('click', event => {
            const restoreButton =
                event.target.closest(
                    '[data-st-restore-key]'
                );

            const deleteButton =
                event.target.closest(
                    '[data-st-delete-key]'
                );

            if (restoreButton) {
                restoreDraft(
                    restoreButton.dataset.stRestoreKey
                );
            }

            if (deleteButton) {
                deleteDraft(
                    deleteButton.dataset.stDeleteKey
                );
            }
        });
    }

    function setBackupTheme(theme) {
        const panel = document.querySelector(
            `#${PANEL_ID}`
        );

        if (!panel) {
            return;
        }

        const finalTheme =
            theme === 'dark' ? 'dark' : 'light';

        panel.dataset.theme = finalTheme;
        localStorage.setItem(THEME_KEY, finalTheme);

        updateStatus(
            finalTheme === 'dark'
                ? '已切换为黑色外观'
                : '已切换为白色外观'
        );
    }

    function openBackupPanel() {
        createBackupPanel();
        renderBackupList();

        const panel = document.querySelector(
            `#${PANEL_ID}`
        );

        if (panel) {
            panel.dataset.theme =
                localStorage.getItem(THEME_KEY) || 'light';

            panel.style.display = 'block';
        }
    }

    function closeBackupPanel() {
        const panel = document.querySelector(
            `#${PANEL_ID}`
        );

        if (panel) {
            panel.style.display = 'none';
        }
    }

    function renderBackupList() {
        createBackupPanel();

        const list = document.querySelector(
            '#st-draft-backup-list'
        );

        if (!list) {
            return;
        }

        list.innerHTML = '';

        const drafts = Object.values(getDraftData())
            .sort((a, b) => {
                return (b.updatedAt || 0) -
                    (a.updatedAt || 0);
            });

        if (!drafts.length) {
            const empty = createElement(
                'div',
                'st-draft-backup-empty',
                '暂时没有备份'
            );

            list.appendChild(empty);
            return;
        }

        drafts.forEach(draft => {
            const card = createElement(
                'div',
                'st-draft-backup-card'
            );

            const name = createElement(
                'div',
                'st-draft-backup-card-name',
                draft.name || '未命名聊天'
            );

            const time = createElement(
                'div',
                'st-draft-backup-card-time',
                formatTime(draft.updatedAt)
            );

            const preview = createElement(
                'div',
                'st-draft-backup-card-preview',
                draft.text || ''
            );

            const actions = createElement(
                'div',
                'st-draft-backup-card-actions'
            );

            const restoreButton = createElement(
                'button',
                '',
                '恢复'
            );

            restoreButton.type = 'button';
            restoreButton.dataset.stRestoreKey =
                draft.key;

            const deleteButton = createElement(
                'button',
                '',
                '删除'
            );

            deleteButton.type = 'button';
            deleteButton.dataset.stDeleteKey =
                draft.key;

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
        const drafts = getDraftData();
        const draft = drafts[key];

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

        closeBackupPanel();
    }

    function deleteDraft(key) {
        const drafts = getDraftData();

        if (!drafts[key]) {
            return;
        }

        delete drafts[key];
        saveDraftData(drafts);

        renderBackupList();
        updateStatus('已删除备份');
    }

    function addBackupButtonToQrMenu() {
        const rightList = document.querySelector(
            QR_LIST_SELECTOR
        );

        if (!rightList) {
            return;
        }

        const oldButton = document.querySelector(
            `#${BACKUP_BUTTON_ID}`
        );

        /*
         * 如果旧版本残留了右下角悬浮按钮，
         * 先移除它。
         */
        if (
            oldButton &&
            !rightList.contains(oldButton)
        ) {
            oldButton.remove();
        }

        if (
            rightList.querySelector(
                `#${BACKUP_BUTTON_ID}`
            )
        ) {
            return;
        }

        const button = document.createElement('button');

        button.id = BACKUP_BUTTON_ID;
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
            openBackupPanel();
        });

        rightList.appendChild(button);
    }

    function watchQrAssistant() {
        const qrMenu = document.querySelector(
            QR_MENU_SELECTOR
        );

        if (!qrMenu) {
            if (!qrRetryTimer) {
                qrRetryTimer = setTimeout(() => {
                    qrRetryTimer = null;
                    watchQrAssistant();
                }, 1000);
            }

            return;
        }

        addBackupButtonToQrMenu();

        if (qrObserverStarted) {
            return;
        }

        qrObserverStarted = true;

        const observer = new MutationObserver(() => {
            addBackupButtonToQrMenu();
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

        const info = getCurrentChatInfo();

        if (info.key !== currentChatKey) {
            currentChatKey = info.key;
            inputInitialized = false;
            lastText = textarea.value;

            /*
             * 切换聊天时，只有输入框为空才恢复。
             */
            if (!textarea.value) {
                setTimeout(() => {
                    restoreCurrentDraft();
                }, 300);
            }

            return;
        }

        if (!inputInitialized) {
            inputInitialized = true;
            lastText = textarea.value;
            return;
        }

        /*
         * 捕获酒馆程序主动修改输入框的情况。
         */
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
        saveCurrentDraft(textarea.value);
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            closeBackupPanel();
        }
    });

    function start() {
        createBackupPanel();
        watchQrAssistant();
        checkInput();

        setInterval(() => {
            checkInput();
            watchQrAssistant();
        }, CHECK_DELAY);

        setTimeout(() => {
            restoreCurrentDraft();
        }, 1200);

        console.log(
            '[输入框实时备份] 已启动'
        );
    }

    if (
        document.readyState === 'loading'
    ) {
        document.addEventListener(
            'DOMContentLoaded',
            start,
            { once: true }
        );
    } else {
        start();
    }
})();
