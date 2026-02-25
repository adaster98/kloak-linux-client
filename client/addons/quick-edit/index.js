(async () => {
  const ADDON_ID = "quick-edit";

  // Fetch config once on startup
  let config = { maxMessages: 10 };
  try {
    if (window.electronAPI && window.electronAPI.getAddonConfig) {
      const savedConfig = await window.electronAPI.getAddonConfig(ADDON_ID);
      if (savedConfig && savedConfig.maxMessages) {
        config.maxMessages = parseInt(savedConfig.maxMessages, 10);
      }
    }
  } catch (e) {
    console.error(`[${ADDON_ID}] Failed to load config:`, e);
  }

  let upArrowHandler = null;

  // Register the Addon
  window.KloakAddons.registerAddon({
    id: ADDON_ID,
    name: "Quick Edit",
    description: "Press Up Arrow to instantly edit your last sent message.",

    onEnable: () => {
      let isSearching = false;

      upArrowHandler = async (e) => {
        if (e.key !== "ArrowUp") return;

        const target = e.target;
        const isTextInput =
          target.tagName === "TEXTAREA" ||
          target.tagName === "INPUT" ||
          target.isContentEditable;
        if (!isTextInput) return;

        const value =
          target.value !== undefined ? target.value : target.textContent;
        if (value.trim() !== "") return;

        e.preventDefault();
        if (isSearching) return;
        isSearching = true;

        // Grab recent messages based on limit
        const messages = Array.from(
          document.querySelectorAll(
            'div[id^="message-"], div[id^="dm-message-"]',
          ),
        )
          .reverse()
          .slice(0, config.maxMessages);

        for (const msg of messages) {
          // Look for the inline Edit button
          const editBtn = msg.querySelector('button[aria-label="Edit"]');

          if (editBtn) {
            editBtn.click();

            // Wait for React to mount the textarea and grab focus
            let attempts = 0;
            const focusInterval = setInterval(() => {
              attempts++;
              const editBox = msg.querySelector("textarea");

              if (editBox) {
                clearInterval(focusInterval);
                editBox.focus();
                const textLen = editBox.value.length;
                editBox.setSelectionRange(textLen, textLen);

                // Double-tap the focus just in case React tries to steal it back
                setTimeout(() => {
                  editBox.focus();
                  editBox.setSelectionRange(textLen, textLen);
                  // Grab the entire message group wrapper
                  const messageContainer = editBox.closest(".group") || msg;
                  // Scroll the whole block into view
                  messageContainer.scrollIntoView({
                    behavior: "smooth",
                    block: "nearest",
                  });
                }, 50);
              } else if (attempts > 50) {
                clearInterval(focusInterval); // Give up after 500ms
              }
            }, 10);

            isSearching = false;
            return; // Stop searching
          }
        }

        isSearching = false;
      };

      document.addEventListener("keydown", upArrowHandler, true);
    },

    onDisable: () => {
      if (upArrowHandler) {
        document.removeEventListener("keydown", upArrowHandler, true);
        upArrowHandler = null;
      }
    },

    renderSettings: (container) => {
      container.innerHTML = `
            <div class="addon-settings-item">
                <p style="margin: 0; color: var(--kloak-text-sub); font-size: 13px;">Configure how far up the chat the script will search for your last message.</p>
                <label class="addon-label">Search Limit (Messages)</label>
                <input id="qe-limit-input" type="number" min="1" max="50" value="${config.maxMessages}" style="width: 100%; padding: 10px; background: var(--kloak-bg-box); border: 1px solid var(--kloak-bg-btn); border-radius: 6px; color: var(--kloak-text-main); margin-top: 6px; outline: none;">
            </div>
            <button id="qe-save-btn" class="addon-btn-save">Save Changes</button>
            `;

      container.querySelector("#qe-save-btn").addEventListener("click", () => {
        let newLimit = parseInt(
          container.querySelector("#qe-limit-input").value,
          10,
        );
        if (isNaN(newLimit) || newLimit < 1) newLimit = 10;

        config.maxMessages = newLimit;
        container.querySelector("#qe-limit-input").value = newLimit;

        if (window.electronAPI && window.electronAPI.saveAddonConfig) {
          window.electronAPI.saveAddonConfig({
            addonId: ADDON_ID,
            data: config,
          });
          const saveBtn = container.querySelector("#qe-save-btn");
          const originalText = saveBtn.textContent;
          saveBtn.textContent = "✓ Saved to config";
          setTimeout(() => (saveBtn.textContent = originalText), 2000);
        }
      });
    },
  });
})();
