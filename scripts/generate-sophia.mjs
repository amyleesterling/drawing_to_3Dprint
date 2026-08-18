#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import {
  makeArmPart,
  makeHeadPart,
  makeLinkPart,
  makePinPart,
  resampleSpine,
  rigPointToModel,
} from "../geometry.js";

const rig = {
  name: "Sophia's four-armed dragon",
  spine: [
    { x: .34, y: .88, w: 24 }, { x: .35, y: .77, w: 25 },
    { x: .37, y: .66, w: 23 }, { x: .38, y: .55, w: 21 },
    { x: .41, y: .45, w: 18 }, { x: .47, y: .35, w: 16 },
    { x: .56, y: .27, w: 14 }, { x: .66, y: .21, w: 13 },
    { x: .75, y: .23, w: 12 }, { x: .82, y: .32, w: 11 },
    { x: .84, y: .43, w: 10 },
  ],
  head: { x: .80, y: .53, size: 18 },
  arms: [
    { rootIndex: 2, tip: { x: .08, y: .64 } },
    { rootIndex: 2, tip: { x: .66, y: .66 } },
    { rootIndex: 4, tip: { x: .18, y: .44 } },
    { rootIndex: 4, tip: { x: .63, y: .46 } },
  ],
};

const params = {
  size: 140,
  segments: 10,
  thickness: 3.2,
  clearance: .35,
  pinDiameter: 2.6,
};

const material = new THREE.MeshStandardMaterial({ color: "#ff784f" });
const crownMaterial = material.clone();
const pegMaterial = new THREE.MeshStandardMaterial({ color: "#f0c95b" });
const scale = params.size / 140;
const pinRadius = params.pinDiameter * scale / 2;
const holeRadius = pinRadius + params.clearance;
const layer = params.thickness + params.clearance;
const spineRig = resampleSpine(rig.spine, params.segments);
const spine = spineRig.map((point) => rigPointToModel(point, params.size));
const parts = [];

for (let index = 0; index < params.segments; index++) {
  const start = spine[index], end = spine[index + 1];
  parts.push({
    name: `body-${index + 1}`,
    group: makeLinkPart(
      start.distanceTo(end),
      Math.max(7.2, spineRig[index].w * scale),
      Math.max(6.5, spineRig[index + 1].w * scale),
      params.thickness,
      holeRadius,
      index > 0,
      true,
      material,
    ),
  });
}

const neckEnd = spine.at(-1);
const headPoint = rigPointToModel(rig.head, params.size);
parts.push({
  name: "head-with-cute-face",
  group: makeHeadPart(
    Math.max(18 * scale, neckEnd.distanceTo(headPoint)),
    params.thickness,
    holeRadius,
    rig.head.size * scale,
    material,
    crownMaterial,
  ),
});

rig.arms.forEach((arm, index) => {
  const rootIndex = THREE.MathUtils.clamp(Math.round(arm.rootIndex / (rig.spine.length - 1) * params.segments), 1, params.segments - 1);
  const root = spine[rootIndex];
  const tip = rigPointToModel(arm.tip, params.size);
  parts.push({ name: `arm-${index + 1}`, group: makeArmPart(root.distanceTo(tip), params.thickness, holeRadius, material) });
});

for (let index = 0; index < params.segments; index++) {
  const tall = index === 1 || index === 3;
  const stackCount = tall ? 4 : 2;
  const height = stackCount * params.thickness + (stackCount - 1) * params.clearance + 1.4;
  parts.push({ name: `peg-${index + 1}`, group: makePinPart(height, pinRadius, pegMaterial) });
}

const printGroup = new THREE.Group();
const bedWidth = Number(process.env.BED_WIDTH || 212);
const gap = 7;
let cursorX = 0, cursorY = 0, rowHeight = 0;
const layoutItems = parts.map((part) => {
  const clone = part.group.clone(true);
  clone.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(clone);
  return { part, clone, box, width: box.max.x - box.min.x, height: box.max.y - box.min.y };
}).sort((a, b) => b.height - a.height);
for (const { part, clone, box, width, height } of layoutItems) {
  if (cursorX && cursorX + width > bedWidth) {
    cursorX = 0;
    cursorY += rowHeight + gap;
    rowHeight = 0;
  }
  clone.position.set(cursorX - box.min.x, cursorY - box.min.y, 0);
  clone.userData.partName = part.name;
  printGroup.add(clone);
  cursorX += width + gap;
  rowHeight = Math.max(rowHeight, height);
}
printGroup.updateMatrixWorld(true);
const laidOutBoxes = printGroup.children.map((child) => ({
  name: child.userData.partName,
  box: new THREE.Box3().setFromObject(child),
}));
const overlappingPartPairs = [];
for (let left = 0; left < laidOutBoxes.length; left++) {
  for (let right = left + 1; right < laidOutBoxes.length; right++) {
    const a = laidOutBoxes[left];
    const b = laidOutBoxes[right];
    const overlapX = Math.min(a.box.max.x, b.box.max.x) - Math.max(a.box.min.x, b.box.min.x);
    const overlapY = Math.min(a.box.max.y, b.box.max.y) - Math.max(a.box.min.y, b.box.min.y);
    if (overlapX > .01 && overlapY > .01) overlappingPartPairs.push([a.name, b.name]);
  }
}
if (overlappingPartPairs.length) {
  throw new Error(`print layout contains overlapping parts: ${JSON.stringify(overlappingPartPairs)}`);
}

let meshCount = 0;
let vertexCount = 0;
printGroup.traverse((object) => {
  if (!object.isMesh) return;
  meshCount++;
  const positions = object.geometry.getAttribute("position");
  vertexCount += positions.count;
  for (let index = 0; index < positions.count; index++) {
    if (![positions.getX(index), positions.getY(index), positions.getZ(index)].every(Number.isFinite)) {
      throw new Error(`non-finite vertex in ${object.parent?.userData.partName || "mesh"}`);
    }
  }
});

const view = new STLExporter().parse(printGroup, { binary: true });
const stl = Buffer.from(view.buffer, view.byteOffset, view.byteLength);
const stlFilename = "sophias-four-arm-articulated-dragon-kit.stl";

const triangleCount = stl.readUInt32LE(80);
const vertexIds = new Map();
const edgeUse = new Map();
const stlMin = [Infinity, Infinity, Infinity];
const stlMax = [-Infinity, -Infinity, -Infinity];
const vertexId = (x, y, z) => {
  const key = [x, y, z].map((value) => Math.round(value * 1e5)).join(",");
  if (!vertexIds.has(key)) vertexIds.set(key, vertexIds.size);
  return vertexIds.get(key);
};
for (let triangle = 0; triangle < triangleCount; triangle++) {
  const offset = 84 + triangle * 50;
  const ids = [];
  for (let corner = 0; corner < 3; corner++) {
    const vertex = [
      stl.readFloatLE(offset + 12 + corner * 12),
      stl.readFloatLE(offset + 16 + corner * 12),
      stl.readFloatLE(offset + 20 + corner * 12),
    ];
    vertex.forEach((value, axis) => {
      stlMin[axis] = Math.min(stlMin[axis], value);
      stlMax[axis] = Math.max(stlMax[axis], value);
    });
    ids.push(vertexId(...vertex));
  }
  [[ids[0], ids[1]], [ids[1], ids[2]], [ids[2], ids[0]]].forEach(([a, b]) => {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    edgeUse.set(key, (edgeUse.get(key) || 0) + 1);
  });
}
const boundaryEdges = [...edgeUse.values()].filter((count) => count === 1).length;
const bounds = new THREE.Box3().setFromObject(printGroup);
const dimensions = bounds.getSize(new THREE.Vector3());
const stlDimensions = stlMax.map((value, axis) => value - stlMin[axis]);
const report = {
  name: rig.name,
  speciesContract: {
    connectedHeadJoint: true,
    arms: rig.arms.length,
    longNeckSegments: params.segments,
    faceSignature: ["open oval eye", "chunky wink", "rounded muzzle loop", "dangling nose nub"],
  },
  params,
  surfaceDetailMm: {
    bodyRidge: Number((Math.max(.8, params.thickness * .3) - .12).toFixed(2)),
    faceRelief: Number((Math.max(1, params.thickness * .33) + .81).toFixed(2)),
  },
  printablePieces: parts.length,
  meshShells: meshCount,
  vertices: vertexCount,
  triangles: triangleCount,
  boundaryEdges,
  overlappingPartPairs: overlappingPartPairs.length,
  printBedLayoutMm: stlDimensions.map((value) => Number(value.toFixed(2))),
  stlBytes: stl.length,
};

if (rig.arms.length !== 4) throw new Error("species contract failed: expected exactly four arms");
if (triangleCount < 1000) throw new Error("geometry smoke test failed: unexpectedly sparse STL");
if (stl.length !== 84 + triangleCount * 50) throw new Error("binary STL length does not match triangle count");
if (boundaryEdges !== 0) throw new Error(`mesh audit failed: ${boundaryEdges} open boundary edges`);
dimensions.toArray().forEach((value, axis) => {
  if (Math.abs(value - stlDimensions[axis]) > .02) {
    throw new Error(`layout audit failed on axis ${axis}: scene ${value.toFixed(3)} mm vs STL ${stlDimensions[axis].toFixed(3)} mm`);
  }
});

const outputDirectories = ["artifacts", "models", "public/models"].map((directory) => path.resolve(directory));
const reportJson = `${JSON.stringify(report, null, 2)}\n`;
outputDirectories.forEach((directory) => {
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, stlFilename), stl);
  fs.writeFileSync(path.join(directory, "sophias-four-arm-articulated-dragon-report.json"), reportJson);
});

console.log(JSON.stringify(report, null, 2));
