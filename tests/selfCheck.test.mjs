import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { isConversationPage, problemsFor, publishHealth, reportUrl } from '../lib/selfCheck.ts';

test('conversation pages are recognised per platform', () => {
    assert.equal(isConversationPage('chatgpt', '/c/abc-123'), true);
    assert.equal(isConversationPage('chatgpt', '/g/g-xyz-gpt/c/abc'), true);
    assert.equal(isConversationPage('chatgpt', '/'), false);
    assert.equal(isConversationPage('claude', '/chat/0f2a'), true);
    assert.equal(isConversationPage('claude', '/new'), false);
    assert.equal(isConversationPage('gemini', '/app/8e1c2d'), true);
    assert.equal(isConversationPage('gemini', '/u/1/app/8e1c2d'), true);
    assert.equal(isConversationPage('gemini', '/app'), false);
});

test('problems: missing chat box, empty conversation, guessed speakers', () => {
    assert.deepEqual(problemsFor({ chatBox: true, messages: 0, rolesGuessed: false, conversation: false }), []);
    assert.deepEqual(problemsFor({ chatBox: false, messages: 4, rolesGuessed: false, conversation: true }), ['Chat box not found']);
    assert.deepEqual(problemsFor({ chatBox: true, messages: 0, rolesGuessed: false, conversation: true }), ['No messages found on a conversation page']);
    assert.equal(problemsFor({ chatBox: true, messages: 3, rolesGuessed: true, conversation: true }).length, 1);
});

test('report link carries site and problem but no chat content or conversation link', () => {
    const url = new URL(reportUrl({ platformName: 'Claude', problems: ['Chat box not found'], conversation: true, version: '0.1.0',
        userAgent: 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/141.0.0.0 Safari/537.36' }));
    assert.equal(url.origin + url.pathname, 'https://github.com/Anujsuthar004/Bridge-ai/issues/new');
    assert.equal(url.searchParams.get('title'), 'Claude: Chat box not found');
    const body = url.searchParams.get('body');
    for (const part of ['Claude', 'existing conversation', 'Chat box not found', '0.1.0', 'Chrome version:** 141']) assert.ok(body.includes(part), part);
    assert.ok(!body.includes('claude.ai'));
});

test('health is published on the host element for live-site checks', () => {
    const host = new JSDOM('<div id="bridge-ai-root"></div>').window.document.getElementById('bridge-ai-root');
    publishHealth(host, { chatBox: true, messages: 0, rolesGuessed: false, conversation: true });
    assert.equal(host.dataset.bridgeaiChatBox, 'found');
    assert.equal(host.dataset.bridgeaiMessages, '0');
    assert.equal(host.dataset.bridgeaiStatus, 'problem');
});
