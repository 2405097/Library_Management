import { 
  createUser, 
  findUserById, 
  findUserByEmail, 
  findUser,
  updateLastLogin,
  getAllUsers,
  updateUser,
  deleteUser 
} from '../Models/user.model.js';

// Login user
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

    if (user.passHash !== password) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Update last login timestamp
    await updateLastLogin(user.userID);

    // Exclude password hash from response
    const { passHash, ...userWithoutPassword } = user;
    res.status(200).json({
      message: 'Login successful',
      user: userWithoutPassword,
    });
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

// Create new user
export const createNewUser = async (req, res) => {
  try {
    const { name, email, phone, address, role = 'MEMBER', password, passHash, username } = req.body;
    
    if (!name || !email || (!password && !passHash)) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    // Check if user exists
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }
    
    const user = await createUser({
      name,
      email,
      phone: phone || null,
      address: address || null,
      role: role || 'MEMBER',
      password: password || passHash,
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