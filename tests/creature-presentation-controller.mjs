import assert from 'node:assert/strict';
import test from 'node:test';

import { createCreaturePresentationController } from '../src/browser/creature-presentation-controller.mjs';

test('identical presentation commits reuse cached text measurement and collision layout', () => {
  const previous = {
    HTMLElement: globalThis.HTMLElement,
    document: globalThis.document,
    getComputedStyle: globalThis.getComputedStyle,
    devicePixelRatio: globalThis.devicePixelRatio,
  };

  let measureTextCalls = 0;
  const fillTextValues = [];
  const context = {
    save() {},
    restore() {},
    setTransform() {},
    clearRect() {},
    fillRect() {},
    strokeRect() {},
    fillText(value) { fillTextValues.push(value); },
    measureText(value) {
      measureTextCalls += 1;
      return { width: Array.from(value).length * 6 };
    },
  };

  class FakeElement {
    constructor() {
      this.style = {};
      this.hidden = false;
    }
  }
  class FakeCanvas extends FakeElement {
    constructor() {
      super();
      this.width = 0;
      this.height = 0;
    }
    setAttribute() {}
    getContext() { return context; }
  }
  class FakeFrame extends FakeElement {
    append() {}
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 640, height: 360 };
    }
  }

  try {
    globalThis.HTMLElement = FakeElement;
    globalThis.document = {
      createElement(tagName) {
        assert.equal(tagName, 'canvas');
        return new FakeCanvas();
      },
      querySelector() { return null; },
    };
    globalThis.getComputedStyle = () => ({ display: 'block', visibility: 'visible' });
    globalThis.devicePixelRatio = 1;

    const recordId = 'monster:test-creature';
    const controller = createCreaturePresentationController({ frame: new FakeFrame() });
    const input = {
      view: { x: 100, y: 100, floor: -7, zoom: 2, mode: 'map', overview: false },
      detailReady: true,
      targets: [{
        recordId,
        geometryKey: 'geometry:v1',
        presentationRect: { x: 280, y: 160, width: 32, height: 32 },
      }],
      records: new Map([[recordId, {
        record_id: recordId,
        kind: 'monster',
        name: 'Test Creature',
      }]]),
      selectedId: null,
      hoveredId: null,
      activeFilter: 'all',
    };

    const first = controller.commit(input);
    assert.equal(first.labelLayouts[0]?.priority, 'monster');
    assert.deepEqual(fillTextValues, ['Test Creature'], 'visible labels must draw their factual display text');
    assert(measureTextCalls > 0, 'first layout commit must measure visible label text');
    const afterFirst = measureTextCalls;
    const second = controller.commit(input);

    assert.equal(second.labelLayoutGeneration, first.labelLayoutGeneration);
    assert.equal(
      measureTextCalls,
      afterFirst,
      'unchanged layout dependencies must not rerun measureText/collision layout',
    );
  } finally {
    if (previous.HTMLElement === undefined) delete globalThis.HTMLElement;
    else globalThis.HTMLElement = previous.HTMLElement;
    if (previous.document === undefined) delete globalThis.document;
    else globalThis.document = previous.document;
    if (previous.getComputedStyle === undefined) delete globalThis.getComputedStyle;
    else globalThis.getComputedStyle = previous.getComputedStyle;
    if (previous.devicePixelRatio === undefined) delete globalThis.devicePixelRatio;
    else globalThis.devicePixelRatio = previous.devicePixelRatio;
  }
});
