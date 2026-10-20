// Fill a chat input the way a user paste would, so the site's editor state updates.
// Nothing here ever submits: the user reviews and presses send themselves.

const isTextField = (el: Element): el is HTMLTextAreaElement | HTMLInputElement =>
    el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement;

/** The element that actually accepts text: the input itself or an editable descendant of a wrapper. */
export function resolveEditable(input: HTMLElement): HTMLElement {
    if (isTextField(input) || input.isContentEditable || input.getAttribute('contenteditable') === 'true') return input;
    return input.querySelector<HTMLElement>('textarea, [contenteditable="true"]') || input;
}

const currentText = (el: HTMLElement) => isTextField(el) ? el.value : el.textContent || '';
// Editors turn line breaks into <p> or <br>, which textContent drops, so compare without whitespace.
const squash = (text: string) => text.replace(/\s+/g, '');

export function isInputEmpty(input: HTMLElement): boolean {
    return !currentText(resolveEditable(input)).trim();
}

/** True when the input holds the start and end of `text`. */
export function inputHasText(input: HTMLElement, text: string): boolean {
    const have = squash(currentText(resolveEditable(input)));
    const want = squash(text);
    return have.includes(want.slice(0, 60)) && have.includes(want.slice(-60));
}

export async function insertIntoInput(input: HTMLElement, text: string): Promise<boolean> {
    const target = resolveEditable(input);
    target.focus();
    if (isTextField(target)) {
        // Use the prototype setter so frameworks tracking `value` see a real change.
        const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(target), 'value')?.set;
        if (setter) setter.call(target, text); else target.value = text;
        target.dispatchEvent(new Event('input', { bubbles: true }));
        return inputHasText(target, text);
    }
    // Rich editors (ProseMirror, Quill) handle paste themselves and keep line breaks.
    const data = new DataTransfer();
    data.setData('text/plain', text);
    const before = currentText(target);
    const handled = !target.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    // Some editors (Quill) apply a paste on the next tick; give them a moment before falling back.
    if (handled) await new Promise(resolve => setTimeout(resolve, 150));
    if (!handled || currentText(target) === before) document.execCommand('insertText', false, text);
    return inputHasText(target, text);
}

/** Resolve with the first non-null result of `find`, re-checking as the page changes. */
export function waitForElement<T>(find: () => T | null, timeoutMs = 15000): Promise<T | null> {
    return new Promise(resolve => {
        const found = find();
        if (found) return resolve(found);
        const observer = new MutationObserver(() => {
            const match = find();
            if (match) { observer.disconnect(); clearTimeout(timer); resolve(match); }
        });
        const timer = setTimeout(() => { observer.disconnect(); resolve(null); }, timeoutMs);
        observer.observe(document.body, { childList: true, subtree: true });
    });
}

const isVisible = (el: HTMLElement) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';

/**
 * The chat input: the first selector, in priority order, with a visible match. Sites keep a hidden
 * fallback textarea next to the real editor, and rename their composer often, so try several.
 * Falls back to the first match at all when nothing is visible (for example while the page loads).
 */
export function findChatInput(selectors: string[]): HTMLElement | null {
    let first: HTMLElement | null = null;
    for (const selector of selectors) {
        const matches = Array.from(document.querySelectorAll<HTMLElement>(selector));
        const visible = matches.find(isVisible);
        if (visible) return visible;
        first ??= matches[0] ?? null;
    }
    return first;
}
