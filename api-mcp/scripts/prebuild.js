#!/usr/bin/env node
/**
 * Pre-build script: Regenerate version.ts on every build
 * This ensures Firebase Functions always sees a "new" file and redeploys
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const versionFilePath = path.join(__dirname, '../src/version.ts');

// Get git commit hash (short)
let gitCommit = 'local';
try {
    gitCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
} catch (e) {
    console.warn('⚠️  Could not get git commit hash');
}

// Get git branch
let gitBranch = 'unknown';
try {
    gitBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
} catch (e) {
    console.warn('⚠️  Could not get git branch');
}

const versionContent = `// Auto-generated version file - DO NOT EDIT MANUALLY
// This file is regenerated on every build to force function redeployment
// Generated at: ${new Date().toISOString()}

export const VERSION = {
    buildTimestamp: '${new Date().toISOString()}',
    buildNumber: ${Date.now()},
    gitCommit: '${gitCommit}',
    gitBranch: '${gitBranch}',
    nodeVersion: '${process.version}'
};

// Log version on module load
console.log('📦 Journey Mapper API Version:', VERSION);
`;

fs.writeFileSync(versionFilePath, versionContent, 'utf-8');
console.log('✅ Generated version.ts:', { gitCommit, gitBranch, timestamp: new Date().toISOString() });
