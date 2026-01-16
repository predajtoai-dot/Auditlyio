@echo off
chcp 65001 >nul
echo ========================================
echo 🚀 VERCEL DEPLOYMENT SCRIPT
echo ========================================
echo.

cd /d "%~dp0"
echo 📁 Current directory: %CD%
echo.

echo ✅ Modern Vercel Config:
echo    - Removed deprecated "builds" section
echo    - Using automatic detection
echo    - API functions in /api directory
echo.

echo 🔍 Checking Vercel CLI...
vercel --version
if errorlevel 1 (
    echo ❌ Vercel CLI not found! Install with: npm i -g vercel
    pause
    exit /b 1
)
echo.

echo 📦 Deploying to Vercel Production...
echo    ⚙️ Vercel will auto-detect settings
echo    📂 Static files: index.html, main.js, styles.css
echo    🔧 API functions: /api/server.js
echo.
vercel --prod --yes

echo.
echo ========================================
if errorlevel 1 (
    echo ❌ Deployment FAILED!
    echo.
    echo 💡 Troubleshooting:
    echo    1. Check Environment Variables on Vercel Dashboard
    echo    2. Make sure OPENAI_API_KEY is set
    echo    3. Check deployment logs: vercel logs
) else (
    echo ✅ Deployment SUCCESSFUL!
    echo.
    echo 📋 Next steps:
    echo    1. Check your site URL in the output above
    echo    2. Verify Environment Variables in Vercel Dashboard
    echo    3. Test the API endpoints
)
echo ========================================
echo.
pause
