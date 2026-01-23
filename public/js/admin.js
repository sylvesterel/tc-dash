var adminPages = [];

function escapeHtmlAdmin(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function loadPageStatuses() {
    var container = document.getElementById('pageStatusList');
    if (!container) return;

    fetch('/api/page-status')
        .then(function(response) {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.json();
        })
        .then(function(data) {
            if (data.success && data.pages) {
                adminPages = data.pages;
                renderPageStatusList();
            } else {
                container.innerHTML = '<p class="text-red-400 text-center py-4">Kunne ikke hente side status</p>';
            }
        })
        .catch(function(error) {
            container.innerHTML = '<p class="text-red-400 text-center py-4">Fejl: ' + escapeHtmlAdmin(error.message) + '</p>';
        });
}

function renderPageStatusList() {
    var container = document.getElementById('pageStatusList');
    if (!container) return;

    if (!adminPages || adminPages.length === 0) {
        container.innerHTML = '<div class="text-center py-8 text-text-secondary"><p>Ingen sider fundet</p></div>';
        return;
    }

    var html = '';
    for (var i = 0; i < adminPages.length; i++) {
        var page = adminPages[i];
        var isDisabled = page.is_disabled === 1 || page.is_disabled === true;

        html += '<div class="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors">';
        html += '<div class="flex items-center gap-4">';
        html += '<div class="w-10 h-10 rounded-lg ' + (isDisabled ? 'bg-red-500/20' : 'bg-green-500/20') + ' flex items-center justify-center">';
        html += '<i class="fa-solid ' + (isDisabled ? 'fa-ban text-red-400' : 'fa-check text-green-400') + '"></i>';
        html += '</div>';
        html += '<div>';
        html += '<h3 class="font-medium text-text-primary">' + escapeHtmlAdmin(page.page_name) + '</h3>';
        html += '<p class="text-text-secondary text-sm">' + escapeHtmlAdmin(page.page_path) + '</p>';
        html += '</div></div>';
        html += '<div class="flex items-center gap-3">';
        html += '<span class="px-3 py-1 rounded-full text-xs font-medium ' + (isDisabled ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400') + '">';
        html += isDisabled ? 'Deaktiveret' : 'Aktiv';
        html += '</span>';
        html += '<button onclick="togglePageStatus(' + page.id + ', ' + isDisabled + ')" class="p-2 rounded-lg ' + (isDisabled ? 'bg-green-500/20 hover:bg-green-500/30 text-green-400' : 'bg-red-500/20 hover:bg-red-500/30 text-red-400') + ' transition-colors" title="' + (isDisabled ? 'Aktiver side' : 'Deaktiver side') + '">';
        html += '<i class="fa-solid ' + (isDisabled ? 'fa-toggle-off' : 'fa-toggle-on') + '"></i>';
        html += '</button>';
        html += '</div></div>';
    }

    container.innerHTML = html;
}

function togglePageStatus(pageId, currentlyDisabled) {
    var page = null;
    for (var i = 0; i < adminPages.length; i++) {
        if (adminPages[i].id === pageId) {
            page = adminPages[i];
            break;
        }
    }
    if (!page) return;

    if (currentlyDisabled) {
        updatePageStatus(pageId, false, null);
    } else {
        showDisableModal(pageId, page.page_name);
    }
}

function showDisableModal(pageId, pageName) {
    var existing = document.getElementById('adminModal');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = 'adminModal';
    modal.className = 'fixed inset-0 bg-black/70 backdrop-blur-sm z-[10000] flex items-center justify-center p-4';
    modal.innerHTML = '<div class="bg-dark-card border border-white/10 rounded-2xl w-full max-w-md p-6" style="animation: fadeInUp 0.3s ease forwards;">' +
        '<div class="flex items-center gap-3 mb-6">' +
        '<div class="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">' +
        '<i class="fa-solid fa-triangle-exclamation text-yellow-400 text-xl"></i>' +
        '</div>' +
        '<div>' +
        '<h3 class="text-xl font-semibold text-text-primary">Deaktiver Side</h3>' +
        '<p class="text-text-secondary text-sm">' + escapeHtmlAdmin(pageName) + '</p>' +
        '</div></div>' +
        '<div class="mb-6">' +
        '<label class="block text-sm font-medium text-text-secondary mb-2">Besked til brugere (valgfrit)</label>' +
        '<textarea id="disableMessage" rows="3" placeholder="Denne side er midlertidigt deaktiveret..." class="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-text-primary placeholder-text-secondary/50 focus:outline-none focus:border-primary/50 transition-colors resize-none"></textarea>' +
        '</div>' +
        '<div class="flex gap-3">' +
        '<button onclick="closeAdminModal()" class="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-text-secondary rounded-xl font-medium transition-colors">Annuller</button>' +
        '<button onclick="confirmDisable(' + pageId + ')" class="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-colors">Deaktiver</button>' +
        '</div></div>';

    document.body.appendChild(modal);
    modal.addEventListener('click', function(e) {
        if (e.target === modal) closeAdminModal();
    });
}

function closeAdminModal() {
    var modal = document.getElementById('adminModal');
    if (modal) modal.remove();
}

function confirmDisable(pageId) {
    var textarea = document.getElementById('disableMessage');
    var message = textarea ? textarea.value.trim() : '';
    closeAdminModal();
    updatePageStatus(pageId, true, message || 'Denne side er midlertidigt deaktiveret.');
}

function updatePageStatus(pageId, isDisabled, message) {
    fetch('/api/page-status/' + pageId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            is_disabled: isDisabled,
            disabled_message: message
        })
    })
    .then(function(response) { return response.json(); })
    .then(function(data) {
        if (data.success) {
            showAdminNotification(data.message, 'success');
            loadPageStatuses();
        } else {
            showAdminNotification(data.error || 'Kunne ikke opdatere', 'error');
        }
    })
    .catch(function(error) {
        showAdminNotification('Fejl: ' + escapeHtmlAdmin(error.message), 'error');
    });
}

function showAdminNotification(message, type) {
    var existing = document.querySelectorAll('.admin-notification');
    for (var i = 0; i < existing.length; i++) existing[i].remove();

    var colors = {
        success: 'bg-green-500/20 border-green-500/30 text-green-400',
        error: 'bg-red-500/20 border-red-500/30 text-red-400'
    };
    var icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle'
    };

    var notification = document.createElement('div');
    notification.className = 'admin-notification fixed top-20 right-4 z-[10001] px-5 py-4 rounded-xl border ' + colors[type] + ' flex items-center gap-3 shadow-2xl';
    notification.style.animation = 'fadeInUp 0.3s ease forwards';
    notification.innerHTML = '<i class="fa-solid ' + icons[type] + '"></i><span class="font-medium">' + escapeHtmlAdmin(message) + '</span>';

    document.body.appendChild(notification);

    setTimeout(function() {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-10px)';
        notification.style.transition = 'all 0.3s ease';
        setTimeout(function() { notification.remove(); }, 300);
    }, 3000);
}

// Add animation style
var adminStyle = document.createElement('style');
adminStyle.textContent = '@keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }';
document.head.appendChild(adminStyle);
