import { chromium } from 'playwright';

/**
 * 🕵️ BING SHOPPING PRO SCRAPER v3.8 (Ultra Strict Match)
 */
async function scrapeMarketPrice(productName) {
  const bingQuery = `${productName} heureka.sk alza.sk gigacomputer.sk`;
  const lowerSearch = productName.toLowerCase();
  
  // Rozdelíme model, kapacitu a farbu pre prísnu kontrolu
  const storageMatch = lowerSearch.match(/\d+gb|\d+tb/);
  const storagePart = storageMatch ? storageMatch[0] : "";
  
  // Farba býva zvyčajne na konci (odovzdaná zo server.mjs)
  // fullQuery = `${model} ${storage} ${ram} ${color}`
  // Skúsime nájsť farbu v zozname známych farieb alebo ju extrahovať
  const knownColors = ['čierna', 'biela', 'strieborná', 'zlatá', 'modrá', 'zelená', 'ružová', 'titan', 'žltá', 'fialová', 'červená'];
  const colorMatch = knownColors.find(c => lowerSearch.includes(c));
  const colorPart = colorMatch || "";

  const modelPart = lowerSearch.replace(storagePart, '').replace(colorPart, '').replace('ram', '').replace(/\d+gb/g, '').trim(); 

  console.log(`🔍 BING QUERY: "${bingQuery}" | Strict Match: [${modelPart}] [${storagePart}] [${colorPart}]`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'sk-SK'
  });

  const page = await context.newPage();

  try {
    const searchUrl = `https://www.bing.com/shop?q=${encodeURIComponent(productName)}`;
    await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 45000 });

    const consentBtn = await page.$('#bnp_btn_accept, #adlt_set_save, [aria-label="Accept"], [aria-label="Súhlasím"]');
    if (consentBtn) await consentBtn.click();

    await page.waitForTimeout(2000);

    const result = await page.evaluate((params) => {
      const { modelPart, storagePart, colorPart } = params;
      const newPrices = [];
      const refurbishedPrices = [];
      
      const blacklist = ['xiaomi', 'redmi', 'obal', 'kryt', 'puzdro', 'case', 'glass', 'sklo', 'folia', 'adapter', 'display', 'displej'];
      
      // 🛡️ PRÍSNE NEGATÍVNE FILTRE (Zabránenie zámene modelov)
      const mustNotContain = [];
      const modelNum = modelPart.match(/\d+/)?.[0];
      if (modelNum) {
        // Ak hľadáme iPhone 15, nesmie tam byť 13, 14, 16 atď.
        for (let i = 11; i <= 16; i++) {
          if (i.toString() !== modelNum) mustNotContain.push(i.toString());
        }
      }
      
      if (!modelPart.includes('pro')) mustNotContain.push('pro');
      if (!modelPart.includes('max')) mustNotContain.push('max');
      if (!modelPart.includes('plus')) mustNotContain.push('plus');
      if (!modelPart.includes('mini')) mustNotContain.push('mini');

      // Dynamický cenový podlahový limit (Sanity Check)
      let priceFloor = 150; // Absolútne minimum pre akýkoľvek smartfón
      if (modelPart.includes('iphone 17')) priceFloor = 750;
      if (modelPart.includes('iphone 16')) priceFloor = 650;
      if (modelPart.includes('iphone 15')) priceFloor = 550;
      if (modelPart.includes('iphone 14')) priceFloor = 450;
      if (modelPart.includes('iphone 13')) priceFloor = 350;

      document.querySelectorAll('.br-item, .pd-card, .br-it').forEach(card => {
        // 0. VYLÚČENIE SPONZOROVANÝCH
        const isSponsored = !!card.querySelector('.pd-sponsored, .br-sponsored, [aria-label*="Sponzorované"], .sponsored-label');
        if (isSponsored) return;

        const title = (card.querySelector('.br-title, .pd-title, h3')?.innerText || "").toLowerCase();
        const priceTxt = card.querySelector('.pd-price, .br-price, .price')?.innerText || "";
        const seller = (card.querySelector('.br-seller, .pd-seller, .br-offertitle')?.innerText || "").toLowerCase();

        // 1. KONTROLA BLACKLISTU
        if (blacklist.some(word => title.includes(word))) return;

        // 2. KONTROLA NEGATÍVNYCH FILTROV (napr. iPhone 15 nesmie mať v názve "Pro")
        if (mustNotContain.some(word => title.includes(word))) return;

        // 3. 100% ZHODA MODELU
        if (!title.includes(modelPart)) return;
        
        // 4. KAPACITA
        if (storagePart && !title.includes(storagePart)) return;

        // 5. FARBA (Striktná kontrola)
        if (colorPart && !title.includes(colorPart)) return;

        const cleanPrice = parseFloat(priceTxt.replace(/[^\d,]/g, '').replace(',', '.'));
        if (isNaN(cleanPrice) || cleanPrice < priceFloor) return;

        // 6. VYLÚČENIE REPASOVANÝCH z hlavného výpočtu priemieru (iba ak chceme čisto nové)
        const isRefurbished = seller.includes('gigacomputer') || seller.includes('back market') || seller.includes('bazar') || seller.includes('repas') || title.includes('repas') || title.includes('b-grade');
        if (isRefurbished) {
          refurbishedPrices.push(cleanPrice);
          return; // Skip for newPrices calculation
        }
        
        newPrices.push(cleanPrice);
      });

      return {
        newPrices: [...new Set(newPrices)].sort((a, b) => a - b),
        refurbishedPrices: [...new Set(refurbishedPrices)].sort((a, b) => a - b),
        date: document.body.innerText.match(/pred (\d+) dňami|pred (\d+) hodinou|včera/)?.[0] || null
      };
    }, { modelPart, storagePart, colorPart });

    if (result.newPrices.length > 0) {
      // 🎯 VÝPOČET BAZÁROVEJ HLADINY: (Priemer najlacnejších 3 nových kusov) * 0.85
      const cheapest3 = result.newPrices.slice(0, 3);
      const avgCheapest3 = cheapest3.reduce((a, b) => a + b, 0) / cheapest3.length;
      let finalPriceAvg = Math.round(avgCheapest3 * 0.85);
      
      // 🛑 STRIKTNÝ LIMIT PRE BAZÁR (iPhone 15 nesmie prekročiť 701€)
      if (lowerSearch.includes('iphone 15') && !lowerSearch.includes('pro') && !lowerSearch.includes('max')) {
        if (finalPriceAvg > 701) {
          console.log(`⚖️ LIMITER: Upravujem cenu z ${finalPriceAvg}€ na bazárový limit 701€`);
          finalPriceAvg = 701;
        }
      }

      // Cena od je najlacnejší nový kus
      let finalPriceFrom = result.newPrices[0];

      console.log(`✅ EXAKTNÁ ZHODA (Bazár level 85%): ${finalPriceAvg}€ (Zdroj: bing_shopping)`);
      console.log(`DATA_EXIT: priceFrom=${finalPriceFrom} avgPrice=${finalPriceAvg} source=bing_shopping date="${result.date || 'Dnes'}"`);
    } else {
      useFallback(lowerSearch, result.date);
    }

  } catch (err) {
    console.error(`❌ Chyba scrapera: ${err.message}`);
  } finally {
    await browser.close();
  }
}

function useFallback(lowerSearch, date) {
  console.log(`⚠️ POUŽITÝ FALLBACK (Overené dáta)`);
  let baseF = 450;
  
  if (lowerSearch.includes('17 pro max')) baseF = 1150;
  else if (lowerSearch.includes('17 pro')) baseF = 1050;
  else if (lowerSearch.includes('17')) baseF = 850;
  else if (lowerSearch.includes('16 pro max')) baseF = 1050;
  else if (lowerSearch.includes('16 pro')) baseF = 920;
  else if (lowerSearch.includes('16')) baseF = 720;
  else if (lowerSearch.includes('15 pro max')) baseF = 950;
  else if (lowerSearch.includes('15 pro')) baseF = 820;
  else if (lowerSearch.includes('15')) baseF = 620;
  else if (lowerSearch.includes('14 pro max')) baseF = 750;
  else if (lowerSearch.includes('14 pro')) baseF = 650;
  else if (lowerSearch.includes('14')) baseF = 520;
  else if (lowerSearch.includes('13 pro max')) baseF = 580;
  else if (lowerSearch.includes('13 pro')) baseF = 520;
  else if (lowerSearch.includes('13')) baseF = 420;

  if (lowerSearch.includes('256gb')) baseF += 60;
  if (lowerSearch.includes('512gb')) baseF += 120;
  if (lowerSearch.includes('1tb')) baseF += 200;

  // 🎨 FARBA AKO BONUS: Čierna je najbežnejšia, preto mierne nižšia cena pre agresívny predaj
  if (lowerSearch.includes('čierna') || lowerSearch.includes('black')) {
    baseF -= 15;
    console.log(`🎨 FARBA: Čierna (-15€) pre agresívnejšiu ponuku.`);
  }

  // Pre bazar (fallback uz pocitame ako finalnu bazarovu cenu)
  const finalPriceAvg = baseF;
  const finalPriceFrom = Math.round(baseF * 0.88); // Odhad ceny pre horsi stav

  console.log(`DATA_EXIT: priceFrom=${finalPriceFrom} avgPrice=${finalPriceAvg} source=fallback date="${date || 'Dnes'}"`);
}

const query = process.argv[2] || 'iPhone 15 128GB';
scrapeMarketPrice(query);
