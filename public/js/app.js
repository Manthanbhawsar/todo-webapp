/**
 * Zenith Tasks — Modern To-Do Application Frontend
 * Clean, reactive, responsive interface backed by Express REST API
 */

(function () {
  'use strict';

  // --- State ---
  const state = {
    todos: [],
    stats: null,
    categories: [],
    filter: {
      status: 'all',
      category: 'all',
      priority: 'all',
      search: '',
      sort: 'createdAt',
      order: 'desc'
    },
    modal: {
      isOpen: false,
      isEdit: false,
      taskId: null,
      subtasks: []
    },
    lastDeletedTask: null
  };

  // --- DOM Elements ---
  const el = {
    // Header & Theme
    currentDateDisplay: document.getElementById('currentDateDisplay'),
    searchInput: document.getElementById('searchInput'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    openCreateModalBtn: document.getElementById('openCreateModalBtn'),
    userProfilePill: document.getElementById('userProfilePill'),
    userInitialBadge: document.getElementById('userInitialBadge'),
    userDisplayName: document.getElementById('userDisplayName'),
    logoutBtn: document.getElementById('logoutBtn'),

    // Stats
    statTotal: document.getElementById('statTotal'),
    statCompleted: document.getElementById('statCompleted'),
    statPercent: document.getElementById('statPercent'),
    statActive: document.getElementById('statActive'),
    statOverdue: document.getElementById('statOverdue'),
    statDueToday: document.getElementById('statDueToday'),
    statPinnedCount: document.getElementById('statPinnedCount'),
    progressCircle: document.getElementById('progressCircle'),

    // Quick Add
    quickAddForm: document.getElementById('quickAddForm'),
    quickTitleInput: document.getElementById('quickTitleInput'),
    quickCategorySelect: document.getElementById('quickCategorySelect'),
    quickPrioritySelect: document.getElementById('quickPrioritySelect'),
    quickDueDateInput: document.getElementById('quickDueDateInput'),

    // Toolbar Tabs & Filters
    statusTabs: document.querySelectorAll('.status-tab'),
    tabCountAll: document.getElementById('tabCountAll'),
    tabCountActive: document.getElementById('tabCountActive'),
    tabCountCompleted: document.getElementById('tabCountCompleted'),
    tabCountPinned: document.getElementById('tabCountPinned'),
    categoryFilterContainer: document.getElementById('categoryFilterContainer'),
    priorityFilterContainer: document.getElementById('priorityFilterContainer'),
    sortSelect: document.getElementById('sortSelect'),
    clearCompletedBtn: document.getElementById('clearCompletedBtn'),

    // Task Lists & Feedback
    pinnedSection: document.getElementById('pinnedSection'),
    pinnedTaskList: document.getElementById('pinnedTaskList'),
    taskList: document.getElementById('taskList'),
    emptyState: document.getElementById('emptyState'),
    loadingState: document.getElementById('loadingState'),
    taskListHeading: document.getElementById('taskListHeading'),
    showingCountText: document.getElementById('showingCountText'),

    // Modal
    taskModal: document.getElementById('taskModal'),
    taskModalCard: document.getElementById('taskModalCard'),
    modalTitle: document.getElementById('modalTitle'),
    modalForm: document.getElementById('modalForm'),
    modalTaskId: document.getElementById('modalTaskId'),
    modalTitleInput: document.getElementById('modalTitleInput'),
    modalDescInput: document.getElementById('modalDescInput'),
    modalCategorySelect: document.getElementById('modalCategorySelect'),
    modalPrioritySelect: document.getElementById('modalPrioritySelect'),
    modalDueDateInput: document.getElementById('modalDueDateInput'),
    modalPinnedCheckbox: document.getElementById('modalPinnedCheckbox'),
    modalSubtaskList: document.getElementById('modalSubtaskList'),
    modalSubtaskCount: document.getElementById('modalSubtaskCount'),
    modalNewSubtaskInput: document.getElementById('modalNewSubtaskInput'),
    modalAddSubtaskBtn: document.getElementById('modalAddSubtaskBtn'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    cancelModalBtn: document.getElementById('cancelModalBtn'),
    saveModalBtn: document.getElementById('saveModalBtn'),

    // Toasts
    toastContainer: document.getElementById('toastContainer')
  };

  // --- Category Icons & Emojis ---
  const categoryIcons = {
    Work: '💼',
    Personal: '👤',
    Health: '💪',
    Study: '📚',
    Finance: '💰',
    Other: '✨'
  };

  // --- Initialization ---
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    renderCurrentDate();
    initEventListeners();
    fetchInitialData();
  });

  // --- Date Display ---
  function renderCurrentDate() {
    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const options = { weekday: 'long', month: 'short', day: 'numeric' };
    el.currentDateDisplay.textContent = `${greeting} • ${now.toLocaleDateString('en-US', options)}`;

    // Default quick add due date to today
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    el.quickDueDateInput.value = `${yyyy}-${mm}-${dd}`;
  }

  // --- Theme Controller ---
  function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  function toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    showToast(isDark ? 'Dark mode enabled' : 'Light mode enabled', 'info');
  }

  // --- Event Listeners ---
  function initEventListeners() {
    // Theme toggle
    el.themeToggleBtn.addEventListener('click', toggleTheme);

    // Quick Add Task
    el.quickAddForm.addEventListener('submit', handleQuickAdd);

    // Search Input (with debounce)
    let searchTimeout = null;
    el.searchInput.addEventListener('input', (e) => {
      const val = e.target.value;
      el.clearSearchBtn.classList.toggle('hidden', !val);
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        state.filter.search = val;
        loadTasks();
      }, 250);
    });

    el.clearSearchBtn.addEventListener('click', () => {
      el.searchInput.value = '';
      el.clearSearchBtn.classList.add('hidden');
      state.filter.search = '';
      loadTasks();
      el.searchInput.focus();
    });

    // Status Tabs
    el.statusTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        el.statusTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        state.filter.status = tab.dataset.status;
        loadTasks();
      });
    });

    // Category Filter Pills
    el.categoryFilterContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.cat-pill');
      if (!btn) return;
      el.categoryFilterContainer.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.filter.category = btn.dataset.category;
      loadTasks();
    });

    // Priority Filter Pills
    el.priorityFilterContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.prio-pill');
      if (!btn) return;
      el.priorityFilterContainer.querySelectorAll('.prio-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.filter.priority = btn.dataset.priority;
      loadTasks();
    });

    // Sort Dropdown
    el.sortSelect.addEventListener('change', (e) => {
      const [sort, order] = e.target.value.split('-');
      state.filter.sort = sort;
      state.filter.order = order;
      loadTasks();
    });

    // Clear Completed
    el.clearCompletedBtn.addEventListener('click', handleClearCompleted);

    // Open Modal for New Task
    el.openCreateModalBtn.addEventListener('click', () => openModal(false));

    // Modal Events
    el.closeModalBtn.addEventListener('click', closeModal);
    el.cancelModalBtn.addEventListener('click', closeModal);
    el.modalForm.addEventListener('submit', handleSaveModal);
    el.modalAddSubtaskBtn.addEventListener('click', handleAddModalSubtask);
    el.modalNewSubtaskInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddModalSubtask();
      }
    });

    // Backdrop click close modal
    el.taskModal.addEventListener('click', (e) => {
      if (e.target === el.taskModal) closeModal();
    });

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      // Escape closes modal or clears search
      if (e.key === 'Escape') {
        if (state.modal.isOpen) {
          closeModal();
        } else if (el.searchInput.value) {
          el.clearSearchBtn.click();
        }
      }
      // '/' focuses search when not in inputs
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        el.searchInput.focus();
      }
      // 'n' or 'N' opens new task modal
      if ((e.key === 'n' || e.key === 'N') && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        openModal(false);
      }
    });

    // Logout button
    if (el.logoutBtn) {
      el.logoutBtn.addEventListener('click', () => {
        TaskAPI.logout();
      });
    }
  }

  // --- User Profile ---
  function renderUserProfile(user) {
    const u = user || TaskAPI.getUser();
    if (u) {
      if (el.userDisplayName) {
        el.userDisplayName.textContent = u.name || u.email || 'User';
      }
      if (el.userInitialBadge) {
        const initial = (u.name ? u.name.charAt(0) : (u.email ? u.email.charAt(0) : 'U')).toUpperCase();
        el.userInitialBadge.textContent = initial;
      }
    }
  }

  async function loadUserProfile() {
    try {
      const res = await TaskAPI.getMe();
      if (res && res.data) {
        TaskAPI.setUser(res.data);
        renderUserProfile(res.data);
      }
    } catch (err) {
      console.warn('Failed to load user profile:', err);
    }
  }

  // --- Initial Data Fetch ---
  async function fetchInitialData() {
    renderUserProfile();
    showLoading(true);
    try {
      await Promise.all([loadUserProfile(), loadStats(), loadTasks()]);
    } catch (err) {
      showToast('Could not connect to Express API. Ensure server is running.', 'error');
    } finally {
      showLoading(false);
    }
  }

  // --- API Calls & Data Sync ---
  async function loadTasks() {
    try {
      const res = await TaskAPI.getTodos(state.filter);
      state.todos = res.data || [];
      renderTasks();
      updateShowingCount();
    } catch (err) {
      showToast(err.message || 'Error loading tasks', 'error');
    }
  }

  async function loadStats() {
    try {
      const res = await TaskAPI.getStats();
      state.stats = res.data;
      renderStats();
    } catch (err) {
      console.warn('Failed to load stats:', err);
    }
  }

  // --- Render Functions ---
  function renderStats() {
    if (!state.stats) return;
    const { total, completed, active, pinned, overdue, dueToday, completionRate } = state.stats;

    el.statTotal.textContent = total;
    el.statCompleted.textContent = completed;
    el.statPercent.textContent = `${completionRate}%`;
    el.statActive.textContent = active;
    el.statOverdue.textContent = overdue;
    el.statDueToday.textContent = dueToday;
    el.statPinnedCount.textContent = pinned;

    // Tab counts
    el.tabCountAll.textContent = total;
    el.tabCountActive.textContent = active;
    el.tabCountCompleted.textContent = completed;
    el.tabCountPinned.textContent = pinned;

    // Animate SVG circular progress
    if (el.progressCircle) {
      el.progressCircle.setAttribute('stroke-dasharray', `${completionRate}, 100`);
    }
  }

  function updateShowingCount() {
    const count = state.todos.length;
    el.showingCountText.textContent = `Showing ${count} task${count === 1 ? '' : 's'}`;
  }

  function renderTasks() {
    const { status } = state.filter;
    const todos = state.todos;

    // Handle Empty State
    if (!todos || todos.length === 0) {
      el.taskList.innerHTML = '';
      el.pinnedSection.classList.add('hidden');
      el.emptyState.classList.remove('hidden');
      return;
    }

    el.emptyState.classList.add('hidden');

    // Separate Pinned and Regular tasks when viewing 'all'
    if (status === 'all') {
      const pinned = todos.filter(t => t.pinned && !t.completed);
      const others = todos.filter(t => !(t.pinned && !t.completed));

      if (pinned.length > 0) {
        el.pinnedSection.classList.remove('hidden');
        el.pinnedTaskList.innerHTML = pinned.map(t => createTaskCardHtml(t, true)).join('');
      } else {
        el.pinnedSection.classList.add('hidden');
        el.pinnedTaskList.innerHTML = '';
      }

      el.taskList.innerHTML = others.map(t => createTaskCardHtml(t, false)).join('');
    } else {
      el.pinnedSection.classList.add('hidden');
      el.pinnedTaskList.innerHTML = '';
      el.taskList.innerHTML = todos.map(t => createTaskCardHtml(t, false)).join('');
    }

    attachTaskCardListeners();
  }

  function createTaskCardHtml(todo, isPinnedSection = false) {
    const isCompleted = todo.completed;
    const priority = (todo.priority || 'medium').toLowerCase();
    const category = todo.category || 'Other';

    // Due Date relative string & styling
    const dueDateMeta = formatDueDate(todo.dueDate, isCompleted);

    // Subtasks summary
    const hasSubtasks = Array.isArray(todo.subtasks) && todo.subtasks.length > 0;
    const completedSubCount = hasSubtasks ? todo.subtasks.filter(st => st.completed).length : 0;
    const totalSubCount = hasSubtasks ? todo.subtasks.length : 0;

    return `
      <div
        class="task-card ${isCompleted ? 'is-completed' : ''} bg-white dark:bg-neutral-900 border ${todo.pinned ? 'border-indigo-400/50 dark:border-indigo-500/40' : 'border-neutral-200/90 dark:border-neutral-800'} rounded-2xl p-3.5 sm:p-4 shadow-subtle dark:shadow-subtle-dark group animate-fade-in"
        data-id="${todo.id}"
      >
        <div class="flex items-start gap-3">
          
          <!-- Custom Minimal Checkbox -->
          <button
            type="button"
            class="custom-checkbox ${isCompleted ? 'checked' : ''} mt-0.5"
            aria-label="${isCompleted ? 'Mark as active' : 'Mark as completed'}"
            title="${isCompleted ? 'Mark as active' : 'Mark as completed'}"
            data-action="toggle"
          ></button>

          <!-- Main Content -->
          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-2">
              <h4 class="text-sm font-medium text-neutral-900 dark:text-neutral-100 ${isCompleted ? 'line-through text-neutral-400 dark:text-neutral-500' : ''} break-words leading-snug">
                ${escapeHtml(todo.title)}
              </h4>

              <!-- Actions Toolbar (Visible on hover on desktop, always on touch) -->
              <div class="flex items-center gap-0.5 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <!-- Pin Button -->
                <button
                  type="button"
                  data-action="pin"
                  aria-label="${todo.pinned ? 'Unpin task' : 'Pin task to top'}"
                  title="${todo.pinned ? 'Unpin task' : 'Pin task to top'}"
                  class="p-1.5 rounded-lg text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition ${todo.pinned ? 'text-indigo-600 dark:text-indigo-400' : ''}"
                >
                  <svg class="w-3.5 h-3.5 ${todo.pinned ? 'fill-current' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
                </button>

                <!-- Edit Button -->
                <button
                  type="button"
                  data-action="edit"
                  aria-label="Edit task"
                  title="Edit task"
                  class="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
                >
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>

                <!-- Delete Button -->
                <button
                  type="button"
                  data-action="delete"
                  aria-label="Delete task"
                  title="Delete task"
                  class="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
                >
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              </div>
            </div>

            <!-- Description (if present) -->
            ${todo.description ? `
              <p class="text-sm text-neutral-600 dark:text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
                ${escapeHtml(todo.description)}
              </p>
            ` : ''}

            <!-- Badges & Meta Row -->
            <div class="flex flex-wrap items-center gap-1.5 mt-2.5 text-xs">
              
              <!-- Category Badge -->
              <span class="badge-minimal">
                ${escapeHtml(category)}
              </span>

              <!-- Priority Badge -->
              <span class="badge-minimal ${priority === 'urgent' || priority === 'high' ? 'badge-minimal-indigo' : ''} capitalize">
                ${priority}
              </span>

              <!-- Due Date Badge -->
              ${dueDateMeta ? `
                <span class="badge-minimal ${dueDateMeta.cssClass}">
                  ${dueDateMeta.label}
                </span>
              ` : ''}

              <!-- Subtasks Progress Button -->
              ${hasSubtasks ? `
                <button
                  type="button"
                  data-action="toggle-subtasks"
                  class="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200/70 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-400 text-[10px] font-medium transition"
                >
                  <span>${completedSubCount}/${totalSubCount} subtasks</span>
                </button>
              ` : ''}

            </div>

            <!-- Subtasks Accordion Content -->
            ${hasSubtasks ? `
              <div class="subtasks-container hidden mt-2.5 pt-2.5 border-t border-neutral-100 dark:border-neutral-800 space-y-1">
                ${todo.subtasks.map(st => `
                  <label class="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300 py-0.5 hover:text-neutral-900 dark:hover:text-white cursor-pointer">
                    <input
                      type="checkbox"
                      class="subtask-checkbox w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 dark:bg-neutral-800 dark:border-neutral-700"
                      data-subtask-id="${st.id}"
                      ${st.completed ? 'checked' : ''}
                    >
                    <span class="${st.completed ? 'line-through text-neutral-400 dark:text-neutral-500' : ''}">${escapeHtml(st.title)}</span>
                  </label>
                `).join('')}
              </div>
            ` : ''}

          </div>

        </div>
      </div>
    `;
  }

  function attachTaskCardListeners() {
    document.querySelectorAll('.task-card').forEach(card => {
      const id = card.dataset.id;

      card.addEventListener('click', async (e) => {
        const actionBtn = e.target.closest('[data-action]');
        const subtaskCheck = e.target.closest('.subtask-checkbox');

        // Handle subtask checkbox toggle
        if (subtaskCheck) {
          const subtaskId = subtaskCheck.dataset.subtaskId;
          await handleToggleSubtask(id, subtaskId);
          return;
        }

        if (!actionBtn) return;
        const action = actionBtn.dataset.action;

        if (action === 'toggle') {
          handleToggleTask(id, card);
        } else if (action === 'pin') {
          handleTogglePin(id);
        } else if (action === 'edit') {
          handleOpenEditModal(id);
        } else if (action === 'delete') {
          handleDeleteTask(id);
        } else if (action === 'toggle-subtasks') {
          const container = card.querySelector('.subtasks-container');
          if (container) {
            container.classList.toggle('hidden');
          }
        }
      });
    });
  }

  // --- Task Action Handlers ---
  async function handleQuickAdd(e) {
    e.preventDefault();
    const title = el.quickTitleInput.value.trim();
    if (!title) return;

    const category = el.quickCategorySelect.value;
    const priority = el.quickPrioritySelect.value;
    const dueDate = el.quickDueDateInput.value || null;

    try {
      const res = await TaskAPI.createTodo({
        title,
        category,
        priority,
        dueDate,
        pinned: false,
        subtasks: []
      });

      el.quickTitleInput.value = '';
      showToast('Task added successfully', 'success');
      
      // Update data
      await Promise.all([loadStats(), loadTasks()]);
      el.quickTitleInput.focus();
    } catch (err) {
      showToast(err.message || 'Failed to create task', 'error');
    }
  }

  async function handleToggleTask(id, cardElement) {
    const checkBtn = cardElement ? cardElement.querySelector('.custom-checkbox') : null;
    if (checkBtn) {
      checkBtn.classList.remove('pop');
      void checkBtn.offsetWidth;
      checkBtn.classList.add('pop');
    }
    try {
      const res = await TaskAPI.toggleTodo(id);
      const isCompleted = res.data.completed;

      // Celebrate with subtle indigo-accented confetti if completed!
      if (isCompleted && typeof confetti === 'function') {
        const rect = cardElement ? cardElement.getBoundingClientRect() : null;
        if (rect) {
          const x = (rect.left + rect.width / 2) / window.innerWidth;
          const y = (rect.top + rect.height / 2) / window.innerHeight;
          confetti({
            particleCount: 28,
            spread: 50,
            colors: ['#4F46E5', '#6366F1', '#A5B4FC', '#C7D2FE'],
            origin: { x, y }
          });
        }
      }

      showToast(isCompleted ? 'Task completed' : 'Task marked active', 'success');
      await Promise.all([loadStats(), loadTasks()]);
    } catch (err) {
      showToast(err.message || 'Failed to update task', 'error');
    }
  }

  async function handleTogglePin(id) {
    try {
      const res = await TaskAPI.togglePin(id);
      showToast(res.data.pinned ? 'Task pinned to top 📌' : 'Task unpinned', 'info');
      await Promise.all([loadStats(), loadTasks()]);
    } catch (err) {
      showToast(err.message || 'Failed to update pin', 'error');
    }
  }

  async function handleToggleSubtask(taskId, subtaskId) {
    try {
      await TaskAPI.toggleSubtask(taskId, subtaskId);
      await Promise.all([loadStats(), loadTasks()]);
    } catch (err) {
      showToast(err.message || 'Failed to update subtask', 'error');
    }
  }

  async function handleDeleteTask(id) {
    const taskToDelete = state.todos.find(t => t.id === id);
    const cardElement = document.querySelector(`.task-card[data-id="${id}"]`);
    if (cardElement) {
      cardElement.classList.add('task-leave');
      await new Promise(r => setTimeout(r, 150));
    }
    try {
      await TaskAPI.deleteTodo(id);
      state.lastDeletedTask = taskToDelete;

      showToast(
        'Task deleted',
        'info',
        taskToDelete ? {
          actionLabel: 'Undo',
          onAction: () => handleUndoDelete()
        } : null
      );

      await Promise.all([loadStats(), loadTasks()]);
    } catch (err) {
      showToast(err.message || 'Failed to delete task', 'error');
    }
  }

  async function handleUndoDelete() {
    if (!state.lastDeletedTask) return;
    try {
      await TaskAPI.createTodo(state.lastDeletedTask);
      state.lastDeletedTask = null;
      showToast('Task restored!', 'success');
      await Promise.all([loadStats(), loadTasks()]);
    } catch (err) {
      showToast('Failed to undo deletion', 'error');
    }
  }

  async function handleClearCompleted() {
    const completedCount = state.todos.filter(t => t.completed).length;
    if (completedCount === 0) {
      showToast('No completed tasks to clear', 'info');
      return;
    }

    if (!confirm(`Are you sure you want to clear all ${completedCount} completed tasks?`)) {
      return;
    }

    try {
      const res = await TaskAPI.clearCompleted();
      showToast(res.message || 'Cleared completed tasks', 'success');
      await Promise.all([loadStats(), loadTasks()]);
    } catch (err) {
      showToast(err.message || 'Failed to clear completed tasks', 'error');
    }
  }

  // --- Modal Logic (Create & Edit) ---
  function openModal(isEdit = false, task = null) {
    state.modal.isOpen = true;
    state.modal.isEdit = isEdit;
    state.modal.taskId = isEdit && task ? task.id : null;
    state.modal.subtasks = isEdit && task && Array.isArray(task.subtasks)
      ? JSON.parse(JSON.stringify(task.subtasks))
      : [];

    el.modalTitle.textContent = isEdit ? 'Edit Task' : 'Create New Task';
    el.modalTaskId.value = isEdit && task ? task.id : '';
    el.modalTitleInput.value = isEdit && task ? task.title : '';
    el.modalDescInput.value = isEdit && task ? (task.description || '') : '';
    el.modalCategorySelect.value = isEdit && task ? task.category : 'Personal';
    el.modalPrioritySelect.value = isEdit && task ? task.priority : 'medium';
    el.modalDueDateInput.value = isEdit && task ? (task.dueDate || '') : '';
    el.modalPinnedCheckbox.checked = isEdit && task ? Boolean(task.pinned) : false;
    el.modalNewSubtaskInput.value = '';

    renderModalSubtasks();

    // Show modal with animation
    el.taskModal.classList.remove('hidden');
    setTimeout(() => {
      el.taskModal.classList.remove('opacity-0');
      el.taskModalCard.classList.remove('scale-95');
      el.taskModalCard.classList.add('scale-100');
      el.modalTitleInput.focus();
    }, 10);
  }

  function closeModal() {
    el.taskModalCard.classList.remove('scale-100');
    el.taskModalCard.classList.add('scale-95');
    el.taskModal.classList.add('opacity-0');

    setTimeout(() => {
      el.taskModal.classList.add('hidden');
      state.modal.isOpen = false;
      state.modal.taskId = null;
      state.modal.subtasks = [];
    }, 200);
  }

  function handleOpenEditModal(id) {
    const task = state.todos.find(t => t.id === id);
    if (!task) return;
    openModal(true, task);
  }

  function handleAddModalSubtask() {
    const text = el.modalNewSubtaskInput.value.trim();
    if (!text) return;

    state.modal.subtasks.push({
      id: 'sub-' + Math.random().toString(36).slice(2, 9),
      title: text,
      completed: false
    });

    el.modalNewSubtaskInput.value = '';
    renderModalSubtasks();
    el.modalNewSubtaskInput.focus();
  }

  function renderModalSubtasks() {
    const list = state.modal.subtasks;
    el.modalSubtaskCount.textContent = `${list.length} item${list.length === 1 ? '' : 's'}`;

    if (list.length === 0) {
      el.modalSubtaskList.innerHTML = '<p class="text-xs text-slate-400 italic">No subtasks yet.</p>';
      return;
    }

    el.modalSubtaskList.innerHTML = list.map((st, idx) => `
      <div class="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-xs">
        <label class="flex items-center gap-2 flex-1 cursor-pointer">
          <input
            type="checkbox"
            ${st.completed ? 'checked' : ''}
            data-index="${idx}"
            class="modal-subtask-check w-3.5 h-3.5 rounded text-brand-600 focus:ring-brand-500 dark:bg-slate-700"
          >
          <span class="${st.completed ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-200'}">${escapeHtml(st.title)}</span>
        </label>
        <button
          type="button"
          data-remove-index="${idx}"
          class="modal-subtask-remove text-slate-400 hover:text-rose-500 p-1"
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    `).join('');

    // Attach listeners inside modal subtask list
    el.modalSubtaskList.querySelectorAll('.modal-subtask-check').forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = e.target.dataset.index;
        state.modal.subtasks[idx].completed = e.target.checked;
        renderModalSubtasks();
      });
    });

    el.modalSubtaskList.querySelectorAll('.modal-subtask-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = btn.dataset.removeIndex;
        state.modal.subtasks.splice(idx, 1);
        renderModalSubtasks();
      });
    });
  }

  async function handleSaveModal(e) {
    if (e && e.preventDefault) e.preventDefault();
    const title = el.modalTitleInput.value.trim();
    if (!title) {
      el.modalTitleInput.focus();
      showToast('Title is required', 'warning');
      return;
    }

    const payload = {
      title,
      description: el.modalDescInput.value.trim(),
      category: el.modalCategorySelect.value,
      priority: el.modalPrioritySelect.value,
      dueDate: el.modalDueDateInput.value || null,
      pinned: el.modalPinnedCheckbox.checked,
      subtasks: state.modal.subtasks
    };

    try {
      if (state.modal.isEdit && state.modal.taskId) {
        await TaskAPI.updateTodo(state.modal.taskId, payload);
        showToast('Task updated successfully', 'success');
      } else {
        await TaskAPI.createTodo(payload);
        showToast('Task created successfully', 'success');
      }

      closeModal();
      await Promise.all([loadStats(), loadTasks()]);
    } catch (err) {
      showToast(err.message || 'Failed to save task', 'error');
    }
  }

  // --- Helper Functions ---
  function formatDueDate(dueDateStr, isCompleted) {
    if (!dueDateStr) return null;

    const todayStr = new Date().toISOString().split('T')[0];
    const dueTime = new Date(dueDateStr + 'T00:00:00');
    const todayTime = new Date(todayStr + 'T00:00:00');
    const diffDays = Math.round((dueTime - todayTime) / (1000 * 60 * 60 * 24));

    if (isCompleted) {
      return {
        label: dueTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        cssClass: 'text-neutral-400'
      };
    }

    if (diffDays < 0) {
      const days = Math.abs(diffDays);
      return {
        label: `Overdue (${days}d)`,
        cssClass: 'text-neutral-800 dark:text-neutral-200 font-medium'
      };
    } else if (diffDays === 0) {
      return {
        label: 'Due Today',
        cssClass: 'badge-minimal-indigo font-medium'
      };
    } else if (diffDays === 1) {
      return {
        label: 'Tomorrow',
        cssClass: 'text-neutral-600 dark:text-neutral-300'
      };
    } else {
      return {
        label: dueTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        cssClass: 'text-neutral-500 dark:text-neutral-400'
      };
    }
  }

  function showLoading(show) {
    el.loadingState.classList.toggle('hidden', !show);
  }

  function escapeHtml(str) {
    if (!str) return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return String(str).replace(/[&<>"']/g, m => map[m]);
  }

  // --- Toast Notification Engine ---
  function showToast(message, type = 'info', action = null) {
    const toast = document.createElement('div');
    toast.className = 'toast-enter pointer-events-auto flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl shadow-lg text-xs font-medium max-w-sm border transition-all bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-neutral-800 dark:border-neutral-200';

    let actionBtnHtml = '';
    if (action && action.actionLabel) {
      actionBtnHtml = `<button class="toast-action-btn underline text-indigo-400 dark:text-indigo-600 hover:opacity-80 ml-2 font-semibold">${escapeHtml(action.actionLabel)}</button>`;
    }

    toast.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
        <span>${escapeHtml(message)}</span>
      </div>
      ${actionBtnHtml}
    `;

    if (action && action.onAction) {
      const btn = toast.querySelector('.toast-action-btn');
      if (btn) {
        btn.addEventListener('click', () => {
          action.onAction();
          removeToast(toast);
        });
      }
    }

    el.toastContainer.appendChild(toast);

    // Auto remove after 3.2 seconds
    setTimeout(() => {
      removeToast(toast);
    }, 3200);
  }

  function removeToast(toast) {
    if (!toast || !toast.parentNode) return;
    toast.classList.remove('toast-enter');
    toast.classList.add('toast-leave');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 200);
  }

})();
