import cors from "cors";
import express from "express";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("API running...");
});

const PORT = 5432; // Default port, can be overridden by .env

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});