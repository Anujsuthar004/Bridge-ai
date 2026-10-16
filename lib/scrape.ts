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
function outermost(selector: string): Element[] {
    return Array.from(document.querySelectorAll(selector)).filter(el => !el.parentElement?.closest(selector));
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
    const items = outermost(selector).map((element, index) => {
        const role = knownRole(element);
        if (!role) guessed = true;
        return { element, role: role ?? (index % 2 === 0 ? 'user' : 'assistant') as MessageRole };
    });
    return build(items, minLength, guessed);
}
