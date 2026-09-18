import jwt from 'jsonwebtoken';
import { pool } from '../config/database.js';

/**
 * Middleware: verifies the JWT in the Authorization header.
 * Attaches { userID, role, email } to req.user and raw token to req.token.
 * Rejects with 401 if missing / invalid / revoked.
 */
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required. No token provided.' });
    }
    const token = authHeader.split(' ')[1];
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      const msg = err.name === 'TokenExpiredError'
        ? 'Token has expired. Please log in again.'
        : 'Invalid token. Please log in again.';
      return res.status(401).json({ message: msg });
    }
    const { rows } = await pool.query('SELECT 1 FROM revoked_token WHERE token = $1', [token]);
    if (rows.length > 0) {
      return res.status(401).json({ message: 'Token has been revoked. Please log in again.' });
    }
    const userResult = await pool.query(
      'SELECT 1 FROM users WHERE "userID" = $1',
      [payload.userID]
    );
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'This account no longer exists. Please log in again.' });
    }
    req.user = { userID: payload.userID, role: payload.role, email: payload.email };
    req.token = token;
    next();
  } catch (error) {
    res.status(500).json({ message: 'Internal server error during authentication.' });
  }
};

/**
 * Middleware factory: only allows users whose role matches one of the allowed roles.
 * Must be used AFTER authenticate.
 */
export const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Authentication required.' });
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied. Required role(s): ' + roles.join(', ') + '. Your role: ' + req.user.role + '.' });
  }
  next();
};

/**
 * Middleware: allows access only when the authenticated user is accessing
 * their OWN resource or is an ADMIN.
 * Must be used AFTER authenticate.
 */
export const authorizeSelfOrAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Authentication required.' });
  const requestedId = parseInt(req.params.id, 10);
  const isOwner = req.user.userID === requestedId;
  const isAdmin = req.user.role === 'ADMIN';
  if (!isOwner && !isAdmin) {
    return res.status(403).json({ message: 'Access denied. You can only access your own resources.' });
  }
  next();
};
