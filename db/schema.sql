-- db/schema.sql
-- ====================================================================
--  TravelPlan — полная схема БД
--  Применить:  mysql -u root travel_plan < db/schema.sql
--  ВНИМАНИЕ: дропает все таблицы и пересоздаёт с нуля. Данные потеряются.
-- ====================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET FOREIGN_KEY_CHECKS = 0;

-- ── DROP всех таблиц (порядок не важен из-за FOREIGN_KEY_CHECKS=0) ──
DROP TABLE IF EXISTS trip_comments;
DROP TABLE IF EXISTS attachments;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS invitations;
DROP TABLE IF EXISTS budget_items;
DROP TABLE IF EXISTS budget_categories;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS task_categories;
DROP TABLE IF EXISTS trip_itinerary;
DROP TABLE IF EXISTS locations;
DROP TABLE IF EXISTS location_categories;
DROP TABLE IF EXISTS trip_notes;
DROP TABLE IF EXISTS trip_tags;
DROP TABLE IF EXISTS trip_members;
DROP TABLE IF EXISTS trips;
DROP TABLE IF EXISTS user_settings;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS currency_rates_history;
DROP TABLE IF EXISTS currencies;
DROP TABLE IF EXISTS api_cache;

SET FOREIGN_KEY_CHECKS = 1;


-- ====================================================================
--  Справочники (без FK на динамические таблицы)
-- ====================================================================

CREATE TABLE currencies (
    id          INT NOT NULL AUTO_INCREMENT,
    code        VARCHAR(10)  NOT NULL,
    name        VARCHAR(100) NOT NULL,
    symbol      VARCHAR(10)  NOT NULL,
    rate_to_rub DECIMAL(10, 4) NOT NULL DEFAULT 1.0000,
    is_active   TINYINT(1)   NOT NULL DEFAULT 1,
    updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_currency_code (code),
    KEY idx_currency_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE budget_categories (
    id    INT NOT NULL AUTO_INCREMENT,
    slug  VARCHAR(50)  NOT NULL,
    name  VARCHAR(100) NOT NULL,
    icon  VARCHAR(50)  DEFAULT NULL,
    color VARCHAR(20)  DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_bcat_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE task_categories (
    id    INT NOT NULL AUTO_INCREMENT,
    slug  VARCHAR(50)  NOT NULL,
    name  VARCHAR(100) NOT NULL,
    color VARCHAR(20)  DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_tcat_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE location_categories (
    id          INT NOT NULL AUTO_INCREMENT,
    slug        VARCHAR(50)  NOT NULL,
    name        VARCHAR(100) NOT NULL,
    icon        VARCHAR(50)  DEFAULT NULL,
    color       VARCHAR(20)  DEFAULT NULL,
    google_type VARCHAR(100) DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_lcat_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Кэш ответов внешних API (OpenWeather, 2GIS)
CREATE TABLE api_cache (
    id         INT NOT NULL AUTO_INCREMENT,
    cache_key  VARCHAR(255) NOT NULL,
    endpoint   VARCHAR(100) NOT NULL,
    response   JSON NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_cache_key (cache_key),
    KEY idx_cache_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ====================================================================
--  Пользователи
-- ====================================================================

CREATE TABLE users (
    id            INT NOT NULL AUTO_INCREMENT,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(100) NOT NULL,
    password      VARCHAR(255) NOT NULL,
    role          ENUM('user', 'admin') NOT NULL DEFAULT 'user',
    avatar        VARCHAR(255) DEFAULT NULL,
    bio           TEXT DEFAULT NULL,
    phone         VARCHAR(20)  DEFAULT NULL,
    is_active     TINYINT(1)   NOT NULL DEFAULT 1,
    last_login_at TIMESTAMP NULL DEFAULT NULL,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_user_email (email),
    KEY idx_user_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_settings (
    user_id              INT NOT NULL,
    default_currency_id  INT NOT NULL DEFAULT 1,
    language             VARCHAR(10) NOT NULL DEFAULT 'ru',
    timezone             VARCHAR(50) NOT NULL DEFAULT 'Europe/Moscow',
    notify_invites       TINYINT(1)  NOT NULL DEFAULT 1,
    notify_updates       TINYINT(1)  NOT NULL DEFAULT 1,
    notify_reminders     TINYINT(1)  NOT NULL DEFAULT 1,
    reminder_days        TINYINT     NOT NULL DEFAULT 3,
    updated_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    KEY idx_us_currency (default_currency_id),
    CONSTRAINT fk_us_user     FOREIGN KEY (user_id)             REFERENCES users(id)      ON DELETE CASCADE,
    CONSTRAINT fk_us_currency FOREIGN KEY (default_currency_id) REFERENCES currencies(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE currency_rates_history (
    id          INT NOT NULL AUTO_INCREMENT,
    currency_id INT NOT NULL,
    rate_to_rub DECIMAL(10, 4) NOT NULL,
    source      VARCHAR(50) DEFAULT 'api',
    recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_crh_currency_date (currency_id, recorded_at),
    CONSTRAINT fk_crh_currency FOREIGN KEY (currency_id) REFERENCES currencies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ====================================================================
--  Поездки
-- ====================================================================

CREATE TABLE trips (
    id                 INT NOT NULL AUTO_INCREMENT,
    user_id            INT NOT NULL,
    title              VARCHAR(255) NOT NULL,
    description        TEXT DEFAULT NULL,
    city               VARCHAR(255) NOT NULL,
    country            VARCHAR(100) DEFAULT NULL,
    country_code       VARCHAR(5)   DEFAULT NULL,
    timezone           VARCHAR(50)  DEFAULT NULL,
    date_start         DATE NOT NULL,
    date_end           DATE NOT NULL,
    cover_image        VARCHAR(255) DEFAULT NULL,
    cover_image_source ENUM('upload', 'api', 'url') DEFAULT 'upload',
    base_currency_id   INT NOT NULL DEFAULT 1,
    budget_limit       DECIMAL(10, 2) DEFAULT NULL,
    status             ENUM('draft', 'active', 'completed', 'archived') NOT NULL DEFAULT 'active',
    is_public          TINYINT(1) NOT NULL DEFAULT 0,
    created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_trip_user     (user_id),
    KEY idx_trip_dates    (date_start, date_end),
    KEY idx_trip_status   (status),
    KEY idx_trip_public   (is_public),
    KEY idx_trip_currency (base_currency_id),
    CONSTRAINT fk_trips_user     FOREIGN KEY (user_id)          REFERENCES users(id)      ON DELETE CASCADE,
    CONSTRAINT fk_trips_currency FOREIGN KEY (base_currency_id) REFERENCES currencies(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE trip_members (
    id         INT NOT NULL AUTO_INCREMENT,
    trip_id    INT NOT NULL,
    user_id    INT NOT NULL,
    role       ENUM('owner', 'editor', 'viewer') NOT NULL DEFAULT 'viewer',
    status     ENUM('pending', 'accepted', 'declined') NOT NULL DEFAULT 'pending',
    invited_by INT NOT NULL,
    joined_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_tm_member  (trip_id, user_id),
    KEY idx_tm_trip_user (trip_id, user_id),
    KEY idx_tm_user      (user_id),
    KEY idx_tm_status    (status),
    KEY idx_tm_invited   (invited_by),
    CONSTRAINT fk_tm_trip    FOREIGN KEY (trip_id)    REFERENCES trips(id) ON DELETE CASCADE,
    CONSTRAINT fk_tm_user    FOREIGN KEY (user_id)    REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_tm_invited FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE trip_tags (
    id      INT NOT NULL AUTO_INCREMENT,
    trip_id INT NOT NULL,
    tag     VARCHAR(50) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_tt_trip_tag (trip_id, tag),
    KEY idx_tt_tag (tag),
    CONSTRAINT fk_tt_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE trip_notes (
    id         INT NOT NULL AUTO_INCREMENT,
    trip_id    INT NOT NULL,
    added_by   INT NOT NULL,
    title      VARCHAR(255) DEFAULT NULL,
    content    TEXT NOT NULL,
    color      VARCHAR(20) DEFAULT NULL,
    is_pinned  TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_tn_trip    (trip_id),
    KEY idx_tn_pinned  (trip_id, is_pinned),
    KEY idx_tn_user    (added_by),
    CONSTRAINT fk_tn_trip FOREIGN KEY (trip_id)  REFERENCES trips(id) ON DELETE CASCADE,
    CONSTRAINT fk_tn_user FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ====================================================================
--  Локации и маршрут
-- ====================================================================

CREATE TABLE locations (
    id           INT NOT NULL AUTO_INCREMENT,
    trip_id      INT NOT NULL,
    added_by     INT NOT NULL,
    name         VARCHAR(255) NOT NULL,
    address      VARCHAR(500) DEFAULT NULL,
    lat          DECIMAL(10, 8) NOT NULL,
    lng          DECIMAL(11, 8) NOT NULL,
    place_id     VARCHAR(255) DEFAULT NULL,
    place_source ENUM('google', 'osm', 'manual', '2gis') DEFAULT 'manual',
    category_id  INT DEFAULT NULL,
    note         TEXT DEFAULT NULL,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_loc_trip      (trip_id),
    KEY idx_loc_user      (added_by),
    KEY idx_loc_place_id  (place_id),
    KEY idx_loc_category  (category_id),
    CONSTRAINT fk_loc_trip     FOREIGN KEY (trip_id)     REFERENCES trips(id)               ON DELETE CASCADE,
    CONSTRAINT fk_loc_user     FOREIGN KEY (added_by)    REFERENCES users(id)               ON DELETE CASCADE,
    CONSTRAINT fk_loc_category FOREIGN KEY (category_id) REFERENCES location_categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE trip_itinerary (
    id                     INT NOT NULL AUTO_INCREMENT,
    trip_id                INT NOT NULL,
    location_id            INT NOT NULL,
    day_number             TINYINT NOT NULL DEFAULT 1,
    visit_date             DATE DEFAULT NULL,
    visit_time             TIME DEFAULT NULL,
    duration_min           INT DEFAULT NULL,
    order_index            INT NOT NULL DEFAULT 0,
    is_visited             TINYINT(1) NOT NULL DEFAULT 0,
    visited_at             TIMESTAMP NULL DEFAULT NULL,
    transport_to           ENUM('walk','car','taxi','bus','metro','train','boat','other') DEFAULT NULL,
    transport_duration_min INT DEFAULT NULL,
    note                   TEXT DEFAULT NULL,
    created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_itin_trip     (trip_id),
    KEY idx_itin_location (location_id),
    KEY idx_itin_day      (trip_id, day_number, order_index),
    KEY idx_itin_date     (visit_date),
    CONSTRAINT fk_itin_trip     FOREIGN KEY (trip_id)     REFERENCES trips(id)     ON DELETE CASCADE,
    CONSTRAINT fk_itin_location FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ====================================================================
--  Задачи / чек-лист
-- ====================================================================

CREATE TABLE tasks (
    id          INT NOT NULL AUTO_INCREMENT,
    trip_id     INT NOT NULL,
    added_by    INT NOT NULL,
    category_id INT DEFAULT NULL,
    title       VARCHAR(255) NOT NULL,
    description TEXT DEFAULT NULL,
    priority    ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'medium',
    is_done     TINYINT(1) NOT NULL DEFAULT 0,
    done_by     INT DEFAULT NULL,
    done_at     TIMESTAMP NULL DEFAULT NULL,
    due_date    DATE DEFAULT NULL,
    order_index INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_tasks_trip      (trip_id),
    KEY idx_tasks_trip_done (trip_id, is_done),
    KEY idx_tasks_user      (added_by),
    KEY idx_tasks_done      (done_by),
    KEY idx_tasks_category  (category_id),
    KEY idx_tasks_due       (due_date),
    KEY idx_tasks_order     (trip_id, order_index),
    CONSTRAINT fk_tasks_trip     FOREIGN KEY (trip_id)     REFERENCES trips(id)           ON DELETE CASCADE,
    CONSTRAINT fk_tasks_user     FOREIGN KEY (added_by)    REFERENCES users(id)           ON DELETE CASCADE,
    CONSTRAINT fk_tasks_done     FOREIGN KEY (done_by)     REFERENCES users(id)           ON DELETE SET NULL,
    CONSTRAINT fk_tasks_category FOREIGN KEY (category_id) REFERENCES task_categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ====================================================================
--  Бюджет
-- ====================================================================

CREATE TABLE budget_items (
    id             INT NOT NULL AUTO_INCREMENT,
    trip_id        INT NOT NULL,
    added_by       INT NOT NULL,
    category_id    INT DEFAULT NULL,
    title          VARCHAR(255) NOT NULL,
    amount         DECIMAL(10, 2) NOT NULL,
    currency_id    INT NOT NULL,
    amount_in_base DECIMAL(10, 2) DEFAULT NULL,
    is_paid        TINYINT(1) NOT NULL DEFAULT 0,
    paid_by        INT DEFAULT NULL,
    paid_at        TIMESTAMP NULL DEFAULT NULL,
    location_id    INT DEFAULT NULL,
    itinerary_id   INT DEFAULT NULL,
    receipt_image  VARCHAR(255) DEFAULT NULL,
    note           TEXT DEFAULT NULL,
    created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_bi_trip          (trip_id),
    KEY idx_bi_trip_currency (trip_id, currency_id),
    KEY idx_bi_user          (added_by),
    KEY idx_bi_category      (category_id),
    KEY idx_bi_paid_by       (paid_by),
    KEY idx_bi_currency      (currency_id),
    KEY idx_bi_location      (location_id),
    KEY idx_bi_itinerary     (itinerary_id),
    CONSTRAINT fk_bi_trip      FOREIGN KEY (trip_id)      REFERENCES trips(id)             ON DELETE CASCADE,
    CONSTRAINT fk_bi_user      FOREIGN KEY (added_by)     REFERENCES users(id)             ON DELETE CASCADE,
    CONSTRAINT fk_bi_paid      FOREIGN KEY (paid_by)      REFERENCES users(id)             ON DELETE SET NULL,
    CONSTRAINT fk_bi_currency  FOREIGN KEY (currency_id)  REFERENCES currencies(id)        ON DELETE RESTRICT,
    CONSTRAINT fk_bi_category  FOREIGN KEY (category_id)  REFERENCES budget_categories(id) ON DELETE SET NULL,
    CONSTRAINT fk_bi_location  FOREIGN KEY (location_id)  REFERENCES locations(id)         ON DELETE SET NULL,
    CONSTRAINT fk_bi_itinerary FOREIGN KEY (itinerary_id) REFERENCES trip_itinerary(id)    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ====================================================================
--  Приглашения
-- ====================================================================

CREATE TABLE invitations (
    id          INT NOT NULL AUTO_INCREMENT,
    trip_id     INT NOT NULL,
    invited_by  INT NOT NULL,
    email       VARCHAR(100) NOT NULL,
    token       VARCHAR(255) NOT NULL,
    role        ENUM('editor', 'viewer') NOT NULL DEFAULT 'viewer',
    status      ENUM('pending', 'accepted', 'declined') NOT NULL DEFAULT 'pending',
    expires_at  TIMESTAMP NOT NULL,
    accepted_at TIMESTAMP NULL DEFAULT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_inv_token (token),
    KEY idx_inv_trip   (trip_id),
    KEY idx_inv_email  (email),
    KEY idx_inv_status (status),
    KEY idx_inv_user   (invited_by),
    CONSTRAINT fk_inv_trip FOREIGN KEY (trip_id)    REFERENCES trips(id) ON DELETE CASCADE,
    CONSTRAINT fk_inv_user FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ====================================================================
--  Уведомления
-- ====================================================================

CREATE TABLE notifications (
    id         INT NOT NULL AUTO_INCREMENT,
    user_id    INT NOT NULL,
    type       ENUM('trip_invite', 'trip_update', 'member_joined', 'member_left',
                    'task_assigned', 'task_done', 'budget_limit', 'trip_reminder') NOT NULL,
    title      VARCHAR(255) NOT NULL,
    message    TEXT DEFAULT NULL,
    data       JSON DEFAULT NULL,
    is_read    TINYINT(1) NOT NULL DEFAULT 0,
    expires_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_notif_user      (user_id),
    KEY idx_notif_user_read (user_id, is_read, created_at),
    KEY idx_notif_created   (created_at),
    CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ====================================================================
--  Файлы (фото мест, чеки расходов, документы)
-- ====================================================================

CREATE TABLE attachments (
    id              INT NOT NULL AUTO_INCREMENT,
    trip_id         INT NOT NULL,
    location_id     INT DEFAULT NULL,
    budget_item_id  INT DEFAULT NULL,
    uploaded_by     INT NOT NULL,
    kind            ENUM('photo', 'receipt', 'document') NOT NULL DEFAULT 'photo',
    filename        VARCHAR(255) NOT NULL,
    original_name   VARCHAR(255) NOT NULL,
    mime_type       VARCHAR(100) NOT NULL,
    size_bytes      INT NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_att_trip     (trip_id),
    KEY idx_att_location (location_id),
    KEY idx_att_budget   (budget_item_id),
    KEY idx_att_user     (uploaded_by),
    CONSTRAINT fk_att_trip   FOREIGN KEY (trip_id)        REFERENCES trips(id)        ON DELETE CASCADE,
    CONSTRAINT fk_att_loc    FOREIGN KEY (location_id)    REFERENCES locations(id)    ON DELETE CASCADE,
    CONSTRAINT fk_att_budget FOREIGN KEY (budget_item_id) REFERENCES budget_items(id) ON DELETE CASCADE,
    CONSTRAINT fk_att_user   FOREIGN KEY (uploaded_by)    REFERENCES users(id)        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ====================================================================
--  Комментарии участников
-- ====================================================================

CREATE TABLE trip_comments (
    id         INT NOT NULL AUTO_INCREMENT,
    trip_id    INT NOT NULL,
    user_id    INT NOT NULL,
    content    TEXT NOT NULL,
    is_edited  TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_tc_trip (trip_id, created_at),
    KEY idx_tc_user (user_id),
    CONSTRAINT fk_tc_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
    CONSTRAINT fk_tc_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ====================================================================
--  СИД-ДАННЫЕ
-- ====================================================================

INSERT INTO currencies (id, code, name, symbol, rate_to_rub, is_active) VALUES
(1,  'RUB', 'Российский рубль',    '₽',   1.0000, 1),
(2,  'USD', 'Доллар США',          '$',  90.0000, 1),
(3,  'EUR', 'Евро',                '€',  98.0000, 1),
(4,  'KZT', 'Казахстанский тенге', '₸',   0.2000, 1),
(5,  'CNY', 'Китайский юань',      '¥',  12.5000, 1),
(6,  'TRY', 'Турецкая лира',       '₺',   3.0000, 1),
(7,  'AED', 'Дирхам ОАЭ',          'د.إ', 24.5000, 1),
(8,  'THB', 'Тайский бат',         '฿',   2.5000, 1),
(9,  'GBP', 'Фунт стерлингов',     '£', 115.0000, 1),
(10, 'JPY', 'Японская иена',       '¥',   0.6000, 1);

INSERT INTO budget_categories (id, slug, name, icon, color) VALUES
(1, 'transport',  'Транспорт',  'plane',           '#3498db'),
(2, 'housing',    'Жильё',      'home',            '#9b59b6'),
(3, 'food',       'Еда',        'utensils',        '#e67e22'),
(4, 'activities', 'Активности', 'ticket',          '#2ecc71'),
(5, 'shopping',   'Покупки',    'shopping-bag',    '#e91e63'),
(6, 'visa',       'Виза',       'file-text',       '#f39c12'),
(7, 'insurance',  'Страховка',  'shield',          '#1abc9c'),
(8, 'medicine',   'Медицина',   'plus-circle',     '#e74c3c'),
(9, 'other',      'Другое',     'more-horizontal', '#95a5a6');

INSERT INTO task_categories (id, slug, name, color) VALUES
(1, 'documents', 'Документы',     '#3498db'),
(2, 'packing',   'Вещи',          '#9b59b6'),
(3, 'booking',   'Бронирование',  '#e67e22'),
(4, 'transport', 'Транспорт',     '#2ecc71'),
(5, 'other',     'Другое',        '#95a5a6');

INSERT INTO location_categories (id, slug, name, icon, color, google_type) VALUES
(1,  'sight',         'Достопримечательность', 'landmark',     '#01abfb', 'tourist_attraction'),
(2,  'museum',        'Музей',                 'museum',       '#9b59b6', 'museum'),
(3,  'restaurant',    'Ресторан',              'utensils',     '#e67e22', 'restaurant'),
(4,  'cafe',          'Кафе',                  'coffee',       '#f39c12', 'cafe'),
(5,  'hotel',         'Отель',                 'hotel',        '#2ecc71', 'lodging'),
(6,  'transport',     'Транспорт',             'bus',          '#3498db', 'transit_station'),
(7,  'shopping',      'Шоппинг',               'shopping-bag', '#e91e63', 'shopping_mall'),
(8,  'park',          'Парк',                  'tree',         '#27ae60', 'park'),
(9,  'beach',         'Пляж',                  'umbrella',     '#00bcd4', 'natural_feature'),
(10, 'entertainment', 'Развлечения',           'star',         '#ff5722', 'amusement_park'),
(11, 'other',         'Другое',                'map-pin',      '#95a5a6', NULL);

-- ── Дефолтный админ ──────────────────────────────────────────────
--  Email:    admin@travel.local
--  Пароль:   Admin123
--  Поменяй пароль через /profile сразу после первого входа!

INSERT INTO `users` (`id`, `name`, `email`, `password`, `role`, `avatar`, `bio`, `phone`, `is_active`, `last_login_at`, `created_at`, `updated_at`) VALUES
(1, 'admin', 'admin@travel.com', '$2b$12$urIEFkg.Exbi1CE7d4ZhW.1/m1INQfGHfs3kkvBvGh180t7JNdEIi', 'admin', NULL, NULL, NULL, 1, NULL, '2026-05-05 15:07:15', '2026-05-05 15:07:31'),
(2, 'Sanya', 'sanya@gmail.com', '$2b$12$YOLX.ytlB05kUrEdTVtV3eeyAM.uF/eI31oTKkWA8MvfK8kEXnrm.', 'user', NULL, NULL, NULL, 1, NULL, '2026-05-05 15:08:10', '2026-05-05 15:08:10');


INSERT INTO user_settings (user_id) VALUES (1);
INSERT INTO user_settings (user_id) VALUES (2);
