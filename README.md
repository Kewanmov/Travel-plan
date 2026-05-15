<!-- README.md -->
# TravelPlan — Веб-приложение для планирования путешествий

Курсовая работа по дисциплине «Веб-разработка».

## Описание

TravelPlan — это веб-приложение для совместного планирования поездок. Позволяет создавать маршруты, управлять бюджетом, вести чек-листы и приглашать участников с разными уровнями доступа.

## Функциональность

- Регистрация и авторизация (JWT + bcrypt)
- Создание и управление поездками (роли: владелец / редактор / наблюдатель)
- Маршруты: локации по дням с временем и описанием
- Бюджет с поддержкой нескольких валют и конвертацией
- Чек-листы с приоритетами и отметками о выполнении
- Приглашения участников по токену
- Интеграция с 2GIS для поиска мест
- Панель администратора со статистикой

## Стек технологий

**Бэкенд:** Python 3, FastAPI, SQLAlchemy, MySQL, JWT

**Фронтенд:** HTML5, CSS3, Vanilla JavaScript (ES Modules)

**База данных:** MySQL

## Запуск проекта

### Требования

- Python 3.10+
- MySQL
- Node.js (не обязателен — фронтенд статический)

### Установка

1. Клонировать репозиторий:
   ```bash
   git clone <url>
   cd travel_plan
   ```

2. Установить зависимости бэкенда:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

3. Создать файл `backend/.env`:
   ```
   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=travel_planner
   DB_USER=root
   DB_PASSWORD=your_password
   SECRET_KEY=your_secret_key
   ```

4. Импортировать схему базы данных:
   ```sql
   mysql -u root -p travel_planner < db/travel_planner.sql
   ```

5. Запустить бэкенд:
   ```bash
   uvicorn main:app --reload --port 8000
   ```

6. Открыть `index.html` через локальный HTTP-сервер (например, OSPanel).

## Структура проекта

```
travel_plan/
├── backend/          # FastAPI приложение
│   ├── main.py       # Точка входа, регистрация роутеров
│   ├── core/         # Безопасность, зависимости
│   ├── models/       # SQLAlchemy модели
│   ├── schemas/      # Pydantic схемы
│   └── routers/      # Роутеры по доменам
├── main/             # JavaScript (ES Modules)
├── style/            # CSS стили
├── db/               # SQL схема
└── *.html            # Страницы приложения
```

## Автор

Разработчик: [@kewanmov](https://t.me/kewanmov)

Год: 2026
