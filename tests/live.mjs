// Live check against the real Gemini site (the only one that loads for an automated, signed-out
// browser; ChatGPT and Claude show a bot check). Confirms BridgeAI finds the chat box and can put
// text in it. Nothing is ever sent.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const extension = path.resolve('build/chrome-mv3-prod');
const profile = await mkdtemp(path.join(tmpdir(), 'bridgeai-live-'));
const artifacts = process.env.BRIDGEAI_TEST_OUTPUT || path.resolve('test-results');
await mkdir(artifacts, { recursive: true });
const context = await chromium.launchPersistentContext(profile, {
    headless: true, channel: 'chromium', viewport: { width: 1280, height: 800 }, locale: 'en-US',
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
});
const page = await context.newPage();
try {
    await page.goto('https://gemini.google.com/app', { waitUntil: 'domcontentloaded' });
    assert.equal(new URL(page.url()).hostname, 'gemini.google.com', `Gemini redirected to ${page.url()}`);
    await page.getByRole('button', { name: 'Transfer · Keep context' }).waitFor({ timeout: 30000 });
    const root = page.locator('#bridge-ai-root[data-bridgeai-status]');
    await root.waitFor({ state: 'attached', timeout: 45000 });
    assert.equal(await root.getAttribute('data-bridgeai-chat-box'), 'found', 'BridgeAI could not find Gemini’s chat box');

    // Insert a brief request into the real editor, check it arrived, then clear it. Never send.
    await page.getByRole('button', { name: 'Transfer · Keep context' }).click();
    await page.getByRole('button', { name: 'Ask Gemini to draft it', exact: true }).click();
    await page.getByText('The brief request is in the chat box.', { exact: false }).waitFor({ timeout: 15000 });
    const editor = page.locator('rich-textarea .ql-editor').first();
    assert.ok((await editor.innerText()).trim().startsWith('[BridgeAI brief request]'), 'text did not reach Gemini’s chat box');
    await page.screenshot({ path: path.join(artifacts, 'live-gemini.png') });
    const text = await editor.innerText();
    assert.equal(text.split('[BridgeAI brief request]').length - 1, 1, 'the request was inserted more than once');
    // Clear the box the way a user would.
    await editor.click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.press('Delete');
    assert.equal((await editor.innerText()).trim(), '', 'chat box was not cleared');
    console.log('Live check passed: Gemini chat box found and accepts inserted text.');
} catch (error) {
    await page.screenshot({ path: path.join(artifacts, 'live-gemini-failure.png') }).catch(() => {});
    throw error;
} finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
}
