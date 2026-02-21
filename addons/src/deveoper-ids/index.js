(async () => {
    const ADDON_ID = 'developer-ids';

    const STYLE_CONFIG = {
        msgId: 'kloak-injected-msg-id text-[10px] text-muted-foreground/60 font-mono mt-1 select-text transition-colors hover:text-muted-foreground/80',
        userId: 'kloak-injected-user-id text-[10px] text-muted-foreground/60 font-mono ml-2 mr-1 select-text transition-colors hover:text-muted-foreground/80'
    };

    let domObserver = null;
    let rightClickObserver = null;
    let lastRightClickedMessageId = null;
    let lastRightClickedUserId = null;

    const processMessage = (msgNode) => {
        // Prevent double-processing
        if (msgNode.dataset.messageIdInjected) return;
        msgNode.dataset.messageIdInjected = 'true';

        const fullMsgId = msgNode.id;
        if (!fullMsgId || !fullMsgId.startsWith('message-')) return;
        const msgId = fullMsgId.replace('message-', '');

        // Extract User ID from avatar
        let userId = null;
        const avatarImg = msgNode.querySelector('img[src*="/avatars/"]');
        if (avatarImg) {
            const match = avatarImg.src.match(/\/avatars\/([^\/]+)\//);
            if (match) userId = match[1];
        }

        // Inject Message ID at the bottom
        const contentContainer = msgNode.querySelector('.flex-1.min-w-0.overflow-hidden');
        if (contentContainer && !contentContainer.querySelector('.kloak-injected-msg-id')) {
            const idDiv = document.createElement('div');
            idDiv.className = STYLE_CONFIG.msgId;
            idDiv.textContent = `msg: ${msgId}`;
            contentContainer.appendChild(idDiv);
        }

        // Inject User ID next to the name
        const headerContainer = msgNode.querySelector('.flex.items-baseline.gap-2');
        if (userId && headerContainer && !headerContainer.querySelector('.kloak-injected-user-id')) {
            const uidSpan = document.createElement('span');
            uidSpan.className = STYLE_CONFIG.userId;
            uidSpan.textContent = `usr: ${userId}`;

            // Insert it before the timestamp
            const timestamp = headerContainer.querySelector('.text-muted-foreground');
            if (timestamp) {
                headerContainer.insertBefore(uidSpan, timestamp);
            } else {
                headerContainer.appendChild(uidSpan);
            }
        }
    };

    // Track right clicks to know WHICH message context menu is opening
    const handleContextMenu = (e) => {
        const msgNode = e.target.closest('div[id^="message-"]');
        if (msgNode) {
            lastRightClickedMessageId = msgNode.id.replace('message-', '');

            // Grab the user ID for the context menu
            const avatarImg = msgNode.querySelector('img[src*="/avatars/"]');
            if (avatarImg) {
                const match = avatarImg.src.match(/\/avatars\/([^\/]+)\//);
                lastRightClickedUserId = match ? match[1] : null;
            } else {
                lastRightClickedUserId = null;
            }
        } else {
            lastRightClickedMessageId = null;
            lastRightClickedUserId = null;
        }
    };

    // Helper to clone Kloak's native right-click buttons
    const createContextMenuItem = (text, iconSvg, onClickAction) => {
        const item = document.createElement('div');
        item.className = 'relative flex cursor-default select-none items-center rounded-lg px-3 py-2 text-sm outline-none transition-colors text-popover-foreground hover:bg-white/10 hover:text-foreground focus:bg-white/15 focus:text-foreground kloak-custom-context-btn';
        item.setAttribute('role', 'menuitem');
        item.tabIndex = -1;
        item.innerHTML = `${iconSvg}${text}`;

        item.addEventListener('click', () => {
            onClickAction();
            // Send a fake ESC keypress to elegantly close the menu after clicking
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        });

        return item;
    };

    window.KloakAddons.registerAddon({
        id: ADDON_ID,
        name: 'Developer IDs',
        description: 'Displays raw Message and User IDs in the chat interface and adds copy buttons to the context menu.',

        onEnable: () => {
            document.querySelectorAll('div[id^="message-"]').forEach(processMessage);

            domObserver = new MutationObserver((mutations) => {
                for (const mut of mutations) {
                    for (const node of mut.addedNodes) {
                        if (node.nodeType === 1) {
                            if (node.id && node.id.startsWith('message-')) {
                                processMessage(node);
                            } else if (node.querySelectorAll) {
                                node.querySelectorAll('div[id^="message-"]').forEach(processMessage);
                            }
                        }
                    }
                }
            });
            domObserver.observe(document.body, { childList: true, subtree: true });

            document.addEventListener('contextmenu', handleContextMenu, true);

            rightClickObserver = new MutationObserver((mutations) => {
                for (const mut of mutations) {
                    for (const node of mut.addedNodes) {
                        if (node.nodeType === 1 && node.querySelector && lastRightClickedMessageId) {
                            const menu = node.querySelector('[data-radix-menu-content]') || (node.hasAttribute('data-radix-menu-content') ? node : null);

                            if (menu && !menu.querySelector('.kloak-custom-context-btn')) {

                                // Inject Copy Message ID Button
                                const msgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-hash w-4 h-4 mr-2"><line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/></svg>`;
                                menu.appendChild(createContextMenuItem('Copy Message ID', msgIcon, () => navigator.clipboard.writeText(lastRightClickedMessageId)));

                                // Inject Copy User ID Button
                                if (lastRightClickedUserId) {
                                    const userIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user w-4 h-4 mr-2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
                                    menu.appendChild(createContextMenuItem('Copy User ID', userIcon, () => navigator.clipboard.writeText(lastRightClickedUserId)));
                                }
                            }
                        }
                    }
                }
            });
            rightClickObserver.observe(document.body, { childList: true, subtree: false });
        },

        onDisable: () => {
            if (domObserver) domObserver.disconnect();
            if (rightClickObserver) rightClickObserver.disconnect();
            document.removeEventListener('contextmenu', handleContextMenu, true);

            document.querySelectorAll('.kloak-injected-msg-id, .kloak-injected-user-id').forEach(el => el.remove());
            document.querySelectorAll('div[id^="message-"]').forEach(msg => {
                delete msg.dataset.messageIdInjected;
            });
        }
    });
})();
