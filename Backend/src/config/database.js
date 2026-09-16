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
      // DB already initialised — still ensure revoked_token table exists
      // (added in a later migration; safe to run IF NOT EXISTS every startup)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS revoked_token (
          token TEXT PRIMARY KEY,
          "revokedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await pool.query(`
        ALTER TABLE borrow_record
        ALTER COLUMN "borrowDate" TYPE TIMESTAMP WITH TIME ZONE USING "borrowDate"::TIMESTAMP WITH TIME ZONE,
        ALTER COLUMN "dueDate" TYPE TIMESTAMP WITH TIME ZONE USING "dueDate"::TIMESTAMP WITH TIME ZONE,
        ALTER COLUMN "returnDate" TYPE TIMESTAMP WITH TIME ZONE USING
          CASE WHEN "returnDate" IS NULL THEN NULL ELSE "returnDate"::TIMESTAMP WITH TIME ZONE END;
      `);
      await pool.query(`
        ALTER TABLE "ORDER"
        ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP WITH TIME ZONE;
      `);
      await pool.query(`
        ALTER TABLE borrow_record
        ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP WITH TIME ZONE;
      `);
      await pool.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'borrow_record'::regclass AND conname = 'borrow_record_status_check'
          ) THEN
            ALTER TABLE borrow_record DROP CONSTRAINT borrow_record_status_check;
          END IF;
          ALTER TABLE borrow_record
          ADD CONSTRAINT borrow_record_status_check
          CHECK (status IN ('PENDING', 'BORROWED', 'RETURNED', 'OVERDUE', 'LOST', 'REJECTED'));
        END $$;
      `);
      await pool.query(`
        ALTER TABLE borrow_record
        ALTER COLUMN status SET DEFAULT 'PENDING';
      `);
      await pool.query(`
        ALTER TABLE borrow_record
        ALTER COLUMN "borrowDate" DROP NOT NULL;
      `);
      await pool.query(`
        ALTER TABLE borrow_record
        ALTER COLUMN "dueDate" DROP NOT NULL;
      `);
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