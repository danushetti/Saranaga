# Saranga storefront — developer MVP

A responsive, four-section storefront for Saranga, built with plain HTML/CSS/JavaScript and a small Node.js/Express backend. The front end is intentionally framework-free so a developer can quickly customise the design, products, images and copy.

## What is included

- **Four long-scroll sections:** Home, Products, Our Story and Contact, with sticky navigation and smooth scrolling.
- **Responsive premium design:** desktop, tablet and mobile layouts; editorial serif typography; botanical illustrations; reduced-motion support.
- **Header icon actions:** search, profile and cart are icon-only controls with accessible labels.
- **Search:** searches product names, category, ingredients and descriptions.
- **Product catalogue:** currently includes all four supplied products (the brief said three items but listed four).
- **Cart:** add, remove, increase/decrease quantity, persistent browser cart via `localStorage`, subtotal and Buy Now.
- **Address-first checkout:** name, email, phone and full delivery address are collected before starting Razorpay Checkout.
- **Razorpay order creation:** prices and quantities are revalidated on the server using `data/products.json`; the browser cannot set its own price.
- **Payment verification:** the server verifies the Razorpay order/payment signature using the Razorpay key secret.
- **Address persistence:** customer and address records are written to a local SQLite database when a payment order is created. The optional checkbox also remembers the address in that browser for the next visit.
- **Google sign-in scaffold:** Firebase Google popup sign-in is implemented on the front end. Firebase Admin token verification is supported on the server when configured. Guest checkout is also supported.

## Product catalogue and images

### Add or edit a product

Edit `data/products.json`. Each active product follows this structure:

```json
{
  "id": "new-product-id",
  "name": "New Product Name",
  "weight": "250 g",
  "category": "Premixes",
  "description": "A short product description.",
  "price": 199,
  "image": "/assets/products/new-product.webp",
  "badge": "New",
  "ingredients": ["Ingredient one", "Ingredient two"],
  "sortOrder": 5,
  "active": true
}
```

- Use a unique, URL-safe `id`.
- `price` is the amount in whole Indian rupees. This is the source of truth used by the checkout API.
- `image` is a path under `public/`, so you can replace an image without changing the product card code. Recommended product image: square or 4:3, WebP/JPG/PNG, with the product centered and breathing room around it.
- Set `active` to `false` to hide a product without deleting its details.
- `sortOrder` controls the order in the product grid.
- `category` must match an existing filter (currently `Premixes` or `Everyday bites`) if you want it to appear under that filter.

The four initial image paths are:

- `public/assets/products/ragi-idli.svg`
- `public/assets/products/moongdal-dosa.svg`
- `public/assets/products/foxtail-khichdi.svg`
- `public/assets/products/flaxseed-mukhwas.svg`

These are original vector pack illustrations used as editable visual placeholders. Replace the SVG files with real product photography, or update the relevant `image` value in `data/products.json`.

### Initial products and prices

| Product | Pack size | Price |
|---|---:|---:|
| Ragi Idli Premix | 500 g | ₹175 |
| Moong Dal Dosa Mix | 500 g | ₹225 |
| Foxtail Millet Khichdi Premix | 500 g | ₹399 |
| Flaxseed Mukhwas | 100 g | ₹149 |

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
cp .env.example .env
npm start
```

Open `http://localhost:3000`.

The website, product browsing, search and cart work without payment keys. Online payment is intentionally disabled until valid Razorpay credentials are configured.

## Razorpay setup

1. Create or sign in to your Razorpay account.
2. Use **Test Mode** first and generate a Key ID and Key Secret.
3. Put the values in the server-side `.env` file:

```env
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
```

4. Restart the Node server.
5. Complete a full test payment and confirm that the order status changes to `paid` in the `data/saranga.sqlite` database.
6. Only after end-to-end testing and account/business checks, use Live Mode credentials in your hosting provider's secret/environment-variable settings.

**Important:** never put `RAZORPAY_KEY_SECRET` in browser JavaScript, HTML or a public repository. Only the server reads it. This MVP verifies the Checkout signature on the backend. Before a high-volume launch, add a Razorpay webhook and reconcile payment, capture, refund and dispute events server-to-server.

## Google sign-in setup

1. Create a Firebase project in Firebase Console.
2. Add a Web App and copy its Firebase Web App configuration.
3. Enable **Authentication → Sign-in method → Google**.
4. Add your production website domain under Authentication authorised domains.
5. Replace the placeholder values in `public/firebase-config.js`.
6. For server-side ID-token verification, create/download a Firebase Admin service-account credential and provide its JSON as the `FIREBASE_SERVICE_ACCOUNT_JSON` server environment variable. Keep it secret; never place it in `public/` or commit it.

The front end allows guest checkout. When a signed-in customer checks out, the backend verifies the Firebase ID token if the server service account is configured and checks that the checkout email matches the verified account email. If Firebase is configured in the browser but Firebase Admin is not configured on the server, authenticated checkout will be rejected rather than trusting an unverified token.

## Useful project map

```text
saranga-storefront/
├── data/
│   ├── products.json          # product catalogue (edit this to list products)
│   └── saranga.sqlite         # auto-created customer/address/order database
├── public/
│   ├── assets/products/       # replace product images here
│   ├── app.js                 # cart, search, Firebase and checkout UI
│   ├── firebase-config.js     # Firebase Web App config placeholders
│   ├── index.html             # all four scroll sections and dialogs
│   └── styles.css             # responsive visual design
├── .env.example
├── package.json
├── README.md
└── server.js                  # catalogue API, Razorpay order + signature verification
```

## Before going live — launch checklist

This is a functional MVP foundation, not a fully production-hardened commerce platform. Complete these items before accepting real customer payments:

- Replace the illustration packs with approved, accurate product photos and verify every pack size, ingredient, allergen, nutrition, shelf-life and food-label claim.
- Confirm that the brand can substantiate “no added preservatives” for every product where that phrase is displayed. Remove or qualify the claim where it does not apply.
- Confirm final selling prices, GST/tax treatment, shipping fees, delivery regions, dispatch timelines, cancellation/refund policy and who handles customer support. The current MVP calculates payment from product subtotals only; shipping and tax rules are not yet added.
- Add Terms & Conditions, Privacy Policy, Shipping/Delivery Policy, Refund/Cancellation Policy, and business identity details required for the live store and payment-provider onboarding.
- Move SQLite to a managed production database with backups and access controls. The included SQLite file is suitable for local development/small MVP testing, not concurrent/high-scale production operations.
- Put secrets in the hosting platform's secret manager; use HTTPS; restrict database access; add retention/deletion processes for customer personal information; and review applicable Indian privacy, consumer and food-business requirements with qualified advisers.
- Add order confirmation email/SMS/WhatsApp notifications and an order-status page or admin workflow.
- Add Razorpay webhooks, idempotency/reconciliation, refunds and operational monitoring.
- Test mobile Safari/Chrome, address validation, failed payments, dismissing checkout, duplicate clicks, expired Google sessions and slow networks.

## Deployment

Deploy the Node app to a host that supports a persistent Node process and a writable persistent volume for the SQLite database (for example, a Node-capable app host). Configure the environment variables in the host dashboard, use your production domain, and point the domain's DNS records to that host. A static-only host such as a plain HTML bucket is not enough for this version because Razorpay order creation, signature verification and saved addresses require the Express backend.

The contact links currently point to `https://www.saranga.food/`, `tel:+918529459892`, WhatsApp `https://wa.me/918529459892` and Instagram `https://www.instagram.com/saranga.food/`.
