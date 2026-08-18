import * as THREE from "three";

export function taperedShape(length, radiusStart, radiusEnd) {
  const shape = new THREE.Shape();
  const points = [];
  const steps = 12;
  for (let i = 0; i <= steps; i++) {
    const theta = Math.PI / 2 + Math.PI * i / steps;
    points.push(new THREE.Vector2(Math.cos(theta) * radiusStart, Math.sin(theta) * radiusStart));
  }
  for (let i = 0; i <= steps; i++) {
    const theta = -Math.PI / 2 + Math.PI * i / steps;
    points.push(new THREE.Vector2(length + Math.cos(theta) * radiusEnd, Math.sin(theta) * radiusEnd));
  }
  shape.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((point) => shape.lineTo(point.x, point.y));
  shape.closePath();
  return shape;
}

export function addCircularHole(shape, x, y, radius) {
  const hole = new THREE.Path();
  hole.absarc(x, y, radius, 0, Math.PI * 2, true);
  shape.holes.push(hole);
}

function ovalShape(x, y, radiusX, radiusY) {
  const shape = new THREE.Shape();
  shape.absellipse(x, y, radiusX, radiusY, 0, Math.PI * 2, false);
  shape.closePath();
  return shape;
}

function ovalRingShape(x, y, radiusX, radiusY, ringWidth) {
  const shape = ovalShape(x, y, radiusX, radiusY);
  const hole = new THREE.Path();
  hole.absellipse(
    x,
    y,
    Math.max(.45, radiusX - ringWidth),
    Math.max(.45, radiusY - ringWidth),
    0,
    Math.PI * 2,
    true,
  );
  shape.holes.push(hole);
  return shape;
}

export function extrudeShape(shape, depth, material, bevel = .45) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    steps: 1,
    curveSegments: 12,
    bevelEnabled: bevel > 0,
    bevelThickness: Math.min(bevel, depth * .13),
    bevelSize: Math.min(bevel, depth * .13),
    bevelSegments: 1,
  });
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function makeLinkPart(length, radiusStart, radiusEnd, depth, holeRadius, startHole, endHole, material) {
  const group = new THREE.Group();
  const shape = taperedShape(length, radiusStart, radiusEnd);
  if (startHole) addCircularHole(shape, 0, 0, holeRadius);
  if (endHole) addCircularHole(shape, length, 0, holeRadius);
  group.add(extrudeShape(shape, depth, material));
  const ridge = extrudeShape(
    ovalShape(
      length * .5,
      0,
      Math.max(2.2, length * .24),
      Math.max(2.4, Math.min(radiusStart, radiusEnd) * .42),
    ),
    Math.max(.8, depth * .3),
    material,
    .24,
  );
  ridge.position.z = depth - .12;
  ridge.userData.surfaceRelief = true;
  group.add(ridge);
  return group;
}

export function makeHandPart(depth, material) {
  const shape = new THREE.Shape();
  const points = [
    [-5,-4], [1,-4], [7,-10], [10,-8], [7,-2.8],
    [14,0], [7,2.8], [10,8], [7,10], [1,4], [-5,4],
  ];
  shape.moveTo(points[0][0], points[0][1]);
  points.slice(1).forEach(([x,y]) => shape.lineTo(x,y));
  shape.closePath();
  return extrudeShape(shape, depth, material, .35);
}

export function makeArmPart(length, depth, holeRadius, material) {
  const bodyLength = Math.max(13, length - 8);
  const group = makeLinkPart(bodyLength, 6.2, 4.5, depth, holeRadius, true, false, material);
  const hand = makeHandPart(depth, material);
  hand.position.x = bodyLength;
  group.add(hand);
  return group;
}

export function disk(radius, depth, material, segments = 22) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, depth, segments), material);
  mesh.rotation.x = Math.PI / 2;
  mesh.castShadow = true;
  return mesh;
}

export function makeHeadPart(length, depth, holeRadius, size, material, _crownMaterial) {
  const group = new THREE.Group();
  const jointRadius = Math.max(7.2, size * .45);
  const headShape = new THREE.Shape();
  headShape.moveTo(0, jointRadius);
  headShape.absarc(0, 0, jointRadius, Math.PI / 2, Math.PI * 1.5, false);
  headShape.bezierCurveTo(
    length * .42, -size * .5,
    length + size * .1, -size * .86,
    length + size * .5, -size * .62,
  );
  headShape.bezierCurveTo(
    length + size * .8, -size * .42,
    length + size * .92, -size * .14,
    length + size * .84, size * .16,
  );
  headShape.bezierCurveTo(
    length + size * .74, size * .52,
    length + size * .26, size * .93,
    length - size * .05, size * .76,
  );
  headShape.bezierCurveTo(
    length * .48, size * .61,
    length * .25, size * .49,
    0, jointRadius,
  );
  headShape.closePath();
  addCircularHole(headShape, 0, 0, holeRadius);
  group.add(extrudeShape(headShape, depth, material, .48));

  const facePlateHeight = Math.max(1, depth * .33);
  const facePlate = extrudeShape(
    ovalShape(length + size * .22, 0, size * .52, size * .62),
    facePlateHeight,
    material,
    .34,
  );
  facePlate.position.z = depth - .16;
  facePlate.userData.surfaceRelief = true;
  group.add(facePlate);

  const cream = new THREE.MeshStandardMaterial({ color: "#fff6df", roughness: .75 });
  const dark = new THREE.MeshStandardMaterial({ color: "#17201c", roughness: .7 });
  const cheek = new THREE.MeshStandardMaterial({ color: "#f0c95b", roughness: .7 });
  const detailBaseZ = depth + facePlateHeight - .34;

  // Sophie's drawing has one big open oval eye and one deliciously chunky wink.
  const openEye = extrudeShape(
    ovalRingShape(length + size * .04, size * .35, size * .2, size * .28, Math.max(1.05, size * .065)),
    1.15,
    dark,
    .16,
  );
  openEye.position.z = detailBaseZ;
  group.add(openEye);
  const eyeGlow = extrudeShape(
    ovalShape(length + size * .04, size * .35, size * .105, size * .16),
    .42,
    cream,
    .1,
  );
  eyeGlow.position.z = detailBaseZ - .12;
  group.add(eyeGlow);

  const winkLength = size * .38;
  const wink = extrudeShape(
    taperedShape(winkLength, size * .075, size * .075),
    1.12,
    dark,
    .18,
  );
  wink.position.set(length - winkLength * .5 + size * .04, -size * .36, detailBaseZ);
  wink.rotation.z = -.08;
  group.add(wink);

  // The rounded muzzle loop and tiny dangling nub are copied from the drawing,
  // not replaced with a generic emoji smile.
  const muzzle = extrudeShape(
    ovalRingShape(length + size * .47, 0, size * .28, size * .33, Math.max(1.05, size * .064)),
    .9,
    cheek,
    .16,
  );
  muzzle.position.z = detailBaseZ - .04;
  group.add(muzzle);
  const nub = extrudeShape(
    ovalShape(length + size * .82, 0, size * .14, size * .19),
    1.45,
    cheek,
    .2,
  );
  nub.position.z = depth - .12;
  group.add(nub);

  group.userData.faceMeshes = true;
  return group;
}

export function makePinPart(height, pinRadius, material) {
  const group = new THREE.Group();
  const shaft = disk(pinRadius, height, material, 18);
  shaft.position.z = height / 2 + .65;
  group.add(shaft);
  const base = disk(pinRadius * 1.72, 1.2, material, 20);
  base.position.z = .6;
  group.add(base);
  const snap = disk(pinRadius * 1.16, 1.05, material, 18);
  snap.position.z = height + .9;
  group.add(snap);
  return group;
}

export function rigPointToModel(point, size) {
  return new THREE.Vector2((point.x - .5) * size, (.93 - point.y) * size);
}

export function resampleSpine(spine, segmentCount) {
  const distances = [0];
  for (let i = 1; i < spine.length; i++) {
    distances.push(distances[i - 1] + Math.hypot(spine[i].x - spine[i - 1].x, spine[i].y - spine[i - 1].y));
  }
  const total = distances.at(-1);
  const result = [];
  for (let sample = 0; sample <= segmentCount; sample++) {
    const target = total * sample / segmentCount;
    let index = 1;
    while (index < distances.length - 1 && distances[index] < target) index++;
    const a = spine[index - 1], b = spine[index];
    const span = distances[index] - distances[index - 1] || 1;
    const t = (target - distances[index - 1]) / span;
    result.push({
      x: THREE.MathUtils.lerp(a.x, b.x, t),
      y: THREE.MathUtils.lerp(a.y, b.y, t),
      w: THREE.MathUtils.lerp(a.w, b.w, t),
    });
  }
  return result;
}
