import 'dotenv/config';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { upsertEmail } from './trainingStore.js';
import { detectOnBehalf, extractCreatorName, guessBrandDomain, contentHash } from './features.js';

const {
  IMAP_HOST, IMAP_PORT = 993, IMAP_SECURE = 'true',
  IMAP_USER, IMAP_PASS, IMAP_MAILBOX = 'Training/Approved Sent'
} = process.env;

async function runSync() {
  const client = new ImapFlow({
    host: IMAP_HOST,
    port: Number(IMAP_PORT),
    secure: IMAP_SECURE === 'true',
    auth: { user: IMAP_USER, pass: IMAP_PASS }
  });

  await client.connect();
  const lock = await client.getMailboxLock(IMAP_MAILBOX);
  try {
    const since = new Date(Date.now() - 365*24*3600*1000); // last 12 months
    const uids = await client.search({ since }, { uid: true });
    console.log(`[SYNC] Found ${uids.length} messages in "${IMAP_MAILBOX}"`);

    for await (const msg of client.fetch(uids, { envelope: true, source: true })) {
      const parsed = await simpleParser(msg.source);
      const messageId = parsed.messageId || (parsed.headers?.get('message-id') || '').trim() || `uid:${msg.uid}`;
      const date = new Date(parsed.date || Date.now()).getTime();

      const fromAddr = parsed.from?.value?.map(v => v.address) || [];
      const toAddrs  = parsed.to?.value?.map(v => v.address)   || [];
      const ccAddrs  = parsed.cc?.value?.map(v => v.address)   || [];

      const text = (parsed.text || parsed.html || '').toString().trim();

      upsertEmail({
        message_id: messageId,
        date,
        from_addr: JSON.stringify(fromAddr),
        to_addrs: JSON.stringify(toAddrs),
        cc_addrs: JSON.stringify(ccAddrs),
        subject: parsed.subject || '',
        text,
        on_behalf: detectOnBehalf(text) ? 1 : 0,
        creator_name: extractCreatorName(text) || '',
        brand_domain: guessBrandDomain(toAddrs, ccAddrs),
        content_hash: contentHash(text)
      });
    }
    console.log("[SYNC] Done.");
  } finally {
    lock.release();
    await client.logout();
  }
}

runSync().catch(e => { console.error(e); process.exit(1); });
