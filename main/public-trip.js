'use strict';

function ptQs(s) { return document.querySelector(s); }

function ptCalcDays(a, b) {
    if (!a || !b) return 0;
    return Math.max(0, Math.round((new Date(b) - new Date(a)) / 86400000) + 1);
}

function ptDeclDays(n) {
    if (n % 100 >= 11 && n % 100 <= 19) return 'дней';
    var r = n % 10;
    if (r === 1) return 'день';
    if (r >= 2 && r <= 4) return 'дня';
    return 'дней';
}

function ptIcon(num, color) {
    return L.divIcon({
        className: '',
        html: '<div style="width:28px;height:28px;border-radius:50%;background:' + color +
              ';border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4);display:flex;' +
              'align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;font-family:Inter,Arial">' +
              num + '</div>',
        iconSize:   [28, 28],
        iconAnchor: [14, 14],
    });
}

var DAY_COLORS = ['#01abfb', '#4ade80', '#a78bfa', '#fb7185', '#fbbf24', '#22d3ee', '#f97316'];

function ptRenderMap(locations) {
    var map = L.map('ptMap', { zoomControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
    }).addTo(map);

    if (!locations.length) {
        map.setView([55.7558, 37.6176], 4);
        return;
    }

    var bounds = [];
    var byDay  = {};
    locations.forEach(function (loc, i) {
        var lat = parseFloat(loc.lat);
        var lng = parseFloat(loc.lng);
        if (isNaN(lat) || isNaN(lng)) return;
        var d = loc.day_number || 0;
        var color = DAY_COLORS[(d - 1 + DAY_COLORS.length) % DAY_COLORS.length] || '#01abfb';
        bounds.push([lat, lng]);
        byDay[d] = byDay[d] || [];
        byDay[d].push([lat, lng]);

        var marker = L.marker([lat, lng], { icon: ptIcon(i + 1, color) }).addTo(map);
        marker.bindPopup(
            '<strong>' + escHtml(loc.name) + '</strong>' +
            (loc.address ? '<br><small>' + escHtml(loc.address) + '</small>' : '') +
            (loc.note    ? '<br><em>'    + escHtml(loc.note)    + '</em>'    : '')
        );
    });

    Object.keys(byDay).forEach(function (d) {
        var pts = byDay[d];
        if (pts.length < 2) return;
        var color = DAY_COLORS[((+d) - 1 + DAY_COLORS.length) % DAY_COLORS.length] || '#01abfb';
        L.polyline(pts, { color: color, weight: 2.5, opacity: 0.65, dashArray: '6,6' }).addTo(map);
    });

    if (bounds.length === 1) map.setView(bounds[0], 13);
    else map.fitBounds(bounds, { padding: [40, 40] });
}

function ptRenderRoute(locations) {
    var box = ptQs('#ptRoute');
    if (!locations.length) {
        box.innerHTML = '<div class="tp-route__empty">Точки маршрута не добавлены</div>';
        return;
    }

    var html = '';
    var lastDay = null;
    locations.forEach(function (loc, i) {
        var d = loc.day_number;
        if (d && d !== lastDay) {
            html += '<div class="pt-day-head">День ' + d + '</div>';
            lastDay = d;
        }
        var isLast = i === locations.length - 1;
        html += '<div class="tp-route-item">' +
            '<div class="tp-route-item__left">' +
                '<div class="tp-route-item__num">' + (i + 1) + '</div>' +
                (!isLast ? '<div class="tp-route-item__line"></div>' : '') +
            '</div>' +
            '<div class="tp-route-item__info">' +
                '<div class="tp-route-item__name">' + escHtml(loc.name || 'Без названия') +
                    (loc.visit_time ? ' <span style="color:#98a2b3;font-weight:500;font-size:12px">· ' + escHtml(loc.visit_time.slice(0, 5)) + '</span>' : '') +
                '</div>' +
                (loc.address ? '<div class="tp-route-item__note">' + escHtml(loc.address) + '</div>' : '') +
                (loc.note    ? '<div class="tp-route-item__note">' + escHtml(loc.note)    + '</div>' : '') +
            '</div></div>';
    });
    box.innerHTML = html;
}

function ptRender(trip) {
    document.title = (trip.title || 'Поездка') + ' — TravelPlan';

    if (trip.cover_image) {
        ptQs('#ptHeroBg').style.backgroundImage = "url('" + trip.cover_image + "')";
    }

    var loc = [trip.city, trip.country].filter(Boolean).join(', ');
    ptQs('#ptTitle').textContent    = trip.title || 'Без названия';
    ptQs('#ptLocation').textContent = loc || 'Место не указано';
    ptQs('#ptDates').textContent    = formatDate(trip.date_start) + (trip.date_end ? ' — ' + formatDate(trip.date_end) : '');

    var d = ptCalcDays(trip.date_start, trip.date_end);
    var dEl = ptQs('#ptDuration');
    if (d > 0) { dEl.textContent = d + ' ' + ptDeclDays(d); } else { dEl.style.display = 'none'; }

    if (trip.owner_name) {
        ptQs('#ptOwner').textContent = 'Автор: ' + trip.owner_name;
    }

    if (trip.description) {
        ptQs('#ptDescText').textContent = trip.description;
    } else {
        ptQs('#ptDescCard').style.display = 'none';
    }

    var locs = trip.locations || [];
    ptQs('#ptMapSub').textContent = locs.length ? (locs.length + ' точек') : 'Нет точек';

    ptQs('#ptSkeleton').style.display = 'none';
    ptQs('#ptContent').style.display  = '';

    ptRenderMap(locs);
    ptRenderRoute(locs);
}

document.addEventListener('DOMContentLoaded', function () {
    var id = new URLSearchParams(location.search).get('id');
    if (!id) { ptQs('#ptSkeleton').style.display = 'none'; ptQs('#ptError').style.display = ''; return; }

    api.get('/public/trips/' + encodeURIComponent(id))
        .then(ptRender)
        .catch(function () {
            ptQs('#ptSkeleton').style.display = 'none';
            ptQs('#ptError').style.display    = '';
        });
});