// tests/api.test.js
const request = require('supertest');
const app = require('../src/app');
const { resetStore } = require('../src/store');

beforeEach(() => {
  // Clean slate for each test
  resetStore();
});

describe('Ecommerce API', () => {
  test('add to cart & checkout without coupon', async () => {
    // Fetch products
    const productsRes = await request(app).get('/products');
    expect(productsRes.status).toBe(200);
    const products = productsRes.body.data;
    const productId = products[0].id;

    // Add item to cart
    const addRes = await request(app)
      .post('/cart/user1/items')
      .send({ productId, qty: 2 });

    expect(addRes.status).toBe(200);
    expect(addRes.body.data.cart).toHaveLength(1);

    // Checkout
    const coRes = await request(app).post('/checkout/user1').send({});
    expect(coRes.status).toBe(201);
    expect(coRes.body.data.order.total).toBeGreaterThan(0);
    expect(coRes.body.data.order.discountAmount).toBe(0);
  });

  test('nth order generates coupon, coupon applies once', async () => {
    // We know N=3 by default config
    const productId = 'p1';

    // Place first 3 orders for different users
    for (let i = 1; i <= 3; i++) {
      const user = `u${i}`;

      await request(app)
        .post(`/cart/${user}/items`)
        .send({ productId, qty: 1 });

      const coRes = await request(app).post(`/checkout/${user}`).send({});
      expect(coRes.status).toBe(201);
    }

    // After 3rd order, we should have at least one unused coupon
    const statsRes = await request(app).get('/admin/stats');
    expect(statsRes.status).toBe(200);
    const coupons = statsRes.body.data.coupons;
    const available = coupons.find((c) => !c.used);
    expect(available).toBeDefined();

    const couponCode = available.code;

    // 4th user uses coupon
    await request(app)
      .post('/cart/u4/items')
      .send({ productId, qty: 1 });

    const coWithCoupon = await request(app)
      .post('/checkout/u4')
      .send({ couponCode });

    expect(coWithCoupon.status).toBe(201);
    expect(coWithCoupon.body.data.order.discountAmount).toBeGreaterThan(0);

    // Try using same coupon again (should fail)
    await request(app)
      .post('/cart/u5/items')
      .send({ productId, qty: 1 });

    const coAgain = await request(app)
      .post('/checkout/u5')
      .send({ couponCode });

    expect(coAgain.status).toBe(400);
    expect(coAgain.body.error).toMatch(/already been used/i);
  });
});
