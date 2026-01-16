const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// Test data - príklad MacBook fotky (môžete nahradiť vlastnou)
const TEST_IMAGE_PATH = path.join(__dirname, 'test-product.jpg');
const TEST_PRODUCT_NAME = 'MacBook Air M1 8GB 256GB';
const TEST_DESCRIPTION = 'Predám MacBook Air v perfektnom stave';
const TEST_EMAIL = 'test@example.com';

// Možné hodnoty filtrov
const RAM_OPTIONS = [4, 8, 16, 32];
const SSD_OPTIONS = [128, 256, 512, 1024];
const YEAR_OPTIONS = [2020, 2021, 2022, 2023, 2024];
const CONDITION_OPTIONS = ['new', 'used', 'damaged'];

// Výsledky testov
let failedCombinations = [];
let passedCombinations = [];

test.describe('Filter Price Testing - 50 kombinácií', () => {
  test.setTimeout(120000); // 2 minúty na test

  test('Testovanie 50 náhodných kombinácií filtrov', async ({ page }) => {
    console.log('\n🧪 Začínam testovanie 50 kombinácií filtrov...\n');

    // Navigácia na stránku
    await page.goto('http://localhost:5510');
    await page.waitForLoadState('networkidle');

    // Generuj 50 náhodných kombinácií
    const combinations = generateRandomCombinations(50);

    for (let i = 0; i < combinations.length; i++) {
      const combo = combinations[i];
      console.log(`\n📋 Test ${i + 1}/50: RAM=${combo.ram}GB, SSD=${combo.ssd}GB, Year=${combo.year}, Condition=${combo.condition}`);

      try {
        // Refresh stránky pre nový test
        if (i > 0) {
          await page.reload({ waitUntil: 'networkidle' });
          await page.waitForTimeout(1000);
        }

        // 1. Nahrať fotku (ak existuje)
        if (fs.existsSync(TEST_IMAGE_PATH)) {
          const fileInput = page.locator('[data-image-input]');
          await fileInput.setInputFiles(TEST_IMAGE_PATH);
          await page.waitForTimeout(2000);
        }

        // 2. Vyplniť formulár
        await page.fill('[data-product-name]', TEST_PRODUCT_NAME);
        await page.fill('[data-product-notes]', TEST_DESCRIPTION);
        
        // 3. Vyplniť email
        const emailInput = page.locator('[data-beta-email]');
        if (await emailInput.isVisible()) {
          await emailInput.fill(TEST_EMAIL);
        }

        // 4. Súhlas s GDPR
        const gdprCheckbox = page.locator('[data-gdpr-checkbox]');
        if (await gdprCheckbox.isVisible()) {
          await gdprCheckbox.check();
        }

        // 5. Kliknúť na "Vyhodnotiť a generovať"
        const evaluateBtn = page.locator('[data-evaluate-btn]');
        await evaluateBtn.click();
        console.log('   ⏳ Čakám na modal s inzerátmi...');

        // 6. Počkať na modal
        await page.waitForSelector('[data-review-modal]:not([hidden])', { timeout: 60000 });
        await page.waitForTimeout(2000);

        // 7. Aplikovať filtre
        await applyFilters(page, combo);
        await page.waitForTimeout(1500);

        // 8. Kliknúť "Potvrdiť a vypočítať cenu"
        const confirmBtn = page.locator('[data-review-confirm]');
        await confirmBtn.click();
        console.log('   ⏳ Čakám na výpočet ceny...');

        // 9. Počkať na vygenerovaný inzerát a cenu
        await page.waitForTimeout(5000);

        // 10. Skontrolovať cenu
        const priceResult = await checkPrice(page);
        
        if (priceResult.isValid) {
          console.log(`   ✅ PASS: Cena = ${priceResult.price}€`);
          passedCombinations.push({
            combination: combo,
            price: priceResult.price
          });
        } else {
          console.log(`   ❌ FAIL: ${priceResult.error}`);
          failedCombinations.push({
            combination: combo,
            error: priceResult.error,
            price: priceResult.price
          });
        }

      } catch (error) {
        console.log(`   ⚠️ ERROR: ${error.message}`);
        failedCombinations.push({
          combination: combo,
          error: `Test error: ${error.message}`,
          price: null
        });
      }
    }

    // Výsledky
    console.log('\n' + '='.repeat(60));
    console.log('📊 VÝSLEDKY TESTOVANIA');
    console.log('='.repeat(60));
    console.log(`✅ Úspešné: ${passedCombinations.length}/${combinations.length}`);
    console.log(`❌ Neúspešné: ${failedCombinations.length}/${combinations.length}`);
    
    if (failedCombinations.length > 0) {
      console.log('\n🔴 ZOZNAM CHYBNÝCH KOMBINÁCIÍ:');
      console.log('='.repeat(60));
      failedCombinations.forEach((item, idx) => {
        const c = item.combination;
        console.log(`\n${idx + 1}. RAM: ${c.ram}GB | SSD: ${c.ssd}GB | Year: ${c.year} | Condition: ${c.condition}`);
        console.log(`   Error: ${item.error}`);
        console.log(`   Price: ${item.price}`);
      });

      // Uložiť do súboru
      const reportPath = path.join(__dirname, 'failed-combinations-report.json');
      fs.writeFileSync(reportPath, JSON.stringify(failedCombinations, null, 2));
      console.log(`\n📄 Detailný report uložený do: ${reportPath}`);
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // Assert že sú všetky testy úspešné
    expect(failedCombinations.length).toBe(0);
  });
});

// Helper funkcie

function generateRandomCombinations(count) {
  const combinations = [];
  const used = new Set();

  while (combinations.length < count) {
    const combo = {
      ram: RAM_OPTIONS[Math.floor(Math.random() * RAM_OPTIONS.length)],
      ssd: SSD_OPTIONS[Math.floor(Math.random() * SSD_OPTIONS.length)],
      year: YEAR_OPTIONS[Math.floor(Math.random() * YEAR_OPTIONS.length)],
      condition: CONDITION_OPTIONS[Math.floor(Math.random() * CONDITION_OPTIONS.length)]
    };

    const key = `${combo.ram}-${combo.ssd}-${combo.year}-${combo.condition}`;
    if (!used.has(key)) {
      used.add(key);
      combinations.push(combo);
    }
  }

  return combinations;
}

async function applyFilters(page, combo) {
  console.log('   🔧 Aplikujem filtre...');

  // RAM filter
  const ramBtn = page.locator(`[data-filter-ram="${combo.ram}"]`);
  if (await ramBtn.count() > 0) {
    await ramBtn.click();
    await page.waitForTimeout(300);
  }

  // SSD filter
  const ssdBtn = page.locator(`[data-filter-ssd="${combo.ssd}"]`);
  if (await ssdBtn.count() > 0) {
    await ssdBtn.click();
    await page.waitForTimeout(300);
  }

  // Year filter
  const yearBtn = page.locator(`[data-filter-year="${combo.year}"]`);
  if (await yearBtn.count() > 0) {
    await yearBtn.click();
    await page.waitForTimeout(300);
  }

  // Condition filter
  const conditionBtn = page.locator(`[data-condition="${combo.condition}"]`);
  if (await conditionBtn.count() > 0) {
    await conditionBtn.click();
    await page.waitForTimeout(300);
  }
}

async function checkPrice(page) {
  // Skúsiť nájsť cenu v rôznych možných lokáciách
  const priceSelectors = [
    '[data-price]',
    '[data-result-price]',
    '[data-market-price]',
    '.estimate__price',
    '.result__price'
  ];

  for (const selector of priceSelectors) {
    try {
      const priceEl = page.locator(selector).first();
      if (await priceEl.count() > 0) {
        const priceText = await priceEl.textContent();
        const price = parseFloat(priceText.replace(/[^\d.,]/g, '').replace(',', '.'));

        if (isNaN(price)) {
          return {
            isValid: false,
            error: `Cena je NaN (text: "${priceText}")`,
            price: priceText
          };
        }

        if (price === 0) {
          return {
            isValid: false,
            error: 'Cena je 0€',
            price: 0
          };
        }

        return {
          isValid: true,
          price: price
        };
      }
    } catch (e) {
      // Pokračovať na ďalší selector
    }
  }

  return {
    isValid: false,
    error: 'Cena sa nenašla na stránke',
    price: null
  };
}
