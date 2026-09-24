import express from 'express';
import { searchBooks, getBookDetails, getBookReviews } from '../Controllers/user.controller.js';

const router = express.Router();

router.get('/search', searchBooks);
router.get('/:id', getBookDetails);
router.get('/:id/reviews', getBookReviews);

export default router;
