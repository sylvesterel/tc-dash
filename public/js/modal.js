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
            if (e.key === 'Escape' && this.overlay.classList.contains('show')) {
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
            <div class="global-modal-overlay" id="globalModalOverlay">
                <div class="global-modal" id="globalModal">
                    <div class="global-modal-icon" id="globalModalIcon"></div>
                    <h3 class="global-modal-title" id="globalModalTitle">Titel</h3>
                    <p class="global-modal-message" id="globalModalMessage">Besked</p>
                    <div class="global-modal-buttons" id="globalModalButtons">
                        <button class="global-modal-btn global-modal-btn-cancel" id="globalModalCancel">Annuller</button>
                        <button class="global-modal-btn global-modal-btn-confirm" id="globalModalConfirm">Bekræft</button>
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

        this.icon.innerHTML = icons[type] || icons.info;
        this.icon.className = 'global-modal-icon ' + type;
        this.title.textContent = title;
        this.message.innerHTML = message;
        this.confirmBtn.textContent = confirmText;
        this.confirmBtn.className = 'global-modal-btn global-modal-btn-confirm ' + type;

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

    // ============================================
    // Close Modal
    // ============================================
    close(result) {
        this.overlay.classList.remove('show');
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
