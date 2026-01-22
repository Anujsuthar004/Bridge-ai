import type { ContextPayload } from '~adapters/types';
import { PLATFORMS } from '~adapters/types';

/**
 * BridgeAI Background Service Worker
 * Handles tab lifecycle and message passing between content scripts
 */

// Message types for communication
interface TransferMessage {
    type: 'TRANSFER_CONTEXT';
    payload: ContextPayload;
}

interface OpenTabMessage {
    type: 'OPEN_DESTINATION_TAB';
    destinationPlatform: string;
}

type BridgeMessage = TransferMessage | OpenTabMessage;

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message: BridgeMessage, sender, sendResponse) => {
    console.log('[BridgeAI Background] Received message:', message.type);

    if (message.type === 'OPEN_DESTINATION_TAB') {
        handleOpenDestinationTab(message.destinationPlatform, sendResponse);
        return true; // Keep the message channel open for async response
    }

    if (message.type === 'TRANSFER_CONTEXT') {
        handleTransferContext(message.payload, sendResponse);
        return true;
    }

    return false;
});

/**
 * Open a new tab for the destination platform
 */
async function handleOpenDestinationTab(
    destinationPlatform: string,
    sendResponse: (response: { success: boolean; tabId?: number; error?: string }) => void
) {
    try {
        const platform = PLATFORMS.find((p) => p.id === destinationPlatform);

        if (!platform) {
            sendResponse({ success: false, error: `Unknown platform: ${destinationPlatform}` });
            return;
        }

        // Create a new tab with the destination URL
        const tab = await chrome.tabs.create({
            url: platform.url,
            active: true,
        });

        console.log(`[BridgeAI Background] Opened ${platform.name} tab:`, tab.id);
        sendResponse({ success: true, tabId: tab.id });
    } catch (error) {
        console.error('[BridgeAI Background] Failed to open tab:', error);
        sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to open tab'
        });
    }
}

/**
 * Handle the transfer context message
 */
async function handleTransferContext(
    payload: ContextPayload,
    sendResponse: (response: { success: boolean; error?: string }) => void
) {
    try {
        // Save the payload to storage (done in content script, but backup here)
        await chrome.storage.local.set({ bridgeai_context_payload: payload });

        // Open the destination tab
        const platform = PLATFORMS.find((p) => p.id === payload.destinationPlatform);

        if (!platform) {
            sendResponse({ success: false, error: `Unknown destination: ${payload.destinationPlatform}` });
            return;
        }

        await chrome.tabs.create({
            url: platform.url,
            active: true,
        });

        console.log(`[BridgeAI Background] Transfer initiated to ${platform.name}`);
        sendResponse({ success: true });
    } catch (error) {
        console.error('[BridgeAI Background] Transfer failed:', error);
        sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Transfer failed'
        });
    }
}

// Listen for tab updates to trigger injection on destination
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete' || !tab.url) {
        return;
    }

    // Check if this is a destination platform and we have a pending payload
    const isAIPlatform = PLATFORMS.some((p) => tab.url?.includes(new URL(p.url).hostname));

    if (isAIPlatform) {
        console.log('[BridgeAI Background] AI platform tab loaded:', tab.url);
        // The content script will handle checking for and injecting the payload
    }
});

// Clean up old payloads periodically (older than 5 minutes)
chrome.alarms.create('cleanupPayloads', { periodInMinutes: 5 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'cleanupPayloads') {
        try {
            const result = await chrome.storage.local.get(['bridgeai_context_payload']);
            const payload = result.bridgeai_context_payload as ContextPayload | undefined;

            if (payload && Date.now() - payload.timestamp > 5 * 60 * 1000) {
                await chrome.storage.local.remove(['bridgeai_context_payload']);
                console.log('[BridgeAI Background] Cleaned up stale payload');
            }
        } catch (error) {
            console.error('[BridgeAI Background] Cleanup error:', error);
        }
    }
});

console.log('[BridgeAI Background] Service worker initialized');
