require("dotenv").config();

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const Database = require("better-sqlite3");
const Razorpay = require("razorpay");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const PRODUCTS_FILE = path.join(DATA_DIR, "products.json");
const DB_FILE = path.join(DATA_DIR, "saranga.sqlite");

if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(express.json({ limit: "30kb" }));
app.use(express.static(PUBLIC_DIR, { extensions: ["html"], maxAge: process.env.NODE_ENV === "production" ? "1h" : 0 }));

const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many checkout attempts. Please try again in a few minutes." }
});

const db = new Database(DB_FILE);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS addresses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    line1 TEXT NOT NULL,
    landmark TEXT,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    postal_code TEXT NOT NULL,
    country TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    address_id INTEGER NOT NULL REFERENCES addresses(id),
    razorpay_order_id TEXT NOT NULL UNIQUE,
    amount_paise INTEGER NOT NULL,
    currency TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'created',
    items_json TEXT NOT NULL,
    razorpay_payment_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    paid_at TEXT
  );
`);

let firebaseAdminAuth = null;
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    const admin = require("firebase-admin");
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    firebaseAdminAuth = admin.auth();
    console.log("Firebase Admin token verification enabled.");
  } catch (error) {
    console.error("Firebase Admin could not initialise. Google-authenticated checkout will be rejected until this is fixed:", error.message);
  }
}

function getProducts() {
  const value = JSON.parse(fs.readFileSync(PRODUCTS_FILE, "utf8"));
  if (!Array.isArray(value)) throw new Error("The product catalogue must be an array.");
  return value;
}

function getRazorpay() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret || keyId.includes("REPLACE") || keySecret.includes("REPLACE")) {
    const error = new Error("Online payment is not configured yet. Add your Razorpay Test Mode keys to the server .env file.");
    error.status = 503;
    throw error;
  }
  return { client: new Razorpay({ key_id: keyId, key_secret: keySecret }), keyId, keySecret };
}

function cleanText(value, field, maxLength, required = true) {
  if (typeof value !== "string") throw Object.assign(new Error(`${field} is required.`), { status: 400 });
  const clean = value.trim();
  if (required && !clean) throw Object.assign(new Error(`${field} is required.`), { status: 400 });
  if (clean.length > maxLength) throw Object.assign(new Error(`${field} is too long.`), { status: 400 });
  return clean;
}

function validateAddress(raw) {
  if (!raw || typeof raw !== "object") throw Object.assign(new Error("Please provide your delivery address."), { status: 400 });
  const address = {
    name: cleanText(raw.name, "Full name", 100),
    email: cleanText(raw.email, "Email address", 150).toLowerCase(),
    phone: cleanText(raw.phone, "Phone number", 18),
    line1: cleanText(raw.line1, "Address", 220),
    landmark: cleanText(raw.landmark || "", "Landmark", 100, false),
    city: cleanText(raw.city, "City", 80),
    state: cleanText(raw.state, "State", 80),
    postalCode: cleanText(raw.postalCode, "PIN code", 6),
    country: cleanText(raw.country || "India", "Country", 60)
  };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.email)) throw Object.assign(new Error("Please enter a valid email address."), { status: 400 });
  if (!/^[0-9+() -]{10,18}$/.test(address.phone) || address.phone.replace(/\D/g, "").length < 10) {
    throw Object.assign(new Error("Please enter a valid phone number."), { status: 400 });
  }
  if (!/^\d{6}$/.test(address.postalCode)) throw Object.assign(new Error("Please enter a valid 6-digit PIN code."), { status: 400 });
  return address;
}

function validateItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length < 1 || rawItems.length > 20) {
    throw Object.assign(new Error("Your bag is empty or contains too many items."), { status: 400 });
  }
  const catalogue = getProducts().filter(product => product.active !== false);
  const normalised = new Map();
  for (const item of rawItems) {
    const id = typeof item?.id === "string" ? item.id : "";
    const quantity = Number(item?.quantity);
    const product = catalogue.find(entry => entry.id === id);
    if (!product) throw Object.assign(new Error("One of the products in your bag is no longer available."), { status: 400 });
    if (!Number.isSafeInteger(product.price) || product.price < 1) {
      throw Object.assign(new Error(`The listed price for ${product.name} needs to be checked.`), { status: 500 });
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      throw Object.assign(new Error("Please check the quantity in your bag."), { status: 400 });
    }
    const combinedQuantity = (normalised.get(id) || 0) + quantity;
    if (combinedQuantity > 20) throw Object.assign(new Error("A maximum of 20 units per product can be ordered."), { status: 400 });
    normalised.set(id, combinedQuantity);
  }
  const items = [...normalised.entries()].map(([id, quantity]) => {
    const product = catalogue.find(entry => entry.id === id);
    return { id, name: product.name, quantity, unitPrice: product.price, lineTotal: product.price * quantity };
  });
  const amountRupees = items.reduce((sum, item) => sum + item.lineTotal, 0);
  if (!Number.isSafeInteger(amountRupees) || amountRupees < 1 || amountRupees > 500000) {
    throw Object.assign(new Error("This order total is outside the allowed checkout range."), { status: 400 });
  }
  return { items, amountRupees, amountPaise: amountRupees * 100 };
}

async function getVerifiedUser(req) {
  const authorization = req.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return null;
  if (!firebaseAdminAuth) {
    throw Object.assign(new Error("Google sign-in verification is not configured on the server. Please check Firebase Admin settings, or continue as a guest."), { status: 503 });
  }
  try {
    return await firebaseAdminAuth.verifyIdToken(authorization.slice(7));
  } catch {
    throw Object.assign(new Error("Your sign-in session has expired. Please sign in again."), { status: 401 });
  }
}

const saveOrderRecords = db.transaction(({ address, razorpayOrder, items }) => {
  const existingCustomer = db.prepare("SELECT id FROM customers WHERE email = ?").get(address.email);
  db.prepare(`
    INSERT INTO customers (name, email, phone) VALUES (?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET name = excluded.name, phone = excluded.phone, updated_at = CURRENT_TIMESTAMP
  `).run(address.name, address.email, address.phone);
  const customer = db.prepare("SELECT id FROM customers WHERE email = ?").get(address.email);
  db.prepare("UPDATE addresses SET is_default = 0 WHERE customer_id = ?").run(customer.id);
  const addressResult = db.prepare(`
    INSERT INTO addresses (customer_id, line1, landmark, city, state, postal_code, country, is_default)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(customer.id, address.line1, address.landmark, address.city, address.state, address.postalCode, address.country);
  db.prepare(`
    INSERT INTO orders (customer_id, address_id, razorpay_order_id, amount_paise, currency, status, items_json)
    VALUES (?, ?, ?, ?, ?, 'created', ?)
  `).run(customer.id, addressResult.lastInsertRowid, razorpayOrder.id, razorpayOrder.amount, razorpayOrder.currency, JSON.stringify(items));
  return { customerId: customer.id, addressId: addressResult.lastInsertRowid };
});

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "saranga-storefront" }));

app.get("/api/products", (_req, res) => {
  try {
    const products = getProducts().filter(product => product.active !== false).sort((a, b) => a.sortOrder - b.sortOrder);
    res.set("Cache-Control", "no-store").json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "The product catalogue could not be loaded." });
  }
});

app.post("/api/checkout/create-order", checkoutLimiter, async (req, res, next) => {
  try {
    const verifiedUser = await getVerifiedUser(req);
    const address = validateAddress(req.body?.address);
    if (verifiedUser?.email) {
      if (address.email !== verifiedUser.email.toLowerCase()) {
        throw Object.assign(new Error("Please use the email address associated with your Google account."), { status: 400 });
      }
      address.email = verifiedUser.email.toLowerCase();
    }
    const { items, amountPaise } = validateItems(req.body?.items);
    const { client, keyId } = getRazorpay();
    const razorpayOrder = await client.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: `saranga_${Date.now()}`,
      notes: {
        customer_email: address.email,
        city: address.city,
        postal_code: address.postalCode
      }
    });
    saveOrderRecords({ address, razorpayOrder, items });
    res.status(201).json({
      keyId,
      order: { id: razorpayOrder.id, amount: razorpayOrder.amount, currency: razorpayOrder.currency }
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/checkout/verify-payment", checkoutLimiter, async (req, res, next) => {
  try {
    await getVerifiedUser(req);
    const orderId = cleanText(req.body?.razorpay_order_id, "Razorpay order ID", 80);
    const paymentId = cleanText(req.body?.razorpay_payment_id, "Razorpay payment ID", 80);
    const signature = cleanText(req.body?.razorpay_signature, "Razorpay signature", 256);
    const { keySecret } = getRazorpay();
    const order = db.prepare("SELECT id, status FROM orders WHERE razorpay_order_id = ?").get(orderId);
    if (!order) throw Object.assign(new Error("We could not find this order. Please contact Saranga with your payment reference."), { status: 404 });
    if (order.status === "paid") return res.json({ verified: true, message: "Payment already verified." });
    const expected = crypto.createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");
    const expectedBuffer = Buffer.from(expected, "hex");
    const actualBuffer = Buffer.from(signature, "hex");
    if (expectedBuffer.length !== actualBuffer.length || !crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
      throw Object.assign(new Error("Payment signature could not be verified. Please contact Saranga before retrying."), { status: 400 });
    }
    db.prepare(`UPDATE orders SET status = 'paid', razorpay_payment_id = ?, paid_at = CURRENT_TIMESTAMP WHERE razorpay_order_id = ?`)
      .run(paymentId, orderId);
    res.json({ verified: true, message: "Payment verified." });
  } catch (error) {
    next(error);
  }
});

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.use((req, res) => res.status(404).json({ error: "Not found." }));
app.use((error, _req, res, _next) => {
  const status = Number.isInteger(error.status) ? error.status : 500;
  if (status >= 500) console.error(error);
  res.status(status).json({ error: status >= 500 ? "Something went wrong. Please try again." : error.message });
});

app.listen(PORT, () => {
  console.log(`Saranga storefront running at http://localhost:${PORT}`);
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_ID.includes("REPLACE") || process.env.RAZORPAY_KEY_SECRET.includes("REPLACE")) {
    console.warn("Razorpay is not configured. Product browsing and cart work; online payment is disabled until .env keys are added.");
  }
});
