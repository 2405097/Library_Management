import express from 'express';
import { 
  getUsers, 
  getUser, 
  createNewUser, 
  updateUserDetails, 
  deleteUserDetails 
} from '../controllers/user.controller.js';

const router = express.Router();

// GET /api/users - Get all users
router.get('/', getUsers);

// GET /api/users/:id - Get single user
router.get('/:id', getUser);

// POST /api/users - Create new user
router.post('/', createNewUser);

// PUT /api/users/:id - Update user
router.put('/:id', updateUserDetails);

// DELETE /api/users/:id - Delete user
router.delete('/:id', deleteUserDetails);

export default router;