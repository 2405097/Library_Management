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
  status VARCHAR(30) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'BORROWED', 'RETURNED', 'FINE_DUE', 'RETURNED_WITH_FINE', 'FINE_WAIVED', 'OVERDUE', 'LOST', 'REJECTED')),
  "approvedAt" TIMESTAMP WITH TIME ZONE,
  "fineActionAt" TIMESTAMP WITH TIME ZONE,
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

