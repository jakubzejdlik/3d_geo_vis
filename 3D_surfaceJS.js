document.addEventListener("DOMContentLoaded", function() {
  require([
    "esri/Map",
    "esri/views/SceneView",
    "esri/Ground",
    "esri/layers/ElevationLayer",
    "esri/layers/FeatureLayer",
    "esri/widgets/Home",
    "esri/widgets/BasemapGallery",
    "esri/widgets/Expand",
    "esri/widgets/Legend"
  ], function(Map, SceneView, Ground, ElevationLayer, FeatureLayer, Home, BasemapGallery, Expand, Legend) {

    // Map & layer
    const ELEVATION_URL = "https://tiles.arcgis.com/tiles/AGrMjSBR7fxJYLfU/arcgis/rest/services/EU_3Dsurface_proj/ImageServer";
    const FEATURES_URL  = "https://services1.arcgis.com/AGrMjSBR7fxJYLfU/arcgis/rest/services/EU_horizontal/FeatureServer/0";
    const FEATURE_FIELD = "Temperature";

    const map = new Map({ basemap: "topo-vector" });
    const customElevation = new ElevationLayer({ url: ELEVATION_URL });
    map.ground = new Ground({ layers: [customElevation] }); // jen náš elevation

    const surfaceLayer = new FeatureLayer({
      url: FEATURES_URL,
      outFields: ["*"],
      visible: false,
      title: "3D Surface (Temperature)",
      popupTemplate: { title: "Temperature", content: "Value: {" + FEATURE_FIELD + "}" },
      renderer: {
        type: "simple",
        symbol: { type: "polygon-3d", symbolLayers: [{ type: "fill", material: { color: "white" } }] },
        visualVariables: [] // doplníme níže
      },
      elevationInfo: { mode: "on-the-ground" }
    });

    map.add(surfaceLayer);

    // View
    const view = new SceneView({
      container: "viewDiv",
      map,
      camera: { position: { latitude: 48, longitude: 15, z: 15000000 }, tilt: 0, heading: -1 },
      constraints: { rotationEnabled: true },
      qualityProfile: "high",
      environment: { atmosphereEnabled: true, lighting: { directShadowsEnabled: false } }
    });

    // Widgets
    view.ui.add(new Home({ view }), "top-left");
    const bg = new BasemapGallery({ view });
    view.ui.add(new Expand({ view, content: bg, expandIconClass: "esri-icon-basemap" }), "top-left");
    const legend = new Legend({ view, layerInfos: [{ layer: surfaceLayer, title: "3D Surface" }] });
    view.ui.add(new Expand({ view, content: legend, expandIconClass: "esri-icon-legend" }), "bottom-left");

    // Symbology
    const startColorPicker = document.getElementById("startColorPicker");
    const middleColorPicker = document.getElementById("middleColorPicker");
    const endColorPicker = document.getElementById("endColorPicker");
    const transparencyInput = document.getElementById("transparencyInput");
    const colorRampPreview = document.getElementById("colorRampPreview");

    // Help
    const helpButton = document.getElementById("helpButton");
    const helpOverlay = document.getElementById("helpModalOverlay");
    const helpModal = document.getElementById("helpModal");
    const closeHelpModalBtn = document.getElementById("closeHelpModal");

    // Helpers / Renderers / Apply
    let TEMP_MIN = 265, TEMP_MID = 277, TEMP_MAX = 289;
    let booting = true;

    function updateColorRampPreview(stops) {
      if (!colorRampPreview) return;
      const colors = stops.map(s => typeof s.color === "string" ? s.color : (s.color?.toHex?.() ?? s.color));
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
      const r = base.clone ? base.clone() : JSON.parse(JSON.stringify(base));
      let colorVV = r.visualVariables.find(v => v.type === "color");
      if (!colorVV) { colorVV = { type: "color", field: FEATURE_FIELD, stops: [] }; r.visualVariables.push(colorVV); }
      colorVV.field = FEATURE_FIELD;
      colorVV.stops = [
        { value: TEMP_MIN, color: startColorPicker?.value || "#4575b4" },
        { value: TEMP_MID, color: middleColorPicker?.value || "#ffffbf" },
        { value: TEMP_MAX, color: endColorPicker?.value || "#d73027" }
      ];
      r.visualVariables = r.visualVariables.filter(v => v.type !== "opacity");
      return r;
    }

    function applyAll() {
      if (booting) return;
      surfaceLayer.renderer = buildRenderer(surfaceLayer.renderer);
      const op = Number(transparencyInput?.value);
      surfaceLayer.opacity = Number.isFinite(op) ? op : 1;
    }

    const applyWithPreviewDebounced = debounce(() => {
      updatePreviewFromInputs();
      if (!booting) applyAll();
    }, 100);

    const openHelp = () => { if (!helpOverlay) return; helpOverlay.style.display = "flex"; helpOverlay.setAttribute("aria-hidden", "false"); };
    const closeHelp = () => { if (!helpOverlay) return; helpOverlay.style.display = "none"; helpOverlay.setAttribute("aria-hidden", "true"); };
    helpButton?.addEventListener("click", e => { e.preventDefault(); openHelp(); });
    closeHelpModalBtn?.addEventListener("click", e => { e.preventDefault(); closeHelp(); });
    helpOverlay?.addEventListener("click", e => { if (e.target === helpOverlay) closeHelp(); });
    window.addEventListener("keydown", e => { if (e.key === "Escape") closeHelp(); });
    helpModal?.addEventListener("click", e => e.stopPropagation());

    // Listeners
    updatePreviewFromInputs();
    startColorPicker?.addEventListener("input", () => { updatePreviewFromInputs(); applyWithPreviewDebounced(); });
    middleColorPicker?.addEventListener("input", () => { updatePreviewFromInputs(); applyWithPreviewDebounced(); });
    endColorPicker?.addEventListener("input", () => { updatePreviewFromInputs(); applyWithPreviewDebounced(); });
    transparencyInput?.addEventListener("input", applyWithPreviewDebounced);

    async function initStats() {
      await surfaceLayer.load();
      const fld = surfaceLayer.fields.find(f => f.name === FEATURE_FIELD);
      if (!fld || !["double","single","integer","small-integer"].includes(fld.type)) return;

      const q = surfaceLayer.createQuery();
      q.where = "1=1"; q.returnGeometry = false;
      q.outStatistics = [
        { statisticType: "min", onStatisticField: FEATURE_FIELD, outStatisticFieldName: "vmin" },
        { statisticType: "max", onStatisticField: FEATURE_FIELD, outStatisticFieldName: "vmax" }
      ];
      const res = await surfaceLayer.queryFeatures(q);
      const a = res.features?.[0]?.attributes || {};
      const vmin = Number(a.vmin), vmax = Number(a.vmax);
      if (Number.isFinite(vmin) && Number.isFinite(vmax) && vmin !== vmax) {
        TEMP_MIN = vmin;
        TEMP_MAX = vmax;
        TEMP_MID = vmin + (vmax - vmin) * 0.5;
      }
    }

    // Zoom
    view.when(async () => {
      await customElevation.load().catch(() => {});
      await initStats().catch(() => {});
      await view.whenLayerView(surfaceLayer).catch(() => {});
      surfaceLayer.renderer = buildRenderer(surfaceLayer.renderer);
      const op0 = Number(transparencyInput?.value);
      surfaceLayer.opacity = Number.isFinite(op0) ? op0 : 1;
      surfaceLayer.visible = true;                
      updatePreviewFromInputs();

      try {
        await view.goTo({ position: { latitude: 48, longitude: 15, z: 6000000 }, tilt: 0, heading: -1 }, { duration: 5000 });
      } catch(e) {}

      booting = false;                            
      applyAll();                            
    });
  });
});
