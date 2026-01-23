import type { AIAdapter, Message } from './types';

/**
 * Claude Adapter
 * Targets: claude.ai (January 2026 DOM structure)
 */
export class ClaudeAdapter implements AIAdapter {
    readonly platformName = 'Claude';
    readonly platformId = 'claude';
    readonly newChatUrl = 'https://claude.ai/new';

    // DOM Selectors (updated for 2026)
    private readonly selectors = {
        messageContainer: '[data-testid="chat-message"]',
        userMessage: '[data-testid="user-message"]',
        assistantMessage: '[data-testid="assistant-message"]',
        inputTextarea: '[data-testid="prompt-input"], [contenteditable="true"]',
        sendButton: '[data-testid="send-button"], button[aria-label="Send"]',
        conversationContainer: '[data-testid="conversation"]',
        // Fallback selectors
        fallbackMessages: '.prose',
        fallbackInput: 'div[contenteditable="true"]',
    };

    isDetected(): boolean {
        return window.location.hostname.includes('claude.ai');
    }

    scrapeMessages(): Message[] {
        const messages: Message[] = [];

        // Try primary selectors
        let messageElements = document.querySelectorAll(this.selectors.messageContainer);

        // Fallback to prose elements if primary fails
        if (messageElements.length === 0) {
            messageElements = document.querySelectorAll(this.selectors.fallbackMessages);
        }

        // Claude typically alternates user/assistant messages
        messageElements.forEach((element, index) => {
            const isUser = element.getAttribute('data-testid')?.includes('user') ||
                element.closest('[data-is-human-message]') !== null ||
                index % 2 === 0;

            const content = element.textContent?.trim() || '';

            if (content) {
                messages.push({
                    role: isUser ? 'user' : 'assistant',
                    content,
                    timestamp: Date.now(),
                });
            }
        });

        return messages;
    }

    getInputElement(): HTMLElement | null {
        // Try multiple selectors
        const selectors = [
            this.selectors.inputTextarea,
            this.selectors.fallbackInput,
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
