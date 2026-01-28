// ============================================
// User Management JavaScript (Admin)
// ============================================

const UsersManager = {
    users: [],
    currentUser: null,
    apiEndpoint: '/api/users',

    // ============================================
    // Initialize
    // ============================================
    async init() {
        await this.loadCurrentUser();
        await this.loadUsers();
        this.attachEventListeners();
    },

    // ============================================
    // API Calls
    // ============================================
    async loadCurrentUser() {
        try {
            const response = await fetch('/me');
            if (!response.ok) throw new Error('Failed to load user');
            const data = await response.json();
            this.currentUser = data.user;
        } catch (error) {
            console.error('Error loading current user:', error);
        }
    },

    async loadUsers() {
        try {
            const response = await fetch(this.apiEndpoint);
            if (!response.ok) throw new Error('Failed to load users');
            const data = await response.json();
            this.users = data.users || [];
            this.renderUserList();
            this.updateStats();
        } catch (error) {
            console.error('Error loading users:', error);
            this.showNotification('Kunne ikke indlæse brugere. Prøv igen.', 'error');
        }
    },

    async createUser(userData) {
        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to create user');
            }

            await this.loadUsers();
            return result;
        } catch (error) {
            console.error('Error creating user:', error);
            this.showNotification(error.message || 'Kunne ikke oprette bruger.', 'error');
            throw error;
        }
    },

    async updateUser(userId, userData) {
        try {
            const response = await fetch(`${this.apiEndpoint}/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to update user');
            }

            this.showNotification('Bruger opdateret!', 'success');
            await this.loadUsers();
            return result;
        } catch (error) {
            console.error('Error updating user:', error);
            this.showNotification(error.message || 'Kunne ikke opdatere bruger.', 'error');
            throw error;
        }
    },

    async deleteUser(userId) {
        try {
            const response = await fetch(`${this.apiEndpoint}/${userId}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to delete user');
            }

            this.showNotification('Bruger slettet!', 'success');
            await this.loadUsers();
        } catch (error) {
            console.error('Error deleting user:', error);
            this.showNotification(error.message || 'Kunne ikke slette bruger.', 'error');
        }
    },

    // ============================================
    // Event Listeners
    // ============================================
    attachEventListeners() {
        const searchInput = document.getElementById('searchUsers');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.renderUserList(e.target.value);
            });
        }
    },

    // ============================================
    // Render Functions
    // ============================================
    renderUserList(filter = '') {
        const main = document.querySelector('main');
        if (!main) return;

        const isAdmin = this.currentUser && this.currentUser.rolle === 'admin';

        const filtered = this.users.filter(user => {
            const searchTerm = filter.toLowerCase();
            const fullName = `${user.fornavn} ${user.efternavn}`.toLowerCase();
            const username = user.brugernavn.toLowerCase();
            const email = user.email.toLowerCase();
            return fullName.includes(searchTerm) || username.includes(searchTerm) || email.includes(searchTerm);
        });

        main.innerHTML = `
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <div>
                    <h1 class="text-2xl font-semibold text-text-primary">Brugere</h1>
                    <p class="text-text-secondary mt-1">Administrer systemets brugere</p>
                </div>
                <div class="flex flex-col sm:flex-row gap-3">
                    <div class="relative">
                        <i class="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary"></i>
                        <input type="text" id="searchUsers" class="pl-11 pr-4 py-2.5 bg-dark-card border border-white/10 rounded-xl text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary/50 transition-colors" placeholder="Søg brugere..." value="${this.escapeHtml(filter)}">
                    </div>
                    ${isAdmin ? `
                        <button class="flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-medium transition-all" onclick="UsersManager.showCreateModal()">
                            <i class="fa-solid fa-plus"></i>
                            Ny bruger
                        </button>
                    ` : ''}
                </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div class="bg-dark-card border border-white/10 rounded-xl p-5">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                            <i class="fa-solid fa-users text-primary"></i>
                        </div>
                        <div>
                            <span class="text-text-secondary text-sm">Total brugere</span>
                            <span class="block text-2xl font-semibold text-text-primary" id="totalUsers">0</span>
                        </div>
                    </div>
                </div>
                <div class="bg-dark-card border border-white/10 rounded-xl p-5">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                            <i class="fa-solid fa-user-shield text-yellow-400"></i>
                        </div>
                        <div>
                            <span class="text-text-secondary text-sm">Administratorer</span>
                            <span class="block text-2xl font-semibold text-text-primary" id="adminUsers">0</span>
                        </div>
                    </div>
                </div>
                <div class="bg-dark-card border border-white/10 rounded-xl p-5">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                            <i class="fa-solid fa-user text-green-400"></i>
                        </div>
                        <div>
                            <span class="text-text-secondary text-sm">Standard brugere</span>
                            <span class="block text-2xl font-semibold text-text-primary" id="standardUsers">0</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                ${filtered.length === 0 ? this.renderEmptyState(filter) : filtered.map(user => this.renderUserCard(user)).join('')}
            </div>
        `;

        // Re-attach search listener
        const newSearchInput = document.getElementById('searchUsers');
        if (newSearchInput) {
            newSearchInput.addEventListener('input', (e) => this.renderUserList(e.target.value));
            newSearchInput.focus();
            newSearchInput.setSelectionRange(filter.length, filter.length);
        }

        this.updateStats();
    },

    renderUserCard(user) {
        const isAdmin = this.currentUser && this.currentUser.rolle === 'admin';
        const isCurrentUser = this.currentUser && this.currentUser.id === user.id;
        const rolleText = user.rolle === 'admin' ? 'Administrator' : 'Standard';
        const rolleClass = user.rolle === 'admin' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400';

        return `
            <div class="bg-dark-card border border-white/10 rounded-xl p-5 flex flex-col gap-4 hover:border-white/20 transition-colors">
                <div class="flex items-start gap-4">
                    <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary-hover flex items-center justify-center flex-shrink-0 shadow-lg">
                        <span class="text-white font-semibold">${user.fornavn.charAt(0)}${user.efternavn.charAt(0)}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <h3 class="font-semibold text-text-primary">${this.escapeHtml(user.fornavn)} ${this.escapeHtml(user.efternavn)}</h3>
                            ${isCurrentUser ? '<span class="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-primary/20 text-primary uppercase">Dig</span>' : ''}
                        </div>
                        <p class="text-text-secondary text-sm">@${this.escapeHtml(user.brugernavn)}</p>
                        ${user.title ? `<p class="text-text-secondary text-sm mt-0.5">${this.escapeHtml(user.title)}</p>` : ''}
                    </div>
                </div>
                <div class="space-y-2 text-sm">
                    <div class="flex items-center gap-3 text-text-secondary">
                        <i class="fa-solid fa-envelope w-4 text-center"></i>
                        <span class="truncate">${this.escapeHtml(user.email)}</span>
                    </div>
                    <div class="flex items-center gap-3">
                        <i class="fa-solid fa-shield-halved w-4 text-center text-text-secondary"></i>
                        <span class="px-2 py-0.5 text-xs font-medium rounded-full ${rolleClass}">${rolleText}</span>
                    </div>
                    <div class="flex items-center gap-3 text-text-secondary">
                        <i class="fa-solid fa-phone w-4 text-center"></i>
                        ${user.telefon ? `<span>${this.escapeHtml(user.telefon)}</span>` : '<span class="opacity-50">Ikke angivet</span>'}
                    </div>
                    <div class="flex items-center gap-3 text-text-secondary">
                        <i class="fa-solid fa-clock w-4 text-center"></i>
                        <span>${user.last_login ? this.formatDateTime(user.last_login) : 'Aldrig logget ind'}</span>
                    </div>
                </div>
                <div class="pt-3 border-t border-white/10 flex gap-2">
                    ${isAdmin || isCurrentUser ? `
                        <button class="flex-1 px-3 py-2 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors flex items-center justify-center gap-2" onclick="UsersManager.showEditModal(${user.id})">
                            <i class="fa-solid fa-pen-to-square"></i>
                            Rediger
                        </button>
                    ` : ''}
                    ${isAdmin && !isCurrentUser ? `
                        <button class="flex-1 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors flex items-center justify-center gap-2" onclick="UsersManager.confirmDelete(${user.id}, '${this.escapeHtml(user.fornavn)} ${this.escapeHtml(user.efternavn)}')">
                            <i class="fa-solid fa-trash"></i>
                            Slet
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    },

    renderEmptyState(filter) {
        if (filter) {
            return `
                <div class="col-span-full flex flex-col items-center justify-center py-16 text-center">
                    <div class="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                        <i class="fa-solid fa-search text-2xl text-text-secondary"></i>
                    </div>
                    <h3 class="text-lg font-semibold text-text-primary mb-2">Ingen brugere fundet</h3>
                    <p class="text-text-secondary">Prøv at søge efter noget andet</p>
                </div>
            `;
        }
        return `
            <div class="col-span-full flex flex-col items-center justify-center py-16 text-center">
                <div class="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                    <i class="fa-solid fa-users text-2xl text-text-secondary"></i>
                </div>
                <h3 class="text-lg font-semibold text-text-primary mb-2">Ingen brugere endnu</h3>
                <p class="text-text-secondary">Opret den første bruger for at komme i gang</p>
            </div>
        `;
    },

    updateStats() {
        const total = this.users.length;
        const admins = this.users.filter(u => u.rolle === 'admin').length;
        const standard = this.users.filter(u => u.rolle === 'standard').length;

        const totalEl = document.getElementById('totalUsers');
        const adminEl = document.getElementById('adminUsers');
        const standardEl = document.getElementById('standardUsers');

        if (totalEl) totalEl.textContent = total;
        if (adminEl) adminEl.textContent = admins;
        if (standardEl) standardEl.textContent = standard;
    },

    // ============================================
    // Create User Modal
    // ============================================
    showCreateModal() {
        this.showUserModal(null);
    },

    showEditModal(userId) {
        const user = this.users.find(u => u.id === userId);
        if (user) {
            this.showUserModal(user);
        }
    },

    showUserModal(user = null) {
        const isEdit = user !== null;
        const isAdmin = this.currentUser && this.currentUser.rolle === 'admin';
        const title = isEdit ? 'Rediger bruger' : 'Opret ny bruger';

        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4';
        modal.id = 'userModal';
        modal.innerHTML = `
            <div class="bg-dark-card border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in-up">
                <div class="flex items-center justify-between p-6 border-b border-white/10">
                    <h2 class="text-xl font-semibold text-text-primary">${title}</h2>
                    <button class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-text-secondary transition-colors" onclick="UsersManager.closeUserModal()">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <form id="userForm" class="p-6 space-y-4">
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-text-secondary mb-1.5">Fornavn *</label>
                            <input type="text" id="userFornavn" required value="${isEdit ? this.escapeHtml(user.fornavn) : ''}" class="w-full px-4 py-2.5 bg-dark-bg border border-white/10 rounded-xl text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary/50 transition-colors">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-text-secondary mb-1.5">Efternavn *</label>
                            <input type="text" id="userEfternavn" required value="${isEdit ? this.escapeHtml(user.efternavn) : ''}" class="w-full px-4 py-2.5 bg-dark-bg border border-white/10 rounded-xl text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary/50 transition-colors">
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-text-secondary mb-1.5">Brugernavn *</label>
                            <input type="text" id="userBrugernavn" required ${isEdit ? 'disabled' : ''} value="${isEdit ? this.escapeHtml(user.brugernavn) : ''}" class="w-full px-4 py-2.5 bg-dark-bg border border-white/10 rounded-xl text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary/50 transition-colors ${isEdit ? 'opacity-50 cursor-not-allowed' : ''}">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-text-secondary mb-1.5">Email *</label>
                            <input type="email" id="userEmail" required value="${isEdit ? this.escapeHtml(user.email) : ''}" class="w-full px-4 py-2.5 bg-dark-bg border border-white/10 rounded-xl text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary/50 transition-colors">
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-text-secondary mb-1.5">Telefon</label>
                            <input type="tel" id="userTelefon" placeholder="+45 12345678" value="${isEdit && user.telefon ? this.escapeHtml(user.telefon) : ''}" class="w-full px-4 py-2.5 bg-dark-bg border border-white/10 rounded-xl text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary/50 transition-colors">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-text-secondary mb-1.5">Titel / Stilling</label>
                            <input type="text" id="userTitle" placeholder="F.eks. Tekniker" value="${isEdit && user.title ? this.escapeHtml(user.title) : ''}" class="w-full px-4 py-2.5 bg-dark-bg border border-white/10 rounded-xl text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary/50 transition-colors">
                        </div>
                    </div>

                    ${isEdit ? `
                    <div>
                        <label class="block text-sm font-medium text-text-secondary mb-1.5">Ny adgangskode (lad stå tom for at beholde)</label>
                        <input type="password" id="userPassword" minlength="8" class="w-full px-4 py-2.5 bg-dark-bg border border-white/10 rounded-xl text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary/50 transition-colors">
                        <span class="text-xs text-text-secondary mt-1 block">Mindst 8 tegn</span>
                    </div>
                    ` : `
                    <div class="p-4 bg-primary/10 border border-primary/20 rounded-xl">
                        <div class="flex items-center gap-2 text-primary mb-1">
                            <i class="fa-solid fa-key"></i>
                            <span class="font-medium">Automatisk adgangskode</span>
                        </div>
                        <p class="text-sm text-text-secondary">Der genereres automatisk en sikker adgangskode. Brugeren skal skifte adgangskode ved første login.</p>
                    </div>
                    `}

                    ${isAdmin ? `
                        <div>
                            <label class="block text-sm font-medium text-text-secondary mb-1.5">Rolle *</label>
                            <select id="userRolle" required class="w-full px-4 py-2.5 bg-dark-bg border border-white/10 rounded-xl text-text-primary focus:outline-none focus:border-primary/50 transition-colors">
                                <option value="standard" ${isEdit && user.rolle === 'standard' ? 'selected' : ''}>Standard Bruger</option>
                                <option value="admin" ${isEdit && user.rolle === 'admin' ? 'selected' : ''}>Administrator</option>
                            </select>
                        </div>
                    ` : ''}

                    ${!isEdit ? `
                        <div class="flex items-start gap-3 p-4 bg-white/5 rounded-xl">
                            <input type="checkbox" id="sendWelcomeEmail" checked class="mt-0.5 w-4 h-4 rounded border-white/20 bg-dark-bg text-primary focus:ring-primary/50">
                            <div>
                                <label for="sendWelcomeEmail" class="text-sm text-text-primary cursor-pointer font-medium">Send velkomst-email</label>
                                <span class="text-xs text-text-secondary block mt-0.5">Brugeren modtager login-oplysninger på email</span>
                            </div>
                        </div>
                    ` : ''}

                    <div class="flex gap-3 pt-4 border-t border-white/10">
                        <button type="button" class="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-text-secondary rounded-xl font-medium transition-colors" onclick="UsersManager.closeUserModal()">
                            Annuller
                        </button>
                        <button type="submit" class="flex-1 px-4 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-medium transition-colors">
                            ${isEdit ? 'Gem ændringer' : 'Opret bruger'}
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);

        // Store user ID for editing
        modal.dataset.userId = isEdit ? user.id : '';

        // Attach form listener
        document.getElementById('userForm').addEventListener('submit', (e) => this.handleUserFormSubmit(e, isEdit));

        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeUserModal();
        });

        // Close on Escape
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeUserModal();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    },

    closeUserModal() {
        const modal = document.getElementById('userModal');
        if (modal) modal.remove();
    },

    async handleUserFormSubmit(e, isEdit) {
        e.preventDefault();

        const modal = document.getElementById('userModal');
        const userId = modal?.dataset.userId;
        const isAdmin = this.currentUser && this.currentUser.rolle === 'admin';

        const userData = {
            fornavn: document.getElementById('userFornavn').value.trim(),
            efternavn: document.getElementById('userEfternavn').value.trim(),
            email: document.getElementById('userEmail').value.trim(),
            telefon: document.getElementById('userTelefon').value.trim() || null,
            title: document.getElementById('userTitle').value.trim() || null,
        };

        const passwordField = document.getElementById('userPassword');
        if (passwordField) {
            const password = passwordField.value;
            if (password) userData.password = password;
        }

        if (!isEdit) {
            userData.brugernavn = document.getElementById('userBrugernavn').value.trim();
            userData.sendEmail = document.getElementById('sendWelcomeEmail')?.checked || false;
        }

        if (isAdmin) {
            userData.rolle = document.getElementById('userRolle')?.value || 'standard';
        }

        try {
            if (isEdit) {
                await this.updateUser(userId, userData);
            } else {
                const result = await this.createUser(userData);
                this.closeUserModal();

                if (result.generatedPassword) {
                    // Show password modal if email wasn't sent
                    this.showGeneratedPasswordModal(result.user, result.generatedPassword);
                } else if (userData.sendEmail) {
                    this.showNotification(result.emailSent ? 'Bruger oprettet og email sendt!' : 'Bruger oprettet (email kunne ikke sendes)', result.emailSent ? 'success' : 'warning');
                } else {
                    this.showNotification('Bruger oprettet!', 'success');
                }
                return;
            }
            this.closeUserModal();
        } catch (error) {
            // Error already shown
        }
    },

    showGeneratedPasswordModal(user, password) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4';
        modal.id = 'passwordModal';
        modal.innerHTML = `
            <div class="bg-dark-card border border-white/10 rounded-2xl w-full max-w-md p-6 text-center animate-fade-in-up">
                <div class="w-16 h-16 rounded-2xl bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                    <i class="fa-solid fa-check text-green-400 text-2xl"></i>
                </div>
                <h3 class="text-xl font-semibold text-text-primary mb-2">Bruger oprettet!</h3>
                <p class="text-text-secondary mb-4">${this.escapeHtml(user.fornavn)} ${this.escapeHtml(user.efternavn)} er nu oprettet.</p>

                <div class="bg-dark-bg border border-white/10 rounded-xl p-4 mb-4 text-left">
                    <div class="flex items-center justify-between mb-3">
                        <span class="text-sm text-text-secondary">Brugernavn:</span>
                        <span class="text-text-primary font-mono">${this.escapeHtml(user.brugernavn)}</span>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="text-sm text-text-secondary">Adgangskode:</span>
                        <div class="flex items-center gap-2">
                            <span class="text-text-primary font-mono" id="generatedPassword">${this.escapeHtml(password)}</span>
                            <button type="button" class="p-1.5 hover:bg-white/10 rounded-lg transition-colors" onclick="UsersManager.copyPassword()" title="Kopiér">
                                <i class="fa-solid fa-copy text-text-secondary"></i>
                            </button>
                        </div>
                    </div>
                </div>

                <p class="text-xs text-yellow-400 mb-4">
                    <i class="fa-solid fa-triangle-exclamation mr-1"></i>
                    Gem denne adgangskode - den vises kun én gang!
                </p>

                <button class="w-full px-4 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-medium transition-colors" onclick="UsersManager.closePasswordModal()">
                    OK, jeg har gemt adgangskoden
                </button>
            </div>
        `;

        document.body.appendChild(modal);
    },

    copyPassword() {
        const passwordEl = document.getElementById('generatedPassword');
        if (passwordEl) {
            navigator.clipboard.writeText(passwordEl.textContent).then(() => {
                this.showNotification('Adgangskode kopieret!', 'success');
            });
        }
    },

    closePasswordModal() {
        const modal = document.getElementById('passwordModal');
        if (modal) modal.remove();
    },

    // ============================================
    // Delete Confirmation
    // ============================================
    confirmDelete(userId, userName) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4';
        modal.id = 'deleteConfirmModal';
        modal.innerHTML = `
            <div class="bg-dark-card border border-white/10 rounded-2xl w-full max-w-md p-6 text-center animate-fade-in-up">
                <div class="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                    <i class="fa-solid fa-trash text-red-400 text-2xl"></i>
                </div>
                <h3 class="text-xl font-semibold text-text-primary mb-2">Slet bruger</h3>
                <p class="text-text-secondary mb-6">Er du sikker på at du vil slette<br><strong class="text-text-primary">${this.escapeHtml(userName)}</strong>?<br><br>Denne handling kan ikke fortrydes.</p>
                <div class="flex gap-3">
                    <button class="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-text-secondary rounded-xl font-medium transition-colors" onclick="UsersManager.closeDeleteModal()">
                        Annuller
                    </button>
                    <button class="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-colors" onclick="UsersManager.executeDelete(${userId})">
                        Ja, slet bruger
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeDeleteModal();
        });
    },

    closeDeleteModal() {
        const modal = document.getElementById('deleteConfirmModal');
        if (modal) modal.remove();
    },

    async executeDelete(userId) {
        this.closeDeleteModal();
        await this.deleteUser(userId);
    },

    // ============================================
    // Notifications
    // ============================================
    showNotification(message, type = 'info') {
        // Remove existing notifications
        document.querySelectorAll('.user-notification').forEach(n => n.remove());

        const colors = {
            success: 'bg-green-500/20 border-green-500/30 text-green-400',
            error: 'bg-red-500/20 border-red-500/30 text-red-400',
            warning: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400',
            info: 'bg-primary/20 border-primary/30 text-primary'
        };

        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        const notification = document.createElement('div');
        notification.className = `user-notification fixed top-4 right-4 z-[10000] px-5 py-4 rounded-xl border ${colors[type]} flex items-center gap-3 shadow-2xl animate-fade-in-up`;
        notification.innerHTML = `
            <i class="fa-solid ${icons[type]}"></i>
            <span class="font-medium">${this.escapeHtml(message)}</span>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateY(-10px)';
            notification.style.transition = 'all 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    },

    // ============================================
    // Utility Functions
    // ============================================
    formatDateTime(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${day}/${month}/${year} kl. ${hours}:${minutes}`;
    },

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => UsersManager.init());
} else {
    UsersManager.init();
}
