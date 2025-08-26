#!/usr/bin/env bun
import { access, readFile, stat } from 'fs/promises';
import { join } from 'path';
import { createVerify } from 'crypto';

interface VerificationResult {
  component: string;
  status: '✅' | '❌' | '⚠️';
  message: string;
  details?: string;
}

async function checkBinaryExists(binaryPath: string): Promise<VerificationResult> {
  try {
    await access(binaryPath);
    const stats = await stat(binaryPath);
    const isExecutable = (stats.mode & 0o111) !== 0;

    return {
      component: 'Binary Executable',
      status: isExecutable ? '✅' : '⚠️',
      message: `Binary found at ${binaryPath}`,
      details: isExecutable ? 'Executable permissions set' : 'Missing executable permissions',
    };
  } catch {
    return {
      component: 'Binary Executable',
      status: '❌',
      message: `Binary not found at ${binaryPath}`,
    };
  }
}

async function checkBinarySignature(binaryPath: string, publicKeyPath: string): Promise<VerificationResult> {
  try {
    const signaturePath = `${binaryPath}.sig`;

    // Check if signature file exists
    try {
      await access(signaturePath);
    } catch {
      return {
        component: 'Binary Signature',
        status: '⚠️',
        message: 'Signature file not found',
        details: 'Binary is not signed - security verification not possible',
      };
    }

    // Verify signature
    const publicKey = await readFile(publicKeyPath, 'utf8');
    const binaryContent = await readFile(binaryPath);
    const signature = await readFile(signaturePath, 'utf8');

    const verify = createVerify('SHA256');
    verify.update(binaryContent);
    verify.end();

    const isValid = verify.verify(publicKey, signature, 'base64');

    return {
      component: 'Binary Signature',
      status: isValid ? '✅' : '❌',
      message: isValid ? 'Signature verified successfully' : 'Signature verification failed',
      details: isValid ? 'Binary integrity confirmed' : 'Binary may have been tampered with',
    };
  } catch (error) {
    return {
      component: 'Binary Signature',
      status: '❌',
      message: 'Signature verification error',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkConfigurationDirectories(): Promise<VerificationResult[]> {
  const results: VerificationResult[] = [];
  const configDir = process.env.QB_CONFIG_DIR || join(process.env.HOME || '', '.querybird');

  const directories = [
    { path: join(configDir, 'configs'), name: 'Configs Directory' },
    { path: join(configDir, 'secrets'), name: 'Secrets Directory' },
    { path: join(configDir, 'watermarks'), name: 'Watermarks Directory' },
    { path: join(configDir, 'outputs'), name: 'Outputs Directory' },
    { path: join(configDir, 'logs'), name: 'Logs Directory' },
  ];

  for (const dir of directories) {
    try {
      await access(dir.path);
      const stats = await stat(dir.path);

      if (dir.name === 'Secrets Directory') {
        // Check if secrets directory has secure permissions (700)
        const permissions = stats.mode & 0o777;
        const isSecure = permissions === 0o700;

        results.push({
          component: dir.name,
          status: isSecure ? '✅' : '⚠️',
          message: `Directory exists at ${dir.path}`,
          details: isSecure ? 'Secure permissions (700) set' : `Insecure permissions (${permissions.toString(8)}) - should be 700`,
        });
      } else {
        results.push({
          component: dir.name,
          status: '✅',
          message: `Directory exists at ${dir.path}`,
          details: 'Ready for use',
        });
      }
    } catch {
      results.push({
        component: dir.name,
        status: '❌',
        message: `Directory not found at ${dir.path}`,
        details: 'Run setup script to create required directories',
      });
    }
  }

  return results;
}

async function checkPostgresSetup(): Promise<VerificationResult> {
  const paths = { base: process.env.QB_CONFIG_DIR || join(process.env.HOME || '', '.querybird') };
  const configDir = join(paths.base, 'configs');
  const secretsDir = join(paths.base, 'secrets');

  try {
    // Check if there are any job configs
    const { readdir } = await import('fs/promises');
    const configFiles = await readdir(configDir);
    const jobConfigs = configFiles.filter((f) => f.endsWith('.yml') || f.endsWith('.yaml') || f.endsWith('.json'));

    if (jobConfigs.length === 0) {
      return {
        component: 'PostgreSQL Setup',
        status: '⚠️',
        message: 'No job configurations found',
        details: 'Run "querybird init-postgres" to create sample configurations',
      };
    }

    // Check if secrets file exists
    try {
      await access(join(secretsDir, 'secrets.json'));
      return {
        component: 'PostgreSQL Setup',
        status: '✅',
        message: 'PostgreSQL setup appears complete',
        details: `Found ${jobConfigs.length} job config(s) and secrets file`,
      };
    } catch {
      return {
        component: 'PostgreSQL Setup',
        status: '⚠️',
        message: 'Job configs found but secrets file missing',
        details: 'Run "querybird init-postgres" to complete setup',
      };
    }
  } catch (error) {
    return {
      component: 'PostgreSQL Setup',
      status: '❌',
      message: 'Cannot check PostgreSQL setup',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkSystemService(): Promise<VerificationResult> {
  const os = process.platform;

  if (os === 'linux') {
    try {
      const { execSync } = await import('child_process');
      const result = execSync('systemctl is-active querybird', { encoding: 'utf8', stdio: 'pipe' });
      const isActive = result.trim() === 'active';

      return {
        component: 'System Service (Linux)',
        status: isActive ? '✅' : '⚠️',
        message: isActive ? 'QueryBird service is running' : 'QueryBird service is not running',
        details: isActive ? 'Service is active and running' : 'Start with: sudo systemctl start querybird',
      };
    } catch {
      return {
        component: 'System Service (Linux)',
        status: '⚠️',
        message: 'QueryBird service not installed or not accessible',
        details: 'Install with: sudo systemctl enable querybird',
      };
    }
  } else if (os === 'darwin') {
    try {
      const { execSync } = await import('child_process');
      const result = execSync('launchctl list | grep querybird', { encoding: 'utf8', stdio: 'pipe' });

      return {
        component: 'System Service (macOS)',
        status: '✅',
        message: 'QueryBird LaunchDaemon found',
        details: 'Service appears to be configured',
      };
    } catch {
      return {
        component: 'System Service (macOS)',
        status: '⚠️',
        message: 'QueryBird LaunchDaemon not found',
        details: 'Install with: sudo launchctl load /Library/LaunchDaemons/dev.querybird.plist',
      };
    }
  } else if (os === 'win32') {
    return {
      component: 'System Service (Windows)',
      status: '⚠️',
      message: 'Windows service status check not implemented',
      details: 'Check manually with: sc query QueryBird',
    };
  } else {
    return {
      component: 'System Service',
      status: '⚠️',
      message: 'Unsupported operating system',
      details: `Platform: ${os}`,
    };
  }
}

async function runCommandTest(): Promise<VerificationResult> {
  try {
    const { execSync } = await import('child_process');
    const result = execSync('querybird --help', { encoding: 'utf8', stdio: 'pipe' });

    if (result.includes('QueryBird') && result.includes('start')) {
      return {
        component: 'Command Line Interface',
        status: '✅',
        message: 'CLI is working correctly',
        details: 'Help command executed successfully',
      };
    } else {
      return {
        component: 'Command Line Interface',
        status: '❌',
        message: 'CLI output unexpected',
        details: 'Help command output does not match expected format',
      };
    }
  } catch (error) {
    return {
      component: 'Command Line Interface',
      status: '❌',
      message: 'CLI test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function main(): Promise<void> {
  console.log('🔍 QueryBird Installation Verification');
  console.log('=====================================\n');

  const results: VerificationResult[] = [];

  // Check binary
  const binaryPath = process.argv[2] || 'querybird';
  results.push(await checkBinaryExists(binaryPath));

  // Check signature if public key exists
  const publicKeyPath = './querybird-public.pem';
  try {
    await access(publicKeyPath);
    results.push(await checkBinarySignature(binaryPath, publicKeyPath));
  } catch {
    // Public key not found, skip signature check
  }

  // Check configuration directories
  const dirResults = await checkConfigurationDirectories();
  results.push(...dirResults);

  // Check PostgreSQL setup
  results.push(await checkPostgresSetup());

  // Check system service
  results.push(await checkSystemService());

  // Test CLI
  results.push(await runCommandTest());

  // Display results
  console.log('Verification Results:\n');

  let passed = 0;
  let warnings = 0;
  let failed = 0;

  for (const result of results) {
    console.log(`${result.status} ${result.component}`);
    console.log(`   ${result.message}`);
    if (result.details) {
      console.log(`   Details: ${result.details}`);
    }
    console.log('');

    if (result.status === '✅') passed++;
    else if (result.status === '⚠️') warnings++;
    else failed++;
  }

  // Summary
  console.log('📊 Summary:');
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ⚠️  Warnings: ${warnings}`);
  console.log(`   ❌ Failed: ${failed}`);

  if (failed > 0) {
    console.log('\n❌ Installation has issues that need to be resolved.');
    process.exit(1);
  } else if (warnings > 0) {
    console.log('\n⚠️  Installation is functional but has some warnings.');
    console.log('Consider addressing the warnings for optimal operation.');
  } else {
    console.log('\n🎉 Installation verification passed successfully!');
    console.log('QueryBird is ready to use.');
  }

  // Recommendations
  if (warnings > 0 || failed > 0) {
    console.log('\n🔧 Recommendations:');
    console.log('1. Run "querybird init-postgres" to complete PostgreSQL setup');
    console.log('2. Check directory permissions, especially for secrets directory');
    console.log('3. Review system service installation if needed');
    console.log('4. Ensure all required directories exist and are accessible');
  }
}

if (import.meta.main) {
  main().catch(console.error);
}
