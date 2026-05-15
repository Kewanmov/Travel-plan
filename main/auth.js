// main/auth.js
'use strict';

function qs(sel) { return document.querySelector(sel); }

function setError(inputId, errorId, msg) {
    var input = qs('#' + inputId);
    var error = qs('#' + errorId);
    if (input) input.classList.toggle('auth-form__input--error', !!msg);
    if (error) {
        error.textContent = msg || '';
        error.classList.toggle('visible', !!msg);
    }
}

function clearAllErrors() {
    document.querySelectorAll('.auth-form__input--error').forEach(function (el) {
        el.classList.remove('auth-form__input--error');
    });
    document.querySelectorAll('.auth-form__error').forEach(function (el) {
        el.textContent = '';
        el.classList.remove('visible');
    });
}

function showAlert(msg, type) {
    var el = qs('#authAlert');
    if (!el) return;
    el.textContent = msg;
    el.className = 'auth-alert' + (type === 'success' ? ' auth-alert--success' : '');
    el.style.display = 'block';
}

function hideAlert() {
    var el = qs('#authAlert');
    if (el) el.style.display = 'none';
}

function setBtnLoading(btn, loading, originalText) {
    if (!btn) return;
    btn.disabled = loading;
    btn.textContent = loading ? 'Подождите...' : originalText;
}

function isEmail(str) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

function initEyeToggles() {
    document.querySelectorAll('.auth-form__eye').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var input = qs('#' + btn.dataset.target);
            if (!input) return;
            var isPass = input.type === 'password';
            input.type = isPass ? 'text' : 'password';
            var open   = btn.querySelector('.eye-open');
            var closed = btn.querySelector('.eye-closed');
            if (open)   open.style.display   = isPass ? 'none'  : 'block';
            if (closed) closed.style.display = isPass ? 'block' : 'none';
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
    if (/[A-Z]/.test(pass))         score++;
    if (/[0-9]/.test(pass))         score++;
    if (/[^A-Za-z0-9]/.test(pass))  score++;

    var levels = [
        { pct: '20%',  color: '#e74c3c', label: 'Очень слабый' },
        { pct: '40%',  color: '#f97316', label: 'Слабый' },
        { pct: '60%',  color: '#f59e0b', label: 'Средний' },
        { pct: '80%',  color: '#22c55e', label: 'Хороший' },
        { pct: '100%', color: '#01abfb', label: 'Отличный' },
    ];
    var level = levels[Math.min(score, 4)];
    if (fill)  { fill.style.width = level.pct; fill.style.background = level.color; }
    if (label) { label.textContent = level.label; label.style.color = level.color; }
}

function initTabs() {
    var tabs       = document.querySelectorAll('.auth-tab');
    var loginForm  = qs('#loginForm');
    var regForm    = qs('#registerForm');
    if (!tabs.length || !loginForm || !regForm) return;

    function switchTab(tab) {
        tabs.forEach(function (t) { t.classList.remove('auth-tab--active'); });
        tab.classList.add('auth-tab--active');
        clearAllErrors();
        hideAlert();

        if (tab.dataset.tab === 'login') {
            loginForm.style.display = '';
            regForm.style.display   = 'none';
        } else {
            loginForm.style.display = 'none';
            regForm.style.display   = '';
        }
    }

    tabs.forEach(function (tab) {
        tab.addEventListener('click', function () { switchTab(tab); });
    });

    if (window.location.hash === '#register') {
        var regTab = document.querySelector('[data-tab="register"]');
        if (regTab) switchTab(regTab);
    }
}

function initLoginForm() {
    var form = qs('#loginForm');
    if (!form) return;

    var btn         = qs('#loginBtn');
    var btnOriginal = btn ? btn.textContent : 'Войти';

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        clearAllErrors();
        hideAlert();

        var email    = ((qs('#loginEmail') || {}).value || '').trim();
        var password = (qs('#loginPassword') || {}).value || '';
        var valid    = true;

        if (!email || !isEmail(email)) {
            setError('loginEmail', 'emailError', 'Введите корректный email');
            valid = false;
        }

        if (!password) {
            setError('loginPassword', 'passwordError', 'Введите пароль');
            valid = false;
        }

        if (!valid) return;

        setBtnLoading(btn, true, btnOriginal);

        var loginData = { email: email, password: password };

        api.post('/auth/login', loginData)
            .then(function (result) {
                localStorage.setItem('access_token', result.token);
                localStorage.setItem('user', JSON.stringify(result.user));

                var redirect = sessionStorage.getItem('redirect_after_login');
                sessionStorage.removeItem('redirect_after_login');
                if (result.user && result.user.role === 'admin') {
                    window.location.replace('admin.html');
                } else {
                    window.location.replace(redirect || 'dashboard.html');
                }
            })
            .catch(function (err) {
                showAlert(err.message || 'Неверный email/логин или пароль');
                setBtnLoading(btn, false, btnOriginal);
            });
    });
}

function initRegisterForm() {
    var form = qs('#registerForm');
    if (!form) return;

    var btn         = qs('#registerBtn');
    var btnOriginal = btn ? btn.textContent : 'Создать аккаунт';

    var passInput = qs('#regPassword');
    if (passInput) {
        passInput.addEventListener('input', function () {
            checkPasswordStrength(passInput.value);
        });
    }

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        clearAllErrors();
        hideAlert();

        var name    = ((qs('#regName')            || {}).value || '').trim();
        var email   = ((qs('#regEmail')           || {}).value || '').trim();
        var pass    = (qs('#regPassword')         || {}).value || '';
        var confirm = (qs('#regPasswordConfirm')  || {}).value || '';
        var agree   = qs('#agree') ? qs('#agree').checked : false;
        var valid   = true;

        if (!name || name.length < 2) {
            setError('regName', 'nameError', 'Имя минимум 2 символа');
            valid = false;
        }

        if (!email || !isEmail(email)) {
            setError('regEmail', 'regEmailError', 'Введите корректный email');
            valid = false;
        }

        if (!pass || pass.length < 8) {
            setError('regPassword', 'regPasswordError', 'Пароль минимум 8 символов');
            valid = false;
        }

        if (pass !== confirm) {
            setError('regPasswordConfirm', 'confirmError', 'Пароли не совпадают');
            valid = false;
        }

        if (!agree) {
            var agreeError = qs('#agreeError');
            if (agreeError) {
                agreeError.textContent = 'Примите условия использования';
                agreeError.classList.add('visible');
            }
            valid = false;
        }

        if (!valid) return;

        setBtnLoading(btn, true, btnOriginal);

        api.post('/auth/register', { name: name, email: email, password: pass })
            .then(function (result) {
                localStorage.setItem('access_token', result.token);
                localStorage.setItem('user', JSON.stringify(result.user));
                window.location.replace('dashboard.html');
            })
            .catch(function (err) {
                showAlert(err.message || 'Ошибка регистрации');
                setBtnLoading(btn, false, btnOriginal);
            });
    });
}

document.addEventListener('DOMContentLoaded', function () {
    initEyeToggles();
    initTabs();
    initLoginForm();
    initRegisterForm();
});