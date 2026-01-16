# 💳 **CREDIT SYSTEM - IMPLEMENTATION PLAN**

**Model:** €2.99 za 3 inzeráty (credits)  
**Payment:** Stripe / PayPal  
**Status:** 🚧 READY TO IMPLEMENT

---

## 🎯 **USER FLOW:**

### **1. FREE USER (0 credits):**
```
1. Upload foto → "Nahral si MacBook Pro"
2. Klik "Generovať" → ⚠️ MODAL: "Potrebuješ 1 credit"
3. Button: "Kúpiť 3 credits za €2.99" → Payment
4. Po platbe → Dostane 3 credits
5. Generuje inzerát → -1 credit (ostáva 2)
```

### **2. PAID USER (3 credits):**
```
1. Upload foto → AI rozpozná produkt
2. Klik "Generovať" → ✅ Vygeneruje (used 1 credit, 2 left)
3. Dostane:
   ✅ AI popis + titulok
   ✅ Price comparison (Heureka, Google, Bazoš)
   ✅ Affiliate links aktívne
   ✅ Export PDF ready
```

---

## 💾 **DATABASE SCHEMA:**

```javascript
// users collection
{
  _id: ObjectId,
  email: "user@example.com",
  credits: 3,
  totalPurchased: 3,
  createdAt: ISODate,
  lastPayment: ISODate
}

// transactions collection
{
  _id: ObjectId,
  userId: ObjectId,
  amount: 2.99,
  credits: 3,
  paymentProvider: "stripe",
  paymentId: "ch_xxx",
  status: "completed",
  createdAt: ISODate
}

// ads collection
{
  _id: ObjectId,
  userId: ObjectId,
  title: "MacBook Pro 2020",
  description: "...",
  price: 510,
  creditsUsed: 1,
  createdAt: ISODate
}
```

---

## 🔧 **BACKEND ENDPOINTS:**

### **1. Check Credits:**
```javascript
GET /api/user/credits
→ { credits: 3, email: "user@example.com" }
```

### **2. Purchase Credits:**
```javascript
POST /api/purchase
Body: { email, paymentMethod: "stripe" }
→ { checkoutUrl: "https://stripe.com/checkout/..." }
```

### **3. Generate Ad (protected):**
```javascript
POST /api/generate-ad
Headers: { Authorization: "Bearer token" }
Body: { imageUrl, productName, ... }

→ IF credits >= 1:
    - Generate AI content
    - Fetch price comparison
    - Return affiliate links
    - Deduct 1 credit
  ELSE:
    - Return 402 Payment Required
```

---

## 💳 **PAYMENT INTEGRATION (STRIPE):**

### **Setup:**
```bash
npm install stripe
```

### **Server code:**
```javascript
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Create checkout session
app.post('/api/purchase', async (req, res) => {
  const { email } = req.body;
  
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'eur',
        product_data: {
          name: '3 AI Inzeráty',
          description: 'Vygeneruj 3 prémiové inzeráty s AI',
        },
        unit_amount: 299, // €2.99 in cents
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: 'https://predajto.ai/success?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: 'https://predajto.ai/cancel',
    customer_email: email,
  });
  
  res.json({ checkoutUrl: session.url });
});

// Webhook (Stripe callback)
app.post('/api/webhook/stripe', async (req, res) => {
  const event = req.body;
  
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_email;
    
    // Add 3 credits to user
    await db.collection('users').updateOne(
      { email },
      { 
        $inc: { credits: 3, totalPurchased: 3 },
        $set: { lastPayment: new Date() }
      },
      { upsert: true }
    );
    
    console.log(`✅ Added 3 credits to ${email}`);
  }
  
  res.json({ received: true });
});
```

---

## 🎨 **FRONTEND CHANGES:**

### **1. Add Credit Counter (top-right corner):**
```html
<div class="creditBadge">
  <span class="creditBadge__icon">💎</span>
  <span class="creditBadge__count" data-credit-count>0</span>
  <button class="creditBadge__buy" data-buy-credits>
    Kúpiť credits
  </button>
</div>
```

### **2. Paywall Modal:**
```html
<div class="paywallModal" data-paywall-modal hidden>
  <div class="paywallModal__content">
    <h2>🔒 Potrebuješ 1 credit</h2>
    <p>Kúp si 3 credits za €2.99 a vygeneruj profesionálne inzeráty s AI</p>
    
    <div class="paywallModal__features">
      ✅ AI popis + titulok<br>
      ✅ Price comparison (Heureka + Google)<br>
      ✅ Affiliate links<br>
      ✅ Export PDF
    </div>
    
    <button class="paywallModal__cta" data-checkout-btn>
      Kúpiť 3 credits za €2.99
    </button>
    
    <small>Bezpečná platba cez Stripe</small>
  </div>
</div>
```

### **3. Modified Generate Button:**
```javascript
generateBtn.addEventListener("click", async () => {
  // Check credits first
  const credits = await checkUserCredits();
  
  if (credits < 1) {
    showPaywallModal();
    return;
  }
  
  // Has credits → generate
  const result = await generateAd();
  
  // Update credit counter
  updateCreditCounter(credits - 1);
});
```

---

## 💰 **REVENUE CALCULATION:**

### **Conservative (100 paying users/mesiac):**
```
100 users × €2.99 = €299/mesiac
```

### **Realistic (500 paying users/mesiac):**
```
500 users × €2.99 = €1,495/mesiac
Annual: €17,940
```

### **Optimistic (2,000 paying users/mesiac):**
```
2,000 users × €2.99 = €5,980/mesiac
Annual: €71,760
```

### **With upsells (10 credits za €7.99):**
```
50% users buy 3 credits (€2.99)
50% users buy 10 credits (€7.99)

Average: (€2.99 + €7.99) / 2 = €5.49 per user
500 users × €5.49 = €2,745/mesiac = €32,940/rok
```

---

## 🎯 **PRICING TIERS (OPTIONS):**

### **Option A: Simple (RECOMMENDED):**
```
3 credits = €2.99
10 credits = €7.99 (save 20%)
30 credits = €19.99 (save 33%)
```

### **Option B: Subscription:**
```
Monthly: €9.99/mesiac = unlimited
Annual: €99/rok = unlimited + bonuses
```

### **Option C: Hybrid:**
```
Pay-per-use: €2.99 per 3 credits
OR
Subscription: €9.99/mesiac unlimited
```

---

## ⚡ **QUICK START (WEEK 1):**

### **Day 1: Setup Payment**
- [ ] Register Stripe account (stripe.com)
- [ ] Get API keys (test + production)
- [ ] Test payment flow

### **Day 2: Backend**
- [ ] Add MongoDB (free at mongodb.com/atlas)
- [ ] Implement credit system
- [ ] Add payment webhook

### **Day 3: Frontend**
- [ ] Add credit counter UI
- [ ] Add paywall modal
- [ ] Protect generate button

### **Day 4: Testing**
- [ ] Test full flow (buy → generate → deduct)
- [ ] Test edge cases
- [ ] Security audit

### **Day 5-7: Launch**
- [ ] Deploy to production
- [ ] Enable live payments
- [ ] Monitor first transactions

---

## 🔐 **SECURITY:**

✅ JWT authentication  
✅ Stripe webhook signature verification  
✅ Rate limiting (prevent abuse)  
✅ Server-side credit validation  
✅ HTTPS only  

---

## 📊 **ANALYTICS TO TRACK:**

- Conversion rate (visitors → paid users)
- Average revenue per user (ARPU)
- Churn rate (users who don't return)
- Most popular package (3 vs 10 vs 30 credits)
- Time to first purchase

---

## 🚀 **EXPECTED TIMELINE:**

**Week 1:** Payment integration  
**Week 2:** Beta testing (10 users)  
**Week 3:** Public launch  
**Week 4:** First €100 revenue  
**Month 2:** €500-1,000 MRR  
**Month 6:** €2,000-5,000 MRR  

---

**READY TO IMPLEMENT?** 🚀

Chceš aby som začal s credit systemom alebo najprv dopracujeme UI?
