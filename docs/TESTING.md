# ✅ Testovanie Nových Funkcií

Tento dokument obsahuje pokyny na otestovanie všetkých nových funkcií v Predajto.ai.

---

## 🔒 1. Rate Limiting (max 5 generovaní za hodinu)

### Čo bolo implementované:
- In-memory store pre sledovanie IP adries
- Max **5 generovaní za hodinu** na jednu IP adresu
- Automatické čistenie starých záznamov každých 10 minút
- HTTP 429 odpoveď pri dosiahnutí limitu

### Ako otestovať:

1. **Reštartuj server:**
   ```bash
   cd "C:\Users\marek\OneDrive\Počítač\PredajTo"
   taskkill /F /IM node.exe 2>$null
   node server.mjs
   ```

2. **Otvor aplikáciu a vygeneruj 5 inzerátov:**
   - Nahraj obrázok
   - Zadaj email
   - Zadaj názov produktu
   - Zadaj popis (min. 10 znakov)
   - Klikni "Vyskúšať zadarmo"
   - **Opakuj 5x**

3. **Pri 6. pokuse by si mal vidieť:**
   ```
   ⚠️ Dosiahli ste limit 5 generovaní za hodinu. 
   Skúste to znova o XX minút.
   ```

4. **Overiť v konzole prehliadača:**
   - Otvor DevTools (F12)
   - Network tab → Pozri response `/api/evaluate`
   - Status: **429 Too Many Requests**
   - Response body:
     ```json
     {
       "ok": false,
       "error": "Dosiahli ste limit 5 generovaní za hodinu...",
       "resetIn": 60
     }
     ```

5. **Test pre rôzne IP:**
   - Ak používaš VPN/Proxy, zmena IP by mala resetovať limit
   - Alebo počkaj hodinu a skús znova

---

## 📧 2. Email Notifikácie

### Čo bolo implementované:
- Automatický email pri **thumbs up/down** (feedback)
- Automatický email pri **novom beta používateľovi**
- Integrované s Gmail cez App Password

### Ako otestovať:

#### **Krok 1: Nakonfiguruj Gmail**

Ak ešte nemáš nastavené Gmail credentials, postupuj podľa `EMAIL_SETUP.md`:

1. Choď na https://myaccount.google.com/apppasswords
2. Prihlás sa ako `predajto.ai@gmail.com`
3. Vytvor App Password (názov: "Predajto.ai Server")
4. Skopíruj 16-znakový kód (napr. `abcd efgh ijkl mnop`)

5. **Pridaj do `env.local`:**
   ```env
   OPENAI_API_KEY=sk-...
   OPENAI_MODEL=gpt-4o-mini
   PORT=5510
   GMAIL_USER=predajto.ai@gmail.com
   GMAIL_APP_PASSWORD=abcdefghijklmnop
   FEEDBACK_EMAIL=predajto.ai@gmail.com
   EMAIL_FROM=predajto.ai@gmail.com
   ```

6. **Reštartuj server:**
   ```bash
   node server.mjs
   ```

7. **Skontroluj výstup:**
   ```
   📧 Email notifications enabled
   predajto.ai dev server running on http://127.0.0.1:5510
   ```

   **Ak vidíš:**
   ```
   ⚠️ Email notifications disabled (missing GMAIL_USER or GMAIL_APP_PASSWORD in .env.local)
   ```
   → Skontroluj, či si správne zadal credentials do `env.local`

#### **Krok 2: Test Beta Signup Email**

1. Otvor aplikáciu
2. Zadaj **nový email** (ktorý si ešte nepoužil)
3. Nahraj obrázok, zadaj produkt a vygeneruj inzerát
4. **Skontroluj inbox:** `predajto.ai@gmail.com`

**Očakávaný email:**
```
Subject: 🎉 Nový beta používateľ: test@example.com
From: predajto.ai@gmail.com

🎉 Nový beta používateľ

Email: test@example.com
Prvý produkt: iPhone 13 Pro 256GB
Timestamp: 5. 1. 2026, 21:30:45
```

#### **Krok 3: Test Feedback Email (👍/👎)**

1. Po vygenerovaní inzerátu, klikni na **👍** alebo **👎**
2. **Skontroluj inbox:** `predajto.ai@gmail.com`

**Očakávaný email (👍):**
```
Subject: 👍 Pozitívny feedback - iPhone 13 Pro 256GB
From: predajto.ai@gmail.com

👍 POZITÍVNY FEEDBACK

Produkt: iPhone 13 Pro 256GB
Čas: 5. 1. 2026, 21:35:12
Typ: positive

Vygenerovaný text inzerátu:
Predám iPhone 13 Pro 256GB...
```

**Očakávaný email (👎):**
```
Subject: 👎 Negatívny feedback - iPhone 13 Pro 256GB
From: predajto.ai@gmail.com

👎 NEGATÍVNY FEEDBACK
...
```

---

## 🧹 3. Vyčistené Console Log-y

### Čo bolo vyčistené:
- **Odstránené všetky debug console.log-y** v `main.js` a `server.mjs`
- **Zachované len kritické logy:**
  - Server startup message
  - Email transporter setup warning

### Ako otestovať:

1. **Otvor DevTools (F12) → Console tab**
2. **Refreshni stránku (Ctrl+F5)**
3. **Skontroluj, či console je čistá:**

**✅ Console by mala obsahovať len:**
```
(prázdno alebo len critical errors)
```

**❌ Console by už NEMALA obsahovať:**
```
📧 Beta signup already notified for: ...
✅ Beta signup notification sent
📊 User Feedback: ...
✅ Email notification sent
[api] POST /api/evaluate
📊 Edit counter status: 0/3
🔄 Edit counter reset: 3 → 0
```

4. **Test pri generovaní inzerátu:**
   - Vygeneruj inzerát
   - Klikni na thumbs up/down
   - Urob úpravu inzerátu
   - **Console by mala zostať čistá** (žiadne debug log-y)

5. **Test pri chybách:**
   - Vypni server (`taskkill /F /IM node.exe`)
   - Skús vygenerovať inzerát
   - **Mal by si vidieť len user-friendly Toast notifikáciu**
   - Console by nemala byť zaplnená log-mi

---

## 🐛 Riešenie Problémov

### Rate Limiting nefunguje

**Symptóm:** Môžem generovať viac ako 5 inzerátov  
**Riešenie:**
1. Reštartuj server
2. Vyčisti cache prehliadača (Ctrl+Shift+Del)
3. Skontroluj, či máš najnovšiu verziu `server.mjs`

### Email notifikácie nechodia

**Symptóm:** Neklikám thumbs up/down, ale email nepríde  
**Riešenie:**
1. Skontroluj `env.local` - musíš mať všetky 4 premenné
2. GMAIL_APP_PASSWORD musí byť **BEZ MEDZIER** (16 znakov)
3. Reštartuj server a skontroluj, či vidíš "📧 Email notifications enabled"
4. Skontroluj SPAM folder v Gmaile

### Console je stále plná log-ov

**Symptóm:** Vidím staré console.log-y  
**Riešenie:**
1. Hard refresh: **Ctrl+Shift+R** alebo **Ctrl+F5**
2. Skontroluj, či máš najnovšiu verziu: `main.js?v=84`
3. Vymaž cache prehliadača

---

## ✅ Checklist (Skontroluj všetko)

### Rate Limiting
- [ ] Server sa spustil bez chýb
- [ ] Po 5 generovaniach vidím Toast s limitom
- [ ] API vracia HTTP 429 po 5 pokusoch
- [ ] Po hodine môžem znova generovať

### Email Notifikácie
- [ ] `env.local` obsahuje Gmail credentials
- [ ] Server hlási "📧 Email notifications enabled"
- [ ] Email príde pri thumbs up
- [ ] Email príde pri thumbs down
- [ ] Email príde pri novom beta používateľovi
- [ ] Emaily obsahujú správne údaje (produkt, text, timestamp)

### Console Cleanup
- [ ] Console je čistá pri štarte stránky
- [ ] Console je čistá pri generovaní inzerátu
- [ ] Console je čistá pri feedback (thumbs up/down)
- [ ] Console je čistá pri úprave inzerátu
- [ ] Žiadne debug log-y (📊, ✅, 🔄, atď.)

---

## 📊 Poznámky

### Rate Limiting
- Limit je **per IP adresa**, nie per email
- Store je **in-memory** (reštart servera = reset limitov)
- Automatické čistenie každých 10 minút

### Email System
- Emaily sú posielané **asynchrónne** (neblokujú request)
- Ak email zlyhá, **request stále prejde** (silent fail)
- Beta signup email sa posiela **len raz** (tracked v localStorage)

### Console Cleanup
- Odstránené všetky `console.log`, `console.warn` okrem critical errors
- `debugResetEdits()` funkcia stále funguje (pre manuálny reset edit counteru)

---

**Hotovo! Všetky tri funkcie sú implementované a pripravené na testovanie.** 🎉✅

Pre ďalšie otázky alebo problémy, kontaktuj: predajto.ai@gmail.com


