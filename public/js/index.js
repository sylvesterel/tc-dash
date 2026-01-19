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
                    errorsBadge.className = 'stat-badge';
                    if (stats.unresolved_errors.count === 0) {
                        errorsBadge.classList.add('success');
                    } else if (stats.unresolved_errors.count <= 5) {
                        errorsBadge.classList.add('warning');
                    } else {
                        errorsBadge.classList.add('danger');
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
            <div class="menu-day-accordion ${isToday ? 'today' : ''} ${isExpanded ? 'expanded' : 'collapsed'}"
                 data-day="${day}">
                <div class="menu-day-header" onclick="toggleMenuDay('${day}')">
                    <div class="day-info">
                        <span class="day-name">${dayLabels[day]}</span>
                        ${isToday ? '<span class="today-badge">I dag</span>' : ''}
                    </div>
                    <div class="day-preview">
                        <span class="main-dish-preview">${dayMenu ? dayMenu.main_dish : 'Ingen menu'}</span>
                        <span class="toggle-icon">${isExpanded ? '<i class="fa-solid fa-angles-down"></i>' : '<i class="fa-solid fa-angles-right"></i>'}</span>
                    </div>
                </div>
                <div class="menu-day-content" style="display: ${isExpanded ? 'block' : 'none'}">
                    ${dayMenu ? `
                        <div class="menu-details">
                            <div class="menu-section">
                                <div class="section-label">Varm ret</div>
                                <div class="section-content">
                                    <strong>${dayMenu.main_dish}</strong>
                                    ${dayMenu.main_dish_description ? `<br><span class="description">${dayMenu.main_dish_description}</span>` : ''}
                                </div>
                            </div>
                            ${dayMenu.toppings && dayMenu.toppings.length > 0 ? `
                                <div class="menu-section">
                                    <div class="section-label">Paalag</div>
                                    <div class="section-content">
                                        ${dayMenu.toppings.join('<br>')}
                                    </div>
                                </div>
                            ` : ''}
                            ${dayMenu.salads && dayMenu.salads.length > 0 ? `
                                <div class="menu-section">
                                    <div class="section-label">Salat</div>
                                    <div class="section-content">
                                        ${dayMenu.salads.join('<br>')}
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    ` : '<div class="no-menu">Ingen menu for denne dag</div>'}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function renderEmptyMenu() {
    const container = document.getElementById('menu-container');
    container.innerHTML = `
        <div class="empty-menu">
            <p>Ingen menu tilgangelig for denne uge.</p>
            <button class="btn-primary" onclick="openMenuEditor()">Opret menu</button>
        </div>
    `;
}

function toggleMenuDay(day) {
    const accordion = document.querySelector(`.menu-day-accordion[data-day="${day}"]`);
    const content = accordion.querySelector('.menu-day-content');
    const icon = accordion.querySelector('.toggle-icon');

    if (accordion.classList.contains('expanded')) {
        accordion.classList.remove('expanded');
        accordion.classList.add('collapsed');
        content.style.display = 'none';
        icon.innerHTML = '<i class="fa-solid fa-angles-right"></i>';
    } else {
        accordion.classList.remove('collapsed');
        accordion.classList.add('expanded');
        content.style.display = 'block';
        icon.innerHTML = '<i class="fa-solid fa-angles-down"></i>';
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
        <div class="menu-editor-header">
            <p>Redigerer menu for <strong>Uge ${currentWeekNumber}, ${currentYear}</strong></p>
        </div>
        <div class="menu-editor-days">
    `;

    dayNames.forEach(day => {
        const dayMenu = menuMap[day] || {};

        html += `
            <div class="editor-day-section">
                <h4>${dayLabels[day]}</h4>
                <div class="form-row">
                    <div class="form-field">
                        <label>Hovedret</label>
                        <input type="text" id="menu-${day}-main"
                               value="${dayMenu.main_dish || ''}"
                               placeholder="F.eks. Kylling i karry">
                    </div>
                    <div class="form-field">
                        <label>Beskrivelse</label>
                        <input type="text" id="menu-${day}-desc"
                               value="${dayMenu.main_dish_description || ''}"
                               placeholder="F.eks. Med ris og grontsager">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-field">
                        <label>Paalag (adskilt med komma)</label>
                        <input type="text" id="menu-${day}-toppings"
                               value="${dayMenu.toppings ? dayMenu.toppings.join(', ') : ''}"
                               placeholder="F.eks. Skinke, Ost, Leverpostej">
                    </div>
                    <div class="form-field">
                        <label>Salater (adskilt med komma)</label>
                        <input type="text" id="menu-${day}-salads"
                               value="${dayMenu.salads ? dayMenu.salads.join(', ') : ''}"
                               placeholder="F.eks. Pastasalat, Dagens salat">
                    </div>
                </div>
            </div>
        `;
    });

    html += `
        </div>
        <div class="modal-actions">
            <button class="btn-secondary" onclick="closeMenuEditor()">Annuller</button>
            <button class="btn-primary" onclick="saveMenu()">Gem menu</button>
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
        1: 'priority-critical',
        2: 'priority-normal',
        3: 'priority-low',
    };

    let html = notesData.map(note => `
        <div class="note-item ${priorityClasses[note.priority] || 'priority-normal'}">
            <div class="note-header">
                <span class="note-priority-badge ${priorityClasses[note.priority]}">${priorityLabels[note.priority] || 'Normal'}</span>
                <div class="note-actions">
                    <button class="note-action-btn" onclick="editNote(${note.id})" title="Rediger"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button class="note-action-btn" onclick="completeNote(${note.id})" title="Marker faerdig"><i class="fa-solid fa-check"></i></button>
                    <button class="note-action-btn delete" onclick="deleteNote(${note.id})" title="Slet"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            </div>
            <div class="note-title">${escapeHtml(note.title)}</div>
            ${note.content ? `<div class="note-content">${escapeHtml(note.content)}</div>` : ''}
            <div class="note-meta">
                <span class="note-author">${escapeHtml(note.created_by_name)}</span>
                <span class="note-date">${formatDate(note.created_at)}</span>
            </div>
        </div>
    `).join('');

    container.innerHTML = html;
}

function renderEmptyNotes() {
    const container = document.getElementById('notes-container');
    container.innerHTML = `
        <div class="empty-notes">
            <p>Ingen noter endnu.</p>
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
        <div class="form-field">
            <label>Titel</label>
            <input type="text" id="note-title" value="${note ? escapeHtml(note.title) : ''}" placeholder="Indtast titel...">
        </div>
        <div class="form-field">
            <label>Indhold (valgfrit)</label>
            <textarea id="note-content" rows="3" placeholder="Indtast beskrivelse...">${note ? escapeHtml(note.content || '') : ''}</textarea>
        </div>
        <div class="form-field">
            <label>Prioritet</label>
            <select id="note-priority">
                <option value="1" ${note?.priority === 1 ? 'selected' : ''}>1 - Hoj</option>
                <option value="2" ${(!note || note.priority === 2) ? 'selected' : ''}>2 - Normal</option>
                <option value="3" ${note?.priority === 3 ? 'selected' : ''}>3 - Lav</option>
            </select>
        </div>
        <div class="modal-actions">
            <button class="btn-secondary" onclick="closeNoteEditor()">Annuller</button>
            <button class="btn-primary" onclick="saveNote()">Gem note</button>
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
