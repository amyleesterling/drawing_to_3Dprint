# Drawing to 3D Print

Turn a child's drawing into an articulated, inspectable, 3D-printable creature.

**Creature forge:** https://amyleesterling.github.io/drawing_to_3Dprint/

**Tested Sophia STL:**
[download the articulated print kit](models/sophias-four-arm-articulated-dragon-kit.stl)

The golden test animal is Sophia's long-necked segmented dragon—with its
connected head, exactly four arrow-handed arms, and the face she actually drew:
one open oval eye, one chunky wink, a rounded muzzle loop, and a tiny dangling
nose nub. Those marks are raised as printable relief instead of being replaced
with a generic cartoon face. The governing rule:

> Preserve the weird. A polished generic dragon that erases the child's anatomy
> is a worse reconstruction.

## What works now

The GitHub Pages laboratory runs entirely in the browser:

1. Upload a drawing or restore the Sophia preset.
2. Drag the spine, head, and four hand markers over the intended anatomy.
3. Generate an assembled articulated preview.
4. Adjust segment count, plate thickness, clearance, and finished size.
5. Orbit, zoom, wiggle, explode, recolor, and inspect the geometry.
6. Download a laid-out binary STL print kit, clean SVG sketch, and JSON recipe.

No account, server, API key, or uploaded child artwork is required. Images stay
on the device.

## The articulation system

The body is a chain of tapered plates arranged on alternating depth layers.
Round eyelets overlap at each joint and printable pegs hold the stack together.
The same mechanism attaches the head and all four arms. Shallow central ridges
give the body plates height without entering the hinge sweep, while the face is
built in stepped relief. This is an
assemble-after-print prototype: the exported STL lays every component flat on a
virtual 212 mm-wide layout so it retains margins on a common 220 mm bed.

Read [docs/ARTICULATION.md](docs/ARTICULATION.md) for the joint geometry,
defaults, and calibration boundary.

## Run locally

```bash
npm install
npm run dev
```

`npm run build` creates a static `dist/` directory. GitHub Actions deploys that
directory to Pages after changes land on `main`.

## Honest boundary

This version does deterministic, human-guided geometry. It does not pretend a
static webpage can secretly run a 4-billion-parameter reconstruction model.
Open image-to-3D adapters can propose richer surfaces later; the explicit rig,
joint clearances, print layout, and validation contract remain model-independent.

## Open model strategy

- **Default:** [TripoSG-Scribble](https://github.com/VAST-AI-Research/TripoSG)
  for scribble + prompt → mesh.
- **High-fidelity challenger:** [Pixal3D](https://github.com/TencentARC/Pixal3D).
- **Print-first challenger:** [Step1X-3D](https://github.com/stepfun-ai/Step1X-3D).
- **Quality ceiling:** [TRELLIS.2](https://github.com/microsoft/TRELLIS.2).
- **Fast baseline:** [TripoSR](https://github.com/VAST-AI-Research/TripoSR).

See [docs/MODEL_LANDSCAPE.md](docs/MODEL_LANDSCAPE.md) and
[docs/PIPELINE.md](docs/PIPELINE.md) for the researched comparison and complete
drawing-to-object contract.

Model weights are never committed. Future adapters will fetch pinned upstream
artifacts into a gitignored cache and preserve every license and NOTICE file.
