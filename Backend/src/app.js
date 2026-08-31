import express from "express"
import cors from "cors"

const app = express();
app.use(express.json());
app.use(cors());

//Import routes
import userRoutes from "./Routes/user.route.js";
import bookRoutes from "./Routes/book.route.js";
import adminRoutes from "./Routes/admin.route.js";

//Mount routes
app.use("/api/users", userRoutes);
app.use("/api/books", bookRoutes);
app.use("/api/admin", adminRoutes);

export default app;