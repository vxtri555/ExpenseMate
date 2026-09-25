const mongoose = require('mongoose');

// Don't queue DB queries while disconnected - fail fast so offline mode kicks in
mongoose.set('bufferCommands', false);

// Connects to MongoDB Atlas using MONGODB_URI from .env.
// Returns true when connected, false when running in offline mode.
async function connectDB() {
  if (!process.env.MONGODB_URI) {
    console.warn('⚠️  MONGODB_URI is not set - starting in OFFLINE mode.');
    console.warn('    The app still works: data is saved in the browser (localStorage).');
    console.warn('    To use MongoDB: copy .env.example to .env, add your Atlas connection string, restart.');
    return false;
  }
  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
    console.log('✅ Connected to MongoDB:', mongoose.connection.name);
    return true;
  } catch (err) {
    console.warn('⚠️  MongoDB connection failed - starting in OFFLINE mode.');
    console.warn('    Reason:', err.message);
    console.warn('    Check MONGODB_URI in .env and Atlas Network Access (IP whitelist), then restart.');
    return false;
  }
}

module.exports = connectDB;
