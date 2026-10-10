import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const readerSource = readFileSync(resolve(here, "../reader.html"), "utf8");

test("indeks 30 Juz tepat terhadap referensi ayat dan halaman mushaf Madinah", () => {
  const juzIndex = JSON.parse(readFileSync(resolve(here, "../quran/juz_index.json"), "utf8"));
  const pages = JSON.parse(readFileSync(resolve(here, "../mushaf/index.json"), "utf8"));
  const surahs = JSON.parse(readFileSync(resolve(here, "../quran/surah_index.json"), "utf8"));
  const expectedStarts = [
    "1:1", "2:142", "2:253", "3:93", "4:24", "4:148", "5:82", "6:111", "7:88", "8:41",
    "9:93", "11:6", "12:53", "15:1", "17:1", "18:75", "21:1", "23:1", "25:21", "27:56",
    "29:46", "33:31", "36:28", "39:32", "41:47", "46:1", "51:31", "58:1", "67:1", "78:1",
  ];
  assert.equal(juzIndex.schemaVersion, 1);
  assert.equal(juzIndex.mushafLayout, "Madinah 604-page");
  assert.equal(juzIndex.juzs.length, 30);
  assert.deepEqual(juzIndex.juzs.map(item => item.juz), Array.from({ length: 30 }, (_, index) => index + 1));
  assert.deepEqual(juzIndex.juzs.map(item => item.start), expectedStarts);
  for (const item of juzIndex.juzs) {
    const [surah, ayah] = item.start.split(":").map(Number);
    const metadata = surahs.find(entry => entry.n === surah);
    assert.ok(metadata && ayah >= 1 && ayah <= metadata.jml, `referensi ${item.start} valid`);
    assert.equal(item.page, pages[item.start], `halaman ${item.start} cocok`);
    assert.ok(item.page >= 1 && item.page <= 604);
  }
  assert.equal(juzIndex.juzs[3].page, 62, "Juz 4 dimulai pada 3:93 di halaman 62");
  assert.equal(juzIndex.juzs[25].page, 502, "Juz 26 dimulai pada 46:1 di halaman 502");
});

test("validator indeks Juz menolak halaman yang meleset dari indeks ayat", () => {
  const data = JSON.parse(readFileSync(resolve(here, "../quran/juz_index.json"), "utf8"));
  const pages = JSON.parse(readFileSync(resolve(here, "../mushaf/index.json"), "utf8"));
  const surahs = JSON.parse(readFileSync(resolve(here, "../quran/surah_index.json"), "utf8"));
  const start = readerSource.indexOf("function validateJuzIndex(");
  const end = readerSource.indexOf("\nasync function loadJuzIndex(", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const validate = new Function("data", "surahs", "pages", `${readerSource.slice(start, end)}\nreturn validateJuzIndex(data,surahs,pages);`);
  assert.equal(validate(data, surahs, pages), true);
  const invalid = structuredClone(data);
  invalid.juzs[3].page = 61;
  assert.equal(validate(invalid, surahs, pages), false);
});

test("data bookmark lokal yang rusak tidak merusak tab Penanda", () => {
  const start = readerSource.indexOf("function getBk(");
  const end = readerSource.indexOf("\nasync function hasSession(", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const read = value => new Function("localStorage", `function bkKey(){return "key";}\n${readerSource.slice(start, end)}\nreturn getBk();`)({ getItem: () => value });
  assert.deepEqual(read('{"not":"a list"}'), []);
  assert.deepEqual(read('[{"s":2,"a":255,"v":"2:255"},{"s":0,"a":255,"v":"0:255"}]'), [{ s: 2, a: 255, v: "2:255" }]);
});

test("Juz dan posisi lanjut baca menuju ayat tanpa membuka sheet detail", async () => {
  const start = readerSource.indexOf("async function gotoAyat(");
  const end = readerSource.indexOf("\n\n// ── Tandai sudah dibaca", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const calls = { pages: [], verses: [], details: 0, closed: 0 };
  const run = new Function(
    "hideNav", "hideNotesPanel", "hideMorePanel", "loadIndex", "toast", "go", "scrollAyatIntoView", "openAyat", "options",
    `${readerSource.slice(start, end)}\nreturn gotoAyat(3,93,options);`,
  );
  const navigate = options => run(
    () => { calls.closed += 1; }, () => {}, () => {}, async () => ({ "3:93": 62 }), () => {},
    async page => { calls.pages.push(page); return true; }, verse => { calls.verses.push(verse); return true; },
    () => { calls.details += 1; },
    options,
  );
  assert.equal(await navigate({ openDetails: false }), true);
  assert.deepEqual(calls.pages, [62]);
  assert.deepEqual(calls.verses, ["3:93"]);
  assert.equal(calls.details, 0);
  assert.equal(await navigate({}), true);
  assert.equal(calls.details, 1);
});

test("navigasi detail menggulir ayat tujuan ke dalam viewport mushaf", () => {
  const start = readerSource.indexOf("function scrollAyatIntoView(");
  const end = readerSource.indexOf("\nasync function gotoAyat(", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const stage = { scrollTop: 20, clientTop: 0, getBoundingClientRect: () => ({ top: 100, bottom: 500 }) };
  const line = { getBoundingClientRect: () => ({ top: 480, bottom: 510 }) };
  const word = { dataset: { v: "3:93" }, closest: selector => selector === ".line" ? line : null };
  const box = { querySelectorAll: () => [word] };
  const document = { querySelector: () => stage, getElementById: () => box };
  const scroll = new Function("document", `${readerSource.slice(start, end)}\nreturn scrollAyatIntoView('3:93');`);
  assert.equal(scroll(document), true);
  assert.equal(stage.scrollTop, 30);
});

test("panel navigasi menyediakan tab aksesibel tanpa panel bookmark duplikat", () => {
  assert.match(readerSource, /role="tablist" aria-label="Jenis navigasi"/);
  for (const id of ["navTabSurah", "navTabJuz", "navTabPenanda"]) assert.match(readerSource, new RegExp(`id="${id}" role="tab"`));
  assert.doesNotMatch(readerSource, /id="bkPanel"/);
  assert.match(readerSource, /function openBkPanel\(\)\{ openNav\("penanda"\); \}/);
});

test("panah tab navigasi memindahkan fokus dan status tab tanpa memajukan mushaf", () => {
  const setStart = readerSource.indexOf("function setNavTab(");
  const setEnd = readerSource.indexOf("\nasync function openNav(", setStart);
  const setupStart = readerSource.indexOf("function setupNavigationTabs(");
  const setupEnd = readerSource.indexOf("\n\nasync function doSearch(", setupStart);
  assert.notEqual(setStart, -1);
  assert.notEqual(setEnd, -1);
  assert.notEqual(setupStart, -1);
  assert.notEqual(setupEnd, -1);
  const ids = ["navTabSurah", "navTabJuz", "navTabPenanda"];
  const elements = Object.fromEntries(ids.map(id => [id, {
    attributes: {}, tabIndex: -1, focus() { this.focused = true; },
    setAttribute(name, value) { this.attributes[name] = value; },
  }]));
  elements.q = { value: "", placeholder: "" };
  elements.navList = { setAttribute(name, value) { this[name] = value; } };
  elements.navPanel = { addEventListener(type, callback) { if (type === "keydown") this.handler = callback; } };
  const searches = [];
  const createHarness = new Function("document", "doSearch", `let ACTIVE_NAV_TAB="surah";\n${readerSource.slice(setStart, setEnd)}\n${readerSource.slice(setupStart, setupEnd)}\nsetupNavigationTabs(); return { get tab(){return ACTIVE_NAV_TAB;}, key:event=>document.getElementById("navPanel").handler(event) };`);
  const harness = createHarness({ getElementById: id => elements[id] }, value => searches.push(value));
  const event = key => ({ key, target: { matches: selector => selector === "[role='tab']" }, preventDefault() { this.prevented = true; } });
  const right = event("ArrowRight"); harness.key(right);
  assert.equal(right.prevented, true);
  assert.equal(harness.tab, "juz");
  assert.equal(elements.navTabJuz.attributes["aria-selected"], "true");
  assert.equal(elements.navList["aria-labelledby"], "navTabJuz");
  assert.deepEqual(searches, [""]);
});

test("mode fokus memulihkan posisi ayat yang sama di viewport", () => {
  const start = readerSource.indexOf("function toggleReaderChrome(");
  const end = readerSource.indexOf("\nfunction toggleFS(", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  let focused = false;
  const stage = { scrollTop: 100, getBoundingClientRect: () => ({ top: 0, bottom: 600 }) };
  const line = {
    getBoundingClientRect: () => ({ top: 260 - stage.scrollTop - (focused ? 60 : 0), bottom: 300 - stage.scrollTop - (focused ? 60 : 0) }),
    querySelector: selector => selector === ".w" ? { dataset: { v: "2:255" } } : null,
  };
  const toggle = { setAttribute() {}, focus() {} }, reveal = { setAttribute() {}, focus() {} };
  const body = { classList: { toggle() { focused = !focused; return focused; } } };
  const document = {
    body, querySelector: () => stage, querySelectorAll: () => [line],
    getElementById: id => id === "focusToggle" ? toggle : reveal,
  };
  const run = new Function("document", "syncPageIndicators", "requestAnimationFrame", `let page=353,renderedPage=353,lastReadingPosition=null,chromePositionAnchor=null;\n${readerSource.slice(start, end)}\ntoggleReaderChrome(); return {page,lastReadingPosition,chromePositionAnchor};`);
  const before = line.getBoundingClientRect().top;
  const state=run(document, () => {}, callback => callback());
  assert.equal(line.getBoundingClientRect().top, before);
  assert.equal(focused, true);
  assert.deepEqual(state.lastReadingPosition, { page: 353, v: "2:255" });
  assert.equal(state.chromePositionAnchor.scrollTop, stage.scrollTop);
});

test("tombol Berikutnya berada di kiri dan Sebelumnya di kanan", () => {
  const next = readerSource.indexOf('<button id="next"');
  const mark = readerSource.indexOf('<button id="markBtn"');
  const previous = readerSource.indexOf('<button id="prev"');
  assert.ok(next >= 0 && next < mark && mark < previous);
  assert.match(readerSource, /\.footer-controls #next\{order:1\}\.footer-controls #markBtn\{order:2\}\.footer-controls #prev\{order:3\}/);
});

test("kontrol baca menjaga target sentuh dan menyediakan menu ringkas di layar 320 px", () => {
  assert.match(readerSource, /\.icon-button\{[^}]*width:44px;height:44px/);
  assert.match(readerSource, /\.focus-reveal\{[^}]*min-height:44px/);
  assert.match(readerSource, /\.jump\{[^}]*height:44px/);
  assert.match(readerSource, /\.page-slider\{[^}]*height:44px/);
  assert.match(readerSource, /@media\(max-width:359px\)\{[\s\S]*?#notesToggle,#settingsToggle\{display:none\}[\s\S]*?#moreToggle\{display:grid\}/);
  assert.match(readerSource, /@media\(max-height:520px\) and \(min-width:640px\)\{[\s\S]*?\.footer-button\{min-height:44px/);
});

function extractFunction(name, nextName) {
  const start = readerSource.indexOf(`function ${name}(`);
  const end = readerSource.indexOf(`\nfunction ${nextName}(`, start);
  assert.notEqual(start, -1, `${name} exists in reader.html`);
  assert.notEqual(end, -1, `${nextName} follows ${name} in reader.html`);
  return readerSource.slice(start, end);
}

function makeClock() {
  let nextId = 0;
  const pending = new Map();
  return {
    setTimeout(callback) {
      const id = ++nextId;
      pending.set(id, callback);
      return id;
    },
    clearTimeout(id) { pending.delete(id); },
    runNext() {
      const first = pending.entries().next().value;
      if (!first) return false;
      pending.delete(first[0]); first[1](); return true;
    },
  };
}

function setupGestureHarness() {
  const listeners = {};
  const calls = { pages: [], verses: [], chrome: 0 };
  const stage = { addEventListener(type, callback) { listeners[type] = callback; } };
  const mushaf = { id: "mushaf", dataset: {}, closest: () => null };
  const window = { visualViewport: { scale: 1 }, addEventListener() {} };
  const document = {
    querySelector(selector) { assert.equal(selector, ".stage"); return stage; },
    getElementById(selector) { assert.equal(selector, "mushaf"); return mushaf; },
  };
  const clock = makeClock();
  const run = new Function(
    "document", "window", "go", "page", "scheduleReadingPositionSave",
    "saveReadingPosition", "hideSheet", "openAyat", "toggleReaderChrome",
    "navigator", "setTimeout", "clearTimeout",
    `${extractFunction("navigateByPhysicalDirection", "setupGestures")}\n${extractFunction("setupGestures", "setupKeyboard")}\nsetupGestures();`,
  );
  run(
    document, window, value => calls.pages.push(value), 353,
    () => {}, () => {}, () => {}, value => calls.verses.push(value),
    () => { calls.chrome += 1; }, {}, clock.setTimeout, clock.clearTimeout,
  );
  return { listeners, calls, mushaf, window, clock };
}

function setupKeyboardHarness() {
  let onKeyDown;
  const pages = [];
  const document = {
    addEventListener(type, callback) { if (type === "keydown") onKeyDown = callback; },
    querySelector() { return null; },
  };
  const run = new Function(
    "document", "window", "go", "page",
    `${extractFunction("navigateByPhysicalDirection", "setupGestures")}\n${extractFunction("setupKeyboard", "askConfirm")}\nsetupKeyboard();`,
  );
  run(document, {}, value => pages.push(value), 353);
  return { pages, key(key, target = "button") {
    onKeyDown({
      key, target: { matches: selector => selector.split(",").some(s => s.trim() === target) },
      altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
      preventDefault() {},
    });
  } };
}

function tap(harness, target, x = 100) {
  const eventTarget = target === harness.mushaf ? target : {
    dataset: { v: target.v || "1:1" },
    closest(selector) { return selector === ".w" && target.kind === "verse" ? this : null; },
  };
  harness.listeners.touchstart({ touches: [{ clientX: x, clientY: 100 }], target: eventTarget });
  harness.listeners.touchend({ touches: [], changedTouches: [{ clientX: x, clientY: 100 }] });
}

test("geser ke kiri membuka halaman berikutnya dan geser ke kanan membuka sebelumnya", () => {
  const harness = setupGestureHarness();
  tap(harness, { kind: "blank" }, 200);
  harness.listeners.touchend({ touches: [], changedTouches: [{ clientX: 100, clientY: 100 }] });
  assert.deepEqual(harness.calls.pages, [354]);

  tap(harness, { kind: "blank" }, 100);
  harness.listeners.touchend({ touches: [], changedTouches: [{ clientX: 200, clientY: 100 }] });
  assert.deepEqual(harness.calls.pages, [354, 352]);
});

test("panah kiri membuka halaman berikutnya dan panah kanan membuka sebelumnya", () => {
  const harness = setupKeyboardHarness();
  harness.key("ArrowLeft");
  harness.key("ArrowRight");
  assert.deepEqual(harness.pages, [354, 352]);
});

test("batas halaman menonaktifkan tombol arah yang keluar dari mushaf", () => {
  const start = readerSource.indexOf("function updateNav(");
  const end = readerSource.indexOf("\nfunction syncBackdrop(", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const nodes = Object.fromEntries(["prev", "next", "pageSlider", "jump", "railPage", "railJuz", "railCaption"].map(id => [id, {
    disabled: false, value: "", textContent: "", style: { setProperty() {} },
  }]));
  const document = { getElementById: id => nodes[id], documentElement: { style: { setProperty() {} } } };
  const update = new Function("document", "page", "currentJuz", `${readerSource.slice(start, end)}\nupdateNav();`);
  update(document, 1, 1);
  assert.equal(nodes.prev.disabled, true);
  assert.equal(nodes.next.disabled, false);
  update(document, 604, 30);
  assert.equal(nodes.prev.disabled, false);
  assert.equal(nodes.next.disabled, true);
});

test("indikator hanya menunjukkan angka halaman saat kontrol disembunyikan", () => {
  const start = readerSource.indexOf("function syncPageIndicators(");
  const end = readerSource.indexOf("\nfunction updateNav(", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const pageInfo = { textContent: "" };
  const body = { classList: { contains: name => name === "reader-focus" && focused } };
  let focused = false;
  const document = { body, getElementById: id => id === "pageInfo" ? pageInfo : null };
  const sync = new Function("document", "page", "currentJuz", `${readerSource.slice(start, end)}\nsyncPageIndicators();`);
  sync(document, 353, 25);
  assert.equal(pageInfo.textContent, "Juz 25");
  focused = true;
  sync(document, 353, 25);
  assert.equal(pageInfo.textContent, "Halaman 353 · Juz 25");
});

test("lompat halaman dan slider disinkronkan pada rentang 1 sampai 604", () => {
  const start = readerSource.indexOf("function updateNav(");
  const end = readerSource.indexOf("\nfunction syncBackdrop(", start);
  const nodes = Object.fromEntries(["prev", "next", "pageSlider", "jump", "railPage", "railJuz", "railCaption"].map(id => [id, {
    disabled: false, value: "", textContent: "", style: { setProperty() {} },
  }]));
  const document = { getElementById: id => nodes[id], documentElement: { style: { setProperty() {} } } };
  const update = new Function("document", "page", "currentJuz", `${readerSource.slice(start, end)}\nupdateNav();`);
  update(document, 353, 25);
  assert.equal(nodes.pageSlider.value, 353);
  assert.equal(nodes.jump.value, 353);
  assert.match(readerSource, /id="pageSlider" type="range" min="1" max="604"/);
  assert.match(readerSource, /id="jump" type="number" min="1" max="604"/);
});

test("ketuk latar mushaf mengganti mode kontrol, ketuk ayat membuka detail", () => {
  const harness = setupGestureHarness();
  const blank = harness.mushaf;
  const verse = { kind: "verse", dataset: { v: "2:255" } };
  verse.closest = selector => selector === ".w" ? verse : null;

  harness.listeners.click({ target: blank });
  harness.listeners.click({ target: verse });

  assert.equal(harness.calls.chrome, 1);
  assert.deepEqual(harness.calls.verses, ["2:255"]);
});

test("ketuk latar di ponsel tidak mengganti mode dua kali setelah event click susulan", () => {
  const harness = setupGestureHarness();
  tap(harness, harness.mushaf);
  harness.listeners.click({ target: harness.mushaf });

  assert.equal(harness.calls.chrome, 1);
});

test("ketuk elemen di dalam mushaf selain ayat tidak mengubah mode kontrol", () => {
  const harness = setupGestureHarness();
  const child = { dataset: {}, closest: () => null };
  harness.listeners.click({ target: child });
  assert.equal(harness.calls.chrome, 0);
  assert.deepEqual(harness.calls.verses, []);
});

test("geser halaman tidak ikut mengganti mode kontrol", () => {
  const harness = setupGestureHarness();
  harness.listeners.touchstart({ touches: [{ clientX: 200, clientY: 100 }], target: harness.mushaf });
  harness.listeners.touchend({ touches: [], changedTouches: [{ clientX: 100, clientY: 100 }] });
  assert.deepEqual(harness.calls.pages, [354]);
  assert.equal(harness.calls.chrome, 0);
});

test("gerakan sentuh yang sempat menggulir lalu kembali tidak dianggap ketuk kosong", () => {
  const harness = setupGestureHarness();
  harness.listeners.touchstart({ touches: [{ clientX: 100, clientY: 100 }], target: harness.mushaf });
  harness.listeners.touchmove({ touches: [{ clientX: 100, clientY: 116 }] });
  harness.listeners.touchmove({ touches: [{ clientX: 100, clientY: 100 }] });
  harness.listeners.touchend({ touches: [], changedTouches: [{ clientX: 100, clientY: 100 }] });
  assert.equal(harness.calls.chrome, 0);
});

test("tekan lama pada ayat membuka detail satu kali tanpa mengubah mode", () => {
  const harness = setupGestureHarness();
  const verse = { kind: "verse", v: "2:255" };
  const target = { dataset: { v: verse.v }, closest: selector => selector === ".w" ? target : null };
  harness.listeners.touchstart({ touches: [{ clientX: 100, clientY: 100 }], target });
  assert.equal(harness.clock.runNext(), true);
  harness.listeners.touchend({ touches: [], changedTouches: [{ clientX: 100, clientY: 100 }] });
  harness.listeners.click({ target });
  assert.deepEqual(harness.calls.verses, ["2:255"]);
  assert.equal(harness.calls.chrome, 0);
});

test("pinch zoom dan geser saat diperbesar tidak mengganti halaman atau mode", () => {
  const harness = setupGestureHarness();
  harness.window.visualViewport.scale = 2;
  harness.listeners.touchstart({ touches: [{ clientX: 100, clientY: 100 }, { clientX: 140, clientY: 100 }], target: harness.mushaf });
  harness.listeners.touchend({ touches: [], changedTouches: [{ clientX: 100, clientY: 100 }] });
  harness.listeners.touchstart({ touches: [{ clientX: 200, clientY: 100 }], target: harness.mushaf });
  harness.listeners.touchend({ touches: [], changedTouches: [{ clientX: 100, clientY: 100 }] });
  assert.deepEqual(harness.calls.pages, []);
  assert.equal(harness.calls.chrome, 0);
});
