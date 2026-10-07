import test from 'node:test';
import assert from 'node:assert/strict';
import { newProject } from '../lib/projectMemory.ts';
import { listProjects, saveProject, deleteProject } from '../lib/storage.ts';
import { pendingKey, readPending, removePending, cleanExpiredTransfers, TRANSFER_TTL } from '../lib/pendingTransfers.ts';
const data = {};
globalThis.chrome = { storage: { local: {
    get: async key => structuredClone(key === null ? data : { [key]: data[key] }),
    set: async items => Object.assign(data, structuredClone(items)),
    remove: async keys => { for (const key of Array.isArray(keys) ? keys : [keys]) delete data[key]; },
} } };

test('independent saved projects retain pins, edited decisions, and explicit deletion', async () => {
    const a = newProject([], 'ChatGPT', 'https://chatgpt.com/a');
    const b = newProject([], 'Claude', 'https://claude.ai/b');
    a.decisions = 'Use React'; b.decisions = 'Use vanilla JS';
    await Promise.all([saveProject(a), saveProject(b)]);
    a.decisions = 'Use Vue instead'; await saveProject(a);
    const projects = await listProjects();
    assert.equal(projects.find(p => p.id === a.id).decisions, 'Use Vue instead');
    assert.equal(projects.find(p => p.id === b.id).decisions, 'Use vanilla JS');
    await deleteProject(a.id);
    assert.deepEqual((await listProjects()).map(p => p.id), [b.id]);
});

test('concurrent transfers stay isolated by tab and expired payloads cannot be consumed', async () => {
    data[pendingKey(10)] = { id: 'a', targetTabId: 10, timestamp: Date.now() };
    data[pendingKey(20)] = { id: 'b', targetTabId: 20, timestamp: Date.now() };
    assert.equal(await readPending(30), null);
    assert.equal((await readPending(10)).id, 'a');
    await removePending(10, 'wrong-id'); assert.ok(await readPending(10));
    await removePending(10, 'a'); assert.equal(await readPending(10), null);
    assert.equal((await readPending(20)).id, 'b');
    data[pendingKey(20)].timestamp = Date.now() - TRANSFER_TTL;
    assert.equal(await readPending(20), null);
});

test('periodic expiry never deletes saved project memory', async () => {
    const project = newProject([], 'ChatGPT', 'https://chatgpt.com');
    await saveProject(project);
    data[pendingKey(40)] = { timestamp: Date.now() - TRANSFER_TTL - 1 };
    await cleanExpiredTransfers();
    assert.equal(data[pendingKey(40)], undefined);
    assert.ok((await listProjects()).some(p => p.id === project.id));
});
