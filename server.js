require("dotenv").config();
const fs = require("fs");
const path = require("path");
const express = require("express");
const QRCode = require("qrcode");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/+$/, "");
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "cards.json");
const CARD_TEMPLATE = path.join(__dirname, "views", "card.html");

if (!process.env.ADMIN_SECRET) {
  throw new Error("ADMIN_SECRET is required.");
}

fs.mkdirSync(DATA_DIR, { recursive: true });

app.use(helmet());
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(express.static(path.join(__dirname, "public")));

function readCards() {
  if (!fs.existsSync(DATA_FILE)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (error) {
    console.error("Failed to read cards.json:", error);
    return {};
  }
}
const createCardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Muitas tentativas. Tente novamente mais tarde."
});

function writeCards(cards) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(cards, null, 2));
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function slugify(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function normalizeUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function createUniqueSlug(name, cards) {
  const base = slugify(name) || `card-${Date.now()}`;
  let slug = base;
  let counter = 2;

  while (cards[slug]) {
    slug = `${base}-${counter}`;
    counter += 1;
  }

  return slug;
}

function validateCard(input) {
  const card = {
    name: String(input.name || "").trim(),
    role: String(input.role || "").trim(),
    linkedin: normalizeUrl(input.linkedin),
    github: normalizeUrl(input.github),
    email: String(input.email || "").trim().toLowerCase()
  };

  const errors = [];

  if (!card.name) {
    errors.push("Name is required.");
  }

  if (!card.role) {
    errors.push("Role is required.");
  }

  if (!card.linkedin) {
    errors.push("LinkedIn is required.");
  }

  if (!card.github) {
    errors.push("GitHub is required.");
  }

  if (!card.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(card.email)) {
    errors.push("A valid email is required.");
  }

  return { card, errors };
}

app.post("/api/cards", createCardLimiter, async (req, res) => {
  const { card, errors } = validateCard(req.body);

  if (req.body.secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  const cards = readCards();
  const slug = createUniqueSlug(card.name, cards);
  const cardUrl = `${BASE_URL}/card/${slug}`;
  const qrCode = await QRCode.toDataURL(cardUrl, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 280
  });

  cards[slug] = {
    ...card,
    slug,
    cardUrl,
    createdAt: new Date().toISOString()
  };

  writeCards(cards);

  return res.status(201).json({
    slug,
    cardUrl,
    qrCode,
    card: cards[slug]
  });
});

app.get("/card/:slug", async (req, res) => {
  const cards = readCards();
  const card = cards[req.params.slug];

  if (!card) {
    return res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
  }

  const template = fs.readFileSync(CARD_TEMPLATE, "utf8");
  const currentUrl = `${BASE_URL}/card/${encodeURIComponent(card.slug)}`;
  const qrCode = await QRCode.toDataURL(currentUrl, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 240
  });

  const html = template
    .replaceAll("{{name}}", escapeHtml(card.name))
    .replaceAll("{{role}}", escapeHtml(card.role))
    .replaceAll("{{email}}", escapeHtml(card.email))
    .replaceAll("{{linkedin}}", escapeHtml(card.linkedin))
    .replaceAll("{{github}}", escapeHtml(card.github))
    .replaceAll("{{cardUrl}}", escapeHtml(currentUrl))
    .replaceAll("{{qrCode}}", qrCode);

  return res.send(html);
});

app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on ${BASE_URL}`);
});
