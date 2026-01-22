/**
 * Core types for the BridgeAI adapter pattern
 */

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
    role: MessageRole;
    content: string;
    timestamp?: number;
}

export interface ContextPayload {
    id: string;
    sourcePlatform: string;
    destinationPlatform: string;
    messages: Message[];
    formattedPrompt: string;
    timestamp: number;
}

export interface AIAdapter {
    /** Human-readable platform name */
    readonly platformName: string;

    /** Platform identifier for routing */
    readonly platformId: string;

    /** URL pattern to open a new chat */
    readonly newChatUrl: string;

    /**
     * Check if this adapter matches the current page
     */
    isDetected(): boolean;

    /**
     * Scrape all messages from the current conversation
     */
    scrapeMessages(): Message[];

    /**
     * Inject a prompt into the chat input
     * Uses techniques to bypass React/Next.js state management
     */
    injectPrompt(text: string): Promise<boolean>;

    /**
     * Get the main input element for the chat
     */
    getInputElement(): HTMLTextAreaElement | HTMLElement | null;

    /**
     * Wait for the chat UI to be ready (using MutationObserver)
     */
    waitForReady(): Promise<boolean>;
}

export interface PlatformOption {
    id: string;
    name: string;
    icon: string;
    url: string;
    color: string;
}

export const PLATFORMS: PlatformOption[] = [
    {
        id: 'chatgpt',
        name: 'ChatGPT',
        icon: '🤖',
        url: 'https://chat.openai.com',
        color: '#10a37f'
    },
    {
        id: 'claude',
        name: 'Claude',
        icon: '🧠',
        url: 'https://claude.ai',
        color: '#d97706'
    },
    {
        id: 'gemini',
        name: 'Gemini',
        icon: '✨',
        url: 'https://gemini.google.com/app',
        color: '#4285f4'
    }
];
