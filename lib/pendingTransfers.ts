import type { ContextPayload } from '../adapters/types';
export const TRANSFER_TTL = 5 * 60 * 1000;
const PREFIX = 'bridgeai_pending_';
export const pendingKey = (tabId: number) => PREFIX + tabId;
export async function readPending(tabId: number): Promise<ContextPayload | null> {
    const key = pendingKey(tabId);
    const payload = (await chrome.storage.local.get(key))[key] as ContextPayload | undefined;
    if (!payload) return null;
    if (payload.targetTabId !== tabId || !Number.isFinite(payload.timestamp) || Date.now() - payload.timestamp >= TRANSFER_TTL) {
        await chrome.storage.local.remove(key);
        return null;
    }
    return payload;
}
export async function removePending(tabId: number, id: string): Promise<void> {
    const payload = await readPending(tabId);
    if (payload?.id === id) await chrome.storage.local.remove(pendingKey(tabId));
}
export async function cleanExpiredTransfers(): Promise<void> {
    const all = await chrome.storage.local.get(null);
    const expired = Object.entries(all).filter(([key, payload]) =>
        (key.startsWith(PREFIX) || key === 'bridgeai_context_payload') &&
        (!Number.isFinite(payload?.timestamp) || Date.now() - payload.timestamp >= TRANSFER_TTL)
    ).map(([key]) => key);
    if (expired.length) await chrome.storage.local.remove(expired);
}
