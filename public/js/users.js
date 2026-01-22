// ============================================
// User Management JavaScript (Admin)
// ============================================
// Handles user administration - viewing and creating users

const UsersManager = {
    users: [],
    currentUser: null,
    selectedUserId: null,
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
            this.showError('Kunne ikke indlæse brugere. Prøv igen.');
        }
    },

    async createUser(userData) {
        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create user');
            }

            const result = await response.json();
            await this.loadUsers();

            return result;
        } catch (error) {
            console.error('Error creating user:', error);
            this.showError(error.message || 'Kunne ikke oprette bruger. Prøv igen.');
            throw error;
        }
    },

    async deleteUser(userId) {
        try {
            const response = await fetch(`${this.apiEndpoint}/${userId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to delete user');
            }

            this.showSuccess('Bruger slettet!');
            await this.loadUsers();
        } catch (error) {
            console.error('Error deleting user:', error);
            this.showError(error.message || 'Kunne ikke slette bruger. Prøv igen.');
        }
    },

    // ============================================
    // Event Listeners
    // ============================================
    attachEventListeners() {
        // Navigation buttons
        document.querySelectorAll('.nav-content a').forEach(link => {
            link.addEventListener('click', function(e) {
                if (this.getAttribute('href')) {
                    document.querySelectorAll('.nav-content a').forEach(l => {
                        l.classList.remove('active');
                    });
                    this.classList.add('active');
                }
            });
        });

        // Logout button
        const logoutBtn = document.querySelector('.nav-bottom h1');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                if (confirm('Er du sikker på at du vil logge ud?')) {
                    try {
                        await fetch('/logout', { method: 'POST' });
                        window.location.href = '/login.html';
                    } catch (error) {
                        console.error('Logout error:', error);
                    }
                }
            });
        }

        // Search functionality
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

            return fullName.includes(searchTerm) ||
                username.includes(searchTerm) ||
                email.includes(searchTerm);
        });

        main.innerHTML = `
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <div>
                    <h1 class="text-2xl font-semibold text-text-primary">Brugere</h1>
                    <p class="text-text-secondary mt-1">Administrer systemets brugere</p>
                </div>
                <div class="flex flex-col sm:flex-row gap-3">
                    <input
                        type="text"
                        id="searchUsers"
                        class="px-4 py-2.5 bg-dark-card border border-white/10 rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-colors"
                        placeholder="Søg efter brugere..."
                        value="${filter}"
                    >
                    ${isAdmin ? `
                        <button class="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition-colors" onclick="UsersManager.showCreateModal()">
                            <span class="text-lg">+</span>
                            Ny bruger
                        </button>
                    ` : ''}
                </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div class="bg-dark-card border border-white/10 rounded-xl p-5">
                    <span class="text-text-secondary text-sm">Total brugere</span>
                    <span class="block text-2xl font-semibold text-text-primary mt-1" id="totalUsers">0</span>
                </div>
                <div class="bg-dark-card border border-white/10 rounded-xl p-5">
                    <span class="text-text-secondary text-sm">Administratorer</span>
                    <span class="block text-2xl font-semibold text-text-primary mt-1" id="adminUsers">0</span>
                </div>
                <div class="bg-dark-card border border-white/10 rounded-xl p-5">
                    <span class="text-text-secondary text-sm">Standard brugere</span>
                    <span class="block text-2xl font-semibold text-text-primary mt-1" id="standardUsers">0</span>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                ${filtered.length === 0 ? this.renderEmptyState(filter) : filtered.map(user => this.renderUserCard(user)).join('')}
            </div>
        `;

        // Re-attach search listener
        const newSearchInput = document.getElementById('searchUsers');
        if (newSearchInput) {
            newSearchInput.addEventListener('input', (e) => {
                this.renderUserList(e.target.value);
            });
        }

        this.updateStats();
    },

    renderUserCard(user) {
        const isAdmin = this.currentUser && this.currentUser.rolle === 'admin';
        const isCurrentUser = this.currentUser && this.currentUser.id === user.id;
        const rolleText = user.rolle === 'admin' ? 'Administrator' : 'Standard';
        const rolleClass = user.rolle === 'admin' ? 'bg-primary/20 text-primary' : 'bg-white/10 text-text-secondary';

        return `
            <div class="bg-dark-card border border-white/10 rounded-xl p-5 flex flex-col gap-4">
                <div class="flex items-start gap-4">
                    <div class="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <span class="text-primary font-semibold">${user.fornavn.charAt(0)}${user.efternavn.charAt(0)}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <h3 class="font-semibold text-text-primary">${this.escapeHtml(user.fornavn)} ${this.escapeHtml(user.efternavn)}</h3>
                            ${isCurrentUser ? '<span class="px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-400">Dig</span>' : ''}
                        </div>
                        <p class="text-text-secondary text-sm">@${this.escapeHtml(user.brugernavn)}</p>
                        ${user.title ? `<p class="text-text-secondary text-sm mt-1">${this.escapeHtml(user.title)}</p>` : ''}
                    </div>
                </div>
                <div class="space-y-2 text-sm">
                    <div class="flex items-center gap-2 text-text-secondary">
                        <i class="fa-solid fa-envelope w-4"></i>
                        <span class="truncate">${this.escapeHtml(user.email)}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <i class="fa-solid fa-user-tag w-4 text-text-secondary"></i>
                        <span class="px-2 py-0.5 text-xs rounded-full ${rolleClass}">${rolleText}</span>
                    </div>
                    <div class="flex items-center gap-2 text-text-secondary">
                        <i class="fa-solid fa-phone w-4"></i>
                        ${user.telefon ? `<span>${this.escapeHtml(user.telefon)}</span>` : '<span class="opacity-50">Ingen telefon</span>'}
                    </div>
                    <div class="flex items-center gap-2 text-text-secondary">
                        <i class="fa-solid fa-clock w-4"></i>
                        <span>${user.last_login ? this.formatDateTime(user.last_login) : 'Aldrig logget ind'}</span>
                    </div>
                </div>
                ${isAdmin && !isCurrentUser ? `
                    <div class="pt-3 border-t border-white/10">
                        <button class="w-full px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" onclick="UsersManager.confirmDelete(${user.id}, '${this.escapeHtml(user.fornavn)} ${this.escapeHtml(user.efternavn)}')">
                            <i class="fa-solid fa-trash mr-2"></i>
                            Slet bruger
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    },

    renderEmptyState(filter) {
        if (filter) {
            return `
                <div class="col-span-full flex flex-col items-center justify-center py-16 text-center">
                    <div class="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                        <i class="fa-solid fa-search text-2xl text-text-secondary"></i>
                    </div>
                    <h3 class="text-lg font-semibold text-text-primary mb-2">Ingen brugere fundet</h3>
                    <p class="text-text-secondary">Prøv at søge efter noget andet</p>
                </div>
            `;
        }
        return `
            <div class="col-span-full flex flex-col items-center justify-center py-16 text-center">
                <div class="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
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
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4';
        modal.id = 'createUserModal';
        modal.innerHTML = `
            <div class="bg-dark-card border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div class="flex items-center justify-between p-6 border-b border-white/10">
                    <h2 class="text-xl font-semibold text-text-primary">Opret ny bruger</h2>
                    <button class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-text-secondary transition-colors" onclick="UsersManager.closeModal()">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <form id="createUserForm" class="p-6 space-y-4">
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-text-secondary mb-1.5" for="newFornavn">Fornavn *</label>
                            <input type="text" id="newFornavn" required class="w-full px-4 py-2.5 bg-dark-bg border border-white/10 rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-colors">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-text-secondary mb-1.5" for="newEfternavn">Efternavn *</label>
                            <input type="text" id="newEfternavn" required class="w-full px-4 py-2.5 bg-dark-bg border border-white/10 rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-colors">
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-text-secondary mb-1.5" for="newBrugernavn">Brugernavn *</label>
                            <input type="text" id="newBrugernavn" required class="w-full px-4 py-2.5 bg-dark-bg border border-white/10 rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-colors">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-text-secondary mb-1.5" for="newEmail">Email *</label>
                            <input type="email" id="newEmail" required class="w-full px-4 py-2.5 bg-dark-bg border border-white/10 rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-colors">
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-text-secondary mb-1.5" for="newTelefon">Telefon</label>
                            <input type="tel" id="newTelefon" placeholder="+45 12345678" class="w-full px-4 py-2.5 bg-dark-bg border border-white/10 rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-colors">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-text-secondary mb-1.5" for="newTitle">Titel / Stilling</label>
                            <input type="text" id="newTitle" placeholder="F.eks. Tekniker" class="w-full px-4 py-2.5 bg-dark-bg border border-white/10 rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-colors">
                        </div>
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-text-secondary mb-1.5" for="newPassword">Adgangskode *</label>
                        <input type="password" id="newPassword" required minlength="8" class="w-full px-4 py-2.5 bg-dark-bg border border-white/10 rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-colors">
                        <span class="text-xs text-text-secondary mt-1 block">Mindst 8 tegn</span>
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-text-secondary mb-1.5" for="newRolle">Rolle *</label>
                        <select id="newRolle" required class="w-full px-4 py-2.5 bg-dark-bg border border-white/10 rounded-lg text-text-primary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-colors">
                            <option value="standard">Standard Bruger</option>
                            <option value="admin">Administrator</option>
                        </select>
                        <span class="text-xs text-text-secondary mt-1 block">Standard brugere kan se alt, men ikke oprette nye brugere</span>
                    </div>

                    <div class="flex items-start gap-3">
                        <input type="checkbox" id="sendWelcomeEmail" checked class="mt-1 w-4 h-4 rounded border-white/20 bg-dark-bg text-primary focus:ring-primary/50">
                        <div>
                            <label for="sendWelcomeEmail" class="text-sm text-text-primary cursor-pointer">Send velkomst-email med login-oplysninger</label>
                            <span class="text-xs text-text-secondary block mt-0.5">Brugeren modtager en email med brugernavn, adgangskode og link til dashboard</span>
                        </div>
                    </div>

                    <div class="flex gap-3 pt-4 border-t border-white/10">
                        <button type="button" class="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-text-secondary rounded-lg font-medium transition-colors" onclick="UsersManager.closeModal()">
                            Annuller
                        </button>
                        <button type="submit" class="flex-1 px-4 py-2.5 bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition-colors">
                            Opret bruger
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);

        // Attach form listener
        const form = document.getElementById('createUserForm');
        if (form) {
            form.addEventListener('submit', (e) => this.handleCreateUser(e));
        }

        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        });
    },

    closeModal() {
        const modal = document.getElementById('createUserModal');
        if (modal) {
            modal.remove();
        }
    },

    async handleCreateUser(e) {
        e.preventDefault();

        const userData = {
            fornavn: document.getElementById('newFornavn').value.trim(),
            efternavn: document.getElementById('newEfternavn').value.trim(),
            brugernavn: document.getElementById('newBrugernavn').value.trim(),
            email: document.getElementById('newEmail').value.trim(),
            telefon: document.getElementById('newTelefon').value.trim() || null,
            title: document.getElementById('newTitle').value.trim() || null,
            password: document.getElementById('newPassword').value,
            rolle: document.getElementById('newRolle').value,
            sendEmail: document.getElementById('sendWelcomeEmail').checked
        };

        try {
            const result = await this.createUser(userData);
            this.closeModal();

            // Show email status
            if (userData.sendEmail) {
                if (result.emailSent) {
                    this.showSuccess('Bruger oprettet og velkomst-email sendt!');
                } else {
                    this.showError('Bruger oprettet, men email kunne ikke sendes. Tjek email-konfiguration.');
                }
            }
        } catch (error) {
            // Error already handled
        }
    },

    // ============================================
    // User Actions
    // ============================================
    async confirmDelete(userId, userName) {
        const confirmed = await Modal.show({
            type: 'danger',
            title: 'Slet bruger',
            message: `Er du sikker på at du vil slette brugeren <strong>"${this.escapeHtml(userName)}"</strong>?<br><br>Denne handling kan ikke fortrydes.`,
            confirmText: 'Ja, slet bruger',
            cancelText: 'Annuller'
        });

        if (confirmed) {
            this.deleteUser(userId);
        }
    },

    // ============================================
    // Utility Functions
    // ============================================
    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    },

    formatDateTime(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${minutes}`;
    },

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    showSuccess(message) {
        Modal.success('Succes', message);
    },

    showError(message) {
        Modal.error('Fejl', message);
    }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => UsersManager.init());
} else {
    UsersManager.init();
}
