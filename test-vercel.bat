@echo off
set /p DOMAIN="Enter your Vercel domain (e.g., predajto-ai-xxxxx.vercel.app): "

echo.
echo Testing health endpoint...
curl https://%DOMAIN%/api/health
echo.
echo.
echo Testing market search...
curl "https://%DOMAIN%/api/market/search?query=MacBook&limit=5"
echo.
pause
