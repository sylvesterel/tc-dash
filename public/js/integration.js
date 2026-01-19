/**
 * Integration Dashboard JavaScript
 * Handles HubSpot & Rentman integration dashboard functionality
 */

let currentUser = null;
let isAdmin = false;
let refreshInterval = null;
let isSyncRunning = false;

// Initialize dashboard on load
document.addEventListener('DOMContentLoaded', async () => {
    await loadUserInfo();
    await refreshDashboard();

    // Auto refresh every 30 seconds
    refreshInterval = setInterval(refreshDashboard, 30000);
});

// Load user info and set admin visibility
async function loadUserInfo() {
    try {
        const response = await fetch('/me');
        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            isAdmin = currentUser.rolle === 'admin';

            // Update user name in header
            const userNameEl = document.getElementById('userName');
            if (userNameEl) {
                userNameEl.textContent = currentUser.fornavn || currentUser.brugernavn;
            }

            // Show/hide admin-only elements
            updateAdminVisibility();
        }
    } catch (error) {
        console.error('Error loading user info:', error);
    }
}

// Update visibility of admin-only elements
function updateAdminVisibility() {
    const adminElements = document.querySelectorAll('.admin-only');
    adminElements.forEach(el => {
        if (!isAdmin) {
            el.style.display = 'none';
        }
    });
}

// Refresh all dashboard data
async function refreshDashboard() {
    try {
        const response = await fetch('/api/integration/dashboard');
        if (!response.ok) throw new Error('Failed to fetch dashboard data');

        const data = await response.json();

        updateStats(data);
        updateSyncStatus(data.currentStatus, data.lastSync);
        updateErrorList(data.errors.recentErrors);
        updateSyncHistory(data.recentSyncs);
        updateWebhookList(data.webhookEvents);

        isSyncRunning = data.currentStatus.isRunning;
        updateSyncButtons();

    } catch (error) {
        console.error('Error refreshing dashboard:', error);
        showError('Kunne ikke opdatere dashboard');
    }
}

// Update statistics cards
function updateStats(data) {
    // Status
    const statusEl = document.getElementById('syncStatus');
    const statusBadge = document.getElementById('statusBadge');
    const lastSyncEl = document.getElementById('lastSyncTime');

    if (data.currentStatus.isRunning) {
        statusEl.textContent = 'Kører';
        statusBadge.textContent = 'Syncing';
        statusBadge.className = 'stat-badge warning';
    } else {
        statusEl.textContent = 'Klar';
        statusBadge.textContent = 'Online';
        statusBadge.className = 'stat-badge success';
    }

    if (data.lastSync) {
        const lastSyncDate = new Date(data.lastSync.started_at);
        lastSyncEl.textContent = `Sidste sync: ${formatRelativeTime(lastSyncDate)}`;
    }

    // Errors
    const unresolvedEl = document.getElementById('unresolvedCount');
    const criticalEl = document.getElementById('criticalCount');
    const errorBadge = document.getElementById('errorBadge');

    unresolvedEl.textContent = data.errors.unresolvedCount;
    criticalEl.textContent = `Kritiske: ${data.errors.criticalCount}`;

    if (data.errors.criticalCount > 0) {
        errorBadge.textContent = 'Kritisk';
        errorBadge.className = 'stat-badge error';
    } else if (data.errors.unresolvedCount > 0) {
        errorBadge.textContent = 'Uløste';
        errorBadge.className = 'stat-badge warning';
    } else {
        errorBadge.textContent = 'OK';
        errorBadge.className = 'stat-badge success';
    }

    // Syncs
    const totalSyncsEl = document.getElementById('totalSyncs');
    const successRateEl = document.getElementById('successRate');
    const syncsBadge = document.getElementById('syncsBadge');

    const stats = data.syncStats;
    totalSyncsEl.textContent = stats.total_syncs || 0;

    const successRate = stats.total_syncs > 0
        ? Math.round((stats.successful_syncs / stats.total_syncs) * 100)
        : 100;
    successRateEl.textContent = `Succesrate: ${successRate}%`;
    syncsBadge.textContent = `${successRate}%`;
    syncsBadge.className = successRate >= 90 ? 'stat-badge success' :
                          successRate >= 70 ? 'stat-badge warning' : 'stat-badge error';

    // Items processed
    const itemsEl = document.getElementById('itemsProcessed');
    const todayItemsEl = document.getElementById('todayItems');

    itemsEl.textContent = formatNumber(stats.total_items_processed || 0);

    const todayStats = data.errors.todayStats;
    if (todayStats) {
        const todayTotal = (todayStats.webhook_errors || 0) + (todayStats.api_errors || 0);
        todayItemsEl.textContent = `I dag: ${todayTotal} events`;
    } else {
        todayItemsEl.textContent = 'I dag: 0 events';
    }
}

// Update sync status indicator
function updateSyncStatus(status, lastSync) {
    const dot = document.getElementById('statusDot');
    const title = document.getElementById('currentStatusTitle');
    const subtitle = document.getElementById('currentStatusSubtitle');

    if (status.isRunning) {
        dot.className = 'status-dot running';
        title.textContent = `Synkroniserer ${formatSyncType(status.currentType)}`;
        subtitle.textContent = 'Sync i gang...';
    } else {
        dot.className = 'status-dot idle';
        title.textContent = 'Integration Klar';

        if (lastSync) {
            const lastSyncDate = new Date(lastSync.completed_at || lastSync.started_at);
            subtitle.textContent = `Sidst opdateret ${formatRelativeTime(lastSyncDate)}`;
        } else {
            subtitle.textContent = 'Ingen aktiv sync';
        }
    }
}

// Update error list
function updateErrorList(errors) {
    const container = document.getElementById('errorList');

    if (!errors || errors.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon"><i class="fas fa-check-circle"></i></div>
                <h4>Ingen uløste fejl</h4>
                <p>Alt ser godt ud</p>
            </div>
        `;
        return;
    }

    container.innerHTML = errors.map(error => `
        <div class="error-item ${error.severity}">
            <div class="error-icon ${error.severity}">
                ${getSeverityIcon(error.severity)}
            </div>
            <div class="error-content">
                <div class="error-message" title="${escapeHtml(error.error_message)}">
                    ${escapeHtml(error.error_message)}
                </div>
                <div class="error-meta">
                    <span>${error.source_system || 'system'}</span>
                    <span>${error.error_type}</span>
                    <span>${formatRelativeTime(new Date(error.created_at))}</span>
                </div>
            </div>
            <div class="error-actions">
                <button class="btn-resolve" onclick="resolveError(${error.id})">
                    Løs
                </button>
            </div>
        </div>
    `).join('');
}

// Update sync history
function updateSyncHistory(syncs) {
    const container = document.getElementById('syncHistory');

    if (!syncs || syncs.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon"><i class="fas fa-history"></i></div>
                <h4>Ingen sync historik</h4>
                <p>Ingen syncs er koert endnu</p>
            </div>
        `;
        return;
    }

    container.innerHTML = syncs.map(sync => {
        const statusClass = sync.status === 'completed' ? 'success' :
                           sync.status === 'failed' ? 'failed' : 'partial';
        const icon = sync.status === 'completed' ? '<i class="fas fa-check"></i>' :
                    sync.status === 'failed' ? '<i class="fas fa-times"></i>' : '<i class="fas fa-exclamation"></i>';

        return `
            <div class="history-item">
                <div class="history-icon ${statusClass}">${icon}</div>
                <div class="history-content">
                    <div class="history-title">${formatSyncType(sync.sync_type)} Sync</div>
                    <div class="history-meta">
                        ${formatRelativeTime(new Date(sync.started_at))}
                        ${sync.triggered_by ? `• af ${sync.triggered_by}` : ''}
                    </div>
                </div>
                <div class="history-stats">
                    <div class="stat success">${sync.success_count || 0} ok</div>
                    ${sync.error_count > 0 ? `<div class="stat error">${sync.error_count} fejl</div>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// Update webhook list
function updateWebhookList(webhooks) {
    const container = document.getElementById('webhookList');

    if (!webhooks || webhooks.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 20px;">
                <p style="font-size: 13px; color: var(--text-secondary);">Ingen webhooks modtaget endnu</p>
            </div>
        `;
        return;
    }

    container.innerHTML = webhooks.slice(0, 10).map(webhook => `
        <div class="webhook-item">
            <span class="webhook-source ${webhook.source}">${webhook.source}</span>
            <span class="webhook-type">${webhook.event_type || webhook.subscription_type || 'unknown'}</span>
            <span class="webhook-status ${webhook.status}">${webhook.status}</span>
            <span class="webhook-time">${formatRelativeTime(new Date(webhook.created_at))}</span>
        </div>
    `).join('');
}

// Update sync buttons state
function updateSyncButtons() {
    const buttons = document.querySelectorAll('.sync-action-btn, .btn-sync');
    buttons.forEach(btn => {
        if (isSyncRunning) {
            btn.disabled = true;
        } else {
            btn.disabled = false;
        }
    });
}

// Run a specific sync type
async function runSync(type) {
    if (isSyncRunning) {
        showError('En sync kører allerede');
        return;
    }

     if (!isAdmin) {
        showError('Kun administratorer kan køre sync');
        return;
    }

    try {
        isSyncRunning = true;
        updateSyncButtons();

        const response = await fetch(`/api/integration/sync/${type}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Sync fejlede');
        }

        showSuccess(`${formatSyncType(type)} sync startet`);

        // Start polling for status
        pollSyncStatus();

    } catch (error) {
        console.error('Error running sync:', error);
        showError(error.message);
        isSyncRunning = false;
        updateSyncButtons();
    }
}

// Run full sync (admin only)
async function runFullSync() {
    if (!isAdmin) {
        showError('Kun administratorer kan køre fuld sync');
        return;
    }

    if (isSyncRunning) {
        showError('En sync kører allerede');
        return;
    }

    const confirmed = await Modal.confirm(
        'Fuld synkronisering',
        'Er du sikker på at du vil køre en fuld synkronisering?<br><br>Dette kan tage flere minutter.',
        'warning'
    );
    if (!confirmed) return;

    try {
        isSyncRunning = true;
        updateSyncButtons();

        const response = await fetch('/api/integration/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Fuld sync fejlede');
        }

        showSuccess('Fuld sync startet');

        // Start polling for status
        pollSyncStatus();

    } catch (error) {
        console.error('Error running full sync:', error);
        showError(error.message);
        isSyncRunning = false;
        updateSyncButtons();
    }
}

// Poll sync status while running
async function pollSyncStatus() {
    const checkStatus = async () => {
        try {
            const response = await fetch('/api/integration/status');
            const data = await response.json();

            if (!data.isRunning) {
                isSyncRunning = false;
                updateSyncButtons();
                refreshDashboard();
                return;
            }

            updateSyncStatus(data, data.currentSync);
            setTimeout(checkStatus, 3000);

        } catch (error) {
            console.error('Error polling status:', error);
            isSyncRunning = false;
            updateSyncButtons();
        }
    };

    checkStatus();
}

// Resolve an error
async function resolveError(errorId) {
    try {
        const response = await fetch(`/api/integration/errors/${errorId}/resolve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        if (!response.ok) {
            throw new Error('Kunne ikke løse fejl');
        }

        showSuccess('Fejl markeret som løst');
        refreshDashboard();

    } catch (error) {
        console.error('Error resolving error:', error);
        showError(error.message);
    }
}

// Show all errors (can be expanded to modal or separate page)
function showAllErrors() {
    // For now, just refresh with all errors visible
    // Could be expanded to show a modal or navigate to a dedicated page
    window.location.href = '/integration?view=errors';
}

// Helper functions
function formatSyncType(type) {
    const types = {
        'full': 'Fuld',
        'company': 'Virksomheder',
        'contact': 'Kontakter',
        'deal': 'Deals',
        'order': 'Ordrer'
    };
    return types[type] || type;
}

function formatRelativeTime(date) {
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'Lige nu';
    if (minutes < 60) return `${minutes} min siden`;
    if (hours < 24) return `${hours} time${hours > 1 ? 'r' : ''} siden`;
    if (days < 7) return `${days} dag${days > 1 ? 'e' : ''} siden`;

    return date.toLocaleDateString('da-DK', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

function getSeverityIcon(severity) {
    const icons = {
        'critical': '<i class="fas fa-times-circle"></i>',
        'error': '<i class="fas fa-exclamation-circle"></i>',
        'warn': '<i class="fas fa-exclamation-triangle"></i>',
        'info': '<i class="fas fa-info-circle"></i>',
        'debug': '<i class="fas fa-bug"></i>'
    };
    return icons[severity] || '<i class="fas fa-circle"></i>';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showSuccess(message) {
    // Simple toast notification - can be replaced with better UI
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 16px 24px;
        background: rgba(0, 230, 118, 0.9);
        color: #000;
        border-radius: 10px;
        font-weight: 600;
        font-size: 14px;
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showError(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 16px 24px;
        background: rgba(255, 82, 82, 0.9);
        color: #fff;
        border-radius: 10px;
        font-weight: 600;
        font-size: 14px;
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
`;
document.head.appendChild(style);
