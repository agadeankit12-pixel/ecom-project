# Ecommerce Assignment – Cart, Checkout & Coupon System (In-Memory Store)

This project implements an ecommerce backend with:
- Add to cart
- Checkout
- Automatic coupon generation after every Nth order
- Apply coupon on checkout (10% discount)
- Admin APIs (generate coupon, view stats)
- In-memory data store
- Full Node.js + Express production-style structure
- Complete test Unit testing (Jest + Supertest)
- Clean error handling, validation & modular design

---

## 🚀 Tech Stack

**Backend**
- Node.js
- Express
- helmet + morgan (security & logging)
- Jest + Supertest (tests)
- uuid (IDs)

**Data Store**
- In-memory JS objects

**Config**
- Every Nth order generates a coupon (default: `3`)
- Discount rate: `10%` (configurable)
- Environment variables via `.env`

---


---

## ⚙️ Installation & Setup

### 1️⃣ Clone repo


git clone <your-repo-url>

### Install dependencies
cd ecom-assignment
npm install

### Start server
npm start

### Server running at
http://localhost:3000

### Unit testing
npm test

