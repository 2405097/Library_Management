import dotenv from 'dotenv';
import app from './app.js';
import { connectDB } from './config/database.js';

dotenv.config({
    path: '.env'
});

const startServer = async () => {
  try {
    // 1. Connect to PostgreSQL
    await connectDB();

    const PORT = process.env.PORT || 8000;

    // 2. Start Express app listener
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
  }
};

startServer();