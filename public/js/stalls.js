// ============================================
// Stalls Management JavaScript
// ============================================
// Handles stall (båse) CRUD operations with database integration

const StallsManager = {
    stalls: [],
    selectedStallId: null,
    apiEndpoint: '/api/stalls',

    // Security: HTML Escaping
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // Validate and sanitize color values
    sanitizeColor(color) {
        if (!color) return '#9DABB9';
        // Only allow valid hex colors
        const hexPattern = /^#[0-9A-Fa-f]{6}$/;
        return hexPattern.test(color) ? color : '#9DABB9';
    },

    // ============================================
    // Initialize
    // ============================================
    init() {
        this.loadStalls();
        this.attachEventListeners();
    },

    // ============================================
    // API Calls
    // ============================================
    async loadStalls() {
        try {
            const response = await fetch(this.apiEndpoint);
            if (!response.ok) throw new Error('Failed to load stalls');
            
            const data = await response.json();
            this.stalls = data.stalls || [];
            this.renderStallList();
        } catch (error) {
            console.error('Error loading stalls:', error);
            this.showError('Kunne ikke indlæse båse. Prøv igen.');
        }
    },

    async saveStall(stallData) {
        try {
            const method = stallData.id ? 'PUT' : 'POST';
            const url = stallData.id 
                ? `${this.apiEndpoint}/${stallData.id}` 
                : this.apiEndpoint;

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(stallData)
            });

            if (!response.ok) throw new Error('Failed to save stall');

            const result = await response.json();
            this.showSuccess('Ændringer gemt!');
            await this.loadStalls();
            
            if (this.selectedStallId) {
                this.selectStall(this.selectedStallId);
            }

            return result;
        } catch (error) {
            console.error('Error saving stall:', error);
            this.showError('Kunne ikke gemme ændringer. Prøv igen.');
            throw error;
        }
    },

    async deleteStall(stallId) {
        try {
            const response = await fetch(`${this.apiEndpoint}/${stallId}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Failed to delete stall');

            this.showSuccess('Bås slettet!');
            await this.loadStalls();
            this.selectedStallId = null;
            this.renderEditor(null);
        } catch (error) {
            console.error('Error deleting stall:', error);
            this.showError('Kunne ikke slette bås. Prøv igen.');
        }
    },

    // ============================================
    // Event Listeners
    // ============================================
    attachEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('searchStalls');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.renderStallList(e.target.value);
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

    // ============================================
    // Render Functions
    // ============================================
    renderStallList(filter = '') {
        const stallList = document.getElementById('stallList');
        if (!stallList) return;

        stallList.innerHTML = '';

        const filtered = this.stalls.filter(stall => {
            const searchTerm = filter.toLowerCase();
            const stallName = stall.name || '';
            return stallName.toLowerCase().includes(searchTerm) || 
                   `bås ${stall.stall_number}`.includes(searchTerm);
        });

        filtered.forEach(stall => {
            const isActive = this.selectedStallId === stall.id;
            const statusText = stall.status === 'occupied' ? 'Optaget' : 'Ledig';
            const statusColor = stall.status === 'occupied' ? this.sanitizeColor(stall.color) : '#9DABB9';

            const stallItem = document.createElement('button');
            stallItem.className = `stall-item ${isActive ? 'active' : ''}`;
            stallItem.innerHTML = `
                <div class="stall-icon">📦</div>
                <div class="stall-info">
                    <span class="stall-name">Bås ${String(stall.stall_number).padStart(2, '0')}</span>
                    <span class="stall-status">${this.escapeHtml(statusText)}</span>
                </div>
                <div class="stall-indicator" style="background-color: ${statusColor}"></div>
            `;
            stallItem.onclick = () => this.selectStall(stall.id);
            stallList.appendChild(stallItem);
        });
    },

    selectStall(id) {
        this.selectedStallId = id;
        this.renderStallList();
        this.renderEditor(id);
    },

    renderEditor(id) {
        const editor = document.getElementById('stallEditor');
        if (!editor) return;

        if (!id) {
            editor.innerHTML = `
                <div class="editor-placeholder">
                    <div class="placeholder-icon">📦</div>
                    <h3>Vælg en bås</h3>
                    <p>Vælg en bås fra listen til venstre for at redigere information.</p>
                </div>
            `;
            return;
        }

        const stall = this.stalls.find(s => s.id === id);
        if (!stall) return;

        const statusBadge = stall.status === 'occupied' 
            ? '<div class="status-badge occupied">● Optaget</div>'
            : '<div class="status-badge available">● Ledig</div>';

        const startDate = stall.start_date || '';
        const endDate = stall.end_date || '';

        editor.innerHTML = `
            <div class="editor-content">
                <div class="editor-header">
                    <div class="breadcrumb">
                        <span>Sluse</span>
                        <span>/</span>
                        <span class="active-crumb">Bås ${String(stall.stall_number).padStart(2, '0')}</span>
                    </div>
                    <div class="editor-title-row">
                        <div>
                            <h2>Rediger Bås ${String(stall.stall_number).padStart(2, '0')}</h2>
                            <p>Opdater information og farvekode for denne bås.</p>
                        </div>
                        ${statusBadge}
                    </div>
                </div>

                <div class="editor-card">
                    <div class="color-stripe" style="background-color: ${this.sanitizeColor(stall.color)}"></div>
                    <div class="editor-form">
                        <div class="form-section">
                            <div class="form-row">
                                <div class="form-field">
                                    <label for="stallName">
                                        <span class="label-icon">🏷️</span>
                                        Navn
                                    </label>
                                    <input type="text" id="stallName" value="${this.escapeHtml(stall.name || '')}" placeholder="Indtast navn på bås">
                                </div>
                                <div class="form-field">
                                    <label for="stallQuantity">
                                        <span class="label-icon">📦</span>
                                        Koli antal
                                    </label>
                                    <input type="number" id="stallQuantity" value="${stall.quantity || 0}" placeholder="0">
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-field">
                                    <label for="stallStartDate">
                                        <span class="label-icon">📅</span>
                                        Start Dato
                                    </label>
                                    <input type="date" id="stallStartDate" value="${startDate}">
                                </div>
                                <div class="form-field">
                                    <label for="stallEndDate">
                                        <span class="label-icon">📅</span>
                                        Slut Dato
                                    </label>
                                    <input type="date" id="stallEndDate" value="${endDate}">
                                </div>
                            </div>
                        </div>

                        <div class="divider"></div>

                        <div class="form-section">
                            <div class="color-section-header">
                                <label>
                                    <span class="label-icon">🎨</span>
                                    Farvekode
                                </label>
                                <p class="field-description">Vælg en farve til at identificere denne bås på kortet.</p>
                            </div>
                            <div class="color-picker">
                                <div class="color-options">
                                    ${this.renderColorOptions(this.sanitizeColor(stall.color))}
                                </div>
                                <div class="color-divider"></div>
                                <div class="hex-input">
                                    <span class="hex-label">Hex</span>
                                    <div class="hex-field">
                                        <span class="hex-hash">#</span>
                                        <input type="text" id="hexInput" value="${this.sanitizeColor(stall.color).replace('#', '')}" maxlength="6">
                                    </div>
                                    <div class="hex-preview" id="hexPreview" style="background-color: ${this.sanitizeColor(stall.color)}"></div>
                                </div>
                            </div>
                        </div>

                        <div class="form-actions">
                            <button class="btn-secondary" onclick="StallsManager.cancelEdit()">Annuller</button>
                            <button class="btn-primary" onclick="StallsManager.saveCurrentStall()">
                                <span>💾</span>
                                Gem ændringer
                            </button>
                        </div>
                    </div>
                </div>

                <div class="info-tip">
                    <span class="tip-icon">💡</span>
                    <div class="tip-content">
                        <h4>Automatisk Synkronisering</h4>
                        <p>Ændringer til båsfarver vil automatisk blive reflekteret på hovedoversigten inden for 5 minutter.</p>
                    </div>
                </div>
            </div>
        `;

        // Attach hex input listener
        this.attachHexInputListener();
    },

    renderColorOptions(currentColor) {
        const colors = ['#137fec', '#22c55e', '#ec1363', '#f59e0b', '#8b5cf6', '#06b6d4'];
        return colors.map(color => `
            <label class="color-option">
                <input type="radio" name="color" value="${color}" ${currentColor === color ? 'checked' : ''}>
                <div class="color-circle" style="background-color: ${color}">
                    <span class="check">✓</span>
                </div>
            </label>
        `).join('');
    },

    attachHexInputListener() {
        const hexInput = document.getElementById('hexInput');
        const hexPreview = document.getElementById('hexPreview');
        
        if (hexInput && hexPreview) {
            hexInput.addEventListener('input', (e) => {
                let value = e.target.value.replace(/[^0-9A-Fa-f]/g, '');
                if (value.length <= 6) {
                    e.target.value = value;
                    if (value.length === 6) {
                        hexPreview.style.backgroundColor = `#${value}`;
                    }
                }
            });
        }
    },

    // ============================================
    // Save/Cancel Functions
    // ============================================
    async saveCurrentStall() {
        const name = document.getElementById('stallName').value.trim();
        const quantity = parseInt(document.getElementById('stallQuantity').value) || 0;
        const startDate = document.getElementById('stallStartDate').value || null;
        const endDate = document.getElementById('stallEndDate').value || null;
        
        let color;
        const selectedColor = document.querySelector('input[name="color"]:checked');
        if (selectedColor) {
            color = selectedColor.value;
        } else {
            const hexValue = document.getElementById('hexInput').value;
            color = `#${hexValue}`;
        }

        // Validate color format
        if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
            this.showError('Ugyldig farveformat. Brug hex format: #RRGGBB');
            return;
        }

        // Validate dates
        if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
            this.showError('Start dato skal være før slut dato.');
            return;
        }

        const stall = this.stalls.find(s => s.id === this.selectedStallId);
        
        const stallData = {
            id: stall.id,
            stall_number: stall.stall_number,
            name: name || null,
            quantity: quantity,
            start_date: startDate,
            end_date: endDate,
            color: color,
            status: name ? 'occupied' : 'available'
        };

        try {
            await this.saveStall(stallData);
        } catch (error) {
            // Error already handled in saveStall
        }
    },

    cancelEdit() {
        if (confirm('Er du sikker på at du vil annullere ændringerne?')) {
            this.renderEditor(this.selectedStallId);
        }
    },

    // ============================================
    // Utility Functions
    // ============================================
    showSuccess(message) {
        // Simple alert for now - can be replaced with toast notification
        alert(`✅ ${message}`);
    },

    showError(message) {
        // Simple alert for now - can be replaced with toast notification
        alert(`❌ ${message}`);
    }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => StallsManager.init());
} else {
    StallsManager.init();
}