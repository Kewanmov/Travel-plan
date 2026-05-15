'use strict';

function qs(sel)  { return document.querySelector(sel); }
function qsa(sel) { return Array.from(document.querySelectorAll(sel)); }

var tripId    = null;
var tripData  = null;
var tripTasks = [];
var tripLocations = [];
var tripMap   = null;
var dndSortables = [];

function initHeaderScroll() {
    var h = qs('#header');
    if (!h) return;
    window.addEventListener('scroll', function () {
        h.classList.toggle('scrolled', window.scrollY > 8);
    }, { passive: true });
}

function initBurger() {
    var burger = qs('#burger');
    var menu   = qs('#mobileMenu');
    if (!burger || !menu) return;
    burger.addEventListener('click', function () {
        var open = burger.classList.toggle('open');
        menu.classList.toggle('open', open);
    });
}

function initUserPill() {
    var pill = qs('#userPill');
    if (!pill) return;
    document.addEventListener('click', function (e) {
        if (pill.contains(e.target)) {
            pill.classList.toggle('open');
        } else {
            pill.classList.remove('open');
        }
    });
}

function initLogout() {
    qsa('#logoutBtn, #logoutMobile').forEach(function (btn) {
        btn.addEventListener('click', function () {
            localStorage.removeItem('access_token');
            localStorage.removeItem('user');
            window.location.replace('login.html');
        });
    });
}

function loadUserInfo() {
    var user   = window.currentUser || JSON.parse(localStorage.getItem('user') || '{}');
    var name   = user.name  || 'Пользователь';
    var email  = user.email || '';
    var letter = name.charAt(0).toUpperCase();

    var avatar = qs('#headerAvatar');
    if (avatar) avatar.textContent = letter;

    var els = { headerName: name, dropName: name, dropEmail: email };
    Object.keys(els).forEach(function (id) {
        var el = qs('#' + id);
        if (el) el.textContent = els[id];
    });
}

function setText(id, val) {
    var el = qs('#' + id);
    if (el) el.textContent = val;
}

function calcDays(start, end) {
    if (!start || !end) return 0;
    return Math.max(0, Math.round((new Date(end) - new Date(start)) / 86400000) + 1);
}

function declDays(n) {
    if (n % 100 >= 11 && n % 100 <= 19) return 'дней';
    var r = n % 10;
    if (r === 1) return 'день';
    if (r >= 2 && r <= 4) return 'дня';
    return 'дней';
}

function declPoints(n) {
    if (n % 100 >= 11 && n % 100 <= 19) return 'точек';
    var r = n % 10;
    if (r === 1) return 'точка';
    if (r >= 2 && r <= 4) return 'точки';
    return 'точек';
}

function declMembers(n) {
    if (n % 100 >= 11 && n % 100 <= 19) return 'участников';
    var r = n % 10;
    if (r === 1) return 'участник';
    if (r >= 2 && r <= 4) return 'участника';
    return 'участников';
}

var CURRENCY_SYMBOLS = { 1:'₽', 2:'$', 3:'€', 4:'₸', 5:'¥', 6:'₺', 7:'د.إ', 8:'฿' };

function getCurrencySymbol(currencyId, trip) {
    if (trip && trip.base_currency && trip.base_currency_id === currencyId) {
        return trip.base_currency.symbol || CURRENCY_SYMBOLS[currencyId] || '₽';
    }
    return CURRENCY_SYMBOLS[currencyId] || '₽';
}

function formatMoney(amount, currencyId, trip) {
    var sym = getCurrencySymbol(currencyId, trip);
    return sym + ' ' + Number(amount).toLocaleString('ru-RU');
}

var STATUS_MAP = {
    draft:     { label: 'Черновик',  cls: 'tp-badge--draft' },
    active:    { label: 'Активная',  cls: 'tp-badge--active' },
    completed: { label: 'Завершена', cls: 'tp-badge--completed' },
};

function renderTrip(trip, locations, tasks) {
    tripData      = trip;
    tripTasks     = tasks;
    tripLocations = locations;

    var days     = calcDays(trip.date_start, trip.date_end);
    var daysStr  = days > 0 ? days + ' ' + declDays(days) : '';
    var status   = STATUS_MAP[trip.status] || STATUS_MAP.draft;
    var location = [trip.city, trip.country].filter(Boolean).join(', ');
    var doneCnt  = tasks.filter(function (t) { return t.is_done; }).length;

    
    var heroBg = qs('#heroBg');
    if (heroBg && trip.cover_image) heroBg.style.backgroundImage = 'url(\'' + trip.cover_image + '\')';

    setText('heroTitle',        trip.title || 'Без названия');
    setText('heroLocationText', location   || 'Место не указано');
    setText('heroDatesText',
        formatDate(trip.date_start) + (trip.date_end ? ' — ' + formatDate(trip.date_end) : ''));

    var heroStatus = qs('#heroStatus');
    if (heroStatus) { heroStatus.textContent = status.label; heroStatus.className = 'tp-badge ' + status.cls; }

    var durEl = qs('#heroDuration');
    if (durEl) { durEl.textContent = daysStr; durEl.style.display = daysStr ? '' : 'none'; }

    var user = window.currentUser || JSON.parse(localStorage.getItem('user') || '{}');
    if (trip.role === 'owner' || trip.user_id === user.id) {
        var actEl = qs('#heroOwnerActions');
        if (actEl) actEl.style.display = '';
    }

    setText('statPoints',  locations.length.toString());
    setText('statMembers', trip.members_count || 1);
    setText('statTasks',   doneCnt + '/' + tasks.length);
    setText('statBudget',  trip.budget_limit
        ? formatMoney(trip.budget_limit, trip.base_currency_id, trip)
        : '—');

    setText('detailCity',     trip.city    || '—');
    setText('detailCountry',  trip.country || '—');
    setText('detailStart',    formatDate(trip.date_start));
    setText('detailEnd',      formatDate(trip.date_end));
    setText('detailDuration', daysStr || '—');

    var detailStatus = qs('#detailStatus');
    if (detailStatus) detailStatus.textContent = status.label;

    var descCard = qs('#descCard');
    var descEl   = qs('#tripDescText');
    if (descEl) {
        if (trip.description) {
            descEl.textContent = trip.description;
        } else {
            if (descCard) descCard.style.display = 'none';
        }
    }

    renderMap(locations);
    renderRoute(locations);
    renderBudget(trip);
    renderMembers(trip.members || []);
    renderTasks(tasks);

    loadStats(trip.id);
    loadComments(trip.id);

    if (window.attachments) {
        var canEdit = trip.role === 'owner' || trip.role === 'editor';
        window.attachments.mount({
            container: qs('#tripAttachments'),
            tripId:    trip.id,
            kind:      'photo',
            canEdit:   canEdit,
        });
    }

    qs('#tripSkeleton').style.display = 'none';
    qs('#tripContent').style.display  = '';

    document.title = (trip.title || 'Поездка') + ' — TravelPlan';
}

function customIcon(num) {
    return L.divIcon({
        className: '',
        html: '<div style="width:28px;height:28px;border-radius:50%;background:#01abfb;border:3px solid #fff;box-shadow:0 2px 8px rgba(1,171,251,.5);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;font-family:Inter,Arial">' + num + '</div>',
        iconSize:   [28, 28],
        iconAnchor: [14, 14],
    });
}

function sortByItinerary(locations) {
    return locations.slice().sort(function (a, b) {
        var da = locDay(a), db = locDay(b);
        if (da === 0 && db !== 0) return 1;
        if (db === 0 && da !== 0) return -1;
        if (da !== db) return da - db;
        return locOrder(a) - locOrder(b);
    });
}

function renderMap(locations) {
    locations = sortByItinerary(locations);
    if (!tripMap) {
        tripMap = L.map('tripMap', { zoomControl: true });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19,
        }).addTo(tripMap);
    }

    var sub = qs('#mapSubtitle');

    if (!locations || !locations.length) {
        tripMap.setView([55.7558, 37.6176], 5);
        if (sub) sub.textContent = 'Нет точек';
        return;
    }

    if (sub) sub.textContent = locations.length + ' ' + declPoints(locations.length);

    var bounds = [];
    locations.forEach(function (loc, i) {
        var lat = parseFloat(loc.lat);
        var lng = parseFloat(loc.lng);
        if (isNaN(lat) || isNaN(lng)) return;
        bounds.push([lat, lng]);
        var marker = L.marker([lat, lng], { icon: customIcon(i + 1) }).addTo(tripMap);
        marker.bindPopup('<strong>' + escHtml(loc.name || 'Точка ' + (i + 1)) + '</strong>' +
            (loc.note ? '<br><em>' + escHtml(loc.note) + '</em>' : ''));
    });

    if (bounds.length === 1) {
        tripMap.setView(bounds[0], 13);
    } else if (bounds.length > 1) {
        tripMap.fitBounds(bounds, { padding: [40, 40] });
        L.polyline(bounds, { color: '#01abfb', weight: 2.5, opacity: 0.6, dashArray: '6,6' }).addTo(tripMap);
    }
}

function getCanEdit() {
    return tripData && (tripData.role === 'owner' || tripData.role === 'editor');
}

function locDay(loc) {
    var it = (loc.itinerary && loc.itinerary[0]) || null;
    return it && it.day_number ? parseInt(it.day_number) : 0; // 0 = Не запланировано
}

function locOrder(loc) {
    var it = (loc.itinerary && loc.itinerary[0]) || null;
    return it && typeof it.order_index === 'number' ? it.order_index : 0;
}

function tripTotalDays() {
    if (!tripData || !tripData.date_start || !tripData.date_end) return 1;
    return Math.max(1, Math.round((new Date(tripData.date_end) - new Date(tripData.date_start)) / 86400000) + 1);
}

function groupByDay(locations) {
    var groups = {};
    locations.forEach(function (loc) {
        var d = locDay(loc);
        (groups[d] = groups[d] || []).push(loc);
    });
    Object.keys(groups).forEach(function (k) {
        groups[k].sort(function (a, b) { return locOrder(a) - locOrder(b); });
    });
    return groups;
}

function renderRoute(locations) {
    var list = qs('#routeList');
    if (!list) return;

    dndSortables.forEach(function (s) { try { s.destroy(); } catch (e) {} });
    dndSortables = [];

    if (!locations || !locations.length) {
        list.innerHTML = '<div class="tp-route__empty">Точки маршрута не добавлены</div>';
        return;
    }

    var canEdit = getCanEdit();
    var groups  = groupByDay(locations);
    var maxDay  = Math.max(tripTotalDays(), 1);
    Object.keys(groups).forEach(function (k) { if (+k > maxDay) maxDay = +k; });

    var html = '';
    if ((groups[0] || []).length) {
        html += renderDayBlock(0, groups[0]);
    }
    for (var d = 1; d <= maxDay; d++) {
        html += renderDayBlock(d, groups[d] || []);
    }
    if (canEdit) {
        html += '<button class="tp-day-add" id="dndAddDay">' +
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none">' +
            '<line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>' +
            '<line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>' +
            '</svg> Добавить день</button>';
    }

    list.innerHTML = html;

    if (canEdit && window.Sortable) initSortable();

    var add = qs('#dndAddDay');
    if (add) add.addEventListener('click', function () {
        var nextDay = maxDay + 1;
        var ph = document.createElement('div');
        ph.innerHTML = renderDayBlock(nextDay, []);
        list.insertBefore(ph.firstChild, add);
        if (window.Sortable) initSortable();
    });
}

function renderDayBlock(day, items) {
    var canEdit = getCanEdit();
    var label = day === 0 ? 'Не запланировано' : ('День ' + day);
    var dateStr = '';
    if (day > 0 && tripData && tripData.date_start) {
        var d = new Date(tripData.date_start);
        d.setDate(d.getDate() + day - 1);
        dateStr = ' · ' + d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    }

    var itemsHtml = items.map(function (loc, i) {
        return renderDndItem(loc, i + 1);
    }).join('');

    return '<div class="tp-day-block">' +
        '<div class="tp-day-block__head">' +
            '<span>' + escHtml(label) + escHtml(dateStr) + '</span>' +
            '<span class="tp-day-block__count">' + items.length + '</span>' +
        '</div>' +
        '<div class="tp-day-list" data-day="' + day + '"' + (canEdit ? '' : ' data-readonly="1"') + '>' +
            itemsHtml +
        '</div>' +
    '</div>';
}

function renderDndItem(loc, num) {
    return '<div class="tp-dnd-item" data-loc-id="' + loc.id + '">' +
        '<span class="tp-dnd-handle">' +
            '<svg width="12" height="16" viewBox="0 0 12 16" fill="none">' +
            '<circle cx="3" cy="3" r="1.5" fill="currentColor"/>' +
            '<circle cx="9" cy="3" r="1.5" fill="currentColor"/>' +
            '<circle cx="3" cy="8" r="1.5" fill="currentColor"/>' +
            '<circle cx="9" cy="8" r="1.5" fill="currentColor"/>' +
            '<circle cx="3" cy="13" r="1.5" fill="currentColor"/>' +
            '<circle cx="9" cy="13" r="1.5" fill="currentColor"/>' +
            '</svg>' +
        '</span>' +
        '<span class="tp-dnd-num">' + num + '</span>' +
        '<div class="tp-dnd-body">' +
            '<div class="tp-dnd-name">' + escHtml(loc.name || 'Без названия') + '</div>' +
            (loc.note ? '<div class="tp-dnd-note">' + escHtml(loc.note) + '</div>' : '') +
        '</div>' +
    '</div>';
}

function initSortable() {
    dndSortables.forEach(function (s) { try { s.destroy(); } catch (e) {} });
    dndSortables = [];

    qsa('.tp-day-list').forEach(function (el) {
        if (el.dataset.readonly) return;
        var s = Sortable.create(el, {
            group: 'trip-route',
            animation: 150,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            onEnd: onDndEnd,
        });
        dndSortables.push(s);
    });
}

var dndSaveTimer = null;
function onDndEnd() {
    qsa('.tp-day-list').forEach(function (list) {
        var n = 1;
        list.querySelectorAll('.tp-dnd-item').forEach(function (it) {
            var num = it.querySelector('.tp-dnd-num');
            if (num) num.textContent = n++;
        });
    });
    if (dndSaveTimer) clearTimeout(dndSaveTimer);
    dndSaveTimer = setTimeout(saveDndOrder, 350);
}

function saveDndOrder() {
    var items = [];
    qsa('.tp-day-list').forEach(function (list) {
        var day = parseInt(list.dataset.day) || 0;
        if (day < 1) return;
        list.querySelectorAll('.tp-dnd-item').forEach(function (it, i) {
            items.push({
                location_id: parseInt(it.dataset.locId),
                day_number:  day,
                order_index: i,
            });
        });
    });

    api.patch('/locations/itinerary/reorder', { trip_id: tripId, items: items })
        .then(function () {
            items.forEach(function (it) {
                var loc = tripLocations.find(function (l) { return l.id === it.location_id; });
                if (!loc) return;
                if (!loc.itinerary || !loc.itinerary.length) loc.itinerary = [{}];
                loc.itinerary[0].day_number  = it.day_number;
                loc.itinerary[0].order_index = it.order_index;
            });
            renderMap(tripLocations);
            loadStats(tripId);
        })
        .catch(function (err) {
            if (window.showToast) showToast(err.message || 'Не удалось сохранить порядок', 'error');
        });
}

function renderBudget(trip) {
    var container = qs('#budgetContent');
    var subEl     = qs('#budgetSubtitle');
    if (!container) return;

    var hasBudget = trip.budget_limit && trip.budget_limit > 0;

    if (!hasBudget) {
        container.innerHTML = '<div class="tp-budget-empty">Бюджет не указан</div>';
        if (subEl) subEl.textContent = 'Не установлен';
        return;
    }

    if (subEl) subEl.textContent = 'Лимит: ' + formatMoney(trip.budget_limit, trip.base_currency_id, trip);

    container.innerHTML = '<div class="tp-budget-total">' +
        '<span class="tp-budget-total__label">Общий бюджет</span>' +
        '<span class="tp-budget-total__amount">' + formatMoney(trip.budget_limit, trip.base_currency_id, trip) + '</span>' +
        '</div>';
}

function renderMembers(members) {
    var list  = qs('#membersList');
    var subEl = qs('#membersSubtitle');
    if (!list) return;

    var user   = window.currentUser || JSON.parse(localStorage.getItem('user') || '{}');
    var name   = user.name || 'Вы';
    var letter = name.charAt(0).toUpperCase();

    var guests = members.filter(function (m) { return m.role !== 'owner'; });
    var total  = 1 + guests.length;

    if (subEl) subEl.textContent = total + ' ' + declMembers(total);

    var html = '<div class="tp-member tp-member--owner">' +
        '<div class="tp-member__avatar">' + escHtml(letter) + '</div>' +
        '<div class="tp-member__info">' +
        '<div class="tp-member__name">' + escHtml(name) + '</div>' +
        '<div class="tp-member__role">Владелец</div>' +
        '</div></div>';

    guests.forEach(function (m) {
        var l = (m.name || m.email || '?').charAt(0).toUpperCase();
        html += '<div class="tp-member">' +
            '<div class="tp-member__avatar tp-member__avatar--purple">' + escHtml(l) + '</div>' +
            '<div class="tp-member__info">' +
            '<div class="tp-member__name">' + escHtml(m.name || m.email || '—') + '</div>' +
            '<div class="tp-member__role">Участник</div>' +
            '</div></div>';
    });

    list.innerHTML = html;
}

function renderTasks(tasks) {
    var list     = qs('#tasksList');
    var subEl    = qs('#tasksSubtitle');
    var progWrap = qs('#tasksProgress');
    var progFill = qs('#tasksProgressFill');
    if (!list) return;

    if (!tasks || !tasks.length) {
        list.innerHTML = '<div class="tp-tasks__empty">Задачи не добавлены</div>';
        if (subEl)    subEl.textContent    = 'Нет задач';
        if (progWrap) progWrap.style.display = 'none';
        return;
    }

    var done = tasks.filter(function (t) { return t.is_done; }).length;
    var pct  = Math.round(done / tasks.length * 100);

    if (subEl)    subEl.textContent  = done + ' из ' + tasks.length + ' выполнено';
    if (progWrap) progWrap.style.display = '';
    if (progFill) progFill.style.width   = pct + '%';

    list.innerHTML = tasks.map(function (task) {
        var doneCls = task.is_done ? ' tp-task--done' : '';
        return '<div class="tp-task' + doneCls + '" data-task-id="' + task.id + '">' +
            '<div class="tp-task__check">' +
            (task.is_done
                ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
                : '') +
            '</div>' +
            '<span class="tp-task__text">' + escHtml(task.title) + '</span>' +
            '</div>';
    }).join('');

    list.querySelectorAll('.tp-task').forEach(function (el) {
        el.addEventListener('click', function () {
            var id   = parseInt(el.dataset.taskId);
            var task = tripTasks.find(function (t) { return t.id === id; });
            if (!task) return;

            task.is_done = !task.is_done;
            api.put('/tasks/' + id, { is_done: task.is_done }).catch(function () {});
            renderTasks(tripTasks);
        });
    });
}

function initDeleteBtn() {
    var btn     = qs('#deleteTripBtn');
    var modal   = qs('#deleteModal');
    var cancel  = qs('#deleteModalCancel');
    var close   = qs('#deleteModalClose');
    var confirm = qs('#deleteModalConfirm');
    if (!btn || !modal) return;

    var openModal  = function () { modal.style.display = 'flex'; };
    var closeModal = function () { modal.style.display = 'none'; };

    btn.addEventListener('click', openModal);
    cancel.addEventListener('click', closeModal);
    close.addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });

    confirm.addEventListener('click', function () {
        confirm.disabled    = true;
        confirm.textContent = 'Удаляем...';

        api.delete('/trips/' + tripId)
            .then(function () {
                showToast('Поездка удалена', 'success');
                setTimeout(function () { window.location.href = 'dashboard.html'; }, 700);
            })
            .catch(function (err) {
                showToast(err.message || 'Ошибка удаления', 'error');
                confirm.disabled    = false;
                confirm.textContent = 'Удалить';
                closeModal();
            });
    });
}

var commentsCache = [];

function commentTimeAgo(s) {
    if (!s) return '';
    try {
        var d = new Date(s.replace(' ', 'T') + 'Z');
        var diffMin = Math.round((Date.now() - d.getTime()) / 60000);
        if (diffMin < 1)    return 'только что';
        if (diffMin < 60)   return diffMin + ' мин назад';
        if (diffMin < 1440) return Math.round(diffMin / 60) + ' ч назад';
        return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
}

function currentUserId() {
    var u = window.currentUser || JSON.parse(localStorage.getItem('user') || '{}');
    return parseInt(u.id) || 0;
}

function loadComments(id) {
    api.get('/comments?trip_id=' + id)
        .then(function (list) {
            commentsCache = Array.isArray(list) ? list : [];
            renderComments();
        })
        .catch(function () { renderComments(); });
}

function renderComments() {
    var list = qs('#commentsList');
    var sub  = qs('#commentsSub');
    if (!list) return;

    if (sub) {
        sub.textContent = commentsCache.length
            ? (commentsCache.length + ' ' + (commentsCache.length === 1 ? 'сообщение' : 'сообщений'))
            : 'Сообщений пока нет';
    }

    if (!commentsCache.length) {
        list.innerHTML = '<div class="tp-comments__empty">Будь первым — напиши участникам!</div>';
        return;
    }

    var me = currentUserId();
    list.innerHTML = commentsCache.map(function (c) {
        var mine = c.user_id === me;
        var letter = (c.user_name || '?').charAt(0).toUpperCase();
        var canDelete = mine || (tripData && tripData.role === 'owner');
        var actions = '';
        if (mine) {
            actions += '<button class="tp-comment__btn" data-act="edit" data-id="' + c.id + '">Изменить</button>';
        }
        if (canDelete) {
            actions += '<button class="tp-comment__btn tp-comment__btn--danger" data-act="del" data-id="' + c.id + '">Удалить</button>';
        }

        return '<div class="tp-comment' + (mine ? ' tp-comment--mine' : '') + '" data-id="' + c.id + '">' +
            '<div class="tp-comment__av">' + escHtml(letter) + '</div>' +
            '<div class="tp-comment__body">' +
                '<div class="tp-comment__head">' +
                    '<span class="tp-comment__name">' + escHtml(c.user_name || '—') +
                        (c.is_edited ? '<span class="tp-comment__edited"> (изменено)</span>' : '') +
                    '</span>' +
                    '<span class="tp-comment__time">' + commentTimeAgo(c.created_at) + '</span>' +
                '</div>' +
                '<div class="tp-comment__text" data-text>' + escHtml(c.content) + '</div>' +
                (actions ? '<div class="tp-comment__actions">' + actions + '</div>' : '') +
            '</div>' +
        '</div>';
    }).join('');

    list.scrollTop = list.scrollHeight;
}

function initComments() {
    var btn   = qs('#commentSend');
    var input = qs('#commentInput');
    var list  = qs('#commentsList');
    if (!btn || !input || !list) return;

    btn.addEventListener('click', function () {
        var txt = input.value.trim();
        if (!txt) return;
        btn.disabled = true;
        api.post('/comments', { trip_id: tripId, content: txt })
            .then(function (c) {
                input.value = '';
                commentsCache.push(c);
                renderComments();
            })
            .catch(function (err) { showToast(err.message || 'Не отправлено', 'error'); })
            .finally(function () { btn.disabled = false; });
    });

    input.addEventListener('keydown', function (e) {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); btn.click(); }
    });

    list.addEventListener('click', function (e) {
        var target = e.target.closest('[data-act]');
        if (!target) return;
        var id = parseInt(target.dataset.id);
        var c  = commentsCache.find(function (x) { return x.id === id; });
        if (!c) return;

        if (target.dataset.act === 'del') {
            if (!confirm('Удалить комментарий?')) return;
            api.delete('/comments/' + id)
                .then(function () {
                    commentsCache = commentsCache.filter(function (x) { return x.id !== id; });
                    renderComments();
                })
                .catch(function (err) { showToast(err.message || 'Ошибка', 'error'); });
        }

        if (target.dataset.act === 'edit') {
            var node    = target.closest('.tp-comment');
            var textBox = node.querySelector('[data-text]');
            var actions = node.querySelector('.tp-comment__actions');
            var orig    = c.content;
            textBox.innerHTML = '<textarea class="tp-comment__edit-input">' + escHtml(orig) + '</textarea>';
            actions.innerHTML =
                '<button class="tp-comment__btn tp-comment__btn--save" data-act="save" data-id="' + id + '">Сохранить</button>' +
                '<button class="tp-comment__btn" data-act="cancel" data-id="' + id + '">Отмена</button>';
            textBox.querySelector('textarea').focus();
        }

        if (target.dataset.act === 'cancel') {
            renderComments();
        }

        if (target.dataset.act === 'save') {
            var node2 = target.closest('.tp-comment');
            var ta    = node2.querySelector('textarea.tp-comment__edit-input');
            var newTxt = ta ? ta.value.trim() : '';
            if (!newTxt) return;
            api.put('/comments/' + id, { content: newTxt })
                .then(function (upd) {
                    var i = commentsCache.findIndex(function (x) { return x.id === id; });
                    if (i >= 0) commentsCache[i] = upd;
                    renderComments();
                })
                .catch(function (err) { showToast(err.message || 'Ошибка', 'error'); });
        }
    });
}

var statsCharts = { cat: null, day: null };

function loadStats(id) {
    if (!window.Chart) return;
    api.get('/trips/' + id + '/stats').then(renderStats).catch(function () {});
}

function renderStats(s) {
    var card = qs('#statsCard');
    if (!card || !s) return;
    card.style.display = '';

    var sym = (s.currency && s.currency.symbol) || '₽';
    var fmt = function (v) { return Number(v || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 }); };
    var bRow = qs('#statsBudgetRow');
    if (s.budget_limit && s.budget_limit > 0) {
        bRow.style.display = '';
        var pct = Math.min(100, Math.round(s.total_spent / s.budget_limit * 100));
        var fill = qs('#statsBudgetFill');
        fill.style.width = pct + '%';
        fill.classList.toggle('stats-prog-bar__fill--over', s.total_spent > s.budget_limit);
        qs('#statsSpent').textContent = fmt(s.total_spent) + ' ' + sym;
        qs('#statsLimit').textContent = fmt(s.budget_limit) + ' ' + sym;
        var paidEl = qs('#statsPaidNote');
        if (paidEl && s.total_paid > 0) {
            paidEl.textContent = 'Оплачено: ' + fmt(s.total_paid) + ' ' + sym + ' из ' + fmt(s.total_spent) + ' ' + sym;
            paidEl.style.display = '';
        }
    }
    var tt = (s.tasks && s.tasks.total) || 0;
    var td = (s.tasks && s.tasks.done)  || 0;
    qs('#statsTasksDone').textContent  = td;
    qs('#statsTasksTotal').textContent = tt;
    qs('#statsTasksFill').style.width  = tt ? Math.round(td / tt * 100) + '%' : '0%';

    var hasCat = (s.by_category || []).some(function (c) { return c.total > 0; });
    var hasDay = (s.by_day || []).length > 0;
    qs('#statsEmpty').style.display = (hasCat || hasDay) ? 'none' : '';
    if (statsCharts.cat) { statsCharts.cat.destroy(); statsCharts.cat = null; }
    if (hasCat) {
        var labels = s.by_category.map(function (c) { return c.name; });
        var data   = s.by_category.map(function (c) { return c.total; });
        var colors = s.by_category.map(function (c) { return c.color || '#94a3b8'; });
        statsCharts.cat = new Chart(qs('#statsCatChart'), {
            type: 'doughnut',
            data: { labels: labels, datasets: [{ data: data, backgroundColor: colors, borderWidth: 0 }] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '62%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                return ctx.label + ': ' + fmt(ctx.parsed) + ' ' + sym;
                            }
                        }
                    }
                }
            }
        });
        var list = qs('#statsCatList');
        list.innerHTML = s.by_category.map(function (c) {
            return '<div class="stats-cat-item">' +
                '<span class="dot" style="background:' + escHtml(c.color || '#94a3b8') + '"></span>' +
                '<span class="name">' + escHtml(c.name) + '</span>' +
                '<span class="val">' + fmt(c.total) + ' ' + sym + '</span>' +
            '</div>';
        }).join('');
    } else {
        qs('#statsCatList').innerHTML = '';
    }
    if (statsCharts.day) { statsCharts.day.destroy(); statsCharts.day = null; }
    if (hasDay) {
        var dlabels = s.by_day.map(function (d) {
            try { return new Date(d.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }); }
            catch (e) { return d.date; }
        });
        var ddata = s.by_day.map(function (d) { return d.total; });
        statsCharts.day = new Chart(qs('#statsDayChart'), {
            type: 'bar',
            data: {
                labels: dlabels,
                datasets: [{
                    label: 'Расходы',
                    data: ddata,
                    backgroundColor: 'rgba(1,171,251,.7)',
                    borderRadius: 6,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) { return fmt(ctx.parsed.y) + ' ' + sym; }
                        }
                    }
                },
                scales: {
                    y: { beginAtZero: true, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,.05)' } },
                    x: { ticks: { color: '#94a3b8' }, grid: { display: false } }
                }
            }
        });
    }
}


function buildPublicUrl(id) {
    return location.origin + location.pathname.replace(/[^/]*$/, '') + 'public-trip.html?id=' + id;
}

function initShareBtn() {
    var btn        = qs('#shareTripBtn');
    var modal      = qs('#shareModal');
    var closeBtn   = qs('#shareModalClose');
    var cancelBtn  = qs('#shareModalCancel');
    var toggle     = qs('#sharePublicToggle');
    var linkWrap   = qs('#shareLinkWrap');
    var linkInput  = qs('#shareLinkInput');
    var copyBtn    = qs('#shareCopyBtn');
    if (!btn || !modal) return;

    var openModal  = function () {
        var isPub = !!(tripData && tripData.is_public);
        toggle.checked = isPub;
        linkWrap.style.display = isPub ? '' : 'none';
        linkInput.value = buildPublicUrl(tripId);
        modal.style.display = 'flex';
    };
    var closeModal = function () { modal.style.display = 'none'; };

    btn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });

    toggle.addEventListener('change', function () {
        var nextVal = toggle.checked;
        toggle.disabled = true;
        api.patch('/trips/' + tripId + '/visibility', { is_public: nextVal })
            .then(function (res) {
                tripData.is_public = !!(res && res.is_public);
                linkWrap.style.display = tripData.is_public ? '' : 'none';
                showToast(tripData.is_public ? 'Поездка теперь публичная' : 'Поездка скрыта', 'success');
            })
            .catch(function (err) {
                toggle.checked = !nextVal;
                showToast(err.message || 'Не удалось обновить', 'error');
            })
            .finally(function () { toggle.disabled = false; });
    });

    copyBtn.addEventListener('click', function () {
        var url = linkInput.value;
        var done = function () {
            copyBtn.textContent = 'Скопировано';
            setTimeout(function () { copyBtn.textContent = 'Копировать'; }, 1500);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(done).catch(function () {
                linkInput.select(); document.execCommand('copy'); done();
            });
        } else {
            linkInput.select(); document.execCommand('copy'); done();
        }
    });
}

function initEditBtn() {
    var btn = qs('#editTripBtn');
    if (!btn) return;
    btn.addEventListener('click', function () {
        window.location.href = 'trip-create.html?edit=' + tripId;
    });
}

function showError() {
    qs('#tripSkeleton').style.display = 'none';
    qs('#tripContent').style.display  = 'none';
    qs('#tripError').style.display    = 'flex';
}

function loadTrip() {
    var params = new URLSearchParams(window.location.search);
    tripId = params.get('id');

    if (!tripId) { showError(); return; }

    Promise.all([
        api.get('/trips/' + tripId),
        api.get('/locations?trip_id=' + tripId),
        api.get('/tasks?trip_id='     + tripId),
    ])
    .then(function (results) {
        var trip      = results[0];
        var locations = Array.isArray(results[1]) ? results[1] : [];
        var tasks     = Array.isArray(results[2]) ? results[2] : [];
        renderTrip(trip, locations, tasks);
    })
    .catch(function () {
        showError();
    });
}

document.addEventListener('DOMContentLoaded', function () {
    initHeaderScroll();
    initBurger();
    initUserPill();
    initLogout();
    loadUserInfo();
    initEditBtn();
    initShareBtn();
    initDeleteBtn();
    initComments();
    loadTrip();
});