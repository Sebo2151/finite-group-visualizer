import { test } from "node:test";
import assert from "node:assert/strict";

import {
  core, groups, groupKeys, idsOf, bruteForceOrder, pathNumbers, quadraticPoints, hypot,
  circuitsOf, isConvexCircuit, PATH_PRECISION, perpendicularDistance
} from "./core.mjs";

const {
  ANIMATION_DURATION_MS, DOT_RADIUS, slotPositionsFor, applyOperationWith,
  animationDurationMs, easeInOutCubic, distance, buildFourCycleSegments, cubicPoint,
  arrowPathBetween, loopPathAt, pathForArrow, projectImages, previewArrows,
  cayleyArrows, isInvolution
} = core;

const identityImages = (group) => new Map(idsOf(group).map((id) => [id, id]));

test("animation duration collapses to zero under prefers-reduced-motion", () => {
  assert.equal(animationDurationMs(false), ANIMATION_DURATION_MS);
  assert.equal(animationDurationMs(true), 0);
});

test("the easing curve is a well-behaved 0→1 ramp", () => {
  assert.equal(easeInOutCubic(0), 0);
  assert.equal(easeInOutCubic(1), 1);
  assert.ok(Math.abs(easeInOutCubic(0.5) - 0.5) < 1e-12);
  for (let t = 0; t < 1; t += 0.05) {
    assert.ok(easeInOutCubic(t + 0.05) > easeInOutCubic(t), `not increasing at ${t}`);
  }
});

test("arrow geometry depends on nothing but the endpoints and the layout centre", () => {
  const a = { x: 100, y: 120 };
  const b = { x: 300, y: 260 };
  const center = { x: 350, y: 230 };
  assert.equal(arrowPathBetween(a, b), arrowPathBetween({ ...a }, { ...b }));
  assert.equal(arrowPathBetween(a, b, center), arrowPathBetween({ ...a }, { ...b }, { ...center }));
  assert.notEqual(arrowPathBetween(a, b), arrowPathBetween(b, a),
    "opposite arrows should bow to opposite sides so both stay visible");
});

test("a circuit centre swings the bend outward whichever way the arrow runs", () => {
  const center = { x: 415, y: 177.5 };
  const a = { x: 295, y: 85 };
  const b = { x: 295, y: 270 };
  for (const [source, target] of [[a, b], [b, a]]) {
    const { control, middle } = quadraticPoints(arrowPathBetween(source, target, center));
    assert.ok(hypot(control, center) > hypot(middle, center) + 10,
      "arrow bows towards the centre of its circuit");
  }
  // With no centre the two directions bow to opposite sides, which is what
  // keeps a mutual pair of arrows from landing on top of each other.
  const forward = quadraticPoints(arrowPathBetween(a, b));
  const backward = quadraticPoints(arrowPathBetween(b, a));
  assert.ok(hypot(forward.control, backward.control) > 20, "mutual pair collapsed onto one curve");
});

test("the outward swing eases through straight instead of snapping over", () => {
  // A chord sweeping past its circuit's centre passes through the ambiguous
  // orientation; the bend must shrink smoothly rather than flip in one frame.
  const center = { x: 350, y: 230 };
  const samples = [];
  for (let offset = -40; offset <= 40; offset += 2) {
    const { control, middle } = quadraticPoints(
      arrowPathBetween({ x: 250 + offset, y: 130 }, { x: 450 + offset, y: 330 }, center)
    );
    samples.push((control.x - middle.x) - (control.y - middle.y));
  }
  const steps = samples.slice(1).map((value, i) => Math.abs(value - samples[i]));
  assert.ok(Math.max(...steps) < 12, `bend jumped by ${Math.max(...steps).toFixed(1)} between samples`);
  assert.ok(samples[0] * samples[samples.length - 1] < 0, "the sweep never crossed over");
});

test("arrows clear the dots at both ends", () => {
  const a = { x: 165, y: 170 };
  const b = { x: 425, y: 170 };
  const [sx, sy, cx, cy, ex, ey] = pathNumbers(arrowPathBetween(a, b));
  assert.ok([sx, sy, cx, cy, ex, ey].every(Number.isFinite));
  assert.ok(distance({ x: sx, y: sy }, a) >= DOT_RADIUS, "start overlaps the source dot");
  assert.ok(distance({ x: ex, y: ey }, b) >= DOT_RADIUS, "end overlaps the target dot");
  assert.ok(distance({ x: cx, y: cy }, { x: (sx + ex) / 2, y: (sy + ey) / 2 }) > 1, "arrow is not bowed");
});

test("degenerate separations fall back to a loop instead of NaN", () => {
  assert.equal(arrowPathBetween({ x: 10, y: 10 }, { x: 10, y: 12 }), null);
  const fallback = pathForArrow({ from: { x: 10, y: 10 }, to: { x: 10, y: 12 }, loop: false }, { x: 0, y: 0 });
  assert.match(fallback, /^M [\d.-]+ [\d.-]+ C /);
  assert.ok(!fallback.includes("NaN"));
});

test("loops flare away from the middle of the layout", () => {
  const center = { x: 350, y: 245 };
  const ys = pathNumbers(loopPathAt({ x: 350, y: 70 }, center)).filter((_, i) => i % 2 === 1);
  assert.ok(ys.every((y) => y < 70), "loop on the top dot should sit above it");
  assert.ok(ys.every((y) => y > -10), "loop should stay inside the 0–500 viewBox");
});

for (const key of groupKeys) {
  const group = groups[key];
  const positions = slotPositionsFor(group);
  const ids = idsOf(group);

  test(`${key}: order-four multiplications decompose into four-cycles`, () => {
    for (const elementId of ids) {
      if (bruteForceOrder(group, elementId) !== 4) continue;
      for (const side of ["left", "right"]) {
        const operation = { side, elementId };
        const segments = buildFourCycleSegments(group, positions, operation);
        assert.equal(segments.size, 8, `${side} ${elementId}`);
        for (const id of ids) {
          const segment = segments.get(id);
          const target = applyOperationWith(group, operation, id);
          assert.deepEqual(segment.p0, { ...positions.get(id) }, `${id} start`);
          assert.deepEqual(segment.p3, { ...positions.get(target) }, `${id} end`);
        }
      }
    }
  });

  test(`${key}: the four-cycle path is only defined for order-four elements`, () => {
    for (const elementId of ids) {
      if (bruteForceOrder(group, elementId) === 4) continue;
      assert.throws(
        () => buildFourCycleSegments(group, positions, { side: "left", elementId }),
        /four-cycles/,
        `${elementId} should not produce four-cycles`
      );
    }
  });

  test(`${key}: preview and Cayley arrows coincide when they share endpoints`, () => {
    // At rest the preview of "multiply by g" and the Cayley arrows for g run
    // between exactly the same dots, so the two overlays must draw identically.
    for (const side of ["left", "right"]) {
      for (const generatorId of ids) {
        const preview = previewArrows(
          group, positions, identityImages(group), [], { side, elementId: generatorId }
        );
        const cayley = cayleyArrows(group, positions, generatorId, side);
        assert.deepEqual(
          preview.map((arrow) => pathForArrow(arrow, group.visualCenter)),
          cayley.map((arrow) => pathForArrow(arrow, group.visualCenter)),
          `${side} multiplication by ${generatorId}`
        );
        assert.deepEqual(preview.map((a) => a.loop), cayley.map((a) => a.loop));
      }
    }
  });

  test(`${key}: only the identity draws loops`, () => {
    for (const side of ["left", "right"]) {
      for (const generatorId of ids) {
        const loops = cayleyArrows(group, positions, generatorId, side).filter((arrow) => arrow.loop);
        assert.equal(loops.length, generatorId === group.identityId ? 8 : 0,
          `${side} ${generatorId}`);
      }
    }
  });

  test(`${key}: no arrow in a circuit ever bows inward`, () => {
    // The failure this pins down: a face traversed counter-clockwise used to
    // bow towards its own centre, drawing a four-pointed star instead of a
    // rounded circuit.
    for (const side of ["left", "right"]) {
      for (const generatorId of ids) {
        if (generatorId === group.identityId || isInvolution(group, generatorId)) continue;
        for (const arrow of cayleyArrows(group, positions, generatorId, side)) {
          const { control, middle } = quadraticPoints(pathForArrow(arrow, group.visualCenter));
          assert.ok(
            hypot(control, arrow.center) >= hypot(middle, arrow.center) - PATH_PRECISION,
            `${side} ${generatorId}: ${arrow.id} → ${arrow.targetId} bows inward`
          );
        }
      }
    }
  });

  test(`${key}: every convex circuit is visibly rounded in both directions`, () => {
    // Where the circuit really is a simple convex polygon — the cube faces and
    // the octagon's sub-cycles — the arrows must bow out by a visible margin,
    // not just by a hair, no matter which way round they run.
    let checked = 0;
    for (const side of ["left", "right"]) {
      for (const generatorId of ids) {
        if (generatorId === group.identityId || isInvolution(group, generatorId)) continue;
        const arrows = cayleyArrows(group, positions, generatorId, side);
        const byId = new Map(arrows.map((arrow) => [arrow.id, arrow]));
        for (const circuit of circuitsOf(arrows)) {
          if (!isConvexCircuit(circuit, (id) => positions.get(id))) continue;
          for (const id of circuit) {
            const arrow = byId.get(id);
            const { start, control, end } = quadraticPoints(pathForArrow(arrow, group.visualCenter));
            // Measured off the chord, not as a change in radius: a chord that
            // points nearly straight at its circuit's centre can be strongly
            // bowed while barely moving further out.
            assert.ok(
              perpendicularDistance(start, end, control) > 12,
              `${side} ${generatorId}: ${arrow.id} → ${arrow.targetId} is nearly straight`
            );
            checked += 1;
          }
        }
      }
    }
    const hasHigherOrder = ids.some((id) => bruteForceOrder(group, id) > 2);
    if (hasHigherOrder) assert.ok(checked > 0, "no convex circuit was examined");
  });

  test(`${key}: mutually paired arrows stay visibly apart`, () => {
    for (const side of ["left", "right"]) {
      for (const generatorId of ids) {
        if (!isInvolution(group, generatorId)) continue;
        const byPair = new Map();
        for (const arrow of cayleyArrows(group, positions, generatorId, side)) {
          byPair.set(`${arrow.id}->${arrow.targetId}`, quadraticPoints(pathForArrow(arrow, group.visualCenter)));
        }
        for (const [pairKey, forward] of byPair) {
          const [from, to] = pairKey.split("->");
          const backward = byPair.get(`${to}->${from}`);
          assert.ok(backward, `${generatorId} is an involution but ${to} → ${from} is missing`);
          assert.ok(hypot(forward.control, backward.control) > 20,
            `${side} ${generatorId}: ${pairKey} overlaps its reverse`);
        }
      }
    }
  });

  test(`${key}: queued operations project to the composite x ↦ axb`, () => {
    const left = ids[3];
    const right = ids[5];
    const pending = [
      { side: "left", elementId: left },
      { side: "right", elementId: right }
    ];
    const projected = projectImages(group, identityImages(group), pending);
    for (const id of ids) {
      assert.equal(projected.get(id), group.multiply(group.multiply(left, id), right), `image of ${id}`);
    }
    // Reversing the click order must give the same net map.
    const reversed = projectImages(group, identityImages(group), [...pending].reverse());
    assert.deepEqual([...reversed.entries()].sort(), [...projected.entries()].sort());
  });

  test(`${key}: at rest a preview points straight at the destination slot`, () => {
    for (const side of ["left", "right"]) {
      for (const hoveredId of ids) {
        const arrows = previewArrows(
          group, positions, identityImages(group), [], { side, elementId: hoveredId }
        );
        for (const arrow of arrows) {
          const destination = side === "left"
            ? group.multiply(hoveredId, arrow.id)
            : group.multiply(arrow.id, hoveredId);
          assert.deepEqual(arrow.to, positions.get(destination), `${side} target for ${arrow.id}`);
        }
      }
    }
  });

  test(`${key}: both ends of a preview arrow are live dots`, () => {
    // Mid-animation every dot is off its slot, so neither endpoint may be
    // read from the static layout — both have to come from the live map.
    const pending = [{ side: "left", elementId: ids[2] }];
    const hoveredId = ids[6];
    const live = new Map(ids.map((id, n) => [id, { x: 40 + 80 * n, y: 60 + 40 * n }]));
    const arrows = previewArrows(
      group, live, identityImages(group), pending, { side: "left", elementId: hoveredId }
    );
    const projected = projectImages(group, identityImages(group), pending);
    const slotValues = new Set([...positions.values()].map((p) => `${p.x},${p.y}`));
    for (const arrow of arrows) {
      assert.deepEqual(arrow.from, live.get(arrow.id), `tail of ${arrow.id}`);
      assert.deepEqual(arrow.to, live.get(arrow.targetId), `head of ${arrow.id}`);
      assert.ok(!slotValues.has(`${arrow.to.x},${arrow.to.y}`), "head is pinned to a static slot");
      // The dot at the head is exactly the one heading for the destination.
      assert.equal(
        projected.get(arrow.targetId),
        group.multiply(hoveredId, projected.get(arrow.id)),
        `head of ${arrow.id} is not the label that lands on the destination`
      );
    }
  });

  test(`${key}: a preview arrow's head lands on the destination slot`, () => {
    // Following the target dot must not change where the arrow finishes: once
    // the queue drains, the head is standing on the slot the source moves to.
    const pending = [{ side: "right", elementId: ids[3] }];
    const hoveredId = ids[5];
    const settled = projectImages(group, identityImages(group), pending);
    const settledCoordinates = new Map(ids.map((id) => [id, positions.get(settled.get(id))]));
    const arrows = previewArrows(
      group, settledCoordinates, identityImages(group), pending, { side: "right", elementId: hoveredId }
    );
    for (const arrow of arrows) {
      const destination = group.multiply(settled.get(arrow.id), hoveredId);
      assert.deepEqual(arrow.to, positions.get(destination), `settled target for ${arrow.id}`);
    }
  });

  test(`${key}: every drawn loop stays inside the viewBox`, () => {
    // Sampled along the curve rather than checked at the control points, which
    // sit well outside the path a cubic actually traces.
    for (const point of positions.values()) {
      const [x0, y0, x1, y1, x2, y2, x3, y3] = pathNumbers(loopPathAt(point, group.visualCenter));
      const curve = {
        p0: { x: x0, y: y0 }, p1: { x: x1, y: y1 },
        p2: { x: x2, y: y2 }, p3: { x: x3, y: y3 }
      };
      for (let t = 0; t <= 1; t += 0.02) {
        const q = cubicPoint(curve, t);
        assert.ok(q.x >= 0 && q.x <= 720 && q.y >= 0 && q.y <= 500,
          `loop at (${point.x.toFixed(0)}, ${point.y.toFixed(0)}) leaves the canvas`);
      }
    }
  });
}

test("D8's counter-clockwise back face is as rounded as its clockwise front face", () => {
  // The reported bug, at the exact spot it showed up: right-multiplying by r
  // runs the front face clockwise and the back face counter-clockwise, and the
  // back four used to bend inward into a four-pointed star.
  const group = groups.D8;
  const positions = slotPositionsFor(group);
  const front = ["e", "r", "r2", "r3"];
  const bulgeOf = (arrow) => {
    const { control, middle } = quadraticPoints(pathForArrow(arrow, group.visualCenter));
    return hypot(control, arrow.center) - hypot(middle, arrow.center);
  };
  const arrows = cayleyArrows(group, positions, "r", "right");
  const frontBulges = arrows.filter((a) => front.includes(a.id)).map(bulgeOf);
  const backBulges = arrows.filter((a) => !front.includes(a.id)).map(bulgeOf);
  assert.equal(frontBulges.length, 4);
  assert.equal(backBulges.length, 4);
  for (const bulge of [...frontBulges, ...backBulges]) {
    assert.ok(bulge > 10, `arrow bulges only ${bulge.toFixed(1)}px away from its circuit`);
  }
  // The projected back face is slightly smaller than the front one, so the two
  // circuits bow by similar rather than identical amounts.
  const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;
  const ratio = mean(backBulges) / mean(frontBulges);
  assert.ok(ratio > 0.8 && ratio < 1.25,
    `back face bows ${ratio.toFixed(2)}× as much as the front face`);
});

test("Cayley arrows follow the dots rather than the slots", () => {
  // After a net transformation the dots sit somewhere else; the arrows are
  // built from live coordinates, so the whole picture moves rigidly with them.
  const group = groups.D8;
  const positions = slotPositionsFor(group);
  const displaced = new Map(
    idsOf(group).map((id) => [id, positions.get(group.multiply("s", id))])
  );
  const arrows = cayleyArrows(group, displaced, "r", "right");
  for (const arrow of arrows) {
    assert.deepEqual(arrow.from, positions.get(group.multiply("s", arrow.id)));
    assert.deepEqual(arrow.to, positions.get(group.multiply("s", arrow.targetId)));
  }
});
