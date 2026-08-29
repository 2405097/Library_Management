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