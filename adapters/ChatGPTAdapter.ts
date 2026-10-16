import { readMessageText } from '../lib/messageText';
import type { AIAdapter, Message } from './types';

/**
 * ChatGPT Adapter
 * Targets: chatgpt.com and chat.openai.com (January 2026 DOM structure)
 */
export class ChatGPTAdapter implements AIAdapter {
    readonly platformName = 'ChatGPT';
    readonly platformId = 'chatgpt';

    // DOM Selectors (updated for 2026)
    private readonly selectors = {
        messageContainer: '[data-message-author-role]',
        inputTextarea: '#prompt-textarea',
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
            const content = readMessageText(contentElement);

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

    getInputElement(): HTMLElement | null {
        return document.querySelector(this.selectors.inputTextarea) as HTMLElement | null;
    }
}
