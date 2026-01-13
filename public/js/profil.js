
const ProfileManager = {
    currentUser: null,
    apiEndpoint: '/api/users',

    // ============================================
    // Initialize
    // ============================================
    async init() {
        await this.loadCurrentUser();
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

            // Load full user details
            const userResponse = await fetch(`${this.apiEndpoint}/${this.currentUser.id}`);
            const userData = await userResponse.json();

            this.currentUser = { ...this.currentUser, ...userData.user };
            this.renderProfile();
        } catch (error) {
            console.error('Error loading user:', error);
            this.showError('Kunne ikke indlæse brugerdata. Prøv igen.');
        }
    },

    async updateProfile(profileData) {
        try {
            const response = await fetch(`${this.apiEndpoint}/${this.currentUser.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(profileData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update profile');
            }

            const result = await response.json();
            this.showSuccess('Profil opdateret!');
            await this.loadCurrentUser();

            return result;
        } catch (error) {
            console.error('Error updating profile:', error);
            this.showError(error.message || 'Kunne ikke opdatere profil. Prøv igen.');
            throw error;
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
    },

    // ============================================
    // Render Functions
    // ============================================
    renderProfile() {
        const main = document.querySelector('main');
        if (!main) return;

        const user = this.currentUser;
        const fullName = `${user.fornavn} ${user.efternavn}`;
        const rolleText = user.rolle === 'admin' ? 'Administrator' : 'Standard Bruger';

        main.innerHTML = `
            <div class="dashboard-header">
                <div>
                    <h1>Min Profil</h1>
                    <p>Administrer dine personlige oplysninger</p>
                </div>
            </div>

            <div class="profile-content">
                <div class="profile-sidebar">
                    <div class="profile-card">
                        <div class="profile-avatar">
                            <span class="avatar-icon">${user.fornavn.charAt(0)}${user.efternavn.charAt(0)}</span>
                        </div>
                        <h2>${fullName}</h2>
                        <p class="profile-role">${rolleText}</p>
                        ${user.title ? `<p class="profile-title">${this.escapeHtml(user.title)}</p>` : ''}
                        
                        <div class="profile-stats">
                            <div class="stat-item">
                                <span class="stat-label">Brugernavn</span>
                                <span class="stat-value">@${user.brugernavn}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Oprettet</span>
                                <span class="stat-value">${this.formatDate(user.created_at)}</span>
                            </div>
                            ${user.last_login ? `
                                <div class="stat-item">
                                    <span class="stat-label">Sidst aktiv</span>
                                    <span class="stat-value">${this.formatDateTime(user.last_login)}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>

                <div class="profile-main">
                    <div class="profile-section">
                        <div class="section-header">
                            <h3>
                                <span class="section-icon">👤</span>
                                Personlige Oplysninger
                            </h3>
                            <button class="btn-edit" onclick="ProfileManager.enableEdit()">
                                Rediger
                            </button>
                        </div>

                        <form id="profileForm" class="profile-form">
                            <div class="form-row">
                                <div class="form-field">
                                    <label for="fornavn">
                                        Fornavn
                                    </label>
                                    <input type="text" id="fornavn" value="${user.fornavn}" disabled>
                                </div>
                                <div class="form-field">
                                    <label for="efternavn">
                                        Efternavn
                                    </label>
                                    <input type="text" id="efternavn" value="${user.efternavn}" disabled>
                                </div>
                            </div>

                            <div class="form-row">
                                <div class="form-field">
                                    <label for="email">
                                        Email
                                    </label>
                                    <input type="email" id="email" value="${user.email}" disabled>
                                </div>
                                <div class="form-field">
                                    <label for="telefon">
                                        Telefon
                                    </label>
                                    <input type="tel" id="telefon" value="${user.telefon || ''}" placeholder="Ikke angivet" disabled>
                                </div>
                            </div>

                            <div class="form-field">
                                <label for="title">
                                    Titel / Stilling
                                </label>
                                <input type="text" id="title" value="${user.title || ''}" placeholder="F.eks. Tekniker, Manager" disabled>
                            </div>

                            <div class="form-actions" style="display: none;">
                                <button type="button" class="btn-secondary" onclick="ProfileManager.cancelEdit()">
                                    Annuller
                                </button>
                                <button type="submit" class="btn-primary">
                                    Gem ændringer
                                </button>
                            </div>
                        </form>
                    </div>

                    <div class="profile-section">
                        <div class="section-header">
                            <h3>
                                Sikkerhed
                            </h3>
                        </div>

                        <form id="passwordForm" class="profile-form">
                            <div class="form-field">
                                <label for="newPassword">
                                    Ny adgangskode
                                </label>
                                <input type="password" id="newPassword" placeholder="Mindst 8 tegn">
                                <span class="field-hint">
                                    Lad feltet være tomt, hvis du ikke vil ændre adgangskode
                                </span>
                            </div>

                            <div class="form-field">
                                <label for="confirmPassword">
                                    Bekræft adgangskode
                                </label>
                                <input type="password" id="confirmPassword" placeholder="Gentag ny adgangskode">
                            </div>

                            <button type="submit" class="btn-primary">
                                Opdater adgangskode
                            </button>
                        </form>
                    </div>

                    <div class="profile-section info-section">
                        <div class="info-content">
                            <div>
                                <h4>Kan ikke ændre brugernavn eller rolle?</h4>
                                <p>Kontakt en administrator for at ændre dit brugernavn eller din rolle.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Attach form listeners
        this.attachFormListeners();
    },

    attachFormListeners() {
        const profileForm = document.getElementById('profileForm');
        if (profileForm) {
            profileForm.addEventListener('submit', (e) => this.handleProfileSubmit(e));
        }

        const passwordForm = document.getElementById('passwordForm');
        if (passwordForm) {
            passwordForm.addEventListener('submit', (e) => this.handlePasswordSubmit(e));
        }
    },

    // ============================================
    // Edit Mode
    // ============================================
    enableEdit() {
        const inputs = document.querySelectorAll('#profileForm input:not([type="password"])');
        inputs.forEach(input => {
            if (input.id !== 'brugernavn' && input.id !== 'rolle') {
                input.disabled = false;
            }
        });

        const formActions = document.querySelector('.form-actions');
        if (formActions) formActions.style.display = 'flex';

        const editBtn = document.querySelector('.btn-edit');
        if (editBtn) editBtn.style.display = 'none';
    },

    cancelEdit() {
        this.renderProfile();
    },

    // ============================================
    // Form Handlers
    // ============================================
    async handleProfileSubmit(e) {
        e.preventDefault();

        const fornavn = document.getElementById('fornavn').value.trim();
        const efternavn = document.getElementById('efternavn').value.trim();
        const email = document.getElementById('email').value.trim();
        const telefon = document.getElementById('telefon').value.trim();
        const title = document.getElementById('title').value.trim();

        if (!fornavn || !efternavn || !email) {
            this.showError('Fornavn, efternavn og email er påkrævet.');
            return;
        }

        const profileData = {
            fornavn,
            efternavn,
            email,
            telefon: telefon || null,
            title: title || null
        };

        try {
            await this.updateProfile(profileData);
        } catch (error) {
            // Error already handled
        }
    },

    async handlePasswordSubmit(e) {
        e.preventDefault();

        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (!newPassword) {
            this.showError('Indtast ny adgangskode.');
            return;
        }

        if (newPassword.length < 8) {
            this.showError('Adgangskode skal være mindst 8 tegn.');
            return;
        }

        if (newPassword !== confirmPassword) {
            this.showError('Adgangskoder matcher ikke.');
            return;
        }

        try {
            await this.updateProfile({ password: newPassword });

            // Clear password fields
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
        } catch (error) {
            // Error already handled
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
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    showSuccess(message) {
        alert(`${message}`);
    },

    showError(message) {
        alert(`${message}`);
    }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ProfileManager.init());
} else {
    ProfileManager.init();
}