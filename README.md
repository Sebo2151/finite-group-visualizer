# Finite Group Visualizer

An interactive, browser-based visualization of finite groups. It currently
covers all five groups of order 8:

- cyclic group `C8`
- direct product `C4 × C2`
- elementary abelian group `C2 × C2 × C2`
- dihedral group `D8`
- quaternion group `Q8`

The app supports left and right multiplication previews, queued multiplication animations, net-transform tracking, and configurable left/right Cayley graph overlays.

`D8` here denotes the dihedral group of **order 8** (the symmetries of a square), which some authors write as `D4`.

## Run locally

No installation or build step is required. Open `index.html` in a modern browser.

For a local web server, run one of the following commands from the repository folder:

```bash
python -m http.server 8000
```

or

```bash
npx serve .
```

Then open the local address shown in the terminal.

## Tests

The tests need Node 18 or newer and have no dependencies:

```bash
node --test "tests/*.test.mjs"
```

They load the DOM-free part of `index.html` directly — the region between the
`/* core:start */` and `/* core:end */` markers — so they check the code that
actually ships rather than a copy of it. Coverage includes the group axioms and
the full multiplication table of each group, the classification by order
profile, the arrow and animation geometry, and page-level invariants such as
colour contrast and attribution.

## Publish with GitHub Pages

1. Create a new GitHub repository, for example `finite-group-visualizer`.
2. Put the contents of this folder at the repository root and push them to the `main` branch.
3. On GitHub, open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select the `main` branch and the `/(root)` folder, then save.

GitHub will publish the site at a project URL of the form:

```text
https://YOUR-USERNAME.github.io/finite-group-visualizer/
```

Official documentation: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## Repository structure

```text
.
├── index.html        # Complete self-contained application
├── tests/            # Dependency-free Node test suite
├── LICENSE           # MIT License
├── .nojekyll         # Serve the static files without Jekyll processing
├── .gitignore
└── README.md
```

## Customization

The app is self-contained in `index.html`. The main animation speed is controlled by the JavaScript constant:

```js
const ANIMATION_DURATION_MS = 760;
```

Readers who have asked for reduced motion get the end state immediately instead.

No external libraries, fonts, APIs, or network requests are required.

## Layouts

`C8` sits on a regular octagon.

`C4 × C2`, `C2 × C2 × C2`, and `D8` sit at the vertices of a cube drawn in
parallel projection: two equal squares joined by a single depth offset running
26° right of vertical, foreshortened to about 0.61 of the side. For each of them
the cube's twelve edges are exactly the Cayley graph edges of the default
generators.

Those three numbers are more constrained than they look. The tilt has to stay
away from 45°, where the two lower-left and two upper-right corners fall on one
straight line. The depth has to stay away from `side / (sin θ + cos θ)`, where
the back lower-left corner lands on the front face's diagonal. And the overall
size is capped not by the resting layout but by the four-cycle animation, whose
path bows an eighth of a side outside each face. `tests/layout.test.mjs` pins
all three.

`Q8` cannot be drawn that way, and no choice of generators would fix it. A
connected 3-regular Cayley graph needs an inverse-closed generating set of size
3; since `Q8` has only one involution, any such set is `{−1, g, g⁻¹}`, which
generates only `⟨g⟩`. So `Q8` instead uses the standard diagram — `1` and `−1`
on a short vertical axis inside a regular hexagon carrying `±i`, `±j`, `±k`,
each element opposite its negative — following
[this Wikimedia Commons figure](https://commons.wikimedia.org/wiki/File:Cayley_Q8_multiplication_graph.svg).
Every `⟨g⟩` and every coset of one then closes up as a convex quadrilateral.

## Author

Sebastian Bozlee, Wake Forest University — <bozlees@wfu.edu>

Developed in collaboration with ChatGPT and Claude.

## License

Released under the MIT License. See [LICENSE](LICENSE).
