#!/usr/bin/env bun
import { createSign, createVerify, generateKeyPairSync } from 'crypto';
import { readFile, writeFile, readdir, mkdir } from 'fs/promises';
import { join } from 'path';

interface SigningKeys {
  privateKey: string;
  publicKey: string;
}

const KEYS_DIR = './keys';
const BINARIES_DIR = './dist/binaries';

async function generateKeys(): Promise<void> {
  console.log('🔑 Generating signing keys...');

  await mkdir(KEYS_DIR, { recursive: true });

  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 4096,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  await writeFile(join(KEYS_DIR, 'querybird-private.pem'), privateKey);
  await writeFile(join(KEYS_DIR, 'querybird-public.pem'), publicKey);

  console.log('✅ Generated signing keys:');
  console.log(`  Private key: ${join(KEYS_DIR, 'querybird-private.pem')}`);
  console.log(`  Public key: ${join(KEYS_DIR, 'querybird-public.pem')}`);
  console.log('\n⚠️  Keep your private key secure and never commit it to version control!');
}

async function signBinary(binaryPath: string, privateKeyPath: string): Promise<string> {
  const privateKey = await readFile(privateKeyPath, 'utf8');
  const binaryContent = await readFile(binaryPath);

  const sign = createSign('SHA256');
  sign.update(binaryContent);
  sign.end();

  return sign.sign(privateKey, 'base64');
}

async function signAllBinaries(): Promise<void> {
  console.log('🔐 Signing all binaries...');

  const privateKeyPath = join(KEYS_DIR, 'querybird-private.pem');
  const publicKeyPath = join(KEYS_DIR, 'querybird-public.pem');

  // Check if keys exist
  try {
    await readFile(privateKeyPath);
    await readFile(publicKeyPath);
  } catch {
    console.error('❌ Signing keys not found. Run "generate-keys" first.');
    process.exit(1);
  }

  const files = await readdir(BINARIES_DIR);
  const binaryFiles = files.filter((f) => f.startsWith('querybird-') && !f.endsWith('.sig'));

  for (const file of binaryFiles) {
    const binaryPath = join(BINARIES_DIR, file);
    const signature = await signBinary(binaryPath, privateKeyPath);

    const sigPath = `${binaryPath}.sig`;
    await writeFile(sigPath, signature);

    console.log(`✅ Signed ${file}`);
  }

  // Copy public key to binaries directory
  await copyFile(publicKeyPath, join(BINARIES_DIR, 'querybird-public.pem'));
  console.log('✅ Copied public key to binaries directory');
}

async function verifyBinary(binaryPath: string, signaturePath: string, publicKeyPath: string): Promise<boolean> {
  try {
    const publicKey = await readFile(publicKeyPath, 'utf8');
    const binaryContent = await readFile(binaryPath);
    const signature = await readFile(signaturePath, 'utf8');

    const verify = createVerify('SHA256');
    verify.update(binaryContent);
    verify.end();

    return verify.verify(publicKey, signature, 'base64');
  } catch {
    return false;
  }
}

async function verifyAllBinaries(): Promise<void> {
  console.log('🔍 Verifying all binary signatures...');

  const publicKeyPath = join(BINARIES_DIR, 'querybird-public.pem');

  try {
    await readFile(publicKeyPath);
  } catch {
    console.error('❌ Public key not found in binaries directory.');
    process.exit(1);
  }

  const files = await readdir(BINARIES_DIR);
  const binaryFiles = files.filter((f) => f.startsWith('querybird-') && !f.endsWith('.sig'));

  let allValid = true;

  for (const file of binaryFiles) {
    const binaryPath = join(BINARIES_DIR, file);
    const signaturePath = `${binaryPath}.sig`;

    try {
      const isValid = await verifyBinary(binaryPath, signaturePath, publicKeyPath);

      if (isValid) {
        console.log(`✅ ${file} - Signature valid`);
      } else {
        console.log(`❌ ${file} - Signature invalid`);
        allValid = false;
      }
    } catch {
      console.log(`❌ ${file} - Signature file missing`);
      allValid = false;
    }
  }

  if (allValid) {
    console.log('\n🎉 All binaries verified successfully!');
  } else {
    console.log('\n❌ Some binaries failed verification.');
    process.exit(1);
  }
}

async function copyFile(src: string, dest: string): Promise<void> {
  const { copyFile: fsCopyFile } = await import('fs/promises');
  await fsCopyFile(src, dest);
}

async function main(): Promise<void> {
  const command = process.argv[2];

  switch (command) {
    case 'generate-keys':
      await generateKeys();
      break;

    case 'sign-all':
      await signAllBinaries();
      break;

    case 'verify-all':
      await verifyAllBinaries();
      break;

    default:
      console.log('QueryBird Binary Signing Tool');
      console.log('');
      console.log('Commands:');
      console.log('  generate-keys  Generate new RSA signing key pair');
      console.log('  sign-all       Sign all binaries with private key');
      console.log('  verify-all     Verify all binary signatures');
      console.log('');
      console.log('Example usage:');
      console.log('  bun run scripts/sign-binaries.ts generate-keys');
      console.log('  bun run scripts/sign-binaries.ts sign-all');
      console.log('  bun run scripts/sign-binaries.ts verify-all');
      break;
  }
}

if (import.meta.main) {
  main().catch(console.error);
}
