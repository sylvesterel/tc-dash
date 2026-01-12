// ============================================
// Access Codes Management JavaScript
// ============================================
// Handles access code (adgangskoder) CRUD operations with database integration

const AccessManager = {
    accessCodes: [],
    currentFilter: 'all',
    apiEndpoint: '/api/access-codes',

    // ============================================
    // Initialize
    // ============================================
    init() {
        this.loadAccessCodes();
        this.attachEventListeners();
    },

    // ============================================
    // API Calls
    // ============================================
    async loadAccessCodes() {
        try {
            const response = await fetch(this.apiEndpoint);
            if (!response.ok) throw new Error('Failed to load access codes');
            
            const data = await response.json();
            this.accessCodes = data.access_codes || [];
            this.updateCounts();
            this.renderAccessList(this.currentFilter);
        } catch (error) {
            console.error('Error loading access codes:', error);
            this.showError('Kunne ikke indlæse adgangskoder. Prøv igen.');
        }
    },

    async createAccessCode(accessData) {
        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(accessData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to create access code');
            }

            const result = await response.json();
            this.showSuccess(`Adgangskode oprettet!\n\nKode: ${result.access_code.access_code}\nArtist: ${result.access_code.artist_name}`);
            await this.loadAccessCodes();
            
            return result;
        } catch (error) {
            console.error('Error creating access code:', error);
            this.showError(error.message || 'Kunne ikke oprette adgangskode. Prøv igen.');
            throw error;
        }
    },

    async updateAccessCode(id, accessData) {
        try {
            const response = await fetch(`${this.apiEndpoint}/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(accessData)
            });

            if (!response.ok) throw new Error('Failed to update access code');

            const result = await response.json();
            this.showSuccess('Adgangskode opdateret!');
            await this.loadAccessCodes();
            
            return result;
        } catch (error) {
            console.error('Error updating access code:', error);
            this.showError('Kunne ikke opdatere adgangskode. Prøv igen.');
            throw error;
        }
    },

    async deleteAccessCode(id) {
        try {
            const response = await fetch(`${this.apiEndpoint}/${id}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Failed to delete access code');

            this.showSuccess('Adgangskode slettet!');
            await this.loadAccessCodes();
        } catch (error) {
            console.error('Error deleting access code:', error);
            this.showError('Kunne ikke slette adgangskode. Prøv igen.');
        }
    },

    async revokeAccessCode(id) {
        try {
            const response = await fetch(`${this.apiEndpoint}/${id}/revoke`, {
                method: 'POST'
            });

            if (!response.ok) throw new Error('Failed to revoke access code');

            this.showSuccess('Adgangskode tilbagekaldt!');
            await this.loadAccessCodes();
        } catch (error) {
            console.error('Error revoking access code:', error);
            this.showError('Kunne ikke tilbagekalde adgangskode. Prøv igen.');
        }
    },

    // ============================================
    // Event Listeners
    // ============================================
    attachEventListeners() {
        // Form submission
        const form = document.getElementById('accessForm');
        if (form) {
            form.addEventListener('submit', (e) => this.handleFormSubmit(e));
        }

        // Filter tabs
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.addEventListener('click', () => this.handleFilterClick(tab));
        });

        // Search
        const searchInput = document.getElementById('searchAccess');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.renderAccessList(this.currentFilter, e.target.value);
            });
        }

        // Navigation buttons
        document.querySelectorAll('.nav-content button').forEach(button => {
            button.addEventListener('click', function() {
                document.querySelectorAll('.nav-content button').forEach(btn => {
                    btn.classList.remove('active');
                });
                this.classList.add('active');
            });
        });
    },

    handleFilterClick(tab) {
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentFilter = tab.dataset.filter;
        const searchValue = document.getElementById('searchAccess')?.value || '';
        this.renderAccessList(this.currentFilter, searchValue);
    },

    async handleFormSubmit(e) {
        e.preventDefault();

        const artist = document.getElementById('artistName').value.trim();
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const rentmanProject = document.getElementById('rentmanProject').value || null;

        // Validate dates
        if (new Date(startDate) > new Date(endDate)) {
            this.showError('Start dato skal være før slut dato.');
            return;
        }

        // Generate code
        const code = this.generateCode(artist);

        const accessData = {
            artist_name: artist,
            access_code: code,
            start_date: startDate,
            end_date: endDate,
            rentman_project: rentmanProject
        };

        try {
            await this.createAccessCode(accessData);
            e.target.reset();
        } catch (error) {
            // Error already handled in createAccessCode
        }
    },

    // ============================================
    // Render Functions
    // ============================================
    updateCounts() {
        const active = this.accessCodes.filter(a => a.status === 'active').length;
        const expired = this.accessCodes.filter(a => a.status === 'expired').length;
        
        const activeEl = document.getElementById('activeCount');
        const expiredEl = document.getElementById('expiredCount');
        
        if (activeEl) activeEl.textContent = active;
        if (expiredEl) expiredEl.textContent = expired;
    },

    renderAccessList(filter = 'all', search = '') {
        const list = document.getElementById('accessList');
        if (!list) return;

        let filtered = this.accessCodes;

        // Apply filter
        if (filter === 'active') {
            filtered = filtered.filter(a => a.status === 'active');
        } else if (filter === 'expired') {
            filtered = filtered.filter(a => a.status === 'expired');
        }

        // Apply search
        if (search) {
            const searchLower = search.toLowerCase();
            filtered = filtered.filter(a =>
                a.artist_name.toLowerCase().includes(searchLower) ||
                a.access_code.toLowerCase().includes(searchLower)
            );
        }

        if (filtered.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🔍</div>
                    <h3>Ingen adgangskoder fundet</h3>
                    <p>Prøv at justere dine søgekriterier</p>
                </div>
            `;
            return;
        }

        list.innerHTML = filtered.map(access => this.renderAccessCard(access)).join('');
    },

    renderAccessCard(access) {
        const statusClass = access.status;
        const statusText = this.getStatusText(access.status);
        
        return `
            <div class="access-card ${statusClass}">
                <div class="access-main">
                    <div class="access-info">
                        <div class="access-artist">
                            <span class="artist-icon">🎤</span>
                            <h4>${this.escapeHtml(access.artist_name)}</h4>
                        </div>
                        <div class="access-code-display">
                            <code>${access.access_code}</code>
                            <button class="btn-copy" onclick="AccessManager.copyCode('${access.access_code}')">
                                📋
                            </button>
                        </div>
                    </div>
                    <div class="access-meta">
                        <div class="meta-item">
                            <span class="meta-label">Periode:</span>
                            <span class="meta-value">${this.formatDate(access.start_date)} - ${this.formatDate(access.end_date)}</span>
                        </div>
                        ${access.rentman_project ? `
                            <div class="meta-item">
                                <span class="meta-label">Projekt:</span>
                                <span class="meta-value">${this.escapeHtml(access.rentman_project)}</span>
                            </div>
                        ` : ''}
                        ${access.usage_count > 0 ? `
                            <div class="meta-item">
                                <span class="meta-label">Brug:</span>
                                <span class="meta-value">${access.usage_count} gange</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="access-actions">
                    <div class="status-badge ${statusClass}">
                        ${statusText}
                    </div>
                    <div class="action-buttons">
                        ${access.status === 'active' ? `
                            <button class="btn-action revoke" onclick="AccessManager.confirmRevoke(${access.id})" title="Tilbagekald">
                                🚫
                            </button>
                        ` : ''}
                        <button class="btn-action delete" onclick="AccessManager.confirmDelete(${access.id})" title="Slet">
                            🗑️
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    // ============================================
    // User Actions
    // ============================================
    async copyCode(code) {
        try {
            await navigator.clipboard.writeText(code);
            
            // Visual feedback
            const btns = document.querySelectorAll('.btn-copy');
            btns.forEach(btn => {
                if (btn.onclick.toString().includes(code)) {
                    const originalText = btn.textContent;
                    btn.textContent = '✓';
                    btn.style.background = 'var(--color-success)';
                    setTimeout(() => {
                        btn.textContent = originalText;
                        btn.style.background = '';
                    }, 1500);
                }
            });
        } catch (error) {
            console.error('Failed to copy:', error);
            this.showError('Kunne ikke kopiere koden.');
        }
    },

    confirmRevoke(id) {
        const access = this.accessCodes.find(a => a.id === id);
        if (!access) return;

        if (confirm(`Er du sikker på at du vil tilbagekalde adgangskoden for ${access.artist_name}?\n\nKode: ${access.access_code}\n\nDenne handling kan ikke fortrydes.`)) {
            this.revokeAccessCode(id);
        }
    },

    confirmDelete(id) {
        const access = this.accessCodes.find(a => a.id === id);
        if (!access) return;

        if (confirm(`Er du sikker på at du vil slette adgangskoden for ${access.artist_name}?\n\nKode: ${access.access_code}\n\nDenne handling kan ikke fortrydes.`)) {
            this.deleteAccessCode(id);
        }
    },

    // ============================================
    // Utility Functions
    // ============================================
    generateCode(artistName) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const prefix = this.getCodePrefix(artistName);
        
        // Generate two segments of 4 random characters
        const segment1 = Array.from({length: 4}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        const segment2 = Array.from({length: 4}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        
        return `${prefix}-${segment1}-${segment2}`;
    },

    getCodePrefix(artistName) {
        const words = artistName.trim().split(/\s+/);
        if (words.length === 1) {
            return words[0].substring(0, 3).toUpperCase();
        }
        // Take first letter of first two words
        return words.slice(0, 2).map(w => w[0]).join('').toUpperCase().padEnd(3, words[0][1] || 'X');
    },

    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    },

    getStatusText(status) {
        const statusMap = {
            'active': '● Aktiv',
            'expired': '● Udløbet',
            'revoked': '● Tilbagekaldt'
        };
        return statusMap[status] || status;
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    showSuccess(message) {
        alert(`✅ ${message}`);
    },

    showError(message) {
        alert(`❌ ${message}`);
    }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => AccessManager.init());
} else {
    AccessManager.init();
}