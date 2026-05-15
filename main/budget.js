// main/budget.js
'use strict';

function qs(sel)  { return document.querySelector(sel); }
function qsa(sel) { return Array.from(document.querySelectorAll(sel)); }

var allTrips   = [];
var activeTrip = null;
var budgetData = null;

var CURRENCY_SYMBOLS = { 1:'₽', 2:'$', 3:'€', 4:'₸', 5:'¥', 6:'₺', 7:'د.إ', 8:'฿' };
var CAT_ICONS = {
    transport:     '<svg viewBox="0 0 24 24" fill="none"><path d="M21 16v-2l-8-5V3.5C13 2.67 12.33 2 11.5 2S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill="currentColor"/></svg>',
    hotel:         '<svg viewBox="0 0 24 24" fill="none"><path d="M3 21V8l9-5 9 5v13" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><rect x="9" y="13" width="6" height="8" stroke="currentColor" stroke-width="1.8"/></svg>',
    food:          '<svg viewBox="0 0 24 24" fill="none"><path d="M3 2v8a3 3 0 0 0 3 3v9M9 2v8a3 3 0 0 1-3 3M9 2v6M15 11h5v10M18 2c-2 0-3 2-3 5s1 4 3 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    entertainment: '<svg viewBox="0 0 24 24" fill="none"><polygon points="12 2 15 9 22 9 17 14 19 22 12 17 5 22 7 14 2 9 9 9" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    shopping:      '<svg viewBox="0 0 24 24" fill="none"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6L18 2zM3 6h18M16 10a4 4 0 0 1-8 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    visa:          '<svg viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><polyline points="14 2 14 8 20 8" stroke="currentColor" stroke-width="1.8"/><path d="M9 13h6M9 17h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    insurance:     '<svg viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    other:         '<svg viewBox="0 0 24 24" fill="none"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4M3 5v14a2 2 0 0 0 2 2h16v-5M18 12a2 2 0 0 0 0 4h4v-4z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
};

var CAT_COLORS = {
    transport:     '#01abfb',
    hotel:         '#8b5cf6',
    food:          '#f97316',
    entertainment: '#ec4899',
    shopping:      '#f59e0b',
    visa:          '#6366f1',
    insurance:     '#22c55e',
    other:         '#98a2b3',
};

function initHeader() {
    var h = qs('#header');
    if (h) window.addEventListener('scroll', function () {
        h.classList.toggle('scrolled', window.scrollY > 8);
    }, { passive: true });

    var burger = qs('#burger'), menu = qs('#mobileMenu');
    if (burger && menu) burger.addEventListener('click', function () {
        menu.classList.toggle('open', burger.classList.toggle('open'));
    });

    var pill = qs('#userPill');
    if (pill) document.addEventListener('click', function (e) {
        if (pill.contains(e.target)) pill.classList.toggle('open');
        else pill.classList.remove('open');
    });

    qsa('#logoutBtn,#logoutMobile').forEach(function (b) {
        b.addEventListener('click', function () {
            localStorage.removeItem('access_token');
            localStorage.removeItem('user');
            window.location.replace('login.html');
        });
    });
}

function loadUser() {
    var u = window.currentUser || JSON.parse(localStorage.getItem('user') || '{}');
    var n = u.name || 'Пользователь', e = u.email || '';
    var l = n.charAt(0).toUpperCase();
    var av = qs('#headerAvatar');
    if (av) av.textContent = l;
    [['headerName', n], ['dropName', n], ['dropEmail', e]].forEach(function (p) {
        var el = qs('#' + p[0]);
        if (el) el.textContent = p[1];
    });
}

function loadTrips() {
    api.get('/trips')
        .then(function (res) {
            allTrips = Array.isArray(res) ? res : [];

            qs('#bgSkeleton').style.display = 'none';
            qs('#bgContent').style.display  = '';

            if (!allTrips.length) {
                qs('#bgEmpty').style.display     = '';
                qs('#tripSelector').style.display = 'none';
                return;
            }

            qs('#tripSelector').style.display = '';
            buildSelector(allTrips);
            selectTrip(allTrips[0]);
        })
        .catch(function (err) {
            showToast(err.message || 'Ошибка загрузки', 'error');
            qs('#bgSkeleton').style.display = 'none';
            qs('#bgContent').style.display  = '';
            qs('#bgEmpty').style.display    = '';
        });
}

function loadBudget(trip) {
    api.get('/budget?trip_id=' + trip.id)
        .then(function (data) {
            budgetData = data;
            renderBudget(trip, data);
        })
        .catch(function (err) {
            showToast(err.message || 'Ошибка загрузки бюджета', 'error');
        });
}

function buildSelector(trips) {
    var list = qs('#tripSelectorList');
    list.innerHTML = '';
    trips.forEach(function (t) {
        var btn = document.createElement('button');
        btn.className    = 'bg-trip-btn';
        btn.dataset.id   = t.id;
        btn.innerHTML    = '<span class="bg-trip-btn__dot"></span>' + escHtml(t.title || 'Без названия');
        btn.addEventListener('click', function () { selectTrip(t); });
        list.appendChild(btn);
    });
}

function selectTrip(trip) {
    activeTrip = trip;
    qsa('.bg-trip-btn').forEach(function (b) {
        b.classList.toggle('bg-trip-btn--active', b.dataset.id == trip.id);
    });
    loadBudget(trip);
}

function renderBudget(trip, data) {
    var sym   = (data.base_currency && data.base_currency.symbol) || CURRENCY_SYMBOLS[trip.base_currency_id] || '₽';
    var limit = data.budget_limit || 0;
    var spent = data.total        || 0;
    var left  = Math.max(0, limit - spent);
    var pct   = limit ? Math.min(100, Math.round(spent / limit * 100)) : 0;
    var items = data.items || [];

    var sub = qs('#budgetHeadSub');
    if (sub) sub.textContent = escHtml(trip.title) + ' · ' + (items.length ? items.length + ' расходов' : 'нет расходов');

    setText('statTotal', limit > 0 ? sym + ' ' + fmt(limit) : '—');
    setText('statSpent', sym + ' ' + fmt(spent));
    setText('statLeft',  limit > 0 ? sym + ' ' + fmt(left) : '—');

    var fill = qs('#budgetProgressFill');
    if (fill) {
        fill.style.width = pct + '%';
        fill.className   = 'bg-progress-fill' +
            (pct >= 100 ? ' bg-progress-fill--danger' : pct >= 80 ? ' bg-progress-fill--warn' : '');
    }
    setText('budgetProgressSpent', sym + ' ' + fmt(spent));
    setText('budgetProgressTotal', limit > 0 ? sym + ' ' + fmt(limit) : '—');
    setText('budgetProgressPct',   pct + '%');
    setText('budgetProgressSub',
        limit === 0 ? 'Лимит не установлен' :
        pct >= 100  ? 'Бюджет исчерпан!' :
        pct >= 80   ? 'Осторожно — бюджет почти исчерпан' :
        'Использовано ' + pct + '% бюджета');

    setText('itemsSubtitle', items.length ? items.length + ' ' + declItems(items.length) : 'Нет статей');
    renderItems(items, limit, sym);
}

function renderItems(items, limit, sym) {
    var list = qs('#bgItems');
    if (!list) return;

    if (!items.length) {
        list.innerHTML = '<div class="bg-items__empty">Нет статей расходов. Добавьте первую!</div>';
        return;
    }

    list.innerHTML = '';
    items.forEach(function (item) {
        list.appendChild(buildItem(item, limit, sym));
    });
}

function buildItem(item, limit, sym) {
    var pct   = limit ? Math.min(100, Math.round((parseFloat(item.amount_in_base) || 0) / limit * 100)) : 0;
    var color = '#98a2b3';
    var icon  = CAT_ICONS.other;

    var el = document.createElement('div');
    el.className = 'bg-item';
    el.innerHTML =
        '<div class="bg-item__cat" style="background:' + color + '22;color:' + color + '">' + icon + '</div>' +
        '<div class="bg-item__info">' +
            '<div class="bg-item__name">' + escHtml(item.title || '—') + '</div>' +
            (item.note ? '<div class="bg-item__note">' + escHtml(item.note) + '</div>' : '') +
        '</div>' +
        '<div class="bg-item__bar-wrap">' +
            '<div class="bg-item__bar">' +
                '<div class="bg-item__bar-fill" style="width:' + pct + '%;background:' + color + '"></div>' +
            '</div>' +
            '<div class="bg-item__bar-pct">' + pct + '% от лимита</div>' +
        '</div>' +
        '<div class="bg-item__amount">' + sym + ' ' + fmt(item.amount_in_base || item.amount) + '</div>' +
        '<div class="bg-item__actions">' +
            '<button class="bg-item__btn" data-attach="' + item.id + '" data-title="' + escHtml(item.title || '') + '" title="Чеки и фото">' +
                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none">' +
                '<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
                '</svg>' +
            '</button>' +
            '<button class="bg-item__btn" data-del="' + item.id + '" title="Удалить">' +
                '<svg width="13" height="13" viewBox="0 0 24 24" fill="none">' +
                '<polyline points="3 6 5 6 21 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
                '<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
                '</svg>' +
            '</button>' +
        '</div>';

    el.querySelector('[data-del]').addEventListener('click', function () {
        deleteItem(item.id);
    });
    el.querySelector('[data-attach]').addEventListener('click', function () {
        openReceipts(item.id, item.title || '');
    });

    return el;
}

function openReceipts(itemId, title) {
    var modal = qs('#receiptsModal');
    var body  = qs('#receiptsBody');
    var titleEl = qs('#receiptsTitle');
    if (!modal || !body || !window.attachments || !activeTrip) return;

    if (titleEl) titleEl.textContent = 'Чеки: ' + title;
    body.innerHTML = '';
    modal.style.display = 'flex';

    window.attachments.mount({
        container:    body,
        tripId:       activeTrip.id,
        budgetItemId: itemId,
        kind:         'receipt',
        canEdit:      true,
    });
}

function initReceiptsModal() {
    var modal   = qs('#receiptsModal');
    var closeBtn = qs('#receiptsClose');
    if (!modal) return;
    var close = function () { modal.style.display = 'none'; };
    if (closeBtn) closeBtn.addEventListener('click', close);
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
}

function deleteItem(id) {
    api.delete('/budget/' + id)
        .then(function () {
            if (budgetData) {
                budgetData.items = (budgetData.items || []).filter(function (b) { return b.id !== id; });
                budgetData.total = budgetData.items.reduce(function (s, b) {
                    return s + (parseFloat(b.amount_in_base) || 0);
                }, 0);
            }
            renderBudget(activeTrip, budgetData);
            showToast('Расход удалён', 'success');
        })
        .catch(function (err) { showToast(err.message || 'Ошибка', 'error'); });
}

function initAddModal() {
    var modal   = qs('#addItemModal');
    var closeFn = function () { modal.style.display = 'none'; };

    qs('#addItemBtn').addEventListener('click', function () {
        qs('#itemName').value   = '';
        qs('#itemAmount').value = '';
        qs('#itemNote').value   = '';
        modal.style.display = 'flex';
        setTimeout(function () { qs('#itemName').focus(); }, 80);
    });

    qs('#addItemModalClose').addEventListener('click', closeFn);
    qs('#addItemModalCancel').addEventListener('click', closeFn);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeFn(); });

    qs('#addItemModalSave').addEventListener('click', function () {
        var title  = (qs('#itemName').value || '').trim();
        var amount = parseFloat(qs('#itemAmount').value) || 0;
        var note   = (qs('#itemNote').value || '').trim();

        if (!title)  { showToast('Введите название', 'error');  return; }
        if (!amount) { showToast('Введите сумму',    'error');  return; }
        if (!activeTrip) { showToast('Выберите поездку', 'error'); return; }

        var btn = qs('#addItemModalSave');
        btn.disabled    = true;
        btn.textContent = 'Сохраняем...';

        api.post('/budget', {
            trip_id:     activeTrip.id,
            title:       title,
            amount:      amount,
            currency_id: activeTrip.base_currency_id || 1,
            note:        note || null,
        })
        .then(function (res) {
            closeFn();
            return loadBudgetSilent(activeTrip);
        })
        .then(function () {
            showToast('Расход добавлен', 'success');
        })
        .catch(function (err) {
            showToast(err.message || 'Ошибка', 'error');
        })
        .finally(function () {
            btn.disabled    = false;
            btn.textContent = 'Сохранить';
        });
    });

    qs('#itemName').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') qs('#addItemModalSave').click();
    });
}

function loadBudgetSilent(trip) {
    return api.get('/budget?trip_id=' + trip.id)
        .then(function (data) {
            budgetData = data;
            renderBudget(trip, data);
        });
}

function fmt(n) {
    return Number(n || 0).toLocaleString('ru-RU', { maximumFractionDigits: 2 });
}

function declItems(n) {
    if (n % 100 >= 11 && n % 100 <= 19) return 'статей';
    var r = n % 10;
    if (r === 1) return 'статья';
    if (r >= 2 && r <= 4) return 'статьи';
    return 'статей';
}

function setText(id, val) {
    var el = qs('#' + id);
    if (el) el.textContent = val;
}

document.addEventListener('DOMContentLoaded', function () {
    initHeader();
    loadUser();
    initAddModal();
    initReceiptsModal();
    loadTrips();
});