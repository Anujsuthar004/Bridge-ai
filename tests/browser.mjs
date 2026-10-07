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
    headless: true, channel: 'chromium', viewport: { width: 1360, height: 1000 },
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
});
const errors = [];
context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
const code = 'function contact() {\n  return "exact working code";\n\n}\n';
const fixtures = {
    'chatgpt.com': `<div data-message-author-role="user">Build a free portfolio. Keep it mobile friendly.</div><div data-message-author-role="assistant"><pre><code>${code}</code></pre></div><div data-message-author-role="user">Debug the contact form next.</div><textarea id="prompt-textarea"></textarea>`,
    'claude.ai': '<div data-testid="user-message">Continue my portfolio</div><div data-testid="assistant-message">The contact form is fixed.</div><div contenteditable="true" data-testid="prompt-input"></div>',
    'gemini.google.com': '<user-query>Continue my portfolio</user-query><model-response>The form is tested.</model-response><div class="ql-editor" contenteditable="true"></div>',
};
await context.route('https://**/*', route => {
    const host = new URL(route.request().url()).hostname;
    return route.fulfill({contentType: 'text/html', body: `<html><head><title>BridgeAI test fixture</title></head><body style="background:#eef2f7;padding:40px;font-family:system-ui"><h1>Conversation fixture</h1>${fixtures[host] || ''}</body></html>`});
});
try {
    const page = await context.newPage();
    await page.goto('https://chatgpt.com/c/bridgeai-test');
    await page.getByRole('button', { name: 'Transfer · Keep context' }).click();
    await page.getByLabel('Project name', { exact: true }).fill('Portfolio');
    await page.getByLabel('Goal', { exact: true }).fill('Finish my internship portfolio');
    await page.getByLabel('Current decisions', { exact: true }).fill('Use Supabase; Firebase was rejected.');
    await page.getByLabel('Next action', { exact: true }).fill('Debug the contact form.');
    await page.getByLabel('Pin message 2', { exact: true }).check();
    await page.getByText('Full transfer preview', { exact: true }).click();
    const preview = await page.getByLabel('Full transfer preview', { exact: true }).inputValue();
    assert.ok(preview.includes(code));
    assert.ok(preview.includes('Use Supabase; Firebase was rejected.'));
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
    await page.setViewportSize({ width: 1360, height: 1000 });

    const newPage = context.waitForEvent('page');
    await page.getByRole('button', { name: 'Continue in Claude', exact: true }).click();
    const destination = await newPage;
    await destination.waitForURL('https://claude.ai/');
    const incoming = destination.getByLabel('Incoming context', { exact: true });
    await incoming.waitFor();
    assert.ok((await incoming.inputValue()).includes(code));
    assert.ok((await incoming.inputValue()).includes('Use Supabase; Firebase was rejected.'));

    const unrelated = await context.newPage();
    await unrelated.goto('https://claude.ai/chat/unrelated');
    await unrelated.getByRole('button', { name: 'Transfer · Keep context' }).waitFor();
    assert.equal(await unrelated.getByLabel('Incoming context', { exact: true }).count(), 0);

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
    assert.deepEqual(errors, []);
    console.log('Browser checks passed: actual MV3 extension, editor, full-code pinning, save/reopen/delete, oversize block, mobile layout, targeted transfer, second-platform memory.');
} catch (error) {
    for (const [i, page] of context.pages().entries()) await page.screenshot({ path: path.join(artifacts, `failure-${i}.png`) }).catch(() => {});
    throw error;
} finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
}
