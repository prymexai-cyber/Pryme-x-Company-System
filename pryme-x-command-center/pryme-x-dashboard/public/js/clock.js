const Clocks = {
  data: [],
  timer: null,

  render(clocks) {
    this.data = clocks;
    const grid = document.getElementById('clockGrid');
    grid.innerHTML = clocks
      .map(
        (c, i) => `
      <div class="glass clock-card" data-tz="${c.timezone}">
        <div class="flag">${c.flag || '🌐'}</div>
        <div class="time" id="clock-time-${i}">--:--:--</div>
        <div class="date" id="clock-date-${i}">-</div>
        <div class="place">${escapeHtml(c.label)}</div>
      </div>`
      )
      .join('');
    this.tick();
  },

  tick() {
    this.data.forEach((c, i) => {
      try {
        const now = new Date();
        const timeEl = document.getElementById(`clock-time-${i}`);
        const dateEl = document.getElementById(`clock-date-${i}`);
        if (!timeEl) return;
        timeEl.textContent = now.toLocaleTimeString('en-GB', { timeZone: c.timezone, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        dateEl.textContent = now.toLocaleDateString('en-US', { timeZone: c.timezone, weekday: 'short', month: 'short', day: 'numeric' });
      } catch (e) {
        // invalid timezone string — ignore silently
      }
    });
  },

  startTicking() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), 1000);
  },
};

async function loadClocks() {
  const { settings } = await PX.api('/clocks');
  Clocks.render(settings.clocks);
  Clocks.startTicking();
}

// ---- Edit clocks modal (Full Access only) ----
const clocksModal = document.getElementById('clocksModal');

document.getElementById('editClocksBtn')?.addEventListener('click', () => {
  const list = document.getElementById('clocksEditList');
  list.innerHTML = Clocks.data
    .map(
      (c, i) => `
    <div style="display:flex; gap:8px; margin-bottom:8px;" data-row="${i}">
      <input type="text" value="${escapeHtml(c.flag)}" style="width:56px; padding:8px; border-radius:8px; border:1px solid var(--glass-border); background:var(--bg-2); color:var(--text-0);" class="clk-flag" />
      <input type="text" value="${escapeHtml(c.label)}" placeholder="Label" style="flex:1; padding:8px; border-radius:8px; border:1px solid var(--glass-border); background:var(--bg-2); color:var(--text-0);" class="clk-label" />
      <input type="text" value="${escapeHtml(c.timezone)}" placeholder="IANA Timezone (e.g. Asia/Colombo)" style="flex:1.3; padding:8px; border-radius:8px; border:1px solid var(--glass-border); background:var(--bg-2); color:var(--text-0);" class="clk-tz" />
      <button class="btn btn-sm btn-danger" data-remove-clock="${i}">✕</button>
    </div>`
    )
    .join('');
  clocksModal.classList.add('show');
});

document.getElementById('clocksEditList')?.addEventListener('click', (e) => {
  if (e.target.dataset.removeClock !== undefined) {
    e.target.closest('[data-row]').remove();
  }
});

document.getElementById('clocksCancelBtn')?.addEventListener('click', () => clocksModal.classList.remove('show'));

document.getElementById('clocksSaveBtn')?.addEventListener('click', async () => {
  try {
    const rows = document.querySelectorAll('#clocksEditList [data-row]');
    const clocks = Array.from(rows).map((row) => ({
      flag: row.querySelector('.clk-flag').value.trim(),
      label: row.querySelector('.clk-label').value.trim(),
      timezone: row.querySelector('.clk-tz').value.trim(),
    }));
    const { settings } = await PX.api('/clocks', { method: 'PUT', body: { clocks } });
    Clocks.render(settings.clocks);
    clocksModal.classList.remove('show');
    PX.toast('World clocks updated.');
  } catch (err) {
    PX.toast(err.message, 'error');
  }
});
