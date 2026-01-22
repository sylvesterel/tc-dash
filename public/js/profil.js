
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
            <div class="mb-8">
                <h1 class="text-2xl font-semibold text-text-primary">Min Profil</h1>
                <p class="text-text-secondary mt-1">Administrer dine personlige oplysninger</p>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- Sidebar -->
                <div class="lg:col-span-1">
                    <div class="bg-dark-card border border-white/10 rounded-xl p-6 text-center">
                        <div class="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                            <span class="text-2xl font-semibold text-primary">${user.fornavn.charAt(0)}${user.efternavn.charAt(0)}</span>
                        </div>
                        <h2 class="text-xl font-semibold text-text-primary">${fullName}</h2>
                        <p class="text-primary text-sm mt-1">${rolleText}</p>
                        ${user.title ? `<p class="text-text-secondary text-sm mt-1">${this.escapeHtml(user.title)}</p>` : ''}

                        <div class="mt-6 pt-6 border-t border-white/10 space-y-4 text-left">
                            <div>
                                <span class="text-text-secondary text-xs block">Brugernavn</span>
                                <span class="text-text-primary">@${user.brugernavn}</span>
                            </div>
                            <div>
                                <span class="text-text-secondary text-xs block">Oprettet</span>
                                <span class="text-text-primary">${this.formatDate(user.created_at)}</span>
                            </div>
                            ${user.last_login ? `
                                <div>
                                    <span class="text-text-secondary text-xs block">Sidst aktiv</span>
                                    <span class="text-text-primary">${this.formatDateTime(user.last_login)}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>

                <!-- Main Content -->
                <div class="lg:col-span-2 space-y-6">
                    <!-- Personal Info Section -->
                    <div class="bg-dark-card border border-white/10 rounded-xl p-6">
                        <div class="flex items-center justify-between mb-6">
                            <h3 class="text-lg font-semibold text-text-primary">Personlige Oplysninger</h3>
                            <button class="px-4 py-2 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors" onclick="ProfileManager.enableEdit()">
                                <i class="fa-solid fa-pen mr-2"></i>
                                Rediger
                            </button>
                        </div>

                        <form id="profileForm" class="space-y-4">
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium text-text-secondary mb-1.5" for="fornavn">Fornavn</label>
                                    <input type="text" id="fornavn" value="${user.fornavn}" disabled class="w-full px-4 py-2.5 bg-dark-bg border border-white/10 rounded-lg text-text-primary disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-colors">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-text-secondary mb-1.5" for="efternavn">Efternavn</label>
                                    <input type="text" id="efternavn" value="${user.efternavn}" disabled class="w-full px-4 py-2.5 bg-dark-bg border border-white/10 rounded-lg text-text-primary disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-colors">
                                </div>
                            </div>

                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium text-text-secondary mb-1.5" for="email">Email</label>
                                    <input type="email" id="email" value="${user.email}" disabled class="w-full px-4 py-2.5 bg-dark-bg border border-white/10 rounded-lg text-text-primary disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-colors">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-text-secondary mb-1.5" for="telefon">Telefon</label>
                                    <input type="tel" id="telefon" value="${user.telefon || ''}" placeholder="Ikke angivet" disabled class="w-full px-4 py-2.5 bg-dark-bg border border-white/10 rounded-lg text-text-primary placeholder-text-secondary disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-colors">
                                </div>
                            </div>

                            <div>
                                <label class="block text-sm font-medium text-text-secondary mb-1.5" for="title">Titel / Stilling</label>
                                <input type="text" id="title" value="${user.title || ''}" placeholder="F.eks. Tekniker, Manager" disabled class="w-full px-4 py-2.5 bg-dark-bg border border-white/10 rounded-lg text-text-primary placeholder-text-secondary disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-colors">
                            </div>

                            <div class="hidden flex gap-3 pt-4 border-t border-white/10" id="profileFormActions">
                                <button type="button" class="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-text-secondary rounded-lg font-medium transition-colors" onclick="ProfileManager.cancelEdit()">
                                    Annuller
                                </button>
                                <button type="submit" class="flex-1 px-4 py-2.5 bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition-colors">
                                    Gem ændringer
                                </button>
                            </div>
                        </form>
                    </div>

                    <!-- Security Section -->
                    <div class="bg-dark-card border border-white/10 rounded-xl p-6">
                        <h3 class="text-lg font-semibold text-text-primary mb-6">Sikkerhed</h3>

                        <form id="passwordForm" class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-text-secondary mb-1.5" for="newPassword">Ny adgangskode</label>
                                <input type="password" id="newPassword" placeholder="Mindst 8 tegn" class="w-full px-4 py-2.5 bg-dark-bg border border-white/10 rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-colors">
                                <span class="text-xs text-text-secondary mt-1 block">Lad feltet være tomt, hvis du ikke vil ændre adgangskode</span>
                            </div>

                            <div>
                                <label class="block text-sm font-medium text-text-secondary mb-1.5" for="confirmPassword">Bekræft adgangskode</label>
                                <input type="password" id="confirmPassword" placeholder="Gentag ny adgangskode" class="w-full px-4 py-2.5 bg-dark-bg border border-white/10 rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-colors">
                            </div>

                            <button type="submit" class="px-4 py-2.5 bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition-colors">
                                Opdater adgangskode
                            </button>
                        </form>
                    </div>

                    <!-- Info Section -->
                    <div class="bg-primary/10 border border-primary/20 rounded-xl p-6">
                        <div class="flex items-start gap-4">
                            <div class="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                                <i class="fa-solid fa-info text-primary"></i>
                            </div>
                            <div>
                                <h4 class="font-medium text-text-primary">Vil du ændre brugernavn eller rolle?</h4>
                                <p class="text-text-secondary text-sm mt-1">Kontakt en administrator for at ændre dit brugernavn eller din rolle.</p>
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

        const formActions = document.getElementById('profileFormActions');
        if (formActions) {
            formActions.classList.remove('hidden');
            formActions.classList.add('flex');
        }

        const editBtn = document.querySelector('button[onclick="ProfileManager.enableEdit()"]');
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
        Modal.success('Succes', message);
    },

    showError(message) {
        Modal.error('Fejl', message);
    }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ProfileManager.init());
} else {
    ProfileManager.init();
}
