import assert from 'node:assert/strict';
import test from 'node:test';
import { CdpSession } from '../../tools/fullworld-runtime/cdp-session.mjs';

class FakeWebSocket {
  constructor(url) {
    this.url = url;
    this.closed = false;
    this.sent = [];
    this.listeners = new Map();
  }

  addEventListener(type, listener, { once = false } = {}) {
    const entries = this.listeners.get(type) ?? [];
    entries.push({ listener, once });
    this.listeners.set(type, entries);
  }

  emit(type, event = {}) {
    const entries = [...(this.listeners.get(type) ?? [])];
    for (const entry of entries) entry.listener(event);
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter((entry) => !entry.once));
  }

  send(message) {
    this.sent.push(message);
  }

  close() {
    this.closed = true;
  }
}

async function openedSession(options = {}) {
  let socket;
  class TestWebSocket extends FakeWebSocket {
    constructor(url) {
      super(url);
      socket = this;
    }
  }
  const session = new CdpSession('ws://qualification.test/devtools', { WebSocketImpl: TestWebSocket, ...options });
  const opening = session.open();
  socket.emit('open');
  await opening;
  return { session, socket };
}

test('CDP session resolves a response before the per-RPC deadline', async () => {
  const { session, socket } = await openedSession({ deadline: 1_000, rpcTimeoutMs: 100, now: () => 0 });
  const pending = session.send('Runtime.evaluate', { expression: '1 + 1' });
  const request = JSON.parse(socket.sent[0]);
  assert.equal(request.method, 'Runtime.evaluate');
  socket.emit('message', { data: JSON.stringify({ id: request.id, result: { result: { value: 2 } } }) });
  assert.deepEqual(await pending, { result: { value: 2 } });
  assert.equal(session.pending.size, 0);
  session.close();
});

test('CDP session aborts a stalled RPC at the effective per-RPC timeout', async () => {
  const { session, socket } = await openedSession({ deadline: 1_000, rpcTimeoutMs: 5, now: () => 0 });
  await assert.rejects(session.send('Page.captureScreenshot'), /CDP RPC Page\.captureScreenshot timed out/);
  assert.equal(session.pending.size, 0);
  assert.equal(socket.closed, true);
});

test('CDP session refuses a new RPC after the outer deadline', async () => {
  const { session, socket } = await openedSession({ deadline: 100, rpcTimeoutMs: 50, now: () => 100 });
  await assert.rejects(session.send('Performance.getMetrics'), /outer deadline expired/);
  assert.equal(socket.sent.length, 0);
  session.close();
});
