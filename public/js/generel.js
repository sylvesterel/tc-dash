// ============================================
// Initialization
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    setupMobileNav();
    loadNavbar();
    loadUserInfo();
});

// ============================================
// Mobile Navigation
// ============================================
function setupMobileNav() {
    // Add hamburger button to header
    const header = document.querySelector('header');
    if (header) {
        const hamburgerBtn = document.createElement('button');
        hamburgerBtn.className = 'hamburger-btn';
        hamburgerBtn.id = 'hamburgerBtn';
        hamburgerBtn.setAttribute('aria-label', 'Abn menu');
        hamburgerBtn.innerHTML = '<i class="fa-solid fa-bars"></i>';
        header.insertBefore(hamburgerBtn, header.firstChild);

        hamburgerBtn.addEventListener('click', toggleMobileNav);
    }

    // Add overlay element
    const overlay = document.createElement('div');
    overlay.className = 'nav-overlay';
    overlay.id = 'navOverlay';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', closeMobileNav);
}

function toggleMobileNav() {
    const nav = document.getElementById('navbar');
    const overlay = document.getElementById('navOverlay');

    if (nav && overlay) {
        const isOpen = nav.classList.contains('mobile-open');
        if (isOpen) {
            closeMobileNav();
        } else {
            nav.classList.add('mobile-open');
            overlay.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
    }
}

function closeMobileNav() {
    const nav = document.getElementById('navbar');
    const overlay = document.getElementById('navOverlay');

    if (nav) nav.classList.remove('mobile-open');
    if (overlay) overlay.classList.remove('show');
    document.body.style.overflow = '';
}

// ============================================
// Navigation
// ============================================
function loadNavbar() {
    fetch('/navbar.html')
        .then(response => response.text())
        .then(data => {
            document.getElementById('navbar').innerHTML = data;

            const currentPath = window.location.pathname;
            const links = document.querySelectorAll('#navbar a');

            links.forEach(link => {
                if (link.getAttribute('href') === currentPath) {
                    link.classList.add('active');
                } else {
                    link.classList.remove('active');
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
        })
        .catch(err => console.error('Fejl ved indlasning af navbar:', err));
}

// ============================================
// Logout Handler
// ============================================
function setupLogoutHandler() {
    const logoutBtn = document.querySelector('.nav-bottom h1');
    if (logoutBtn) {
        logoutBtn.style.cursor = 'pointer';
        logoutBtn.addEventListener('click', async () => {
            if (confirm('Er du sikker på at du vil logge ud?')) {
                try {
                    await fetch('/logout', { method: 'POST' });
                    window.location.href = '/login.html';
                } catch (error) {
                    console.error('Logout error:', error);
                    alert('Kunne ikke logge ud. Prøv igen.');
                }
            }
        });
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
            document.getElementById('user-name').textContent = data.user.fornavn;
        }
    } catch (error) {
        console.error('Error loading user info:', error);
    }
}