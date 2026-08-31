import express from 'express';
import { searchBooks } from '../Controllers/user.controller.js';

const router = express.Router();

router.get('/search', searchBooks);

export default router;
