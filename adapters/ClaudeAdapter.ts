import { readMessageText } from '../lib/messageText';
import type { AIAdapter, Message } from './types';

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
        inputTextarea: '[data-testid="prompt-input"], [contenteditable="true"], .ProseMirror',
        // Broader fallback selectors
        conversationTurn: '[data-testid^="chat-message"], .group\\/turn, [class*="turn"], [class*="message"]',
        fallbackMessages: '.prose, .whitespace-pre-wrap, [class*="MessageContent"]',
    };

    isDetected(): boolean {
        return window.location.hostname.includes('claude.ai');
    }

    scrapeMessages(): Message[] {
        const messages: Message[] = [];

        // Strategy 1: Try user and assistant message selectors separately
        const userMessages = document.querySelectorAll(this.selectors.userMessage);
        const assistantMessages = document.querySelectorAll(this.selectors.assistantMessage);

        if (userMessages.length > 0 || assistantMessages.length > 0) {
            // Collect all messages with their positions in the DOM
            const allMessages: { element: Element; isUser: boolean; position: number }[] = [];

            userMessages.forEach((el) => {
                allMessages.push({
                    element: el,
                    isUser: true,
                    position: this.getElementPosition(el),
                });
            });

            assistantMessages.forEach((el) => {
                allMessages.push({
                    element: el,
                    isUser: false,
                    position: this.getElementPosition(el),
                });
            });

            // Sort by position in DOM
            allMessages.sort((a, b) => a.position - b.position);

            allMessages.forEach(({ element, isUser }) => {
                const content = readMessageText(element);
                if (content && content.length > 0) {
                    messages.push({
                        role: isUser ? 'user' : 'assistant',
                        content,
                        timestamp: Date.now(),
                    });
                }
            });

            if (messages.length > 0) {
                return messages;
            }
        }

        // Strategy 2: Try conversation turn selectors
        const turns = document.querySelectorAll(this.selectors.conversationTurn);

        if (turns.length > 0) {
            turns.forEach((turn, index) => {
                const content = readMessageText(turn);
                // Determine role from attributes or alternate
                const isHuman = turn.getAttribute('data-is-human-message') === 'true' ||
                    turn.querySelector('[data-is-human-message="true"]') !== null ||
                    index % 2 === 0;

                if (content && content.length > 0) {
                    messages.push({
                        role: isHuman ? 'user' : 'assistant',
                        content,
                        timestamp: Date.now(),
                    });
                }
            });

            if (messages.length > 0) {
                return messages;
            }
        }

        // Strategy 3: Fallback to prose elements
        const proseElements = document.querySelectorAll(this.selectors.fallbackMessages);

        proseElements.forEach((element, index) => {
            const content = readMessageText(element);
            if (content && content.length > 10) { // Filter out very short/empty elements
                messages.push({
                    role: index % 2 === 0 ? 'user' : 'assistant',
                    content,
                    timestamp: Date.now(),
                });
            }
        });

        return messages;
    }

    // Helper to get element position in DOM for sorting
    private getElementPosition(element: Element): number {
        const rect = element.getBoundingClientRect();
        return rect.top + window.scrollY;
    }

    getInputElement(): HTMLElement | null {
        // Try multiple selectors
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
