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
            <div class="dashboard-header">
                <div>
                    <h1>Brugere</h1>
                    <p>Administrer systemets brugere</p>
                </div>
                <div class="header-actions">
                    <input 
                        type="text" 
                        id="searchUsers" 
                        class="search-users" 
                        placeholder="Søg efter brugere..."
                        value="${filter}"
                    >
                    ${isAdmin ? `
                        <button class="add-user-btn" onclick="UsersManager.showCreateModal()">
                            <span>+</span>
                            Ny bruger
                        </button>
                    ` : ''}
                </div>
            </div>

            <div class="users-stats">
                <div class="stat-card">
                    <div class="stat-content">
                        <span class="stat-label">Total brugere</span>
                        <span class="stat-value" id="totalUsers">0</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-content">
                        <span class="stat-label">Administratorer</span>
                        <span class="stat-value" id="adminUsers">0</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-content">
                        <span class="stat-label">Standard brugere</span>
                        <span class="stat-value" id="standardUsers">0</span>
                    </div>
                </div>
            </div>

            <div class="users-content">
                <div class="users-grid">
                    ${filtered.length === 0 ? this.renderEmptyState(filter) : filtered.map(user => this.renderUserCard(user)).join('')}
                </div>
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
        const rolleClass = user.rolle === 'admin' ? 'admin' : 'standard';

        return `
            <div class="user-card">
                <div class="user-info">
                    <div class="user-avatar">
                        <span class="avatar-text">${user.fornavn.charAt(0)}${user.efternavn.charAt(0)}</span>
                    </div>
                    <div class="user-details">
                        <div class="user-header">
                            <h3>${this.escapeHtml(user.fornavn)} ${this.escapeHtml(user.efternavn)}</h3>
                            ${isCurrentUser ? '<span class="you-badge">Dig</span>' : ''}
                        </div>
                        <p class="user-username">@${this.escapeHtml(user.brugernavn)}</p>
                        ${user.title ? `<p class="user-title">${this.escapeHtml(user.title)}</p>` : ''}
                    </div>
                </div>
                <div class="user-meta">
                    <div class="meta-row">
                        <span class="meta-text">${this.escapeHtml(user.email)}</span>
                    </div>
                    <div class="meta-row">
                        <span class="role-badge ${rolleClass}">${rolleText}</span>
                    </div>
                    ${user.telefon ? `
                        <div class="meta-row">
                            <span class="meta-text">${this.escapeHtml(user.telefon)}</span>
                        </div>
                    ` : `
                        <div class="meta-row">
                            <span class="meta-text" style="opacity: 0.5">Ingen telefon</span>
                        </div>
                    `}
                    <div class="meta-row">
                        <span class="meta-text">${user.last_login ? this.formatDateTime(user.last_login) : 'Aldrig logget ind'}</span>
                    </div>
                </div>
                ${isAdmin && !isCurrentUser ? `
                    <div class="user-actions">
                        <button class="btn-action delete" onclick="UsersManager.confirmDelete(${user.id}, '${this.escapeHtml(user.fornavn)} ${this.escapeHtml(user.efternavn)}')" title="Slet bruger">
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
                <div class="empty-state">
                    <h3>Ingen brugere fundet</h3>
                    <p>Prøv at søge efter noget andet</p>
                </div>
            `;
        }
        return `
            <div class="empty-state">
                <h3>Ingen brugere endnu</h3>
                <p>Opret den første bruger for at komme i gang</p>
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
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>
                        Opret ny bruger
                    </h2>
                    <button class="btn-close" onclick="UsersManager.closeModal()">✕</button>
                </div>
                <form id="createUserForm" class="modal-form">
                    <div class="form-row">
                        <div class="form-field">
                            <label for="newFornavn">
                                Fornavn *
                            </label>
                            <input type="text" id="newFornavn" required>
                        </div>
                        <div class="form-field">
                            <label for="newEfternavn">
                                Efternavn *
                            </label>
                            <input type="text" id="newEfternavn" required>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-field">
                            <label for="newBrugernavn">

                                Brugernavn *
                            </label>
                            <input type="text" id="newBrugernavn" required>
                        </div>
                        <div class="form-field">
                            <label for="newEmail">
                                Email *
                            </label>
                            <input type="email" id="newEmail" required>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-field">
                            <label for="newTelefon">
                                Telefon
                            </label>
                            <input type="tel" id="newTelefon" placeholder="+45 12345678">
                        </div>
                        <div class="form-field">
                            <label for="newTitle">
                                Titel / Stilling
                            </label>
                            <input type="text" id="newTitle" placeholder="F.eks. Tekniker">
                        </div>
                    </div>

                    <div class="form-field">
                        <label for="newPassword">
                            Adgangskode *
                        </label>
                        <input type="password" id="newPassword" required minlength="8">
                        <span class="field-hint">
                            Mindst 8 tegn
                        </span>
                    </div>

                    <div class="form-field">
                        <label for="newRolle">
                            Rolle *
                        </label>
                        <select id="newRolle" required>
                            <option value="standard">Standard Bruger</option>
                            <option value="admin">Administrator</option>
                        </select>
                        <span class="field-hint">
                            Standard brugere kan se alt, men ikke oprette nye brugere
                        </span>
                    </div>

                    <div class="form-field checkbox-field">
                        <label class="checkbox-label">
                            <input type="checkbox" id="sendWelcomeEmail" checked>
                            <span class="checkbox-text">Send velkomst-email med login-oplysninger</span>
                        </label>
                        <span class="field-hint">
                            Brugeren modtager en email med brugernavn, adgangskode og link til dashboard
                        </span>
                    </div>

                    <div class="modal-actions">
                        <button type="button" class="btn-secondary" onclick="UsersManager.closeModal()">
                            Annuller
                        </button>
                        <button type="submit" class="btn-primary">
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
        const modal = document.querySelector('.modal-overlay');
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