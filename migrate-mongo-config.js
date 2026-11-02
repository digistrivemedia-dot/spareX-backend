// migrate-mongo reads this file directly, so it loads .env itself when one exists.
const { existsSync } = require('node:fs');

if (existsSync('.env')) process.loadEnvFile('.env');

if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set.');

module.exports = {
  mongodb: { url: process.env.MONGO_URI },
  migrationsDir: 'migrations',
  changelogCollectionName: 'migrations',
  lockCollectionName: 'migrationsLock',
  lockTtl: 300,
  migrationFileExtension: '.js',
  useFileHash: false,
  moduleSystem: 'commonjs',
};
