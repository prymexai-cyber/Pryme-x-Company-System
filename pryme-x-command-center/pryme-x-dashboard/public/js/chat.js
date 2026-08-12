const Chat = {
  groups: [],
  activeGroup: null,
  allUsers: [],
};

async function loadGroups() {
  const { groups } = await PX.api('/chat/groups');
  Chat.groups = groups;
  renderGroupList();
  if (groups.length && !Chat.activeGroup) {
    selectGroup(groups[0]._id);
  }
}

function renderGroupList() {
  const list = document.getElementById('groupList');
  list.innerHTML = Chat.groups
    .map(
      (g) => `
    <div class="group-item ${Chat.activeGroup === g._id ? 'active' : ''}" data-group-id="${g._id}">
      <div class="avatar avatar-sm" style="background:var(--accent-deep); color:#0b0b0d;">${g.name.slice(0, 2).toUpperCase()}</div>
      <div class="meta">
        <div class="gname">${escapeHtml(g.name)}${g.isGeneral ? ' 🏢' : ''}</div>
        <div class="gcount">${g.members.length} member${g.members.length === 1 ? '' : 's'}</div>
      </div>
    </div>`
    )
    .join('');

  list.querySelectorAll('[data-group-id]').forEach((el) => {
    el.addEventListener('click', () => selectGroup(el.dataset.groupId));
  });
}

async function selectGroup(groupId) {
  Chat.activeGroup = groupId;
  renderGroupList();
  const group = Chat.groups.find((g) => g._id === groupId);
  if (!group) return;

  document.getElementById('activeGroupName').textContent = group.name;
  document.getElementById('activeGroupMeta').textContent = `${group.members.length} members — ${group.members.filter((m) => m.isOnline).length} online`;
  document.getElementById('chatInput').disabled = false;
  document.getElementById('sendMsgBtn').disabled = false;

  const leaveBtn = document.getElementById('leaveGroupBtn');
  const deleteBtn = document.getElementById('deleteGroupBtn');
  const canManage = State.isFullAccess();

  if (!group.isGeneral && canManage) {
    leaveBtn.style.display = 'inline-flex';
    leaveBtn.onclick = () => leaveGroup(groupId);
  } else {
    leaveBtn.style.display = 'none';
  }

  if (!group.isGeneral && canManage) {
    deleteBtn.style.display = 'inline-flex';
    deleteBtn.onclick = () => deleteGroup(groupId);
  } else {
    deleteBtn.style.display = 'none';
  }

  const { messages } = await PX.api(`/chat/groups/${groupId}/messages`);
  renderMessages(messages);
}

function renderMessages(messages) {
  const box = document.getElementById('chatMessages');
  box.innerHTML = messages
    .map((m) => {
      const own = m.sender._id === State.user.id || m.sender._id === State.user.id?.toString();
      const isOwn = String(m.sender._id) === String(State.user.id);
      return `
      <div class="msg ${isOwn ? 'own' : ''}">
        <div class="avatar avatar-sm" style="background:${m.sender.avatarColor || '#c9a44c'}">${PX.initials(m.sender.username)}</div>
        <div>
          ${!isOwn ? `<div class="sender">${escapeHtml(m.sender.username)}</div>` : ''}
          <div class="bubble">${escapeHtml(m.content)}</div>
        </div>
      </div>`;
    })
    .join('');
  box.scrollTop = box.scrollHeight;
}

async function leaveGroup(groupId) {
  if (!confirm('Leave this group?')) return;
  try {
    await PX.api(`/chat/groups/${groupId}/leave`, { method: 'POST' });
    Chat.activeGroup = null;
    PX.toast('You left the group.');
    loadGroups();
  } catch (err) {
    PX.toast(err.message, 'error');
  }
}

async function deleteGroup(groupId) {
  if (!confirm('Permanently delete this group and all its messages? This cannot be undone.')) return;
  try {
    await PX.api(`/chat/groups/${groupId}`, { method: 'DELETE' });
    Chat.activeGroup = null;
    PX.toast('Group deleted.');
    loadGroups();
  } catch (err) {
    PX.toast(err.message, 'error');
  }
}

document.getElementById('sendMsgBtn')?.addEventListener('click', sendMessage);
document.getElementById('chatInput')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
  const input = document.getElementById('chatInput');
  const content = input.value.trim();
  if (!content || !Chat.activeGroup) return;
  State.socket.emit('chat:send', { groupId: Chat.activeGroup, content }, (res) => {
    if (res?.error) PX.toast(res.error, 'error');
  });
  input.value = '';
}

// Incoming real-time messages
document.addEventListener('DOMContentLoaded', () => {
  const tryAttach = () => {
    if (!State.socket) return setTimeout(tryAttach, 300);
    State.socket.on('chat:message', (message) => {
      if (message.group === Chat.activeGroup || message.group?.toString() === Chat.activeGroup) {
        const box = document.getElementById('chatMessages');
        const isOwn = String(message.sender._id) === String(State.user.id);
        const el = document.createElement('div');
        el.className = `msg ${isOwn ? 'own' : ''}`;
        el.innerHTML = `
          <div class="avatar avatar-sm" style="background:${message.sender.avatarColor || '#c9a44c'}">${PX.initials(message.sender.username)}</div>
          <div>
            ${!isOwn ? `<div class="sender">${escapeHtml(message.sender.username)}</div>` : ''}
            <div class="bubble">${escapeHtml(message.content)}</div>
          </div>`;
        box.appendChild(el);
        box.scrollTop = box.scrollHeight;
      } else {
        PX.toast(`New message in another group.`);
      }
      loadGroups();
    });

    State.socket.on('chat:groupCreated', () => loadGroups());

    State.socket.on('chat:groupDeleted', ({ groupId }) => {
      if (Chat.activeGroup === groupId) {
        Chat.activeGroup = null;
        document.getElementById('chatMessages').innerHTML = '';
        document.getElementById('activeGroupName').textContent = 'Select a group';
        document.getElementById('activeGroupMeta').textContent = '';
        document.getElementById('chatInput').disabled = true;
        document.getElementById('sendMsgBtn').disabled = true;
      }
      PX.toast('A group was deleted.');
      loadGroups();
    });
  };
  tryAttach();

  // Kick off group loading once auth bootstrap completes
  const waitUser = setInterval(() => {
    if (State.user) {
      clearInterval(waitUser);
      loadGroups();
      populateGroupMemberPicker();
    }
  }, 200);
});

// ---- Create group modal (Full Access only) ----
const groupModal = document.getElementById('groupModal');
document.getElementById('newGroupBtn')?.addEventListener('click', () => groupModal.classList.add('show'));
document.getElementById('groupCancelBtn')?.addEventListener('click', () => groupModal.classList.remove('show'));

async function populateGroupMemberPicker() {
  const { users } = await PX.api('/users');
  Chat.allUsers = users;
  const box = document.getElementById('grp_members');
  box.innerHTML = users
    .filter((u) => u.id !== State.user.id)
    .map(
      (u) => `
    <div class="checkbox-row" style="margin-bottom:6px;">
      <input type="checkbox" value="${u.id}" id="mem_${u.id}" />
      <label for="mem_${u.id}" style="margin:0; text-transform:none; font-size:13px;">${escapeHtml(u.username)} — ${escapeHtml(u.jobPosition)}</label>
    </div>`
    )
    .join('');
}

document.getElementById('groupSubmitBtn')?.addEventListener('click', () => {
  const name = document.getElementById('grp_name').value.trim();
  const description = document.getElementById('grp_desc').value.trim();
  const memberIds = Array.from(document.querySelectorAll('#grp_members input:checked')).map((el) => el.value);

  if (!name) return PX.toast('Group name is required.', 'error');

  State.socket.emit('chat:createGroup', { name, description, memberIds }, (res) => {
    if (res?.error) return PX.toast(res.error, 'error');
    PX.toast('Group created.');
    groupModal.classList.remove('show');
    document.getElementById('grp_name').value = '';
    document.getElementById('grp_desc').value = '';
    loadGroups();
  });
});
