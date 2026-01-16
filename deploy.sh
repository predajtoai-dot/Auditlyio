#!/bin/bash
# Vercel deployment script

echo "========================================"
echo "🚀 VERCEL DEPLOYMENT SCRIPT"
echo "========================================"
echo ""

cd "$(dirname "$0")"
echo "📁 Current directory: $(pwd)"
echo ""

echo "🔍 Checking Vercel CLI..."
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found! Install with: npm i -g vercel"
    exit 1
fi
vercel --version
echo ""

echo "📦 Deploying to Vercel Production..."
echo ""
vercel --prod --yes

echo ""
echo "========================================"
if [ $? -eq 0 ]; then
    echo "✅ Deployment SUCCESSFUL!"
else
    echo "❌ Deployment FAILED!"
fi
echo "========================================"
echo ""
