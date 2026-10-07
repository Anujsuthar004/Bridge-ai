import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readMessageText } from '../lib/messageText.ts';
import { ChatGPTAdapter } from '../adapters/ChatGPTAdapter.ts';
import { ClaudeAdapter } from '../adapters/ClaudeAdapter.ts';
import { GeminiAdapter } from '../adapters/GeminiAdapter.ts';

test('paragraphs remain separated and code retains indentation and blank lines', () => {
    const dom = new JSDOM('<div><p>First paragraph</p><p>Second paragraph</p><pre><code>function x() {\n  return 42;\n\n}\n</code><button>Copy code</button></pre></div>');
    const text = readMessageText(dom.window.document.querySelector('div'));
    assert.ok(text.includes('First paragraph\n\nSecond paragraph'));
    assert.ok(text.includes('```\nfunction x() {\n  return 42;\n\n}\n```'));
    assert.ok(!text.includes('Copy code'));
});

test('all platform adapters preserve code text from representative DOM fixtures', () => {
    for (const [Adapter, html] of [
        [ChatGPTAdapter, '<div data-message-author-role="user">Help</div><div data-message-author-role="assistant"><div class="markdown"><pre><code>  exact\n\n    code</code></pre></div></div>'],
        [ClaudeAdapter, '<div data-testid="user-message">Help</div><div data-testid="assistant-message"><pre><code>  exact\n\n    code</code></pre></div>'],
        [GeminiAdapter, '<user-query>Help</user-query><model-response><pre><code>  exact\n\n    code</code></pre></model-response>'],
    ]) {
        const dom = new JSDOM(html);
        globalThis.document = dom.window.document;
        globalThis.window = dom.window;
        const messages = new Adapter().scrapeMessages();
        assert.equal(messages.length, 2);
        assert.equal(messages[0].role, 'user');
        assert.equal(messages[1].role, 'assistant');
        assert.ok(messages[1].content.includes('  exact\n\n    code'));
    }
});
