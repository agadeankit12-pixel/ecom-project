// src/app.js
//
// Express app with:
// - request logging
// - basic security headers
// - JSON body parsing
// - cart + checkout APIs
// - admin APIs
// - centralized error handling

const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');

const { DISCOUNT_RATE } = require('./config');
const {
  state,
  getOrCreateUser,
  placeOrder,
  getCouponByCode,
  adminGenerateCoupon,
  getAdminStats
} = require('./store');

const app = express();

// Middlewares
app.use(helmet());
app.use(express.json());
app.use(morgan('dev'));

// Simple health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Expose available products
app.get('/products', (req, res) => {
  res.json({ data: Object.values(state.products) });
});

/**
 * Validate quantity: integer >= 1
 */
function normalizeQty(qty) {
  const n = Number(qty);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    const err = new Error('Quantity must be a positive integer');
    err.status = 400;
    err.code = 'INVALID_QTY';
    throw err;
  }
  return n;
}

/**
 * Add item to cart
 * POST /cart/:userId/items
 * body: { productId, qty }
 */
app.post('/cart/:userId/items', (req, res, next) => {
  try {
    const { userId } = req.params;
    const { productId, qty } = req.body;

    if (!productId) {
      const err = new Error('productId is required');
      err.status = 400;
      err.code = 'PRODUCT_ID_REQUIRED';
      throw err;
    }

    const product = state.products[productId];
    if (!product) {
      const err = new Error('Product not found');
      err.status = 404;
      err.code = 'PRODUCT_NOT_FOUND';
      throw err;
    }

    const quantity = normalizeQty(qty || 1);
    const user = getOrCreateUser(userId);

    // Try to find existing cart item
    const existing = user.cart.find((it) => it.productId === productId);
    if (existing) {
      existing.qty += quantity;
    } else {
      user.cart.push({ productId, qty: quantity });
    }

    res.status(200).json({
      data: {
        cart: user.cart,
        message: 'Item added to cart'
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Get user's cart
 * GET /cart/:userId
 */
app.get('/cart/:userId', (req, res) => {
  const { userId } = req.params;
  const user = getOrCreateUser(userId);

  // Attach product details for client convenience
  const items = user.cart.map((it) => ({
    productId: it.productId,
    qty: it.qty,
    product: state.products[it.productId] || null
  }));

  // Calculate total on the fly
  const total = items.reduce((sum, it) => {
    if (!it.product) return sum;
    return sum + it.product.price * it.qty;
  }, 0);

  res.json({
    data: {
      items,
      total
    }
  });
});

/**
 * Checkout
 * POST /checkout/:userId
 * body: { couponCode?: string }
 *
 * Behavior:
 * - Validates coupon if provided.
 * - Applies 10% discount to entire order if coupon is valid.
 * - Marks coupon as used.
 * - Places order & clears cart.
 * - If this order is Nth order, auto-generates next coupon (if no unused coupon already exists).
 */
app.post('/checkout/:userId', (req, res, next) => {
  try {
    const { userId } = req.params;
    const { couponCode } = req.body || {};

    let coupon = null;

    if (couponCode) {
      coupon = getCouponByCode(couponCode);

      // Fail early if coupon invalid or used.
      if (!coupon) {
        const err = new Error('Invalid coupon code');
        err.status = 400;
        err.code = 'INVALID_COUPON';
        throw err;
      }
      if (coupon.used) {
        const err = new Error('Coupon has already been used');
        err.status = 400;
        err.code = 'COUPON_ALREADY_USED';
        throw err;
      }
    }

    const order = placeOrder({ userId, coupon });

    res.status(201).json({
      data: {
        order,
        effectiveDiscountRate: coupon ? DISCOUNT_RATE : 0
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Admin: generate coupon
 * POST /admin/coupons
 *
 * Only allowed when:
 * - At least 1 order exists.
 * - orderCount % N === 0.
 * - No unused coupon currently exists.
 *
 * Note: auto-generation already happens on Nth order,
 * so this endpoint is more for explicit admin control / demo.
 */
app.post('/admin/coupons', (req, res, next) => {
  try {
    const coupon = adminGenerateCoupon();
    res.status(201).json({ data: coupon });
  } catch (err) {
    next(err);
  }
});

/**
 * Admin stats
 * GET /admin/stats
 */
app.get('/admin/stats', (req, res) => {
  const stats = getAdminStats();
  res.json({ data: stats });
});

/**
 * Global 404 handler for unknown routes.
 */
app.use((req, res, next) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.originalUrl
  });
});

/**
 * Central error handler.
 * Always returns JSON with { error, code?, details? } shape.
 */
app.use((err, req, res, next) => {
  // You can log here using a logger in real world
  const status = err.status || 500;
  const code = err.code || 'INTERNAL_ERROR';

  // In real production, don't leak stack traces unless explicitly allowed.
  res.status(status).json({
    error: err.message || 'Something went wrong',
    code
  });
});

module.exports = app;
