// ============================================
// SEAM Access Management - Kun oprettelse
// ============================================
// Bruger global Modal fra modal.js

const AccessManager = {
    seamUsers: [],
    projects: [],
    projectsLoaded: false,
    lastCreatedName: null,  // Gem navn til PDF generering
    processingActions: new Set(),  // Idempotency: track igangværende handlinger

    // Idempotency helpers
    isProcessing(actionId) {
        return this.processingActions.has(actionId);
    },

    startProcessing(actionId) {
        if (this.processingActions.has(actionId)) return false;
        this.processingActions.add(actionId);
        return true;
    },

    stopProcessing(actionId) {
        this.processingActions.delete(actionId);
    },

    init() {
        this.attachEventListeners();
        this.loadSeamUsers();
        this.setDefaultDates();
        this.loadProjects();
        this.initProjectPicker();
    },

    setDefaultDates() {
        const today = new Date();
        const startInput = document.getElementById('startDate');
        const endInput = document.getElementById('endDate');

        if (startInput) {
            startInput.value = today.toISOString().split('T')[0];
        }
        if (endInput) {
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            endInput.value = tomorrow.toISOString().split('T')[0];
        }
    },

    attachEventListeners() {
        const form = document.getElementById('accessForm');
        if (form) {
            form.addEventListener('submit', (e) => this.handleFormSubmit(e));
        }

        // Enter key support
        const inputs = document.querySelectorAll("#artistName, #startDate, #endDate");
        inputs.forEach(input => input.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                form?.requestSubmit();
            }
        }));

        // User search
        const searchUsers = document.getElementById('searchUsers');
        if (searchUsers) {
            searchUsers.addEventListener('input', (e) => {
                this.renderUsersList(e.target.value);
            });
        }
    },

    // Status box opdatering
    updateStatus(message, type = 'info') {
        const statusList = document.getElementById('statusList');
        if (!statusList) return;

        const typeColors = {
            'info': 'text-text-secondary',
            'success': 'text-green-400',
            'error': 'text-red-400'
        };

        const statusItem = document.createElement('div');
        statusItem.className = `flex items-center gap-3 py-1.5 ${typeColors[type] || typeColors['info']}`;

        const now = new Date();
        const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

        statusItem.innerHTML = `
            <span class="text-xs text-text-secondary opacity-60 font-mono">${time}</span>
            <span class="text-sm">${message}</span>
        `;

        statusList.appendChild(statusItem);
        statusList.scrollTop = statusList.scrollHeight;
    },

    clearStatus() {
        const statusList = document.getElementById('statusList');
        if (statusList) {
            statusList.innerHTML = '';
        }
    },

    showStatusBox() {
        const statusBox = document.getElementById('statusBox');
        if (statusBox) {
            statusBox.style.display = 'block';
        }
    },

    async handleFormSubmit(e) {
        e.preventDefault();

        const actionId = 'create-user';
        if (!this.startProcessing(actionId)) {
            return; // Allerede i gang med at oprette
        }

        const artistName = document.getElementById('artistName').value.trim();
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const submitBtn = document.querySelector('.btn-generate');

        if (!artistName || !startDate || !endDate) {
            this.showError('Udfyld alle felter!');
            this.stopProcessing(actionId);
            return;
        }

        if (new Date(startDate) > new Date(endDate)) {
            this.showError('Start dato skal være før slut dato.');
            this.stopProcessing(actionId);
            return;
        }

        // Gem navnet til PDF generering
        this.lastCreatedName = artistName;

        // Disable button and show status
        submitBtn.disabled = true;
        submitBtn.textContent = 'Opretter...';

        this.showStatusBox();
        this.clearStatus();
        this.updateStatus('Starter oprettelse...', 'info');

        try {
            const res = await fetch("/api/seam/create-user", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    artist_name: artistName,
                    start_date: new Date(startDate).toISOString(),
                    end_date: new Date(endDate).toISOString()
                })
            });

            const reader = res.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let done = false;
            let credentialId = null;

            while (!done) {
                const { value, done: readerDone } = await reader.read();
                done = readerDone;
                if (value) {
                    const text = decoder.decode(value);
                    text.split("\n").forEach(line => {
                        if (!line.trim()) return;

                        if (line.startsWith("STATUS:")) {
                            this.updateStatus(line.replace("STATUS:", ""), 'info');
                        } else if (line.startsWith("CREDENTIAL_ID:")) {
                            credentialId = line.replace("CREDENTIAL_ID:", "").trim();
                        } else if (line.startsWith("USER_ID:")) {
                            // User ID received
                        } else if (line.startsWith("ERROR:")) {
                            this.updateStatus(line.replace("ERROR:", ""), 'error');
                        }
                    });
                }
            }

            if (credentialId) {
                this.updateStatus('Poller for pinkode...', 'info');
                await this.pollForPin(credentialId);
            }

            // Reload users list
            await this.loadSeamUsers();

            // Reset form
            document.getElementById('accessForm').reset();
            this.setDefaultDates();

        } catch (err) {
            console.error('Create user error:', err);
            this.updateStatus('Fejl: ' + err.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Opret Adgang';
            this.stopProcessing(actionId);
        }
    },

    async pollForPin(credentialId) {
        let attempts = 0;
        const maxAttempts = 60; // 5 min max

        return new Promise((resolve) => {
            const interval = setInterval(async () => {
                attempts++;

                if (attempts > maxAttempts) {
                    this.updateStatus('Timeout - pinkode blev ikke genereret i tide', 'error');
                    clearInterval(interval);
                    resolve();
                    return;
                }

                try {
                    const res = await fetch(`/api/seam/check-pin?credential_id=${credentialId}`);
                    const data = await res.json();

                    if (data.pin) {
                        this.updateStatus(`PINKODE: ${data.pin} + #`, 'success');
                        this.showPinResult(data.pin);
                        clearInterval(interval);
                        resolve();
                    }
                } catch (err) {
                    this.updateStatus('Fejl ved hentning af pinkode', 'error');
                    clearInterval(interval);
                    resolve();
                }
            }, 5000);
        });
    },

    showPinResult(pin) {
        const pinDisplay = document.getElementById('pinResult');
        if (pinDisplay) {
            const name = this.lastCreatedName || 'Ukendt';
            pinDisplay.innerHTML = `
                <div class="flex flex-col gap-4">
                    <div class="flex items-center justify-between gap-4 p-4 bg-green-500/20 border border-green-500/30 rounded-lg">
                        <div class="flex items-center gap-3">
                            <span class="text-text-secondary text-sm">Pinkode:</span>
                            <span class="text-2xl font-bold text-green-400 font-mono">${pin} + #</span>
                        </div>
                        <button class="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors text-sm" onclick="AccessManager.copyPin('${pin}')">
                            <i class="fa-solid fa-copy mr-2"></i>Kopier
                        </button>
                    </div>
                    <button class="w-full py-3 px-4 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2" onclick="AccessManager.downloadPDF('${pin}', '${name.replace(/'/g, "\\'")}')">
                        <i class="fa-solid fa-file-pdf"></i>
                        Download Adgangsvejledning (PDF)
                    </button>
                </div>
            `;
            pinDisplay.style.display = 'block';
        }
    },

    async copyPin(pin) {
        try {
            await navigator.clipboard.writeText(pin);
            this.updateStatus('Pinkode kopieret til udklipsholder', 'success');
        } catch (err) {
            this.updateStatus('Kunne ikke kopiere pinkode', 'error');
        }
    },

    downloadPDF(pin, name) {
        const url = `/api/seam/generate-pdf?pin=${encodeURIComponent(pin)}&name=${encodeURIComponent(name)}`;
        window.open(url, '_blank');
        this.updateStatus('PDF download startet', 'success');
    },

    // Suspend bruger
    async suspendUser(userId, userName) {
        const actionId = `suspend-${userId}`;
        if (!this.startProcessing(actionId)) {
            return; // Allerede i gang
        }

        try {
            const confirmed = await Modal.show({
                type: 'warning',
                title: 'Suspender bruger',
                message: `Er du sikker på at du vil suspendere<br><strong>${userName}</strong>?<br><br>Brugeren vil miste adgang indtil de genaktiveres.`,
                confirmText: 'Suspender',
                cancelText: 'Annuller'
            });

            if (!confirmed) {
                this.stopProcessing(actionId);
                return;
            }

            // Optimistisk UI: Marker brugeren som suspenderet med det samme
            const user = this.seamUsers.find(u => u.acs_user_id === userId);
            if (user) {
                user.is_suspended = true;
                this.renderUsersList();
                this.updateCounts();
            }

            const res = await fetch(`/api/seam/users/${userId}/suspend`, {
                method: 'POST'
            });
            const data = await res.json();

            if (data.success) {
                this.showStatusBox();
                this.updateStatus(`Bruger "${userName}" er suspenderet`, 'success');
                await Modal.success('Bruger suspenderet', `<strong>${userName}</strong> er nu suspenderet og har ikke længere adgang.`);
            } else {
                // Rollback ved fejl
                await this.loadSeamUsers();
                await Modal.error('Fejl', data.error || 'Kunne ikke suspendere bruger');
            }
        } catch (err) {
            console.error('Suspend error:', err);
            await this.loadSeamUsers();
            await Modal.error('Fejl', 'Fejl ved suspendering: ' + err.message);
        } finally {
            this.stopProcessing(actionId);
        }
    },

    // Genaktiver bruger
    async unsuspendUser(userId, userName) {
        const actionId = `unsuspend-${userId}`;
        if (!this.startProcessing(actionId)) {
            return; // Allerede i gang
        }

        try {
            const confirmed = await Modal.show({
                type: 'success',
                title: 'Genaktiver bruger',
                message: `Er du sikker på at du vil genaktivere<br><strong>${userName}</strong>?<br><br>Brugeren vil få adgang igen.`,
                confirmText: 'Genaktiver',
                cancelText: 'Annuller'
            });

            if (!confirmed) {
                this.stopProcessing(actionId);
                return;
            }

            // Optimistisk UI: Marker brugeren som aktiv med det samme
            const user = this.seamUsers.find(u => u.acs_user_id === userId);
            if (user) {
                user.is_suspended = false;
                this.renderUsersList();
                this.updateCounts();
            }

            const res = await fetch(`/api/seam/users/${userId}/unsuspend`, {
                method: 'POST'
            });
            const data = await res.json();

            if (data.success) {
                this.showStatusBox();
                this.updateStatus(`Bruger "${userName}" er genaktiveret`, 'success');
                await Modal.success('Bruger genaktiveret', `<strong>${userName}</strong> er nu genaktiveret og har adgang igen.`);
            } else {
                // Rollback ved fejl
                await this.loadSeamUsers();
                await Modal.error('Fejl', data.error || 'Kunne ikke genaktivere bruger');
            }
        } catch (err) {
            console.error('Unsuspend error:', err);
            await this.loadSeamUsers();
            await Modal.error('Fejl', 'Fejl ved genaktivering: ' + err.message);
        } finally {
            this.stopProcessing(actionId);
        }
    },

    // Slet bruger
    async deleteUser(userId, userName) {
        const actionId = `delete-${userId}`;
        if (!this.startProcessing(actionId)) {
            return; // Allerede i gang
        }

        try {
            const confirmed = await Modal.show({
                type: 'danger',
                title: 'Slet bruger permanent',
                message: `Er du sikker på at du vil slette<br><strong>${userName}</strong>?<br><br><span style="color: #ef4444;">Denne handling kan IKKE fortrydes!</span>`,
                confirmText: 'Ja, slet bruger',
                cancelText: 'Annuller'
            });

            if (!confirmed) {
                this.stopProcessing(actionId);
                return;
            }

            // Optimistisk UI: Fjern brugeren med det samme
            this.seamUsers = this.seamUsers.filter(u => u.acs_user_id !== userId);
            this.renderUsersList();
            this.updateCounts();

            const res = await fetch(`/api/seam/users/${userId}`, {
                method: 'DELETE'
            });
            const data = await res.json();

            if (data.success) {
                this.showStatusBox();
                this.updateStatus(`Bruger "${userName}" er slettet`, 'success');
                await Modal.success('Bruger slettet', `<strong>${userName}</strong> er blevet slettet permanent.`);
            } else {
                // Rollback: Genindlæs listen ved fejl
                await this.loadSeamUsers();
                await Modal.error('Fejl', data.error || 'Kunne ikke slette bruger');
            }
        } catch (err) {
            console.error('Delete error:', err);
            // Rollback ved fejl
            await this.loadSeamUsers();
            await Modal.error('Fejl', 'Fejl ved sletning: ' + err.message);
        } finally {
            this.stopProcessing(actionId);
        }
    },

    async loadSeamUsers() {
        try {
            const res = await fetch('/api/seam/users');
            const data = await res.json();

            if (data.success) {
                this.seamUsers = data.users || [];
                this.renderUsersList();
                this.updateCounts();
            }
        } catch (err) {
            console.error('Error loading seam users:', err);
        }
    },

    updateCounts() {
        const now = new Date();
        const active = this.seamUsers.filter(u => {
            if (!u.access_schedule) return false;
            const end = new Date(u.access_schedule.ends_at);
            return end > now && !u.is_suspended;
        }).length;

        const expired = this.seamUsers.filter(u => {
            if (!u.access_schedule) return true;
            const end = new Date(u.access_schedule.ends_at);
            return end <= now || u.is_suspended;
        }).length;

        const activeEl = document.getElementById('activeCount');
        const expiredEl = document.getElementById('expiredCount');

        if (activeEl) activeEl.textContent = active;
        if (expiredEl) expiredEl.textContent = expired;
    },

    renderUsersList(filter = '') {
        const list = document.getElementById('accessList');
        if (!list) return;

        // Filter users
        let filteredUsers = this.seamUsers;
        if (filter.trim()) {
            const searchTerm = filter.toLowerCase();
            filteredUsers = this.seamUsers.filter(user => {
                const name = (user.full_name || '').toLowerCase();
                return name.includes(searchTerm);
            });
        }

        if (filteredUsers.length === 0) {
            list.innerHTML = `
                <div class="flex flex-col items-center justify-center py-12 text-center">
                    <div class="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                        <i class="fa-solid fa-key text-2xl text-text-secondary"></i>
                    </div>
                    <h3 class="text-lg font-semibold text-text-primary mb-2">${filter ? 'Ingen resultater' : 'Ingen brugere fundet'}</h3>
                    <p class="text-text-secondary">${filter ? 'Prøv et andet søgeord' : 'Opret en ny adgang til venstre'}</p>
                </div>
            `;
            return;
        }

        const now = new Date();

        const statusStyles = {
            'active': {
                card: 'bg-green-500/5 border-green-500/20 hover:border-green-500/40',
                badge: 'bg-green-500/20 text-green-400',
                icon: 'fa-user-check text-green-400'
            },
            'expired': {
                card: 'bg-yellow-500/5 border-yellow-500/20 hover:border-yellow-500/40',
                badge: 'bg-yellow-500/20 text-yellow-400',
                icon: 'fa-clock text-yellow-400'
            },
            'revoked': {
                card: 'bg-red-500/5 border-red-500/20 hover:border-red-500/40',
                badge: 'bg-red-500/20 text-red-400',
                icon: 'fa-user-slash text-red-400'
            }
        };

        list.innerHTML = filteredUsers.map(user => {
            const isExpired = user.access_schedule
                ? new Date(user.access_schedule.ends_at) <= now
                : false;
            const isSuspended = user.is_suspended;
            const status = isSuspended ? 'revoked' : (isExpired ? 'expired' : 'active');
            const statusText = isSuspended ? 'Suspenderet' : (isExpired ? 'Udløbet' : 'Aktiv');
            const styles = statusStyles[status];
            const escapedName = this.escapeHtml(user.full_name).replace(/'/g, "\\'");

            return `
                <div class="border ${styles.card} rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4 transition-all duration-200">
                    <div class="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                        <i class="fa-solid ${styles.icon}"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <h4 class="font-semibold text-text-primary truncate">${this.escapeHtml(user.full_name)}</h4>
                        ${user.access_schedule ? `
                            <div class="flex items-center gap-2 mt-1 text-text-secondary text-sm">
                                <i class="fa-regular fa-calendar text-xs"></i>
                                <span>${this.formatDate(user.access_schedule.starts_at)} → ${this.formatDate(user.access_schedule.ends_at)}</span>
                            </div>
                        ` : ''}
                    </div>
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="px-3 py-1.5 text-xs font-medium rounded-lg ${styles.badge}">${statusText}</span>
                        ${!isSuspended ? `
                            <button class="px-3 py-1.5 text-xs bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded-lg transition-all duration-200 flex items-center gap-1.5" onclick="AccessManager.suspendUser('${user.acs_user_id}', '${escapedName}')">
                                <i class="fa-solid fa-pause text-[10px]"></i> Suspender
                            </button>
                        ` : `
                            <button class="px-3 py-1.5 text-xs bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-lg transition-all duration-200 flex items-center gap-1.5" onclick="AccessManager.unsuspendUser('${user.acs_user_id}', '${escapedName}')">
                                <i class="fa-solid fa-play text-[10px]"></i> Aktiver
                            </button>
                        `}
                        <button class="px-3 py-1.5 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-all duration-200 flex items-center gap-1.5" onclick="AccessManager.deleteUser('${user.acs_user_id}', '${escapedName}')">
                            <i class="fa-solid fa-trash text-[10px]"></i> Slet
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    },

    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    showError(message) {
        Modal.error('Fejl', message);
    },

    // ============================================
    // Project Picker
    // ============================================

    async loadProjects() {
        try {
            const res = await fetch('/api/projects');
            const data = await res.json();

            if (data.success) {
                this.projects = data.data || [];
                this.projectsLoaded = true;
                this.renderProjectList();
            }
        } catch (err) {
            console.error('Error loading projects:', err);
            this.projectsLoaded = true;
            this.projects = [];
        }
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
        const filtered = this.projects.filter(item => {
            const name = (item.project_name || '').toLowerCase();
            return name.includes(searchTerm.toLowerCase());
        });
        this.renderProjectList(filtered);
    },

    renderProjectList(items = null) {
        const list = document.getElementById('projectPickerList');
        if (!list) return;

        const data = items || this.projects;

        if (!this.projectsLoaded) {
            list.innerHTML = `
                <div class="flex flex-col items-center justify-center py-8 text-center px-4">
                    <div class="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3 animate-pulse">
                        <i class="fa-solid fa-spinner fa-spin text-primary"></i>
                    </div>
                    <p class="text-text-secondary text-sm">Indlæser projekter...</p>
                </div>
            `;
            return;
        }

        if (data.length === 0) {
            list.innerHTML = `
                <div class="flex flex-col items-center justify-center py-8 text-center px-4">
                    <div class="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-3">
                        <i class="fa-regular fa-folder-open text-text-secondary text-xl"></i>
                    </div>
                    <p class="text-text-secondary text-sm">Ingen projekter fundet</p>
                </div>
            `;
            return;
        }

        list.innerHTML = data.map((item, idx) => {
            const originalIdx = this.projects.indexOf(item);
            const startDate = item.start_date ? this.formatDateShort(item.start_date) : '?';
            const endDate = item.end_date ? this.formatDateShort(item.end_date) : '?';

            return `
                <div class="p-3 hover:bg-white/5 cursor-pointer transition-all duration-150 border-b border-white/5 last:border-0 group" onclick="AccessManager.selectProject(${originalIdx})">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                            <i class="fa-solid fa-folder text-primary text-sm"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="text-text-primary text-sm font-medium truncate">${this.escapeHtml(item.project_name)}</div>
                            <div class="flex items-center gap-2 mt-0.5 text-xs text-text-secondary">
                                <i class="fa-regular fa-calendar text-[10px]"></i>
                                <span>${startDate} → ${endDate}</span>
                                ${item.subproject_count > 1 ? `<span class="opacity-50">•</span><span>${item.subproject_count} subprojekter</span>` : ''}
                            </div>
                        </div>
                        <i class="fa-solid fa-chevron-right text-text-secondary text-xs opacity-0 group-hover:opacity-100 transition-opacity"></i>
                    </div>
                </div>
            `;
        }).join('');
    },

    selectProject(idx) {
        const item = this.projects[idx];
        if (!item) return;

        // Update trigger text
        const trigger = document.getElementById('projectPickerTrigger');
        if (trigger) {
            trigger.innerHTML = `
                <div class="flex items-center gap-2">
                    <i class="fa-solid fa-folder text-primary"></i>
                    <span class="text-text-primary font-medium">${this.escapeHtml(item.project_name)}</span>
                </div>
                <i class="fa-solid fa-chevron-down text-text-secondary text-xs transition-transform duration-200"></i>
            `;
        }

        // Set form values
        const nameInput = document.getElementById('artistName');
        if (nameInput) nameInput.value = item.project_name || '';

        const startInput = document.getElementById('startDate');
        if (startInput && item.start_date) {
            startInput.value = this.formatDateForInput(item.start_date);
        }

        const endInput = document.getElementById('endDate');
        if (endInput && item.end_date) {
            endInput.value = this.formatDateForInput(item.end_date);
        }

        // Close dropdown
        this.closeProjectPicker();

        // Clear search
        const search = document.getElementById('projectPickerSearch');
        if (search) search.value = '';
        this.renderProjectList();
    },

    formatDateShort(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${day}/${month}`;
    },

    formatDateForInput(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => AccessManager.init());
} else {
    AccessManager.init();
}
