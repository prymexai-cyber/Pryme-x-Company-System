const Inbox = {
  messages: [],
  loaded: false,
};

function formatEmailDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function loadInbox() {
  const list = document.getElementById('inboxList');
  if (!list) return;
  list.innerHTML = `<div style="padding:24px; text-align:center; color:var(--text-2); font-size:13px;">Connecting to live inbox…</div>`;

  try {
    const { messages, fetchedAt } = await PX.api('/inbox?limit=20');
    Inbox.messages = messages;
    Inbox.loaded = true;
    document.getElementById('inboxMeta').textContent = `Connected via Gmail IMAP — last synced ${new Date(fetchedAt).toLocaleTimeString()}`;

    if (!messages.length) {
      list.innerHTML = `<div style="padding:24px; text-align:center; color:var(--text-2); font-size:13px;">Inbox is empty.</div>`;
      return;
    }

    list.innerHTML = messages
      .map(
        (m, i) => `
      <div class="group-item" style="border-radius:0; border-bottom:1px solid var(--glass-border); padding:14px 18px; margin:0;" data-email-idx="${i}">
        <div style="width:8px; height:8px; border-radius:50%; background:${m.unread ? 'var(--accent)' : 'transparent'}; flex-shrink:0;"></div>
        <div class="meta">
          <div class="gname" style="display:flex; justify-content:space-between; gap:8px;">
            <span>${escapeHtml(m.from)}</span>
            <span style="font-weight:400; font-size:11.5px; color:var(--text-2);">${formatEmailDate(m.date)}</span>
          </div>
          <div class="gcount">${escapeHtml(m.subject)}</div>
        </div>
      </div>`
      )
      .join('');

    list.querySelectorAll('[data-email-idx]').forEach((row) => {
      row.addEventListener('click', () => openEmail(Inbox.messages[Number(row.dataset.emailIdx)].uid));
    });
  } catch (err) {
    list.innerHTML = `<div style="padding:24px; text-align:center; color:var(--danger); font-size:13px;">${escapeHtml(err.message)}</div>`;
  }
}

async function openEmail(uid) {
  const modal = document.getElementById('emailModal');
  document.getElementById('email_subject').textContent = 'Loading…';
  document.getElementById('email_from').textContent = '';
  document.getElementById('email_date').textContent = '';
  document.getElementById('email_body').textContent = '';
  modal.classList.add('show');

  try {
    const { message } = await PX.api(`/inbox/${uid}`);
    document.getElementById('email_subject').textContent = message.subject;
    document.getElementById('email_from').textContent = `From: ${message.from}${message.to ? ' — To: ' + message.to : ''}`;
    document.getElementById('email_date').textContent = formatEmailDate(message.date);
    document.getElementById('email_body').textContent = message.text || '(No text content)';
  } catch (err) {
    document.getElementById('email_subject').textContent = 'Unable to load message';
    document.getElementById('email_body').textContent = err.message;
  }
}

document.getElementById('emailCloseBtn')?.addEventListener('click', () => {
  document.getElementById('emailModal').classList.remove('show');
});
document.getElementById('refreshInboxBtn')?.addEventListener('click', loadInbox);

// Load inbox lazily the first time the section is opened (avoids an IMAP round-trip on every page load).
document.addEventListener('DOMContentLoaded', () => {
  document.querySelector('.nav-item[data-section="inbox"]')?.addEventListener('click', () => {
    if (!Inbox.loaded) loadInbox();
  });
});
