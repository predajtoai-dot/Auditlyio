# 🚀 Quick Deployment Commands

## Option 1: Double-click deploy.bat (Windows)
Just double-click `deploy.bat` file in Windows Explorer!

## Option 2: CMD Command
```cmd
cd /d "C:\Users\marek\OneDrive\Počítač\PredajTo"
vercel --prod --yes
```

## Option 3: Git Bash
```bash
cd "/c/Users/marek/OneDrive/Počítač/PredajTo"
./deploy.sh
```

## Option 4: Git Push (Easiest!)
```bash
git add .
git commit -m "Deploy v133 - Purple theme update"
git push origin main
```

Vercel will auto-deploy from GitHub! 🎉

## After Deployment

Check your site at: https://your-project.vercel.app

Don't forget to set Environment Variables on Vercel:
- OPENAI_API_KEY

---

**Current Version:**
- CSS: v=133
- JS: v=156
