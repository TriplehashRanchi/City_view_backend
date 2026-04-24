
CREATE TABLE IF NOT EXISTS admins (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  phone VARCHAR(30) NULL,
  password_hash VARCHAR(255) NOT NULL,
  status ENUM('active', 'disabled') NOT NULL DEFAULT 'active',
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admins_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS clients (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(30) NULL,
  email VARCHAR(190) NULL,
  company_name VARCHAR(190) NULL,
  notes TEXT NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_clients_name (name),
  KEY idx_clients_email (email),
  KEY idx_clients_phone (phone),
  CONSTRAINT fk_clients_created_by FOREIGN KEY (created_by) REFERENCES admins(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_id BIGINT UNSIGNED NOT NULL,
  occasion_type VARCHAR(120) NOT NULL,
  event_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NULL,
  guest_count INT UNSIGNED NOT NULL,
  venue VARCHAR(180) NULL,
  notes TEXT NULL,
  event_status ENUM('enquiry', 'quotation_created', 'confirmed', 'cancelled') NOT NULL DEFAULT 'enquiry',
  created_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_events_date_status (event_date, event_status),
  KEY idx_events_client (client_id),
  CONSTRAINT fk_events_client FOREIGN KEY (client_id) REFERENCES clients(id),
  CONSTRAINT fk_events_created_by FOREIGN KEY (created_by) REFERENCES admins(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_categories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  sort_order INT UNSIGNED NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_product_categories_name (name),
  UNIQUE KEY uq_product_categories_slug (slug),
  KEY idx_product_categories_status_sort (status, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(180) NOT NULL,
  image_url VARCHAR(255) NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  food_type ENUM('veg', 'non_veg') NOT NULL DEFAULT 'veg',
  base_price DECIMAL(12,2) NOT NULL,
  description TEXT NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_products_name_category_id (name, category_id),
  KEY idx_products_status_category_id (status, category_id),
  CONSTRAINT fk_products_created_by FOREIGN KEY (created_by) REFERENCES admins(id),
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES product_categories(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS packages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(180) NOT NULL,
  description TEXT NULL,
  per_person_price DECIMAL(12,2) NOT NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_packages_name (name),
  KEY idx_packages_status (status),
  CONSTRAINT fk_packages_created_by FOREIGN KEY (created_by) REFERENCES admins(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS package_products (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  package_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_package_products (package_id, product_id),
  KEY idx_package_products_sort (package_id, sort_order),
  CONSTRAINT fk_package_products_package FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE,
  CONSTRAINT fk_package_products_product FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quotations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_id BIGINT UNSIGNED NOT NULL,
  quote_code VARCHAR(40) NOT NULL,
  current_version_number INT UNSIGNED NOT NULL DEFAULT 0,
  current_status ENUM('draft', 'sent', 'accepted', 'rejected') NOT NULL DEFAULT 'draft',
  latest_version_id BIGINT UNSIGNED NULL,
  accepted_version_id BIGINT UNSIGNED NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_quote_code (quote_code),
  UNIQUE KEY uq_quotation_event (event_id),
  CONSTRAINT fk_quotations_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  CONSTRAINT fk_quotations_created_by FOREIGN KEY (created_by) REFERENCES admins(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quotation_versions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  quotation_id BIGINT UNSIGNED NOT NULL,
  version_number INT UNSIGNED NOT NULL,
  status ENUM('draft', 'sent', 'accepted', 'rejected') NOT NULL DEFAULT 'draft',
  valid_until DATE NULL,
  source_package_id BIGINT UNSIGNED NULL,
  display_as_package TINYINT(1) NOT NULL DEFAULT 0,
  client_snapshot_json JSON NOT NULL,
  event_snapshot_json JSON NOT NULL,
  per_person_price DECIMAL(12,2) NOT NULL,
  guest_count INT UNSIGNED NOT NULL,
  subtotal_amount DECIMAL(12,2) NOT NULL,
  discount_type ENUM('none', 'flat', 'percentage') NOT NULL DEFAULT 'none',
  discount_value DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  final_amount DECIMAL(12,2) NOT NULL,
  notes TEXT NULL,
  terms_and_conditions TEXT NULL,
  cloned_from_version_id BIGINT UNSIGNED NULL,
  sent_at DATETIME NULL,
  accepted_at DATETIME NULL,
  rejected_at DATETIME NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_quote_version (quotation_id, version_number),
  KEY idx_quote_versions_status (status),
  CONSTRAINT fk_quote_versions_quotation FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
  CONSTRAINT fk_quote_versions_created_by FOREIGN KEY (created_by) REFERENCES admins(id),
  CONSTRAINT fk_quote_versions_cloned_from FOREIGN KEY (cloned_from_version_id) REFERENCES quotation_versions(id),
  CONSTRAINT fk_quote_versions_source_package FOREIGN KEY (source_package_id) REFERENCES packages(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quotation_version_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  quotation_version_id BIGINT UNSIGNED NOT NULL,
  item_type ENUM('product', 'custom') NOT NULL,
  product_id BIGINT UNSIGNED NULL,
  item_name VARCHAR(190) NOT NULL,
  item_category VARCHAR(60) NULL,
  food_type ENUM('veg', 'non_veg') NULL,
  is_custom TINYINT(1) NOT NULL DEFAULT 0,
  description TEXT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_quote_version_items_version (quotation_version_id),
  CONSTRAINT fk_quote_version_items_version FOREIGN KEY (quotation_version_id) REFERENCES quotation_versions(id) ON DELETE CASCADE,
  CONSTRAINT fk_quote_version_items_product FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS restaurant_expenses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  expense_date DATE NOT NULL,
  category_name VARCHAR(150) NOT NULL,
  vendor_name VARCHAR(150) NULL,
  amount DECIMAL(10,2) NOT NULL,
  gst TINYINT(1) NOT NULL DEFAULT 0,
  gstin VARCHAR(15) NULL,
  tax_percentage DECIMAL(5,2) NULL,
  amount_is ENUM('inclusive', 'exclusive') NULL,
  invoice_number VARCHAR(100) NULL,
  payment_mode ENUM('cash', 'upi', 'card', 'bank', 'credit') NULL,
  status ENUM('paid', 'pending', 'cancelled') NOT NULL DEFAULT 'paid',
  receipt_url VARCHAR(255) NULL,
  notes VARCHAR(500) NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_restaurant_expenses_date (expense_date),
  KEY idx_restaurant_expenses_category (category_name),
  KEY idx_restaurant_expenses_vendor (vendor_name),
  KEY idx_restaurant_expenses_payment_mode (payment_mode),
  KEY idx_restaurant_expenses_status (status),
  CONSTRAINT fk_restaurant_expenses_created_by FOREIGN KEY (created_by) REFERENCES admins(id),
  CONSTRAINT chk_restaurant_expenses_amount CHECK (amount >= 0),
  CONSTRAINT chk_restaurant_expenses_tax_percentage CHECK (tax_percentage IS NULL OR (tax_percentage >= 0 AND tax_percentage <= 100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
