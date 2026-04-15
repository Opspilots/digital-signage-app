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
`);

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

// Seed default admin user from env vars on first run
const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin';

const existingAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get(ADMIN_USERNAME);
if (!existingAdmin) {
  const hash = bcrypt.hashSync(ADMIN_PASSWORD, 12);
  db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(
    uuidv4(), ADMIN_USERNAME, hash
  );
  console.log(`[db] Default admin user '${ADMIN_USERNAME}' created`);
}

export default db;
