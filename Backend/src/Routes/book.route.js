import express from 'express';
import { searchBooks, getCatalogBooks, getPopularBooksData, getBookDetails, getBookReviews, getRelatedBooks } from '../Controllers/user.controller.js';

const router = express.Router();

router.get('/search', searchBooks);
router.get('/catalog', getCatalogBooks);
router.get('/popular', getPopularBooksData);
router.get('/:id', getBookDetails);
router.get('/:id/reviews', getBookReviews);
router.get('/:id/related', getRelatedBooks);

export default router;
