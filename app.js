import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { STLExporter } from "three/addons/exporters/STLExporter.js";
import { SOPHIA_IMAGE } from "./sample-image.js";
import {
  makeArmPart,
  makeHeadPart,
  makeLinkPart,
  makePinPart,
  resampleSpine,
  rigPointToModel,
} from "./geometry.js";

const $ = (selector) => document.querySelector(selector);
$("#tested-stl").href = new URL("./models/sophias-four-arm-articulated-dragon-kit.stl", import.meta.url).href;

const SOPHIA_RIG = Object.freeze({
  name: "Sophia's four-armed dragon",
  spine: [
    { x: 0.34, y: 0.88, w: 24 },
    { x: 0.35, y: 0.77, w: 25 },
    { x: 0.37, y: 0.66, w: 23 },
    { x: 0.38, y: 0.55, w: 21 },
    { x: 0.41, y: 0.45, w: 18 },
    { x: 0.47, y: 0.35, w: 16 },
    { x: 0.56, y: 0.27, w: 14 },
    { x: 0.66, y: 0.21, w: 13 },
    { x: 0.75, y: 0.23, w: 12 },
    { x: 0.82, y: 0.32, w: 11 },
    { x: 0.84, y: 0.43, w: 10 },
  ],
  head: { x: 0.80, y: 0.53, size: 18 },
  arms: [
    { rootIndex: 2, tip: { x: 0.08, y: 0.64 }, label: "lower left" },
    { rootIndex: 2, tip: { x: 0.66, y: 0.66 }, label: "lower right" },
    { rootIndex: 4, tip: { x: 0.18, y: 0.44 }, label: "upper left" },
    { rootIndex: 4, tip: { x: 0.63, y: 0.46 }, label: "upper right" },
  ],
});

const state = {
  rig: cloneRig(SOPHIA_RIG),
  sourceName: "sophia-dragon.jpeg",
  image: new Image(),
  imageUrl: SOPHIA_IMAGE,
  selectedColor: "#ff784f",
  wireframe: false,
  exploded: false,
  wiggling: false,
  dragHandle: null,
  drawTransform: null,
  assembledParts: [],
  tintMaterials: [],
  localParts: [],
  pinParts: [],
  printGroup: null,
};

function cloneRig(rig) {
  return JSON.parse(JSON.stringify(rig));
}

function toast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove("show"), 2400);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

// ---------------------------------------------------------------------------
// Drawing + rig editor
// ---------------------------------------------------------------------------

const rigCanvas = $("#rig-canvas");
const rigContext = rigCanvas.getContext("2d");
let rigHandles = [];

function resizeRigCanvas() {
  const rect = rigCanvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(320, Math.round(rect.width));
  const height = Math.max(420, Math.round(rect.height));
  if (rigCanvas.width !== width * ratio || rigCanvas.height !== height * ratio) {
    rigCanvas.width = width * ratio;
    rigCanvas.height = height * ratio;
    rigContext.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  drawRig();
}

function drawRig() {
  if (!state.image.complete || !state.image.naturalWidth) return;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = rigCanvas.width / ratio;
  const height = rigCanvas.height / ratio;
  rigContext.clearRect(0, 0, width, height);
  rigContext.fillStyle = "#d9ceba";
  rigContext.fillRect(0, 0, width, height);

  const scale = Math.min(width / state.image.naturalWidth, height / state.image.naturalHeight);
  const drawWidth = state.image.naturalWidth * scale;
  const drawHeight = state.image.naturalHeight * scale;
  const offsetX = (width - drawWidth) / 2;
  const offsetY = (height - drawHeight) / 2;
  state.drawTransform = { offsetX, offsetY, drawWidth, drawHeight };
  rigContext.drawImage(state.image, offsetX, offsetY, drawWidth, drawHeight);
  rigContext.fillStyle = "rgba(20,33,28,.06)";
  rigContext.fillRect(offsetX, offsetY, drawWidth, drawHeight);

  const toScreen = (point) => ({
    x: offsetX + point.x * drawWidth,
    y: offsetY + point.y * drawHeight,
  });
  rigHandles = [];
  const spine = state.rig.spine.map(toScreen);

  rigContext.save();
  rigContext.lineCap = "round";
  rigContext.lineJoin = "round";
  rigContext.shadowColor = "rgba(0,0,0,.28)";
  rigContext.shadowBlur = 7;
  rigContext.strokeStyle = "rgba(20,33,28,.72)";
  rigContext.lineWidth = 13;
  rigContext.beginPath();
  spine.forEach((point, index) => index ? rigContext.lineTo(point.x, point.y) : rigContext.moveTo(point.x, point.y));
  rigContext.stroke();
  rigContext.shadowBlur = 0;
  rigContext.strokeStyle = "#69d6c4";
  rigContext.lineWidth = 7;
  rigContext.stroke();

  const head = toScreen(state.rig.head);
  const neckEnd = spine[spine.length - 1];
  rigContext.strokeStyle = "rgba(20,33,28,.72)";
  rigContext.lineWidth = 13;
  rigContext.beginPath(); rigContext.moveTo(neckEnd.x, neckEnd.y); rigContext.lineTo(head.x, head.y); rigContext.stroke();
  rigContext.strokeStyle = "#69d6c4"; rigContext.lineWidth = 7; rigContext.stroke();

  state.rig.arms.forEach((arm, index) => {
    const root = spine[arm.rootIndex];
    const tip = toScreen(arm.tip);
    rigContext.strokeStyle = "rgba(20,33,28,.68)";
    rigContext.lineWidth = 10;
    rigContext.beginPath(); rigContext.moveTo(root.x, root.y); rigContext.lineTo(tip.x, tip.y); rigContext.stroke();
    rigContext.strokeStyle = "#ff784f"; rigContext.lineWidth = 5; rigContext.stroke();
    drawHandle(tip.x, tip.y, "#ff784f", 8, String(index + 1));
    rigHandles.push({ kind: "arm", index, x: tip.x, y: tip.y });
  });

  spine.forEach((point, index) => {
    drawHandle(point.x, point.y, "#69d6c4", index === 0 ? 9 : 7, index === 0 ? "T" : "");
    rigHandles.push({ kind: "spine", index, x: point.x, y: point.y });
  });
  drawHandle(head.x, head.y, "#f0c95b", 12, "☺");
  rigHandles.push({ kind: "head", index: 0, x: head.x, y: head.y });
  rigContext.restore();
}

function drawHandle(x, y, color, radius, label = "") {
  rigContext.beginPath();
  rigContext.arc(x, y, radius + 4, 0, Math.PI * 2);
  rigContext.fillStyle = "rgba(20,33,28,.82)";
  rigContext.fill();
  rigContext.beginPath();
  rigContext.arc(x, y, radius, 0, Math.PI * 2);
  rigContext.fillStyle = color;
  rigContext.fill();
  if (label) {
    rigContext.fillStyle = "#14211c";
    rigContext.font = "800 9px ui-monospace, monospace";
    rigContext.textAlign = "center";
    rigContext.textBaseline = "middle";
    rigContext.fillText(label, x, y + .5);
  }
}

function canvasPoint(event) {
  const rect = rigCanvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function pointToNormalized(point) {
  const t = state.drawTransform;
  return {
    x: THREE.MathUtils.clamp((point.x - t.offsetX) / t.drawWidth, 0, 1),
    y: THREE.MathUtils.clamp((point.y - t.offsetY) / t.drawHeight, 0, 1),
  };
}

rigCanvas.addEventListener("pointerdown", (event) => {
  const point = canvasPoint(event);
  const handle = rigHandles
    .map((candidate) => ({ ...candidate, distance: Math.hypot(candidate.x - point.x, candidate.y - point.y) }))
    .sort((a, b) => a.distance - b.distance)[0];
  if (!handle || handle.distance > 28) return;
  state.dragHandle = handle;
  rigCanvas.classList.add("dragging");
  rigCanvas.setPointerCapture(event.pointerId);
});

rigCanvas.addEventListener("pointermove", (event) => {
  if (!state.dragHandle) return;
  const normalized = pointToNormalized(canvasPoint(event));
  if (state.dragHandle.kind === "spine") Object.assign(state.rig.spine[state.dragHandle.index], normalized);
  if (state.dragHandle.kind === "head") Object.assign(state.rig.head, normalized);
  if (state.dragHandle.kind === "arm") Object.assign(state.rig.arms[state.dragHandle.index].tip, normalized);
  drawRig();
});

function finishRigDrag() {
  if (!state.dragHandle) return;
  state.dragHandle = null;
  rigCanvas.classList.remove("dragging");
  buildCreature();
}
rigCanvas.addEventListener("pointerup", finishRigDrag);
rigCanvas.addEventListener("pointercancel", finishRigDrag);

function loadImage(url, name) {
  state.image.onload = () => { resizeRigCanvas(); buildCreature(); };
  state.image.src = url;
  state.sourceName = name;
}

$("#image-upload").addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (state.imageUrl.startsWith("blob:")) URL.revokeObjectURL(state.imageUrl);
  state.imageUrl = URL.createObjectURL(file);
  loadImage(state.imageUrl, file.name);
  toast("Drawing loaded. Drag the bones to teach us its anatomy.");
});

function restoreSophia() {
  state.rig = cloneRig(SOPHIA_RIG);
  state.imageUrl = SOPHIA_IMAGE;
  loadImage(SOPHIA_IMAGE, "sophia-dragon.jpeg");
  toast("Sophia's long-necked four-arm wonder restored.");
}
$("#sample-button").addEventListener("click", restoreSophia);
$("#reset-rig").addEventListener("click", () => {
  state.rig = cloneRig(SOPHIA_RIG);
  drawRig();
  buildCreature();
  toast("Bones reset. The dragon has remembered itself.");
});

function sketchStar(x, y, angle, scale = 1) {
  const points = [];
  for (let index = 0; index < 10; index++) {
    const radius = (index % 2 ? 5.5 : 12) * scale;
    const theta = angle + index * Math.PI / 5;
    points.push(`${(x + Math.cos(theta) * radius).toFixed(1)},${(y + Math.sin(theta) * radius).toFixed(1)}`);
  }
  return points.join(" ");
}

function exportSketch() {
  const width = 800;
  const height = 1000;
  const ink = "#d97643";
  const paper = "#fffaf0";
  const toSvg = (point) => ({ x: point.x * width, y: point.y * height });
  const spine = state.rig.spine.map(toSvg);
  const head = toSvg(state.rig.head);
  const elements = [];

  elements.push(`<rect width="${width}" height="${height}" rx="36" fill="${paper}"/>`);
  for (let index = 0; index < spine.length - 1; index++) {
    const a = spine[index], b = spine[index + 1];
    const outer = Math.max(22, state.rig.spine[index].w * 2.15);
    elements.push(`<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="${ink}" stroke-width="${outer.toFixed(1)}" stroke-linecap="round"/>`);
    elements.push(`<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="${paper}" stroke-width="${Math.max(14, outer - 5).toFixed(1)}" stroke-linecap="round"/>`);
  }
  for (let index = 1; index < spine.length - 1; index++) {
    const prev = spine[index - 1], next = spine[index + 1], point = spine[index];
    const angle = Math.atan2(next.y - prev.y, next.x - prev.x) + Math.PI / 2;
    const radius = state.rig.spine[index].w * 1.02;
    elements.push(`<line x1="${(point.x - Math.cos(angle) * radius).toFixed(1)}" y1="${(point.y - Math.sin(angle) * radius).toFixed(1)}" x2="${(point.x + Math.cos(angle) * radius).toFixed(1)}" y2="${(point.y + Math.sin(angle) * radius).toFixed(1)}" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>`);
  }

  const neck = spine.at(-1);
  elements.push(`<line x1="${neck.x.toFixed(1)}" y1="${neck.y.toFixed(1)}" x2="${head.x.toFixed(1)}" y2="${head.y.toFixed(1)}" stroke="${ink}" stroke-width="28" stroke-linecap="round"/>`);
  elements.push(`<line x1="${neck.x.toFixed(1)}" y1="${neck.y.toFixed(1)}" x2="${head.x.toFixed(1)}" y2="${head.y.toFixed(1)}" stroke="${paper}" stroke-width="22" stroke-linecap="round"/>`);
  elements.push(`<ellipse cx="${head.x.toFixed(1)}" cy="${head.y.toFixed(1)}" rx="48" ry="61" fill="${paper}" stroke="${ink}" stroke-width="5" transform="rotate(8 ${head.x.toFixed(1)} ${head.y.toFixed(1)})"/>`);
  elements.push(`<ellipse cx="${(head.x - 17).toFixed(1)}" cy="${(head.y - 10).toFixed(1)}" rx="7" ry="11" fill="none" stroke="${ink}" stroke-width="4"/>`);
  elements.push(`<ellipse cx="${(head.x + 17).toFixed(1)}" cy="${(head.y - 10).toFixed(1)}" rx="7" ry="11" fill="none" stroke="${ink}" stroke-width="4"/>`);
  elements.push(`<path d="M ${(head.x - 20).toFixed(1)} ${(head.y + 17).toFixed(1)} Q ${head.x.toFixed(1)} ${(head.y + 36).toFixed(1)} ${(head.x + 20).toFixed(1)} ${(head.y + 17).toFixed(1)}" fill="none" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>`);
  elements.push(`<circle cx="${head.x.toFixed(1)}" cy="${(head.y + 8).toFixed(1)}" r="5" fill="${ink}"/>`);

  state.rig.arms.forEach((arm) => {
    const root = spine[arm.rootIndex], tip = toSvg(arm.tip);
    const angle = Math.atan2(tip.y - root.y, tip.x - root.x);
    elements.push(`<line x1="${root.x.toFixed(1)}" y1="${root.y.toFixed(1)}" x2="${tip.x.toFixed(1)}" y2="${tip.y.toFixed(1)}" stroke="${ink}" stroke-width="15" stroke-linecap="round"/>`);
    elements.push(`<line x1="${root.x.toFixed(1)}" y1="${root.y.toFixed(1)}" x2="${tip.x.toFixed(1)}" y2="${tip.y.toFixed(1)}" stroke="${paper}" stroke-width="9" stroke-linecap="round"/>`);
    elements.push(`<polygon points="${sketchStar(tip.x, tip.y, angle, 1.05)}" fill="${paper}" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>`);
  });

  elements.push(`<text x="40" y="60" fill="${ink}" font-family="Georgia,serif" font-size="28">${state.rig.name.replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</text>`);
  elements.push(`<text x="40" y="91" fill="#746b5e" font-family="monospace" font-size="13" letter-spacing="2">CLEAN ARTICULATION SKETCH · 4 ARMS · HEAD ATTACHED</text>`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${elements.join("")}</svg>`;
  downloadBlob(new Blob([svg], { type: "image/svg+xml" }), "sophias-four-arm-dragon-sketch.svg");
  toast("Sketch exported: one tidy orange noodle-dragon blueprint.");
}

$("#download-sketch").addEventListener("click", exportSketch);

window.addEventListener("resize", resizeRigCanvas);

// ---------------------------------------------------------------------------
// Three.js viewer and printable geometry
// ---------------------------------------------------------------------------

const viewer = $("#viewer");
const scene = new THREE.Scene();
scene.background = new THREE.Color("#17201c");
scene.fog = new THREE.Fog("#17201c", 260, 520);
const camera = new THREE.PerspectiveCamera(34, 1, .1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
viewer.prepend(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = .055;
controls.autoRotate = true;
controls.autoRotateSpeed = .72;
controls.minDistance = 90;
controls.maxDistance = 430;

scene.add(new THREE.HemisphereLight("#fff2da", "#07110d", 2.4));
const keyLight = new THREE.DirectionalLight("#fff0d8", 5.8);
keyLight.position.set(-90, 150, 130);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight("#69d6c4", 3.1);
rimLight.position.set(120, 80, -110);
scene.add(rimLight);
const warmLight = new THREE.PointLight("#ff784f", 45, 260);
warmLight.position.set(-70, 40, 95);
scene.add(warmLight);

const floor = new THREE.Mesh(
  new THREE.CylinderGeometry(98, 105, 5, 72),
  new THREE.MeshStandardMaterial({ color: "#25342d", roughness: .87, metalness: .02 })
);
floor.position.y = -70;
floor.receiveShadow = true;
scene.add(floor);
const grid = new THREE.GridHelper(390, 39, "#4d695d", "#283a32");
grid.position.y = -72.55;
scene.add(grid);

let creatureRoot = new THREE.Group();
scene.add(creatureRoot);

function resizeViewer() {
  const width = viewer.clientWidth;
  const height = viewer.clientHeight;
  if (!width || !height) return;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resizeViewer).observe(viewer);

function createMaterial(color, roughness = .58) {
  const material = new THREE.MeshStandardMaterial({ color, roughness, metalness: .025, side: THREE.DoubleSide });
  state.tintMaterials.push(material);
  return material;
}

function placePart(localGroup, start, end, z, kind, wigglePhase = 0) {
  const instance = localGroup.clone(true);
  instance.position.set(start.x, start.y, z);
  instance.rotation.z = Math.atan2(end.y - start.y, end.x - start.x);
  instance.userData.baseZ = z;
  instance.userData.baseRotation = instance.rotation.z;
  instance.userData.kind = kind;
  instance.userData.phase = wigglePhase;
  creatureRoot.add(instance);
  state.assembledParts.push(instance);
  return instance;
}

function makeDisplayPin(position, height, zBase, radius, material, kind = "joint") {
  const pin = makePinPart(height, radius, material);
  pin.position.set(position.x, position.y, zBase);
  pin.userData.baseZ = zBase;
  pin.userData.baseRotation = 0;
  pin.userData.kind = kind;
  creatureRoot.add(pin);
  state.assembledParts.push(pin);
  return pin;
}

function disposeObject(object) {
  object.traverse((child) => {
    if (!child.isMesh) return;
    child.geometry?.dispose();
    if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose());
    else child.material?.dispose();
  });
}

function buildCreature() {
  const segmentCount = Number($("#segments").value);
  const depth = Number($("#thickness").value);
  const clearance = Number($("#clearance").value);
  const size = Number($("#creature-size").value);
  const scale = size / 140;
  const pinRadius = 1.3 * scale;
  const holeRadius = pinRadius + clearance;
  const layer = depth + clearance;

  scene.remove(creatureRoot);
  disposeObject(creatureRoot);
  creatureRoot = new THREE.Group();
  scene.add(creatureRoot);
  state.assembledParts = [];
  state.tintMaterials.forEach((material) => material.dispose());
  state.tintMaterials = [];
  state.localParts = [];
  state.pinParts = [];

  const spineRig = resampleSpine(state.rig.spine, segmentCount);
  const spine = spineRig.map((point) => rigPointToModel(point, size));
  const bodyMaterials = [
    createMaterial(state.selectedColor),
    createMaterial(new THREE.Color(state.selectedColor).offsetHSL(.018, -.02, -.075)),
    createMaterial(new THREE.Color(state.selectedColor).offsetHSL(-.015, .01, .045)),
  ];
  const pinMaterial = new THREE.MeshStandardMaterial({ color: "#f0c95b", roughness: .42, metalness: .08 });

  for (let index = 0; index < segmentCount; index++) {
    const start = spine[index], end = spine[index + 1];
    const length = start.distanceTo(end);
    const radiusStart = Math.max(7.2, spineRig[index].w * scale);
    const radiusEnd = Math.max(6.5, spineRig[index + 1].w * scale);
    const local = makeLinkPart(length, radiusStart, radiusEnd, depth, holeRadius, index > 0, true, bodyMaterials[index % bodyMaterials.length]);
    state.localParts.push({ name: `body-${index + 1}`, group: local });
    placePart(local, start, end, index % 2 ? layer : 0, "body", index * .55);
  }

  const headPoint = rigPointToModel(state.rig.head, size);
  const neckEnd = spine.at(-1);
  const headLength = Math.max(18 * scale, neckEnd.distanceTo(headPoint));
  const headSize = state.rig.head.size * scale;
  const headLocal = makeHeadPart(headLength, depth, holeRadius, headSize, bodyMaterials[0], createMaterial(state.selectedColor));
  state.localParts.push({ name: "head-with-cute-face", group: headLocal });
  placePart(headLocal, neckEnd, headPoint, segmentCount % 2 ? layer : 0, "head", 1.1);

  const armRoots = new Map();
  state.rig.arms.forEach((arm, armIndex) => {
    const rootIndex = THREE.MathUtils.clamp(Math.round(arm.rootIndex / (state.rig.spine.length - 1) * segmentCount), 1, segmentCount - 1);
    const root = spine[rootIndex];
    const tip = rigPointToModel(arm.tip, size);
    const length = root.distanceTo(tip);
    const local = makeArmPart(length, depth, holeRadius, bodyMaterials[(armIndex + 1) % bodyMaterials.length]);
    state.localParts.push({ name: `arm-${armIndex + 1}-${arm.label.replaceAll(" ", "-")}`, group: local });
    const armLayer = (2 + armIndex % 2) * layer;
    placePart(local, root, tip, armLayer, "arm", armIndex * 1.7);
    const existing = armRoots.get(rootIndex) || [];
    existing.push(armIndex);
    armRoots.set(rootIndex, existing);
  });

  for (let jointIndex = 1; jointIndex <= segmentCount; jointIndex++) {
    const armsAtJoint = armRoots.get(jointIndex)?.length || 0;
    const stackCount = Math.max(2, 2 + armsAtJoint);
    const height = stackCount * depth + (stackCount - 1) * clearance + 1.4;
    makeDisplayPin(spine[jointIndex], height, -.7, pinRadius, pinMaterial, armsAtJoint ? "arm-joint" : "joint");
    state.pinParts.push({ name: `pin-${jointIndex}`, group: makePinPart(height, pinRadius, pinMaterial) });
  }

  buildPrintLayout();
  frameCreature();
  applyWireframe();
  applyExplode();
  updateMetrics(segmentCount);
  $("#viewer-loading").hidden = true;
}

function buildPrintLayout() {
  state.printGroup = new THREE.Group();
  const bedWidth = 212;
  const gap = 7;
  let cursorX = 0, cursorY = 0, rowHeight = 0;
  const layoutItems = [...state.localParts, ...state.pinParts].map((part) => {
    const clone = part.group.clone(true);
    clone.position.set(0,0,0);
    clone.rotation.set(0,0,0);
    clone.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(clone);
    return { clone, box, width: box.max.x - box.min.x, height: box.max.y - box.min.y };
  }).sort((a, b) => b.height - a.height);
  layoutItems.forEach(({ clone, box, width, height }) => {
    if (cursorX && cursorX + width > bedWidth) {
      cursorX = 0;
      cursorY += rowHeight + gap;
      rowHeight = 0;
    }
    clone.position.x += cursorX - box.min.x;
    clone.position.y += cursorY - box.min.y;
    state.printGroup.add(clone);
    cursorX += width + gap;
    rowHeight = Math.max(rowHeight, height);
  });
  state.printGroup.userData.bed = { width: bedWidth, depth: cursorY + rowHeight };
}

function frameCreature() {
  const box = new THREE.Box3().setFromObject(creatureRoot);
  const center = box.getCenter(new THREE.Vector3());
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  floor.position.y = box.min.y - 7;
  grid.position.y = floor.position.y - 2.55;
  controls.target.copy(center);
  controls.target.z = 1;
  const distance = Math.max(125, sphere.radius * 2.55);
  camera.position.set(center.x + distance * .64, center.y + distance * .28, center.z + distance);
  controls.minDistance = sphere.radius * 1.15;
  controls.maxDistance = sphere.radius * 5.2;
  camera.near = Math.max(.1, distance / 120);
  camera.far = distance * 12;
  camera.updateProjectionMatrix();
  controls.update();
}

function applyWireframe() {
  state.tintMaterials.forEach((material) => material.wireframe = state.wireframe);
}

function applyExplode() {
  const middle = (state.assembledParts.length - 1) / 2;
  state.assembledParts.forEach((part, index) => {
    part.position.z = part.userData.baseZ + (state.exploded ? (index - middle) * 1.45 : 0);
  });
}

function updateMetrics(segmentCount) {
  $("#parts-metric").textContent = String(segmentCount + 5);
  $("#joints-metric").textContent = String(segmentCount + 4);
}

function updateControlLabels() {
  $("#segments-value").textContent = $("#segments").value;
  $("#thickness-value").textContent = `${Number($("#thickness").value).toFixed(1)} mm`;
  $("#clearance-value").textContent = `${Number($("#clearance").value).toFixed(2)} mm`;
  $("#size-value").textContent = `${$("#creature-size").value} mm`;
}

let rebuildTimer;
["#segments", "#thickness", "#clearance", "#creature-size"].forEach((selector) => {
  $(selector).addEventListener("input", () => {
    updateControlLabels();
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(buildCreature, 120);
  });
});
$("#generate-button").addEventListener("click", () => { buildCreature(); toast("Dragon regenerated. Head attached. Four arms accounted for."); });

document.querySelectorAll(".swatch").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".swatch").forEach((candidate) => candidate.classList.toggle("active", candidate === button));
    state.selectedColor = button.dataset.color;
    buildCreature();
  });
});

$("#wireframe-button").addEventListener("click", (event) => {
  state.wireframe = !state.wireframe;
  event.currentTarget.classList.toggle("active", state.wireframe);
  applyWireframe();
});
$("#explode-button").addEventListener("click", (event) => {
  state.exploded = !state.exploded;
  event.currentTarget.classList.toggle("active", state.exploded);
  applyExplode();
});
$("#wiggle-button").addEventListener("click", (event) => {
  state.wiggling = !state.wiggling;
  event.currentTarget.classList.toggle("active", state.wiggling);
  toast(state.wiggling ? "The improbable noodle awakens." : "Dragon politely holding still.");
});
$("#camera-reset").addEventListener("click", frameCreature);

$("#download-stl").addEventListener("click", () => {
  if (!state.printGroup) return;
  const exporter = new STLExporter();
  const dataView = exporter.parse(state.printGroup, { binary: true });
  const blob = new Blob([dataView.buffer], { type: "model/stl" });
  downloadBlob(blob, "sophias-four-arm-articulated-dragon-kit.stl");
  toast("STL downloaded: plates, four arms, head, and pegs. Tiny dragon factory achieved!");
});

$("#download-recipe").addEventListener("click", () => {
  const recipe = {
    schema: "drawing-to-3d-print/creature-recipe@1",
    name: state.rig.name,
    source: state.sourceName,
    units: "mm",
    articulation: "alternating-plate pin hinges",
    parameters: {
      bodySegments: Number($("#segments").value),
      plateThickness: Number($("#thickness").value),
      jointClearance: Number($("#clearance").value),
      creatureSize: Number($("#creature-size").value),
      arms: 4,
    },
    rig: state.rig,
    note: "Preserve the weird.",
  };
  downloadBlob(new Blob([JSON.stringify(recipe, null, 2)], { type: "application/json" }), "sophias-dragon.recipe.json");
  toast("Recipe saved. The dragon can be regenerated, not merely remembered.");
});

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const time = clock.getElapsedTime();
  state.assembledParts.forEach((part) => {
    if (!state.wiggling || !["arm", "head"].includes(part.userData.kind)) {
      part.rotation.z += (part.userData.baseRotation - part.rotation.z) * .08;
      return;
    }
    const amplitude = part.userData.kind === "head" ? .055 : .16;
    part.rotation.z = part.userData.baseRotation + Math.sin(time * 2.2 + part.userData.phase) * amplitude;
  });
  controls.update();
  renderer.render(scene, camera);
}

updateControlLabels();
resizeViewer();
loadImage(SOPHIA_IMAGE, "sophia-dragon.jpeg");
animate();
