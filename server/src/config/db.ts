import mongoose from 'mongoose';
import { env, isProduction } from './env.js';

/**
 * Single shared connection. Mongoose buffers commands until the connection is
 * ready, but we still await it at boot so the process fails fast on a bad URI
 * rather than accepting traffic it cannot serve.
 */
export async function connectDatabase(): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true);
  if (!isProduction) mongoose.set('debug', false);

  mongoose.connection.on('disconnected', () => {
    console.warn('[db] disconnected');
  });
  mongoose.connection.on('error', (err) => {
    console.error('[db] connection error:', err.message);
  });

  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10_000,
    autoIndex: !isProduction, // in production, create indexes via a migration instead
  });

  console.log(`[db] connected to ${mongoose.connection.name}`);
  return mongoose;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.connection.close();
}
