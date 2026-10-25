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
    /** Called after every scroll, so a caller can collect messages a virtualized list is about to drop. */
    onRound?: () => void;
}

export interface LoadHistoryResult {
    /** True when two scrolls in a row loaded nothing new. */
    complete: boolean;
    stopped: boolean;
}

/**
 * Scroll to the top repeatedly so the platform lazy-loads older messages. Stops once
 * two scrolls in a row change nothing, the round limit is reached, or the user cancels.
 * `progress` describes what is on screen (for example the count and first message): a virtualized
 * list can swap messages while keeping the count and height, so comparing counts alone is not enough.
 */
export async function loadEarlierMessages(scroller: { scrollTop: number; scrollHeight: number }, progress: () => string | number,
    { signal, wait = ms => new Promise(resolve => setTimeout(resolve, ms)), settleMs = 900, maxRounds = 40, onRound }: LoadHistoryOptions = {},
): Promise<LoadHistoryResult> {
    let unchanged = 0;
    for (let round = 0; round < maxRounds; round++) {
        if (signal?.aborted) return { complete: false, stopped: true };
        const before = { progress: progress(), height: scroller.scrollHeight };
        scroller.scrollTop = 0;
        await wait(settleMs);
        onRound?.();
        if (progress() === before.progress && scroller.scrollHeight === before.height) {
            if (++unchanged >= 2) return { complete: true, stopped: false };
        } else unchanged = 0;
    }
    return { complete: false, stopped: !!signal?.aborted };
}
