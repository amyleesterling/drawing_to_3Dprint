# Drawing-to-object pipeline

## Two lanes, one contract

### Parametric lane

Use JSCAD or Manifold3D to build a deliberate solid from interpreted body
curves, segments, horns, feet, and tail. Prefer this lane when fidelity to the
drawing and guaranteed thickness matter more than sculptural surprise.

### AI-mesh lane

Use a model adapter to propose geometry, then subject it to the same mandatory
repair and validation stages. AI output is evidence, not a manufacturing file.

## Production sequence

```text
source drawing + intent spec
          v
crop / segment / normalize
          v
parametric generator OR model adapter
          v
Trimesh normalize + inspect
          v
Manifold union / thickness operations
          v
optional Blender voxel-remesh fallback
          v
validation report
          v
3MF master + GLB preview + STL compatibility
          v
PrusaSlicer CLI acceptance test
```

## Permissive core

- [Trimesh](https://github.com/mikedh/trimesh) - MIT; import, transforms,
  components, metrics, repair helpers, and validation orchestration.
- [Manifold](https://github.com/elalish/manifold) - Apache-2.0; reliable
  primitives, sweeps, and Boolean operations on valid manifold inputs.
- [lib3mf](https://github.com/3MFConsortium/lib3mf) - BSD-2-Clause; canonical
  3MF output and validation.
- [Three.js](https://github.com/mrdoob/three.js) - MIT; GLB/STL browser viewer,
  dimensions, wireframe, and inspection overlays.

Optional external tools:

- Blender headless for voxel remesh, solidify, decimation, and GLB export.
- PrusaSlicer CLI as the final practical acceptance test.
- PyMeshFix or PyMeshLab only behind optional adapters because GPL terms can
  affect distribution decisions.

## Validation report

Each job writes `report.json` with:

- units, axis convention, bounding box, and volume;
- duplicate/zero-area face counts;
- watertight, winding-consistent, outward-normal, and volume flags;
- connected components, floating islands, holes, and non-manifold edges;
- sampled minimum wall/feature thickness;
- selected orientation, downward overhang area, and bed-contact area;
- slicer success, supports, material estimate, and print-time estimate;
- raw, repaired, and final artifact hashes.

Thresholds live in printer/nozzle/material profiles. There is no single magic
wall thickness or overhang angle for every machine and material.

## Formats

- **3MF:** canonical print master with units and manufacturing metadata.
- **GLB:** derived browser preview and appearance asset.
- **STL:** compatibility export only; never the source of truth.
