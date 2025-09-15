require([
  "esri/Map",
  "esri/views/SceneView",
  "esri/layers/FeatureLayer",
  "esri/widgets/Home",
  "esri/widgets/BasemapGallery",
  "esri/widgets/Expand",
  "esri/widgets/Legend" 
], function(Map, SceneView, FeatureLayer, Home, BasemapGallery, Expand, Legend) {

  const map = new Map({
    basemap: "topo-vector",
    ground: "world-elevation"
  });

  const euPointCloudLayer = new FeatureLayer({
    url: "https://services1.arcgis.com/AGrMjSBR7fxJYLfU/arcgis/rest/services/EU_point_cloud_irregular2/FeatureServer",
    outFields: ["*"],
    visible: true,
    title: "Point Cloud",
    popupTemplate: {
      title: "Temperature",
      content: "Value: {Temperature}"
    },
    renderer: {
      type: "simple",
      symbol: {
        type: "point-3d",
        symbolLayers: [{
          type: "object",
          resource: { primitive: "sphere" },
          material: { color: "white" },
          height: 5,
          width: 5,
          depth: 5
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
          stops: [
            { value: 265, size: 40000  }, 
            { value: 289, size: 40000  }  
          ]
        }
      ]
    }
  });

  map.addMany([euPointCloudLayer]);

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

  const symbologyEditorPanel = document.getElementById("symbologyEditorPanel");
  const startColorPicker = document.getElementById("startColorPicker");
  const middleColorPicker = document.getElementById("middleColorPicker");
  const endColorPicker = document.getElementById("endColorPicker");
  const transparencyInput = document.getElementById("transparencyInput");
  const sizeInput = document.getElementById("sizeInput");
  const minZOffsetInput = document.getElementById("minZOffsetInput");
  const maxZOffsetInput = document.getElementById("maxZOffsetInput");
  const applySymbologyButton = document.getElementById("applySymbologyButton");
  const colorRampPreview = document.getElementById("colorRampPreview");
  const symbologyNotSupportedMessage = document.getElementById("symbologyNotSupportedMessage");
  const shapeSelect = document.getElementById("shapeSelect");

  let activeLayerForSymbology = euPointCloudLayer; 
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

  function applyCurrentSymbology() {
    if (!activeLayerForSymbology) return;

    currentRenderer = activeLayerForSymbology.renderer.clone();

    let fieldName = "Temperature"; 
    let minDataValue = 265; 
    let maxDataValue = 289; 

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

    const newSize = parseFloat(sizeInput.value);
    let sizeVV = currentRenderer.visualVariables.find(vv => vv.type === "size");
    if (sizeVV) {
        sizeVV.field = fieldName;
        sizeVV.stops = [
            { value: minDataValue, size: newSize },
            { value: maxDataValue, size: newSize }
        ];
    } else {
        currentRenderer.visualVariables.push({
            type: "size",
            field: fieldName,
            stops: [
                { value: minDataValue, size: newSize },
                { value: maxDataValue, size: newSize }
            ]
        });
    }
    let objectSymbolLayer = currentRenderer.symbol.symbolLayers.find(sl => sl.type === "object");
      if (!objectSymbolLayer) {
        objectSymbolLayer = { type: "object", material: { color: "white" } };
        currentRenderer.symbol.symbolLayers.push(objectSymbolLayer);
      }
      
    const newShape = shapeSelect ? shapeSelect.value : "sphere";
      objectSymbolLayer.resource = { primitive: newShape };
    
    const symbolLayer = currentRenderer.symbol.symbolLayers.getItemAt(0); 
    if (symbolLayer && symbolLayer.type === "object") {
        symbolLayer.width = newSize;
        symbolLayer.depth = newSize;
        symbolLayer.height = newSize; 
    }

    const newMinZOffset = parseFloat(minZOffsetInput.value);
    const newMaxZOffset = parseFloat(maxZOffsetInput.value);

    const dataValueRange = maxDataValue - minDataValue;
    const heightRange = newMaxZOffset - newMinZOffset;

    let expression = `$feature.${fieldName}`;
    if (dataValueRange > 0) {
        const scaleFactor = heightRange / dataValueRange;
        const baseOffset = newMinZOffset - (minDataValue * scaleFactor);
        expression = `$feature.${fieldName} * ${scaleFactor} + ${baseOffset}`;
    } else {
        expression = `${newMinZOffset}`;
    }

    activeLayerForSymbology.elevationInfo = {
        mode: "relative-to-ground",
        featureExpressionInfo: {
            expression: expression
        }
    };

    activeLayerForSymbology.renderer = currentRenderer;
  }

  applySymbologyButton.addEventListener("click", applyCurrentSymbology);

  view.when().then(function() {
    return Promise.all([ 
      euPointCloudLayer.load()
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

    const sizeVV = currentRenderer.visualVariables.find(vv => vv.type === "size");
    if (sizeVV && sizeVV.stops.length > 0) {
      sizeInput.value = sizeVV.stops[0].size;
    } else {
      sizeInput.value = 5; 
    }
    
    const objectSymbolLayer = currentRenderer.symbol.symbolLayers.find(sl => sl.type === "object");
      if (objectSymbolLayer) {
        if (shapeSelect && objectSymbolLayer.resource && objectSymbolLayer.resource.primitive) {
          shapeSelect.value = objectSymbolLayer.resource.primitive;
        } else if (shapeSelect) {
          shapeSelect.value = "cylinder"; 
        }
      }

    minZOffsetInput.value = 0;
    maxZOffsetInput.value = 200000; 
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
