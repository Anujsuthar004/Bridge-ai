import type { AIAdapter, Message } from './types';

/**
 * ChatGPT Adapter
 * Targets: chat.openai.com (January 2026 DOM structure)
 */
export class ChatGPTAdapter implements AIAdapter {
    readonly platformName = 'ChatGPT';
    readonly platformId = 'chatgpt';
    readonly newChatUrl = 'https://chat.openai.com';

    // DOM Selectors (updated for 2026)
    private readonly selectors = {
        messageContainer: '[data-message-author-role]',
        userMessage: '[data-message-author-role="user"]',
        assistantMessage: '[data-message-author-role="assistant"]',
        inputTextarea: '#prompt-textarea',
        sendButton: '[data-testid="send-button"]',
        chatContainer: 'main',
    };

    isDetected(): boolean {
        return (
            window.location.hostname.includes('chat.openai.com') ||
            window.location.hostname.includes('chatgpt.com')
        );
    }

    scrapeMessages(): Message[] {
        const messages: Message[] = [];
        const messageElements = document.querySelectorAll(this.selectors.messageContainer);

        messageElements.forEach((element) => {
            const role = element.getAttribute('data-message-author-role') as 'user' | 'assistant';
            const contentElement = element.querySelector('.markdown') || element;
            const content = contentElement.textContent?.trim() || '';

            if (content && role) {
                messages.push({
                    role,
                    content,
                    timestamp: Date.now(),
                });
            }
        });

        return messages;
    }

    getInputElement(): HTMLTextAreaElement | null {
        return document.querySelector(this.selectors.inputTextarea) as HTMLTextAreaElement | null;
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
            // Check if already ready
            if (this.getInputElement()) {
                resolve(true);
                return;
            }

            // Use MutationObserver to wait for the input to appear
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

            // Timeout after 10 seconds
            setTimeout(() => {
                observer.disconnect();
                resolve(false);
            }, 10000);
        });
    }
}
