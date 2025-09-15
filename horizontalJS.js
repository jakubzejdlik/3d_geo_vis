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

  const symbologyEditorPanel = document.getElementById("symbologyEditorPanel");
  const startColorPicker = document.getElementById("startColorPicker");
  const middleColorPicker = document.getElementById("middleColorPicker");
  const endColorPicker = document.getElementById("endColorPicker");
  const transparencyInput = document.getElementById("transparencyInput");
  const planeHeightInput = document.getElementById("planeHeightInput");
  const applySymbologyButton = document.getElementById("applySymbologyButton");
  const colorRampPreview = document.getElementById("colorRampPreview");
  const symbologyNotSupportedMessage = document.getElementById("symbologyNotSupportedMessage");

  const map = new Map({
    basemap: "topo-vector",
    ground: "world-elevation"
  });

  const euHorizontalLayer = new FeatureLayer({
    url: "https://services1.arcgis.com/AGrMjSBR7fxJYLfU/arcgis/rest/services/EU_horizontal/FeatureServer/0",
    outFields: ["*"],
    visible: true,
    title: "EU Horizontal Planes",
    popupTemplate: {
      title: "Temperature",
      content: "Value: {Temperature}"
    },
      queryFormat: "json",
      elevationInfo: {
          mode: "relative-to-ground", 
          offset: 300000
      },
    renderer: {
      type: "simple",
      symbol: {
        type: "polygon-3d",
        symbolLayers: [{
          type: "fill", 
            material: { color: "white" }
        }]
      },
      visualVariables: [
        {
          type: "color",
          field: "Temperature",
          stops: [
            { value: 266, color: "#4575b4" },
            { value: 277, color: "#ffffbf" },
            { value: 286, color: "#d73027" }
          ]
        },
        {
          type: "opacity",
          field: "Temperature",
          stops: [
            { value: 266, opacity: 1 },
            { value: 286, opacity: 1 }
          ]
        }
      ]
    }
  });

  map.addMany([euHorizontalLayer]);

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
  
  const homeWidget = new Home({
    view: view
  });
  view.ui.add(homeWidget, "top-left");

  const basemapGallery = new BasemapGallery({
    view: view
  });

  const basemapGalleryExpand = new Expand({
    view: view,
    content: basemapGallery,
    expandIconClass: "esri-icon-basemap"
  });
  view.ui.add(basemapGalleryExpand, "top-left");

  let activeLayerForSymbology = euHorizontalLayer; 
  let currentRenderer; 

  function rgbaToHex(rgba) {
    if (rgba && typeof rgba.toHex === 'function') {
        return rgba.toHex();
    }
    const parts = rgba.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+\.?\d*))?\)$/);
    if (!parts) return "#000000"; 

    const r = parseInt(parts[1]).toString(16).padStart(2, '0');
    const g = parseInt(parts[2]).toString(16).padStart(2, '0');
    const b = parseInt(parts[3]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }

  function updateColorRampPreview(stops) {
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
      { value: 266, color: startColorPicker.value },
      { value: 277, color: middleColorPicker.value },
      { value: 286, color: endColorPicker.value }
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
    let minDataValue = 266; 
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
        { color: startColorPicker.value, value: minDataValue },
        { color: middleColorPicker.value, value: defaultMiddleValue },
        { color: endColorPicker.value, value: maxDataValue }
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

    const newOpacity = parseFloat(transparencyInput.value);
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

    const newPlaneHeight = parseFloat(planeHeightInput.value);
    activeLayerForSymbology.elevationInfo = {
        mode: "relative-to-ground", 
        offset: newPlaneHeight 
    };

    activeLayerForSymbology.renderer = currentRenderer;
  }

  applySymbologyButton.addEventListener("click", applyCurrentSymbology);

  view.when().then(function() {
    return Promise.all([ 
      euHorizontalLayer.load()
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
      symbologyNotSupportedMessage.style.display = "block";
      symbologyEditorPanel.style.display = "none";
      return;
    } else {
      symbologyNotSupportedMessage.style.display = "none";
      symbologyEditorPanel.style.display = "block";
    }

    const colorVV = currentRenderer.visualVariables.find(vv => vv.type === "color");
    if (colorVV && colorVV.stops.length === 3) {
      startColorPicker.value = rgbaToHex(colorVV.stops[0].color);
      middleColorPicker.value = rgbaToHex(colorVV.stops[1].color);
      endColorPicker.value = rgbaToHex(colorVV.stops[2].color);
      updateColorRampPreview(colorVV.stops);
    } else {
      startColorPicker.value = "#4575b4";
      middleColorPicker.value = "#ffffbf";
      endColorPicker.value = "#d73027";
      updateColorRampPreview([
        { value: 266, color: "#4575b4" },
        { value: 277, color: "#ffffbf" },
        { value: 286, color: "#d73027" }
      ]);
    }

    const opacityVV = currentRenderer.visualVariables.find(vv => vv.type === "opacity");
    if (opacityVV && opacityVV.stops.length > 0) {
      transparencyInput.value = opacityVV.stops[0].opacity;
    } else {
      transparencyInput.value = 1; 
    }
    
    if (layer.elevationInfo && typeof layer.elevationInfo.offset === 'number') {
          planeHeightInput.value = layer.elevationInfo.offset;
      } else {
          planeHeightInput.value = 300000; 
      }
  }

  const helpButton = document.getElementById("helpButton");
  const helpModalOverlay = document.getElementById("helpModalOverlay");
  const closeHelpModalButton = document.getElementById("closeHelpModal");

  helpButton.addEventListener("click", function() {
    helpModalOverlay.style.display = "flex";
  });

  closeHelpModalButton.addEventListener("click", function() {
    helpModalOverlay.style.display = "none";
  });

  helpModalOverlay.addEventListener("click", function(event) {
    if (event.target === helpModalOverlay) {
      helpModalOverlay.style.display = "none";
    }
  });

});
