// main/guard.js
(function () {
    'use strict';

    var PUBLIC_PAGES  = ['login.html', 'register.html', 'index.html', ''];
    var ADMIN_PAGES   = ['admin.html'];
    var PRIVATE_PAGES = [
        'dashboard.html',
        'trip.html',
        'trip-create.html',
        'profile.html',
        'budget.html',
        'checklist.html',
    ];

    var filename = window.location.pathname.split('/').pop() || 'index.html';

    var token = localStorage.getItem('access_token');
    var user  = null;

    try {
        user = JSON.parse(localStorage.getItem('user') || 'null');
    } catch (e) {
        localStorage.removeItem('user');
    }

    if (token && user) {
        window.currentUser = user;
        window.isLoggedIn  = true;
    } else {
        window.currentUser = null;
        window.isLoggedIn  = false;
        token = null;
        user  = null;
    }

    var isPublic  = PUBLIC_PAGES.indexOf(filename)  !== -1;
    var isAdmin   = ADMIN_PAGES.indexOf(filename)   !== -1;
    var isPrivate = PRIVATE_PAGES.indexOf(filename) !== -1;

    if (isAdmin) {
        if (!token || !user) {
            window.location.replace('login.html');
            return;
        }
        if (user.role !== 'admin') {
            window.location.replace('dashboard.html');
            return;
        }
        return;
    }

    if (isPrivate) {
        if (!token || !user) {
            sessionStorage.setItem('redirect_after_login', window.location.href);
            window.location.replace('login.html');
            return;
        }
        return;
    }

    if (isPublic) {
        if (filename === 'login.html' || filename === 'register.html') {
            if (token && user) {
                if (user.role === 'admin') {
                    window.location.replace('admin.html');
                } else {
                    window.location.replace('dashboard.html');
                }
                return;
            }
        }
    }

})();