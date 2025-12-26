import dotenv from 'dotenv';
dotenv.config();

export const PORT = process.env.PORT || 3000;
export const LOCAL_URL = process.env.LOCAL_URL;
export const CLOUD_URL = process.env.CLOUD_URL;

export const JWT_SECRET = process.env.JWT_SECRET;
export const DEVICE_SECRET = process.env.DEVICE_SECRET;
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN;

export const PUBNUB_PUBLISH_KEY = process.env.PUBNUB_PUBLISH_KEY;
export const PUBNUB_SUBSCRIBE_KEY = process.env.PUBNUB_SUBSCRIBE_KEY;
export const PUBNUB_SECRET_KEY = process.env.SECRET_KEY;

export const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'guard_imoto_db',
  ssl: {
    rejectUnauthorized: false, // allows self-signed cert
  },
};

export const FIREBASE_SERVICE_ACCOUNT = process.env.FIREBASE_SERVICE_ACCOUNT;
