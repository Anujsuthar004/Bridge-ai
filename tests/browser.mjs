import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const extension = path.resolve('build/chrome-mv3-prod');
const profile = await mkdtemp(path.join(tmpdir(), 'bridgeai-test-'));
const artifacts = process.env.BRIDGEAI_TEST_OUTPUT || path.resolve('test-results');
await mkdir(artifacts, { recursive: true });
const context = await chromium.launchPersistentContext(profile, {
    headless: true, channel: 'chromium', viewport: { width: 1280, height: 800 },
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
});
const errors = [];
context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
const code = 'function contact() {\n  return "exact working code";\n\n}\n';
const fixtures = {
    'chatgpt.com': `<div data-message-author-role="user">Build a free portfolio. Keep it mobile friendly.</div><div data-message-author-role="assistant"><pre><code>${code}</code></pre></div><div data-message-author-role="user">Debug the contact form next.</div>` +
        // ChatGPT has renamed its composer before: no #prompt-textarea, a hidden fallback textarea, and the real editor.
        '<form><textarea name="prompt-textarea" style="display:none"></textarea><div class="ProseMirror" contenteditable="true"></div></form>',
    // Like ProseMirror and Quill, this composer takes over paste and applies it a moment later, at the caret.
    'claude.ai': '<div data-testid="user-message">Continue my portfolio</div><div data-testid="assistant-message">The contact form is fixed.</div><div contenteditable="true" data-testid="prompt-input"></div>' +
        '<script>document.querySelector("[data-testid=prompt-input]").addEventListener("paste", event => { event.preventDefault(); const text = event.clipboardData.getData("text/plain"); setTimeout(() => document.execCommand("insertText", false, text), 0); });</script>',
    'gemini.google.com': '<user-query>Continue my portfolio</user-query><model-response>The form is tested.</model-response><div class="ql-editor" contenteditable="true"></div>',
};
// A new Claude chat as it loads: only a hidden placeholder at first, the real composer 2.5 seconds later.
const slowClaude = '<textarea style="display:none"></textarea><script>setTimeout(() => {' +
    'document.body.insertAdjacentHTML("beforeend", \'<div contenteditable="true" data-testid="prompt-input"></div>\');' +
    'document.querySelector("[data-testid=prompt-input]").addEventListener("paste", event => { event.preventDefault(); const text = event.clipboardData.getData("text/plain"); setTimeout(() => document.execCommand("insertText", false, text), 0); });' +
    '}, 2500);</script>';
// ChatGPT and Claude are built with Tailwind v4, which registers these custom properties for the
// whole document. Registrations cross shadow DOM, so they must not break BridgeAI's own styles.
const siteCss = '<style>' + [
    ['--tw-gradient-from', '<color>', '#0000'], ['--tw-gradient-via', '<color>', '#0000'], ['--tw-gradient-to', '<color>', '#0000'],
    ['--tw-gradient-from-position', '<length-percentage>', '0%'], ['--tw-gradient-via-position', '<length-percentage>', '50%'],
    ['--tw-gradient-to-position', '<length-percentage>', '100%'],
].map(([name, syntax, initial]) => `@property ${name}{syntax:"${syntax}";inherits:false;initial-value:${initial}}`).join('') +
    '@property --tw-gradient-stops{syntax:"*";inherits:false}</style>';
await context.route('https://**/*', route => {
    const url = new URL(route.request().url());
    // A page as it would look after a site redesign: no message markers and no chat box.
    const content = url.pathname.includes('redesigned') ? '<main><p>Messages BridgeAI cannot recognise</p></main>'
        : url.pathname.includes('guessed') ? '<div class="prose">A long enough first message</div><div class="prose">A long enough second message</div><div contenteditable="true" data-testid="prompt-input"></div>'
        : url.hostname === 'claude.ai' && url.pathname === '/' ? slowClaude : fixtures[url.hostname] || '';
    return route.fulfill({contentType: 'text/html', body: `<html><head><title>BridgeAI test fixture</title>${siteCss}</head><body style="background:#eef2f7;padding:40px;font-family:system-ui"><h1>Conversation fixture</h1>${content}</body></html>`});
});
try {
    const page = await context.newPage();
    await page.goto('https://chatgpt.com/c/bridgeai-test');
    const launcher = page.getByRole('button', { name: 'Transfer · Keep context' });
    // Self-check: the working fixture is recorded as healthy for live-site checks.
    await page.waitForSelector('#bridge-ai-root[data-bridgeai-status="ok"][data-bridgeai-chat-box="found"][data-bridgeai-messages="3"]', { state: 'attached' });
    // The launcher must keep its brand background on sites that register Tailwind v4 properties.
    assert.ok((await launcher.evaluate(el => getComputedStyle(el).backgroundImage)).includes('rgb(99, 102, 241)'), 'launcher lost its background');
    await launcher.click();
    assert.ok((await page.getByRole('button', { name: 'Continue in Claude', exact: true })
        .evaluate(el => getComputedStyle(el).backgroundImage)).includes('rgb(99, 102, 241)'), 'primary buttons lost their background');
    await page.getByLabel('Project name', { exact: true }).fill('Portfolio');
    await page.getByLabel('Goal', { exact: true }).fill('Finish my internship portfolio');
    await page.getByLabel('Current decisions', { exact: true }).fill('Use Supabase; Firebase was rejected.');
    await page.getByLabel('Next action', { exact: true }).fill('Debug the contact form.');
    await page.getByLabel('Pin message 2', { exact: true }).check();
    await page.getByText('Full transfer preview', { exact: true }).click();
    const preview = await page.getByLabel('Full transfer preview', { exact: true }).inputValue();
    assert.ok(preview.includes(code));
    assert.ok(preview.includes('Use Supabase; Firebase was rejected.'));
    await page.screenshot({ path: path.join(artifacts, 'transfer-preview.png') });
    await page.locator('.bridge-memory-body').evaluate(el => { el.scrollTop = 0; });
    await page.screenshot({ path: path.join(artifacts, 'memory-editor-desktop.png') });
    await page.getByRole('button', { name: 'Save memory', exact: true }).click();
    await page.getByText('Project memory saved on this device.', { exact: true }).waitFor();

    // Oversized protected material must block transfer without losing the draft.
    await page.getByLabel('Exact working material', { exact: true }).fill('x'.repeat(65000));
    await page.getByText('Your protected material exceeds this budget.', { exact: false }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Continue in Claude', exact: true }).isDisabled(), true);
    await page.getByLabel('Exact working material', { exact: true }).fill('');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.bridge-memory-body').evaluate(el => { el.scrollTop = 0; });
    await page.screenshot({ path: path.join(artifacts, 'memory-editor-mobile.png') });
    assert.equal(await page.getByRole('dialog').evaluate(el => el.scrollWidth <= el.clientWidth), true);
    await page.setViewportSize({ width: 1280, height: 800 });

    const newPage = context.waitForEvent('page');
    await page.getByRole('button', { name: 'Continue in Claude', exact: true }).click();
    const destination = await newPage;
    await destination.waitForURL('https://claude.ai/');
    // The context is inserted into the destination's chat box automatically, and never sent.
    await destination.getByText('Inserted into the chat box. Review it, then press send.', { exact: true }).waitFor();
    const composer = await destination.locator('[data-testid="prompt-input"]').textContent();
    // The hidden placeholder that loaded first must stay empty: the text waited for the real composer.
    assert.equal(await destination.locator('textarea').inputValue(), '');
    assert.ok(composer.replace(/\s+/g, '').includes(code.replace(/\s+/g, '')));
    assert.ok(composer.includes('Use Supabase; Firebase was rejected.'));

    const unrelated = await context.newPage();
    await unrelated.goto('https://claude.ai/chat/unrelated');
    await unrelated.getByRole('button', { name: 'Transfer · Keep context' }).waitFor();
    assert.equal(await unrelated.getByLabel('Incoming context', { exact: true }).count(), 0);
    assert.equal(await unrelated.getByText('Your project context is', { exact: false }).count(), 0);

    // Load earlier messages: this fixture lazily adds older turns when scrolled to the top.
    await unrelated.evaluate(() => {
        document.body.insertAdjacentHTML('beforeend', '<div style="height:3000px"></div>');
        window.scrollTo(0, document.body.scrollHeight);
        let left = 2;
        window.addEventListener('scroll', () => {
            if (window.scrollY !== 0 || left === 0) return;
            left--;
            document.querySelector('h1').insertAdjacentHTML('afterend', `<div data-testid="user-message">Older message ${left}</div><div style="height:600px"></div>`);
            window.scrollTo(0, 400);
        });
    });
    await unrelated.getByRole('button', { name: 'Transfer · Keep context' }).click();
    await unrelated.getByRole('button', { name: 'Load earlier messages', exact: true }).click();
    await unrelated.getByText('Loaded 2 earlier messages.', { exact: true }).waitFor({ timeout: 30000 });
    assert.ok((await unrelated.locator('.bridge-messages summary').first().textContent()).includes('Older message 0'));
    await unrelated.getByText('Full transfer preview', { exact: true }).click();
    assert.ok((await unrelated.getByLabel('Full transfer preview', { exact: true }).inputValue())
        .includes('ORIGINAL REQUEST\n[user; Claude; message 1; https://claude.ai/chat/unrelated]\nOlder message 0'));

    // Draft the brief with the current AI: the request goes into the chat box, the reply fills the fields.
    await unrelated.getByRole('button', { name: 'Ask Claude to draft it', exact: true }).click();
    await unrelated.getByText('The brief request is in the chat box.', { exact: false }).waitFor();
    const request = await unrelated.locator('[data-testid="prompt-input"]').evaluate(el => el.innerText);
    assert.ok(request.startsWith('[BridgeAI brief request]'));
    await unrelated.evaluate(sent => {
        document.querySelector('[data-testid="prompt-input"]').innerHTML = '';
        const user = document.createElement('div'); user.dataset.testid = 'user-message'; user.textContent = sent;
        const reply = document.createElement('div'); reply.dataset.testid = 'assistant-message';
        reply.innerHTML = '<p>[BRIDGEAI:NAME]<br>Portfolio redesign</p><p>[BRIDGEAI:GOAL]<br>Relaunch the site.</p>' +
            '<p>[BRIDGEAI:DECISIONS]</p><ul><li>Use Astro</li><li>Drop Firebase</li></ul><p>[BRIDGEAI:NEXT]<br>Write the about page.</p><p>[BRIDGEAI:END]</p>';
        document.body.append(user, reply);
    }, request);
    await unrelated.getByRole('button', { name: 'Fill brief', exact: true }).click();
    await unrelated.getByText('Filled 4 fields from Claude’s reply.', { exact: false }).waitFor();
    assert.equal(await unrelated.getByLabel('Project name', { exact: true }).inputValue(), 'Portfolio redesign');
    assert.equal(await unrelated.getByLabel('Goal', { exact: true }).inputValue(), 'Relaunch the site.');
    const decisions = await unrelated.getByLabel('Current decisions', { exact: true }).inputValue();
    assert.ok(decisions.includes('- Use Astro') && decisions.includes('- Drop Firebase'));
    await unrelated.getByText('Full transfer preview', { exact: true }).click();
    const drafted = await unrelated.getByLabel('Full transfer preview', { exact: true }).inputValue();
    assert.ok(drafted.includes('Write the about page.'));
    assert.ok(!drafted.includes('[BRIDGEAI:') && !drafted.includes('[BridgeAI brief request]'));
    await unrelated.getByRole('button', { name: 'Undo fill', exact: true }).click();
    assert.equal(await unrelated.getByLabel('Goal', { exact: true }).inputValue(), '');
    unrelated.once('dialog', dialog => dialog.accept());
    await unrelated.getByRole('button', { name: 'Close project memory', exact: true }).click();

    // When the reply on the page can't be read, the user can paste it instead.
    await unrelated.getByRole('button', { name: 'Transfer · Keep context' }).click();
    await unrelated.getByRole('button', { name: 'Ask Claude to draft it', exact: true }).click();
    await unrelated.getByRole('button', { name: 'Fill brief', exact: true }).click();
    // The new request hasn't been sent, so the earlier reply on the page must not be reused.
    await unrelated.getByText('The brief request hasn’t been sent yet.', { exact: false }).waitFor();
    await unrelated.getByLabel('Pasted brief reply', { exact: true }).fill('**[BRIDGEAI:GOAL]**\nPasted goal.\n**[BRIDGEAI:NEXT]**\nPasted next step.');
    await unrelated.getByRole('button', { name: 'Fill from pasted reply', exact: true }).click();
    assert.equal(await unrelated.getByLabel('Goal', { exact: true }).inputValue(), 'Pasted goal.');
    assert.equal(await unrelated.getByLabel('Next action', { exact: true }).inputValue(), 'Pasted next step.');
    unrelated.once('dialog', dialog => dialog.accept());
    await unrelated.getByRole('button', { name: 'Close project memory', exact: true }).click();

    // Continue with the saved project: exact pins and original request survive.
    await destination.getByRole('button', { name: 'Transfer · Keep context' }).click();
    assert.equal(await destination.getByLabel('Project name', { exact: true }).inputValue(), 'Portfolio');
    await destination.getByLabel('Progress & open questions', { exact: true }).fill('The form is now fixed.');
    await destination.getByLabel('Next action', { exact: true }).fill('Test mobile layout.');
    await destination.getByText('Full transfer preview', { exact: true }).click();
    const second = await destination.getByLabel('Full transfer preview', { exact: true }).inputValue();
    assert.ok(second.includes(code));
    assert.ok(second.includes('Build a free portfolio. Keep it mobile friendly.'));
    assert.ok(second.includes('Test mobile layout.'));
    await destination.getByRole('button', { name: 'Save memory', exact: true }).click();
    await destination.getByText('Project memory saved on this device.', { exact: true }).waitFor();
    await destination.getByRole('button', { name: 'Close project memory', exact: true }).click();
    await destination.getByRole('button', { name: 'Transfer · Keep context' }).click();
    await destination.getByLabel('Project', { exact: true }).selectOption({ label: 'Portfolio' });
    assert.equal(await destination.getByLabel('Next action', { exact: true }).inputValue(), 'Test mobile layout.');
    destination.once('dialog', dialog => dialog.accept());
    await destination.getByRole('button', { name: 'Delete saved project', exact: true }).click();
    await destination.getByText('Saved project deleted.', { exact: true }).waitFor();
    assert.equal(await destination.getByLabel('Project', { exact: true }).locator('option').count(), 1);
    // ChatGPT: the brief request goes into the visible editor, not the hidden fallback textarea.
    const chat = await context.newPage();
    await chat.goto('https://chatgpt.com/c/second');
    await chat.getByRole('button', { name: 'Transfer · Keep context' }).click();
    await chat.getByRole('button', { name: 'Ask ChatGPT to draft it', exact: true }).click();
    await chat.getByText('The brief request is in the chat box.', { exact: false }).waitFor();
    assert.ok((await chat.locator('.ProseMirror').textContent()).startsWith('[BridgeAI brief request]'));
    assert.equal(await chat.locator('textarea[name="prompt-textarea"]').inputValue(), '');

    // Guessed speakers must be confirmed before transferring.
    const guessed = await context.newPage();
    await guessed.goto('https://claude.ai/chat/guessed');
    await guessed.getByRole('button', { name: 'Transfer · Keep context' }).click();
    await guessed.getByLabel('Project name', { exact: true }).fill('Guessed');
    await guessed.getByLabel('Goal', { exact: true }).fill('Check speakers');
    const toChatGPT = guessed.getByRole('button', { name: 'Continue in ChatGPT', exact: true });
    assert.equal(await toChatGPT.isDisabled(), true);
    await guessed.getByLabel('I checked the speaker labels').check();
    assert.equal(await toChatGPT.isDisabled(), false);

    // A redesigned page is flagged by the self-check and offers a prefilled problem report.
    const broken = await context.newPage();
    await broken.goto('https://claude.ai/chat/redesigned');
    await broken.waitForSelector('#bridge-ai-root[data-bridgeai-status="problem"][data-bridgeai-chat-box="missing"]', { state: 'attached', timeout: 45000 });
    await broken.getByRole('button', { name: 'Transfer · Keep context' }).click();
    const report = new URL(await broken.getByRole('link', { name: 'Report a problem' }).getAttribute('href'));
    assert.equal(report.pathname, '/Anujsuthar004/Bridge-ai/issues/new');
    assert.equal(report.searchParams.get('title'), 'Claude: Chat box not found');
    assert.ok(report.searchParams.get('body').includes('No messages found on a conversation page'));

    assert.deepEqual(errors, []);
    console.log('Browser checks passed: actual MV3 extension, editor, full-code pinning, save/reopen/delete, oversize block, mobile layout, targeted transfer with auto-insert, load earlier messages, AI-drafted brief with undo, second-platform memory, self-check and problem report, waiting for a slow composer, confirming guessed speakers.');
} catch (error) {
    for (const [i, page] of context.pages().entries()) await page.screenshot({ path: path.join(artifacts, `failure-${i}.png`) }).catch(() => {});
    throw error;
} finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
}
