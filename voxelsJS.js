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

    const euVoxelsLayer = new FeatureLayer({
      url: "https://services1.arcgis.com/AGrMjSBR7fxJYLfU/arcgis/rest/services/EU_voxels/FeatureServer/1",
      outFields: ["*"], visible: true, title: "EU Voxels",
      popupTemplate: { title: "Temperature", content: "Value: {Temperature}" },
      renderer: {
        type: "simple",
        symbol: { type: "polygon-3d", symbolLayers: [{ type: "extrude", material: { color: "white" } }] },
        visualVariables: [
          { type: "color", field: "Temperature",
            stops: [{ value: 265, color: "#4575b4" }, { value: 277, color: "#ffffbf" }, { value: 289, color: "#d73027" }] },
          { type: "opacity", field: "Temperature", stops: [{ value: 265, opacity: 1 }, { value: 289, opacity: 1 }] },
          { type: "size", field: "Temperature", valueUnit: "meters",
            stops: [{ value: 265, size: 0 }, { value: 289, size: 200000 }] }
        ]
      },
      elevationInfo: { mode: "relative-to-ground", offset: 0 }
    });

    map.add(euVoxelsLayer);

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
    const legend = new Legend({ view, layerInfos: [{ layer: euVoxelsLayer, title: "Voxels" }] });
    view.ui.add(new Expand({ view, content: legend, expandIconClass: "esri-icon-legend" }), "bottom-left");

    // UI
    const startColorPicker = document.getElementById("startColorPicker");
    const middleColorPicker = document.getElementById("middleColorPicker");
    const endColorPicker = document.getElementById("endColorPicker");
    const transparencyInput = document.getElementById("transparencyInput");
    const colorRampPreview = document.getElementById("colorRampPreview");
    const minZOffsetInput = document.getElementById("minZOffsetInput");
    const maxZOffsetInput = document.getElementById("maxZOffsetInput");
    const heightAboveGroundInput = document.getElementById("heightAboveGroundInput");

    // Help
    const helpButton = document.getElementById("helpButton");
    const helpOverlay = document.getElementById("helpModalOverlay");
    const helpModal = document.getElementById("helpModal");
    const closeHelpModalBtn = document.getElementById("closeHelpModal");

    // Helpers
    const TEMP_MIN = 265, TEMP_MID = 277, TEMP_MAX = 289;
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
      // color
      let colorVV = r.visualVariables.find(v => v.type === "color");
      if (!colorVV) { colorVV = { type: "color", field: "Temperature", stops: [] }; r.visualVariables.push(colorVV); }
      colorVV.field = "Temperature";
      colorVV.stops = [
        { value: TEMP_MIN, color: startColorPicker?.value || "#4575b4" },
        { value: TEMP_MID, color: middleColorPicker?.value || "#ffffbf" },
        { value: TEMP_MAX, color: endColorPicker?.value || "#d73027" }
      ];
      // extruze
      let sizeVV = r.visualVariables.find(v => v.type === "size");
      if (!sizeVV) { sizeVV = { type: "size", field: "Temperature", valueUnit: "meters", stops: [] }; r.visualVariables.push(sizeVV); }
      const minH = Number(minZOffsetInput?.value) || 0;
      const maxH = Number(maxZOffsetInput?.value) || 200000;
      sizeVV.field = "Temperature";
      sizeVV.valueUnit = "meters";
      sizeVV.stops = [{ value: TEMP_MIN, size: minH }, { value: TEMP_MAX, size: maxH }];
      return r;
    }

    function applyAll() {
      if (booting) return;
      euVoxelsLayer.renderer = buildRenderer(euVoxelsLayer.renderer);
      const op = Number(transparencyInput?.value);
      euVoxelsLayer.opacity = Number.isFinite(op) ? op : 1;
      const offset = Number(heightAboveGroundInput?.value);
      euVoxelsLayer.elevationInfo = { mode: "relative-to-ground", offset: Number.isFinite(offset) ? offset : 0 };
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
    minZOffsetInput?.addEventListener("input", applyWithPreviewDebounced);
    maxZOffsetInput?.addEventListener("input", applyWithPreviewDebounced);
    heightAboveGroundInput?.addEventListener("input", applyWithPreviewDebounced);

    // Boot
    view.when(async () => {
      await view.whenLayerView(euVoxelsLayer).catch(() => {});
      try {
        await view.goTo({ position: { latitude: 48, longitude: 15, z: 6000000 }, tilt: 0, heading: -1 }, { duration: 5000 });
      } catch (e) {}
      booting = false;
      applyAll();
    });
  });
});
