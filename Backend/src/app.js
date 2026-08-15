import express from "express"
import cors from "cors"

const app = express();
app.use(express.json());
app.use(cors());

//Import route
import userRoutes from "./Routes/user.route.js";

//Mount route
app.use("/api/users", userRoutes);

export default app;