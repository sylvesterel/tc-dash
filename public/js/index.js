// ============================================
// Global State
// ============================================
let currentMenuData = null;
let currentWeekNumber = null;
let currentYear = null;
let selectedWeekOffset = 0;
let notesData = [];
let editingNoteId = null;

// ============================================
// Initialization
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    loadDashboardData();
});


// ============================================
// Dashboard Data
// ============================================
async function loadDashboardData() {
    await Promise.all([
        loadDashboardStats(),
        loadWeeklyMenu(),
        loadNotes()
    ]);
}

async function loadDashboardStats() {
    try {
        const response = await fetch('/api/dashboard-stats');
        const data = await response.json();

        if (data.success) {
            const stats = data.stats;

            // Update projects count
            document.getElementById('projects-count').textContent = stats.weekly_projects;
            document.getElementById('projects-footer').textContent = 'Aktive projekter denne uge';

            // Update activity count
            document.getElementById('activity-count').textContent = stats.activity_24h;

            // Update unresolved errors
            if (stats.unresolved_errors) {
                const errorsCount = document.getElementById('errors-count');
                const errorsBadge = document.getElementById('errors-badge');
                const errorsFooter = document.getElementById('errors-footer');

                if (errorsCount) {
                    errorsCount.textContent = stats.unresolved_errors.count;
                }
                if (errorsBadge) {
                    errorsBadge.textContent = stats.unresolved_errors.status;
                    // Reset classes and apply Tailwind
                    errorsBadge.className = 'px-2 py-0.5 text-xs rounded-full';
                    if (stats.unresolved_errors.count === 0) {
                        errorsBadge.classList.add('bg-green-500/20', 'text-green-400');
                    } else if (stats.unresolved_errors.count <= 5) {
                        errorsBadge.classList.add('bg-yellow-500/20', 'text-yellow-400');
                    } else {
                        errorsBadge.classList.add('bg-red-500/20', 'text-red-400');
                    }
                }
                if (errorsFooter) {
                    errorsFooter.textContent = stats.unresolved_errors.count === 0
                        ? 'Ingen uloste fejl'
                        : 'Se integration for detaljer';
                }
            }
        }
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
        document.getElementById('projects-count').textContent = '-';
        document.getElementById('activity-count').textContent = '-';
        document.getElementById('errors-count').textContent = '-';
    }
}

// ============================================
// Week Navigation
// ============================================
function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function changeWeek(offset) {
    selectedWeekOffset += offset;
    selectedWeekOffset = Math.max(-4, Math.min(4, selectedWeekOffset));
    updateWeekNavButtons();
    loadWeeklyMenu();
}

function updateWeekNavButtons() {
    const prevBtn = document.getElementById('prevWeekBtn');
    const nextBtn = document.getElementById('nextWeekBtn');

    if (prevBtn) {
        prevBtn.disabled = selectedWeekOffset <= -4;
        prevBtn.style.opacity = selectedWeekOffset <= -4 ? '0.5' : '1';
    }
    if (nextBtn) {
        nextBtn.disabled = selectedWeekOffset >= 4;
        nextBtn.style.opacity = selectedWeekOffset >= 4 ? '0.5' : '1';
    }
}

// ============================================
// Weekly Menu
// ============================================
async function loadWeeklyMenu() {
    try {
        const now = new Date();
        const targetDate = new Date(now);
        targetDate.setDate(now.getDate() + (selectedWeekOffset * 7));

        const weekNum = getWeekNumber(targetDate);
        const year = targetDate.getFullYear();

        const response = await fetch(`/api/menu?week=${weekNum}&year=${year}`);
        const data = await response.json();

        if (data.success) {
            currentMenuData = data.menu;
            currentWeekNumber = data.week_number;
            currentYear = data.year;

            document.getElementById('week-number').textContent = `Uge ${data.week_number}`;

            const today = selectedWeekOffset === 0 ? data.today : null;
            renderMenu(data.menu, today);
        } else {
            renderEmptyMenu();
        }

        updateWeekNavButtons();
    } catch (error) {
        console.error('Error loading menu:', error);
        renderEmptyMenu();
    }
}

function renderMenu(menu, today) {
    const container = document.getElementById('menu-container');
    const dayNames = ['mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag'];
    const dayLabels = {
        'mandag': 'Mandag',
        'tirsdag': 'Tirsdag',
        'onsdag': 'Onsdag',
        'torsdag': 'Torsdag',
        'fredag': 'Fredag'
    };

    const menuMap = {};
    menu.forEach(item => {
        menuMap[item.day_of_week] = item;
    });

    let html = '';

    dayNames.forEach(day => {
        const isToday = day === today;
        const dayMenu = menuMap[day];
        const isExpanded = isToday;

        html += `
            <div class="border ${isToday ? 'border-primary/50 bg-primary/5' : 'border-white/10'} rounded-lg overflow-hidden"
                 data-day="${day}">
                <div class="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors" onclick="toggleMenuDay('${day}')">
                    <div class="flex items-center gap-3">
                        <span class="font-medium text-text-primary">${dayLabels[day]}</span>
                        ${isToday ? '<span class="px-2 py-0.5 text-xs rounded-full bg-primary/20 text-primary">I dag</span>' : ''}
                    </div>
                    <div class="flex items-center gap-3">
                        <span class="text-text-secondary text-sm hidden sm:block">${dayMenu ? dayMenu.main_dish : 'Ingen menu'}</span>
                        <span class="text-text-secondary text-xs" id="toggle-icon-${day}">${isExpanded ? '<i class="fa-solid fa-chevron-down"></i>' : '<i class="fa-solid fa-chevron-right"></i>'}</span>
                    </div>
                </div>
                <div class="border-t border-white/10 p-4 ${isExpanded ? 'block' : 'hidden'}" id="menu-content-${day}">
                    ${dayMenu ? `
                        <div class="space-y-4">
                            <div>
                                <div class="text-xs text-text-secondary uppercase tracking-wider mb-1">Varm ret</div>
                                <div class="text-text-primary">
                                    <strong>${dayMenu.main_dish}</strong>
                                    ${dayMenu.main_dish_description ? `<br><span class="text-text-secondary text-sm">${dayMenu.main_dish_description}</span>` : ''}
                                </div>
                            </div>
                            ${dayMenu.toppings && dayMenu.toppings.length > 0 ? `
                                <div>
                                    <div class="text-xs text-text-secondary uppercase tracking-wider mb-1">Paalag</div>
                                    <div class="text-text-primary text-sm">${dayMenu.toppings.join('<br>')}</div>
                                </div>
                            ` : ''}
                            ${dayMenu.salads && dayMenu.salads.length > 0 ? `
                                <div>
                                    <div class="text-xs text-text-secondary uppercase tracking-wider mb-1">Salat</div>
                                    <div class="text-text-primary text-sm">${dayMenu.salads.join('<br>')}</div>
                                </div>
                            ` : ''}
                        </div>
                    ` : '<div class="text-text-secondary text-sm">Ingen menu for denne dag</div>'}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function renderEmptyMenu() {
    const container = document.getElementById('menu-container');
    container.innerHTML = `
        <div class="flex flex-col items-center justify-center py-8 text-center">
            <p class="text-text-secondary mb-4">Ingen menu tilgangelig for denne uge.</p>
            <button class="px-4 py-2 bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition-colors" onclick="openMenuEditor()">Opret menu</button>
        </div>
    `;
}

function toggleMenuDay(day) {
    const content = document.getElementById(`menu-content-${day}`);
    const icon = document.getElementById(`toggle-icon-${day}`);

    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        content.classList.add('block');
        icon.innerHTML = '<i class="fa-solid fa-chevron-down"></i>';
    } else {
        content.classList.remove('block');
        content.classList.add('hidden');
        icon.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
    }
}

// ============================================
// Menu Editor
// ============================================
function openMenuEditor() {
    const modal = document.getElementById('menu-modal');
    const form = document.getElementById('menu-editor-form');

    const dayNames = ['mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag'];
    const dayLabels = {
        'mandag': 'Mandag',
        'tirsdag': 'Tirsdag',
        'onsdag': 'Onsdag',
        'torsdag': 'Torsdag',
        'fredag': 'Fredag'
    };

    const menuMap = {};
    if (currentMenuData) {
        currentMenuData.forEach(item => {
            menuMap[item.day_of_week] = item;
        });
    }

    let html = `
        <div class="mb-6">
            <p class="text-text-secondary">Redigerer menu for <strong class="text-text-primary">Uge ${currentWeekNumber}, ${currentYear}</strong></p>
        </div>
        <div class="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
    `;

    dayNames.forEach(day => {
        const dayMenu = menuMap[day] || {};

        html += `
            <div class="border-b border-white/10 pb-6 last:border-0">
                <h4 class="font-semibold text-text-primary mb-4">${dayLabels[day]}</h4>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label class="block text-sm font-medium text-text-secondary mb-1.5">Hovedret</label>
                        <input type="text" id="menu-${day}-main"
                               value="${dayMenu.main_dish || ''}"
                               placeholder="F.eks. Kylling i karry"
                               class="w-full px-4 py-2.5 bg-dark-bg border border-white/10 rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-colors">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-text-secondary mb-1.5">Beskrivelse</label>
                        <input type="text" id="menu-${day}-desc"
                               value="${dayMenu.main_dish_description || ''}"
                               placeholder="F.eks. Med ris og grontsager"
                               class="w-full px-4 py-2.5 bg-dark-bg border border-white/10 rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-colors">
                    </div>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-text-secondary mb-1.5">Paalag (adskilt med komma)</label>
                        <input type="text" id="menu-${day}-toppings"
                               value="${dayMenu.toppings ? dayMenu.toppings.join(', ') : ''}"
                               placeholder="F.eks. Skinke, Ost, Leverpostej"
                               class="w-full px-4 py-2.5 bg-dark-bg border border-white/10 rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-colors">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-text-secondary mb-1.5">Salater (adskilt med komma)</label>
                        <input type="text" id="menu-${day}-salads"
                               value="${dayMenu.salads ? dayMenu.salads.join(', ') : ''}"
                               placeholder="F.eks. Pastasalat, Dagens salat"
                               class="w-full px-4 py-2.5 bg-dark-bg border border-white/10 rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-colors">
                    </div>
                </div>
            </div>
        `;
    });

    html += `
        </div>
        <div class="flex gap-3 pt-6 border-t border-white/10 mt-6">
            <button class="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-text-secondary rounded-lg font-medium transition-colors" onclick="closeMenuEditor()">Annuller</button>
            <button class="flex-1 px-4 py-2.5 bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition-colors" onclick="saveMenu()">Gem menu</button>
        </div>
    `;

    form.innerHTML = html;
    modal.style.display = 'flex';
}

function closeMenuEditor() {
    document.getElementById('menu-modal').style.display = 'none';
}

async function saveMenu() {
    const dayNames = ['mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag'];

    const menu = dayNames.map(day => {
        const mainDish = document.getElementById(`menu-${day}-main`).value.trim();
        const description = document.getElementById(`menu-${day}-desc`).value.trim();
        const toppingsStr = document.getElementById(`menu-${day}-toppings`).value.trim();
        const saladsStr = document.getElementById(`menu-${day}-salads`).value.trim();

        return {
            day_of_week: day,
            main_dish: mainDish || 'Ingen menu',
            main_dish_description: description || null,
            toppings: toppingsStr ? toppingsStr.split(',').map(s => s.trim()).filter(s => s) : [],
            salads: saladsStr ? saladsStr.split(',').map(s => s.trim()).filter(s => s) : []
        };
    });

    try {
        const response = await fetch('/api/menu', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                week_number: currentWeekNumber,
                year: currentYear,
                menu: menu
            })
        });

        const data = await response.json();

        if (data.success) {
            closeMenuEditor();
            loadWeeklyMenu();
        } else {
            Modal.error('Fejl', data.error || 'Kunne ikke gemme menu');
        }
    } catch (error) {
        console.error('Error saving menu:', error);
        Modal.error('Fejl', 'Der opstod en fejl ved gemning af menu');
    }
}

// ============================================
// Notes
// ============================================
async function loadNotes() {
    try {
        const response = await fetch('/api/notes');
        const data = await response.json();

        if (data.success) {
            notesData = data.notes || [];
            renderNotes();
        }
    } catch (error) {
        console.error('Error loading notes:', error);
        renderEmptyNotes();
    }
}

function renderNotes() {
    const container = document.getElementById('notes-container');

    if (notesData.length === 0) {
        renderEmptyNotes();
        return;
    }

    const priorityLabels = {
        1: 'Høj',
        2: 'Normal',
        3: 'Lav',
    };

    const priorityClasses = {
        1: 'bg-red-500/20 text-red-400 border-red-500/30',
        2: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        3: 'bg-green-500/20 text-green-400 border-green-500/30',
    };

    const borderClasses = {
        1: 'border-l-red-500',
        2: 'border-l-yellow-500',
        3: 'border-l-green-500',
    };

    let html = notesData.map(note => `
        <div class="bg-dark-card border border-white/10 rounded-lg p-4 border-l-4 ${borderClasses[note.priority] || 'border-l-yellow-500'}">
            <div class="flex items-start justify-between gap-4 mb-2">
                <span class="px-2 py-0.5 text-xs rounded-full ${priorityClasses[note.priority] || priorityClasses[2]}">${priorityLabels[note.priority] || 'Normal'}</span>
                <div class="flex items-center gap-1">
                    <button class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-text-secondary transition-colors" onclick="editNote(${note.id})" title="Rediger">
                        <i class="fa-solid fa-pen-to-square text-sm"></i>
                    </button>
                    <button class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-green-500/10 text-green-400 transition-colors" onclick="completeNote(${note.id})" title="Marker faerdig">
                        <i class="fa-solid fa-check text-sm"></i>
                    </button>
                    <button class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-red-400 transition-colors" onclick="deleteNote(${note.id})" title="Slet">
                        <i class="fa-solid fa-trash-can text-sm"></i>
                    </button>
                </div>
            </div>
            <div class="font-medium text-text-primary mb-1">${escapeHtml(note.title)}</div>
            ${note.content ? `<div class="text-text-secondary text-sm mb-3">${escapeHtml(note.content)}</div>` : ''}
            <div class="flex items-center gap-3 text-xs text-text-secondary">
                <span>${escapeHtml(note.created_by_name)}</span>
                <span>${formatDate(note.created_at)}</span>
            </div>
        </div>
    `).join('');

    container.innerHTML = html;
}

function renderEmptyNotes() {
    const container = document.getElementById('notes-container');
    container.innerHTML = `
        <div class="flex flex-col items-center justify-center py-8 text-center">
            <p class="text-text-secondary">Ingen noter endnu.</p>
        </div>
    `;
}

function openNoteEditor(noteId = null) {
    const modal = document.getElementById('note-modal');
    const form = document.getElementById('note-editor-form');
    const title = document.getElementById('note-modal-title');

    editingNoteId = noteId;
    const note = noteId ? notesData.find(n => n.id === noteId) : null;

    title.textContent = note ? 'Rediger Note' : 'Tilføj Note';

    form.innerHTML = `
        <div class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-text-secondary mb-1.5">Titel</label>
                <input type="text" id="note-title" value="${note ? escapeHtml(note.title) : ''}" placeholder="Indtast titel..." class="w-full px-4 py-2.5 bg-dark-bg border border-white/10 rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-colors">
            </div>
            <div>
                <label class="block text-sm font-medium text-text-secondary mb-1.5">Indhold (valgfrit)</label>
                <textarea id="note-content" rows="3" placeholder="Indtast beskrivelse..." class="w-full px-4 py-2.5 bg-dark-bg border border-white/10 rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-colors resize-none">${note ? escapeHtml(note.content || '') : ''}</textarea>
            </div>
            <div>
                <label class="block text-sm font-medium text-text-secondary mb-1.5">Prioritet</label>
                <select id="note-priority" class="w-full px-4 py-2.5 bg-dark-bg border border-white/10 rounded-lg text-text-primary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-colors">
                    <option value="1" ${note?.priority === 1 ? 'selected' : ''}>1 - Hoj</option>
                    <option value="2" ${(!note || note.priority === 2) ? 'selected' : ''}>2 - Normal</option>
                    <option value="3" ${note?.priority === 3 ? 'selected' : ''}>3 - Lav</option>
                </select>
            </div>
        </div>
        <div class="flex gap-3 pt-6 border-t border-white/10 mt-6">
            <button class="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-text-secondary rounded-lg font-medium transition-colors" onclick="closeNoteEditor()">Annuller</button>
            <button class="flex-1 px-4 py-2.5 bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition-colors" onclick="saveNote()">Gem note</button>
        </div>
    `;

    modal.style.display = 'flex';
}

function closeNoteEditor() {
    document.getElementById('note-modal').style.display = 'none';
    editingNoteId = null;
}

function editNote(noteId) {
    openNoteEditor(noteId);
}

async function saveNote() {
    const title = document.getElementById('note-title').value.trim();
    const content = document.getElementById('note-content').value.trim();
    const priority = parseInt(document.getElementById('note-priority').value);

    if (!title) {
        Modal.alert('Manglende felt', 'Titel er påkrævet', 'warning');
        return;
    }

    try {
        const url = editingNoteId ? `/api/notes/${editingNoteId}` : '/api/notes';
        const method = editingNoteId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content, priority })
        });

        const data = await response.json();

        if (data.success) {
            closeNoteEditor();
            loadNotes();
        } else {
            Modal.error('Fejl', data.error || 'Kunne ikke gemme note');
        }
    } catch (error) {
        console.error('Error saving note:', error);
        Modal.error('Fejl', 'Der opstod en fejl ved gemning af note');
    }
}

async function completeNote(noteId) {
    const confirmed = await Modal.confirm('Færdiggør note', 'Marker denne note som færdig?', 'info');
    if (!confirmed) return;

    try {
        const response = await fetch(`/api/notes/${noteId}/complete`, {
            method: 'PUT'
        });

        const data = await response.json();

        if (data.success) {
            loadNotes();
        } else {
            Modal.error('Fejl', data.error || 'Kunne ikke markere note som færdig');
        }
    } catch (error) {
        console.error('Error completing note:', error);
        Modal.error('Fejl', 'Der opstod en fejl ved markering af note');
    }
}

async function deleteNote(noteId) {
    const confirmed = await Modal.show({
        type: 'danger',
        title: 'Slet note',
        message: 'Er du sikker på at du vil slette denne note?',
        confirmText: 'Ja, slet',
        cancelText: 'Annuller'
    });
    if (!confirmed) return;

    try {
        const response = await fetch(`/api/notes/${noteId}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            loadNotes();
        } else {
            Modal.error('Fejl', data.error || 'Kunne ikke slette note');
        }
    } catch (error) {
        console.error('Error deleting note:', error);
        Modal.error('Fejl', 'Der opstod en fejl ved sletning af note');
    }
}

// ============================================
// Utility Functions
// ============================================
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
}

// Close modals on outside click
document.getElementById('menu-modal')?.addEventListener('click', function(e) {
    if (e.target === this) {
        closeMenuEditor();
    }
});

document.getElementById('note-modal')?.addEventListener('click', function(e) {
    if (e.target === this) {
        closeNoteEditor();
    }
});
