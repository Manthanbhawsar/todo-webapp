require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { connectDB, isMongoActive } = require('./db');
const dataStore = require('./services/dataStore');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'zenith_fallback_secret_key_2026';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Simple request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.originalUrl.startsWith('/api')) {
      console.log(`[${req.method}] ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// In-Memory Rate Limiter for Auth endpoints
const rateLimitMap = new Map();
function authRateLimiter(limit = 20, windowMs = 15 * 60 * 1000) {
  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const key = `${ip}:${req.baseUrl || ''}${req.path}`;
    const now = Date.now();
    let record = rateLimitMap.get(key);

    if (!record || now - record.startTime > windowMs) {
      record = { count: 1, startTime: now };
      rateLimitMap.set(key, record);
      return next();
    }

    record.count++;
    if (record.count > limit) {
      return res.status(429).json({
        success: false,
        error: 'Too many authentication attempts. Please try again later.'
      });
    }

    next();
  };
}

// Authentication Middleware
async function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await dataStore.findUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    req.user = { id: user.id, email: user.email, name: user.name };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired session' });
  }
}

// Email format validator
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ======================== AUTHENTICATION ROUTES ======================== //

/**
 * POST /api/auth/signup
 * Register a new user
 */
app.post('/api/auth/signup', authRateLimiter(20), async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ success: false, error: 'Please enter a valid email address' });
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters long' });
    }

    const existingUser = await dataStore.findUserByEmail(normalizedEmail);
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const currentCount = await dataStore.countUsers();
    const isFirstUser = currentCount === 0;

    const newUser = await dataStore.createUser({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash
    });

    // Migration: Assign any pre-existing unassigned tasks to the first registered user
    if (isFirstUser) {
      await dataStore.migrateLegacyTasks(newUser.id);
    }

    const token = jwt.sign(
      { userId: newUser.id, email: newUser.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email
      }
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ success: false, error: 'Registration failed. Please try again.' });
  }
});

/**
 * POST /api/auth/login
 * Authenticate existing user
 */
app.post('/api/auth/login', authRateLimiter(20), async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !email.trim() || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await dataStore.findUserByEmail(normalizedEmail);

    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Logged in successfully',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Login failed. Please try again.' });
  }
});

/**
 * GET /api/auth/me
 * Return currently authenticated user
 */
app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

// ======================== PROTECTED TODO ROUTES ======================== //

// Apply auth middleware to all remaining /api routes
app.use('/api/todos', authMiddleware);
app.use('/api/stats', authMiddleware);
app.use('/api/categories', authMiddleware);

/**
 * GET /api/todos
 * Query params: status (all/active/completed/pinned), category, priority, search, sort, order
 */
app.get('/api/todos', async (req, res) => {
  try {
    const todos = await dataStore.getTodos(req.user.id, req.query);
    res.json({
      success: true,
      count: todos.length,
      data: todos
    });
  } catch (err) {
    console.error('Error getting todos:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve tasks' });
  }
});

/**
 * GET /api/stats
 * Overview analytics for user's dashboard cards and progress ring
 */
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await dataStore.getStats(req.user.id);
    res.json({
      success: true,
      data: stats
    });
  } catch (err) {
    console.error('Error getting stats:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve stats' });
  }
});

/**
 * GET /api/categories
 * Returns existing categories for current user
 */
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await dataStore.getCategories(req.user.id);
    res.json({ success: true, data: categories });
  } catch (err) {
    console.error('Error getting categories:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve categories' });
  }
});

/**
 * GET /api/todos/:id
 * Retrieve single todo item for current user
 */
app.get('/api/todos/:id', async (req, res) => {
  try {
    const todo = await dataStore.getTodoById(req.user.id, req.params.id);
    if (!todo) {
      return res.status(404).json({ success: false, error: 'Todo not found' });
    }
    res.json({ success: true, data: todo });
  } catch (err) {
    console.error('Error getting todo by id:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve task' });
  }
});

/**
 * POST /api/todos
 * Create a new todo assigned to current user
 */
app.post('/api/todos', async (req, res) => {
  try {
    const { title, description, category, priority, dueDate, subtasks, pinned } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }

    const newTodo = await dataStore.createTodo(req.user.id, {
      title,
      description,
      category,
      priority,
      dueDate,
      subtasks,
      pinned
    });

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: newTodo
    });
  } catch (err) {
    console.error('Error creating todo:', err);
    res.status(500).json({ success: false, error: 'Failed to create task' });
  }
});

/**
 * PUT /api/todos/:id
 * Full/partial update of todo belonging to user
 */
app.put('/api/todos/:id', async (req, res) => {
  try {
    const { title } = req.body;
    if (title !== undefined && (!title || !title.trim())) {
      return res.status(400).json({ success: false, error: 'Title cannot be empty' });
    }

    const updated = await dataStore.updateTodo(req.user.id, req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Todo not found' });
    }

    res.json({
      success: true,
      message: 'Task updated successfully',
      data: updated
    });
  } catch (err) {
    console.error('Error updating todo:', err);
    res.status(500).json({ success: false, error: 'Failed to update task' });
  }
});

/**
 * PATCH /api/todos/:id/toggle
 * Toggle completion status for user's task
 */
app.patch('/api/todos/:id/toggle', async (req, res) => {
  try {
    const todo = await dataStore.toggleTodo(req.user.id, req.params.id);
    if (!todo) {
      return res.status(404).json({ success: false, error: 'Todo not found' });
    }

    res.json({
      success: true,
      message: `Task marked as ${todo.completed ? 'completed' : 'active'}`,
      data: todo
    });
  } catch (err) {
    console.error('Error toggling todo:', err);
    res.status(500).json({ success: false, error: 'Failed to toggle task' });
  }
});

/**
 * PATCH /api/todos/:id/pin
 * Toggle pinned status for user's task
 */
app.patch('/api/todos/:id/pin', async (req, res) => {
  try {
    const todo = await dataStore.togglePin(req.user.id, req.params.id);
    if (!todo) {
      return res.status(404).json({ success: false, error: 'Todo not found' });
    }

    res.json({
      success: true,
      message: `Task ${todo.pinned ? 'pinned' : 'unpinned'}`,
      data: todo
    });
  } catch (err) {
    console.error('Error pinning todo:', err);
    res.status(500).json({ success: false, error: 'Failed to pin task' });
  }
});

/**
 * PATCH /api/todos/:id/subtasks/:subtaskId
 * Toggle subtask completion for user's task
 */
app.patch('/api/todos/:id/subtasks/:subtaskId', async (req, res) => {
  try {
    const todo = await dataStore.toggleSubtask(req.user.id, req.params.id, req.params.subtaskId);
    if (!todo) {
      return res.status(404).json({ success: false, error: 'Todo or subtask not found' });
    }

    res.json({
      success: true,
      message: 'Subtask updated',
      data: todo
    });
  } catch (err) {
    console.error('Error toggling subtask:', err);
    res.status(500).json({ success: false, error: 'Failed to toggle subtask' });
  }
});

/**
 * DELETE /api/todos/:id
 * Delete a user's task
 */
app.delete('/api/todos/:id', async (req, res) => {
  try {
    const success = await dataStore.deleteTodo(req.user.id, req.params.id);
    if (!success) {
      return res.status(404).json({ success: false, error: 'Todo not found' });
    }

    res.json({
      success: true,
      message: 'Task deleted successfully',
      id: req.params.id
    });
  } catch (err) {
    console.error('Error deleting todo:', err);
    res.status(500).json({ success: false, error: 'Failed to delete task' });
  }
});

/**
 * POST /api/todos/clear-completed
 * Clear all completed tasks belonging to user
 */
app.post('/api/todos/clear-completed', async (req, res) => {
  try {
    const removedCount = await dataStore.clearCompleted(req.user.id);
    res.json({
      success: true,
      message: `Cleared ${removedCount} completed task(s)`,
      removedCount
    });
  } catch (err) {
    console.error('Error clearing completed todos:', err);
    res.status(500).json({ success: false, error: 'Failed to clear completed tasks' });
  }
});

// Database status endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: isMongoActive() ? 'mongodb' : 'file-fallback',
    timestamp: new Date().toISOString()
  });
});

// 404 Handler for undefined API routes
app.all('/api/*', (req, res) => {
  res.status(404).json({ success: false, error: 'API endpoint not found' });
});

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error'
  });
});

// Start Server and connect to MongoDB
async function startServer() {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`🚀 Zenith Server running on http://localhost:${PORT}`);
    console.log(`📡 Storage: ${isMongoActive() ? '🍃 MongoDB' : '📁 Local JSON (fallback)'}`);
    console.log(`📡 REST API available at http://localhost:${PORT}/api/todos`);
    console.log(`🔐 Auth API available at http://localhost:${PORT}/api/auth`);
    console.log(`===============================================`);
  });
}

startServer();
