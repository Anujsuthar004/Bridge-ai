# BridgeAI Privacy Policy

BridgeAI processes conversation text locally in your browser. It does not operate an external backend, collect analytics, or call any AI or summarization API.

## What is stored

When you save, copy, or transfer a project, BridgeAI stores its name, editable brief, original request, pinned messages, source conversation URLs and message numbers, and exact working material in `chrome.storage.local`. Saved project memory is not synced by BridgeAI and remains until you delete that project or uninstall the extension.

Opening the editor alone does not save a new project. Unsaved edits are held in the page session. Select a project explicitly when continuing existing work; unrelated chats are not automatically merged.

Pending transfer prompts are stored separately and bound to the destination tab. They are rejected after five minutes and removed on periodic cleanup, dismissal, or tab closure. Cleanup alarms may run later when the browser is asleep. An already displayed prompt can remain in the page until you dismiss or close it; expiry does not erase the clipboard.

## Where data goes

When a transfer arrives, BridgeAI places the handoff in the destination's chat box. It never presses send, and it does not overwrite text you have already typed. When you submit the handoff, the destination AI provider receives it under that provider's policies.

If you choose "Ask … to draft it", BridgeAI places a brief request in your current chat box. Nothing is sent unless you send it; if you do, that request goes to the provider you are already using, which then reads its own conversation. BridgeAI reads the reply from the page to fill your project fields.

BridgeAI writes to your system clipboard only after you click a button: Copy context, or as a fallback when text cannot be placed in the chat box. Clipboard contents may be accessible to other applications or your operating system's clipboard history.

Images, files, and hidden/unloaded messages are not automatically transferred. "Load earlier messages" only scrolls the conversation you are viewing so the page loads older messages. Source conversation links included in the handoff may themselves contain private identifiers. Review the preview before copying or submitting.

## Your controls

Edit or remove project memory and pinned messages before transferring. Use **Delete saved project** in the transfer editor to remove a saved project's local memory. This does not delete copies already on the clipboard, in an incoming transfer, or submitted to an AI provider. Dismiss incoming transfers separately. Uninstalling the extension removes its Chrome local storage.

Host permissions are restricted to the supported ChatGPT, Claude, and Gemini domains. The extension also uses storage, tabs, alarms, and clipboard-write permissions for the functions described above.

## Limited use

BridgeAI uses captured website content and user-entered project memory only to provide its visible context-retention and transfer features. It does not sell this data, use it for advertising, creditworthiness or lending decisions, or transmit it for unrelated purposes. The developer does not receive or read users' saved conversations. BridgeAI's use of information adheres to the Chrome Web Store User Data Policy, including the Limited Use requirements.
