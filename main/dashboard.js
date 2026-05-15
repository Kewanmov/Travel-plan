'use strict';

function qs(sel)  { return document.querySelector(sel); }
function qsa(sel) { return Array.from(document.querySelectorAll(sel)); }

var trips = [];

var FALLBACK_IMG = 'img/fallback-cover.jpg';

function tripIsUpcoming(trip) {
    return new Date(trip.date_end) >= new Date(new Date().toDateString());
}

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
            window.location.href = 'index.html';
        });
    });
}

function loadUserInfo() {
    var user   = window.currentUser || JSON.parse(localStorage.getItem('user') || '{}');
    var name   = user.name  || 'Пользователь';
    var email  = user.email || '';
    var letter = name.charAt(0).toUpperCase();

    var avatar = qs('#headerAvatar');
    if (avatar) {
        if (user.avatar && /^(https?:\/\/|\/uploads\/)/.test(user.avatar)) {
            var origin = (window.api && api.baseUrl) ? api.baseUrl.replace(/\/api\/?$/, '') : '';
            var rawUrl = user.avatar.indexOf('http') === 0 ? user.avatar : (origin + user.avatar);
            var url = rawUrl.replace(/'/g, '%27');
            avatar.style.backgroundImage    = "url('" + url + "')";
            avatar.style.backgroundSize     = 'cover';
            avatar.style.backgroundPosition = 'center';
            avatar.style.color              = 'transparent';
            avatar.textContent              = '';
        } else {
            avatar.style.backgroundImage = '';
            avatar.style.color           = '';
            avatar.textContent           = letter;
        }
    }

    var els = { headerName: name, dropName: name, dropEmail: email };
    Object.keys(els).forEach(function (id) {
        var el = qs('#' + id);
        if (el) el.textContent = els[id];
    });
}

function updateSidebarStats() {
    var cities = new Set(trips.map(function (t) { return t.city; })).size;
    var places = trips.reduce(function (acc, t) { return acc + (t.locations_count || 0); }, 0);

    var el;
    el = qs('#statTrips');  if (el) el.textContent = trips.length;
    el = qs('#statCities'); if (el) el.textContent = cities;
    el = qs('#statPlaces'); if (el) el.textContent = places;
}

function initFilters() {
    var tabs        = qsa('.filter-tab');
    var searchInput = qs('#tripSearch');

    tabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
            tabs.forEach(function (t) { t.classList.remove('filter-tab--active'); });
            tab.classList.add('filter-tab--active');
            applyFilter();
        });
    });

    if (searchInput) searchInput.addEventListener('input', applyFilter);
}

function applyFilter() {
    var activeFilter = (qs('.filter-tab--active') || {}).dataset.filter || 'all';
    var search       = ((qs('#tripSearch') || {}).value || '').toLowerCase();

    var filtered = trips.filter(function (trip) {
        var upcoming = tripIsUpcoming(trip);
        var isShared = trip.role !== 'owner';

        if (activeFilter === 'upcoming' && !upcoming) return false;
        if (activeFilter === 'past'     && upcoming)  return false;
        if (activeFilter === 'shared'   && !isShared) return false;
        if (search && trip.title.toLowerCase().indexOf(search) === -1) return false;
        return true;
    });

    renderTrips(filtered);
}

function renderTrips(list) {
    var grid  = qs('#tripsGrid');
    var empty = qs('#tripsEmpty');
    if (!grid) return;

    qsa('.trip-card:not(.trip-card--create)').forEach(function (c) { c.remove(); });

    if (!list || !list.length) {
        if (empty) empty.style.display = 'flex';
        return;
    }

    if (empty) empty.style.display = 'none';

    var createCard = qs('#createCard');

    list.forEach(function (trip) {
        var start    = new Date(trip.date_start);
        var end      = new Date(trip.date_end);
        var days     = Math.ceil((end - start) / 86400000) + 1;
        var pct      = trip.tasks_total ? Math.round(trip.tasks_done / trip.tasks_total * 100) : 0;
        var upcoming = tripIsUpcoming(trip);

        var statusText  = upcoming ? 'Предстоящая' : 'Завершена';
        var statusClass = upcoming ? 'trip-card__badge--blue' : 'trip-card__badge--grey';
        var roleText    = trip.role === 'owner' ? 'Владелец' : 'Участник';
        var img         = trip.cover_image || FALLBACK_IMG;

        var members = (trip.members || []).slice(0, 4).map(function (m, i) {
            var letter = (m.name || '?').charAt(0).toUpperCase();
            var cls    = 'trip-card__member' + (i > 0 ? ' trip-card__member--' + (i + 1) : '');
            return '<div class="' + cls + '" title="' + escHtml(m.name || '') + '">' + escHtml(letter) + '</div>';
        }).join('');

        var dropEdit = trip.role === 'owner'
            ? '<a href="trip-create.html?edit=' + trip.id + '" class="trip-card__dropdown-item">Редактировать</a>'
            : '';
        var dropDanger = trip.role === 'owner'
            ? '<button class="trip-card__dropdown-item trip-card__dropdown-item--danger" data-action="delete" data-id="' + trip.id + '">Удалить</button>'
            : '<button class="trip-card__dropdown-item trip-card__dropdown-item--danger" data-action="leave" data-id="' + trip.id + '">Покинуть</button>';

        var card = document.createElement('div');
        card.className      = 'trip-card';
        card.dataset.status = upcoming ? 'upcoming' : 'past';
        card.dataset.title  = trip.title;

        card.innerHTML =
            '<div class="trip-card__cover" style="background-image:url(\'' + img + '\')">' +
            '<div class="trip-card__cover-overlay"></div>' +
            '<span class="trip-card__badge ' + statusClass + '">' + statusText + '</span>' +
            '<span class="trip-card__role">' + roleText + '</span>' +
            '</div>' +
            '<div class="trip-card__body">' +
            '<div class="trip-card__head">' +
            '<h3 class="trip-card__title">' + escHtml(trip.title) + '</h3>' +
            '<div class="trip-card__menu" data-id="' + trip.id + '">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none">' +
            '<circle cx="12" cy="5" r="1.5" fill="#98a2b3"/>' +
            '<circle cx="12" cy="12" r="1.5" fill="#98a2b3"/>' +
            '<circle cx="12" cy="19" r="1.5" fill="#98a2b3"/>' +
            '</svg>' +
            '<div class="trip-card__dropdown">' +
            '<a href="trip.html?id=' + trip.id + '" class="trip-card__dropdown-item">Открыть</a>' +
            dropEdit +
            '<div class="trip-card__dropdown-divider"></div>' +
            dropDanger +
            '</div></div></div>' +
            '<div class="trip-card__meta">' +
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke="#98a2b3" stroke-width="1.8"/><path d="M16 2v4M8 2v4M3 10h18" stroke="#98a2b3" stroke-width="1.8" stroke-linecap="round"/></svg>' +
            formatDateShort(trip.date_start) + ' — ' + formatDateShort(trip.date_end) +
            '<span class="trip-card__days">' + days + ' дн.</span>' +
            '</div>' +
            '<div class="trip-card__progress">' +
            '<div class="trip-card__progress-bar"><div class="trip-card__progress-fill" style="width:' + pct + '%"></div></div>' +
            '<span class="trip-card__progress-label">' + trip.tasks_done + ' / ' + trip.tasks_total + ' задач</span>' +
            '</div>' +
            '<div class="trip-card__footer">' +
            '<div class="trip-card__members">' + members + '</div>' +
            '<div class="trip-card__locations">' +
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="#98a2b3" stroke-width="1.8"/><circle cx="12" cy="9" r="2.5" stroke="#98a2b3" stroke-width="1.8"/></svg>' +
            '<span>' + (trip.locations_count || 0) + ' мест</span>' +
            '</div></div>' +
            '<a href="trip.html?id=' + trip.id + '" class="trip-card__btn">Открыть поездку</a>' +
            '</div>';

        createCard ? grid.insertBefore(card, createCard) : grid.appendChild(card);
    });
}

function showGridLoading() {
    var grid       = qs('#tripsGrid');
    var createCard = qs('#createCard');
    if (!grid) return;
    qsa('.trip-card:not(.trip-card--create)').forEach(function (c) { c.remove(); });
    for (var i = 0; i < 3; i++) {
        var card = document.createElement('div');
        card.className = 'trip-card trip-card--skeleton';
        card.innerHTML =
            '<div class="trip-card__cover trip-card__cover--skeleton"></div>' +
            '<div class="trip-card__body">' +
            '<div class="skeleton-line skeleton-line--title"></div>' +
            '<div class="skeleton-line"></div>' +
            '<div class="skeleton-line skeleton-line--short"></div>' +
            '</div>';
        createCard ? grid.insertBefore(card, createCard) : grid.appendChild(card);
    }
}

function hideGridLoading() {
    qsa('.trip-card--skeleton').forEach(function (c) { c.remove(); });
}

function initCardMenus() {
    document.addEventListener('click', function (e) {
        var menu = e.target.closest('.trip-card__menu');
        if (menu) {
            e.stopPropagation();
            var isOpen = menu.classList.contains('open');
            qsa('.trip-card__menu.open').forEach(function (m) { m.classList.remove('open'); });
            if (!isOpen) menu.classList.add('open');
        } else {
            qsa('.trip-card__menu.open').forEach(function (m) { m.classList.remove('open'); });
        }
    });
}

var confirmCallback = null;

function openConfirm(title, desc, cb, btnLabel) {
    var modal   = qs('#confirmModal');
    var titleEl = qs('#confirmTitle');
    var descEl  = qs('#confirmDesc');
    var okBtn   = qs('#confirmOk');

    if (!modal) return;
    if (titleEl) titleEl.textContent = title;
    if (descEl)  descEl.textContent  = desc;
    if (okBtn)   okBtn.textContent   = btnLabel || 'Удалить';

    confirmCallback = cb;
    modal.style.display = 'flex';
}

function initConfirmModal() {
    var modal     = qs('#confirmModal');
    var okBtn     = qs('#confirmOk');
    var cancelBtn = qs('#confirmCancel');
    var closeBtn  = qs('#confirmClose');

    function close() {
        if (modal) modal.style.display = 'none';
        confirmCallback = null;
    }

    if (okBtn)     okBtn.addEventListener('click', function () { if (typeof confirmCallback === 'function') confirmCallback(); close(); });
    if (cancelBtn) cancelBtn.addEventListener('click', close);
    if (closeBtn)  closeBtn.addEventListener('click', close);
    if (modal)     modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
}

function initTripActions() {
    document.addEventListener('click', function (e) {
        var deleteBtn = e.target.closest('[data-action="delete"]');
        if (deleteBtn) {
            e.preventDefault();
            var id    = parseInt(deleteBtn.dataset.id);
            var trip  = trips.find(function (t) { return t.id === id; });
            var title = trip ? trip.title : 'поездку';

            openConfirm(
                'Удалить поездку?',
                'Поездка "' + title + '" и все её данные будут удалены навсегда.',
                function () {
                    api.delete('/trips/' + id)
                        .then(function () {
                            trips = trips.filter(function (t) { return t.id !== id; });
                            applyFilter();
                            updateSidebarStats();
                            showToast('Поездка удалена', 'success');
                        })
                        .catch(function (err) {
                            showToast(err.message || 'Ошибка удаления', 'error');
                        });
                },
                'Удалить'
            );
        }

        var leaveBtn = e.target.closest('[data-action="leave"]');
        if (leaveBtn) {
            e.preventDefault();
            var lid    = parseInt(leaveBtn.dataset.id);
            var ltrip  = trips.find(function (t) { return t.id === lid; });
            var ltitle = ltrip ? ltrip.title : 'поездку';

            openConfirm(
                'Покинуть поездку?',
                'Вы потеряете доступ к поездке "' + ltitle + '".',
                function () {
                    trips = trips.filter(function (t) { return t.id !== lid; });
                    applyFilter();
                    updateSidebarStats();
                    showToast('Вы покинули поездку', 'info');
                },
                'Покинуть'
            );
        }
    });
}

var dhMap = null;
var dhCountdownTimer = null;

function renderHero() {
    var hero = qs('#dhHero');
    if (!hero) return;

    if (!trips.length) { hero.style.display = 'none'; return; }
    hero.style.display = '';

    renderCountdown();
    renderMiniMap();
}

function pickNextTrip() {
    var now = new Date(); now.setHours(0, 0, 0, 0);
    var upcoming = trips
        .filter(function (t) { return new Date(t.date_start) >= now; })
        .sort(function (a, b) { return new Date(a.date_start) - new Date(b.date_start); });
    if (upcoming.length) return { trip: upcoming[0], state: 'upcoming' };

    var active = trips.filter(function (t) {
        var s = new Date(t.date_start), e = new Date(t.date_end);
        return s <= now && now <= e;
    });
    if (active.length) return { trip: active[0], state: 'active' };

    var past = trips.slice().sort(function (a, b) { return new Date(b.date_end) - new Date(a.date_end); });
    return past.length ? { trip: past[0], state: 'past' } : null;
}

function renderCountdown() {
    var box = qs('#dhCountdown');
    if (!box) return;
    if (dhCountdownTimer) { clearInterval(dhCountdownTimer); dhCountdownTimer = null; }

    var pick = pickNextTrip();
    if (!pick) {
        box.className = 'dh-countdown dh-countdown--empty';
        box.style.backgroundImage = '';
        box.innerHTML =
            '<div class="dh-countdown__label">Нет поездок</div>' +
            '<div class="dh-countdown__title">Создай первое путешествие</div>' +
            '<div class="dh-countdown__city">Спланируй маршрут, бюджет и приглашай друзей</div>' +
            '<a href="trip-create.html" class="dh-countdown__btn">Создать поездку</a>';
        return;
    }

    var trip  = pick.trip;
    var state = pick.state;
    var img   = trip.cover_image || FALLBACK_IMG;
    box.className = 'dh-countdown' + (state === 'past' ? ' dh-countdown--past' : '');
    box.style.backgroundImage = state === 'past' ? '' : "url('" + img + "')";

    var label =
        state === 'upcoming' ? 'Ближайшая поездка'
        : state === 'active' ? 'Сейчас в пути'
        : 'Последняя поездка';

    function tick() {
        var now    = new Date();
        var target = state === 'upcoming' ? new Date(trip.date_start) : new Date(trip.date_end);
        if (state === 'upcoming') target.setHours(0, 0, 0, 0);
        else target.setHours(23, 59, 59, 999);

        var diff = target - now;
        var timer;

        if (state === 'past' || (state === 'active' && diff < 0)) {
            timer = '<div class="dh-cd-cell"><b>—</b><span>Завершена</span></div>';
        } else {
            var sec = Math.max(0, Math.floor(diff / 1000));
            var d   = Math.floor(sec / 86400);
            var h   = Math.floor((sec % 86400) / 3600);
            var m   = Math.floor((sec % 3600) / 60);
            timer =
                '<div class="dh-cd-cell"><b>' + d + '</b><span>дней</span></div>' +
                '<div class="dh-cd-cell"><b>' + h + '</b><span>часов</span></div>' +
                '<div class="dh-cd-cell"><b>' + m + '</b><span>минут</span></div>';
        }

        var city = [trip.city, trip.country].filter(Boolean).join(', ');
        box.innerHTML =
            '<div class="dh-countdown__label">' + label + '</div>' +
            '<h2 class="dh-countdown__title">' + escHtml(trip.title) + '</h2>' +
            '<div class="dh-countdown__city">' + escHtml(city) +
                ' · ' + formatDateShort(trip.date_start) + ' — ' + formatDateShort(trip.date_end) + '</div>' +
            '<div class="dh-countdown__timer">' + timer + '</div>' +
            '<a href="trip.html?id=' + trip.id + '" class="dh-countdown__btn">Открыть поездку</a>';
    }
    tick();
    if (state !== 'past') dhCountdownTimer = setInterval(tick, 30000);
}

function renderMiniMap() {
    var mapEl = qs('#dhMap');
    var cnt   = qs('#dhMapCount');
    if (!mapEl || !window.L) return;

    var withCoords = trips.filter(function (t) { return t.center_lat != null && t.center_lng != null; });
    if (cnt) cnt.textContent = withCoords.length + ' из ' + trips.length;

    if (!withCoords.length) {
        mapEl.innerHTML = '<div class="dh-map-empty">Добавь локации в поездки — они появятся на карте</div>';
        return;
    }

    if (dhMap) { dhMap.remove(); dhMap = null; }
    dhMap = L.map(mapEl, { zoomControl: false, attributionControl: false });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(dhMap);
    L.control.zoom({ position: 'bottomright' }).addTo(dhMap);

    var bounds = [];
    withCoords.forEach(function (t) {
        var ll = [parseFloat(t.center_lat), parseFloat(t.center_lng)];
        if (isNaN(ll[0]) || isNaN(ll[1])) return;
        bounds.push(ll);
        var icon = L.divIcon({
            className: '',
            html: '<div style="width:14px;height:14px;border-radius:50%;background:#01abfb;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.6)"></div>',
            iconSize: [14, 14], iconAnchor: [7, 7],
        });
        var m = L.marker(ll, { icon: icon }).addTo(dhMap);
        m.bindPopup(
            '<strong>' + escHtml(t.title) + '</strong><br>' +
            '<small>' + escHtml(t.city || '') + '</small><br>' +
            '<a href="trip.html?id=' + t.id + '">Открыть</a>'
        );
    });

    if (bounds.length === 1) dhMap.setView(bounds[0], 5);
    else dhMap.fitBounds(bounds, { padding: [30, 30] });
    setTimeout(function () { dhMap.invalidateSize(); }, 60);
}

function loadTrips() {
    showGridLoading();

    api.get('/trips')
        .then(function (result) {
            hideGridLoading();
            trips = Array.isArray(result) ? result : [];
            updateSidebarStats();
            renderHero();
            applyFilter();
        })
        .catch(function (err) {
            hideGridLoading();
            showToast(err.message || 'Не удалось загрузить поездки', 'error');
            renderTrips([]);
        });
}

document.addEventListener('DOMContentLoaded', function () {
    initHeaderScroll();
    initBurger();
    initUserPill();
    initLogout();
    loadUserInfo();
    initFilters();
    initCardMenus();
    initConfirmModal();
    initTripActions();
    loadTrips();
});