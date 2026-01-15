// ============================================
// Sluse Management - Integration med gammel TourCare database
// ============================================

// Modal System
const Modal = {
    overlay: null,
    modal: null,
    icon: null,
    title: null,
    message: null,
    buttons: null,
    cancelBtn: null,
    confirmBtn: null,
    resolvePromise: null,

    init() {
        this.overlay = document.getElementById('modalOverlay');
        this.modal = document.getElementById('modal');
        this.icon = document.getElementById('modalIcon');
        this.title = document.getElementById('modalTitle');
        this.message = document.getElementById('modalMessage');
        this.buttons = document.getElementById('modalButtons');
        this.cancelBtn = document.getElementById('modalCancel');
        this.confirmBtn = document.getElementById('modalConfirm');

        if (!this.overlay) return;

        this.cancelBtn.addEventListener('click', () => this.close(false));
        this.confirmBtn.addEventListener('click', () => this.close(true));
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close(false);
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.overlay.classList.contains('show')) {
                this.close(false);
            }
        });
    },

    show(options) {
        const {
            type = 'info',
            title = 'Information',
            message = '',
            confirmText = 'OK',
            cancelText = 'Annuller',
            showCancel = true
        } = options;

        const icons = {
            warning: '!',
            danger: 'X',
            success: '✓',
            info: 'i'
        };

        this.icon.innerHTML = icons[type] || icons.info;
        this.icon.className = 'modal-icon ' + type;
        this.title.textContent = title;
        this.message.innerHTML = message;
        this.confirmBtn.textContent = confirmText;
        this.confirmBtn.className = 'modal-btn modal-btn-confirm ' + type;

        if (showCancel) {
            this.cancelBtn.style.display = 'block';
            this.cancelBtn.textContent = cancelText;
            this.buttons.classList.remove('single');
        } else {
            this.cancelBtn.style.display = 'none';
            this.buttons.classList.add('single');
        }

        this.overlay.classList.add('show');
        this.confirmBtn.focus();

        return new Promise((resolve) => {
            this.resolvePromise = resolve;
        });
    },

    close(result) {
        this.overlay.classList.remove('show');
        if (this.resolvePromise) {
            this.resolvePromise(result);
            this.resolvePromise = null;
        }
    },

    async confirm(title, message, type = 'warning') {
        return this.show({
            type,
            title,
            message,
            confirmText: 'Ja, fortsaet',
            cancelText: 'Annuller',
            showCancel: true
        });
    },

    async alert(title, message, type = 'info') {
        return this.show({
            type,
            title,
            message,
            confirmText: 'OK',
            showCancel: false
        });
    },

    async success(title, message) {
        return this.alert(title, message, 'success');
    },

    async error(title, message) {
        return this.alert(title, message, 'danger');
    }
};

// ============================================
// Sluse Manager
// ============================================
const SluseManager = {
    data: [],
    rentmanData: [],
    rentmanLoaded: false,
    selectedSluse: null,

    // Fixed colors from old system
    colors: {
        'Sluse1': '#703817',
        'Sluse2': '#FF0000',
        'Sluse3': '#FFA500',
        'Sluse4': '#FFFF00',
        'Sluse5': '#008000',
        'Sluse6': '#0000FF',
        'Sluse7': '#EE82EE',
        'Reol1': '#808080',
        'Reol2': '#000000',
    },

    displayNames: {
        'Sluse1': 'Bås #1',
        'Sluse2': 'Bås #2',
        'Sluse3': 'Bås #3',
        'Sluse4': 'Bås #4',
        'Sluse5': 'Bås #5',
        'Sluse6': 'Bås #6',
        'Sluse7': 'Bås #7',
        'Reol1': 'Reol #8',
        'Reol2': 'Reol #9',
    },

    init() {
        Modal.init();
        this.loadData();
        this.loadRentmanData();
        this.attachEventListeners();
    },

    async loadData() {
        try {
            const res = await fetch('/api/sluse');
            const result = await res.json();

            if (result.success) {
                this.data = result.data;
                this.renderStallList();
            }
        } catch (err) {
            console.error('Error loading sluse data:', err);
            Modal.error('Fejl', 'Kunne ikke indlaese data');
        }
    },

    async loadRentmanData() {
        try {
            const res = await fetch('/api/rentman/projects');
            const result = await res.json();

            if (result.success) {
                this.rentmanData = result.data || [];
                this.rentmanLoaded = true;
                // Update dropdown if editor is open
                this.updateRentmanDropdown();
            }
        } catch (err) {
            console.error('Error loading Rentman data:', err);
        }
    },

    attachEventListeners() {
        const searchInput = document.getElementById('searchStalls');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.renderStallList(e.target.value);
            });
        }
    },

    renderStallList(filter = '') {
        const stallList = document.getElementById('stallList');
        if (!stallList) return;

        stallList.innerHTML = '';

        const filtered = this.data.filter(item => {
            const searchTerm = filter.toLowerCase();
            const displayName = this.displayNames[item.slusenavn] || item.slusenavn;
            const kunde = item.Kunde || '';
            return displayName.toLowerCase().includes(searchTerm) ||
                   kunde.toLowerCase().includes(searchTerm) ||
                   item.slusenavn.toLowerCase().includes(searchTerm);
        });

        filtered.forEach(item => {
            const isActive = this.selectedSluse === item.slusenavn;
            const hasContent = item.Kunde && item.Kunde.trim() !== '';
            const color = this.colors[item.slusenavn] || '#808080';
            const statusColor = hasContent ? "#d62f3d" : "var(--color-success)"

            const stallItem = document.createElement('button');
            stallItem.className = `stall-item ${isActive ? 'active' : ''} ${hasContent ? 'optaget' : 'ledig'}`;
            stallItem.innerHTML = `
                <i class="fa-solid fa-box" style="color: var(--border-light); font-size: 21px;"></i>
                <div class="stall-info">
                    <span class="stall-name">${this.displayNames[item.slusenavn] || item.slusenavn}</span>
                    <span class="stall-status">${hasContent ? item.Kunde : '— Ledig —'}</span>
                </div>
                <div class="stall-indicator" style="background-color: ${statusColor}; border: 2px solid ${statusColor};"></div>
            `;
            stallItem.onclick = () => this.selectSluse(item.slusenavn);
            stallList.appendChild(stallItem);
        });
    },

    selectSluse(slusenavn) {
        this.selectedSluse = slusenavn;
        this.renderStallList();
        this.renderEditor(slusenavn);
    },

    updateRentmanDropdown() {
        // No longer using select - using custom picker
    },

    initProjectPicker() {
        const trigger = document.getElementById('projectPickerTrigger');
        const dropdown = document.getElementById('projectPickerDropdown');
        const search = document.getElementById('projectPickerSearch');

        if (!trigger || !dropdown) return;

        // Toggle dropdown
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = dropdown.classList.contains('show');
            if (isOpen) {
                this.closeProjectPicker();
            } else {
                this.openProjectPicker();
            }
        });

        // Search functionality
        if (search) {
            search.addEventListener('input', (e) => {
                this.filterProjects(e.target.value);
            });
        }

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.project-picker-wrapper')) {
                this.closeProjectPicker();
            }
        });

        // Render initial list
        this.renderProjectList();
    },

    openProjectPicker() {
        const trigger = document.getElementById('projectPickerTrigger');
        const dropdown = document.getElementById('projectPickerDropdown');
        const search = document.getElementById('projectPickerSearch');

        trigger?.classList.add('active');
        dropdown?.classList.add('show');
        search?.focus();
    },

    closeProjectPicker() {
        const trigger = document.getElementById('projectPickerTrigger');
        const dropdown = document.getElementById('projectPickerDropdown');

        trigger?.classList.remove('active');
        dropdown?.classList.remove('show');
    },

    filterProjects(searchTerm) {
        const filtered = this.rentmanData.filter(item => {
            const name = (item.sp_name || '').toLowerCase();
            return name.includes(searchTerm.toLowerCase());
        });
        this.renderProjectList(filtered);
    },

    renderProjectList(items = null) {
        const list = document.getElementById('projectPickerList');
        if (!list) return;

        const data = items || this.rentmanData;

        if (!this.rentmanLoaded) {
            list.innerHTML = `
                <div class="project-picker-empty">
                    <div class="empty-icon"><i class="fa-solid fa-hourglass-end"></i></div>
                    <p>Indlæser projekter...</p>
                </div>
            `;
            return;
        }

        if (data.length === 0) {
            list.innerHTML = `
                <div class="project-picker-empty">
                    <div class="empty-icon"><i class="fa-regular fa-folder-open"></i></div>
                    <p>Ingen projekter fundet</p>
                </div>
            `;
            return;
        }

        list.innerHTML = data.map((item, idx) => {
            const originalIdx = this.rentmanData.indexOf(item);
            const statusClass = item.status == 4 ? 'status-out' : item.status == 5 ? 'status-in' : '';
            const statusText = item.status == 4 ? 'Ud' : item.status == 5 ? 'Ind' : '';

            return `
                <div class="project-picker-item" onclick="SluseManager.selectProject(${originalIdx})">
                    <div class="project-name">${this.escapeHtml(item.sp_name)}</div>
                    <div class="project-meta">
                        ${statusText ? `<span class="project-status ${statusClass}">${statusText}</span>` : ''}
                        <span>${item.st_sp_up || '?'} → ${item.end_sp_up || '?'}</span>
                    </div>
                </div>
            `;
        }).join('');
    },

    selectProject(idx) {
        const item = this.rentmanData[idx];
        if (!item) return;

        // Update trigger text
        const trigger = document.getElementById('projectPickerTrigger');
        if (trigger) {
            trigger.innerHTML = `
                <span>${this.escapeHtml(item.sp_name)}</span>
                <span class="chevron">▼</span>
            `;
        }

        // Set form values
        const kundeInput = document.getElementById('sluseKunde');
        if (kundeInput) kundeInput.value = item.sp_name || '';

        const datoInput = document.getElementById('sluseDato');
        if (datoInput) {
            const udDato = item.st_sp_up || '';
            const indDato = item.end_sp_up || '';

            if (item.status == 5) {
                datoInput.value = `Ind: ${indDato}`;
            } else {
                datoInput.value = `Ud: ${udDato} | Ind: ${indDato}`;
            }
        }

        // Close dropdown
        this.closeProjectPicker();

        // Clear search
        const search = document.getElementById('projectPickerSearch');
        if (search) search.value = '';
        this.renderProjectList();
    },

    renderEditor(slusenavn) {
        const editor = document.getElementById('stallEditor');
        if (!editor) return;

        if (!slusenavn) {
            editor.innerHTML = `
                <div class="editor-placeholder">
                    <div class="placeholder-icon">-</div>
                    <h3>Vælg en bås</h3>
                    <p>Vælg en bås fra listen til venstre for at redigere information.</p>
                </div>
            `;
            return;
        }

        const item = this.data.find(s => s.slusenavn === slusenavn);
        if (!item) return;

        const color = this.colors[slusenavn] || '#808080';
        const displayName = this.displayNames[slusenavn] || slusenavn;
        const hasContent = item.Kunde && item.Kunde.trim() !== '';

        const statusBadge = hasContent
            ? '<div class="status-badge occupied">Optaget</div>'
            : '<div class="status-badge available">Ledig</div>';

        editor.innerHTML = `
            <div class="editor-content">
                <div class="editor-header">
                    <div class="breadcrumb">
                        <span>Sluse</span>
                        <span>/</span>
                        <span class="active-crumb">${displayName}</span>
                    </div>
                    <div class="editor-title-row">
                        <div>
                            <h2>Rediger ${displayName}</h2>
                            <p>Opdater information for denne bås.</p>
                        </div>
                        ${statusBadge}
                    </div>
                </div>

                <div class="editor-card">
                    <div class="color-stripe" style="background-color: ${color}"></div>
                    <div class="editor-form">
                        <div class="form-section">
                            <div class="form-field">
                                <label>Vælg fra Rentman</label>
                                <div class="project-picker-wrapper">
                                    <div class="project-picker-trigger" id="projectPickerTrigger">
                                        <span class="placeholder">Søg efter projekt...</span>
                                        <span class="chevron">▼</span>
                                    </div>
                                    <div class="project-picker-dropdown" id="projectPickerDropdown">
                                        <input type="text" class="project-picker-search" id="projectPickerSearch" placeholder="Søg projekt...">
                                        <div class="project-picker-list" id="projectPickerList">
                                            <!-- Items rendered by JS -->
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="divider"></div>

                            <div class="form-field">
                                <label for="sluseKunde">
                                    Kunde / Artist
                                </label>
                                <input type="text" id="sluseKunde" value="${this.escapeHtml(item.Kunde || '')}" placeholder="Indtast kunde eller artist navn">
                            </div>
                            <div class="form-field-two"> 
                                <div class="form-field">
                                    <label for="sluseDetaljer">
                                        Detaljer / Kolli
                                    </label>
                                    <input type="text" id="sluseDetaljer" value="${this.escapeHtml(item.Detaljer || '')}" placeholder="Indtast detaljer eller kolli antal">
                                </div>
                                <div class="form-field">
                                    <label for="sluseDato">
                                        Dato (ud/ind)
                                    </label>
                                    <input type="text" id="sluseDato" value="${this.escapeHtml(item.Dato || '')}" placeholder="F.eks. Ud: 01/01 | Ind: 05/01">
                                </div>
                            </div>
                        </div>

                        <div class="divider"></div>

                        <div class="form-section">
                            <div class="color-section-header">
                                <label>
                                    Bås Farve
                                </label>
                                <p class="field-description">Farven er fast tildelt denne bås.</p>
                            </div>
                            <div class="color-preview" style="display: flex; align-items: center; gap: 1rem; margin-top: 0.5rem;">
                                <div style="width: 40px; height: 40px; border-radius: 8px; background-color: ${color}; border: 2px solid rgba(255,255,255,0.2);"></div>
                            </div>
                        </div>

                        <div class="form-actions">
                            <button class="btn-secondary" onclick="SluseManager.clearSluse()">Ryd bås</button>
                            <button class="btn-primary" onclick="SluseManager.saveCurrentSluse()">
                                Gem ændringer
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Initialize project picker
        setTimeout(() => this.initProjectPicker(), 0);
    },

    async saveCurrentSluse() {
        if (!this.selectedSluse) return;

        const kunde = document.getElementById('sluseKunde')?.value || '';
        const detaljer = document.getElementById('sluseDetaljer')?.value || '';
        const dato = document.getElementById('sluseDato')?.value || '';

        try {
            const res = await fetch(`/api/sluse/${this.selectedSluse}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ Kunde: kunde, Detaljer: detaljer, Dato: dato })
            });

            const result = await res.json();

            if (result.success) {
                await Modal.success('Gemt', `<strong>${this.displayNames[this.selectedSluse]}</strong> er blevet opdateret.`);
                await this.loadData();
                this.selectSluse(this.selectedSluse);
            } else {
                await Modal.error('Fejl', result.error || 'Kunne ikke gemme');
            }
        } catch (err) {
            console.error('Error saving:', err);
            await Modal.error('Fejl', 'Der opstod en fejl ved gemning');
        }
    },

    async clearSluse() {
        if (!this.selectedSluse) return;

        const displayName = this.displayNames[this.selectedSluse];
        const confirmed = await Modal.show({
            type: 'danger',
            title: 'Ryd bås',
            message: `Er du sikker paa at du vil rydde<br><strong>${displayName}</strong>?<br><br>Alle felter vil blive toemt.`,
            confirmText: 'Ja, ryd bås',
            cancelText: 'Annuller'
        });

        if (!confirmed) return;

        try {
            const res = await fetch(`/api/sluse/${this.selectedSluse}/clear`, {
                method: 'DELETE'
            });

            const result = await res.json();

            if (result.success) {
                await Modal.success('Ryddet', `<strong>${displayName}</strong> er nu ledig.`);
                await this.loadData();
                this.selectSluse(this.selectedSluse);
            } else {
                await Modal.error('Fejl', result.error || 'Kunne ikke rydde');
            }
        } catch (err) {
            console.error('Error clearing:', err);
            await Modal.error('Fejl', 'Der opstod en fejl');
        }
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => SluseManager.init());
} else {
    SluseManager.init();
}
