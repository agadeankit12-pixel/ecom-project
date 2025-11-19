// src/store.js
//
// In-memory store only for this assignment.
// In production, these would be DB tables / collections.
//
// We keep this module small and pure so tests can reset easily.

const { v4: uuidv4 } = require('uuid');
const { N, DISCOUNT_RATE } = require('./config');

// Seed products – in real world, this is DB data.
const initialProducts = {
  p1: { id: 'p1', name: 'T-shirt', price: 500 },       // values are in smallest currency unit (e.g. INR paise, cents)
  p2: { id: 'p2', name: 'Mug', price: 250 },
  p3: { id: 'p3', name: 'Sticker Pack', price: 100 }
};

let state = {
  products: { ...initialProducts },

  // userId -> { cart: [{productId, qty}], orders: [] }
  users: new Map(),

  // All orders placed
  orders: [],

  // All coupons ever generated
  // { code, createdAt, used, usedByOrderId?, createdForOrderNumber }
  coupons: [],

  // Counts how many orders have been placed so far (global)
  orderCount: 0
};

/**
 * Get or create a user document.
 */
function getOrCreateUser(userId) {
  if (!state.users.has(userId)) {
    state.users.set(userId, { cart: [], orders: [] });
  }
  return state.users.get(userId);
}

/**
 * Calculate total amount for given cart items.
 * 
 * We:
 * - ignore unknown products (defensive coding)
 * - enforce qty >= 1 (we normalize earlier but this protects us if something slips through)
 */
function calculateCartTotal(cart) {
  return cart.reduce((sum, item) => {
    const product = state.products[item.productId];
    if (!product) return sum; // product deleted in between? ignore
    const qty = item.qty && item.qty > 0 ? item.qty : 1;
    return sum + product.price * qty;
  }, 0);
}

/**
 * Create a new order given user + coupon (if any).
 * This function is "transaction-like" for in-memory:
 *   - builds order object
 *   - marks coupon as used (if present)
 *   - updates user + global state
 *   - handles "every Nth order" coupon generation
 */
function placeOrder({ userId, coupon }) {
  const user = getOrCreateUser(userId);

  if (!user.cart || user.cart.length === 0) {
    const err = new Error('Cart is empty');
    err.status = 400;
    err.code = 'CART_EMPTY';
    throw err;
  }

  const subtotal = calculateCartTotal(user.cart);

  // Guard: no negative or weird totals
  if (subtotal <= 0) {
    const err = new Error('Cart total must be positive');
    err.status = 400;
    err.code = 'INVALID_CART_TOTAL';
    throw err;
  }

  let discountAmount = 0;
  if (coupon) {
    // Discount is 10% of subtotal, rounded to nearest integer in smallest units.
    discountAmount = Math.round(subtotal * DISCOUNT_RATE);

    // Safety: never let discount exceed subtotal
    if (discountAmount > subtotal) discountAmount = subtotal;
  }

  const total = subtotal - discountAmount;

  // Build order object
  const order = {
    id: uuidv4(),
    userId,
    items: user.cart.map((it) => ({ productId: it.productId, qty: it.qty })),
    subtotal,
    discountAmount,
    total,
    couponCode: coupon ? coupon.code : null,
    createdAt: new Date().toISOString()
  };

  // If coupon exists, mark it as used and bind to order
  if (coupon) {
    coupon.used = true;
    coupon.usedByOrderId = order.id;
    coupon.usedAt = new Date().toISOString();
  }

  // Persist order in in-memory store
  state.orders.push(order);
  user.orders.push(order);

  // Clear cart after successful order
  user.cart = [];

  // Increment global order count
  state.orderCount += 1;

  // After updating orderCount, generate coupon IF we've hit the Nth order
  maybeGenerateCouponForNthOrder();

  return order;
}

/**
 * Generate a coupon code (simple random).
 * In real production, you'd likely use stronger / more structured codes.
 */
function generateCouponCode() {
  return `C-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

/**
 * Generate a new coupon tied to current orderCount.
 */
function createCouponForCurrentOrderCount() {
  const code = generateCouponCode();

  const coupon = {
    code,
    createdAt: new Date().toISOString(),
    used: false,
    createdForOrderNumber: state.orderCount
  };

  state.coupons.push(coupon);
  return coupon;
}

/**
 * Generates coupon automatically on every Nth order IF:
 *  - orderCount > 0
 *  - orderCount % N === 0
 *  - there is no currently unused coupon (avoid piling up multiple usable codes)
 */
function maybeGenerateCouponForNthOrder() {
  if (state.orderCount === 0) return;
  if (state.orderCount % N !== 0) return;

  const unusedCouponExists = state.coupons.some((c) => !c.used);
  if (unusedCouponExists) return;

  createCouponForCurrentOrderCount();
}

/**
 * Get coupon by code. Returns null if not found.
 */
function getCouponByCode(code) {
  if (!code) return null;
  return state.coupons.find((c) => c.code === code) || null;
}

/**
 * Admin-friendly "generate coupon" that enforces the Nth-order rule.
 * Throws if rule isn't satisfied.
 */
function adminGenerateCoupon() {
  if (state.orderCount === 0) {
    const err = new Error('No orders placed yet');
    err.status = 400;
    err.code = 'NO_ORDERS';
    throw err;
  }

  if (state.orderCount % N !== 0) {
    const err = new Error(`Coupon is available only after every ${N}th order`);
    err.status = 400;
    err.code = 'NOT_NTH_ORDER';
    throw err;
  }

  const unusedCouponExists = state.coupons.some((c) => !c.used);
  if (unusedCouponExists) {
    const err = new Error('An unused coupon already exists');
    err.status = 400;
    err.code = 'UNUSED_COUPON_EXISTS';
    throw err;
  }

  return createCouponForCurrentOrderCount();
}

/**
 * Aggregated admin stats: total items, total purchase, coupon list, total discount.
 */
function getAdminStats() {
  const totalItemsPurchased = state.orders.reduce((count, order) => {
    const orderItemsCount = order.items.reduce((c, it) => c + (it.qty || 0), 0);
    return count + orderItemsCount;
  }, 0);

  const totalPurchaseAmount = state.orders.reduce(
    (sum, order) => sum + order.total,
    0
  );

  const totalDiscountAmount = state.orders.reduce(
    (sum, order) => sum + (order.discountAmount || 0),
    0
  );

  return {
    orderCount: state.orderCount,
    totalItemsPurchased,
    totalPurchaseAmount,
    totalDiscountAmount,
    coupons: state.coupons
  };
}

/**
 * For tests only: reset the in-memory store.
 */
function resetStore() {
  state = {
    products: { ...initialProducts },
    users: new Map(),
    orders: [],
    coupons: [],
    orderCount: 0
  };
}

module.exports = {
  state,
  getOrCreateUser,
  calculateCartTotal,
  placeOrder,
  getCouponByCode,
  adminGenerateCoupon,
  getAdminStats,
  resetStore
};
