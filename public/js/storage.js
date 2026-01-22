// ============================================
// Storage Booking System
// ============================================

const StorageBooking = {
    // Unit configuration
    unitsLeft: ['V-A', 'V-B', 'V-C', 'V-D', 'V-E', 'V-F', 'V-G', 'V-H', 'V-I'],
    unitsRight: ['H-A', 'H-B', 'H-C', 'H-D', 'H-E', 'H-F', 'H-G', 'H-H', 'H-I'],

    // State
    selectedUnits: new Set(),
    bookings: [],
    bookedUnits: new Set(),

    // ============================================
    // Initialization
    // ============================================
    init() {
        this.setDefaultDates();
        this.loadBookings();
        this.renderUnits();
        this.attachEventListeners();
    },

    setDefaultDates() {
        const today = new Date();
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);

        document.getElementById('startDate').value = today.toISOString().split('T')[0];
        document.getElementById('endDate').value = nextWeek.toISOString().split('T')[0];
    },

    attachEventListeners() {
        document.getElementById('bookBtn').addEventListener('click', () => this.createBooking());
        document.getElementById('startDate').addEventListener('change', () => this.onDateChange());
        document.getElementById('endDate').addEventListener('change', () => this.onDateChange());
    },

    // ============================================
    // Data Loading
    // ============================================
    async loadBookings() {
        try {
            const res = await fetch('/api/storage/bookings');
            if (res.ok) {
                const data = await res.json();
                this.bookings = data.bookings || [];
                this.updateBookedUnits();
                this.renderUnits();
                this.renderUpcomingBookings();
                this.updateStats();
            }
        } catch (err) {
            console.error('Error loading bookings:', err);
        }
    },

    updateBookedUnits() {
        this.bookedUnits.clear();
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;

        if (!startDate || !endDate) return;

        const start = new Date(startDate);
        const end = new Date(endDate);

        this.bookings.forEach(booking => {
            const bookingStart = new Date(booking.start_date);
            const bookingEnd = new Date(booking.end_date);

            // Check if date ranges overlap
            if (start <= bookingEnd && end >= bookingStart) {
                booking.units.forEach(unit => this.bookedUnits.add(unit));
            }
        });
    },

    onDateChange() {
        this.updateBookedUnits();
        this.renderUnits();

        // Deselect any units that are now booked
        this.selectedUnits.forEach(unit => {
            if (this.bookedUnits.has(unit)) {
                this.selectedUnits.delete(unit);
            }
        });
        this.updateSidebar();
    },

    // ============================================
    // Rendering
    // ============================================
    renderUnits() {
        const leftContainer = document.getElementById('unitsLeft');
        const rightContainer = document.getElementById('unitsRight');

        leftContainer.innerHTML = this.unitsLeft.map(id => this.createUnitButton(id)).join('');
        rightContainer.innerHTML = this.unitsRight.map(id => this.createUnitButton(id)).join('');
    },

    createUnitButton(id) {
        const isSelected = this.selectedUnits.has(id);
        const isBooked = this.bookedUnits.has(id);

        let bgColor, borderColor, textColor, cursor;

        if (isBooked) {
            bgColor = 'bg-error/20';
            borderColor = 'border-error/50';
            textColor = 'text-error';
            cursor = 'cursor-pointer';
        } else if (isSelected) {
            bgColor = 'bg-primary/20';
            borderColor = 'border-primary';
            textColor = 'text-primary';
            cursor = 'cursor-pointer';
        } else {
            bgColor = 'bg-success/20';
            borderColor = 'border-success/50';
            textColor = 'text-success';
            cursor = 'cursor-pointer';
        }

        const onclick = isBooked ? `StorageBooking.showBookingInfo('${id}')` : `StorageBooking.toggleUnit('${id}')`;

        return `<button class="w-24 h-14 ${bgColor} ${borderColor} ${textColor} border-2 rounded-xl flex items-center justify-center font-bold text-sm ${cursor} transition-all hover:scale-105" onclick="${onclick}">${id}</button>`;
    },

    renderUpcomingBookings() {
        const container = document.getElementById('upcomingBookings');
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const upcoming = this.bookings
            .filter(b => new Date(b.end_date) >= today)
            .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
            .slice(0, 10);

        if (upcoming.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-text-secondary">
                    <i class="fa-solid fa-calendar-xmark text-3xl mb-3 opacity-50"></i>
                    <p>Ingen kommende bookinger</p>
                </div>
            `;
            return;
        }

        container.innerHTML = upcoming.map(booking => {
            const start = new Date(booking.start_date).toLocaleDateString('da-DK', { day: '2-digit', month: 'short' });
            const end = new Date(booking.end_date).toLocaleDateString('da-DK', { day: '2-digit', month: 'short' });
            const isActive = new Date(booking.start_date) <= today && new Date(booking.end_date) >= today;

            return `
                <div class="flex items-center justify-between p-4 bg-dark-hover rounded-xl border border-[#333] hover:border-primary/30 transition-all cursor-pointer"
                     onclick="StorageBooking.showBookingDetails(${booking.id})">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-lg ${isActive ? 'bg-success/20' : 'bg-primary/20'} flex items-center justify-center">
                            <i class="fa-solid fa-box ${isActive ? 'text-success' : 'text-primary'}"></i>
                        </div>
                        <div>
                            <p class="text-text-primary font-medium">${this.escapeHtml(booking.customer_name)}</p>
                            <p class="text-text-secondary text-xs">${booking.units.join(', ')}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="text-text-secondary text-sm">${start} - ${end}</p>
                        ${isActive ? '<span class="text-xs text-success font-medium">Aktiv</span>' : ''}
                    </div>
                </div>
            `;
        }).join('');
    },

    updateStats() {
        const total = this.unitsLeft.length + this.unitsRight.length;
        const booked = this.bookedUnits.size;
        const available = total - booked;

        document.getElementById('statTotal').textContent = total;
        document.getElementById('statAvailable').textContent = available;
        document.getElementById('statBooked').textContent = booked;
    },

    // ============================================
    // Selection
    // ============================================
    toggleUnit(id) {
        if (this.bookedUnits.has(id)) return;

        if (this.selectedUnits.has(id)) {
            this.selectedUnits.delete(id);
        } else {
            this.selectedUnits.add(id);
        }

        this.renderUnits();
        this.updateSidebar();
    },

    clearSelection() {
        this.selectedUnits.clear();
        this.renderUnits();
        this.updateSidebar();
    },

    updateSidebar() {
        const countEl = document.getElementById('selectedCount');
        const listEl = document.getElementById('selectedList');
        const bookBtn = document.getElementById('bookBtn');

        countEl.textContent = this.selectedUnits.size;

        if (this.selectedUnits.size > 0) {
            listEl.innerHTML = Array.from(this.selectedUnits).sort().map(id => `
                <div class="flex items-center justify-between p-3 bg-dark-hover rounded-lg border border-[#333]">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">${id}</div>
                        <span class="text-text-primary text-sm font-medium">Lokale ${id}</span>
                    </div>
                    <button onclick="StorageBooking.toggleUnit('${id}')" class="text-text-secondary hover:text-error transition-colors">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            `).join('');

            bookBtn.disabled = false;
            bookBtn.classList.remove('bg-[#333]', 'text-text-secondary', 'cursor-not-allowed');
            bookBtn.classList.add('bg-primary', 'text-white', 'cursor-pointer', 'hover:bg-primary-hover');
        } else {
            listEl.innerHTML = `
                <div class="text-center py-8 border border-dashed border-[#333] rounded-xl">
                    <i class="fa-solid fa-hand-pointer text-2xl text-text-secondary opacity-50 mb-2"></i>
                    <p class="text-text-secondary text-sm">Vælg lokaler fra oversigten</p>
                </div>
            `;

            bookBtn.disabled = true;
            bookBtn.classList.add('bg-[#333]', 'text-text-secondary', 'cursor-not-allowed');
            bookBtn.classList.remove('bg-primary', 'text-white', 'cursor-pointer', 'hover:bg-primary-hover');
        }
    },

    // ============================================
    // Booking Actions
    // ============================================
    async createBooking() {
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const customerName = document.getElementById('customerName').value.trim();

        if (!startDate || !endDate) {
            this.showToast('Vælg start og slut dato', 'error');
            return;
        }

        if (!customerName) {
            this.showToast('Indtast kundenavn', 'error');
            return;
        }

        if (this.selectedUnits.size === 0) {
            this.showToast('Vælg mindst ét lokale', 'error');
            return;
        }

        if (new Date(startDate) > new Date(endDate)) {
            this.showToast('Startdato skal være før slutdato', 'error');
            return;
        }

        try {
            const res = await fetch('/api/storage/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    startDate,
                    endDate,
                    customerName,
                    units: Array.from(this.selectedUnits)
                })
            });

            if (res.ok) {
                this.showToast('Booking oprettet!', 'success');
                this.clearSelection();
                document.getElementById('customerName').value = '';
                this.loadBookings();
            } else {
                const data = await res.json();
                this.showToast(data.error || 'Kunne ikke oprette booking', 'error');
            }
        } catch (err) {
            console.error('Error creating booking:', err);
            this.showToast('Fejl ved oprettelse af booking', 'error');
        }
    },

    showBookingInfo(unitId) {
        const booking = this.bookings.find(b => {
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;
            const start = new Date(startDate);
            const end = new Date(endDate);
            const bookingStart = new Date(b.start_date);
            const bookingEnd = new Date(b.end_date);

            return b.units.includes(unitId) && start <= bookingEnd && end >= bookingStart;
        });

        if (booking) {
            this.showBookingDetails(booking.id);
        }
    },

    showBookingDetails(bookingId) {
        const booking = this.bookings.find(b => b.id === bookingId);
        if (!booking) return;

        const start = new Date(booking.start_date).toLocaleDateString('da-DK', { day: '2-digit', month: 'long', year: 'numeric' });
        const end = new Date(booking.end_date).toLocaleDateString('da-DK', { day: '2-digit', month: 'long', year: 'numeric' });

        const content = document.getElementById('bookingModalContent');
        content.innerHTML = `
            <div class="space-y-4">
                <div class="p-4 bg-dark-hover rounded-xl">
                    <p class="text-xs text-text-secondary uppercase tracking-wider mb-1">Kunde</p>
                    <p class="text-lg font-semibold text-text-primary">${this.escapeHtml(booking.customer_name)}</p>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div class="p-4 bg-dark-hover rounded-xl">
                        <p class="text-xs text-text-secondary uppercase tracking-wider mb-1">Fra</p>
                        <p class="text-text-primary font-medium">${start}</p>
                    </div>
                    <div class="p-4 bg-dark-hover rounded-xl">
                        <p class="text-xs text-text-secondary uppercase tracking-wider mb-1">Til</p>
                        <p class="text-text-primary font-medium">${end}</p>
                    </div>
                </div>
                <div class="p-4 bg-dark-hover rounded-xl">
                    <p class="text-xs text-text-secondary uppercase tracking-wider mb-2">Lokaler</p>
                    <div class="flex flex-wrap gap-2">
                        ${booking.units.map(u => `<span class="px-3 py-1 bg-primary/20 text-primary rounded-lg text-sm font-medium">${u}</span>`).join('')}
                    </div>
                </div>
                <div class="flex gap-3 pt-4">
                    <button onclick="StorageBooking.closeModal()" class="flex-1 py-3 bg-dark-hover border border-[#333] rounded-xl text-text-secondary font-medium hover:bg-[#252f3a] transition-all">
                        Luk
                    </button>
                    <button onclick="StorageBooking.deleteBooking(${booking.id})" class="flex-1 py-3 bg-error/20 border border-error/30 rounded-xl text-error font-medium hover:bg-error hover:text-white transition-all">
                        <i class="fa-solid fa-trash mr-2"></i>Slet booking
                    </button>
                </div>
            </div>
        `;

        document.getElementById('bookingModal').classList.remove('hidden');
        document.getElementById('bookingModal').classList.add('flex');
    },

    closeModal() {
        document.getElementById('bookingModal').classList.add('hidden');
        document.getElementById('bookingModal').classList.remove('flex');
    },

    async deleteBooking(bookingId) {
        if (!confirm('Er du sikker på at du vil slette denne booking?')) return;

        try {
            const res = await fetch(`/api/storage/bookings/${bookingId}`, { method: 'DELETE' });
            if (res.ok) {
                this.showToast('Booking slettet', 'success');
                this.closeModal();
                this.loadBookings();
            } else {
                this.showToast('Kunne ikke slette booking', 'error');
            }
        } catch (err) {
            console.error('Error deleting booking:', err);
            this.showToast('Fejl ved sletning', 'error');
        }
    },

    // ============================================
    // Utilities
    // ============================================
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    },

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = 'fixed bottom-6 right-6 px-5 py-3 rounded-lg text-white font-medium shadow-lg transition-all duration-300 z-[10001]';

        switch(type) {
            case 'success': toast.classList.add('bg-success'); break;
            case 'error': toast.classList.add('bg-error'); break;
            default: toast.classList.add('bg-primary');
        }

        toast.classList.remove('translate-y-20', 'opacity-0');
        toast.classList.add('translate-y-0', 'opacity-100');

        setTimeout(() => {
            toast.classList.remove('translate-y-0', 'opacity-100');
            toast.classList.add('translate-y-20', 'opacity-0');
        }, 3000);
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => StorageBooking.init());
