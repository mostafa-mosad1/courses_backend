require('dotenv').config();
const app = require('./app');
const pool = require('./config/db');

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    console.log('✅ MySQL connected');
  } catch (err) {
    console.error('❌ Database connection failed', err.message || err);
  }

  // Only listen if not running on Vercel
  if (process.env.VERCEL) {
    module.exports = app;
  } else {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  }
}

start();
