(() => {
  'use strict';

  const TARGET_URL = './targets/poster.mind';
  const CONFIG_URL = './config.json';
  const IMAGE_FOLDER = 'assets/images/';
  const sceneEl = document.querySelector('#ar-scene');
  const targetEl = document.querySelector('#poster-target');
  const tapTargetEl = document.querySelector('#tap-target');
  const artNode = document.querySelector('#art-node');
  const textNode = document.querySelector('#text-node');
  const hintEl = document.querySelector('#camera-hint');
  const noticeEl = document.querySelector('#setup-notice');

  let config = null;
  let currentSceneIndex = 0;
  let targetIsVisible = false;
  let sceneRevision = 0;
  const animationFrames = new WeakMap();
  const transitionFrames = new WeakMap();
  const activeExitClones = new Map();
  const restartButton = document.querySelector('#restart-button');

  function setHint(message) {
    if (hintEl && typeof message === 'string') hintEl.textContent = message;
  }

  function showNotice(message) {
    noticeEl.textContent = message;
    noticeEl.hidden = false;
  }

  function hideNotice() {
    noticeEl.hidden = true;
    noticeEl.textContent = '';
  }

  function safeNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function normalizeConfig(raw) {
    if (!raw || !Array.isArray(raw.scenes) || raw.scenes.length !== 5) {
      throw new Error('config.json debe contener exactamente cinco escenas.');
    }
    raw.project = raw.project || {};
    raw.project.fonts = Array.isArray(raw.project.fonts) ? raw.project.fonts : [];
    raw.target = raw.target || {};
    raw.target.width = Math.max(0.1, safeNumber(raw.target.width, 1));
    raw.target.height = Math.max(0.1, safeNumber(raw.target.height, 1.414));
    raw.target.index = Math.max(0, Math.floor(safeNumber(raw.target.index, 0)));
    raw.interface = raw.interface || {};
    raw.interface.continuePrompt = raw.interface.continuePrompt || 'Pulse la imagen para continuar';
    raw.interface.finalPrompt = raw.interface.finalPrompt || 'Fin de la experiencia';
    raw.interface.notFoundPrompt = raw.interface.notFoundPrompt || 'Apuntá la cámara al afiche';
    raw.interface.loadingPrompt = raw.interface.loadingPrompt || 'Preparando la experiencia…';

    raw.scenes.forEach((scene, index) => {
      scene.id = index + 1;
      scene.label = scene.label || `Escena ${index + 1}`;
      scene.image = scene.image || {};
      scene.text = scene.text || {};
      const image = scene.image;
      image.src = typeof image.src === 'string' ? image.src.trim() : '';
      image.x = safeNumber(image.x, 0);
      image.y = safeNumber(image.y, 0);
      image.z = safeNumber(image.z, 0.18);
      image.width = Math.max(0.01, safeNumber(image.width, 0.82));
      image.height = image.height === null || image.height === '' || image.height === undefined
        ? null : Math.max(0.01, safeNumber(image.height, 0.5));
      image.opacity = clamp(safeNumber(image.opacity, 1), 0, 1);
      image.animation = validAnimation(image.animation);
      image.durationMs = clamp(safeNumber(image.durationMs, 700), 0, 10000);

      const text = scene.text;
      text.content = typeof text.content === 'string' ? text.content : '';
      text.x = safeNumber(text.x, 0);
      text.y = safeNumber(text.y, -0.43);
      text.z = safeNumber(text.z, 0.22);
      text.width = Math.max(0.05, safeNumber(text.width, 0.88));
      text.height = Math.max(0.05, safeNumber(text.height, 0.32));
      text.fontFamily = typeof text.fontFamily === 'string' && text.fontFamily.trim() ? text.fontFamily : 'Arial';
      text.fontSize = clamp(safeNumber(text.fontSize, 58), 8, 240);
      text.fontWeight = typeof text.fontWeight === 'string' ? text.fontWeight : 'normal';
      text.color = typeof text.color === 'string' ? text.color : '#FFFFFF';
      text.align = ['left', 'center', 'right'].includes(text.align) ? text.align : 'center';
      text.verticalAlign = ['top', 'middle', 'bottom'].includes(text.verticalAlign) ? text.verticalAlign : 'middle';
      text.lineHeight = clamp(safeNumber(text.lineHeight, 1.2), 0.8, 2.5);
      text.opacity = clamp(safeNumber(text.opacity, 1), 0, 1);
      text.animation = validAnimation(text.animation);
      text.durationMs = clamp(safeNumber(text.durationMs, 700), 0, 10000);
    });
    return raw;
  }

  function validAnimation(value) {
    return ['none', 'fade', 'pop', 'slide-up', 'float'].includes(value) ? value : 'none';
  }

  function setNodePosition(node, x, y, z) {
    node.setAttribute('position', `${x} ${y} ${z}`);
  }

  function disposeNodeMesh(node) {
    stopAnimation(node);
    stopTransition(node);
    const mesh = node.getObject3D('mesh');
    if (mesh) {
      node.removeObject3D('mesh');
      mesh.traverse((part) => {
        if (part.geometry && typeof part.geometry.dispose === 'function') part.geometry.dispose();
        if (part.material) {
          const materials = Array.isArray(part.material) ? part.material : [part.material];
          materials.forEach((material) => {
            if (material.map && typeof material.map.dispose === 'function') material.map.dispose();
            if (typeof material.dispose === 'function') material.dispose();
          });
        }
      });
    }
    node.setAttribute('visible', false);
  }

  // La opacidad se aplica como un multiplicador para conservar la transparencia
  // propia de cada material (por ejemplo, el fondo negro semitransparente del texto).
  function setMaterialsOpacity(node, factor) {
    node.object3D.traverse((part) => {
      if (!part.material) return;
      const materials = Array.isArray(part.material) ? part.material : [part.material];
      materials.forEach((material) => {
        if (material.userData.webarBaseOpacity === undefined) {
          material.userData.webarBaseOpacity = material.opacity;
        }
        material.transparent = true;
        material.opacity = clamp(material.userData.webarBaseOpacity * factor, 0, 1);
        material.needsUpdate = true;
      });
    });
  }

  function stopAnimation(node) {
    const oldFrame = animationFrames.get(node);
    if (oldFrame) cancelAnimationFrame(oldFrame);
    animationFrames.delete(node);
  }

  function stopTransition(node) {
    const oldFrame = transitionFrames.get(node);
    if (oldFrame) cancelAnimationFrame(oldFrame);
    transitionFrames.delete(node);
  }

  function animateNode(node, mode, duration, basePosition) {
    stopAnimation(node);
    const object = node.object3D;
    const pos = { x: basePosition.x, y: basePosition.y, z: basePosition.z };
    const time = Math.max(0, safeNumber(duration, 700));
    object.position.set(pos.x, pos.y, pos.z);
    object.scale.set(1, 1, 1);
    setMaterialsOpacity(node, 1);

    if (mode === 'none' || time === 0) return;

    if (mode === 'fade') setMaterialsOpacity(node, 0);
    if (mode === 'pop') object.scale.set(0.05, 0.05, 0.05);
    if (mode === 'slide-up') object.position.y = pos.y - 0.16;

    const startedAt = performance.now();
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);
    const step = (now) => {
      if (!node.isConnected) {
        animationFrames.delete(node);
        return;
      }
      const progress = clamp((now - startedAt) / time, 0, 1);
      const eased = easeOut(progress);
      if (mode === 'fade') setMaterialsOpacity(node, eased);
      if (mode === 'pop') {
        const back = 1 + 1.35 * Math.pow(progress - 1, 3) + 0.35 * Math.pow(progress - 1, 2);
        const scale = progress === 1 ? 1 : Math.max(0.02, back);
        object.scale.set(scale, scale, scale);
      }
      if (mode === 'slide-up') object.position.y = pos.y - 0.16 * (1 - eased);
      if (mode === 'float') {
        const angle = ((now - startedAt) / time) * Math.PI * 2;
        object.position.y = pos.y + Math.sin(angle) * 0.045;
      }

      if (progress < 1 || mode === 'float') {
        animationFrames.set(node, requestAnimationFrame(step));
      } else {
        object.position.set(pos.x, pos.y, pos.z);
        if (mode === 'pop') object.scale.set(1, 1, 1);
        if (mode === 'fade') setMaterialsOpacity(node, 1);
        animationFrames.delete(node);
      }
    };
    animationFrames.set(node, requestAnimationFrame(step));
  }

  const TRANSITION_MS = 650;

  function disposeClonedObject(object) {
    object.traverse((part) => {
      if (part.geometry && typeof part.geometry.dispose === 'function') part.geometry.dispose();
      if (!part.material) return;
      const materials = Array.isArray(part.material) ? part.material : [part.material];
      materials.forEach((material) => {
        if (material.map && typeof material.map.dispose === 'function') material.map.dispose();
        if (typeof material.dispose === 'function') material.dispose();
      });
    });
  }

  // Copia la escena que está saliendo para poder desvanecerla mientras aparece la nueva.
  // Se duplican geometrías, materiales y texturas para que borrar la escena anterior
  // no interrumpa la animación de salida.
  function fadeOutNodeClone(node) {
    const sourceMesh = node.getObject3D('mesh');
    if (!sourceMesh || node.getAttribute('visible') === false) return;

    const clone = node.object3D.clone(true);
    const materials = [];
    clone.traverse((part) => {
      if (!part.isMesh) return;
      // Dibujar la capa saliente antes de la entrante permite que ambas se mezclen
      // durante el fundido, en vez de que la anterior tape por completo a la nueva.
      if (Number.isFinite(part.renderOrder)) part.renderOrder -= 0.1;
      if (part.geometry && typeof part.geometry.clone === 'function') part.geometry = part.geometry.clone();
      const originals = Array.isArray(part.material) ? part.material : [part.material];
      const copies = originals.map((original) => {
        const material = original.clone();
        if (original.map && typeof original.map.clone === 'function') {
          material.map = original.map.clone();
          material.map.needsUpdate = true;
        }
        material.transparent = true;
        material.depthWrite = false;
        material.userData.webarBaseOpacity = material.opacity;
        materials.push({ material, startOpacity: material.opacity });
        return material;
      });
      part.material = Array.isArray(part.material) ? copies : copies[0];
    });

    targetEl.object3D.add(clone);
    const startedAt = performance.now();
    const easeInOut = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const step = (now) => {
      const progress = clamp((now - startedAt) / TRANSITION_MS, 0, 1);
      const factor = 1 - easeInOut(progress);
      materials.forEach(({ material, startOpacity }) => {
        material.opacity = startOpacity * factor;
        material.needsUpdate = true;
      });
      if (progress < 1) {
        activeExitClones.set(clone, requestAnimationFrame(step));
      } else {
        activeExitClones.delete(clone);
        if (clone.parent) clone.parent.remove(clone);
        disposeClonedObject(clone);
      }
    };
    activeExitClones.set(clone, requestAnimationFrame(step));
  }

  function fadeInNode(node, duration = TRANSITION_MS) {
    stopTransition(node);
    const time = Math.max(1, safeNumber(duration, TRANSITION_MS));
    const startedAt = performance.now();
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);
    setMaterialsOpacity(node, 0);
    const step = (now) => {
      if (!node.isConnected) {
        transitionFrames.delete(node);
        return;
      }
      const progress = clamp((now - startedAt) / time, 0, 1);
      setMaterialsOpacity(node, easeOut(progress));
      if (progress < 1) transitionFrames.set(node, requestAnimationFrame(step));
      else {
        setMaterialsOpacity(node, 1);
        transitionFrames.delete(node);
      }
    };
    transitionFrames.set(node, requestAnimationFrame(step));
  }

  async function loadCustomFonts() {
    const fonts = config && config.project && Array.isArray(config.project.fonts) ? config.project.fonts : [];
    if (!('fonts' in document) || typeof FontFace === 'undefined' || fonts.length === 0) return;
    await Promise.all(fonts.map(async (font) => {
      if (!font || !font.family || !font.src) return;
      try {
        const face = new FontFace(font.family, `url("${font.src.replace(/"/g, '')}")`, {
          weight: String(font.weight || 'normal'),
          style: String(font.style || 'normal')
        });
        const loadedFace = await face.load();
        document.fonts.add(loadedFace);
      } catch (error) {
        console.warn(`No se pudo cargar la fuente "${font.family}" desde ${font.src}. Se usará una fuente alternativa.`, error);
      }
    }));
    try { await document.fonts.ready; } catch (_) { /* La fuente estándar seguirá disponible. */ }
  }

  function imageUrl(path) {
    if (!path) return '';
    // Se conservan las rutas relativas para que también funcione en GitHub Pages.
    return path;
  }

  function renderScene(index, options = {}) {
    if (!config) return;
    if (options.transition) {
      fadeOutNodeClone(artNode);
      fadeOutNodeClone(textNode);
    }
    currentSceneIndex = clamp(index, 0, config.scenes.length - 1);
    sceneRevision += 1;
    const thisRevision = sceneRevision;
    const scene = config.scenes[currentSceneIndex];

    disposeNodeMesh(artNode);
    disposeNodeMesh(textNode);

    setNodePosition(artNode, scene.image.x, scene.image.y, scene.image.z);
    setNodePosition(textNode, scene.text.x, scene.text.y, scene.text.z);

    if (scene.image.src) {
      artNode.setAttribute('visible', false);
      const loader = new THREE.TextureLoader();
      loader.load(
        imageUrl(scene.image.src),
        (texture) => {
          if (thisRevision !== sceneRevision || !artNode.isConnected) {
            texture.dispose();
            return;
          }
          const original = texture.image || {};
          const pixelWidth = safeNumber(original.naturalWidth || original.videoWidth || original.width, 1);
          const pixelHeight = safeNumber(original.naturalHeight || original.videoHeight || original.height, 1);
          if ('colorSpace' in texture && THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
          else if ('encoding' in texture && THREE.sRGBEncoding) texture.encoding = THREE.sRGBEncoding;
          texture.needsUpdate = true;

          const planeWidth = scene.image.width;
          const planeHeight = scene.image.height === null
            ? planeWidth * (pixelHeight / Math.max(1, pixelWidth))
            : scene.image.height;
          const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
          const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: scene.image.opacity,
            side: THREE.DoubleSide,
            depthWrite: false,
            toneMapped: false
          });
          material.userData.webarBaseOpacity = scene.image.opacity;
          const mesh = new THREE.Mesh(geometry, material);
          mesh.renderOrder = 2;
          artNode.setObject3D('mesh', mesh);
          artNode.setAttribute('visible', true);
          animateNode(artNode, scene.image.animation, scene.image.durationMs, scene.image);
          if (options.transition) fadeInNode(artNode);
        },
        undefined,
        (error) => {
          if (thisRevision === sceneRevision) {
            artNode.setAttribute('visible', false);
            console.info(`Ilustración pendiente o no encontrada: ${scene.image.src}`, error || '');
          }
        }
      );
    } else {
      artNode.setAttribute('visible', false);
    }

    if (scene.text.content.trim()) {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = Math.max(128, Math.round(1024 * scene.text.height / scene.text.width));
      const context = canvas.getContext('2d');
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.globalAlpha = scene.text.opacity;
      context.fillStyle = scene.text.color;
      context.textAlign = scene.text.align;
      context.textBaseline = 'top';
      context.font = `${scene.text.fontWeight} ${scene.text.fontSize}px "${scene.text.fontFamily.replace(/"/g, '')}"`;

      const padding = Math.max(18, scene.text.fontSize * 0.35);
      const maxLineWidth = canvas.width - padding * 2;
      const rawLines = scene.text.content.split('\n');
      const lines = [];
      rawLines.forEach((rawLine) => {
        if (rawLine === '') { lines.push(''); return; }
        const words = rawLine.split(/\s+/);
        let line = '';
        words.forEach((word) => {
          const candidate = line ? `${line} ${word}` : word;
          if (line && context.measureText(candidate).width > maxLineWidth) {
            lines.push(line);
            line = word;
          } else {
            line = candidate;
          }
        });
        lines.push(line);
      });

      // Todos los textos de la experiencia son blancos con un contorno negro fino,
      // para mantener el contraste sobre imágenes y fondos reales de la cámara.
      context.fillStyle = '#FFFFFF';
      context.strokeStyle = '#000000';
      context.lineWidth = Math.max(2, scene.text.fontSize * 0.055);
      context.lineJoin = 'round';

      const lineStep = scene.text.fontSize * scene.text.lineHeight;
      const totalTextHeight = Math.max(lineStep, lines.length * lineStep);
      let y = padding;
      if (scene.text.verticalAlign === 'middle') y = Math.max(padding, (canvas.height - totalTextHeight) / 2);
      if (scene.text.verticalAlign === 'bottom') y = Math.max(padding, canvas.height - totalTextHeight - padding);
      const x = scene.text.align === 'left' ? padding : scene.text.align === 'right' ? canvas.width - padding : canvas.width / 2;
      lines.forEach((line, lineIndex) => {
        if (y + lineIndex * lineStep <= canvas.height - padding) {
          const lineY = y + lineIndex * lineStep;
          context.strokeText(line, x, lineY, maxLineWidth);
          context.fillText(line, x, lineY, maxLineWidth);
        }
      });
      context.globalAlpha = 1;

      const texture = new THREE.CanvasTexture(canvas);
      if ('colorSpace' in texture && THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
      else if ('encoding' in texture && THREE.sRGBEncoding) texture.encoding = THREE.sRGBEncoding;
      texture.needsUpdate = true;
      const geometry = new THREE.PlaneGeometry(scene.text.width, scene.text.height);
      // Fondo negro semitransparente detrás del texto. Al formar parte del mismo
      // grupo que la tipografía, acompaña exactamente su posición y su animación.
      const textGroup = new THREE.Group();
      const backgroundGeometry = new THREE.PlaneGeometry(scene.text.width * 1.045, scene.text.height * 1.12);
      const backgroundMaterial = new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.56,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: false,
        toneMapped: false
      });
      backgroundMaterial.userData.webarBaseOpacity = 0.56;
      const backgroundMesh = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
      backgroundMesh.position.z = 0;
      backgroundMesh.renderOrder = 2.5;
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 1,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: false,
        toneMapped: false
      });
      material.userData.webarBaseOpacity = 1;
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.z = 0.002;
      mesh.renderOrder = 3;
      textGroup.add(backgroundMesh);
      textGroup.add(mesh);
      textNode.setObject3D('mesh', textGroup);
      textNode.setAttribute('visible', true);
      animateNode(textNode, scene.text.animation, scene.text.durationMs, scene.text);
      if (options.transition) fadeInNode(textNode);
    } else {
      textNode.setAttribute('visible', false);
    }

    updateHint();
  }

  function updateHint() {
    if (!config) return;
    if (!targetIsVisible) {
      if (restartButton) restartButton.hidden = true;
      setHint(config.interface.notFoundPrompt);
      return;
    }
    if (currentSceneIndex >= config.scenes.length - 1) {
      setHint(config.interface.finalPrompt);
      if (restartButton) restartButton.hidden = false;
      return;
    }
    if (restartButton) restartButton.hidden = true;
    setHint(config.interface.continuePrompt);
  }

  function nextScene() {
    if (!targetIsVisible || !config) return;
    if (currentSceneIndex < config.scenes.length - 1) renderScene(currentSceneIndex + 1, { transition: true });
    else updateHint();
  }

  function validateTargetFile() {
    return fetch(TARGET_URL, { cache: 'no-store' }).then((response) => {
      if (!response.ok) throw new Error('missing-target');
      return response.arrayBuffer();
    }).then((buffer) => {
      if (!buffer || buffer.byteLength < 100) throw new Error('invalid-target');
    });
  }

  function waitForScene() {
    if (sceneEl.hasLoaded) return Promise.resolve();
    return new Promise((resolve) => sceneEl.addEventListener('loaded', resolve, { once: true }));
  }

  async function startExperience() {
    try {
      setHint('Preparando la experiencia…');
      const response = await fetch(CONFIG_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error('No se pudo abrir config.json. Verificá que esté en la carpeta principal del proyecto y que la página se ejecute desde una dirección web.');
      config = normalizeConfig(await response.json());
      await loadCustomFonts();
      tapTargetEl.setAttribute('width', config.target.width);
      tapTargetEl.setAttribute('height', config.target.height);
      targetEl.setAttribute('mindar-image-target', `targetIndex: ${config.target.index}`);
      renderScene(0);

      await waitForScene();
      // La cámara debe verse a través del canvas WebGL. alpha:true por sí solo no
      // siempre basta en todos los móviles: forzamos el canal alfa del renderer.
      const makeRendererTransparent = () => {
        const renderer = sceneEl.renderer;
        if (!renderer) return;
        renderer.setClearColor(0x000000, 0);
        renderer.setClearAlpha(0);
        if (renderer.domElement) renderer.domElement.style.background = 'transparent';
      };
      makeRendererTransparent();
      sceneEl.addEventListener('renderstart', makeRendererTransparent, { once: true });
      try {
        await validateTargetFile();
      } catch (error) {
        showNotice(
          'Falta el archivo de reconocimiento del afiche.\n\nCopiá tu archivo .mind generado con MindAR dentro de la carpeta targets y renombralo exactamente poster.mind.\n\nLa ruta necesaria es: targets/poster.mind'
        );
        setHint('Falta configurar el afiche');
        return;
      }

      const arSystem = sceneEl.systems['mindar-image-system'];
      if (!arSystem || typeof arSystem.start !== 'function') {
        throw new Error('No se pudo iniciar MindAR. Comprobá que la conexión a internet permita cargar las bibliotecas de A-Frame y MindAR.');
      }
      sceneEl.addEventListener('arReady', () => {
        hideNotice();
        updateHint();
      });
      sceneEl.addEventListener('arError', () => {
        showNotice('No se pudo iniciar la cámara. Revisá el permiso de cámara del navegador y abrí la experiencia mediante HTTPS (por ejemplo, GitHub Pages).');
        setHint('No se pudo iniciar la cámara');
      });
      setHint('Solicitando acceso a la cámara…');
      const result = arSystem.start();
      if (result && typeof result.catch === 'function') {
        result.catch(() => {
          showNotice('No se pudo iniciar la cámara. Revisá los permisos y usá una dirección HTTPS.');
          setHint('No se pudo iniciar la cámara');
        });
      }
    } catch (error) {
      console.error(error);
      if (location.protocol === 'file:') {
        showNotice('No abras index.html directamente desde una carpeta. La cámara requiere una dirección web segura. Publicá el proyecto en HTTPS o probalo en un servidor local.');
      } else {
        showNotice(error.message || 'Ocurrió un error al iniciar la experiencia.');
      }
      setHint('No se pudo preparar la experiencia');
    }
  }

  targetEl.addEventListener('targetFound', () => {
    targetIsVisible = true;
    updateHint();
  });

  targetEl.addEventListener('targetLost', () => {
    targetIsVisible = false;
    updateHint();
  });

  tapTargetEl.addEventListener('click', (event) => {
    event.stopPropagation();
    nextScene();
  });

  if (restartButton) {
    restartButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!config || !targetIsVisible) return;
      renderScene(0, { transition: true });
      updateHint();
    });
  }

  window.addEventListener('pagehide', () => {
    // Los bucles de animación son de corta duración, excepto 'float'; cancelar el de cada entidad.
    stopAnimation(artNode);
    stopAnimation(textNode);
    stopTransition(artNode);
    stopTransition(textNode);
    activeExitClones.forEach((frame, clone) => {
      cancelAnimationFrame(frame);
      if (clone.parent) clone.parent.remove(clone);
      disposeClonedObject(clone);
    });
    activeExitClones.clear();
  });

  startExperience();
})();
