// src/config.js

// Central place for configuration. In real prod, values come from env vars / secrets manager.
const N = parseInt(process.env.NTH_ORDER_FOR_COUPON || '3', 10); // every Nth order
const DISCOUNT_RATE = parseFloat(process.env.DISCOUNT_RATE || '0.10'); // 10% discount
const PORT = parseInt(process.env.PORT || '3000', 10);

if (Number.isNaN(N) || N <= 0) {
  throw new Error('Invalid NTH_ORDER_FOR_COUPON config');
}
if (Number.isNaN(DISCOUNT_RATE) || DISCOUNT_RATE <= 0 || DISCOUNT_RATE >= 1) {
  throw new Error('Invalid DISCOUNT_RATE config; expected 0 < rate < 1');
}

module.exports = {
  N,
  DISCOUNT_RATE,
  PORT
};
