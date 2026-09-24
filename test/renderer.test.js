const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const source = readFileSync(require.resolve('../renderer.js'), 'utf8');

function setup(getUserMedia, play = async () => {}) {
  const video = { srcObject: null, play };
  const status = { hidden: false, textContent: 'Starting camera…' };
  const events = {};
  vm.runInNewContext(source, {
    document: { getElementById: id => id === 'video' ? video : status },
    navigator: { mediaDevices: { getUserMedia } },
    window: { addEventListener: (name, callback) => { events[name] = callback; } },
    console: { error() {} },
  });
  return { video, status, events };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
function makeStream() {
  const stops = [0, 0];
  return { stops, getTracks: () => stops.map((_, index) => ({ stop() { stops[index]++; } })) };
}

test('starts video without audio and releases all tracks on page exit', async () => {
  const stream = makeStream();
  let constraints;
  const ui = setup(async value => { constraints = value; return stream; });
  await flush();
  assert.equal(constraints.video, true);
  assert.equal(constraints.audio, false);
  assert.equal(ui.video.srcObject, stream);
  assert.equal(ui.status.hidden, true);
  ui.events.pagehide();
  assert.deepEqual(stream.stops, [1, 1]);
  assert.equal(ui.video.srcObject, null);
});

for (const [name, message] of [
  ['NotAllowedError', 'Camera access denied'],
  ['NotFoundError', 'No camera found'],
  ['NotReadableError', 'Camera unavailable'],
  ['UnknownError', 'Unable to start the camera'],
]) {
  test(`shows actionable feedback for ${name}`, async () => {
    const ui = setup(async () => { throw Object.assign(new Error('failure'), { name }); });
    await flush();
    assert.equal(ui.status.hidden, false);
    assert.ok(ui.status.textContent.startsWith(message));
    assert.equal(ui.video.srcObject, null);
  });
}

test('releases camera when permission resolves after page exit', async () => {
  let grant;
  const pending = new Promise(resolve => { grant = resolve; });
  const ui = setup(() => pending);
  ui.events.pagehide();
  const stream = makeStream();
  grant(stream);
  await flush();
  assert.deepEqual(stream.stops, [1, 1]);
  assert.equal(ui.video.srcObject, null);
});

test('playback failure releases camera and displays an error', async () => {
  const stream = makeStream();
  const ui = setup(async () => stream, async () => { throw new Error('playback failed'); });
  await flush();
  assert.deepEqual(stream.stops, [1, 1]);
  assert.equal(ui.video.srcObject, null);
  assert.equal(ui.status.hidden, false);
  assert.match(ui.status.textContent, /Unable to start/);
});
