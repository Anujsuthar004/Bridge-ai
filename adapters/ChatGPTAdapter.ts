import { findChatInput } from '../lib/insertText';
import { scrapeByRole, type ScrapeResult } from '../lib/scrape';
import type { AIAdapter } from './types';

/**
 * ChatGPT Adapter
 * Targets: chatgpt.com and chat.openai.com (January 2026 DOM structure)
 */
export class ChatGPTAdapter implements AIAdapter {
    readonly platformName = 'ChatGPT';
    readonly platformId = 'chatgpt';

    // DOM Selectors (updated for 2026)
    private readonly selectors = {
        userMessage: '[data-message-author-role="user"]',
        assistantMessage: '[data-message-author-role="assistant"]',
        // ProseMirror composer; its id and test id have changed before, so keep broader fallbacks.
        input: [
            '#prompt-textarea',
            '[data-testid="prompt-textarea"]',
            'form .ProseMirror[contenteditable="true"]',
            '.ProseMirror[contenteditable="true"]',
            'form [contenteditable="true"]',
            'form textarea',
            '[contenteditable="true"]',
        ],
    };

    isDetected(): boolean {
        return (
            window.location.hostname.includes('chat.openai.com') ||
            window.location.hostname.includes('chatgpt.com')
        );
    }

    scrapeMessages(): ScrapeResult {
        // Read the rendered markdown when present, so per-message controls are skipped.
        return scrapeByRole(this.selectors.userMessage, this.selectors.assistantMessage,
            element => element.querySelector('.markdown') || element);
    }

    getInputElement(): HTMLElement | null {
        return findChatInput(this.selectors.input);
    }
}
