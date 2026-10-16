import type { Message } from '../adapters/types';
import type { ProjectMemory } from './projectMemory';

export const BRIEF_REQUEST_START = '[BridgeAI brief request]';
const END = 'END';

// Labels survive markdown rendering as plain text, unlike headings or bold markers.
const SECTIONS = [
    ['NAME', 'name', 'A short project name, at most 6 words.'],
    ['GOAL', 'goal', 'What the user is trying to accomplish.'],
    ['REQUIREMENTS', 'requirements', 'Constraints, preferences, tools, tone, budget, and instructions the user gave.'],
    ['DECISIONS', 'decisions', 'Decisions that are still current. Leave out anything that was later replaced.'],
    ['PROGRESS', 'progress', 'What is done, what was tried and rejected (and why), and open questions.'],
    ['NEXT', 'nextStep', 'The single next thing to work on.'],
] as const;

export type BriefField = typeof SECTIONS[number][1];
export type BriefDraft = Partial<Record<BriefField, string>>;

const label = (key: string) => `[BRIDGEAI:${key}]`;

export function buildBriefRequest(): string {
    return `${BRIEF_REQUEST_START}\n` +
        `I'm moving this conversation to another AI assistant. Write a handoff brief based only on this conversation so far.\n\n` +
        `Reply with exactly the labelled sections below, in this order, and nothing else. Put each label on its own line ` +
        `and write plain text under it (short bullet points are fine). Do not use a code block. ` +
        `If something was never discussed, write "Unknown" under that label.\n\n` +
        SECTIONS.map(([key, , hint]) => `${label(key)}\n${hint}`).join('\n') + `\n${label(END)}`;
}

export function isBriefRequest(content: string): boolean {
    return content.trimStart().startsWith(BRIEF_REQUEST_START);
}

export function isBriefReply(content: string): boolean {
    return content.includes(label('GOAL')) && content.includes(label(END));
}

/** The assistant reply to the most recent brief request, if it has arrived. */
export function findBriefReply(messages: Message[]): Message | undefined {
    const request = messages.map(message => isBriefRequest(message.content)).lastIndexOf(true);
    return messages.slice(request + 1).reverse().find(message => message.role === 'assistant' && isBriefReply(message.content));
}

export function parseBriefReply(content: string): BriefDraft {
    const parts = content.split(/\[BRIDGEAI:([A-Z]+)\]/);
    const draft: BriefDraft = {};
    for (let i = 1; i < parts.length; i += 2) {
        if (parts[i] === END) break;
        const field = SECTIONS.find(([key]) => key === parts[i])?.[1];
        const value = parts[i + 1].split('\n').filter(line => !/^\s*`{3,}/.test(line)).join('\n').trim();
        if (field && value && !/^unknown\.?$/i.test(value)) draft[field] = value;
    }
    return draft;
}

/** Apply a parsed brief. The name is only replaced while it is still the placeholder. */
export function applyBrief(memory: ProjectMemory, draft: BriefDraft): { memory: ProjectMemory; filled: BriefField[] } {
    const filled = (Object.keys(draft) as BriefField[]).filter(field =>
        field !== 'name' || !memory.name.trim() || memory.name === 'Untitled project');
    const next = { ...memory };
    for (const field of filled) next[field] = draft[field]!;
    return { memory: next, filled };
}
