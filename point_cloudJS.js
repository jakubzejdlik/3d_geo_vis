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
  ], function (Map, SceneView, FeatureLayer, Home, BasemapGallery, Expand, Legend, ObjectSymbol3DLayer, PointSymbol3D) {

    // Map & Layer
    const map = new Map({ basemap: "topo-vector", ground: "world-elevation" });

    const euPointCloudLayer = new FeatureLayer({
      url: "https://services1.arcgis.com/AGrMjSBR7fxJYLfU/arcgis/rest/services/EU_point_cloud_irregular2/FeatureServer",
      outFields: ["*"], visible: true, title: "Point Cloud",
      popupTemplate: { title: "Temperature", content: "Value: {Temperature}", },
      renderer: {
        type: "simple",
        symbol: { type: "point-3d", symbolLayers: [{ type: "object", resource: { primitive: "sphere" }, material: { color: "white" }, height: 5, width: 5, depth: 5 }] },
        visualVariables: [
          { type: "color", field: "Temperature",
            stops: [{ value: 265, color: "#4575b4" }, { value: 277, color: "#ffffbf" }, { value: 289, color: "#d73027" }] },
          { type: "opacity", field: "Temperature",
            stops: [{ value: 265, opacity: 1 }, { value: 289, opacity: 1 }],
          },
          { type: "size", field: "Temperature", valueUnit: "meters", stops: [ { value: 265, size: 40000 }, { value: 289, size: 40000 }, ],
          },
        ],
      },
      elevationInfo: {
        mode: "relative-to-ground",
      },
    });

    map.add(euPointCloudLayer);

    // View
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
    const legend = new Legend({ view, layerInfos: [{ layer: euPointCloudLayer, title: "Point Cloud" }] });
    view.ui.add(new Expand({ view, content: legend, expandIconClass: "esri-icon-legend" }), "bottom-left");

    // Symbology
    const startColorPicker = document.getElementById("startColorPicker");
    const middleColorPicker = document.getElementById("middleColorPicker");
    const endColorPicker = document.getElementById("endColorPicker");
    const transparencyInput = document.getElementById("transparencyInput");
    const sizeInput = document.getElementById("sizeInput");
    const minZOffsetInput = document.getElementById("minZOffsetInput");
    const maxZOffsetInput = document.getElementById("maxZOffsetInput");
    const colorRampPreview = document.getElementById("colorRampPreview");
    const shapeSelect = document.getElementById("shapeSelect");

    // Help
    const helpButton = document.getElementById("helpButton");
    const helpOverlay = document.getElementById("helpModalOverlay");
    const helpModal = document.getElementById("helpModal");
    const closeHelpModalBtn = document.getElementById("closeHelpModal");

    const activeLayerForSymbology = euPointCloudLayer;

    // Helpers / Renderers / Apply
    const TEMP_MIN = 265;
    const TEMP_MID = 277;
    const TEMP_MAX = 289;

    let booting = true;

    function updateColorRampPreview(stops) {
      if (!colorRampPreview || !Array.isArray(stops) || !stops.length) return;
      const colors = stops.map((s) => (s.color && s.color.toHex ? s.color.toHex() : s.color));
      colorRampPreview.style.background = `linear-gradient(to right, ${colors.join(", ")})`;
    }

    function updatePreviewFromInputs() {
      updateColorRampPreview([
        { value: TEMP_MIN, color: startColorPicker?.value || "#4575b4" },
        { value: TEMP_MID, color: middleColorPicker?.value || "#ffffbf" },
        { value: TEMP_MAX, color: endColorPicker?.value || "#d73027" },
      ]);
    }

    function debounce(fn, d = 100) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), d); }; }

    function resolvePrimitive(value) {
      const v = String(value || "").toLowerCase();
      const allowed = ["sphere", "cube", "cylinder", "cone", "tetrahedron", "diamond"];
      return allowed.includes(v) ? v : "sphere";
    }

    // Point
    function buildPoint3DSymbol(primitive) {
      const objLayer = new ObjectSymbol3DLayer({
        resource: { primitive },
        material: { color: "white" },
        height: 5,
        width: 5,
        depth: 5,
      });
      return new PointSymbol3D({
        symbolLayers: [objLayer],
      });
    }

    function buildUpdatedRendererFromUI(baseRenderer) {
      const r = baseRenderer.clone();

      const prim = resolvePrimitive(shapeSelect?.value);
      r.symbol = buildPoint3DSymbol(prim);

      let colorVV = r.visualVariables.find((vv) => vv.type === "color");
      if (!colorVV) {
        colorVV = { type: "color", field: "Temperature", stops: [] };
        r.visualVariables.push(colorVV);
      }
      colorVV.field = "Temperature";
      colorVV.stops = [
        { value: TEMP_MIN, color: startColorPicker?.value || "#4575b4" },
        { value: TEMP_MID, color: middleColorPicker?.value || "#ffffbf" },
        { value: TEMP_MAX, color: endColorPicker?.value || "#d73027" },
      ];

      let sizeVV = r.visualVariables.find((vv) => vv.type === "size");
      if (!sizeVV) {
        sizeVV = { type: "size", field: "Temperature", valueUnit: "meters", stops: [] };
        r.visualVariables.push(sizeVV);
      }
      const sz = Number(sizeInput?.value) || 40000;
      sizeVV.field = "Temperature";
      sizeVV.valueUnit = "meters";
      sizeVV.stops = [
        { value: TEMP_MIN, size: sz },
        { value: TEMP_MAX, size: sz },
      ];

      return r;
    }

    function applyAll() {
      if (!activeLayerForSymbology) return;

      const newRenderer = buildUpdatedRendererFromUI(activeLayerForSymbology.renderer);
      activeLayerForSymbology.renderer = newRenderer;

      const op = Number(transparencyInput?.value);
      activeLayerForSymbology.opacity = Number.isFinite(op) ? op : 1;

      const zMin = Number(minZOffsetInput?.value);
      const zMax = Number(maxZOffsetInput?.value);
      const z0 = Number.isFinite(zMin) ? zMin : 0;
      const z1 = Number.isFinite(zMax) ? zMax : 200000;

      const expr =
        `var t = ($feature.Temperature - ${TEMP_MIN}) / (${TEMP_MAX} - ${TEMP_MIN});` +
        `return ${z0} + t*(${z1} - ${z0});`;

      const elev = Object.assign({}, activeLayerForSymbology.elevationInfo || {});
      elev.mode = "relative-to-ground";
      elev.featureExpressionInfo = { expression: expr };
      activeLayerForSymbology.elevationInfo = elev;
    }
    
    const applyWithPreviewDebounced = debounce(() => {
      updatePreviewFromInputs();
      if (!booting) applyAll();
  }, 100);

    updatePreviewFromInputs();
    const openHelp = () => { if (!helpOverlay) return; helpOverlay.style.display = "flex"; helpOverlay.setAttribute("aria-hidden", "false"); };
    const closeHelp = () => { if (!helpOverlay) return; helpOverlay.style.display = "none"; helpOverlay.setAttribute("aria-hidden", "true"); };
    helpButton?.addEventListener("click", e => { e.preventDefault(); openHelp(); });
    closeHelpModalBtn?.addEventListener("click", e => { e.preventDefault(); closeHelp(); });
    helpOverlay?.addEventListener("click", e => { if (e.target === helpOverlay) closeHelp(); });
    window.addEventListener("keydown", e => { if (e.key === "Escape") closeHelp(); });
    helpModal?.addEventListener("click", e => e.stopPropagation());
    
    // Listeners
    startColorPicker?.addEventListener("input", () => { updatePreviewFromInputs(); applyWithPreviewDebounced(); });
    middleColorPicker?.addEventListener("input", () => { updatePreviewFromInputs(); applyWithPreviewDebounced(); });
    endColorPicker?.addEventListener("input", () => { updatePreviewFromInputs(); applyWithPreviewDebounced(); });
    transparencyInput?.addEventListener("input", applyWithPreviewDebounced);
    sizeInput?.addEventListener("input", applyWithPreviewDebounced);
    minZOffsetInput?.addEventListener("input", applyWithPreviewDebounced);
    maxZOffsetInput?.addEventListener("input", applyWithPreviewDebounced);
    shapeSelect?.addEventListener("change", applyWithPreviewDebounced);
    shapeSelect?.addEventListener("input", applyWithPreviewDebounced);

    // Zoom
    view.when(async () => {
      await view.whenLayerView(euPointCloudLayer).catch(() => {});
      try {
        await view.goTo({ position: { latitude: 48, longitude: 15, z: 6000000 }, tilt: 0, heading: -1 }, { duration: 5000 });
      } catch (e) {}
      booting = false;
      applyAll();
    });
  });
});