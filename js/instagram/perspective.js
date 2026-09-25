/**
 * ============================================================================
 * Instagram conversation perspective controller
 * ============================================================================
 * Handles flipping the Instagram DM chat view perspective (sender / receiver).
 * In 1-on-1 conversations, swaps the two participants with one click.
 * In group chats (3+ participants), opens a modal sheet to choose whose
 * perspective to view the thread from.
 * ============================================================================
 */
import { $, escapeAttribute, escapeHtml } from "../shared/dom.js?v=1.7.3";
import { pushOverlayState, popOverlayState } from "../shared/history.js?v=1.7.3";
import { initialsFor } from "./parser.js?v=1.7.3";
import { igState } from "./state.js?v=1.7.3";

let handlers = {
    onRender: () => {},
    onToast: () => {},
    closeMenu: () => {}
};

/** Configure external callbacks for render, toasts, and menus. */
export function setupIgPerspective(options = {}) {
    handlers = { ...handlers, ...options };
}

/**
 * Returns a sorted list of unique sender names from the loaded conversation.
 * Sorted by message count descending, then alphabetically.
 */
export function getIgSenders(senderStats = igState.senderStats) {
    return Object.keys(senderStats || {}).sort((a, b) => {
        const countDiff = (senderStats[b] || 0) - (senderStats[a] || 0);
        if (countDiff !== 0) return countDiff;
        return a.localeCompare(b);
    });
}

/**
 * Triggered from the 3-dots header menu.
 * Validates conversation state, then either immediately swaps (for 2 participants)
 * or opens the participant picker sheet (for 3+ participants).
 */
export function handleIgFlipViewAction(event) {
    if (event?.preventDefault) event.preventDefault();
    handlers.closeMenu();

    if (!igState.messages.length) {
        handlers.onToast("Load a conversation first", "warn");
        return;
    }

    const senders = getIgSenders(igState.senderStats);
    if (!senders.length) {
        handlers.onToast("No participants found in this conversation", "warn");
        return;
    }

    if (senders.length === 1) {
        const onlySender = senders[0];
        if (igState.myName && igState.myName.toLowerCase() === onlySender.toLowerCase()) {
            handlers.onToast("Only 1 participant in this conversation", "info");
        } else {
            setInstagramPerspective(onlySender);
        }
        return;
    }

    if (senders.length === 2) {
        const currentName = (igState.myName || "").toLowerCase();
        let targetSender;

        if (currentName === senders[0].toLowerCase()) {
            targetSender = senders[1];
        } else if (currentName === senders[1].toLowerCase()) {
            targetSender = senders[0];
        } else {
            targetSender = senders[1];
        }

        setInstagramPerspective(targetSender);
        return;
    }

    // 3 or more participants in a group DM
    openIgPerspectiveSheet();
}

/**
 * Updates the active perspective to `newSenderName`, re-evaluates isMe across
 * all messages, and re-renders the conversation.
 */
export function setInstagramPerspective(newSenderName) {
    if (!newSenderName) return;

    igState.myName = newSenderName;

    const targetLower = newSenderName.toLowerCase();
    for (const msg of igState.messages) {
        if (msg.type === "msg") {
            msg.isMe = (msg.sender || "").toLowerCase() === targetLower;
        }
    }

    if (typeof document !== "undefined") {
        const nameInput = $("ig-my-name");
        if (nameInput) nameInput.value = igState.myName;
    }

    try {
        if (typeof window !== "undefined" && window.localStorage) {
            window.localStorage.setItem("chatlume-ig-display-name", igState.myName);
        }
    } catch (_) {}

    handlers.onRender();
    handlers.onToast(`Flipped view: now viewing as ${igState.myName}`);
}

/**
 * Opens the "View Chat As" sheet for group conversations.
 */
export function openIgPerspectiveSheet() {
    const sheet = $("ig-perspective-sheet");
    const list = $("ig-perspective-list");
    if (!sheet || !list) return;

    const senders = getIgSenders(igState.senderStats);
    const currentName = (igState.myName || "").toLowerCase();

    let html = "";
    for (const sender of senders) {
        const count = igState.senderStats[sender] || 0;
        const isCurrent = sender.toLowerCase() === currentName;
        const initials = initialsFor(sender);

        html += `
            <button type="button" class="perspective-item ${isCurrent ? "active" : ""}" data-perspective-sender="${escapeAttribute(sender)}">
                <span class="perspective-avatar" style="background:linear-gradient(135deg,#833AB4,#C13584,#E1306C)" aria-hidden="true">${escapeHtml(initials)}</span>
                <div class="perspective-info">
                    <span class="perspective-name">${escapeHtml(sender)}</span>
                    <span class="perspective-count">${count.toLocaleString()} message${count === 1 ? "" : "s"}</span>
                </div>
                ${isCurrent ? '<span class="perspective-badge" style="background:#C13584">Current</span>' : ""}
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
    pushOverlayState("ig-perspective-sheet");
}

/**
 * Closes the "View Chat As" sheet.
 */
export function closeIgPerspectiveSheet() {
    const sheet = $("ig-perspective-sheet");
    if (!sheet) return;

    sheet.classList.remove("open");
    window.setTimeout(() => {
        if (!sheet.classList.contains("open")) {
            sheet.hidden = true;
        }
    }, 180);
}
