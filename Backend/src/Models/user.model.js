import { pool } from "../config/database.js";

/**
 * Insert a new user into the database
 */
export const createUser = async ({ name, email, phone, address, role = "MEMBER" }) => {
  const query = `
    INSERT INTO users (name, email, phone, address, role)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING "userID", name, email, phone, address, role, "createdAt";
  `;
  const values = [name, email, phone, address, role];
  const { rows } = await pool.query(query, values);
  return rows[0];
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
 * Update dynamic fields for a user
 */
export const updateUser = async (userID, { name, phone, address, role }) => {
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
  const { rows } = await pool.query(query, values);
  return rows[0];
};

/**
 * Delete a user by userID
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
 * Find a user for logging in
 */

export const findUser = async ()