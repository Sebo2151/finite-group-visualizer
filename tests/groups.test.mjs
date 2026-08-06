import { test } from "node:test";
import assert from "node:assert/strict";

import {
  core, groups, groupKeys, idsOf, bruteForceOrder, orderProfile, isAbelian,
  centerOf, generatedBy, inverseOf, cubeEdgeSet, cayleyEdgeSet, sameSet
} from "./core.mjs";

const { slotPositionsFor, elementOrderIn } = core;

test("all five groups of order 8 are present", () => {
  assert.deepEqual(groupKeys.sort(), ["C2xC2xC2", "C4xC2", "C8", "D8", "Q8"]);
});

for (const key of groupKeys) {
  const group = groups[key];
  const ids = idsOf(group);

  test(`${key}: has eight distinct elements`, () => {
    assert.equal(ids.length, 8);
    assert.equal(new Set(ids).size, 8);
  });

  test(`${key}: multiplication is closed`, () => {
    for (const a of ids) {
      for (const b of ids) {
        assert.ok(ids.includes(group.multiply(a, b)), `${a}·${b} left the group`);
      }
    }
  });

  test(`${key}: the identity is two-sided`, () => {
    for (const a of ids) {
      assert.equal(group.multiply(group.identityId, a), a);
      assert.equal(group.multiply(a, group.identityId), a);
    }
  });

  test(`${key}: multiplication is associative`, () => {
    for (const a of ids) {
      for (const b of ids) {
        for (const c of ids) {
          assert.equal(
            group.multiply(group.multiply(a, b), c),
            group.multiply(a, group.multiply(b, c)),
            `(${a}${b})${c} ≠ ${a}(${b}${c})`
          );
        }
      }
    }
  });

  test(`${key}: every element has a two-sided inverse`, () => {
    for (const a of ids) {
      const inverse = inverseOf(group, a);
      assert.ok(inverse, `${a} has no right inverse`);
      assert.equal(group.multiply(inverse, a), group.identityId, `${a} has no left inverse`);
    }
  });

  test(`${key}: the Cayley table is a Latin square`, () => {
    for (const a of ids) {
      assert.equal(new Set(ids.map((b) => group.multiply(a, b))).size, 8, `row ${a} repeats`);
      assert.equal(new Set(ids.map((b) => group.multiply(b, a))).size, 8, `column ${a} repeats`);
    }
  });

  test(`${key}: elementOrderIn agrees with brute force`, () => {
    for (const a of ids) {
      assert.equal(elementOrderIn(group, a), bruteForceOrder(group, a), `order of ${a}`);
    }
  });

  test(`${key}: left and right translations commute`, () => {
    // This is what makes the "x ↦ axb" readout well defined no matter what
    // order the user clicks the left and right buttons in.
    for (const a of ids) {
      for (const b of ids) {
        for (const x of ids) {
          assert.equal(group.multiply(a, group.multiply(x, b)), group.multiply(group.multiply(a, x), b));
        }
      }
    }
  });

  test(`${key}: slotOrder is a bijection onto eight distinct positions`, () => {
    assert.equal(group.slotOrder.length, 8);
    assert.equal(new Set(group.slotOrder).size, 8);
    for (const id of group.slotOrder) assert.ok(ids.includes(id), `unknown slot occupant ${id}`);
    assert.equal(group.slotPositions.length, 8);
    const seen = new Set(group.slotPositions.map((p) => `${p.x},${p.y}`));
    assert.equal(seen.size, 8, "two elements share a slot");
    const positions = slotPositionsFor(group);
    assert.equal(positions.size, 8);
  });

  test(`${key}: the default generators generate the whole group`, () => {
    assert.ok(group.defaultGenerators.length > 0, "no default generators");
    for (const id of group.defaultGenerators) assert.ok(ids.includes(id), `unknown generator ${id}`);
    assert.equal(generatedBy(group, group.defaultGenerators).size, 8);
  });

  test(`${key}: the legend states a presentation`, () => {
    assert.match(group.legendHTML, /^Presentation: /);
    assert.match(group.legendHTML, /⟨.*∣.*⟩/);
  });

  test(`${key}: carries no leftover face captions`, () => {
    assert.equal(group.frontSubcaption, undefined);
    assert.equal(group.backSubcaption, undefined);
  });
}

test("the order profiles identify the five isomorphism classes", () => {
  assert.deepEqual(orderProfile(groups.C8), [1, 2, 4, 4, 8, 8, 8, 8]);
  assert.deepEqual(orderProfile(groups.C4xC2), [1, 2, 2, 2, 4, 4, 4, 4]);
  assert.deepEqual(orderProfile(groups.C2xC2xC2), [1, 2, 2, 2, 2, 2, 2, 2]);
  assert.deepEqual(orderProfile(groups.D8), [1, 2, 2, 2, 2, 2, 4, 4]);
  assert.deepEqual(orderProfile(groups.Q8), [1, 2, 4, 4, 4, 4, 4, 4]);
});

test("no two of the five groups are isomorphic", () => {
  // The multiset of element orders is a complete invariant at order 8, so
  // five distinct profiles means five distinct isomorphism classes.
  const profiles = groupKeys.map((key) => orderProfile(groups[key]).join(","));
  assert.equal(new Set(profiles).size, groupKeys.length);
});

test("abelian-ness and centres match the classification", () => {
  assert.deepEqual(groupKeys.filter((key) => isAbelian(groups[key])).sort(), ["C2xC2xC2", "C4xC2", "C8"]);
  assert.deepEqual(centerOf(groups.D8).sort(), ["e", "r2"]);
  assert.deepEqual(centerOf(groups.Q8).sort(), ["minusOne", "one"]);
});

test("D8 satisfies its stated presentation", () => {
  const g = groups.D8;
  assert.equal(bruteForceOrder(g, "r"), 4);
  assert.equal(bruteForceOrder(g, "s"), 2);
  // srs⁻¹ = r⁻¹
  assert.equal(g.multiply(g.multiply("s", "r"), inverseOf(g, "s")), inverseOf(g, "r"));
});

test("Q8 satisfies Hamilton's relations", () => {
  const g = groups.Q8;
  assert.equal(g.multiply("i", "i"), "minusOne");
  assert.equal(g.multiply("j", "j"), "minusOne");
  assert.equal(g.multiply("k", "k"), "minusOne");
  assert.equal(g.multiply(g.multiply("i", "j"), "k"), "minusOne");
  assert.equal(g.multiply("i", "j"), "k");
  assert.equal(g.multiply("j", "k"), "i");
  assert.equal(g.multiply("k", "i"), "j");
  assert.equal(g.multiply("j", "i"), "minusK");
  // and its stated presentation: i⁴ = e, i² = j², jij⁻¹ = i⁻¹
  assert.equal(bruteForceOrder(g, "i"), 4);
  assert.equal(g.multiply("i", "i"), g.multiply("j", "j"));
  assert.equal(g.multiply(g.multiply("j", "i"), inverseOf(g, "j")), inverseOf(g, "i"));
});

test("every group on the cube layout has the cube's edges as its Cayley edges", () => {
  const expected = {
    C4xC2: ["left", "right"],
    C2xC2xC2: ["left", "right"],
    D8: ["right"] // left multiplication by s sends two verticals to face diagonals
  };
  const onCube = groupKeys.filter((key) => groups[key].layoutKind === "cube");
  assert.deepEqual(onCube.sort(), Object.keys(expected).sort(),
    "the set of groups drawn on a cube has changed");
  for (const [key, sides] of Object.entries(expected)) {
    const group = groups[key];
    const cube = cubeEdgeSet(group);
    for (const side of ["left", "right"]) {
      const matches = sameSet(cayleyEdgeSet(group, group.defaultGenerators, side), cube);
      assert.equal(matches, sides.includes(side), `${key} / ${side} multiplication`);
    }
  }
});

test("Q8 is not drawn on the cube, because it cannot be", () => {
  // Kept honest by the exhaustive proof below: no generating set puts Q8 on a
  // cube, so it gets the standard hexagon-and-poles diagram instead.
  assert.notEqual(groups.Q8.layoutKind, "cube");
  assert.equal(groups.Q8.layoutKind, "quaternion");
});

test("every group explains its own layout for screen readers", () => {
  for (const key of groupKeys) {
    assert.match(groups[key].layoutDescription, /^[a-z±1]/,
      `${key} description should read on from "arranged "`);
  }
  assert.equal(new Set(groupKeys.map((key) => groups[key].layoutDescription)).size, 3);
});

test("Q3 is not a Cayley graph of Q8 for any generating set", () => {
  // A connected 3-regular Cayley graph needs an inverse-closed generating set
  // of size 3. Q8 has only one involution, so any such set is {−1, g, g⁻¹},
  // which generates the cyclic group ⟨g⟩ of order 4. Checked exhaustively.
  const g = groups.Q8;
  const ids = idsOf(g).filter((id) => id !== g.identityId);
  let candidates = 0;
  for (let a = 0; a < ids.length; a += 1) {
    for (let b = a + 1; b < ids.length; b += 1) {
      for (let c = b + 1; c < ids.length; c += 1) {
        const set = [ids[a], ids[b], ids[c]];
        const inverseClosed = set.every((id) => set.includes(inverseOf(g, id)));
        if (!inverseClosed) continue;
        candidates += 1;
        assert.notEqual(generatedBy(g, set).size, 8,
          `${set.join(",")} unexpectedly generates Q8`);
      }
    }
  }
  assert.ok(candidates > 0, "no inverse-closed triples were examined");
});

test("mod normalises negative values", () => {
  assert.equal(core.mod(-1, 4), 3);
  assert.equal(core.mod(-5, 4), 3);
  assert.equal(core.mod(9, 4), 1);
  assert.equal(core.mod(0, 4), 0);
});
