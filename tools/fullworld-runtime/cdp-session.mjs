import { performance } from 'node:perf_hooks';

const DEFAULT_RPC_TIMEOUT_MS = 10_000;

function positiveFinite(value, label) {
  if (!Number.isFinite(value) || value <= 0) throw new TypeError(`${label} must be a positive finite number`);
  return value;
}

export class CdpSession {
  constructor(webSocketUrl, {
    deadline,
    rpcTimeoutMs = DEFAULT_RPC_TIMEOUT_MS,
    WebSocketImpl = globalThis.WebSocket,
    now = () => performance.now(),
  } = {}) {
    if (typeof WebSocketImpl !== 'function') throw new TypeError('WebSocket implementation is required');
    if (!Number.isFinite(deadline)) throw new TypeError('CDP outer deadline is required');
    this.deadline = deadline;
    this.rpcTimeoutMs = positiveFinite(rpcTimeoutMs, 'CDP RPC timeout');
    this.now = now;
    this.ws = new WebSocketImpl(webSocketUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.closed = false;
  }

  async open() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) pending.reject(new Error(`${message.error.code}: ${message.error.message}`));
      else pending.resolve(message.result);
    });
    this.ws.addEventListener('close', () => {
      if (!this.closed) this.abort(new Error('CDP WebSocket closed with RPCs pending'), { closeSocket: false });
    });
  }

  send(method, params = {}) {
    if (this.closed) return Promise.reject(new Error(`CDP session is closed before ${method}`));
    const remainingMs = this.deadline - this.now();
    if (!(remainingMs > 0)) return Promise.reject(new Error(`CDP outer deadline expired before ${method}`));
    const timeoutMs = Math.min(this.rpcTimeoutMs, remainingMs);
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.abort(new Error(`CDP RPC ${method} timed out after ${Math.ceil(timeoutMs)} ms`));
      }, timeoutMs);
      this.pending.set(id, { method, reject, resolve, timer });
      try {
        this.ws.send(JSON.stringify({ id, method, params }));
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  abort(reason, { closeSocket = true } = {}) {
    if (this.closed && this.pending.size === 0) return;
    this.closed = true;
    const error = reason instanceof Error ? reason : new Error(String(reason));
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
    if (closeSocket) {
      try { this.ws.close(); } catch {}
    }
  }

  close() {
    this.abort(new Error('CDP session closed'));
  }
}
