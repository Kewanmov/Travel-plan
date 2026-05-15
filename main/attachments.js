// main/attachments.js
'use strict';

(function () {
    function buildOrigin() {
        if (window.api && api.baseUrl) {
            return api.baseUrl.replace(/\/api\/?$/, '');
        }
        return '';
    }

    function isImage(mime) {
        return mime && mime.indexOf('image/') === 0;
    }

    function fmtSize(b) {
        if (b < 1024) return b + ' B';
        if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
        return (b / 1024 / 1024).toFixed(1) + ' MB';
    }

    function injectStyles() {
        if (document.getElementById('attStyles')) return;
        var css =
            '.att-gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;margin-top:12px}' +
            '.att-item{position:relative;aspect-ratio:1;border-radius:8px;overflow:hidden;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);cursor:pointer}' +
            '.att-item img{width:100%;height:100%;object-fit:cover;display:block}' +
            '.att-item .att-doc{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#98a2b3;font-size:11px;text-align:center;padding:8px;gap:6px}' +
            '.att-del{position:absolute;top:4px;right:4px;width:22px;height:22px;border-radius:50%;background:rgba(0,0,0,.6);border:0;color:#fff;cursor:pointer;display:none;align-items:center;justify-content:center;font-size:14px;line-height:1}' +
            '.att-item:hover .att-del{display:flex}' +
            '.att-empty{padding:18px;color:#667085;font-size:13px;text-align:center;border:1px dashed rgba(255,255,255,.12);border-radius:8px;margin-top:10px}' +
            '.att-upload{display:inline-flex;align-items:center;gap:8px;padding:8px 14px;background:#01abfb;color:#fff;border:0;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;margin-top:10px}' +
            '.att-upload:hover{background:#0294dc}' +
            '.att-upload[disabled]{opacity:.6;cursor:wait}' +
            '.att-lightbox{position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;cursor:zoom-out}' +
            '.att-lightbox img{max-width:95%;max-height:95%;border-radius:8px;box-shadow:0 20px 60px rgba(0,0,0,.6)}';
        var s = document.createElement('style');
        s.id = 'attStyles';
        s.textContent = css;
        document.head.appendChild(s);
    }

    function lightbox(url) {
        var box = document.createElement('div');
        box.className = 'att-lightbox';
        box.innerHTML = '<img src="' + url + '">';
        box.addEventListener('click', function () { box.remove(); });
        document.body.appendChild(box);
    }

    function mount(opts) {
        injectStyles();
        var container    = opts.container;
        var tripId       = opts.tripId;
        var locationId   = opts.locationId   || null;
        var budgetItemId = opts.budgetItemId || null;
        var kind         = opts.kind || (budgetItemId ? 'receipt' : 'photo');
        var canEdit      = opts.canEdit !== false;
        var origin       = buildOrigin();

        if (!container || !tripId) return;

        container.innerHTML = '<div class="att-gallery" data-att-list></div>' +
            (canEdit
                ? '<label class="att-upload">' +
                    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none">' +
                    '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>' +
                    '</svg> Загрузить' +
                    '<input type="file" data-att-input style="display:none" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf">' +
                    '</label>'
                : '');

        var listEl  = container.querySelector('[data-att-list]');
        var inputEl = container.querySelector('[data-att-input]');
        var btnEl   = container.querySelector('.att-upload');

        function render(items) {
            if (!items.length) {
                listEl.innerHTML = '<div class="att-empty">Пока нет вложений</div>';
                return;
            }
            listEl.innerHTML = items.map(function (a) {
                var url = origin + a.url;
                var preview = isImage(a.mime_type)
                    ? '<img src="' + url + '" alt="' + escHtml(a.original_name) + '">'
                    : '<div class="att-doc">' +
                        '<svg width="32" height="32" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="1.6"/><polyline points="14 2 14 8 20 8" stroke="currentColor" stroke-width="1.6"/></svg>' +
                        '<span>' + escHtml(a.original_name) + '</span>' +
                        '<small>' + fmtSize(a.size_bytes) + '</small>' +
                      '</div>';
                return '<div class="att-item" data-id="' + a.id + '" data-url="' + url +
                       '" data-mime="' + escHtml(a.mime_type) + '">' +
                       preview +
                       (canEdit ? '<button class="att-del" title="Удалить">&times;</button>' : '') +
                       '</div>';
            }).join('');

            listEl.querySelectorAll('.att-item').forEach(function (it) {
                it.addEventListener('click', function (e) {
                    if (e.target.closest('.att-del')) {
                        e.stopPropagation();
                        if (!confirm('Удалить файл?')) return;
                        var id = it.dataset.id;
                        api.delete('/attachments/' + id).then(refresh).catch(function (err) {
                            if (window.showToast) showToast(err.message, 'error');
                        });
                        return;
                    }
                    var mime = it.dataset.mime || '';
                    var url  = it.dataset.url;
                    if (isImage(mime)) lightbox(url);
                    else window.open(url, '_blank');
                });
            });
        }

        function refresh() {
            var qs = new URLSearchParams();
            if (locationId)        qs.set('location_id', locationId);
            else if (budgetItemId) qs.set('budget_item_id', budgetItemId);
            else                   qs.set('trip_id', tripId);
            api.get('/attachments?' + qs.toString())
                .then(function (d) { render(Array.isArray(d) ? d : []); })
                .catch(function () { render([]); });
        }

        if (inputEl) {
            inputEl.addEventListener('change', function () {
                var file = inputEl.files && inputEl.files[0];
                if (!file) return;
                var fd = new FormData();
                fd.append('file', file);
                fd.append('trip_id', tripId);
                fd.append('kind', kind);
                if (locationId)   fd.append('location_id',    locationId);
                if (budgetItemId) fd.append('budget_item_id', budgetItemId);

                btnEl.setAttribute('disabled', 'disabled');
                api.upload('/attachments', fd)
                    .then(function () {
                        if (window.showToast) showToast('Файл загружен', 'success');
                        refresh();
                    })
                    .catch(function (err) {
                        if (window.showToast) showToast(err.message, 'error');
                    })
                    .finally(function () {
                        btnEl.removeAttribute('disabled');
                        inputEl.value = '';
                    });
            });
        }

        refresh();
        return { refresh: refresh };
    }

    window.attachments = { mount: mount };
})();