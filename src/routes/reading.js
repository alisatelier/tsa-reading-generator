// src/routes/reading.js
import express from "express";
import { parseReadingRequestBody } from "../services/readingRequestParser.js";
import { generateReading } from "../services/readingService.js";

const router = express.Router();

router.post("/", async (request, response) => {
  try {
    const { userQuestionText, spreadNameText, cardLinesText } =
      parseReadingRequestBody(request.body);

    const { readingText, debug } = await generateReading({
      userQuestionText,
      spreadNameText,
      cardLinesText,
    });

    response.json({
      ok: true,
      readingText,
      debug,
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      errorMessage: "Reading generation failed",
      errorDetails: String(error),
    });
  }
});

export default router;
