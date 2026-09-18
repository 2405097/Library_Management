import express from 'express';
import {
  getUsers,
  getUser,
  createNewUser,
  updateUserDetails,
  deleteUserDetails,
  loginUser,
  logoutUser,
  getBorrowRecordsByUser,
  borrowBookForUser,
  getBookReviewsByUser,
  createBookReviewForUser,
  getOrdersByUser,
  createOrderForUser,
  getLibraryReviewsByUser,
  createLibraryReviewForUser,
  getWishlistForUser,
  addToWishlistForUser,
  removeFromWishlistForUser,
  moveInWishlistForUser,
} from '../Controllers/user.controller.js';
import { authenticate, authorize, authorizeSelfOrAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// ── Public routes (no token required) ──────────────────────────────────────
// POST /api/users/login — authenticate and receive a JWT
router.post('/login', loginUser);

// POST /api/users — register a new user account
router.post('/', createNewUser);

// ── Authenticated routes ────────────────────────────────────────────────────
// POST /api/users/logout — revoke the current JWT (genuine server-side logout)
router.post('/logout', authenticate, logoutUser);

// ── Admin-only routes ───────────────────────────────────────────────────────
// GET /api/users — list all users (ADMIN only)
router.get('/', authenticate, authorize('ADMIN'), getUsers);

// DELETE /api/users/:id — delete a user (ADMIN only)
router.delete('/:id', authenticate, authorize('ADMIN'), deleteUserDetails);

// ── Self-or-Admin routes (user can access own data; ADMIN can access any) ──
// GET /api/users/:id — get user profile
router.get('/:id', authenticate, authorizeSelfOrAdmin, getUser);

// PUT /api/users/:id — update user profile
router.put('/:id', authenticate, authorizeSelfOrAdmin, updateUserDetails);

// GET /api/users/:id/borrow-records
router.get('/:id/borrow-records', authenticate, authorizeSelfOrAdmin, getBorrowRecordsByUser);

// POST /api/users/:id/borrow - place a borrow request awaiting admin approval
router.post('/:id/borrow', authenticate, authorizeSelfOrAdmin, borrowBookForUser);

// GET /api/users/:id/book-reviews
router.get('/:id/book-reviews', authenticate, authorizeSelfOrAdmin, getBookReviewsByUser);

// POST /api/users/:id/book-reviews - only allowed for books this user borrowed
router.post('/:id/book-reviews', authenticate, authorizeSelfOrAdmin, createBookReviewForUser);

// GET /api/users/:id/orders
router.get('/:id/orders', authenticate, authorizeSelfOrAdmin, getOrdersByUser);
router.post('/:id/orders', authenticate, authorizeSelfOrAdmin, createOrderForUser);

// GET /api/users/:id/library-reviews
router.get('/:id/library-reviews', authenticate, authorizeSelfOrAdmin, getLibraryReviewsByUser);

// POST /api/users/:id/library-reviews — submit a library review
router.post('/:id/library-reviews', authenticate, authorizeSelfOrAdmin, createLibraryReviewForUser);

// Wishlist routes
router.get('/:id/wishlist', authenticate, authorizeSelfOrAdmin, getWishlistForUser);
router.post('/:id/wishlist', authenticate, authorizeSelfOrAdmin, addToWishlistForUser);
router.delete('/:id/wishlist/:bookID', authenticate, authorizeSelfOrAdmin, removeFromWishlistForUser);
router.patch('/:id/wishlist/:bookID', authenticate, authorizeSelfOrAdmin, moveInWishlistForUser);

export default router;

