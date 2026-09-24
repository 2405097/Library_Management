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
        ALTER TABLE book
        ADD COLUMN IF NOT EXISTS "availableBorrowCopies" INT,
        ADD COLUMN IF NOT EXISTS "availableOrderCopies" INT;
        UPDATE book
        SET "availableBorrowCopies" = COALESCE("availableBorrowCopies", "availableCopies", "totalCopies", 0),
            "availableOrderCopies" = COALESCE("availableOrderCopies", "totalCopies", 0);
        ALTER TABLE book
        ALTER COLUMN "availableBorrowCopies" SET DEFAULT 1,
        ALTER COLUMN "availableBorrowCopies" SET NOT NULL,
        ALTER COLUMN "availableOrderCopies" SET DEFAULT 1,
        ALTER COLUMN "availableOrderCopies" SET NOT NULL;
      `);
      await pool.query(`
        ALTER TABLE borrow_record
        ADD COLUMN IF NOT EXISTS "copyNumber" INT;
        WITH numbered_records AS (
          SELECT
            br."borrowID",
            ROW_NUMBER() OVER (PARTITION BY br."bookID" ORDER BY br."borrowID") AS record_number,
            GREATEST(b."totalCopies", 1) AS total_copies
          FROM borrow_record br
          JOIN book b ON b."bookID" = br."bookID"
          WHERE br."copyNumber" IS NULL
        )
        UPDATE borrow_record br
        SET "copyNumber" = ((numbered_records.record_number - 1) % numbered_records.total_copies) + 1
        FROM numbered_records
        WHERE br."borrowID" = numbered_records."borrowID";
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
        ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS "orderedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "actualPrice" NUMERIC(10, 2),
        ADD COLUMN IF NOT EXISTS "discountPercentage" NUMERIC(5, 2) NOT NULL DEFAULT 0;
        UPDATE "ORDER" SET "actualPrice" = COALESCE("actualPrice", price), "discountPercentage" = COALESCE("discountPercentage", 0);
        ALTER TABLE "ORDER"
        ALTER COLUMN "actualPrice" SET NOT NULL;
      `);
      await pool.query(`
        DO $$
        DECLARE
          constraint_record RECORD;
        BEGIN
          FOR constraint_record IN
            SELECT conname
            FROM pg_constraint
            WHERE conrelid = '"ORDER"'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%status%'
          LOOP
            EXECUTE format('ALTER TABLE "ORDER" DROP CONSTRAINT %I', constraint_record.conname);
          END LOOP;
          ALTER TABLE "ORDER"
          ADD CONSTRAINT order_status_check
          CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'));
        END $$;
      `);
      await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS "isApproved" BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP WITH TIME ZONE;
        ALTER TABLE users ALTER COLUMN "isApproved" SET DEFAULT TRUE;
        UPDATE users
        SET "isApproved" = TRUE,
            "approvedAt" = COALESCE("approvedAt", "createdAt")
        WHERE "isApproved" IS DISTINCT FROM TRUE
          AND role IS DISTINCT FROM 'ADMIN';
      `);
      await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS avatar TEXT,
        ADD COLUMN IF NOT EXISTS bio TEXT;
      `);
      await pool.query(`
        ALTER TABLE borrow_record
        ALTER COLUMN status TYPE VARCHAR(30),
        ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP WITH TIME ZONE;
        ALTER TABLE borrow_record
        ADD COLUMN IF NOT EXISTS "fineActionAt" TIMESTAMP WITH TIME ZONE;
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
          CHECK (status IN ('PENDING', 'BORROWED', 'RETURNED', 'FINE_DUE', 'RETURNED_WITH_FINE', 'FINE_WAIVED', 'OVERDUE', 'LOST', 'REJECTED'));
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
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS book_review_one_per_member_book
        ON book_review ("userID", "bookID");
      `);
      await pool.query(`
        ALTER TABLE book_review
        ADD COLUMN IF NOT EXISTS "reviewSource" VARCHAR(10);
        UPDATE book_review br
        SET "reviewSource" = CASE
          WHEN EXISTS (
            SELECT 1 FROM "ORDER" o
            WHERE o."userID" = br."userID"
              AND o."bookID" = br."bookID"
              AND o.status = 'APPROVED'
              AND COALESCE(o."approvedAt", o."orderedAt") <= br."createdAt"
          ) AND NOT EXISTS (
            SELECT 1 FROM borrow_record b
            WHERE b."userID" = br."userID"
              AND b."bookID" = br."bookID"
              AND b.status IN ('BORROWED', 'RETURNED', 'OVERDUE', 'LOST')
              AND COALESCE(b."approvedAt", b."borrowDate") <= br."createdAt"
          ) THEN 'BOUGHT'
          ELSE 'BORROWED'
        END
        WHERE "reviewSource" IS NULL;
        ALTER TABLE book_review
        ALTER COLUMN "reviewSource" SET DEFAULT 'BORROWED',
        ALTER COLUMN "reviewSource" SET NOT NULL;
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS app_migrations (
          name TEXT PRIMARY KEY,
          "appliedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      const priceMigration = await pool.query(`
        INSERT INTO app_migrations (name)
        VALUES ('prices-stored-in-taka')
        ON CONFLICT (name) DO NOTHING
        RETURNING name;
      `);
      if (priceMigration.rowCount > 0) {
        await pool.query(`UPDATE book SET price = price * 100 WHERE price IS NOT NULL`);
      }
      await pool.query(`
        UPDATE borrow_record
        SET "delayFee" = GREATEST(
          0,
          CEIL(EXTRACT(EPOCH FROM ("returnDate" - "borrowDate")) / 86400 - 7) * 20
        )
        WHERE "returnDate" IS NOT NULL;
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
