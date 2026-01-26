import type { AIAdapter, Message } from './types';

/**
 * Claude Adapter
 * Targets: claude.ai (January 2026 DOM structure)
 */
export class ClaudeAdapter implements AIAdapter {
    readonly platformName = 'Claude';
    readonly platformId = 'claude';
    readonly newChatUrl = 'https://claude.ai/new';

    // DOM Selectors (updated for Claude 2026)
    private readonly selectors = {
        // Claude uses these classes/attributes for messages
        userMessage: '[data-testid="user-message"], .font-user-message, [data-is-human-message="true"]',
        assistantMessage: '[data-testid="assistant-message"], .font-claude-message, [data-is-human-message="false"]',
        inputTextarea: '[data-testid="prompt-input"], [contenteditable="true"], .ProseMirror',
        sendButton: '[data-testid="send-button"], button[aria-label="Send"]',
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

        console.log('[BridgeAI] Claude - Found user messages:', userMessages.length);
        console.log('[BridgeAI] Claude - Found assistant messages:', assistantMessages.length);

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
                const content = element.textContent?.trim() || '';
                if (content && content.length > 0) {
                    messages.push({
                        role: isUser ? 'user' : 'assistant',
                        content,
                        timestamp: Date.now(),
                    });
                }
            });

            if (messages.length > 0) {
                console.log('[BridgeAI] Claude - Scraped', messages.length, 'messages via specific selectors');
                return messages;
            }
        }

        // Strategy 2: Try conversation turn selectors
        const turns = document.querySelectorAll(this.selectors.conversationTurn);
        console.log('[BridgeAI] Claude - Found conversation turns:', turns.length);

        if (turns.length > 0) {
            turns.forEach((turn, index) => {
                const content = turn.textContent?.trim() || '';
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
                console.log('[BridgeAI] Claude - Scraped', messages.length, 'messages via turns');
                return messages;
            }
        }

        // Strategy 3: Fallback to prose elements
        const proseElements = document.querySelectorAll(this.selectors.fallbackMessages);
        console.log('[BridgeAI] Claude - Found fallback elements:', proseElements.length);

        proseElements.forEach((element, index) => {
            const content = element.textContent?.trim() || '';
            if (content && content.length > 10) { // Filter out very short/empty elements
                messages.push({
                    role: index % 2 === 0 ? 'user' : 'assistant',
                    content,
                    timestamp: Date.now(),
                });
            }
        });

        console.log('[BridgeAI] Claude - Final scraped messages:', messages.length);
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

    async injectPrompt(text: string): Promise<boolean> {
        const input = this.getInputElement();

        try {
            // Copy to clipboard - most reliable method
            await navigator.clipboard.writeText(text);
            console.log('[BridgeAI] Context copied to clipboard');

            // Focus the input so user can immediately paste
            if (input) {
                input.focus();
                input.click();
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            return true;
        } catch (error) {
            console.error('[BridgeAI] Failed to copy to clipboard:', error);
            return false;
        }
    }

    async waitForReady(): Promise<boolean> {
        return new Promise((resolve) => {
            if (this.getInputElement()) {
                resolve(true);
                return;
            }

            const observer = new MutationObserver((mutations, obs) => {
                if (this.getInputElement()) {
                    obs.disconnect();
                    resolve(true);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true,
            });

            setTimeout(() => {
                observer.disconnect();
                resolve(false);
            }, 10000);
        });
    }
}
