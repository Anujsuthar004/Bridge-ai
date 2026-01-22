import type { Message, ContextPayload } from '~adapters/types';

const STORAGE_KEY = 'bridgeai_context_payload';

/**
 * Save a context payload to chrome.storage.local
 */
export async function saveContextPayload(payload: ContextPayload): Promise<void> {
    return new Promise((resolve, reject) => {
        try {
            chrome.storage.local.set({ [STORAGE_KEY]: payload }, () => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    console.log('[BridgeAI] Context payload saved successfully');
                    resolve();
                }
            });
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Retrieve the context payload from chrome.storage.local
 */
export async function getContextPayload(): Promise<ContextPayload | null> {
    return new Promise((resolve, reject) => {
        try {
            chrome.storage.local.get([STORAGE_KEY], (result) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    const payload = result[STORAGE_KEY] as ContextPayload | undefined;
                    resolve(payload || null);
                }
            });
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Clear the context payload from storage
 */
export async function clearContextPayload(): Promise<void> {
    return new Promise((resolve, reject) => {
        try {
            chrome.storage.local.remove([STORAGE_KEY], () => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    console.log('[BridgeAI] Context payload cleared');
                    resolve();
                }
            });
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Generate a unique ID for context payloads
 */
export function generatePayloadId(): string {
    return `bridge_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
