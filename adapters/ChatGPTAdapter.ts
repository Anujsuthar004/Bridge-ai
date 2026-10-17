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
        inputTextarea: '#prompt-textarea',
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
        return document.querySelector(this.selectors.inputTextarea) as HTMLElement | null;
    }
}
