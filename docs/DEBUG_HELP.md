# 🐛 DEBUG: Prečo len 2 inzeráty?

## 📋 Ako získať backend logy

### **Krok 1: Otvorte Developer Tools**
```
Stlačte F12 alebo Ctrl+Shift+I
```

### **Krok 2: Prejdite na Network tab**
```
F12 → Network (nie Console!)
```

### **Krok 3: Vyhľadajte produkt znova**
```
1. Nahrajte fotku
2. Kliknite "Vyhodnotiť a generovať"
3. Počkajte na výsledok
```

### **Krok 4: Nájdite request `/api/evaluate`**
```
V Network tabe by ste mali vidieť:
- evaluate (POST request)
- Status: 200
```

### **Krok 5: Skopírujte RESPONSE**
```
1. Kliknite na "evaluate"
2. Prejdite na tab "Response" alebo "Preview"
3. Mali by ste vidieť JSON s:
   - similarAds: [...] ← TOTO JE DÔLEŽITÉ
   - pricing: {...}
   - title, description, atď.
```

### **Krok 6: Skopírujte Console logy**
```
F12 → Console tab
Hľadajte logy typu:
🔎 Searching Bazoš: ...
📦 Raw results: X ads
✂️ After accessory filter: X ads
📊 Final results: X ads
```

---

## 🎯 **Čo potrebujem vedieť**

### **1. Názov produktu**
Čo presne ste hľadali? (napr. "MacBook Air M2", "MacBook Pro", atď.)

### **2. Console logy z backendu**
Skopírujte všetky logy, ktoré začínajú s emoji:
- 🔎, 📦, ✂️, 🚫, 🎯, 💰, 📊

### **3. Počet inzerátov v každom kroku**
Napr:
```
📦 Raw results: 120 ads
✂️ After accessory filter: 115 ads
🚫 After blacklist filter: 115 ads
🎯 After relevance filter: 110 ads
💰 After price validation: 95 ads
📊 Final results: 2 ads ← PREČO JEN 2?
```

---

## 🚀 **Alternatíva: Pozrite Vercel Logs**

Ak nemáte prístup k console logom, môžem sa pozrieť na Vercel logy:

```bash
vercel logs predajto-ai --follow
```

Ale to by som musel mať prístup k vašemu účtu.

---

## 💡 **Dočasné riešenie**

Zatiaľ skúste:

### **1. Skráťte názov produktu**
❌ "MacBook Air M2 2023 16GB 512GB"
✅ "MacBook Air M2"
✅ "MacBook"

### **2. Vyskúšajte iný produkt**
Napr. "iPhone 13" alebo "Samsung Galaxy S23"

Ak aj pri inom produkte nájde len 2-3 inzeráty, problém je v kóde.
Ak pri inom produkte nájde 15-20 inzerátov, problém je v search query.

---

**Prosím, pošlite mi:**
1. ✅ Názov produktu
2. ✅ Console logy (🔎, 📦, ✂️, 🎯, 💰, 📊)
3. ✅ Response z `/api/evaluate` (Network tab)

Potom zistím presne, kde sa stratili inzeráty! 🕵️

