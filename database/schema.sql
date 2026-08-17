-- =========================================================
--  LMS Platform — MySQL Schema
--  Engine: InnoDB · Charset: utf8mb4 (عشان العربي)
--  الـ id بيتولد من Node عن طريق crypto.randomUUID()
-- =========================================================

CREATE DATABASE IF NOT EXISTS lms_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE lms_db;

-- ===================== USERS =====================

CREATE TABLE users (
  id                  VARCHAR(36) PRIMARY KEY,
  name                VARCHAR(100) NOT NULL,
  email               VARCHAR(150) NOT NULL UNIQUE,
  password            VARCHAR(255) NULL,
  image               VARCHAR(500) NULL,
  bio                 TEXT NULL,
  phone               VARCHAR(30) NULL,
  role                ENUM('STUDENT','INSTRUCTOR','ADMIN') NOT NULL DEFAULT 'STUDENT',
  is_active           TINYINT(1) NOT NULL DEFAULT 1,
  email_verified_at   DATETIME NULL,
  locale              VARCHAR(5) NOT NULL DEFAULT 'ar',
  email_notifications TINYINT(1) NOT NULL DEFAULT 1,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- تفعيل الإيميل + استرجاع الباسورد
CREATE TABLE verification_tokens (
  id         VARCHAR(36) PRIMARY KEY,
  user_id    VARCHAR(36) NOT NULL,
  token      VARCHAR(255) NOT NULL UNIQUE,
  type       ENUM('EMAIL_VERIFY','PASSWORD_RESET') NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at    DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_vt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_vt_user_type (user_id, type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===================== CATALOG =====================

CREATE TABLE categories (
  id          VARCHAR(36) PRIMARY KEY,
  name        VARCHAR(120) NOT NULL,
  slug        VARCHAR(150) NOT NULL UNIQUE,
  description TEXT NULL,
  image       VARCHAR(500) NULL,
  icon        VARCHAR(100) NULL,
  parent_id   VARCHAR(36) NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cat_parent FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL,
  INDEX idx_cat_parent (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE courses (
  id                VARCHAR(36) PRIMARY KEY,
  title             VARCHAR(200) NOT NULL,
  slug              VARCHAR(220) NOT NULL UNIQUE,
  short_description VARCHAR(500) NULL,
  description       LONGTEXT NULL,
  thumbnail         VARCHAR(500) NULL,
  preview_video     VARCHAR(500) NULL,
  price             DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  discount_price    DECIMAL(10,2) NULL,
  level             ENUM('BEGINNER','INTERMEDIATE','ADVANCED') NOT NULL DEFAULT 'BEGINNER',
  language          VARCHAR(5) NOT NULL DEFAULT 'ar',
  status            ENUM('DRAFT','PUBLISHED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  is_featured       TINYINT(1) NOT NULL DEFAULT 0,
  requirements      JSON NULL,
  outcomes          JSON NULL,
  -- حقول محسوبة عشان قوائم الكورسات تبقى سريعة
  duration          INT NOT NULL DEFAULT 0,   -- بالثواني
  lessons_count     INT NOT NULL DEFAULT 0,
  students_count    INT NOT NULL DEFAULT 0,
  rating_avg        DECIMAL(3,2) NOT NULL DEFAULT 0.00,
  reviews_count     INT NOT NULL DEFAULT 0,
  category_id       VARCHAR(36) NULL,
  instructor_id     VARCHAR(36) NOT NULL,
  published_at      DATETIME NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_course_cat FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  CONSTRAINT fk_course_instructor FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_course_status_cat (status, category_id),
  INDEX idx_course_instructor (instructor_id),
  FULLTEXT KEY ft_course_search (title, short_description)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE sections (
  id         VARCHAR(36) PRIMARY KEY,
  course_id  VARCHAR(36) NOT NULL,
  title      VARCHAR(200) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_section_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  INDEX idx_section_course (course_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE lessons (
  id         VARCHAR(36) PRIMARY KEY,
  section_id VARCHAR(36) NOT NULL,
  title      VARCHAR(200) NOT NULL,
  type       ENUM('VIDEO','ARTICLE','FILE') NOT NULL DEFAULT 'VIDEO',
  content    LONGTEXT NULL,
  video_url  VARCHAR(500) NULL,
  duration   INT NOT NULL DEFAULT 0,          -- بالثواني
  sort_order INT NOT NULL DEFAULT 0,
  is_free    TINYINT(1) NOT NULL DEFAULT 0,   -- preview مجاني
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_lesson_section FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
  INDEX idx_lesson_section (section_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE attachments (
  id         VARCHAR(36) PRIMARY KEY,
  lesson_id  VARCHAR(36) NOT NULL,
  name       VARCHAR(200) NOT NULL,
  url        VARCHAR(500) NOT NULL,
  size       INT NOT NULL DEFAULT 0,
  mime_type  VARCHAR(100) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_att_lesson FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
  INDEX idx_att_lesson (lesson_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===================== ENROLLMENT & PROGRESS =====================

CREATE TABLE enrollments (
  id             VARCHAR(36) PRIMARY KEY,
  user_id        VARCHAR(36) NOT NULL,
  course_id      VARCHAR(36) NOT NULL,
  status         ENUM('ACTIVE','COMPLETED','CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  progress       TINYINT UNSIGNED NOT NULL DEFAULT 0,  -- 0..100
  enrolled_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at   DATETIME NULL,
  last_access_at DATETIME NULL,
  CONSTRAINT fk_enr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_enr_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  UNIQUE KEY uq_enr_user_course (user_id, course_id),
  INDEX idx_enr_user_status (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE lesson_progress (
  id              VARCHAR(36) PRIMARY KEY,
  user_id         VARCHAR(36) NOT NULL,
  lesson_id       VARCHAR(36) NOT NULL,
  is_completed    TINYINT(1) NOT NULL DEFAULT 0,
  watched_seconds INT NOT NULL DEFAULT 0,
  completed_at    DATETIME NULL,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_lp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_lp_lesson FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
  UNIQUE KEY uq_lp_user_lesson (user_id, lesson_id),
  INDEX idx_lp_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE certificates (
  id         VARCHAR(36) PRIMARY KEY,
  serial     VARCHAR(50) NOT NULL UNIQUE,   -- للتحقق العام
  user_id    VARCHAR(36) NOT NULL,
  course_id  VARCHAR(36) NOT NULL,
  file_url   VARCHAR(500) NULL,
  issued_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cert_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_cert_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  UNIQUE KEY uq_cert_user_course (user_id, course_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE reviews (
  id          VARCHAR(36) PRIMARY KEY,
  user_id     VARCHAR(36) NOT NULL,
  course_id   VARCHAR(36) NOT NULL,
  rating      TINYINT UNSIGNED NOT NULL,   -- 1..5
  comment     TEXT NULL,
  is_approved TINYINT(1) NOT NULL DEFAULT 1,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_rev_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_rev_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  UNIQUE KEY uq_rev_user_course (user_id, course_id),
  INDEX idx_rev_course (course_id, is_approved)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE wishlist (
  id         VARCHAR(36) PRIMARY KEY,
  user_id    VARCHAR(36) NOT NULL,
  course_id  VARCHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_wl_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_wl_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  UNIQUE KEY uq_wl_user_course (user_id, course_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===================== ORDERS =====================

CREATE TABLE coupons (
  id         VARCHAR(36) PRIMARY KEY,
  code       VARCHAR(50) NOT NULL UNIQUE,
  type       ENUM('PERCENT','FIXED') NOT NULL DEFAULT 'PERCENT',
  value      DECIMAL(10,2) NOT NULL,
  max_uses   INT NULL,
  used_count INT NOT NULL DEFAULT 0,
  starts_at  DATETIME NULL,
  expires_at DATETIME NULL,
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE orders (
  id             VARCHAR(36) PRIMARY KEY,
  number         VARCHAR(30) NOT NULL UNIQUE,
  user_id        VARCHAR(36) NOT NULL,
  status         ENUM('PENDING','PAID','FAILED','REFUNDED') NOT NULL DEFAULT 'PENDING',
  subtotal       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  discount       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total          DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  currency       VARCHAR(5) NOT NULL DEFAULT 'EGP',
  coupon_id      VARCHAR(36) NULL,
  payment_method VARCHAR(30) NULL,
  payment_ref    VARCHAR(120) NULL,
  paid_at        DATETIME NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_coupon FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE SET NULL,
  INDEX idx_order_user_status (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE order_items (
  id        VARCHAR(36) PRIMARY KEY,
  order_id  VARCHAR(36) NOT NULL,
  course_id VARCHAR(36) NOT NULL,
  title     VARCHAR(200) NOT NULL,          -- snapshot وقت الشراء
  price     DECIMAL(10,2) NOT NULL,
  CONSTRAINT fk_oi_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_oi_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE RESTRICT,
  INDEX idx_oi_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===================== MISC =====================

CREATE TABLE notifications (
  id         VARCHAR(36) PRIMARY KEY,
  user_id    VARCHAR(36) NOT NULL,
  type       ENUM('SYSTEM','COURSE','ORDER','CERTIFICATE') NOT NULL DEFAULT 'SYSTEM',
  title      VARCHAR(200) NOT NULL,
  message    TEXT NULL,
  link       VARCHAR(500) NULL,
  is_read    TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notif_user_read (user_id, is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE settings (
  `key`      VARCHAR(100) PRIMARY KEY,
  value      JSON NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE contact_messages (
  id         VARCHAR(36) PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  email      VARCHAR(150) NOT NULL,
  subject    VARCHAR(200) NULL,
  message    TEXT NOT NULL,
  is_read    TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
