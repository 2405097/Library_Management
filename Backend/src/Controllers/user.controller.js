import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database.js';
import { 
  createUser, 
  findUserById, 
  findUserByEmail, 
  findUser,
  updateLastLogin,
  getAllUsers,
  updateUser,
  deleteUser,
  getBorrowRecordsByUserId,
  getBookReviewsByUserId,
  getOrdersByUserId,
  getLibraryReviewsByUserId,
  createLibraryReview,
  searchBooksByField,
  getAdminSummary,
  getAdminBooks,
  getAdminBorrowRecords,
  getAdminOrders
} from '../Models/user.model.js';

// Login user — verifies bcrypt password, issues signed JWT
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await findUser(email);
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Verify password against bcrypt hash stored in DB
    const passwordMatch = await bcrypt.compare(password, user.passHash);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Update last login timestamp
    await updateLastLogin(user.userID);

    // Sign JWT — role comes from DB, never from request body
    const token = jwt.sign(
      { userID: user.userID, role: user.role, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Exclude password hash from response
    const { passHash, ...userWithoutPassword } = user;
    res.status(200).json({
      message: 'Login successful',
      token,
      user: userWithoutPassword,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Logout user — revokes the JWT so it cannot be reused even before expiry
export const logoutUser = async (req, res) => {
  try {
    // req.token is set by the authenticate middleware
    await pool.query(
      'INSERT INTO revoked_token (token) VALUES ($1) ON CONFLICT DO NOTHING',
      [req.token]
    );
    res.status(200).json({ message: 'Logged out successfully.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all users
export const getUsers = async (req, res) => {
  try {
    const users = await getAllUsers();
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get user by ID
export const getUser = async (req, res) => {
  try {
    const user = await findUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create new user — password is bcrypt-hashed before storage
export const createNewUser = async (req, res) => {
  try {
    const { name, email, phone, address, role = 'MEMBER', password, passHash, username } = req.body;
    
    if (!name || !email || (!password && !passHash)) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    // Check if user exists
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ message: 'User with this email already exists' });
    }

    // Hash password before storing — never store plaintext
    const rawPassword = password || passHash;
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    const user = await createUser({
      name,
      email,
      phone: phone || null,
      address: address || null,
      role: role || 'MEMBER',
      password: hashedPassword,
      username: username || null,
    });

    res.status(201).json({
      message: 'User created successfully',
      user,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update user
export const updateUserDetails = async (req, res) => {
  try {
    const user = await updateUser(req.params.id, req.body);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete user
export const deleteUserDetails = async (req, res) => {
  try {
    const user = await deleteUser(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const searchBooks = async (req, res) => {
  try {
    const { field, keyword } = req.query;

    if (!field || !keyword) {
      return res.status(400).json({ message: "Search field and keyword are required" });
    }

    const books = await searchBooksByField(field, keyword);
    res.status(200).json(books);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getBorrowRecordsByUser = async (req, res) => {
  try {
    const records = await getBorrowRecordsByUserId(req.params.id);
    res.status(200).json(records);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getBookReviewsByUser = async (req, res) => {
  try {
    const reviews = await getBookReviewsByUserId(req.params.id);
    res.status(200).json(reviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getOrdersByUser = async (req, res) => {
  try {
    const orders = await getOrdersByUserId(req.params.id);
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getLibraryReviewsByUser = async (req, res) => {
  try {
    const reviews = await getLibraryReviewsByUserId(req.params.id);
    res.status(200).json(reviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createLibraryReviewForUser = async (req, res) => {
  try {
    const { rating, reportDetails } = req.body;

    if (!rating || !reportDetails || !String(reportDetails).trim()) {
      return res.status(400).json({ message: "Rating and review details are required" });
    }

    const numericRating = Number(rating);
    if (Number.isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }

    const review = await createLibraryReview(req.params.id, numericRating, reportDetails.trim());
    res.status(201).json({ message: "Library review created successfully", review });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAdminDashboardSummary = async (req, res) => {
  try {
    const summary = await getAdminSummary();
    res.status(200).json(summary);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAdminBooksData = async (req, res) => {
  try {
    const books = await getAdminBooks();
    res.status(200).json(books);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAdminBorrowData = async (req, res) => {
  try {
    const borrowRecords = await getAdminBorrowRecords();
    res.status(200).json(borrowRecords);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAdminOrderData = async (req, res) => {
  try {
    const orders = await getAdminOrders();
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};