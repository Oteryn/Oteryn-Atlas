export function createFrameScheduler(render, options = {}) {
  const requestFrame = options.requestFrame ?? globalThis.requestAnimationFrame?.bind(globalThis);
  const cancelFrame = options.cancelFrame ?? globalThis.cancelAnimationFrame?.bind(globalThis);
  if (typeof requestFrame !== 'function') throw new Error('requestAnimationFrame unavailable');

  let handle = null;
  let dirty = false;
  let requested = 0;
  let rendered = 0;
  let coalesced = 0;
  let lastReason = 'initial';

  function run(timestamp) {
    handle = null;
    if (!dirty) return;
    dirty = false;
    rendered += 1;
    render(timestamp, lastReason);
    if (dirty && handle == null) handle = requestFrame(run);
  }

  function schedule(reason = 'dirty') {
    requested += 1;
    lastReason = reason;
    if (dirty) coalesced += 1;
    dirty = true;
    if (handle == null) handle = requestFrame(run);
  }

  function cancel() {
    dirty = false;
    if (handle != null && typeof cancelFrame === 'function') cancelFrame(handle);
    handle = null;
  }

  function stats() {
    return Object.freeze({ requested, rendered, coalesced, pending: handle != null, dirty });
  }

  return Object.freeze({ schedule, cancel, stats });
}
