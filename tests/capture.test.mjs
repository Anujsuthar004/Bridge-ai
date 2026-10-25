import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readMessageText } from '../lib/messageText.ts';
import { ClaudeAdapter } from '../adapters/ClaudeAdapter.ts';
import { GeminiAdapter } from '../adapters/GeminiAdapter.ts';
import { inputHasText, insertIntoInput, isInputEmpty, resolveEditable } from '../lib/insertText.ts';
import { loadEarlierMessages } from '../lib/loadHistory.ts';
import { mergeScrapes } from '../lib/scrape.ts';

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

// Audit findings (October 2026): each test below failed before its fix.

test('Claude fallback keeps separate turns apart when their container also matches', () => {
    page('<div data-testid="chat-messages"><div data-testid="chat-message-1">First turn text</div><div data-testid="chat-message-2">Second turn text</div></div>');
    assert.deepEqual(new ClaudeAdapter().scrapeMessages().messages.map(m => m.content), ['First turn text', 'Second turn text']);
    page('<div class="MessageContentList"><div class="MessageContent">A long enough first message</div><div class="MessageContent">A long enough second message</div></div>');
    const result = new ClaudeAdapter().scrapeMessages();
    assert.deepEqual(result.messages.map(m => m.content), ['A long enough first message', 'A long enough second message']);
    assert.equal(result.rolesGuessed, true);
});

test('text hidden with CSS or the hidden attribute is not captured; code keeps its whitespace', () => {
    const dom = page('<div><p>Visible text</p><p style="display:none">Secret one</p><p hidden>Secret two</p>' +
        '<span style="visibility:hidden">Secret three</span><pre><code>  keep\n\n    this</code></pre></div>');
    const text = readMessageText(dom.window.document.querySelector('div'));
    assert.ok(text.includes('Visible text'));
    assert.ok(!text.includes('Secret'));
    assert.ok(text.includes('  keep\n\n    this'));
});

test('insertion check needs the whole text, not just its start and end', () => {
    const dom = page('<textarea></textarea>');
    const input = dom.window.document.querySelector('textarea');
    const start = 'S'.repeat(70), end = 'E'.repeat(70);
    input.value = `${start} the middle was changed ${end}`;
    assert.equal(inputHasText(input, `${start} the original middle ${end}`), false);
    input.value = `${start}\n\nthe original\n middle ${end}`;
    assert.equal(inputHasText(input, `${start} the original middle ${end}`), true);
});

test('history loading keeps going while a virtualized list swaps messages at the same count', async () => {
    const pages = [['m7', 'm8', 'm9'], ['m4', 'm5', 'm6'], ['m1', 'm2', 'm3']];
    let shown = 0, rounds = 0;
    const scroller = { scrollHeight: 1000, set scrollTop(value) { if (value === 0 && shown < pages.length - 1) shown++; } };
    const result = await loadEarlierMessages(scroller, () => `${pages[shown].length}|${pages[shown][0]}`, { wait: async () => {}, onRound: () => rounds++ });
    assert.equal(result.complete, true);
    assert.equal(shown, 2, 'stopped before reaching the oldest messages');
    assert.ok(rounds >= 3);
});

test('captures from a virtualized chat are joined without losing the newest messages', () => {
    const scrape = (...contents) => ({ messages: contents.map((content, i) => ({ role: i % 2 ? 'assistant' : 'user', content })), rolesGuessed: false, firstElement: null });
    // Older view after scrolling up holds m1..m4; the original view held m3..m6.
    const older = { messages: ['m1', 'm2', 'm3', 'm4'].map((content, i) => ({ role: i % 2 ? 'assistant' : 'user', content })), rolesGuessed: false, firstElement: null };
    const newer = { messages: ['m3', 'm4', 'm5', 'm6'].map((content, i) => ({ role: i % 2 ? 'assistant' : 'user', content })), rolesGuessed: false, firstElement: null };
    assert.deepEqual(mergeScrapes(older, newer).messages.map(m => m.content), ['m1', 'm2', 'm3', 'm4', 'm5', 'm6']);
    // A normal chat keeps everything on the page, so the older view already contains the newer one.
    assert.deepEqual(mergeScrapes(scrape('a', 'b', 'c', 'd'), scrape('c', 'd')).messages.map(m => m.content), ['a', 'b', 'c', 'd']);
});
