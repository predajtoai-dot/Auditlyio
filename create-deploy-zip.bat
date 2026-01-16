@echo off
echo ========================================
echo 📦 Creating Vercel Deployment ZIP
echo ========================================

cd /d "%~dp0"

if exist predajto-deploy.zip del predajto-deploy.zip

echo Creating ZIP file...
powershell -Command "& { Compress-Archive -Path 'index.html','main.js','styles.css','server.mjs','marketStore.mjs','categories.mjs','pricingProtection.mjs','privacy.html','pricing-info-styles.css','package.json','package-lock.json','vercel.json','.vercelignore','env.example','api' -DestinationPath 'predajto-deploy.zip' -Force }"

if exist predajto-deploy.zip (
    echo.
    echo ✅ ZIP created successfully: predajto-deploy.zip
    echo.
    echo 📋 Next steps:
    echo    1. Go to https://vercel.com/new
    echo    2. Upload predajto-deploy.zip
    echo    3. Set Environment Variable: OPENAI_API_KEY
    echo    4. Deploy!
    echo.
) else (
    echo.
    echo ❌ Failed to create ZIP
    echo.
)

pause
