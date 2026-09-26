import express from 'express';
import {
  getAdminDashboardSummary,
  getAdminBooksData,
  createAdminBookData,
  updateAdminBookData,
  getAdminBookReviewsData,
  getAdminFeedbackData,
  getAdminBorrowData,
  getAdminOrderData,
  approveBorrowForAdmin,
  rejectBorrowForAdmin,
  returnBookForAdmin,
  resolveFineForAdmin,
  approveOrderForAdmin,
  rejectOrderForAdmin,
  approveAdminSignup,
} from '../Controllers/user.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

// All admin routes require a valid JWT AND ADMIN role
router.get('/summary', authenticate, authorize('ADMIN'), getAdminDashboardSummary);
router.get('/books', authenticate, authorize('ADMIN'), getAdminBooksData);
router.post('/books', authenticate, authorize('ADMIN'), createAdminBookData);
router.put('/books/:bookID', authenticate, authorize('ADMIN'), updateAdminBookData);
router.get('/book-reviews', authenticate, authorize('ADMIN'), getAdminBookReviewsData);
router.get('/feedback', authenticate, authorize('ADMIN'), getAdminFeedbackData);
router.post('/admin-signup-approvals/:id/approve', authenticate, authorize('ADMIN'), approveAdminSignup);
router.get('/borrow-records', authenticate, authorize('ADMIN'), getAdminBorrowData);
router.get('/orders', authenticate, authorize('ADMIN'), getAdminOrderData);
router.post('/borrow-records/:borrowID/approve', authenticate, authorize('ADMIN'), approveBorrowForAdmin);
router.post('/borrow-records/:borrowID/reject', authenticate, authorize('ADMIN'), rejectBorrowForAdmin);
router.post('/borrow-records/:borrowID/return', authenticate, authorize('ADMIN'), returnBookForAdmin);
router.post('/borrow-records/:borrowID/fine', authenticate, authorize('ADMIN'), resolveFineForAdmin);
router.post('/orders/:purchaseNo/approve', authenticate, authorize('ADMIN'), approveOrderForAdmin);
router.post('/orders/:purchaseNo/reject', authenticate, authorize('ADMIN'), rejectOrderForAdmin);

export default router;
