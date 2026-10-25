import { useEffect, useMemo, useRef, useState } from 'react';
import type { Message, PlatformOption } from '../adapters/types';
import { PLATFORMS } from '../adapters/types';
import { applyBrief, findBriefReply, parseBriefReply } from '../lib/briefDraft';
import { buildHandoff, isBriefExchange, isProjectHandoff } from '../lib/contextEngine';
import { captureMessage, newProject, sameMessage, type ProjectMemory } from '../lib/projectMemory';

interface Props {
    messages: Message[];
    /** Speaker labels came from a fallback and may be wrong. */
    rolesGuessed: boolean;
    sourcePlatform: string;
    sourceUrl: string;
    platformId: string;
    projects: ProjectMemory[];
    initialProjectId?: string;
    /** Unsaved memory set aside while the current AI drafted a brief. */
    initialMemory?: ProjectMemory;
    /** Fill the fields from the AI's brief reply as soon as the editor opens. */
    fillFromBrief?: boolean;
    /** A brief reply the user pasted, used instead of searching the page. */
    briefText?: string;
    onSave: (project: ProjectMemory) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    onTransfer: (project: ProjectMemory, prompt: string, destination: PlatformOption) => Promise<void>;
    onClose: () => void;
    onLoadEarlier: (signal: AbortSignal) => Promise<string>;
    onRequestDraft: (memory: ProjectMemory) => void;
    /** Set when BridgeAI's self-check found a problem on this page: a prefilled issue to report it. */
    reportUrl?: string;
}

const fields = [
    ['goal', 'Goal', 'What are you trying to accomplish?'],
    ['requirements', 'Requirements & preferences', 'Constraints, tone, tools, budget, and instructions to keep.'],
    ['decisions', 'Current decisions', 'Keep the latest decisions here. Replace anything that is no longer true.'],
    ['progress', 'Progress & open questions', 'What is done? What failed, and why? What is still unresolved?'],
    ['nextStep', 'Next action', 'Exactly what should the next AI help with?'],
    ['workingMaterial', 'Exact working material', 'Paste the latest code, draft, calculations, or errors. This stays whole.'],
] as const;

export function MemoryEditor(props: Props) {
    const { messages, sourcePlatform, sourceUrl, projects, onSave, onDelete, onTransfer, onClose } = props;
    const fresh = () => newProject(messages, sourcePlatform, sourceUrl);
    const initial = props.initialMemory || projects.find(project => project.id === props.initialProjectId) || fresh();
    const saved = projects.find(project => project.id === initial.id);
    const [memory, setMemory] = useState<ProjectMemory>(initial);
    // A set-aside draft of a new project has unsaved work, so it starts dirty.
    const [savedSnapshot, setSavedSnapshot] = useState(saved || !props.initialMemory ? JSON.stringify(saved || initial) : '');
    const [budget, setBudget] = useState(24000);
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState('');
    const [error, setError] = useState('');
    const [beforeFill, setBeforeFill] = useState<ProjectMemory | null>(null);
    const [loading, setLoading] = useState(false);
    const [historyStatus, setHistoryStatus] = useState('');
    const stopLoading = useRef<AbortController | null>(null);
    const dialog = useRef<HTMLDivElement>(null);
    const result = useMemo(() => buildHandoff(messages, sourcePlatform, sourceUrl, memory, budget), [messages, sourcePlatform, sourceUrl, memory, budget]);
    const briefReply = useMemo(() => props.briefText ?? findBriefReply(messages)?.content, [messages, props.briefText]);
    const dirty = JSON.stringify(memory) !== savedSnapshot;
    const meaningful = !!(memory.originalRequest || memory.pins.length || fields.some(([key]) => memory[key].trim()));
    const canTransfer = meaningful && !!memory.name.trim() && !result.overBudget && !busy && !loading;
    const patch = (key: string, value: string) => { setMemory(previous => ({ ...previous, [key]: value })); setStatus(''); setBeforeFill(null); };
    const close = () => { if (!busy && !loading && (!dirty || window.confirm('Discard unsaved project memory changes?'))) onClose(); };

    const fillBrief = () => {
        if (!briefReply) return;
        const { memory: next, filled } = applyBrief(memory, parseBriefReply(briefReply));
        if (!filled.length) { setError(`Couldn’t read the brief in ${sourcePlatform}’s reply. Copy the parts you need into the fields.`); return; }
        setBeforeFill(memory); setMemory(next); setError('');
        setStatus(`Filled ${filled.length} field${filled.length === 1 ? '' : 's'} from ${sourcePlatform}’s reply. Review them before transferring.`);
    };
    const loadEarlier = async () => {
        const controller = new AbortController();
        stopLoading.current = controller;
        setLoading(true); setHistoryStatus('Loading earlier messages… this can take up to a minute for long chats.');
        try { setHistoryStatus(await props.onLoadEarlier(controller.signal)); }
        catch { setHistoryStatus('Could not load earlier messages. Scroll up in the chat manually, then reopen Transfer.'); }
        finally { setLoading(false); stopLoading.current = null; }
    };

    useEffect(() => { if (props.fillFromBrief) fillBrief(); }, []);

    // After earlier messages load, message numbers shift and a new project's first request may be older.
    useEffect(() => {
        const first = newProject(messages, sourcePlatform, sourceUrl).originalRequest;
        const numberOf = (item: { role: string; content: string }) =>
            messages.findIndex(message => message.role === item.role && message.content === item.content) + 1;
        setMemory(previous => {
            const isSaved = projects.some(project => project.id === previous.id);
            const originalRequest = !isSaved && previous.originalRequest && first && previous.originalRequest.sourceUrl === sourceUrl &&
                (previous.originalRequest.content !== first.content || previous.originalRequest.messageNumber !== first.messageNumber)
                ? { ...first, id: previous.originalRequest.id } : previous.originalRequest;
            const pins = previous.pins.map(item => item.sourceUrl === sourceUrl && numberOf(item) && numberOf(item) !== item.messageNumber
                ? { ...item, messageNumber: numberOf(item) } : item);
            const changed = originalRequest !== previous.originalRequest || pins.some((item, i) => item !== previous.pins[i]);
            return changed ? { ...previous, originalRequest, pins } : previous;
        });
    }, [messages]);

    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null;
        dialog.current?.focus();
        return () => previous?.focus();
    }, []);

    const run = async (action: () => Promise<void>, success: string) => {
        setBusy(true); setError(''); setStatus('');
        try { await action(); setStatus(success); }
        catch (cause) { setError(cause instanceof Error ? cause.message : 'Something went wrong. Your draft is still here; try again.'); }
        finally { setBusy(false); }
    };
    const persist = async () => { await onSave(memory); setSavedSnapshot(JSON.stringify(memory)); };
    const pin = (message: Message, index: number) => {
        const captured = captureMessage(message, index, sourcePlatform, sourceUrl);
        setMemory(previous => ({ ...previous, pins: previous.pins.some(item => sameMessage(item, captured))
            ? previous.pins.filter(item => !sameMessage(item, captured)) : [...previous.pins, captured] }));
        setStatus('');
    };

    return <div className="bridge-overlay">
        <div className="bridge-modal bridge-memory" role="dialog" aria-modal="true" aria-labelledby="bridge-title" tabIndex={-1} ref={dialog}
            onKeyDown={event => {
                if (event.key === 'Escape') { event.stopPropagation(); close(); }
                if (event.key === 'Tab') {
                    const items = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), summary, a[href]');
                    const visible = Array.from(items || []).filter(item => item.getClientRects().length);
                    const active = dialog.current?.getRootNode() as Document | ShadowRoot;
                    const first = visible[0], last = visible[visible.length - 1];
                    if (event.shiftKey && (active.activeElement === first || active.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
                    else if (!event.shiftKey && active.activeElement === last) { event.preventDefault(); first?.focus(); }
                }
            }}>
            <header className="bridge-memory-header">
                <div><p className="bridge-eyebrow">BRIDGE AI · PROJECT MEMORY</p><h2 id="bridge-title">Switch AI. Keep your progress.</h2>
                    <p>Review what the next AI should know. Your brief and pinned text stay whole.</p></div>
                <button className="bridge-btn-ghost" onClick={close} disabled={busy} aria-label="Close project memory">Close</button>
            </header>
            <div className="bridge-memory-body">
                <fieldset disabled={busy} className="bridge-editor-fields">
                    <label>Project<select aria-label="Project" value={projects.some(project => project.id === memory.id) ? memory.id : ''}
                        onChange={event => {
                            if (dirty && !window.confirm('Discard unsaved changes before switching projects?')) return;
                            const next = projects.find(project => project.id === event.target.value) || fresh();
                            setMemory(next); setSavedSnapshot(JSON.stringify(next)); setStatus(''); setError('');
                        }}><option value="">New project</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
                    <p className="bridge-help">Choose the same project after switching AI to carry its memory forward. Saved projects stay in this browser until you delete them.</p>
                    <div className="bridge-draft">
                        <p>Let {sourcePlatform} draft the brief from this conversation, then review it here. You send the request yourself.</p>
                        <div className="bridge-actions">
                            <button className="bridge-btn-ghost" onClick={() => props.onRequestDraft(memory)}>Ask {sourcePlatform} to draft it</button>
                            {briefReply && <button className="bridge-btn-ghost" onClick={fillBrief}>Fill from {sourcePlatform}’s reply</button>}
                        </div>
                    </div>
                    <label>Project name<input aria-label="Project name" value={memory.name} onChange={event => patch('name', event.target.value)} /></label>
                    {fields.map(([key, label, placeholder]) => <label key={key}>{label}<textarea aria-label={label} rows={key === 'workingMaterial' ? 5 : 2}
                        placeholder={placeholder} value={memory[key]} onChange={event => patch(key, event.target.value)} spellCheck={key !== 'workingMaterial'} /></label>)}
                    <div className="bridge-actions"><button className="bridge-btn-ghost" disabled={!memory.name.trim()} onClick={() => run(persist, 'Project memory saved on this device.')}>Save memory</button>
                        {projects.some(project => project.id === memory.id) && <button className="bridge-delete" onClick={() => {
                            if (!window.confirm(`Delete saved memory for “${memory.name}” from this browser?`)) return;
                            run(async () => { await onDelete(memory.id); const next = fresh(); setMemory(next); setSavedSnapshot(JSON.stringify(next)); }, 'Saved project deleted.');
                        }}>Delete saved project</button>}</div>
                </fieldset>
                <section className="bridge-material">
                    <h3>Keep the evidence</h3>
                    {memory.originalRequest && <details><summary>Original request · included in full</summary><p className="bridge-help">{memory.originalRequest.sourcePlatform} · message {memory.originalRequest.messageNumber}</p><pre>{memory.originalRequest.content}</pre><button className="bridge-btn-ghost" disabled={busy} onClick={() => setMemory(previous => ({ ...previous, originalRequest: undefined }))}>Remove original request</button></details>}
                    {memory.pins.map(item => <details key={item.id}><summary>Pinned · {item.sourcePlatform} · message {item.messageNumber}</summary>
                        <a href={item.sourceUrl} target="_blank" rel="noreferrer">Open source conversation</a><pre>{item.content}</pre>
                        <button className="bridge-btn-ghost" disabled={busy} onClick={() => setMemory(previous => ({ ...previous, pins: previous.pins.filter(pin => pin.id !== item.id) }))}>Unpin</button></details>)}
                    <p className="bridge-help">Pin anything that must survive future switches. Expand a message to check its full text.</p>
                    {props.rolesGuessed && <p className="bridge-notice" role="status">{sourcePlatform}’s usual message markers weren’t found, so the speaker labels below were guessed. Check them before transferring, and pin anything important.{props.reportUrl && <> <a className="bridge-report" href={props.reportUrl} target="_blank" rel="noreferrer">Report a problem</a></>}</p>}
                    <div className="bridge-actions">
                        {loading ? <button className="bridge-btn-ghost" onClick={() => stopLoading.current?.abort()}>Stop loading</button>
                            : <button className="bridge-btn-ghost" disabled={busy} onClick={loadEarlier}>Load earlier messages</button>}
                    </div>
                    <p className="bridge-help" role="status">{historyStatus || 'Long chats may not show their oldest messages until you scroll up. This scrolls for you.'}</p>
                    <div className="bridge-messages">{messages.map((message, index) => {
                        const pinned = memory.pins.some(item => item.sourceUrl === sourceUrl && item.role === message.role && item.content === message.content);
                        const earlier = isProjectHandoff(message.content, memory.id);
                        const brief = isBriefExchange(message);
                        return <div className="bridge-message" key={index}>
                            <label className="bridge-pin"><input type="checkbox" checked={pinned} disabled={busy || earlier || brief} onChange={() => pin(message, index)} aria-label={`Pin message ${index + 1}`} />Pin</label>
                            <details><summary>{index + 1} · {message.role} · {earlier ? 'Earlier handoff (memory retained above)' : brief ? 'Brief drafting (kept out of the handoff)' : message.content.slice(0, 95)}</summary><pre>{message.content}</pre></details>
                        </div>;
                    })}{!messages.length && <p>No messages found on this page. If this chat has messages, {sourcePlatform} may have changed its page layout. You can still use a saved project or write a brief.{props.reportUrl && <> <a className="bridge-report" href={props.reportUrl} target="_blank" rel="noreferrer">Report a problem</a></>}</p>}</div>
                    <h3>Review your handoff</h3>
                    <label>Transfer size<select aria-label="Transfer size" value={budget} disabled={busy} onChange={event => setBudget(Number(event.target.value))}>
                        <option value={12000}>Compact · 12,000 characters</option><option value={24000}>Balanced · 24,000 characters</option><option value={60000}>Extended · 60,000 characters</option>
                    </select></label>
                    <p className="bridge-help">{result.characterCount.toLocaleString()} characters · {result.included.length} recent messages included · {memory.pins.length} pins. These sizes are transfer budgets, not provider limits.</p>
                    {result.omitted.length > 0 && <p className="bridge-notice" role="status">Messages {result.omitted.map(index => index + 1).join(', ')} won’t fit. Pin essential messages or increase the size. No message is shortened.</p>}
                    {result.overBudget && <p className="bridge-error" role="alert">Your protected material exceeds this budget. Increase the size, edit the brief, or unpin material before transferring.</p>}
                    <p className="bridge-help">Captures text currently available on this page. Re-upload files and images in the destination; hidden or unloaded messages may be missing. Memory is user-edited, not automatically summarized.</p>
                    <details><summary>Full transfer preview</summary><textarea aria-label="Full transfer preview" readOnly rows={14} value={result.prompt} /></details>
                </section>
            </div>
            <footer className="bridge-memory-footer">
                {error && <p className="bridge-error" role="alert">{error}</p>}
                {status && <div className="bridge-actions"><p role="status">{status}</p>{beforeFill && <button className="bridge-btn-ghost"
                    onClick={() => { setMemory(beforeFill); setBeforeFill(null); setStatus('Brief fill undone.'); }}>Undo fill</button>}</div>}
                <div className="bridge-actions"><button className="bridge-btn-ghost" disabled={!canTransfer} onClick={() => run(async () => { await navigator.clipboard.writeText(result.prompt); await persist(); }, 'Context copied and memory saved. Paste it into your next chat.')}>Copy context</button>
                    {PLATFORMS.filter(platform => platform.id !== props.platformId).map(platform => <button key={platform.id} className="bridge-btn" disabled={!canTransfer}
                        onClick={() => run(async () => { await persist(); await onTransfer(memory, result.prompt, platform); }, `Opened ${platform.name}. Your context is ready in the new tab.`)}>Continue in {platform.name}</button>)}</div>
                <p className="bridge-help">Works without an API key or another response from your current AI. Review before sending.</p>
            </footer>
        </div>
    </div>;
}
