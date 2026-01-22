/* =======================
   CLOCK
======================= */
function updateClock() {
    const now = new Date();
    const timeEl = document.getElementById('current-time');
    const dateEl = document.getElementById('current-date');

    if (timeEl) {
        const hours = now.getHours().toString().padStart(2,'0');
        const minutes = now.getMinutes().toString().padStart(2,'0');
        timeEl.textContent = `${hours}:${minutes}`;
    }

    if (dateEl) {
        const danishMonths = ['jan','feb','mar','apr','maj','jun','jul','aug','sep','okt','nov','dec'];
        const danishDays = ['son','man','tir','ons','tor','fre','lor'];
        const day = danishDays[now.getDay()];
        const date = now.getDate();
        const month = danishMonths[now.getMonth()];
        const year = now.getFullYear();
        dateEl.textContent = `${day} ${date}. ${month} ${year}`;
    }
}

/* =======================
   DOM ELEMENTS
======================= */
const els = {
    confirmed: document.querySelector('.project-list-confirmed'),
    prepped: document.querySelector('.project-list-prepped'),
    onlocation: document.querySelector('.project-list-onlocation'),
    delayed: document.querySelector('.project-list-delayed'),
    cConfirmed: document.getElementById('projects-count-confirmed'),
    cPrepped: document.getElementById('projects-count-prepped'),
    cOnlocation: document.getElementById('projects-count-onlocation'),
    cDelayed: document.getElementById('projects-count-delayed'),
};

/* =======================
   STATE
======================= */
const state = {
    confirmedPages: [],
    preppedPages: [],
    onlocationPages: [],
    delayedPages: [],
    currentConfirmed: 0,
    currentPrepped: 0,
    currentOnlocation: 0,
    currentDelayed: 0,
    projectCountdown: 30,
    lastFetch: 0,
    fetchRunning: false
};

/* =======================
   HELPERS
======================= */
function chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) {
        out.push(arr.slice(i, i + size));
    }
    return out;
}

function safeFetch(url, timeout = 10000) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeout);
    return fetch(url, { signal: controller.signal })
        .then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json();
        })
        .finally(() => clearTimeout(t));
}

/* =======================
   RENDER HELPERS
======================= */
function addProjectToList(project, type, fragment) {
    const li = document.createElement('li');
    li.className = "bg-white dark:bg-card-dark px-3 rounded-lg shadow-sm flex items-center justify-between border-l-[4px]";

    let borderColor = '';
    if (type === "confirmed") {
        borderColor = 'border-yellow-500';
    } else if (type === "prepped") {
        borderColor = 'border-blue-500';
    } else if (type === "onlocation") {
        borderColor = 'border-green-500';
    } else if (type === "delayed") {
        borderColor = 'border-orange-500';
    }
    li.classList.add(borderColor);

    const contentWrapper = document.createElement('div');
    contentWrapper.className = "flex items-center gap-3";

    if (type !== "delayed") {
        let letter = '';
        if ((type === "confirmed" || type === "prepped") && project.wh_out_letter) {
            letter = project.wh_out_letter;
        } else if (type === "onlocation" && project.wh_in_letter) {
            letter = project.wh_in_letter;
        }
        if (letter) {
            const circle = document.createElement('div');
            circle.className = "size-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600";
            circle.textContent = letter;
            contentWrapper.appendChild(circle);
        }
    }

    const infoDiv = document.createElement('div');
    infoDiv.className = "flex flex-col justify-center";

    const nameSpan = document.createElement('span');
    nameSpan.className = "text-base font-bold text-gray-900 dark:text-white leading-tight";
    nameSpan.textContent = project.displayname;
    infoDiv.appendChild(nameSpan);

    if (project.displayname !== project.project) {
        const subSpan = document.createElement('span');
        subSpan.className = "text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide";
        subSpan.textContent = project.project;
        infoDiv.appendChild(subSpan);
    }

    contentWrapper.appendChild(infoDiv);
    li.appendChild(contentWrapper);

    const dateSpan = document.createElement('span');
    dateSpan.className = "text-xs font-bold text-gray-400";
    const useStartDate = type === 'confirmed' || type === 'prepped';
    let date;
    if (type === "prepped") {
        date = useStartDate ? new Date(project.sp_start_up) : new Date(project.sp_end_up);
    } else {
        date = useStartDate ? new Date(project.sp_start_pp) : new Date(project.sp_end_pp);
    }
    const today = new Date();
    const pad2 = n => n.toString().padStart(2,'0');
    const danishMonths = ['jan','feb','mar','apr','maj','jun','jul','aug','sep','okt','nov','dec'];

    if (date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear()) {
        dateSpan.innerHTML = `I dag<br>${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
    } else {
        dateSpan.innerHTML = `${date.getDate()}. ${danishMonths[date.getMonth()]}<br>${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
    }

    li.appendChild(dateSpan);
    fragment.appendChild(li);
}

/* =======================
   RENDER
======================= */
function renderProjects(container, pages, index, type) {
    if (!container || !pages[index]) return;
    container.innerHTML = '';
    const frag = document.createDocumentFragment();
    pages[index].forEach(p => addProjectToList(p, type, frag));
    container.appendChild(frag);
}

function updateCounters() {
    const refresh = `${state.projectCountdown}s`;
    if (els.cConfirmed) els.cConfirmed.textContent = state.confirmedPages.length ? `${state.currentConfirmed+1}/${state.confirmedPages.length} | ${refresh}` : '0';
    if (els.cPrepped) els.cPrepped.textContent = state.preppedPages.length ? `${state.currentPrepped+1}/${state.preppedPages.length} | ${refresh}` : '0';
    if (els.cOnlocation) els.cOnlocation.textContent = state.onlocationPages.length ? `${state.currentOnlocation+1}/${state.onlocationPages.length} | ${refresh}` : '0';
    if (els.cDelayed) els.cDelayed.textContent = state.delayedPages.length ? `${state.currentDelayed+1}/${state.delayedPages.length} | ${refresh}` : '0';
}

/* =======================
   FETCH
======================= */
async function fetchAndRender() {
    if (state.fetchRunning) return;
    state.fetchRunning = true;

    try {
        const [confirmed, prepped, onlocation, delayed] = await Promise.all([
            safeFetch('/projects/confirmed'),
            safeFetch('/projects/prepped'),
            safeFetch('/projects/onlocation'),
            safeFetch('/projects/delayed'),
        ]);

        state.confirmedPages = chunk(confirmed, 9);
        state.preppedPages = chunk(prepped, 9);
        state.onlocationPages = chunk(onlocation, 9);
        state.delayedPages = chunk(delayed, 9);

        renderProjects(els.confirmed, state.confirmedPages, state.currentConfirmed, 'confirmed');
        renderProjects(els.prepped, state.preppedPages, state.currentPrepped, 'prepped');
        renderProjects(els.onlocation, state.onlocationPages, state.currentOnlocation, 'onlocation');
        renderProjects(els.delayed, state.delayedPages, state.currentDelayed, 'delayed');

        state.projectCountdown = 30;
        state.lastFetch = Date.now();
    } catch(e) {
        console.error('Fetch fejl:', e);
    } finally {
        state.fetchRunning = false;
    }
}

/* =======================
   MAIN LOOP
======================= */
setInterval(() => {
    updateClock();

    state.projectCountdown--;

    if (state.projectCountdown <= 0) {
        state.currentConfirmed = (state.currentConfirmed+1) % Math.max(1,state.confirmedPages.length);
        state.currentPrepped = (state.currentPrepped+1) % Math.max(1,state.preppedPages.length);
        state.currentOnlocation = (state.currentOnlocation+1) % Math.max(1,state.onlocationPages.length);
        state.currentDelayed = (state.currentDelayed+1) % Math.max(1,state.delayedPages.length);

        renderProjects(els.confirmed, state.confirmedPages, state.currentConfirmed, 'confirmed');
        renderProjects(els.prepped, state.preppedPages, state.currentPrepped, 'prepped');
        renderProjects(els.onlocation, state.onlocationPages, state.currentOnlocation, 'onlocation');
        renderProjects(els.delayed, state.delayedPages, state.currentDelayed, 'delayed');

        state.projectCountdown = 30;
    }

    if (Date.now() - state.lastFetch > 120000) fetchAndRender();
    updateCounters();
}, 1000);

/* =======================
   WATCHDOG - Reload every 6 hours
======================= */
setTimeout(() => location.reload(), 6 * 60 * 60 * 1000);

fetchAndRender();
