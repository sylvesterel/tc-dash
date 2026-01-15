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
        })
        .catch(err => console.error('Fejl ved indlasning af navbar:', err));
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