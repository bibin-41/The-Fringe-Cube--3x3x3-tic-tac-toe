// ═══════════════════════════════════════════════════════════════
    // HYPERGRID // 3X3X3  —  Game Engine
    // ═══════════════════════════════════════════════════════════════

    // ── Constants ─────────────────────────────────────────────────
    const EMPTY = 0, X = 1, O = 2, TRIANGLE = 3;
    const CYAN = 0x00f0ff, PINK = 0xff0055, TRI_COLOR = 0x00ff88, VIOLET = 0x8a2be2;

    // ── Game State ────────────────────────────────────────────────
    let board = new Array(27).fill(EMPTY);
    let currentPlayer = X;
    let gameOver = false;
    let winLine = null;
    let viewMode = '2d'; // '3d' or '2d'
    let primaryMode = '2p'; // '2p' or '3p' (Default: 2P)
    let mode2P = 'ai'; // 'human' or 'ai' (Default: vs AI)
    let gameMode = 'ai'; // 'ai' (2P vs AI default), 'pvp' (2P), or '3p' (3P)
    let botMode3P = '0'; // '0': 3 Humans, '1': 2 Humans & 1Bot, '2': 1 Human and 2 Bots
    let aiDifficulty = 'medium'; // Default: 'medium'
    let audioEnabled = true;
    let moveHistory = [];
    let scores = { x: 0, o: 0, tri: 0, draw: 0 };
    let isolatedLayer = -1;
    let explodeAmount = 0.3;

    function getPlayerColorHex(player) {
      if (player === X) return CYAN;
      if (player === O) return PINK;
      if (player === TRIANGLE) return TRI_COLOR;
      return 0x2a3055;
    }

    function getPlayerSymbol(player) {
      if (player === X) return '✕';
      if (player === O) return '◯';
      if (player === TRIANGLE) return '△';
      return '';
    }

    function isCurrentPlayerBot() {
      if (primaryMode === '2p' || gameMode === 'ai' || gameMode === 'pvp') {
        return (mode2P === 'ai' || gameMode === 'ai') && currentPlayer === O;
      }
      if (primaryMode === '3p' || gameMode === '3p') {
        if (botMode3P === '1') return currentPlayer === TRIANGLE;
        if (botMode3P === '2') return currentPlayer === O || currentPlayer === TRIANGLE;
      }
      return false;
    }

    // ── 49 Winning Lines ─────────────────────────────────────────
    // index = y*9 + z*3 + x  (layer=y, row=z, col=x)
    function idx(x, y, z) { return y * 9 + z * 3 + x; }

    const WIN_LINES = [];
    const WIN_LINE_LABELS = [];

    // Helper to add a line
    function addLine(cells, label) {
      WIN_LINES.push(cells);
      WIN_LINE_LABELS.push(label);
    }

    // 9 rows per axis direction × 3 axes = 27 axial lines
    // X-axis rows (along x for fixed y,z)
    for (let y = 0; y < 3; y++)
      for (let z = 0; z < 3; z++)
        addLine([idx(0, y, z), idx(1, y, z), idx(2, y, z)], `X-Row L${y + 1} R${z + 1}`);

    // Y-axis columns (along y for fixed x,z)
    for (let x = 0; x < 3; x++)
      for (let z = 0; z < 3; z++)
        addLine([idx(x, 0, z), idx(x, 1, z), idx(x, 2, z)], `Y-Col C${x + 1} R${z + 1}`);

    // Z-axis columns (along z for fixed x,y)
    for (let x = 0; x < 3; x++)
      for (let y = 0; y < 3; y++)
        addLine([idx(x, y, 0), idx(x, y, 1), idx(x, y, 2)], `Z-Col C${x + 1} L${y + 1}`);

    // 18 planar diagonals (2 diagonals × 3 slices × 3 planes)
    // XY plane diagonals (fixed z)
    for (let z = 0; z < 3; z++) {
      addLine([idx(0, 0, z), idx(1, 1, z), idx(2, 2, z)], `XY-Diag R${z + 1} ↘`);
      addLine([idx(2, 0, z), idx(1, 1, z), idx(0, 2, z)], `XY-Diag R${z + 1} ↙`);
    }
    // XZ plane diagonals (fixed y)
    for (let y = 0; y < 3; y++) {
      addLine([idx(0, y, 0), idx(1, y, 1), idx(2, y, 2)], `XZ-Diag L${y + 1} ↘`);
      addLine([idx(2, y, 0), idx(1, y, 1), idx(0, y, 2)], `XZ-Diag L${y + 1} ↙`);
    }
    // YZ plane diagonals (fixed x)
    for (let x = 0; x < 3; x++) {
      addLine([idx(x, 0, 0), idx(x, 1, 1), idx(x, 2, 2)], `YZ-Diag C${x + 1} ↘`);
      addLine([idx(x, 2, 0), idx(x, 1, 1), idx(x, 0, 2)], `YZ-Diag C${x + 1} ↙`);
    }

    // 4 space diagonals
    addLine([idx(0, 0, 0), idx(1, 1, 1), idx(2, 2, 2)], 'Space Diag 1');
    addLine([idx(2, 0, 0), idx(1, 1, 1), idx(0, 2, 2)], 'Space Diag 2');
    addLine([idx(0, 0, 2), idx(1, 1, 1), idx(2, 2, 0)], 'Space Diag 3');
    addLine([idx(2, 0, 2), idx(1, 1, 1), idx(0, 2, 0)], 'Space Diag 4');

    // Precomputed cell to winning lines index map & strategic anchors
    const CELL_WIN_LINES = Array.from({ length: 27 }, () => []);
    for (let i = 0; i < WIN_LINES.length; i++) {
      for (let j = 0; j < 3; j++) {
        CELL_WIN_LINES[WIN_LINES[i][j]].push(i);
      }
    }
    const CORNERS = [0, 2, 6, 8, 18, 20, 24, 26];

    // ── Coordinate helpers ───────────────────────────────────────
    function idxToCoord(i) {
      const y = Math.floor(i / 9);
      const z = Math.floor((i % 9) / 3);
      const x = i % 3;
      return { x, y, z };
    }

    function coordLabel(i) {
      const c = idxToCoord(i);
      return `L${c.y + 1}(${c.x},${c.z})`;
    }

    // ── Win Detection ────────────────────────────────────────────
    function checkWin(b) {
      for (let i = 0; i < WIN_LINES.length; i++) {
        const [a, bb, c] = WIN_LINES[i];
        if (b[a] !== EMPTY && b[a] === b[bb] && b[bb] === b[c]) {
          return { winner: b[a], line: WIN_LINES[i], lineIndex: i };
        }
      }
      return null;
    }

    function fastCheckWin(b) {
      for (let i = 0; i < WIN_LINES.length; i++) {
        const line = WIN_LINES[i];
        const v = b[line[0]];
        if (v !== EMPTY && v === b[line[1]] && v === b[line[2]]) {
          return v;
        }
      }
      return 0;
    }

    function isBoardFull(b) {
      return b.every(c => c !== EMPTY);
    }

    // ═══════════════════════════════════════════════════════════════
    // Three.js — 3D Viewport
    // ═══════════════════════════════════════════════════════════════

    let scene, camera, renderer, controls;
    let cellMeshes = [];
    let glyphMeshes = [];
    let ghostMesh = null;
    let winLineMesh = null;
    let hoveredCell = -1;
    let animFrame;

    function init3D() {
      const canvas = document.getElementById('three-canvas');
      const rect = document.getElementById('viewport').getBoundingClientRect();

      scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x07080d, 0.04);

      camera = new THREE.PerspectiveCamera(50, rect.width / rect.height, 0.1, 1000);
      camera.position.set(6, 5, 8);

      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setSize(rect.width, rect.height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x07080d, 1);

      controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.minDistance = 5;
      controls.maxDistance = 25;
      controls.target.set(0, 0, 0);

      // Lighting
      const ambientLight = new THREE.AmbientLight(0x334466, 0.5);
      scene.add(ambientLight);

      const pointLight1 = new THREE.PointLight(CYAN, 0.8, 30);
      pointLight1.position.set(5, 8, 5);
      scene.add(pointLight1);

      const pointLight2 = new THREE.PointLight(PINK, 0.5, 30);
      pointLight2.position.set(-5, -3, -5);
      scene.add(pointLight2);

      // Grid helper lines (subtle)
      const gridSize = 4;
      const gridMat = new THREE.LineBasicMaterial({ color: 0x1a1f3a, transparent: true, opacity: 0.3 });
      for (let i = -gridSize; i <= gridSize; i++) {
        const geo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(i, -0.01, -gridSize),
          new THREE.Vector3(i, -0.01, gridSize)
        ]);
        scene.add(new THREE.Line(geo, gridMat));
        const geo2 = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-gridSize, -0.01, i),
          new THREE.Vector3(gridSize, -0.01, i)
        ]);
        scene.add(new THREE.Line(geo2, gridMat));
      }

      buildCells();

      // Raycasting & Pointer/Touch Interaction
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      let pointerDownPos = { x: 0, y: 0, time: 0 };

      canvas.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'touch') return;

        const rect = canvas.getBoundingClientRect();
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);

        const intersects = raycaster.intersectObjects(cellMeshes.filter(m => m.visible));
        const prevHovered = hoveredCell;
        hoveredCell = -1;
        if (intersects.length > 0) {
          const mesh = intersects[0].object;
          const ci = mesh.userData.cellIndex;
          if (board[ci] === EMPTY && !gameOver) {
            hoveredCell = ci;
            document.body.style.cursor = 'pointer';
          }
        }
        if (hoveredCell === -1) document.body.style.cursor = 'default';
        if (hoveredCell !== prevHovered) {
          updateGhostPreview();
          updateCellHighlights();
          if (hoveredCell !== -1) playSound('hover');
        }
      });

      canvas.addEventListener('pointerleave', () => {
        if (hoveredCell !== -1) {
          hoveredCell = -1;
          updateGhostPreview();
          updateCellHighlights();
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
        raycaster.setFromCamera(pointer, camera);

        const intersects = raycaster.intersectObjects(cellMeshes.filter(m => m.visible));
        if (intersects.length > 0) {
          const mesh = intersects[0].object;
          const ci = mesh.userData.cellIndex;
          if (board[ci] === EMPTY && !gameOver && !isCurrentPlayerBot()) {
            makeMove(ci);
          }
        }
      });

      window.addEventListener('resize', onResize);
      animate();
    }

    function buildCells() {
      // Clear existing
      cellMeshes.forEach(m => scene.remove(m));
      glyphMeshes.forEach(m => scene.remove(m));
      cellMeshes = [];
      glyphMeshes = [];
      if (ghostMesh) { scene.remove(ghostMesh); ghostMesh = null; }
      clearWinLines3D();

      const spacing = 1.6;
      const cellGeo = new THREE.BoxGeometry(1.1, 1.1, 1.1);
      const edgeGeo = new THREE.EdgesGeometry(cellGeo);

      for (let i = 0; i < 27; i++) {
        const { x, y, z } = idxToCoord(i);
        const px = (x - 1) * spacing;
        const py = (y - 1) * spacing * (1 + explodeAmount);
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
        scene.add(mesh);
        cellMeshes.push(mesh);

        // Wireframe edges
        const edgeMat = new THREE.LineBasicMaterial({
          color: 0x2a3055,
          transparent: true,
          opacity: 0.4
        });
        const edges = new THREE.LineSegments(edgeGeo, edgeMat);
        edges.position.copy(mesh.position);
        edges.userData.cellIndex = i;
        scene.add(edges);

        // Glyph placeholder (invisible initially)
        glyphMeshes.push(null);
      }
    }

    function updateCellPositions() {
      const spacing = 1.6;
      for (let i = 0; i < 27; i++) {
        const { x, y, z } = idxToCoord(i);
        const px = (x - 1) * spacing;
        const py = (y - 1) * spacing * (1 + explodeAmount);
        const pz = (z - 1) * spacing;

        cellMeshes[i].position.set(px, py, pz);

        // Update visibility for layer isolation
        if (isolatedLayer === -1) {
          cellMeshes[i].visible = true;
        } else {
          cellMeshes[i].visible = (y === isolatedLayer);
        }

        // Update glyph positions
        if (glyphMeshes[i]) {
          glyphMeshes[i].position.set(px, py, pz);
          glyphMeshes[i].visible = cellMeshes[i].visible;
        }
      }

      // Update edges too
      scene.children.forEach(child => {
        if (child instanceof THREE.LineSegments && child.userData.cellIndex !== undefined) {
          const ci = child.userData.cellIndex;
          child.position.copy(cellMeshes[ci].position);
          child.visible = cellMeshes[ci].visible;
        }
      });
    }

    function updateCellHighlights() {
      scene.children.forEach(child => {
        if (child instanceof THREE.LineSegments && child.userData.cellIndex !== undefined) {
          const ci = child.userData.cellIndex;
          if (ci === hoveredCell && board[ci] === EMPTY) {
            child.material.color.setHex(getPlayerColorHex(currentPlayer));
            child.material.opacity = 0.9;
          } else if (winLine && winLine.includes(ci)) {
            const winner = board[winLine[0]];
            child.material.color.setHex(getPlayerColorHex(winner));
            child.material.opacity = 1.0;
          } else {
            child.material.color.setHex(0x2a3055);
            child.material.opacity = 0.4;
          }
        }
      });

      // Dim non-winning cells when game is won
      cellMeshes.forEach((mesh, i) => {
        if (winLine && !winLine.includes(i)) {
          mesh.material.opacity = 0.02;
        } else if (winLine && winLine.includes(i)) {
          const winner = board[winLine[0]];
          mesh.material.color.setHex(getPlayerColorHex(winner));
          mesh.material.opacity = 0.15;
        } else {
          mesh.material.color.setHex(0x151a2e);
          mesh.material.opacity = 0.08;
        }
      });
    }

    function createGlyph3D(player, position) {
      let glyph;
      if (player === X) {
        // X: crossed bars
        const barGeo = new THREE.BoxGeometry(0.08, 0.8, 0.08);
        const barMat = new THREE.MeshPhongMaterial({
          color: CYAN,
          emissive: CYAN,
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
        const light = new THREE.PointLight(CYAN, 0.4, 3);
        glyph.add(light);
      } else if (player === O) {
        // O: torus ring
        const torusGeo = new THREE.TorusGeometry(0.32, 0.05, 12, 32);
        const torusMat = new THREE.MeshPhongMaterial({
          color: PINK,
          emissive: PINK,
          emissiveIntensity: 0.8,
          transparent: true,
          opacity: 0.9,
        });
        glyph = new THREE.Mesh(torusGeo, torusMat);
        glyph.rotation.x = Math.PI / 2;

        const light = new THREE.PointLight(PINK, 0.4, 3);
        glyph.add(light);
      } else if (player === TRIANGLE) {
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
          bevelThickness: 0.015
        };
        const triGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        triGeo.center();

        const triMat = new THREE.MeshPhongMaterial({
          color: TRI_COLOR,
          emissive: TRI_COLOR,
          emissiveIntensity: 0.8,
          transparent: true,
          opacity: 0.9,
        });
        glyph = new THREE.Mesh(triGeo, triMat);

        const light = new THREE.PointLight(TRI_COLOR, 0.4, 3);
        glyph.add(light);
      }
      if (glyph) glyph.position.copy(position);
      return glyph;
    }

    function placeGlyph3D(cellIndex) {
      const pos = cellMeshes[cellIndex].position.clone();
      const glyph = createGlyph3D(board[cellIndex], pos);
      glyph.scale.set(0.01, 0.01, 0.01);
      scene.add(glyph);
      glyphMeshes[cellIndex] = glyph;

      // Animate scale in
      const targetScale = 1;
      const animate = () => {
        if (glyph.scale.x < targetScale) {
          glyph.scale.multiplyScalar(1.15);
          if (glyph.scale.x > targetScale) glyph.scale.set(targetScale, targetScale, targetScale);
          requestAnimationFrame(animate);
        }
      };
      animate();
    }

    function updateGhostPreview() {
      if (ghostMesh) {
        scene.remove(ghostMesh);
        ghostMesh = null;
      }
      if (hoveredCell === -1 || board[hoveredCell] !== EMPTY || gameOver) return;

      const pos = cellMeshes[hoveredCell].position.clone();
      ghostMesh = createGlyph3D(currentPlayer, pos);
      ghostMesh.traverse(child => {
        if (child.isMesh) {
          child.material = child.material.clone();
          child.material.opacity = 0.2;
          child.material.emissiveIntensity = 0.3;
        }
        if (child.isLight) child.intensity = 0.1;
      });
      scene.add(ghostMesh);
    }

    function clearWinLines3D() {
      if (winLineMesh) {
        scene.remove(winLineMesh);
        if (winLineMesh.geometry) winLineMesh.geometry.dispose();
        if (winLineMesh.material) winLineMesh.material.dispose();
        winLineMesh = null;
      }
      const toRemove = [];
      scene.children.forEach(child => {
        if (child && child.userData && child.userData.isWinTube) {
          toRemove.push(child);
        }
      });
      toRemove.forEach(child => {
        scene.remove(child);
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    }

    function drawWinLine3D(cells) {
      clearWinLines3D();

      const positions = cells.map(ci => cellMeshes[ci].position);
      const geo = new THREE.BufferGeometry().setFromPoints(positions);
      const winner = board[cells[0]];
      const winColor = getPlayerColorHex(winner);
      const mat = new THREE.LineBasicMaterial({
        color: winColor,
        linewidth: 2,
        transparent: true,
        opacity: 1
      });
      winLineMesh = new THREE.Line(geo, mat);
      scene.add(winLineMesh);

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
      scene.add(tube);
    }

    function onResize() {
      const rect = document.getElementById('viewport').getBoundingClientRect();
      camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix();
      renderer.setSize(rect.width, rect.height);
    }

    function animate() {
      animFrame = requestAnimationFrame(animate);
      controls.update();

      // Rotate glyphs slightly
      glyphMeshes.forEach((g, i) => {
        if (g) {
          if (board[i] === O) g.rotation.z += 0.008;
          if (board[i] === TRIANGLE) g.rotation.y += 0.012;
        }
      });

      // Pulse win tube
      scene.children.forEach(child => {
        if (child.userData && child.userData.isWinTube) {
          const t = Date.now() * 0.003;
          child.material.emissiveIntensity = 1.0 + Math.sin(t) * 0.5;
          child.material.opacity = 0.5 + Math.sin(t) * 0.2;
        }
      });

      if (viewMode === '3d') renderer.render(scene, camera);
    }

    // ═══════════════════════════════════════════════════════════════
    // 2D Flat View
    // ═══════════════════════════════════════════════════════════════

    function buildFlatView() {
      const container = document.getElementById('flat-view');
      container.innerHTML = '';

      const planesContainer = document.createElement('div');
      planesContainer.className = 'flat-planes-container';
      planesContainer.id = 'flatPlanesContainer';

      for (let y = 0; y < 3; y++) {
        const plane = document.createElement('div');
        plane.className = 'flat-plane';
        plane.dataset.layerIndex = y;

        const label = document.createElement('div');
        label.className = 'flat-plane-label';
        label.textContent = `LAYER ${y + 1} ${y === 0 ? '(BOTTOM)' : y === 1 ? '(MID)' : '(TOP)'}`;
        plane.appendChild(label);

        const grid = document.createElement('div');
        grid.className = 'flat-grid';

        for (let z = 0; z < 3; z++) {
          for (let x = 0; x < 3; x++) {
            const ci = idx(x, y, z);
            const cell = document.createElement('div');
            cell.className = 'flat-cell';
            cell.dataset.cellIndex = ci;
            cell.dataset.x = x;
            cell.dataset.y = y;
            cell.dataset.z = z;

            cell.addEventListener('click', () => {
              if (board[ci] === EMPTY && !gameOver && !isCurrentPlayerBot()) {
                makeMove(ci);
              }
            });

            cell.addEventListener('mouseenter', () => {
              if (board[ci] === EMPTY && !gameOver) {
                playSound('hover');
                highlightPillar(x, z, y);
                if (!isCurrentPlayerBot()) {
                  const ghostClass = currentPlayer === X ? 'ghost-x' : (currentPlayer === O ? 'ghost-o' : 'ghost-tri');
                  cell.classList.add(ghostClass);
                  cell.textContent = getPlayerSymbol(currentPlayer);
                }
              }
            });

            cell.addEventListener('mouseleave', () => {
              clearPillarHighlights();
              if (board[ci] === EMPTY) {
                cell.classList.remove('ghost-x', 'ghost-o', 'ghost-tri');
                cell.textContent = '';
              }
            });

            grid.appendChild(cell);
          }
        }

        plane.appendChild(grid);
        planesContainer.appendChild(plane);
      }

      container.appendChild(planesContainer);
    }

    function updateFlatView() {
      const cells = document.querySelectorAll('.flat-cell');
      cells.forEach(cell => {
        const ci = parseInt(cell.dataset.cellIndex);
        cell.className = 'flat-cell';
        cell.textContent = '';

        if (board[ci] === X) {
          cell.classList.add('x-cell');
          cell.textContent = '✕';
        } else if (board[ci] === O) {
          cell.classList.add('o-cell');
          cell.textContent = '◯';
        } else if (board[ci] === TRIANGLE) {
          cell.classList.add('tri-cell');
          cell.textContent = '△';
        }

        // Win highlighting
        if (winLine && winLine.includes(ci)) {
          cell.classList.add('winning-cell');
        } else if (winLine) {
          cell.classList.add('dimmed');
        }
      });
    }

    function highlightPillar(x, z, activeY) {
      const cells = document.querySelectorAll('.flat-cell');
      cells.forEach(cell => {
        const cx = parseInt(cell.dataset.x);
        const cz = parseInt(cell.dataset.z);
        const cy = parseInt(cell.dataset.y);
        if (cx === x && cz === z && cy !== activeY) {
          cell.classList.add('pillar-highlight');
        }
      });
    }

    function clearPillarHighlights() {
      document.querySelectorAll('.flat-cell.pillar-highlight').forEach(c => {
        c.classList.remove('pillar-highlight');
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // Game Logic
    // ═══════════════════════════════════════════════════════════════

    function makeMove(cellIndex) {
      if (board[cellIndex] !== EMPTY || gameOver) return;

      board[cellIndex] = currentPlayer;
      moveHistory.push({ player: currentPlayer, cell: cellIndex });

      playSound(currentPlayer === X ? 'moveX' : (currentPlayer === O ? 'moveO' : 'moveTri'));

      // Update 3D
      placeGlyph3D(cellIndex);
      updateCellHighlights();
      updateGhostPreview();

      // Update 2D
      updateFlatView();

      // Check win
      const result = checkWin(board);
      if (result) {
        gameOver = true;
        winLine = result.line;
        const winner = result.winner;

        // Update score
        if (winner === X) scores.x++;
        else if (winner === O) scores.o++;
        else if (winner === TRIANGLE) scores.tri++;
        updateScoreboard();

        // Win visuals
        drawWinLine3D(result.line);
        updateCellHighlights();
        updateFlatView();
        updateStatusDisplay();
        updateLinesChecklist();
        playSound('win');

        setTimeout(() => {
          showGameOverModal({
            isDraw: false,
            winner: winner,
            winLine: result.line,
            lineIndex: result.lineIndex
          });
        }, 600);
        return;
      }

      if (isBoardFull(board)) {
        gameOver = true;
        scores.draw++;
        updateScoreboard();
        updateStatusDisplay();
        playSound('draw');

        setTimeout(() => {
          showGameOverModal({
            isDraw: true
          });
        }, 600);
        return;
      }

      // Switch player
      if (gameMode === '3p') {
        if (currentPlayer === X) currentPlayer = O;
        else if (currentPlayer === O) currentPlayer = TRIANGLE;
        else currentPlayer = X;
      } else {
        currentPlayer = currentPlayer === X ? O : X;
      }
      updateTurnDisplay();
      updateMoveLog();

      // AI move
      if (isCurrentPlayerBot() && !gameOver) {
        setTimeout(() => {
          const aiMove = getAIMove();
          if (aiMove !== -1) makeMove(aiMove);
        }, 400);
      }
    }

    function resetGame() {
      board = new Array(27).fill(EMPTY);
      currentPlayer = X;
      gameOver = false;
      winLine = null;
      moveHistory = [];
      hoveredCell = -1;
      lastGameResult = null;
      closeGameOverModal();
      const mobBtnResult = document.getElementById('mobBtnResult');
      if (mobBtnResult) mobBtnResult.style.display = 'none';

      clearWinLines3D();

      buildCells();
      updateCellPositions();
      updateFlatView();
      updateTurnDisplay();
      updateStatusDisplay();
      updateMoveLog();
      updateLinesChecklist();

      playSound('draw');

      document.getElementById('historyLog').innerHTML = '';
    }

    // ═══════════════════════════════════════════════════════════════
    // AI Engine
    // ═══════════════════════════════════════════════════════════════

    function getAIMove() {
      const available = [];
      for (let i = 0; i < 27; i++) {
        if (board[i] === EMPTY) available.push(i);
      }
      if (available.length === 0) return -1;

      if (aiDifficulty === 'easy') {
        return available[Math.floor(Math.random() * available.length)];
      }

      if (gameMode === '3p') {
        return threePlayerAI(available, currentPlayer, aiDifficulty);
      }

      if (aiDifficulty === 'medium') {
        return tacticalAI(available);
      }

      return cyberCoreAI(available);
    }

    function threePlayerAI(available, aiPlayer, diff) {
      // 1. Can AI win immediately?
      for (const move of available) {
        board[move] = aiPlayer;
        const win = checkWin(board);
        board[move] = EMPTY;
        if (win) return move;
      }

      // 2. Can any opponent win on their next turn? Block!
      const opponents = [X, O, TRIANGLE].filter(p => p !== aiPlayer);
      for (const opp of opponents) {
        for (const move of available) {
          board[move] = opp;
          const win = checkWin(board);
          board[move] = EMPTY;
          if (win) return move;
        }
      }

      // 3. Medium: take center if free, else random corner/move
      if (diff === 'medium') {
        if (board[13] === EMPTY) return 13;
        const corners = [0, 2, 6, 8, 18, 20, 24, 26].filter(c => board[c] === EMPTY);
        if (corners.length > 0 && Math.random() < 0.75) {
          return corners[Math.floor(Math.random() * corners.length)];
        }
        return available[Math.floor(Math.random() * available.length)];
      }

      // 4. Cyber (Tactical positional scoring):
      let bestScore = -Infinity;
      let bestMove = available[0];
      const corners = new Set([0, 2, 6, 8, 18, 20, 24, 26]);

      for (const move of available) {
        let score = 0;
        if (move === 13) score += 15;
        else if (corners.has(move)) score += 6;

        for (const line of WIN_LINES) {
          if (line.includes(move)) {
            const [a, b, c] = line;
            const vals = [board[a], board[b], board[c]];
            const aiCount = vals.filter(v => v === aiPlayer).length;
            const oppCount = vals.filter(v => v !== EMPTY && v !== aiPlayer).length;

            if (oppCount === 0) {
              if (aiCount === 1) score += 9;
              else if (aiCount === 0) score += 3;
            } else if (aiCount === 0) {
              if (oppCount === 1) score += 4;
            }
          }
        }
        score += Math.random() * 0.6;
        if (score > bestScore) {
          bestScore = score;
          bestMove = move;
        }
      }
      return bestMove;
    }

    function tacticalAI(available) {
      // 1. Win if possible
      for (const move of available) {
        board[move] = O;
        if (checkWin(board)) { board[move] = EMPTY; return move; }
        board[move] = EMPTY;
      }

      // 2. Block opponent win
      for (const move of available) {
        board[move] = X;
        if (checkWin(board)) { board[move] = EMPTY; return move; }
        board[move] = EMPTY;
      }

      // 3. Center
      if (board[13] === EMPTY) return 13;

      // 4. Random
      return available[Math.floor(Math.random() * available.length)];
    }

    function scoreCandidateMove(b, m, player) {
      let score = 0;
      if (m === 13) score += 50;
      else if (CORNERS.indexOf(m) !== -1) score += 20;

      const lines = CELL_WIN_LINES[m];
      const opp = player === O ? X : O;
      for (let i = 0; i < lines.length; i++) {
        const line = WIN_LINES[lines[i]];
        const c1 = b[line[0]], c2 = b[line[1]], c3 = b[line[2]];
        const pCount = (c1 === player ? 1 : 0) + (c2 === player ? 1 : 0) + (c3 === player ? 1 : 0);
        const oppCount = (c1 === opp ? 1 : 0) + (c2 === opp ? 1 : 0) + (c3 === opp ? 1 : 0);
        if (oppCount === 0) {
          score += pCount === 2 ? 15 : 5;
        } else if (pCount === 0 && oppCount === 2) {
          score += 40; // Critical block line
        }
      }
      return score;
    }

    function cyberCoreAI(available) {
      // 1. Immediate Win (1-ply instant strike)
      for (let i = 0; i < available.length; i++) {
        const m = available[i];
        board[m] = O;
        if (fastCheckWin(board) === O) {
          board[m] = EMPTY;
          return m;
        }
        board[m] = EMPTY;
      }

      // 2. Immediate Block (1-ply critical counter)
      for (let i = 0; i < available.length; i++) {
        const m = available[i];
        board[m] = X;
        if (fastCheckWin(board) === X) {
          board[m] = EMPTY;
          return m;
        }
        board[m] = EMPTY;
      }

      // 3. Opening book for first response: instant optimal anchor (0ms)
      if (available.length >= 26) {
        if (board[13] === EMPTY) return 13;
        for (let i = 0; i < CORNERS.length; i++) {
          if (board[CORNERS[i]] === EMPTY) return CORNERS[i];
        }
      }

      // 4. Score and order candidate moves for high alpha-beta pruning efficiency
      const scoredMoves = [];
      for (let i = 0; i < available.length; i++) {
        const m = available[i];
        scoredMoves.push({ move: m, score: scoreCandidateMove(board, m, O) });
      }
      scoredMoves.sort((a, b) => b.score - a.score);

      // Search top candidate moves (up to 12) to avoid evaluating non-strategic cells
      const candidateCount = Math.min(12, scoredMoves.length);
      const candidates = [];
      for (let i = 0; i < candidateCount; i++) {
        candidates.push(scoredMoves[i].move);
      }

      // Adaptive depth: fast opening/midgame, deeper endgame
      const maxDepth = available.length >= 18 ? 2 : (available.length >= 10 ? 3 : 4);

      let bestScore = -Infinity;
      let bestMove = candidates[0];

      for (let i = 0; i < candidates.length; i++) {
        const move = candidates[i];
        board[move] = O;
        const score = minimax(board, 0, false, -Infinity, Infinity, maxDepth);
        board[move] = EMPTY;
        if (score > bestScore) {
          bestScore = score;
          bestMove = move;
        }
      }
      return bestMove;
    }

    function minimax(b, depth, isMaximizing, alpha, beta, maxDepth) {
      const winner = fastCheckWin(b);
      if (winner !== 0) {
        return winner === O ? (1000 - depth) : (-1000 + depth);
      }
      if (depth >= maxDepth || isBoardFull(b)) {
        return evaluateBoard(b);
      }

      if (isMaximizing) {
        let maxEval = -Infinity;
        for (let i = 0; i < 27; i++) {
          if (b[i] !== EMPTY) continue;
          b[i] = O;
          const ev = minimax(b, depth + 1, false, alpha, beta, maxDepth);
          b[i] = EMPTY;
          if (ev > maxEval) maxEval = ev;
          if (ev > alpha) alpha = ev;
          if (beta <= alpha) break;
        }
        return maxEval;
      } else {
        let minEval = Infinity;
        for (let i = 0; i < 27; i++) {
          if (b[i] !== EMPTY) continue;
          b[i] = X;
          const ev = minimax(b, depth + 1, true, alpha, beta, maxDepth);
          b[i] = EMPTY;
          if (ev < minEval) minEval = ev;
          if (ev < beta) beta = ev;
          if (beta <= alpha) break;
        }
        return minEval;
      }
    }

    function evaluateBoard(b) {
      let score = 0;
      for (let i = 0; i < WIN_LINES.length; i++) {
        const line = WIN_LINES[i];
        const c1 = b[line[0]], c2 = b[line[1]], c3 = b[line[2]];
        const oCount = (c1 === O ? 1 : 0) + (c2 === O ? 1 : 0) + (c3 === O ? 1 : 0);
        const xCount = (c1 === X ? 1 : 0) + (c2 === X ? 1 : 0) + (c3 === X ? 1 : 0);

        if (oCount > 0 && xCount === 0) {
          score += oCount === 2 ? 25 : 3;
        } else if (xCount > 0 && oCount === 0) {
          score -= xCount === 2 ? 30 : 3;
        }
      }
      // Center bonus
      if (b[13] === O) score += 10;
      else if (b[13] === X) score -= 10;
      return score;
    }

    // ═══════════════════════════════════════════════════════════════
    // Audio — Web Audio API Synthesis
    // ═══════════════════════════════════════════════════════════════

    let audioCtx;

    function getAudioCtx() {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      return audioCtx;
    }

    function playSound(type) {
      if (!audioEnabled) return;
      try {
        const ctx = getAudioCtx();
        const now = ctx.currentTime;

        if (type === 'hover') {
          // Short high pip
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.setValueAtTime(2000, now);
          osc.type = 'sine';
          gain.gain.setValueAtTime(0.06, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
          osc.start(now);
          osc.stop(now + 0.08);
        }

        if (type === 'moveX') {
          // Higher chime — two quick notes
          [1200, 1600].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.setValueAtTime(freq, now + i * 0.06);
            osc.type = 'triangle';
            gain.gain.setValueAtTime(0.12, now + i * 0.06);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.15);
            osc.start(now + i * 0.06);
            osc.stop(now + i * 0.06 + 0.15);
          });
        }

        if (type === 'moveO') {
          // Resonant saw wave
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.setValueAtTime(350, now);
          osc.frequency.exponentialRampToValueAtTime(280, now + 0.15);
          osc.type = 'sawtooth';
          gain.gain.setValueAtTime(0.08, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
          osc.start(now);
          osc.stop(now + 0.2);
        }

        if (type === 'moveTri') {
          // Resonant crystal pulse - two quick harmonics
          [880, 1320].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.setValueAtTime(freq, now + i * 0.05);
            osc.type = 'triangle';
            gain.gain.setValueAtTime(0.12, now + i * 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.18);
            osc.start(now + i * 0.05);
            osc.stop(now + i * 0.05 + 0.18);
          });
        }

        if (type === 'win') {
          // Ascending arpeggio
          const notes = [523, 659, 784, 1047, 1319];
          notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const dist = ctx.createWaveShaper();

            // Distortion curve
            const curve = new Float32Array(256);
            for (let j = 0; j < 256; j++) {
              const x = (j * 2) / 256 - 1;
              curve[j] = (Math.PI + 4) * x / (Math.PI + 4 * Math.abs(x));
            }
            dist.curve = curve;

            osc.connect(dist);
            dist.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.setValueAtTime(freq, now + i * 0.1);
            osc.type = i % 2 === 0 ? 'square' : 'triangle';
            gain.gain.setValueAtTime(0.1, now + i * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.4);
            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 0.4);
          });
        }

        if (type === 'draw') {
          // Low bass slide down
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.setValueAtTime(200, now);
          osc.frequency.exponentialRampToValueAtTime(60, now + 0.5);
          osc.type = 'sawtooth';
          gain.gain.setValueAtTime(0.1, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
          osc.start(now);
          osc.stop(now + 0.5);
        }
      } catch (e) {
        // Audio context may not be available
      }
    }

    function toggleAudio() {
      audioEnabled = !audioEnabled;
      document.getElementById('btnAudio').textContent = audioEnabled ? '🔊' : '🔇';
    }

    function toggleSidebar() {
      const sidebar = document.getElementById('sidebar');
      const overlay = document.getElementById('sidebarOverlay');
      const btn = document.getElementById('hamburgerBtn');
      const isOpen = sidebar.classList.contains('open');

      if (isOpen) {
        sidebar.classList.remove('open');
        btn.classList.remove('open');
        overlay.classList.remove('visible');
        setTimeout(() => overlay.classList.remove('open'), 300);
      } else {
        overlay.classList.add('open');
        requestAnimationFrame(() => {
          overlay.classList.add('visible');
          sidebar.classList.add('open');
          btn.classList.add('open');
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // UI Updates
    // ═══════════════════════════════════════════════════════════════

    function updateTurnDisplay() {
      const el = document.getElementById('turnIndicator');
      const text = document.getElementById('turnText');
      el.className = 'turn-indicator ' + (currentPlayer === X ? 'x-turn' : (currentPlayer === O ? 'o-turn' : 'tri-turn'));
      let label = 'PLAYER X';
      if (currentPlayer === O) {
        label = (gameMode === 'ai' ? 'AI [O]' : (gameMode === '3p' && botMode3P === '2' ? 'BOT [O]' : 'PLAYER O'));
      } else if (currentPlayer === TRIANGLE) {
        label = (gameMode === '3p' && (botMode3P === '1' || botMode3P === '2') ? 'BOT [△]' : 'PLAYER △');
      }
      text.textContent = label;
    }

    function updateStatusDisplay() {
      const badge = document.getElementById('statusBadge');
      if (gameOver) {
        if (winLine) {
          const winner = board[winLine[0]];
          let winClass = 'win-x';
          let winText = '✕ WINS';
          if (winner === O) {
            winClass = 'win-o';
            winText = '◯ WINS';
          } else if (winner === TRIANGLE) {
            winClass = 'win-tri';
            winText = '△ WINS';
          }
          badge.className = 'status-badge ' + winClass;
          badge.textContent = winText;
        } else {
          badge.className = 'status-badge draw';
          badge.textContent = 'DRAW';
        }
        badge.title = 'Click to view match summary';
      } else {
        badge.className = 'status-badge active';
        badge.textContent = 'ACTIVE';
        badge.title = '';
      }
    }

    function updateScoreboard() {
      document.getElementById('scoreX').textContent = scores.x;
      document.getElementById('scoreO').textContent = scores.o;
      const scoreTriEl = document.getElementById('scoreTri');
      if (scoreTriEl) scoreTriEl.textContent = scores.tri;
      document.getElementById('scoreDraw').textContent = scores.draw;

      // Mobile Quick Ribbon
      const mobX = document.getElementById('mobScoreX');
      const mobO = document.getElementById('mobScoreO');
      const mobTri = document.getElementById('mobScoreTri');
      const mobDraw = document.getElementById('mobScoreDraw');
      if (mobX) mobX.textContent = scores.x;
      if (mobO) mobO.textContent = scores.o;
      if (mobTri) mobTri.textContent = scores.tri;
      if (mobDraw) mobDraw.textContent = scores.draw;
    }

    function updateMoveLog() {
      const moveStr = `${moveHistory.length} / 27`;
      document.getElementById('moveCount').textContent = moveStr;
      const modalMoveCount = document.getElementById('modalMoveCount');
      if (modalMoveCount) modalMoveCount.textContent = `${moveHistory.length}/27`;

      const log = document.getElementById('historyLog');
      const modalLog = document.getElementById('modalHistoryLog');
      if (log) log.innerHTML = '';
      if (modalLog) modalLog.innerHTML = '';

      moveHistory.forEach((m, i) => {
        const pClass = m.player === X ? 'x-move' : (m.player === O ? 'o-move' : 'tri-move');
        const html = `
          <span class="move-num">#${i + 1}</span>
          <span class="move-player">${getPlayerSymbol(m.player)}</span>
          <span class="move-pos">${coordLabel(m.cell)}</span>
        `;
        if (log) {
          const entry = document.createElement('div');
          entry.className = `history-entry ${pClass}`;
          entry.innerHTML = html;
          log.prepend(entry);
        }
        if (modalLog) {
          const mEntry = document.createElement('div');
          mEntry.className = `history-entry ${pClass}`;
          mEntry.innerHTML = html;
          modalLog.prepend(mEntry);
        }
      });
    }

    function updateLinesChecklist() {
      const container = document.getElementById('linesChecklist');
      const modalContainer = document.getElementById('modalLinesChecklist');
      if (container) container.innerHTML = '';
      if (modalContainer) modalContainer.innerHTML = '';

      WIN_LINES.forEach((line, i) => {
        const [a, b, c] = line;
        const item = document.createElement('div');
        const label = WIN_LINE_LABELS[i];
        const isWon = board[a] !== EMPTY && board[a] === board[b] && board[b] === board[c];
        const wonClass = isWon ? (board[a] === X ? 'x-won' : (board[a] === O ? 'o-won' : 'tri-won')) : '';
        const text = isWon ? `✓ ${label}` : label;

        if (container) {
          const cItem = document.createElement('div');
          cItem.className = 'line-item' + (wonClass ? ' ' + wonClass : '');
          cItem.textContent = text;
          container.appendChild(cItem);
        }
        if (modalContainer) {
          const mItem = document.createElement('div');
          mItem.className = 'line-item' + (wonClass ? ' ' + wonClass : '');
          mItem.textContent = text;
          modalContainer.appendChild(mItem);
        }
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // Controls
    // ═══════════════════════════════════════════════════════════════

    function setViewMode(mode) {
      viewMode = mode;
      document.getElementById('btnView3D').classList.toggle('active', mode === '3d');
      document.getElementById('btnView2D').classList.toggle('active', mode === '2d');
      document.getElementById('flat-view').classList.toggle('active', mode === '2d');
      document.getElementById('three-canvas').style.display = mode === '3d' ? 'block' : 'none';
      document.getElementById('viewModeBadge').textContent = mode === '3d' ? '3D SPATIAL' : '2D PLANES';
      document.getElementById('panel3DControls').style.display = mode === '3d' ? 'block' : 'none';

      // Mobile controls
      const mobBtnIcon = document.getElementById('mobBtnViewIcon');
      if (mobBtnIcon) mobBtnIcon.textContent = mode === '3d' ? '▦ 2D' : '◈ 3D';

      const mob3dDock = document.getElementById('mobile3DDock');
      if (mob3dDock) {
        if (mode === '3d') {
          mob3dDock.classList.add('visible');
        } else {
          mob3dDock.classList.remove('visible');
        }
      }

      if (mode === '2d') updateFlatView();
      if (mode === '3d') onResize();
    }

    function toggleViewModeMobile() {
      setViewMode(viewMode === '3d' ? '2d' : '3d');
    }

    function setPrimaryMode(mode) {
      primaryMode = mode;
      const b2p = document.getElementById('btnMode2P');
      const b3p = document.getElementById('btnMode3P');
      if (b2p) b2p.classList.toggle('active', mode === '2p');
      if (b3p) b3p.classList.toggle('active', mode === '3p');

      const is2P = (mode === '2p');
      const is3P = (mode === '3p');

      const sub2P = document.getElementById('submenu2P');
      const sub3P = document.getElementById('submenu3P');
      if (sub2P) sub2P.style.display = is2P ? 'block' : 'none';
      if (sub3P) sub3P.style.display = is3P ? 'block' : 'none';

      const cardTri = document.getElementById('scoreCardTri');
      if (cardTri) cardTri.style.display = is3P ? 'flex' : 'none';

      const mobTriWrap = document.getElementById('mobScoreTriWrap');
      if (mobTriWrap) mobTriWrap.style.display = is3P ? 'inline-flex' : 'none';

      if (is2P) {
        gameMode = (mode2P === 'ai') ? 'ai' : 'pvp';
      } else {
        gameMode = '3p';
      }

      updateAISettingsVisibility();
      resetGame();
    }

    function set2PMode(type) {
      mode2P = type; // 'human' or 'ai'
      gameMode = (type === 'ai') ? 'ai' : 'pvp';
      const bHuman = document.getElementById('btn2pHuman');
      const bAI = document.getElementById('btn2pAI');
      if (bHuman) bHuman.classList.toggle('active', type === 'human');
      if (bAI) bAI.classList.toggle('active', type === 'ai');
      updateAISettingsVisibility();
      resetGame();
    }

    function set3PMode(val) {
      botMode3P = val; // '0': 3 Humans, '1': 2 Humans & 1Bot, '2': 1 Human and 2 Bots
      gameMode = '3p';
      const b0 = document.getElementById('btn3pHumans');
      const b1 = document.getElementById('btn3p1Bot');
      const b2 = document.getElementById('btn3p2Bots');
      if (b0) b0.classList.toggle('active', val === '0');
      if (b1) b1.classList.toggle('active', val === '1');
      if (b2) b2.classList.toggle('active', val === '2');
      updateAISettingsVisibility();
      resetGame();
    }

    function updateAISettingsVisibility() {
      const showAI = (primaryMode === '2p' && mode2P === 'ai') || (primaryMode === '3p' && botMode3P !== '0');
      const aiPanel = document.getElementById('aiSettings');
      if (aiPanel) aiPanel.style.display = showAI ? 'block' : 'none';
    }

    function setDifficulty(diff) {
      aiDifficulty = diff;
      const bEasy = document.getElementById('btnEasy');
      const bMed = document.getElementById('btnMed');
      const bHard = document.getElementById('btnHard');
      if (bEasy) bEasy.classList.toggle('active', diff === 'easy');
      if (bMed) bMed.classList.toggle('active', diff === 'medium');
      if (bHard) bHard.classList.toggle('active', diff === 'hard');
      resetGame();
    }

    // Backward compatibility aliases
    function setGameMode(mode) {
      if (mode === '3p') {
        setPrimaryMode('3p');
      } else if (mode === 'pvp') {
        setPrimaryMode('2p');
        set2PMode('human');
      } else if (mode === 'ai') {
        setPrimaryMode('2p');
        set2PMode('ai');
      }
    }

    function set3PBotMode(val) {
      set3PMode(val);
    }

    function setExplode(val) {
      explodeAmount = val / 100;
      updateCellPositions();
    }

    function setCameraPreset(preset) {
      const dur = 600;
      let target;
      switch (preset) {
        case 'front': target = { x: 0, y: 0, z: 12 }; break;
        case 'top': target = { x: 0.1, y: 12, z: 0.1 }; break;
        case 'iso': target = { x: 6, y: 5, z: 8 }; break;
      }
      // Simple tween
      const start = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
      const startTime = Date.now();
      function tweenCam() {
        const elapsed = Date.now() - startTime;
        const t = Math.min(elapsed / dur, 1);
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        camera.position.x = start.x + (target.x - start.x) * ease;
        camera.position.y = start.y + (target.y - start.y) * ease;
        camera.position.z = start.z + (target.z - start.z) * ease;
        if (t < 1) requestAnimationFrame(tweenCam);
      }
      tweenCam();
    }

    function isolateLayer(layer) {
      isolatedLayer = layer;
      document.getElementById('btnL0').classList.toggle('active', layer === 0);
      document.getElementById('btnL1').classList.toggle('active', layer === 1);
      document.getElementById('btnL2').classList.toggle('active', layer === 2);
      document.getElementById('btnLAll').classList.toggle('active', layer === -1);

      // Mobile 3D dock layer buttons
      const mb0 = document.getElementById('mobL0');
      const mb1 = document.getElementById('mobL1');
      const mb2 = document.getElementById('mobL2');
      const mbAll = document.getElementById('mobLAll');
      if (mb0) mb0.classList.toggle('active', layer === 0);
      if (mb1) mb1.classList.toggle('active', layer === 1);
      if (mb2) mb2.classList.toggle('active', layer === 2);
      if (mbAll) mbAll.classList.toggle('active', layer === -1);

      updateCellPositions();
    }

    // ═══════════════════════════════════════════════════════════════
    // Mobile Telemetry Modal & Handlers
    // ═══════════════════════════════════════════════════════════════

    function openStatsModal() {
      const modal = document.getElementById('statsModal');
      if (modal) {
        modal.classList.add('open');
        updateMoveLog();
        updateLinesChecklist();
      }
    }

    function closeStatsModal() {
      const modal = document.getElementById('statsModal');
      if (modal) modal.classList.remove('open');
    }

    function onStatsModalClick(e) {
      if (e.target.id === 'statsModal') {
        closeStatsModal();
      }
    }

    function switchModalTab(tab) {
      const isMoves = tab === 'moves';
      const tabM = document.getElementById('modalTabMoves');
      const tabL = document.getElementById('modalTabLines');
      const viewM = document.getElementById('modalMoveLogView');
      const viewL = document.getElementById('modalLinesView');
      if (tabM) tabM.classList.toggle('active', isMoves);
      if (tabL) tabL.classList.toggle('active', !isMoves);
      if (viewM) viewM.classList.toggle('active', isMoves);
      if (viewL) viewL.classList.toggle('active', !isMoves);
    }

    // ═══════════════════════════════════════════════════════════════
    // Game Over / Match Result Modal Handlers
    // ═══════════════════════════════════════════════════════════════

    let lastGameResult = null;

    function getDifficultyDisplay(diff) {
      if (diff === 'easy') return 'Easy';
      if (diff === 'medium') return 'Medium';
      if (diff === 'hard') return 'Hard';
      return 'Medium';
    }

    function getGameModeDisplayString() {
      const diffStr = getDifficultyDisplay(aiDifficulty);
      if (primaryMode === '2p' || gameMode === 'ai' || gameMode === 'pvp') {
        if (mode2P === 'ai' || gameMode === 'ai') {
          return `2P vs AI (${diffStr})`;
        } else {
          return `2P vs Human`;
        }
      } else {
        // 3P mode
        if (botMode3P === '0') {
          return `3P: 3 Humans`;
        } else if (botMode3P === '1') {
          return `3P: 2 Humans & 1Bot (${diffStr})`;
        } else if (botMode3P === '2') {
          return `3P: 1 Human and 2 Bots (${diffStr})`;
        }
        return `3P Mode`;
      }
    }

    function showGameOverModal(info) {
      lastGameResult = info;
      const modal = document.getElementById('gameOverModal');
      const dialog = document.getElementById('gameOverDialog');
      const avatar = document.getElementById('gameOverAvatar');
      const title = document.getElementById('gameOverTitle');
      const subtitle = document.getElementById('gameOverSubtitle');
      const modeVal = document.getElementById('gameOverMode');
      const lineCard = document.getElementById('cardWinLine');
      const lineVal = document.getElementById('gameOverLine');
      const movesVal = document.getElementById('gameOverMoves');
      const scoreVal = document.getElementById('gameOverScoreTally');
      const tag = document.getElementById('gameOverTag');

      if (!modal || !dialog) return;

      dialog.className = 'game-over-dialog';

      if (info.isDraw) {
        dialog.classList.add('winner-draw');
        if (avatar) avatar.textContent = '⚖';
        if (title) title.textContent = 'MATCH DRAW';
        if (subtitle) subtitle.textContent = 'Grid saturated. No alignment achieved.';
        if (tag) tag.textContent = 'STALEMATE';
        if (lineCard) lineCard.style.display = 'none';
      } else {
        const winner = info.winner;
        let winnerName = 'PLAYER X';
        let winClass = 'winner-x';
        let winSymbol = '✕';

        if (winner === X) {
          winnerName = 'PLAYER X';
          winClass = 'winner-x';
          winSymbol = '✕';
        } else if (winner === O) {
          winnerName = (gameMode === 'ai' ? 'AI [O]' : (gameMode === '3p' && botMode3P === '2' ? 'BOT [O]' : 'PLAYER O'));
          winClass = 'winner-o';
          winSymbol = '◯';
        } else if (winner === TRIANGLE) {
          winnerName = (gameMode === '3p' && (botMode3P === '1' || botMode3P === '2') ? 'BOT [△]' : 'PLAYER △');
          winClass = 'winner-tri';
          winSymbol = '△';
        }

        dialog.classList.add(winClass);
        if (avatar) avatar.textContent = winSymbol;
        if (title) title.textContent = `${winnerName} WINS!`;
        if (subtitle) {
          if ((primaryMode === '2p' || gameMode === 'ai') && (mode2P === 'ai' || gameMode === 'ai') && winner === O) {
            subtitle.textContent = `AI (${getDifficultyDisplay(aiDifficulty)}) triumphs over player`;
          } else if ((primaryMode === '2p' || gameMode === 'ai') && (mode2P === 'ai' || gameMode === 'ai') && winner === X) {
            subtitle.textContent = `Human player overcomes AI (${getDifficultyDisplay(aiDifficulty)})!`;
          } else if ((primaryMode === '3p' || gameMode === '3p') && (botMode3P === '1' || botMode3P === '2') && (winner === O || winner === TRIANGLE)) {
            subtitle.textContent = `AI Bot (${getDifficultyDisplay(aiDifficulty)}) claims the 3D grid!`;
          } else {
            subtitle.textContent = 'Three-dimensional alignment confirmed';
          }
        }
        if (tag) tag.textContent = 'VICTORY';

        if (lineCard) {
          lineCard.style.display = 'flex';
          const lineLabel = (info.lineIndex !== undefined && WIN_LINE_LABELS[info.lineIndex])
            ? WIN_LINE_LABELS[info.lineIndex]
            : 'Linear Trio';
          if (lineVal) lineVal.textContent = lineLabel;
        }
      }

      if (modeVal) modeVal.textContent = getGameModeDisplayString();
      if (movesVal) movesVal.textContent = `${moveHistory.length} / 27 MOVES`;
      if (scoreVal) {
        if (gameMode === '3p') {
          scoreVal.textContent = `X: ${scores.x} · O: ${scores.o} · △: ${scores.tri} · D: ${scores.draw}`;
        } else {
          scoreVal.textContent = `X: ${scores.x} · O: ${scores.o} · D: ${scores.draw}`;
        }
      }

      modal.classList.add('open');

      const mobBtnResult = document.getElementById('mobBtnResult');
      if (mobBtnResult) mobBtnResult.style.display = 'inline-flex';
    }

    function closeGameOverModal() {
      const modal = document.getElementById('gameOverModal');
      if (modal) modal.classList.remove('open');
    }

    function reopenGameOverModal() {
      if (lastGameResult) {
        showGameOverModal(lastGameResult);
      }
    }

    function resetGameFromModal() {
      closeGameOverModal();
      resetGame();
    }

    function onGameOverModalClick(e) {
      if (e.target.id === 'gameOverModal') {
        closeGameOverModal();
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // Detailed Guide Modal Handlers
    // ═══════════════════════════════════════════════════════════════

    function openGuideModal() {
      const modal = document.getElementById('guideModal');
      if (modal) modal.classList.add('open');
    }

    function closeGuideModal() {
      const modal = document.getElementById('guideModal');
      if (modal) modal.classList.remove('open');
    }

    function onGuideModalClick(e) {
      if (e.target.id === 'guideModal') {
        closeGuideModal();
      }
    }

    function switchGuideTab(tabId) {
      const tabs = ['overview', 'lines', 'modes', 'controls', 'tactics'];
      tabs.forEach(t => {
        const btn = document.getElementById('tabGuide' + t.charAt(0).toUpperCase() + t.slice(1));
        const content = document.getElementById('guideTabContent-' + t);
        const isActive = (t === tabId);
        if (btn) {
          btn.classList.toggle('active', isActive);
          if (isActive && typeof btn.scrollIntoView === 'function') {
            btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          }
        }
        if (content) content.classList.toggle('active', isActive);
      });
      const body = document.getElementById('guideModalBody');
      if (body) body.scrollTop = 0;
    }

    // ═══════════════════════════════════════════════════════════════
    // Ambient Particles
    // ═══════════════════════════════════════════════════════════════

    function createParticles() {
      const container = document.getElementById('particles');
      const count = 30;
      for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.left = Math.random() * 100 + '%';
        p.style.animationDuration = (8 + Math.random() * 15) + 's';
        p.style.animationDelay = (Math.random() * 10) + 's';
        p.style.width = (1 + Math.random() * 2) + 'px';
        const rand = Math.random();
        if (rand < 0.33) p.style.background = '#00f0ff';
        else if (rand < 0.66) p.style.background = '#ff0055';
        else p.style.background = '#00ff88';
        container.appendChild(p);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // Initialization
    // ═══════════════════════════════════════════════════════════════

    function init() {
      createParticles();
      init3D();
      buildFlatView();
      updateFlatView();
      updateTurnDisplay();
      updateStatusDisplay();
      updateScoreboard();
      updateMoveLog();
      updateLinesChecklist();
      setExplode(document.getElementById('explodeSlider').value);
      setViewMode('2d');

      // Ensure default mode is 2P vs AI (Medium)
      setPrimaryMode('2p');
      set2PMode('ai');
      setDifficulty('medium');

      const badge = document.getElementById('statusBadge');
      if (badge) {
        badge.addEventListener('click', () => {
          if (gameOver && lastGameResult) {
            showGameOverModal(lastGameResult);
          }
        });
      }

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          closeGameOverModal();
          closeStatsModal();
          closeGuideModal();
        }
      });
    }

    window.addEventListener('DOMContentLoaded', init);