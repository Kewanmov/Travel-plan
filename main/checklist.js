'use strict';

function qs(sel)  { return document.querySelector(sel); }
function qsa(sel) { return Array.from(document.querySelectorAll(sel)); }

var allTrips      = [];
var tasksByTrip   = {};
var activeTrip    = 'all';
var viewMode      = 'all';

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

function loadData() {
    api.get('/trips')
        .then(function (res) {
            allTrips = Array.isArray(res) ? res : [];
            buildFilters();
            buildQuickSelect();
            qs('#clSkeleton').style.display = 'none';
            qs('#clContent').style.display  = '';
            loadAllTasksAndRender();
        })
        .catch(function (err) {
            showToast(err.message || 'Ошибка загрузки', 'error');
            qs('#clSkeleton').style.display = 'none';
            qs('#clContent').style.display  = '';
        });
}

function loadAllTasksAndRender() {
    if (!allTrips.length) {
        render();
        return;
    }
    var promises = allTrips.map(function (t) {
        return api.get('/tasks?trip_id=' + t.id)
            .then(function (data) {
                tasksByTrip[t.id] = Array.isArray(data) ? data : [];
            })
            .catch(function () {
                tasksByTrip[t.id] = [];
            });
    });
    Promise.all(promises).then(function () { render(); });
}

function loadTripTasksAndRender(tripId) {
    api.get('/tasks?trip_id=' + tripId)
        .then(function (data) {
            tasksByTrip[tripId] = Array.isArray(data) ? data : [];
            render();
        })
        .catch(function (err) {
            showToast(err.message || 'Ошибка загрузки задач', 'error');
        });
}

function buildFilters() {
    var wrap = qs('#tripFilter');
    wrap.innerHTML = '<button class="cl-filter__btn cl-filter__btn--active" data-trip="all">Все поездки</button>';
    allTrips.forEach(function (t) {
        var btn = document.createElement('button');
        btn.className   = 'cl-filter__btn';
        btn.dataset.trip = t.id;
        btn.textContent  = t.title || 'Без названия';
        wrap.appendChild(btn);
    });

    wrap.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-trip]');
        if (!btn) return;
        activeTrip = btn.dataset.trip;
        qsa('.cl-filter__btn').forEach(function (b) {
            b.classList.toggle('cl-filter__btn--active', b.dataset.trip == activeTrip);
        });
        if (activeTrip !== 'all' && !tasksByTrip[activeTrip]) {
            loadTripTasksAndRender(activeTrip);
        } else {
            render();
        }
    });
}

function buildQuickSelect() {
    var sel = qs('#quickTaskTrip');
    sel.innerHTML = '<option value="">Выбери поездку</option>';
    allTrips.forEach(function (t) {
        var o = document.createElement('option');
        o.value       = t.id;
        o.textContent = t.title || 'Без названия';
        sel.appendChild(o);
    });
}

function initViewToggle() {
    qsa('.cl-view-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            viewMode = btn.dataset.view;
            qsa('.cl-view-btn').forEach(function (b) {
                b.classList.toggle('cl-view-btn--active', b.dataset.view === viewMode);
            });
            render();
        });
    });
}

function initQuickAdd() {
    function doAdd() {
        var input   = qs('#quickTaskInput');
        var tripSel = qs('#quickTaskTrip');
        var title   = (input.value || '').trim();
        var tripId  = tripSel.value;

        if (!title)  { showToast('Введите текст задачи', 'error'); return; }
        if (!tripId) { showToast('Выберите поездку',     'error'); return; }

        var btn = qs('#quickAddBtn');
        btn.disabled = true;

        api.post('/tasks', { trip_id: parseInt(tripId, 10), title: title })
            .then(function (task) {
                if (!tasksByTrip[tripId]) tasksByTrip[tripId] = [];
                tasksByTrip[tripId].push(task);
                input.value = '';
                render();
                showToast('Задача добавлена', 'success');
            })
            .catch(function (err) { showToast(err.message || 'Ошибка', 'error'); })
            .finally(function () { btn.disabled = false; });
    }

    qs('#quickAddBtn').addEventListener('click', doAdd);
    qs('#quickTaskInput').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') doAdd();
    });
}

function render() {
    var trips = activeTrip === 'all'
        ? allTrips
        : allTrips.filter(function (t) { return t.id == activeTrip; });

    
    var total = 0, done = 0;
    allTrips.forEach(function (t) {
        (tasksByTrip[t.id] || []).forEach(function (task) {
            total++;
            if (task.is_done) done++;
        });
    });
    var left = total - done;
    var pct  = total ? Math.round(done / total * 100) : 0;

    setText('sumTotal', total);
    setText('sumDone',  done);
    setText('sumLeft',  left);
    setText('sumPct',   pct + '%');
    var bar = qs('#sumBar');
    if (bar) bar.style.width = pct + '%';

    
    var groups = qs('#clGroups');
    var empty  = qs('#clEmpty');
    groups.innerHTML = '';

    var hasAny = false;

    trips.forEach(function (trip) {
        var allTasks = tasksByTrip[trip.id] || [];
        var filtered = allTasks.filter(function (t) {
            if (viewMode === 'active') return !t.is_done;
            if (viewMode === 'done')   return  t.is_done;
            return true;
        });

        if (!allTasks.length && viewMode !== 'all') return;

        hasAny = true;
        groups.appendChild(buildGroup(trip, allTasks, filtered));
    });

    empty.style.display = hasAny ? 'none' : '';
}

function buildGroup(trip, allTasks, filtered) {
    var doneCount = allTasks.filter(function (t) { return t.is_done; }).length;
    var pct       = allTasks.length ? Math.round(doneCount / allTasks.length * 100) : 0;

    var wrap = document.createElement('div');
    wrap.className = 'cl-group';
    wrap.innerHTML =
        '<div class="cl-group__head">' +
            '<div class="cl-group__left">' +
                '<div class="cl-group__icon">' +
                    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none">' +
                    '<path d="M9 11l3 3L22 4" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
                    '<path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>' +
                    '</svg>' +
                '</div>' +
                '<div class="cl-group__info">' +
                    '<div class="cl-group__title">' + escHtml(trip.title || 'Без названия') + '</div>' +
                    '<div class="cl-group__sub">' + doneCount + ' из ' + allTasks.length + ' выполнено</div>' +
                '</div>' +
            '</div>' +
            '<div class="cl-group__right">' +
                '<div class="cl-group__bar-wrap">' +
                    '<div class="cl-group__bar"><div class="cl-group__bar-fill" style="width:' + pct + '%"></div></div>' +
                    '<span class="cl-group__bar-pct">' + pct + '%</span>' +
                '</div>' +
                '<a href="trip.html?id=' + trip.id + '" class="cl-group__link">Открыть</a>' +
            '</div>' +
        '</div>' +
        '<div class="cl-group__body"></div>';

    var body = wrap.querySelector('.cl-group__body');
    if (!filtered.length) {
        body.innerHTML = '<div style="text-align:center;padding:20px;font-size:13px;color:var(--text-3)">' +
            (allTasks.length ? 'Нет задач в этом фильтре' : 'Нет задач') + '</div>';
    } else {
        filtered.forEach(function (task) {
            body.appendChild(buildTask(task, trip.id));
        });
    }

    return wrap;
}

function buildTask(task, tripId) {
    var el = document.createElement('div');
    el.className = 'cl-task' + (task.is_done ? ' cl-task--done' : '');
    el.innerHTML =
        '<div class="cl-task__check">' +
            (task.is_done
                ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
                : '') +
        '</div>' +
        '<span class="cl-task__text">' + escHtml(task.title || '') + '</span>' +
        '<button class="cl-task__del" title="Удалить">' +
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none">' +
            '<line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
            '<line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
            '</svg>' +
        '</button>';

    el.addEventListener('click', function (e) {
        if (e.target.closest('.cl-task__del')) return;
        task.is_done = !task.is_done;
        render();
        api.put('/tasks/' + task.id, { is_done: task.is_done })
            .catch(function (err) {
                task.is_done = !task.is_done;
                render();
                showToast(err.message || 'Ошибка сохранения', 'error');
            });
    });

    el.querySelector('.cl-task__del').addEventListener('click', function (e) {
        e.stopPropagation();
        api.delete('/tasks/' + task.id)
            .then(function () {
                tasksByTrip[tripId] = (tasksByTrip[tripId] || []).filter(function (t) { return t.id !== task.id; });
                render();
                showToast('Задача удалена', 'success');
            })
            .catch(function (err) { showToast(err.message || 'Ошибка', 'error'); });
    });

    return el;
}

function setText(id, val) {
    var el = qs('#' + id);
    if (el) el.textContent = val;
}

document.addEventListener('DOMContentLoaded', function () {
    initHeader();
    loadUser();
    initViewToggle();
    initQuickAdd();
    loadData();
});