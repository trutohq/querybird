import { Client as PgClient } from 'pg';
import mysql from 'mysql2/promise';
import { ImprovedSecretsManager } from '../utils/improved-secrets-manager';
import { Logger } from '../utils/logger';

interface DatabaseConfig {
  host: string;
  port?: number;
  database: string;
  user: string;
  username?: string;
  password: string;
  ssl?: boolean;
  timeout?: number;
}

export interface DatabaseConnection {
  query(sql: string, params?: unknown[]): Promise<unknown[]>;
  close(): Promise<void>;
}

class PostgresConnection implements DatabaseConnection {
  constructor(private client: PgClient) {}

  async query(sql: string, params?: unknown[]): Promise<unknown[]> {
    const result = await this.client.query(sql, params);
    return result.rows;
  }

  async close(): Promise<void> {
    await this.client.end();
  }
}

class MySqlConnection implements DatabaseConnection {
  constructor(private connection: mysql.Connection) {}

  async query(sql: string, params?: unknown[]): Promise<unknown[]> {
    const [rows] = await this.connection.execute(sql, params);
    return rows as unknown[];
  }

  async close(): Promise<void> {
    await this.connection.end();
  }
}

export class DatabaseManager {
  private connections = new Map<string, DatabaseConnection>();

  constructor(
    private secretsManager: ImprovedSecretsManager,
    private logger: Logger
  ) {}

  async getConnection(type: 'postgres' | 'mysql', connectionInfo: string): Promise<DatabaseConnection> {
    const connectionKey = `${type}:${connectionInfo}`;
    
    let connection = this.connections.get(connectionKey);
    if (connection) {
      return connection;
    }

    connection = await this.createConnection(type, connectionInfo);
    this.connections.set(connectionKey, connection);
    
    return connection;
  }

  private async createConnection(type: 'postgres' | 'mysql', connectionInfo: string): Promise<DatabaseConnection> {
    let config: DatabaseConfig;
    try {
      config = JSON.parse(connectionInfo) as DatabaseConfig;
    } catch (error) {
      this.logger.debug(`Failed to parse connection info as JSON, trying as URL: ${connectionInfo}`);
      config = this.parseConnectionUrl(connectionInfo);
    }

    if (type === 'postgres') {
      const client = new PgClient({
        host: config.host,
        port: config.port || 5432,
        database: config.database,
        user: config.user || config.username,
        password: config.password,
        ssl: config.ssl !== false ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: config.timeout || 30000,
      });

      await client.connect();
      this.logger.info(`Connected to PostgreSQL: ${config.host}:${config.port}/${config.database}`);
      
      return new PostgresConnection(client);
    } else {
      const mysqlConfig: mysql.ConnectionOptions = {
        host: config.host,
        port: config.port || 3306,
        database: config.database,
        user: config.user || config.username,
        password: config.password,
      };
      
      if (config.ssl !== false) {
        mysqlConfig.ssl = {};
      }
      
      const connection = await mysql.createConnection(mysqlConfig);

      this.logger.info(`Connected to MySQL: ${config.host}:${config.port}/${config.database}`);
      
      return new MySqlConnection(connection);
    }
  }

  private parseConnectionUrl(url: string): DatabaseConfig {
    const urlObj = new URL(url);
    
    return {
      host: urlObj.hostname,
      port: urlObj.port ? parseInt(urlObj.port, 10) : undefined,
      database: urlObj.pathname.slice(1),
      user: urlObj.username,
      password: urlObj.password,
      ssl: urlObj.searchParams.get('ssl') !== 'false',
    };
  }

  async closeAll(): Promise<void> {
    const promises: Promise<void>[] = [];
    
    for (const [key, connection] of this.connections) {
      promises.push(
        connection.close().catch(error => {
          this.logger.error(`Failed to close connection ${key}:`, error);
        })
      );
    }
    
    await Promise.all(promises);
    this.connections.clear();
    
    this.logger.info('All database connections closed');
  }

  /**
   * Close all connections and clear the pool due to secrets change
   * This forces recreation of connections with new credentials
   */
  async closeAllConnections(): Promise<void> {
    if (this.connections.size > 0) {
      this.logger.info('Closing all database connections due to secrets reload...');
      await this.closeAll();
    }
  }
}