import test from 'node:test';
import assert from 'node:assert/strict';
import { applyBrief, buildBriefRequest, findBriefReply, parseBriefReply } from '../lib/briefDraft.ts';
import { buildHandoff } from '../lib/contextEngine.ts';
import { newProject } from '../lib/projectMemory.ts';
const url = 'https://claude.ai/chat/example';
const msg = (role, content) => ({ role, content });

const reply = [
    'Here is the brief.',
    '[BRIDGEAI:NAME]', 'Portfolio site',
    '[BRIDGEAI:GOAL]', 'Ship a free portfolio.',
    '[BRIDGEAI:REQUIREMENTS]', 'Unknown',
    '[BRIDGEAI:DECISIONS]', '- Use Supabase', '- Firebase rejected',
    '[BRIDGEAI:PROGRESS]', '```', 'Contact form fixed', '```',
    '[BRIDGEAI:NEXT]', 'Test mobile layout.',
    '[BRIDGEAI:END]',
].join('\n');

test('a rendered brief reply parses into fields and skips Unknown', () => {
    assert.deepEqual(parseBriefReply(reply), {
        name: 'Portfolio site', goal: 'Ship a free portfolio.', decisions: '- Use Supabase\n- Firebase rejected',
        progress: 'Contact form fixed', nextStep: 'Test mobile layout.',
    });
});

test('labels still parse when markdown joins them onto one line', () => {
    assert.equal(parseBriefReply('[BRIDGEAI:GOAL] Ship it. [BRIDGEAI:NEXT] Test. [BRIDGEAI:END]').nextStep, 'Test.');
});

test('only an assistant reply after the latest request counts', () => {
    const request = buildBriefRequest();
    assert.equal(findBriefReply([msg('user', request)]), undefined, 'the request itself contains the labels');
    assert.equal(findBriefReply([msg('user', request), msg('assistant', reply), msg('user', request)]), undefined);
    assert.equal(findBriefReply([msg('user', request), msg('assistant', reply)]).content, reply);
});

test('applying a brief keeps a name the user already chose', () => {
    const project = newProject([], 'Claude', url);
    assert.equal(applyBrief(project, parseBriefReply(reply)).memory.name, 'Portfolio site');
    project.name = 'My portfolio';
    const { memory, filled } = applyBrief(project, parseBriefReply(reply));
    assert.equal(memory.name, 'My portfolio');
    assert.ok(!filled.includes('name'));
    assert.equal(memory.nextStep, 'Test mobile layout.');
});

test('brief drafting messages stay out of the handoff and the original request', () => {
    const messages = [msg('user', 'Build a portfolio.'), msg('assistant', 'Sure.'), msg('user', buildBriefRequest()), msg('assistant', reply)];
    const project = newProject(messages.slice(2), 'Claude', url);
    assert.equal(project.originalRequest, undefined);
    const result = buildHandoff(messages, 'Claude', url, newProject(messages, 'Claude', url));
    assert.deepEqual(result.briefExchanges, [2, 3]);
    assert.ok(!result.prompt.includes('[BRIDGEAI:'));
    assert.ok(result.prompt.includes('2 brief-drafting messages excluded'));
});

test('replies that restyle the labels or drop END are still read', () => {
    const variants = [
        '\\[BRIDGEAI:GOAL\\]\nShip it.\n\\[BRIDGEAI:NEXT\\]\nTest it.',
        '**[BRIDGEAI:GOAL]**\nShip it.\n**[BRIDGEAI:NEXT]**\nTest it.',
        '[ BridgeAI : goal ]\nShip it.\n[ BridgeAI : next ]\nTest it.',
        'BRIDGEAI:GOAL\nShip it.\nBRIDGEAI:NEXT\nTest it.',
        '### [BRIDGEAI:GOAL]\nShip it.\n### [BRIDGEAI:NEXT]\nTest it.',
    ];
    for (const text of variants) {
        assert.ok(findBriefReply([msg('user', buildBriefRequest()), msg('assistant', text)]), text);
        assert.deepEqual(parseBriefReply(text), { goal: 'Ship it.', nextStep: 'Test it.' }, text);
    }
});

test('a reply with a single label, or ordinary text, is not mistaken for a brief', () => {
    assert.equal(findBriefReply([msg('user', buildBriefRequest()), msg('assistant', 'Sure! [BRIDGEAI:GOAL] coming up.')]), undefined);
    assert.equal(findBriefReply([msg('assistant', 'The BridgeAI handoff worked.')]), undefined);
});

test('the reply after the request is noticed even when it is not a readable brief', async () => {
    const { hasReplyAfterRequest } = await import('../lib/briefDraft.ts');
    assert.equal(hasReplyAfterRequest([msg('user', buildBriefRequest())]), false);
    assert.equal(hasReplyAfterRequest([msg('user', buildBriefRequest()), msg('assistant', 'I cannot do that.')]), true);
    assert.equal(hasReplyAfterRequest([msg('assistant', 'Hello')]), false);
});
