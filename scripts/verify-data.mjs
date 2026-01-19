// Používame natívny fetch (Node.js 18+)
const API_BASE = 'http://localhost:5510';

async function runFullDiagnostic() {
  console.log('🛡️ SPUŠŤAM KOMPLETNÚ DIAGNOSTIKU VŠETKÝCH PRODUKTOV...\n');

  try {
    // 1. Skontrolovať zdravie servera
    const healthResp = await fetch(`${API_BASE}/api/health`);
    if (!healthResp.ok) {
      console.log('❌ SERVER NIE JE ZDRAVÝ ALEBO DOSTUPNÝ');
      return;
    }
    console.log('✅ Server Health: OK');

    // 2. Získať zoznam všetkých produktov
    const listResp = await fetch(`${API_BASE}/api/products/list`);
    const listData = await listResp.json();
    
    if (!listData.ok || !Array.isArray(listData.products)) {
      console.log('❌ Nepodarilo sa načítať zoznam produktov.');
      return;
    }

    const products = listData.products;
    console.log(`✅ Zoznam produktov: OK (${products.length} modelov nájdených)\n`);
    console.log('='.repeat(50));

    let passedCount = 0;
    let failedCount = 0;
    let warningsCount = 0;

    // 3. Prejsť každý produkt a overiť jeho audit
    for (const p of products) {
      process.stdout.write(`📡 Testujem: ${p.name}... `);
      
      try {
        const brandParam = p.brand ? `&brand=${encodeURIComponent(p.brand)}` : '';
        const modelParam = encodeURIComponent(p.model_name || p.name);
        const auditResp = await fetch(`${API_BASE}/api/audit/report?model=${modelParam}${brandParam}`);
        const auditData = await auditResp.json();

        if (!auditData.ok) {
          console.log('\n❌ CHYBA: Audit zlyhal pre tento model.');
          failedCount++;
          continue;
        }

        const report = auditData.report;
        const issues = verifySpecs(report);

        if (issues.errors.length === 0 && issues.warnings.length === 0) {
          console.log('✅ OK');
          passedCount++;
        } else {
          console.log(issues.errors.length > 0 ? '❌ FAILED' : '⚠️ WARNING');
          
          issues.errors.forEach(err => console.log(`      🔴 CHYBA: ${err}`));
          issues.warnings.forEach(warn => console.log(`      🟡 UPOZORNENIE: ${warn}`));
          
          if (issues.errors.length > 0) failedCount++;
          else warningsCount++;
        }
      } catch (err) {
        console.log(`\n❌ CHYBA SIETE: ${err.message}`);
        failedCount++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 FINÁLNE ŠTATISTIKY:');
    console.log(`✅ Úspešné: ${passedCount}`);
    console.log(`⚠️ S upozornením: ${warningsCount}`);
    console.log(`❌ Chybné: ${failedCount}`);
    console.log(`📦 Celkom testovaných: ${products.length}`);
    console.log('='.repeat(50));

    if (failedCount > 0) {
      console.log('\n❌ DIAGNOSTIKA NAŠLA KRITICKÉ CHYBY. JE POTREBNÁ OPRAVA DATABÁZY.');
    } else {
      console.log('\n✨ DIAGNOSTIKA DOKONČENÁ. VŠETKY DÁTA SÚ KONZISTENTNÉ.');
    }

  } catch (e) {
    console.log(`\n❌ DIAGNOSTIKA PRERUŠENÁ: ${e.message}`);
    console.log('Uistite sa, že beží node server.mjs');
  }
}

function verifySpecs(r) {
  const issues = { errors: [], warnings: [] };
  if (!r) {
    issues.errors.push('Report je prázdny');
    return issues;
  }

  // 1. Základné polia
  if (!r.full_report || r.full_report.length < 50) issues.errors.push('Hĺbkový report chýba alebo je príliš krátky');
  if (!r.negotiation_tips || r.negotiation_tips.length < 20) issues.errors.push('Vyjednávacie tipy chýbajú alebo sú príliš krátke');

  // 2. Technické špecifikácie pre iPhone 15/16
  const name = r.name.toLowerCase();
  
  if (name.includes('iphone 15') || name.includes('iphone 16')) {
    // Jas (2000 nit peak pre i15/16)
    const hasBrightness = r.full_report?.includes('2000 nit') || r.display_tech?.includes('2000 nit');
    if (!hasBrightness) issues.errors.push('CHYBNÝ JAS: iPhone 15/16 musí mať v reporte "2000 nit" (peak outdoor).');

    // USB-C Verzia (Pro = USB 3.0 / 10Gbps, Základ = USB 2.0 / 480Mbps)
    const hasUsbC = r.full_report?.toLowerCase().includes('usb-c');
    if (!hasUsbC) {
      issues.errors.push('CHÝBA USB-C: Tento model musí mať v reporte zmienku o USB-C konektivite.');
    } else {
      if (name.includes('pro')) {
        const hasUsb3 = r.full_report?.includes('USB 3') || r.full_report?.includes('10Gb/s');
        if (!hasUsb3) issues.warnings.push('USB VERZIA: Pro modely majú USB 3.0 (10Gb/s). V reporte to chýba.');
      } else {
        const hasUsb2 = r.full_report?.includes('USB 2') || r.full_report?.includes('480Mb/s');
        if (!hasUsb2) issues.warnings.push('USB VERZIA: Základné modely majú USB 2.0 (480Mb/s). V reporte to chýba.');
      }
    }

    // Nabíjanie
    const hasCharging = r.full_report?.includes('W');
    if (!hasCharging) issues.warnings.push('RÝCHLOSŤ NABÍJANIA: V reporte chýba informácia o max. wattoch (napr. 27W alebo 20W).');
  }

  // 3. Kontrola iPad Pro M4 (Tandem OLED)
  if (name.includes('ipad pro') && name.includes('m4')) {
    const hasOled = r.full_report?.toLowerCase().includes('tandem oled') || r.display_tech?.toLowerCase().includes('tandem oled');
    if (!hasOled) issues.errors.push('CHÝBA OLED: iPad Pro M4 musí mať v reporte "Tandem OLED".');
    
    const hasThin = r.full_report?.includes('5.1 mm') || r.full_report?.includes('5,1 mm');
    if (!hasThin) issues.warnings.push('CHÝBA ROZMER: Odporúča sa spomenúť rekordnú hrúbku 5.1 mm.');
  }

  // 4. Kontrola MacBook Pro M3
  if (name.includes('macbook pro') && name.includes('m3')) {
    const hasBrightness = r.full_report?.includes('1000 nit') || r.display_tech?.includes('1000 nit');
    if (!hasBrightness) issues.errors.push('CHYBNÝ JAS: MacBook Pro M3 má 1000 nitov (SDR).');
  }

  // 5. Kontrola "marketingového cukru"
  const marketingPhrases = ['40% lepšia grafika', '40% lepsia grafika', 'neuveriteľný výkon'];
  marketingPhrases.forEach(phrase => {
    if (r.full_report?.toLowerCase().includes(phrase)) {
      issues.warnings.push(`Nájdená marketingová fráza: "${phrase}" (Odporúča sa nahradiť faktami)`);
    }
  });

  return issues;
}

runFullDiagnostic();
