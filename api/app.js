const crypto = require("node:crypto");
const express = require("express");
const mongoose = require("mongoose");

const app = express();
const commitSchema = new mongoose.Schema(
  {
    sha: { type: String, required: true, unique: true, trim: true },
    message: { type: String, required: true, trim: true },
    author: { type: String, required: true, trim: true },
    timestamp: { type: Date, required: true },
    repository: { type: String, required: true, trim: true },
    url: { type: String, default: "" },
  },
  { timestamps: true },
);

const Commit =
  mongoose.models.Commit || mongoose.model("Commit", commitSchema);

let connectionPromise;

async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI must be configured.");
  }

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(process.env.MONGODB_URI).catch((error) => {
      connectionPromise = undefined;
      throw error;
    });
  }

  await connectionPromise;
}

app.use(
  express.json({
    limit: "2mb",
    verify(request, response, buffer) {
      request.rawBody = buffer;
    },
  }),
);

app.get("/api/health", (request, response) => {
  response.json({ status: "ok" });
});

app.get("/api/commits", async (request, response, next) => {
  try {
    await connectToDatabase();
    const commits = await Commit.find()
      .sort({ timestamp: -1 })
      .limit(100)
      .lean();

    response.json({ commits });
  } catch (error) {
    next(error);
  }
});

app.post("/api/webhook", async (request, response, next) => {
  try {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (secret) {
      const signature = request.get("x-hub-signature-256") || "";
      const expected = `sha256=${crypto
        .createHmac("sha256", secret)
        .update(request.rawBody)
        .digest("hex")}`;
      const signatureBuffer = Buffer.from(signature);
      const expectedBuffer = Buffer.from(expected);

      if (
        signatureBuffer.length !== expectedBuffer.length ||
        !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
      ) {
        return response.status(401).json({ error: "Invalid webhook signature." });
      }
    }

    if (request.get("x-github-event") !== "push") {
      return response.status(202).json({ message: "Event ignored." });
    }

    const payload = request.body;
    const repository = payload?.repository?.full_name;
    const incomingCommits = payload?.commits;

    if (
      typeof repository !== "string" ||
      !repository.trim() ||
      !Array.isArray(incomingCommits)
    ) {
      return response
        .status(400)
        .json({ error: "Expected a GitHub push payload with repository and commits." });
    }

    const parsedCommits = [];
    for (const [index, commit] of incomingCommits.entries()) {
      const timestamp = new Date(commit?.timestamp);
      const sha = typeof commit?.id === "string" ? commit.id.trim() : "";
      const message =
        typeof commit?.message === "string" ? commit.message.trim() : "";
      const author =
        typeof commit?.author?.name === "string"
          ? commit.author.name.trim()
          : "";

      if (!sha || !message || !author || Number.isNaN(timestamp.getTime())) {
        return response.status(400).json({
          error: `Commit at index ${index} is missing valid required fields.`,
        });
      }

      parsedCommits.push({
        sha,
        message,
        author,
        timestamp,
        repository: repository.trim(),
        url: typeof commit.url === "string" ? commit.url : "",
      });
    }

    const operations = parsedCommits.map((commit) => ({
      updateOne: {
        filter: { sha: commit.sha },
        update: {
          $set: commit,
        },
        upsert: true,
      },
    }));

    await connectToDatabase();
    if (operations.length > 0) {
      await Commit.bulkWrite(operations, { ordered: true });
    }

    return response.status(202).json({
      message: "Push event processed.",
      received: operations.length,
    });
  } catch (error) {
    next(error);
  }
});

app.use((error, request, response, next) => {
  const status =
    Number.isInteger(error.status) && error.status >= 400 && error.status < 500
      ? error.status
      : 500;
  if (status === 500) {
    console.error("API request failed:", error);
  }
  response.status(status).json({
    error:
      status === 500
        ? "The request could not be completed."
        : "The request body is invalid.",
  });
});

module.exports = app;
