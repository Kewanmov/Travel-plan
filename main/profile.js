// main/profile.js
'use strict';

function qs(sel)  { return document.querySelector(sel); }
function qsa(sel) { return Array.from(document.querySelectorAll(sel)); }

var confirmCallback = null;

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

function avatarOrigin() {
    return (window.api && api.baseUrl) ? api.baseUrl.replace(/\/api\/?$/, '') : '';
}

function setAvatarLook(el, user) {
    if (!el) return;
    var letter = (user.name || '?').charAt(0).toUpperCase();
    if (user.avatar) {
        var url = user.avatar.indexOf('http') === 0 ? user.avatar : (avatarOrigin() + user.avatar);
        el.style.backgroundImage = "url('" + url + "')";
        el.style.backgroundSize  = 'cover';
        el.style.backgroundPosition = 'center';
        el.textContent = '';
    } else {
        el.style.backgroundImage = '';
        el.textContent = letter;
    }
}

function applyUser(u) {
    var name   = u.name  || 'Пользователь';
    var email  = u.email || '';

    setAvatarLook(qs('#headerAvatar'),  u);
    setAvatarLook(qs('#profileAvatar'), u);

    var delBtn = qs('#avatarDelBtn');
    if (delBtn) delBtn.style.display = u.avatar ? '' : 'none';

    [['headerName',name],['dropName',name],['dropEmail',email],
     ['profileName',name],['profileEmail',email]].forEach(function (p) {
        var el = qs('#' + p[0]); if (el) el.textContent = p[1];
    });

    if (u.created_at) {
        var d = new Date(u.created_at);
        var months = ['январе','феврале','марте','апреле','мае','июне',
                      'июле','августе','сентябре','октябре','ноябре','декабре'];
        var el = qs('#profileSince');
        if (el) el.textContent = 'С нами с ' + months[d.getMonth()] + ' ' + d.getFullYear();
    }

    var fn = qs('#fieldName');  if (fn) fn.value = u.name  || '';
    var fe = qs('#fieldEmail'); if (fe) fe.value = u.email || '';
    var fp = qs('#fieldPhone'); if (fp) fp.value = u.phone || '';
    var fb = qs('#fieldBio');   if (fb) { fb.value = u.bio || ''; updateBioCount(); }
}

function persistUser(u) {
    var stored = JSON.parse(localStorage.getItem('user') || '{}');
    Object.assign(stored, u);
    localStorage.setItem('user', JSON.stringify(stored));
    applyUser(stored);
}

function initAvatarUpload() {
    var input  = qs('#avatarInput');
    var delBtn = qs('#avatarDelBtn');
    if (input) {
        input.addEventListener('change', function () {
            var file = input.files && input.files[0];
            if (!file) return;
            var fd = new FormData();
            fd.append('file', file);
            api.upload('/auth/avatar', fd)
                .then(function (res) {
                    persistUser({ avatar: (res && res.avatar) || null });
                    showToast('Аватар обновлён', 'success');
                })
                .catch(function (err) { showToast(err.message || 'Ошибка', 'error'); })
                .finally(function () { input.value = ''; });
        });
    }
    if (delBtn) {
        delBtn.addEventListener('click', function () {
            if (!confirm('Удалить аватар?')) return;
            api.delete('/auth/avatar')
                .then(function () { persistUser({ avatar: null }); showToast('Аватар удалён', 'success'); })
                .catch(function (err) { showToast(err.message || 'Ошибка', 'error'); });
        });
    }
}

function loadUser() {
    var cached = window.currentUser || JSON.parse(localStorage.getItem('user') || '{}');
    applyUser(cached);

    api.get('/auth/me')
        .then(function (res) {
            var u = res.user || res;
            var stored = JSON.parse(localStorage.getItem('user') || '{}');
            Object.assign(stored, u);
            localStorage.setItem('user', JSON.stringify(stored));
            applyUser(u);
        })
        .catch(function () {});
}

function loadStats() {
    api.get('/trips')
        .then(function (trips) {
            trips = Array.isArray(trips) ? trips : [];
            var cities   = new Set(trips.map(function (t) { return t.city; }).filter(Boolean)).size;
            var tasks    = trips.reduce(function (s, t) { return s + (t.tasks_total || 0); }, 0);
            var upcoming = trips.filter(function (t) { return new Date(t.date_end) >= new Date(); }).length;

            var el;
            el = qs('#heroStatTrips');  if (el) el.textContent = trips.length;
            el = qs('#heroStatCities'); if (el) el.textContent = cities;
            el = qs('#heroStatTasks');  if (el) el.textContent = tasks;

            renderTripsList(trips, upcoming);
        })
        .catch(function () {});
}

function renderTripsList(trips, upcoming) {
    var container = qs('#profileTripsList');
    var sub       = qs('#tripsListSub');
    if (!container) return;

    if (sub) sub.textContent = trips.length + ' поездок · ' + upcoming + ' предстоящих';

    if (!trips.length) {
        container.innerHTML = '<div class="pf-trips__empty">Поездок пока нет. <a href="trip-create.html">Создать →</a></div>';
        return;
    }

    var STATUS = { active:'Активная', upcoming:'Предстоящая', completed:'Завершена', draft:'Черновик' };

    container.innerHTML = trips.slice(0, 8).map(function (t) {
        var isUpcoming = new Date(t.date_end) >= new Date();
        var label = isUpcoming ? 'Предстоящая' : 'Завершена';
        var cls   = isUpcoming ? 'pf-trip-badge--blue' : 'pf-trip-badge--gray';
        var img   = t.cover_image || 'img/fallback-cover.jpg';
        return '<a href="trip.html?id=' + t.id + '" class="pf-trip-item">' +
            '<div class="pf-trip-item__cover" style="background-image:url(\'' + img + '\')"></div>' +
            '<div class="pf-trip-item__info">' +
                '<div class="pf-trip-item__title">' + escHtml(t.title || 'Без названия') + '</div>' +
                '<div class="pf-trip-item__meta">' +
                    (t.city ? escHtml(t.city) + ' · ' : '') +
                    formatDateShort(t.date_start) + ' — ' + formatDateShort(t.date_end) +
                '</div>' +
            '</div>' +
            '<span class="pf-trip-badge ' + cls + '">' + label + '</span>' +
            '</a>';
    }).join('');
}

function initTabs() {
    var tabs   = qsa('.pf-tab');
    var panels = qsa('.pf-panel');

    tabs.forEach(function (btn) {
        btn.addEventListener('click', function () {
            tabs.forEach(function (t)   { t.classList.remove('pf-tab--active'); });
            panels.forEach(function (p) { p.classList.remove('pf-panel--active'); });
            btn.classList.add('pf-tab--active');
            var panel = qs('#tab-' + btn.dataset.tab);
            if (panel) panel.classList.add('pf-panel--active');
        });
    });
}

function updateBioCount() {
    var bio   = qs('#fieldBio');
    var count = qs('#bioCount');
    if (bio && count) count.textContent = bio.value.length;
}

function initInfoForm() {
    var bio = qs('#fieldBio');
    if (bio) bio.addEventListener('input', updateBioCount);

    var form = qs('#infoForm');
    if (!form) return;

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        var name  = (qs('#fieldName').value  || '').trim();
        var email = (qs('#fieldEmail').value || '').trim();
        var phone = (qs('#fieldPhone').value || '').trim();
        var bio   = (qs('#fieldBio').value   || '').trim();
        var btn   = qs('#infoSaveBtn');

        if (!name)  { showToast('Введите имя', 'error');   return; }
        if (!email) { showToast('Введите email', 'error'); return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('Некорректный email', 'error'); return; }

        btn.disabled    = true;
        btn.textContent = 'Сохраняем...';

        api.put('/auth/profile', { name: name, email: email, phone: phone, bio: bio })
            .then(function (res) {
                var u = (res && res.user) ? res.user : { name: name, email: email, phone: phone, bio: bio };
                persistUser(u);
                showToast('Профиль обновлён', 'success');
            })
            .catch(function (err) {
                showToast(err.message || 'Ошибка сохранения', 'error');
            })
            .finally(function () {
                btn.disabled    = false;
                btn.textContent = 'Сохранить изменения';
            });
    });
}

function initPasswordForm() {
    qsa('.pf-eye').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var input = qs('#' + btn.dataset.target);
            if (!input) return;
            input.type = input.type === 'password' ? 'text' : 'password';
        });
    });

    var newPass = qs('#fieldNewPass');
    if (newPass) newPass.addEventListener('input', function () {
        checkPasswordStrength(newPass.value);
    });

    var form = qs('#passwordForm');
    if (!form) return;

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        var oldPass     = qs('#fieldOldPass').value     || '';
        var newPassVal  = qs('#fieldNewPass').value      || '';
        var confirmPass = qs('#fieldConfirmPass').value  || '';
        var btn         = qs('#passSaveBtn');

        if (!oldPass) { showToast('Введите текущий пароль', 'error'); return; }
        if (newPassVal.length < 8) { showToast('Пароль минимум 8 символов', 'error'); return; }
        if (newPassVal !== confirmPass) { showToast('Пароли не совпадают', 'error'); return; }

        btn.disabled    = true;
        btn.textContent = 'Сохраняем...';

        api.put('/auth/profile', { old_password: oldPass, password: newPassVal })
            .then(function () {
                showToast('Пароль изменён', 'success');
                qs('#fieldOldPass').value    = '';
                qs('#fieldNewPass').value    = '';
                qs('#fieldConfirmPass').value = '';
                var str = qs('#passStrength');
                if (str) str.style.display = 'none';
            })
            .catch(function (err) {
                showToast(err.message || 'Ошибка', 'error');
            })
            .finally(function () {
                btn.disabled    = false;
                btn.textContent = 'Изменить пароль';
            });
    });
}

function checkPasswordStrength(pass) {
    var el    = qs('#passStrength');
    var fill  = qs('#strengthFill');
    var label = qs('#strengthLabel');
    if (!el) return;
    if (!pass) { el.style.display = 'none'; return; }
    el.style.display = 'flex';

    var score = 0;
    if (pass.length >= 8)           score++;
    if (pass.length >= 12)          score++;
    if (/[A-Z]/.test(pass))        score++;
    if (/[0-9]/.test(pass))        score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;

    var levels = [
        { pct:'20%',  color:'#e74c3c', label:'Очень слабый' },
        { pct:'40%',  color:'#f97316', label:'Слабый' },
        { pct:'60%',  color:'#f59e0b', label:'Средний' },
        { pct:'80%',  color:'#22c55e', label:'Хороший' },
        { pct:'100%', color:'#01abfb', label:'Отличный' },
    ];
    var level = levels[Math.min(score, 4)];
    if (fill)  { fill.style.width = level.pct; fill.style.background = level.color; }
    if (label) { label.textContent = level.label; label.style.color = level.color; }
}

function initSessionMeta() {
    var el = qs('#sessionMeta');
    if (!el) return;
    var ua      = navigator.userAgent;
    var browser = 'Браузер';
    if      (/Chrome/.test(ua) && !/Edge/.test(ua)) browser = 'Google Chrome';
    else if (/Firefox/.test(ua))  browser = 'Firefox';
    else if (/Safari/.test(ua))   browser = 'Safari';
    else if (/Edge/.test(ua))     browser = 'Microsoft Edge';
    var os = '';
    if      (/Windows/.test(ua)) os = 'Windows';
    else if (/Mac/.test(ua))     os = 'macOS';
    else if (/Linux/.test(ua))   os = 'Linux';
    else if (/Android/.test(ua)) os = 'Android';
    el.textContent = browser + (os ? ' · ' + os : '');
}

function initDeleteAccount() {
    var btn = qs('#deleteAccountBtn');
    if (!btn) return;
    btn.addEventListener('click', function () {
        var pwd = window.prompt(
            'Удалить аккаунт?\n\nВсе данные, поездки и история будут удалены безвозвратно.\n\n' +
            'Введите ТЕКУЩИЙ пароль для подтверждения:'
        );
        if (pwd === null) return;
        if (!pwd) { showToast('Пароль обязателен', 'error'); return; }

        api.delete('/auth/account', { password: pwd })
            .then(function () {
                localStorage.removeItem('access_token');
                localStorage.removeItem('user');
                showToast('Аккаунт удалён', 'success');
                setTimeout(function () { window.location.replace('login.html'); }, 800);
            })
            .catch(function (err) {
                showToast(err.message || 'Не удалось удалить', 'error');
            });
    });
}

function openConfirm(title, desc, cb, btnLabel) {
    var modal = qs('#confirmModal');
    if (!modal) return;
    var el;
    el = qs('#confirmTitle'); if (el) el.textContent = title;
    el = qs('#confirmDesc');  if (el) el.textContent = desc;
    el = qs('#confirmOk');    if (el) el.textContent = btnLabel || 'Подтвердить';
    confirmCallback = cb;
    modal.style.display = 'flex';
}

function initConfirmModal() {
    var modal = qs('#confirmModal');
    function close() { if (modal) modal.style.display = 'none'; confirmCallback = null; }
    var el;
    el = qs('#confirmOk');     if (el) el.addEventListener('click', function () { if (typeof confirmCallback === 'function') confirmCallback(); close(); });
    el = qs('#confirmCancel'); if (el) el.addEventListener('click', close);
    el = qs('#confirmClose');  if (el) el.addEventListener('click', close);
    if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
}

document.addEventListener('DOMContentLoaded', function () {
    initHeader();
    loadUser();
    loadStats();
    initTabs();
    initInfoForm();
    initPasswordForm();
    initAvatarUpload();
    initSessionMeta();
    initDeleteAccount();
    initConfirmModal();
});