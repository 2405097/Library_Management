import express from 'express';
import {
  getAdminDashboardSummary,
  getAdminBooksData,
  getAdminBorrowData,
  getAdminOrderData,
} from '../Controllers/user.controller.js';

const router = express.Router();

router.get('/summary', getAdminDashboardSummary);
router.get('/books', getAdminBooksData);
router.get('/borrow-records', getAdminBorrowData);
router.get('/orders', getAdminOrderData);

export default router;
