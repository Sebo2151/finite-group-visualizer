import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { core, html, coreSource, projectRoot, contrastWithWhite } from "./core.mjs";

const { cayleyColors, cayleyDashes } = core;
const license = readFileSync(path.join(projectRoot, "LICENSE"), "utf8");
const readme = readFileSync(path.join(projectRoot, "README.md"), "utf8");

test("the core region is delimited exactly once", () => {
  assert.equal(html.split("/* core:start").length - 1, 1);
  assert.equal(html.split("/* core:end */").length - 1, 1);
  assert.ok(html.indexOf("/* core:start") < html.indexOf("/* core:end */"));
});

test("the core region touches no browser globals", () => {
  for (const global of ["document", "window", "performance", "requestAnimationFrame", "matchMedia"]) {
    assert.ok(!new RegExp(`\\b${global}\\b`).test(coreSource), `core region references ${global}`);
  }
});

test("the Cayley palette clears WCAG contrast against white", () => {
  assert.equal(cayleyColors.length, 8);
  assert.equal(new Set(cayleyColors).size, 8);
  for (const color of cayleyColors) {
    const ratio = contrastWithWhite(color);
    // 4.5:1 raw leaves headroom for the 0.82 stroke opacity, keeping the
    // rendered arrows above the 3:1 floor for non-text graphics.
    assert.ok(ratio >= 4.5, `${color} is only ${ratio.toFixed(2)}:1 against white`);
  }
});

test("each generator gets its own dash pattern as well as its own colour", () => {
  assert.equal(cayleyDashes.length, cayleyColors.length);
  assert.equal(new Set(cayleyDashes).size, cayleyDashes.length);
  for (const dash of cayleyDashes) {
    if (dash === "") continue;
    assert.match(dash, /^\d+(\.\d+)?( \d+(\.\d+)?)+$/, `malformed dash array "${dash}"`);
  }
});

test("colour slots are handed out by selection order, not by element", () => {
  const { nextCayleySlot } = core;
  // First two generators always take the first two colours, whichever
  // elements they happen to be.
  assert.equal(nextCayleySlot(new Set()), 0);
  assert.equal(nextCayleySlot(new Set([0])), 1);
  assert.equal(nextCayleySlot(new Set([0, 1])), 2);
  // A freed slot is reused, so the surviving generators keep their colours.
  assert.equal(nextCayleySlot(new Set([0, 2])), 1);
  assert.equal(nextCayleySlot(new Set([1, 2])), 0);
  // Never runs off the end of the palette.
  const full = new Set(core.cayleyColors.map((_, i) => i));
  assert.equal(nextCayleySlot(full), core.cayleyColors.length - 1);
});

test("the first colour slots stay apart for red-green colour blindness", () => {
  // Two or three generators is the common case, so the earliest slots carry
  // the most weight. Simulated deuteranopia must keep them separable.
  const deuteranope = (hex) => {
    const [r, g, b] = [1, 3, 5].map((o) => parseInt(hex.slice(o, o + 2), 16));
    return [0.625 * r + 0.375 * g, 0.7 * r + 0.3 * g, 0.3 * g + 0.7 * b];
  };
  const first = core.cayleyColors.slice(0, 3).map(deuteranope);
  for (let i = 0; i < first.length; i += 1) {
    for (let j = i + 1; j < first.length; j += 1) {
      const gap = Math.hypot(...first[i].map((v, k) => v - first[j][k]));
      assert.ok(gap > 100, `slots ${i} and ${j} are only ${gap.toFixed(0)} apart`);
    }
  }
});

test("the status line reserves its height so the figure cannot shift", () => {
  // A status naming a live operation wraps to a second line where "Ready"
  // does not; without a reserved height that pushed the figure down every
  // time an animation started.
  const block = html.match(/#status \{[^}]*\}/);
  assert.ok(block, "#status rule is missing");
  assert.match(block[0], /min-height:\s*2\.6em/);
  assert.match(block[0], /line-clamp:\s*2/);
  // The message has to stay short enough to fit those two lines on a narrow
  // phone, so the running state must not regain a prefix.
  assert.ok(!html.includes("Performing:"), "the status prefix is back");
});

test("muted body text clears WCAG AA", () => {
  const match = html.match(/--muted:\s*(#[0-9a-fA-F]{6})/);
  assert.ok(match, "--muted is not defined");
  const ratio = contrastWithWhite(match[1]);
  assert.ok(ratio >= 4.5, `--muted is only ${ratio.toFixed(2)}:1 against white`);
});

test("no low-contrast face captions remain", () => {
  for (const remnant of ["face-caption", "face-subcaption", "layout-captions", "frontSubcaption", "backSubcaption", "Front face", "Back face"]) {
    assert.ok(!html.includes(remnant), `index.html still mentions ${remnant}`);
  }
});

test("reduced motion is honoured in both CSS and script", () => {
  assert.match(html, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(html, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(html, /animationDurationMs\(reducedMotionQuery\.matches\)/);
});

test("a hidden tab settles the queue instead of stranding it", () => {
  assert.match(html, /visibilitychange/);
  assert.match(html, /document\.hidden.*flushAnimations|flushAnimations\(\)/s);
});

test("the Cayley side defaults to right multiplication", () => {
  assert.match(html, /name="cayley-side" value="right" checked/);
  assert.ok(!/name="cayley-side" value="left" checked/.test(html));
  assert.match(html, /input\.checked = input\.value === "right"/);
  assert.match(html, /\?\?\s*"right"/, "the side fallback should also be right");
});

test("the Cayley radios are labelled with the formulas they draw", () => {
  assert.match(html, /x &mapsto; xg/);
  assert.match(html, /x &mapsto; gx/);
});

test("overlays are rebuilt rather than cleared while animating", () => {
  // The old code hid both overlays for the duration of an animation; the
  // arrows are now re-aimed every frame instead.
  assert.ok(!html.includes("clearCayleyGraph"), "clearCayleyGraph should be gone");
  assert.match(html, /updateOverlayGeometry\(\);\s*\n\s*requestAnimationFrame\(frame\)/);
});

test("the page is fully self-contained", () => {
  assert.ok(!/<script[^>]+\ssrc=/i.test(html), "external script");
  assert.ok(!/<link[^>]+rel=["']stylesheet/i.test(html), "external stylesheet");
  assert.ok(!/@import/i.test(html), "CSS @import");
  const remoteRefs = [...html.matchAll(/(?:href|src)=["'](https?:[^"']+)["']/gi)];
  assert.deepEqual(remoteRefs.map((m) => m[1]), [], "remote resource reference");
});

test("attribution appears on the page", () => {
  assert.match(html, /Sebastian Bozlee/);
  assert.match(html, /Wake Forest University/);
  assert.match(html, /bozlees@wfu\.edu/);
  assert.match(html, /ChatGPT and Claude/);
  assert.match(html, /MIT License/);
  assert.match(html, /<meta name="author" content="Sebastian Bozlee"/);
});

test("the MIT licence names the author", () => {
  assert.match(license, /^MIT License/);
  assert.match(license, /Copyright \(c\) \d{4} Sebastian Bozlee, Wake Forest University/);
  assert.match(license, /WITHOUT WARRANTY OF ANY KIND/);
});

test("the README carries the same attribution and licence", () => {
  assert.match(readme, /Sebastian Bozlee/);
  assert.match(readme, /Wake Forest University/);
  assert.match(readme, /bozlees@wfu\.edu/);
  assert.match(readme, /ChatGPT and Claude/);
  assert.match(readme, /MIT/);
  assert.match(readme, /node --test "tests\/\*\.test\.mjs"/);
});
