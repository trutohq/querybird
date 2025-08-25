#!/usr/bin/env bun
import { readdir, unlink, stat } from 'fs/promises';
import { join } from 'path';

const RELEASES_DIR = join(process.cwd(), 'dist', 'releases');

interface AssetInfo {
  name: string;
  size: number;
  created: Date;
}

async function cleanAssets(): Promise<void> {
  console.log('🧹 Cleaning up QueryBird release assets...');

  try {
    const files = await readdir(RELEASES_DIR);

    // Group files by platform and version
    const assetGroups = new Map<string, AssetInfo[]>();

    for (const file of files) {
      if (file.endsWith('.zip') || file.endsWith('.tar.gz') || file.endsWith('.txt') || file.endsWith('.md')) {
        const filePath = join(RELEASES_DIR, file);
        const stats = await stat(filePath);

        // Parse filename to extract platform and version
        const match = file.match(/^querybird-([^-]+)-([^-]+)-v([^-]+)\.(.+)$/);
        if (match) {
          const [, platform, arch, version, ext] = match;
          const key = `${platform}-${arch}-${version}`;

          if (!assetGroups.has(key)) {
            assetGroups.set(key, []);
          }

          assetGroups.get(key)!.push({
            name: file,
            size: stats.size,
            created: stats.birthtime,
          });
        }
      }
    }

    // Find and report duplicate assets
    let duplicatesFound = false;
    for (const [key, assets] of assetGroups) {
      if (assets.length > 1) {
        console.log(`⚠️  Duplicate assets found for ${key}:`);
        for (const asset of assets) {
          console.log(`   - ${asset.name} (${(asset.size / 1024).toFixed(1)} KB, created: ${asset.created.toISOString()})`);
        }
        duplicatesFound = true;
      }
    }

    if (!duplicatesFound) {
      console.log('✅ No duplicate assets found');
    }

    // List all assets
    console.log('\n📦 Current release assets:');
    const allAssets = files.filter((f) => f.endsWith('.zip') || f.endsWith('.tar.gz'));
    allAssets.sort();

    for (const asset of allAssets) {
      const filePath = join(RELEASES_DIR, asset);
      const stats = await stat(filePath);
      const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`   ${asset} (${sizeInMB} MB)`);
    }

    console.log(`\nTotal assets: ${allAssets.length}`);
  } catch (error) {
    console.error('❌ Error cleaning assets:', error);
    process.exit(1);
  }
}

async function validateNaming(): Promise<void> {
  console.log('\n🔍 Validating asset naming conventions...');

  try {
    const files = await readdir(RELEASES_DIR);
    const zipFiles = files.filter((f) => f.endsWith('.zip'));

    const expectedPatterns = ['querybird-linux-x64-v', 'querybird-linux-arm64-v', 'querybird-darwin-x64-v', 'querybird-darwin-arm64-v', 'querybird-windows-x64-v', 'querybird-windows-arm64-v'];

    let namingIssues = 0;

    for (const file of zipFiles) {
      let matchesExpected = false;

      for (const pattern of expectedPatterns) {
        if (file.startsWith(pattern)) {
          matchesExpected = true;
          break;
        }
      }

      if (!matchesExpected) {
        console.log(`❌ Unexpected naming: ${file}`);
        namingIssues++;
      }
    }

    if (namingIssues === 0) {
      console.log('✅ All assets follow expected naming conventions');
    } else {
      console.log(`⚠️  Found ${namingIssues} assets with unexpected naming`);
    }
  } catch (error) {
    console.error('❌ Error validating naming:', error);
  }
}

async function main(): Promise<void> {
  if (process.argv.includes('--validate-only')) {
    await validateNaming();
    return;
  }

  await cleanAssets();
  await validateNaming();

  console.log('\n🎯 Recommendations:');
  console.log('1. Always run "bun run clean" before building');
  console.log('2. Use consistent versioning across all builds');
  console.log('3. Avoid manual asset creation outside of build scripts');
  console.log('4. Run this script regularly to check for issues');
}

if (import.meta.main) {
  main().catch(console.error);
}
