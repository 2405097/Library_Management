CREATE TABLE USERS (
  "userID" SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL CHECK(char_length(name) >= 1),
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  address VARCHAR(255),
  avatar TEXT,
  bio TEXT,
  role VARCHAR(10) CHECK (role IN ('MEMBER', 'STAFF', 'ADMIN')),
  "isApproved" BOOLEAN NOT NULL DEFAULT TRUE,
  "approvedAt" TIMESTAMP WITH TIME ZONE,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE PUBLISHER (
  "publisherID" SERIAL PRIMARY KEY,
  "publisherName" VARCHAR(255) NOT NULL,
  address VARCHAR(255),
  "contactInfo" VARCHAR(100)
);

CREATE TABLE AUTHOR (
  "authorID" SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  biography TEXT,
  nationality VARCHAR(100),
  date_of_birth DATE
);

CREATE TABLE CREDENTIALS (
  "userID" INT PRIMARY KEY REFERENCES USERS("userID") ON DELETE CASCADE,
  username VARCHAR(100) UNIQUE,
  "passHash" VARCHAR(255) NOT NULL,
  "lastLogin" TIMESTAMP WITH TIME ZONE
);

-- Updated BOOK table without direct authorID foreign key
CREATE TABLE BOOK (
  "bookID" SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  genre VARCHAR(100),
  avg_rating NUMERIC(3, 2) DEFAULT 0.0 CHECK (avg_rating >= 0.0 AND avg_rating <= 5.0),
  language VARCHAR(50),
  price NUMERIC(10, 2) CHECK (price >= 0),
  "ISBN" VARCHAR(20) UNIQUE,
  edition VARCHAR(50),
  "publicationYear" INT,
  book_copy INT DEFAULT 1 CHECK (book_copy >= 0),
  "totalCopies" INT DEFAULT 1 CHECK ("totalCopies" >= 0),
  "availableCopies" INT DEFAULT 1 CHECK ("availableCopies" >= 0),
  "availableBorrowCopies" INT DEFAULT 1 CHECK ("availableBorrowCopies" >= 0),
  "availableOrderCopies" INT DEFAULT 1 CHECK ("availableOrderCopies" >= 0),
  "publisherID" INT REFERENCES PUBLISHER("publisherID") ON DELETE SET NULL
);

CREATE TABLE LIBRARY_REVIEW (
  "libReviewID" SERIAL PRIMARY KEY,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  "reportDetails" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "userID" INT NOT NULL REFERENCES USERS("userID") ON DELETE CASCADE
);

-- Junction / Bridge Table for Book <-> Author (Many-to-Many)
CREATE TABLE BOOK_AUTHOR (
  "bookID" INT NOT NULL REFERENCES BOOK("bookID") ON DELETE CASCADE,
  "authorID" INT NOT NULL REFERENCES AUTHOR("authorID") ON DELETE CASCADE,
  PRIMARY KEY ("bookID", "authorID")
);

CREATE TABLE BORROW_RECORD (
  "borrowID" SERIAL PRIMARY KEY,
  "borrowDate" TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  "requestedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "dueDate" TIMESTAMP WITH TIME ZONE,
  "returnDate" TIMESTAMP WITH TIME ZONE,
  "delayFee" NUMERIC(10, 2) DEFAULT 0.0 CHECK ("delayFee" >= 0),
  status VARCHAR(30) DEFAULT 'PENDING' CHECK (status IN ('WAITLISTED', 'PENDING', 'BORROWED', 'RETURNED', 'FINE_DUE', 'RETURNED_WITH_FINE', 'FINE_WAIVED', 'OVERDUE', 'LOST', 'REJECTED')),
  "approvedAt" TIMESTAMP WITH TIME ZONE,
  "fineActionAt" TIMESTAMP WITH TIME ZONE,
  "returnRequested" BOOLEAN NOT NULL DEFAULT FALSE,
  "returnRequestedAt" TIMESTAMP WITH TIME ZONE,
  "copyNumber" INT CHECK ("copyNumber" > 0),
  "userID" INT REFERENCES USERS("userID") ON DELETE SET NULL,
  "bookID" INT NOT NULL REFERENCES BOOK("bookID") ON DELETE RESTRICT
);

DO $$ BEGIN
  CREATE TYPE wishlist_list_type AS ENUM ('CURRENTLY_READING', 'WANT_TO_READ', 'FAVORITES');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE WISHLIST (
  "wishlistID" SERIAL PRIMARY KEY,
  "userID" INT NOT NULL REFERENCES USERS("userID") ON DELETE CASCADE,
  "bookID" INT NOT NULL REFERENCES BOOK("bookID") ON DELETE CASCADE,
  "listType" wishlist_list_type NOT NULL DEFAULT 'WANT_TO_READ',
  "addedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("userID", "bookID", "listType")
);

CREATE TABLE "ORDER" (
  "purchaseNo" SERIAL PRIMARY KEY,
  "orderDate" DATE NOT NULL DEFAULT CURRENT_DATE,
  "orderedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "actualPrice" NUMERIC(10, 2) CHECK ("actualPrice" >= 0),
  "discountPercentage" NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK ("discountPercentage" >= 0 AND "discountPercentage" <= 50),
  price NUMERIC(10, 2) CHECK (price >= 0),
  quantity INT DEFAULT 1 CHECK (quantity > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  "approvedAt" TIMESTAMP WITH TIME ZONE,
  "userID" INT REFERENCES USERS("userID") ON DELETE SET NULL,
  "bookID" INT NOT NULL REFERENCES BOOK("bookID") ON DELETE RESTRICT
);

CREATE TABLE BOOK_REVIEW (
  "reviewID" SERIAL PRIMARY KEY,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  "reviewSource" VARCHAR(10) NOT NULL DEFAULT 'BORROWED' CHECK ("reviewSource" IN ('BORROWED', 'BOUGHT')),
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "userID" INT NOT NULL REFERENCES USERS("userID") ON DELETE CASCADE,
  "bookID" INT NOT NULL REFERENCES BOOK("bookID") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS book_review_one_per_member_book
  ON BOOK_REVIEW ("userID", "bookID");

-- Stores revoked JWTs to support genuine server-side logout
CREATE TABLE REVOKED_TOKEN (
  token TEXT PRIMARY KEY,
  "revokedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- FUNCTIONS, PROCEDURES, AND TRIGGERS FOR BOOK RATINGS & STATISTICS
-- ============================================================================

-- Function 1: Compute average rating for a specific book from BOOK_REVIEW
CREATE OR REPLACE FUNCTION fn_calculate_book_avg_rating(p_book_id INT)
RETURNS NUMERIC(3, 2) AS $$
DECLARE
  v_avg NUMERIC(3, 2);
BEGIN
  SELECT COALESCE(ROUND(AVG(rating)::numeric, 2), 0.00)
  INTO v_avg
  FROM book_review
  WHERE "bookID" = p_book_id;
  RETURN v_avg;
END;
$$ LANGUAGE plpgsql;

-- Function 2: Retrieve real-time rating and reading stats for a book
CREATE OR REPLACE FUNCTION fn_get_book_rating_stats(
  p_book_id INT,
  OUT avg_rating NUMERIC(3, 2),
  OUT total_ratings INT,
  OUT want_to_read INT,
  OUT currently_reading INT,
  OUT have_read INT
) AS $$
BEGIN
  SELECT
    fn_calculate_book_avg_rating(p_book_id),
    (SELECT COUNT(*)::INT FROM book_review WHERE "bookID" = p_book_id),
    (SELECT COUNT(*)::INT FROM wishlist WHERE "bookID" = p_book_id AND "listType" = 'WANT_TO_READ'),
    (SELECT COUNT(*)::INT FROM wishlist WHERE "bookID" = p_book_id AND "listType" = 'CURRENTLY_READING'),
    (SELECT (
      (SELECT COUNT(DISTINCT "userID") FROM borrow_record WHERE "bookID" = p_book_id AND status = 'RETURNED') +
      (SELECT COUNT(DISTINCT "userID") FROM "ORDER" WHERE "bookID" = p_book_id AND status = 'APPROVED') +
      (SELECT COUNT(DISTINCT "userID") FROM wishlist WHERE "bookID" = p_book_id AND "listType" = 'FAVORITES')
    )::INT)
  INTO avg_rating, total_ratings, want_to_read, currently_reading, have_read;
END;
$$ LANGUAGE plpgsql;

-- Function 3: Retrieve related books by matching genre and/or author
CREATE OR REPLACE FUNCTION fn_get_related_books(
  p_book_id INT,
  p_limit INT DEFAULT 12
)
RETURNS TABLE (
  "bookID" INT,
  title VARCHAR,
  genre VARCHAR,
  price NUMERIC,
  "ISBN" VARCHAR,
  "publicationYear" INT,
  avg_rating NUMERIC,
  language VARCHAR,
  edition VARCHAR,
  "totalCopies" INT,
  "availableBorrowCopies" INT,
  "availableOrderCopies" INT,
  "publisherName" VARCHAR,
  author_name TEXT,
  match_score INT
) AS $$
DECLARE
  v_genre VARCHAR;
BEGIN
  SELECT b.genre INTO v_genre FROM book b WHERE b."bookID" = p_book_id;

  RETURN QUERY
  WITH source_authors AS (
    SELECT ba."authorID"
    FROM book_author ba
    WHERE ba."bookID" = p_book_id
  ),
  candidates AS (
    SELECT
      b."bookID",
      b.title,
      b.genre,
      b.price,
      b."ISBN",
      b."publicationYear",
      b.avg_rating,
      b.language,
      b.edition,
      b."totalCopies",
      b."availableBorrowCopies",
      b."availableOrderCopies",
      p."publisherName",
      STRING_AGG(DISTINCT a.name, ', ') AS author_name,
      (
        (CASE WHEN COUNT(DISTINCT sa."authorID") > 0 THEN 2 ELSE 0 END) +
        (CASE WHEN v_genre IS NOT NULL AND LOWER(b.genre) = LOWER(v_genre) THEN 1 ELSE 0 END)
      )::INT AS match_score
    FROM book b
    LEFT JOIN publisher p ON p."publisherID" = b."publisherID"
    LEFT JOIN book_author ba ON ba."bookID" = b."bookID"
    LEFT JOIN author a ON a."authorID" = ba."authorID"
    LEFT JOIN source_authors sa ON sa."authorID" = ba."authorID"
    WHERE b."bookID" != p_book_id
    GROUP BY b."bookID", b.title, b.genre, b.price, b."ISBN", b."publicationYear", b.avg_rating, b.language, b.edition, b."totalCopies", b."availableBorrowCopies", b."availableOrderCopies", p."publisherName"
  )
  SELECT
    c."bookID",
    c.title,
    c.genre,
    c.price,
    c."ISBN",
    c."publicationYear",
    c.avg_rating,
    c.language,
    c.edition,
    c."totalCopies",
    c."availableBorrowCopies",
    c."availableOrderCopies",
    c."publisherName",
    c.author_name,
    c.match_score
  FROM candidates c
  WHERE c.match_score > 0
  ORDER BY c.match_score DESC, c.avg_rating DESC NULLS LAST, c.title ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Procedure 1: Update average rating of a single book
CREATE OR REPLACE PROCEDURE sp_update_book_avg_rating(p_book_id INT)
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE book
  SET avg_rating = fn_calculate_book_avg_rating(p_book_id)
  WHERE "bookID" = p_book_id;
END;
$$;

-- Procedure 2: Recalculate average rating for all books in the catalog
CREATE OR REPLACE PROCEDURE sp_recalculate_all_ratings()
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE book b
  SET avg_rating = fn_calculate_book_avg_rating(b."bookID");
END;
$$;

-- Procedure 3: Multi-table workflow to process book return and restore inventory
CREATE OR REPLACE PROCEDURE sp_process_book_return(
  p_borrow_id INT,
  INOUT p_status VARCHAR DEFAULT NULL,
  INOUT p_delay_fee NUMERIC DEFAULT NULL
)
LANGUAGE plpgsql AS $$
DECLARE
  v_book_id INT;
  v_borrow_date TIMESTAMPTZ;
  v_fee NUMERIC(10, 2);
  v_new_status VARCHAR(30);
BEGIN
  -- 1. Find and lock the active borrow record
  SELECT "bookID", "borrowDate"
  INTO v_book_id, v_borrow_date
  FROM borrow_record
  WHERE "borrowID" = p_borrow_id AND status IN ('BORROWED', 'OVERDUE')
  FOR UPDATE;

  IF NOT FOUND THEN
    p_status := NULL;
    p_delay_fee := 0;
    RETURN;
  END IF;

  -- 2. Calculate delay fee (20 Taka/day after 7 days)
  v_fee := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - v_borrow_date)) / 86400 - 7) * 20);
  IF v_fee > 0 THEN
    v_new_status := 'FINE_DUE';
  ELSE
    v_new_status := 'RETURNED';
  END IF;

  -- 3. Modify table 1: borrow_record
  UPDATE borrow_record
  SET "returnDate" = CURRENT_TIMESTAMP,
      status = v_new_status,
      "delayFee" = v_fee,
      "fineActionAt" = NULL,
      "returnRequested" = FALSE
  WHERE "borrowID" = p_borrow_id;

  -- 4. Modify table 2: book (restore available borrow copy)
  UPDATE book
  SET "availableBorrowCopies" = LEAST("totalCopies", "availableBorrowCopies" + 1)
  WHERE "bookID" = v_book_id;

  p_status := v_new_status;
  p_delay_fee := v_fee;
END;
$$;

-- Trigger Function: Trigger worker that executes the stored procedure
CREATE OR REPLACE FUNCTION trg_fn_update_book_rating()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD."bookID" IS DISTINCT FROM NEW."bookID" THEN
      CALL sp_update_book_avg_rating(OLD."bookID");
    END IF;
    CALL sp_update_book_avg_rating(NEW."bookID");
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    CALL sp_update_book_avg_rating(NEW."bookID");
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    CALL sp_update_book_avg_rating(OLD."bookID");
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Automatically update book avg_rating on review insert, update, or delete
DROP TRIGGER IF EXISTS trg_update_book_avg_rating ON book_review;
DROP TRIGGER IF EXISTS trg_book_review_rating_sync ON book_review;

CREATE TRIGGER trg_book_review_rating_sync
AFTER INSERT OR UPDATE OR DELETE ON book_review
FOR EACH ROW
EXECUTE FUNCTION trg_fn_update_book_rating();

