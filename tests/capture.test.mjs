import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readMessageText } from '../lib/messageText.ts';
import { ClaudeAdapter } from '../adapters/ClaudeAdapter.ts';
import { GeminiAdapter } from '../adapters/GeminiAdapter.ts';
import { insertIntoInput, isInputEmpty, resolveEditable } from '../lib/insertText.ts';
import { loadEarlierMessages } from '../lib/loadHistory.ts';

const page = html => {
    const dom = new JSDOM(html);
    Object.assign(globalThis, { document: dom.window.document, window: dom.window, Event: dom.window.Event,
        HTMLTextAreaElement: dom.window.HTMLTextAreaElement, HTMLInputElement: dom.window.HTMLInputElement });
    return dom;
};
const roles = result => result.messages.map(m => `${m.role}:${m.content}`);

test('Gemini keeps page order when a turn has no reply', () => {
    page('<user-query>First</user-query><user-query>Second</user-query><model-response>Answer to second</model-response><user-query>Third</user-query><model-response>Answer to third</model-response>');
    assert.deepEqual(roles(new GeminiAdapter().scrapeMessages()),
        ['user:First', 'user:Second', 'assistant:Answer to second', 'user:Third', 'assistant:Answer to third']);
});

test('Claude does not capture nested role markers twice and keeps page order', () => {
    page('<div data-is-human-message="true"><div class="font-user-message">Question</div></div>' +
        '<div data-is-human-message="false"><div class="font-claude-message">Reply</div></div>');
    const result = new ClaudeAdapter().scrapeMessages();
    assert.deepEqual(roles(result), ['user:Question', 'assistant:Reply']);
    assert.equal(result.rolesGuessed, false);
});

test('fallback capture flags guessed speakers instead of passing them off as known', () => {
    page('<div class="prose">A message long enough to keep</div><div class="prose">Another long enough message</div>');
    const result = new ClaudeAdapter().scrapeMessages();
    assert.equal(result.messages.length, 2);
    assert.equal(result.rolesGuessed, true);
});

test('empty page reports no messages and no guessing', () => {
    page('<main></main>');
    const result = new GeminiAdapter().scrapeMessages();
    assert.deepEqual(result.messages, []);
    assert.equal(result.rolesGuessed, false);
});

test('lists keep bullet and number markers', () => {
    const dom = page('<div><ul><li>Apples</li><li>Pears</li></ul><ol start="3"><li>Third</li><li>Fourth</li></ol></div>');
    const text = readMessageText(dom.window.document.querySelector('div'));
    assert.ok(text.includes('- Apples\n\n- Pears'));
    assert.ok(text.includes('3. Third\n\n4. Fourth'));
});

test('inserting into a plain textarea fires input and never submits', async () => {
    const dom = page('<form><textarea id="prompt"></textarea></form>');
    const input = dom.window.document.getElementById('prompt');
    let inputs = 0, submits = 0;
    input.addEventListener('input', () => inputs++);
    dom.window.document.querySelector('form').addEventListener('submit', () => submits++);
    assert.equal(isInputEmpty(input), true);
    assert.equal(await insertIntoInput(input, 'Line one\n\nLine two'), true);
    assert.equal(input.value, 'Line one\n\nLine two');
    assert.equal(inputs, 1);
    assert.equal(submits, 0);
    assert.equal(isInputEmpty(input), false);
});

test('a wrapper element resolves to its editable child', () => {
    const dom = page('<rich-textarea><div class="ql-editor" contenteditable="true"></div></rich-textarea>');
    const wrapper = dom.window.document.querySelector('rich-textarea');
    assert.equal(resolveEditable(wrapper).className, 'ql-editor');
});

test('history loading stops once scrolling to the top loads nothing new', async () => {
    let batches = 3, count = 10;
    const scroller = { scrollHeight: 1000, set scrollTop(value) { if (value === 0 && batches > 0) { batches--; count += 10; this.scrollHeight += 500; } } };
    const result = await loadEarlierMessages(scroller, () => count, { wait: async () => {} });
    assert.deepEqual(result, { complete: true, stopped: false });
    assert.equal(count, 40);
});

test('history loading can be stopped', async () => {
    const controller = new AbortController();
    const scroller = { scrollHeight: 0, set scrollTop(_) { this.scrollHeight += 100; } };
    const result = await loadEarlierMessages(scroller, () => 1, { signal: controller.signal, wait: async () => controller.abort() });
    assert.equal(result.stopped, true);
});
