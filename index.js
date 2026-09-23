(() => {
    'use strict';

    const STORAGE_KEY = 'st_mobile_draft_backup_v1';
    const TEXTAREA_SELECTOR = '#send_textarea';
    const SAVE_DELAY = 400;
    const CHECK_DELAY = 500;

    let saveTimer = null;
    let lastText = null;
    let currentChatKey = null;
    let initialized = false;

    function getContext() {
        try {
            return SillyTavern.getContext();
        } catch {
            return {};
        }
    }

    function getTextarea() {
        return document.querySelector(TEXTAREA_SELECTOR);
    }

    function getStorage() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        } catch {
            return {};
        }
    }

    function setStorage(data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    function getChatInfo() {
        const context = getContext();

        let chatId =
            context.getCurrentChatId?.() ||
            context.chatId ||
            context.chat_id ||
            '';

        let characterId =
            context.characterId ||
            context.character_id ||
            '';

        let groupId =
            context.groupId ||
            context.group_id ||
            '';

        /*
         * 如果酒馆没有提供聊天 ID，就用当前地址作为备用标识。
         */
        if (!chatId) {
            chatId = location.href;
        }

        const character =
            context.characters?.[characterId] ||
            context.character ||
            null;

        const characterName =
            character?.name ||
            character?.data?.name ||
            (groupId ? `群聊 ${groupId}` : '当前聊天');

        const key = [
            groupId ? `group-${groupId}` : `character-${characterId}`,
            `chat-${chatId}`,
        ].join('__');

        return {
            key,
            name: characterName,
            chatId: String(chatId),
            groupId: String(groupId || ''),
            updatedAt: Date.now(),
        };
    }

    function saveDraft(text) {
        const info = getChatInfo();
        const drafts = getStorage();

        /*
         * 输入框被清空，视为消息已经发送或草稿被主动清除。
         */
        if (!text) {
            delete drafts[info.key];
            setStorage(drafts);
            updateStatus('已清除当前草稿');
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

        setStorage(drafts);
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
        const drafts = getStorage();
        const draft = drafts[info.key];

        if (!draft?.text) {
            return;
        }

        /*
         * 默认不覆盖用户当前已经输入的文字。
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

        return new Date(timestamp).toLocaleString();
    }

    function escapeHTML(text) {
        return String(text)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function updateStatus(text) {
        const status = document.querySelector('#st-draft-backup-status');

        if (status) {
            status.textContent = text;
        }
    }

    function createButton() {
        if (document.querySelector('#st-draft-backup-button')) {
            return;
        }

        const button = document.createElement('button');

        button.id = 'st-draft-backup-button';
        button.type = 'button';
        button.textContent = '备份';
        button.title = '打开输入框备份';

        Object.assign(button.style, {
            position: 'fixed',
            right: '12px',
            bottom: '88px',
            zIndex: '99999',
            padding: '8px 12px',
            border: '1px solid currentColor',
            borderRadius: '8px',
            background: 'var(--SmartThemeBodyColor, #333)',
            color: 'var(--SmartThemeFontColor, #fff)',
            fontSize: '14px',
            opacity: '0.9',
        });

        button.addEventListener('click', openBackupPanel);

        document.body.appendChild(button);
    }

    function createPanel() {
        if (document.querySelector('#st-draft-backup-panel')) {
            return;
        }

        const panel = document.createElement('div');

        panel.id = 'st-draft-backup-panel';

        Object.assign(panel.style, {
            display: 'none',
            position: 'fixed',
            inset: '0',
            zIndex: '100000',
            background: 'rgba(0, 0, 0, 0.65)',
            padding: '20px',
            overflowY: 'auto',
        });

        panel.innerHTML = `
            <div id="st-draft-backup-box" style="
                max-width: 600px;
                margin: 20px auto;
                padding: 16px;
                border-radius: 12px;
                background: var(--SmartThemeBodyColor, #222);
                color: var(--SmartThemeFontColor, #fff);
                box-shadow: 0 4px 20px rgba(0,0,0,.5);
            ">
                <div style="
                    display:flex;
                    align-items:center;
                    justify-content:space-between;
                    gap:8px;
                    margin-bottom:12px;
                ">
                    <strong style="font-size:18px;">输入框备份</strong>
                    <button id="st-draft-backup-close" type="button">关闭</button>
                </div>

                <div id="st-draft-backup-status" style="
                    margin-bottom:12px;
                    opacity:.75;
                    font-size:13px;
                ">备份保存在当前浏览器</div>

                <div id="st-draft-backup-list"></div>

                <div style="
                    display:flex;
                    gap:8px;
                    margin-top:16px;
                ">
                    <button id="st-draft-backup-refresh" type="button">
                        刷新列表
                    </button>

                    <button id="st-draft-backup-clear-all" type="button">
                        删除全部
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(panel);

        panel.addEventListener('click', event => {
            if (event.target === panel) {
                closeBackupPanel();
            }
        });

        panel.querySelector('#st-draft-backup-close')
            .addEventListener('click', closeBackupPanel);

        panel.querySelector('#st-draft-backup-refresh')
            .addEventListener('click', renderBackupList);

        panel.querySelector('#st-draft-backup-clear-all')
            .addEventListener('click', () => {
                if (!confirm('确定删除全部输入备份吗？')) {
                    return;
                }

                localStorage.removeItem(STORAGE_KEY);
                renderBackupList();
                updateStatus('已删除全部备份');
            });

        panel.querySelector('#st-draft-backup-list')
            .addEventListener('click', event => {
                const restoreButton =
                    event.target.closest('[data-restore-key]');

                const deleteButton =
                    event.target.closest('[data-delete-key]');

                if (restoreButton) {
                    restoreDraftByKey(
                        restoreButton.dataset.restoreKey,
                    );
                }

                if (deleteButton) {
                    deleteDraftByKey(
                        deleteButton.dataset.deleteKey,
                    );
                }
            });
    }

    function renderBackupList() {
        const list = document.querySelector('#st-draft-backup-list');

        if (!list) {
            return;
        }

        const drafts = Object.values(getStorage())
            .sort((a, b) => b.updatedAt - a.updatedAt);

        if (!drafts.length) {
            list.innerHTML = `
                <div style="padding:20px 0; opacity:.7;">
                    暂时没有备份。
                </div>
            `;
            return;
        }

        list.innerHTML = drafts.map(draft => `
            <div style="
                margin-bottom:10px;
                padding:12px;
                border:1px solid currentColor;
                border-radius:8px;
            ">
                <div style="font-weight:bold;">
                    ${escapeHTML(draft.name || '未命名聊天')}
                </div>

                <div style="
                    margin:4px 0 8px;
                    opacity:.7;
                    font-size:12px;
                ">
                    ${escapeHTML(formatTime(draft.updatedAt))}
                </div>

                <div style="
                    max-height:80px;
                    overflow:hidden;
                    white-space:pre-wrap;
                    opacity:.85;
                    font-size:13px;
                ">
                    ${escapeHTML(draft.text)}
                </div>

                <div style="
                    display:flex;
                    gap:8px;
                    margin-top:10px;
                ">
                    <button
                        type="button"
                        data-restore-key="${escapeHTML(draft.key)}"
                    >
                        恢复
                    </button>

                    <button
                        type="button"
                        data-delete-key="${escapeHTML(draft.key)}"
                    >
                        删除
                    </button>
                </div>
            </div>
        `).join('');
    }

    function openBackupPanel() {
        createPanel();
        renderBackupList();

        const panel = document.querySelector('#st-draft-backup-panel');

        if (panel) {
            panel.style.display = 'block';
        }
    }

    function closeBackupPanel() {
        const panel = document.querySelector('#st-draft-backup-panel');

        if (panel) {
            panel.style.display = 'none';
        }
    }

    function restoreDraftByKey(key) {
        const drafts = getStorage();
        const draft = drafts[key];

        if (!draft) {
            alert('找不到这条备份。');
            renderBackupList();
            return;
        }

        const textarea = getTextarea();

        if (!textarea) {
            alert('找不到酒馆输入框。');
            return;
        }

        textarea.value = draft.text;

        textarea.dispatchEvent(new Event('input', {
            bubbles: true,
        }));

        lastText = textarea.value;
        closeBackupPanel();
        updateStatus('已恢复备份');
    }

    function deleteDraftByKey(key) {
        const drafts = getStorage();

        delete drafts[key];
        setStorage(drafts);

        renderBackupList();
        updateStatus('已删除备份');
    }

    function checkInput() {
        const textarea = getTextarea();

        if (!textarea) {
            return;
        }

        const info = getChatInfo();

        if (info.key !== currentChatKey) {
            currentChatKey = info.key;
            lastText = textarea.value;

            /*
             * 切换聊天后，只有输入框为空才自动恢复。
             */
            if (!textarea.value) {
                restoreCurrentDraft();
            }

            return;
        }

        if (!initialized) {
            initialized = true;
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

    document.addEventListener('input', event => {
        const textarea = event.target;

        if (!(textarea instanceof HTMLTextAreaElement)) {
            return;
        }

        if (textarea.id !== 'send_textarea') {
            return;
        }

        lastText = textarea.value;
        scheduleSave(textarea.value);
    }, true);

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
            closeBackupPanel();
        }
    });

    function start() {
        createButton();
        createPanel();
        checkInput();

        setInterval(checkInput, CHECK_DELAY);

        setTimeout(() => {
            restoreCurrentDraft();
        }, 1200);

        console.log('[输入框备份] 扩展已启动');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
            function createButton() {
        const qrMenu = document.querySelector('#qr-assistant');

        /*
         * QR 助手可能比本扩展晚加载。
         * 找不到菜单就稍后重试。
         */
        if (!qrMenu) {
            setTimeout(createButton, 800);
            return;
        }

        /*
         * 监听 QR 助手菜单重绘。
         * QR 助手每次打开菜单都会重新生成按钮，
         * 所以必须监听它的 DOM 变化。
         */
        if (qrMenu.dataset.stDraftObserver !== 'true') {
            const observer = new MutationObserver(() => {
                addBackupButtonToQrMenu();
            });

            observer.observe(qrMenu, {
                childList: true,
                subtree: true,
            });

            qrMenu.dataset.stDraftObserver = 'true';
        }

        addBackupButtonToQrMenu();
    }

    function addBackupButtonToQrMenu() {
        const rightList = document.querySelector('#qr-list-right');

        if (!rightList) {
            return;
        }

        /*
         * 已经存在就不重复添加。
         */
        if (
            rightList.querySelector(
                '#st-draft-backup-button'
            )
        ) {
            return;
        }

        const button = document.createElement('button');

        button.id = 'st-draft-backup-button';
        button.type = 'button';
        button.className = 'action-item';
        button.dataset.label = '📦备份';

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
})();
