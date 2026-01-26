# BridgeAI - Technical Deep Dive

## Interview Explanation Guide

---

## 🎯 The Problem

When working with multiple AI assistants (ChatGPT, Claude, Gemini), users often want to:
- Get a second opinion from another AI
- Continue a conversation on a different platform
- Compare responses across different models

**The pain point:** Manually copy-pasting conversation context is tedious and loses formatting/structure.

---

## 💡 The Solution

**BridgeAI** - A Chrome extension that transfers conversation context between AI platforms with one click.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Chrome Extension                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Content    │    │  Background  │    │    Popup     │  │
│  │   Script     │    │   Service    │    │     UI       │  │
│  │              │    │   Worker     │    │              │  │
│  └──────┬───────┘    └──────┬───────┘    └──────────────┘  │
│         │                   │                               │
│         │    Messages       │                               │
│         ├───────────────────┤                               │
│         │                   │                               │
│  ┌──────▼───────┐    ┌──────▼───────┐                      │
│  │   Adapters   │    │   Storage    │                      │
│  │ (ChatGPT,    │    │   (Chrome    │                      │
│  │  Claude,     │    │    Local)    │                      │
│  │  Gemini)     │    │              │                      │
│  └──────────────┘    └──────────────┘                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
bridge-ai/
├── adapters/                 # Platform-specific logic
│   ├── types.ts              # Shared interfaces
│   ├── index.ts              # Adapter factory
│   ├── ChatGPTAdapter.ts     # ChatGPT scraping/injection
│   ├── ClaudeAdapter.ts      # Claude scraping/injection
│   └── GeminiAdapter.ts      # Gemini scraping/injection
├── contents/
│   └── transfer-ui.tsx       # Content script (React UI)
├── lib/
│   ├── contextEngine.ts      # Prompt formatting
│   └── storage.ts            # Chrome storage helpers
├── background.ts             # Service worker
├── popup.tsx                 # Extension popup
├── style.css                 # Tailwind styles
└── package.json              # Plasmo config
```

---

## 🔧 Key Components Explained

### 1. Adapter Pattern

We used the **Adapter Pattern** to handle platform differences:

```typescript
interface AIAdapter {
    readonly platformName: string;
    readonly platformId: string;
    readonly newChatUrl: string;
    
    isDetected(): boolean;           // Am I on this platform?
    scrapeMessages(): Message[];     // Get conversation
    injectPrompt(text: string): Promise<boolean>;  // Paste text
    waitForReady(): Promise<boolean>; // Wait for DOM
}
```

**Why this pattern?**
- Each AI platform has different DOM structure
- Easy to add new platforms without changing core logic
- Single interface for content script to work with

### 2. Content Script (transfer-ui.tsx)

The content script runs on every AI platform page and:
- Detects which platform we're on
- Renders the floating "Transfer" button
- Handles scraping and destination selection
- Injects transferred context on destination

**Key React hooks used:**
```typescript
const [adapter, setAdapter] = useState<AIAdapter | null>(null);
const [isOverlayOpen, setIsOverlayOpen] = useState(false);
const [toast, setToast] = useState<ToastState | null>(null);
```

### 3. Background Service Worker (background.ts)

The service worker:
- Opens new tabs for destination platforms
- Manages cross-tab communication via `chrome.runtime.onMessage`
- Cleans up old payloads (5-minute expiry)

```typescript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'OPEN_DESTINATION_TAB') {
        handleOpenDestinationTab(message.destinationPlatform, sendResponse);
        return true; // Keep channel open for async
    }
});
```

### 4. Message Scraping

Each adapter has platform-specific selectors:

**ChatGPT:**
```typescript
messageContainer: '[data-message-author-role]'
// Extracts role from data-message-author-role="user" or "assistant"
```

**Claude:**
```typescript
userMessage: '[data-testid="user-message"], [data-is-human-message="true"]'
assistantMessage: '[data-testid="assistant-message"]'
// Uses multiple fallback strategies
```

**Gemini:**
```typescript
userMessage: 'user-query, .user-message'
assistantMessage: 'model-response, .model-message'
```

### 5. Context Engine (contextEngine.ts)

Formats scraped messages into a structured prompt:

```typescript
function buildTransferPrompt(messages: Message[], sourcePlatform: string): string {
    return `[System Transfer]
Context: Previous conversation from ${sourcePlatform}
---
${messages.map(m => `[${m.role}]: ${m.content}`).join('\n\n')}
---
[End of context. Please continue.]`;
}
```

---

## 🚧 Challenges & Solutions

### Challenge 1: DOM Injection Doesn't Trigger Send Button

**Problem:** Setting input.value or innerHTML doesn't update React state, so AI platforms don't recognize the text (send button doesn't appear).

**Solutions tried:**
1. Native value setter pattern ❌
2. ClipboardEvent simulation ❌
3. execCommand('insertText') ❌

**Final solution:** Clipboard-based approach
```typescript
await navigator.clipboard.writeText(text);
input.focus();
// User presses Cmd+V to paste
```

Modern AI platforms intentionally prevent programmatic input for security. The clipboard approach is standard (same as password managers).

### Challenge 2: Different DOM Structures

**Problem:** Each platform uses different selectors, and they change over time.

**Solution:** Multiple fallback selectors + debug logging:
```typescript
// Strategy 1: Specific selectors
const userMessages = document.querySelectorAll('[data-testid="user-message"]');

// Strategy 2: Broader selectors
if (userMessages.length === 0) {
    userMessages = document.querySelectorAll('[data-is-human-message="true"]');
}

// Strategy 3: Fallback to common patterns
if (userMessages.length === 0) {
    userMessages = document.querySelectorAll('.prose');
}
```

### Challenge 3: Tab Opening Race Condition

**Problem:** Content script needed to wait for destination tab to fully load before injecting.

**Solution:** MutationObserver with timeout:
```typescript
async waitForReady(): Promise<boolean> {
    return new Promise((resolve) => {
        if (this.getInputElement()) {
            resolve(true);
            return;
        }
        
        const observer = new MutationObserver(() => {
            if (this.getInputElement()) {
                observer.disconnect();
                resolve(true);
            }
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => { observer.disconnect(); resolve(false); }, 10000);
    });
}
```

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **Plasmo** | Chrome extension framework (handles manifest, bundling) |
| **React 18** | UI components |
| **TypeScript** | Type safety |
| **Tailwind CSS** | Styling with custom design tokens |
| **Chrome APIs** | tabs, storage, runtime messaging |

---

## 📊 Data Flow

```
1. User clicks "Transfer" on ChatGPT
           ↓
2. ChatGPTAdapter.scrapeMessages() extracts messages
           ↓
3. contextEngine.buildTransferPrompt() formats text
           ↓
4. storage.saveContextPayload() stores in chrome.storage.local
           ↓
5. background.ts opens new Claude tab
           ↓
6. Claude tab loads, content script detects pending payload
           ↓
7. ClaudeAdapter.injectPrompt() copies to clipboard + focuses input
           ↓
8. User presses Cmd+V → text pastes → send button appears
```

---

## 🔒 Privacy & Security

- **No external servers** - All processing is local
- **No data collection** - Extension doesn't phone home
- **Auto-cleanup** - Payloads deleted after 5 minutes
- **Minimal permissions** - Only storage, tabs, clipboard

---

## 🎓 Key Learnings

1. **Modern web apps prevent programmatic input** - For security, React/Vue apps ignore synthetic events
2. **Adapter pattern scales well** - Easy to add new platforms
3. **Chrome extension APIs are async** - Use message passing properly
4. **DOM selectors change** - Always have fallbacks
5. **User feedback matters** - Clear toast messages guide users

---

## 📈 Future Improvements

- Support for more platforms (Perplexity, Copilot)
- Keyboard shortcuts
- History of transfers
- Option to auto-send after paste
