// ============================================
// Storage Booking System
// ============================================

const StorageBooking = {
    // Unit configuration
    unitsLeft: ['V-A', 'V-B', 'V-C', 'V-D', 'V-E', 'V-F', 'V-G', 'V-H', 'V-I'],
    unitsRight: ['H-A', 'H-B', 'H-C', 'H-D', 'H-E', 'H-F', 'H-G', 'H-H', 'H-I'],

    // State
    selectedUnit: null,
    rentals: [],
    unitStatus: new Map(), // Map of unit -> { status: 'free'|'partial'|'booked', rentals: [], coverage: number }

    // ============================================
    // Initialization
    // ============================================
    init() {
        this.setDefaultDates();
        this.attachEventListeners();
        this.loadRentals();
    },

    setDefaultDates() {
        const today = new Date();
        document.getElementById('startDate').value = today.toISOString().split('T')[0];
        document.getElementById('endDate').value = today.toISOString().split('T')[0];
    },

    attachEventListeners() {
        document.getElementById('startDate').addEventListener('change', () => this.onDateChange());
        document.getElementById('endDate').addEventListener('change', () => this.onDateChange());
    },

    onDateChange() {
        this.updateUnitStatus();
        this.renderUnits();
        this.updateStats();

        if (this.selectedUnit) {
            this.updateSidebar();
        }
    },

    resetPeriod() {
        this.setDefaultDates();
        this.onDateChange();
    },

    // ============================================
    // Data Loading
    // ============================================
    async loadRentals() {
        try {
            const res = await fetch('/api/storage/rentals');
            if (res.ok) {
                const data = await res.json();
                this.rentals = data.rentals || [];
                this.updateUnitStatus();
                this.renderUnits();
                this.renderUpcomingBookings();
                this.updateStats();
            }
        } catch (err) {
            console.error('Error loading rentals:', err);
        }
    },

    // Calculate the status of each unit for the selected period
    updateUnitStatus() {
        this.unitStatus.clear();

        const startDateEl = document.getElementById('startDate');
        const endDateEl = document.getElementById('endDate');

        if (!startDateEl.value || !endDateEl.value) return;

        const filterStart = this.parseLocalDate(startDateEl.value);
        const filterEnd = this.parseLocalDate(endDateEl.value);

        const totalDays = this.getDaysBetween(filterStart, filterEnd);

        // Use string comparison for dates (YYYY-MM-DD format) - timezone safe
        const filterStartStr = this.formatDateKey(filterStart);
        const filterEndStr = this.formatDateKey(filterEnd);

        // Group rentals by bay_id
        const rentalsByBay = new Map();
        this.rentals.forEach(rental => {
            if (!rental.bay_id) return;

            // Get date strings for comparison (handles both Date objects and strings)
            const rentalStartStr = rental.start_date ? this.getDateString(rental.start_date) : null;
            const rentalEndStr = rental.end_date ? this.getDateString(rental.end_date) : null;

            // Check if rental overlaps with selected period using string comparison
            const overlaps = (!rentalStartStr || rentalStartStr <= filterEndStr) &&
                           (!rentalEndStr || rentalEndStr >= filterStartStr);

            if (overlaps) {
                if (!rentalsByBay.has(rental.bay_id)) {
                    rentalsByBay.set(rental.bay_id, []);
                }
                rentalsByBay.get(rental.bay_id).push(rental);
            }
        });

        // Calculate coverage for each bay
        const allUnits = [...this.unitsLeft, ...this.unitsRight];
        allUnits.forEach(unitId => {
            const unitRentals = rentalsByBay.get(unitId) || [];

            if (unitRentals.length === 0) {
                this.unitStatus.set(unitId, {
                    status: 'free',
                    rentals: [],
                    coverage: 0,
                    bookedDays: 0,
                    totalDays: totalDays
                });
            } else {
                // Calculate how many days are booked
                const bookedDays = this.calculateBookedDays(unitRentals, filterStart, filterEnd);
                const coverage = totalDays > 0 ? (bookedDays / totalDays) * 100 : 100;

                let status;
                if (coverage >= 100) {
                    status = 'booked';
                } else if (coverage > 0) {
                    status = 'partial';
                } else {
                    status = 'free';
                }

                this.unitStatus.set(unitId, {
                    status,
                    rentals: unitRentals,
                    coverage: Math.round(coverage),
                    bookedDays,
                    totalDays
                });
            }
        });
    },

    // Format date as YYYY-MM-DD string (local time, no UTC conversion)
    formatDateKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    // Get date string (YYYY-MM-DD) from any date format - timezone safe
    getDateString(dateInput) {
        if (!dateInput) return null;

        // If it's already a string, extract YYYY-MM-DD part
        if (typeof dateInput === 'string') {
            const match = dateInput.match(/^(\d{4}-\d{2}-\d{2})/);
            if (match) return match[1];
            // Try to parse and format
            const d = new Date(dateInput);
            if (!isNaN(d.getTime())) {
                return this.formatDateKey(d);
            }
            return null;
        }

        // If it's a Date object
        if (dateInput instanceof Date) {
            return this.formatDateKey(dateInput);
        }

        return null;
    },

    // Parse date string as local date (not UTC)
    // Handles "YYYY-MM-DD" and "YYYY-MM-DDTHH:MM:SS" formats
    parseLocalDate(dateStr) {
        if (!dateStr) return null;
        // If it's already a Date object, just normalize it
        if (dateStr instanceof Date) {
            return new Date(dateStr.getFullYear(), dateStr.getMonth(), dateStr.getDate());
        }
        // Parse string - extract year, month, day to avoid UTC interpretation
        const str = String(dateStr);
        const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
            return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
        }
        // Fallback to normal parsing
        const d = new Date(dateStr);
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    },

    // Normalize date to midnight local time
    normalizeDate(date) {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    },

    getDaysBetween(start, end) {
        const startNorm = this.normalizeDate(start);
        const endNorm = this.normalizeDate(end);

        // Count days by iterating (DST safe)
        let count = 0;
        let current = new Date(startNorm);
        while (current <= endNorm) {
            count++;
            current = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1);
        }
        return count;
    },

    calculateBookedDays(rentals, periodStart, periodEnd) {
        const bookedDates = new Set();

        const periodStartStr = this.formatDateKey(periodStart);
        const periodEndStr = this.formatDateKey(periodEnd);

        // Generate all days in period as strings
        const allDaysInPeriod = [];
        let y = periodStart.getFullYear(), m = periodStart.getMonth(), d = periodStart.getDate();
        let currentStr = periodStartStr;
        while (currentStr <= periodEndStr) {
            allDaysInPeriod.push(currentStr);
            d++;
            const nextDate = new Date(y, m, d);
            y = nextDate.getFullYear();
            m = nextDate.getMonth();
            d = nextDate.getDate();
            currentStr = this.formatDateKey(nextDate);
        }

        rentals.forEach(rental => {
            // Get rental date strings
            let rentalStartStr = rental.start_date ? this.getDateString(rental.start_date) : periodStartStr;
            let rentalEndStr = rental.end_date ? this.getDateString(rental.end_date) : periodEndStr;

            // Clamp to period bounds (string comparison works for YYYY-MM-DD)
            if (rentalStartStr < periodStartStr) rentalStartStr = periodStartStr;
            if (rentalEndStr > periodEndStr) rentalEndStr = periodEndStr;

            // Add each day in the rental period to the set
            allDaysInPeriod.forEach(dayStr => {
                if (dayStr >= rentalStartStr && dayStr <= rentalEndStr) {
                    bookedDates.add(dayStr);
                }
            });
        });

        return bookedDates.size;
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
        const isSelected = this.selectedUnit === id;
        const unitInfo = this.unitStatus.get(id) || { status: 'free', coverage: 0 };
        const status = unitInfo.status;

        let bgColor, borderColor, textColor, extraHtml = '';

        if (status === 'booked') {
            bgColor = 'bg-error/20';
            borderColor = 'border-error/50';
            textColor = 'text-error';
        } else if (status === 'partial') {
            bgColor = 'bg-warning/20';
            borderColor = 'border-warning/50';
            textColor = 'text-warning';
            // Add coverage indicator
            extraHtml = `<div class="absolute bottom-0.5 md:bottom-1 left-0.5 md:left-1 right-0.5 md:right-1 h-0.5 md:h-1 bg-dark-bg rounded-full overflow-hidden">
                <div class="h-full bg-warning rounded-full" style="width: ${unitInfo.coverage}%"></div>
            </div>`;
        } else if (isSelected) {
            bgColor = 'bg-primary/20';
            borderColor = 'border-primary';
            textColor = 'text-primary';
        } else {
            bgColor = 'bg-success/20';
            borderColor = 'border-success/50';
            textColor = 'text-success';
        }

        const onclick = `StorageBooking.selectUnit('${id}')`;

        // Responsive button sizes: smaller on mobile
        return `<button class="relative w-full h-10 md:h-14 ${bgColor} ${borderColor} ${textColor} border-2 rounded-lg md:rounded-xl flex items-center justify-center font-bold text-xs md:text-sm cursor-pointer transition-all hover:scale-105 active:scale-95" onclick="${onclick}">
            ${id}
            ${extraHtml}
        </button>`;
    },

    renderUpcomingBookings() {
        const container = document.getElementById('upcomingBookings');
        const today = this.normalizeDate(new Date());

        const upcoming = this.rentals
            .filter(r => r.bay_id && r.end_date && this.parseLocalDate(r.end_date) >= today)
            .sort((a, b) => this.parseLocalDate(a.end_date) - this.parseLocalDate(b.end_date))
            .slice(0, 10);

        if (upcoming.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-text-secondary">
                    <i class="fa-solid fa-calendar-xmark text-3xl mb-3 opacity-50"></i>
                    <p>Ingen aktive udlejninger</p>
                </div>
            `;
            return;
        }

        container.innerHTML = upcoming.map(rental => {
            const startDate = rental.start_date ? this.parseLocalDate(rental.start_date) : null;
            const endDate = rental.end_date ? this.parseLocalDate(rental.end_date) : null;
            const start = startDate ? startDate.toLocaleDateString('da-DK', { day: '2-digit', month: 'short' }) : '-';
            const end = endDate ? endDate.toLocaleDateString('da-DK', { day: '2-digit', month: 'short' }) : '-';
            const isActive = (!startDate || startDate <= today) && (!endDate || endDate >= today);

            return `
                <div class="flex items-center justify-between p-4 bg-dark-hover rounded-xl border border-[#333] hover:border-primary/30 transition-all cursor-pointer"
                     onclick="StorageBooking.selectUnit('${rental.bay_id}')">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-lg ${isActive ? 'bg-error/20' : 'bg-primary/20'} flex items-center justify-center">
                            <i class="fa-solid fa-box ${isActive ? 'text-error' : 'text-primary'}"></i>
                        </div>
                        <div>
                            <p class="text-text-primary font-medium">${this.escapeHtml(rental.project_name || 'Ukendt projekt')}</p>
                            <p class="text-text-secondary text-xs">${rental.bay_id} - ${this.escapeHtml(rental.subproject_name || '')}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="text-text-secondary text-sm">${start} - ${end}</p>
                        ${isActive ? '<span class="text-xs text-error font-medium">Aktiv</span>' : ''}
                    </div>
                </div>
            `;
        }).join('');
    },

    updateStats() {
        const total = this.unitsLeft.length + this.unitsRight.length;
        let booked = 0;
        let partial = 0;

        this.unitStatus.forEach(info => {
            if (info.status === 'booked') booked++;
            else if (info.status === 'partial') partial++;
        });

        const available = total - booked - partial;

        document.getElementById('statTotal').textContent = total;
        document.getElementById('statAvailable').textContent = available;
        document.getElementById('statBooked').textContent = booked;

        // Update partial stat if it exists
        const partialEl = document.getElementById('statPartial');
        if (partialEl) {
            partialEl.textContent = partial;
        }
    },

    // ============================================
    // Selection
    // ============================================
    selectUnit(id) {
        this.selectedUnit = id;
        this.renderUnits();
        this.updateSidebar();

        // On mobile, open the bottom sheet
        if (window.innerWidth < 1024) {
            this.openMobileSheet();
        }
    },

    clearSelection() {
        this.selectedUnit = null;
        this.renderUnits();
        this.updateSidebar();
        this.closeMobileSheet();
    },

    // Mobile bottom sheet handling
    openMobileSheet() {
        const sheet = document.getElementById('mobileDetailSheet');
        const overlay = document.getElementById('mobileSheetOverlay');
        if (sheet) {
            sheet.classList.remove('translate-y-full');
            sheet.classList.add('translate-y-0');
        }
        if (overlay) {
            overlay.classList.remove('hidden');
        }
        document.body.style.overflow = 'hidden';
    },

    closeMobileSheet() {
        const sheet = document.getElementById('mobileDetailSheet');
        const overlay = document.getElementById('mobileSheetOverlay');
        if (sheet) {
            sheet.classList.add('translate-y-full');
            sheet.classList.remove('translate-y-0');
        }
        if (overlay) {
            overlay.classList.add('hidden');
        }
        document.body.style.overflow = '';
    },

    updateSidebar() {
        // Update both desktop and mobile sidebars
        const desktopListEl = document.getElementById('selectedList');
        const mobileListEl = document.getElementById('mobileSelectedList');

        const emptyHtml = `
            <div class="text-center py-8 border border-dashed border-[#333] rounded-xl">
                <i class="fa-solid fa-hand-pointer text-2xl text-text-secondary opacity-50 mb-2"></i>
                <p class="text-text-secondary text-sm">Vælg en bås for at se detaljer</p>
            </div>
        `;

        if (!this.selectedUnit) {
            if (desktopListEl) desktopListEl.innerHTML = emptyHtml;
            if (mobileListEl) mobileListEl.innerHTML = emptyHtml;
            return;
        }

        const unitInfo = this.unitStatus.get(this.selectedUnit) || { status: 'free', rentals: [], coverage: 0 };
        const { status, rentals, coverage, bookedDays, totalDays } = unitInfo;

        let statusBg, statusBorder, statusText, statusLabel, statusIcon;

        if (status === 'booked') {
            statusBg = 'bg-error/10';
            statusBorder = 'border-error/30';
            statusText = 'text-error';
            statusLabel = 'Optaget';
            statusIcon = 'fa-times-circle';
        } else if (status === 'partial') {
            statusBg = 'bg-warning/10';
            statusBorder = 'border-warning/30';
            statusText = 'text-warning';
            statusLabel = 'Delvist optaget';
            statusIcon = 'fa-exclamation-circle';
        } else {
            statusBg = 'bg-success/10';
            statusBorder = 'border-success/30';
            statusText = 'text-success';
            statusLabel = 'Ledig';
            statusIcon = 'fa-check-circle';
        }

        let html = `
            <div class="space-y-4">
                <div class="flex items-center justify-between p-3 ${statusBg} rounded-lg border ${statusBorder}">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg ${statusBg} flex items-center justify-center ${statusText} font-bold text-xs">${this.selectedUnit}</div>
                        <span class="${statusText} text-sm font-medium">${statusLabel}</span>
                    </div>
                    <i class="fa-solid ${statusIcon} ${statusText}"></i>
                </div>
        `;

        // Show coverage summary for partial
        if (status === 'partial' || status === 'booked') {
            const freeDays = totalDays - bookedDays;
            html += `
                <div class="p-4 bg-dark-hover rounded-xl">
                    <p class="text-xs text-text-secondary uppercase tracking-wider mb-3">Periode overblik</p>
                    <div class="flex items-center gap-3 mb-3">
                        <div class="flex-1 h-3 bg-dark-bg rounded-full overflow-hidden">
                            <div class="h-full bg-error rounded-full transition-all" style="width: ${coverage}%"></div>
                        </div>
                        <span class="text-xs text-text-secondary font-medium">${coverage}%</span>
                    </div>
                    <div class="flex justify-between text-xs">
                        <span class="text-error"><i class="fa-solid fa-square mr-1"></i>${bookedDays} dage optaget</span>
                        <span class="text-success"><i class="fa-solid fa-square mr-1"></i>${freeDays} dage ledig</span>
                    </div>
                </div>
            `;

            // Show timeline
            html += this.renderTimeline(rentals);

            // Show rental details
            rentals.forEach((rental, idx) => {
                const startDate = rental.start_date ? this.parseLocalDate(rental.start_date) : null;
                const endDate = rental.end_date ? this.parseLocalDate(rental.end_date) : null;
                const start = startDate ? startDate.toLocaleDateString('da-DK', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
                const end = endDate ? endDate.toLocaleDateString('da-DK', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

                html += `
                    <div class="p-4 bg-dark-hover rounded-xl border-l-4 border-error">
                        <div class="flex items-center justify-between mb-2">
                            <p class="text-xs text-text-secondary uppercase tracking-wider">Udlejning ${rentals.length > 1 ? idx + 1 : ''}</p>
                        </div>
                        <p class="text-text-primary font-medium mb-1">${this.escapeHtml(rental.project_name || 'Ukendt')}</p>
                        <p class="text-text-secondary text-sm mb-2">${this.escapeHtml(rental.subproject_name || '')}</p>
                        <div class="flex items-center gap-2 text-xs text-text-secondary">
                            <i class="fa-solid fa-calendar"></i>
                            <span>${start} - ${end}</span>
                        </div>
                    </div>
                `;
            });
        } else {
            // Free
            html += `
                <div class="text-center py-6">
                    <i class="fa-solid fa-check-circle text-4xl text-success mb-3"></i>
                    <p class="text-text-secondary">Denne bås er ledig</p>
                    <p class="text-text-secondary text-xs mt-1">i hele den valgte periode</p>
                </div>
            `;
        }

        html += '</div>';

        // Update both desktop and mobile sidebars
        if (desktopListEl) desktopListEl.innerHTML = html;
        if (mobileListEl) mobileListEl.innerHTML = html;
    },

    renderTimeline(rentals) {
        const startDateEl = document.getElementById('startDate');
        const endDateEl = document.getElementById('endDate');

        const periodStart = this.parseLocalDate(startDateEl.value);
        const periodEnd = this.parseLocalDate(endDateEl.value);

        // For timeline calculation, use end of day for periodEnd
        const periodEndForCalc = new Date(periodEnd);
        periodEndForCalc.setHours(23, 59, 59, 999);

        const totalMs = periodEndForCalc - periodStart;
        if (totalMs <= 0) return '';

        // Create timeline segments
        let segments = [];

        rentals.forEach(rental => {
            let rentalStart = rental.start_date ? this.parseLocalDate(rental.start_date) : new Date(periodStart);
            let rentalEnd = rental.end_date ? this.parseLocalDate(rental.end_date) : new Date(periodEnd);

            // Set end to end of day for visual representation
            rentalEnd = new Date(rentalEnd);
            rentalEnd.setHours(23, 59, 59, 999);

            // Clamp to period
            if (rentalStart < periodStart) rentalStart = new Date(periodStart);
            if (rentalEnd > periodEndForCalc) rentalEnd = new Date(periodEndForCalc);

            const startPercent = ((rentalStart - periodStart) / totalMs) * 100;
            const widthPercent = ((rentalEnd - rentalStart) / totalMs) * 100;

            segments.push({
                start: Math.max(0, startPercent),
                width: Math.min(100 - startPercent, widthPercent),
                rental
            });
        });

        const startLabel = periodStart.toLocaleDateString('da-DK', { day: '2-digit', month: 'short' });
        const endLabel = periodEnd.toLocaleDateString('da-DK', { day: '2-digit', month: 'short' });

        return `
            <div class="p-4 bg-dark-hover rounded-xl">
                <p class="text-xs text-text-secondary uppercase tracking-wider mb-3">Tidslinje</p>
                <div class="relative h-8 bg-success/20 rounded-lg overflow-hidden border border-success/30">
                    ${segments.map(seg => `
                        <div class="absolute top-0 bottom-0 bg-error/80 border-x border-error"
                             style="left: ${seg.start}%; width: ${seg.width}%;"
                             title="${this.escapeHtml(seg.rental.project_name || '')}"></div>
                    `).join('')}
                </div>
                <div class="flex justify-between mt-2 text-xs text-text-secondary">
                    <span>${startLabel}</span>
                    <span>${endLabel}</span>
                </div>
                <div class="flex items-center gap-4 mt-3 text-xs">
                    <div class="flex items-center gap-1">
                        <div class="w-3 h-3 rounded bg-success/20 border border-success/30"></div>
                        <span class="text-text-secondary">Ledig</span>
                    </div>
                    <div class="flex items-center gap-1">
                        <div class="w-3 h-3 rounded bg-error/80 border border-error"></div>
                        <span class="text-text-secondary">Optaget</span>
                    </div>
                </div>
            </div>
        `;
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
