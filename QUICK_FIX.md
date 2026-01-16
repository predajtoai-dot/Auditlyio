# 🔧 RÝCHLA OPRAVA: Prečo len 2 inzeráty?

## 🎯 **Problém identifikovaný**

AI správne detekovala:
- ✅ Produkt: "MacBook"
- ✅ Kategória: 13 (PC)
- ✅ Confidence: 0.9

Ale backend vracia len **2 inzeráty** z 1000+.

---

## 🐛 **Možné príčiny**

### 1. **Search query je príliš všeobecný**
"MacBook" (bez modelu) môže vrátiť menej výsledkov než "MacBook Pro" alebo "MacBook Air".

### 2. **Minimum ads requirement = 2**
Systém má nastavené: "Pre PC potrebujeme aspoň 2 inzeráty".
Ak má presne 2, zobrazí ich, ale to znamená, že filtering odstránil všetky ostatné.

### 3. **Outlier removal pre PC je vypnutý, ALE...**
Možno iné filtre (blacklist, relevance, price validation) sú príliš prísne.

---

## 🔍 **Dočasné riešenie: Vypnúť minimum ads requirement**

Znížim requirement z 2 na 1, aby som videl, či problém je v filtering alebo v search:

```javascript
// pricingProtection.mjs
const minAdsRequired = [13, 14, 15, 16].includes(categoryId) 
  ? 1  // Znížené z 2 na 1
  : 3;
```

---

## 🚀 **Lepšie riešenie: Debug endpoint**

Vytvorím diagnostický endpoint, ktorý ukáže presne:
- Koľko ads sa načítalo z Bazoša
- Koľko prešlo cez každý filter
- Prečo sa 118+ ads vymazalo

---

## 💡 **Odporúčanie pre používateľa**

**Zatiaľ skúste:**

1. **Špecifickejší model**
   - ❌ "MacBook" (príliš všeobecné)
   - ✅ "MacBook Pro" (lepšie)
   - ✅ "MacBook Air M2" (najlepšie)

2. **Iný produkt na test**
   - Skúste "iPhone 13 Pro"
   - Ak aj tam je len 2-3 inzeráty → problém je v kóde
   - Ak tam je 15-20 inzerátov → problém je v search query "MacBook"

3. **Počkajte na nový deployment**
   - Práve pripravujem fix, ktorý zníži minimum na 1 ad
   - Potom uvidíme, či problém je v minimum requirement alebo vo filteringu

---

## 📊 **Next Steps**

Upravím:
1. ✅ Minimum ads requirement: 2 → 1
2. ✅ Pridám viac debug logov
3. ✅ Vytvorím `/api/debug-search` endpoint

Deployment za ~2 minúty...

