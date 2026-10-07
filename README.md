# 🌉 BridgeAI

**Switch AI. Keep your progress.**

Carry a reviewed project brief, pinned messages, and exact working material between ChatGPT, Claude, and Gemini—even when your current AI has hit its limit.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?logo=typescript)

---

## ✨ Features

- **Portable project memory** — edit your goal, requirements, current decisions, progress, and next action.
- **Exact working material** — carry code, drafts, calculations, and errors without a per-message cutoff.
- **Pinned evidence** — preserve full messages with their platform, conversation link, and message number.
- **Review before transferring** — preview the exact prompt and see which recent messages will not fit.
- **Whole-message budgets** — choose 12,000, 24,000, or 60,000 characters. Protected material is never silently shortened; transfers block if it exceeds the budget.
- **Local and API-free** — saved projects remain in this browser until you delete them. Pending transfers expire after five minutes.

---

## 🎯 Supported Platforms

| Platform | URL | Status |
|----------|-----|--------|
| ChatGPT | chat.openai.com, chatgpt.com | ✅ |
| Claude | claude.ai | ✅ |
| Gemini | gemini.google.com | ✅ |

---

## 🚀 Installation

### From Source

Use Node.js 22.13+ (or a current Node.js 24+ release) for the development and test toolchain.

1. **Clone the repository**
   ```bash
   git clone https://github.com/Anujsuthar004/Bridge-ai.git
   cd Bridge-ai
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the extension**
   ```bash
   npm run build
   ```

4. **Load in Chrome**
   - Open `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `build/chrome-mv3-prod` folder

---

## 🎮 Usage

1. Open a conversation and click **Transfer · Keep context**.
2. Start a project or explicitly select a saved one. Update its brief and replace decisions that are no longer current.
3. Pin important messages and paste any exact working material. The first user request is included by default; you can remove it.
4. Review the full transfer preview and any omission notice. Increase the budget or pin an omitted message if it matters.
5. Click **Continue in Claude / Gemini / ChatGPT**. The project is saved locally before opening the destination.
6. In the destination tab, click **Copy context**, paste, review, and send. A selectable text fallback is available if clipboard access fails.
7. For the next switch, select the same saved project and update its progress. Its original request and pins remain intact. Previous handoff envelopes for that project are excluded from recent history to prevent nesting.

**Save memory** persists edits without transferring. **Copy context** saves the project and copies the handoff without opening a tab. **Delete saved project** removes that project's saved memory; it cannot retract text already pasted into another service.

### Capture limitations

Only text present in the page DOM is captured. Scroll/load older conversation messages before opening the editor if they are needed. Images, attached files, hidden messages, and provider-side memory are not transferred. Re-upload files at the destination. Platform DOM changes can require adapter updates.

Project memory is explicitly edited by the user; this release does not automatically infer decisions or perform AI summarization. Selected code retains its captured whitespace, but this is not a byte-for-byte export of original uploaded files. Budgets measure JavaScript string length, not tokens or provider quotas.

---

## 🏗️ Tech Stack

- **Framework**: [Plasmo](https://plasmo.com) - Chrome extension framework
- **UI**: React 18 + TypeScript
- **Styling**: Tailwind CSS
- **Storage**: Chrome Local Storage API

---

## 📁 Project Structure

```
bridge-ai/
├── adapters/           # Platform-specific adapters
│   ├── ChatGPTAdapter.ts
│   ├── ClaudeAdapter.ts
│   └── GeminiAdapter.ts
├── contents/           # Content scripts
│   └── transfer-ui.tsx
├── lib/                # Utilities
│   ├── contextEngine.ts
│   └── storage.ts
├── background.ts       # Service worker
├── popup.tsx           # Extension popup
└── style.css           # Global styles
```

---

## 🛠️ Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Package for distribution
npm run package

# Test context retention, DOM extraction, and storage
npm test
npm run typecheck

# Browser checks against controlled platform fixtures (after building)
npx playwright install chromium
npm run test:browser
```

---

## 🔒 Privacy

- **No BridgeAI backend** - No conversations are sent to a BridgeAI server. When you submit a handoff, the destination AI receives that text.
- **No external servers** - All processing is local
- **Scoped permissions** - Host access is limited to the supported AI sites.

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🤝 Contributing

Contributions welcome! Please open an issue or submit a PR.

---

<p align="center">Made with ❤️ for the AI-powered future</p>
