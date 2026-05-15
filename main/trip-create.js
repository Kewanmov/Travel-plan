'use strict';

function qs(sel)  { return document.querySelector(sel); }
function qsa(sel) { return Array.from(document.querySelectorAll(sel)); }

var currentStep   = 1;
var map           = null;
var mapPoints     = [];
var mapMarkers    = [];
var pendingLatLng = null;
var members       = [];
var tasks         = [];
var editId        = null;

function initHeaderScroll() {
    var header = qs('#header');
    if (!header) return;
    window.addEventListener('scroll', function () {
        header.classList.toggle('scrolled', window.scrollY > 8);
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

    var ownerAvatar = qs('#ownerAvatar');
    var ownerName   = qs('#ownerName');
    if (ownerAvatar) ownerAvatar.textContent = letter;
    if (ownerName)   ownerName.textContent   = name;
}

function goToStep(step) {
    currentStep = step;

    qsa('.tc-section').forEach(function (s) { s.classList.remove('tc-section--active'); });
    var sec = qs('#section-' + step);
    if (sec) sec.classList.add('tc-section--active');

    qsa('.tc-progress__step').forEach(function (el) {
        var n = parseInt(el.dataset.step);
        el.classList.remove('tc-progress__step--active', 'tc-progress__step--done');
        if (n === step) el.classList.add('tc-progress__step--active');
        if (n < step)  el.classList.add('tc-progress__step--done');
    });

    qsa('.tc-progress__line').forEach(function (el, i) {
        el.classList.toggle('tc-progress__line--done', i < step - 1);
    });

    if (step === 2 && !map) setTimeout(initMap, 100);

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function validateStep1() {
    var title     = (qs('#tripTitle')     || {}).value || '';
    var city      = (qs('#tripCity')      || {}).value || '';
    var dateStart = (qs('#tripDateStart') || {}).value || '';
    var dateEnd   = (qs('#tripDateEnd')   || {}).value || '';
    var valid     = true;

    clearErrors();

    if (!title.trim()) { showFieldError('titleError',     'Введите название поездки'); valid = false; }
    if (!city.trim())  { showFieldError('cityError',      'Введите город');             valid = false; }
    if (!dateStart)    { showFieldError('dateStartError', 'Укажите дату начала');       valid = false; }
    if (!dateEnd)      { showFieldError('dateEndError',   'Укажите дату конца');        valid = false; }
    if (dateStart && dateEnd && dateStart > dateEnd) {
        showFieldError('dateEndError', 'Дата конца раньше даты начала');
        valid = false;
    }

    return valid;
}

function showFieldError(id, msg) {
    var el = qs('#' + id);
    if (!el) return;
    el.textContent = msg;
    el.classList.add('visible');
}

function clearErrors() {
    qsa('.tc-form__error').forEach(function (el) {
        el.textContent = '';
        el.classList.remove('visible');
    });
}

function initStepNav() {
    qs('#next1').addEventListener('click', function () {
        if (validateStep1()) goToStep(2);
    });
    qs('#next2').addEventListener('click', function () { goToStep(3); });
    qs('#next3').addEventListener('click', function () { goToStep(4); });
    qs('#next4').addEventListener('click', function () { goToStep(5); });

    document.addEventListener('click', function (e) {
        var prevBtn = e.target.closest('[data-prev]');
        if (prevBtn) goToStep(parseInt(prevBtn.dataset.prev));
    });

    qsa('.tc-progress__step').forEach(function (step) {
        step.addEventListener('click', function () {
            var n = parseInt(step.dataset.step);
            if (n < currentStep) goToStep(n);
        });
    });
}

function initMap() {
    if (map) return;

    map = L.map('map').setView([55.7558, 37.6176], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
    }).addTo(map);

    map.on('click', function (e) {
        pendingLatLng = e.latlng;
        openPointModal();
    });
}

function customIcon(num) {
    return L.divIcon({
        className: '',
        html: '<div style="width:28px;height:28px;border-radius:50%;background:#01abfb;border:3px solid #fff;box-shadow:0 2px 8px rgba(1,171,251,.5);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;font-family:Inter,Arial">' + num + '</div>',
        iconSize:   [28, 28],
        iconAnchor: [14, 14],
    });
}

function openPointModal() {
    var modal = qs('#pointModal');
    if (modal) modal.style.display = 'flex';
    qs('#pointName').value = '';
    qs('#pointNote').value = '';
    setTimeout(function () { qs('#pointName').focus(); }, 100);
}

function closePointModal() {
    var modal = qs('#pointModal');
    if (modal) modal.style.display = 'none';
    pendingLatLng = null;
}

function initPointModal() {
    qs('#pointModalClose').addEventListener('click', closePointModal);
    qs('#pointModalCancel').addEventListener('click', closePointModal);
    qs('#pointModal').addEventListener('click', function (e) {
        if (e.target === qs('#pointModal')) closePointModal();
    });

    qs('#pointModalSave').addEventListener('click', savePoint);
    qs('#pointName').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') savePoint();
    });
}

function savePoint() {
    var name = (qs('#pointName').value || '').trim();
    if (!name) {
        qs('#pointName').focus();
        showToast('Введите название места', 'error');
        return;
    }

    var point = {
        id:   Date.now(),
        name: name,
        lat:  pendingLatLng ? pendingLatLng.lat : 0,
        lng:  pendingLatLng ? pendingLatLng.lng : 0,
        note: (qs('#pointNote').value || '').trim(),
    };

    mapPoints.push(point);

    if (pendingLatLng) {
        var marker = L.marker([point.lat, point.lng], { icon: customIcon(mapPoints.length) }).addTo(map);
        marker.bindPopup('<strong>' + escHtml(point.name) + '</strong>');
        mapMarkers.push({ id: point.id, marker: marker });
    }

    renderPoints();
    closePointModal();
    showToast('Точка добавлена', 'success');
}

function renderPoints() {
    var list  = qs('#pointsList');
    var count = qs('#pointsCount');
    if (!list) return;

    if (count) count.textContent = mapPoints.length + ' ' + declPoints(mapPoints.length);

    if (!mapPoints.length) {
        list.innerHTML = '<div class="tc-points__empty"><svg width="32" height="32" viewBox="0 0 24 24" fill="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="#d0d5dd" stroke-width="1.5"/><circle cx="12" cy="9" r="2.5" stroke="#d0d5dd" stroke-width="1.5"/></svg><p>Нет точек. Кликни по карте</p></div>';
        return;
    }

    list.innerHTML = mapPoints.map(function (p, i) {
        return '<div class="tc-point-item">' +
            '<div class="tc-point-item__num">' + (i + 1) + '</div>' +
            '<div class="tc-point-item__info">' +
            '<div class="tc-point-item__name">' + escHtml(p.name) + '</div>' +
            (p.note ? '<div class="tc-point-item__meta">' + escHtml(p.note) + '</div>' : '') +
            '</div>' +
            '<button class="tc-point-item__del" data-point-id="' + p.id + '" title="Удалить">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
            '</button></div>';
    }).join('');

    list.querySelectorAll('[data-point-id]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            removePoint(parseInt(btn.dataset.pointId));
        });
    });
}

function removePoint(id) {
    mapPoints = mapPoints.filter(function (p) { return p.id !== id; });
    var entry = mapMarkers.find(function (m) { return m.id === id; });
    if (entry) {
        map.removeLayer(entry.marker);
        mapMarkers = mapMarkers.filter(function (x) { return x.id !== id; });
    }
    mapMarkers.forEach(function (m, i) { m.marker.setIcon(customIcon(i + 1)); });
    renderPoints();
}

function declPoints(n) {
    if (n % 100 >= 11 && n % 100 <= 19) return 'точек';
    var r = n % 10;
    if (r === 1) return 'точка';
    if (r >= 2 && r <= 4) return 'точки';
    return 'точек';
}

function initMembers() {
    qs('#addMember').addEventListener('click', addMemberByEmail);
    qs('#inviteEmail').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); addMemberByEmail(); }
    });
}

function addMemberByEmail() {
    var input = qs('#inviteEmail');
    var email = (input.value || '').trim();
    var error = qs('#inviteError');

    if (!email) return;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        if (error) { error.textContent = 'Введите корректный email'; error.classList.add('visible'); }
        return;
    }

    if (members.find(function (m) { return m.email === email; })) {
        if (error) { error.textContent = 'Этот участник уже добавлен'; error.classList.add('visible'); }
        return;
    }

    if (error) { error.textContent = ''; error.classList.remove('visible'); }

    members.push({ id: Date.now(), email: email });
    input.value = '';
    renderMembers();
}

function renderMembers() {
    var list  = qs('#membersList');
    var owner = list.querySelector('.tc-member--owner');

    var html = members.map(function (m) {
        var letter = m.email.charAt(0).toUpperCase();
        return '<div class="tc-member">' +
            '<div class="tc-member__avatar" style="background:linear-gradient(135deg,#8b5cf6,#6d28d9)">' + escHtml(letter) + '</div>' +
            '<div class="tc-member__info">' +
            '<div class="tc-member__name">' + escHtml(m.email) + '</div>' +
            '<div class="tc-member__role">Участник</div>' +
            '</div>' +
            '<button class="tc-member__del" data-member-id="' + m.id + '" title="Удалить">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
            '</button></div>';
    }).join('');

    list.innerHTML = '';
    if (owner) list.appendChild(owner);
    list.insertAdjacentHTML('beforeend', html);

    list.querySelectorAll('[data-member-id]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var id = parseInt(btn.dataset.memberId);
            members = members.filter(function (m) { return m.id !== id; });
            renderMembers();
        });
    });
}

function initTasks() {
    qs('#addTask').addEventListener('click', addTask);
    qs('#taskInput').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); addTask(); }
    });

    qsa('.tc-quick-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var text = btn.dataset.task;
            if (!tasks.find(function (t) { return t.text === text; })) {
                tasks.push({ id: Date.now(), text: text });
                renderTasks();
            }
        });
    });
}

function addTask() {
    var input = qs('#taskInput');
    var text  = (input.value || '').trim();
    if (!text) return;
    tasks.push({ id: Date.now(), text: text });
    input.value = '';
    renderTasks();
    input.focus();
}

function renderTasks() {
    var list = qs('#tasksList');
    if (!list) return;

    if (!tasks.length) {
        list.innerHTML = '<div class="tc-tasks-empty">Нет задач. Добавь первую</div>';
        return;
    }

    list.innerHTML = tasks.map(function (t) {
        return '<div class="tc-task-item">' +
            '<div class="tc-task-item__text">' + escHtml(t.text) + '</div>' +
            '<button class="tc-task-item__del" data-task-del="' + t.id + '" title="Удалить">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
            '</button></div>';
    }).join('');

    list.querySelectorAll('[data-task-del]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var id = parseInt(btn.dataset.taskDel);
            tasks = tasks.filter(function (t) { return t.id !== id; });
            renderTasks();
        });
    });
}

function getTripPayload() {
    return {
        title:            (qs('#tripTitle')     || {}).value || '',
        city:             (qs('#tripCity')      || {}).value || '',
        country:          (qs('#tripCountry')   || {}).value || '',
        description:      (qs('#tripDesc')      || {}).value || '',
        date_start:       (qs('#tripDateStart') || {}).value || '',
        date_end:         (qs('#tripDateEnd')   || {}).value || '',
        base_currency_id: parseInt((qs('#tripCurrency') || {}).value) || 1,
        budget_limit:     parseFloat((qs('#tripBudget') || {}).value) || null,
    };
}

function saveExtras(tripId) {
    var locRequests = mapPoints.map(function (p) {
        return api.post('/locations', {
            trip_id:      tripId,
            name:         p.name,
            lat:          p.lat,
            lng:          p.lng,
            note:         p.note || '',
            place_source: 'manual',
        });
    });

    var taskRequests = tasks.map(function (t) {
        return api.post('/tasks', { trip_id: tripId, title: t.text });
    });

    var inviteRequests = members.map(function (m) {
        return api.post('/invitations', { trip_id: tripId, email: m.email, role: 'viewer' });
    });

    return Promise.all(locRequests.concat(taskRequests).concat(inviteRequests));
}

function initSave() {
    qs('#saveBtn').addEventListener('click', function () {
        if (!validateStep1()) {
            goToStep(1);
            showToast('Заполни обязательные поля', 'error');
            return;
        }

        var btn      = qs('#saveBtn');
        var origHtml = btn.innerHTML;
        btn.disabled = true;
        btn.textContent = 'Сохраняем...';

        var payload  = getTripPayload();
        var tripCall = editId ? api.put('/trips/' + editId, payload) : api.post('/trips', payload);

        tripCall
            .then(function (result) {
                var trip = result.trip || result;
                var id   = trip.id || editId;

                if (!editId) {
                    return saveExtras(id).then(function () { return id; });
                }
                return Promise.resolve(id);
            })
            .then(function (id) {
                showToast(editId ? 'Поездка обновлена' : 'Поездка создана!', 'success');
                setTimeout(function () {
                    window.location.href = 'trip.html?id=' + id;
                }, 700);
            })
            .catch(function (err) {
                showToast(err.message || 'Ошибка сохранения', 'error');
                btn.disabled = false;
                btn.innerHTML = origHtml;
            });
    });
}

function initFromUrl() {
    var params    = new URLSearchParams(window.location.search);
    var editParam = params.get('edit');
    var city      = params.get('city');
    var dateStart = params.get('dateStart');
    var dateEnd   = params.get('dateEnd');

    var cityEl = qs('#tripCity');      if (city      && cityEl)      cityEl.value      = city;
    var dsEl   = qs('#tripDateStart'); if (dateStart && dsEl)        dsEl.value        = dateStart;
    var deEl   = qs('#tripDateEnd');   if (dateEnd   && deEl)        deEl.value        = dateEnd;
    var titleEl = qs('#tripTitle');
    if (city && titleEl && !titleEl.value) titleEl.value = 'Поездка в ' + city;

    if (!editParam) return;

    editId = parseInt(editParam);

    var pageTitle = qs('#pageTitle');
    var pageSub   = qs('#pageSubtitle');
    if (pageTitle) pageTitle.textContent = 'Редактировать поездку';
    if (pageSub)   pageSub.textContent   = 'Измени данные и сохрани';

    var saveBtn = qs('#saveBtn');
    if (saveBtn) saveBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><polyline points="17 21 17 13 7 13 7 21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><polyline points="7 3 7 8 15 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg> Сохранить изменения';

    api.get('/trips/' + editId)
        .then(function (result) {
            var trip = result.trip || result;
            var set  = function (id, val) { var el = qs('#' + id); if (el) el.value = val || ''; };
            set('tripTitle',     trip.title);
            set('tripCity',      trip.city);
            set('tripCountry',   trip.country);
            set('tripDateStart', trip.date_start ? trip.date_start.slice(0, 10) : '');
            set('tripDateEnd',   trip.date_end   ? trip.date_end.slice(0, 10)   : '');
            set('tripDesc',      trip.description);
            set('tripBudget',    trip.budget_limit || '');
            if (trip.base_currency_id) {
                var sel = qs('#tripCurrency');
                if (sel) sel.value = trip.base_currency_id;
            }
        })
        .catch(function (err) {
            showToast('Ошибка загрузки: ' + (err.message || ''), 'error');
        });
}

document.addEventListener('DOMContentLoaded', function () {
    initHeaderScroll();
    initBurger();
    initUserPill();
    initLogout();
    loadUserInfo();
    initStepNav();
    initPointModal();
    initMembers();
    initTasks();
    initSave();
    initFromUrl();
});
