import type { Message, MessageRole } from '../adapters/types';
import { readMessageText } from './messageText';

export interface ScrapeResult {
    messages: Message[];
    /** True when a fallback had to guess who said what; the user should check before transferring. */
    rolesGuessed: boolean;
    /** First captured message element, used to find the conversation's scroll container. */
    firstElement: Element | null;
}

export const EMPTY_SCRAPE: ScrapeResult = { messages: [], rolesGuessed: false, firstElement: null };

// Outermost matches only, in document order. Platforms often nest one marked
// element inside another, which would otherwise capture the same text twice.
function outermost(selector: string, elements = Array.from(document.querySelectorAll(selector))): Element[] {
    const set = new Set(elements);
    return elements.filter(el => {
        for (let up = el.parentElement?.closest(selector); up; up = up.parentElement?.closest(selector)) if (set.has(up)) return false;
        return true;
    });
}

// Broad fallback selectors can match a whole conversation container as well as its turns. An element
// holding two or more separate matches is a container, so it is skipped and its turns are kept apart.
function turnsNotContainers(selector: string): Element[] {
    const all = Array.from(document.querySelectorAll(selector));
    const kept = all.filter(el => outermost(selector, Array.from(el.querySelectorAll(selector))).length < 2);
    return outermost(selector, kept);
}

function build(items: { element: Element; role: MessageRole }[], minLength: number, rolesGuessed: boolean,
    contentOf: (el: Element) => Element = el => el): ScrapeResult {
    const kept = items
        .map(item => ({ ...item, content: readMessageText(contentOf(item.element)) }))
        .filter(item => item.content.length >= minLength);
    return {
        messages: kept.map(({ role, content }) => ({ role, content, timestamp: Date.now() })),
        rolesGuessed: rolesGuessed && kept.length > 0,
        firstElement: kept[0]?.element ?? null,
    };
}

const sameTurn = (a: Message, b: Message) => a.role === b.role && a.content === b.content;

/**
 * Join an earlier view of the chat onto a later-loaded, older one. Virtualized chats drop the newest
 * messages while loading older ones, so `older` may hold only the start: line them up on the first
 * message of `newer` and keep both sides. Without an overlap, the longer capture wins.
 */
export function mergeScrapes(older: ScrapeResult, newer: ScrapeResult): ScrapeResult {
    const first = newer.messages[0];
    const at = first ? older.messages.findIndex(message => sameTurn(message, first)) : -1;
    const combined = at < 0 ? null : [...older.messages.slice(0, at), ...newer.messages];
    const messages = !first ? older.messages
        : combined && combined.length >= older.messages.length ? combined
        : older.messages.length >= newer.messages.length ? older.messages : newer.messages;
    return { messages, rolesGuessed: older.rolesGuessed || newer.rolesGuessed, firstElement: older.firstElement ?? newer.firstElement };
}

/** Messages whose role is known from the element itself. Order comes from the page, not from pairing lists. */
export function scrapeByRole(userSelector: string, assistantSelector: string,
    contentOf?: (el: Element) => Element): ScrapeResult {
    const items = outermost(`${userSelector}, ${assistantSelector}`)
        .map(element => ({ element, role: (element.matches(userSelector) ? 'user' : 'assistant') as MessageRole }));
    return build(items, 1, false, contentOf);
}

/**
 * Last-resort capture when the platform's role markers are missing. Uses `knownRole`
 * where it can and otherwise alternates, flagging the result so the UI can warn.
 */
export function scrapeGuessingRoles(selector: string, knownRole: (el: Element) => MessageRole | null = () => null,
    minLength = 1): ScrapeResult {
    let guessed = false;
    const items = turnsNotContainers(selector).map((element, index) => {
        const role = knownRole(element);
        if (!role) guessed = true;
        return { element, role: role ?? (index % 2 === 0 ? 'user' : 'assistant') as MessageRole };
    });
    return build(items, minLength, guessed);
}
