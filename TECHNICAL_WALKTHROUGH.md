# BridgeAI - Technical Deep Dive

## A Beginner-Friendly Guide to How It Works

---

## 🎯 What's the Big Picture?

Imagine you're chatting with ChatGPT about a coding problem. You've shared a lot of context – your code, error messages, explanations. Now you want a "second opinion" from Claude or Gemini.

**The annoying way:** Manually copy-paste everything, lose formatting, spend 5 minutes setting up the new AI.

**BridgeAI's way:** Click one button → your conversation transfers instantly → continue chatting on the new AI.

---

## 🏗️ Architecture: The 3 Main Parts

Think of a Chrome extension like a mini-application with **3 separate "workers"** that talk to each other:

```
┌──────────────────────────────────────────────────────────────┐
│                     YOUR BROWSER                              │
│                                                               │
│  1. CONTENT SCRIPT    2. BACKGROUND WORKER    3. POPUP UI    │
│  (Lives on the        (Lives in the           (The little    │
│   webpage itself)      background, always      menu when you │
│                        running)                click the icon)│
└──────────────────────────────────────────────────────────────┘
```

### 1️⃣ Content Script (`transfer-ui.tsx`)

- **What it is:** Code that gets **injected into the actual webpage** (like ChatGPT's page)
- **What it does:** 
  - Shows the floating "Transfer" button you see on the page
  - Reads (scrapes) the conversation from the page
  - On the destination, pastes the transferred text
- **Analogy:** It's like a spy that lives inside the ChatGPT webpage, watching what's happening and able to interact with it

### 2️⃣ Background Service Worker (`background.ts`)

- **What it is:** Code that runs **behind the scenes**, even when you're not looking at the extension
- **What it does:**
  - Opens new browser tabs (when you pick Claude as destination)
  - Manages communication between different tabs
  - Cleans up old data after 5 minutes
- **Analogy:** It's like a backstage manager coordinating everything

### 3️⃣ Popup UI (`popup.tsx`)

- **What it is:** The small window that appears when you **click the extension icon** in your toolbar
- **What it does:** Shows status, settings, help info
- **Analogy:** The reception desk of your extension

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

## 🔌 The Adapter Pattern (The Clever Part)

### The Problem

ChatGPT, Claude, and Gemini all have **completely different website structures**. The HTML/CSS is different. Finding where messages are stored requires different code for each.

### The Solution: Adapters

An **adapter** is like a universal power plug converter. You have one standard plug (your extension), and adapters translate it to work with different outlets (AI platforms).

```typescript
interface AIAdapter {
    platformName: string;           // "ChatGPT", "Claude", etc.
    isDetected(): boolean;          // "Am I on this website?"
    scrapeMessages(): Message[];    // "Read all the chat messages"
    injectPrompt(text: string): Promise<boolean>;  // "Paste this text"
}
```

**In plain English:**
- **`isDetected()`** → Checks if you're on ChatGPT, Claude, or Gemini
- **`scrapeMessages()`** → Goes through the webpage and collects all messages (who said what)
- **`injectPrompt()`** → Puts text into the input box on the destination platform

**Why is this smart?**
- To add a new platform (like Perplexity), you just create ONE new adapter file
- The rest of the extension stays the same
- Each adapter handles its platform's quirks independently

---

## 🔍 Message Scraping: How Does It Read Chats?

### What is "Scraping"?

**Web scraping** = Reading data from a webpage by looking at its HTML structure.

When you see a ChatGPT conversation, your browser actually has HTML like this:

```html
<div data-message-author-role="user">
    Hey, can you help me with Python?
</div>
<div data-message-author-role="assistant">
    Of course! What do you need help with?
</div>
```

The scraper finds these elements and extracts:
- **Role:** Who said it (user or AI)
- **Content:** The actual text

### Different Platforms, Different HTML

| Platform | How to find user messages | How to find AI messages |
|----------|---------------------------|-------------------------|
| ChatGPT | `data-message-author-role="user"` | `data-message-author-role="assistant"` |
| Claude | `data-testid="user-message"` | `data-testid="assistant-message"` |
| Gemini | `user-query` element | `model-response` element |

This is why we need **different adapters** – they know where to look on each platform.

---

## 📦 Chrome Storage: Temporary Memory

### The Problem

You click "Transfer" on ChatGPT → Opens Claude in new tab.
**But how does the Claude tab know what text to paste?**

Tabs can't directly talk to each other!

### The Solution: Chrome Storage

Think of it like a **shared notepad** that all parts of the extension can read/write:

1. **ChatGPT tab writes:** "Here's the conversation to transfer" → saves to storage
2. **Claude tab reads:** "Oh, there's a pending transfer!" → grabs the text
3. **Auto-cleanup:** After 5 minutes, old data is deleted (privacy!)

```typescript
// Writing to storage
await chrome.storage.local.set({ 
    pendingTransfer: { 
        text: "The conversation...", 
        timestamp: Date.now() 
    } 
});

// Reading from storage
const data = await chrome.storage.local.get('pendingTransfer');
```

---

## 🚧 The Biggest Challenge: Why Can't We Just "Paste" Text?

### The Expectation

You'd think: "Just put text in the input box using JavaScript!"

```javascript
document.querySelector('textarea').value = "Hello!";
```

### The Reality

**This doesn't work on modern AI sites!** 

Here's why: ChatGPT/Claude/Gemini are built with **React**, a framework that manages its own internal state. When you change `input.value` directly, React doesn't know about it. So:
- The text appears in the box
- But the "Send" button stays disabled
- React thinks the input is still empty!

### Why Do They Block This?

**Security.** Imagine malicious scripts that could:
- Type things in your AI chat without you knowing
- Submit prompts automatically
- Steal your conversation

So these platforms intentionally ignore JavaScript-injected text.

### The Solution: Clipboard Approach

Instead of injecting text directly, BridgeAI:
1. Copies the text to your **clipboard** (like pressing Cmd+C)
2. Focuses on the input box
3. Shows a toast: "Press Cmd+V to paste!"
4. **You** press Cmd+V → Text pastes properly → Send button appears

This works because **you** are performing the action, not a script. It's the same approach password managers use!

```typescript
await navigator.clipboard.writeText(transferText);
input.focus();
showToast("Press Cmd+V to paste!");
```

---

## 👀 MutationObserver: Waiting for Pages to Load

### The Problem

When you open a new tab (say, Claude), the page doesn't load instantly. The extension needs to **wait** until:
1. The page is loaded
2. The input box actually exists in the HTML

### What is MutationObserver?

It's a browser feature that **watches for changes** in the webpage. Like a security camera for the HTML.

```typescript
const observer = new MutationObserver(() => {
    // This runs every time ANYTHING on the page changes
    if (document.querySelector('.input-box')) {
        // Input box appeared! We can proceed now.
        observer.disconnect(); // Stop watching
    }
});

// Start watching the whole page
observer.observe(document.body, { childList: true, subtree: true });
```

**In plain English:**
> "Hey browser, watch this page. The moment you see an input box appear, tell me!"

The extension adds a 10-second timeout – if the input never appears, it gives up gracefully instead of waiting forever.

---

## 📊 The Complete Data Flow

Here's what happens step-by-step when you transfer from ChatGPT to Claude:

```
1️⃣ You click "Transfer" button on ChatGPT
            ↓
2️⃣ ChatGPTAdapter.scrapeMessages() reads all messages from the page
            ↓
3️⃣ contextEngine.buildTransferPrompt() formats them nicely:
            
   [System Transfer]
   Context: Previous conversation from ChatGPT
   ---
   [user]: Can you help me with Python?
   [assistant]: Of course! What do you need?
   ---
   [End of context. Please continue.]
            ↓
4️⃣ Text is saved to chrome.storage.local
            ↓
5️⃣ Background worker opens new Claude tab
            ↓
6️⃣ Claude loads → Content script wakes up → Sees pending transfer
            ↓
7️⃣ ClaudeAdapter copies text to clipboard + focuses input
            ↓
8️⃣ Toast appears: "Press Cmd+V to paste!"
            ↓
9️⃣ You paste → Send button appears → You send → Done! 🎉
```

---

## 🛠️ Tech Stack Explained

| Technology | What It Is | Why BridgeAI Uses It |
|------------|-----------|---------------------|
| **Plasmo** | A framework for building Chrome extensions | Handles all the boring setup (manifest files, bundling, hot-reload) |
| **React** | UI library | Makes it easy to build the transfer button, overlay, toasts |
| **TypeScript** | JavaScript with types | Catches bugs before runtime (like spell-check for code) |
| **Tailwind CSS** | Utility CSS framework | Quick styling without writing custom CSS files |
| **Chrome APIs** | Browser-provided functions | `chrome.tabs`, `chrome.storage`, `chrome.runtime` for tab management and data storage |

---

## 🔐 Privacy & Security

| Concern | How BridgeAI Handles It |
|---------|------------------------|
| "Does it send my chats to a server?" | **No.** Everything runs 100% locally in your browser |
| "Is my data stored permanently?" | **No.** Auto-deleted after 5 minutes |
| "What permissions does it need?" | Only: storage, tabs, clipboard (the minimum needed) |

---

## 🎓 Key Takeaways

1. **Chrome extensions have 3 parts:** Content scripts (on pages), Background workers (behind scenes), Popup UI (icon menu)

2. **Adapter Pattern:** A design pattern to handle multiple platforms with one interface

3. **Web Scraping:** Reading data from HTML by finding specific elements

4. **Chrome Storage:** Shared memory between extension parts

5. **Modern sites block direct text injection:** Clipboard approach is the workaround

6. **MutationObserver:** Watches for page changes (like waiting for elements to appear)

---

## 📈 Future Improvements

- Support for more platforms (Perplexity, Copilot)
- Keyboard shortcuts
- History of transfers
- Option to auto-send after paste
