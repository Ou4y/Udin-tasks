CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('player', 'admin') NOT NULL DEFAULT 'player',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS levels (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  grid_data JSON NOT NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_levels_name (name),
  KEY idx_levels_created_by (created_by),
  CONSTRAINT fk_levels_created_by
    FOREIGN KEY (created_by) REFERENCES users (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS scores (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  level_id INT UNSIGNED NOT NULL,
  moves INT UNSIGNED NOT NULL,
  completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_scores_user_level (user_id, level_id),
  KEY idx_scores_level_moves (level_id, moves, completed_at),
  CONSTRAINT fk_scores_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_scores_level
    FOREIGN KEY (level_id) REFERENCES levels (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO users (username, password_hash, role)
VALUES ('admin', '$2b$10$BzOY.Iqaa6j99LfkCQRoVeSinrCvcvgfuj//7IyLyM1YkGNCklisG', 'admin')
ON DUPLICATE KEY UPDATE username = username;

INSERT INTO levels (name, grid_data, created_by)
SELECT
  'Starter Push',
  JSON_ARRAY(
    '#######',
    '#     #',
    '#  .  #',
    '#  $  #',
    '#  @  #',
    '#     #',
    '#######'
  ),
  users.id
FROM users
WHERE users.username = 'admin'
ON DUPLICATE KEY UPDATE name = name;
