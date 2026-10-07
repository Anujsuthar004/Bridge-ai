import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHandoff, isProjectHandoff } from '../lib/contextEngine.ts';
import { newProject, captureMessage } from '../lib/projectMemory.ts';
const url = 'https://chatgpt.com/c/example';
const msg = (role, content) => ({ role, content });

test('preserves original instructions beyond ten messages and full pinned code', () => {
    const code = '```ts\n' + 'const answer = 42;\n'.repeat(100) + '```';
    const messages = [msg('user', 'Use no paid services.'), msg('assistant', code), ...Array.from({length: 20}, (_, i) => msg('user', `Follow-up ${i}`))];
    const project = newProject(messages, 'ChatGPT', url);
    project.pins.push(captureMessage(messages[1], 1, 'ChatGPT', url));
    const result = buildHandoff(messages, 'ChatGPT', url, project);
    assert.ok(result.prompt.includes('Use no paid services.'));
    assert.ok(result.prompt.includes(code));
    assert.equal(result.prompt.split(code).length - 1, 1, 'pins should not be duplicated in history');
    assert.equal(result.omitted.length, 0);
});

test('budget drops whole oldest messages and preserves a contiguous recent suffix', () => {
    const messages = [msg('user', 'Original'), ...Array.from({length: 6}, (_, i) => msg('assistant', `Message ${i}:` + 'x'.repeat(800)))];
    const project = newProject(messages, 'ChatGPT', url);
    const result = buildHandoff(messages, 'ChatGPT', url, project, 3200);
    assert.ok(result.characterCount <= 3200);
    assert.ok(result.included.includes(6));
    assert.ok(result.omitted.includes(1));
    result.included.forEach(i => assert.ok(result.prompt.includes(messages[i].content)));
    result.omitted.forEach(i => assert.ok(!result.prompt.includes(messages[i].content)));
});

test('oversized protected material blocks rather than truncating', () => {
    const project = newProject([msg('user', 'Original')], 'ChatGPT', url);
    project.workingMaterial = 'EXACT DATA\n' + 'z'.repeat(15000);
    const result = buildHandoff([], 'ChatGPT', url, project, 12000);
    assert.equal(result.overBudget, true);
    assert.ok(result.prompt.includes(project.workingMaterial));
});

test('does not silently substitute older messages when newest does not fit', () => {
    const messages = [msg('user', 'Original'), msg('assistant', 'old state'), msg('user', 'new state:' + 'x'.repeat(20000))];
    const result = buildHandoff(messages, 'ChatGPT', url, newProject(messages, 'ChatGPT', url), 12000);
    assert.deepEqual(result.included, []);
    assert.deepEqual(result.omitted, [1, 2]);
});

test('four-platform round trip preserves original memory without nested envelopes', () => {
    const original = [msg('user', 'Build a free portfolio.'), msg('assistant', 'Use Firebase.')];
    const project = newProject(original, 'ChatGPT', url);
    project.decisions = 'Use Supabase; Firebase was rejected.';
    project.nextStep = 'Debug the contact form.';
    project.pins.push(captureMessage(msg('assistant', 'Exact error: 403'), 2, 'ChatGPT', url));
    let result = buildHandoff(original, 'ChatGPT', url, project);
    for (const platform of ['Claude', 'Gemini', 'ChatGPT']) {
        const previous = result.prompt;
        result = buildHandoff([msg('user', previous), msg('assistant', `Progress on ${platform}`)], platform, `https://${platform.toLowerCase()}.example/chat`, structuredClone(project));
        assert.equal(result.previousHandoffs.length, 1);
        assert.equal(result.prompt.split('[BridgeAI handoff v1]').length - 1, 1);
        for (const value of ['Build a free portfolio.', project.decisions, project.nextStep, 'Exact error: 403']) assert.ok(result.prompt.includes(value));
    }
});

test('does not discard another project handoff or instructions appended to a handoff', () => {
    const first = newProject([], 'ChatGPT', url);
    const second = newProject([], 'ChatGPT', url);
    const prompt = buildHandoff([], 'ChatGPT', url, first).prompt;
    assert.equal(isProjectHandoff(prompt, second.id), false);
    assert.equal(isProjectHandoff(prompt + '\nNew request', first.id), false);
    assert.equal(isProjectHandoff(prompt.replaceAll('\n', '\n\n'), first.id), true);
});

test('empty page still transfers an edited brief and reports attachment limitations', () => {
    const project = newProject([], 'Claude', url);
    project.goal = 'Finish my application';
    const result = buildHandoff([], 'Claude', url, project);
    assert.ok(result.prompt.includes(project.goal));
    assert.ok(result.prompt.includes('Attachments and hidden/unloaded messages are not included.'));
});
