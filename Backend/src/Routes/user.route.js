import express from 'express';
import {
  getUsers,
  getUser,
  createNewUser,
  updateUserDetails,
  deleteUserDetails,
  loginUser,
  getBorrowRecordsByUser,
  getBookReviewsByUser,
  getOrdersByUser,
  getLibraryReviewsByUser,
  createLibraryReviewForUser,
} from '../Controllers/user.controller.js';

const router = express.Router();

// POST /api/users/login - Login user
router.post('/login', loginUser);

// POST /api/users - Create new user
router.post('/', createNewUser);

// GET /api/users - Get all users
router.get('/', getUsers);

// GET /api/users/:id - Get single user
router.get('/:id', getUser);

// GET /api/users/:id/borrow-records - Borrow records for a user
router.get('/:id/borrow-records', getBorrowRecordsByUser);

// GET /api/users/:id/book-reviews - Book reviews for a user
router.get('/:id/book-reviews', getBookReviewsByUser);

// GET /api/users/:id/orders - Orders for a user
router.get('/:id/orders', getOrdersByUser);

// GET /api/users/:id/library-reviews - Library reviews for a user
router.get('/:id/library-reviews', getLibraryReviewsByUser);

// POST /api/users/:id/library-reviews - Add a library review for a user
router.post('/:id/library-reviews', createLibraryReviewForUser);

// PUT /api/users/:id - Update user
router.put('/:id', updateUserDetails);

// DELETE /api/users/:id - Delete user
router.delete('/:id', deleteUserDetails);

export default router;