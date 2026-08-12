(function () {
  const root = document.documentElement;
  const saved = localStorage.getItem('px_theme') || 'dark';
  root.setAttribute('data-theme', saved);

  function attach() {
    const toggle = document.getElementById('themeToggle');
    if (!toggle) return;
    toggle.addEventListener('click', () => {
      const current = root.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      localStorage.setItem('px_theme', next);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attach);
  } else {
    attach();
  }
})();
