import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const DB_PATH = path.join(__dirname, '../../data/signage.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Run migrations on startup
db.exec(`
  CREATE TABLE IF NOT EXISTS media_files (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    duration_seconds REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS playlists (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS playlist_items (
    id TEXT PRIMARY KEY,
    playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    media_file_id TEXT NOT NULL REFERENCES media_files(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 0,
    display_duration INTEGER NOT NULL DEFAULT 5,
    transition_type TEXT NOT NULL DEFAULT 'none',
    transition_duration INTEGER NOT NULL DEFAULT 500
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS screens (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT,
    status TEXT NOT NULL DEFAULT 'offline',
    current_playlist_id TEXT REFERENCES playlists(id) ON DELETE SET NULL,
    last_seen_at TEXT,
    token TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS schedules (
    id TEXT PRIMARY KEY,
    screen_id TEXT NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
    playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    days_of_week INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Indexes for frequent queries
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist_id ON playlist_items(playlist_id);
  CREATE INDEX IF NOT EXISTS idx_schedules_screen_id ON schedules(screen_id);
  CREATE INDEX IF NOT EXISTS idx_screens_token ON screens(token);
  CREATE INDEX IF NOT EXISTS idx_media_files_type ON media_files(mime_type);
`);

// Add thumbnail_path column if missing
const mediaInfo = db.prepare('PRAGMA table_info(media_files)').all() as Array<{ name: string }>;
if (!mediaInfo.some(col => col.name === 'thumbnail_path')) {
  db.exec('ALTER TABLE media_files ADD COLUMN thumbnail_path TEXT');
}
if (!mediaInfo.some(col => col.name === 'updated_at')) {
  db.exec("ALTER TABLE media_files ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'))");
}

// Add role and email columns to users if missing
const usersInfo = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
if (!usersInfo.some(col => col.name === 'role')) {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'admin'");
}
if (!usersInfo.some(col => col.name === 'email')) {
  db.exec('ALTER TABLE users ADD COLUMN email TEXT');
}

// Column rename migrations for existing databases
const playlistsInfo = db.prepare('PRAGMA table_info(playlists)').all() as Array<{ name: string }>;
if (playlistsInfo.some(col => col.name === 'name')) {
  db.exec('ALTER TABLE playlists RENAME COLUMN name TO title');
}

const itemsInfo = db.prepare('PRAGMA table_info(playlist_items)').all() as Array<{ name: string }>;
if (itemsInfo.some(col => col.name === 'media_id')) {
  db.exec('ALTER TABLE playlist_items RENAME COLUMN media_id TO media_file_id');
}
if (itemsInfo.some(col => col.name === 'order_index')) {
  db.exec('ALTER TABLE playlist_items RENAME COLUMN order_index TO position');
}

// Per-item scheduling (0/NULL = always active)
const itemsInfo2 = db.prepare('PRAGMA table_info(playlist_items)').all() as Array<{ name: string }>;
if (!itemsInfo2.some(col => col.name === 'days_of_week')) {
  db.exec('ALTER TABLE playlist_items ADD COLUMN days_of_week INTEGER NOT NULL DEFAULT 0');
}
if (!itemsInfo2.some(col => col.name === 'start_time')) {
  db.exec('ALTER TABLE playlist_items ADD COLUMN start_time TEXT');
}
if (!itemsInfo2.some(col => col.name === 'end_time')) {
  db.exec('ALTER TABLE playlist_items ADD COLUMN end_time TEXT');
}

// Soft-delete columns for playlists and media_files
const playlistsInfo2 = db.prepare('PRAGMA table_info(playlists)').all() as Array<{ name: string }>;
if (!playlistsInfo2.some(col => col.name === 'deleted_at')) {
  db.exec('ALTER TABLE playlists ADD COLUMN deleted_at DATETIME DEFAULT NULL');
}

const mediaInfo2 = db.prepare('PRAGMA table_info(media_files)').all() as Array<{ name: string }>;
if (!mediaInfo2.some(col => col.name === 'deleted_at')) {
  db.exec('ALTER TABLE media_files ADD COLUMN deleted_at DATETIME DEFAULT NULL');
}

// Pairing code on screens (rotating short code vs permanent token)
const screensInfo = db.prepare('PRAGMA table_info(screens)').all() as Array<{ name: string }>;
if (!screensInfo.some(col => col.name === 'pairing_code')) {
  db.exec('ALTER TABLE screens ADD COLUMN pairing_code TEXT');
}
if (!screensInfo.some(col => col.name === 'pairing_expires_at')) {
  db.exec('ALTER TABLE screens ADD COLUMN pairing_expires_at TEXT');
}

// Seed default admin user from env vars on first run
const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin';

const existingAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get(ADMIN_USERNAME);
if (!existingAdmin) {
  const hash = bcrypt.hashSync(ADMIN_PASSWORD, 12);
  db.prepare('INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)').run(
    uuidv4(), ADMIN_USERNAME, hash, 'admin'
  );
  console.log(`[db] Default admin user '${ADMIN_USERNAME}' created`);
}

export default db;
