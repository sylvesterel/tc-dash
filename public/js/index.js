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
        loadNotes(),
        loadActivities()
    ]);
}

async function loadDashboardStats() {
    try {
        const response = await fetch('/api/stats');
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
    const dayIcons = {
        'mandag': 'fa-calendar-day',
        'tirsdag': 'fa-calendar-day',
        'onsdag': 'fa-calendar-day',
        'torsdag': 'fa-calendar-day',
        'fredag': 'fa-calendar-week'
    };

    const menuMap = {};
    menu.forEach(item => {
        menuMap[item.day_of_week] = item;
    });

    let html = '<div class="space-y-2">';

    dayNames.forEach(day => {
        const isToday = day === today;
        const dayMenu = menuMap[day];
        const isExpanded = isToday;
        const hasMenu = dayMenu && dayMenu.main_dish && dayMenu.main_dish !== 'Ingen menu';

        html += `
            <div class="group rounded-xl overflow-hidden transition-all duration-200 ${isToday ? 'bg-primary/10 ring-1 ring-primary/30' : 'bg-dark-hover/50 hover:bg-dark-hover'}"
                 data-day="${day}">
                <div class="flex items-center justify-between p-4 cursor-pointer transition-all duration-200" onclick="toggleMenuDay('${day}')">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-lg ${isToday ? 'bg-primary/20' : 'bg-white/5'} flex items-center justify-center transition-colors">
                            <i class="fa-solid ${dayIcons[day]} ${isToday ? 'text-primary' : 'text-text-secondary'}"></i>
                        </div>
                        <div>
                            <div class="flex items-center gap-2">
                                <span class="font-semibold ${isToday ? 'text-primary' : 'text-text-primary'}">${dayLabels[day]}</span>
                                ${isToday ? '<span class="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-primary text-white uppercase tracking-wider">I dag</span>' : ''}
                            </div>
                            <span class="text-text-secondary text-sm mt-0.5 block">${hasMenu ? dayMenu.main_dish : '<span class="italic opacity-60">Ingen menu</span>'}</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center transition-all duration-200 group-hover:bg-white/10" id="toggle-icon-${day}">
                            <i class="fa-solid fa-chevron-down text-text-secondary text-xs transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}"></i>
                        </span>
                    </div>
                </div>
                <div class="overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}" id="menu-content-${day}">
                    <div class="px-4 pb-4 pt-0">
                        <div class="h-px bg-white/10 mb-4"></div>
                        ${hasMenu ? `
                            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div class="bg-dark-card/50 rounded-lg p-3">
                                    <div class="flex items-center gap-2 mb-2">
                                        <i class="fa-solid fa-fire text-warning text-xs"></i>
                                        <span class="text-xs text-text-secondary uppercase tracking-wider font-medium">Varm ret</span>
                                    </div>
                                    <div class="text-text-primary font-medium">${dayMenu.main_dish}</div>
                                    ${dayMenu.main_dish_description ? `<div class="text-text-secondary text-sm mt-1">${dayMenu.main_dish_description}</div>` : ''}
                                </div>
                                ${dayMenu.toppings && dayMenu.toppings.length > 0 ? `
                                    <div class="bg-dark-card/50 rounded-lg p-3">
                                        <div class="flex items-center gap-2 mb-2">
                                            <i class="fa-solid fa-bread-slice text-warning text-xs"></i>
                                            <span class="text-xs text-text-secondary uppercase tracking-wider font-medium">Pålæg</span>
                                        </div>
                                        <div class="text-text-primary text-sm space-y-0.5">${dayMenu.toppings.map(t => `<div>${t}</div>`).join('')}</div>
                                    </div>
                                ` : ''}
                                ${dayMenu.salads && dayMenu.salads.length > 0 ? `
                                    <div class="bg-dark-card/50 rounded-lg p-3">
                                        <div class="flex items-center gap-2 mb-2">
                                            <i class="fa-solid fa-leaf text-success text-xs"></i>
                                            <span class="text-xs text-text-secondary uppercase tracking-wider font-medium">Salat</span>
                                        </div>
                                        <div class="text-text-primary text-sm space-y-0.5">${dayMenu.salads.map(s => `<div>${s}</div>`).join('')}</div>
                                    </div>
                                ` : ''}
                            </div>
                        ` : '<div class="text-text-secondary text-sm italic">Ingen menu for denne dag</div>'}
                    </div>
                </div>
            </div>
        `;
    });

    html += '</div>';
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
    const chevron = icon?.querySelector('i');

    if (content.classList.contains('max-h-0')) {
        content.classList.remove('max-h-0', 'opacity-0');
        content.classList.add('max-h-96', 'opacity-100');
        chevron?.classList.remove('-rotate-90');
    } else {
        content.classList.remove('max-h-96', 'opacity-100');
        content.classList.add('max-h-0', 'opacity-0');
        chevron?.classList.add('-rotate-90');
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
// Activity Feed
// ============================================
async function loadActivities() {
    try {
        const response = await fetch('/api/activities?limit=20');
        const data = await response.json();

        if (data.success) {
            renderActivities(data.activities || []);
        } else {
            renderEmptyActivities('Kunne ikke hente aktiviteter');
        }
    } catch (error) {
        console.error('Error loading activities:', error);
        renderEmptyActivities('Fejl ved indlæsning');
    }
}

function renderActivities(activities) {
    const container = document.getElementById('activity-container');
    if (!container) return;

    if (activities.length === 0) {
        renderEmptyActivities('Ingen aktiviteter endnu');
        return;
    }

    const actionIcons = {
        'create': { icon: 'fa-plus', color: 'text-green-400', bg: 'bg-green-500/20' },
        'update': { icon: 'fa-pen', color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
        'delete': { icon: 'fa-trash', color: 'text-red-400', bg: 'bg-red-500/20' },
        'login': { icon: 'fa-right-to-bracket', color: 'text-blue-400', bg: 'bg-blue-500/20' },
        'logout': { icon: 'fa-right-from-bracket', color: 'text-gray-400', bg: 'bg-gray-500/20' },
        'view': { icon: 'fa-eye', color: 'text-purple-400', bg: 'bg-purple-500/20' },
        'export': { icon: 'fa-download', color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
        'import': { icon: 'fa-upload', color: 'text-orange-400', bg: 'bg-orange-500/20' },
        'sync': { icon: 'fa-arrows-rotate', color: 'text-indigo-400', bg: 'bg-indigo-500/20' }
    };

    const actionLabels = {
        'create': 'oprettede',
        'update': 'opdaterede',
        'delete': 'slettede',
        'login': 'loggede ind',
        'logout': 'loggede ud',
        'view': 'så',
        'export': 'eksporterede',
        'import': 'importerede',
        'sync': 'synkroniserede'
    };

    const html = activities.map(activity => {
        const actionStyle = actionIcons[activity.action_type] || actionIcons['update'];
        const actionLabel = actionLabels[activity.action_type] || activity.action_type;
        const timeAgo = formatTimeAgo(activity.created_at);

        return `
            <div class="flex items-start gap-3 py-3 border-b border-white/5 last:border-0">
                <div class="w-8 h-8 rounded-lg ${actionStyle.bg} flex items-center justify-center flex-shrink-0">
                    <i class="fa-solid ${actionStyle.icon} ${actionStyle.color} text-xs"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-sm text-text-primary">
                        <span class="font-medium">${escapeHtml(activity.user_name || 'System')}</span>
                        <span class="text-text-secondary"> ${actionLabel} </span>
                        ${activity.resource_name ? `<span class="font-medium">${escapeHtml(activity.resource_name)}</span>` : ''}
                        ${activity.resource_type ? `<span class="text-text-secondary text-xs">(${activity.resource_type})</span>` : ''}
                    </p>
                    ${activity.description ? `<p class="text-xs text-text-secondary mt-0.5 truncate">${escapeHtml(activity.description)}</p>` : ''}
                </div>
                <span class="text-xs text-text-secondary whitespace-nowrap">${timeAgo}</span>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

function renderEmptyActivities(message) {
    const container = document.getElementById('activity-container');
    if (!container) return;

    container.innerHTML = `
        <div class="flex flex-col items-center justify-center py-8 text-center">
            <div class="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                <i class="fa-solid fa-chart-line text-text-secondary text-lg"></i>
            </div>
            <p class="text-text-secondary">${message}</p>
        </div>
    `;
}

function formatTimeAgo(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Lige nu';
    if (diffMins < 60) return `${diffMins} min siden`;
    if (diffHours < 24) return `${diffHours} time${diffHours > 1 ? 'r' : ''} siden`;
    if (diffDays < 7) return `${diffDays} dag${diffDays > 1 ? 'e' : ''} siden`;
    return formatDate(dateString);
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
