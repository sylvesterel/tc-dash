// ============================================
// Global State
// ============================================
let currentUser = null;

// ============================================
// Initialization
// ============================================
document.addEventListener('DOMContentLoaded', async function() {
    setupMobileNav();
    await loadNavbar();
    await loadUserInfo();
    checkPageStatus();
});

// ============================================
// Mobile Navigation
// ============================================
function setupMobileNav() {
    const header = document.querySelector('header');
    if (header) {
        // Check if hamburger button already exists
        if (!document.getElementById('hamburgerBtn')) {
            const hamburgerBtn = document.createElement('button');
            hamburgerBtn.className = 'lg:hidden flex items-center justify-center w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 text-text-secondary transition-colors';
            hamburgerBtn.id = 'hamburgerBtn';
            hamburgerBtn.setAttribute('aria-label', 'Åbn menu');
            hamburgerBtn.innerHTML = '<i class="fa-solid fa-bars text-lg"></i>';
            header.insertBefore(hamburgerBtn, header.firstChild);
            hamburgerBtn.addEventListener('click', toggleMobileNav);
        }
    }

    // Add overlay element if not exists
    if (!document.getElementById('navOverlay')) {
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black/50 z-40 hidden lg:hidden transition-opacity';
        overlay.id = 'navOverlay';
        document.body.appendChild(overlay);
        overlay.addEventListener('click', closeMobileNav);
    }
}

function toggleMobileNav() {
    const nav = document.getElementById('navbar');
    const overlay = document.getElementById('navOverlay');

    if (nav && overlay) {
        const isOpen = nav.classList.contains('translate-x-0');
        if (isOpen) {
            closeMobileNav();
        } else {
            nav.classList.remove('-translate-x-full');
            nav.classList.add('translate-x-0');
            overlay.classList.remove('hidden');
            overlay.classList.add('block');
            document.body.style.overflow = 'hidden';
        }
    }
}

function closeMobileNav() {
    const nav = document.getElementById('navbar');
    const overlay = document.getElementById('navOverlay');

    if (nav) {
        nav.classList.add('-translate-x-full');
        nav.classList.remove('translate-x-0');
    }
    if (overlay) {
        overlay.classList.add('hidden');
        overlay.classList.remove('block');
    }
    document.body.style.overflow = '';
}

// ============================================
// Navigation
// ============================================
async function loadNavbar() {
    try {
        const response = await fetch('/navbar.html');
        const data = await response.text();

        const navbar = document.getElementById('navbar');
        if (navbar) {
            navbar.innerHTML = data;
        }

        const currentPath = window.location.pathname;
        const links = document.querySelectorAll('#navbar a');

        links.forEach(link => {
            if (link.getAttribute('href') === currentPath) {
                link.classList.add('active', 'bg-dark-hover', 'text-text-primary');
            } else {
                link.classList.remove('active', 'bg-dark-hover', 'text-text-primary');
            }

            // Close mobile nav when clicking a link
            link.addEventListener('click', () => {
                closeMobileNav();
            });
        });

        // Setup logout handler
        setupLogoutHandler();

        // Setup mobile close button
        const closeBtn = document.getElementById('hamburgerClose');
        if (closeBtn) {
            closeBtn.addEventListener('click', closeMobileNav);
        }
    } catch (err) {
        console.error('Fejl ved indlæsning af navbar:', err);
    }
}

// ============================================
// Logout Handler
// ============================================
function setupLogoutHandler() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', showLogoutConfirm);
    }
}

function showLogoutConfirm() {
    // Remove existing modal if any
    const existingModal = document.getElementById('logoutModal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4';
    modal.id = 'logoutModal';
    modal.innerHTML = `
        <div class="bg-dark-card border border-white/10 rounded-2xl w-full max-w-sm p-6 text-center" style="animation: fadeInUp 0.3s ease forwards;">
            <div class="w-14 h-14 rounded-2xl bg-yellow-500/20 flex items-center justify-center mx-auto mb-4">
                <i class="fa-solid fa-right-from-bracket text-yellow-400 text-xl"></i>
            </div>
            <h3 class="text-xl font-semibold text-text-primary mb-2">Log ud</h3>
            <p class="text-text-secondary mb-6">Er du sikker på at du vil logge ud?</p>
            <div class="flex gap-3">
                <button class="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-text-secondary rounded-xl font-medium transition-colors" onclick="closeLogoutModal()">
                    Annuller
                </button>
                <button class="flex-1 px-4 py-3 bg-yellow-500 hover:bg-yellow-600 text-black rounded-xl font-medium transition-colors" onclick="executeLogout()">
                    Log ud
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Close on overlay click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeLogoutModal();
    });

    // Close on Escape key
    document.addEventListener('keydown', handleLogoutEscape);
}

function handleLogoutEscape(e) {
    if (e.key === 'Escape') {
        closeLogoutModal();
    }
}

function closeLogoutModal() {
    const modal = document.getElementById('logoutModal');
    if (modal) modal.remove();
    document.removeEventListener('keydown', handleLogoutEscape);
}

async function executeLogout() {
    const modal = document.getElementById('logoutModal');
    const buttons = modal?.querySelectorAll('button');

    // Disable buttons and show loading
    if (buttons) {
        buttons.forEach(btn => {
            btn.disabled = true;
            btn.classList.add('opacity-50', 'cursor-not-allowed');
        });
    }

    try {
        await fetch('/logout', { method: 'POST' });
        window.location.href = '/login.html';
    } catch (error) {
        console.error('Logout error:', error);
        closeLogoutModal();
        showNotification('Kunne ikke logge ud. Prøv igen.', 'error');
    }
}

// ============================================
// User Info
// ============================================
async function loadUserInfo() {
    try {
        const response = await fetch('/me');
        const data = await response.json();

        if (data.user) {
            currentUser = data.user;

            // Check if user must change password
            if (data.user.mustChangePassword) {
                window.location.href = '/change-password.html';
                return;
            }

            const userNameEl = document.getElementById('user-name');
            if (userNameEl) {
                userNameEl.textContent = data.user.fornavn;
            }
        }
    } catch (error) {
        console.error('Error loading user info:', error);
    }
}

// ============================================
// Page Status Check
// ============================================
async function checkPageStatus() {
    try {
        const currentPath = window.location.pathname;
        const response = await fetch(`/api/page-status/check?path=${encodeURIComponent(currentPath)}`);
        const data = await response.json();

        if (data.success && data.isDisabled) {
            showDisabledPagePopup(data.message);
        }
    } catch (error) {
        console.error('Error checking page status:', error);
    }
}

function showDisabledPagePopup(message) {
    // Remove existing popup if any
    const existingPopup = document.getElementById('disabledPagePopup');
    if (existingPopup) existingPopup.remove();

    const isAdmin = currentUser && currentUser.rolle === 'admin';

    const popup = document.createElement('div');
    popup.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4';
    popup.id = 'disabledPagePopup';
    popup.innerHTML = `
        <div class="bg-dark-card border border-white/10 rounded-2xl w-full max-w-md p-8 text-center" style="animation: fadeInUp 0.3s ease forwards;">
            <div class="w-20 h-20 rounded-2xl bg-yellow-500/20 flex items-center justify-center mx-auto mb-6">
                <i class="fa-solid fa-triangle-exclamation text-yellow-400 text-3xl"></i>
            </div>
            <h3 class="text-2xl font-bold text-text-primary mb-3">Side Deaktiveret</h3>
            <p class="text-text-secondary mb-6 leading-relaxed">${escapeHtml(message)}</p>
            <div class="space-y-3">
                <a href="/" class="block w-full px-4 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-medium transition-colors">
                    <i class="fa-solid fa-home mr-2"></i>
                    Gå til forsiden
                </a>
                ${isAdmin ? `
                    <button onclick="closeDisabledPagePopup()" class="w-full px-4 py-3 bg-white/5 hover:bg-white/10 text-text-secondary rounded-xl font-medium transition-colors">
                        <i class="fa-solid fa-shield-halved mr-2"></i>
                        Fortsæt alligevel (Admin)
                    </button>
                ` : ''}
            </div>
            ${!isAdmin ? `
                <p class="text-text-secondary/60 text-sm mt-6">
                    <i class="fa-solid fa-lock mr-1"></i>
                    Kontakt en administrator for at få adgang
                </p>
            ` : ''}
        </div>
    `;

    document.body.appendChild(popup);

    // Prevent scrolling
    document.body.style.overflow = 'hidden';
}

function closeDisabledPagePopup() {
    const popup = document.getElementById('disabledPagePopup');
    if (popup) {
        popup.remove();
        document.body.style.overflow = '';
    }
}

// ============================================
// Global Notification
// ============================================
function showNotification(message, type = 'info') {
    // Remove existing notifications
    document.querySelectorAll('.global-notification').forEach(n => n.remove());

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
    notification.className = `global-notification fixed top-4 right-4 z-[10000] px-5 py-4 rounded-xl border ${colors[type]} flex items-center gap-3 shadow-2xl`;
    notification.style.animation = 'fadeInUp 0.3s ease forwards';
    notification.innerHTML = `
        <i class="fa-solid ${icons[type]}"></i>
        <span class="font-medium">${escapeHtml(message)}</span>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-10px)';
        notification.style.transition = 'all 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
    }
`;
document.head.appendChild(style);
