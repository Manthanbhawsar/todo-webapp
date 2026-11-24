require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Todo = require('../models/Todo');

async function inspectDatabase() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/zenith';
  console.log(`\nConnecting to MongoDB: ${uri} ...\n`);

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 4000 });
    console.log('✅ Connected to MongoDB!\n');

    // Fetch Users
    const users = await User.find({}).lean();
    console.log('========================================================================');
    console.log(`👤 USERS COLLECTION (${users.length} registered user${users.length === 1 ? '' : 's'})`);
    console.log('========================================================================');
    if (users.length === 0) {
      console.log('No users found in database.\n');
    } else {
      const userTable = users.map(u => ({
        ID: u.id || u._id.toString(),
        Name: u.name,
        Email: u.email,
        CreatedAt: u.createdAt ? new Date(u.createdAt).toLocaleString() : 'N/A'
      }));
      console.table(userTable);
    }

    // Fetch Todos
    const todos = await Todo.find({}).lean();
    console.log('\n========================================================================');
    console.log(`📝 TODOS / TASKS COLLECTION (${todos.length} task${todos.length === 1 ? '' : 's'})`);
    console.log('========================================================================');
    if (todos.length === 0) {
      console.log('No tasks found in database.\n');
    } else {
      const todoTable = todos.map(t => ({
        ID: t.id || t._id.toString(),
        Owner_UserID: t.userId,
        Title: t.title.length > 28 ? t.title.slice(0, 25) + '...' : t.title,
        Category: t.category,
        Priority: t.priority,
        DueDate: t.dueDate || '-',
        Completed: t.completed ? '✅ Yes' : '⏳ No',
        Pinned: t.pinned ? '📌 Yes' : 'No',
        Subtasks: t.subtasks ? t.subtasks.length : 0
      }));
      console.table(todoTable);
    }

  } catch (err) {
    console.error('❌ Error inspecting MongoDB:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB.\n');
    process.exit(0);
  }
}

inspectDatabase();
