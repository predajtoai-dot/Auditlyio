# Pricing Protection System - Dokumentácia

## 📊 Prehľad

Systém **Pricing Protection** implementuje pokročilé mechanizmy na zabezpečenie presnej a dôveryhodnej cenovej kalkulácie pre produkty na báze dát z Bazoš a Google Shopping.

---

## 🛡️ Multi-Layer Filtering (Viacvrstvové filtrovanie)

### 1️⃣ Negative Filters - Blacklist Keywords
Automatické odstránenie nerelevantných inzerátov na základe kategórie:
- **Dom & Záhrada (11)**: Filtruje "rodinný dom", "rekonštrukcia", "služby", "montáž"
- **PC (13)**: Filtruje "prenájom", "kancelária", "oprava"
- **Mobily (14)**: Filtruje "sim karta", "predplatné"

### 2️⃣ Category Hard Limits (Cenové limity)
Každá kategória má maximálny strop:
- **Mobily**: 2500€
- **PC**: 5000€
- **Elektro**: 4000€
- **Oblečenie**: 500€

### 3️⃣ Statistical Outlier Removal
- Odstránenie cien < 5€
- Odstránenie cien > 200% mediánu
- Použitie **mediánu** namiesto priemeru (odolnejšie voči extrémom)

---

## 🎯 Extreme Variance Detection (Detekcia extrémneho rozptylu)

### Prípad 1: Extrémny rozptyl na Bazoši (>5x)
**Príklad**: Pri vyhľadávaní "iPhone" sa nájdu výsledky od 50€ (kryt) až po 1200€ (nový telefón).

**Riešenie**:
1. AI detekuje variance > 5x
2. Zobrazí sa **Price Category Selection Modal**
3. Používateľ si vyberie kategóriu:
   - 🏃 **Lacný variant** (50-100€) - príslušenstvo, samostatné kusy
   - ⭐ **Štandardná cena** (300-500€) - bežný bazárový produkt
   - 💎 **Prémiová verzia** (800-1200€) - komplet set, nový kus

### Prípad 2: Rozptyl na Google Shopping (>300%)
Ak Google vráti veľmi rôzne ceny (napr. keramická dekorácia: 10€ až 150€), systém:
1. Vytvorí 3 cenové kategórie (Low/Mid/High)
2. Zobrazí modál s výberom
3. Používateľ klikne na tú, ktorá zodpovedá jeho produktu

**Priorita názvu**: Ak sa Google výsledok presne zhoduje s AI-detekovaným názvom, dostane **5x vyššiu váhu**.

---

## 🚫 Strategické mlčanie (0 výsledkov)

### Prípad: Nedostatok dát
Ak Bazoš vráti 0 inzerátov **a** Google vráti cenu s nízkou istotou (<0.6):

**Hláška pre používateľa**:
```
"Bohužiaľ, pre tento produkt sme nenašli dostatok dát na Bazoši ani v e-shopoch. 
Skúste produkt premenovať na niečo bežnejšie (napr. 'keramická dekorácia')."
```

**Systém**:
- Nezobrazí žiadnu cenu (namiesto halucinácie)
- Vygeneruje text inzerátu
- Ponúkne tip na premenovanie produktu

---

## 🔄 Cross-Check Logic (Overenie Bazoš vs Google)

### Scenár 1: Iba Bazoš dáta
- Použije sa medián z Bazoš inzerátov
- Confidence: **0.8**

### Scenár 2: Iba Google dáta
- Použije sa **70% z Google ceny** (typická bazárová strata hodnoty)
- Confidence: **0.6**

### Scenár 3: Oboje dostupné
- **Cross-check**: Ak je Bazoš medián > 120% Google ceny → podozrivé (pravdepodobne nájdené byty namiesto produktov)
- Použije sa **70% z Google ceny** ako korekcia
- Confidence: **0.7**

### Scenár 4: Dáta vyzerajú dobre
- Použije sa Bazoš medián
- Confidence: **0.9**

---

## 🧪 Testovanie

### Test 1: Normálny produkt (iPhone 13 Pro)
**Očakávaný výsledok**:
- Nájde 15+ inzerátov na Bazoši
- Ceny v rozsahu 600-900€
- Variance < 5x
- Vráti medián ~750€

### Test 2: Extrémny rozptyl (dymová dekorácia)
**Očakávaný výsledok**:
- Google vráti ceny: 10€ (malý kúsok) až 150€ (komplet set)
- Variance > 3x
- Zobrazí sa **Price Category Selection Modal**
- Používateľ si vyberie kategóriu

### Test 3: 0 výsledkov (veľmi špecifický model)
**Očakávaný výsledok**:
- Bazoš: 0 inzerátov
- Google: Nízka confidence (0.4)
- Zobrazí sa hláška: "Nedostatok dát... skúste premenovať"
- Inzerát sa vygeneruje, ale bez ceny

### Test 4: Havarovaný produkt
**Očakávaný výsledok**:
- Penalty -80% z trhovej hodnoty
- Cena max 50€ (cap)
- Text: "Predám vrak na náhradné diely"

---

## 📦 Implementované súbory

### `pricingProtection.mjs`
- `calculateProtectedPrice()` - Hlavná funkcia
- `filterAdsByBlacklist()` - Blacklist filtering
- `applyCategoryCap()` - Category price caps
- `removeOutliers()` - Statistical outliers
- `getGoogleRetailPrice()` - Google Shopping API (placeholder)
- `crossCheckPrices()` - Bazoš vs Google validation
- `nameSimilarity()` - Weighted scoring pre Google výsledky

### `server.mjs`
- Integrácia `calculateProtectedPrice` do `/api/evaluate`
- Handling `requiresUserSelection` flag
- Handling `insufficientData` flag

### `main.js`
- `showPriceCategoryModal()` - UI pre výber kategórie
- Handling price variance detection
- Toast notifikácie pre používateľa

### `styles.css`
- `.priceCategoryModal` - Styling pre modál
- `.priceCategoryOption` - Styling pre jednotlivé kategórie
- Glassmorphism efekt

---

## 🎨 UI/UX Flow

1. **Používateľ nahrá fotku** → AI detekuje produkt
2. **Backend zavolá `calculateProtectedPrice()`**
3. **Ak variance > 5x**:
   - Backend vráti `requiresUserSelection: true` + `priceCategories`
   - Frontend zobrazí **Price Category Modal**
   - Používateľ klikne na kategóriu
   - Frontend dopočíta ceny a pokračuje
4. **Ak 0 výsledkov**:
   - Backend vráti `insufficientData: true` + `message`
   - Frontend zobrazí chybovú hlášku + tip na premenovanie
   - Inzerát sa vygeneruje bez ceny
5. **Normálny priebeh**:
   - Backend vráti `price`, `priceRange`, `confidence`
   - Frontend zobrazí cenu + zdroj + počet inzerátov

---

## 🔒 Bezpečnostné pravidlá

### Price Caps (Limity cien)
1. **Finálna cena nikdy neprekročí 90% retail ceny**
2. **Ak bazárová cena > retail cena** → force 70% retail ceny
3. **Kategória hard limits** (napr. Mobily max 2500€)

### Anti-Hallucination (Ochrana pred halucináciami)
1. **0 výsledkov** → "Nedostatok dát", nie fake cena
2. **Variance > 5x** → Používateľ si vyberie kategóriu
3. **Google price sanity check** → Ak Google cena > 3x category cap → reject

---

## 📈 Budúce vylepšenia

- [ ] Integrácia reálneho Google Shopping API (SerpApi/Serper)
- [ ] Machine learning pre lepšiu kategorizáciu variance
- [ ] Historické dáta pre sledovanie trendov cien
- [ ] A/B testovanie: priemer vs medián
- [ ] Personalizovaná korekcia na základe feedbacku používateľov

---

## 🐛 Debugging

### Console logs
```javascript
console.log("⚠️ Extreme price variance detected - user selection required");
console.log("💰 Extreme variance in Bazoš data: 8.5x (50€ - 425€)");
console.warn("⚠️ Insufficient data from bazaars and Google - cannot estimate price");
```

### Test v browseri
```javascript
// Resetovať edit counter
window.debugResetEdits();

// Skontrolovať posledný AI response
console.log(lastIdentification);
```

---

## 📝 Licencia

Tento systém je súčasťou **Predajto.ai** platformy a je chránený autorskými právami.

