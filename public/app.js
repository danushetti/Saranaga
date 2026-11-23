import { firebaseConfig, isFirebaseConfigured } from "/firebase-config.js";

const CART_KEY = "saranga-cart-v1";
const ADDRESS_KEY = "saranga-address-v1";
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

let products = [];
let activeFilter = "All";
let cart = loadCart();
let currentUser = null;
let firebaseAuth = null;
let firebaseProvider = null;
let toastTimer = null;

function loadCart() {
  try {
    const value = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    return Array.isArray(value) ? value.filter(item => item && typeof item.id === "string" && Number.isInteger(item.qty) && item.qty > 0) : [];
  } catch {
    return [];
  }
}

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  renderCartCount();
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function money(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function showDialog(id) {
  const dialog = document.getElementById(id);
  if (dialog && !dialog.open) dialog.showModal();
}

function closeDialog(id) {
  const dialog = document.getElementById(id);
  if (dialog?.open) dialog.close();
}

async function loadProducts() {
  try {
    const response = await fetch("/api/products", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Products unavailable");
    products = await response.json();
  } catch (error) {
    console.error(error);
    products = [];
    $("#productGrid").innerHTML = '<p class="search-hint">Our products are taking a little break. Please refresh the page.</p>';
  }
  renderProducts();
  renderCart();
  renderCartCount();
}

function productCard(product) {
  return `
    <article class="product-card">
      <div class="product-image-wrap">
        <img class="product-image" src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}" loading="lazy" />
        ${product.badge ? `<span class="product-badge">${escapeHTML(product.badge)}</span>` : ""}
      </div>
      <div class="product-card-body">
        <span class="product-category">${escapeHTML(product.category || "Saranga")}</span>
        <h3>${escapeHTML(product.name)}</h3>
        <span class="product-weight">${escapeHTML(product.weight || "")}</span>
        <p class="product-description">${escapeHTML(product.description || "Thoughtfully made with traditional ingredients.")}</p>
        <div class="product-card-bottom">
          <span class="product-price"><small>₹</small>${Number(product.price).toLocaleString("en-IN")}</span>
          <button class="product-action" type="button" data-action="add" data-id="${escapeHTML(product.id)}" aria-label="Add ${escapeHTML(product.name)} to cart" title="Add to cart">+</button>
        </div>
        <button class="buy-now-link" type="button" data-action="buy" data-id="${escapeHTML(product.id)}">Buy now <span>↗</span></button>
      </div>
    </article>`;
}

function renderProducts() {
  const visible = products.filter(product => product.active !== false && (activeFilter === "All" || product.category === activeFilter));
  $("#productGrid").innerHTML = visible.length ? visible.map(productCard).join("") : '<p class="search-hint">No products in this collection just yet.</p>';
  $("#productCountLabel").textContent = `${visible.length} ${visible.length === 1 ? "thoughtful essential" : "thoughtful essentials"}`;
  $("#allCount").textContent = String(products.filter(product => product.active !== false).length).padStart(2, "0");
  $$(".filter-tab").forEach(button => button.classList.toggle("active", button.dataset.filter === activeFilter));
}

function findProduct(id) {
  return products.find(product => product.id === id);
}

function addToCart(id, quantity = 1) {
  const product = findProduct(id);
  if (!product) return;
  const existing = cart.find(item => item.id === id);
  if (existing) existing.qty = Math.min(20, existing.qty + quantity);
  else cart.push({ id, qty: Math.min(20, quantity) });
  saveCart();
  renderCart();
  showToast(`${product.name} added to your bag`);
}

function cartDetails() {
  return cart.map(item => {
    const product = findProduct(item.id);
    return product ? { ...product, qty: item.qty, lineTotal: product.price * item.qty } : null;
  }).filter(Boolean);
}

function cartTotal() {
  return cartDetails().reduce((sum, item) => sum + item.lineTotal, 0);
}

function renderCartCount() {
  const count = cart.reduce((sum, item) => sum + item.qty, 0);
  $("#cartCount").textContent = String(count);
  $("#cartHeadingCount").textContent = `(${count})`;
}

function renderCart() {
  const items = cartDetails();
  const container = $("#cartItems");
  if (!items.length) {
    container.innerHTML = '<div class="empty-cart"><span>✳</span><strong>Your bag is waiting.</strong><p>Add a little goodness to get started.</p></div>';
    $("#cartSummary").hidden = true;
    $("#cartSubtotal").textContent = money(0);
    return;
  }
  $("#cartSummary").hidden = false;
  container.innerHTML = items.map(item => `
    <div class="cart-line">
      <img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.name)}" />
      <div>
        <h3>${escapeHTML(item.name)}</h3>
        <small>${escapeHTML(item.weight)} · ${money(item.price)} each</small>
        <span class="cart-line-price">${money(item.lineTotal)}</span>
        <div class="quantity-controls" aria-label="Quantity for ${escapeHTML(item.name)}">
          <button type="button" data-cart-action="decrease" data-id="${escapeHTML(item.id)}" aria-label="Decrease quantity">−</button>
          <span>${item.qty}</span>
          <button type="button" data-cart-action="increase" data-id="${escapeHTML(item.id)}" aria-label="Increase quantity">+</button>
        </div>
      </div>
      <button class="remove-item" type="button" data-cart-action="remove" data-id="${escapeHTML(item.id)}" aria-label="Remove ${escapeHTML(item.name)}">×</button>
    </div>`).join("");
  $("#cartSubtotal").textContent = money(cartTotal());
}

function renderCheckoutSummary() {
  const items = cartDetails();
  $("#checkoutItems").innerHTML = items.map(item => `
    <div class="checkout-summary-item">
      <img src="${escapeHTML(item.image)}" alt="" />
      <div><strong>${escapeHTML(item.name)}</strong><small>${item.qty} × ${money(item.price)}</small></div>
      <b>${money(item.lineTotal)}</b>
    </div>`).join("");
  $("#checkoutSubtotal").textContent = money(cartTotal());
}

function openCheckout() {
  if (!cartDetails().length) {
    showToast("Your bag is empty. Add a product first.");
    return;
  }
  closeDialog("cartDialog");
  fillAddressForm();
  renderCheckoutSummary();
  $("#checkoutError").textContent = "";
  showDialog("checkoutDialog");
}

function fillAddressForm() {
  const form = $("#addressForm");
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(ADDRESS_KEY) || "{}"); } catch { saved = {}; }
  const values = {
    name: saved.name || currentUser?.displayName || "",
    email: saved.email || currentUser?.email || "",
    phone: saved.phone || "",
    line1: saved.line1 || "",
    landmark: saved.landmark || "",
    city: saved.city || "",
    state: saved.state || "",
    postalCode: saved.postalCode || "",
    country: saved.country || "India"
  };
  for (const [name, value] of Object.entries(values)) {
    const input = form.elements.namedItem(name);
    if (input && value) input.value = value;
  }
}

function readAddressForm() {
  const data = new FormData($("#addressForm"));
  return {
    name: String(data.get("name") || "").trim(),
    email: String(data.get("email") || "").trim().toLowerCase(),
    phone: String(data.get("phone") || "").trim(),
    line1: String(data.get("line1") || "").trim(),
    landmark: String(data.get("landmark") || "").trim(),
    city: String(data.get("city") || "").trim(),
    state: String(data.get("state") || "").trim(),
    postalCode: String(data.get("postalCode") || "").trim(),
    country: String(data.get("country") || "India").trim(),
    saveAddress: data.get("saveAddress") === "on"
  };
}

async function loadRazorpayScript() {
  if (window.Razorpay) return;
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = resolve;
    script.onerror = () => reject(new Error("Razorpay Checkout could not be loaded. Check your connection and try again."));
    document.head.appendChild(script);
  });
}

async function getIdToken() {
  if (!currentUser) return null;
  return currentUser.getIdToken();
}

async function beginPayment(address) {
  const payButton = $("#payNow");
  const error = $("#checkoutError");
  payButton.disabled = true;
  payButton.textContent = "Preparing secure checkout…";
  error.textContent = "";
  try {
    const idToken = await getIdToken();
    const response = await fetch("/api/checkout/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
      body: JSON.stringify({
        items: cart.map(item => ({ id: item.id, quantity: item.qty })),
        address
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "We couldn't start checkout. Please try again.");

    await loadRazorpayScript();
    const options = {
      key: result.keyId,
      amount: result.order.amount,
      currency: result.order.currency,
      name: "Saranga",
      description: "A Mother's Goodness, Made for Every Home",
      image: "/assets/saranga-mark.svg",
      order_id: result.order.id,
      prefill: { name: address.name, email: address.email, contact: address.phone },
      notes: { city: address.city, postal_code: address.postalCode },
      theme: { color: "#294c3d" },
      handler: async paymentResponse => {
        try {
          const verificationResponse = await fetch("/api/checkout/verify-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
            body: JSON.stringify(paymentResponse)
          });
          const verification = await verificationResponse.json().catch(() => ({}));
          if (!verificationResponse.ok || !verification.verified) throw new Error(verification.error || "Payment verification failed. Please contact Saranga with your payment reference.");
          cart = [];
          saveCart();
          renderCart();
          closeDialog("checkoutDialog");
          closeDialog("cartDialog");
          showToast(`Thank you, ${address.name.split(" ")[0]}! Your order is confirmed.`);
          $("#addressForm").reset();
          $("#addressForm").elements.country.value = "India";
          if (address.saveAddress) {
            const { saveAddress, ...savedAddress } = address;
            localStorage.setItem(ADDRESS_KEY, JSON.stringify(savedAddress));
          }
        } catch (verificationError) {
          error.textContent = verificationError.message;
          showToast("We couldn't verify the payment. Please keep your payment ID.");
        }
      },
      modal: {
        ondismiss: () => {
          payButton.disabled = false;
          payButton.innerHTML = 'Proceed to secure payment <span>→</span>';
        }
      }
    };
    const checkout = new window.Razorpay(options);
    checkout.on("payment.failed", event => {
      const description = event?.error?.description || "Payment was not completed. Please try again.";
      error.textContent = description;
      payButton.disabled = false;
      payButton.innerHTML = 'Proceed to secure payment <span>→</span>';
    });
    checkout.open();
    if (address.saveAddress) {
      const { saveAddress, ...savedAddress } = address;
      localStorage.setItem(ADDRESS_KEY, JSON.stringify(savedAddress));
    }
  } catch (paymentError) {
    error.textContent = paymentError.message;
  } finally {
    payButton.disabled = false;
    payButton.innerHTML = 'Proceed to secure payment <span>→</span>';
  }
}

async function initialiseFirebase() {
  const note = $("#authNote");
  const signInButton = $("#googleSignIn");
  if (!isFirebaseConfigured()) {
    note.textContent = "Google sign-in is ready to configure. Add your Firebase Web App values in public/firebase-config.js.";
    signInButton.addEventListener("click", () => showToast("Add your Firebase project configuration to enable Google sign-in."));
    renderProfile();
    return;
  }
  try {
    const [{ initializeApp }, authModule] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js")
    ]);
    const app = initializeApp(firebaseConfig);
    firebaseAuth = authModule.getAuth(app);
    firebaseProvider = new authModule.GoogleAuthProvider();
    firebaseProvider.setCustomParameters({ prompt: "select_account" });
    authModule.onAuthStateChanged(firebaseAuth, user => {
      currentUser = user;
      renderProfile();
    });
    signInButton.addEventListener("click", async () => {
      try {
        await authModule.signInWithPopup(firebaseAuth, firebaseProvider);
        showToast("You're signed in. Welcome to Saranga!");
      } catch (error) {
        console.error(error);
        showToast(error.code === "auth/popup-closed-by-user" ? "Sign-in was closed." : "Google sign-in couldn't be completed.");
      }
    });
    note.textContent = "Your account is protected by Google sign-in.";
  } catch (error) {
    console.error("Firebase initialisation failed", error);
    note.textContent = "Google sign-in could not be initialised. Check the Firebase configuration.";
  }
  renderProfile();
}

function renderProfile() {
  const content = $("#profileContent");
  if (!currentUser) {
    content.innerHTML = `
      <div class="profile-emblem">S</div>
      <p class="profile-copy">Sign in to make your next visit a little easier. Your saved details will be ready when you return.</p>
      <button class="google-button" id="googleSignIn" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.7 4.7 0 0 1-2 3.1v2.6h3.3c1.9-1.8 2.9-4.4 2.9-7.6Z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.6c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3v2.7A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 13.9a6 6 0 0 1 0-3.8V7.4H3a10 10 0 0 0 0 9.2l3.4-2.7Z"/><path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.7 9.7 0 0 0 12 2a10 10 0 0 0-9 5.4l3.4 2.7C7.2 7.8 9.4 6 12 6Z"/></svg>Continue with Google</button>
      <p class="auth-note" id="authNote">${isFirebaseConfigured() ? "Connecting to Google sign-in…" : "Google sign-in is ready to configure. Add your Firebase Web App values in public/firebase-config.js."}</p>
      <p class="privacy-note">By continuing, you agree to our terms and privacy policy.</p>`;
    const button = $("#googleSignIn");
    if (firebaseAuth && firebaseProvider) {
      button.addEventListener("click", async () => {
        try {
          const { signInWithPopup } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js");
          await signInWithPopup(firebaseAuth, firebaseProvider);
          showToast("You're signed in. Welcome to Saranga!");
        } catch (error) {
          console.error(error);
          showToast("Google sign-in couldn't be completed.");
        }
      });
    } else {
      button.addEventListener("click", () => showToast("Add your Firebase project configuration to enable Google sign-in."));
    }
  } else {
    content.innerHTML = `
      <div class="profile-emblem">${escapeHTML((currentUser.displayName || "S").charAt(0).toUpperCase())}</div>
      <div class="profile-user"><strong>${escapeHTML(currentUser.displayName || "Welcome back")}</strong><small>${escapeHTML(currentUser.email || "")}</small><button id="signOutButton" type="button">Sign out</button></div>
      <p class="privacy-note">Your Google account is connected to Saranga.</p>`;
    $("#signOutButton").addEventListener("click", async () => {
      try {
        const { signOut } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js");
        await signOut(firebaseAuth);
        showToast("You have been signed out.");
      } catch (error) {
        console.error(error);
        showToast("Sign out couldn't be completed.");
      }
    });
  }
}

function renderSearchResults(query) {
  const results = products.filter(product => product.active !== false && `${product.name} ${product.category} ${product.description} ${(product.ingredients || []).join(" ")}`.toLowerCase().includes(query.toLowerCase()));
  const container = $("#searchResults");
  if (!query.trim()) {
    container.innerHTML = '<p class="search-hint">Start typing to discover something wholesome.</p>';
    return;
  }
  if (!results.length) {
    container.innerHTML = '<p class="search-hint">No matches yet. Try “millet”, “ragi” or “dosa”.</p>';
    return;
  }
  container.innerHTML = results.map(product => `
    <div class="search-result">
      <img src="${escapeHTML(product.image)}" alt="" />
      <div class="search-result-info"><strong>${escapeHTML(product.name)}</strong><small>${escapeHTML(product.weight)} · ${money(product.price)}</small></div>
      <button type="button" data-search-add="${escapeHTML(product.id)}" aria-label="Add ${escapeHTML(product.name)} to cart">+</button>
    </div>`).join("");
}

// Event wiring
$("#productGrid").addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const { id, action } = button.dataset;
  if (action === "add") addToCart(id);
  if (action === "buy") {
    addToCart(id);
    openCheckout();
  }
});

$$(".filter-tab").forEach(button => button.addEventListener("click", () => {
  activeFilter = button.dataset.filter;
  renderProducts();
}));

$("#cartItems").addEventListener("click", event => {
  const button = event.target.closest("button[data-cart-action]");
  if (!button) return;
  const item = cart.find(entry => entry.id === button.dataset.id);
  if (!item) return;
  if (button.dataset.cartAction === "increase") item.qty = Math.min(20, item.qty + 1);
  if (button.dataset.cartAction === "decrease") item.qty -= 1;
  if (button.dataset.cartAction === "remove" || item.qty <= 0) cart = cart.filter(entry => entry.id !== button.dataset.id);
  saveCart();
  renderCart();
});

$("#searchOpen").addEventListener("click", () => {
  $("#searchInput").value = "";
  renderSearchResults("");
  showDialog("searchDialog");
  setTimeout(() => $("#searchInput").focus(), 50);
});
$("#searchInput").addEventListener("input", event => renderSearchResults(event.target.value));
$("#searchResults").addEventListener("click", event => {
  const button = event.target.closest("button[data-search-add]");
  if (!button) return;
  addToCart(button.dataset.searchAdd);
});

$("#profileOpen").addEventListener("click", () => {
  renderProfile();
  showDialog("profileDialog");
});
$("#cartOpen").addEventListener("click", () => {
  renderCart();
  showDialog("cartDialog");
});
$("#checkoutStart").addEventListener("click", openCheckout);
$("#addressForm").addEventListener("submit", event => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const address = readAddressForm();
  beginPayment(address);
});

$$('[data-close]').forEach(button => button.addEventListener("click", () => closeDialog(button.dataset.close)));
["searchDialog", "profileDialog", "checkoutDialog", "cartDialog"].forEach(id => {
  const dialog = document.getElementById(id);
  dialog.addEventListener("click", event => {
    if (event.target === dialog && id !== "cartDialog") dialog.close();
    if (event.target === dialog && id === "cartDialog") dialog.close();
  });
});

// Mark the navigation item for the section currently in view.
const sections = ["home", "products", "story", "contact"].map(id => document.getElementById(id));
const navLinks = $$(".nav-link");
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) navLinks.forEach(link => link.classList.toggle("active", link.getAttribute("href") === `#${entry.target.id}`));
    });
  }, { rootMargin: "-35% 0px -55% 0px", threshold: 0 });
  sections.forEach(section => observer.observe(section));
}

$("#year").textContent = new Date().getFullYear();
loadProducts();
initialiseFirebase();
