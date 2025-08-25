import { z } from 'zod';

const SqlQuerySchema = z.object({
  name: z.string().min(1),
  sql: z.string().min(1),
});

// New format with required name for array connections
const DatabaseConnectionSchema = z.object({
  name: z.string().min(1),
  connection_info: z.string().min(1),
  sql: z.array(SqlQuerySchema).min(1),
});

// Legacy format for backward compatibility
const LegacyDatabaseConnectionSchema = z.object({
  connection_info: z.string().min(1),
  sql: z.array(SqlQuerySchema).min(1),
});

// Allow URL or secret reference
const urlOrSecretRef = z.string().refine(
  (val) => {
    return val.startsWith('!secrets ') || z.string().url().safeParse(val).success;
  },
  { message: 'Must be a valid URL or secret reference (!secrets ...)' }
);

export const InputSchema = z
  .object({
    postgres: z.union([LegacyDatabaseConnectionSchema, DatabaseConnectionSchema, z.array(DatabaseConnectionSchema).min(1)]).optional(),
    mysql: z.union([LegacyDatabaseConnectionSchema, DatabaseConnectionSchema, z.array(DatabaseConnectionSchema).min(1)]).optional(),
    http: z
      .object({
        url: urlOrSecretRef,
        method: z.enum(['GET', 'POST']).default('GET'),
        headers: z.union([z.record(z.string()), z.string()]).optional(),
      })
      .optional(),
  })
  .refine(
    (data) => {
      const sources = [data.postgres, data.mysql, data.http].filter(Boolean);
      return sources.length >= 1;
    },
    { message: 'At least one input source must be specified' }
  );

export const OutputSchema = z
  .object({
    type: z.enum(['webhook', 'http', 's3', 'file']),
    endpoint: urlOrSecretRef.optional(),
    format: z.enum(['json', 'csv', 'parquet']).default('json'),
    headers: z.union([z.record(z.string()), z.string()]).optional(),
    retryCount: z
      .union([z.number(), z.string()])
      .default(3)
      .transform((val) => (typeof val === 'string' ? parseInt(val, 10) : val)),
    retryDelay: z
      .union([z.number(), z.string()])
      .default(5000)
      .transform((val) => (typeof val === 'string' ? parseInt(val, 10) : val)),
    bucket: z.string().optional(),
    key: z.string().optional(),
    path: z.string().optional(),

    // Enhanced HTTP configuration
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('POST'),
    body: z.union([z.record(z.unknown()), z.string()]).optional(), // Custom body (overrides format if provided)
    query_params: z.union([z.record(z.string()), z.string()]).optional(), // Query parameters

    // Additional fields for upload_url type
    response_url_field: z.string().optional(),
    upload_method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('POST'),
  })
  .refine(
    (data) => {
      if (data.type === 'webhook' || data.type === 'http') {
        return !!data.endpoint;
      }
      if (data.type === 'file') {
        return !!data.path;
      }
      if (data.type === 's3') {
        return !!(data.bucket && data.key);
      }
      return true;
    },
    { message: 'Required fields missing for output type' }
  );

export const JobSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'Job ID must contain only lowercase letters, numbers, and hyphens'),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  input: InputSchema,
  /**
   * JSONata transformation expression.
   *
   * For database inputs, you can access results using:
   * - Enhanced format: db_name.query_name (e.g., test1.users)
   *
   * Examples:
   * - test1.users - Access all results from test1 database users query
   * - wsrwr.users.is_superuser - Access is_superuser field from wsrwr database users query
   * - $merge([test1.users, wsrwr.users]) - Merge results from multiple databases
   *
   * Connection Info Context:
   * - Single connection: connection_info.db_name, connection_info.region
   * - Multiple connections: db_name.connection_info.db_name, db_name.connection_info.region
   * - Root level: connections_info.db_name for all connection details
   * - Additional fields: connection_info.host, connection_info.port, connection_info.user, connection_info.ssl
   *
   * Note: The new format creates nested objects, so you can access data using
   * standard dot notation in JSONata expressions.
   */
  transform: z.string().min(1),
  schedule: z.string().min(1),
  enabled: z.boolean().default(true),
  outputs: z.array(OutputSchema).min(1),
  timeout: z
    .union([z.number(), z.string()])
    .default(30000)
    .transform((val) => (typeof val === 'string' ? parseInt(val, 10) : val)),
  watermark: z
    .object({
      column: z.string().min(1),
      initial_value: z.string().min(1),
      store_path: z.string().optional(),
    })
    .optional(),
});

export type Job = z.infer<typeof JobSchema>;
export type Input = z.infer<typeof InputSchema>;
export type Output = z.infer<typeof OutputSchema>;
export type SqlQuery = z.infer<typeof SqlQuerySchema>;
