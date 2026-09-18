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
        ALTER TABLE borrow_record
        ADD COLUMN IF NOT EXISTS "requestedAt" TIMESTAMP WITH TIME ZONE;
      `);
      await pool.query(`
        UPDATE borrow_record
        SET "requestedAt" = COALESCE("borrowDate", "approvedAt")
        WHERE "requestedAt" IS NULL
          AND ("borrowDate" IS NOT NULL OR "approvedAt" IS NOT NULL);
      `);
      await pool.query(`
        ALTER TABLE borrow_record
        ALTER COLUMN "requestedAt" SET DEFAULT CURRENT_TIMESTAMP;
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
      await pool.query(`
        DO $$ BEGIN
          CREATE TYPE wishlist_list_type AS ENUM ('CURRENTLY_READING', 'WANT_TO_READ', 'FAVORITES');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS wishlist (
          "wishlistID" SERIAL PRIMARY KEY,
          "userID" INTEGER NOT NULL REFERENCES users("userID") ON DELETE CASCADE,
          "bookID" INTEGER NOT NULL REFERENCES book("bookID") ON DELETE CASCADE,
          "listType" wishlist_list_type NOT NULL DEFAULT 'WANT_TO_READ',
          "addedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE ("userID", "bookID", "listType")
        );
      `);
      await pool.query(`
        ALTER TABLE borrow_record
        ALTER COLUMN "userID" DROP NOT NULL;
        ALTER TABLE "ORDER"
        ALTER COLUMN "userID" DROP NOT NULL;
      `);
      await pool.query(`
        DO $$
        DECLARE
          constraint_name TEXT;
        BEGIN
          FOR constraint_name IN
            SELECT conname
            FROM pg_constraint
            WHERE conrelid = 'borrow_record'::regclass
              AND confrelid = 'users'::regclass
              AND contype = 'f'
          LOOP
            EXECUTE format('ALTER TABLE borrow_record DROP CONSTRAINT %I', constraint_name);
          END LOOP;

          FOR constraint_name IN
            SELECT conname
            FROM pg_constraint
            WHERE conrelid = '"ORDER"'::regclass
              AND confrelid = 'users'::regclass
              AND contype = 'f'
          LOOP
            EXECUTE format('ALTER TABLE "ORDER" DROP CONSTRAINT %I', constraint_name);
          END LOOP;

          ALTER TABLE borrow_record
            ADD CONSTRAINT borrow_record_userID_fkey
            FOREIGN KEY ("userID") REFERENCES users("userID") ON DELETE SET NULL;
          ALTER TABLE "ORDER"
            ADD CONSTRAINT order_userID_fkey
            FOREIGN KEY ("userID") REFERENCES users("userID") ON DELETE SET NULL;
        END $$;
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
