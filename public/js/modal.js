// ============================================
// Global Modal System
// ============================================
// Fælles modal-system til alle sider
// Erstatter browser confirm() og alert()

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
    initialized: false,

    // ============================================
    // Initialize
    // ============================================
    init() {
        if (this.initialized) return;

        // Opret modal HTML hvis den ikke findes
        if (!document.getElementById('globalModalOverlay')) {
            this.createModalHTML();
        }

        this.overlay = document.getElementById('globalModalOverlay');
        this.modal = document.getElementById('globalModal');
        this.icon = document.getElementById('globalModalIcon');
        this.title = document.getElementById('globalModalTitle');
        this.message = document.getElementById('globalModalMessage');
        this.buttons = document.getElementById('globalModalButtons');
        this.cancelBtn = document.getElementById('globalModalCancel');
        this.confirmBtn = document.getElementById('globalModalConfirm');

        if (!this.overlay) return;

        this.cancelBtn.addEventListener('click', () => this.close(false));
        this.confirmBtn.addEventListener('click', () => this.close(true));
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close(false);
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.overlay.classList.contains('flex')) {
                this.close(false);
            }
        });

        this.initialized = true;
    },

    // ============================================
    // Create Modal HTML
    // ============================================
    createModalHTML() {
        const modalHTML = `
            <div class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 hidden items-center justify-center p-4" id="globalModalOverlay">
                <div class="bg-dark-card border border-white/10 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl" id="globalModal">
                    <div class="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4" id="globalModalIcon"></div>
                    <h3 class="text-xl font-semibold text-text-primary mb-2" id="globalModalTitle">Titel</h3>
                    <p class="text-text-secondary mb-6" id="globalModalMessage">Besked</p>
                    <div class="flex gap-3 justify-center" id="globalModalButtons">
                        <button class="px-5 py-2.5 rounded-lg font-medium transition-colors bg-white/5 hover:bg-white/10 text-text-secondary border border-white/10" id="globalModalCancel">Annuller</button>
                        <button class="px-5 py-2.5 rounded-lg font-medium transition-colors" id="globalModalConfirm">Bekræft</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    // ============================================
    // Show Modal
    // ============================================
    show(options) {
        if (!this.initialized) this.init();

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
            danger: '✕',
            success: '✓',
            info: 'i'
        };

        const iconColors = {
            warning: 'bg-yellow-500/20 text-yellow-500',
            danger: 'bg-red-500/20 text-red-500',
            success: 'bg-green-500/20 text-green-500',
            info: 'bg-primary/20 text-primary'
        };

        const buttonColors = {
            warning: 'bg-yellow-500 hover:bg-yellow-600 text-black',
            danger: 'bg-red-500 hover:bg-red-600 text-white',
            success: 'bg-green-500 hover:bg-green-600 text-white',
            info: 'bg-primary hover:bg-primary/80 text-white'
        };

        this.icon.innerHTML = icons[type] || icons.info;
        this.icon.className = `w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4 ${iconColors[type] || iconColors.info}`;
        this.title.textContent = title;
        this.message.innerHTML = message;
        this.confirmBtn.textContent = confirmText;
        this.confirmBtn.className = `px-5 py-2.5 rounded-lg font-medium transition-colors ${buttonColors[type] || buttonColors.info}`;

        if (showCancel) {
            this.cancelBtn.style.display = 'block';
            this.cancelBtn.textContent = cancelText;
        } else {
            this.cancelBtn.style.display = 'none';
        }

        this.overlay.classList.remove('hidden');
        this.overlay.classList.add('flex');
        this.confirmBtn.focus();

        return new Promise((resolve) => {
            this.resolvePromise = resolve;
        });
    },

    // ============================================
    // Close Modal
    // ============================================
    close(result) {
        this.overlay.classList.add('hidden');
        this.overlay.classList.remove('flex');
        if (this.resolvePromise) {
            this.resolvePromise(result);
            this.resolvePromise = null;
        }
    },

    // ============================================
    // Helper Methods
    // ============================================
    async confirm(title, message, type = 'warning') {
        return this.show({
            type,
            title,
            message,
            confirmText: 'Ja, fortsæt',
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

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Modal.init());
} else {
    Modal.init();
}
