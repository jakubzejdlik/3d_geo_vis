document.addEventListener("DOMContentLoaded", function () {
  require([
    "esri/Map",
    "esri/Ground",
    "esri/views/SceneView",
    "esri/layers/ElevationLayer",
    "esri/layers/FeatureLayer",
    "esri/widgets/Home",
    "esri/widgets/BasemapGallery",
    "esri/widgets/Expand",
    "esri/widgets/Legend"
  ], function (
    Map, Ground, SceneView, ElevationLayer, FeatureLayer, Home, BasemapGallery, Expand, Legend
  ) {

    // === CONFIG ===
    const ELEVATION_URL = "https://tiles.arcgis.com/tiles/AGrMjSBR7fxJYLfU/arcgis/rest/services/ho_povrch_proj/ImageServer";
    const FEATURES_URL  = "https://services1.arcgis.com/AGrMjSBR7fxJYLfU/arcgis/rest/services/EU_horizontal/FeatureServer/0";
    const FEATURE_FIELD = "Temperature"; // numerické pole pro rampu

    // === UI prvky ===
    const startColorPicker = document.getElementById("startColorPicker");
    const middleColorPicker = document.getElementById("middleColorPicker");
    const endColorPicker    = document.getElementById("endColorPicker");
    const transparencyInput = document.getElementById("transparencyInput");
    const colorRampPreview  = document.getElementById("colorRampPreview");

    // Help (pokud je v HTML)
    const helpButton        = document.getElementById("helpButton");
    const helpOverlay       = document.getElementById("helpModalOverlay");
    const helpModal         = document.getElementById("helpModal");
    const closeHelpModalBtn = document.getElementById("closeHelpModal");
    const openHelp  = () => { if (!helpOverlay) return; helpOverlay.style.display = "flex"; helpOverlay.setAttribute("aria-hidden","false"); };
    const closeHelp = () => { if (!helpOverlay) return; helpOverlay.style.display = "none"; helpOverlay.setAttribute("aria-hidden","true"); };
    helpButton?.addEventListener("click", e => { e.preventDefault(); openHelp(); });
    closeHelpModalBtn?.addEventListener("click", e => { e.preventDefault(); closeHelp(); });
    helpOverlay?.addEventListener("click", e => { if (e.target === helpOverlay) closeHelp(); });
    window.addEventListener("keydown", e => { if (e.key === "Escape") closeHelp(); });
    helpModal?.addEventListener("click", e => e.stopPropagation());

    // === helpers ===
    const clampHex = (hex, def) => (typeof hex === "string" && /^#?[0-9a-f]{6}$/i.test(hex) ? (hex[0]==="#"?hex:"#"+hex) : def);
    const debounce = (fn, d=120) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), d); }; };

    function updatePreview() {
      if (!colorRampPreview) return;
      const s = clampHex(startColorPicker?.value, "#4575b4");
      const m = clampHex(middleColorPicker?.value, "#ffffbf");
      const e = clampHex(endColorPicker?.value, "#d73027");
      colorRampPreview.style.background = `linear-gradient(to right, ${s}, ${m}, ${e})`;
    }

    // === MAP: ground = pouze náš elevation ===
    const map = new Map({ basemap: "topo-vector" });
    const customElevation = new ElevationLayer({ url: ELEVATION_URL });
    map.ground = new Ground({ layers: [customElevation] });

    // Overlay (drapované polygony, barveno podle Temperature)
    const overlayLayer = new FeatureLayer({
      url: FEATURES_URL,
      title: "3D Surface (Temperature)",
      outFields: ["*"],
      elevationInfo: { mode: "on-the-ground" },
      visible: false,           // zapneme až po nastavení rendereru
      popupEnabled: true
    });
    map.add(overlayLayer);

    // === VIEW ===
    const view = new SceneView({
      container: "viewDiv",
      map,
      camera: { position: { latitude: 48, longitude: 15, z: 15000000 }, tilt: 0, heading: -1 },
      qualityProfile: "high",
      environment: { atmosphereEnabled: true, lighting: { directShadowsEnabled: false } }
    });

    // === WIDGETS ===
    view.ui.add(new Home({ view }), "top-left");
    const bg = new BasemapGallery({ view });
    view.ui.add(new Expand({ view, content: bg, expandIconClass: "esri-icon-basemap" }), "top-left");
    const legend = new Legend({ view, layerInfos: [{ layer: overlayLayer, title: "3D Surface (Temperature)" }] });
    view.ui.add(new Expand({ view, content: legend, expandIconClass: "esri-icon-legend" }), "bottom-left");

    // === STATISTIKY pro rampu ===
    let statsMin = null, statsMax = null;

    async function fetchMinMax() {
      await overlayLayer.load();
      const fld = overlayLayer.fields.find(f => f.name === FEATURE_FIELD);
      if (!fld || !["double","single","integer","small-integer"].includes(fld.type)) {
        statsMin = statsMax = null; return;
      }
      const q = overlayLayer.createQuery();
      q.where = "1=1"; q.returnGeometry = false;
      q.outStatistics = [
        { statisticType: "min", onStatisticField: FEATURE_FIELD, outStatisticFieldName: "vmin" },
        { statisticType: "max", onStatisticField: FEATURE_FIELD, outStatisticFieldName: "vmax" }
      ];
      const res = await overlayLayer.queryFeatures(q);
      const a = res.features?.[0]?.attributes || {};
      const vmin = Number(a.vmin), vmax = Number(a.vmax);
      statsMin = Number.isFinite(vmin) ? vmin : 0;
      statsMax = Number.isFinite(vmax) ? vmax : 1;
      if (statsMin === statsMax) { statsMin -= 0.5; statsMax += 0.5; }
    }

    function buildRenderer() {
      const baseSymbol = { type: "polygon-3d", symbolLayers: [{ type: "fill", material: { color: [255,255,255,255] } }] };

      // prùhlednost overlay
      const op = Number(transparencyInput?.value);
      overlayLayer.opacity = Number.isFinite(op) ? op : 1;

      // bez platných statistik -> prostý renderer
      if (!Number.isFinite(statsMin) || !Number.isFinite(statsMax)) {
        return { type: "simple", symbol: baseSymbol };
      }

      // barevná VV: start/middle/end
      const s = clampHex(startColorPicker?.value, "#4575b4");
      const m = clampHex(middleColorPicker?.value, "#ffffbf");
      const e = clampHex(endColorPicker?.value, "#d73027");
      const mid = statsMin + (statsMax - statsMin) * 0.5;

      return {
        type: "simple",
        symbol: baseSymbol,
        visualVariables: [{
          type: "color",
          field: FEATURE_FIELD,
          stops: [
            { value: statsMin, color: s },
            { value: mid,      color: m },
            { value: statsMax, color: e }
          ]
        }]
      };
    }

    function applyRenderer() {
      overlayLayer.renderer = buildRenderer();
      updatePreview();
    }
    const applyWithPreviewDebounced = debounce(applyRenderer, 120);

    // === UI listenery (jen barvy a prùhlednost) ===
    updatePreview();
    startColorPicker?.addEventListener("input", applyWithPreviewDebounced);
    middleColorPicker?.addEventListener("input", applyWithPreviewDebounced);
    endColorPicker?.addEventListener("input", applyWithPreviewDebounced);
    transparencyInput?.addEventListener("input", applyWithPreviewDebounced);

    // === BOOT ===
    (async () => {
      try { await customElevation.load(); } catch {}
      try {
        await fetchMinMax();
        applyRenderer();          // renderer nastavíme pøed zviditelnìním overlaye
        overlayLayer.visible = true;
      } catch (e) {
        console.warn("Init rendereru selhal, zapínám overlay s default vzhledem:", e);
        overlayLayer.visible = true;
      }

      view.when(async () => {
        try {
          await view.goTo(
            { position: { latitude: 48, longitude: 15, z: 6000000 }, tilt: 0, heading: -1 },
            { duration: 5000 }
          );
        } catch (e) {}
      });
    })();
  });
});
