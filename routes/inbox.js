const express = require('express');
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const { requireAuth } = require('../middleware/auth');
const { requireFullAccess } = require('../middleware/rbac');

const router = express.Router();

function buildClient() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;

  return new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
  });
}

/**
 * GET /api/inbox — Full Access only.
 * Connects live to the corporate Gmail inbox via IMAP (read-only) and returns
 * the most recent messages. Nothing is cached or persisted locally — every
 * request is a fresh live read, per the "Live Email Inbox" requirement.
 */
router.get('/', requireAuth, requireFullAccess, async (req, res) => {
  const client = buildClient();
  if (!client) {
    return res.status(503).json({
      error: 'Live inbox is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD (with IMAP enabled) in your environment.',
    });
  }

  const limit = Math.min(parseInt(req.query.limit, 10) || 15, 50);
  const messages = [];

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');

    try {
      const status = client.mailbox; // populated after lock acquisition
      const total = status.exists || 0;

      if (total > 0) {
        const start = Math.max(1, total - limit + 1);
        const range = `${start}:${total}`;

        for await (const msg of client.fetch(range, { envelope: true, flags: true, bodyStructure: true, source: false, uid: true })) {
          messages.push({
            uid: msg.uid,
            subject: msg.envelope?.subject || '(No subject)',
            from: msg.envelope?.from?.[0] ? `${msg.envelope.from[0].name || ''} <${msg.envelope.from[0].address}>`.trim() : 'Unknown sender',
            to: msg.envelope?.to?.map((t) => t.address).join(', ') || '',
            date: msg.envelope?.date || null,
            unread: !msg.flags?.has('\\Seen'),
            flagged: !!msg.flags?.has('\\Flagged'),
          });
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();
    res.json({ messages: messages.reverse(), fetchedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[Inbox] IMAP error:', err.message);
    try { client.close(); } catch { /* noop */ }
    res.status(502).json({ error: 'Unable to reach the live inbox right now. Verify Gmail IMAP is enabled and the App Password is valid.' });
  }
});

/**
 * GET /api/inbox/:uid — Full Access only. Fetches and parses a single message body.
 */
router.get('/:uid', requireAuth, requireFullAccess, async (req, res) => {
  const client = buildClient();
  if (!client) {
    return res.status(503).json({ error: 'Live inbox is not configured.' });
  }

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    let result = null;

    try {
      const uid = parseInt(req.params.uid, 10);
      for await (const msg of client.fetch({ uid }, { source: true, uid: true }, { uid: true })) {
        const parsed = await simpleParser(msg.source);
        result = {
          uid: msg.uid,
          subject: parsed.subject || '(No subject)',
          from: parsed.from?.text || 'Unknown sender',
          to: parsed.to?.text || '',
          date: parsed.date,
          text: (parsed.text || '').slice(0, 5000),
        };
      }
    } finally {
      lock.release();
    }

    await client.logout();
    if (!result) return res.status(404).json({ error: 'Message not found.' });
    res.json({ message: result });
  } catch (err) {
    console.error('[Inbox] IMAP fetch-one error:', err.message);
    try { client.close(); } catch { /* noop */ }
    res.status(502).json({ error: 'Unable to load that message right now.' });
  }
});

module.exports = router;
