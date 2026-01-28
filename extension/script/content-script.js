// Listen for messages from the website
window.addEventListener('message', (event) => {

    const allowedOrigins = [
        'https://login.n8ncopilot.com',
        'http://localhost:5678',
        'https://app.n8n.cloud',
        'https://*.n8n.cloud/*',
        globalThis.location.origin
    ];
    
    if (!allowedOrigins.includes(event.origin)) {
        return;
    }

    if (event.data.type === 'N8N_AUTH_SUCCESS' && event.data.source === 'firebase-auth') {
        // Forward the message to background script
        chrome.runtime.sendMessage({
            type: 'N8N_AUTH_SUCCESS',
            userData: event.data.userData
        }, (response) => {
            if (chrome.runtime.lastError) {
                if (chrome.runtime.lastError.message.includes('Extension context invalidated')) {
                    console.warn('Extension context invalidated - extension may have been reloaded or disabled');
                    // Optionally, you could try to re-establish connection or show user notification
                } else {
                    console.error('Error sending to background:', chrome.runtime.lastError);
                }
            }
        });
    }
});

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'REMOVE_BUTTONS') {
        // Remove all extension buttons and modals
        [
            "n8n-generate-btn-container",
            "n8n-generate-modal",
            "n8n-debug-btn",
            "n8n-premium-notification",
        ].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });
        sendResponse({ success: true });
    } else if (request.type === 'SHOW_NOTIFICATION') {
        // Show notification popup on the page
        try {
            showPageNotification(request.success, request.message);
            sendResponse({ success: true });
        } catch (error) {
            console.error('Error showing notification:', error);
            sendResponse({ success: false, error: error.message });
        }
    }
});

// Function to show notification popup on n8n page
function showPageNotification(success, message) {
    // Ensure document is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            showPageNotification(success, message);
        });
        return;
    }

    // Remove existing notification if any
    const existingNotification = document.getElementById('n8n-copilot-notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.id = 'n8n-copilot-notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #1a1a1a;
        border: 1px solid #2a2a2a;
        border-left: 4px solid ${success ? '#28a745' : '#ef4444'};
        color: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3), 0 4px 6px rgba(0, 0, 0, 0.2);
        z-index: 999999;
        max-width: 420px;
        min-width: 350px;
        animation: slideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        backdrop-filter: blur(10px);
    `;

    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%) scale(0.95);
                opacity: 0;
            }
            to {
                transform: translateX(0) scale(1);
                opacity: 1;
            }
        }
        @keyframes slideOut {
            from {
                transform: translateX(0) scale(1);
                opacity: 1;
            }
            to {
                transform: translateX(100%) scale(0.95);
                opacity: 0;
            }
        }
        .n8n-notification-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 12px;
        }
        .n8n-notification-title {
            font-weight: 700;
            font-size: 16px;
            color: white;
            margin: 0;
        }
        .n8n-notification-subtitle {
            font-size: 13px;
            color: #cccccc;
            margin: 0;
            font-weight: 500;
        }
        .n8n-notification-message {
            font-size: 14px;
            color: #e0e0e0;
            line-height: 1.5;
            margin: 0;
        }
        .n8n-notification-timestamp {
            font-size: 12px;
            color: #999999;
            margin-top: 8px;
            font-weight: 500;
        }
        .n8n-notification-close {
            position: absolute;
            top: 12px;
            right: 12px;
            background: none;
            border: none;
            color: #999999;
            cursor: pointer;
            font-size: 18px;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
            transition: all 0.2s ease;
        }
        .n8n-notification-close:hover {
            background: #2a2a2a;
            color: white;
        }
    `;
    if (!document.getElementById('n8n-copilot-notification-style')) {
        style.id = 'n8n-copilot-notification-style';
        document.head.appendChild(style);
    }

    // Get current time
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Create notification content
    const statusText = success ? 'Success' : 'Error';
    const titleText = success ? 'Workflow Generated Successfully' : 'Generation Failed';

    notification.innerHTML = `
        <button class="n8n-notification-close" onclick="this.parentElement.remove()">×</button>
        <div class="n8n-notification-header">
            <img src="${chrome.runtime.getURL('assets/icon128.png')}" 
                 style="width: 32px; height: 32px; border-radius: 8px; margin-right: 12px;" 
                 alt="n8nCopilot"
                 onerror="this.style.display='none'">
            <div>
                <h3 class="n8n-notification-title">n8nCopilot</h3>
                <p class="n8n-notification-subtitle">${statusText}</p>
            </div>
        </div>
        <div>
            <h4 style="font-weight: 600; font-size: 15px; color: white; margin: 0 0 8px 0;">
                ${titleText}
            </h4>
            <p class="n8n-notification-message">${message}</p>
            <p class="n8n-notification-timestamp">${timeString}</p>
        </div>
    `;

    // Add to page
    document.body.appendChild(notification);

    // Auto remove after 6 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOut 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }
    }, 6000);
}