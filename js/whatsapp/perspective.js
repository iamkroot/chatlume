/**
 * ============================================================================
 * Chat perspective controller
 * ============================================================================
 * Handles flipping the chat view perspective (sender / receiver).
 * In 1-on-1 chats, swaps the two participants with one click.
 * In group chats (3+ participants), opens a modal sheet to choose whose
 * perspective to view the chat from.
 * ============================================================================
 */
import { $, escapeAttribute, escapeHtml } from "../shared/dom.js?v=1.7.3";
import { pushOverlayState, popOverlayState } from "../shared/history.js?v=1.7.3";
import { colorForName } from "../shared/colors.js?v=1.7.3";
import { state } from "./state.js?v=1.7.3";
import { getChatSenders, populateSenderFilter } from "./filter.js?v=1.7.3";

let handlers = {
    onRender: () => {},
    onToast: () => {},
    closeMenu: () => {}
};

/** Configure external callbacks for render, toasts, and menus. */
export function setupPerspective(options = {}) {
    handlers = { ...handlers, ...options };
}

/** Colour for a participant avatar, stable for the life of the chat. */
export const getColor = (name) => colorForName(name, state.colorMap);

/** Up to two initials for the participant avatar circle. */
export function initialsFor(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Triggered from the 3-dots header menu.
 * Validates chat state, then either immediately swaps (for 2 participants)
 * or opens the participant picker sheet (for 3+ participants).
 */
export function handleFlipViewAction(event) {
    if (event?.preventDefault) event.preventDefault();
    handlers.closeMenu();

    if (!state.messages.length) {
        handlers.onToast("Load a chat first", "warn");
        return;
    }

    const senders = getChatSenders(state.senderStats);
    if (!senders.length) {
        handlers.onToast("No participants found in this chat", "warn");
        return;
    }

    if (senders.length === 1) {
        const onlySender = senders[0];
        if (state.myName && state.myName.toLowerCase() === onlySender.toLowerCase()) {
            handlers.onToast("Only 1 participant in this chat", "info");
        } else {
            setChatPerspective(onlySender);
        }
        return;
    }

    if (senders.length === 2) {
        const currentName = (state.myName || "").toLowerCase();
        let targetSender;

        if (currentName === senders[0].toLowerCase()) {
            targetSender = senders[1];
        } else if (currentName === senders[1].toLowerCase()) {
            targetSender = senders[0];
        } else {
            // Neither matched exactly (e.g. initial name had a typo or was "You")
            const youIndex = senders.findIndex((s) => s.toLowerCase() === "you");
            if (youIndex !== -1) {
                targetSender = youIndex === 0 ? senders[1] : senders[0];
            } else {
                targetSender = senders[1];
            }
        }

        setChatPerspective(targetSender);
        return;
    }

    // 3 or more participants in a group chat
    openPerspectiveSheet();
}

/**
 * Updates the active perspective to `newSenderName`, re-evaluates isMe across
 * all messages, and synchronizes the UI, storage, and filter badges.
 */
export function setChatPerspective(newSenderName) {
    if (!newSenderName) return;

    state.myName = newSenderName;

    const targetLower = newSenderName.toLowerCase();
    for (const item of state.messages) {
        if (item.type === "msg") {
            item.isMe = (item.sender || "").toLowerCase() === targetLower;
        }
    }

    if (typeof document !== "undefined") {
        const nameInput = $("display-name");
        if (nameInput) nameInput.value = state.myName;

        const profileName = $("profile-display-name");
        if (profileName) profileName.innerText = state.myName || "You";

        populateSenderFilter();
    }

    try {
        if (typeof window !== "undefined" && window.localStorage) {
            window.localStorage.setItem("chatlume-display-name", state.myName);
        }
    } catch (_) {}

    if (state.activeImportId) {
        const record = state.storedImports.find((item) => item.id === state.activeImportId);
        if (record) {
            record.displayName = state.myName;
        }
    }

    handlers.onRender();
    handlers.onToast(`Flipped view: now viewing as ${state.myName}`);
}

/**
 * Opens the "View Chat As" sheet for group conversations.
 */
export function openPerspectiveSheet() {
    const sheet = $("perspective-sheet");
    const list = $("perspective-list");
    if (!sheet || !list) return;

    const senders = getChatSenders(state.senderStats);
    const currentName = (state.myName || "").toLowerCase();

    let html = "";
    for (const sender of senders) {
        const count = state.senderStats[sender] || 0;
        const isCurrent = sender.toLowerCase() === currentName;
        const color = getColor(sender);
        const initials = initialsFor(sender);

        html += `
            <button type="button" class="perspective-item ${isCurrent ? "active" : ""}" data-perspective-sender="${escapeAttribute(sender)}">
                <span class="perspective-avatar" style="background:${color}" aria-hidden="true">${escapeHtml(initials)}</span>
                <div class="perspective-info">
                    <span class="perspective-name">${escapeHtml(sender)}</span>
                    <span class="perspective-count">${count.toLocaleString()} message${count === 1 ? "" : "s"}</span>
                </div>
                ${isCurrent ? '<span class="perspective-badge">Current</span>' : ""}
            </button>
        `;
    }

    list.innerHTML = html;
    sheet.hidden = false;
    requestAnimationFrame(() => {
        sheet.classList.add("open");
        const activeBtn = list.querySelector(".perspective-item.active") || list.querySelector(".perspective-item");
        activeBtn?.focus({ preventScroll: true });
    });
    pushOverlayState("perspective-sheet");
}

/**
 * Closes the "View Chat As" sheet.
 */
export function closePerspectiveSheet() {
    const sheet = $("perspective-sheet");
    if (!sheet) return;

    sheet.classList.remove("open");
    window.setTimeout(() => {
        if (!sheet.classList.contains("open")) {
            sheet.hidden = true;
        }
    }, 180);
}
