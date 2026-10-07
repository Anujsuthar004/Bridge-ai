import type { ContextPayload } from '~adapters/types';
import { PLATFORMS } from '~adapters/types';
import { pendingKey, readPending, removePending, cleanExpiredTransfers } from '~lib/pendingTransfers';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const run = async () => {
        if (sender.tab?.id === undefined) throw new Error('Transfer must originate from a chat tab.');
        if (message.type === 'GET_PENDING_CONTEXT') return { payload: await readPending(sender.tab.id) };
        if (message.type === 'CLEAR_PENDING_CONTEXT') {
            await removePending(sender.tab.id, message.id);
            return { success: true };
        }
        if (message.type !== 'TRANSFER_CONTEXT') throw new Error('Unknown BridgeAI action.');
        const payload = message.payload as ContextPayload;
        const platform = PLATFORMS.find(item => item.id === payload.destinationPlatform);
        if (!platform || !payload.formattedPrompt?.trim()) throw new Error('Invalid transfer destination or empty context.');
        // Bind the payload before navigation. Another tab on the same platform
        // must never consume this transfer, including concurrent transfers.
        const tab = await chrome.tabs.create({ url: 'about:blank', active: false });
        if (tab.id === undefined) throw new Error('Could not create a destination tab.');
        try {
            await chrome.storage.local.set({ [pendingKey(tab.id)]: { ...payload, targetTabId: tab.id, timestamp: Date.now() } });
            await chrome.tabs.update(tab.id, { url: platform.url, active: true });
        } catch (error) {
            await chrome.storage.local.remove(pendingKey(tab.id));
            await chrome.tabs.remove(tab.id);
            throw error;
        }
        return { success: true };
    };
    run().then(sendResponse).catch(error => sendResponse({ success: false, error: error instanceof Error ? error.message : 'Transfer failed.' }));
    return true;
});
chrome.tabs.onRemoved.addListener(tabId => { chrome.storage.local.remove(pendingKey(tabId)).catch(console.error); });
chrome.alarms.create('cleanupPayloads', { periodInMinutes: 5 });
chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === 'cleanupPayloads') cleanExpiredTransfers().catch(console.error); });
