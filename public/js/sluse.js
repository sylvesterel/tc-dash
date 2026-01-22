// ============================================
// Sluse Management - Integration med gammel TourCare database
// ============================================
// Bruger global Modal fra modal.js

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
            } else {
                // API returned an error, still mark as loaded to show empty state
                this.rentmanData = [];
                this.rentmanLoaded = true;
                console.warn('Rentman data not available:', result.error || 'Unknown error');
            }
        } catch (err) {
            // Network or parsing error, mark as loaded to show empty state
            this.rentmanData = [];
            this.rentmanLoaded = true;
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
            const statusColor = hasContent ? "bg-red-500" : "bg-green-500";

            const stallItem = document.createElement('button');
            stallItem.className = `w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${isActive ? 'bg-primary/20 border border-primary/50' : 'bg-dark-card border border-white/10 hover:bg-white/5'}`;
            stallItem.innerHTML = `
                <i class="fa-solid fa-box text-text-secondary text-xl"></i>
                <div class="flex-1 min-w-0">
                    <span class="block text-text-primary font-medium">${this.displayNames[item.slusenavn] || item.slusenavn}</span>
                    <span class="block text-sm text-text-secondary truncate">${hasContent ? item.Kunde : '— Ledig —'}</span>
                </div>
                <div class="w-3 h-3 rounded-full ${statusColor} flex-shrink-0"></div>
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
            const isOpen = dropdown.classList.contains('block');
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

        trigger?.classList.add('border-primary/50');
        dropdown?.classList.remove('hidden');
        dropdown?.classList.add('block');
        search?.focus();
    },

    closeProjectPicker() {
        const trigger = document.getElementById('projectPickerTrigger');
        const dropdown = document.getElementById('projectPickerDropdown');

        trigger?.classList.remove('border-primary/50');
        dropdown?.classList.add('hidden');
        dropdown?.classList.remove('block');
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
                <div class="flex flex-col items-center justify-center py-8 text-center">
                    <div class="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                        <i class="fa-solid fa-hourglass-end text-text-secondary"></i>
                    </div>
                    <p class="text-text-secondary text-sm">Indlæser projekter...</p>
                </div>
            `;
            return;
        }

        if (data.length === 0) {
            list.innerHTML = `
                <div class="flex flex-col items-center justify-center py-8 text-center">
                    <div class="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                        <i class="fa-regular fa-folder-open text-text-secondary"></i>
                    </div>
                    <p class="text-text-secondary text-sm">Ingen projekter fundet</p>
                </div>
            `;
            return;
        }

        list.innerHTML = data.map((item, idx) => {
            const originalIdx = this.rentmanData.indexOf(item);
            const statusClass = item.status == 4 ? 'bg-orange-500/20 text-orange-400' : item.status == 5 ? 'bg-green-500/20 text-green-400' : '';
            const statusText = item.status == 4 ? 'Ud' : item.status == 5 ? 'Ind' : '';

            return `
                <div class="p-3 hover:bg-white/5 cursor-pointer transition-colors border-b border-white/5 last:border-0" onclick="SluseManager.selectProject(${originalIdx})">
                    <div class="text-text-primary text-sm font-medium">${this.escapeHtml(item.sp_name)}</div>
                    <div class="flex items-center gap-2 mt-1">
                        ${statusText ? `<span class="px-2 py-0.5 text-xs rounded-full ${statusClass}">${statusText}</span>` : ''}
                        <span class="text-text-secondary text-xs">${item.st_sp_up || '?'} → ${item.end_sp_up || '?'}</span>
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
                <span class="text-text-primary">${this.escapeHtml(item.sp_name)}</span>
                <i class="fa-solid fa-chevron-down text-text-secondary text-xs"></i>
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
                <div class="flex flex-col items-center justify-center h-full text-center py-16">
                    <div class="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
                        <i class="fa-solid fa-hand-pointer text-3xl text-text-secondary"></i>
                    </div>
                    <h3 class="text-lg font-semibold text-text-primary mb-2">Vælg en bås</h3>
                    <p class="text-text-secondary">Vælg en bås fra listen til venstre for at redigere information.</p>
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
            ? '<span class="px-3 py-1 text-sm rounded-full bg-red-500/20 text-red-400">Optaget</span>'
            : '<span class="px-3 py-1 text-sm rounded-full bg-green-500/20 text-green-400">Ledig</span>';

        editor.innerHTML = `
            <div class="h-full flex flex-col">
                <div class="mb-6">
                    <div class="flex items-center gap-2 text-sm text-text-secondary mb-2">
                        <span>Sluse</span>
                        <span>/</span>
                        <span class="text-text-primary">${displayName}</span>
                    </div>
                    <div class="flex items-center justify-between">
                        <div>
                            <h2 class="text-xl font-semibold text-text-primary">Rediger ${displayName}</h2>
                            <p class="text-text-secondary text-sm mt-1">Opdater information for denne bås.</p>
                        </div>
                        ${statusBadge}
                    </div>
                </div>

                <div class="bg-dark-card border border-white/10 rounded-xl overflow-hidden flex-1">
                    <div class="h-2" style="background-color: ${color}"></div>
                    <div class="p-6 space-y-6">
                        <div>
                            <label class="block text-sm font-medium text-text-secondary mb-2">Vælg fra Rentman</label>
                            <div class="project-picker-wrapper relative">
                                <div class="flex items-center justify-between px-4 py-2.5 bg-dark-bg border border-white/10 rounded-lg cursor-pointer hover:border-white/20 transition-colors" id="projectPickerTrigger">
                                    <span class="text-text-secondary">Søg efter projekt...</span>
                                    <i class="fa-solid fa-chevron-down text-text-secondary text-xs"></i>
                                </div>
                                <div class="hidden absolute top-full left-0 right-0 mt-2 bg-dark-card border border-white/10 rounded-lg shadow-xl z-10 overflow-hidden" id="projectPickerDropdown">
                                    <input type="text" class="w-full px-4 py-3 bg-dark-bg border-b border-white/10 text-text-primary placeholder-text-secondary focus:outline-none" id="projectPickerSearch" placeholder="Søg projekt...">
                                    <div class="max-h-64 overflow-y-auto" id="projectPickerList">
                                        <!-- Items rendered by JS -->
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="h-px bg-white/10"></div>

                        <div>
                            <label class="block text-sm font-medium text-text-secondary mb-2" for="sluseKunde">Kunde / Artist</label>
                            <input type="text" id="sluseKunde" value="${this.escapeHtml(item.Kunde || '')}" placeholder="Indtast kunde eller artist navn" class="w-full px-4 py-2.5 bg-dark-bg border border-white/10 rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-colors">
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-text-secondary mb-2" for="sluseDetaljer">Detaljer / Kolli</label>
                                <input type="text" id="sluseDetaljer" value="${this.escapeHtml(item.Detaljer || '')}" placeholder="Indtast detaljer eller kolli antal" class="w-full px-4 py-2.5 bg-dark-bg border border-white/10 rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-colors">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-text-secondary mb-2" for="sluseDato">Dato (ud/ind)</label>
                                <input type="text" id="sluseDato" value="${this.escapeHtml(item.Dato || '')}" placeholder="F.eks. Ud: 01/01 | Ind: 05/01" class="w-full px-4 py-2.5 bg-dark-bg border border-white/10 rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-colors">
                            </div>
                        </div>

                        <div class="h-px bg-white/10"></div>

                        <div>
                            <label class="block text-sm font-medium text-text-secondary mb-1">Bås Farve</label>
                            <p class="text-text-secondary text-xs mb-3">Farven er fast tildelt denne bås.</p>
                            <div class="w-10 h-10 rounded-lg border-2 border-white/20" style="background-color: ${color}"></div>
                        </div>

                        <div class="flex gap-3 pt-4 border-t border-white/10">
                            <button class="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-text-secondary rounded-lg font-medium transition-colors" onclick="SluseManager.clearSluse()">
                                Ryd bås
                            </button>
                            <button class="flex-1 px-4 py-2.5 bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition-colors" onclick="SluseManager.saveCurrentSluse()">
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
