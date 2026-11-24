const mongoose = require('mongoose');
const crypto = require('crypto');

const subtaskSchema = new mongoose.Schema({
  id: {
    type: String,
    default: () => 'sub-' + crypto.randomUUID().slice(0, 8)
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  completed: {
    type: Boolean,
    default: false
  }
}, { _id: false });

const todoSchema = new mongoose.Schema({
  id: {
    type: String,
    unique: true,
    index: true,
    default: () => 'task-' + crypto.randomUUID()
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: '',
    trim: true
  },
  category: {
    type: String,
    default: 'Work',
    trim: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  dueDate: {
    type: String,
    default: null
  },
  completed: {
    type: Boolean,
    default: false,
    index: true
  },
  pinned: {
    type: Boolean,
    default: false,
    index: true
  },
  subtasks: {
    type: [subtaskSchema],
    default: []
  },
  createdAt: {
    type: String,
    default: () => new Date().toISOString()
  },
  updatedAt: {
    type: String,
    default: () => new Date().toISOString()
  }
}, {
  timestamps: false
});

todoSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret.id || ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Todo', todoSchema);
