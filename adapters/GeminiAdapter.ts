import type { AIAdapter, Message } from './types';

/**
 * Gemini Adapter
 * Targets: gemini.google.com (January 2026 DOM structure)
 */
export class GeminiAdapter implements AIAdapter {
    readonly platformName = 'Gemini';
    readonly platformId = 'gemini';
    readonly newChatUrl = 'https://gemini.google.com/app';

    // DOM Selectors (updated for 2026)
    private readonly selectors = {
        messageContainer: 'message-content, .conversation-turn',
        userMessage: 'user-query, .user-message',
        assistantMessage: 'model-response, .model-message',
        inputTextarea: 'rich-textarea, .ql-editor, [contenteditable="true"]',
        sendButton: 'button[aria-label="Send message"], .send-button',
        conversationContainer: '.conversation-container',
        // Fallback selectors
        fallbackMessages: '.message-content',
        fallbackInput: 'div[contenteditable="true"][role="textbox"]',
    };

    isDetected(): boolean {
        return (
            window.location.hostname.includes('gemini.google.com') ||
            window.location.hostname.includes('bard.google.com')
        );
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
                const content = turn.textContent?.trim() || '';
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
                const content = userMessages[i].textContent?.trim() || '';
                if (content) {
                    messages.push({
                        role: 'user',
                        content,
                        timestamp: Date.now(),
                    });
                }
            }
            if (i < assistantMessages.length) {
                const content = assistantMessages[i].textContent?.trim() || '';
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

    async injectPrompt(text: string): Promise<boolean> {
        const input = this.getInputElement();

        try {
            // Copy to clipboard - this is the only reliable way for Gemini
            await navigator.clipboard.writeText(text);
            console.log('[BridgeAI] Context copied to clipboard');

            // Focus the input field so user can immediately paste
            if (input) {
                input.focus();
                input.click();
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // Return true - clipboard copy succeeded
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
