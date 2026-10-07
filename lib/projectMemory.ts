import type { Message } from '../adapters/types';

export interface SourceMessage {
    id: string;
    role: Message['role'];
    content: string;
    sourcePlatform: string;
    sourceUrl: string;
    messageNumber: number;
}

export interface ProjectMemory {
    version: 1;
    id: string;
    name: string;
    goal: string;
    requirements: string;
    decisions: string;
    progress: string;
    nextStep: string;
    workingMaterial: string;
    originalRequest?: SourceMessage;
    pins: SourceMessage[];
    updatedAt: number;
}

export function captureMessage(message: Message, index: number, platform: string, url: string): SourceMessage {
    return {
        id: crypto.randomUUID(), role: message.role, content: message.content,
        sourcePlatform: platform, sourceUrl: url, messageNumber: index + 1,
    };
}

export function sameMessage(a: SourceMessage, b: SourceMessage): boolean {
    return a.role === b.role && a.content === b.content && a.sourceUrl === b.sourceUrl;
}

export function newProject(messages: Message[], platform: string, url: string): ProjectMemory {
    const first = messages.findIndex(message => message.role === 'user' && message.content.trim());
    return {
        version: 1, id: crypto.randomUUID(), name: 'Untitled project',
        goal: '', requirements: '', decisions: '', progress: '', nextStep: '', workingMaterial: '',
        originalRequest: first < 0 ? undefined : captureMessage(messages[first], first, platform, url),
        pins: [], updatedAt: Date.now(),
    };
}
