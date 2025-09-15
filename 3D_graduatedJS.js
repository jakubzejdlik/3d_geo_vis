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

    const euGraduatedSymbolsLayer = new FeatureLayer({
      url: "https://services1.arcgis.com/AGrMjSBR7fxJYLfU/arcgis/rest/services/EU_3D_graduated/FeatureServer/0",
      outFields: ["*"],
      visible: true,
      title: "3D Graduated Symbols",
      popupTemplate: {
        title: "{NAME}",
        content: "Temperature: {Temperature}<br>"
      },
        queryFormat: "json",
        labelingInfo: [{
          labelExpressionInfo: {
            expression: "$feature.NAME"
          },
          symbol: {
            type: "label-3d", 
            symbolLayers: [{
              type: "text",
              material: { color: "#646464" },
              size: 10, // Velikost písma
              halo: { // Ohranièení textu pro lepší èitelnost
                color: "white",
                size: 1
              },
              font: {
                weight: "bold" // Tuèné písmo
              }
            }]
          }
        }],
      renderer: {
        type: "simple",
        symbol: {
          type: "point-3d",
          symbolLayers: [{
            type: "object",
            resource: { primitive: "cylinder" },
            material: { color: "white" },
            width: 80000
          }]
        },
        visualVariables: [
          {
            type: "color",
            field: "Temperature",
            stops: [
              { value: 269, color: "#4575b4" },
              { value: 277, color: "#ffffbf" },
              { value: 286, color: "#d73027" }
            ]
          },
          {
            type: "opacity",
            field: "Temperature",
            stops: [
              { value: 269, opacity: 1 },
              { value: 288, opacity: 1 }
            ]
          },
          {
            type: "size", 
            field: "Temperature",
            axis: "height",
            stops: [
              { value: 269, size: 0 },
              { value: 286, size: 500000 }
            ]
          },
          {
            type: "size",
            axis: "width-and-depth",
            useSymbolValue: true,
          },
        ]
      },
      elevationInfo: {
        mode: "relative-to-ground",
        offset: 0
      }
    });

    map.addMany([euGraduatedSymbolsLayer]);

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

    const symbologyEditorPanel = document.getElementById("symbologyEditorPanel");
    const startColorPicker = document.getElementById("startColorPicker");
    const middleColorPicker = document.getElementById("middleColorPicker");
    const endColorPicker = document.getElementById("endColorPicker");
    const transparencyInput = document.getElementById("transparencyInput");
    const minZOffsetInput = document.getElementById("minZOffsetInput");
    const maxZOffsetInput = document.getElementById("maxZOffsetInput"); 
    const applySymbologyButton = document.getElementById("applySymbologyButton");
    const colorRampPreview = document.getElementById("colorRampPreview");
    const symbologyNotSupportedMessage = document.getElementById("symbologyNotSupportedMessage");
    const heightAboveGroundInput = document.getElementById("heightAboveGroundInput");
    
    // NOVÉ REFERENCE NA DOM ELEMENTY
    const diameterInput = document.getElementById("diameterInput");
    const shapeSelect = document.getElementById("shapeSelect");

    let activeLayerForSymbology = euGraduatedSymbolsLayer;
    let currentRenderer;

    function rgbaToHex(rgba) {
      if (rgba && typeof rgba.toHex === 'function') {
        return rgba.toHex();
      }
      const parts = String(rgba).match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+\.?\d*))?\)$/);
      if (!parts) return "#000000";

      const r = parseInt(parts[1]).toString(16).padStart(2, '0');
      const g = parseInt(parts[2]).toString(16).padStart(2, '0');
      const b = parseInt(parts[3]).toString(16).padStart(2, '0');
      return `#${r}${g}${b}`;
    }

    function updateColorRampPreview(stops) {
      if (!colorRampPreview) return;
      let gradientCss = "linear-gradient(to right, ";
      stops.forEach((stop, index) => {
        const colorValue = typeof stop.color === 'object' && stop.color.toHex ? stop.color.toHex() : stop.color;
        gradientCss += colorValue;
        if (index < stops.length - 1) {
          gradientCss += ", ";
        }
      });
      gradientCss += ")";
      colorRampPreview.style.background = gradientCss;
    }

    function updateColorRamp() {
      updateColorRampPreview([
        { value: 269, color: startColorPicker ? startColorPicker.value : "#4575b4" },
        { value: 277, color: middleColorPicker ? middleColorPicker.value : "#ffffbf" },
        { value: 286, color: endColorPicker ? endColorPicker.value : "#d73027" }
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

    function applyCurrentSymbology() {
      if (!activeLayerForSymbology) return;

      currentRenderer = activeLayerForSymbology.renderer.clone();

      let fieldName = "Temperature";
      let minDataValue = 269;
      let maxDataValue = 286;

      const currentColourVV = currentRenderer.visualVariables.find(vv => vv.type === "color");
      if (currentColourVV && currentColourVV.field) {
        fieldName = currentColourVV.field;
        if (currentColourVV.stops && currentColourVV.stops.length > 0) {
          if (currentColourVV.field === "Temperature") {
            minDataValue = currentColourVV.stops[0].value;
            maxDataValue = currentColourVV.stops[currentColourVV.stops.length - 1].value;
          }
        }
      }

      const defaultMiddleValue = (minDataValue + maxDataValue) / 2;

      const newColorRampStops = [
        { color: new Color(startColorPicker ? startColorPicker.value : "#4575b4"), value: minDataValue },
        { color: new Color(middleColorPicker ? middleColorPicker.value : "#ffffbf"), value: defaultMiddleValue },
        { color: new Color(endColorPicker ? endColorPicker.value : "#d73027"), value: maxDataValue }
      ];
      let colorVV = currentRenderer.visualVariables.find(vv => vv.type === "color");
      if (colorVV) {
        colorVV.field = fieldName;
        colorVV.stops = newColorRampStops;
      } else {
        currentRenderer.visualVariables.push({
          type: "color",
          field: fieldName,
          stops: newColorRampStops
        });
      }
      updateColorRampPreview(newColorRampStops);

      const newOpacity = transparencyInput ? parseFloat(transparencyInput.value) : 1;
      let opacityVV = currentRenderer.visualVariables.find(vv => vv.type === "opacity");
      if (opacityVV) {
        opacityVV.field = fieldName;
        opacityVV.stops = [
          { value: minDataValue, opacity: newOpacity },
          { value: maxDataValue, opacity: newOpacity }
        ];
      } else {
        currentRenderer.visualVariables.push({
          type: "opacity",
          field: fieldName,
          stops: [
            { value: minDataValue, opacity: newOpacity },
            { value: maxDataValue, opacity: newOpacity }
          ]
        });
      }

      const minColumnHeight = minZOffsetInput ? parseFloat(minZOffsetInput.value) : 0;
      const maxColumnHeight = maxZOffsetInput ? parseFloat(maxZOffsetInput.value) : 500000;
      let sizeVV = currentRenderer.visualVariables.find(vv => vv.type === "size" && vv.axis === "height");
      if (sizeVV) {
        sizeVV.field = fieldName;
        sizeVV.stops = [
          { value: minDataValue, size: minColumnHeight },
          { value: maxDataValue, size: maxColumnHeight }
        ];
      } else {
        currentRenderer.visualVariables.push({
          type: "size",
          axis: "height",
          field: fieldName,
          stops: [
            { value: minDataValue, size: minColumnHeight },
            { value: maxDataValue, size: maxColumnHeight }
          ]
        });
      }

      let objectSymbolLayer = currentRenderer.symbol.symbolLayers.find(sl => sl.type === "object");
      if (!objectSymbolLayer) {
        objectSymbolLayer = { type: "object", material: { color: "white" } };
        currentRenderer.symbol.symbolLayers.push(objectSymbolLayer);
      }

      const newShape = shapeSelect ? shapeSelect.value : "cylinder";
      objectSymbolLayer.resource = { primitive: newShape };

      const newDiameter = diameterInput ? parseFloat(diameterInput.value) : 80000;
      objectSymbolLayer.width = newDiameter;
      objectSymbolLayer.depth = newDiameter;

      // Zajištìní, že width a depth zùstanou pevné (øešení od uživatele)
      let fixedWidthDepthVV = currentRenderer.visualVariables.find(vv => vv.type === "size" && vv.axis === "width-and-depth" && vv.useSymbolValue === true);
      if (!fixedWidthDepthVV) {
          currentRenderer.visualVariables.push({
              type: "size",
              axis: "width-and-depth",
              useSymbolValue: true,
              field: fieldName 
          });
      }

      const heightAboveGround = heightAboveGroundInput ? parseFloat(heightAboveGroundInput.value) : 0;

      activeLayerForSymbology.elevationInfo = {
        mode: "relative-to-ground",
        offset: heightAboveGround 
      };

      activeLayerForSymbology.renderer = currentRenderer;
    }

    if (applySymbologyButton) {
      applySymbologyButton.addEventListener("click", applyCurrentSymbology);
    }

    view.when().then(function() {
      return Promise.all([
        euGraduatedSymbolsLayer.load()
      ]).then(function() {
        initializeSymbologyPanel(activeLayerForSymbology);
        applyCurrentSymbology();

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
            console.error("Animation Error: ", error);
          }
        });
      });
    });

    const legend = new Legend({
      view: view
    });

    const legendExpand = new Expand({
      view: view,
      content: legend,
      expandIconClass: "esri-icon-legend",
      expanded: false,
      group: "bottom-left"
    });

    view.ui.add(legendExpand, "bottom-left");

    function initializeSymbologyPanel(layer) {
      currentRenderer = layer.renderer ? layer.renderer.clone() : null;

      if (!currentRenderer || !currentRenderer.visualVariables) {
        if (symbologyNotSupportedMessage) symbologyNotSupportedMessage.style.display = "block";
        if (symbologyEditorPanel) symbologyEditorPanel.style.display = "none";
        return;
      } else {
        if (symbologyNotSupportedMessage) symbologyNotSupportedMessage.style.display = "none";
        if (symbologyEditorPanel) symbologyEditorPanel.style.display = "block";
      }

      const colorVV = currentRenderer.visualVariables.find(vv => vv.type === "color");
      if (colorVV && colorVV.stops.length === 3) {
        if (startColorPicker) startColorPicker.value = rgbaToHex(colorVV.stops[0].color);
        if (middleColorPicker) middleColorPicker.value = rgbaToHex(colorVV.stops[1].color);
        if (endColorPicker) endColorPicker.value = rgbaToHex(colorVV.stops[2].color);
        updateColorRampPreview(colorVV.stops);
      } else {
        if (startColorPicker) startColorPicker.value = "#4575b4";
        if (middleColorPicker) middleColorPicker.value = "#ffffbf";
        if (endColorPicker) endColorPicker.value = "#d73027";
        updateColorRampPreview([
          { value: 269, color: "#4575b4" },
          { value: 277, color: "#ffffbf" },
          { value: 286, color: "#d73027" }
        ]);
      }

      const opacityVV = currentRenderer.visualVariables.find(vv => vv.type === "opacity");
      if (opacityVV && opacityVV.stops.length > 0) {
        if (transparencyInput) transparencyInput.value = opacityVV.stops[0].opacity;
      } else {
        if (transparencyInput) transparencyInput.value = 1;
      }

      const sizeVV = currentRenderer.visualVariables.find(vv => vv.type === "size" && vv.axis === "height"); // Specifikujeme axis: "height"
      if (sizeVV && sizeVV.stops.length > 0) {
        if (minZOffsetInput) minZOffsetInput.value = sizeVV.stops[0].size;
        if (maxZOffsetInput) maxZOffsetInput.value = sizeVV.stops[sizeVV.stops.length - 1].size;
      } else {
        if (minZOffsetInput) minZOffsetInput.value = 0;
        if (maxZOffsetInput) maxZOffsetInput.value = 500000;
      }

      const objectSymbolLayer = currentRenderer.symbol.symbolLayers.find(sl => sl.type === "object");
      if (objectSymbolLayer) {
        if (diameterInput && typeof objectSymbolLayer.width === 'number') {
          diameterInput.value = objectSymbolLayer.width;
        } else if (diameterInput) {
          diameterInput.value = 80000; 
        }

        if (shapeSelect && objectSymbolLayer.resource && objectSymbolLayer.resource.primitive) {
          shapeSelect.value = objectSymbolLayer.resource.primitive;
        } else if (shapeSelect) {
          shapeSelect.value = "cylinder"; 
        }
      }


      if (heightAboveGroundInput && layer.elevationInfo && typeof layer.elevationInfo.offset === 'number') {
        heightAboveGroundInput.value = layer.elevationInfo.offset;
      } else if (heightAboveGroundInput) {
        heightAboveGroundInput.value = 0; 
      }
    }

    const helpButton = document.getElementById("helpButton");
    const helpModalOverlay = document.getElementById("helpModalOverlay");
    const closeHelpModalButton = document.getElementById("closeHelpModal");

    if (helpButton) {
      helpButton.addEventListener("click", function() {
        if (helpModalOverlay) helpModalOverlay.style.display = "flex";
      });
    }

    if (closeHelpModalButton) {
      closeHelpModalButton.addEventListener("click", function() {
        if (helpModalOverlay) helpModalOverlay.style.display = "none";
      });
    }

    if (helpModalOverlay) {
      helpModalOverlay.addEventListener("click", function(event) {
        if (event.target === helpModalOverlay) {
          helpModalOverlay.style.display = "none";
        }
      });
    }
  });
});
