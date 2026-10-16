import { readMessageText } from '../lib/messageText';
import type { AIAdapter, Message } from './types';

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
        fallbackInput: 'div[contenteditable="true"][role="textbox"]',
    };

    isDetected(): boolean {
        return window.location.hostname.includes('gemini.google.com');
    }

    scrapeMessages(): Message[] {
        const messages: Message[] = [];

        // Try to find all message containers
        const userMessages = document.querySelectorAll(this.selectors.userMessage);
        const assistantMessages = document.querySelectorAll(this.selectors.assistantMessage);

        // If specific selectors don't work, try generic approach
        if (userMessages.length === 0 && assistantMessages.length === 0) {
            // Look for conversation turns
            const turns = document.querySelectorAll('.conversation-turn, [data-message-id]');
            turns.forEach((turn, index) => {
                const content = readMessageText(turn);
                if (content) {
                    messages.push({
                        role: index % 2 === 0 ? 'user' : 'assistant',
                        content,
                        timestamp: Date.now(),
                    });
                }
            });
            return messages;
        }

        // Interleave user and assistant messages
        const maxLen = Math.max(userMessages.length, assistantMessages.length);
        for (let i = 0; i < maxLen; i++) {
            if (i < userMessages.length) {
                const content = readMessageText(userMessages[i]);
                if (content) {
                    messages.push({
                        role: 'user',
                        content,
                        timestamp: Date.now(),
                    });
                }
            }
            if (i < assistantMessages.length) {
                const content = readMessageText(assistantMessages[i]);
                if (content) {
                    messages.push({
                        role: 'assistant',
                        content,
                        timestamp: Date.now(),
                    });
                }
            }
        }

        return messages;
    }

    getInputElement(): HTMLElement | null {
        // Gemini uses a rich text editor - try multiple selectors
        const selectors = [
            'rich-textarea',
            '.ql-editor',
            '[contenteditable="true"][role="textbox"]',
            this.selectors.fallbackInput,
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
