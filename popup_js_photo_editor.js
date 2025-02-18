// ----------------------------------------------------
// Icons array – adapt to your own folder structure
// ----------------------------------------------------
const scriptPath = document.currentScript && document.currentScript.src ? document.currentScript.src : "";
const scriptDir = scriptPath ? scriptPath.substring(0, scriptPath.lastIndexOf('/')) : ".";

var icons = [
  { key: 'pen-tool', src: `${scriptDir}/icons/pen.svg` },
  { key: 'text-tool', src: `${scriptDir}/icons/text.svg` },
  { key: 'select-tool', src: `${scriptDir}/icons/select.svg` },
  { key: 'select-area', src: `${scriptDir}/icons/select.svg` },
  { key: 'shape-tool', src: `${scriptDir}/icons/shape.svg` },
  { key: 'show', src: `${scriptDir}/icons/show.svg` },
  { key: 'hide', src: `${scriptDir}/icons/hide.svg` },
  { key: 'sort_down', src: `${scriptDir}/icons/sort_down.svg` },
  { key: 'sort_up', src: `${scriptDir}/icons/sort_up.svg` },
  { key: 'new_layer', src: `${scriptDir}/icons/new_layer.svg` },
  { key: 'delete_layer', src: `${scriptDir}/icons/delete.svg` },
  { key: 'new_image', src: `${scriptDir}/icons/new_image.svg` },
  { key: 'zoom-in', src: `${scriptDir}/icons/zoom_in.svg` },
  { key: 'zoom-out', src: `${scriptDir}/icons/zoom_out.svg` },
  { key: 'fit-screen', src: `${scriptDir}/icons/fit_screen.svg` },
  { key: 'crop', src: `${scriptDir}/icons/crop.svg` },
  { key: 'settings', src: `${scriptDir}/icons/settings.svg` },
  { key: 'shape', src: `${scriptDir}/icons/shape.svg` },
  { key: 'undo', src: `${scriptDir}/icons/undo.svg` },
  { key: 'redo', src: `${scriptDir}/icons/redo.svg` },
  { key: 'mask', src: `${scriptDir}/icons/mask.svg` }
];

// ------------------------------------------------------------------------
// PhotoEditor CLASS
// ------------------------------------------------------------------------
(function (global) {
  "use strict";

  function PhotoEditor() {
    // Container / Canvas
    this.container = null;
    this.canvas = null;
    this.ctx = null;
    this.width = 800;
    this.height = 600;

    // Tools: "select", "pen", "text", "shape", "selectArea", "canvasSettings"
    this.tool = "select";

    // Layers + history
    this.layers = [];
    this.selectedLayerId = null;
    this.nextLayerId = 1;
    this.undoStack = [];
    this.redoStack = [];

    // Zoom
    this.zoomFactor = 1;

    // Mouse/drag
    this.isMouseDown = false;
    this.dragMode = null;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.originalX = 0;
    this.originalY = 0;
    this.originalW = 0;
    this.originalH = 0;
    this.dragStartState = null;

    // Pen tool
    this.penColor = "#ff0000";
    this.penSize = 5;
    this.isDrawing = false;

    // Shape tool
    this.isShapeDrawing = false;
    this.shapeStartX = 0;
    this.shapeStartY = 0;
    this.currentShapeRect = null;
    this.shapeColor = "#ff0000";
    this.shapeFill = true;
    this.shapeStroke = false;
    this.shapeStrokeSize = 2;
    this.shapeType = "square";

    // Select area
    this.isAreaSelecting = false;
    this.areaSelectRect = null;
    this.clipboard = null;

    // Offscreen for pixel picking
    this.offscreenCanvas = document.createElement("canvas");
    this.offscreenCtx = this.offscreenCanvas.getContext("2d");

    // Callback
    this.onComplete = null;
  }

  // ------------------------------------------------------------------------
  // If layer.isMask => we draw that layer in GREEN.
  // We'll transform each pixel that is non-transparent to #00ff00.
  // ------------------------------------------------------------------------
  PhotoEditor.prototype.getMaskedCanvas = function (sourceCanvas) {
    const w = sourceCanvas.width, h = sourceCanvas.height;
    const tmp = document.createElement("canvas");
    tmp.width = w; tmp.height = h;
    const ctx = tmp.getContext("2d");
    ctx.drawImage(sourceCanvas, 0, 0);
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 0) {
        // make it green
        data[i + 0] = 0;   // R=0
        data[i + 1] = 255; // G=255
        data[i + 2] = 0;   // B=0
      }
    }
    ctx.putImageData(imageData, 0, 0);
    return tmp;
  };

  // ------------------------------------------------------------------------
  // Minimal History approach:
  //   - layerAdded / layerRemoved => we store pixel data (so we can re-add the layer).
  //   - layerModified => only bounding box changes, no pixel data (since pen strokes aren’t undone).
  // ------------------------------------------------------------------------
  PhotoEditor.prototype.serializeLayer = function (layer, includePixelData) {
    const data = {
      id: layer.id,
      x: layer.x,
      y: layer.y,
      width: layer.width,
      height: layer.height,
      originalWidth: layer.originalWidth,
      originalHeight: layer.originalHeight,
      rotation: layer.rotation || 0,
      opacity: layer.opacity || 1,
      visible: layer.visible,
      isText: layer.isText,
      isMask: layer.isMask,
      textContent: layer.textContent || "",
      textColor: layer.textColor || "#000000",
      fontSize: layer.fontSize || 24,
      fontFamily: layer.fontFamily || "Arial",
      bold: layer.bold || false,
      italic: layer.italic || false,
      shapeType: layer.shapeType || ""
    };
    if (includePixelData) {
      data.imageData = layer.offscreenCanvas.toDataURL("image/png");
    }
    return data;
  };

  PhotoEditor.prototype.deserializeLayer = function (data) {
    const off = document.createElement("canvas");
    off.width = data.originalWidth;
    off.height = data.originalHeight;
    const newLayer = {
      id: data.id,
      x: data.x,
      y: data.y,
      width: data.width,
      height: data.height,
      originalWidth: data.originalWidth,
      originalHeight: data.originalHeight,
      rotation: data.rotation,
      opacity: data.opacity,
      visible: (data.visible !== false),
      offscreenCanvas: off,
      isText: data.isText,
      isMask: data.isMask,
      textContent: data.textContent,
      textColor: data.textColor,
      fontSize: data.fontSize,
      fontFamily: data.fontFamily,
      bold: data.bold,
      italic: data.italic,
      shapeType: data.shapeType
    };
    if (data.imageData) {
      const img = new Image();
      img.onload = () => {
        off.getContext("2d").clearRect(0, 0, off.width, off.height);
        off.getContext("2d").drawImage(img, 0, 0);
      };
      img.src = data.imageData;
    }
    // If text, re-render text
    if (newLayer.isText) {
      this.renderTextLayer(newLayer);
    }
    return newLayer;
  };

  PhotoEditor.prototype.applyLayerState = function (layer, state) {
    layer.x = state.x;
    layer.y = state.y;
    layer.width = state.width;
    layer.height = state.height;
    layer.rotation = state.rotation;
    layer.opacity = state.opacity;
    layer.visible = (state.visible !== false);
    layer.isMask = state.isMask;
    if (state.imageData) {
      const ctx = layer.offscreenCanvas.getContext("2d");
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, layer.originalWidth, layer.originalHeight);
        ctx.drawImage(img, 0, 0);
      };
      img.src = state.imageData;
    }
    if (layer.isText) {
      layer.textContent = state.textContent;
      layer.textColor = state.textColor;
      layer.fontSize = state.fontSize;
      layer.fontFamily = state.fontFamily;
      layer.bold = state.bold;
      layer.italic = state.italic;
      this.renderTextLayer(layer);
    }
  };

  PhotoEditor.prototype.getLayerById = function (id) {
    return this.layers.find(l => l.id === id);
  };

  PhotoEditor.prototype.saveHistory = function (action) {
    this.undoStack.push(action);
    this.redoStack = [];
  };

  PhotoEditor.prototype.applyUndoAction = function (action) {
    if (action.name === "layerAdded") {
      // remove that layer
      this.layers = this.layers.filter(l => l.id !== action.layerId);
      if (this.selectedLayerId === action.layerId) this.selectedLayerId = null;
    } else if (action.name === "layerRemoved") {
      // re-add it
      const layer = this.deserializeLayer(action.before);
      this.layers.push(layer);
    } else if (action.name === "layerModified") {
      // revert bounding box
      const layer = this.getLayerById(action.layerId);
      if (layer) {
        this.applyLayerState(layer, action.before);
      }
    }
  };

  PhotoEditor.prototype.applyRedoAction = function (action) {
    if (action.name === "layerAdded") {
      // add layer again
      const layer = this.deserializeLayer(action.after);
      this.layers.push(layer);
    } else if (action.name === "layerRemoved") {
      // remove again
      this.layers = this.layers.filter(l => l.id !== action.layerId);
      if (this.selectedLayerId === action.layerId) this.selectedLayerId = null;
    } else if (action.name === "layerModified") {
      // apply after
      const layer = this.getLayerById(action.layerId);
      if (layer) {
        this.applyLayerState(layer, action.after);
      }
    }
  };

  PhotoEditor.prototype.undo = function () {
    if (!this.undoStack.length) return;
    const action = this.undoStack.pop();
    this.applyUndoAction(action);
    this.redoStack.push(action);
    this.redrawAll();
    this.updateLayersListUI();
  };

  PhotoEditor.prototype.redo = function () {
    if (!this.redoStack.length) return;
    const action = this.redoStack.pop();
    this.applyRedoAction(action);
    this.undoStack.push(action);
    this.redrawAll();
    this.updateLayersListUI();
  };

  // ------------------------------------------------------------------------
  // init
  // ------------------------------------------------------------------------
  PhotoEditor.prototype.init = function (containerDiv, width, height, imageUrls, finishCallback) {
    this.container = containerDiv;
    this.width = width;
    this.height = height;
    this.onComplete = finishCallback || function () { };
    this.imageUrls = imageUrls || [];

    this.container.innerHTML = "";
    this.container.classList.add("photo-editor-container");

    // Left Panel
    const leftPanel = document.createElement("div");
    leftPanel.classList.add("photo-editor-left-panel");

    const toolsTitle = document.createElement("div");
    toolsTitle.classList.add("photo-editor-tools-title");
    toolsTitle.textContent = "Tools";
    leftPanel.appendChild(toolsTitle);

    // SELECT-AREA
    const areaSelectBtn = document.createElement("button");
    areaSelectBtn.classList.add("photo-editor-button");
    areaSelectBtn.id = 'tool-button-selectArea';
    {
      const icon = icons.find(i => i.key === 'crop');
      areaSelectBtn.innerHTML = icon ? `<img src="${icon.src}" alt="Area" class="photo-editor-icon" />` : "Area";
    }
    areaSelectBtn.title = "Select Area (Cut/Copy/Paste)";
    areaSelectBtn.onclick = () => {
      this.tool = "selectArea";
      this.updateToolUI();
      this.areaSelectRect = null;
    };
    leftPanel.appendChild(areaSelectBtn);

    // SELECT
    const selectBtn = document.createElement("button");
    selectBtn.classList.add("photo-editor-button");
    selectBtn.id = 'tool-button-select';
    {
      const icon = icons.find(i => i.key === 'select-tool');
      selectBtn.innerHTML = icon ? `<img src="${icon.src}" alt="Select" class="photo-editor-icon" />` : "Select";
    }
    selectBtn.onclick = () => {
      this.tool = "select";
      this.updateToolUI();
    };
    leftPanel.appendChild(selectBtn);

    // PEN
    const penBtn = document.createElement("button");
    penBtn.classList.add("photo-editor-button");
    penBtn.id = 'tool-button-pen';
    {
      const icon = icons.find(i => i.key === 'pen-tool');
      penBtn.innerHTML = icon ? `<img src="${icon.src}" alt="Pen" class="photo-editor-icon" />` : "Pen";
    }
    penBtn.title = "Pen (No Undo for strokes)";
    penBtn.onclick = () => {
      this.tool = "pen";
      this.updateToolUI();
    };
    leftPanel.appendChild(penBtn);

    // TEXT
    const textBtn = document.createElement("button");
    textBtn.classList.add("photo-editor-button");
    textBtn.id = 'tool-button-text';
    {
      const icon = icons.find(i => i.key === 'text-tool');
      textBtn.innerHTML = icon ? `<img src="${icon.src}" alt="Text" class="photo-editor-icon" />` : "Text";
    }
    textBtn.onclick = () => {
      this.tool = "text";
      this.updateToolUI();
    };
    leftPanel.appendChild(textBtn);

    // SHAPE
    const shapeBtn = document.createElement("button");
    shapeBtn.classList.add("photo-editor-button");
    shapeBtn.id = 'tool-button-shape';
    {
      const icon = icons.find(i => i.key === 'shape-tool');
      shapeBtn.innerHTML = icon ? `<img src="${icon.src}" alt="Shape" class="photo-editor-icon" />` : "Shape";
    }
    shapeBtn.onclick = () => {
      this.tool = "shape";
      this.updateToolUI();
    };
    leftPanel.appendChild(shapeBtn);



    // break
    const brk = document.createElement("div");
    brk.classList.add("left-panel-break");
    leftPanel.appendChild(brk);

    // CANVAS SETTINGS
    const canvasBtn = document.createElement("button");
    canvasBtn.classList.add("photo-editor-button");
    canvasBtn.id = 'tool-button-canvasSettings';
    {
      const icon = icons.find(i => i.key === 'settings');
      canvasBtn.innerHTML = icon ? `<img src="${icon.src}" alt="Shape" class="photo-editor-icon" />` : "Shape";
    }
    canvasBtn.onclick = () => {
      this.tool = "canvasSettings";
      this.updateToolUI();
    };
    leftPanel.appendChild(canvasBtn);

    const brk2 = document.createElement("div");
    brk2.classList.add("left-panel-break");
    leftPanel.appendChild(brk2);

    // ZOOM
    const zoomInBtn = document.createElement("button");
    zoomInBtn.classList.add("photo-editor-button");
    zoomInBtn.title = "Zoom In";
    {
      const icon = icons.find(i => i.key === 'zoom-in');
      zoomInBtn.innerHTML = icon ? `<img src="${icon.src}" alt="+" class="photo-editor-icon" />` : "+";
    }
    zoomInBtn.onclick = () => this.changeZoom(1.2);
    leftPanel.appendChild(zoomInBtn);

    const fitBtn = document.createElement("button");
    fitBtn.classList.add("photo-editor-button");
    fitBtn.title = "Fit To Screen";
    {
      const icon = icons.find(i => i.key === 'fit-screen');
      fitBtn.innerHTML = icon ? `<img src="${icon.src}" alt="Fit" class="photo-editor-icon" />` : "Fit";
    }
    fitBtn.onclick = () => this.fitToScreen();
    leftPanel.appendChild(fitBtn);

    const zoomOutBtn = document.createElement("button");
    zoomOutBtn.classList.add("photo-editor-button");
    zoomOutBtn.title = "Zoom Out";
    {
      const icon = icons.find(i => i.key === 'zoom-out');
      zoomOutBtn.innerHTML = icon ? `<img src="${icon.src}" alt="-" class="photo-editor-icon" />` : "-";
    }
    zoomOutBtn.onclick = () => this.changeZoom(0.8);
    leftPanel.appendChild(zoomOutBtn);



    const brk3 = document.createElement("div");
    brk3.classList.add("left-panel-break");
    leftPanel.appendChild(brk3);

    // Undo/Redo
    const undoBtn = document.createElement("button");
    undoBtn.classList.add("photo-editor-button");
    {
      const icon = icons.find(i => i.key === 'undo');
      undoBtn.innerHTML = icon ? `<img src="${icon.src}" alt="Shape" class="photo-editor-icon" />` : "Shape";
    }
    undoBtn.title = "Undo (Ctrl+Z)";
    undoBtn.onclick = this.undo.bind(this);
    leftPanel.appendChild(undoBtn);

    const redoBtn = document.createElement("button");
    redoBtn.classList.add("photo-editor-button");
    {
      const icon = icons.find(i => i.key === 'redo');
      redoBtn.innerHTML = icon ? `<img src="${icon.src}" alt="Shape" class="photo-editor-icon" />` : "Shape";
    }
    redoBtn.title = "Redo (Ctrl+Y)";
    redoBtn.onclick = this.redo.bind(this);
    leftPanel.appendChild(redoBtn);

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        this.undo();
      } else if ((e.ctrlKey && e.key.toLowerCase() === "y")
        || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "z")) {
        e.preventDefault();
        this.redo();
      } else if (e.ctrlKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        if (this.tool === "selectArea" && this.areaSelectRect) {
          this.copyArea();
        }
      } else if (e.ctrlKey && e.key.toLowerCase() === "x") {
        e.preventDefault();
        if (this.tool === "selectArea" && this.areaSelectRect) {
          this.cutArea();
        }
      } else if (e.ctrlKey && e.key.toLowerCase() === "v") {
        e.preventDefault();
        this.pasteArea();
      }
    });

    // CENTER
    const centerPanel = document.createElement("div");
    centerPanel.classList.add("photo-editor-center-panel");
    const canvasWrapper = document.createElement("div");
    canvasWrapper.classList.add("photo-editor-canvas-wrapper");
    centerPanel.appendChild(canvasWrapper);

    this.canvas = document.createElement("canvas");
    this.canvas.classList.add("photo-editor-canvas");
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.canvas.style.transformOrigin = "top left";
    canvasWrapper.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");

    // events
    this.canvas.addEventListener("mousedown", this.onMouseDown.bind(this));
    this.canvas.addEventListener("mousemove", this.onMouseMove.bind(this));
    this.canvas.addEventListener("mouseup", this.onMouseUp.bind(this));
    this.canvas.addEventListener("mouseout", this.onMouseUp.bind(this));
    this.canvas.addEventListener("mousemove", this.onHover.bind(this));
    this.canvas.addEventListener("dblclick", this.onDoubleClick.bind(this));
    // wheel
    this.canvas.addEventListener("wheel", (e) => {
      if (e.ctrlKey && e.altKey) {
        e.preventDefault();
        if (e.deltaY < 0) this.changeZoom(1.1);
        else this.changeZoom(0.9);
      }
    }, { passive: false });

    // RIGHT
    const rightPanel = document.createElement("div");
    rightPanel.classList.add("photo-editor-right-panel");

    // Options Box
    const optionsBox = document.createElement("div");
    optionsBox.classList.add("photo-editor-options-box");
    const optionsTitle = document.createElement("div");
    optionsTitle.classList.add("photo-editor-options-title");
    optionsTitle.textContent = "Tool Options";
    optionsBox.appendChild(optionsTitle);

    // SELECT Options
    const selectOptionsDiv = document.createElement("div");
    selectOptionsDiv.classList.add("photo-editor-select-options");
    const rotRow = document.createElement("div");
    rotRow.classList.add("photo-editor-option-row");
    const rotLabel = document.createElement("label");
    rotLabel.textContent = "Rotation:";
    rotRow.appendChild(rotLabel);
    const rotSlider = document.createElement("input");
    rotSlider.type = "range";
    rotSlider.min = "0";
    rotSlider.max = "360";
    rotSlider.value = "0";
    rotSlider.step = "1";
    rotSlider.style.margin = "0 8px";
    rotRow.appendChild(rotSlider);
    const rotValueSpan = document.createElement("span");
    rotValueSpan.textContent = "0°";
    rotRow.appendChild(rotValueSpan);
    rotSlider.oninput = () => {
      rotValueSpan.textContent = rotSlider.value + "°";
    };
    rotSlider.onchange = () => {
      const layer = this.getSelectedLayer();
      if (!layer) return;
      const oldState = this.serializeLayer(layer, false);
      layer.rotation = parseFloat(rotSlider.value) || 0;
      const newState = this.serializeLayer(layer, false);
      this.saveHistory({ name: "layerModified", layerId: layer.id, before: oldState, after: newState });
      this.redrawAll();
    };
    selectOptionsDiv.appendChild(rotRow);

    const opRow = document.createElement("div");
    opRow.classList.add("photo-editor-option-row");
    const opLabel = document.createElement("label");
    opLabel.textContent = "Opacity:";
    opRow.appendChild(opLabel);
    const opSlider = document.createElement("input");
    opSlider.type = "range";
    opSlider.min = "0";
    opSlider.max = "1";
    opSlider.step = "0.01";
    opSlider.value = "1";
    opSlider.style.margin = "0 8px";
    opRow.appendChild(opSlider);
    const opValueSpan = document.createElement("span");
    opValueSpan.textContent = "1.00";
    opRow.appendChild(opValueSpan);
    opSlider.oninput = () => {
      opValueSpan.textContent = parseFloat(opSlider.value).toFixed(2);
    };
    opSlider.onchange = () => {
      const layer = this.getSelectedLayer();
      if (!layer) return;
      const oldState = this.serializeLayer(layer, false);
      layer.opacity = parseFloat(opSlider.value);
      const newState = this.serializeLayer(layer, false);
      this.saveHistory({ name: "layerModified", layerId: layer.id, before: oldState, after: newState });
      this.redrawAll();
    };
    selectOptionsDiv.appendChild(opRow);

    // PEN Options
    const penOptionsDiv = document.createElement("div");
    penOptionsDiv.style.display = "none";
    const penColorRow = document.createElement("div");
    penColorRow.classList.add("photo-editor-option-row");
    const penColorLabel = document.createElement("label");
    penColorLabel.textContent = "Pen Color:";
    penColorRow.appendChild(penColorLabel);
    const penColorInput = document.createElement("input");
    penColorInput.type = "color";
    penColorInput.value = this.penColor;
    penColorInput.style.width = "48px";
    penColorInput.style.height = "32px";
    penColorInput.style.border = "none";
    penColorInput.onchange = () => {
      this.penColor = penColorInput.value;
    };
    penColorRow.appendChild(penColorInput);
    penOptionsDiv.appendChild(penColorRow);

    const penSizeRow = document.createElement("div");
    penSizeRow.classList.add("photo-editor-option-row");
    const penSizeLabel = document.createElement("label");
    penSizeLabel.textContent = "Pen Size:";
    penSizeRow.appendChild(penSizeLabel);
    const penSizeSlider = document.createElement("input");
    penSizeSlider.type = "range";
    penSizeSlider.min = "1";
    penSizeSlider.max = "50";
    penSizeSlider.step = "1";
    penSizeSlider.value = String(this.penSize);
    penSizeSlider.style.margin = "0 8px";
    penSizeRow.appendChild(penSizeSlider);
    const penSizeValSpan = document.createElement("span");
    penSizeValSpan.textContent = String(this.penSize);
    penSizeRow.appendChild(penSizeValSpan);
    penSizeSlider.oninput = () => {
      this.penSize = parseInt(penSizeSlider.value, 10);
      penSizeValSpan.textContent = String(this.penSize);
    };
    penOptionsDiv.appendChild(penSizeRow);

    // SHAPE Options
    const shapeOptionsDiv = document.createElement("div");
    shapeOptionsDiv.style.display = "none";
    const shapeColorRow = document.createElement("div");
    shapeColorRow.classList.add("photo-editor-option-row");
    const shapeColorLabel = document.createElement("label");
    shapeColorLabel.textContent = "Shape Color:";
    shapeColorRow.appendChild(shapeColorLabel);
    const shapeColorInput = document.createElement("input");
    shapeColorInput.type = "color";
    shapeColorInput.value = this.shapeColor;
    shapeColorInput.style.width = "48px";
    shapeColorInput.style.height = "32px";
    shapeColorInput.style.border = "none";
    shapeColorInput.onchange = () => {
      this.shapeColor = shapeColorInput.value;
    };
    shapeColorRow.appendChild(shapeColorInput);
    shapeOptionsDiv.appendChild(shapeColorRow);

    const shapeModeRow = document.createElement("div");
    shapeModeRow.classList.add("photo-editor-option-row");
    const fillRadio = document.createElement("input");
    fillRadio.type = "radio";
    fillRadio.name = "shapeMode";
    fillRadio.value = "fill";
    fillRadio.checked = true;
    fillRadio.onchange = () => {
      this.shapeFill = true;
      this.shapeStroke = false;
      shapeStrokeSizeRow.style.display = "none";
    };
    shapeModeRow.appendChild(fillRadio);
    const fillLabel = document.createElement("label");
    fillLabel.textContent = "Fill";
    shapeModeRow.appendChild(fillLabel);

    const strokeRadio = document.createElement("input");
    strokeRadio.type = "radio";
    strokeRadio.name = "shapeMode";
    strokeRadio.value = "stroke";
    strokeRadio.onchange = () => {
      this.shapeFill = false;
      this.shapeStroke = true;
      shapeStrokeSizeRow.style.display = "block";
    };
    shapeModeRow.appendChild(strokeRadio);
    const strokeLabel = document.createElement("label");
    strokeLabel.textContent = "Stroke";
    shapeModeRow.appendChild(strokeLabel);
    shapeOptionsDiv.appendChild(shapeModeRow);

    const shapeStrokeSizeRow = document.createElement("div");
    shapeStrokeSizeRow.classList.add("photo-editor-option-row");
    shapeStrokeSizeRow.style.display = "none";
    const shapeStrokeSizeLabel = document.createElement("label");
    shapeStrokeSizeLabel.textContent = "Stroke Size:";
    shapeStrokeSizeRow.appendChild(shapeStrokeSizeLabel);
    const shapeStrokeSizeSlider = document.createElement("input");
    shapeStrokeSizeSlider.type = "range";
    shapeStrokeSizeSlider.min = "1";
    shapeStrokeSizeSlider.max = "50";
    shapeStrokeSizeSlider.step = "1";
    shapeStrokeSizeSlider.value = "2";
    shapeStrokeSizeSlider.style.margin = "0 8px";
    shapeStrokeSizeSlider.oninput = () => {
      this.shapeStrokeSize = parseInt(shapeStrokeSizeSlider.value, 10);
      shapeStrokeSizeVal.textContent = shapeStrokeSizeSlider.value;
    };
    shapeStrokeSizeRow.appendChild(shapeStrokeSizeSlider);
    const shapeStrokeSizeVal = document.createElement("span");
    shapeStrokeSizeVal.textContent = "2";
    shapeStrokeSizeRow.appendChild(shapeStrokeSizeVal);

    shapeOptionsDiv.appendChild(shapeStrokeSizeRow);

    const shapeTypeRow = document.createElement("div");
    shapeTypeRow.classList.add("photo-editor-option-row");
    const shapeTypeLabel = document.createElement("label");
    shapeTypeLabel.textContent = "Shape Type:";
    shapeTypeRow.appendChild(shapeTypeLabel);
    const shapeTypeSelect = document.createElement("select");
    ["square", "circle", "triangle", "other"].forEach(t => {
      const op = document.createElement("option");
      op.value = t;
      op.textContent = (t === "other") ? "Rectangle" : (t.charAt(0).toUpperCase() + t.slice(1));
      shapeTypeSelect.appendChild(op);
    });
    shapeTypeSelect.onchange = () => {
      this.shapeType = shapeTypeSelect.value;
    };
    shapeTypeRow.appendChild(shapeTypeSelect);
    shapeOptionsDiv.appendChild(shapeTypeRow);

    // TEXT Options
    const textOptionsDiv = document.createElement("div");
    textOptionsDiv.style.display = "none";

    // Canvas Options
    const canvasOptionsDiv = document.createElement("div");
    canvasOptionsDiv.classList.add("photo-editor-canvas-options");
    canvasOptionsDiv.style.display = "none";
    const canvasOptTitle = document.createElement("div");
    canvasOptTitle.textContent = "Canvas Options";
    canvasOptionsDiv.appendChild(canvasOptTitle);

    const canvasSizeRow = document.createElement("div");
    canvasSizeRow.classList.add("photo-editor-option-row");
    const cWLabel = document.createElement("label");
    cWLabel.textContent = "Width:";
    canvasSizeRow.appendChild(cWLabel);
    const cWInput = document.createElement("input");
    cWInput.type = "number";
    cWInput.value = this.width;
    cWInput.style.width = "60px";
    canvasSizeRow.appendChild(cWInput);

    const cHLabel = document.createElement("label");
    cHLabel.textContent = "Height:";
    canvasSizeRow.appendChild(cHLabel);
    const cHInput = document.createElement("input");
    cHInput.type = "number";
    cHInput.value = this.height;
    cHInput.style.width = "60px";
    canvasSizeRow.appendChild(cHInput);
    canvasOptionsDiv.appendChild(canvasSizeRow);

    const changeSizeBtn = document.createElement("button");
    changeSizeBtn.textContent = "Change Canvas Size";
    changeSizeBtn.onclick = () => {
      const newW = parseInt(cWInput.value, 10);
      const newH = parseInt(cHInput.value, 10);
      if (isNaN(newW) || isNaN(newH) || newW < 10 || newH < 10) {
        alert("Invalid size.");
        return;
      }
      this.width = newW;
      this.height = newH;
      this.canvas.width = newW;
      this.canvas.height = newH;
      this.redrawAll();
    };
    canvasOptionsDiv.appendChild(changeSizeBtn);

    // Add to optionsBox
    optionsBox.appendChild(selectOptionsDiv);
    optionsBox.appendChild(penOptionsDiv);
    optionsBox.appendChild(shapeOptionsDiv);
    optionsBox.appendChild(textOptionsDiv);
    optionsBox.appendChild(canvasOptionsDiv);

    // Layers box
    const layersBox = document.createElement("div");
    layersBox.classList.add("photo-editor-layers-box");
    const layersTitle = document.createElement("div");
    layersTitle.classList.add("photo-editor-layers-title");
    layersTitle.textContent = "Layers";
    layersBox.appendChild(layersTitle);

    const layersList = document.createElement("div");
    layersList.classList.add("photo-editor-layers-list");
    this.layersListEl = layersList;
    layersBox.appendChild(layersList);

    const layerActions = document.createElement("div");
    layerActions.classList.add("photo-editor-layer-actions");

    const addEmptyBtn = document.createElement("button");
    addEmptyBtn.classList.add("photo-editor-button-layers");
    {
      const icon = icons.find(i => i.key === 'new_layer');
      addEmptyBtn.innerHTML = icon ? `<img src="${icon.src}" alt="NewLayer" class="photo-editor-icon"/>` : "New Layer";
    }
    addEmptyBtn.onclick = this.addEmptyLayer.bind(this);
    layerActions.appendChild(addEmptyBtn);

    const addImageBtn = document.createElement("button");
    addImageBtn.classList.add("photo-editor-button-layers");
    {
      const icon = icons.find(i => i.key === 'new_image');
      addImageBtn.innerHTML = icon ? `<img src="${icon.src}" alt="AddImg" class="photo-editor-icon"/>` : "Add Image";
    }
    addImageBtn.onclick = this.addImageLayer.bind(this);
    layerActions.appendChild(addImageBtn);

    const removeBtn = document.createElement("button");
    removeBtn.classList.add("photo-editor-button-layers");
    {
      const icon = icons.find(i => i.key === 'delete_layer');
      removeBtn.innerHTML = icon ? `<img src="${icon.src}" alt="Remove" class="photo-editor-icon"/>` : "Remove";
    }
    removeBtn.onclick = this.removeSelectedLayer.bind(this);
    layerActions.appendChild(removeBtn);

    const finishBtn = document.createElement("button");
    finishBtn.classList.add("photo-editor-finish");
    finishBtn.textContent = "Finish";
    // On finish => return JSON: {image, layers, masks}
    finishBtn.onclick = this.finishEditing.bind(this);
    layerActions.appendChild(finishBtn);

    layersBox.appendChild(layerActions);

    // Attach
    rightPanel.appendChild(optionsBox);
    rightPanel.appendChild(layersBox);

    this.container.appendChild(leftPanel);
    this.container.appendChild(centerPanel);
    this.container.appendChild(rightPanel);

    // Save references
    this.selectOptionsDiv = selectOptionsDiv;
    this.penOptionsDiv = penOptionsDiv;
    this.shapeOptionsDiv = shapeOptionsDiv;
    this.textOptionsDiv = textOptionsDiv;
    this.canvasOptionsDiv = canvasOptionsDiv;
    this.rotateInput = rotSlider;
    this.opacityInput = opSlider;

    // load images
    this.loadInitialImages();
    this.updateToolUI();
    this.redrawAll();
  };

  // ------------------------------------------------------------------------
  // Zoom, etc.
  // ------------------------------------------------------------------------
  PhotoEditor.prototype.changeZoom = function (factor) {
    this.zoomFactor *= factor;
    if (this.zoomFactor < 0.1) this.zoomFactor = 0.1;
    if (this.zoomFactor > 10) this.zoomFactor = 10;
    this.canvas.style.transform = `scale(${this.zoomFactor})`;
  };
  PhotoEditor.prototype.fitToScreen = function () {
    const centerPanel = this.container.querySelector(".photo-editor-center-panel");
    if (!centerPanel) return;
    const availW = centerPanel.clientWidth - 20;
    const availH = centerPanel.clientHeight - 100;
    if (availW < 10 || availH < 10) return;
    const sx = availW / this.width;
    const sy = availH / this.height;
    const scale = Math.min(sx, sy);
    this.zoomFactor = scale;
    if (this.zoomFactor < 0.1) this.zoomFactor = 0.1;
    if (this.zoomFactor > 10) this.zoomFactor = 10;
    this.canvas.style.transform = `scale(${this.zoomFactor})`;
  };
  PhotoEditor.prototype.getRealMouse = function (e) {
    return { x: e.offsetX, y: e.offsetY };
  };

  // ------------------------------------------------------------------------
  // Tools UI
  // ------------------------------------------------------------------------
  PhotoEditor.prototype.updateToolUI = function () {
    // Hide all
    this.selectOptionsDiv.style.display = "none";
    this.penOptionsDiv.style.display = "none";
    this.shapeOptionsDiv.style.display = "none";
    this.textOptionsDiv.style.display = "none";
    this.canvasOptionsDiv.style.display = "none";

    // Clear selected
    document.querySelectorAll('.photo-editor-button').forEach(btn => {
      btn.classList.remove("photo-editor-button-selected");
    });
    const activeBtn = document.getElementById('tool-button-' + this.tool);
    if (activeBtn) {
      activeBtn.classList.add("photo-editor-button-selected");
    }

    // Show
    if (this.tool === "select") {
      this.selectOptionsDiv.style.display = "block";
      this.canvas.style.cursor = "default";
    } else if (this.tool === "pen") {
      this.penOptionsDiv.style.display = "block";
      this.canvas.style.cursor = "crosshair";
    } else if (this.tool === "text") {
      this.textOptionsDiv.style.display = "block";
      this.canvas.style.cursor = "text";
    } else if (this.tool === "shape") {
      this.shapeOptionsDiv.style.display = "block";
      this.canvas.style.cursor = "crosshair";
    } else if (this.tool === "selectArea") {
      this.canvas.style.cursor = "crosshair";
    } else if (this.tool === "canvasSettings") {
      this.canvasOptionsDiv.style.display = "block";
      this.canvas.style.cursor = "default";
    }
  };

  // ------------------------------------------------------------------------
  // Load initial images
  // ------------------------------------------------------------------------
  PhotoEditor.prototype.loadInitialImages = function () {
    if (!this.imageUrls || !this.imageUrls.length) {
      this.redrawAll();
      return;
    }
    this.imageUrls.forEach(url => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const w = img.width, h = img.height;
        const sw = this.width / w, sh = this.height / h;
        const sc = Math.min(sw, sh, 1);
        const dispW = w * sc, dispH = h * sc;
        const off = document.createElement("canvas");
        off.width = w;
        off.height = h;
        off.getContext("2d").drawImage(img, 0, 0);

        const newLayer = {
          id: this.nextLayerId++,
          x: 0, y: 0,
          width: dispW,
          height: dispH,
          originalWidth: w,
          originalHeight: h,
          visible: true,
          rotation: 0,
          opacity: 1,
          offscreenCanvas: off,
          isText: false,
          isMask: false,
          shapeType: ""
        };
        this.layers.push(newLayer);
        this.saveHistory({
          name: "layerAdded",
          layerId: newLayer.id,
          before: null,
          after: this.serializeLayer(newLayer, true)
        });
        this.redrawAll();
        this.updateLayersListUI();
      };
      img.src = url;
    });
  };

  // ------------------------------------------------------------------------
  // Add layer
  // ------------------------------------------------------------------------
  PhotoEditor.prototype.addEmptyLayer = function () {
    const off = document.createElement("canvas");
    off.width = this.width;
    off.height = this.height;
    const newLayer = {
      id: this.nextLayerId++,
      x: 0, y: 0,
      width: this.width,
      height: this.height,
      originalWidth: this.width,
      originalHeight: this.height,
      visible: true,
      rotation: 0,
      opacity: 1,
      offscreenCanvas: off,
      isText: false,
      isMask: false,
      shapeType: ""
    };
    this.layers.push(newLayer);
    this.saveHistory({
      name: "layerAdded",
      layerId: newLayer.id,
      before: null,
      after: this.serializeLayer(newLayer, true)
    });
    this.redrawAll();
    this.updateLayersListUI();
  };
  PhotoEditor.prototype.addImageLayer = function () {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        const img = new Image();
        img.onload = () => {
          const w = img.width, h = img.height;
          const sw = this.width / w, sh = this.height / h;
          const sc = Math.min(sw, sh, 1);
          const dispW = w * sc, dispH = h * sc;
          const off = document.createElement("canvas");
          off.width = w; off.height = h;
          off.getContext("2d").drawImage(img, 0, 0);
          const newLayer = {
            id: this.nextLayerId++,
            x: 0, y: 0,
            width: dispW,
            height: dispH,
            originalWidth: w,
            originalHeight: h,
            visible: true,
            rotation: 0,
            opacity: 1,
            offscreenCanvas: off,
            isText: false,
            isMask: false,
            shapeType: ""
          };
          this.layers.push(newLayer);
          this.saveHistory({
            name: "layerAdded",
            layerId: newLayer.id,
            before: null,
            after: this.serializeLayer(newLayer, true)
          });
          this.redrawAll();
          this.updateLayersListUI();
        };
        img.src = evt.target.result;
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };
  PhotoEditor.prototype.addTextLayer = function (x, y, text) {
    const w = 300, h = 100;
    const off = document.createElement("canvas");
    off.width = w; off.height = h;
    const newLayer = {
      id: this.nextLayerId++,
      x, y,
      width: w, height: h,
      originalWidth: w, originalHeight: h,
      visible: true,
      rotation: 0,
      opacity: 1,
      offscreenCanvas: off,
      isText: true,
      textContent: text,
      textColor: "#000000",
      fontSize: 24,
      fontFamily: "Arial",
      bold: false,
      italic: false,
      isMask: false,
      shapeType: ""
    };
    this.renderTextLayer(newLayer);
    this.layers.push(newLayer);
    this.saveHistory({
      name: "layerAdded",
      layerId: newLayer.id,
      before: null,
      after: this.serializeLayer(newLayer, true)
    });
    this.redrawAll();
    this.updateLayersListUI();
  };
  PhotoEditor.prototype.renderTextLayer = function (layer) {
    const ctx = layer.offscreenCanvas.getContext("2d");
    ctx.clearRect(0, 0, layer.originalWidth, layer.originalHeight);
    const weight = layer.bold ? "bold" : "normal";
    const style = layer.italic ? "italic" : "normal";
    ctx.font = `${style} ${weight} ${layer.fontSize}px ${layer.fontFamily}`;
    ctx.fillStyle = layer.textColor;
    ctx.textBaseline = "top";
    const lines = (layer.textContent || "").split("\n");
    let cursorY = 0;
    const lh = layer.fontSize * 1.2;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], 0, cursorY);
      cursorY += lh;
    }
  };

  // ------------------------------------------------------------------------
  // Clipboard
  // ------------------------------------------------------------------------
  PhotoEditor.prototype.copyArea = function () {
    const layer = this.getSelectedLayer();
    if (!layer || !this.areaSelectRect) {
      alert("No active layer or selection.");
      return;
    }
    const scaleX = layer.originalWidth / layer.width;
    const scaleY = layer.originalHeight / layer.height;
    const sx = (this.areaSelectRect.x - layer.x) * scaleX;
    const sy = (this.areaSelectRect.y - layer.y) * scaleY;
    const sw = this.areaSelectRect.width * scaleX;
    const sh = this.areaSelectRect.height * scaleY;
    const clip = document.createElement("canvas");
    clip.width = this.areaSelectRect.width;
    clip.height = this.areaSelectRect.height;
    clip.getContext("2d").drawImage(layer.offscreenCanvas, sx, sy, sw, sh, 0, 0, clip.width, clip.height);
    this.clipboard = clip;
    //alert("Area copied.");
  };
  PhotoEditor.prototype.cutArea = function () {
    const layer = this.getSelectedLayer();
    if (!layer || !this.areaSelectRect) {
      alert("No active layer or selection.");
      return;
    }
    this.copyArea();
    // clear
    const scaleX = layer.originalWidth / layer.width;
    const scaleY = layer.originalHeight / layer.height;
    const sx = (this.areaSelectRect.x - layer.x) * scaleX;
    const sy = (this.areaSelectRect.y - layer.y) * scaleY;
    const sw = this.areaSelectRect.width * scaleX;
    const sh = this.areaSelectRect.height * scaleY;
    layer.offscreenCanvas.getContext("2d").clearRect(sx, sy, sw, sh);
    // no undo for pen/cut
    this.redrawAll();
    //alert("Area cut.");
  };
  PhotoEditor.prototype.pasteArea = function () {
    if (!this.clipboard) {
      alert("Clipboard empty.");
      return;
    }
    const newX = this.areaSelectRect ? this.areaSelectRect.x : 10;
    const newY = this.areaSelectRect ? this.areaSelectRect.y : 10;
    const newLayer = {
      id: this.nextLayerId++,
      x: newX, y: newY,
      width: this.clipboard.width,
      height: this.clipboard.height,
      originalWidth: this.clipboard.width,
      originalHeight: this.clipboard.height,
      visible: true,
      rotation: 0,
      opacity: 1,
      offscreenCanvas: this.clipboard,
      isText: false,
      isMask: false,
      shapeType: ""
    };
    this.layers.push(newLayer);
    this.saveHistory({
      name: "layerAdded",
      layerId: newLayer.id,
      before: null,
      after: this.serializeLayer(newLayer, true)
    });
    this.redrawAll();
    this.updateLayersListUI();
    //alert("Pasted as new layer.");
  };

  // ------------------------------------------------------------------------
  // Mouse
  // ------------------------------------------------------------------------
  PhotoEditor.prototype.onMouseDown = function (e) {
    this.isMouseDown = true;
    const { x, y } = this.getRealMouse(e);

    if (this.tool === "pen") {
      this.isDrawing = true;
      this.lastPenX = x;
      this.lastPenY = y;
      return;
    }
    if (this.tool === "text") {
      const txt = prompt("Enter text:", "Hello");
      if (!txt) { this.isMouseDown = false; return; }
      this.addTextLayer(x, y, txt);
      this.selectedLayerId = this.layers[this.layers.length - 1].id;
      this.redrawAll();
      this.updateLayersListUI();
      this.isMouseDown = false;
      return;
    }
    if (this.tool === "shape") {
      this.isShapeDrawing = true;
      this.shapeStartX = x;
      this.shapeStartY = y;
      return;
    }
    if (this.tool === "selectArea") {
      this.isAreaSelecting = true;
      this.areaSelectRect = { x, y, width: 0, height: 0 };
      return;
    }

    // select tool
    if (this.tool === "select") {
      const sel = this.getSelectedLayer();
      if (e.ctrlKey) {
        // quick pick topmost
        const clicked = this.getTopmostLayerAt(x, y);
        if (clicked) {
          this.selectedLayerId = clicked.id;
          const handle = this.getEdgeOrCornerHit(clicked, x, y);
          this.dragMode = handle || "move";
          this.setupDragVars(clicked, x, y);
          this.canvas.style.cursor = "move";
        } else {
          this.selectedLayerId = null;
          this.dragMode = null;
          this.canvas.style.cursor = "default";
        }
        this.updateLayersListUI();
        this.redrawAll();
        return;
      }
      if (sel && sel.visible) {
        const handle = this.getEdgeOrCornerHit(sel, x, y);
        if (handle) {
          this.dragMode = handle;
          this.setupDragVars(sel, x, y);
          this.canvas.style.cursor = this.getCursorForHandle(handle) || "move";
        } else {
          // inside bounding box?
          if (x >= sel.x && x <= sel.x + sel.width && y >= sel.y && y <= sel.y + sel.height) {
            this.dragMode = "move";
            this.setupDragVars(sel, x, y);
            this.canvas.style.cursor = "move";
          } else {
            // maybe another layer
            const clicked = this.getTopmostLayerAt(x, y);
            if (clicked) {
              this.selectedLayerId = clicked.id;
              const handle2 = this.getEdgeOrCornerHit(clicked, x, y);
              this.dragMode = handle2 || "move";
              this.setupDragVars(clicked, x, y);
              this.canvas.style.cursor = "move";
            } else {
              // none
              this.selectedLayerId = null;
              this.dragMode = null;
              this.canvas.style.cursor = "default";
            }
          }
        }
      } else {
        // no selection or hidden
        const clicked = this.getTopmostLayerAt(x, y);
        if (clicked) {
          this.selectedLayerId = clicked.id;
          const handle = this.getEdgeOrCornerHit(clicked, x, y);
          this.dragMode = handle || "move";
          this.setupDragVars(clicked, x, y);
          this.canvas.style.cursor = "move";
        } else {
          this.selectedLayerId = null;
          this.dragMode = null;
          this.canvas.style.cursor = "default";
        }
      }
      this.updateLayersListUI();
      this.redrawAll();
    }
  };
  PhotoEditor.prototype.setupDragVars = function (layer, x, y) {
    this.dragStartX = x;
    this.dragStartY = y;
    this.originalX = layer.x;
    this.originalY = layer.y;
    this.originalW = layer.width;
    this.originalH = layer.height;
    this.dragStartState = this.serializeLayer(layer, false);
  };
  PhotoEditor.prototype.onMouseMove = function (e) {
    const { x, y } = this.getRealMouse(e);
    if (this.tool === "pen" && this.isDrawing) {
      const layer = this.getSelectedLayer();
      if (!layer) return;
      const ctx = layer.offscreenCanvas.getContext("2d");
      const scaleX = layer.originalWidth / layer.width;
      const scaleY = layer.originalHeight / layer.height;
      const lx1 = (this.lastPenX - layer.x) * scaleX;
      const ly1 = (this.lastPenY - layer.y) * scaleY;
      const lx2 = (x - layer.x) * scaleX;
      const ly2 = (y - layer.y) * scaleY;
      const color = layer.isMask ? "#00ff00" : this.penColor;
      ctx.strokeStyle = color;
      ctx.lineWidth = this.penSize;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(lx1, ly1);
      ctx.lineTo(lx2, ly2);
      ctx.stroke();
      this.lastPenX = x;
      this.lastPenY = y;
      this.redrawAll();
      return;
    }
    if (this.tool === "shape" && this.isShapeDrawing) {
      const rx = Math.min(this.shapeStartX, x);
      const ry = Math.min(this.shapeStartY, y);
      const rw = Math.abs(x - this.shapeStartX);
      const rh = Math.abs(y - this.shapeStartY);
      this.currentShapeRect = { x: rx, y: ry, width: rw, height: rh };
      this.redrawAll();
      this.drawPreviewShape(this.currentShapeRect);
      return;
    }
    if (this.tool === "selectArea" && this.isAreaSelecting) {
      const rx = Math.min(this.areaSelectRect.x, x);
      const ry = Math.min(this.areaSelectRect.y, y);
      const rw = Math.abs(x - this.areaSelectRect.x);
      const rh = Math.abs(y - this.areaSelectRect.y);
      this.areaSelectRect = { x: rx, y: ry, width: rw, height: rh };
      this.redrawAll();
      this.drawAreaSelection(this.areaSelectRect);
      return;
    }
    if (!this.isMouseDown || !this.dragMode || this.tool !== "select") return;
    const layer = this.getSelectedLayer();
    if (!layer) return;
    const dx = x - this.dragStartX;
    const dy = y - this.dragStartY;
    const shift = e.shiftKey;
    if (this.dragMode === "move") {
      layer.x = this.originalX + dx;
      layer.y = this.originalY + dy;
      this.redrawAll();
      return;
    }
    // resizing
    if (this.dragMode === "resize-left") {
      const newW = this.originalW - dx;
      if (!shift) {
        const sc = newW / this.originalW;
        layer.width = Math.max(10, newW);
        layer.height = Math.max(10, this.originalH * sc);
        layer.x = this.originalX + (this.originalW - layer.width);
      } else {
        layer.x = this.originalX + dx;
        layer.width = Math.max(10, newW);
      }
    } else if (this.dragMode === "resize-right") {
      const newW = this.originalW + dx;
      if (!shift) {
        const sc = newW / this.originalW;
        layer.width = Math.max(10, newW);
        layer.height = Math.max(10, this.originalH * sc);
      } else {
        layer.width = Math.max(10, newW);
      }
    } else if (this.dragMode === "resize-top") {
      const newH = this.originalH - dy;
      if (!shift) {
        const sc = newH / this.originalH;
        layer.height = Math.max(10, newH);
        layer.width = Math.max(10, this.originalW * sc);
        layer.y = this.originalY + (this.originalH - layer.height);
      } else {
        layer.y = this.originalY + dy;
        layer.height = Math.max(10, newH);
      }
    } else if (this.dragMode === "resize-bottom") {
      const newH = this.originalH + dy;
      if (!shift) {
        const sc = newH / this.originalH;
        layer.height = Math.max(10, newH);
        layer.width = Math.max(10, this.originalW * sc);
      } else {
        layer.height = Math.max(10, newH);
      }
    } else {
      // corners
      let newW, newH;
      if (this.dragMode === "resize-tl") {
        newW = this.originalW - dx;
        newH = this.originalH - dy;
      } else if (this.dragMode === "resize-tr") {
        newW = this.originalW + dx;
        newH = this.originalH - dy;
      } else if (this.dragMode === "resize-bl") {
        newW = this.originalW - dx;
        newH = this.originalH + dy;
      } else {
        newW = this.originalW + dx;
        newH = this.originalH + dy;
      }
      if (!shift) {
        const scW = newW / this.originalW;
        const scH = newH / this.originalH;
        const sc = Math.min(scW, scH);
        layer.width = Math.max(10, this.originalW * sc);
        layer.height = Math.max(10, this.originalH * sc);
        if (this.dragMode === "resize-tl") {
          layer.x = this.originalX + (this.originalW - layer.width);
          layer.y = this.originalY + (this.originalH - layer.height);
        } else if (this.dragMode === "resize-tr") {
          layer.y = this.originalY + (this.originalH - layer.height);
        } else if (this.dragMode === "resize-bl") {
          layer.x = this.originalX + (this.originalW - layer.width);
        }
      } else {
        layer.width = Math.max(10, newW);
        layer.height = Math.max(10, newH);
        if (this.dragMode === "resize-tl") {
          layer.x = this.originalX + (this.originalW - layer.width);
          layer.y = this.originalY + (this.originalH - layer.height);
        } else if (this.dragMode === "resize-tr") {
          layer.y = this.originalY + (this.originalH - layer.height);
        } else if (this.dragMode === "resize-bl") {
          layer.x = this.originalX + (this.originalW - layer.width);
        }
      }
    }
    this.redrawAll();
  };
  PhotoEditor.prototype.onMouseUp = function (e) {
    this.isMouseDown = false;
    if (this.tool === "pen" && this.isDrawing) {
      this.isDrawing = false;
      // no undo for pen
      return;
    }
    if (this.tool === "shape" && this.isShapeDrawing) {
      this.isShapeDrawing = false;
      if (this.currentShapeRect) {
        const rect = this.currentShapeRect;
        const off = document.createElement("canvas");
        off.width = rect.width; off.height = rect.height;
        const ctx = off.getContext("2d");
        if (this.shapeType === "square") {
          const side = Math.min(rect.width, rect.height);
          if (this.shapeFill) {
            ctx.fillStyle = this.shapeColor;
            ctx.fillRect(0, 0, side, side);
          } else if (this.shapeStroke) {
            ctx.strokeStyle = this.shapeColor;
            ctx.lineWidth = this.shapeStrokeSize;
            ctx.strokeRect(0, 0, side, side);
          }
        }
        else if (this.shapeType === "circle") {
          const radius = Math.min(rect.width, rect.height) / 2;
          ctx.beginPath();
          ctx.arc(rect.width / 2, rect.height / 2, radius, 0, 2 * Math.PI);
          if (this.shapeFill) {
            ctx.fillStyle = this.shapeColor;
            ctx.fill();
          } else if (this.shapeStroke) {
            ctx.strokeStyle = this.shapeColor;
            ctx.lineWidth = this.shapeStrokeSize;
            ctx.stroke();
          }
        }
        else if (this.shapeType === "triangle") {
          ctx.beginPath();
          ctx.moveTo(rect.width / 2, 0);
          ctx.lineTo(0, rect.height);
          ctx.lineTo(rect.width, rect.height);
          ctx.closePath();
          if (this.shapeFill) {
            ctx.fillStyle = this.shapeColor;
            ctx.fill();
          } else if (this.shapeStroke) {
            ctx.strokeStyle = this.shapeColor;
            ctx.lineWidth = this.shapeStrokeSize;
            ctx.stroke();
          }
        }
        else {
          // rectangle
          if (this.shapeFill) {
            ctx.fillStyle = this.shapeColor;
            ctx.fillRect(0, 0, rect.width, rect.height);
          } else if (this.shapeStroke) {
            ctx.strokeStyle = this.shapeColor;
            ctx.lineWidth = this.shapeStrokeSize;
            ctx.strokeRect(0, 0, rect.width, rect.height);
          }
        }
        const newLayer = {
          id: this.nextLayerId++,
          x: rect.x, y: rect.y,
          width: rect.width, height: rect.height,
          originalWidth: rect.width, originalHeight: rect.height,
          visible: true,
          rotation: 0,
          opacity: 1,
          offscreenCanvas: off,
          isText: false,
          isMask: false,
          shapeType: this.shapeType
        };
        this.layers.push(newLayer);
        this.saveHistory({
          name: "layerAdded",
          layerId: newLayer.id,
          before: null,
          after: this.serializeLayer(newLayer, true)
        });
        this.selectedLayerId = newLayer.id;
        delete this.currentShapeRect;
        this.redrawAll();
        this.updateLayersListUI();
      }
      return;
    }
    if (this.tool === "selectArea" && this.isAreaSelecting) {
      this.isAreaSelecting = false;
      this.redrawAll();
      this.drawAreaSelection(this.areaSelectRect);
      return;
    }
    if (this.tool === "select" && this.dragMode) {
      const layer = this.getSelectedLayer();
      if (layer) {
        const newState = this.serializeLayer(layer, false);
        this.saveHistory({
          name: "layerModified",
          layerId: layer.id,
          before: this.dragStartState,
          after: newState
        });
      }
    }
    this.dragMode = null;
    if (this.tool === "pen") {
      this.canvas.style.cursor = "crosshair";
    } else if (this.tool === "text") {
      this.canvas.style.cursor = "text";
    } else {
      this.canvas.style.cursor = "default";
    }
  };
  PhotoEditor.prototype.onHover = function (e) {
    if (this.isMouseDown) return;
    if (this.tool !== "select") return;
    const { x, y } = this.getRealMouse(e);
    const sel = this.getSelectedLayer();
    if (sel && sel.visible) {
      const handle = this.getEdgeOrCornerHit(sel, x, y);
      if (handle) {
        this.canvas.style.cursor = this.getCursorForHandle(handle);
        return;
      } else {
        if (x >= sel.x && x <= sel.x + sel.width && y >= sel.y && y <= sel.y + sel.height) {
          this.canvas.style.cursor = "move";
          return;
        }
      }
    }
    const top = this.getTopmostLayerAt(x, y);
    this.canvas.style.cursor = top ? "move" : "default";
  };
  PhotoEditor.prototype.onDoubleClick = function (e) {
    console.log("Double-click at", this.getRealMouse(e));
  };

  // ------------------------------------------------------------------------
  // Previews
  // ------------------------------------------------------------------------
  PhotoEditor.prototype.drawPreviewShape = function (rect) {
    if (!rect) return;
    this.ctx.save();
    this.ctx.setLineDash([5, 5]);
    this.ctx.strokeStyle = this.shapeFill ? this.shapeColor : "#000";
    this.ctx.lineWidth = this.shapeStroke ? this.shapeStrokeSize : 2;
    this.ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    this.ctx.restore();
  };
  PhotoEditor.prototype.drawAreaSelection = function (rect) {
    if (!rect) return;
    this.ctx.save();
    this.ctx.setLineDash([4, 4]);
    this.ctx.strokeStyle = "#ff00ff";
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    this.ctx.restore();
  };

  // ------------------------------------------------------------------------
  // Pixel picking
  // ------------------------------------------------------------------------
  PhotoEditor.prototype.getTopmostLayerAt = function (x, y) {
    for (let i = this.layers.length - 1; i >= 0; i--) {
      const layer = this.layers[i];
      if (!layer.visible) continue;
      if (x < layer.x || x > layer.x + layer.width) continue;
      if (y < layer.y || y > layer.y + layer.height) continue;
      const localX = x - layer.x;
      const localY = y - layer.y;
      const scaleX = layer.originalWidth / layer.width;
      const scaleY = layer.originalHeight / layer.height;
      const testX = Math.floor(localX * scaleX);
      const testY = Math.floor(localY * scaleY);
      if (testX < 0 || testX >= layer.originalWidth || testY < 0 || testY >= layer.originalHeight) continue;
      this.offscreenCanvas.width = layer.originalWidth;
      this.offscreenCanvas.height = layer.originalHeight;
      this.offscreenCtx.clearRect(0, 0, layer.originalWidth, layer.originalHeight);
      this.offscreenCtx.drawImage(layer.offscreenCanvas, 0, 0);
      const pixel = this.offscreenCtx.getImageData(testX, testY, 1, 1).data;
      if (pixel[3] > 0) {
        return layer;
      }
    }
    return null;
  };

  // ------------------------------------------------------------------------
  // Redraw
  // ------------------------------------------------------------------------
  PhotoEditor.prototype.redrawAll = function () {
    this.ctx.clearRect(0, 0, this.width, this.height);
    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];
      if (!layer.visible) continue;
      if (layer.isText) {
        this.renderTextLayer(layer);
      }
      this.drawLayerWithTransform(layer);
    }
    if (this.tool === "selectArea" && this.areaSelectRect) {
      this.drawAreaSelection(this.areaSelectRect);
    }
  };
  PhotoEditor.prototype.drawLayerWithTransform = function (layer) {
    this.ctx.save();
    const cx = layer.x + layer.width / 2;
    const cy = layer.y + layer.height / 2;
    this.ctx.translate(cx, cy);
    const rad = (layer.rotation || 0) * Math.PI / 180;
    this.ctx.rotate(rad);
    const sx = layer.width / layer.originalWidth;
    const sy = layer.height / layer.originalHeight;
    this.ctx.scale(sx, sy);
    this.ctx.translate(-layer.originalWidth / 2, -layer.originalHeight / 2);
    this.ctx.globalAlpha = layer.opacity;

    // If mask => draw the green version
    let toDraw = layer.offscreenCanvas;
    if (layer.isMask) {
      toDraw = this.getMaskedCanvas(layer.offscreenCanvas);
    }
    this.ctx.drawImage(toDraw, 0, 0);

    // if selected, show bounding box + handles
    if (this.tool === "select" && layer.id === this.selectedLayerId) {
      this.ctx.save();
      this.ctx.strokeStyle = "#018dff";
      this.ctx.lineWidth = 2 / sx;
      this.ctx.strokeRect(0, 0, layer.originalWidth, layer.originalHeight);
      const s = 8 / sx;
      this.drawHandle(0, 0, s);
      this.drawHandle(layer.originalWidth, 0, s);
      this.drawHandle(0, layer.originalHeight, s);
      this.drawHandle(layer.originalWidth, layer.originalHeight, s);
      this.drawHandle(layer.originalWidth / 2, 0, s);
      this.drawHandle(layer.originalWidth / 2, layer.originalHeight, s);
      this.drawHandle(0, layer.originalHeight / 2, s);
      this.drawHandle(layer.originalWidth, layer.originalHeight / 2, s);
      this.ctx.restore();
    }

    this.ctx.restore();
  };
  PhotoEditor.prototype.drawHandle = function (x, y, size) {
    this.ctx.fillStyle = "#018dff";
    this.ctx.fillRect(x - size / 2, y - size / 2, size, size);
  };

  // Edges
  PhotoEditor.prototype.getEdgeOrCornerHit = function (layer, x, y) {
    const buffer = 8;
    const L = layer.x, R = layer.x + layer.width, T = layer.y, B = layer.y + layer.height;
    if (this.isNear(x, y, L, T, buffer)) return "resize-tl";
    if (this.isNear(x, y, R, T, buffer)) return "resize-tr";
    if (this.isNear(x, y, L, B, buffer)) return "resize-bl";
    if (this.isNear(x, y, R, B, buffer)) return "resize-br";
    if (this.isBetween(y, T, B) && Math.abs(x - L) <= buffer) return "resize-left";
    if (this.isBetween(y, T, B) && Math.abs(x - R) <= buffer) return "resize-right";
    if (this.isBetween(x, L, R) && Math.abs(y - T) <= buffer) return "resize-top";
    if (this.isBetween(x, L, R) && Math.abs(y - B) <= buffer) return "resize-bottom";
    return null;
  };
  PhotoEditor.prototype.getCursorForHandle = function (handle) {
    switch (handle) {
      case "resize-left":
      case "resize-right": return "ew-resize";
      case "resize-top":
      case "resize-bottom": return "ns-resize";
      case "resize-tl":
      case "resize-br": return "nwse-resize";
      case "resize-tr":
      case "resize-bl": return "nesw-resize";
      default: return "default";
    }
  };
  PhotoEditor.prototype.isNear = function (x, y, tx, ty, dist) {
    return (Math.abs(x - tx) <= dist && Math.abs(y - ty) <= dist);
  };
  PhotoEditor.prototype.isBetween = function (v, min, max) {
    return (v >= min && v <= max);
  };
  PhotoEditor.prototype.getSelectedLayer = function () {
    return this.layers.find(l => l.id === this.selectedLayerId);
  };

  // ------------------------------------------------------------------------
  // Layers UI
  // ------------------------------------------------------------------------
  PhotoEditor.prototype.updateLayersListUI = function () {
    if (!this.layersListEl) return;
    this.layersListEl.innerHTML = "";
    for (let i = this.layers.length - 1; i >= 0; i--) {
      const layer = this.layers[i];
      const row = document.createElement("div");
      row.classList.add("photo-editor-layer-row");
      if (layer.id === this.selectedLayerId) {
        row.classList.add("selected");
      }
      // show/hide
      const hideBtn = document.createElement("button");
      hideBtn.classList.add("photo-editor-button", "layer-control-button");
      if (layer.visible) {
        const iconShow = icons.find(ii => ii.key === 'show');
        hideBtn.innerHTML = iconShow ? `<img src="${iconShow.src}" alt="Hide" class="layer-option-icon"/>` : "Hide";
      } else {
        const iconHide = icons.find(ii => ii.key === 'hide');
        hideBtn.innerHTML = iconHide ? `<img src="${iconHide.src}" alt="Show" class="layer-option-icon"/>` : "Show";
        hideBtn.style.backgroundColor = 'red';
      }
      hideBtn.onclick = (evt) => {
        evt.stopPropagation();
        layer.visible = !layer.visible;
        this.redrawAll();
        this.updateLayersListUI();
      };
      row.appendChild(hideBtn);

      // Mask toggle
      const maskBtn = document.createElement("button");
      maskBtn.classList.add("photo-editor-button", "layer-control-button");
      //maskBtn.textContent = layer.isMask ? "Mask On" : "Mask Off";

      if (layer.isMask) {
        const iconShow = icons.find(ii => ii.key === 'mask');
        maskBtn.innerHTML = iconShow ? `<img src="${iconShow.src}" alt="Hide" class="layer-option-icon"/>` : "Hide";
        maskBtn.style.backgroundColor = 'green';

      } else {
        const iconHide = icons.find(ii => ii.key === 'mask');
        maskBtn.innerHTML = iconHide ? `<img src="${iconHide.src}" alt="Show" class="layer-option-icon"/>` : "Show";
      }

      maskBtn.onclick = (evt) => {
        evt.stopPropagation();
        const oldState = this.serializeLayer(layer, false);
        layer.isMask = !layer.isMask;
        const newState = this.serializeLayer(layer, false);
        this.saveHistory({ name: "layerModified", layerId: layer.id, before: oldState, after: newState });
        this.updateLayersListUI();
        this.redrawAll();
      };
      row.appendChild(maskBtn);

      // Preview
      const preview = this.createLayerPreview(layer, 80, 50);
      preview.classList.add("layer-preview-canvas");
      row.appendChild(preview);

      // Label
      const textSpan = document.createElement("span");
      if (layer.isMask) {
        textSpan.textContent = "Mask Layer";
      } else if (layer.isText) {
        textSpan.textContent = "Text Layer";
      } else if (layer.shapeType) {
        textSpan.textContent = "Shape Layer";
      } else {
        textSpan.textContent = "Image Layer";
      }
      row.appendChild(textSpan);

      row.onclick = () => {
        this.selectedLayerId = layer.id;
        this.redrawAll();
        this.updateLayersListUI();
        this.syncSelectedLayerOptions();
      };

      // up/down
      const upBtn = document.createElement("button");
      upBtn.classList.add("photo-editor-button", "layer-control-button");
      {
        const icon = icons.find(ii => ii.key === 'sort_up');
        upBtn.innerHTML = icon ? `<img src="${icon.src}" alt="Up" class="layer-option-icon"/>` : "Up";
      }
      upBtn.onclick = (evt) => {
        evt.stopPropagation();
        this.moveLayerUp(layer.id);
      };
      row.appendChild(upBtn);

      const downBtn = document.createElement("button");
      downBtn.classList.add("photo-editor-button", "layer-control-button");
      {
        const icon = icons.find(ii => ii.key === 'sort_down');
        downBtn.innerHTML = icon ? `<img src="${icon.src}" alt="Down" class="layer-option-icon"/>` : "Down";
      }
      downBtn.onclick = (evt) => {
        evt.stopPropagation();
        this.moveLayerDown(layer.id);
      };
      row.appendChild(downBtn);

      this.layersListEl.appendChild(row);
    }
    this.syncSelectedLayerOptions();
  };
  PhotoEditor.prototype.createLayerPreview = function (layer, w, h) {
    const previewCanvas = document.createElement("canvas");
    previewCanvas.width = w; previewCanvas.height = h;
    const ctx = previewCanvas.getContext("2d");
    ctx.clearRect(0, 0, w, h);
    const scale = Math.min(w / layer.originalWidth, h / layer.originalHeight);
    const newW = layer.originalWidth * scale;
    const newH = layer.originalHeight * scale;
    const offX = (w - newW) / 2;
    const offY = (h - newH) / 2;

    if (layer.isText) {
      this.renderTextLayer(layer);
    }

    // if isMask => draw green version
    let toDraw = layer.offscreenCanvas;
    if (layer.isMask) {
      toDraw = this.getMaskedCanvas(layer.offscreenCanvas);
    }
    ctx.drawImage(toDraw, offX, offY, newW, newH);
    return previewCanvas;
  };
  PhotoEditor.prototype.syncSelectedLayerOptions = function () {
    const layer = this.getSelectedLayer();
    if (!layer) {
      this.rotateInput.value = 0;
      this.opacityInput.value = 1;
      return;
    }
    this.rotateInput.value = layer.rotation || 0;
    this.opacityInput.value = layer.opacity || 1;
    this.rotateInput.dispatchEvent(new Event("input"));
    this.opacityInput.dispatchEvent(new Event("input"));
  };
  PhotoEditor.prototype.moveLayerUp = function (layerId) {
    const i = this.layers.findIndex(l => l.id === layerId);
    if (i < 0 || i === this.layers.length - 1) return;
    const tmp = this.layers[i];
    this.layers[i] = this.layers[i + 1];
    this.layers[i + 1] = tmp;
    this.redrawAll();
    this.updateLayersListUI();
  };
  PhotoEditor.prototype.moveLayerDown = function (layerId) {
    const i = this.layers.findIndex(l => l.id === layerId);
    if (i <= 0) return;
    const tmp = this.layers[i];
    this.layers[i] = this.layers[i - 1];
    this.layers[i - 1] = tmp;
    this.redrawAll();
    this.updateLayersListUI();
  };
  PhotoEditor.prototype.removeSelectedLayer = function () {
    const layer = this.getSelectedLayer();
    if (!layer) return;
    const before = this.serializeLayer(layer, true);
    this.layers = this.layers.filter(l => l.id !== layer.id);
    this.saveHistory({
      name: "layerRemoved",
      layerId: layer.id,
      before: before,
      after: null
    });
    this.selectedLayerId = null;
    this.redrawAll();
    this.updateLayersListUI();
  };

  // ------------------------------------------------------------------------
  // finishEditing -> returns JSON with:
  //  {
  //    "image": <all layers flattened (mask layers in green) as base64>,
  //    "layers": [
  //      { "data": <layer individually as base64 (mask => green)>,
  //        "type": "mask|text|shape|image" },
  //      ...
  //    ],
  //    "masks": <flattened image of all mask layers in green, or "" if none>
  //  }
  // ------------------------------------------------------------------------
  PhotoEditor.prototype.finishEditing = function () {
    // 1) Flatten all layers (if mask => green) -> final image
    const finalImageBase64 = this.flattenAllLayers(true); // pass 'true' => treat mask as green

    // 2) Each layer => base64 + type
    const layersArray = this.layers.map(layer => {
      return {
        data: this.flattenSingleLayer(layer),
        type: this.getLayerType(layer)
      };
    });

    // 3) Flatten only mask layers -> if no mask => ""
    const maskLayers = this.layers.filter(l => l.isMask);
    let maskImageBase64 = "";
    if (maskLayers.length > 0) {
      maskImageBase64 = this.flattenMaskLayers(maskLayers);
    }

    const result = {
      image: finalImageBase64,
      layers: layersArray,
      masks: maskImageBase64
    };

    if (typeof this.onComplete === "function") {
      this.onComplete(result);
    }
  };

  // Helper: get layer type
  PhotoEditor.prototype.getLayerType = function (layer) {
    if (layer.isMask) return "mask";
    if (layer.isText) return "text";
    if (layer.shapeType && layer.shapeType !== "") return "shape";
    return "image";
  };

  // Flatten all layers into a single image (mask => green if doGreen)
  PhotoEditor.prototype.flattenAllLayers = function (doGreen) {
    const tmp = document.createElement("canvas");
    tmp.width = this.width;
    tmp.height = this.height;
    const ctx = tmp.getContext("2d");
    ctx.clearRect(0, 0, this.width, this.height);

    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];
      if (!layer.visible) continue;
      ctx.save();
      const cx = layer.x + layer.width / 2;
      const cy = layer.y + layer.height / 2;
      ctx.translate(cx, cy);
      const rad = (layer.rotation || 0) * Math.PI / 180;
      ctx.rotate(rad);
      const sx = layer.width / layer.originalWidth;
      const sy = layer.height / layer.originalHeight;
      ctx.scale(sx, sy);
      ctx.translate(-layer.originalWidth / 2, -layer.originalHeight / 2);
      ctx.globalAlpha = layer.opacity;
      let toDraw = layer.offscreenCanvas;
      if (doGreen && layer.isMask) {
        toDraw = this.getMaskedCanvas(layer.offscreenCanvas);
      }
      ctx.drawImage(toDraw, 0, 0);
      ctx.restore();
    }
    return tmp.toDataURL("image/png");
  };

  // Flatten just the mask layers => green
  PhotoEditor.prototype.flattenMaskLayers = function (maskLayers) {
    // same approach
    const tmp = document.createElement("canvas");
    tmp.width = this.width;
    tmp.height = this.height;
    const ctx = tmp.getContext("2d");
    ctx.clearRect(0, 0, this.width, this.height);

    for (let i = 0; i < maskLayers.length; i++) {
      const layer = maskLayers[i];
      if (!layer.visible) continue;
      ctx.save();
      const cx = layer.x + layer.width / 2;
      const cy = layer.y + layer.height / 2;
      ctx.translate(cx, cy);
      const rad = (layer.rotation || 0) * Math.PI / 180;
      ctx.rotate(rad);
      const sx = layer.width / layer.originalWidth;
      const sy = layer.height / layer.originalHeight;
      ctx.scale(sx, sy);
      ctx.translate(-layer.originalWidth / 2, -layer.originalHeight / 2);
      ctx.globalAlpha = layer.opacity;
      const toDraw = this.getMaskedCanvas(layer.offscreenCanvas);
      ctx.drawImage(toDraw, 0, 0);
      ctx.restore();
    }
    return tmp.toDataURL("image/png");
  };

  // Flatten single layer alone (if mask => green)
  PhotoEditor.prototype.flattenSingleLayer = function (layer) {
    // Just draw the layer's offscreenCanvas or green version with its original size
    // to a temporary canvas. Return dataURL.
    const w = layer.originalWidth, h = layer.originalHeight;
    const tmp = document.createElement("canvas");
    tmp.width = w; tmp.height = h;
    const ctx = tmp.getContext("2d");
    ctx.clearRect(0, 0, w, h);
    const toDraw = layer.isMask ? this.getMaskedCanvas(layer.offscreenCanvas) : layer.offscreenCanvas;
    ctx.drawImage(toDraw, 0, 0);
    return tmp.toDataURL("image/png");
  };

  // Expose
  global.PhotoEditor = PhotoEditor;
})(window);