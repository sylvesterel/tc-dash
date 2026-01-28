// ============================================
// Configuration
// ============================================
const API_URL = '/api';
let passwords = [];
let deleteId = null;
let activeFilter = 'all';
let currentEntryType = 'login';
let editMode = false;

// ============================================
// Security: HTML Escaping
// ============================================
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

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

    // Toggle password visibility (using CSS masking to avoid autofill)
    if (togglePassword) {
        togglePassword.onclick = () => {
            const pwInput = document.getElementById('password');
            const icon = togglePassword.querySelector('i');
            const isHidden = pwInput.style.webkitTextSecurity === 'disc' || pwInput.style.webkitTextSecurity === '';

            if (isHidden) {
                pwInput.style.webkitTextSecurity = 'none';
                pwInput.classList.remove('masked');
                pwInput.classList.add('visible');
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                pwInput.style.webkitTextSecurity = 'disc';
                pwInput.classList.remove('visible');
                pwInput.classList.add('masked');
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        };
    }

    // Type selection buttons
    const typeLogin = document.getElementById('typeLogin');
    const typePartner = document.getElementById('typePartner');

    if (typeLogin) {
        typeLogin.onclick = () => setEntryType('login');
    }
    if (typePartner) {
        typePartner.onclick = () => setEntryType('partner');
    }
}

// ============================================
// Entry Type Handling
// ============================================
function setEntryType(type) {
    currentEntryType = type;

    const typeLogin = document.getElementById('typeLogin');
    const typePartner = document.getElementById('typePartner');
    const loginFields = document.getElementById('loginFields');
    const partnerFields = document.getElementById('partnerFields');

    if (type === 'login') {
        typeLogin.classList.remove('bg-dark-hover', 'border-[#333]', 'text-text-secondary');
        typeLogin.classList.add('bg-primary/10', 'border-primary', 'text-primary');
        typePartner.classList.remove('bg-info/10', 'border-info', 'text-info');
        typePartner.classList.add('bg-dark-hover', 'border-[#333]', 'text-text-secondary');

        loginFields.classList.remove('hidden');
        partnerFields.classList.add('hidden');
    } else {
        typePartner.classList.remove('bg-dark-hover', 'border-[#333]', 'text-text-secondary');
        typePartner.classList.add('bg-info/10', 'border-info', 'text-info');
        typeLogin.classList.remove('bg-primary/10', 'border-primary', 'text-primary');
        typeLogin.classList.add('bg-dark-hover', 'border-[#333]', 'text-text-secondary');

        loginFields.classList.add('hidden');
        partnerFields.classList.remove('hidden');
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

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
}

function render(searchFilter = "") {
    passwordContainer.innerHTML = "";

    // Filter passwords
    let filtered = passwords.filter(p =>
        p.siteName.toLowerCase().includes(searchFilter.toLowerCase()) ||
        (p.username && p.username.toLowerCase().includes(searchFilter.toLowerCase())) ||
        (p.partnerId && p.partnerId.toLowerCase().includes(searchFilter.toLowerCase()))
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
            const isPartner = p.entryType === 'partner';

            const item = document.createElement('div');
            item.className = 'grid grid-cols-[200px_1fr_180px_160px] gap-4 items-center p-4 bg-dark-hover rounded-xl border border-transparent hover:border-[#333] transition-all group';

            // Build credential display based on type
            let credentialHtml = '';
            if (isPartner) {
                credentialHtml = `
                    <div class="flex flex-col text-right">
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-info/10 text-info text-xs font-medium rounded-lg justify-end w-fit ml-auto">
                            <i class="fa-solid fa-handshake text-[10px]"></i>
                            Samarbejde
                        </span>
                        <p class="font-mono text-sm text-text-primary mt-1 truncate">${escapeHtml(p.partnerId)}</p>
                    </div>
                `;
            } else {
                credentialHtml = `
                    <div class="flex flex-col text-right">
                        <p class="text-sm text-text-primary truncate">${escapeHtml(p.username)}</p>
                        <p class="font-mono text-text-secondary">••••••••</p>
                    </div>
                `;
            }

            item.innerHTML = `
                <!-- Kolonne 1: Ikon + Navn -->
                <div class="flex items-center gap-3 min-w-0">
                    <img src="${escapeHtml(icon)}" class="w-10 h-10 rounded-lg object-contain bg-white/5 p-1 flex-shrink-0"
                        onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2280%22>🔒</text></svg>'">
                    <div class="min-w-0">
                        <h4 class="text-text-primary font-medium text-sm truncate">${escapeHtml(p.siteName)}</h4>
                        <p class="text-text-secondary text-xs truncate">${escapeHtml(domain)}</p>
                    </div>
                </div>

                <!-- Kolonne 2: Note + Oprettet af -->
                <div class="flex flex-col justify-center min-w-0">
                    ${p.note ? `
                        <div class="flex items-start gap-2">
                            <i class="fa-solid fa-sticky-note text-warning/60 text-xs mt-0.5 flex-shrink-0"></i>
                            <p class="text-sm text-text-secondary truncate">${escapeHtml(p.note)}</p>
                        </div>
                    ` : '<div class="text-text-secondary/30 text-sm">—</div>'}
                    <div class="flex items-center gap-3 mt-1">
                        <span class="inline-flex items-center gap-1.5 text-[11px] text-text-secondary/70">
                            <i class="fa-solid fa-user-pen text-[10px]"></i>
                            ${escapeHtml(p.user)}
                        </span>
                        ${p.createdAt ? `
                            <span class="inline-flex items-center gap-1.5 text-[11px] text-text-secondary/70">
                                <i class="fa-regular fa-calendar text-[10px]"></i>
                                ${formatDate(p.createdAt)}
                            </span>
                        ` : ''}
                    </div>
                </div>

                <!-- Kolonne 3: Credentials -->
                ${credentialHtml}

                <!-- Kolonne 4: Actions -->
                <div class="flex items-center gap-2 justify-end">
                    ${!isPartner ? `
                        <button class="copy-btn w-9 h-9 rounded-lg bg-transparent border border-[#333] text-text-secondary flex items-center justify-center hover:bg-primary hover:border-primary hover:text-white transition-all" title="Kopiér adgangskode">
                            <i class="fa-regular fa-copy"></i>
                        </button>
                    ` : `
                        <button class="copy-id-btn w-9 h-9 rounded-lg bg-transparent border border-[#333] text-text-secondary flex items-center justify-center hover:bg-info hover:border-info hover:text-white transition-all" title="Kopiér ID">
                            <i class="fa-regular fa-copy"></i>
                        </button>
                    `}
                    <button class="link-btn w-9 h-9 rounded-lg bg-transparent border border-[#333] text-text-secondary flex items-center justify-center hover:bg-info hover:border-info hover:text-white transition-all" title="Åbn link">
                        <i class="fa-solid fa-arrow-up-right-from-square"></i>
                    </button>
                    <button class="edit-btn w-9 h-9 rounded-lg bg-transparent border border-[#333] text-text-secondary flex items-center justify-center hover:bg-warning hover:border-warning hover:text-white transition-all" title="Rediger">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="delete-btn w-9 h-9 rounded-lg bg-transparent border border-[#333] text-text-secondary flex items-center justify-center hover:bg-error hover:border-error hover:text-white transition-all" title="Slet">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;

            // Copy password
            const copyBtn = item.querySelector('.copy-btn');
            if (copyBtn) {
                copyBtn.onclick = () => {
                    navigator.clipboard.writeText(p.password);
                    showToast('Adgangskode kopieret!', 'success');
                };
            }

            // Copy partner ID
            const copyIdBtn = item.querySelector('.copy-id-btn');
            if (copyIdBtn) {
                copyIdBtn.onclick = () => {
                    navigator.clipboard.writeText(p.partnerId);
                    showToast('Partner ID kopieret!', 'success');
                };
            }

            // Open link
            item.querySelector('.link-btn').onclick = () => {
                let url = p.url;
                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    url = 'https://' + url;
                }
                window.open(url, '_blank');
            };

            // Edit
            item.querySelector('.edit-btn').onclick = () => {
                openEditModal(p.id);
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

    // Calculate average password length for login types only
    const loginPasswords = passwords.filter(p => p.entryType !== 'partner' && p.password);
    let amn = 0;
    loginPasswords.forEach(pass => amn += (pass.password?.length || 0));

    const unique = new Set(passwords.map(p => extractDomain(p.url))).size;
    document.getElementById('uniqueSites').textContent = unique;

    const score = document.getElementById('securityScore');
    const avgLength = loginPasswords.length > 0 ? amn / loginPasswords.length : 0;

    if (avgLength > 16) {
        score.textContent = "Høj";
        score.className = "text-[2.8rem] font-semibold text-success mb-3";
    } else if (avgLength > 12) {
        score.textContent = "God";
        score.className = "text-[2.8rem] font-semibold text-info mb-3";
    } else if (avgLength > 8) {
        score.textContent = "Middel";
        score.className = "text-[2.8rem] font-semibold text-warning mb-3";
    } else if (loginPasswords.length === 0) {
        score.textContent = "-";
        score.className = "text-[2.8rem] font-semibold text-text-secondary mb-3";
    } else {
        score.textContent = "Lav";
        score.className = "text-[2.8rem] font-semibold text-error mb-3";
    }
}

// ============================================
// Modal Functions
// ============================================
function openModal() {
    editMode = false;
    document.getElementById('editId').value = '';
    document.getElementById('modalTitle').textContent = 'Tilføj ny adgangskode';
    document.getElementById('submitBtn').textContent = 'Gem adgangskode';
    document.getElementById('passwordHint').classList.add('hidden');

    // Reset form
    passwordForm.reset();
    setEntryType('login');

    modalOverlay.classList.remove('hidden');
    modalOverlay.classList.add('flex');
    document.getElementById('siteName').focus();
}

async function openEditModal(id) {
    editMode = true;

    try {
        const res = await fetch(`${API_URL}/passwords/${id}`);
        if (!res.ok) throw new Error('Kunne ikke hente data');

        const data = await res.json();

        document.getElementById('editId').value = id;
        document.getElementById('modalTitle').textContent = 'Rediger adgangskode';
        document.getElementById('submitBtn').textContent = 'Gem ændringer';
        document.getElementById('passwordHint').classList.remove('hidden');

        // Fill form
        document.getElementById('siteName').value = data.siteName || '';
        document.getElementById('siteUrl').value = data.url || '';
        document.getElementById('username').value = data.username || '';
        document.getElementById('password').value = ''; // Don't show existing password
        document.getElementById('partnerId').value = data.partnerId || '';
        document.getElementById('note').value = data.note || '';

        // Set type
        setEntryType(data.entryType || 'login');

        modalOverlay.classList.remove('hidden');
        modalOverlay.classList.add('flex');
        document.getElementById('siteName').focus();

    } catch (err) {
        console.error(err);
        showToast('Kunne ikke hente adgangskode', 'error');
    }
}

function closeModalFn() {
    modalOverlay.classList.remove('flex');
    modalOverlay.classList.add('hidden');
    passwordForm.reset();
    editMode = false;
    document.getElementById('editId').value = '';

    // Reset password visibility (using CSS masking)
    const pwInput = document.getElementById('password');
    const icon = togglePassword?.querySelector('i');
    if (pwInput) {
        pwInput.style.webkitTextSecurity = 'disc';
        pwInput.classList.remove('visible');
        pwInput.classList.add('masked');
    }
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

    const editId = document.getElementById('editId').value;
    const isEdit = editMode && editId;

    const data = {
        entryType: currentEntryType,
        siteName: document.getElementById('siteName').value.trim(),
        url: document.getElementById('siteUrl').value.trim(),
        note: document.getElementById('note').value.trim()
    };

    // Add type-specific fields
    if (currentEntryType === 'login') {
        data.username = document.getElementById('username').value.trim();
        const passwordValue = document.getElementById('password').value;
        // Only include password if it's filled (for edits, empty means keep existing)
        if (passwordValue || !isEdit) {
            data.password = passwordValue;
        }
    } else {
        data.partnerId = document.getElementById('partnerId').value.trim();
    }

    // Validation
    if (!data.siteName || !data.url) {
        showToast('Udfyld venligst navn og URL', 'error');
        return;
    }

    if (currentEntryType === 'login' && !isEdit) {
        if (!data.username || !data.password) {
            showToast('Udfyld venligst brugernavn og adgangskode', 'error');
            return;
        }
    }

    if (currentEntryType === 'partner' && !data.partnerId) {
        showToast('Udfyld venligst Partner ID', 'error');
        return;
    }

    try {
        const url = isEdit ? `${API_URL}/passwords/${editId}` : `${API_URL}/passwords`;
        const method = isEdit ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            closeModalFn();
            loadData();
            showToast(isEdit ? 'Adgangskode opdateret!' : 'Adgangskode gemt!', 'success');
        } else {
            const errorData = await res.json();
            throw new Error(errorData.error || 'Kunne ikke gemme');
        }
    } catch (err) {
        console.error(err);
        showToast(err.message || 'Kunne ikke gemme adgangskode', 'error');
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
    switch (type) {
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
