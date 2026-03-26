// Jest global setup — runs before any test file is imported
// This ensures env vars are set BEFORE config/index.ts validates them

process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.API_VERSION = 'v1';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = 'test_secret_key_for_jest_min_32_chars!!';
process.env.JWT_EXPIRES_IN = '1h';
process.env.TWILIO_ACCOUNT_SID = 'ACtest1234567890123456789012345678';
process.env.TWILIO_AUTH_TOKEN = 'test_auth_token_value';
process.env.TWILIO_PHONE_NUMBER = '+15005550006';
process.env.RATE_LIMIT_WINDOW_MS = '900000';
process.env.RATE_LIMIT_MAX = '100';
process.env.SMS_BATCH_SIZE = '5';
process.env.SMS_BATCH_DELAY_MS = '100';
process.env.CORS_ORIGIN = 'http://localhost:5173';
