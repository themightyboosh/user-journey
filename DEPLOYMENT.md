# Deployment Guide

## Firebase Hosting Setup

This project uses Firebase multi-site hosting with two environments:

- **Production**: https://journey-mapper-ai-8822.web.app
- **Staging**: https://journey-mapper-stage.web.app

## Deployment Commands

### Deploy to Production (main branch)
```bash
git checkout main
firebase deploy --only hosting:production,functions
```

### Deploy to Staging (staging branch)
```bash
git checkout staging
firebase deploy --only hosting:staging,functions
```

### Deploy Both Environments
```bash
firebase deploy --only hosting,functions
```

### Deploy Only Functions
```bash
firebase deploy --only functions
```

### Deploy Only Hosting
```bash
# Production
firebase deploy --only hosting:production

# Staging
firebase deploy --only hosting:staging
```

## Branch Strategy

- `main` - Production-ready code → deploys to journey-mapper-ai-8822.web.app
- `staging` - Testing and development → deploys to journey-mapper-stage.web.app

## Quick Deploy Scripts

### Production Deploy
```bash
npm run deploy:prod
# or
pnpm deploy:prod
```

### Staging Deploy
```bash
npm run deploy:stage
# or
pnpm deploy:stage
```

## Environment Configuration

Both environments share the same:
- Firebase project: `journey-mapper-ai-8822`
- Cloud Functions
- Firestore database
- Storage buckets

To isolate data between environments in the future, consider:
- Using Firestore collection prefixes (e.g., `prod_journey_maps`, `stage_journey_maps`)
- Environment-specific service accounts
- Separate Firebase projects for true isolation
