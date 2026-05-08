const fs = require("fs");
const path = require("path");
const express = require("express");
const QRCode = require("qrcode");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "cards.json");
const CARD_TEMPLATE = path.join(__dirname, "views", "card.html");

fs.mkdirSync(DATA_DIR, { recursive: true });

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
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

function getBaseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) {
    return process.env.PUBLIC_BASE_URL.replace(/\/+$/, "");
  }

  return `${req.protocol}://${req.get("host")}`;
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

app.post("/api/cards", async (req, res) => {
  const { card, errors } = validateCard(req.body);

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  const cards = readCards();
  const slug = createUniqueSlug(card.name, cards);
  const baseUrl = getBaseUrl(req);
  const cardUrl = `${baseUrl}/card/${slug}`;
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
  const currentUrl = `${getBaseUrl(req)}/card/${encodeURIComponent(card.slug)}`;
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

app.listen(PORT, () => {
  console.log(`QR Card app running on http://localhost:${PORT}`);
});
