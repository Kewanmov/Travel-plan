// main/api.js
'use strict';

const API_BASE = (typeof window !== 'undefined' && window.__API_BASE__) || 'http://127.0.0.1:8000/api';

class ApiClient {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
    }

    _getHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        const token = localStorage.getItem('access_token');
        if (token) {
            headers['Authorization'] = 'Bearer ' + token;
        }
        return headers;
    }

    async _request(method, url, body) {
        body = body || null;

        const options = {
            method:  method,
            headers: this._getHeaders(),
        };

        if (body !== null && method !== 'GET') {
            options.body = JSON.stringify(body);
        }

        let response;
        try {
            response = await fetch(this.baseUrl + url, options);
        } catch (e) {
            console.error('[API] Сетевая ошибка:', e);
            throw new Error('Нет соединения с сервером');
        }

        if (response.status === 204) {
            return null;
        }

        const text = await response.text();
        let data = null;

        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error('[API] Ответ не JSON:', text);
            throw new Error('Некорректный ответ сервера');
        }

        if (response.status === 401) {
            localStorage.removeItem('access_token');
            localStorage.removeItem('user');
            const isAuthPage = ['login.html', 'register.html', 'index.html'].some(function(p) {
                return window.location.pathname.includes(p);
            });
            if (!isAuthPage) {
                window.location.href = 'login.html';
            }
            throw new Error(data.detail || 'Необходима авторизация');
        }

        if (response.status === 403) {
            throw new Error(data.detail || 'Доступ запрещён');
        }

        if (response.status === 422) {
            const detail = data.detail;
            if (Array.isArray(detail)) {
                throw new Error(detail.map(function(e) { return e.msg; }).join(', '));
            }
            throw new Error('Ошибка валидации данных');
        }

        if (!response.ok) {
            const msg = (data && (data.detail || data.message)) || 'Ошибка сервера';
            throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
        }

        if (data && typeof data === 'object' && 'data' in data) {
            return data.data;
        }

        return data;
    }

    async upload(url, formData) {
        const headers = {};
        const token = localStorage.getItem('access_token');
        if (token) headers['Authorization'] = 'Bearer ' + token;
        let response;
        try {
            response = await fetch(this.baseUrl + url, { method: 'POST', headers, body: formData });
        } catch (e) {
            throw new Error('Нет соединения с сервером');
        }
        const text = await response.text();
        let data = null;
        try { data = JSON.parse(text); } catch (e) {}
        if (!response.ok) {
            const msg = (data && (data.detail || data.message)) || 'Ошибка загрузки';
            throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
        }
        if (data && typeof data === 'object' && 'data' in data) return data.data;
        return data;
    }

    get(url)         { return this._request('GET',    url); }
    post(url, body)  { return this._request('POST',   url, body); }
    put(url, body)   { return this._request('PUT',    url, body); }
    patch(url, body) { return this._request('PATCH',  url, body); }
    delete(url, body){ return this._request('DELETE', url, body); }
}

const api = new ApiClient(API_BASE);
window.api = api;