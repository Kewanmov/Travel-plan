// main/utils.js
'use strict';

function escHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatDate(str) {
    if (!str) return '';
    try {
        return new Date(str).toLocaleDateString('ru-RU', {
            day: 'numeric', month: 'long', year: 'numeric'
        });
    } catch (e) { return ''; }
}

function formatDateShort(str) {
    if (!str) return '—';
    try {
        return new Date(str).toLocaleDateString('ru-RU', {
            day: 'numeric', month: 'short'
        });
    } catch (e) { return '—'; }
}

function showToast(msg, type) {
    type = type || 'info';
    var wrap = document.getElementById('toasts');
    if (!wrap) return;

    var t = document.createElement('div');
    t.className = 'toast toast--' + type;
    t.textContent = msg;
    wrap.appendChild(t);

    void t.offsetHeight;
    t.classList.add('show');

    function remove() {
        t.classList.remove('show');
        setTimeout(function () { t.remove(); }, 280);
    }

    t.addEventListener('click', remove);
    setTimeout(remove, 3500);
}

window.showToast = showToast;
window.escHtml   = escHtml;
window.formatDate = formatDate;
window.formatDateShort = formatDateShort;