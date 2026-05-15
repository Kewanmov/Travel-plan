// main/header-user.js
'use strict';

(function () {
    function avatarOrigin() {
        return (window.api && api.baseUrl) ? api.baseUrl.replace(/\/api\/?$/, '') : '';
    }

    function paint(user) {
        if (!user) return;
        var name   = user.name  || 'Пользователь';
        var email  = user.email || '';
        var letter = name.charAt(0).toUpperCase();

        ['#headerAvatar', '#topbarAvatar', '#profileAvatar'].forEach(function (sel) {
            var el = document.querySelector(sel);
            if (!el) return;
            if (user.avatar && /^(https?:\/\/|\/uploads\/)/.test(user.avatar)) {
                var rawUrl = user.avatar.indexOf('http') === 0 ? user.avatar : (avatarOrigin() + user.avatar);
                var url = rawUrl.replace(/'/g, '%27');
                el.style.backgroundImage    = "url('" + url + "')";
                el.style.backgroundSize     = 'cover';
                el.style.backgroundPosition = 'center';
                el.style.color              = 'transparent';
                el.textContent              = '';
            } else {
                el.style.backgroundImage = '';
                el.style.color           = '';
                el.textContent           = letter;
            }
        });

        var pairs = {
            headerName: name, topbarName: name,
            dropName:   name, dropEmail: email,
        };
        Object.keys(pairs).forEach(function (id) {
            var el = document.getElementById(id);
            if (el && !el.dataset.skipHeaderUser) el.textContent = pairs[id];
        });

        var avDel = document.getElementById('avatarDelBtn');
        if (avDel) avDel.style.display = user.avatar ? '' : 'none';

        var profileLink = document.querySelector('.user-pill__dropdown-item[href="profile.html"]');
        if (profileLink && user.role === 'admin' && !document.getElementById('adminPanelLink')) {
            var adminLink = document.createElement('a');
            adminLink.href = 'admin.html';
            adminLink.id = 'adminPanelLink';
            adminLink.className = profileLink.className;
            adminLink.innerHTML =
                '<svg width="15" height="15" viewBox="0 0 24 24" fill="none">' +
                '<path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' +
                '<path d="M2 17l10 5 10-5" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' +
                '<path d="M2 12l10 5 10-5" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' +
                '</svg>Админ-панель';
            profileLink.parentNode.insertBefore(adminLink, profileLink);
        }
    }

    function init() {
        if (!localStorage.getItem('access_token')) return;
        var cached = {};
        try { cached = JSON.parse(localStorage.getItem('user') || '{}'); } catch (e) {}
        paint(cached);
        if (window.api) {
            api.get('/auth/me').then(function (res) {
                var u = (res && res.user) ? res.user : res;
                if (!u) return;
                var stored = JSON.parse(localStorage.getItem('user') || '{}');
                Object.assign(stored, u);
                localStorage.setItem('user', JSON.stringify(stored));
                paint(stored);
            }).catch(function () {});
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();