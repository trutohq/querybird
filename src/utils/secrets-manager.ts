import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';

export class SecretsManager {
  private readonly secretsFile: string;
  private secrets: Map<string, string> = new Map();

  constructor(serviceName: string) {
    this.secretsFile = `/opt/querybird/secrets/${serviceName}.json`;
  }

  async load(): Promise<void> {
    if (existsSync(this.secretsFile)) {
      const content = readFileSync(this.secretsFile, 'utf-8');
      const json = JSON.parse(content);
      for (const [k, v] of Object.entries(json)) {
        this.secrets.set(k, String(v));
      }
    }
  }

  async save(secrets: Record<string, string>): Promise<void> {
    const dir = dirname(this.secretsFile);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.secretsFile, JSON.stringify(secrets, null, 2), { mode: 0o600 });
    this.secrets = new Map(Object.entries(secrets).map(([k, v]) => [k, String(v)]));
  }

  get(key: string): string {
    const value = this.secrets.get(key);
    if (!value) throw new Error(`Secret not found: ${key}`);
    return value;
  }

  getAll(): Record<string, string> {
    return Object.fromEntries(this.secrets);
  }
}

export function expandConfigWithSecrets(obj: any, secrets: SecretsManager): any {
  if (typeof obj === 'string') {
    if (obj.startsWith('!secret ')) {
      const key = obj.substring(8).trim();
      return secrets.get(key);
    }
    return obj.replace(/\${(\w+)}/g, (_, k) => process.env[k] || '');
  }
  if (Array.isArray(obj)) return obj.map((v) => expandConfigWithSecrets(v, secrets));
  if (obj && typeof obj === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(obj)) out[k] = expandConfigWithSecrets(v, secrets);
    return out;
  }
  return obj;
}
