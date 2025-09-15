document.addEventListener("DOMContentLoaded", function() {
  require([
    "esri/Map",
    "esri/views/SceneView",
    "esri/layers/FeatureLayer",
    "esri/widgets/Home",
    "esri/widgets/BasemapGallery",
    "esri/widgets/Expand",
    "esri/widgets/Legend",
    "esri/Color"
  ], function(Map, SceneView, FeatureLayer, Home, BasemapGallery, Expand, Legend, Color) {

    const map = new Map({
      basemap: "topo-vector",
      ground: "world-elevation"
    });

    const euVoxelsLayer = new FeatureLayer({
        url: "https://services1.arcgis.com/AGrMjSBR7fxJYLfU/arcgis/rest/services/EU_voxels/FeatureServer/1",
        outFields: ["*"],
        visible: true,
        title: "EU Voxels",
        popupTemplate: {
            title: "Temperature",
            content: "Value: {Temperature}"
        },
        queryFormat: "json",
        renderer: {
            type: "simple",
            symbol: {
                type: "polygon-3d",
                symbolLayers: [{
                    type: "extrude",
                    material: { color: "white" }
                }]
            },
            visualVariables: [
                {
                    type: "color",
                    field: "Temperature",
                    stops: [
                        { value: 265, color: "#4575b4" },
                        { value: 277, color: "#ffffbf" },
                        { value: 289, color: "#d73027" }
                    ]
                },
                {
                    type: "opacity",
                    field: "Temperature",
                    stops: [
                        { value: 265, opacity: 1 },
                        { value: 289, opacity: 1 }
                    ]
                },
                {
                    type: "size",
                    field: "Temperature",
                    valueUnit: "meters",
                    stops: [
                        { value: 265, size: 0 },
                        { value: 289, size: 200000 }
                    ]
                }
            ]
        },
        elevationInfo: {
          mode: "relative-to-ground", 
          offset: 0 
        }
    });

    map.add(euVoxelsLayer);

    const view = new SceneView({
    container: "viewDiv",
    map: map,
    camera: {
      position: {
        latitude: 48,       
        longitude: 15,      
        z: 15000000        
      },
      tilt: 0,
      heading: -1
    },
    constraints: {
      rotationEnabled: true
    }
    });
    
    view.when(function() {
    
    const initialCamera = view.camera.clone(); 
      
    view.goTo({
      position: {
          latitude: initialCamera.position.latitude,
          longitude: initialCamera.position.longitude,
          z: 6000000 
        },
        tilt: initialCamera.tilt,
        heading: initialCamera.heading
    }, {
      duration: 5000
    }).catch(function(error) {
      if (error.name != "AbortError") {
        console.error("Chyba pøi animaci pohledu: ", error);
      }
    });
  });

    const homeWidget = new Home({
      view: view
    });
    view.ui.add(homeWidget, "top-left");

    const basemapGallery = new BasemapGallery({
      view: view,
      container: document.createElement("div")
    });

    const bgExpand = new Expand({
      view: view,
      content: basemapGallery.container,
      expandIconClass: "esri-icon-basemap",
      group: "top-left"
    });
    view.ui.add(bgExpand, "top-left");

    const legend = new Legend({
      view: view,
      layerInfos: [{
        layer: euVoxelsLayer,
        title: "Voxels"
      }]
    });

    const legendExpand = new Expand({
      view: view,
      content: legend,
      expandIconClass: "esri-icon-legend",
      group: "bottom-left"
    });
    view.ui.add(legendExpand, "bottom-left");

    const sidebar = document.getElementById("sidebar");
    const toggleSidebarButton = document.getElementById("toggleSidebar");
    if (toggleSidebarButton) {
      toggleSidebarButton.addEventListener("click", function() {
        sidebar.classList.toggle("collapsed");
        if (sidebar.classList.contains("collapsed")) {
          view.padding = { right: 0 };
        } else {
          view.padding = { right: 280 };
        }
      });
    }

    const minColorPicker = document.getElementById("startColorPicker");
    const middleColorPicker = document.getElementById("middleColorPicker");
    const endColorPicker = document.getElementById("endColorPicker");
    const transparencyInput = document.getElementById("transparencyInput");
    const applySymbologyButton = document.getElementById("applySymbologyButton");
    const colorRampPreview = document.getElementById("colorRampPreview");
    const minZOffsetInput = document.getElementById("minZOffsetInput");
    const maxZOffsetInput = document.getElementById("maxZOffsetInput");
    const heightAboveGroundInput = document.getElementById("heightAboveGroundInput");


    function updateColorRampPreview(stops) {
      if (!colorRampPreview || !Array.isArray(stops) || stops.length === 0) {
        return;
      }

      const colors = stops.map(stop => {
        return stop.color.toHex ? stop.color.toHex() : stop.color;
      });

      const gradient = `linear-gradient(to right, ${colors.join(", ")})`;
      colorRampPreview.style.background = gradient;
    }
    
    
    function updateColorRamp() {
      updateColorRampPreview([
        { value: 265, color: startColorPicker.value },
        { value: 277, color: middleColorPicker.value },
        { value: 289, color: endColorPicker.value }
      ]);
    }

    if (startColorPicker) {
      startColorPicker.addEventListener("input", updateColorRamp);
    }

    if (middleColorPicker) {
      middleColorPicker.addEventListener("input", updateColorRamp);
    }

    if (endColorPicker) {
      endColorPicker.addEventListener("input", updateColorRamp);
    }

    if (applySymbologyButton) {
      applySymbologyButton.addEventListener("click", applyCurrentSymbology);
    }

    function applyCurrentSymbology() {
      const renderer = euVoxelsLayer.renderer.clone();

      const startColor = minColorPicker.value;
      const middleColor = middleColorPicker.value;
      const endColor = endColorPicker.value;
      const opacity = parseFloat(transparencyInput.value);
      
      const minHeight = parseFloat(minZOffsetInput.value);
      const maxHeight = parseFloat(maxZOffsetInput.value);

      const colorVV = renderer.visualVariables.find(vv => vv.type === "color");
      if (colorVV) {
        colorVV.stops[0].color = startColor;
        colorVV.stops[1].color = middleColor;
        colorVV.stops[2].color = endColor;
      }

      const opacityVV = renderer.visualVariables.find(vv => vv.type === "opacity");
      if (opacityVV) {
        opacityVV.stops.forEach(stop => stop.opacity = opacity);
      }

      const sizeVV = renderer.visualVariables.find(vv => vv.type === "size");
      if (sizeVV) {
        sizeVV.stops[0].size = minHeight;
        sizeVV.stops[sizeVV.stops.length - 1].size = maxHeight;
      }
      
      const heightAboveGround = parseFloat(heightAboveGroundInput.value);
      
      const newElevationInfo = {
        mode: "relative-to-ground",
        offset: heightAboveGround
      };

      euVoxelsLayer.renderer = renderer;
      euVoxelsLayer.elevationInfo = newElevationInfo;

      updateColorRampPreview(colorVV.stops);
    }

    function initializeSymbologyControls() {
      const currentRenderer = euVoxelsLayer.renderer;
      if (!currentRenderer) return;

      const colorVV = currentRenderer.visualVariables.find(vv => vv.type === "color");
      if (colorVV && colorVV.stops.length >= 3) {
        minColorPicker.value = colorVV.stops[0].color.toHex();
        middleColorPicker.value = colorVV.stops[1].color.toHex();
        endColorPicker.value = colorVV.stops[2].color.toHex();
        updateColorRampPreview([
          { value: colorVV.stops[0].value, color: colorVV.stops[0].color },
          { value: colorVV.stops[1].value, color: colorVV.stops[1].color },
          { value: colorVV.stops[2].value, color: colorVV.stops[2].color }
        ]);
      } else {
        minTemperatureInput.value = 265;
        middleTemperatureInput.value = 277;
        maxTemperatureInput.value = 289;
        minColorPicker.value = "#4575b4";
        middleColorPicker.value = "#ffffbf";
        endColorPicker.value = "#d73027";
        updateColorRampPreview([
          { value: 265, color: "#4575b4" },
          { value: 277, color: "#ffffbf" },
          { value: 289, color: "#d73027" }
        ]);
      }

      const opacityVV = currentRenderer.visualVariables.find(vv => vv.type === "opacity");
      if (opacityVV && opacityVV.stops.length > 0) {
        transparencyInput.value = opacityVV.stops[0].opacity;
      } else {
        transparencyInput.value = 1;
      }

      minZOffsetInput.value = 0;
      maxZOffsetInput.value = 200000;
    }

    const helpButton = document.getElementById("helpButton");
    const helpModalOverlay = document.getElementById("helpModalOverlay");
    const closeHelpModalButton = document.getElementById("closeHelpModal");

    if (helpButton) {
      helpButton.addEventListener("click", function() {
        helpModalOverlay.style.display = "flex";
      });
    }

    if (closeHelpModalButton) {
      closeHelpModalButton.addEventListener("click", function() {
        helpModalOverlay.style.display = "none";
      });
    }

    if (helpModalOverlay) {
      helpModalOverlay.addEventListener("click", function(event) {
        if (event.target === helpModalOverlay) {
          helpModalOverlay.style.display = "none";
        }
      });
    }

    euVoxelsLayer.when(function() {
      initializeSymbologyControls();
    });

  });
});
