# Chrome Web Store listing — v0.1.0

## Existing item

BridgeAI — phobeoflhjedofnpnkejfalfccplopbi
https://chromewebstore.google.com/detail/bridgeai/phobeoflhjedofnpnkejfalfccplopbi

## Name

BridgeAI

## Short description

Switch AI. Keep your progress. Carry project memory and complete pinned messages between ChatGPT, Claude, and Gemini.

## Detailed description

Hit a limit in one AI? Continue in another with the context your task needs.

BridgeAI helps you carry your goals, decisions, progress, and working material between ChatGPT, Claude, and Gemini. Review your handoff, open your destination, then copy, paste, and send.

KEEP YOUR PROJECT MEMORY
• Save an editable brief with your goal, requirements, current decisions, progress, and next action.
• Select the same project when switching again, and update it as your work changes.
• Keep your original request and pin important messages with links back to their source conversation.

PRESERVE COMPLETE WORKING MATERIAL
• Carry selected code, drafts, calculations, and errors without a per-message character cutoff.
• Preserve captured code indentation and paragraph boundaries.
• Choose a compact, balanced, or extended transfer budget. Whole recent messages are included where they fit.
• See exactly which recent messages were omitted. Protected material is never silently shortened; if it is too large, adjust the budget or selection before transferring.

REVIEW BEFORE YOU SEND
• Preview the full handoff.
• Copy directly or open another supported AI.
• Each incoming transfer is delivered to its intended browser tab, with selectable text if clipboard access fails.
• Previous BridgeAI handoff envelopes for the selected project are excluded from recent history to avoid nesting them repeatedly.

LOCAL AND API-FREE
BridgeAI does not require an API key, subscription, or another reply from your current AI. Project memory is edited by you; this version does not automatically summarize conversations or infer decisions.

Saved project memory stays in your browser until you delete it or uninstall the extension. Pending transfers expire after five minutes. BridgeAI has no backend and does not collect analytics or send your chats to its own servers. When you paste and submit a handoff, the destination AI provider receives that text. Review your handoff before sending.

HOW TO USE
1. Open a conversation on ChatGPT, Claude, or Gemini.
2. Click “Transfer · Keep context.”
3. Name or select a project, update its brief, and pin important messages.
4. Review the preview and any omitted-message notice.
5. Choose your destination, click “Copy context” in the new tab, then paste and send.

CAPTURE LIMITATIONS
Only text loaded on the page is captured. Attachments, images, hidden messages, and provider-side memory are not transferred; re-upload files at the destination. Transfer budgets are character budgets, not provider token limits. BridgeAI does not increase or bypass any provider's usage limits. Platform interface changes can affect capture.

WHAT'S NEW IN 0.1.0
Editable saved project memory, complete pinned messages, preserved code formatting, full transfer previews, visible omission notices, and transfers isolated to their destination tab.

Open source: https://github.com/Anujsuthar004/Bridge-ai
Support: https://github.com/Anujsuthar004/Bridge-ai/issues
Privacy: https://github.com/Anujsuthar004/Bridge-ai/blob/main/PRIVACY.md

## Single purpose

Help users preserve and transfer their selected AI conversation context and editable project memory between ChatGPT, Claude, and Gemini.

## Permission justifications

- storage: Save the user's editable project brief, original request, selected pinned messages, and working material locally, plus temporary transfer prompts. Projects are deleted by the user; pending transfers expire after five minutes.
- tabs: Open the chosen AI destination and associate its temporary transfer with that specific tab so another chat cannot consume it. No general browsing history is collected.
- alarms: Periodically remove expired temporary transfer prompts from local storage.
- clipboardWrite: Copy the reviewed handoff to the clipboard after an explicit user action so it can be pasted into the destination AI.
- Host access: Run the capture and transfer interface only on the listed ChatGPT, Claude, and Gemini domains. Capture visible conversation text and its source URL only when the user opens the transfer editor.

## Remote code

No remotely hosted code. JavaScript and CSS are bundled with the extension. No model APIs or remote summarization calls.

## Reviewer test instructions

No BridgeAI account, subscription, or API key is required. A free account on a supported AI platform may be needed to view that provider's conversations.

1. Open a text conversation on ChatGPT, Claude, or Gemini and click “Transfer · Keep context.”
2. Name a project, enter a goal and next action, and pin a message. Expand its text and the full preview to verify that it is complete.
3. Save memory, close, reopen, and select the project to verify persistence. Edit current decisions and save again.
4. Continue in another supported platform. Click “Copy context” in the destination, paste, and review before sending. The extension does not automatically submit a prompt.
5. Open Transfer at the destination and select the same project if needed. Original request and pins should remain. Update progress and transfer again.
6. Enter more than 60,000 characters of working material to verify that a visible size warning blocks transfer rather than shortening protected text.
7. Delete the saved project to remove it from local storage. Dismiss pending incoming context separately.
