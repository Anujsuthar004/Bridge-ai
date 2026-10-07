import type { PlasmoCSConfig, PlasmoGetStyle, PlasmoGetShadowHostId } from 'plasmo';
import { useEffect, useState } from 'react';
import cssText from 'data-text:~style.css';
import { getActiveAdapter, type AIAdapter, type Message, type ContextPayload } from '~adapters';
import { MemoryEditor } from '~components/MemoryEditor';
import { listProjects, saveProject, deleteProject } from '~lib/storage';
import type { ProjectMemory } from '~lib/projectMemory';

export const config: PlasmoCSConfig = {
    matches: ['https://chat.openai.com/*', 'https://chatgpt.com/*', 'https://claude.ai/*', 'https://gemini.google.com/*', 'https://bard.google.com/*'],
    all_frames: false,
};
export const getStyle: PlasmoGetStyle = () => { const style = document.createElement('style'); style.textContent = cssText; return style; };
export const getShadowHostId: PlasmoGetShadowHostId = () => 'bridge-ai-root';

function TransferUI() {
    const [adapter, setAdapter] = useState<AIAdapter | null>(null);
    const [projects, setProjects] = useState<ProjectMemory[]>([]);
    const [snapshot, setSnapshot] = useState<{ messages: Message[]; url: string } | null>(null);
    const [pending, setPending] = useState<ContextPayload | null>(null);
    const [arrivalStatus, setArrivalStatus] = useState('');
    const [error, setError] = useState('');
    const [initialProjectId, setInitialProjectId] = useState<string>();

    useEffect(() => {
        setAdapter(getActiveAdapter());
        chrome.runtime.sendMessage({ type: 'GET_PENDING_CONTEXT' }).then(response => {
            if (response?.payload) { setPending(response.payload); setInitialProjectId(response.payload.projectId); }
        }).catch(() => setError('BridgeAI could not load the incoming transfer. Reload this tab to retry.'));
    }, []);

    const openEditor = async () => {
        if (!adapter) return;
        try {
            setProjects(await listProjects());
            setSnapshot({ messages: adapter.scrapeMessages(), url: location.origin + location.pathname });
            setError('');
        } catch { setError('Could not read project memory. Reload the extension and try again.'); }
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
        <button onClick={openEditor} className="fixed bottom-6 right-6 z-[999996] bridge-btn shadow-2xl">Transfer · Keep context</button>
        {error && <div className="bridge-arrival" role="alert">{error}<button className="bridge-btn-ghost" onClick={() => setError('')}>Dismiss</button></div>}
        {pending && !snapshot && <section className="bridge-arrival" aria-label="Incoming project context">
            <strong>Your project context is ready</strong><p>Copy it, then paste into this chat. Your saved memory is available under Transfer.</p>
            <textarea aria-label="Incoming context" readOnly value={pending.formattedPrompt} onFocus={event => event.currentTarget.select()} />
            <div className="bridge-actions"><button className="bridge-btn" onClick={copyIncoming}>Copy context</button>
                <button className="bridge-btn-ghost" onClick={async () => {
                    try { await chrome.runtime.sendMessage({ type: 'CLEAR_PENDING_CONTEXT', id: pending.id }); setPending(null); }
                    catch { setArrivalStatus('Could not dismiss the transfer. Try again.'); }
                }}>Dismiss</button></div><p role="status">{arrivalStatus}</p>
        </section>}
        {snapshot && <MemoryEditor messages={snapshot.messages} sourcePlatform={adapter.platformName} sourceUrl={snapshot.url}
            platformId={adapter.platformId} projects={projects} initialProjectId={initialProjectId}
            onClose={() => { setSnapshot(null); setInitialProjectId(undefined); }}
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
