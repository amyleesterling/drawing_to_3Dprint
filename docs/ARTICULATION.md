# Articulation system

The browser MVP converts a human-guided 2D rig into a flat-printable mechanical
kit. It deliberately keeps recognition separate from manufacturing.

## Joint design

- The curved body becomes a chain of tapered, rounded plates.
- Neighboring plates alternate between two depth layers.
- Circular eyelets overlap at each joint.
- Separate pegs pass through the eyelets, allowing in-plane rotation.
- The head uses the same joint rather than becoming a disconnected shell.
- Four arm plates attach at two body joints on additional depth layers.

Default dimensions at the 140 mm preset:

| Parameter | Default |
| --- | ---: |
| Body segments | 10 |
| Plate thickness | 3.2 mm |
| Peg diameter | 2.6 mm |
| Radial clearance | 0.35 mm |
| Arms | 4 |
| Body ridge relief | 0.84 mm |
| Maximum face relief | 1.87 mm |

The exporter lays the body plates, head, four arms, and pegs flat on a virtual
212 mm-wide layout before producing the binary STL, leaving margins on a common
220 mm bed. Central relief stays clear of every joint hole and hinge sweep. The
head relief preserves Sophia's open oval eye, chunky wink, rounded muzzle loop,
and dangling nose nub as distinct printable height levels.

The offline generator audits the bytes it writes: the binary triangle count,
zero open boundary edges, and exported XYZ bounds must all agree with the scene
before the STL is published. The SVG and JSON exports share the
same rig, so the sketch, preview, and print kit cannot quietly disagree about
the creature's anatomy.

## Important validation boundary

This is a mechanical prototype, not yet a certified toy design. Clearances vary
with printer, nozzle, material, cooling, and elephant-foot compensation. Print a
small two-link calibration joint before committing to the full creature. Small
pegs require adult assembly and supervision.

## Why human-guided rigging comes first

Automatic image-to-3D systems are good at proposing surface appearance and bad
at knowing which delightful marks are anatomy, notes, eggs, bread, or page
borders. The draggable rig preserves authorship while giving every downstream
model adapter an explicit skeleton and joint contract.
