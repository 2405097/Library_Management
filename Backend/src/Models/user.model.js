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
  password,
  passHash,
  username,
}) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const query = `
      INSERT INTO users (name, email, phone, address, role)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING "userID", name, email, phone, address, role, "createdAt";
    `;
    const values = [name, email, phone, address, role];
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
    SELECT "userID", name, email, phone, address, role, "createdAt"
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
    SELECT "userID", name, email, phone, address, role, "createdAt"
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
    SELECT "userID", name, email, phone, address, role, "createdAt"
    FROM users
    ORDER BY "createdAt" DESC;
  `;
  const { rows } = await pool.query(query);
  return rows;
};

/**
 * Update dynamic fields for a user (and optional credentials)
 */
export const updateUser = async (
  userID,
  { name, phone, address, role, password, passHash, username }
) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const query = `
      UPDATE users
      SET name = COALESCE($1, name),
          phone = COALESCE($2, phone),
          address = COALESCE($3, address),
          role = COALESCE($4, role)
      WHERE "userID" = $5
      RETURNING "userID", name, email, phone, address, role, "createdAt";
    `;
    const values = [name, phone, address, role, userID];
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

/**
 * Delete a user by userID (Cascades to credentials table automatically)
 */
export const deleteUser = async (userID) => {
  const query = `
    DELETE FROM users
    WHERE "userID" = $1
    RETURNING "userID";
  `;
  const { rows } = await pool.query(query, [userID]);
  return rows[0];
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
      u."createdAt",
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
      u."createdAt",
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
  const searchValue = `%${keyword}%`;
  const values = [searchValue];

  let whereClause = "";
  if (field === "title") {
    whereClause = `AND LOWER(b.title) LIKE LOWER($1)`;
  } else if (field === "bookID") {
    whereClause = `AND CAST(b."bookID" AS TEXT) LIKE $1`;
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
      p."publisherName",
      STRING_AGG(DISTINCT a.name, ', ') AS author_name
    FROM book b
    LEFT JOIN publisher p ON p."publisherID" = b."publisherID"
    LEFT JOIN book_author ba ON ba."bookID" = b."bookID"
    LEFT JOIN author a ON a."authorID" = ba."authorID"
    WHERE 1 = 1
    ${whereClause}
    GROUP BY b."bookID", b.title, b.genre, b.price, b."ISBN", b."publicationYear", p."publisherName"
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
  }));
};

// ── User data queries ────────────────────────────────────────────────────────

export const getBorrowRecordsByUserId = async (userID) => {
  const query = `
    SELECT
      br."borrowID",
      br."borrowDate",
      br."dueDate",
      br."returnDate",
      br."delayFee",
      br.status,
      br."bookID",
      b.title AS "bookName"
    FROM borrow_record br
    LEFT JOIN book b ON b."bookID" = br."bookID"
    WHERE br."userID" = $1
    ORDER BY br."borrowDate" DESC;
  `;
  const { rows } = await pool.query(query, [userID]);
  return rows;
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

export const getOrdersByUserId = async (userID) => {
  const query = `
    SELECT
      o."purchaseNo",
      o."orderDate",
      o.price,
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
    GROUP BY o."purchaseNo", o."orderDate", o.price, o."bookID", b.title, p."publisherName"
    ORDER BY o."orderDate" DESC;
  `;
  const { rows } = await pool.query(query, [userID]);
  return rows;
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
      b."availableCopies",
      b."totalCopies",
      p."publisherName",
      STRING_AGG(DISTINCT a.name, ', ') AS author_names
    FROM book b
    LEFT JOIN publisher p ON p."publisherID" = b."publisherID"
    LEFT JOIN book_author ba ON ba."bookID" = b."bookID"
    LEFT JOIN author a ON a."authorID" = ba."authorID"
    GROUP BY b."bookID", b.title, b.genre, b.price, b."availableCopies", b."totalCopies", p."publisherName"
    ORDER BY b."bookID" ASC;
  `;
  const { rows } = await pool.query(query);
  return rows;
};

export const getAdminBorrowRecords = async () => {
  const query = `
    SELECT
      br."borrowID",
      br."borrowDate",
      br."dueDate",
      br."returnDate",
      br.status,
      br."delayFee",
      u.name AS member_name,
      b.title AS book_name
    FROM borrow_record br
    LEFT JOIN users u ON u."userID" = br."userID"
    LEFT JOIN book b ON b."bookID" = br."bookID"
    ORDER BY br."borrowDate" DESC;
  `;
  const { rows } = await pool.query(query);
  return rows;
};

export const getAdminOrders = async () => {
  const query = `
    SELECT
      o."purchaseNo",
      o."orderDate",
      o.price,
      o.quantity,
      u.name AS member_name,
      b.title AS book_name,
      p."publisherName" AS publisher_name,
      STRING_AGG(DISTINCT a.name, ', ') AS author_names
    FROM "ORDER" o
    LEFT JOIN users u ON u."userID" = o."userID"
    LEFT JOIN book b ON b."bookID" = o."bookID"
    LEFT JOIN publisher p ON p."publisherID" = b."publisherID"
    LEFT JOIN book_author ba ON ba."bookID" = b."bookID"
    LEFT JOIN author a ON a."authorID" = ba."authorID"
    GROUP BY o."purchaseNo", o."orderDate", o.price, o.quantity, u.name, b.title, p."publisherName"
    ORDER BY o."orderDate" DESC;
  `;
  const { rows } = await pool.query(query);
  return rows;
};
