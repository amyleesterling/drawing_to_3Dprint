# Open model landscape — August 17, 2026

The target is not merely a textured asset that looks convincing from one
camera. The target is a solid object that can be inspected, repaired, sliced,
and printed. No current generator should be trusted as a print-ready authority.

## Recommended backends

| Model | Input → output | Upstream terms | Official compute | Role here |
| --- | --- | --- | --- | --- |
| [TripoSG / Scribble](https://github.com/VAST-AI-Research/TripoSG) | image → GLB; scribble + text → GLB | MIT code and published weights; retain NOTICE terms | CUDA, at least 8 GB VRAM | Default drawing backend |
| [Pixal3D](https://github.com/TencentARC/Pixal3D) | image → high-fidelity PBR GLB | MIT; inherited components retain their terms | TRELLIS.2-based, 24 GB-class Linux/NVIDIA | High-fidelity challenger |
| [Step1X-3D](https://github.com/stepfun-ai/Step1X-3D) | image → watertight-TSDF geometry → textured GLB | Apache-2.0 | about 27 GB for full pipeline | Print-first challenger |
| [TRELLIS.2](https://github.com/microsoft/TRELLIS.2) | image → O-Voxel mesh/GLB + PBR | MIT; renderer dependencies have separate terms | Linux, NVIDIA 24 GB+ | General quality ceiling |
| [Direct3D-S2](https://github.com/DreamTechAI/Direct3D-S2) | image → high-resolution SDF OBJ | MIT | 10 GB at 512; about 24 GB at 1024 | Geometry benchmark |
| [TripoSR](https://github.com/VAST-AI-Research/TripoSR) | image → extracted mesh, optional texture | MIT | about 6 GB | Fast smoke-test backend |

### Why TripoSG-Scribble starts

It is the only leading candidate whose official interface directly matches our
source material: **scribble + prompt**. The base project explicitly calls out
cartoons and sketches, outputs geometry as GLB, can cap face count, and has a
comparatively friendly 8 GB requirement.

The prompt must describe intent without replacing the drawing. Example:

> A friendly toy dragon designed by a seven-year-old. Preserve its long curled
> segmented body, tall neck, three crown-like head fingers, four sturdy arrow-
> shaped feet, round head, and heart-like tail flourish. One connected solid,
> thick printable limbs, no wings, no generic medieval dragon anatomy.

### Why Pixal3D challenges it

Pixal3D explicitly lifts pixel features into 3D instead of only conditioning
through attention. That makes it a strong candidate for preserving unusual
silhouettes. Its current implementation builds on TRELLIS.2, so it inherits a
heavier installation and 24 GB-class GPU expectations.

### Why Step1X-3D matters

Step1X-3D produces a watertight TSDF representation and publishes watertight
preprocessing based on depth tests and winding numbers. That does not eliminate
final inspection, but it makes the model unusually aligned with manufacturing.

## Optional adapters, not bundled defaults

- [SPAR3D](https://github.com/Stability-AI/stable-point-aware-3d): impressive
  point-aware reconstruction and a 7–10.5 GB path, but Stability’s Community
  License introduces revenue thresholds, registration, and attribution terms.
- [Hunyuan3D 2.1](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1): strong
  shape and PBR generation, but its community license excludes the EU, UK, and
  South Korea and adds terms at scale. Keep it user-installed and isolated.
- [InstantMesh](https://github.com/TencentARC/InstantMesh): Apache-2.0 and still
  useful, but behind the primary candidates in current quality and simplicity.
- [PartCrafter](https://github.com/wgsxm/PartCrafter): valuable later when
  editable semantic parts matter.
- [SAM 3D Objects](https://github.com/facebookresearch/sam-3d-objects): strong
  for masked objects in cluttered real photographs, less direct for a clean
  child’s drawing and distributed under Meta’s custom SAM License.

## Excluded from the primary mesh path

- TripoSplat outputs 3D Gaussians rather than a printable surface mesh.
- OpenLRM has permissive code but noncommercial published weights.
- older Shap-E, Michelangelo, Wonder3D, and original TRELLIS remain useful
  research baselines but do not beat the selected set for this product.
- Hunyuan3D 2.5 is not a verified installable official open-weight target yet.

## Integration rule

Never vendor upstream projects or weights into this repository. Every adapter
must:

1. pin an upstream revision and weight checksum;
2. fetch into `weights/` or an external cache;
3. surface the upstream license and NOTICE before installation;
4. normalize output to the shared job contract;
5. preserve raw output separately from repaired output;
6. declare whether it emits a closed volume, open surface, or unknown topology.
