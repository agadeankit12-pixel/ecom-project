// server.js
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

/**
 * CONFIG
 */
const PORT = process.env.PORT || 3000;
const N = 3; // every Nth order makes a coupon available
const DISCOUNT_RATE = 0.10; // 10%

/**
 * In-memory stores
 */
const products = {
  "p1": { id: "p1", name: "T-shirt", price: 500 },
  "p2": { id: "p2", name: "Mug", price: 250 },
  "p3": { id: "p3", name: "Sticker Pack", price: 100 }
};

const users = {}; // userId -> { cart: [{productId, qty}], orders: [] }


/**
 * Helpers
 */
function ensureUser(userId) {
  if (!users[userId]) users[userId] = { cart: [], orders: [] };
  return users[userId];
}
function calcCartTotal(cart) {
  let total = 0;
  for (const it of cart) {
    const p = products[it.productId];
    if (!p) continue;
    total += p.price * (it.qty || 1);
  }
  return total;
}


/**
 * Public APIs
 */

// add item to cart
app.post('/cart/:userId/add', (req, res) => {
  const { userId } = req.params;
  const { productId, qty = 1 } = req.body;
  if (!products[productId]) return res.status(400).json({ error: 'invalid productId' });
  if (qty <= 0) return res.status(400).json({ error: 'qty must be >= 1' });

  const user = ensureUser(userId);
  const existing = user.cart.find(it => it.productId === productId);
  if (existing) existing.qty += qty;
  else user.cart.push({ productId, qty });

  return res.json({ cart: user.cart });
});

// view cart
app.get('/cart/:userId', (req, res) => {
  const user = ensureUser(req.params.userId);
  const cart = user.cart.map(it => ({ ...it, product: products[it.productId] }));
  return res.json({ cart, total: calcCartTotal(user.cart) });
});



/**
 * Utilities (products listing)
 */
app.get('/products', (req, res) => {
  return res.json(Object.values(products));
});

app.get('/', (req, res) => res.send('Ecommerce in-memory API running'));

/**
 * Start
 */
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
