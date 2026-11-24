# ⚡ Zenith Tasks — Modern To-Do Web Application

A clean, modern, and highly responsive to-do application powered by a **Node.js + Express** server with full **RESTful API endpoints** and a visually stunning frontend.

---

## 🌟 Key Features

### 🎨 Visually Stunning Frontend
- **Design System**: Modern dark & light mode with ambient background glow, glassmorphic cards (`backdrop-filter: blur`), and typography using *Plus Jakarta Sans* & *Inter*.
- **Interactive Dashboard**: Real-time analytics counter cards:
  - Total Tasks counter & pinned stats
  - Completed Tasks with an **animated circular SVG progress ring**
  - In Progress / Pending tasks with live activity pulse
  - Overdue & Due Today indicators
- **Quick-Add Bar**: Inline lightning task creation with category picker, priority flag, and date selector — enter tasks with `Enter` in seconds.
- **Smart Organization & Filtering**:
  - Filter by status: `All`, `Active`, `Completed`, `Pinned`
  - Filter by Category pills: `Work`, `Personal`, `Health`, `Study`, `Finance`, `Other`
  - Filter by Priority: `Urgent`, `High`, `Medium`, `Low`
  - Sorting: By Newest, Oldest, Due Date soonest, Priority level, or Title A-Z
- **Task Cards & Micro-interactions**:
  - Custom bouncy circular checkmarks
  - Pinned tasks elevated to an attention focus section
  - Color-coded priority badges with subtle glow
  - Relative due date badges (*"Due Today"*, *"Tomorrow"*, *"Overdue by 2d"*)
  - Interactive Subtasks Checklist accordion with progress indicators
  - **Confetti Celebration**: Canvas-confetti explosion when completing tasks!
- **Task Modal**: Comprehensive modal for detailed editing, description notes, and subtask management.
- **Toast Notifications**: Floating feedback toasts with one-click **Undo** for accidental task deletions.
- **Keyboard Shortcuts**:
  - <kbd>/</kbd> to quickly jump to the search bar
  - <kbd>N</kbd> to open the New Task modal
  - <kbd>Esc</kbd> to dismiss search or close modal

---

### 🚀 Node.js Express REST API
- Clean REST architecture with JSON request/response handling.
- Input validation and error responses.
- Safe local persistence in `data/todos.json`.
- Dynamic query parameters for filtering and sorting on the server.

---

## 📡 REST API Reference

| Method | Endpoint | Description | Query / Body Parameters |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/todos` | List all tasks | `status`, `category`, `priority`, `search`, `sort`, `order` |
| **GET** | `/api/todos/:id` | Get task by ID | — |
| **POST** | `/api/todos` | Create a new task | `{ title, description, category, priority, dueDate, pinned, subtasks }` |
| **PUT** | `/api/todos/:id` | Update task details | Full or partial task object |
| **PATCH** | `/api/todos/:id/toggle` | Toggle task completion | — |
| **PATCH** | `/api/todos/:id/pin` | Toggle pin status | — |
| **PATCH** | `/api/todos/:id/subtasks/:subtaskId` | Toggle subtask check | — |
| **DELETE** | `/api/todos/:id` | Delete a task | — |
| **POST** | `/api/todos/clear-completed` | Delete all completed tasks | — |
| **GET** | `/api/stats` | Get analytics metrics | Returns totals, active, completed, overdue, completionRate |
| **GET** | `/api/categories` | Get category list | Returns list of distinct categories |

### Example Request (`POST /api/todos`)
```json
{
  "title": "Prepare client presentation",
  "description": "Include Q4 growth numbers and roadmap",
  "category": "Work",
  "priority": "high",
  "dueDate": "2026-11-20",
  "pinned": true,
  "subtasks": [
    { "title": "Outline slides", "completed": true },
    { "title": "Export metrics chart", "completed": false }
  ]
}
```

---

## 📁 Project Structure

```
todo-app/
├── server.js              # Express REST API server & static file host
├── package.json           # Node.js dependencies & scripts
├── data/
│   └── todos.json         # Persistent JSON database (auto-created)
├── public/
│   ├── index.html         # Modern, responsive SPA layout
│   ├── css/
│   │   └── style.css      # Custom animations, glassmorphism, themes
│   └── js/
│       ├── api.js         # Frontend REST API client wrapper
│       └── app.js         # Reactive UI controller, event handlers, toasts
└── README.md              # Project documentation
```

---

## 🏃 Getting Started

### 1. Prerequisites
- **Node.js** (v18 or higher recommended)
- **npm**

### 2. Installation
Open your terminal inside the project folder:
```bash
cd todo-app
npm install
```

### 3. Run the Server
```bash
npm start
```
Or for auto-reloading development:
```bash
npm run dev
```

### 4. Open in Browser
Open your browser and navigate to:
```
http://localhost:3000
```

---

## 💻 Tech Stack
- **Backend**: Node.js, Express.js, CORS
- **Frontend**: HTML5, Modern Vanilla JavaScript (ES6+), Tailwind CSS, Canvas-Confetti, SVG icons
- **Persistence**: Safe JSON storage with atomic writes
