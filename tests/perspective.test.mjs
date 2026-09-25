import assert from "node:assert/strict";
import { describe, test, beforeEach } from "node:test";
import { versioned } from "./versioned.mjs";

const { state } = await versioned("../js/whatsapp/state.js");
const { initialsFor, setChatPerspective } = await versioned("../js/whatsapp/perspective.js");
const { igState } = await versioned("../js/instagram/state.js");
const { getIgSenders, setInstagramPerspective } = await versioned("../js/instagram/perspective.js");

describe("perspective/initialsFor", () => {
    test("handles full names, single names, and empty inputs", () => {
        assert.equal(initialsFor("Paras Sharma"), "PS");
        assert.equal(initialsFor("Alice"), "AL");
        assert.equal(initialsFor("A B C D"), "AD");
        assert.equal(initialsFor(""), "?");
        assert.equal(initialsFor(null), "?");
        assert.equal(initialsFor("   "), "?");
    });
});

describe("whatsapp/perspective 1-on-1 and group flipping", () => {
    beforeEach(() => {
        state.messages = [
            { type: "date", content: "01/01/2024", id: "date-0" },
            { type: "msg", id: "msg-1", sender: "Alice", text: "Hello", isMe: true },
            { type: "msg", id: "msg-2", sender: "Bob", text: "Hi Alice", isMe: false },
            { type: "msg", id: "msg-3", sender: "Alice", text: "How are you?", isMe: true },
            { type: "msg", id: "msg-4", sender: "Charlie", text: "Hey both", isMe: false }
        ];
        state.filteredMessages = state.messages;
        state.myName = "Alice";
        state.senderStats = { Alice: 2, Bob: 1, Charlie: 1 };
    });

    test("setChatPerspective flips perspective in a 2-person conversation", () => {
        // Switch from Alice to Bob
        setChatPerspective("Bob");

        assert.equal(state.myName, "Bob");
        assert.equal(state.messages[1].isMe, false); // Alice
        assert.equal(state.messages[2].isMe, true);  // Bob
        assert.equal(state.messages[3].isMe, false); // Alice
        assert.equal(state.messages[4].isMe, false); // Charlie

        // Switch back from Bob to Alice
        setChatPerspective("Alice");

        assert.equal(state.myName, "Alice");
        assert.equal(state.messages[1].isMe, true);  // Alice
        assert.equal(state.messages[2].isMe, false); // Bob
        assert.equal(state.messages[3].isMe, true);  // Alice
        assert.equal(state.messages[4].isMe, false); // Charlie
    });

    test("setChatPerspective is case-insensitive", () => {
        setChatPerspective("bob");
        assert.equal(state.messages[2].isMe, true);
        assert.equal(state.messages[1].isMe, false);
    });

    test("setChatPerspective allows setting any group participant as perspective", () => {
        setChatPerspective("Charlie");

        assert.equal(state.myName, "Charlie");
        assert.equal(state.messages[1].isMe, false); // Alice
        assert.equal(state.messages[2].isMe, false); // Bob
        assert.equal(state.messages[3].isMe, false); // Alice
        assert.equal(state.messages[4].isMe, true);  // Charlie
    });

    test("handles 'You' sender alias appropriately without keeping both as isMe", () => {
        state.messages = [
            { type: "msg", id: "msg-1", sender: "You", text: "Hello", isMe: true },
            { type: "msg", id: "msg-2", sender: "Bob", text: "Hi", isMe: false }
        ];
        state.filteredMessages = state.messages;
        state.myName = "You";

        // Flip to Bob
        setChatPerspective("Bob");
        assert.equal(state.myName, "Bob");
        assert.equal(state.messages[0].isMe, false); // "You" is now false
        assert.equal(state.messages[1].isMe, true);  // "Bob" is now true

        // Flip back to You
        setChatPerspective("You");
        assert.equal(state.myName, "You");
        assert.equal(state.messages[0].isMe, true);  // "You" is now true
        assert.equal(state.messages[1].isMe, false); // "Bob" is now false
    });
});

describe("instagram/perspective", () => {
    beforeEach(() => {
        igState.messages = [
            { type: "msg", id: "ig-1", sender: "alex_user", text: "hey", isMe: true },
            { type: "msg", id: "ig-2", sender: "sam_user", text: "yo", isMe: false },
            { type: "msg", id: "ig-3", sender: "jordan_user", text: "group msg", isMe: false }
        ];
        igState.myName = "alex_user";
        igState.senderStats = { alex_user: 5, sam_user: 3, jordan_user: 8 };
    });

    test("getIgSenders orders senders by message count descending, then alphabetically", () => {
        const sorted = getIgSenders(igState.senderStats);
        assert.deepEqual(sorted, ["jordan_user", "alex_user", "sam_user"]);
    });

    test("setInstagramPerspective updates igState.myName and isMe flags", () => {
        setInstagramPerspective("sam_user");

        assert.equal(igState.myName, "sam_user");
        assert.equal(igState.messages[0].isMe, false); // alex
        assert.equal(igState.messages[1].isMe, true);  // sam
        assert.equal(igState.messages[2].isMe, false); // jordan

        setInstagramPerspective("jordan_user");

        assert.equal(igState.myName, "jordan_user");
        assert.equal(igState.messages[0].isMe, false);
        assert.equal(igState.messages[1].isMe, false);
        assert.equal(igState.messages[2].isMe, true);
    });
});
