'use strict';

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

let currentPage = {};
let confirmCb   = null;

const PAGE_TITLES = {
    dashboard:     'Дашборд',
    users:         'Пользователи',
    trips:         'Поездки',
    locations:     'Локации',
    currencies:    'Валюты',
    notifications: 'Уведомления',
};

function toast(msg, type = 'success') {
    const icons = { success: '✓', error: '✕', warning: '⚠' };
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    const iconSpan = document.createElement('span');
    iconSpan.className = 'toast-icon';
    iconSpan.textContent = icons[type] || '✓';
    const msgSpan = document.createElement('span');
    msgSpan.className = 'toast-msg';
    msgSpan.textContent = String(msg == null ? '' : msg);
    el.appendChild(iconSpan);
    el.appendChild(msgSpan);
    $('#toastWrap').appendChild(el);
    setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateX(20px)';
        el.style.transition = 'all 0.3s';
        setTimeout(() => el.remove(), 300);
    }, 3500);
}

function openModal(title, bodyHtml, footHtml, size = '') {
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML   = bodyHtml;
    $('#modalFoot').innerHTML   = footHtml;
    const modal = $('#modal');
    modal.className = size ? `modal modal--${size}` : 'modal';
    $('#modalWrap').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    $('#modalWrap').style.display = 'none';
    document.body.style.overflow  = '';
    $('#modalBody').innerHTML = '';
    $('#modalFoot').innerHTML = '';
}

function confirmDialog(title, desc, cb) {
    confirmCb = cb;
    openModal(
        title,
        `<p class="modal-desc">${esc(desc)}</p>`,
        `<button class="btn-cancel" id="confirmCancel">Отмена</button>
         <button class="btn-danger" id="confirmOk">Подтвердить</button>`,
        'sm'
    );
    $('#confirmOk').onclick = () => { closeModal(); if (confirmCb) { confirmCb(); confirmCb = null; } };
    $('#confirmCancel').onclick = closeModal;
}

function fmtDate(str) {
    if (!str) return '—';
    try {
        return new Date(str).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch { return '—'; }
}

function fmtDateShort(str) {
    if (!str) return '—';
    try {
        return new Date(str).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    } catch { return '—'; }
}

function fmtMoney(v) {
    return parseFloat(v || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 });
}

function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function debounce(fn, ms) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

function renderPagination(selector, page, total, cb) {
    const el = $(selector);
    if (!el) return;
    if (!total || total <= 1) { el.innerHTML = ''; return; }
    let html = `<button class="pg-btn" data-p="${page - 1}" ${page === 1 ? 'disabled' : ''}>←</button>`;
    for (let i = 1; i <= total; i++) {
        const near  = i >= page - 1 && i <= page + 1;
        const edge  = i === 1 || i === total;
        const dots  = i === page - 2 || i === page + 2;
        if (edge || near) {
            html += `<button class="pg-btn${i === page ? ' active' : ''}" data-p="${i}">${i}</button>`;
        } else if (dots) {
            html += `<span style="padding:0 4px;color:var(--text-3)">...</span>`;
        }
    }
    html += `<button class="pg-btn" data-p="${page + 1}" ${page === total ? 'disabled' : ''}>→</button>`;
    el.innerHTML = html;
    el.querySelectorAll('.pg-btn:not([disabled])').forEach(b => {
        b.addEventListener('click', () => cb(parseInt(b.dataset.p)));
    });
}

function svgEdit() {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
}

function svgDel() {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M10 11v6M14 11v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
}

function initNav() {
    const items = $$('.sidebar-item[data-page]');
    const loaders = {
        dashboard:     loadDashboard,
        users:         () => loadUsers(1),
        trips:         () => loadTrips(1),
        locations:     () => loadLocations(1),
        currencies:    loadCurrencies,
        notifications: () => loadNotifs(1),
    };

    items.forEach(item => {
        item.addEventListener('click', () => {
            items.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            $$('.page').forEach(p => p.classList.remove('active'));
            const pg = $(`#page-${item.dataset.page}`);
            if (pg) pg.classList.add('active');
            const title = PAGE_TITLES[item.dataset.page] || '';
            $('#topbarTitle').textContent = title;
            if (loaders[item.dataset.page]) loaders[item.dataset.page]();
            closeSidebar();
        });
    });
}

function initBurger() {
    const btn     = $('#burgerBtn');
    const sidebar = $('#sidebar');
    const overlay = $('#overlay');

    btn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('show');
    });

    overlay.addEventListener('click', closeSidebar);
}

function closeSidebar() {
    $('#sidebar').classList.remove('open');
    $('#overlay').classList.remove('show');
}

function initModalClose() {
    $('#modalClose').addEventListener('click', closeModal);
    $('#modalWrap').addEventListener('click', e => {
        if (e.target === $('#modalWrap')) closeModal();
    });
}

function initLogout() {
    var btn = document.querySelector('#logoutBtn');
    if (!btn) return;

    btn.addEventListener('click', function () {
        api.post('/auth/logout')
            .catch(function () {})
            .finally(function () {
                localStorage.removeItem('access_token');
                localStorage.removeItem('user');
                window.location.replace('login.html');
            });
    });
}

function initUser() {
    const raw = localStorage.getItem('user');
    if (!raw) return;
    try {
        const u = JSON.parse(raw);
        const name   = u.name || 'Администратор';
        const letter = name.charAt(0).toUpperCase();
        $('#topbarAvatar').textContent = letter;
        $('#topbarName').textContent   = name;
    } catch {}
}

function fmtBytes(b) {
    if (!b) return '0 B';
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
    if (b < 1024 * 1024 * 1024) return (b / 1024 / 1024).toFixed(1) + ' MB';
    return (b / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}

async function loadLive() {
    try {
        const d = await api.get('/admin/live');
        $('#liveOnline').textContent   = d.online_24h ?? 0;
        $('#liveNewUsers').textContent = d.new_users_24h ?? 0;
        $('#liveNewTrips').textContent = d.new_trips_24h ?? 0;
        $('#liveSpent').textContent    = fmtMoney(d.spent_24h) + ' ₽';
        $('#liveStorage').textContent  = (d.storage_count || 0) + ' · ' + fmtBytes(d.storage_bytes || 0);
    } catch (e) {  }
}

async function downloadCsv(url, filename) {
    const token = localStorage.getItem('access_token');
    try {
        const r = await fetch(url, { headers: token ? { 'Authorization': 'Bearer ' + token } : {} });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const blob = await r.blob();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
    } catch (e) {
        toast('Не удалось скачать CSV: ' + e.message, 'error');
    }
}

function initCsvLinks() {
    document.addEventListener('click', function (e) {
        const a = e.target.closest('a[href^="/api/admin/export/"]');
        if (!a) return;
        e.preventDefault();
        const url = (api.baseUrl.replace(/\/api$/, '')) + a.getAttribute('href');
        const fname = a.getAttribute('href').split('/').pop();
        downloadCsv(url, fname);
    });
}

function initQuickActions() {
    var quick = $('#quickNotif');
    if (quick) quick.addEventListener('click', function (e) {
        e.preventDefault();
        var item = document.querySelector('.sidebar-item[data-page="notifications"]');
        if (item) item.click();
        setTimeout(function () { var b = $('#sendNotifBtn'); if (b) b.click(); }, 100);
    });
    var qcur = $('#quickCurrency');
    if (qcur) qcur.addEventListener('click', function (e) {
        e.preventDefault();
        var item = document.querySelector('.sidebar-item[data-page="currencies"]');
        if (item) item.click();
    });
}

async function loadDashboard() {
    loadLive();
    try {
        const data = await api.get('/admin/stats');
        const s = data.stats;

        $('#sv-users').textContent    = s.total_users ?? '—';
        $('#ss-users').textContent    = `${s.active_users ?? 0} активных`;
        $('#sv-trips').textContent    = s.total_trips ?? '—';
        $('#ss-trips').textContent    = `${s.active_trips ?? 0} активных`;
        $('#sv-locations').textContent = s.total_locations ?? '—';
        $('#ss-tasks').textContent    = `${s.total_tasks ?? 0} задач`;
        $('#sv-budget').textContent   = s.total_budget_items ?? '—';
        $('#ss-budget').textContent   = `${fmtMoney(s.total_spent)} ₽ всего`;

        renderChart('#chartUsers', data.users_by_day, '#01abfb');
        renderChart('#chartTrips', data.trips_by_day, '#4ade80');
        renderTopCities(data.top_cities);
        renderBudgetCats(data.budget_by_category);

    } catch (e) {
        toast('Ошибка загрузки статистики: ' + e.message, 'error');
    }
}

function renderChart(selector, items, color) {
    const el = $(selector);
    if (!el) return;
    if (!items || !items.length) {
        el.innerHTML = '<div class="chart-empty">Нет данных</div>';
        return;
    }
    const max = Math.max(...items.map(i => parseInt(i.count) || 0));
    if (!max) { el.innerHTML = '<div class="chart-empty">Нет данных</div>'; return; }

    el.innerHTML = items.map(item => {
        const pct = Math.max(4, Math.round((parseInt(item.count) || 0) / max * 100));
        const day = item.day ? esc(String(item.day).slice(5)) : '';
        const cnt = parseInt(item.count) || 0;
        return `<div class="chart-col">
            <div class="chart-bar" style="height:${pct}%;background:${esc(color)};opacity:0.85">
                <div class="chart-bar-tip">${cnt}</div>
            </div>
            <div class="chart-day">${day}</div>
        </div>`;
    }).join('');
}

function renderTopCities(cities) {
    const el = $('#topCities');
    if (!el) return;
    if (!cities || !cities.length) {
        el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-3);font-size:13px">Нет данных</div>';
        return;
    }
    const max = Math.max(...cities.map(c => parseInt(c.count) || 0));
    el.innerHTML = cities.map((c, i) => {
        const pct = Math.round((parseInt(c.count) || 0) / max * 100);
        return `<div class="city-row">
            <div class="city-rank">${i + 1}</div>
            <div class="city-name">${esc(c.city)}</div>
            <div class="city-track"><div class="city-fill" style="width:${pct}%"></div></div>
            <div class="city-count">${c.count}</div>
        </div>`;
    }).join('');
}

function renderBudgetCats(cats) {
    const el = $('#budgetCats');
    if (!el) return;
    if (!cats || !cats.length) {
        el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-3);font-size:13px">Нет данных</div>';
        return;
    }
    el.innerHTML = cats.map(c => `
        <div class="bcat-row">
            <div class="bcat-dot" style="background:${esc(c.color || '#888')}"></div>
            <div class="bcat-name">${esc(c.name)}</div>
            <div class="bcat-amount">${fmtMoney(c.total)} ₽</div>
        </div>`).join('');
}

async function loadUsers(page = 1) {
    currentPage.users = page;
    const search = $('#usersSearch')?.value.trim() || '';
    const role   = $('#usersRole')?.value   || '';
    const status = $('#usersStatus')?.value || '';
    const params = new URLSearchParams({ page, search, role, status });
    try {
        const data = await api.get(`/admin/users?${params}`);
        const d = data.users !== undefined ? data : data;
        const users = d.users || [];
        const total = d.total || 0;
        const pages = d.total_pages || 1;
        $('#usersSub').textContent = `Всего: ${total}`;
        renderUsersTable(users);
        renderPagination('#usersPagination', page, pages, p => loadUsers(p));
    } catch (e) {
        toast(e.message, 'error');
    }
}

function renderUsersTable(users) {
    const el = $('#usersBody');
    if (!users.length) {
        el.innerHTML = '<tr><td colspan="8" class="table-empty">Пользователи не найдены</td></tr>';
        return;
    }
    el.innerHTML = users.map(u => `
        <tr>
            <td>
                <div class="user-cell">
                    <div class="user-cell-av">${esc((u.name || '?').charAt(0).toUpperCase())}</div>
                    <div class="user-cell-name">${esc(u.name)}</div>
                </div>
            </td>
            <td style="color:var(--text-2);font-size:12px">${esc(u.email)}</td>
            <td><span class="badge badge-${u.role === 'admin' ? 'admin' : 'user'}">${u.role === 'admin' ? 'Админ' : 'Юзер'}</span></td>
            <td><span class="badge badge-${u.is_active ? 'active' : 'blocked'}">${u.is_active ? 'Активен' : 'Заблокирован'}</span></td>
            <td style="font-weight:600;color:#fff">${u.trips_count || 0}</td>
            <td style="font-size:12px;color:var(--text-2)">${fmtDate(u.created_at)}</td>
            <td style="font-size:12px;color:var(--text-2)">${u.last_login_at ? fmtDate(u.last_login_at) : '—'}</td>
            <td>
                <div class="tbl-actions">
                    <button class="tbl-btn" title="Редактировать"
                        data-action="edit-user"
                        data-id="${u.id}"
                        data-name="${esc(u.name)}"
                        data-email="${esc(u.email)}"
                        data-role="${u.role}"
                        data-status="${u.is_active ? 1 : 0}">
                        ${svgEdit()}
                    </button>
                    <button class="tbl-btn tbl-btn--danger" title="Удалить"
                        data-action="del-user"
                        data-id="${u.id}"
                        data-name="${esc(u.name)}">
                        ${svgDel()}
                    </button>
                </div>
            </td>
        </tr>`).join('');
}

function openEditUser(id, name, email, role, status) {
    openModal(
        id ? 'Редактировать пользователя' : 'Пользователь',
        `<input type="hidden" id="euId" value="${id}">
         <div class="form-group">
             <label class="form-label">Имя</label>
             <input type="text" id="euName" class="form-input" value="${esc(name)}" maxlength="100">
         </div>
         <div class="form-group">
             <label class="form-label">Email</label>
             <input type="email" id="euEmail" class="form-input" value="${esc(email)}" disabled>
         </div>
         <div class="form-group">
             <label class="form-label">Роль</label>
             <select id="euRole" class="form-select">
                 <option value="user" ${role === 'user' ? 'selected' : ''}>Пользователь</option>
                 <option value="admin" ${role === 'admin' ? 'selected' : ''}>Администратор</option>
             </select>
         </div>
         <div class="form-group">
             <label class="form-label">Статус</label>
             <select id="euStatus" class="form-select">
                 <option value="1" ${status == 1 ? 'selected' : ''}>Активен</option>
                 <option value="0" ${status == 0 ? 'selected' : ''}>Заблокирован</option>
             </select>
         </div>`,
        `<button class="btn-cancel" id="euCancel">Отмена</button>
         <button class="btn-save" id="euSave">Сохранить</button>`
    );
    $('#euCancel').onclick = closeModal;
    $('#euSave').onclick = async () => {
        const btn = $('#euSave');
        const uId     = parseInt($('#euId').value);
        const uName   = $('#euName').value.trim();
        const uRole   = $('#euRole').value;
        const uStatus = parseInt($('#euStatus').value);
        if (!uName) { toast('Введите имя', 'error'); return; }
        btn.disabled = true;
        btn.textContent = 'Сохраняем...';
        try {
            await api.put(`/admin/users/${uId}`, { name: uName, role: uRole, is_active: uStatus });
            toast('Пользователь обновлён');
            closeModal();
            loadUsers(currentPage.users || 1);
        } catch (e) {
            toast(e.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Сохранить';
        }
    };
}

async function loadTrips(page = 1) {
    currentPage.trips = page;
    const search = $('#tripsSearch')?.value.trim() || '';
    const status = $('#tripsStatus')?.value || '';
    const params = new URLSearchParams({ page, search, status });
    try {
        const data = await api.get(`/admin/trips?${params}`);
        const trips = data.trips || [];
        const total = data.total || 0;
        const pages = data.total_pages || 1;
        $('#tripsSub').textContent = `Всего: ${total}`;
        renderTripsTable(trips);
        renderPagination('#tripsPagination', page, pages, p => loadTrips(p));
    } catch (e) {
        toast(e.message, 'error');
    }
}

function renderTripsTable(trips) {
    const el = $('#tripsBody');
    const statusLabels = { active: 'Активная', completed: 'Завершена', draft: 'Черновик', archived: 'Архив' };
    if (!trips.length) {
        el.innerHTML = '<tr><td colspan="8" class="table-empty">Поездки не найдены</td></tr>';
        return;
    }
    el.innerHTML = trips.map(t => `
        <tr>
            <td>
                <div class="trip-title">${esc(t.title)}</div>
                <div class="trip-city">${esc(t.city)}${t.country ? ', ' + esc(t.country) : ''}</div>
            </td>
            <td>
                <div class="user-cell">
                    <div class="user-cell-av" style="width:26px;height:26px;font-size:10px">${esc((t.owner_name || '?').charAt(0))}</div>
                    <div>
                        <div style="font-size:12px;font-weight:600;color:#fff">${esc(t.owner_name)}</div>
                        <div style="font-size:11px;color:var(--text-2)">${esc(t.owner_email)}</div>
                    </div>
                </div>
            </td>
            <td style="font-size:12px;color:var(--text-2);white-space:nowrap">${fmtDateShort(t.date_start)} — ${fmtDateShort(t.date_end)}</td>
            <td><span class="badge badge-${t.status}">${statusLabels[t.status] || t.status}</span></td>
            <td style="font-weight:600;color:#fff">${t.members_count || 0}</td>
            <td style="font-weight:600;color:#fff">${t.locations_count || 0}</td>
            <td style="font-weight:600;color:#fff">${t.tasks_count || 0}</td>
            <td>
                <div class="tbl-actions">
                    <button class="tbl-btn tbl-btn--danger" title="Удалить"
                        data-action="del-trip"
                        data-id="${t.id}"
                        data-title="${esc(t.title)}">
                        ${svgDel()}
                    </button>
                </div>
            </td>
        </tr>`).join('');
}

async function loadLocations(page = 1) {
    currentPage.locations = page;
    const search = $('#locationsSearch')?.value.trim() || '';
    const params = new URLSearchParams({ page, search });
    try {
        const data = await api.get(`/admin/locations?${params}`);
        const locs  = data.locations || [];
        const total = data.total || 0;
        const pages = data.total_pages || 1;
        $('#locationsSub').textContent = `Всего: ${total}`;
        renderLocationsTable(locs);
        renderPagination('#locationsPagination', page, pages, p => loadLocations(p));
    } catch (e) {
        toast(e.message, 'error');
    }
}

function renderLocationsTable(locs) {
    const el = $('#locationsBody');
    if (!locs.length) {
        el.innerHTML = '<tr><td colspan="6" class="table-empty">Локации не найдены</td></tr>';
        return;
    }
    el.innerHTML = locs.map(l => `
        <tr>
            <td>
                <div style="font-weight:600;color:#fff">${esc(l.name)}</div>
                ${l.address ? `<div style="font-size:11px;color:var(--text-2)">${esc(l.address)}</div>` : ''}
            </td>
            <td style="font-size:12px;color:var(--text-2)">${esc(l.trip_title || '—')}</td>
            <td style="font-size:12px;color:var(--text-3)">${l.lat?.toFixed(4)}, ${l.lng?.toFixed(4)}</td>
            <td style="font-size:12px;color:var(--text-2)">${esc(l.added_by || '—')}</td>
            <td style="font-size:12px;color:var(--text-2)">${fmtDate(l.created_at)}</td>
            <td>
                <div class="tbl-actions">
                    <button class="tbl-btn tbl-btn--danger" title="Удалить"
                        data-action="del-location"
                        data-id="${l.id}"
                        data-name="${esc(l.name)}">
                        ${svgDel()}
                    </button>
                </div>
            </td>
        </tr>`).join('');
}

async function loadCurrencies() {
    try {
        const data = await api.get('/admin/currencies');
        const currencies = Array.isArray(data) ? data : [];
        renderCurrenciesTable(currencies);
    } catch (e) {
        toast(e.message, 'error');
    }
}

function renderCurrenciesTable(currencies) {
    const el = $('#currenciesBody');
    if (!currencies.length) {
        el.innerHTML = '<tr><td colspan="7" class="table-empty">Нет данных</td></tr>';
        return;
    }
    el.innerHTML = currencies.map(c => `
        <tr>
            <td style="font-weight:600;color:#fff">${esc(c.name)}</td>
            <td><code style="background:var(--dark-3);padding:2px 8px;border-radius:6px;font-size:12px;color:var(--blue)">${esc(c.code)}</code></td>
            <td style="font-size:18px;font-weight:700;color:#fff">${esc(c.symbol)}</td>
            <td style="font-weight:700;color:#fff">${parseFloat(c.rate_to_rub).toFixed(4)} ₽</td>
            <td><span class="badge badge-${c.is_active ? 'active' : 'blocked'}">${c.is_active ? 'Активна' : 'Отключена'}</span></td>
            <td style="font-size:12px;color:var(--text-2)">${fmtDate(c.updated_at)}</td>
            <td>
                <div class="tbl-actions">
                    <button class="tbl-btn" title="Изменить курс"
                        data-action="edit-currency"
                        data-id="${c.id}"
                        data-name="${esc(c.name)}"
                        data-rate="${c.rate_to_rub}"
                        data-status="${c.is_active ? 1 : 0}">
                        ${svgEdit()}
                    </button>
                </div>
            </td>
        </tr>`).join('');
}

function openEditCurrency(id, name, rate, status) {
    openModal(
        'Обновить курс',
        `<input type="hidden" id="ecId" value="${id}">
         <div class="form-group">
             <label class="form-label">Валюта</label>
             <input class="form-input" value="${esc(name)}" disabled>
         </div>
         <div class="form-group">
             <label class="form-label">Курс к рублю (₽)</label>
             <input type="number" id="ecRate" class="form-input" value="${parseFloat(rate).toFixed(4)}" step="0.0001" min="0.0001">
             <span class="form-hint">Сколько рублей стоит 1 единица этой валюты</span>
         </div>
         <div class="form-group">
             <label class="form-label">Статус</label>
             <select id="ecStatus" class="form-select">
                 <option value="1" ${status == 1 ? 'selected' : ''}>Активна</option>
                 <option value="0" ${status == 0 ? 'selected' : ''}>Отключена</option>
             </select>
         </div>`,
        `<button class="btn-cancel" id="ecCancel">Отмена</button>
         <button class="btn-save" id="ecSave">Сохранить</button>`
    );
    $('#ecCancel').onclick = closeModal;
    $('#ecSave').onclick = async () => {
        const btn   = $('#ecSave');
        const cId   = parseInt($('#ecId').value);
        const cRate = parseFloat($('#ecRate').value);
        const cStat = parseInt($('#ecStatus').value);
        if (!cRate || cRate <= 0) { toast('Введи корректный курс', 'error'); return; }
        btn.disabled = true;
        btn.textContent = 'Сохраняем...';
        try {
            await api.put(`/admin/currencies/${cId}`, { rate_to_rub: cRate, is_active: cStat });
            toast('Курс обновлён');
            closeModal();
            loadCurrencies();
        } catch (e) {
            toast(e.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Сохранить';
        }
    };
}

async function loadNotifs(page = 1) {
    currentPage.notifs = page;
    const params = new URLSearchParams({ page });
    try {
        const data  = await api.get(`/admin/notifications?${params}`);
        const notifs = data.notifications || [];
        const total  = data.total || 0;
        const pages  = data.total_pages || 1;
        $('#notifSub').textContent = `Всего: ${total}`;
        renderNotifsTable(notifs);
        renderPagination('#notifPagination', page, pages, p => loadNotifs(p));
    } catch (e) {
        toast(e.message, 'error');
    }
}

function renderNotifsTable(notifs) {
    const el = $('#notifBody');
    const typeLabels = {
        trip_invite: 'Приглашение', trip_update: 'Обновление',
        member_joined: 'Вошёл', member_left: 'Вышел',
        task_assigned: 'Задача назначена', task_done: 'Задача выполнена',
        budget_limit: 'Лимит бюджета', trip_reminder: 'Напоминание',
    };
    if (!notifs.length) {
        el.innerHTML = '<tr><td colspan="7" class="table-empty">Уведомлений нет</td></tr>';
        return;
    }
    el.innerHTML = notifs.map(n => `
        <tr>
            <td style="font-size:12px;color:var(--text-2)">${esc(n.user_name || '—')}</td>
            <td><span class="badge badge-user">${typeLabels[n.type] || n.type}</span></td>
            <td style="font-weight:600;color:#fff;font-size:13px">${esc(n.title)}</td>
            <td style="font-size:12px;color:var(--text-2);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(n.message || '—')}</td>
            <td><span class="badge badge-${n.is_read ? 'read' : 'unread'}">${n.is_read ? 'Да' : 'Нет'}</span></td>
            <td style="font-size:12px;color:var(--text-2)">${fmtDate(n.created_at)}</td>
            <td>
                <div class="tbl-actions">
                    <button class="tbl-btn tbl-btn--danger" title="Удалить"
                        data-action="del-notif"
                        data-id="${n.id}">
                        ${svgDel()}
                    </button>
                </div>
            </td>
        </tr>`).join('');
}

function openSendNotif(users) {
    let opts = '<option value="">Всем пользователям</option>';
    (users || []).forEach(u => {
        opts += `<option value="${parseInt(u.id) || 0}">${esc(u.name)} (${esc(u.email)})</option>`;
    });
    openModal(
        'Отправить уведомление',
        `<div class="form-group">
             <label class="form-label">Получатель</label>
             <select id="snUser" class="form-select">${opts}</select>
         </div>
         <div class="form-group">
             <label class="form-label">Тип</label>
             <select id="snType" class="form-select">
                 <option value="trip_update">Обновление поездки</option>
                 <option value="trip_reminder">Напоминание</option>
                 <option value="budget_limit">Лимит бюджета</option>
             </select>
         </div>
         <div class="form-group">
             <label class="form-label">Заголовок</label>
             <input type="text" id="snTitle" class="form-input" placeholder="Заголовок уведомления">
         </div>
         <div class="form-group">
             <label class="form-label">Сообщение</label>
             <textarea id="snMsg" class="form-textarea" placeholder="Текст уведомления..."></textarea>
         </div>`,
        `<button class="btn-cancel" id="snCancel">Отмена</button>
         <button class="btn-save" id="snSend">Отправить</button>`
    );
    $('#snCancel').onclick = closeModal;
    $('#snSend').onclick = async () => {
        const btn     = $('#snSend');
        const userId  = $('#snUser').value;
        const type    = $('#snType').value;
        const title   = $('#snTitle').value.trim();
        const message = $('#snMsg').value.trim();
        if (!title) { toast('Введите заголовок', 'error'); return; }
        btn.disabled = true;
        btn.textContent = 'Отправляем...';
        try {
            await api.post('/admin/notifications', {
                user_id: userId ? parseInt(userId) : null,
                type, title,
                message: message || null,
            });
            toast('Уведомление отправлено');
            closeModal();
            loadNotifs(1);
        } catch (e) {
            toast(e.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Отправить';
        }
    };
}

function initTableActions() {
    document.addEventListener('click', async e => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const { action, id, name, email, role, status, rate, title: dTitle } = btn.dataset;

        if (action === 'edit-user') {
            openEditUser(id, name, email, role, status);
        }

        if (action === 'del-user') {
            const me = JSON.parse(localStorage.getItem('user') || '{}');
            if (parseInt(id) === me.id) { toast('Нельзя удалить себя', 'error'); return; }
            confirmDialog(
                'Удалить пользователя?',
                `Пользователь «${name}» и все его данные будут удалены безвозвратно.`,
                async () => {
                    try {
                        await api.delete(`/admin/users/${id}`);
                        toast('Пользователь удалён');
                        loadUsers(currentPage.users || 1);
                    } catch (err) { toast(err.message, 'error'); }
                }
            );
        }

        if (action === 'del-trip') {
            confirmDialog(
                'Удалить поездку?',
                `Поездка «${dTitle}» и все её данные будут удалены безвозвратно.`,
                async () => {
                    try {
                        await api.delete(`/admin/trips/${id}`);
                        toast('Поездка удалена');
                        loadTrips(currentPage.trips || 1);
                    } catch (err) { toast(err.message, 'error'); }
                }
            );
        }

        if (action === 'del-location') {
            confirmDialog(
                'Удалить локацию?',
                `Локация «${name}» будет удалена.`,
                async () => {
                    try {
                        await api.delete(`/admin/locations/${id}`);
                        toast('Локация удалена');
                        loadLocations(currentPage.locations || 1);
                    } catch (err) { toast(err.message, 'error'); }
                }
            );
        }

        if (action === 'edit-currency') {
            openEditCurrency(id, name, rate, status);
        }

        if (action === 'del-notif') {
            confirmDialog(
                'Удалить уведомление?',
                'Уведомление будет удалено.',
                async () => {
                    try {
                        await api.delete(`/admin/notifications/${id}`);
                        toast('Удалено');
                        loadNotifs(currentPage.notifs || 1);
                    } catch (err) { toast(err.message, 'error'); }
                }
            );
        }
    });
}

function initSearch() {
    const d = (fn, ms) => debounce(fn, ms);
    $('#usersSearch')?.addEventListener('input',     d(() => loadUsers(1), 400));
    $('#tripsSearch')?.addEventListener('input',     d(() => loadTrips(1), 400));
    $('#locationsSearch')?.addEventListener('input', d(() => loadLocations(1), 400));
    $('#usersRole')?.addEventListener('change',   () => loadUsers(1));
    $('#usersStatus')?.addEventListener('change', () => loadUsers(1));
    $('#tripsStatus')?.addEventListener('change', () => loadTrips(1));
}

function initSendNotifBtn() {
    $('#sendNotifBtn')?.addEventListener('click', async () => {
        try {
            const data  = await api.get('/admin/users?page=1&search=&role=&status=active');
            const users = data.users || [];
            openSendNotif(users);
        } catch {
            openSendNotif([]);
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    initUser();
    initNav();
    initBurger();
    initModalClose();
    initLogout();
    initTableActions();
    initSearch();
    initSendNotifBtn();
    initCsvLinks();
    initQuickActions();
    setInterval(loadLive, 60000);
    await loadDashboard();
});