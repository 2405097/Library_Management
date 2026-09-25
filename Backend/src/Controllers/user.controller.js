import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database.js';
import { 
  createUser, 
  findUserById, 
  findUserByEmail, 
  findUser,
  approvePendingAdminSignup,
  findUserWithCredentialsById,
  updateLastLogin,
  getAllUsers,
  updateUser,
  deleteUserAccount,
  getBorrowRecordsByUserId,
  borrowBook,
  approveBorrow,
  rejectBorrow,
  returnBorrowedBook,
  requestBorrowReturn,
  resolveBorrowFine,
  getBookReviewsByUserId,
  createBookReview,
  getOrdersByUserId,
  getLibraryReviewsByUserId,
  createLibraryReview,
  searchBooksByField,
  getBookDetailsById,
  getBookReviewsByBookId,
  getRelatedBooksByBookId,
  getAdminSummary,
  getAdminBooks,
  getAdminBookReviews,
  getAdminFeedback,
  getAdminBorrowRecords,
  getAdminOrders,
  updateAdminBook,
  createOrder,
  approveOrder,
  rejectOrder,
  getWishlistByUserId,
  addToWishlist,
  removeFromWishlist,
  moveInWishlist,
  updateUserCredentials
} from '../Models/user.model.js';

const WISHLIST_LIST_TYPES = ['CURRENTLY_READING', 'WANT_TO_READ', 'FAVORITES'];

const isValidWishlistListType = (listType) => WISHLIST_LIST_TYPES.includes(listType);

// Login user — verifies bcrypt password, issues signed JWT
export const loginUser = async (req, res) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const { password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await findUser(email);
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Verify bcrypt credentials. Older imported accounts may contain plaintext
    // passwords; migrate those values after the first successful login.
    const isBcryptHash = typeof user.passHash === 'string' && /^\$2[aby]\$/.test(user.passHash);
    const passwordMatch = isBcryptHash
      ? await bcrypt.compare(password, user.passHash)
      : password === user.passHash;
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (user.role === 'ADMIN' && user.isApproved === false) {
      return res.status(403).json({ message: 'Admin account creation waiting for approval...' });
    }

    if (!isBcryptHash) {
      await updateUserCredentials(user.userID, {
        passHash: await bcrypt.hash(password, 10),
      });
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

export const approveAdminSignup = async (req, res) => {
  try {
    const userID = Number(req.params.id);
    if (!Number.isInteger(userID) || userID < 1) {
      return res.status(400).json({ message: 'A valid admin user ID is required.' });
    }

    const user = await approvePendingAdminSignup(userID);
    if (!user) {
      return res.status(409).json({ message: 'Admin signup is already approved or does not exist.' });
    }

    res.status(200).json({ message: 'Admin signup approved successfully.', user });
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
    const { name, phone, address, password, passHash, username } = req.body;
    const normalizedName = typeof name === 'string' ? name.trim() : '';
    const normalizedEmail = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    
    if (!normalizedName || !normalizedEmail || (!password && !passHash)) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    // Check if user exists
    const existingUser = await findUserByEmail(normalizedEmail);
    if (existingUser) {
      return res.status(409).json({ message: 'User with this email already exists' });
    }

    // Hash password before storing — never store plaintext
    const rawPassword = password || passHash;
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    const user = await createUser({
      name: normalizedName,
      email: normalizedEmail,
      phone: phone || null,
      address: address || null,
      role: req.body.role === 'ADMIN' ? 'ADMIN' : 'MEMBER',
      isApproved: req.body.role !== 'ADMIN',
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
    const updatePayload = { ...req.body };
    if (updatePayload.avatar !== undefined && req.user.role !== 'ADMIN') {
      delete updatePayload.avatar;
    }
    if (updatePayload.name !== undefined) {
      updatePayload.name = typeof updatePayload.name === 'string' ? updatePayload.name.trim() : '';
      if (!updatePayload.name) {
        return res.status(400).json({ message: 'Name cannot be empty' });
      }
    }
    if (updatePayload.email !== undefined) {
      updatePayload.email = typeof updatePayload.email === 'string' ? updatePayload.email.trim().toLowerCase() : '';
      if (!updatePayload.email) {
        return res.status(400).json({ message: 'Email cannot be empty' });
      }
    }
    const user = await updateUser(req.params.id, updatePayload);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json(user);
  } catch (error) {
    if (error.code === '23505' && error.constraint === 'users_email_key') {
      return res.status(409).json({ message: 'That email address is already in use.' });
    }
    res.status(500).json({ message: error.message });
  }
};

export const deleteOwnAccount = async (req, res) => {
  try {
    const requestedID = Number(req.params.id);
    if (!Number.isInteger(requestedID) || requestedID !== Number(req.user.userID)) {
      return res.status(403).json({ message: 'You can only delete your own account' });
    }

    const { password } = req.body || {};
    if (typeof password !== 'string' || password.length === 0) {
      return res.status(400).json({ message: 'Your current password is required' });
    }

    const user = await findUserWithCredentialsById(requestedID);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isBcryptHash = typeof user.passHash === 'string' && /^\$2[aby]\$/.test(user.passHash);
    const passwordMatch = isBcryptHash
      ? await bcrypt.compare(password, user.passHash)
      : password === user.passHash;
    if (!passwordMatch) {
      return res.status(401).json({ message: 'The password is incorrect' });
    }

    const result = await deleteUserAccount(requestedID, req.token);
    if (result.reason === 'NOT_FOUND') {
      return res.status(404).json({ message: 'User not found' });
    }
    if (result.reason === 'OPEN_BORROW') {
      return res.status(409).json({
        message: 'Return or resolve all borrowed books before deleting your account',
      });
    }
    if (result.reason === 'LAST_ADMIN') {
      return res.status(409).json({ message: 'The final administrator account cannot be deleted' });
    }

    return res.status(204).send();
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

export const getBookDetails = async (req, res) => {
  try {
    const bookID = Number(req.params.id);
    if (!Number.isInteger(bookID) || bookID < 1) {
      return res.status(400).json({ message: "A valid book ID is required." });
    }
    const book = await getBookDetailsById(bookID);
    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }
    res.status(200).json(book);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getBookReviews = async (req, res) => {
  try {
    const bookID = Number(req.params.id);
    if (!Number.isInteger(bookID) || bookID < 1) {
      return res.status(400).json({ message: "A valid book ID is required." });
    }
    const reviews = await getBookReviewsByBookId(bookID);
    res.status(200).json(reviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getRelatedBooks = async (req, res) => {
  try {
    const bookID = Number(req.params.id);
    if (!Number.isInteger(bookID) || bookID < 1) {
      return res.status(400).json({ message: "A valid book ID is required." });
    }
    const limit = Number(req.query.limit) || 12;
    const relatedBooks = await getRelatedBooksByBookId(bookID, limit);
    res.status(200).json(relatedBooks);
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

export const getWishlistForUser = async (req, res) => {
  try {
    const wishlist = await getWishlistByUserId(req.params.id);
    res.status(200).json(wishlist);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const addToWishlistForUser = async (req, res) => {
  try {
    const bookID = Number(req.body.bookID);
    const { listType } = req.body;
    if (!Number.isInteger(bookID) || bookID < 1 || !isValidWishlistListType(listType)) {
      return res.status(400).json({ message: 'A valid book and wishlist list are required' });
    }

    const entry = await addToWishlist(req.params.id, bookID, listType);
    res.status(entry ? 201 : 200).json({ entry, alreadyExists: !entry });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const removeFromWishlistForUser = async (req, res) => {
  try {
    const bookID = Number(req.params.bookID);
    const { listType } = req.query;
    if (!Number.isInteger(bookID) || bookID < 1 || !isValidWishlistListType(listType)) {
      return res.status(400).json({ message: 'A valid book and wishlist list are required' });
    }

    const entry = await removeFromWishlist(req.params.id, bookID, listType);
    if (!entry) return res.status(404).json({ message: 'Wishlist entry not found' });
    res.status(200).json({ entry });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const moveInWishlistForUser = async (req, res) => {
  try {
    const bookID = Number(req.params.bookID);
    const { fromList, toList } = req.body;
    if (
      !Number.isInteger(bookID) || bookID < 1
      || !isValidWishlistListType(fromList)
      || !isValidWishlistListType(toList)
      || fromList === toList
    ) {
      return res.status(400).json({ message: 'Valid, different source and destination lists are required' });
    }

    const entry = await moveInWishlist(req.params.id, bookID, fromList, toList);
    if (!entry) return res.status(404).json({ message: 'Wishlist entry not found' });
    res.status(200).json({ entry });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'This book is already in the destination list' });
    }
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

export const updateAdminBookData = async (req, res) => {
  try {
    const bookID = Number(req.params.bookID);
    const borrowDelta = Number(req.body.borrowDelta || 0);
    const orderDelta = Number(req.body.orderDelta || 0);
    const price = Number(req.body.price);
    if (!Number.isInteger(bookID) || !Number.isInteger(borrowDelta) || !Number.isInteger(orderDelta)) {
      return res.status(400).json({ message: 'Book and inventory changes must be valid whole numbers.' });
    }
    if (!Number.isFinite(price) || price < 0) {
      return res.status(400).json({ message: 'Price must be a valid non-negative number.' });
    }
    const book = await updateAdminBook(bookID, borrowDelta, orderDelta, price);
    if (!book) {
      return res.status(409).json({ message: 'The requested inventory change is invalid or the book does not exist.' });
    }
    res.status(200).json({ message: 'Book details updated successfully.', book });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAdminBookReviewsData = async (req, res) => {
  try {
    res.status(200).json(await getAdminBookReviews());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAdminFeedbackData = async (req, res) => {
  try {
    res.status(200).json(await getAdminFeedback());
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

export const createBookReviewForUser = async (req, res) => {
  try {
    const { bookID, rating, comment } = req.body;
    const numericBookID = Number(bookID);
    const numericRating = Number(rating);

    if (!Number.isInteger(numericBookID) || !comment || !String(comment).trim()) {
      return res.status(400).json({ message: 'Book and review comment are required' });
    }
    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    const review = await createBookReview(
      req.params.id,
      numericBookID,
      numericRating,
      String(comment).trim()
    );
    if (!review) {
      return res.status(403).json({ message: 'You can review a book only after borrowing it or receiving order approval' });
    }

    res.status(201).json({ message: 'Book review created successfully', review });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'You have already reviewed this book' });
    }
    res.status(500).json({ message: error.message });
  }
};

export const borrowBookForUser = async (req, res) => {
  try {
    const bookID = Number(req.body.bookID);
    if (!Number.isInteger(bookID)) {
      return res.status(400).json({ message: 'A valid book ID is required' });
    }
    const record = await borrowBook(req.params.id, bookID);
    if (record?.alreadyPending) {
      return res.status(409).json({ message: 'You already have a pending borrow request for this book' });
    }
    if (record?.alreadyBorrowed) {
      return res.status(409).json({ message: 'You already have this book borrowed' });
    }
    if (!record) {
      return res.status(409).json({ message: 'This book is currently unavailable' });
    }
    res.status(201).json({ message: 'Borrow request placed and awaiting admin approval', record });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const approveBorrowForAdmin = async (req, res) => {
  try {
    const record = await approveBorrow(Number(req.params.borrowID));
    if (!record) {
      return res.status(409).json({ message: 'This borrow request is already processed or does not exist' });
    }
    res.status(200).json({ message: 'Borrow request approved successfully', record });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const rejectBorrowForAdmin = async (req, res) => {
  try {
    const record = await rejectBorrow(Number(req.params.borrowID));
    if (!record) {
      return res.status(409).json({ message: 'This borrow request is already processed or does not exist' });
    }
    res.status(200).json({ message: 'Borrow request rejected successfully', record });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const returnBookForAdmin = async (req, res) => {
  try {
    const record = await returnBorrowedBook(Number(req.params.borrowID));
    if (!record) {
      return res.status(409).json({ message: 'This borrow record has already been returned' });
    }
    res.status(200).json({ message: 'Book return processed successfully', record });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const requestReturnForUser = async (req, res) => {
  try {
    const userID = req.params.id;
    const borrowID = Number(req.params.borrowID);
    if (!Number.isInteger(borrowID) || borrowID < 1) {
      return res.status(400).json({ message: 'A valid borrow ID is required.' });
    }
    const record = await requestBorrowReturn(userID, borrowID);
    if (!record) {
      return res.status(404).json({ message: 'Borrow record not found or cannot be returned.' });
    }
    res.status(200).json({ message: 'Return requested successfully', record });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const resolveFineForAdmin = async (req, res) => {
  try {
    const resolution = req.body?.resolution;
    if (!['RETURNED_WITH_FINE', 'FINE_WAIVED'].includes(resolution)) {
      return res.status(400).json({ message: 'A valid fine resolution is required.' });
    }
    const record = await resolveBorrowFine(Number(req.params.borrowID), resolution);
    if (!record) {
      return res.status(409).json({ message: 'This fine is already resolved or does not exist.' });
    }
    res.status(200).json({ message: 'Fine resolution recorded successfully.', record });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createOrderForUser = async (req, res) => {
  try {
    const bookID = Number(req.body.bookID);
    const quantity = Number(req.body.quantity || 1);
    if (!Number.isInteger(bookID) || !Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ message: 'A valid book and quantity are required' });
    }
    const order = await createOrder(req.params.id, bookID, quantity);
    if (!order) return res.status(400).json({ message: 'This book is out of stock or does not exist.' });
    res.status(201).json({ message: 'Order placed and awaiting admin confirmation', order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const approveOrderForAdmin = async (req, res) => {
  try {
    const discountPercentage = Number(req.body?.discountPercentage ?? 0);
    if (!Number.isFinite(discountPercentage) || discountPercentage < 0 || discountPercentage > 50) {
      return res.status(400).json({ message: 'Discount must be between 0% and 50%.' });
    }
    const order = await approveOrder(Number(req.params.purchaseNo), discountPercentage);
    if (!order) return res.status(409).json({ message: 'This order is already approved or does not exist' });
    res.status(200).json({ message: 'Order approved successfully', order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const rejectOrderForAdmin = async (req, res) => {
  try {
    const order = await rejectOrder(Number(req.params.purchaseNo));
    if (!order) return res.status(409).json({ message: 'This order cannot be rejected or does not exist' });
    res.status(200).json({ message: 'Order rejected successfully', order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
