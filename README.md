# Drawing to 3D Print

Turn a child’s drawing into a faithful, inspectable, **actually printable** 3D object.

**Live laboratory:** https://drawing-to-3d-print.amysterling.chatgpt.site

The first subject is Sophia’s curled, segmented dragon: crown-like head plumes,
arrow feet, egg stages, dragon bread, and all. The project’s governing rule:

> Preserve the weird. A prettier generic dragon that erases the child’s
> peculiar anatomy is a worse reconstruction.

## The pipeline

```text
drawing + intent
      ↓
clean / segment / describe
      ↓
AI mesh candidates OR parametric generator
      ↓
normalize / repair / thicken / manifold union
      ↓
printability report + slicer acceptance test
      ↓
3MF print master + GLB browser preview + STL compatibility
```

AI may propose the hidden backside. It may not certify its own geometry.

## Recommended model strategy

- **Default:** [TripoSG-Scribble](https://github.com/VAST-AI-Research/TripoSG)
  — scribble + prompt → GLB; MIT code/weights; about 8 GB VRAM.
- **High-fidelity challenger:** [Pixal3D](https://github.com/TencentARC/Pixal3D)
  — pixel-aligned single-image reconstruction; MIT; 24 GB-class backend.
- **Print-first challenger:** [Step1X-3D](https://github.com/stepfun-ai/Step1X-3D)
  — watertight-TSDF geometry; Apache-2.0; heavyweight.
- **Quality ceiling:** [TRELLIS.2](https://github.com/microsoft/TRELLIS.2)
  — 4B image-to-3D with PBR materials; MIT; 24 GB+ VRAM.
- **Geometry benchmark:** [Direct3D-S2](https://github.com/DreamTechAI/Direct3D-S2)
  — high-resolution SDF mesh generation; MIT; 10–24 GB VRAM.
- **Fast smoke test:** [TripoSR](https://github.com/VAST-AI-Research/TripoSR)
  — permissive 6 GB baseline.

See [docs/MODEL_LANDSCAPE.md](docs/MODEL_LANDSCAPE.md) for the researched
comparison and licensing cautions.

## Planned repository shape

```text
apps/web/                 browser viewer and job UI
pipeline/                 ingest, repair, validate, export, slice
adapters/                 one isolated adapter per generation model
generators/               deliberate parametric models
profiles/                 printer / nozzle / material rules
schemas/                  job and validation report contracts
assets/examples/          source drawings and small test fixtures
artifacts/                generated GLB / 3MF / STL / reports (gitignored)
weights/                  model caches (gitignored)
tests/                    fixtures, golden meshes, pipeline checks
```

## Printability contract

Every generated object must report:

- finite vertices and nondegenerate faces;
- watertightness, winding consistency, outward normals, and positive volume;
- connected-body count and floating islands;
- dimensions and explicit millimeter units;
- minimum feature/wall thickness;
- overhang area and bed-contact area;
- slicer success, support requirement, estimated material, and print time.

**3MF is the print master. GLB is the browser preview. STL is compatibility-only.**

## First experiment

1. Crop and clean one dragon from Sophia’s model sheet.
2. Run TripoSG-Scribble with a species-preserving prompt.
3. Generate 4–8 candidates.
4. Compare silhouette and peculiar anatomical features.
5. Repair the best candidate with Trimesh + Manifold3D; use Blender voxel
   remesh only when necessary.
6. Validate it, slice it, and put the GLB beside the deterministic baseline in
   the browser viewer.

This repository intentionally does **not** commit model weights. Adapters will
fetch pinned upstream weights into a gitignored cache and preserve every
upstream license and NOTICE file.
