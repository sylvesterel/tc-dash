// ============================================
// Initialization
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    loadNavbar();
    loadUserInfo();
});

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
            });

            // Setup logout handler
            setupLogoutHandler();
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