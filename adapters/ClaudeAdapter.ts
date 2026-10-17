import { scrapeByRole, scrapeGuessingRoles, type ScrapeResult } from '../lib/scrape';
import type { AIAdapter } from './types';

/**
 * Claude Adapter
 * Targets: claude.ai (January 2026 DOM structure)
 */
export class ClaudeAdapter implements AIAdapter {
    readonly platformName = 'Claude';
    readonly platformId = 'claude';

    // DOM Selectors (updated for Claude 2026)
    private readonly selectors = {
        // Claude uses these classes/attributes for messages
        userMessage: '[data-testid="user-message"], .font-user-message, [data-is-human-message="true"]',
        assistantMessage: '[data-testid="assistant-message"], .font-claude-message, [data-is-human-message="false"]',
        inputTextarea: '[data-testid="prompt-input"], .ProseMirror[contenteditable="true"]',
        // Broader fallback selectors
        conversationTurn: '[data-testid^="chat-message"], .group\\/turn, [class*="turn"], [class*="message"]',
        fallbackMessages: '.prose, .whitespace-pre-wrap, [class*="MessageContent"]',
    };

    isDetected(): boolean {
        return window.location.hostname.includes('claude.ai');
    }

    scrapeMessages(): ScrapeResult {
        // Strategy 1: elements that say who wrote them
        const byRole = scrapeByRole(this.selectors.userMessage, this.selectors.assistantMessage);
        if (byRole.messages.length) return byRole;

        // Strategy 2: conversation turns, using a role marker inside the turn when there is one
        const turns = scrapeGuessingRoles(this.selectors.conversationTurn, turn => {
            const marker = turn.closest('[data-is-human-message]') || turn.querySelector('[data-is-human-message]');
            if (!marker) return null;
            return marker.getAttribute('data-is-human-message') === 'true' ? 'user' : 'assistant';
        });
        if (turns.messages.length) return turns;

        // Strategy 3: any prose block; skip very short elements such as labels
        return scrapeGuessingRoles(this.selectors.fallbackMessages, () => null, 11);
    }

    getInputElement(): HTMLElement | null {
        const selectors = [
            this.selectors.inputTextarea,
            'div[contenteditable="true"]',
            'textarea',
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
