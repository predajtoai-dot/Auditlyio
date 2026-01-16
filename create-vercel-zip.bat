@echo off
echo ====================================
echo Creating Vercel deployment ZIP...
echo ====================================

REM Remove old ZIP if exists
if exist "predajto-vercel.zip" del "predajto-vercel.zip"

REM Create ZIP with PowerShell
powershell -Command "Compress-Archive -Path 'index.html','main.js','styles.css','server.mjs','package.json','vercel.json','categories.mjs','marketStore.mjs','pricingProtection.mjs','.gitignore','.vercelignore','env.example','privacy.html','api' -DestinationPath 'predajto-vercel.zip' -Force"

echo.
echo ====================================
echo ZIP created: predajto-vercel.zip
echo ====================================
echo.
echo NEXT STEPS:
echo 1. Go to https://vercel.com/new
echo 2. Select "Deploy from ZIP"
echo 3. Upload predajto-vercel.zip
echo 4. Add Environment Variable: OPENAI_API_KEY
echo 5. Click Deploy!
echo.
pause
