document.addEventListener("DOMContentLoaded", function() {
  require([
    "esri/Map",
    "esri/views/SceneView",
    "esri/layers/FeatureLayer",
    "esri/widgets/Home",
    "esri/widgets/BasemapGallery",
    "esri/widgets/Expand",
    "esri/widgets/Legend"
  ], function(Map, SceneView, FeatureLayer, Home, BasemapGallery, Expand, Legend) {

    const map = new Map({ basemap: "topo-vector", ground: "world-elevation" });

    const euHorizontalLayer = new FeatureLayer({
      url: "https://services1.arcgis.com/AGrMjSBR7fxJYLfU/arcgis/rest/services/EU_horizontal/FeatureServer/0",
      outFields: ["*"], visible: true, title: "EU Horizontal Planes",
      popupTemplate: { title: "Temperature", content: "Value: {Temperature}" },
      elevationInfo: { mode: "relative-to-ground", offset: 300000 },
      renderer: {
        type: "simple",
        symbol: { type: "polygon-3d", symbolLayers: [{ type: "fill", material: { color: "white" } }] },
        visualVariables: [
          { type: "color", field: "Temperature",
            stops: [{ value: 266, color: "#4575b4" }, { value: 277, color: "#ffffbf" }, { value: 286, color: "#d73027" }] },
          { type: "opacity", field: "Temperature", stops: [{ value: 266, opacity: 1 }, { value: 286, opacity: 1 }] }
        ]
      }
    });

    map.add(euHorizontalLayer);

    const view = new SceneView({
      container: "viewDiv", map,
      camera: { position: { latitude: 48, longitude: 15, z: 15000000 }, tilt: 0, heading: -1 },
      constraints: { rotationEnabled: true },
      qualityProfile: "high"
    });

    // Widgets
    view.ui.add(new Home({ view }), "top-left");
    const bg = new BasemapGallery({ view });
    view.ui.add(new Expand({ view, content: bg, expandIconClass: "esri-icon-basemap" }), "top-left");
    const legend = new Legend({ view, layerInfos: [{ layer: euHorizontalLayer, title: "Horizontal Planes" }] });
    view.ui.add(new Expand({ view, content: legend, expandIconClass: "esri-icon-legend" }), "bottom-left");

    // UI
    const startColorPicker = document.getElementById("startColorPicker");
    const middleColorPicker = document.getElementById("middleColorPicker");
    const endColorPicker = document.getElementById("endColorPicker");
    const transparencyInput = document.getElementById("transparencyInput");
    const planeHeightInput = document.getElementById("planeHeightInput");
    const colorRampPreview = document.getElementById("colorRampPreview");

    // Help
    const helpButton = document.getElementById("helpButton");
    const helpOverlay = document.getElementById("helpModalOverlay");
    const helpModal = document.getElementById("helpModal");
    const closeHelpModalBtn = document.getElementById("closeHelpModal");

    // Helpers
    const TEMP_MIN = 266, TEMP_MID = 277, TEMP_MAX = 286;
    let booting = true;

    function updateColorRampPreview(stops) {
      if (!colorRampPreview) return;
      const colors = stops.map(s => s.color && s.color.toHex ? s.color.toHex() : s.color);
      colorRampPreview.style.background = `linear-gradient(to right, ${colors.join(", ")})`;
    }
    function updatePreviewFromInputs() {
      updateColorRampPreview([
        { value: TEMP_MIN, color: startColorPicker?.value || "#4575b4" },
        { value: TEMP_MID, color: middleColorPicker?.value || "#ffffbf" },
        { value: TEMP_MAX, color: endColorPicker?.value || "#d73027" }
      ]);
    }
    function debounce(fn, d = 100) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), d); }; }

    function buildRenderer(base) {
      const r = base.clone();
      let colorVV = r.visualVariables.find(v => v.type === "color");
      if (!colorVV) { colorVV = { type: "color", field: "Temperature", stops: [] }; r.visualVariables.push(colorVV); }
      colorVV.field = "Temperature";
      colorVV.stops = [
        { value: TEMP_MIN, color: startColorPicker?.value || "#4575b4" },
        { value: TEMP_MID, color: middleColorPicker?.value || "#ffffbf" },
        { value: TEMP_MAX, color: endColorPicker?.value || "#d73027" }
      ];
      return r;
    }

    function applyAll() {
      if (booting) return;
      euHorizontalLayer.renderer = buildRenderer(euHorizontalLayer.renderer);
      const op = Number(transparencyInput?.value);
      euHorizontalLayer.opacity = Number.isFinite(op) ? op : 1;
      const offset = Number(planeHeightInput?.value);
      euHorizontalLayer.elevationInfo = { mode: "relative-to-ground", offset: Number.isFinite(offset) ? offset : 300000 };
    }

    const applyWithPreviewDebounced = debounce(() => {
      updatePreviewFromInputs();   // (u nìkterých souborù se funkce jmenuje updatePreviewFromInputs)
      if (!booting) applyAll();
    }, 100);

    // UI: preview + help hned
    updatePreviewFromInputs();
    const openHelp = () => { if (!helpOverlay) return; helpOverlay.style.display = "flex"; helpOverlay.setAttribute("aria-hidden", "false"); };
    const closeHelp = () => { if (!helpOverlay) return; helpOverlay.style.display = "none"; helpOverlay.setAttribute("aria-hidden", "true"); };
    helpButton?.addEventListener("click", e => { e.preventDefault(); openHelp(); });
    closeHelpModalBtn?.addEventListener("click", e => { e.preventDefault(); closeHelp(); });
    helpOverlay?.addEventListener("click", e => { if (e.target === helpOverlay) closeHelp(); });
    window.addEventListener("keydown", e => { if (e.key === "Escape") closeHelp(); });
    helpModal?.addEventListener("click", e => e.stopPropagation());

    // Listeners hned
    startColorPicker?.addEventListener("input", () => { updatePreviewFromInputs(); applyWithPreviewDebounced(); });
    middleColorPicker?.addEventListener("input", () => { updatePreviewFromInputs(); applyWithPreviewDebounced(); });
    endColorPicker?.addEventListener("input", () => { updatePreviewFromInputs(); applyWithPreviewDebounced(); });
    transparencyInput?.addEventListener("input", applyWithPreviewDebounced);
    planeHeightInput?.addEventListener("input", applyWithPreviewDebounced);

    // Boot
    view.when(async () => {
      await view.whenLayerView(euHorizontalLayer).catch(() => {});
      try {
        await view.goTo({ position: { latitude: 48, longitude: 15, z: 6000000 }, tilt: 0, heading: -1 }, { duration: 5000 });
      } catch (e) {}
      booting = false;
      applyAll();
    });
  });
});
