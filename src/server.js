import express from "express";
import cors from "cors";

import readingRouter from "./routes/reading.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// We'll rebuild the /reading endpoint via a router module
app.use("/reading", readingRouter);

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  console.log(`Reading server running on http://localhost:${PORT}`);
});
