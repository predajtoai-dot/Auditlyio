# 🧪 Playwright Filter Testing

Automatické testovanie 50 kombinácií filtrov na stránke PredajTo.ai

## 📋 Inštalácia

```bash
# 1. Nainštalovať Playwright
npm install -D @playwright/test

# 2. Nainštalovať prehliadače
npx playwright install
```

## 🚀 Spustenie testov

```bash
# Spustiť testy (headless mode)
npx playwright test

# Spustiť testy s viditeľným prehliadačom
npx playwright test --headed

# Debug mode (krok po kroku)
npx playwright test --debug

# Zobraziť HTML report
npx playwright show-report
```

## 📊 Čo test robí

1. **Načíta stránku** localhost:5510
2. **Nahrá testovaciu fotku** (ak existuje)
3. **Vyplní formulár** (názov, popis, email, GDPR)
4. **Klikne "Vyhodnotiť a generovať"**
5. **Počká na modal** s inzerátmi
6. **Aplikuje filtre** podľa náhodnej kombinácie:
   - RAM: 4GB, 8GB, 16GB, 32GB
   - SSD: 128GB, 256GB, 512GB, 1TB
   - Rok: 2020-2024
   - Stav: new, used, damaged
7. **Potvrdí výber** a počká na výpočet ceny
8. **Skontroluje cenu** - či nie je 0 alebo NaN
9. **Zaznamenáva výsledky** do konzoly a JSON súboru

## ✅ Výstupy

### Konzola
```
📋 Test 1/50: RAM=8GB, SSD=256GB, Year=2023, Condition=used
   ⏳ Čakám na modal s inzerátmi...
   🔧 Aplikujem filtre...
   ⏳ Čakám na výpočet ceny...
   ✅ PASS: Cena = 850€

📋 Test 2/50: RAM=16GB, SSD=512GB, Year=2024, Condition=new
   ❌ FAIL: Cena je 0€
```

### JSON Report
Ak sú chyby, vytvorí sa `failed-combinations-report.json`:
```json
[
  {
    "combination": {
      "ram": 16,
      "ssd": 512,
      "year": 2024,
      "condition": "new"
    },
    "error": "Cena je 0€",
    "price": 0
  }
]
```

## 📝 Testovacia fotka

Umiestnite testovaciu fotku produktu do:
```
tests/test-product.jpg
```

Alebo upravte cestu v `filter-price-test.spec.js`:
```javascript
const TEST_IMAGE_PATH = path.join(__dirname, 'test-product.jpg');
```

## 🔧 Konfigurácia

Upravte hodnoty v `filter-price-test.spec.js`:

```javascript
const TEST_PRODUCT_NAME = 'MacBook Air M1 8GB 256GB';
const TEST_DESCRIPTION = 'Predám MacBook Air v perfektnom stave';
const TEST_EMAIL = 'test@example.com';

const RAM_OPTIONS = [4, 8, 16, 32];
const SSD_OPTIONS = [128, 256, 512, 1024];
const YEAR_OPTIONS = [2020, 2021, 2022, 2023, 2024];
const CONDITION_OPTIONS = ['new', 'used', 'damaged'];
```

## 🐛 Debug

Ak test zlyháva:

1. **Spustite s headed mode:**
   ```bash
   npx playwright test --headed --slowMo=500
   ```

2. **Pozrite si screenshots** v `test-results/`

3. **Skontrolujte selektory** v teste - možno sa zmenili

## 📈 Výsledky

Po skončení testu uvidíte:
- ✅ Počet úspešných kombinácií
- ❌ Počet neúspešných kombinácií
- 🔴 Detailný zoznam chybných kombinácií
- 📄 JSON report s chybnými kombináciami

## 💡 Tipy

- Server musí bežať na `http://localhost:5510`
- Testy trvajú ~10-15 minút (50 kombinácií × ~15s)
- Každý test refreshne stránku pre čistý štart
- Výsledky sú automaticky uložené do JSON
