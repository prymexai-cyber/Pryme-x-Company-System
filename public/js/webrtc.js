const RTC = {
  localStream: null,
  peers: new Map(), // socketId -> RTCPeerConnection
  roomId: null,
  activeMeeting: null,
  micOn: true,
  camOn: true,
};

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

async function loadMeetingStatus() {
  const { meeting } = await PX.api('/meetings/active');
  RTC.activeMeeting = meeting;
  renderMeetingBar();
}

function renderMeetingBar() {
  const statusEl = document.getElementById('meetingStatus');
  const startBtn = document.getElementById('startMeetingBtn');
  const endBtn = document.getElementById('endMeetingBtn');
  const joinBtn = document.getElementById('joinMeetingBtn');

  const inCall = !!RTC.roomId;

  if (RTC.activeMeeting) {
    statusEl.textContent = `🔴 Live: "${RTC.activeMeeting.title}" started by ${RTC.activeMeeting.startedBy?.username || 'a colleague'}`;
    startBtn.style.display = 'none';
    endBtn.style.display = State.isFullAccess() ? 'inline-flex' : 'none';
    joinBtn.style.display = inCall ? 'none' : 'inline-flex';
  } else {
    statusEl.textContent = 'No meeting is currently live.';
    startBtn.style.display = State.isFullAccess() ? 'inline-flex' : 'none';
    endBtn.style.display = 'none';
    joinBtn.style.display = 'none';
    if (inCall) leaveCall();
  }
}

document.getElementById('startMeetingBtn')?.addEventListener('click', async () => {
  try {
    const { meeting } = await PX.api('/meetings/start', { method: 'POST', body: { title: 'Executive Meeting' } });
    RTC.activeMeeting = meeting;
    renderMeetingBar();
    await joinCall(meeting.roomId);
  } catch (err) {
    PX.toast(err.message, 'error');
  }
});

document.getElementById('endMeetingBtn')?.addEventListener('click', async () => {
  if (!RTC.activeMeeting) return;
  try {
    await PX.api(`/meetings/${RTC.activeMeeting._id}/end`, { method: 'POST' });
    leaveCall();
  } catch (err) {
    PX.toast(err.message, 'error');
  }
});

document.getElementById('joinMeetingBtn')?.addEventListener('click', () => {
  if (RTC.activeMeeting) joinCall(RTC.activeMeeting.roomId);
});

document.getElementById('leaveCallBtn')?.addEventListener('click', () => leaveCall());

document.getElementById('toggleMicBtn')?.addEventListener('click', () => {
  RTC.micOn = !RTC.micOn;
  RTC.localStream?.getAudioTracks().forEach((t) => (t.enabled = RTC.micOn));
  document.getElementById('toggleMicBtn').textContent = RTC.micOn ? '🎙️' : '🔇';
});

document.getElementById('toggleCamBtn')?.addEventListener('click', () => {
  RTC.camOn = !RTC.camOn;
  RTC.localStream?.getVideoTracks().forEach((t) => (t.enabled = RTC.camOn));
  document.getElementById('toggleCamBtn').textContent = RTC.camOn ? '📷' : '🚫';
});

async function joinCall(roomId) {
  try {
    RTC.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  } catch (err) {
    PX.toast('Camera/microphone access is required to join the meeting.', 'error');
    return;
  }

  RTC.roomId = roomId;
  document.getElementById('videoControls').style.display = 'flex';
  addVideoTile('local', RTC.localStream, `${State.user.username} (You)`, true);
  renderMeetingBar();

  State.socket.emit('webrtc:join', { roomId });
}

function leaveCall() {
  if (RTC.roomId) {
    State.socket.emit('webrtc:leave', { roomId: RTC.roomId });
  }
  RTC.peers.forEach((pc) => pc.close());
  RTC.peers.clear();
  RTC.localStream?.getTracks().forEach((t) => t.stop());
  RTC.localStream = null;
  RTC.roomId = null;
  document.getElementById('videoGrid').innerHTML = '';
  document.getElementById('videoControls').style.display = 'none';
  renderMeetingBar();
}

function addVideoTile(id, stream, label, muted = false) {
  const grid = document.getElementById('videoGrid');
  let tile = document.getElementById(`tile-${id}`);
  if (!tile) {
    tile = document.createElement('div');
    tile.className = 'video-tile glass';
    tile.id = `tile-${id}`;
    tile.innerHTML = `<video autoplay playsinline ${muted ? 'muted' : ''}></video><div class="tag">${escapeHtml(label)}</div>`;
    grid.appendChild(tile);
  }
  tile.querySelector('video').srcObject = stream;
}

function removeVideoTile(id) {
  document.getElementById(`tile-${id}`)?.remove();
}

function createPeerConnection(remoteSocketId, remoteUsername) {
  const pc = new RTCPeerConnection(ICE_SERVERS);
  RTC.peers.set(remoteSocketId, pc);

  RTC.localStream.getTracks().forEach((track) => pc.addTrack(track, RTC.localStream));

  pc.onicecandidate = (e) => {
    if (e.candidate) {
      State.socket.emit('webrtc:signal', { to: remoteSocketId, data: { type: 'ice-candidate', candidate: e.candidate } });
    }
  };

  pc.ontrack = (e) => {
    addVideoTile(remoteSocketId, e.streams[0], remoteUsername || 'Colleague');
  };

  pc.onconnectionstatechange = () => {
    if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
      removeVideoTile(remoteSocketId);
      RTC.peers.delete(remoteSocketId);
    }
  };

  return pc;
}

document.addEventListener('DOMContentLoaded', () => {
  const attach = () => {
    if (!State.socket) return setTimeout(attach, 300);

    State.socket.on('webrtc:peer-joined', async ({ socketId, username }) => {
      if (!RTC.roomId || !RTC.localStream) return;
      const pc = createPeerConnection(socketId, username);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      State.socket.emit('webrtc:signal', { to: socketId, data: { type: 'offer', sdp: offer } });
    });

    State.socket.on('webrtc:signal', async ({ from, data }) => {
      if (!RTC.roomId || !RTC.localStream) return;
      let pc = RTC.peers.get(from);

      if (data.type === 'offer') {
        if (!pc) pc = createPeerConnection(from);
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        State.socket.emit('webrtc:signal', { to: from, data: { type: 'answer', sdp: answer } });
      } else if (data.type === 'answer') {
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      } else if (data.type === 'ice-candidate') {
        if (pc) {
          try { await pc.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch {}
        }
      }
    });

    State.socket.on('webrtc:peer-left', ({ socketId }) => {
      RTC.peers.get(socketId)?.close();
      RTC.peers.delete(socketId);
      removeVideoTile(socketId);
    });

    State.socket.on('meeting:started', (meeting) => {
      RTC.activeMeeting = meeting;
      renderMeetingBar();
      PX.toast(`${meeting.startedBy?.username || 'A colleague'} started a live meeting.`);
    });

    State.socket.on('meeting:ended', () => {
      RTC.activeMeeting = null;
      renderMeetingBar();
      PX.toast('The meeting has ended.');
    });
  };
  attach();
});
