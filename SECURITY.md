# Security Policy

## Supported Versions

We actively maintain and provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security vulnerability in QueryBird, please follow these steps:

### 1. **DO NOT** create a public GitHub issue

Public issues can lead to security vulnerabilities being exploited before they're patched.

### 2. Report the vulnerability privately

Send an email to our security team at: [security@querybird.dev](mailto:security@querybird.dev)

### 3. Include detailed information

Please provide as much detail as possible:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)
- Your contact information

### 4. What happens next?

- We'll acknowledge receipt within 48 hours
- We'll investigate and provide updates
- We'll work on a fix and coordinate disclosure
- We'll credit you in the security advisory (unless you prefer to remain anonymous)

## Security Best Practices

### For Users

- Always use the latest stable version
- Keep your secrets and configuration files secure
- Use strong, unique passwords for database connections
- Regularly rotate API keys and credentials
- Monitor your logs for suspicious activity

### For Developers

- Never commit secrets or sensitive information
- Use environment variables for configuration
- Validate all input data
- Implement proper error handling
- Follow the principle of least privilege

## Security Features

QueryBird includes several security features:

- Secure secrets management
- Input validation and sanitization
- Secure database connections
- Audit logging capabilities
- Binary signing and verification

## Responsible Disclosure

We follow responsible disclosure practices:

- We'll work with you to understand and validate the issue
- We'll develop and test fixes thoroughly
- We'll coordinate public disclosure with you
- We'll provide adequate time for users to update

## Security Updates

Security updates are released as patch versions (e.g., 2.0.1, 2.0.2) and should be applied as soon as possible.

## Contact

For security-related questions or concerns:

- Email: [security@querybird.dev](mailto:security@querybird.dev)
- PGP Key: [Available upon request]

Thank you for helping keep QueryBird secure!
