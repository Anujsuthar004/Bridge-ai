import type { PlasmoCSConfig, PlasmoGetStyle, PlasmoGetShadowHostId } from 'plasmo';
import { useEffect, useState, useCallback } from 'react';
import cssText from 'data-text:~style.css';
import { getActiveAdapter, PLATFORMS, type AIAdapter, type PlatformOption, type ContextPayload } from '~adapters';
import { buildTransferPrompt, validateMessages } from '~lib/contextEngine';
import { saveContextPayload, getContextPayload, clearContextPayload, generatePayloadId } from '~lib/storage';

// Plasmo Content Script Configuration
export const config: PlasmoCSConfig = {
    matches: [
        'https://chat.openai.com/*',
        'https://chatgpt.com/*',
        'https://claude.ai/*',
        'https://gemini.google.com/*',
        'https://bard.google.com/*',
    ],
    all_frames: false,
};

// Get custom styles for Shadow DOM
export const getStyle: PlasmoGetStyle = () => {
    const style = document.createElement('style');
    style.textContent = cssText;
    return style;
};

// Custom shadow host ID for styling
export const getShadowHostId: PlasmoGetShadowHostId = () => 'bridge-ai-root';

// Transfer Overlay Component
interface TransferOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    onTransfer: (destination: PlatformOption) => void;
    currentPlatform: string;
    isTransferring: boolean;
}

function TransferOverlay({ isOpen, onClose, onTransfer, currentPlatform, isTransferring }: TransferOverlayProps) {
    if (!isOpen) return null;

    const availableDestinations = PLATFORMS.filter((p) => p.id !== currentPlatform);

    return (
        <div className="bridge-overlay" onClick={onClose}>
            <div className="bridge-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                            Transfer Conversation
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Choose a destination for your context
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        aria-label="Close"
                    >
                        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Destination Options */}
                <div className="space-y-3">
                    {availableDestinations.map((platform) => (
                        <button
                            key={platform.id}
                            onClick={() => onTransfer(platform)}
                            disabled={isTransferring}
                            className="w-full bridge-card flex items-center gap-4 hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span className="text-3xl">{platform.icon}</span>
                            <div className="flex-1 text-left">
                                <span className="font-semibold text-gray-900 dark:text-white">
                                    {platform.name}
                                </span>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Transfer context to {platform.name}
                                </p>
                            </div>
                            <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: platform.color }}
                            />
                        </button>
                    ))}
                </div>

                {/* Footer */}
                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-400 text-center">
                        Last 10 messages will be transferred with context summary
                    </p>
                </div>
            </div>
        </div>
    );
}

// Status Toast Component
interface ToastProps {
    message: string;
    type: 'success' | 'error' | 'info';
    isVisible: boolean;
}

function Toast({ message, type, isVisible }: ToastProps) {
    if (!isVisible) return null;

    const bgColor = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        info: 'bg-blue-500',
    }[type];

    return (
        <div className={`fixed bottom-4 right-4 z-[9999999] ${bgColor} text-white px-4 py-3 rounded-lg shadow-xl animate-slide-up flex items-center gap-2`}>
            {type === 'success' && <span>✓</span>}
            {type === 'error' && <span>✕</span>}
            {type === 'info' && <span>ℹ</span>}
            <span className="font-medium">{message}</span>
        </div>
    );
}

// Main Content Script Component
function TransferUI() {
    const [adapter, setAdapter] = useState<AIAdapter | null>(null);
    const [isOverlayOpen, setIsOverlayOpen] = useState(false);
    const [isTransferring, setIsTransferring] = useState(false);
    const [isInjecting, setIsInjecting] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    // Show toast notification
    const showToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 5000); // 5 seconds for better visibility
    }, []);

    // Initialize adapter on mount
    useEffect(() => {
        const activeAdapter = getActiveAdapter();
        setAdapter(activeAdapter);

        if (activeAdapter) {
            console.log(`[BridgeAI] Detected platform: ${activeAdapter.platformName}`);
        }
    }, []);

    // Check for pending context on load (destination tab)
    useEffect(() => {
        const checkAndInjectContext = async () => {
            if (!adapter) return;

            try {
                const payload = await getContextPayload();

                if (payload && payload.destinationPlatform === adapter.platformId) {
                    console.log('[BridgeAI] Found pending context for this platform');
                    setIsInjecting(true);

                    // Wait for the input to be ready
                    const isReady = await adapter.waitForReady();

                    if (isReady) {
                        const success = await adapter.injectPrompt(payload.formattedPrompt);

                        if (success) {
                            // Show clipboard paste instruction for all platforms
                            showToast('📋 Context copied! Press ⌘+V or Ctrl+V to paste', 'info');
                            await clearContextPayload();
                        } else {
                            showToast('Failed to inject context', 'error');
                        }
                    } else {
                        showToast('Timed out waiting for chat to load', 'error');
                    }

                    setIsInjecting(false);
                }
            } catch (error) {
                console.error('[BridgeAI] Error checking/injecting context:', error);
                setIsInjecting(false);
            }
        };

        // Delay slightly to ensure DOM is ready
        const timer = setTimeout(checkAndInjectContext, 1500);
        return () => clearTimeout(timer);
    }, [adapter, showToast]);

    // Handle transfer initiation
    const handleTransfer = async (destination: PlatformOption) => {
        if (!adapter) return;

        try {
            setIsTransferring(true);

            // Scrape messages from current conversation
            const messages = adapter.scrapeMessages();

            // Validate messages
            const validation = validateMessages(messages);
            if (!validation.valid) {
                showToast(validation.error || 'No messages to transfer', 'error');
                setIsTransferring(false);
                setIsOverlayOpen(false);
                return;
            }

            // Build the transfer prompt
            const formattedPrompt = buildTransferPrompt(messages, adapter.platformName);

            // Create context payload
            const payload: ContextPayload = {
                id: generatePayloadId(),
                sourcePlatform: adapter.platformId,
                destinationPlatform: destination.id,
                messages,
                formattedPrompt,
                timestamp: Date.now(),
            };

            // Save to storage
            await saveContextPayload(payload);

            // Open destination tab via background script
            chrome.runtime.sendMessage(
                { type: 'OPEN_DESTINATION_TAB', destinationPlatform: destination.id },
                (response) => {
                    if (response?.success) {
                        showToast(`Opening ${destination.name}...`, 'info');
                    } else {
                        showToast(response?.error || 'Failed to open tab', 'error');
                    }
                }
            );

            setIsOverlayOpen(false);
        } catch (error) {
            console.error('[BridgeAI] Transfer error:', error);
            showToast('Transfer failed. Please try again.', 'error');
        } finally {
            setIsTransferring(false);
        }
    };

    // Don't render if no adapter detected
    if (!adapter) {
        return null;
    }

    return (
        <>
            {/* Transfer Button - Fixed position */}
            <button
                onClick={() => setIsOverlayOpen(true)}
                disabled={isInjecting}
                className="fixed bottom-20 right-6 z-[999998] bridge-btn shadow-2xl"
                title="Transfer conversation to another AI"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                    />
                </svg>
                <span>Transfer</span>
            </button>

            {/* Transfer Overlay */}
            <TransferOverlay
                isOpen={isOverlayOpen}
                onClose={() => setIsOverlayOpen(false)}
                onTransfer={handleTransfer}
                currentPlatform={adapter.platformId}
                isTransferring={isTransferring}
            />

            {/* Toast Notifications */}
            <Toast
                message={toast?.message || ''}
                type={toast?.type || 'info'}
                isVisible={toast !== null}
            />

            {/* Injection Loading Indicator */}
            {isInjecting && (
                <div className="fixed inset-0 z-[9999999] flex items-center justify-center bg-black/30 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-2xl flex items-center gap-4 animate-pulse-subtle">
                        <div className="w-8 h-8 border-4 border-bridge-primary border-t-transparent rounded-full animate-spin" />
                        <span className="font-medium text-gray-900 dark:text-white">
                            Transferring context...
                        </span>
                    </div>
                </div>
            )}
        </>
    );
}

export default TransferUI;
