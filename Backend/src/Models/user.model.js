import { pool } from "../config/database.js";

/**
 * Insert a new user into the database along with optional credentials (password/passHash, username)
 */
export const createUser = async ({
  name,
  email,
  phone,
  address,
  role = "MEMBER",
  isApproved = true,
  password,
  passHash,
  username,
}) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const query = `
      INSERT INTO users (name, email, phone, address, role, "isApproved", "approvedAt")
      VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $6 THEN CURRENT_TIMESTAMP ELSE NULL END)
      RETURNING "userID", name, email, phone, address, role, "isApproved", "approvedAt", "createdAt", avatar, bio;
    `;
    const values = [name, email, phone, address, role, isApproved];
    const { rows } = await client.query(query, values);
    const user = rows[0];

    const passwordValue = password || passHash;
    if (passwordValue) {
      const credQuery = `
        INSERT INTO credentials ("userID", username, "passHash")
        VALUES ($1, $2, $3);
      `;
      await client.query(credQuery, [
        user.userID,
        username || null,
        passwordValue,
      ]);
    }

    await client.query("COMMIT");
    return user;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Find a user by their unique primary key (userID)
 */
export const findUserById = async (userID) => {
  const query = `
    SELECT "userID", name, email, phone, address, role, "isApproved", "approvedAt", "createdAt", avatar, bio
    FROM users
    WHERE "userID" = $1;
  `;
  const { rows } = await pool.query(query, [userID]);
  return rows[0];
};

/**
 * Find a user by their email
 */
export const findUserByEmail = async (email) => {
  const query = `
    SELECT "userID", name, email, phone, address, role, "isApproved", "approvedAt", "createdAt", avatar, bio
    FROM users
    WHERE email = $1;
  `;
  const { rows } = await pool.query(query, [email]);
  return rows[0];
};

/**
 * Retrieve all users
 */
export const getAllUsers = async () => {
  const query = `
    SELECT "userID", name, email, phone, address, role, "isApproved", "approvedAt", "createdAt", avatar, bio
    FROM users
    ORDER BY "createdAt" DESC;
  `;
  const { rows } = await pool.query(query);
  return rows;
};

export const approvePendingAdminSignup = async (userID) => {
  const query = `
    UPDATE users
    SET "isApproved" = TRUE, "approvedAt" = CURRENT_TIMESTAMP
    WHERE "userID" = $1 AND role = 'ADMIN' AND "isApproved" = FALSE
    RETURNING "userID", name, email, phone, address, role, "isApproved", "approvedAt", "createdAt", avatar, bio;
  `;
  const { rows } = await pool.query(query, [userID]);
  return rows[0] || null;
};

/**
 * Update dynamic fields for a user (and optional credentials)
 */
export const updateUser = async (
  userID,
  { name, email, phone, address, role, password, passHash, username, avatar, bio }
) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const query = `
      UPDATE users
      SET name = COALESCE($1, name),
          email = COALESCE($2, email),
          phone = COALESCE($3, phone),
          address = COALESCE($4, address),
          role = COALESCE($5, role),
          avatar = COALESCE($6, avatar),
          bio = COALESCE($7, bio)
      WHERE "userID" = $8
      RETURNING "userID", name, email, phone, address, role, "createdAt", avatar, bio;
    `;
    const values = [name, email, phone, address, role, avatar, bio, userID];
    const { rows } = await client.query(query, values);
    const updatedUser = rows[0];

    if (!updatedUser) {
      await client.query("ROLLBACK");
      return null;
    }

    const passwordValue = password || passHash;
    if (passwordValue !== undefined) {
      if (username !== undefined) {
        await client.query(
          `
          INSERT INTO credentials ("userID", username, "passHash")
          VALUES ($1, $2, $3)
          ON CONFLICT ("userID") DO UPDATE
          SET username = EXCLUDED.username,
              "passHash" = EXCLUDED."passHash";
        `,
          [userID, username, passwordValue]
        );
      } else {
        await client.query(
          `
          INSERT INTO credentials ("userID", username, "passHash")
          VALUES ($1, NULL, $2)
          ON CONFLICT ("userID") DO UPDATE
          SET "passHash" = EXCLUDED."passHash";
        `,
          [userID, passwordValue]
        );
      }
    } else if (username !== undefined) {
      await client.query(
        `
        UPDATE credentials
        SET username = $1
        WHERE "userID" = $2;
      `,
        [username, userID]
      );
    }

    await client.query("COMMIT");
    return updatedUser;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const deleteUserAccount = async (userID, token) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userResult = await client.query(
      `SELECT "userID", role
       FROM users
       WHERE "userID" = $1
       FOR UPDATE`,
      [userID]
    );
    if (!userResult.rows[0]) {
      await client.query('ROLLBACK');
      return { reason: 'NOT_FOUND' };
    }

    const activeBorrowResult = await client.query(
      `SELECT "borrowID", status
       FROM borrow_record
       WHERE "userID" = $1
         AND status IN ('PENDING', 'BORROWED', 'OVERDUE', 'LOST')
       LIMIT 1
       FOR UPDATE`,
      [userID]
    );
    if (activeBorrowResult.rows[0]) {
      await client.query('ROLLBACK');
      return {
        reason: 'OPEN_BORROW',
        status: activeBorrowResult.rows[0].status,
      };
    }

    if (userResult.rows[0].role === 'ADMIN') {
      const adminResult = await client.query(
        `SELECT "userID"
         FROM users
         WHERE role = 'ADMIN'
         FOR UPDATE`
      );
      if (adminResult.rows.length <= 1) {
        await client.query('ROLLBACK');
        return { reason: 'LAST_ADMIN' };
      }
    }

    await client.query('DELETE FROM users WHERE "userID" = $1', [userID]);
    if (token) {
      await client.query(
        'INSERT INTO revoked_token (token) VALUES ($1) ON CONFLICT DO NOTHING',
        [token]
      );
    }

    await client.query('COMMIT');
    return { reason: 'DELETED' };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Find a user for logging in by email or username, including credentials
 */
export const findUser = async (identifier) => {
  let email = null;
  let username = null;

  if (typeof identifier === "object" && identifier !== null) {
    email = identifier.email || null;
    username = identifier.username || null;
  } else if (typeof identifier === "string") {
    email = identifier;
    username = identifier;
  }

  const query = `
    SELECT
      u."userID",
      u.name,
      u.email,
      u.phone,
      u.address,
      u.role,
      u."isApproved",
      u."approvedAt",
      u."createdAt",
      u.avatar,
      u.bio,
      c.username,
      c."passHash",
      c."lastLogin"
    FROM users u
    LEFT JOIN credentials c ON u."userID" = c."userID"
    WHERE (u.email = $1 OR c.username = $2);
  `;
  const { rows } = await pool.query(query, [email, username]);
  return rows[0];
};

/**
 * Find a user with credentials by userID
 */
export const findUserWithCredentialsById = async (userID) => {
  const query = `
    SELECT
      u."userID",
      u.name,
      u.email,
      u.phone,
      u.address,
      u.role,
      u."isApproved",
      u."approvedAt",
      u."createdAt",
      u.avatar,
      u.bio,
      c.username,
      c."passHash",
      c."lastLogin"
    FROM users u
    LEFT JOIN credentials c ON u."userID" = c."userID"
    WHERE u."userID" = $1;
  `;
  const { rows } = await pool.query(query, [userID]);
  return rows[0];
};

/**
 * Update user credentials (password/passHash, username, or lastLogin)
 */
export const updateUserCredentials = async (
  userID,
  { username, password, passHash, lastLogin }
) => {
  const passwordValue = password || passHash;
  const query = `
    INSERT INTO credentials ("userID", username, "passHash", "lastLogin")
    VALUES ($1, $2, $3, COALESCE($4, CURRENT_TIMESTAMP))
    ON CONFLICT ("userID") DO UPDATE
    SET username = COALESCE(EXCLUDED.username, credentials.username),
        "passHash" = COALESCE(EXCLUDED."passHash", credentials."passHash"),
        "lastLogin" = COALESCE(EXCLUDED."lastLogin", credentials."lastLogin")
    RETURNING "userID", username, "lastLogin";
  `;
  const { rows } = await pool.query(query, [
    userID,
    username || null,
    passwordValue || null,
    lastLogin || null,
  ]);
  return rows[0];
};

/**
 * Update last login timestamp for a user
 */
export const updateLastLogin = async (userID) => {
  const query = `
    UPDATE credentials
    SET "lastLogin" = CURRENT_TIMESTAMP
    WHERE "userID" = $1
    RETURNING "userID", "lastLogin";
  `;
  const { rows } = await pool.query(query, [userID]);
  return rows[0];
};

// ── Book search ─────────────────────────────────────────────────────────────

export const searchBooksByField = async (field, keyword) => {
  const isNumericField = field === "bookID" && !isNaN(Number(keyword));
  const searchValue = isNumericField ? keyword.trim() : `%${keyword}%`;
  const values = [searchValue];

  let whereClause = "";
  if (field === "title") {
    whereClause = `AND LOWER(b.title) LIKE LOWER($1)`;
  } else if (field === "bookID") {
    whereClause = isNumericField
      ? `AND b."bookID" = $1::INT`
      : `AND CAST(b."bookID" AS TEXT) LIKE $1`;
  } else if (field === "genre") {
    whereClause = `AND LOWER(b.genre) LIKE LOWER($1)`;
  } else if (field === "author") {
    whereClause = `AND LOWER(a.name) LIKE LOWER($1)`;
  } else if (field === "publisher") {
    whereClause = `AND LOWER(p."publisherName") LIKE LOWER($1)`;
  } else {
    throw new Error("Invalid search field");
  }

  const query = `
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
      (SELECT COUNT(*) FROM borrow_record br2 WHERE br2."bookID" = b."bookID" AND br2.status IN ('BORROWED', 'RETURNED', 'OVERDUE', 'LOST')) AS borrow_count,
      (SELECT COALESCE(SUM(o2.quantity), 0) FROM "ORDER" o2 WHERE o2."bookID" = b."bookID" AND o2.status = 'APPROVED') AS sold_count,
      (SELECT COUNT(*)::INT FROM book_review br WHERE br."bookID" = b."bookID") AS rating_count,
      (SELECT COUNT(*)::INT FROM wishlist w WHERE w."bookID" = b."bookID" AND w."listType" = 'WANT_TO_READ') AS want_to_read_count,
      (SELECT COUNT(*)::INT FROM wishlist w WHERE w."bookID" = b."bookID" AND w."listType" = 'CURRENTLY_READING') AS currently_reading_count,
      (SELECT (
        (SELECT COUNT(DISTINCT "userID") FROM borrow_record WHERE "bookID" = b."bookID" AND status = 'RETURNED') +
        (SELECT COUNT(DISTINCT "userID") FROM "ORDER" WHERE "bookID" = b."bookID" AND status = 'APPROVED') +
        (SELECT COUNT(DISTINCT "userID") FROM wishlist WHERE "bookID" = b."bookID" AND "listType" = 'FAVORITES')
      )::INT) AS have_read_count,
      p."publisherName",
      STRING_AGG(DISTINCT a.name, ', ') AS author_name
    FROM book b
    LEFT JOIN publisher p ON p."publisherID" = b."publisherID"
    LEFT JOIN book_author ba ON ba."bookID" = b."bookID"
    LEFT JOIN author a ON a."authorID" = ba."authorID"
    WHERE 1 = 1
    ${whereClause}
    GROUP BY b."bookID", b.title, b.genre, b.price, b."ISBN", b."publicationYear", b.avg_rating, b.language, b.edition, b."totalCopies", b."availableBorrowCopies", b."availableOrderCopies", p."publisherName"
    ORDER BY b.title ASC;
  `;

  const { rows } = await pool.query(query, values);
  return rows.map((book) => ({
    bookID: book.bookID,
    title: book.title,
    genre: book.genre,
    authorName: book.author_name,
    publisher: book.publisherName,
    price: Number(book.price || 0),
    ISBN: book.ISBN,
    publicationYear: book.publicationYear,
    avgRating: book.avg_rating != null ? Number(book.avg_rating) : 0,
    ratingCount: Number(book.rating_count || 0),
    wantToReadCount: Number(book.want_to_read_count || 0),
    currentlyReadingCount: Number(book.currently_reading_count || 0),
    haveReadCount: Number(book.have_read_count || 0),
    language: book.language || "English",
    edition: book.edition,
    totalCopies: book.totalCopies,
    availableBorrowCopies: book.availableBorrowCopies,
    availableOrderCopies: book.availableOrderCopies,
    borrowCount: Number(book.borrow_count || 0),
    soldCount: Number(book.sold_count || 0),
  }));
};

/**
 * Retrieve full book details by ID including stats from PostgreSQL function fn_get_book_rating_stats
 */
export const getBookDetailsById = async (bookID) => {
  const query = `
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
      (SELECT COUNT(*) FROM borrow_record br2 WHERE br2."bookID" = b."bookID" AND br2.status IN ('BORROWED', 'RETURNED', 'OVERDUE', 'LOST')) AS borrow_count,
      (SELECT COALESCE(SUM(o2.quantity), 0) FROM "ORDER" o2 WHERE o2."bookID" = b."bookID" AND o2.status = 'APPROVED') AS sold_count,
      p."publisherName",
      STRING_AGG(DISTINCT a.name, ', ') AS author_name,
      stats.total_ratings AS rating_count,
      stats.want_to_read AS want_to_read_count,
      stats.currently_reading AS currently_reading_count,
      stats.have_read AS have_read_count
    FROM book b
    LEFT JOIN publisher p ON p."publisherID" = b."publisherID"
    LEFT JOIN book_author ba ON ba."bookID" = b."bookID"
    LEFT JOIN author a ON a."authorID" = ba."authorID"
    LEFT JOIN LATERAL fn_get_book_rating_stats(b."bookID") stats ON TRUE
    WHERE b."bookID" = $1
    GROUP BY b."bookID", b.title, b.genre, b.price, b."ISBN", b."publicationYear", b.avg_rating, b.language, b.edition, b."totalCopies", b."availableBorrowCopies", b."availableOrderCopies", p."publisherName", stats.total_ratings, stats.want_to_read, stats.currently_reading, stats.have_read;
  `;
  const { rows } = await pool.query(query, [bookID]);
  if (!rows[0]) return null;
  const book = rows[0];
  return {
    bookID: book.bookID,
    title: book.title,
    genre: book.genre,
    authorName: book.author_name,
    publisher: book.publisherName,
    price: Number(book.price || 0),
    ISBN: book.ISBN,
    publicationYear: book.publicationYear,
    avgRating: book.avg_rating != null ? Number(book.avg_rating) : 0,
    ratingCount: Number(book.rating_count || 0),
    wantToReadCount: Number(book.want_to_read_count || 0),
    currentlyReadingCount: Number(book.currently_reading_count || 0),
    haveReadCount: Number(book.have_read_count || 0),
    language: book.language || "English",
    edition: book.edition,
    totalCopies: book.totalCopies,
    availableBorrowCopies: book.availableBorrowCopies,
    availableOrderCopies: book.availableOrderCopies,
    borrowCount: Number(book.borrow_count || 0),
    soldCount: Number(book.sold_count || 0),
  };
};

/**
 * Retrieve all reviews for a specific book
 */
export const getBookReviewsByBookId = async (bookID) => {
  const query = `
    SELECT
      br."reviewID",
      br.rating,
      br.comment,
      br."reviewSource",
      br."createdAt",
      br."userID" AS user_id,
      u.name AS user_name,
      u.avatar AS user_avatar
    FROM book_review br
    LEFT JOIN users u ON u."userID" = br."userID"
    WHERE br."bookID" = $1
    ORDER BY br."createdAt" DESC;
  `;
  const { rows } = await pool.query(query, [bookID]);
  return rows;
};

/**
 * Retrieve related books using PostgreSQL function fn_get_related_books
 */
export const getRelatedBooksByBookId = async (bookID, limit = 12) => {
  const query = `
    SELECT * FROM fn_get_related_books($1, $2);
  `;
  const { rows } = await pool.query(query, [bookID, limit]);
  return rows.map((b) => ({
    bookID: b.bookID,
    title: b.title,
    genre: b.genre,
    authorName: b.author_name,
    publisher: b.publisherName,
    price: Number(b.price || 0),
    ISBN: b.ISBN,
    publicationYear: b.publicationYear,
    avgRating: b.avg_rating != null ? Number(b.avg_rating) : 0,
    language: b.language || "English",
    edition: b.edition,
    totalCopies: b.totalCopies,
    availableBorrowCopies: b.availableBorrowCopies,
    availableOrderCopies: b.availableOrderCopies,
    matchScore: b.match_score,
  }));
};

// ── User data queries ────────────────────────────────────────────────────────

export const getBorrowRecordsByUserId = async (userID) => {
  const query = `
    SELECT
      br."borrowID",
      br."borrowDate",
      br."requestedAt",
      br."dueDate",
      br."returnDate",
      br."delayFee",
      br."fineActionAt",
      br.status,
      br."approvedAt",
      br."bookID",
      br."copyNumber",
      b.title AS "bookName"
    FROM borrow_record br
    LEFT JOIN book b ON b."bookID" = br."bookID"
    WHERE br."userID" = $1
    ORDER BY br."borrowID" DESC;
  `;
  const { rows } = await pool.query(query, [userID]);
  return rows;
};

export const borrowBook = async (userID, bookID) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Serialize requests for the same user/book pair so concurrent clicks
    // cannot create duplicate active or pending borrow records.
    await client.query(
      'SELECT pg_advisory_xact_lock($1::integer, $2::integer)',
      [userID, bookID]
    );

    const activeBorrowResult = await client.query(
      `SELECT "borrowID", status
       FROM borrow_record
       WHERE "userID" = $1
         AND "bookID" = $2
         AND status IN ('PENDING', 'BORROWED', 'OVERDUE')
       LIMIT 1
       FOR UPDATE`,
      [userID, bookID]
    );
    if (activeBorrowResult.rows[0]) {
      await client.query('ROLLBACK');
      const isPending = activeBorrowResult.rows[0].status === 'PENDING';
      return { alreadyBorrowed: true, alreadyPending: isPending };
    }

    const bookResult = await client.query(
      `SELECT "bookID", "totalCopies", "availableBorrowCopies"
       FROM book
       WHERE "bookID" = $1
       FOR UPDATE`,
      [bookID]
    );
    if (!bookResult.rows[0] || Number(bookResult.rows[0].availableBorrowCopies) <= 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const copyResult = await client.query(
      `SELECT copy_number
       FROM generate_series(1, $2::INT) AS copies(copy_number)
       WHERE NOT EXISTS (
         SELECT 1
         FROM borrow_record br
         WHERE br."bookID" = $1
           AND br."copyNumber" = copies.copy_number
           AND br.status IN ('PENDING', 'BORROWED', 'OVERDUE', 'LOST')
       )
       ORDER BY copy_number
       LIMIT 1`,
      [bookID, Number(bookResult.rows[0].totalCopies || 0)]
    );
    if (!copyResult.rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }

    await client.query(
      `UPDATE book
       SET "availableBorrowCopies" = "availableBorrowCopies" - 1
       WHERE "bookID" = $1`,
      [bookID]
    );

    const borrowResult = await client.query(
      `INSERT INTO borrow_record ("borrowDate", "dueDate", status, "userID", "bookID", "copyNumber")
       VALUES (NULL, NULL, 'PENDING', $1, $2, $3)
       RETURNING "borrowID", "borrowDate", "requestedAt", "dueDate", "returnDate", status, "userID", "bookID", "copyNumber", "approvedAt"`,
      [userID, bookID, copyResult.rows[0].copy_number]
    );
    await client.query('COMMIT');
    return borrowResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const approveBorrow = async (borrowID) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const borrowResult = await client.query(
      `UPDATE borrow_record
       SET status = 'BORROWED',
           "borrowDate" = CURRENT_TIMESTAMP,
           "dueDate" = CURRENT_TIMESTAMP + INTERVAL '14 days',
           "approvedAt" = CURRENT_TIMESTAMP
       WHERE "borrowID" = $1 AND status = 'PENDING'
       RETURNING "borrowID", "bookID", "borrowDate", "dueDate", "returnDate", "delayFee", "approvedAt", status`,
      [borrowID]
    );
    if (!borrowResult.rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }
    await client.query('COMMIT');
    return borrowResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const rejectBorrow = async (borrowID) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const borrowResult = await client.query(
      `UPDATE borrow_record
       SET status = 'REJECTED'
       WHERE "borrowID" = $1 AND status = 'PENDING'
       RETURNING "borrowID", "bookID", "borrowDate", "dueDate", "returnDate", "delayFee", status`,
      [borrowID]
    );
    if (!borrowResult.rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }

    await client.query(
      `UPDATE book
      SET "availableBorrowCopies" = LEAST("totalCopies", "availableBorrowCopies" + 1)
       WHERE "bookID" = $1`,
      [borrowResult.rows[0].bookID]
    );
    await client.query('COMMIT');
    return borrowResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const returnBorrowedBook = async (borrowID) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const borrowResult = await client.query(
      `UPDATE borrow_record
      SET "returnDate" = CURRENT_TIMESTAMP,
          status = CASE
            WHEN GREATEST(0, CEIL(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - "borrowDate")) / 86400 - 7) * 20) > 0
              THEN 'FINE_DUE'
            ELSE 'RETURNED'
          END,
          "delayFee" = GREATEST(0, CEIL(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - "borrowDate")) / 86400 - 7) * 20),
          "fineActionAt" = NULL
       WHERE "borrowID" = $1 AND status IN ('BORROWED', 'OVERDUE')
      RETURNING "borrowID", "bookID", "returnDate", "delayFee", "fineActionAt", status`,
      [borrowID]
    );
    if (!borrowResult.rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }

    await client.query(
      `UPDATE book
      SET "availableBorrowCopies" = LEAST("totalCopies", "availableBorrowCopies" + 1)
       WHERE "bookID" = $1`,
      [borrowResult.rows[0].bookID]
    );
    await client.query('COMMIT');
    return borrowResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const resolveBorrowFine = async (borrowID, resolution) => {
  const status = resolution === 'RETURNED_WITH_FINE' ? resolution : 'FINE_WAIVED';
  const query = `
    UPDATE borrow_record
    SET status = $2, "fineActionAt" = CURRENT_TIMESTAMP
    WHERE "borrowID" = $1 AND status = 'FINE_DUE'
    RETURNING "borrowID", "bookID", "returnDate", "delayFee", "fineActionAt", status;
  `;
  const { rows } = await pool.query(query, [borrowID, status]);
  return rows[0] || null;
};

export const getBookReviewsByUserId = async (userID) => {
  const query = `
    SELECT
      br."reviewID",
      br.rating,
      br.comment,
      br."createdAt",
      br."bookID" AS book_id,
      b.title AS book_name
    FROM book_review br
    LEFT JOIN book b ON b."bookID" = br."bookID"
    WHERE br."userID" = $1
    ORDER BY br."createdAt" DESC;
  `;
  const { rows } = await pool.query(query, [userID]);
  return rows;
};

export const createBookReview = async (userID, bookID, rating, comment) => {
  const query = `
    WITH eligible_book AS (
      SELECT 'BORROWED' AS source, COALESCE("approvedAt", "borrowDate") AS event_at
      FROM borrow_record
      WHERE "userID" = $1 AND "bookID" = $2
        AND status IN ('BORROWED', 'RETURNED', 'OVERDUE', 'LOST')
      UNION ALL
      SELECT 'BOUGHT' AS source, COALESCE("approvedAt", "orderedAt") AS event_at
      FROM "ORDER"
      WHERE "userID" = $1 AND "bookID" = $2 AND status = 'APPROVED'
    ), selected_source AS (
      SELECT source FROM eligible_book
      ORDER BY event_at DESC NULLS LAST
      LIMIT 1
    )
    INSERT INTO book_review ("userID", "bookID", rating, comment, "reviewSource")
    SELECT $1, $2, $3, $4, source
    FROM selected_source
    ON CONFLICT ("userID", "bookID") DO UPDATE
    SET rating = EXCLUDED.rating,
        comment = EXCLUDED.comment,
        "reviewSource" = EXCLUDED."reviewSource",
        "createdAt" = CURRENT_TIMESTAMP
    RETURNING "reviewID", rating, comment, "createdAt", "bookID" AS book_id, "reviewSource";
  `;
  const { rows } = await pool.query(query, [userID, bookID, rating, comment]);
  if (!rows[0]) return null;

  // Retrieve fresh stats from PostgreSQL function
  const statsRes = await pool.query(`SELECT * FROM fn_get_book_rating_stats($1)`, [bookID]);
  const stats = statsRes.rows[0] || {};

  return {
    ...rows[0],
    stats: {
      avgRating: Number(stats.avg_rating || 0),
      ratingCount: Number(stats.total_ratings || 0),
      wantToReadCount: Number(stats.want_to_read || 0),
      currentlyReadingCount: Number(stats.currently_reading || 0),
      haveReadCount: Number(stats.have_read || 0),
    },
  };
};

export const getOrdersByUserId = async (userID) => {
  const query = `
    SELECT
      o."purchaseNo",
      o."orderDate",
      COALESCE(o."orderedAt", o."orderDate"::timestamp with time zone) AS "orderedAt",
      o."actualPrice",
      o."discountPercentage",
      o.price,
      o.status,
      o."approvedAt",
      o."bookID" AS book_id,
      b.title AS book_name,
      STRING_AGG(DISTINCT a.name, ', ') AS author_name,
      p."publisherName" AS publisher_name
    FROM "ORDER" o
    LEFT JOIN book b ON b."bookID" = o."bookID"
    LEFT JOIN book_author ba ON ba."bookID" = o."bookID"
    LEFT JOIN author a ON a."authorID" = ba."authorID"
    LEFT JOIN publisher p ON p."publisherID" = b."publisherID"
    WHERE o."userID" = $1
    GROUP BY o."purchaseNo", o."orderDate", o."orderedAt", o."actualPrice", o."discountPercentage", o.price, o.status, o."approvedAt", o."bookID", b.title, p."publisherName"
    ORDER BY COALESCE(o."orderedAt", o."orderDate"::timestamp with time zone) DESC, o."purchaseNo" DESC;
  `;
  const { rows } = await pool.query(query, [userID]);
  return rows;
};

export const createOrder = async (userID, bookID, quantity = 1) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const bookResult = await client.query(
      `UPDATE book
      SET "availableOrderCopies" = "availableOrderCopies" - $2
      WHERE "bookID" = $1 AND "availableOrderCopies" >= $2
       RETURNING "bookID", price`,
      [bookID, quantity]
    );
    if (!bookResult.rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }

    const totalPrice = Number(bookResult.rows[0].price || 0) * Number(quantity);
    const orderResult = await client.query(
      `INSERT INTO "ORDER" ("orderDate", "orderedAt", "actualPrice", "discountPercentage", price, quantity, status, "userID", "bookID")
       VALUES (CURRENT_DATE, CURRENT_TIMESTAMP, $3, 0, $3, $4, 'PENDING', $1, $2)
       RETURNING "purchaseNo", "orderDate", "orderedAt", "actualPrice", "discountPercentage", price, quantity, status, "approvedAt", "bookID" AS book_id`,
      [userID, bookID, totalPrice, quantity]
    );

    await client.query('COMMIT');
    return orderResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const getLibraryReviewsByUserId = async (userID) => {
  const query = `
    SELECT
      "libReviewID",
      rating,
      "reportDetails",
      "createdAt"
    FROM library_review
    WHERE "userID" = $1
    ORDER BY "createdAt" DESC;
  `;
  const { rows } = await pool.query(query, [userID]);
  return rows;
};

export const createLibraryReview = async (userID, rating, reportDetails) => {
  const query = `
    INSERT INTO library_review ("userID", rating, "reportDetails")
    VALUES ($1, $2, $3)
    RETURNING "libReviewID", rating, "reportDetails", "createdAt";
  `;
  const { rows } = await pool.query(query, [userID, rating, reportDetails]);
  return rows[0];
};

// ── Admin queries ────────────────────────────────────────────────────────────

export const getAdminSummary = async () => {
  const query = `
    SELECT
      (SELECT COUNT(*) FROM users) AS total_users,
      (SELECT COUNT(*) FROM book) AS total_books,
      (SELECT COUNT(*) FROM borrow_record WHERE status = 'BORROWED') AS active_borrow_records,
      (SELECT COUNT(*) FROM borrow_record WHERE status = 'PENDING') AS pending_borrow_requests,
      (SELECT COUNT(*) FROM "ORDER") AS total_orders,
      (SELECT COUNT(*) FROM library_review) AS total_library_reviews;
  `;
  const { rows } = await pool.query(query);
  return rows[0] || {};
};

export const getAdminBooks = async () => {
  const query = `
    SELECT
      b."bookID",
      b.title,
      b.genre,
      b.price,
      b."availableBorrowCopies",
      b."availableOrderCopies",
      b."totalCopies",
      (SELECT COUNT(*) FROM borrow_record br WHERE br."bookID" = b."bookID" AND br.status IN ('BORROWED', 'RETURNED', 'OVERDUE', 'LOST')) AS borrow_count,
      (SELECT COALESCE(SUM(o.quantity), 0) FROM "ORDER" o WHERE o."bookID" = b."bookID" AND o.status = 'APPROVED') AS sold_count,
      p."publisherName",
      STRING_AGG(DISTINCT a.name, ', ') AS author_names
    FROM book b
    LEFT JOIN publisher p ON p."publisherID" = b."publisherID"
    LEFT JOIN book_author ba ON ba."bookID" = b."bookID"
    LEFT JOIN author a ON a."authorID" = ba."authorID"
    GROUP BY b."bookID", b.title, b.genre, b.price, b."availableBorrowCopies", b."availableOrderCopies", b."totalCopies", p."publisherName"
    ORDER BY b."bookID" ASC;
  `;
  const { rows } = await pool.query(query);
  return rows;
};

export const updateAdminBook = async (bookID, borrowDelta, orderDelta, price) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `WITH current_book AS (
        SELECT b."bookID", b.price, b."totalCopies", b."availableBorrowCopies", b."availableOrderCopies",
          (SELECT COUNT(*) FROM borrow_record br
           WHERE br."bookID" = b."bookID" AND br.status IN ('BORROWED', 'OVERDUE', 'LOST')) AS active_borrows
        FROM book b
        WHERE b."bookID" = $1
        FOR UPDATE
      )
      UPDATE book b
      SET "totalCopies" = current_book."totalCopies" + $2,
          "availableBorrowCopies" = current_book."availableBorrowCopies" + $2,
          "availableOrderCopies" = current_book."availableOrderCopies" + $3,
          price = $4
      FROM current_book
      WHERE b."bookID" = current_book."bookID"
        AND current_book."totalCopies" + $2 >= current_book.active_borrows
        AND current_book."availableBorrowCopies" + $2 >= 0
        AND current_book."availableOrderCopies" + $3 >= 0
      RETURNING b."bookID", b.price, b."totalCopies", b."availableBorrowCopies", b."availableOrderCopies"`,
      [bookID, borrowDelta, orderDelta, price]
    );
    if (!result.rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const getAdminBookReviews = async () => {
  const query = `
    SELECT br."reviewID", br.rating, br.comment, br."createdAt", br."reviewSource",
           b.title AS book_name, COALESCE(u.name, 'Deleted user') AS member_name
    FROM book_review br
    LEFT JOIN book b ON b."bookID" = br."bookID"
    LEFT JOIN users u ON u."userID" = br."userID"
    ORDER BY br."createdAt" DESC;
  `;
  const { rows } = await pool.query(query);
  return rows;
};

export const getAdminFeedback = async () => {
  const query = `
    SELECT lr."libReviewID", lr.rating, lr."reportDetails", lr."createdAt",
           COALESCE(u.name, 'Deleted user') AS member_name
    FROM library_review lr
    LEFT JOIN users u ON u."userID" = lr."userID"
    ORDER BY lr."createdAt" DESC;
  `;
  const { rows } = await pool.query(query);
  return rows;
};

export const getAdminBorrowRecords = async () => {
  const query = `
    SELECT
      br."borrowID",
      br."borrowDate",
      br."requestedAt",
      br."dueDate",
      br."returnDate",
      br.status,
      br."delayFee",
      br."fineActionAt",
      br."approvedAt",
      br."bookID",
      br."copyNumber",
      COALESCE(u.name, 'Deleted user') AS member_name,
      b.title AS book_name
    FROM borrow_record br
    LEFT JOIN users u ON u."userID" = br."userID"
    LEFT JOIN book b ON b."bookID" = br."bookID"
    ORDER BY br."requestedAt" DESC NULLS LAST, br."borrowID" DESC;
  `;
  const { rows } = await pool.query(query);
  return rows;
};

export const getAdminOrders = async () => {
  const query = `
    SELECT
      o."purchaseNo",
      o."orderDate",
      COALESCE(o."orderedAt", o."orderDate"::timestamp with time zone) AS "orderedAt",
      o."actualPrice",
      o."discountPercentage",
      o.price,
      o.quantity,
      o.status,
      o."approvedAt",
      COALESCE(u.name, 'Deleted user') AS member_name,
      b.title AS book_name,
      p."publisherName" AS publisher_name,
      STRING_AGG(DISTINCT a.name, ', ') AS author_names
    FROM "ORDER" o
    LEFT JOIN users u ON u."userID" = o."userID"
    LEFT JOIN book b ON b."bookID" = o."bookID"
    LEFT JOIN publisher p ON p."publisherID" = b."publisherID"
    LEFT JOIN book_author ba ON ba."bookID" = b."bookID"
    LEFT JOIN author a ON a."authorID" = ba."authorID"
    GROUP BY o."purchaseNo", o."orderDate", o."orderedAt", o."actualPrice", o."discountPercentage", o.price, o.quantity, o.status, o."approvedAt", u.name, b.title, p."publisherName"
    ORDER BY COALESCE(o."orderedAt", o."orderDate"::timestamp with time zone) DESC, o."purchaseNo" DESC;
  `;
  const { rows } = await pool.query(query);
  return rows;
};

export const approveOrder = async (purchaseNo, discountPercentage = 0) => {
  const query = `
    UPDATE "ORDER"
    SET status = 'APPROVED',
        "discountPercentage" = $2::numeric,
        price = ROUND("actualPrice" * (1 - ($2::numeric / 100)), 2),
        "approvedAt" = CURRENT_TIMESTAMP
    WHERE "purchaseNo" = $1 AND status = 'PENDING'
    RETURNING "purchaseNo", "actualPrice", "discountPercentage", price, status, "approvedAt";
  `;
  const { rows } = await pool.query(query, [purchaseNo, discountPercentage]);
  return rows[0] || null;
};

export const rejectOrder = async (purchaseNo) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const orderResult = await client.query(
      `UPDATE "ORDER"
       SET status = 'REJECTED'
       WHERE "purchaseNo" = $1 AND status = 'PENDING'
       RETURNING "purchaseNo", "bookID", quantity, status`,
      [purchaseNo]
    );
    if (!orderResult.rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }

    await client.query(
      `UPDATE book
      SET "availableOrderCopies" = "availableOrderCopies" + $2::INT
       WHERE "bookID" = $1`,
      [orderResult.rows[0].bookID, Number(orderResult.rows[0].quantity || 1)]
    );

    await client.query('COMMIT');
    return orderResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const getWishlistByUserId = async (userID) => {
  const query = `
    SELECT
      w."wishlistID",
      w."listType",
      w."addedAt",
      b."bookID",
      b.title,
      b."ISBN",
      b.genre,
      b.price,
      b."availableBorrowCopies",
      b."availableOrderCopies",
      STRING_AGG(DISTINCT a.name, ', ') AS "authorName"
    FROM wishlist w
    JOIN book b ON b."bookID" = w."bookID"
    LEFT JOIN book_author ba ON ba."bookID" = b."bookID"
    LEFT JOIN author a ON a."authorID" = ba."authorID"
    WHERE w."userID" = $1
    GROUP BY w."wishlistID", w."listType", w."addedAt", b."bookID", b.title,
             b."ISBN", b.genre, b.price, b."availableBorrowCopies", b."availableOrderCopies"
    ORDER BY w."listType", w."addedAt" DESC;
  `;
  const { rows } = await pool.query(query, [userID]);
  return rows;
};

export const addToWishlist = async (userID, bookID, listType) => {
  const query = `
    INSERT INTO wishlist ("userID", "bookID", "listType")
    VALUES ($1, $2, $3)
    ON CONFLICT ("userID", "bookID", "listType") DO NOTHING
    RETURNING *;
  `;
  const { rows } = await pool.query(query, [userID, bookID, listType]);
  return rows[0] || null;
};

export const removeFromWishlist = async (userID, bookID, listType) => {
  const query = `
    DELETE FROM wishlist
    WHERE "userID" = $1 AND "bookID" = $2 AND "listType" = $3
    RETURNING *;
  `;
  const { rows } = await pool.query(query, [userID, bookID, listType]);
  return rows[0] || null;
};

export const moveInWishlist = async (userID, bookID, fromList, toList) => {
  const query = `
    UPDATE wishlist
    SET "listType" = $4
    WHERE "userID" = $1 AND "bookID" = $2 AND "listType" = $3
    RETURNING *;
  `;
  const { rows } = await pool.query(query, [userID, bookID, fromList, toList]);
  return rows[0] || null;
};
