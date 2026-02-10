#!/bin/bash
# Journey Mapper - Deployment Script
# This deploys the cell population fix to Firebase

set -e  # Exit on error

echo "🚀 Journey Mapper Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Install with: pnpm add -g firebase-tools"
    exit 1
fi

echo "✅ Firebase CLI found"
echo ""

# Check authentication
echo "📋 Checking Firebase authentication..."
if ! firebase projects:list &> /dev/null; then
    echo "⚠️  Not authenticated. Opening browser for login..."
    firebase login --reauth
else
    echo "✅ Already authenticated"
fi

echo ""
echo "🔨 Building API..."
cd api-mcp
pnpm build
cd ..
echo "✅ Build complete"

echo ""
echo "📦 Deploying to Firebase..."
echo "   • Functions (API)"
echo "   • Hosting (Frontend)"
firebase deploy --only functions,hosting

echo ""
echo "✨ Deployment complete!"
echo ""
echo "🔍 Test the fix:"
echo "   1. Visit your Firebase URL"
echo "   2. Start a new journey"
echo "   3. Answer questions about cells"
echo "   4. Verify cells populate on canvas immediately"
echo ""
echo "📊 Check logs at: https://console.firebase.google.com"
