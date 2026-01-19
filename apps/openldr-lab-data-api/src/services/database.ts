import { pool } from "../lib/db";


// Test database connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err:any) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Health check function
const healthCheck = async () => {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    return { status: 'healthy', timestamp: new Date().toISOString() };
  } catch (error:any) {
    return { status: 'unhealthy', error: error.message, timestamp: new Date().toISOString() };
  }
};

// Generic query function
const query = async (text:any, params:any) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error:any) {
    console.error('Database query error:', error);
    throw error;
  }
};

// Get client for transactions
const getClient = async () => {
  return await pool.connect();
};

export {
  pool,
  query,
  getClient,
  healthCheck
}; 