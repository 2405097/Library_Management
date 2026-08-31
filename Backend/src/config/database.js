import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({
  path: '.env'
});

const { Pool } = pg;

// Initialize the PostgreSQL connection pool
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Function to test and verify database connection
export const connectDB = async () => {
  try {
    const client = await pool.connect();
    console.log(`PostgreSQL connected successfully to host: ${client.host}`);
    client.release();
  } catch (error) {
    console.error('PostgreSQL connection failed:', error.message);
    process.exit(1);
  }
};

export const initializeDatabase = async () => {
  try {
    const schemaCheck = await pool.query(
      `SELECT to_regclass('public.users') AS users_table;`
    );

    if (schemaCheck.rows[0]?.users_table) {
      return;
    }

    const schemaPath = path.resolve(process.cwd(), 'src/database/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    await pool.query(schemaSql);
    console.log('Database schema initialized successfully.');
  } catch (error) {
    console.error('Database schema initialization failed:', error.message);
    throw error;
  }
};