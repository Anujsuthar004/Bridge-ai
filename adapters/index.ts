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
    return adapters.find((adapter) => adapter.isDetected()) || null;
}

// Re-export types and adapters
export type { AIAdapter, Message, ContextPayload, PlatformOption } from './types';
export { PLATFORMS } from './types';
export { ChatGPTAdapter } from './ChatGPTAdapter';
export { ClaudeAdapter } from './ClaudeAdapter';
export { GeminiAdapter } from './GeminiAdapter';
