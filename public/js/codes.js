// ============================================
// Configuration
// ============================================
const API_URL = '/api';
let passwords = [];
let deleteId = null;
let activeFilter = 'all';

// ============================================
// DOM Elements
// ============================================
const passwordContainer = document.getElementById('passwordContainer');
const emptyState = document.getElementById('emptyState');
const addBtn = document.getElementById('addBtn');
const modalOverlay = document.getElementById('modalOverlay');
const closeModal = document.getElementById('closeModal');
const cancelModal = document.getElementById('cancelModal');
const passwordForm = document.getElementById('passwordForm');
const searchInput = document.getElementById('searchInput');
const alphabetFilter = document.getElementById('alphabetFilter');
const togglePassword = document.getElementById('togglePassword');

// ============================================
// Initialization
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setupEventListeners();
    buildAlphabetFilter();
});

// ============================================
// Event Listeners
// ============================================
function setupEventListeners() {
    addBtn.onclick = () => openModal();
    closeModal.onclick = () => closeModalFn();
    cancelModal.onclick = () => closeModalFn();

    modalOverlay.onclick = (e) => {
        if (e.target === modalOverlay) closeModalFn();
    };

    passwordForm.onsubmit = handleSubmit;
    searchInput.oninput = (e) => render(e.target.value);

    document.getElementById('cancelDelete').onclick = () => {
        document.getElementById('deleteModal').classList.remove('flex');
        document.getElementById('deleteModal').classList.add('hidden');
        deleteId = null;
    };

    document.getElementById('confirmDelete').onclick = handleDelete;

    // Toggle password visibility
    if (togglePassword) {
        togglePassword.onclick = () => {
            const pwInput = document.getElementById('password');
            const icon = togglePassword.querySelector('i');
            if (pwInput.type === 'password') {
                pwInput.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                pwInput.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        };
    }
}

// ============================================
// Data Fetching
// ============================================
async function loadData() {
    try {
        const res = await fetch(`${API_URL}/passwords`);
        if (!res.ok) throw new Error('Kunne ikke hente data');
        passwords = await res.json();
        render();
        updateStats();
        updateAlphabetFilter();
    } catch (err) {
        console.error("Kunne ikke hente data", err);
        showToast('Kunne ikke hente adgangskoder', 'error');
    }
}

// ============================================
// Alphabet Filter
// ============================================
function buildAlphabetFilter() {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('');
    alphabetFilter.innerHTML = `
        <button class="alphabet-btn px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-white cursor-pointer transition-all" data-letter="all">Alle</button>
    `;

    letters.forEach(letter => {
        const btn = document.createElement('button');
        btn.className = 'alphabet-btn px-3 py-1.5 rounded-lg text-xs font-medium bg-dark-hover text-text-secondary cursor-pointer transition-all hover:bg-[#252f3a]';
        btn.dataset.letter = letter;
        btn.textContent = letter;
        btn.onclick = () => setFilter(letter);
        alphabetFilter.appendChild(btn);
    });

    document.querySelector('[data-letter="all"]').onclick = () => setFilter('all');
}

function updateAlphabetFilter() {
    const usedLetters = new Set();
    passwords.forEach(p => {
        const firstChar = p.siteName.charAt(0).toUpperCase();
        if (/[A-Z]/.test(firstChar)) {
            usedLetters.add(firstChar);
        } else {
            usedLetters.add('#');
        }
    });

    document.querySelectorAll('.alphabet-btn').forEach(btn => {
        const letter = btn.dataset.letter;
        if (letter === 'all') return;

        if (usedLetters.has(letter)) {
            btn.classList.remove('opacity-30', 'cursor-not-allowed');
            btn.classList.add('cursor-pointer');
            btn.disabled = false;
        } else {
            btn.classList.add('opacity-30', 'cursor-not-allowed');
            btn.classList.remove('cursor-pointer');
            btn.disabled = true;
        }
    });
}

function setFilter(letter) {
    activeFilter = letter;

    document.querySelectorAll('.alphabet-btn').forEach(btn => {
        if (btn.dataset.letter === letter) {
            btn.classList.remove('bg-dark-hover', 'text-text-secondary');
            btn.classList.add('bg-primary', 'text-white');
        } else {
            btn.classList.remove('bg-primary', 'text-white');
            btn.classList.add('bg-dark-hover', 'text-text-secondary');
        }
    });

    render(searchInput.value);
}

// ============================================
// Rendering
// ============================================
function extractDomain(url) {
    return url.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "").split('/')[0];
}

function render(searchFilter = "") {
    passwordContainer.innerHTML = "";

    // Filter passwords
    let filtered = passwords.filter(p =>
        p.siteName.toLowerCase().includes(searchFilter.toLowerCase()) ||
        p.username.toLowerCase().includes(searchFilter.toLowerCase())
    );

    // Apply alphabet filter
    if (activeFilter !== 'all') {
        filtered = filtered.filter(p => {
            const firstChar = p.siteName.charAt(0).toUpperCase();
            if (activeFilter === '#') {
                return !/[A-Z]/.test(firstChar);
            }
            return firstChar === activeFilter;
        });
    }

    if (filtered.length === 0) {
        emptyState.classList.remove('hidden');
        passwordContainer.classList.add('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    passwordContainer.classList.remove('hidden');

    // Group by first letter
    const groups = {};
    filtered.forEach(p => {
        const firstChar = p.siteName.charAt(0).toUpperCase();
        const groupKey = /[A-Z]/.test(firstChar) ? firstChar : '#';
        if (!groups[groupKey]) groups[groupKey] = [];
        groups[groupKey].push(p);
    });

    // Sort groups alphabetically
    const sortedKeys = Object.keys(groups).sort((a, b) => {
        if (a === '#') return 1;
        if (b === '#') return -1;
        return a.localeCompare(b);
    });

    // Render each group
    sortedKeys.forEach(letter => {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'mb-6';

        // Group header
        groupDiv.innerHTML = `
            <div class="flex items-center gap-3 mb-3">
                <span class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">${letter}</span>
                <span class="text-xs text-text-secondary font-medium">${groups[letter].length} ${groups[letter].length === 1 ? 'kode' : 'koder'}</span>
                <div class="flex-1 h-px bg-[#333]"></div>
            </div>
        `;

        // Password items
        const itemsContainer = document.createElement('div');
        itemsContainer.className = 'space-y-2';

        groups[letter].forEach(p => {
            const domain = extractDomain(p.url);
            const icon = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

            const item = document.createElement('div');
            item.className = 'flex items-center justify-between p-4 bg-dark-hover rounded-xl border border-transparent hover:border-[#333] transition-all group';
            item.innerHTML = `
                <div class="flex items-center gap-4 flex-1 min-w-0">
                    <img src="${icon}" class="w-10 h-10 rounded-lg object-contain bg-white/5 p-1" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2280%22>🔒</text></svg>'">
                    <div class="min-w-0">
                        <h4 class="text-text-primary font-medium text-sm truncate">${p.siteName}</h4>
                        <p class="text-text-secondary text-xs truncate">${domain}</p>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <div class="text-right mr-4 hidden sm:block">
                        <p class="text-text-secondary text-xs">${p.username}</p>
                        <p class="text-text-secondary text-xs font-mono">••••••••</p>
                    </div>
                    <button class="copy-btn w-9 h-9 rounded-lg bg-transparent border border-[#333] text-text-secondary flex items-center justify-center hover:bg-primary hover:border-primary hover:text-white transition-all" title="Kopiér adgangskode">
                        <i class="fa-regular fa-copy"></i>
                    </button>
                    <button class="link-btn w-9 h-9 rounded-lg bg-transparent border border-[#333] text-text-secondary flex items-center justify-center hover:bg-info hover:border-info hover:text-white transition-all" title="Åbn link">
                        <i class="fa-solid fa-arrow-up-right-from-square"></i>
                    </button>
                    <button class="delete-btn w-9 h-9 rounded-lg bg-transparent border border-[#333] text-text-secondary flex items-center justify-center hover:bg-error hover:border-error hover:text-white transition-all" title="Slet">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;

            // Copy password
            item.querySelector('.copy-btn').onclick = () => {
                navigator.clipboard.writeText(p.password);
                showToast('Adgangskode kopieret!', 'success');
            };

            // Open link
            item.querySelector('.link-btn').onclick = () => {
                let url = p.url;
                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    url = 'https://' + url;
                }
                window.open(url, '_blank');
            };

            // Delete
            item.querySelector('.delete-btn').onclick = () => {
                deleteId = p.id;
                document.getElementById('deleteModal').classList.remove('hidden');
                document.getElementById('deleteModal').classList.add('flex');
            };

            itemsContainer.appendChild(item);
        });

        groupDiv.appendChild(itemsContainer);
        passwordContainer.appendChild(groupDiv);
    });
}

// ============================================
// Stats
// ============================================
function updateStats() {
    document.getElementById('totalCountBadge').textContent = passwords.length;
    document.getElementById('totalValue').textContent = passwords.length;

    const unique = new Set(passwords.map(p => extractDomain(p.url))).size;
    document.getElementById('uniqueSites').textContent = unique;

    const score = document.getElementById('securityScore');
    if (passwords.length > 10) {
        score.textContent = "Høj";
        score.className = "text-[2.8rem] font-semibold text-success mb-3";
    } else if (passwords.length > 5) {
        score.textContent = "God";
        score.className = "text-[2.8rem] font-semibold text-info mb-3";
    } else if (passwords.length > 0) {
        score.textContent = "Middel";
        score.className = "text-[2.8rem] font-semibold text-warning mb-3";
    } else {
        score.textContent = "-";
        score.className = "text-[2.8rem] font-semibold text-text-primary mb-3";
    }
}

// ============================================
// Modal Functions
// ============================================
function openModal() {
    modalOverlay.classList.remove('hidden');
    modalOverlay.classList.add('flex');
    document.getElementById('siteName').focus();
}

function closeModalFn() {
    modalOverlay.classList.remove('flex');
    modalOverlay.classList.add('hidden');
    passwordForm.reset();

    // Reset password visibility
    const pwInput = document.getElementById('password');
    const icon = togglePassword?.querySelector('i');
    if (pwInput) pwInput.type = 'password';
    if (icon) {
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

// ============================================
// Form Handling
// ============================================
async function handleSubmit(e) {
    e.preventDefault();

    const data = {
        siteName: document.getElementById('siteName').value.trim(),
        url: document.getElementById('siteUrl').value.trim(),
        username: document.getElementById('username').value.trim(),
        password: document.getElementById('password').value
    };

    try {
        const res = await fetch(`${API_URL}/passwords`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            closeModalFn();
            loadData();
            showToast('Adgangskode gemt!', 'success');
        } else {
            throw new Error('Kunne ikke gemme');
        }
    } catch (err) {
        console.error(err);
        showToast('Kunne ikke gemme adgangskode', 'error');
    }
}

async function handleDelete() {
    if (!deleteId) return;

    try {
        const res = await fetch(`${API_URL}/passwords/${deleteId}`, { method: 'DELETE' });
        if (res.ok) {
            document.getElementById('deleteModal').classList.remove('flex');
            document.getElementById('deleteModal').classList.add('hidden');
            deleteId = null;
            loadData();
            showToast('Adgangskode slettet', 'success');
        } else {
            throw new Error('Kunne ikke slette');
        }
    } catch (err) {
        console.error(err);
        showToast('Kunne ikke slette adgangskode', 'error');
    }
}

// ============================================
// Toast Notifications
// ============================================
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;

    // Reset classes
    toast.className = 'fixed bottom-6 right-6 px-5 py-3 rounded-lg text-white font-medium shadow-lg transition-all duration-300 z-[10001]';

    // Add type-specific background
    switch(type) {
        case 'success':
            toast.classList.add('bg-success');
            break;
        case 'error':
            toast.classList.add('bg-error');
            break;
        case 'warning':
            toast.classList.add('bg-warning', 'text-dark-bg');
            break;
        default:
            toast.classList.add('bg-primary');
    }

    // Show toast
    toast.classList.remove('translate-y-20', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');

    // Hide after 3 seconds
    setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('translate-y-20', 'opacity-0');
    }, 3000);
}
