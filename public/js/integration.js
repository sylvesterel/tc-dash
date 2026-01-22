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
        statusBadge.className = 'px-2 py-0.5 text-xs rounded-full bg-yellow-500/20 text-yellow-400';
    } else {
        statusEl.textContent = 'Klar';
        statusBadge.textContent = 'Online';
        statusBadge.className = 'px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-400';
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
        errorBadge.className = 'px-2 py-0.5 text-xs rounded-full bg-red-500/20 text-red-400';
    } else if (data.errors.unresolvedCount > 0) {
        errorBadge.textContent = 'Uløste';
        errorBadge.className = 'px-2 py-0.5 text-xs rounded-full bg-yellow-500/20 text-yellow-400';
    } else {
        errorBadge.textContent = 'OK';
        errorBadge.className = 'px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-400';
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
    syncsBadge.className = successRate >= 90 ? 'px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-400' :
                          successRate >= 70 ? 'px-2 py-0.5 text-xs rounded-full bg-yellow-500/20 text-yellow-400' :
                          'px-2 py-0.5 text-xs rounded-full bg-red-500/20 text-red-400';

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
        dot.className = 'w-3 h-3 rounded-full bg-yellow-500 animate-pulse';
        title.textContent = `Synkroniserer ${formatSyncType(status.currentType)}`;
        subtitle.textContent = 'Sync i gang...';
    } else {
        dot.className = 'w-3 h-3 rounded-full bg-green-500';
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
            <div class="flex flex-col items-center justify-center py-8 text-center">
                <div class="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mb-3">
                    <i class="fas fa-check-circle text-green-400 text-xl"></i>
                </div>
                <h4 class="font-medium text-text-primary mb-1">Ingen uløste fejl</h4>
                <p class="text-text-secondary text-sm">Alt ser godt ud</p>
            </div>
        `;
        return;
    }

    const severityColors = {
        'critical': 'border-red-500 bg-red-500/10',
        'error': 'border-orange-500 bg-orange-500/10',
        'warn': 'border-yellow-500 bg-yellow-500/10',
        'info': 'border-blue-500 bg-blue-500/10',
        'debug': 'border-gray-500 bg-gray-500/10'
    };

    const iconColors = {
        'critical': 'bg-red-500/20 text-red-400',
        'error': 'bg-orange-500/20 text-orange-400',
        'warn': 'bg-yellow-500/20 text-yellow-400',
        'info': 'bg-blue-500/20 text-blue-400',
        'debug': 'bg-gray-500/20 text-gray-400'
    };

    container.innerHTML = errors.map(error => `
        <div class="flex items-start gap-3 p-3 rounded-lg border-l-4 ${severityColors[error.severity] || severityColors['error']}">
            <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${iconColors[error.severity] || iconColors['error']}">
                ${getSeverityIcon(error.severity)}
            </div>
            <div class="flex-1 min-w-0">
                <div class="text-text-primary text-sm font-medium truncate" title="${escapeHtml(error.error_message)}">
                    ${escapeHtml(error.error_message)}
                </div>
                <div class="flex items-center gap-2 mt-1 text-xs text-text-secondary">
                    <span>${error.source_system || 'system'}</span>
                    <span class="opacity-50">•</span>
                    <span>${error.error_type}</span>
                    <span class="opacity-50">•</span>
                    <span>${formatRelativeTime(new Date(error.created_at))}</span>
                </div>
            </div>
            <button class="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 text-text-secondary rounded-lg transition-colors flex-shrink-0" onclick="resolveError(${error.id})">
                Løs
            </button>
        </div>
    `).join('');
}

// Update sync history
function updateSyncHistory(syncs) {
    const container = document.getElementById('syncHistory');

    if (!syncs || syncs.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-8 text-center">
                <div class="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                    <i class="fas fa-history text-text-secondary text-xl"></i>
                </div>
                <h4 class="font-medium text-text-primary mb-1">Ingen sync historik</h4>
                <p class="text-text-secondary text-sm">Ingen syncs er koert endnu</p>
            </div>
        `;
        return;
    }

    const statusColors = {
        'completed': 'bg-green-500/20 text-green-400',
        'failed': 'bg-red-500/20 text-red-400',
        'partial': 'bg-yellow-500/20 text-yellow-400'
    };

    container.innerHTML = syncs.map(sync => {
        const statusClass = sync.status === 'completed' ? 'completed' :
                           sync.status === 'failed' ? 'failed' : 'partial';
        const icon = sync.status === 'completed' ? '<i class="fas fa-check"></i>' :
                    sync.status === 'failed' ? '<i class="fas fa-times"></i>' : '<i class="fas fa-exclamation"></i>';

        return `
            <div class="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${statusColors[statusClass] || statusColors['partial']}">${icon}</div>
                <div class="flex-1 min-w-0">
                    <div class="text-text-primary text-sm font-medium">${formatSyncType(sync.sync_type)} Sync</div>
                    <div class="text-xs text-text-secondary">
                        ${formatRelativeTime(new Date(sync.started_at))}
                        ${sync.triggered_by ? `• af ${sync.triggered_by}` : ''}
                    </div>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                    <span class="px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-400">${sync.success_count || 0} ok</span>
                    ${sync.error_count > 0 ? `<span class="px-2 py-0.5 text-xs rounded-full bg-red-500/20 text-red-400">${sync.error_count} fejl</span>` : ''}
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
            <div class="py-5 text-center">
                <p class="text-text-secondary text-sm">Ingen webhooks modtaget endnu</p>
            </div>
        `;
        return;
    }

    const sourceColors = {
        'hubspot': 'bg-orange-500/20 text-orange-400',
        'rentman': 'bg-blue-500/20 text-blue-400'
    };

    const statusColors = {
        'processed': 'text-green-400',
        'pending': 'text-yellow-400',
        'failed': 'text-red-400'
    };

    container.innerHTML = webhooks.slice(0, 10).map(webhook => `
        <div class="flex items-center gap-3 py-2 px-3 hover:bg-white/5 rounded-lg transition-colors">
            <span class="px-2 py-0.5 text-xs rounded-full ${sourceColors[webhook.source] || 'bg-white/10 text-text-secondary'}">${webhook.source}</span>
            <span class="flex-1 text-text-primary text-sm truncate">${webhook.event_type || webhook.subscription_type || 'unknown'}</span>
            <span class="text-xs ${statusColors[webhook.status] || 'text-text-secondary'}">${webhook.status}</span>
            <span class="text-xs text-text-secondary">${formatRelativeTime(new Date(webhook.created_at))}</span>
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
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-5 right-5 px-6 py-4 bg-green-500 text-white rounded-xl font-semibold text-sm z-[10000] animate-slide-in';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('opacity-0', 'transition-opacity');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showError(message) {
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-5 right-5 px-6 py-4 bg-red-500 text-white rounded-xl font-semibold text-sm z-[10000] animate-slide-in';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('opacity-0', 'transition-opacity');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slide-in {
        from { transform: translateX(100px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    .animate-slide-in {
        animation: slide-in 0.3s ease;
    }
`;
document.head.appendChild(style);
