(function () {
  // If already logged in, skip straight to dashboard.
  if (PX.token()) {
    PX.api('/auth/me')
      .then(() => (location.href = '/dashboard.html'))
      .catch(() => {});
  }

  const form = document.getElementById('loginForm');
  const btn = document.getElementById('loginBtn');
  const errorBanner = document.getElementById('errorBanner');

  function showError(msg) {
    errorBanner.textContent = msg;
    errorBanner.classList.add('show');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBanner.classList.remove('show');
    btn.disabled = true;
    btn.textContent = 'Verifying...';

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    try {
      const data = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const json = await data.json();

      if (!data.ok) {
        throw new Error(json.error || 'Invalid credentials.');
      }

      PX.setToken(json.token);
      PX.setUser(json.user);
      location.href = '/dashboard.html';
    } catch (err) {
      showError(err.message || 'Unable to sign in. Please verify your credentials.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign In to Command Center';
    }
  });
})();
