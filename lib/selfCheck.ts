// Checks whether BridgeAI can still read this chat page, so a site redesign shows up as a clear
// problem (and a report link) instead of a silent failure. Reports never include chat content.

export interface PageHealth {
    chatBox: boolean;
    messages: number;
    rolesGuessed: boolean;
    /** The page is an existing conversation, so it should have messages. */
    conversation: boolean;
}

const conversationPaths: Record<string, RegExp> = {
    chatgpt: /^\/(g\/[^/]+\/)?c\/[^/]+/,
    claude: /^\/chat\/[^/]+/,
    gemini: /^\/(u\/\d+\/)?app\/[^/]+/,
};

export function isConversationPage(platformId: string, pathname: string): boolean {
    return conversationPaths[platformId]?.test(pathname) ?? false;
}

export function problemsFor(health: PageHealth): string[] {
    const problems: string[] = [];
    if (!health.chatBox) problems.push('Chat box not found');
    if (health.conversation && !health.messages) problems.push('No messages found on a conversation page');
    if (health.rolesGuessed) problems.push('Message markers missing, so speakers were guessed');
    return problems;
}

const REPO_ISSUES = 'https://github.com/Anujsuthar004/Bridge-ai/issues/new';

/** A prefilled GitHub issue. Only the site, page type, problem and versions: no chat text or conversation link. */
export function reportUrl(details: { platformName: string; problems: string[]; conversation: boolean; version: string; userAgent: string }): string {
    const chrome = details.userAgent.match(/Chrome\/(\d+)/)?.[1] ?? 'unknown';
    const body = [
        `**Site:** ${details.platformName}`,
        `**Page:** ${details.conversation ? 'existing conversation' : 'new chat'}`,
        `**Problem:** ${details.problems.join('; ') || 'Something else'}`,
        `**BridgeAI version:** ${details.version}`,
        `**Chrome version:** ${chrome}`,
        '',
        'What were you trying to do? (Please don’t paste private chat content.)',
        '',
    ].join('\n');
    const params = new URLSearchParams({ title: `${details.platformName}: ${details.problems[0] ?? 'problem report'}`, body, labels: 'site-breakage' });
    return `${REPO_ISSUES}?${params}`;
}

/** Record the result on the page for automated live-site checks, which read it from outside the extension. */
export function publishHealth(host: HTMLElement | null, health: PageHealth): void {
    if (!host) return;
    host.dataset.bridgeaiChatBox = health.chatBox ? 'found' : 'missing';
    host.dataset.bridgeaiMessages = String(health.messages);
    host.dataset.bridgeaiRolesGuessed = String(health.rolesGuessed);
    host.dataset.bridgeaiStatus = problemsFor(health).length ? 'problem' : 'ok';
}
