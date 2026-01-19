# 📧 Nastavenie Email Notifikácií pre Feedback

Keď používateľ klikne na 👍 alebo 👎, dostaneš automatický email na `predajto.ai@gmail.com`.

---

## 🚀 Rýchle nastavenie (Gmail)

### 1. Vytvor Gmail App Password

1. Choď na https://myaccount.google.com/apppasswords
2. Prihlás sa do Gmail účtu `predajto.ai@gmail.com`
3. Klikni "**Create app password**"
4. Názov: `Predajto.ai Server`
5. Skopíruj **16-znakový kód** (napr. `abcd efgh ijkl mnop`)

### 2. Pridaj do `env.local`

Otvor `env.local` a pridaj tieto riadky:

```env
GMAIL_USER=predajto.ai@gmail.com
GMAIL_APP_PASSWORD=abcdefghijklmnop
FEEDBACK_EMAIL=predajto.ai@gmail.com
EMAIL_FROM=predajto.ai@gmail.com
```

**Dôležité:**
- `GMAIL_APP_PASSWORD` = 16 znakov **BEZ MEDZIER**
- Nie je to tvoje normálne heslo!
- Nikdy to necommituj do Gitu!

### 3. Nainštaluj `nodemailer`

```bash
npm install nodemailer
```

### 4. Reštartuj server

```bash
node server.mjs
```

Malo by sa zobraziť:
```
📧 Email notifications enabled
```

---

## ✅ Testovanie

1. Otvor aplikáciu
2. Vygeneruj inzerát
3. Klikni na 👍 alebo 👎
4. Skontroluj inbox na `predajto.ai@gmail.com`

---

## 📧 Ako vyzerá email

### Thumbs Up 👍
```
Subject: 👍 Pozitívny feedback - iPhone 13 Pro 256GB
From: Predajto.ai Feedback <predajto.ai@gmail.com>
To: predajto.ai@gmail.com

👍 POZITÍVNY FEEDBACK

Produkt: iPhone 13 Pro 256GB
Čas: 5. 1. 2026, 21:30:45
Typ: positive

Vygenerovaný text inzerátu:
Predám Apple Watch SE 40mm v stave nového kusu...
```

### Thumbs Down 👎
```
Subject: 👎 Negatívny feedback - Samsung Galaxy S23
From: Predajto.ai Feedback <predajto.ai@gmail.com>
To: predajto.ai@gmail.com

👎 NEGATÍVNY FEEDBACK

Produkt: Samsung Galaxy S23
Čas: 5. 1. 2026, 21:35:12
Typ: negative

Vygenerovaný text inzerátu:
Predám mobilný telefón Samsung Galaxy S23...
```

---

## 🔧 Riešenie problémov

### ❌ "Email notifications disabled"

**Príčina:** Chýba `GMAIL_USER` alebo `GMAIL_APP_PASSWORD` v `env.local`

**Riešenie:**
1. Skontroluj, či máš oba v `env.local`
2. Reštartuj server

---

### ❌ "Failed to send email: Invalid login"

**Príčina:** Zlé App Password alebo email

**Riešenie:**
1. Vygeneruj nové App Password
2. Skopíruj ho **BEZ MEDZIER**
3. Ulož do `env.local`
4. Reštartuj server

---

### ❌ "Failed to send email: Connection timeout"

**Príčina:** Firewall blokuje port 587/465

**Riešenie:**
1. Skontroluj firewall
2. Skús iný WiFi/sieť
3. Skontroluj antivírus

---

## 🎯 Čo sa loguje

### V Console (vždy):
```
📊 User Feedback: {
  "timestamp": "2026-01-05T20:45:23.456Z",
  "type": "positive",
  "productName": "iPhone 13 Pro",
  "adText": "Predám..."
}
✅ Email notification sent
```

### V Emaile (ak je nakonfigurované):
- HTML verzia (pekne formátovaná)
- Plain text verzia (pre staré email klienty)

---

## 🔐 Bezpečnosť

✅ **App Password** je bezpečnejšie ako normálne heslo  
✅ Môžeš ho kedykoľvek zrušiť v Google Account  
✅ Funguje len pre SMTP (nie pre prihlásenie do Gmailu)  
✅ `env.local` je v `.gitignore` (nebude commitnutý)

---

## 📊 Štatistiky

Každý feedback obsahuje:
- **Typ:** positive / negative
- **Produkt:** Názov produktu
- **Text:** Prvých 500 znakov vygenerovaného inzerátu
- **Čas:** ISO timestamp

---

## 🚀 Budúce vylepšenia

- [ ] Uložiť do databázy (SQLite/MongoDB)
- [ ] Dashboard pre analýzu feedbacku
- [ ] Automatické AI retraining based on feedback
- [ ] Slack/Discord notifikácie
- [ ] Weekly summary email

---

**Hotovo! Teraz dostaneš email pri každom thumbs up/down.** 📧✅


