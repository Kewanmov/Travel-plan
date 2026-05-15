// main/notifications-bell.js
'use strict';

(function () {
    var POLL_MS = 30000;
    var TYPE_LABELS = {
        trip_invite:   'Приглашение',
        trip_update:   'Обновление',
        member_joined: 'Новый участник',
        member_left:   'Участник вышел',
        task_assigned: 'Задача назначена',
        task_done:     'Задача выполнена',
        budget_limit:  'Лимит бюджета',
        trip_reminder: 'Напоминание',
    };

    function el(html) {
        var t = document.createElement('template');
        t.innerHTML = html.trim();
        return t.content.firstChild;
    }

    function fmtTime(s) {
        if (!s) return '';
        try {
            var d = new Date(s.replace(' ', 'T') + 'Z');
            var diffMin = Math.round((Date.now() - d.getTime()) / 60000);
            if (diffMin < 1) return 'только что';
            if (diffMin < 60) return diffMin + ' мин назад';
            if (diffMin < 1440) return Math.round(diffMin / 60) + ' ч назад';
            return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
        } catch (e) { return ''; }
    }

    function injectStyles() {
        if (document.getElementById('nbStyles')) return;
        var css =
            '.nb-wrap{position:relative;margin-right:8px}' +
            '.nb-btn{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);' +
            'width:38px;height:38px;border-radius:10px;color:#fff;cursor:pointer;display:flex;' +
            'align-items:center;justify-content:center;position:relative;transition:background .15s}' +
            '.nb-btn:hover{background:rgba(255,255,255,.12)}' +
            '.nb-badge{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;padding:0 5px;' +
            'border-radius:9px;background:#ef4444;color:#fff;font-size:10px;font-weight:700;' +
            'display:flex;align-items:center;justify-content:center;border:2px solid #0f1116}' +
            '.nb-pop{position:absolute;top:48px;right:0;width:360px;max-height:480px;' +
            'background:#161922;border:1px solid rgba(255,255,255,.08);border-radius:12px;' +
            'box-shadow:0 12px 40px rgba(0,0,0,.6);overflow:hidden;display:none;flex-direction:column;z-index:1000}' +
            '.nb-pop.open{display:flex}' +
            '.nb-head{padding:14px 16px;display:flex;justify-content:space-between;align-items:center;' +
            'border-bottom:1px solid rgba(255,255,255,.06)}' +
            '.nb-head h4{margin:0;color:#fff;font-size:14px;font-weight:700}' +
            '.nb-head button{background:none;border:0;color:#01abfb;font-size:12px;cursor:pointer;padding:4px 6px}' +
            '.nb-head button:hover{text-decoration:underline}' +
            '.nb-list{overflow-y:auto;flex:1}' +
            '.nb-item{padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.04);cursor:pointer;' +
            'transition:background .15s;position:relative}' +
            '.nb-item:hover{background:rgba(255,255,255,.03)}' +
            '.nb-item.unread{background:rgba(1,171,251,.06)}' +
            '.nb-item.unread::before{content:"";position:absolute;left:6px;top:18px;' +
            'width:6px;height:6px;border-radius:50%;background:#01abfb}' +
            '.nb-type{font-size:10px;color:#01abfb;font-weight:600;text-transform:uppercase;letter-spacing:.5px}' +
            '.nb-title{color:#fff;font-size:13px;font-weight:600;margin:3px 0 2px}' +
            '.nb-msg{color:#98a2b3;font-size:12px;line-height:1.4}' +
            '.nb-time{color:#667085;font-size:11px;margin-top:4px}' +
            '.nb-empty{padding:40px 20px;text-align:center;color:#667085;font-size:13px}';
        var s = document.createElement('style');
        s.id = 'nbStyles';
        s.textContent = css;
        document.head.appendChild(s);
    }

    function buildBell() {
        return el(
            '<div class="nb-wrap" id="nbWrap">' +
            '  <button class="nb-btn" id="nbBtn" aria-label="Уведомления">' +
            '    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">' +
            '      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
            '      <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
            '    </svg>' +
            '    <span class="nb-badge" id="nbBadge" style="display:none">0</span>' +
            '  </button>' +
            '  <div class="nb-pop" id="nbPop">' +
            '    <div class="nb-head">' +
            '      <h4>Уведомления</h4>' +
            '      <button id="nbReadAll">Прочитать все</button>' +
            '    </div>' +
            '    <div class="nb-list" id="nbList"></div>' +
            '  </div>' +
            '</div>'
        );
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function render(list) {
        var box = document.getElementById('nbList');
        if (!box) return;
        if (!list.length) {
            box.innerHTML = '<div class="nb-empty">Уведомлений пока нет</div>';
            return;
        }
        box.innerHTML = list.map(function (n) {
            return '<div class="nb-item' + (n.is_read ? '' : ' unread') + '" data-id="' + n.id + '"' +
                   (n.data && n.data.trip_id ? ' data-trip="' + parseInt(n.data.trip_id) + '"' : '') + '>' +
                '<div class="nb-type">' + escapeHtml(TYPE_LABELS[n.type] || n.type) + '</div>' +
                '<div class="nb-title">' + escapeHtml(n.title) + '</div>' +
                (n.message ? '<div class="nb-msg">' + escapeHtml(n.message) + '</div>' : '') +
                '<div class="nb-time">' + fmtTime(n.created_at) + '</div>' +
            '</div>';
        }).join('');

        box.querySelectorAll('.nb-item').forEach(function (it) {
            it.addEventListener('click', function () {
                var id = parseInt(it.dataset.id);
                var trip = it.dataset.trip;
                if (!it.classList.contains('unread')) {
                    if (trip) window.location.href = 'trip.html?id=' + trip;
                    return;
                }
                api.post('/notifications/' + id + '/read').catch(function () {});
                it.classList.remove('unread');
                tickBadge(-1);
                if (trip) {
                    setTimeout(function () { window.location.href = 'trip.html?id=' + trip; }, 100);
                }
            });
        });
    }

    function tickBadge(delta) {
        var b = document.getElementById('nbBadge');
        if (!b) return;
        var cur = parseInt(b.textContent) || 0;
        cur = Math.max(0, cur + delta);
        if (cur === 0) { b.style.display = 'none'; b.textContent = '0'; }
        else { b.style.display = ''; b.textContent = cur > 99 ? '99+' : String(cur); }
    }

    function setBadge(n) {
        var b = document.getElementById('nbBadge');
        if (!b) return;
        if (!n) { b.style.display = 'none'; b.textContent = '0'; }
        else { b.style.display = ''; b.textContent = n > 99 ? '99+' : String(n); }
    }

    function refreshCount() {
        if (!localStorage.getItem('access_token')) return;
        api.get('/notifications/unread-count')
            .then(function (r) { setBadge(r && r.count); })
            .catch(function () {});
    }

    function loadList() {
        api.get('/notifications?limit=15')
            .then(function (list) { render(Array.isArray(list) ? list : []); })
            .catch(function () { render([]); });
    }

    function init() {
        if (!window.api) return;
        if (!localStorage.getItem('access_token')) return;
        var anchor = document.querySelector('#userPill');
        if (!anchor || document.getElementById('nbWrap')) return;

        injectStyles();
        var bell = buildBell();
        anchor.parentNode.insertBefore(bell, anchor);

        var btn = document.getElementById('nbBtn');
        var pop = document.getElementById('nbPop');

        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            var open = pop.classList.toggle('open');
            if (open) loadList();
        });
        document.addEventListener('click', function (e) {
            if (!pop.contains(e.target) && e.target !== btn) pop.classList.remove('open');
        });

        document.getElementById('nbReadAll').addEventListener('click', function (e) {
            e.stopPropagation();
            api.post('/notifications/read-all').then(function () {
                setBadge(0);
                loadList();
            }).catch(function () {});
        });

        refreshCount();
        setInterval(refreshCount, POLL_MS);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();