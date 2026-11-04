import { state } from '../state.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

state.init3D = function init3D() {
  const canvas = document.getElementById('three-canvas');
  const rect = document.getElementById('viewport').getBoundingClientRect();

  state.scene = new THREE.Scene();
  state.scene.fog = new THREE.FogExp2(0x07080d, 0.04);

  state.camera = new THREE.PerspectiveCamera(50, rect.width / rect.height, 0.1, 1000);
  state.camera.position.set(6, 5, 8);

  state.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  state.renderer.setSize(rect.width, rect.height);
  state.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  state.renderer.setClearColor(0x07080d, 1);

  state.controls = new OrbitControls(state.camera, state.renderer.domElement);
  state.controls.enableDamping = true;
  state.controls.dampingFactor = 0.08;
  state.controls.minDistance = 5;
  state.controls.maxDistance = 25;
  state.controls.target.set(0, 0, 0);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0x334466, 0.5);
  state.scene.add(ambientLight);

  const pointLight1 = new THREE.PointLight(state.CYAN, 0.8, 30);
  pointLight1.position.set(5, 8, 5);
  state.scene.add(pointLight1);

  const pointLight2 = new THREE.PointLight(state.PINK, 0.5, 30);
  pointLight2.position.set(-5, -3, -5);
  state.scene.add(pointLight2);

  // Grid helper lines (subtle)
  const gridSize = 4;
  const gridMat = new THREE.LineBasicMaterial({
    color: 0x1a1f3a,
    transparent: true,
    opacity: 0.3,
  });
  for (let i = -gridSize; i <= gridSize; i++) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(i, -0.01, -gridSize),
      new THREE.Vector3(i, -0.01, gridSize),
    ]);
    state.scene.add(new THREE.Line(geo, gridMat));
    const geo2 = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-gridSize, -0.01, i),
      new THREE.Vector3(gridSize, -0.01, i),
    ]);
    state.scene.add(new THREE.Line(geo2, gridMat));
  }

  state.buildCells();

  // Raycasting & Pointer/Touch Interaction
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pointerDownPos = { x: 0, y: 0, time: 0 };

  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;

    const rect = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, state.camera);

    const intersects = raycaster.intersectObjects(
      state.cellMeshes.filter((m) => m.visible),
    );
    const prevHovered = state.hoveredCell;
    state.hoveredCell = -1;
    if (intersects.length > 0) {
      const mesh = intersects[0].object;
      const ci = mesh.userData.cellIndex;
      if (state.board[ci] === state.EMPTY && !state.gameOver) {
        state.hoveredCell = ci;
        document.body.style.cursor = 'pointer';
      }
    }
    if (state.hoveredCell === -1) document.body.style.cursor = 'default';
    if (state.hoveredCell !== prevHovered) {
      state.updateGhostPreview();
      state.updateCellHighlights();
      if (state.hoveredCell !== -1) state.playSound('hover');
    }
  });

  canvas.addEventListener('pointerleave', () => {
    if (state.hoveredCell !== -1) {
      state.hoveredCell = -1;
      state.updateGhostPreview();
      state.updateCellHighlights();
    }
  });

  canvas.addEventListener('pointerdown', (e) => {
    pointerDownPos.x = e.clientX;
    pointerDownPos.y = e.clientY;
    pointerDownPos.time = Date.now();
  });

  canvas.addEventListener('pointerup', (e) => {
    const dx = e.clientX - pointerDownPos.x;
    const dy = e.clientY - pointerDownPos.y;
    const dist = Math.hypot(dx, dy);
    const dt = Date.now() - pointerDownPos.time;

    if (dist > 12 || dt > 450) return;

    const rect = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, state.camera);

    const intersects = raycaster.intersectObjects(
      state.cellMeshes.filter((m) => m.visible),
    );
    if (intersects.length > 0) {
      const mesh = intersects[0].object;
      const ci = mesh.userData.cellIndex;
      if (state.board[ci] === state.EMPTY && !state.gameOver && !state.isCurrentPlayerBot()) {
        state.makeMove(ci);
      }
    }
  });

  window.addEventListener('resize', state.onResize);
  state.animate();
}

state.buildCells = function buildCells() {
  // Clear existing
  state.cellMeshes.forEach((m) => state.scene.remove(m));
  state.glyphMeshes.forEach((m) => state.scene.remove(m));
  state.cellMeshes = [];
  state.glyphMeshes = [];
  if (state.ghostMesh) {
    state.scene.remove(state.ghostMesh);
    state.ghostMesh = null;
  }
  state.clearWinLines3D();

  const spacing = 1.6;
  const cellGeo = new THREE.BoxGeometry(1.1, 1.1, 1.1);
  const edgeGeo = new THREE.EdgesGeometry(cellGeo);

  for (let i = 0; i < 27; i++) {
    const { x, y, z } = state.idxToCoord(i);
    const px = (x - 1) * spacing;
    const py = (y - 1) * spacing * (1 + state.explodeAmount);
    const pz = (z - 1) * spacing;

    // Transparent fill
    const fillMat = new THREE.MeshPhongMaterial({
      color: 0x151a2e,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(cellGeo, fillMat);
    mesh.position.set(px, py, pz);
    mesh.userData.cellIndex = i;
    state.scene.add(mesh);
    state.cellMeshes.push(mesh);

    // Wireframe edges
    const edgeMat = new THREE.LineBasicMaterial({
      color: 0x2a3055,
      transparent: true,
      opacity: 0.4,
    });
    const edges = new THREE.LineSegments(edgeGeo, edgeMat);
    edges.position.copy(mesh.position);
    edges.userData.cellIndex = i;
    state.scene.add(edges);

    // Glyph placeholder (invisible initially)
    state.glyphMeshes.push(null);
  }
}

state.updateCellPositions = function updateCellPositions() {
  const spacing = 1.6;
  for (let i = 0; i < 27; i++) {
    const { x, y, z } = state.idxToCoord(i);
    const px = (x - 1) * spacing;
    const py = (y - 1) * spacing * (1 + state.explodeAmount);
    const pz = (z - 1) * spacing;

    state.cellMeshes[i].position.set(px, py, pz);

    // Update visibility for layer isolation
    if (state.isolatedLayer === -1) {
      state.cellMeshes[i].visible = true;
    } else {
      state.cellMeshes[i].visible = y === state.isolatedLayer;
    }

    // Update glyph positions
    if (state.glyphMeshes[i]) {
      state.glyphMeshes[i].position.set(px, py, pz);
      state.glyphMeshes[i].visible = state.cellMeshes[i].visible;
    }
  }

  // Update edges too
  state.scene.children.forEach((child) => {
    if (
      child instanceof THREE.LineSegments &&
      child.userData.cellIndex !== undefined
    ) {
      const ci = child.userData.cellIndex;
      child.position.copy(state.cellMeshes[ci].position);
      child.visible = state.cellMeshes[ci].visible;
    }
  });
}

state.updateCellHighlights = function updateCellHighlights() {
  state.scene.children.forEach((child) => {
    if (
      child instanceof THREE.LineSegments &&
      child.userData.cellIndex !== undefined
    ) {
      const ci = child.userData.cellIndex;
      if (ci === state.hoveredCell && state.board[ci] === state.EMPTY) {
        child.material.color.setHex(state.getPlayerColorHex(state.currentPlayer));
        child.material.opacity = 0.9;
      } else if (state.winLine && state.winLine.includes(ci)) {
        const winner = state.board[state.winLine[0]];
        child.material.color.setHex(state.getPlayerColorHex(winner));
        child.material.opacity = 1.0;
      } else {
        child.material.color.setHex(0x2a3055);
        child.material.opacity = 0.4;
      }
    }
  });

  // Dim non-winning cells when game is won
  state.cellMeshes.forEach((mesh, i) => {
    if (state.winLine && !state.winLine.includes(i)) {
      mesh.material.opacity = 0.02;
    } else if (state.winLine && state.winLine.includes(i)) {
      const winner = state.board[state.winLine[0]];
      mesh.material.color.setHex(state.getPlayerColorHex(winner));
      mesh.material.opacity = 0.15;
    } else {
      mesh.material.color.setHex(0x151a2e);
      mesh.material.opacity = 0.08;
    }
  });
}

state.createGlyph3D = function createGlyph3D(player, position) {
  let glyph;
  if (player === state.X) {
    // X: crossed bars
    const barGeo = new THREE.BoxGeometry(0.08, 0.8, 0.08);
    const barMat = new THREE.MeshPhongMaterial({
      color: state.CYAN,
      emissive: state.CYAN,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.9,
    });
    glyph = new THREE.Group();
    const bar1 = new THREE.Mesh(barGeo, barMat);
    bar1.rotation.z = Math.PI / 4;
    const bar2 = new THREE.Mesh(barGeo, barMat.clone());
    bar2.rotation.z = -Math.PI / 4;
    glyph.add(bar1, bar2);

    // Add a subtle point light
    const light = new THREE.PointLight(state.CYAN, 0.4, 3);
    glyph.add(light);
  } else if (player === state.O) {
    // O: torus ring
    const torusGeo = new THREE.TorusGeometry(0.32, 0.05, 12, 32);
    const torusMat = new THREE.MeshPhongMaterial({
      color: state.PINK,
      emissive: state.PINK,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.9,
    });
    glyph = new THREE.Mesh(torusGeo, torusMat);
    glyph.rotation.x = Math.PI / 2;

    const light = new THREE.PointLight(state.PINK, 0.4, 3);
    glyph.add(light);
  } else if (player === state.TRIANGLE) {
    // Triangle: 3D hollow neon triangle prism
    const shape = new THREE.Shape();
    const r = 0.38;
    const sin60 = Math.sin(Math.PI / 3);
    const cos60 = Math.cos(Math.PI / 3);

    // Outer triangle
    shape.moveTo(0, r);
    shape.lineTo(r * sin60, -r * cos60);
    shape.lineTo(-r * sin60, -r * cos60);
    shape.closePath();

    // Inner cutout hole
    const hole = new THREE.Path();
    const ir = 0.23;
    hole.moveTo(0, ir);
    hole.lineTo(-ir * sin60, -ir * cos60);
    hole.lineTo(ir * sin60, -ir * cos60);
    hole.closePath();
    shape.holes.push(hole);

    const extrudeSettings = {
      depth: 0.08,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.015,
      bevelThickness: 0.015,
    };
    const triGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    triGeo.center();

    const triMat = new THREE.MeshPhongMaterial({
      color: state.TRI_COLOR,
      emissive: state.TRI_COLOR,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.9,
    });
    glyph = new THREE.Mesh(triGeo, triMat);

    const light = new THREE.PointLight(state.TRI_COLOR, 0.4, 3);
    glyph.add(light);
  }
  if (glyph) glyph.position.copy(position);
  return glyph;
}

state.placeGlyph3D = function placeGlyph3D(cellIndex) {
  const pos = state.cellMeshes[cellIndex].position.clone();
  const glyph = state.createGlyph3D(state.board[cellIndex], pos);
  glyph.scale.set(0.01, 0.01, 0.01);
  state.scene.add(glyph);
  state.glyphMeshes[cellIndex] = glyph;

  // Animate scale in
  const targetScale = 1;
  const animate = () => {
    if (glyph.scale.x < targetScale) {
      glyph.scale.multiplyScalar(1.15);
      if (glyph.scale.x > targetScale)
        glyph.scale.set(targetScale, targetScale, targetScale);
      requestAnimationFrame(animate);
    }
  };
  animate();
}

state.updateGhostPreview = function updateGhostPreview() {
  if (state.ghostMesh) {
    state.scene.remove(state.ghostMesh);
    state.ghostMesh = null;
  }
  if (state.hoveredCell === -1 || state.board[state.hoveredCell] !== state.EMPTY || state.gameOver) return;

  const pos = state.cellMeshes[state.hoveredCell].position.clone();
  state.ghostMesh = state.createGlyph3D(state.currentPlayer, pos);
  state.ghostMesh.traverse((child) => {
    if (child.isMesh) {
      child.material = child.material.clone();
      child.material.opacity = 0.2;
      child.material.emissiveIntensity = 0.3;
    }
    if (child.isLight) child.intensity = 0.1;
  });
  state.scene.add(state.ghostMesh);
}

state.clearWinLines3D = function clearWinLines3D() {
  if (state.winLineMesh) {
    state.scene.remove(state.winLineMesh);
    if (state.winLineMesh.geometry) state.winLineMesh.geometry.dispose();
    if (state.winLineMesh.material) state.winLineMesh.material.dispose();
    state.winLineMesh = null;
  }
  const toRemove = [];
  state.scene.children.forEach((child) => {
    if (child && child.userData && child.userData.isWinTube) {
      toRemove.push(child);
    }
  });
  toRemove.forEach((child) => {
    state.scene.remove(child);
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
  });
}

state.drawWinLine3D = function drawWinLine3D(cells) {
  state.clearWinLines3D();

  const positions = cells.map((ci) => state.cellMeshes[ci].position);
  const geo = new THREE.BufferGeometry().setFromPoints(positions);
  const winner = state.board[cells[0]];
  const winColor = state.getPlayerColorHex(winner);
  const mat = new THREE.LineBasicMaterial({
    color: winColor,
    linewidth: 2,
    transparent: true,
    opacity: 1,
  });
  state.winLineMesh = new THREE.Line(geo, mat);
  state.scene.add(state.winLineMesh);

  // Also add a thick glowing tube
  const curve = new THREE.CatmullRomCurve3(positions);
  const tubeGeo = new THREE.TubeGeometry(curve, 20, 0.06, 8, false);
  const tubeMat = new THREE.MeshPhongMaterial({
    color: winColor,
    emissive: winColor,
    emissiveIntensity: 1.5,
    transparent: true,
    opacity: 0.7,
  });
  const tube = new THREE.Mesh(tubeGeo, tubeMat);
  tube.userData.isWinTube = true;
  state.scene.add(tube);
}

state.onResize = function onResize() {
  const rect = document.getElementById('viewport').getBoundingClientRect();
  state.camera.aspect = rect.width / rect.height;
  state.camera.updateProjectionMatrix();
  state.renderer.setSize(rect.width, rect.height);
}

state.animate = function animate() {
  state.animFrame = requestAnimationFrame(state.animate);
  state.controls.update();

  // Rotate glyphs slightly
  state.glyphMeshes.forEach((g, i) => {
    if (g) {
      if (state.board[i] === state.O) g.rotation.z += 0.008;
      if (state.board[i] === state.TRIANGLE) g.rotation.y += 0.012;
    }
  });

  // Pulse win tube
  state.scene.children.forEach((child) => {
    if (child.userData && child.userData.isWinTube) {
      const t = Date.now() * 0.003;
      child.material.emissiveIntensity = 1.0 + Math.sin(t) * 0.5;
      child.material.opacity = 0.5 + Math.sin(t) * 0.2;
    }
  });

  if (state.viewMode === '3d') state.renderer.render(state.scene, state.camera);
}

// ═══════════════════════════════════════════════════════════════
