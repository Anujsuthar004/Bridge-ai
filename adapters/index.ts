import type { AIAdapter } from './types';
import { ChatGPTAdapter } from './ChatGPTAdapter';
import { ClaudeAdapter } from './ClaudeAdapter';
import { GeminiAdapter } from './GeminiAdapter';

// Registry of all available adapters
const adapters: AIAdapter[] = [
    new ChatGPTAdapter(),
    new ClaudeAdapter(),
    new GeminiAdapter(),
];

/**
 * Get the adapter that matches the current page
 * @returns The matching adapter or null if no match
 */
export function getActiveAdapter(): AIAdapter | null {
    for (const adapter of adapters) {
        if (adapter.isDetected()) {
            return adapter;
        }
    }
    return null;
}

/**
 * Get an adapter by its platform ID
 * @param platformId - The platform identifier (e.g., 'chatgpt', 'claude', 'gemini')
 * @returns The matching adapter or null if not found
 */
export function getAdapterByPlatformId(platformId: string): AIAdapter | null {
    return adapters.find((adapter) => adapter.platformId === platformId) || null;
}

/**
 * Get all registered adapters
 * @returns Array of all adapters
 */
export function getAllAdapters(): AIAdapter[] {
    return [...adapters];
}

/**
 * Register a new adapter (for extensibility)
 * @param adapter - The adapter to register
 */
export function registerAdapter(adapter: AIAdapter): void {
    // Avoid duplicates
    const existingIndex = adapters.findIndex((a) => a.platformId === adapter.platformId);
    if (existingIndex >= 0) {
        adapters[existingIndex] = adapter;
    } else {
        adapters.push(adapter);
    }
}

// Re-export types and adapters
export type { AIAdapter, Message, ContextPayload, PlatformOption } from './types';
export { PLATFORMS } from './types';
export { ChatGPTAdapter } from './ChatGPTAdapter';
export { ClaudeAdapter } from './ClaudeAdapter';
export { GeminiAdapter } from './GeminiAdapter';
