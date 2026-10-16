/** The nearest scrollable ancestor of a message, falling back to the page itself. */
export function findScrollContainer(from: Element | null): Element {
    for (let el = from?.parentElement; el; el = el.parentElement) {
        const { overflowY } = getComputedStyle(el);
        if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) return el;
    }
    return document.scrollingElement || document.documentElement;
}

export interface LoadHistoryOptions {
    signal?: AbortSignal;
    wait?: (ms: number) => Promise<void>;
    settleMs?: number;
    maxRounds?: number;
}

export interface LoadHistoryResult {
    /** True when two scrolls in a row loaded nothing new. */
    complete: boolean;
    stopped: boolean;
}

/**
 * Scroll to the top repeatedly so the platform lazy-loads older messages. Stops once
 * two scrolls in a row change nothing, the round limit is reached, or the user cancels.
 */
export async function loadEarlierMessages(scroller: { scrollTop: number; scrollHeight: number }, count: () => number,
    { signal, wait = ms => new Promise(resolve => setTimeout(resolve, ms)), settleMs = 900, maxRounds = 40 }: LoadHistoryOptions = {},
): Promise<LoadHistoryResult> {
    let unchanged = 0;
    for (let round = 0; round < maxRounds; round++) {
        if (signal?.aborted) return { complete: false, stopped: true };
        const before = { count: count(), height: scroller.scrollHeight };
        scroller.scrollTop = 0;
        await wait(settleMs);
        if (count() === before.count && scroller.scrollHeight === before.height) {
            if (++unchanged >= 2) return { complete: true, stopped: false };
        } else unchanged = 0;
    }
    return { complete: false, stopped: !!signal?.aborted };
}
