import { useEffect, useMemo, useRef, useState } from 'react';
import type { Message, PlatformOption } from '../adapters/types';
import { PLATFORMS } from '../adapters/types';
import { buildHandoff, isProjectHandoff } from '../lib/contextEngine';
import { captureMessage, newProject, sameMessage, type ProjectMemory } from '../lib/projectMemory';

interface Props {
    messages: Message[];
    sourcePlatform: string;
    sourceUrl: string;
    platformId: string;
    projects: ProjectMemory[];
    initialProjectId?: string;
    onSave: (project: ProjectMemory) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    onTransfer: (project: ProjectMemory, prompt: string, destination: PlatformOption) => Promise<void>;
    onClose: () => void;
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
    const initial = projects.find(project => project.id === props.initialProjectId) || fresh();
    const [memory, setMemory] = useState<ProjectMemory>(initial);
    const [savedSnapshot, setSavedSnapshot] = useState(JSON.stringify(initial));
    const [budget, setBudget] = useState(24000);
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState('');
    const [error, setError] = useState('');
    const dialog = useRef<HTMLDivElement>(null);
    const result = useMemo(() => buildHandoff(messages, sourcePlatform, sourceUrl, memory, budget), [messages, sourcePlatform, sourceUrl, memory, budget]);
    const dirty = JSON.stringify(memory) !== savedSnapshot;
    const meaningful = !!(memory.originalRequest || memory.pins.length || fields.some(([key]) => memory[key].trim()));
    const canTransfer = meaningful && !!memory.name.trim() && !result.overBudget && !busy;
    const patch = (key: string, value: string) => { setMemory(previous => ({ ...previous, [key]: value })); setStatus(''); };
    const close = () => { if (!busy && (!dirty || window.confirm('Discard unsaved project memory changes?'))) onClose(); };

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
                    <div className="bridge-messages">{messages.map((message, index) => {
                        const pinned = memory.pins.some(item => item.sourceUrl === sourceUrl && item.role === message.role && item.content === message.content);
                        const earlier = isProjectHandoff(message.content, memory.id);
                        return <div className="bridge-message" key={index}>
                            <label className="bridge-pin"><input type="checkbox" checked={pinned} disabled={busy || earlier} onChange={() => pin(message, index)} aria-label={`Pin message ${index + 1}`} />Pin</label>
                            <details><summary>{index + 1} · {message.role} · {earlier ? 'Earlier handoff (memory retained above)' : message.content.slice(0, 95)}</summary><pre>{message.content}</pre></details>
                        </div>;
                    })}{!messages.length && <p>No visible messages found. You can still use a saved project or enter a brief.</p>}</div>
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
                {error && <p className="bridge-error" role="alert">{error}</p>}{status && <p role="status">{status}</p>}
                <div className="bridge-actions"><button className="bridge-btn-ghost" disabled={!canTransfer} onClick={() => run(async () => { await navigator.clipboard.writeText(result.prompt); await persist(); }, 'Context copied and memory saved. Paste it into your next chat.')}>Copy context</button>
                    {PLATFORMS.filter(platform => platform.id !== props.platformId).map(platform => <button key={platform.id} className="bridge-btn" disabled={!canTransfer}
                        onClick={() => run(async () => { await persist(); await onTransfer(memory, result.prompt, platform); }, `Opened ${platform.name}. Your context is ready in the new tab.`)}>Continue in {platform.name}</button>)}</div>
                <p className="bridge-help">Works without an API key or another response from your current AI. Review before sending.</p>
            </footer>
        </div>
    </div>;
}
