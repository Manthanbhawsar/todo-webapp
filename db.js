const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const User = require('./models/User');
const Todo = require('./models/Todo');

const DATA_DIR = path.join(__dirname, 'data');
const TODOS_FILE = path.join(DATA_DIR, 'todos.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

let isConnected = false;

async function migrateJsonToMongo() {
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0 && fs.existsSync(USERS_FILE)) {
      const rawUsers = fs.readFileSync(USERS_FILE, 'utf-8');
      const usersData = JSON.parse(rawUsers || '[]');
      if (usersData.length > 0) {
        console.log(`[MONGODB MIGRATION] Importing ${usersData.length} user(s) from JSON to MongoDB...`);
        for (const u of usersData) {
          await User.updateOne(
            { email: u.email.toLowerCase() },
            {
              $setOnInsert: {
                id: u.id,
                name: u.name,
                email: u.email.toLowerCase(),
                passwordHash: u.passwordHash,
                createdAt: u.createdAt ? new Date(u.createdAt) : new Date()
              }
            },
            { upsert: true }
          );
        }
      }
    }

    const todoCount = await Todo.countDocuments();
    if (todoCount === 0 && fs.existsSync(TODOS_FILE)) {
      const rawTodos = fs.readFileSync(TODOS_FILE, 'utf-8');
      const todosData = JSON.parse(rawTodos || '[]');
      if (todosData.length > 0) {
        console.log(`[MONGODB MIGRATION] Importing ${todosData.length} task(s) from JSON to MongoDB...`);
        for (const t of todosData) {
          await Todo.updateOne(
            { id: t.id },
            {
              $setOnInsert: {
                id: t.id,
                userId: t.userId || 'unassigned',
                title: t.title,
                description: t.description || '',
                category: t.category || 'Other',
                priority: t.priority || 'medium',
                dueDate: t.dueDate || null,
                completed: Boolean(t.completed),
                pinned: Boolean(t.pinned),
                subtasks: t.subtasks || [],
                createdAt: t.createdAt || new Date().toISOString(),
                updatedAt: t.updatedAt || new Date().toISOString()
              }
            },
            { upsert: true }
          );
        }
      }
    }
  } catch (err) {
    console.error('[MONGODB MIGRATION ERROR]', err.message);
  }
}

async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/zenith';

  try {
    console.log(`[MONGODB] Attempting connection to: ${uri.replace(/\/\/.*@/, '//<credentials>@')} ...`);
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 3000
    });

    isConnected = true;
    console.log(`🍃 [MONGODB] Connected successfully to ${mongoose.connection.host}/${mongoose.connection.name}`);

    // Auto-migrate if MongoDB is freshly connected
    await migrateJsonToMongo();

  } catch (err) {
    isConnected = false;
    console.warn(`\n⚠️  [MONGODB] Could not establish connection to ${uri}`);
    console.warn(`   Reason: ${err.message}`);
    console.warn(`   ℹ️  The application will use local JSON file storage as a fallback.`);
    console.warn(`   ℹ️  To connect to MongoDB Atlas or local MongoDB, set MONGODB_URI in your .env file:\n` +
                 `      MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/zenith\n` +
                 `      or start MongoDB locally on port 27017.\n`);
  }

  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    console.warn('⚠️  [MONGODB] Disconnected from MongoDB server.');
  });

  mongoose.connection.on('reconnected', async () => {
    isConnected = true;
    console.log('🍃 [MONGODB] Reconnected to MongoDB server.');
    await migrateJsonToMongo();
  });

  return isConnected;
}

function isMongoActive() {
  return isConnected && mongoose.connection.readyState === 1;
}

module.exports = {
  connectDB,
  isMongoActive,
  migrateJsonToMongo
};
