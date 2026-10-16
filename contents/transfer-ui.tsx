import type { PlasmoCSConfig, PlasmoGetStyle, PlasmoGetShadowHostId } from 'plasmo';
import { useEffect, useState } from 'react';
import cssText from 'data-text:~style.css';
import { getActiveAdapter, type AIAdapter, type ContextPayload } from '~adapters';
import { MemoryEditor } from '~components/MemoryEditor';
import { buildBriefRequest, findBriefReply } from '~lib/briefDraft';
import { inputHasText, insertIntoInput, isInputEmpty, waitForElement } from '~lib/insertText';
import { findScrollContainer, loadEarlierMessages } from '~lib/loadHistory';
import { listProjects, saveProject, deleteProject } from '~lib/storage';
import type { ProjectMemory } from '~lib/projectMemory';
import type { ScrapeResult } from '~lib/scrape';

export const config: PlasmoCSConfig = {
    matches: ['https://chat.openai.com/*', 'https://chatgpt.com/*', 'https://claude.ai/*', 'https://gemini.google.com/*'],
    all_frames: false,
};
export const getStyle: PlasmoGetStyle = () => { const style = document.createElement('style'); style.textContent = cssText; return style; };
export const getShadowHostId: PlasmoGetShadowHostId = () => 'bridge-ai-root';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function TransferUI() {
    const [adapter, setAdapter] = useState<AIAdapter | null>(null);
    const [projects, setProjects] = useState<ProjectMemory[]>([]);
    const [snapshot, setSnapshot] = useState<{ scrape: ScrapeResult; url: string } | null>(null);
    const [pending, setPending] = useState<ContextPayload | null>(null);
    const [inserted, setInserted] = useState(false);
    const [arrivalStatus, setArrivalStatus] = useState('');
    const [error, setError] = useState('');
    const [initialProjectId, setInitialProjectId] = useState<string>();
    // Memory set aside while the current AI drafts a brief, and whether to fill it on reopening.
    const [draft, setDraft] = useState<ProjectMemory | null>(null);
    const [draftStatus, setDraftStatus] = useState('');
    const [fillOnOpen, setFillOnOpen] = useState(false);

    useEffect(() => {
        setAdapter(getActiveAdapter());
        chrome.runtime.sendMessage({ type: 'GET_PENDING_CONTEXT' }).then(response => {
            if (response?.payload) { setPending(response.payload); setInitialProjectId(response.payload.projectId); }
        }).catch(() => setError('BridgeAI could not load the incoming transfer. Reload this tab to retry.'));
    }, []);

    const insertPending = async () => {
        if (!adapter || !pending) return;
        const text = pending.formattedPrompt;
        let input = adapter.getInputElement();
        let ok = !!input && await insertIntoInput(input, text);
        if (ok) {
            // Chat pages can re-render their composer just after loading; make sure the text survived.
            await sleep(1500);
            input = adapter.getInputElement();
            if (!input || !inputHasText(input, text)) ok = !!input && isInputEmpty(input) && await insertIntoInput(input, text);
        }
        if (!ok) { setArrivalStatus('BridgeAI couldn’t insert the context automatically. Use Copy context and paste it.'); return; }
        setInserted(true);
        setArrivalStatus('Inserted into the chat box. Review it, then press send.');
        // The text is in place, so a reload of this tab should not insert it again.
        chrome.runtime.sendMessage({ type: 'CLEAR_PENDING_CONTEXT', id: pending.id }).catch(() => {});
    };

    // Insert incoming context once the destination's chat box appears, unless the user already typed there.
    useEffect(() => {
        if (!adapter || !pending) return;
        let cancelled = false;
        waitForElement(() => adapter.getInputElement()).then(input => {
            if (cancelled) return;
            if (!input) setArrivalStatus('BridgeAI couldn’t find the chat box. Use Copy context and paste it.');
            else if (!isInputEmpty(input)) setArrivalStatus('The chat box already has text, so nothing was inserted. Use Insert into chat or Copy context.');
            else insertPending();
        });
        return () => { cancelled = true; };
    }, [adapter, pending?.id]);

    const openEditor = async (fill = false) => {
        if (!adapter) return;
        try {
            setProjects(await listProjects());
            setSnapshot({ scrape: adapter.scrapeMessages(), url: location.origin + location.pathname });
            setFillOnOpen(fill);
            setDraftStatus('');
            setError('');
        } catch { setError('Could not read project memory. Reload the extension and try again.'); }
    };
    const closeEditor = () => { setSnapshot(null); setInitialProjectId(undefined); setDraft(null); setFillOnOpen(false); };

    const loadEarlier = async (signal: AbortSignal) => {
        if (!adapter) return '';
        const before = adapter.scrapeMessages();
        const scroller = findScrollContainer(before.firstElement);
        const result = await loadEarlierMessages(scroller, () => adapter.scrapeMessages().messages.length, { signal });
        const after = adapter.scrapeMessages();
        scroller.scrollTop = scroller.scrollHeight;
        setSnapshot(previous => previous && { ...previous, scrape: after });
        const added = after.messages.length - before.messages.length;
        if (result.stopped) return `Stopped. ${added} earlier message${added === 1 ? '' : 's'} loaded.`;
        if (added <= 0) return 'No earlier messages found. Everything on this page is captured.';
        return `Loaded ${added} earlier message${added === 1 ? '' : 's'}.` + (result.complete ? '' : ' There may be more; run it again.');
    };

    const requestDraft = async (memory: ProjectMemory) => {
        if (!adapter) return;
        setDraft(memory);
        setSnapshot(null);
        const request = buildBriefRequest();
        const input = adapter.getInputElement();
        if (input && isInputEmpty(input) && await insertIntoInput(input, request)) {
            setDraftStatus(`The brief request is in the chat box. Send it, wait for ${adapter.platformName} to finish replying, then click Fill brief.`);
            return;
        }
        try {
            await navigator.clipboard.writeText(request);
            setDraftStatus(`The brief request was copied. Paste it into the chat, send it, wait for the reply, then click Fill brief.`);
        } catch { setDraftStatus('BridgeAI couldn’t place the brief request. Clear the chat box, then go back to the editor and try again.'); }
    };
    const fillBrief = () => {
        if (!adapter) return;
        if (!findBriefReply(adapter.scrapeMessages().messages)) {
            setDraftStatus(`No brief reply found yet. Wait for ${adapter.platformName} to finish replying, then try again.`);
            return;
        }
        openEditor(true);
    };

    const copyIncoming = async () => {
        if (!pending) return;
        try {
            await navigator.clipboard.writeText(pending.formattedPrompt);
            setArrivalStatus('Copied. Paste into the chat input, review, and send.');
            adapter?.getInputElement()?.focus();
        } catch { setArrivalStatus('Clipboard access failed. Select and copy the text below.'); }
    };
    if (!adapter) return null;
    return <>
        <button onClick={() => openEditor()} className="fixed bottom-6 right-6 z-[999996] bridge-btn shadow-2xl">Transfer · Keep context</button>
        {error && <div className="bridge-arrival" role="alert">{error}<button className="bridge-btn-ghost" onClick={() => setError('')}>Dismiss</button></div>}
        {draft && !snapshot && <section className="bridge-arrival" aria-label="Brief drafting">
            <strong>Drafting your brief with {adapter.platformName}</strong><p role="status">{draftStatus}</p>
            <div className="bridge-actions"><button className="bridge-btn" onClick={fillBrief}>Fill brief</button>
                <button className="bridge-btn-ghost" onClick={() => openEditor()}>Back to editor</button></div>
        </section>}
        {pending && !snapshot && !draft && <section className="bridge-arrival" aria-label="Incoming project context">
            <strong>{inserted ? 'Your project context is in the chat box' : 'Your project context is ready'}</strong>
            <p>{inserted ? 'Review it, then press send. Your saved memory is available under Transfer.'
                : 'Insert it into this chat, review, and send. Your saved memory is available under Transfer.'}</p>
            {!inserted && <textarea aria-label="Incoming context" readOnly value={pending.formattedPrompt} onFocus={event => event.currentTarget.select()} />}
            <div className="bridge-actions">
                {!inserted && <button className="bridge-btn" onClick={insertPending}>Insert into chat</button>}
                <button className={inserted ? 'bridge-btn' : 'bridge-btn-ghost'} onClick={copyIncoming}>Copy context</button>
                <button className="bridge-btn-ghost" onClick={async () => {
                    try { await chrome.runtime.sendMessage({ type: 'CLEAR_PENDING_CONTEXT', id: pending.id }); setPending(null); }
                    catch { setArrivalStatus('Could not dismiss the transfer. Try again.'); }
                }}>Dismiss</button></div><p role="status">{arrivalStatus}</p>
        </section>}
        {snapshot && <MemoryEditor messages={snapshot.scrape.messages} rolesGuessed={snapshot.scrape.rolesGuessed}
            sourcePlatform={adapter.platformName} sourceUrl={snapshot.url}
            platformId={adapter.platformId} projects={projects} initialProjectId={initialProjectId}
            initialMemory={draft ?? undefined} fillFromBrief={fillOnOpen}
            onClose={closeEditor}
            onLoadEarlier={loadEarlier}
            onRequestDraft={requestDraft}
            onSave={async project => { await saveProject(project); setProjects(await listProjects()); }}
            onDelete={async id => { await deleteProject(id); setProjects(await listProjects()); }}
            onTransfer={async (project, prompt, destination) => {
                const payload: ContextPayload = {
                    id: crypto.randomUUID(), sourcePlatform: adapter.platformId, destinationPlatform: destination.id,
                    messages: [], formattedPrompt: prompt, timestamp: Date.now(), projectId: project.id,
                };
                const response = await chrome.runtime.sendMessage({ type: 'TRANSFER_CONTEXT', payload });
                if (!response?.success) throw new Error(response?.error || 'Could not open the destination. Use Copy context or retry.');
            }} />}
    </>;
}
export default TransferUI;
