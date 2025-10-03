#!/usr/bin/env node

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database file path
const DB_PATH = path.join(__dirname, 'tenants.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

/**
 * Initialize SQLite database
 */
export function initDatabase() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL'); // Write-Ahead Logging for better concurrency
  db.pragma('foreign_keys = ON'); // Enable foreign key constraints

  // Read and execute schema
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  db.exec(schema);

  console.log('✅ Database initialized:', DB_PATH);
  return db;
}

/**
 * Get database instance (singleton)
 */
let dbInstance = null;

export function getDatabase() {
  if (!dbInstance) {
    dbInstance = initDatabase();
  }
  return dbInstance;
}

/**
 * Close database connection
 */
export function closeDatabase() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    console.log('✅ Database connection closed');
  }
}

/**
 * Reset database (for testing/development)
 */
export function resetDatabase() {
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
    console.log('🗑️  Database deleted');
  }
  dbInstance = null;
  return initDatabase();
}

// Graceful shutdown
process.on('SIGINT', () => {
  closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeDatabase();
  process.exit(0);
});

export default getDatabase;
