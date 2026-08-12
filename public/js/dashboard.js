// ===========================================================================
// Pryme X Command Center — Dashboard bootstrap
// ===========================================================================

const State = {
  user: null,
  socket: null,
  isFullAccess() {
    return this.user && (this.user.role === 'CEO' || this.user.accessLevel === 'FULL');
  },
};

// ---- Auth guard ----
(async function bootstrap() {
  if (!PX.token()) {
    location.href = '/login.html';
    return;
  }
  try {
    const { user } = await PX.api('/auth/me');
    State.user = user;
    initShell();
    connectSocket();
    await Promise.all([loadMetrics(), loadProfile(), loadClocks(), loadPresence(), loadMeetingStatus()]);
    if (user.role === 'CEO') await loadStaff();
  } catch (err) {
    console.error(err);
    location.href = '/login.html';
  }
})();

function connectSocket() {
  State.socket = io({ auth: { token: PX.token() } });

  State.socket.on('connect_error', (err) => {
    console.warn('[Socket] connection error:', err.message);
  });

  State.socket.on('presence:update', ({ userId, isOnline }) => {
    document.querySelectorAll(`[data-presence-id="${userId}"]`).forEach((el) => {
      el.classList.toggle('online', isOnline);
    });
  });

  State.socket.on('metrics:update', (metrics) => renderMetrics(metrics));
  State.socket.on('clocks:update', ({ clocks }) => Clocks.render(clocks));
}

// ---- Shell: sidebar nav, topbar, theme, logout ----
function initShell() {
  const u = State.user;

  document.getElementById('topbarUser').innerHTML = `
    <div style="text-align:right; line-height:1.2;">
      <div style="font-size:13px; font-weight:600;">${escapeHtml(u.username)}</div>
      <div style="font-size:11px; color:var(--text-2);">${escapeHtml(u.role === 'CEO' ? 'CEO & Founder' : u.jobPosition)}</div>
    </div>
    <div class="avatar" style="background:${u.avatarColor}">${PX.initials(u.username)}</div>
  `;

  if (u.role === 'CEO') {
    document.getElementById('navStaff').style.display = 'flex';
  }
  if (State.isFullAccess()) {
    document.getElementById('metricEditCard').style.display = 'block';
    document.getElementById('newGroupBtn').style.display = 'inline-flex';
    document.getElementById('editClocksBtn').style.display = 'inline-flex';
    document.getElementById('navInbox').style.display = 'flex';
  }

  document.querySelectorAll('.nav-item[data-section]').forEach((item) => {
    item.addEventListener('click', () => switchSection(item.dataset.section));
  });

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    try { await PX.api('/auth/logout', { method: 'POST' }); } catch {}
    PX.clearToken();
    location.href = '/login.html';
  });

  // Mobile sidebar toggle
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  document.getElementById('mobileMenuBtn').addEventListener('click', () => {
    sidebar.classList.add('open');
    backdrop.classList.add('show');
  });
  backdrop.addEventListener('click', () => {
    sidebar.classList.remove('open');
    backdrop.classList.remove('show');
  });
  document.querySelectorAll('.nav-item[data-section]').forEach((item) => {
    item.addEventListener('click', () => {
      sidebar.classList.remove('open');
      backdrop.classList.remove('show');
    });
  });
}

function switchSection(name) {
  document.querySelectorAll('.section').forEach((s) => s.classList.remove('active'));
  document.getElementById(`section-${name}`).classList.add('active');
  document.querySelectorAll('.nav-item[data-section]').forEach((n) => n.classList.remove('active'));
  document.querySelector(`.nav-item[data-section="${name}"]`).classList.add('active');
  const titles = { overview: 'Overview', chat: 'Team Chat', meeting: 'Video Meeting', clocks: 'World Clocks', inbox: 'Live Inbox', staff: 'Staff Management', profile: 'My Profile' };
  document.getElementById('sectionTitle').textContent = titles[name] || name;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

// ---- Metrics ----
function renderMetrics(m) {
  document.getElementById('metricCompleted').textContent = m.completedProjects ?? 0;
  document.getElementById('metricActive').textContent = m.activeProjects ?? 0;
  document.getElementById('metricFailed').textContent = m.failedProjects ?? 0;
  document.getElementById('inputCompleted').value = m.completedProjects ?? 0;
  document.getElementById('inputActive').value = m.activeProjects ?? 0;
  document.getElementById('inputFailed').value = m.failedProjects ?? 0;
}

async function loadMetrics() {
  const { metrics } = await PX.api('/metrics');
  renderMetrics(metrics);
}

document.getElementById('saveMetricsBtn')?.addEventListener('click', async () => {
  try {
    const body = {
      completedProjects: Number(document.getElementById('inputCompleted').value),
      activeProjects: Number(document.getElementById('inputActive').value),
      failedProjects: Number(document.getElementById('inputFailed').value),
    };
    const { metrics } = await PX.api('/metrics', { method: 'PATCH', body });
    renderMetrics(metrics);
    PX.toast('Metrics updated live.');
  } catch (err) {
    PX.toast(err.message, 'error');
  }
});

// ---- Presence ----
async function loadPresence() {
  const { users } = await PX.api('/users');
  const list = document.getElementById('overviewPresence');
  list.innerHTML = users
    .map(
      (u) => `
    <li data-presence-id="${u.id}">
      <span class="status-dot ${u.isOnline ? 'online' : ''}"></span>
      <span>${escapeHtml(u.username)}</span>
      <span style="color:var(--text-2); font-size:11.5px; margin-left:4px;">— ${escapeHtml(u.jobPosition)}</span>
      ${u.role === 'CEO' ? '<span class="badge badge-gold" style="margin-left:auto;">CEO & Founder</span>' : `<span class="badge ${u.accessLevel === 'FULL' ? 'badge-gold' : 'badge-preview'}" style="margin-left:auto;">${u.accessLevel === 'FULL' ? 'Full Access' : 'Preview'}</span>`}
    </li>`
    )
    .join('');
  return users;
}

// ---- Profile ----
async function loadProfile() {
  const u = State.user;
  document.getElementById('profileAvatar').style.background = u.avatarColor;
  document.getElementById('profileAvatar').textContent = PX.initials(u.username);
  document.getElementById('profileUsername').textContent = u.username;
  document.getElementById('profileBadge').textContent = u.role === 'CEO' ? 'CEO & Founder' : (u.accessLevel === 'FULL' ? 'Full System Access' : 'Preview Only');
  document.getElementById('profileJobPosition').value = u.role === 'CEO' ? 'CEO & Founder' : u.jobPosition;
  document.getElementById('profileJobPosition').disabled = u.role === 'CEO';
  document.getElementById('profileDescription').value = u.description || '';
  document.getElementById('profileColor').value = u.avatarColor || '#c9a44c';
}

document.getElementById('saveProfileBtn')?.addEventListener('click', async () => {
  try {
    const body = {
      jobPosition: document.getElementById('profileJobPosition').value,
      description: document.getElementById('profileDescription').value,
      avatarColor: document.getElementById('profileColor').value,
    };
    const { user } = await PX.api('/users/me/profile', { method: 'PATCH', body });
    State.user = user;
    PX.setUser(user);
    initShell();
    loadProfile();
    PX.toast('Profile updated.');
  } catch (err) {
    PX.toast(err.message, 'error');
  }
});

document.getElementById('changePassBtn')?.addEventListener('click', async () => {
  try {
    const currentPassword = document.getElementById('curPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    await PX.api('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } });
    document.getElementById('curPassword').value = '';
    document.getElementById('newPassword').value = '';
    PX.toast('Password updated successfully.');
  } catch (err) {
    PX.toast(err.message, 'error');
  }
});

// ---- Staff Management (CEO only) ----
async function loadStaff() {
  const users = await loadPresence(); // reuse the same fetch
  const tbody = document.getElementById('staffTableBody');
  tbody.innerHTML = users
    .map(
      (u) => `
    <tr>
      <td style="display:flex; align-items:center; gap:8px;">
        <div class="avatar avatar-sm" style="background:${u.avatarColor}">${PX.initials(u.username)}</div>
        ${escapeHtml(u.username)}
      </td>
      <td>${escapeHtml(u.role === 'CEO' ? 'CEO & Founder' : u.jobPosition)}</td>
      <td>
        ${u.role === 'CEO'
          ? '<span class="badge badge-gold">Full System Access</span>'
          : `<span class="badge ${u.accessLevel === 'FULL' ? 'badge-gold' : 'badge-preview'}">${u.accessLevel === 'FULL' ? 'Full Access' : 'Preview Only'}</span>`}
      </td>
      <td><span class="badge ${u.isOnline ? 'badge-online' : 'badge-preview'}">${u.isOnline ? 'Online' : 'Offline'}</span></td>
      <td>
        ${u.role === 'CEO' ? '<span style="color:var(--text-2); font-size:12px;">Protected</span>' : `
          <button class="btn btn-sm" data-toggle-access="${u.id}" data-current="${u.accessLevel}">Toggle Access</button>
          <button class="btn btn-sm btn-danger" data-remove-user="${u.id}">Remove</button>
        `}
      </td>
    </tr>`
    )
    .join('');

  tbody.querySelectorAll('[data-toggle-access]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.toggleAccess;
      const next = btn.dataset.current === 'FULL' ? 'PREVIEW' : 'FULL';
      try {
        await PX.api(`/users/${id}/access`, { method: 'PATCH', body: { accessLevel: next } });
        PX.toast('Access level updated.');
        loadStaff();
      } catch (err) {
        PX.toast(err.message, 'error');
      }
    });
  });

  tbody.querySelectorAll('[data-remove-user]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Remove this staff member permanently?')) return;
      try {
        await PX.api(`/users/${btn.dataset.removeUser}`, { method: 'DELETE' });
        PX.toast('Staff member removed.');
        loadStaff();
      } catch (err) {
        PX.toast(err.message, 'error');
      }
    });
  });
}

// ---- Invite modal ----
const inviteModal = document.getElementById('inviteModal');
document.getElementById('inviteStaffBtn')?.addEventListener('click', () => inviteModal.classList.add('show'));
document.getElementById('inviteCancelBtn')?.addEventListener('click', () => inviteModal.classList.remove('show'));

document.getElementById('inviteSubmitBtn')?.addEventListener('click', async () => {
  try {
    const body = {
      username: document.getElementById('inv_username').value.trim(),
      email: document.getElementById('inv_email').value.trim(),
      tempPassword: document.getElementById('inv_password').value,
      jobPosition: document.getElementById('inv_position').value.trim() || 'Team Member',
      accessLevel: document.querySelector('input[name="inv_access"]:checked').value,
    };
    const res = await PX.api('/users/invite', { method: 'POST', body });
    PX.toast(res.warning ? res.warning : `Invitation sent to ${body.email}.`, res.warning ? 'error' : 'success');
    inviteModal.classList.remove('show');
    ['inv_username', 'inv_email', 'inv_password', 'inv_position'].forEach((id) => (document.getElementById(id).value = ''));
    loadStaff();
  } catch (err) {
    PX.toast(err.message, 'error');
  }
});
