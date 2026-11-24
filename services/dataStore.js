const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User');
const Todo = require('../models/Todo');
const { isMongoActive } = require('../db');

const DATA_DIR = path.join(__dirname, '..', 'data');
const TODOS_FILE = path.join(DATA_DIR, 'todos.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Ensure data folder exists for fallback
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Fallback JSON File Helpers
function readJsonFile(filePath, defaultVal = []) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultVal, null, 2), 'utf-8');
      return defaultVal;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw || '[]');
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err.message);
    return defaultVal;
  }
}

function writeJsonFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err.message);
    return false;
  }
}

const priorityOrder = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1
};

// ======================== USER DATA ACCESS ======================== //

async function findUserByEmail(email) {
  const normalized = (email || '').trim().toLowerCase();
  if (isMongoActive()) {
    const user = await User.findOne({ email: normalized });
    if (!user) return null;
    return {
      id: user.id || user._id.toString(),
      name: user.name,
      email: user.email,
      passwordHash: user.passwordHash,
      createdAt: user.createdAt
    };
  }

  const users = readJsonFile(USERS_FILE);
  return users.find(u => u.email === normalized) || null;
}

async function findUserById(id) {
  if (isMongoActive()) {
    let query = { id };
    if (mongoose.isValidObjectId(id)) {
      query = { $or: [{ id }, { _id: id }] };
    }
    const user = await User.findOne(query);
    if (!user) return null;
    return {
      id: user.id || user._id.toString(),
      name: user.name,
      email: user.email,
      createdAt: user.createdAt
    };
  }

  const users = readJsonFile(USERS_FILE);
  const user = users.find(u => u.id === id);
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt
  };
}

async function countUsers() {
  if (isMongoActive()) {
    return await User.countDocuments();
  }
  const users = readJsonFile(USERS_FILE);
  return users.length;
}

async function createUser({ name, email, passwordHash }) {
  const normalized = email.trim().toLowerCase();
  const userId = 'user-' + crypto.randomUUID();

  if (isMongoActive()) {
    const user = new User({
      id: userId,
      name: name.trim(),
      email: normalized,
      passwordHash,
      createdAt: new Date()
    });
    await user.save();
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt
    };
  }

  const users = readJsonFile(USERS_FILE);
  const newUser = {
    id: userId,
    name: name.trim(),
    email: normalized,
    passwordHash,
    createdAt: new Date().toISOString()
  };
  users.push(newUser);
  writeJsonFile(USERS_FILE, users);
  return {
    id: newUser.id,
    name: newUser.name,
    email: newUser.email,
    createdAt: newUser.createdAt
  };
}

async function migrateLegacyTasks(targetUserId) {
  if (isMongoActive()) {
    const res = await Todo.updateMany(
      { $or: [{ userId: { $exists: false } }, { userId: 'unassigned' }] },
      { $set: { userId: targetUserId } }
    );
    if (res.modifiedCount > 0) {
      console.log(`[MONGODB MIGRATION] Assigned ${res.modifiedCount} legacy tasks to first user (${targetUserId})`);
    }
    return res.modifiedCount;
  }

  const todos = readJsonFile(TODOS_FILE);
  let count = 0;
  todos.forEach(t => {
    if (!t.userId || t.userId === 'unassigned') {
      t.userId = targetUserId;
      count++;
    }
  });
  if (count > 0) {
    writeJsonFile(TODOS_FILE, todos);
    console.log(`[JSON MIGRATION] Assigned ${count} legacy tasks to first user (${targetUserId})`);
  }
  return count;
}

// ======================== TODOS DATA ACCESS ======================== //

async function getTodos(userId, { status, category, priority, search, sort = 'createdAt', order = 'desc' } = {}) {
  if (isMongoActive()) {
    const query = { userId };

    if (status === 'active') {
      query.completed = false;
    } else if (status === 'completed') {
      query.completed = true;
    } else if (status === 'pinned') {
      query.pinned = true;
    }

    if (category && category !== 'all') {
      query.category = { $regex: new RegExp(`^${category.trim()}$`, 'i') };
    }

    if (priority && priority !== 'all') {
      query.priority = priority.toLowerCase();
    }

    if (search && search.trim()) {
      const q = search.trim();
      query.$or = [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { category: { $regex: q, $options: 'i' } }
      ];
    }

    const docs = await Todo.find(query).lean();
    const todos = docs.map(t => {
      const out = { ...t, id: t.id || t._id.toString() };
      delete out._id;
      delete out.__v;
      return out;
    });

    // In-memory sort to support priority weight and exact ordering
    todos.sort((a, b) => {
      if (a.pinned !== b.pinned) {
        return a.pinned ? -1 : 1;
      }

      let comparison = 0;
      if (sort === 'priority') {
        const pA = priorityOrder[a.priority] || 0;
        const pB = priorityOrder[b.priority] || 0;
        comparison = pA - pB;
      } else if (sort === 'dueDate') {
        const dateA = a.dueDate ? new Date(a.dueDate).getTime() : (order === 'asc' ? Infinity : -Infinity);
        const dateB = b.dueDate ? new Date(b.dueDate).getTime() : (order === 'asc' ? Infinity : -Infinity);
        comparison = dateA - dateB;
      } else if (sort === 'title') {
        comparison = (a.title || '').localeCompare(b.title || '');
      } else {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        comparison = dateA - dateB;
      }

      return order === 'asc' ? comparison : -comparison;
    });

    return todos;
  }

  // Fallback JSON mode
  let todos = readJsonFile(TODOS_FILE).filter(t => t.userId === userId);

  if (status === 'active') {
    todos = todos.filter(t => !t.completed);
  } else if (status === 'completed') {
    todos = todos.filter(t => t.completed);
  } else if (status === 'pinned') {
    todos = todos.filter(t => t.pinned);
  }

  if (category && category !== 'all') {
    todos = todos.filter(t => (t.category || '').toLowerCase() === category.toLowerCase());
  }

  if (priority && priority !== 'all') {
    todos = todos.filter(t => (t.priority || '').toLowerCase() === priority.toLowerCase());
  }

  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    todos = todos.filter(t =>
      (t.title && t.title.toLowerCase().includes(q)) ||
      (t.description && t.description.toLowerCase().includes(q)) ||
      (t.category && t.category.toLowerCase().includes(q))
    );
  }

  todos.sort((a, b) => {
    if (a.pinned !== b.pinned) {
      return a.pinned ? -1 : 1;
    }

    let comparison = 0;
    if (sort === 'priority') {
      const pA = priorityOrder[a.priority] || 0;
      const pB = priorityOrder[b.priority] || 0;
      comparison = pA - pB;
    } else if (sort === 'dueDate') {
      const dateA = a.dueDate ? new Date(a.dueDate).getTime() : (order === 'asc' ? Infinity : -Infinity);
      const dateB = b.dueDate ? new Date(b.dueDate).getTime() : (order === 'asc' ? Infinity : -Infinity);
      comparison = dateA - dateB;
    } else if (sort === 'title') {
      comparison = (a.title || '').localeCompare(b.title || '');
    } else {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      comparison = dateA - dateB;
    }

    return order === 'asc' ? comparison : -comparison;
  });

  return todos;
}

async function getTodoById(userId, todoId) {
  if (isMongoActive()) {
    let query = { userId, id: todoId };
    if (mongoose.isValidObjectId(todoId)) {
      query = { userId, $or: [{ id: todoId }, { _id: todoId }] };
    }
    const doc = await Todo.findOne(query).lean();
    if (!doc) return null;
    const out = { ...doc, id: doc.id || doc._id.toString() };
    delete out._id;
    delete out.__v;
    return out;
  }

  const todos = readJsonFile(TODOS_FILE);
  return todos.find(t => t.id === todoId && t.userId === userId) || null;
}

async function createTodo(userId, todoData) {
  const newId = 'task-' + crypto.randomUUID();
  const now = new Date().toISOString();

  const processedSubtasks = Array.isArray(todoData.subtasks)
    ? todoData.subtasks
        .filter(st => st && st.title && st.title.trim())
        .map(st => ({
          id: st.id || 'sub-' + crypto.randomUUID().slice(0, 8),
          title: st.title.trim(),
          completed: Boolean(st.completed)
        }))
    : [];

  const taskPayload = {
    id: newId,
    userId,
    title: todoData.title.trim(),
    description: (todoData.description || '').trim(),
    category: (todoData.category || 'Personal').trim(),
    priority: ['low', 'medium', 'high', 'urgent'].includes(todoData.priority) ? todoData.priority : 'medium',
    dueDate: todoData.dueDate || null,
    completed: false,
    pinned: Boolean(todoData.pinned),
    createdAt: now,
    updatedAt: now,
    subtasks: processedSubtasks
  };

  if (isMongoActive()) {
    const todo = new Todo(taskPayload);
    await todo.save();
    return todo.toJSON();
  }

  const todos = readJsonFile(TODOS_FILE);
  todos.unshift(taskPayload);
  writeJsonFile(TODOS_FILE, todos);
  return taskPayload;
}

async function updateTodo(userId, todoId, updates) {
  if (isMongoActive()) {
    let query = { userId, id: todoId };
    if (mongoose.isValidObjectId(todoId)) {
      query = { userId, $or: [{ id: todoId }, { _id: todoId }] };
    }
    const todo = await Todo.findOne(query);
    if (!todo) return null;

    if (updates.title !== undefined) todo.title = updates.title.trim();
    if (updates.description !== undefined) todo.description = updates.description.trim();
    if (updates.category !== undefined) todo.category = updates.category.trim();
    if (updates.priority !== undefined) todo.priority = updates.priority;
    if (updates.dueDate !== undefined) todo.dueDate = updates.dueDate || null;
    if (updates.completed !== undefined) todo.completed = Boolean(updates.completed);
    if (updates.pinned !== undefined) todo.pinned = Boolean(updates.pinned);
    if (Array.isArray(updates.subtasks)) {
      todo.subtasks = updates.subtasks.map(st => ({
        id: st.id || 'sub-' + crypto.randomUUID().slice(0, 8),
        title: (st.title || '').trim(),
        completed: Boolean(st.completed)
      }));
    }
    todo.updatedAt = new Date().toISOString();

    await todo.save();
    return todo.toJSON();
  }

  const todos = readJsonFile(TODOS_FILE);
  const index = todos.findIndex(t => t.id === todoId && t.userId === userId);
  if (index === -1) return null;

  const current = todos[index];
  const updated = {
    ...current,
    userId,
    title: updates.title !== undefined ? updates.title.trim() : current.title,
    description: updates.description !== undefined ? updates.description.trim() : current.description,
    category: updates.category !== undefined ? updates.category.trim() : current.category,
    priority: updates.priority !== undefined ? updates.priority : current.priority,
    dueDate: updates.dueDate !== undefined ? (updates.dueDate || null) : current.dueDate,
    completed: updates.completed !== undefined ? Boolean(updates.completed) : current.completed,
    pinned: updates.pinned !== undefined ? Boolean(updates.pinned) : current.pinned,
    updatedAt: new Date().toISOString()
  };

  if (Array.isArray(updates.subtasks)) {
    updated.subtasks = updates.subtasks.map(st => ({
      id: st.id || 'sub-' + crypto.randomUUID().slice(0, 8),
      title: (st.title || '').trim(),
      completed: Boolean(st.completed)
    }));
  }

  todos[index] = updated;
  writeJsonFile(TODOS_FILE, todos);
  return updated;
}

async function toggleTodo(userId, todoId) {
  if (isMongoActive()) {
    let query = { userId, id: todoId };
    if (mongoose.isValidObjectId(todoId)) {
      query = { userId, $or: [{ id: todoId }, { _id: todoId }] };
    }
    const todo = await Todo.findOne(query);
    if (!todo) return null;

    todo.completed = !todo.completed;
    todo.updatedAt = new Date().toISOString();

    if (todo.completed && Array.isArray(todo.subtasks)) {
      todo.subtasks.forEach(st => { st.completed = true; });
    }

    await todo.save();
    return todo.toJSON();
  }

  const todos = readJsonFile(TODOS_FILE);
  const index = todos.findIndex(t => t.id === todoId && t.userId === userId);
  if (index === -1) return null;

  const todo = todos[index];
  todo.completed = !todo.completed;
  todo.updatedAt = new Date().toISOString();

  if (todo.completed && Array.isArray(todo.subtasks)) {
    todo.subtasks = todo.subtasks.map(st => ({ ...st, completed: true }));
  }

  todos[index] = todo;
  writeJsonFile(TODOS_FILE, todos);
  return todo;
}

async function togglePin(userId, todoId) {
  if (isMongoActive()) {
    let query = { userId, id: todoId };
    if (mongoose.isValidObjectId(todoId)) {
      query = { userId, $or: [{ id: todoId }, { _id: todoId }] };
    }
    const todo = await Todo.findOne(query);
    if (!todo) return null;

    todo.pinned = !todo.pinned;
    todo.updatedAt = new Date().toISOString();
    await todo.save();
    return todo.toJSON();
  }

  const todos = readJsonFile(TODOS_FILE);
  const index = todos.findIndex(t => t.id === todoId && t.userId === userId);
  if (index === -1) return null;

  todos[index].pinned = !todos[index].pinned;
  todos[index].updatedAt = new Date().toISOString();
  writeJsonFile(TODOS_FILE, todos);
  return todos[index];
}

async function toggleSubtask(userId, todoId, subtaskId) {
  if (isMongoActive()) {
    let query = { userId, id: todoId };
    if (mongoose.isValidObjectId(todoId)) {
      query = { userId, $or: [{ id: todoId }, { _id: todoId }] };
    }
    const todo = await Todo.findOne(query);
    if (!todo || !Array.isArray(todo.subtasks)) return null;

    const subtask = todo.subtasks.find(st => st.id === subtaskId);
    if (!subtask) return null;

    subtask.completed = !subtask.completed;
    const allDone = todo.subtasks.length > 0 && todo.subtasks.every(st => st.completed);
    if (allDone) {
      todo.completed = true;
    } else if (!subtask.completed && todo.completed) {
      todo.completed = false;
    }

    todo.updatedAt = new Date().toISOString();
    await todo.save();
    return todo.toJSON();
  }

  const todos = readJsonFile(TODOS_FILE);
  const todo = todos.find(t => t.id === todoId && t.userId === userId);
  if (!todo || !Array.isArray(todo.subtasks)) return null;

  const subtask = todo.subtasks.find(st => st.id === subtaskId);
  if (!subtask) return null;

  subtask.completed = !subtask.completed;
  const allSubtasksDone = todo.subtasks.length > 0 && todo.subtasks.every(st => st.completed);
  if (allSubtasksDone) {
    todo.completed = true;
  } else if (!subtask.completed && todo.completed) {
    todo.completed = false;
  }

  todo.updatedAt = new Date().toISOString();
  writeJsonFile(TODOS_FILE, todos);
  return todo;
}

async function deleteTodo(userId, todoId) {
  if (isMongoActive()) {
    let query = { userId, id: todoId };
    if (mongoose.isValidObjectId(todoId)) {
      query = { userId, $or: [{ id: todoId }, { _id: todoId }] };
    }
    const res = await Todo.deleteOne(query);
    return res.deletedCount > 0;
  }

  let todos = readJsonFile(TODOS_FILE);
  const initialLen = todos.length;
  todos = todos.filter(t => !(t.id === todoId && t.userId === userId));
  if (todos.length === initialLen) return false;
  writeJsonFile(TODOS_FILE, todos);
  return true;
}

async function clearCompleted(userId) {
  if (isMongoActive()) {
    const res = await Todo.deleteMany({ userId, completed: true });
    return res.deletedCount || 0;
  }

  let todos = readJsonFile(TODOS_FILE);
  const beforeLen = todos.length;
  todos = todos.filter(t => !(t.completed && t.userId === userId));
  const removed = beforeLen - todos.length;
  writeJsonFile(TODOS_FILE, todos);
  return removed;
}

async function getStats(userId) {
  const todos = await getTodos(userId);
  const total = todos.length;
  const completed = todos.filter(t => t.completed).length;
  const active = total - completed;
  const pinned = todos.filter(t => t.pinned).length;

  const todayStr = new Date().toISOString().split('T')[0];
  let overdue = 0;
  let dueToday = 0;

  const priorityBreakdown = { urgent: 0, high: 0, medium: 0, low: 0 };
  const categoryBreakdown = {};

  todos.forEach(t => {
    if (!t.completed && t.dueDate) {
      if (t.dueDate < todayStr) overdue++;
      else if (t.dueDate === todayStr) dueToday++;
    }
    const p = (t.priority || 'medium').toLowerCase();
    if (priorityBreakdown[p] !== undefined) {
      priorityBreakdown[p]++;
    }
    const cat = t.category || 'Other';
    categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
  });

  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    total,
    completed,
    active,
    pinned,
    overdue,
    dueToday,
    completionRate,
    priorityBreakdown,
    categoryBreakdown
  };
}

async function getCategories(userId) {
  const todos = await getTodos(userId);
  const defaults = ['Work', 'Personal', 'Health', 'Study', 'Finance', 'Other'];
  const custom = todos.map(t => t.category).filter(Boolean);
  return Array.from(new Set([...defaults, ...custom]));
}

module.exports = {
  findUserByEmail,
  findUserById,
  countUsers,
  createUser,
  migrateLegacyTasks,
  getTodos,
  getTodoById,
  createTodo,
  updateTodo,
  toggleTodo,
  togglePin,
  toggleSubtask,
  deleteTodo,
  clearCompleted,
  getStats,
  getCategories
};
