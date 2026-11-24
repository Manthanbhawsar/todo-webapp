/**
 * Zenith Tasks — REST API Client with JWT Authentication
 * Clean abstraction over the Express REST & Auth endpoints
 */

const API_BASE = '/api';
const TOKEN_KEY = 'zenith_token';
const USER_KEY = 'zenith_user';

const TaskAPI = {
  /**
   * Token & User Storage Helpers
   */
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken(token) {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  },

  getUser() {
    try {
      const u = localStorage.getItem(USER_KEY);
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  },

  setUser(user) {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  },

  clearAuth() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  isAuthenticated() {
    return Boolean(this.getToken());
  },

  /**
   * Helper to perform fetch, attach auth header, and handle json response
   */
  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    const token = this.getToken();
    if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers
      }
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (response.status === 401) {
        this.clearAuth();
        // Redirect to login.html if not already on login page
        if (!window.location.pathname.endsWith('login.html')) {
          window.location.replace('/login.html');
        }
        throw new Error(data.error || 'Session expired. Please log in again.');
      }

      if (!response.ok) {
        throw new Error(data.error || `Request failed with status ${response.status}`);
      }

      return data;
    } catch (err) {
      console.error(`API Error on [${config.method || 'GET'}] ${url}:`, err);
      throw err;
    }
  },

  // ======================== AUTH API ======================== //

  /**
   * POST /api/auth/signup
   */
  async signup({ name, email, password }) {
    const data = await this.request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });
    if (data.token) {
      this.setToken(data.token);
      this.setUser(data.user);
    }
    return data;
  },

  /**
   * POST /api/auth/login
   */
  async login({ email, password }) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (data.token) {
      this.setToken(data.token);
      this.setUser(data.user);
    }
    return data;
  },

  /**
   * GET /api/auth/me
   */
  async getMe() {
    const data = await this.request('/auth/me');
    if (data.user) {
      this.setUser(data.user);
    }
    return data;
  },

  /**
   * Client-side logout
   */
  logout() {
    this.clearAuth();
    window.location.replace('/login.html');
  },

  // ======================== TODOS API ======================== //

  /**
   * GET /api/todos with query params
   */
  async getTodos({ status = 'all', category = 'all', priority = 'all', search = '', sort = 'createdAt', order = 'desc' } = {}) {
    const params = new URLSearchParams();
    if (status && status !== 'all') params.append('status', status);
    if (category && category !== 'all') params.append('category', category);
    if (priority && priority !== 'all') params.append('priority', priority);
    if (search && search.trim()) params.append('search', search.trim());
    if (sort) params.append('sort', sort);
    if (order) params.append('order', order);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/todos${queryString}`);
  },

  /**
   * GET /api/todos/:id
   */
  async getTodo(id) {
    return this.request(`/todos/${id}`);
  },

  /**
   * POST /api/todos
   */
  async createTodo(todoData) {
    return this.request('/todos', {
      method: 'POST',
      body: JSON.stringify(todoData)
    });
  },

  /**
   * PUT /api/todos/:id
   */
  async updateTodo(id, todoData) {
    return this.request(`/todos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(todoData)
    });
  },

  /**
   * PATCH /api/todos/:id/toggle
   */
  async toggleTodo(id) {
    return this.request(`/todos/${id}/toggle`, {
      method: 'PATCH'
    });
  },

  /**
   * PATCH /api/todos/:id/pin
   */
  async togglePin(id) {
    return this.request(`/todos/${id}/pin`, {
      method: 'PATCH'
    });
  },

  /**
   * PATCH /api/todos/:id/subtasks/:subtaskId
   */
  async toggleSubtask(id, subtaskId) {
    return this.request(`/todos/${id}/subtasks/${subtaskId}`, {
      method: 'PATCH'
    });
  },

  /**
   * DELETE /api/todos/:id
   */
  async deleteTodo(id) {
    return this.request(`/todos/${id}`, {
      method: 'DELETE'
    });
  },

  /**
   * POST /api/todos/clear-completed
   */
  async clearCompleted() {
    return this.request('/todos/clear-completed', {
      method: 'POST'
    });
  },

  /**
   * GET /api/stats
   */
  async getStats() {
    return this.request('/stats');
  },

  /**
   * GET /api/categories
   */
  async getCategories() {
    return this.request('/categories');
  }
};

window.TaskAPI = TaskAPI;
