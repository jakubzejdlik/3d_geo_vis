document.addEventListener("DOMContentLoaded", function() {
  require([
    "esri/Map",
    "esri/views/SceneView",
    "esri/layers/FeatureLayer",
    "esri/widgets/Home",
    "esri/widgets/BasemapGallery",
    "esri/widgets/Expand",
    "esri/widgets/Legend",
    "esri/symbols/ObjectSymbol3DLayer",
    "esri/symbols/PointSymbol3D"
  ], function(Map, SceneView, FeatureLayer, Home, BasemapGallery, Expand, Legend, ObjectSymbol3DLayer, PointSymbol3D) {

    const map = new Map({ basemap: "topo-vector", ground: "world-elevation" });

    const euGraduatedSymbolsLayer = new FeatureLayer({
      url: "https://services1.arcgis.com/AGrMjSBR7fxJYLfU/arcgis/rest/services/EU_3D_graduated/FeatureServer/0",
      outFields: ["*"], visible: true, title: "3D Graduated Symbols",
      popupTemplate: { title: "{NAME}", content: "Temperature: {Temperature}<br>" },
      labelingInfo: [{
        labelExpressionInfo: { expression: "$feature.NAME" },
        symbol: { type: "label-3d", symbolLayers: [{ type: "text", material: { color: "#646464" }, size: 10, halo: { color: "white", size: 1 }, font: { weight: "bold" } }] }
      }],
      renderer: {
        type: "simple",
        symbol: { type: "point-3d", symbolLayers: [{ type: "object", resource: { primitive: "cylinder" }, material: { color: "white" }, width: 80000 }] },
        visualVariables: [
          { type: "color", field: "Temperature",
            stops: [{ value: 269, color: "#4575b4" }, { value: 277, color: "#ffffbf" }, { value: 286, color: "#d73027" }] },
          { type: "opacity", field: "Temperature", stops: [{ value: 269, opacity: 1 }, { value: 288, opacity: 1 }] },
          { type: "size", field: "Temperature", axis: "height", stops: [{ value: 269, size: 0 }, { value: 286, size: 500000 }] },
          { type: "size", axis: "width-and-depth", useSymbolValue: true }
        ]
      },
      elevationInfo: { mode: "relative-to-ground", offset: 0 }
    });

    map.add(euGraduatedSymbolsLayer);

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
    const legend = new Legend({ view, layerInfos: [{ layer: euGraduatedSymbolsLayer, title: "3D Graduated Symbols" }] });
    view.ui.add(new Expand({ view, content: legend, expandIconClass: "esri-icon-legend" }), "bottom-left");

    // UI
    const startColorPicker = document.getElementById("startColorPicker");
    const middleColorPicker = document.getElementById("middleColorPicker");
    const endColorPicker = document.getElementById("endColorPicker");
    const transparencyInput = document.getElementById("transparencyInput");
    const minZOffsetInput = document.getElementById("minZOffsetInput");
    const maxZOffsetInput = document.getElementById("maxZOffsetInput");
    const colorRampPreview = document.getElementById("colorRampPreview");
    const heightAboveGroundInput = document.getElementById("heightAboveGroundInput");
    const diameterInput = document.getElementById("diameterInput");
    const shapeSelect = document.getElementById("shapeSelect");

    // Help
    const helpButton = document.getElementById("helpButton");
    const helpOverlay = document.getElementById("helpModalOverlay");
    const helpModal = document.getElementById("helpModal");
    const closeHelpModalBtn = document.getElementById("closeHelpModal");

    // Helpers
    const TEMP_MIN = 269, TEMP_MID = 277, TEMP_MAX = 286;
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

    function buildPoint3DSymbol(primitive, diameter) {
      const obj = new ObjectSymbol3DLayer({
        resource: { primitive },
        material: { color: "white" },
        width: diameter,
        depth: diameter
      });
      return new PointSymbol3D({ symbolLayers: [obj] });
    }

    function buildRenderer(base) {
      const r = base.clone();
      // tvar + prùmìr
      const prim = String(shapeSelect?.value || "cylinder").toLowerCase();
      const diam = Number(diameterInput?.value) || 80000;
      r.symbol = buildPoint3DSymbol(prim, diam);

      // barvy
      let colorVV = r.visualVariables.find(v => v.type === "color");
      if (!colorVV) { colorVV = { type: "color", field: "Temperature", stops: [] }; r.visualVariables.push(colorVV); }
      colorVV.field = "Temperature";
      colorVV.stops = [
        { value: TEMP_MIN, color: startColorPicker?.value || "#4575b4" },
        { value: TEMP_MID, color: middleColorPicker?.value || "#ffffbf" },
        { value: TEMP_MAX, color: endColorPicker?.value || "#d73027" }
      ];

      // výška
      let sizeH = r.visualVariables.find(v => v.type === "size" && v.axis === "height");
      if (!sizeH) { sizeH = { type: "size", axis: "height", field: "Temperature", stops: [] }; r.visualVariables.push(sizeH); }
      const minH = Number(minZOffsetInput?.value) || 0;
      const maxH = Number(maxZOffsetInput?.value) || 500000;
      sizeH.field = "Temperature";
      sizeH.stops = [{ value: TEMP_MIN, size: minH }, { value: TEMP_MAX, size: maxH }];

      return r;
    }

    function applyAll() {
      if (booting) return;
      euGraduatedSymbolsLayer.renderer = buildRenderer(euGraduatedSymbolsLayer.renderer);
      const op = Number(transparencyInput?.value);
      euGraduatedSymbolsLayer.opacity = Number.isFinite(op) ? op : 1;
      const offset = Number(heightAboveGroundInput?.value);
      euGraduatedSymbolsLayer.elevationInfo = { mode: "relative-to-ground", offset: Number.isFinite(offset) ? offset : 0 };
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
    diameterInput?.addEventListener("input", applyWithPreviewDebounced);
    shapeSelect?.addEventListener("input", applyWithPreviewDebounced);
    shapeSelect?.addEventListener("change", applyWithPreviewDebounced);

    // Boot
    view.when(async () => {
      await view.whenLayerView(euGraduatedSymbolsLayer).catch(() => {});
      try {
        await view.goTo({ position: { latitude: 48, longitude: 15, z: 6000000 }, tilt: 0, heading: -1 }, { duration: 5000 });
      } catch (e) {}
      booting = false;
      applyAll();
    });
  });
});
