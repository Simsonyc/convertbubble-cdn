/* ConvertBubble V3 — Runtime (PHASE 5.5)
   Contract: expose exactly render(config), open(), destroy()
*/

(function () {
  'use strict';

  /** @type {{ root: HTMLElement, launcher: HTMLDivElement, video: HTMLVideoElement, overlay: HTMLDivElement, playerWrap: HTMLDivElement, player: HTMLVideoElement } | null} */
  let instance = null;
// ===== Timeline (PHASE 6.2) =====
let timelineHooks = [];
let triggeredHooks = null;
let onTimeUpdate = null;

const state = {
  isOpen: false,
  currentTime: 0,
  duration: 0,
  isReady: false
};

  function assertConfigV3(config) {
    if (config === null || typeof config !== 'object') {
      throw new Error('[CB-RUNTIME] ConfigV3 invalide: config doit être un objet.');
    }

    // launcher (NE PAS CHANGER)
    if (!config.launcher || typeof config.launcher !== 'object') {
      throw new Error('[CB-RUNTIME] ConfigV3 invalide: launcher requis.');
    }
    if (config.launcher.type !== 'video') {
      throw new Error('[CB-RUNTIME] ConfigV3 invalide: launcher.type doit être "video".');
    }
    if (typeof config.launcher.src !== 'string' || config.launcher.src === '') {
      throw new Error('[CB-RUNTIME] ConfigV3 invalide: launcher.src requis.');
    }
    if (typeof config.launcher.size !== 'number') {
      throw new Error('[CB-RUNTIME] ConfigV3 invalide: launcher.size requis.');
    }
    if (!['circle', 'rounded'].includes(config.launcher.shape)) {
      throw new Error('[CB-RUNTIME] ConfigV3 invalide: launcher.shape invalide.');
    }

    // position
    if (!config.position || typeof config.position !== 'object') {
      throw new Error('[CB-RUNTIME] ConfigV3 invalide: position requis.');
    }
    if (!['BR', 'BL', 'TR', 'TL'].includes(config.position.corner)) {
      throw new Error('[CB-RUNTIME] ConfigV3 invalide: position.corner invalide.');
    }
    if (typeof config.position.margin !== 'number') {
      throw new Error('[CB-RUNTIME] ConfigV3 invalide: position.margin requis.');
    }

    // player (PHASE 5.5)
    if (!config.player || typeof config.player !== 'object') {
      throw new Error('[CB-RUNTIME] ConfigV3 invalide: player requis.');
    }
    if (typeof config.player.src !== 'string' || config.player.src === '') {
      throw new Error('[CB-RUNTIME] ConfigV3 invalide: player.src requis.');
    }
    if (typeof config.player.autoplay !== 'boolean') {
      throw new Error('[CB-RUNTIME] ConfigV3 invalide: player.autoplay doit être un boolean.');
    }
    if (typeof config.player.controls !== 'boolean') {
      throw new Error('[CB-RUNTIME] ConfigV3 invalide: player.controls doit être un boolean.');
    }
  }

  function mount(config) {
    const root = document.createElement('div');
    root.setAttribute('data-cb-runtime', 'v3');
    root.style.position = 'fixed';
    root.style.zIndex = '2147483647';
    root.style.pointerEvents = 'auto';

    // === Launcher === (NE PAS MODIFIER)
    const launcher = document.createElement('div');
    launcher.setAttribute('data-cb-launcher', 'video');
    launcher.style.position = 'fixed';
    launcher.style.width = config.launcher.size + 'px';
    launcher.style.height = config.launcher.size + 'px';
    launcher.style.overflow = 'hidden';
    launcher.style.cursor = 'pointer';
    launcher.style.pointerEvents = 'auto';

    launcher.style.borderRadius =
      config.launcher.shape === 'circle' ? '9999px' : '16px';

    const m = config.position.margin + 'px';
    const c = config.position.corner;
    if (c.includes('B')) launcher.style.bottom = m;
    if (c.includes('T')) launcher.style.top = m;
    if (c.includes('R')) launcher.style.right = m;
    if (c.includes('L')) launcher.style.left = m;

    const video = document.createElement('video');
    video.muted = true;         // preview ALWAYS mute
    video.autoplay = true;
    video.loop = true;
    video.playsInline = true;
    video.src = config.launcher.src;
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'cover';
    video.style.display = 'block';

    launcher.appendChild(video);

    // === Overlay ===
    const overlay = document.createElement('div');
    overlay.setAttribute('data-cb-overlay', 'v3');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(0,0,0,0.72)';
    overlay.style.zIndex = '2147483646';
    overlay.style.display = 'none';
    overlay.style.pointerEvents = 'none';

    // Player container (centered)
    const playerWrap = document.createElement('div');
    playerWrap.setAttribute('data-cb-player-wrap', 'v3');
    playerWrap.style.position = 'absolute';
    playerWrap.style.left = '50%';
    playerWrap.style.top = '50%';
    playerWrap.style.transform = 'translate(-50%, -50%)';
    playerWrap.style.width = 'min(92vw, 960px)';
    playerWrap.style.aspectRatio = '16 / 9';
    playerWrap.style.background = '#000';
    playerWrap.style.borderRadius = '14px';
    playerWrap.style.overflow = 'hidden';
    playerWrap.style.boxShadow = '0 12px 40px rgba(0,0,0,0.45)';
    playerWrap.style.pointerEvents = 'auto';

    const player = document.createElement('video');
// ===== Timeline init =====
timelineHooks = Array.isArray(config.timeline)
  ? config.timeline
      .filter(h => typeof h.at === 'number' && typeof h.name === 'string')
      .slice()
      .sort((a, b) => a.at - b.at)
  : [];

triggeredHooks = new Set();

onTimeUpdate = function () {
  const t = player.currentTime;

  for (let i = 0; i < timelineHooks.length; i++) {
    const hook = timelineHooks[i];

    if (t >= hook.at && !triggeredHooks.has(hook.name)) {
      triggeredHooks.add(hook.name);

      window.dispatchEvent(
        new CustomEvent('cb:timeline', {
          detail: {
            name: hook.name,
            at: hook.at,
            currentTime: t,
          },
        })
      );
    }
  }
};

player.addEventListener('timeupdate', onTimeUpdate);

    player.setAttribute('data-cb-player', 'v3');
    player.src = config.player.src;
    player.playsInline = true;
    player.controls = config.player.controls;
// ===== PHASE 6.0 — runtime events =====
player.addEventListener('loadedmetadata', function () {
  state.duration = player.duration || 0;
  state.isReady = true;
});

player.addEventListener('timeupdate', function () {
  state.currentTime = player.currentTime || 0;
});

player.addEventListener('play', function () {
  state.isOpen = true;
});

player.addEventListener('pause', function () {
  // pause ≠ fermeture → on ne touche pas isOpen ici
});

player.addEventListener('ended', function () {
  state.currentTime = player.duration || state.currentTime;
});


    // IMPORTANT :
    // - on n'autoplay JAMAIS à l'init (sinon son possible avant clic selon context)
    // - on lancera au clic dans open()
    player.autoplay = false;

    player.style.width = '100%';
    player.style.height = '100%';
    player.style.display = 'block';
    player.style.objectFit = 'contain';
    player.preload = 'metadata';

    playerWrap.appendChild(player);
    overlay.appendChild(playerWrap);

    // Events
    launcher.addEventListener('click', function () {
      open(config);
    });

    // Click outside closes (overlay background). Click inside does nothing.
    overlay.addEventListener('click', function () {
      closeOverlay();
    });
    playerWrap.addEventListener('click', function (e) {
      e.stopPropagation();
    });

    root.appendChild(launcher);
    root.appendChild(overlay);
    document.body.appendChild(root);

    instance = { root, launcher, video, overlay, playerWrap, player };
  }

  function unmount() {
  if (!instance) return;

  try {
    if (instance.player && onTimeUpdate) {
      instance.player.removeEventListener('timeupdate', onTimeUpdate);
    }
    instance.root.remove();
  } finally {
    instance = null;
    timelineHooks = [];
    triggeredHooks = null;
    onTimeUpdate = null;
  }
}


  function closeOverlay() {
    if (!instance) return;

    instance.overlay.style.display = 'none';
    instance.overlay.style.pointerEvents = 'none';
    state.isOpen = false;
    state.currentTime = 0;

    // Stop + reset player
    try {
      instance.player.pause();
      instance.player.currentTime = 0;
    } catch (_) {}

    // Réaffiche la bulle (supprime l'effet "rond fantôme")
    instance.launcher.style.display = 'block';

    // Relance la preview proprement
    try {
      instance.video.currentTime = 0;
      instance.video.play();
    } catch (_) {}
  }

  // ===== Contract API =====

  function render(config) {
    assertConfigV3(config);
    unmount();
    mount(config);
  }

  function open(configForAutoplay) {
    if (!instance) {
      throw new Error('[CB-RUNTIME] open() appelé sans instance.');
    }

    // 1) Cache le launcher => plus de rond gris résiduel
    instance.launcher.style.display = 'none';

    // (optionnel mais propre) : stop la preview
    try {
      instance.video.pause();
    } catch (_) {}

    // 2) Affiche overlay
    instance.overlay.style.display = 'block';
    instance.overlay.style.pointerEvents = 'auto';
    state.isOpen = true;

    // 3) Démarrage du player (gesture utilisateur OK)
    // Si autoplay=true => on force play au clic
    if (configForAutoplay && configForAutoplay.player && configForAutoplay.player.autoplay) {
      try {
        instance.player.currentTime = 0;
        const p = instance.player.play();
        // évite "Uncaught (in promise)" si le navigateur refuse
        if (p && typeof p.catch === 'function') p.catch(function () {});
      } catch (_) {}
    }
  }

  function destroy() {
    unmount();
  }
function getState() {
  return {
    isOpen: instance ? instance.overlay.style.display === 'block' : false,
    currentTime: state.currentTime,
    duration: state.duration,
    isReady: state.isReady
  };
}


  window.ConvertBubbleRuntime = {
    render,
    open: function () { open(null); }, // contract exact
    destroy,
    getState
  };
})();
