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

export function makeHeadPart(length, depth, holeRadius, size, material, crownMaterial) {
  const group = makeLinkPart(length, Math.max(7.2, size * .45), size, depth, holeRadius, true, false, material);
  const white = new THREE.MeshStandardMaterial({ color: "#fff6df", roughness: .75 });
  const dark = new THREE.MeshStandardMaterial({ color: "#17201c", roughness: .7 });
  const cheek = new THREE.MeshStandardMaterial({ color: "#f0c95b", roughness: .7 });
  const eyeOffset = Math.max(5, size * .34);
  [-eyeOffset, eyeOffset].forEach((y, index) => {
    const eye = disk(size * .25, .85, white);
    eye.scale.set(1.15, 1, .82);
    eye.position.set(length + size * .03, y, depth + .25);
    group.add(eye);
    const pupil = disk(size * .105, .92, dark);
    pupil.position.set(length + size * .08, y + (index ? -.25 : .25), depth + .73);
    group.add(pupil);
  });
  const nose = disk(size * .12, .82, cheek);
  nose.scale.set(1.25, 1, .82);
  nose.position.set(length + size * .56, 0, depth + .45);
  group.add(nose);
  const smile = new THREE.Shape();
  const smilePoints = [];
  const smileHalfHeight = size * .31;
  const smileArch = size * .27;
  const smileThickness = Math.max(.7, size * .042);
  for (let index = 0; index <= 12; index++) {
    const y = THREE.MathUtils.lerp(-smileHalfHeight, smileHalfHeight, index / 12);
    const normalized = y / smileHalfHeight;
    const x = length + size * .38 + smileArch * (1 - normalized * normalized);
    smilePoints.push(new THREE.Vector2(x + smileThickness / 2, y));
  }
  for (let index = 12; index >= 0; index--) {
    const y = THREE.MathUtils.lerp(-smileHalfHeight, smileHalfHeight, index / 12);
    const normalized = y / smileHalfHeight;
    const x = length + size * .38 + smileArch * (1 - normalized * normalized);
    smilePoints.push(new THREE.Vector2(x - smileThickness / 2, y));
  }
  smile.moveTo(smilePoints[0].x, smilePoints[0].y);
  smilePoints.slice(1).forEach((point) => smile.lineTo(point.x, point.y));
  smile.closePath();
  const smileMesh = extrudeShape(smile, .9, dark, .12);
  smileMesh.position.z = depth - .18;
  group.add(smileMesh);
  [-.42, 0, .42].forEach((factor, index) => {
    const crown = makeHandPart(depth * .72, crownMaterial);
    crown.scale.set(.34, .34, .7);
    crown.rotation.z = Math.PI / 2 + factor * .65;
    crown.position.set(length - size * .25, factor * size * 1.04, depth * .22 + index * .04);
    group.add(crown);
  });
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
