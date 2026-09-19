import { Router } from "express";
import multer from "multer";
import { config } from "../config.js";
import { HttpError } from "../lib/errors.js";
import { extractAssessmentFromPdf } from "../services/extraction.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxPdfBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    const isPdf = file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf");
    if (!isPdf) return cb(new HttpError(415, "Only PDF files are accepted."));
    cb(null, true);
  },
});

export const assessmentsRouter = Router();

/**
 * POST /api/assessments/extract
 * multipart/form-data with a single "file" field (PDF).
 * Returns { assessment } in the TriMetrix DNA JSON schema.
 */
assessmentsRouter.post("/extract", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) throw new HttpError(400, "Attach a PDF in the 'file' field.");
    // A PDF starts with "%PDF". Reject anything else early rather than paying for a model call.
    if (req.file.buffer.subarray(0, 4).toString("latin1") !== "%PDF") {
      throw new HttpError(415, "That file does not look like a PDF.");
    }
    const assessment = await extractAssessmentFromPdf(req.file.buffer);
    res.json({ assessment });
  } catch (err) {
    next(err);
  }
});
