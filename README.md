# 🌉 BridgeAI

**Cross-platform context transfer for AI chatbots**

Transfer your conversations between ChatGPT, Claude, and Gemini with one click.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?logo=typescript)

---

## ✨ Features

- **One-Click Transfer** - Move conversations between AI platforms instantly
- **Smart Context Extraction** - Captures the last 10 messages with proper formatting
- **Cross-Platform Support** - Works with ChatGPT, Claude, and Gemini
- **Privacy First** - All processing happens locally in your browser
- **Auto-Cleanup** - Transferred data expires after 5 minutes

## 🎯 Supported Platforms

| Platform | URL | Status |
|----------|-----|--------|
| ChatGPT | chat.openai.com, chatgpt.com | ✅ |
| Claude | claude.ai | ✅ |
| Gemini | gemini.google.com | ✅ |

---

## 🚀 Installation

### From Source

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

1. Open any conversation on ChatGPT, Claude, or Gemini
2. Click the **Transfer** button (bottom-right corner)
3. Select your destination platform
4. Press **⌘+V** (Mac) or **Ctrl+V** (Windows) to paste
5. Send your message!

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
```

---

## 🔒 Privacy

- **No data collection** - Your conversations never leave your browser
- **No external servers** - All processing is local
- **Minimal permissions** - Only requests necessary Chrome APIs

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🤝 Contributing

Contributions welcome! Please open an issue or submit a PR.

---

<p align="center">Made with ❤️ for the AI-powered future</p>
