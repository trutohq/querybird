import { writeFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { ImprovedSecretsManager } from '../utils/improved-secrets-manager';
import { Logger } from '../utils/logger';
import { Output } from '../types/job-schema';

export class OutputManager {
  constructor(
    private secretsManager: ImprovedSecretsManager,
    private logger: Logger,
    private outputDir: string = './outputs'
  ) {}

  async send(data: unknown, output: Output): Promise<void> {
    const resolvedOutput = await this.resolveSecrets(output);
    
    switch (resolvedOutput.type) {
      case 'webhook':
      case 'http':
        await this.sendHttp(data, resolvedOutput);
        break;
      case 'file':
        await this.saveToFile(data, resolvedOutput);
        break;
      case 's3':
        await this.saveToS3(data, resolvedOutput);
        break;
      default:
        throw new Error(`Unsupported output type: ${output.type}`);
    }
  }

  private async resolveSecrets(output: Output): Promise<Output> {
    const resolved = { ...output };
    
    if (resolved.endpoint) {
      resolved.endpoint = await this.secretsManager.resolveSecret(resolved.endpoint);
    }
    
    if (resolved.headers) {
      if (typeof resolved.headers === 'string') {
        resolved.headers = await this.secretsManager.resolveSecret(resolved.headers);
      } else if (typeof resolved.headers === 'object') {
        const headers: Record<string, string> = {};
        for (const [key, value] of Object.entries(resolved.headers)) {
          headers[key] = await this.secretsManager.resolveSecret(value);
        }
        resolved.headers = headers;
      }
    }

    if (resolved.body) {
      if (typeof resolved.body === 'string') {
        resolved.body = await this.secretsManager.resolveSecret(resolved.body);
      } else if (typeof resolved.body === 'object') {
        // Recursively resolve secrets in object values
        const bodyObj: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(resolved.body)) {
          if (typeof value === 'string') {
            bodyObj[key] = await this.secretsManager.resolveSecret(value);
          } else {
            bodyObj[key] = value;
          }
        }
        resolved.body = bodyObj;
      }
    }

    if (resolved.query_params) {
      if (typeof resolved.query_params === 'string') {
        resolved.query_params = await this.secretsManager.resolveSecret(resolved.query_params);
      } else if (typeof resolved.query_params === 'object') {
        const queryParams: Record<string, string> = {};
        for (const [key, value] of Object.entries(resolved.query_params)) {
          queryParams[key] = await this.secretsManager.resolveSecret(value);
        }
        resolved.query_params = queryParams;
      }
    }

    // The upload_url type now reuses standard HTTP fields (endpoint, headers, body, query_params)
    // so no additional resolution needed
    
    if (resolved.bucket) {
      resolved.bucket = await this.secretsManager.resolveSecret(resolved.bucket);
    }
    
    if (resolved.path) {
      resolved.path = await this.secretsManager.resolveSecret(resolved.path);
    }
    
    return resolved;
  }


  private async sendHttp(data: unknown, output: Output): Promise<void> {
    if (!output.endpoint) {
      throw new Error('Endpoint is required for HTTP output');
    }

    // Check if this is a two-step upload flow
    if (output.response_url_field) {
      await this.sendToUploadUrl(data, output);
      return;
    }

    // Single-step HTTP request
    const url = this.buildUrl(output.endpoint, output.query_params);
    const method = output.method || 'POST';
    
    // Determine payload and headers
    let payload: string | undefined;
    let headers: Record<string, string> = {};
    if (output.headers && typeof output.headers === 'object' && !Array.isArray(output.headers)) {
      headers = { ...output.headers };
    }

    if (output.body) {
      // Use custom body if provided
      payload = typeof output.body === 'string' ? output.body : JSON.stringify(output.body);
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }
    } else if (method !== 'GET' && method !== 'DELETE') {
      // Use formatted data for non-GET/DELETE requests
      payload = this.formatData(data, output.format);
      headers['Content-Type'] = this.getContentType(output.format);
    }

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= output.retryCount; attempt++) {
      try {
        const response = await fetch(url, {
          method,
          headers,
          body: payload
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        this.logger.info(`Successfully sent ${method} request to ${url}`);
        return;
        
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`HTTP output attempt ${attempt}/${output.retryCount} failed:`, { error: error instanceof Error ? error.message : String(error) });
        
        if (attempt < output.retryCount) {
          await new Promise(resolve => setTimeout(resolve, output.retryDelay));
        }
      }
    }

    throw lastError || new Error('HTTP output failed');
  }

  private async sendToUploadUrl(data: unknown, output: Output): Promise<void> {
    if (!output.endpoint) {
      throw new Error('endpoint is required for upload_url output');
    }

    // Step 1: Get the upload URL
    const uploadUrlResponse = await this.getUploadUrl(output);
    
    // Step 2: Upload the data to the returned URL
    const uploadMethod = output.upload_method || 'POST';
    let payload: string | undefined;
    const uploadHeaders: Record<string, string> = {};

    if (uploadMethod !== 'GET' && uploadMethod !== 'DELETE') {
      payload = this.formatData(data, output.format);
      uploadHeaders['Content-Type'] = this.getContentType(output.format);
    }

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= output.retryCount; attempt++) {
      try {
        const response = await fetch(uploadUrlResponse.upload_url, {
          method: uploadMethod,
          headers: uploadHeaders,
          body: payload
        });

        if (!response.ok) {
          throw new Error(`Upload failed - HTTP ${response.status}: ${response.statusText}`);
        }

        this.logger.info(`Successfully uploaded data to ${uploadUrlResponse.upload_url} using ${uploadMethod}`);
        return;
        
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`Upload attempt ${attempt}/${output.retryCount} failed:`, { error: error instanceof Error ? error.message : String(error) });
        
        if (attempt < output.retryCount) {
          await new Promise(resolve => setTimeout(resolve, output.retryDelay));
        }
      }
    }

    throw lastError || new Error('Upload failed');
  }

  private async getUploadUrl(output: Output): Promise<{ upload_url: string }> {
    const url = this.buildUrl(output.endpoint!, output.query_params);
    const method = output.method || 'POST';
    
    let payload: string | undefined;
    let headers: Record<string, string> = {};
    if (output.headers && typeof output.headers === 'object' && !Array.isArray(output.headers)) {
      headers = { ...output.headers };
    }

    if (output.body && method !== 'GET' && method !== 'DELETE') {
      payload = typeof output.body === 'string' ? output.body : JSON.stringify(output.body);
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }
    }


    const response = await fetch(url, {
      method,
      headers,
      body: payload
    });

    if (!response.ok) {
      throw new Error(`Failed to get upload URL - HTTP ${response.status}: ${response.statusText}`);
    }

    const responseData = await response.json();
    
    const urlField = output.response_url_field || 'url';
    
    if (!responseData[urlField]) {
      throw new Error(`Upload URL response missing '${urlField}' field`);
    }

    this.logger.info(`Got upload URL from ${url} using ${method}`);
    
    return { upload_url: responseData[urlField] };
  }

  private buildUrl(baseUrl: string, queryParams?: string | Record<string, string>): string {
    if (!queryParams) {
      return baseUrl;
    }

    if (typeof queryParams === 'string') {
      // If queryParams is a string, it should have been processed by resolveSecrets/JSONata
      // For now, just return the base URL
      return baseUrl;
    }

    if (Object.keys(queryParams).length === 0) {
      return baseUrl;
    }

    const url = new URL(baseUrl);
    Object.entries(queryParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    return url.toString();
  }

  private async saveToFile(data: unknown, output: Output): Promise<void> {
    if (!output.path) {
      throw new Error('Path is required for file output');
    }

    const filePath = join(this.outputDir, output.path);
    const dir = dirname(filePath);
    
    await mkdir(dir, { recursive: true });
    
    const content = this.formatData(data, output.format);
    await writeFile(filePath, content);
    
    this.logger.info(`Data saved to file: ${filePath}`);
  }

  private async saveToS3(data: unknown, output: Output): Promise<void> {
    // Local S3-compatible storage (MinIO) implementation
    // This would work in VPC without external dependencies
    throw new Error('S3 output not implemented for local-only mode');
  }

  private formatData(data: unknown, format: 'json' | 'csv' | 'parquet'): string {
    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);
      
      case 'csv':
        return this.convertToCsv(data);
      
      case 'parquet':
        // Would need a local parquet library
        throw new Error('Parquet format not supported in local-only mode');
      
      default:
        return JSON.stringify(data, null, 2);
    }
  }

  private convertToCsv(data: unknown): string {
    let normalizedData: Record<string, unknown>[];
    
    if (!Array.isArray(data)) {
      normalizedData = [data as Record<string, unknown>];
    } else {
      normalizedData = data as Record<string, unknown>[];
    }

    if (normalizedData.length === 0) {
      return '';
    }

    const firstRow = normalizedData[0];
    if (!firstRow || typeof firstRow !== 'object') {
      return '';
    }

    const headers = Object.keys(firstRow);
    const csvRows = [headers.join(',')];

    for (const row of normalizedData) {
      if (!row || typeof row !== 'object') continue;
      
      const values = headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) {
          return '';
        }
        
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        
        return stringValue;
      });
      
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }

  private getContentType(format: 'json' | 'csv' | 'parquet'): string {
    switch (format) {
      case 'json': return 'application/json';
      case 'csv': return 'text/csv';
      case 'parquet': return 'application/octet-stream';
      default: return 'application/json';
    }
  }
}