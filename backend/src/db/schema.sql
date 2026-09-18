CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_by INTEGER NOT NULL,
  max_players INTEGER NOT NULL DEFAULT 4,
  status TEXT NOT NULL DEFAULT 'waiting',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS room_players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  username TEXT NOT NULL,
  avatar TEXT,
  joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(room_id, user_id),
  FOREIGN KEY (room_id) REFERENCES rooms(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL UNIQUE,
  status TEXT NOT NULL,
  state_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(id)
);

CREATE TABLE IF NOT EXISTS player_stats (
  user_id INTEGER PRIMARY KEY,

  games_played INTEGER NOT NULL DEFAULT 0,
  games_finished INTEGER NOT NULL DEFAULT 0,

  games_won INTEGER NOT NULL DEFAULT 0,

  total_points INTEGER NOT NULL DEFAULT 0,
  tricks_won INTEGER NOT NULL DEFAULT 0,

  predictions_made INTEGER NOT NULL DEFAULT 0,
  exact_predictions INTEGER NOT NULL DEFAULT 0,

  games_created INTEGER NOT NULL DEFAULT 0,
  games_created_finished INTEGER NOT NULL DEFAULT 0,

  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS player_opponents (
  player_id INTEGER NOT NULL,
  opponent_type TEXT NOT NULL,
  opponent_id INTEGER,
  opponent_name TEXT NOT NULL,
  games_played INTEGER NOT NULL DEFAULT 0,

  PRIMARY KEY (
    player_id,
    opponent_type,
    opponent_id,
    opponent_name
  ),

  FOREIGN KEY (player_id) REFERENCES users(id),

  CHECK (opponent_type IN ('user', 'bot'))
);