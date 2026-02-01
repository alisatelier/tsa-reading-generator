import express from "express";
import { buildReadingContextText } from "../services/buildReadingContext.js";
import { ollamaGenerate } from "../services/ollama.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const spreadKey = req.body?.spreadKey;
    const questionText = req.body?.questionText;
    const drawnCards = req.body?.drawnCards; // [{ cardId, isReversed }, ...]

    const { systemText, contextText } = buildReadingContextText({
      spreadKey,
      questionText,
      drawnCards,
    });

    const model = "qwen2.5:7b-instruct";

    const generation = await ollamaGenerate({
      model,
      system: systemText,
      prompt: contextText,
      options: {
        temperature: 0.85,
        top_p: 0.9,
        repeat_penalty: 1.12,
      },
    });

    res.json({ ok: true, reading: generation?.response || generation });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;
