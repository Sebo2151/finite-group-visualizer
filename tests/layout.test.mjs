import { test } from "node:test";
import assert from "node:assert/strict";

import {
  core, groups, groupKeys, idsOf, hypot, circuitsOf, isConvexCircuit, perpendicularDistance,
  bruteForceOrder
} from "./core.mjs";

const {
  DOT_RADIUS, slotPositionsFor, cayleyArrows, cubeSlotPositions,
  buildFourCycleSegments, cubicPoint
} = core;

const VIEW = { width: core.VIEW_WIDTH, height: core.VIEW_HEIGHT };
const near = (a, b, tolerance = 1e-6) => Math.abs(a - b) <= tolerance;

/** How far along ab the foot of `point` falls; between 0 and 1 means the third
 *  dot sits between the other two rather than off one end. */
function projectionParameter(a, b, point) {
  return ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / hypot(a, b) ** 2;
}

test("both cube faces are squares of the same size", () => {
  const front = [0, 1, 2, 3].map((i) => cubeSlotPositions[i]);
  const back = [4, 5, 6, 7].map((i) => cubeSlotPositions[i]);
  for (const [name, face] of [["front", front], ["back", back]]) {
    const sides = face.map((corner, i) => hypot(corner, face[(i + 1) % 4]));
    for (const side of sides) {
      assert.ok(near(side, sides[0], 1e-9), `${name} face is not equilateral: ${sides}`);
    }
    // Equal diagonals turn an equilateral quadrilateral into a square.
    assert.ok(near(hypot(face[0], face[2]), hypot(face[1], face[3]), 1e-9),
      `${name} face is a rhombus, not a square`);
    assert.ok(near(hypot(face[0], face[2]), sides[0] * Math.SQRT2, 1e-9),
      `${name} face diagonal does not match a square's`);
  }
  assert.ok(near(hypot(front[0], front[1]), hypot(back[0], back[1]), 1e-9),
    "the two faces are different sizes");
});

test("the cube is a true parallel projection", () => {
  // One shared depth offset for all four verticals — the old layout used four
  // slightly different ones, which made the back face smaller than the front.
  const offsets = [0, 1, 2, 3].map((i) => ({
    x: cubeSlotPositions[i + 4].x - cubeSlotPositions[i].x,
    y: cubeSlotPositions[i + 4].y - cubeSlotPositions[i].y
  }));
  for (const offset of offsets) {
    assert.ok(near(offset.x, offsets[0].x, 1e-9) && near(offset.y, offsets[0].y, 1e-9),
      `depth offsets differ: ${JSON.stringify(offsets)}`);
  }
});

test("the cube's depth runs at the configured tilt right of vertical", () => {
  const offset = {
    x: cubeSlotPositions[4].x - cubeSlotPositions[0].x,
    y: cubeSlotPositions[4].y - cubeSlotPositions[0].y
  };
  assert.ok(offset.x > 0 && offset.y < 0, "the back face should sit up and to the right");
  const degreesRightOfVertical = Math.atan2(offset.x, -offset.y) * 180 / Math.PI;
  assert.ok(near(degreesRightOfVertical, core.CUBE_TILT_DEGREES, 1e-9),
    `depth runs ${degreesRightOfVertical.toFixed(4)}°, not the configured ${core.CUBE_TILT_DEGREES}°`);
  assert.ok(Math.abs(core.CUBE_TILT_DEGREES - 45) >= 15,
    "the tilt has drifted towards the degenerate 45°");
});

test("the depth ratio avoids dropping a back corner onto a face diagonal", () => {
  // At depth = side / (sin θ + cos θ) the back lower left corner lands exactly
  // on the front face's diagonal, and any arrow along that diagonal runs
  // straight through it. That ratio sits around 0.62, so the real depth has to
  // stay clear of it — which is why the foreshortening cannot simply be dialled
  // up towards 1.
  const tilt = core.CUBE_TILT_DEGREES * Math.PI / 180;
  const degenerate = 1 / (Math.sin(tilt) + Math.cos(tilt));
  const actual = core.CUBE_DEPTH / core.CUBE_SIDE;
  assert.ok(Math.abs(actual - degenerate) > 0.02,
    `depth ratio ${actual.toFixed(3)} is too close to the degenerate ${degenerate.toFixed(3)}`);
});

test("the cube's shortest edge still carries a readable arrow", () => {
  const shaft = Math.min(core.CUBE_SIDE, core.CUBE_DEPTH)
    - core.START_ARROW_CLEARANCE - core.END_ARROW_CLEARANCE;
  assert.ok(shaft > 60, `shortest edge leaves only ${shaft}px of visible arrow`);
  const foreshortening = core.CUBE_DEPTH / core.CUBE_SIDE;
  assert.ok(foreshortening > 0.55 && foreshortening < 0.72,
    `foreshortening ${foreshortening.toFixed(3)} is outside the intended band`);
});

test("the cube's lower-left and upper-right corners are well off one line", () => {
  // At 45° the front-lower-left, back-lower-left, front-upper-right and
  // back-upper-right corners collapse onto a single straight line. The 30°
  // tilt exists to prevent exactly that.
  const [, upperRightFront, , lowerLeftFront] = cubeSlotPositions;
  const lowerLeftBack = cubeSlotPositions[7];
  const upperRightBack = cubeSlotPositions[5];
  for (const corner of [upperRightFront, upperRightBack]) {
    assert.ok(perpendicularDistance(lowerLeftFront, lowerLeftBack, corner) > 60,
      "the four corners are nearly collinear again");
  }
});

for (const key of groupKeys) {
  const group = groups[key];
  const positions = slotPositionsFor(group);
  const points = [...positions.values()];

  test(`${key}: the layout is centred and fits the viewBox`, () => {
    for (const point of points) {
      assert.ok(point.x - DOT_RADIUS >= 0 && point.x + DOT_RADIUS <= VIEW.width, `x ${point.x}`);
      assert.ok(point.y - DOT_RADIUS >= 0 && point.y + DOT_RADIUS <= VIEW.height, `y ${point.y}`);
    }
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const boxCenter = {
      x: (Math.min(...xs) + Math.max(...xs)) / 2,
      y: (Math.min(...ys) + Math.max(...ys)) / 2
    };
    assert.ok(near(boxCenter.x, group.visualCenter.x, 1e-6), "visualCenter is off horizontally");
    assert.ok(near(boxCenter.y, group.visualCenter.y, 1e-6), "visualCenter is off vertically");
  });

  test(`${key}: no dot sits on the line between two others`, () => {
    const ids = idsOf(group);
    for (const a of ids) {
      for (const b of ids) {
        if (a >= b) continue;
        for (const c of ids) {
          if (c === a || c === b) continue;
          const t = projectionParameter(positions.get(a), positions.get(b), positions.get(c));
          if (t <= 0.05 || t >= 0.95) continue;
          // A full dot radius, so no arrow ever has to run behind a dot that
          // is not one of its own endpoints.
          assert.ok(
            perpendicularDistance(positions.get(a), positions.get(b), positions.get(c)) > DOT_RADIUS,
            `${c} lies on the line from ${a} to ${b}`
          );
        }
      }
    }
  });

  test(`${key}: dots stay on screen while a four-cycle animates`, () => {
    // The rounded circuit an order-four multiplication travels bows about an
    // eighth of a side outside its face, so this — not the resting layout — is
    // what caps how large the figure can be.
    for (const elementId of idsOf(group)) {
      if (bruteForceOrder(group, elementId) !== 4) continue;
      for (const side of ["left", "right"]) {
        const segments = buildFourCycleSegments(group, positions, { side, elementId });
        for (const [id, curve] of segments) {
          for (let t = 0; t <= 1; t += 0.02) {
            const point = cubicPoint(curve, t);
            assert.ok(
              point.x - DOT_RADIUS >= 0 && point.x + DOT_RADIUS <= VIEW.width
              && point.y - DOT_RADIUS >= 0 && point.y + DOT_RADIUS <= VIEW.height,
              `${side} ${elementId}: ${id} leaves the canvas at t=${t.toFixed(2)}`
            );
          }
        }
      }
    }
  });

  test(`${key}: dots never overlap`, () => {
    const ids = idsOf(group);
    for (const a of ids) {
      for (const b of ids) {
        if (a >= b) continue;
        assert.ok(hypot(positions.get(a), positions.get(b)) > DOT_RADIUS * 2 + 20,
          `${a} and ${b} are crowded`);
      }
    }
  });
}

test("Q8 matches the standard hexagon-and-poles diagram", () => {
  const group = groups.Q8;
  const positions = slotPositionsFor(group);
  const center = group.visualCenter;
  const angleOf = (id) => {
    const point = positions.get(id);
    const degrees = Math.atan2(center.y - point.y, point.x - center.x) * 180 / Math.PI;
    return (degrees + 360) % 360;
  };
  const radiusOf = (id) => hypot(positions.get(id), center);

  // 1 and −1 sit on a short vertical axis through the middle.
  assert.ok(near(positions.get("one").x, center.x, 1e-9));
  assert.ok(near(positions.get("minusOne").x, center.x, 1e-9));
  assert.ok(positions.get("one").y < center.y, "1 should be the upper pole");
  assert.ok(near(radiusOf("one"), radiusOf("minusOne"), 1e-9));

  // ±i, ±j, ±k form a regular hexagon around them.
  const ring = ["minusI", "k", "j", "i", "minusK", "minusJ"];
  const expectedAngles = [0, 60, 120, 180, 240, 300];
  ring.forEach((id, index) => {
    assert.ok(near(angleOf(id), expectedAngles[index], 1e-6),
      `${id} sits at ${angleOf(id).toFixed(2)}°, expected ${expectedAngles[index]}°`);
    assert.ok(near(radiusOf(id), radiusOf(ring[0]), 1e-9), `${id} is off the ring`);
  });
  assert.ok(radiusOf("i") > radiusOf("one"), "the poles should sit inside the ring");

  // Each element sits directly opposite its negative.
  for (const [element, negative] of [["one", "minusOne"], ["i", "minusI"], ["j", "minusJ"], ["k", "minusK"]]) {
    const a = positions.get(element);
    const b = positions.get(negative);
    assert.ok(near((a.x + b.x) / 2, center.x, 1e-9) && near((a.y + b.y) / 2, center.y, 1e-9),
      `${element} and ${negative} are not antipodal`);
  }
});

test("every circuit in the Q8 layout closes up as a convex quadrilateral", () => {
  // This is the whole point of moving Q8 off the cube: on the cube, ⟨j⟩ and
  // ⟨i⟩j traced self-crossing quadrilaterals with no inside to bow away from.
  const group = groups.Q8;
  const positions = slotPositionsFor(group);
  let checked = 0;
  for (const side of ["left", "right"]) {
    for (const generatorId of idsOf(group)) {
      for (const circuit of circuitsOf(cayleyArrows(group, positions, generatorId, side))) {
        if (circuit.length < 3) continue;
        assert.ok(isConvexCircuit(circuit, (id) => positions.get(id)),
          `${side} multiplication by ${generatorId}: ${circuit.join(" → ")} is not convex`);
        checked += 1;
      }
    }
  }
  assert.ok(checked >= 12, `only ${checked} circuits examined`);
});
