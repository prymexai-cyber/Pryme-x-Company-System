const PX = {
  token() {
    return localStorage.getItem('px_token');
  },
  setToken(t) {
    localStorage.setItem('px_token', t);
  },
  clearToken() {
    localStorage.removeItem('px_token');
    localStorage.removeItem('px_user');
  },
  user() {
    try {
      return JSON.parse(localStorage.getItem('px_user') || 'null');
    } catch {
      return null;
    }
  },
  setUser(u) {
    localStorage.setItem('px_user', JSON.stringify(u));
  },
  async api(path, options = {}) {
    const headers = Object.assign(
      { 'Content-Type': 'application/json' },
      options.headers || {}
    );
    const token = this.token();
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch('/api' + path, {
      ...options,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    let data = {};
    try {
      data = await res.json();
    } catch {
      /* no body */
    }

    if (res.status === 401) {
      this.clearToken();
      if (!location.pathname.endsWith('login.html')) {
        location.href = '/login.html';
      }
    }

    if (!res.ok) {
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data;
  },
  toast(message, type = 'success') {
    let stack = document.querySelector('.toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toast-stack';
      document.body.appendChild(stack);
    }
    const el = document.createElement('div');
    el.className = `toast glass ${type}`;
    el.textContent = message;
    stack.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  },
  initials(name) {
    if (!name) return '?';
    return name.slice(0, 2).toUpperCase();
  },
};
