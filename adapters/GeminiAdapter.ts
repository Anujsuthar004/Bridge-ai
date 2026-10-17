import { scrapeByRole, scrapeGuessingRoles, type ScrapeResult } from '../lib/scrape';
import type { AIAdapter } from './types';

/**
 * Gemini Adapter
 * Targets: gemini.google.com (January 2026 DOM structure)
 */
export class GeminiAdapter implements AIAdapter {
    readonly platformName = 'Gemini';
    readonly platformId = 'gemini';

    // DOM Selectors (updated for 2026)
    private readonly selectors = {
        userMessage: 'user-query, .user-message',
        assistantMessage: 'model-response, .model-message',
        fallbackTurns: '.conversation-turn, [data-message-id]',
    };

    isDetected(): boolean {
        return window.location.hostname.includes('gemini.google.com');
    }

    scrapeMessages(): ScrapeResult {
        // Taken in page order, so a regenerated or missing reply cannot shift later messages.
        const byRole = scrapeByRole(this.selectors.userMessage, this.selectors.assistantMessage);
        if (byRole.messages.length) return byRole;
        return scrapeGuessingRoles(this.selectors.fallbackTurns);
    }

    getInputElement(): HTMLElement | null {
        // Gemini wraps its Quill editor in a <rich-textarea> element; target the editable part.
        const selectors = [
            'rich-textarea .ql-editor',
            '.ql-editor',
            'div[contenteditable="true"][role="textbox"]',
            'div[contenteditable="true"]',
        ];

        for (const selector of selectors) {
            const element = document.querySelector(selector) as HTMLElement | null;
            if (element) {
                return element;
            }
        }

        return null;
    }
}
