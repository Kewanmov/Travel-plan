'use strict';

function qs(sel, ctx)  { return (ctx || document).querySelector(sel); }
function qsa(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }

function initHeaderScroll() {
    var header = qs('#header');
    if (!header) return;
    var onScroll = function () {
        header.classList.toggle('scrolled', window.scrollY > 10);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
}

function initBurger() {
    var burger     = qs('#burger');
    var mobileMenu = qs('#mobileMenu');
    if (!burger || !mobileMenu) return;
    burger.addEventListener('click', function () {
        var isOpen = burger.classList.toggle('open');
        mobileMenu.classList.toggle('open', isOpen);
    });
    qsa('.mobile-menu__link', mobileMenu).forEach(function (link) {
        link.addEventListener('click', function () {
            burger.classList.remove('open');
            mobileMenu.classList.remove('open');
        });
    });
}

function animateCounter(el) {
    var target   = parseInt(el.dataset.target, 10);
    var suffix   = el.dataset.suffix || '';
    var steps    = 50;
    var duration = 1600;
    var stepTime = duration / steps;
    var current  = 0;
    var timer = setInterval(function () {
        current += target / steps;
        if (current >= target) { current = target; clearInterval(timer); }
        el.textContent = Math.floor(current).toLocaleString('ru-RU') + suffix;
    }, stepTime);
}

function initCounters() {
    var els = qsa('[data-target]');
    if (!els.length) return;
    var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
            if (e.isIntersecting && !e.target.dataset.done) {
                e.target.dataset.done = '1';
                animateCounter(e.target);
            }
        });
    }, { threshold: 0.5 });
    els.forEach(function (el) { io.observe(el); });
}

function initReveal() {
    var selectors = ['.feat-card', '.stats__item', '.cta__inner', '.l-step', '.l-feature', '.l-dest'];
    var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
            if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
        });
    }, { threshold: 0.08 });
    selectors.forEach(function (sel) {
        qsa(sel).forEach(function (el, i) {
            if (!sel.startsWith('.l-')) {
                el.classList.add('reveal');
                if (i % 3 === 1) el.classList.add('reveal-d1');
                if (i % 3 === 2) el.classList.add('reveal-d2');
            }
            io.observe(el);
        });
    });
}

function showToast(msg, type) {
    type = type || 'info';
    var wrap = qs('#toasts');
    if (!wrap) return;
    var t = document.createElement('div');
    t.className = 'toast toast--' + type;
    t.textContent = msg;
    wrap.appendChild(t);
    void t.offsetHeight;
    t.classList.add('show');
    function remove() { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 280); }
    t.addEventListener('click', remove);
    setTimeout(remove, 3500);
}

window.showToast = showToast;

function initIndexUser() {
    var token = localStorage.getItem('access_token');
    if (!token) return;

    var user;
    try { user = JSON.parse(localStorage.getItem('user') || '{}'); } catch (e) { user = {}; }
    if (!user || !user.name) return;

    var loginBtn = document.getElementById('loginBtn');
    var pill     = document.getElementById('userPill');
    if (loginBtn) loginBtn.style.display = 'none';
    if (pill)     pill.style.display     = '';

    var name   = user.name  || 'Пользователь';
    var email  = user.email || '';
    var letter = name.charAt(0).toUpperCase();

    var set = function (id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };
    set('headerName', name);
    set('dropName',   name);
    set('dropEmail',  email);

    var avatarEl = document.getElementById('headerAvatar');
    if (avatarEl) {
        if (user.avatar && /^(https?:\/\/|\/uploads\/)/.test(user.avatar)) {
            var origin = '';
            try { if (window.api && api.baseUrl) origin = api.baseUrl.replace(/\/api\/?$/, ''); } catch (e) {}
            var rawUrl = user.avatar.indexOf('http') === 0 ? user.avatar : (origin + user.avatar);
            var url = rawUrl.replace(/'/g, '%27');
            avatarEl.style.backgroundImage    = "url('" + url + "')";
            avatarEl.style.backgroundSize     = 'cover';
            avatarEl.style.backgroundPosition = 'center';
            avatarEl.textContent              = '';
        } else {
            avatarEl.textContent = letter;
        }
    }

    if (pill) {
        document.addEventListener('click', function (e) {
            if (pill.contains(e.target)) pill.classList.toggle('open');
            else pill.classList.remove('open');
        });
    }

    var logout = document.getElementById('logoutBtn');
    if (logout) logout.addEventListener('click', function () {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        window.location.reload();
    });

    var heroBtn = document.querySelector('.l-hero__actions a.l-btn-main');
    if (heroBtn) { heroBtn.href = 'dashboard.html'; heroBtn.firstChild.nodeValue = 'В кабинет '; }
}

document.addEventListener('DOMContentLoaded', function () {
    initHeaderScroll();
    initBurger();
    initCounters();
    initReveal();
    initIndexUser();
});