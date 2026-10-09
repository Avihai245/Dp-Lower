# Visual comparison tools

Render a page of the app and the matching page of the original design prototype with identical rules (same fonts, no video
or analytics), then diff them.

```bash
# the design handoff (DP_Lower_design.zip) unpacked somewhere; the prototypes also need react/react-dom/@babel/standalone,
# which they load from unpkg (when unpkg is not reachable, point PROTO_LIBS at a node_modules that has them)
export DESIGN_DIR=/path/to/design/project

node tools/visual/shot.mjs app   http://localhost:3001/he/eligibility app.png   --width 1440 --full
node tools/visual/shot.mjs proto "DP Lower - Lending Page.dc.html"   proto.png --query "?entry=eligibility" --lang he --full
node tools/visual/compare.mjs app.png proto.png diff.png --side side-by-side.png   # prints the mismatch ratio
```

`shot.mjs` takes `--width/--height`, `--full`, `--click <selector>` and `--eval <js>` (repeatable) to reach a state, `--wait <ms>`
and `--scale`. The comparison pads both images to the same size and highlights differing pixels in red.
