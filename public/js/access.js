// ============================================
// SEAM Access Management - Kun oprettelse
// ============================================
// Bruger global Modal fra modal.js

const AccessManager = {
    seamUsers: [],
    projects: [],
    projectsLoaded: false,

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

        const artistName = document.getElementById('artistName').value.trim();
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const submitBtn = document.querySelector('.btn-generate');

        if (!artistName || !startDate || !endDate) {
            this.showError('Udfyld alle felter!');
            return;
        }

        if (new Date(startDate) > new Date(endDate)) {
            this.showError('Start dato skal vaere foer slut dato.');
            return;
        }

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
            pinDisplay.innerHTML = `
                <div class="flex items-center justify-between gap-4 p-4 bg-green-500/20 border border-green-500/30 rounded-lg">
                    <div class="flex items-center gap-3">
                        <span class="text-text-secondary text-sm">Pinkode:</span>
                        <span class="text-2xl font-bold text-green-400 font-mono">${pin} + #</span>
                    </div>
                    <button class="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors text-sm" onclick="AccessManager.copyPin('${pin}')">
                        <i class="fa-solid fa-copy mr-2"></i>Kopier
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

    // Suspend bruger
    async suspendUser(userId, userName) {
        const confirmed = await Modal.show({
            type: 'warning',
            title: 'Suspender bruger',
            message: `Er du sikker paa at du vil suspendere<br><strong>${userName}</strong>?<br><br>Brugeren vil miste adgang indtil de genaktiveres.`,
            confirmText: 'Suspender',
            cancelText: 'Annuller'
        });

        if (!confirmed) return;

        try {
            const res = await fetch(`/api/seam/users/${userId}/suspend`, {
                method: 'POST'
            });
            const data = await res.json();

            if (data.success) {
                this.showStatusBox();
                this.updateStatus(`Bruger "${userName}" er suspenderet`, 'success');
                await Modal.success('Bruger suspenderet', `<strong>${userName}</strong> er nu suspenderet og har ikke længere adgang.`);
                await this.loadSeamUsers();
            } else {
                await Modal.error('Fejl', data.error || 'Kunne ikke suspendere bruger');
            }
        } catch (err) {
            console.error('Suspend error:', err);
            await Modal.error('Fejl', 'Fejl ved suspendering: ' + err.message);
        }
    },

    // Genaktiver bruger
    async unsuspendUser(userId, userName) {
        const confirmed = await Modal.show({
            type: 'success',
            title: 'Genaktiver bruger',
            message: `Er du sikker paa at du vil genaktivere<br><strong>${userName}</strong>?<br><br>Brugeren vil få adgang igen.`,
            confirmText: 'Genaktiver',
            cancelText: 'Annuller'
        });

        if (!confirmed) return;

        try {
            const res = await fetch(`/api/seam/users/${userId}/unsuspend`, {
                method: 'POST'
            });
            const data = await res.json();

            if (data.success) {
                this.showStatusBox();
                this.updateStatus(`Bruger "${userName}" er genaktiveret`, 'success');
                await Modal.success('Bruger genaktiveret', `<strong>${userName}</strong> er nu genaktiveret og har adgang igen.`);
                await this.loadSeamUsers();
            } else {
                await Modal.error('Fejl', data.error || 'Kunne ikke genaktivere bruger');
            }
        } catch (err) {
            console.error('Unsuspend error:', err);
            await Modal.error('Fejl', 'Fejl ved genaktivering: ' + err.message);
        }
    },

    // Slet bruger
    async deleteUser(userId, userName) {
        const confirmed = await Modal.show({
            type: 'danger',
            title: 'Slet bruger permanent',
            message: `Er du sikker paa at du vil slette<br><strong>${userName}</strong>?<br><br><span style="color: #ef4444;">Denne handling kan IKKE fortrydes!</span>`,
            confirmText: 'Ja, slet bruger',
            cancelText: 'Annuller'
        });

        if (!confirmed) return;

        try {
            const res = await fetch(`/api/seam/users/${userId}`, {
                method: 'DELETE'
            });
            const data = await res.json();

            if (data.success) {
                this.showStatusBox();
                this.updateStatus(`Bruger "${userName}" er slettet`, 'success');
                await Modal.success('Bruger slettet', `<strong>${userName}</strong> er blevet slettet permanent.`);
                await this.loadSeamUsers();
            } else {
                await Modal.error('Fejl', data.error || 'Kunne ikke slette bruger');
            }
        } catch (err) {
            console.error('Delete error:', err);
            await Modal.error('Fejl', 'Fejl ved sletning: ' + err.message);
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

    renderUsersList() {
        const list = document.getElementById('accessList');
        if (!list) return;

        if (this.seamUsers.length === 0) {
            list.innerHTML = `
                <div class="flex flex-col items-center justify-center py-12 text-center">
                    <div class="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                        <i class="fa-solid fa-key text-2xl text-text-secondary"></i>
                    </div>
                    <h3 class="text-lg font-semibold text-text-primary mb-2">Ingen brugere fundet</h3>
                    <p class="text-text-secondary">Opret en ny adgang ovenfor</p>
                </div>
            `;
            return;
        }

        const now = new Date();

        const statusStyles = {
            'active': {
                card: 'border-green-500/30',
                badge: 'bg-green-500/20 text-green-400'
            },
            'expired': {
                card: 'border-yellow-500/30',
                badge: 'bg-yellow-500/20 text-yellow-400'
            },
            'revoked': {
                card: 'border-red-500/30',
                badge: 'bg-red-500/20 text-red-400'
            }
        };

        list.innerHTML = this.seamUsers.map(user => {
            const isExpired = user.access_schedule
                ? new Date(user.access_schedule.ends_at) <= now
                : false;
            const isSuspended = user.is_suspended;
            const status = isSuspended ? 'revoked' : (isExpired ? 'expired' : 'active');
            const statusText = isSuspended ? 'Suspenderet' : (isExpired ? 'Udløbet' : 'Aktiv');
            const styles = statusStyles[status];
            const escapedName = this.escapeHtml(user.full_name).replace(/'/g, "\\'");

            return `
                <div class="bg-dark-card border ${styles.card} rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div class="flex-1">
                        <h4 class="font-semibold text-text-primary">${this.escapeHtml(user.full_name)}</h4>
                        ${user.access_schedule ? `
                            <p class="text-text-secondary text-sm mt-1">
                                ${this.formatDate(user.access_schedule.starts_at)} - ${this.formatDate(user.access_schedule.ends_at)}
                            </p>
                        ` : ''}
                    </div>
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="px-3 py-1 text-xs rounded-full ${styles.badge}">${statusText}</span>
                        ${!isSuspended ? `
                            <button class="px-3 py-1.5 text-xs bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg transition-colors" onclick="AccessManager.suspendUser('${user.acs_user_id}', '${escapedName}')">
                                Suspender
                            </button>
                        ` : ''}
                        <button class="px-3 py-1.5 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors" onclick="AccessManager.deleteUser('${user.acs_user_id}', '${escapedName}')">
                            Slet
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
                this.projects = data.projects || [];
                this.projectsLoaded = true;
                this.renderProjectList();
            }
        } catch (err) {
            console.error('Error loading projects:', err);
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
            const originalIdx = this.projects.indexOf(item);
            const startDate = item.start_date ? this.formatDateShort(item.start_date) : '?';
            const endDate = item.end_date ? this.formatDateShort(item.end_date) : '?';

            return `
                <div class="p-3 hover:bg-white/5 cursor-pointer transition-colors border-b border-white/5 last:border-0" onclick="AccessManager.selectProject(${originalIdx})">
                    <div class="text-text-primary text-sm font-medium">${this.escapeHtml(item.project_name)}</div>
                    <div class="flex items-center gap-2 mt-1 text-xs text-text-secondary">
                        <span>${startDate} → ${endDate}</span>
                        ${item.subproject_count > 1 ? `<span class="opacity-50">•</span><span>${item.subproject_count} subprojekter</span>` : ''}
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
                <span class="text-text-primary">${this.escapeHtml(item.project_name)}</span>
                <i class="fa-solid fa-chevron-down text-text-secondary text-xs"></i>
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
