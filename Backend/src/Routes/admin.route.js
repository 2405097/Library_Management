import express from 'express';
import {
  getAdminDashboardSummary,
  getAdminBooksData,
  getAdminBorrowData,
  getAdminOrderData,
  returnBookForAdmin,
  approveOrderForAdmin,
} from '../Controllers/user.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

// All admin routes require a valid JWT AND ADMIN role
router.get('/summary', authenticate, authorize('ADMIN'), getAdminDashboardSummary);
router.get('/books', authenticate, authorize('ADMIN'), getAdminBooksData);
router.get('/borrow-records', authenticate, authorize('ADMIN'), getAdminBorrowData);
router.get('/orders', authenticate, authorize('ADMIN'), getAdminOrderData);
router.post('/borrow-records/:borrowID/return', authenticate, authorize('ADMIN'), returnBookForAdmin);
router.post('/orders/:purchaseNo/approve', authenticate, authorize('ADMIN'), approveOrderForAdmin);

export default router;
