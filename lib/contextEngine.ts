import type { Message } from '~adapters/types';

/**
 * Default number of messages to extract for context
 */
const DEFAULT_MESSAGE_COUNT = 10;

/**
 * Extract the last N messages from a conversation
 */
export function extractLastNMessages(messages: Message[], n: number = DEFAULT_MESSAGE_COUNT): Message[] {
    if (messages.length <= n) {
        return messages;
    }
    return messages.slice(-n);
}

/**
 * Create a summary of the conversation for context transfer
 * This is a simple implementation - could be enhanced with AI summarization
 */
export function createConversationSummary(messages: Message[]): string {
    if (messages.length === 0) {
        return 'No previous conversation context.';
    }

    // Extract key points from the conversation
    const userMessages = messages.filter((m) => m.role === 'user');
    const assistantMessages = messages.filter((m) => m.role === 'assistant');

    // Get the main topics discussed (first and last messages often have key context)
    const topicHints: string[] = [];

    if (userMessages.length > 0) {
        const firstUserMsg = userMessages[0].content.slice(0, 200);
        topicHints.push(`Initial query: ${firstUserMsg}${userMessages[0].content.length > 200 ? '...' : ''}`);
    }

    if (assistantMessages.length > 0) {
        const lastAssistantMsg = assistantMessages[assistantMessages.length - 1].content.slice(0, 300);
        topicHints.push(`Last response covered: ${lastAssistantMsg}${assistantMessages[assistantMessages.length - 1].content.length > 300 ? '...' : ''}`);
    }

    return topicHints.join(' | ');
}

/**
 * Format messages for display in the transfer prompt
 */
export function formatMessagesForTransfer(messages: Message[]): string {
    return messages
        .map((msg) => {
            const roleLabel = msg.role === 'user' ? 'User' : 'Assistant';
            const content = msg.content.length > 500
                ? msg.content.slice(0, 500) + '...[truncated]'
                : msg.content;
            return `[${roleLabel}]: ${content}`;
        })
        .join('\n\n');
}

/**
 * Build the complete transfer prompt using the template
 */
export function buildTransferPrompt(
    messages: Message[],
    sourcePlatform: string,
    options: {
        messageCount?: number;
        includeFullHistory?: boolean;
    } = {}
): string {
    const { messageCount = DEFAULT_MESSAGE_COUNT, includeFullHistory = false } = options;

    // Extract relevant messages
    const relevantMessages = includeFullHistory
        ? messages
        : extractLastNMessages(messages, messageCount);

    // Create summary
    const summary = createConversationSummary(messages);

    // Get the last message for immediate context
    const lastMessage = messages[messages.length - 1];
    const lastMessageText = lastMessage
        ? `${lastMessage.role === 'user' ? 'User' : 'Assistant'}: ${lastMessage.content.slice(0, 300)}${lastMessage.content.length > 300 ? '...' : ''}`
        : 'No previous messages';

    // Format the conversation history
    const formattedHistory = formatMessagesForTransfer(relevantMessages);

    // Build the transfer prompt using the specified template format
    const transferPrompt = `[System Transfer]
Context: ${summary}
Last State: ${lastMessageText}
Action: Continue project.

---
Previous Conversation (from ${sourcePlatform}):
---

${formattedHistory}

---
[End of transferred context. Please continue from where we left off.]`;

    return transferPrompt;
}

/**
 * Validate that messages are suitable for transfer
 */
export function validateMessages(messages: Message[]): { valid: boolean; error?: string } {
    if (!messages || messages.length === 0) {
        return { valid: false, error: 'No messages to transfer' };
    }

    // Check for minimum content
    const hasContent = messages.some((m) => m.content.trim().length > 0);
    if (!hasContent) {
        return { valid: false, error: 'Messages have no content' };
    }

    return { valid: true };
}
