# SARANGA — Website MVP Product & Developer Specification

## 1. Product objective

Create a premium, warm, responsive direct-to-customer storefront that introduces Saranga's mother-and-daughter food story, showcases its millet/pulse-based products, and lets customers add products to a cart, provide delivery details and pay online.

**Primary MVP outcome:** a customer can discover a product, add it to a cart, enter a complete Indian delivery address, complete Razorpay checkout and have the order/address recorded by the backend.

## 2. Brand direction and messaging

- **Brand:** SARANGA
- **Tagline:** A Mother's Goodness, Made for Every Home.
- **Core line:** “It started with a mother's love. It grew into goodness for every home.”
- **Supporting line:** “Traditional ingredients. Thoughtful recipes. Everyday nourishment.”
- **Positioning:** health-focused food brand offering nutritious millet- and pulse-based instant premixes and ready-to-eat foods. Saranga believes healthy eating should be nutritious, delicious and effortless, with simple ingredients, traditional goodness and convenient preparation.
- **Visual direction:** premium editorial, warm ivory paper, deep forest green, sage, muted terracotta, subtle grain/botanical artwork, refined serif display type and clean sans-serif interface text.

The current interface uses original vector pack illustrations as placeholders. Replace them with approved product photography before launch.

## 3. Information architecture

One continuous, smooth-scroll landing page with four anchor destinations:

1. **Home** (`#home`)
2. **Products** (`#products`)
3. **Our Story** (`#story`)
4. **Contact** (`#contact`)

The navigation remains visible while scrolling. Desktop navigation sits in the header. Mobile uses a separate compact horizontal navigation row.

### Header controls

Three icon-only controls are placed on the top-left:

- **Search:** opens a search dialog; searches product name, category, description and ingredients.
- **My profile:** opens a profile dialog. A new visitor sees “Continue with Google”; returning Google-authenticated users see their display name, email and sign-out action.
- **Cart:** opens a right-side cart drawer showing product image, name, pack size, unit price, quantity controls, remove action and subtotal.

All icon buttons have accessible labels and keyboard focus states even though the visible controls contain icons only.

## 4. Page/section requirements

### Home

- Hero headline: “It started with a mother's love.”
- Supporting line: “It grew into goodness for every home.”
- Brand statement: “Traditional ingredients. Thoughtful recipes. Everyday nourishment.”
- Intro copy explaining that Saranga makes nutritious food easier without compromising on taste or quality.
- Primary CTA scrolls to Products; secondary CTA scrolls to Our Story.
- Brand values strip: traditional goodness, no added preservatives (subject to product-claim substantiation), and everyday convenience.

### Products

The brief says “3 items” but names **four** products. The implementation lists all four:

| Product ID | Display name | Pack size | Price |
|---|---|---:|---:|
| `ragi-idli-premix` | Ragi Idli Premix | 500 g | ₹175 |
| `moongdal-dosa-mix` | Moong Dal Dosa Mix | 500 g | ₹225 |
| `foxtail-millet-khichdi` | Foxtail Millet Khichdi Premix | 500 g | ₹399 |
| `flaxseed-mukhwas` | Flaxseed Mukhwas | 100 g | ₹149 |

Each product card displays image, badge (optional), name, category, pack size, concise description, price, add-to-cart icon and Buy Now action.

Filters: All products, Premixes, Everyday bites.

**Product management rule:** add/edit products only in `data/products.json`. Product imagery is controlled by the `image` path in that file. A product can be hidden by setting `active: false`; its data need not be deleted.

### Our Story

Use the supplied story with editorial line lengths and readable paragraphs:

> **A Mother's Love.**
>
> Saranga began with a simple thought — a mother wanting to make healthy eating easier for her daughters.
>
> Knowing how busy life could get, she started creating homemade instant food premixes that were nutritious, wholesome and quick to prepare. Using traditional ingredients like jowar, foxtail millet, moong dal, flaxseeds and peanuts, she transformed everyday goodness into convenient meals.
>
> What started as a small kitchen experiment soon became something special. Her daughters shared these creations with friends, who loved them and wanted more. Encouraged by the growing demand, we decided to take this little family idea beyond our home.
>
> Today, Saranga brings you a range of wholesome instant premixes and ready-to-eat foods, inspired by traditional recipes and made with the goodness of millets, pulses and seeds.
>
> Our purpose is simple: to make nutritious, home-style food convenient for every home.
>
> From our home to yours, with love.
>
> **Saranga – A Mother's Goodness, Made for Every Home.**

### Contact

- Website: `https://www.saranga.food/`
- Phone: `8529459892` (click-to-call link formatted as `+918529459892`)
- Instagram: `@saranga.food` → `https://www.instagram.com/saranga.food/`
- WhatsApp contact shortcut: `https://wa.me/918529459892`

## 5. Core customer journeys

### Browse and add to cart

1. Customer visits the Home section.
2. Customer scrolls to Products or uses Search.
3. Customer chooses Add to Cart or Buy Now.
4. Cart count updates and cart data persists in browser storage.
5. Cart drawer shows selected items and computed subtotal.

### Cart checkout and payment

1. Customer opens Cart and clicks Continue to Checkout, or chooses Buy Now.
2. Checkout form requires full name, email, phone, address, city, state, PIN code and country.
3. Saved details can prefill the form. The optional browser checkbox remembers the address on that device; the backend also records the submitted fulfilment address with the order.
4. Browser posts item IDs/quantities and delivery details to the backend.
5. Backend reloads the product catalogue, validates product IDs and quantities, calculates the total using server-side product prices and creates a Razorpay order.
6. Browser opens Razorpay Checkout using the returned order ID.
7. Razorpay returns payment ID/signature to the browser handler.
8. Browser posts the payment response to the backend.
9. Backend verifies the HMAC signature with the secret Razorpay key and marks the order `paid` in SQLite.
10. On verified success, cart is cleared and the customer sees an order-confirmation toast.

**Important:** Razorpay is not active until real Test Mode keys are entered into the server `.env`. No secret key is included in the browser code.

### Profile and Google sign-in

1. Customer clicks the profile icon.
2. New customer sees Continue with Google.
3. Firebase Authentication opens the Google sign-in popup once configured.
4. Returning customer sees their name/email and can sign out.
5. A signed-in checkout sends a Firebase ID token; the backend verifies it with Firebase Admin when a service account is configured.
6. Guest checkout remains available in this MVP.

## 6. Functional requirements

| ID | Requirement | Acceptance criteria |
|---|---|---|
| FR-01 | Four-section responsive layout | Home, Products, Our Story and Contact work at desktop/tablet/mobile widths. |
| FR-02 | Sticky navigation | Selecting any nav item scrolls to its section; active section is indicated. |
| FR-03 | Icon-only header tools | Search, profile and cart visible as icons without visible text labels. |
| FR-04 | Product catalogue | Four supplied products and exact supplied prices render from JSON. |
| FR-05 | Search | Matching product results appear and can be added to cart. |
| FR-06 | Category filtering | All, Premixes and Everyday bites filters update the product grid. |
| FR-07 | Cart management | Add, remove, increment, decrement, subtotal and browser persistence work. |
| FR-08 | Buy Now | Adds the selected product and opens address-first checkout. |
| FR-09 | Address capture | Required fields validate before the payment request. |
| FR-10 | Address persistence | Backend saves customer and address records in SQLite. |
| FR-11 | Razorpay | Backend creates orders and verifies payment signatures; browser never decides the payable price. |
| FR-12 | Google Auth | Firebase Google popup flow is available once credentials are supplied; server verifies ID tokens when enabled. |
| FR-13 | Contact | Website, phone, WhatsApp and Instagram links open the right destinations. |

## 7. Data design

### Product JSON

`data/products.json` is the single source of truth for product catalogue display and checkout price validation.

Fields: `id`, `name`, `weight`, `category`, `description`, `price` (whole INR), `image`, `badge`, `ingredients`, `sortOrder`, `active`.

### SQLite tables

- `customers`: name, unique email, phone, timestamps.
- `addresses`: customer ID, street address, landmark, city, state, PIN code, country, default flag and creation date.
- `orders`: customer/address references, unique Razorpay order ID, amount in paise, currency, status, item snapshot JSON, payment ID and timestamps.

The SQLite database is created automatically at `data/saranga.sqlite` on first server start.

## 8. Backend API contract

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Health check. |
| GET | `/api/products` | Returns active products sorted by `sortOrder`. |
| POST | `/api/checkout/create-order` | Validates address/cart, calculates server-side total, creates Razorpay order and stores address/order. |
| POST | `/api/checkout/verify-payment` | Verifies Razorpay signature and marks matching order as paid. |

The checkout API has basic rate limiting, request size limits, input validation and security headers. Payment secrets remain server-side.

## 9. Technical approach

- Front end: semantic HTML, CSS, ES modules and `localStorage`.
- Backend: Node.js 20+, Express.
- Database: SQLite via `better-sqlite3` for MVP/local operation.
- Payments: Razorpay Checkout + server-side order creation and signature verification.
- Authentication: Firebase Authentication (Google provider) + Firebase Admin ID-token verification.
- Product catalogue: JSON file.

The current source tree is deliberately small and easy for a developer to customise.

## 10. Non-functional requirements

- Responsive layouts from small mobile widths to large desktop screens.
- Semantic sections, accessible names for icon buttons, visible keyboard focus and reduced-motion support.
- Server-authoritative prices and payment-signature validation.
- No Razorpay secret or Firebase Admin service-account private key in public files.
- Customer data stored server-side only for checkout fulfilment/order records; browser address prefill is opt-in.
- HTTPS and managed secret storage required in production.

## 11. MVP exclusions / phase two

Not included in this initial MVP: admin dashboard, inventory management, product reviews, coupon engine, shipping aggregator integration, GST invoice generation, automated email/SMS/WhatsApp order notifications, customer order history, loyalty points, wishlist, abandoned-cart recovery, refund dashboard and Razorpay webhook reconciliation.

## 12. Required business decisions before live launch

1. Confirm final product labels, ingredients, allergens, nutrition panels, shelf-life and pack images.
2. Confirm whether “no added preservatives” applies to every SKU and can be substantiated.
3. Define delivery coverage, shipping charges, dispatch timelines, returns/refunds and cancellation rules.
4. Confirm tax/GST treatment and whether displayed prices are inclusive of applicable taxes. Current code charges the sum of product prices only; shipping/tax calculation is not yet implemented.
5. Add the business address/identity and legal policy pages required for customer transparency and payment onboarding.
6. Confirm the support process for failed, pending, refunded or disputed payments.

## 13. Definition of MVP done

- [ ] Brand content, prices and product details approved.
- [ ] Product images replaced with approved photos.
- [ ] Product data can be changed without editing card markup.
- [ ] Search, profile dialog, cart, category filters and Buy Now tested.
- [ ] Address form tested with valid and invalid details.
- [ ] Razorpay Test Mode flow completes and backend marks test order paid after signature verification.
- [ ] Firebase Google sign-in tested with server token verification enabled.
- [ ] Mobile/desktop browser checks completed.
- [ ] Shipping, tax, policies and customer-support details decided before accepting real payments.
- [ ] Production host has HTTPS, environment secrets, persistent database storage and backups.
