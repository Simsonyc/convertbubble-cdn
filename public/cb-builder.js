(function () {
  console.log("✅ cb.js initialisé (overlay CTA actif)");

  // --------- Utilitaires -----------------
  function el(tag, style) {
    const e = document.createElement(tag);
    if (style) Object.assign(e.style, style);
    return e;
  }
  function px(n){ return typeof n === "number" ? n + "px" : n; }

  // NEW: convertir une couleur en rgba avec alpha
  function toRgba(color, alpha = 1) {
    const clamp = v => Math.max(0, Math.min(1, v));
    alpha = clamp(alpha);
    if (!color || typeof color !== "string") return `rgba(255,0,85,${alpha})`;
    if (color.startsWith("rgba(")) {
      const p = color.slice(5, -1).split(",").map(s => s.trim());
      if (p.length === 4) p[3] = String(alpha); else p.push(String(alpha));
      return `rgba(${p.join(",")})`;
    }
    if (color.startsWith("rgb(")) {
      const body = color.slice(4, -1);
      return `rgba(${body}, ${alpha})`;
    }
    const hex = color.replace("#","").trim();
    if (/^[0-9a-fA-F]{3}$/.test(hex)) {
      const r = parseInt(hex[0]+hex[0],16);
      const g = parseInt(hex[1]+hex[1],16);
      const b = parseInt(hex[2]+hex[2],16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    if (/^[0-9a-fA-F]{6}$/.test(hex)) {
      const r = parseInt(hex.slice(0,2),16);
      const g = parseInt(hex.slice(2,4),16);
      const b = parseInt(hex.slice(4,6),16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return color; // fallback
  }

  async function loadConfig() {
    const url = (document.currentScript && document.currentScript.dataset.config) || "config.json";
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Config introuvable: " + res.status);
    return await res.json();
  }

  function matchAnyRegex(patterns, href) {
    try { return patterns.some(p => new RegExp(p).test(href)); }
    catch(e){ console.warn("Regex invalide:", e); return false; }
  }
  function shouldRenderByUrl(config) {
    const rules = config && config.display && config.display.rules;
    if (!rules || !Array.isArray(rules.patterns) || !rules.patterns.length) return true;
    const href = location.href;
    const isMatch = matchAnyRegex(rules.patterns, href);
    if (rules.mode === "allowlist") return isMatch;
    if (rules.mode === "blocklist") return !isMatch;
    return true;
  }

  function applyAnimation(node, type) {
    if (type === "pulse") {
      node.animate([{ transform:"scale(1)" }, { transform:"scale(1.06)" }, { transform:"scale(1)" }],
                   { duration: 1200, iterations: Infinity, easing:"ease-in-out" });
    } else if (type === "bounce") {
      node.animate([{ transform:"translateY(0)" }, { transform:"translateY(-6px)" }, { transform:"translateY(0)" }],
                   { duration: 900, iterations: Infinity, easing:"ease-in-out" });
    }
  }

  // --------- Création de la bulle (inchangé) -----------------
  function createBubble(config) {
    const theme = config.theme || {};
    const bubbleTheme = theme.bubble || {};
    const captionCfg = theme.caption || {};
    const shape = theme.shape || "circle";
    const pos = config.position || "BR";
    const anim = config.animation || "none";

    const bw = Math.max(bubbleTheme.width || 120, 120);
    const bh = bubbleTheme.height || 120;
    const captionPos = captionCfg.position || "right";
    const maxFraction = captionCfg.maxFraction || 0.5;

    const wrapper = el("div", {
      position:"fixed", zIndex:2147483646,
      display:"flex", alignItems:"center", justifyContent:"center",
      cursor:"pointer", userSelect:"none",
      background: theme.primary || "#ff0055",
      color: captionCfg.color || "#fff",
      border: (theme.border?.width || 0) + "px solid " + (theme.border?.color || "transparent"),
      borderRadius: shape === "circle" ? "50%" : "14px",
      boxShadow:"0 10px 20px rgba(0,0,0,.18)", overflow:"hidden"
    });

    if (captionPos === "left" || captionPos === "right") {
      wrapper.style.width = px(bw + bw * maxFraction);
      wrapper.style.height = px(bh);
      wrapper.style.flexDirection = captionPos === "left" ? "row-reverse" : "row";
    } else {
      wrapper.style.width = px(bw);
      wrapper.style.height = px(bh + bh * maxFraction);
      wrapper.style.flexDirection = captionPos === "top" ? "column-reverse" : "column";
    }

    const bubbleContent = el("div", {
      width: px(bw), height: px(bh),
      display:"flex", alignItems:"center", justifyContent:"center",
      flexShrink:"0", overflow:"hidden"
    });

    const lc = config.launcherContent || { type:"emoji", emoji:"▶" };
    if (lc.type === "videoPreview") {
      const pv = el("video", { width:"100%", height:"100%", objectFit:"cover" });
      pv.src = lc.src || "";
      pv.muted = true; pv.autoplay = true; pv.playsInline = true; pv.loop = false;
      bubbleContent.appendChild(pv);
      const limit = lc.previewSeconds || 3;
      pv.addEventListener("timeupdate", () => { if (pv.currentTime >= limit) { pv.currentTime = 0; pv.play().catch(()=>{}); } });
    } else if (lc.type === "image") {
      const img = el("img", { width:"100%", height:"100%", objectFit:"cover" });
      img.src = lc.src || "";
      bubbleContent.appendChild(img);
    } else {
      const icon = el("div", { fontSize:"34px" });
      icon.textContent = lc.emoji || "▶";
      bubbleContent.appendChild(icon);
    }
    wrapper.appendChild(bubbleContent);

    if (captionCfg && captionCfg.text) {
      const caption = el("div", {
        flex:"1", padding:"4px 6px",
        fontSize:(captionCfg.fontSize || 13)+"px",
        textAlign:"center", whiteSpace:"normal", wordBreak:"break-word",
        color: captionCfg.color || "#fff"
      });
      caption.textContent = captionCfg.text;
      wrapper.appendChild(caption);
    }

    const margin = 18;
    if (pos.includes("B")) wrapper.style.bottom = px(margin);
    if (pos.includes("T")) wrapper.style.top = px(margin);
    if (pos.includes("R")) wrapper.style.right = px(margin);
    if (pos.includes("L")) wrapper.style.left = px(margin);

    applyAnimation(wrapper, anim);
    return wrapper;
  }

  // --------- Player overlay -----------------
  function openOverlay(config, wrapper) {
    wrapper.style.display = "none";

    const overlay = el("div", {
      position: "fixed", inset: "0",
      background: `rgba(0,0,0,${config.theme?.overlayOpacity ?? 0.9})`,
      display: "flex", justifyContent: "center", alignItems: "center",
      zIndex: 10000
    });

    // Couleur/épaisseur de bordure prises du thème pour cohérence
    const borderWidth = config.theme?.border?.width ?? 4;
    const borderColor = config.theme?.border?.color ?? "#0f172a";

    const box = el("div", {
      background:"#0b1020", borderRadius:"12px", padding:"16px",
      maxWidth:"90%", maxHeight:"90%", position:"relative",
      display:"flex", flexDirection:"column", boxShadow:"0 12px 40px rgba(0,0,0,0.5)", color:"white",
      border: `${borderWidth}px solid ${borderColor}`, boxSizing:"border-box"
    });

    // Branding (même bordure que la box)
    if (config.branding && config.branding.enabled) {
      const header = el("div", {
        width:"100%", height:"80px",
        background: config.branding.color || "#ff0055",
        display:"flex", alignItems:"center", justifyContent:"center",
        position:"relative", borderRadius:"8px",
        border: `${borderWidth}px solid ${borderColor}`, // 👈 même rendu que le cadre
        marginBottom:"8px", boxSizing:"border-box"
      });
      const label = el("div", { color:"#fff", fontWeight:"bold", fontSize:"28px" });
      label.textContent = config.branding.label || "";
      const closeBtn = el("button", {
        position:"absolute", right:"10px", top:"50%", transform:"translateY(-50%)",
        width:"36px", height:"36px", border:"none", borderRadius:"50%",
        fontSize:"22px", cursor:"pointer",
        background:"rgba(255,255,255,0.3)", color:"white"
      });
      closeBtn.textContent = "×";
      closeBtn.onclick = () => { overlay.remove(); wrapper.style.display = "flex"; };
      header.appendChild(label); header.appendChild(closeBtn);
      box.appendChild(header);
    }

    // ------- VIDÉO : barre visible, sans bande noire -------
    const videoWrap = el("div", {
      position:"relative",
      width:"100%",
      background:"transparent",   // plus de fond noir, le noir reste sur <video>
      borderRadius:"10px",
      overflow:"visible",         // laisse la barre déborder si besoin
      display:"block",
      paddingBottom:"0"           // supprime l'espace noir en bas
    });

    const vcfg = config.video || {};
    const video = document.createElement("video");
    video.src = vcfg.src || "";
    Object.assign(video.style, {
      width:"100%",
      height:"auto",             // aucune hauteur imposée
      display:"block",
      background:"#000",         // fond uniquement sous la vidéo
      borderRadius:"10px",
      objectFit:"contain",
      maxHeight:"calc(90vh - 200px)"
    });
    video.controls = true;
    video.setAttribute("controls", "controls");
    video.setAttribute("controlsList", "nodownload");
    video.autoplay = true;       // son OK à l’ouverture (après clic bulle)
    video.playsInline = true;
    video.preload = "auto";
    videoWrap.appendChild(video);

    // --------- CTA : wrapper + règles de layout ---------
    const ctaBgOpacity =
      (config.ctaOverlay && typeof config.ctaOverlay.opacity === "number")
        ? config.ctaOverlay.opacity
        : (typeof config.theme?.ctaOverlayOpacity === "number" ? config.theme.ctaOverlayOpacity : 0.6);

    const ctasWrap = el("div", {
      position:"absolute",
      bottom: px((config.ctaOverlay && typeof config.ctaOverlay.offset === "number") ? config.ctaOverlay.offset : 80),
      left:"50%", transform:"translateX(-50%)",
      display:"none",
      width:"80%",
      // le mode d'affichage (flex/grid) sera piloté dynamiquement
      gap:"10px",
      justifyContent:"center",
      borderRadius:"6px",
      background:`rgba(0,0,0,${ctaBgOpacity})`,
      zIndex: 3,
      boxSizing:"border-box",
      padding:"6px"
    });

    // NEW: opacité pour le fond des boutons
    const buttonOpacity =
      (config.ctaOverlay && typeof config.ctaOverlay.buttonOpacity === "number")
        ? config.ctaOverlay.buttonOpacity
        : 1;
    const buttonBg = toRgba(config.theme?.primary || "#ff0055", buttonOpacity);

    // crée les CTA (max 4)
    const allCtas = (config.ctas || []).slice(0, 4);
    function makeCta(c) {
      const a = el("a", {
        flex:"1",
        background: buttonBg,   // <-- appliqué ici
        padding:"10px 16px",
        borderRadius:"6px",
        color:"white",
        fontWeight:"bold",
        textDecoration:"none",
        minWidth:"0",

        // centrage parfait
        display:"none",           // basculé en "flex" quand visible
        alignItems:"center",
        justifyContent:"center",
        textAlign:"center",
        lineHeight:"1.15",
        whiteSpace:"normal"
      });
      a.textContent = c.label || "Action";
      a.href = c.href || "#";
      return a;
    }
    const ctas = allCtas.map(makeCta);
    ctas.forEach(a => ctasWrap.appendChild(a));
    videoWrap.appendChild(ctasWrap);

    // Helpers layout
    function setSequentialLayout(visibleIdx) {
      // une seule ligne (flex) pour les apparitions séquentielles
      ctasWrap.style.display = visibleIdx.length ? "flex" : "none";
      ctasWrap.style.display !== "none" && (ctasWrap.style.alignItems = "stretch");
      ctasWrap.style.flexWrap = "nowrap";
      ctasWrap.style.display = visibleIdx.length ? "flex" : "none";
      ctasWrap.style.removeProperty("grid-template-columns");
      ctas.forEach((a, i) => {
        a.style.display = visibleIdx.includes(i) ? "flex" : "none";
        a.style.gridColumn = ""; // reset éventuel
      });
    }

    function setFinalLayout() {
      const n = ctas.length;
      if (!n) { ctasWrap.style.display = "none"; return; }

      // layout "tous ensemble" selon les règles
      ctasWrap.style.display = "grid";
      ctasWrap.style.flexWrap = "";
      if (n === 1) {
        ctasWrap.style.gridTemplateColumns = "1fr";
      } else {
        ctasWrap.style.gridTemplateColumns = "1fr 1fr";
      }

      // reset
      ctas.forEach(a => { a.style.display = "flex"; a.style.gridColumn = ""; });

      if (n === 3) {
        // 1ère ligne = 1 bouton centré (span 2 colonnes), 2ème ligne = 2 boutons
        ctas[0].style.gridColumn = "1 / span 2";
      }
    }

    box.appendChild(videoWrap);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // --------- Logique d'affichage CTA (instant / timed) ---------
    const mode = (config.ctaMode || "timed").toLowerCase();
    const seq = config.timing?.sequence || [];
    const showAllAt = config.timing?.showAllAt;
    let finalShown = false;

    function isFinalTime(t, dur) {
      if (typeof showAllAt === "number") return t >= showAllAt;
      if (showAllAt === "end" && dur) return t >= dur - 0.5;
      return false;
    }

    if (mode === "instant") {
      // tous ensemble dès le départ, selon la matrice
      setFinalLayout();
    } else {
      // TIMED : apparition un par un sur une seule ligne, puis "final"
      video.addEventListener("timeupdate", () => {
        const t = video.currentTime || 0;
        const dur = video.duration || 0;

        if (!finalShown && isFinalTime(t, dur)) {
          setFinalLayout();
          finalShown = true;
          return;
        }

        if (!finalShown) {
          // calcule les CTA visibles à l'instant t (fenêtres showAt/duration)
          const visible = [];
          seq.forEach(s => {
            const idx = (s.index|0);
            if (!ctas[idx]) return;
            const inWindow = s.duration
              ? (t >= s.showAt && t < (s.showAt + s.duration))
              : (t >= s.showAt);
            if (inWindow) visible.push(idx);
          });
          setSequentialLayout(visible);
        }
      });
    }

    // au cas où l’autoplay serait retenu par le navigateur
    video.play().catch(()=>{});
  }

  // --------- Bootstrap -----------------
  (async function init(){
    try {
      const config = await loadConfig();
      if (!shouldRenderByUrl(config)) return;
      const wrapper = createBubble(config);
      wrapper.onclick = () => openOverlay(config, wrapper);
      document.body.appendChild(wrapper);
    } catch (e) {
      console.error("❌ Erreur init ConvertBubble:", e);
    }
  })();
})();

