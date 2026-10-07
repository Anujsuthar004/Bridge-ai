/** Preserve paragraph boundaries and exact code whitespace when reading rendered chat. */
export function readMessageText(element: Element): string {
    const read = (node: Node): string => {
        if (node.nodeType === 3) return node.textContent || '';
        if (node.nodeType !== 1) return '';
        const el = node as Element;
        const tag = el.tagName.toLowerCase();
        if (['button', 'script', 'style', 'svg'].includes(tag) || el.getAttribute('aria-hidden') === 'true') return '';
        if (tag === 'br') return '\n';
        if (tag === 'pre') {
            const code = el.querySelector('code') || el;
            const text = code.textContent || '';
            const ticks = Math.max(3, ...Array.from(text.matchAll(/`+/g), match => match[0].length + 1));
            const fence = '`'.repeat(ticks);
            return `\n${fence}\n${text}${text.endsWith('\n') ? '' : '\n'}${fence}\n`;
        }
        const content = Array.from(el.childNodes).map(read).join('');
        return ['p', 'div', 'li', 'ul', 'ol', 'h1', 'h2', 'h3', 'blockquote', 'tr'].includes(tag)
            ? `\n${content}\n` : tag === 'td' || tag === 'th' ? `${content}\t` : content;
    };
    return read(element).trim();
}
