// Get the directory of the currently executing script
const scriptPath = document.currentScript.src;  // Full path of the script file
const scriptDir = scriptPath.substring(0, scriptPath.lastIndexOf('/')); // Extract directory

// Update the icons array to use the correct base path
var icons = [
  { key: 'pen-tool', src: `${scriptDir}/icons/pen.svg` },
  { key: 'text-tool', src: `${scriptDir}/icons/text.svg` },
  { key: 'select-tool', src: `${scriptDir}/icons/select.svg` },
  { key: 'show', src: `${scriptDir}/icons/show.svg` },
  { key: 'hide', src: `${scriptDir}/icons/hide.svg` },
  { key: 'sort_down', src: `${scriptDir}/icons/sort_down.svg` },
  { key: 'sort_up', src: `${scriptDir}/icons/sort_up.svg` },
  { key: 'new_layer', src: `${scriptDir}/icons/new_layer.svg` },
  { key: 'delete_layer', src: `${scriptDir}/icons/delete.svg` },
  { key: 'new_image', src: `${scriptDir}/icons/new_image.svg` },

  // Optional zoom icons
  { key: 'zoom-in', src: `${scriptDir}/icons/zoom_in.svg` },
  { key: 'zoom-out', src: `${scriptDir}/icons/zoom_out.svg` },
  { key: 'fit-screen', src: `${scriptDir}/icons/fit_screen.svg` }
];

console.log("Icons Path Adjusted:", icons);


// -----------------------------------------------
// 2) PhotoEditor CLASS
// -----------------------------------------------
(function (global) {
  "use strict";

  function PhotoEditor() {
    // Container / Canvas
    this.container = null;
    this.canvas = null;
    this.ctx = null;
    this.width = 800;
    this.height = 600;

    // Tools: "select", "pen", "text"
    this.tool = "select";

    // Layers
    this.layers = [];
    this.selectedLayerId = null;
    this.nextLayerId = 1;

    // Zoom factor (CSS scale)
    this.zoomFactor = 1;

    // Mouse / drag
    this.isMouseDown = false;
    this.dragMode = null; // e.g. "move", "resize-...", etc.
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.originalX = 0;
    this.originalY = 0;
    this.originalW = 0;
    this.originalH = 0;

    // Offscreen for pixel-based picking
    this.offscreenCanvas = document.createElement("canvas");
    this.offscreenCtx = this.offscreenCanvas.getContext("2d");

    // Pen
    this.penColor = "#ff0000";
    this.penSize = 5;
    this.isDrawing = false;

    // Callback when "Finish" is clicked
    this.onComplete = null;
  }

  // ------------------------------------------------------------------------
  // init(...)
  // ------------------------------------------------------------------------
  PhotoEditor.prototype.init = function (
    containerDiv,
    width,
    height,
    imageUrls,
    finishCallback
  ) {
    this.container = containerDiv;
    this.width = width;
    this.height = height;
    this.imageUrls = imageUrls || [];
    this.onComplete = finishCallback || function () { };

    // Clear container & add main class
    this.container.innerHTML = "";
    this.container.classList.add("photo-editor-container");

    // ==================================
    // LEFT PANEL
    // ==================================
    const leftPanel = document.createElement("div");
    leftPanel.classList.add("photo-editor-left-panel");

    const toolsTitle = document.createElement("div");
    toolsTitle.classList.add("photo-editor-tools-title");
    toolsTitle.textContent = "Tools";
    leftPanel.appendChild(toolsTitle);

    // 1) SELECT tool
    const selectBtn = document.createElement("button");
    selectBtn.classList.add("photo-editor-button");
    selectBtn.id = 'tool-button-select';
    selectBtn.title = "Use the Select Tool";
    {
      const icon = icons.find(i => i.key === 'select-tool');
      if (icon) {
        selectBtn.innerHTML = `<img src="${icon.src}" alt="Select" class="photo-editor-icon" />`;
      } else {
        selectBtn.textContent = "Select";
      }
    }
    selectBtn.onclick = () => {
      this.tool = "select";
      this.updateToolUI();
    };
    leftPanel.appendChild(selectBtn);

    // 2) PEN tool
    const penBtn = document.createElement("button");
    penBtn.classList.add("photo-editor-button");
    penBtn.id = 'tool-button-pen';
    penBtn.title = "Use the Pen Tool";
    {
      const icon = icons.find(i => i.key === 'pen-tool');
      if (icon) {
        penBtn.innerHTML = `<img src="${icon.src}" alt="Pen" class="photo-editor-icon" />`;
      } else {
        penBtn.textContent = "Pen";
      }
    }
    penBtn.onclick = () => {
      this.tool = "pen";
      this.updateToolUI();
    };
    leftPanel.appendChild(penBtn);

    // 3) TEXT tool
    const textBtn = document.createElement("button");
    textBtn.classList.add("photo-editor-button");
    textBtn.id = 'tool-button-text';
    textBtn.title = "Use the Text Tool";
    {
      const icon = icons.find(i => i.key === 'text-tool');
      if (icon) {
        textBtn.innerHTML = `<img src="${icon.src}" alt="Text" class="photo-editor-icon" />`;
      } else {
        textBtn.textContent = "Text";
      }
    }
    textBtn.onclick = () => {
      this.tool = "text";
      this.updateToolUI();
    };
    leftPanel.appendChild(textBtn);

    const break_left_panel = document.createElement("div");
    break_left_panel.className = 'left-panel-break';
    leftPanel.appendChild(break_left_panel);

    // Zoom In
    const zoomInBtn = document.createElement("button");
    zoomInBtn.classList.add("photo-editor-button");
    zoomInBtn.title = "Zoom In";
    {
      const icon = icons.find(i => i.key === 'zoom-in');
      if (icon) {
        zoomInBtn.innerHTML = `<img src="${icon.src}" alt="Zoom In" class="photo-editor-icon" />`;
      } else {
        zoomInBtn.textContent = "+";
      }
    }
    zoomInBtn.onclick = () => {
      this.changeZoom(1.2);
    };
    leftPanel.appendChild(zoomInBtn);

    // Zoom Out
    const zoomOutBtn = document.createElement("button");
    zoomOutBtn.classList.add("photo-editor-button");
    zoomOutBtn.title = "Zoom Out";
    {
      const icon = icons.find(i => i.key === 'zoom-out');
      if (icon) {
        zoomOutBtn.innerHTML = `<img src="${icon.src}" alt="Zoom Out" class="photo-editor-icon" />`;
      } else {
        zoomOutBtn.textContent = "-";
      }
    }
    zoomOutBtn.onclick = () => {
      this.changeZoom(0.8);
    };
    leftPanel.appendChild(zoomOutBtn);

    // Fit
    const fitBtn = document.createElement("button");
    fitBtn.classList.add("photo-editor-button");
    fitBtn.title = "Fit to Screen";
    {
      const icon = icons.find(i => i.key === 'fit-screen');
      if (icon) {
        fitBtn.innerHTML = `<img src="${icon.src}" alt="Fit" class="photo-editor-icon" />`;
      } else {
        fitBtn.textContent = "Fit";
      }
    }
    fitBtn.onclick = () => {
      this.fitToScreen();
    };
    leftPanel.appendChild(fitBtn);



    // ==================================
    // CENTER PANEL
    // ==================================
    const centerPanel = document.createElement("div");
    centerPanel.classList.add("photo-editor-center-panel");

    // Canvas wrapper (for overflow hidden if needed)
    const canvasWrapper = document.createElement("div");
    canvasWrapper.classList.add("photo-editor-canvas-wrapper");
    centerPanel.appendChild(canvasWrapper);

    // Actual canvas
    this.canvas = document.createElement("canvas");
    this.canvas.classList.add("photo-editor-canvas");
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.canvas.style.transformOrigin = "top left"; // important for CSS zoom
    canvasWrapper.appendChild(this.canvas);



    // Attach canvas events
    this.ctx = this.canvas.getContext("2d");
    this.canvas.addEventListener("mousedown", this.onMouseDown.bind(this));
    this.canvas.addEventListener("mousemove", this.onMouseMove.bind(this));
    this.canvas.addEventListener("mouseup", this.onMouseUp.bind(this));
    this.canvas.addEventListener("mouseout", this.onMouseUp.bind(this));
    this.canvas.addEventListener("mousemove", this.onHover.bind(this));
    this.canvas.addEventListener("dblclick", this.onDoubleClick.bind(this));

    // Optional: zoom with Ctrl+Alt + wheel
    this.canvas.addEventListener("wheel", (e) => {
      if (e.ctrlKey && e.altKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          this.changeZoom(1.1);
        } else {
          this.changeZoom(0.9);
        }
      }
    }, { passive: false });

    // ==================================
    // RIGHT PANEL
    // ==================================
    const rightPanel = document.createElement("div");
    rightPanel.classList.add("photo-editor-right-panel");

    // OPTIONS BOX
    const optionsBox = document.createElement("div");
    optionsBox.classList.add("photo-editor-options-box");

    const optionsTitle = document.createElement("div");
    optionsTitle.classList.add("photo-editor-options-title");
    optionsTitle.textContent = "Tool Options";
    optionsBox.appendChild(optionsTitle);

    // Create a container div for select tool options
    const selectOptionsDiv = document.createElement("div");
    selectOptionsDiv.classList.add("photo-editor-select-options");

    // ================================
    // 1) ROTATION
    // ================================
    const rotRow = document.createElement("div");
    rotRow.classList.add("photo-editor-option-row");
    // (Use a CSS class like .photo-editor-option-row to style horizontally, etc.)

    const rotLabel = document.createElement("label");
    rotLabel.textContent = "Rotation:";
    rotRow.appendChild(rotLabel);

    // The rotation slider
    const rotSlider = document.createElement("input");
    rotSlider.type = "range";
    rotSlider.min = "0";
    rotSlider.max = "360";
    rotSlider.value = "0";
    rotSlider.step = "1";
    rotSlider.style.margin = "0 8px";
    rotRow.appendChild(rotSlider);

    // A small span to show the numeric value (e.g. "45°")
    const rotValueSpan = document.createElement("span");
    rotValueSpan.textContent = "0°";
    rotRow.appendChild(rotValueSpan);

    // Listen for changes on the slider
    rotSlider.oninput = () => {
      const layer = this.getSelectedLayer();
      if (!layer) return;
      layer.rotation = parseFloat(rotSlider.value) || 0;
      // Update the text readout (e.g. "50°")
      rotValueSpan.textContent = rotSlider.value + "°";

      this.redrawAll();
    };

    // ================================
    // 2) OPACITY
    // ================================
    const opRow = document.createElement("div");
    opRow.classList.add("photo-editor-option-row");

    const opLabel = document.createElement("label");
    opLabel.textContent = "Opacity:";
    opRow.appendChild(opLabel);

    // The opacity slider
    const opSlider = document.createElement("input");
    opSlider.type = "range";
    opSlider.min = "0";
    opSlider.max = "1";
    opSlider.step = "0.01";
    opSlider.value = "1";
    opSlider.style.margin = "0 8px";
    opRow.appendChild(opSlider);

    // A span to display numeric opacity
    const opValueSpan = document.createElement("span");
    opValueSpan.textContent = "1.00";
    opRow.appendChild(opValueSpan);

    // Listen for changes on the slider
    opSlider.oninput = () => {
      const layer = this.getSelectedLayer();
      if (!layer) return;
      layer.opacity = parseFloat(opSlider.value);
      // Update the readout (e.g. "0.75")
      opValueSpan.textContent = parseFloat(opSlider.value).toFixed(2);

      this.redrawAll();
    };

    // Finally, append the rows to the options container
    selectOptionsDiv.appendChild(rotRow);
    selectOptionsDiv.appendChild(opRow);


    // PEN options container (initially hidden)
const penOptionsDiv = document.createElement("div");
penOptionsDiv.style.display = "none";
penOptionsDiv.classList.add("photo-editor-pen-options");

// --------------------------
// 1) Pen Color
// --------------------------
const colorRow = document.createElement("div");
colorRow.classList.add("photo-editor-option-row");

const penColorLabel = document.createElement("label");
penColorLabel.textContent = "Pen Color:";
colorRow.appendChild(penColorLabel);

// A larger color input
const penColorInput = document.createElement("input");
penColorInput.type = "color";
penColorInput.value = this.penColor;
// Example: style to make the color box bigger
penColorInput.style.width  = "48px";
penColorInput.style.height = "32px";
penColorInput.style.border = "none";
penColorInput.onchange = () => {
  this.penColor = penColorInput.value;
};
colorRow.appendChild(penColorInput);

penOptionsDiv.appendChild(colorRow);

// --------------------------
// 2) Pen Size (slider)
// --------------------------
const sizeRow = document.createElement("div");
sizeRow.classList.add("photo-editor-option-row");

const penSizeLabel = document.createElement("label");
penSizeLabel.textContent = "Pen Size:";
sizeRow.appendChild(penSizeLabel);

// A range slider for pen size
const penSizeSlider = document.createElement("input");
penSizeSlider.type = "range";
penSizeSlider.min = "1";
penSizeSlider.max = "50";
penSizeSlider.step = "1";
penSizeSlider.value = String(this.penSize);
penSizeSlider.style.margin = "0 8px";
sizeRow.appendChild(penSizeSlider);

// A small span to show numeric size
const penSizeValueSpan = document.createElement("span");
penSizeValueSpan.textContent = String(this.penSize);
sizeRow.appendChild(penSizeValueSpan);

// Update the pen size on input
penSizeSlider.oninput = () => {
  this.penSize = parseInt(penSizeSlider.value, 10);
  penSizeValueSpan.textContent = String(this.penSize);
};

penOptionsDiv.appendChild(sizeRow);

// Finally, add penOptionsDiv to wherever the “Tool Options” are:
optionsBox.appendChild(penOptionsDiv);


    // TEXT options (hidden in minimal example)
    const textOptionsDiv = document.createElement("div");
    textOptionsDiv.style.display = "none";

    // Combine sub-panels
    optionsBox.appendChild(selectOptionsDiv);
    optionsBox.appendChild(penOptionsDiv);
    optionsBox.appendChild(textOptionsDiv);

    // LAYERS BOX
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

    // LAYER ACTIONS
    const layerActions = document.createElement("div");
    layerActions.classList.add("photo-editor-layer-actions");

    // New Empty Layer
    const addEmptyBtn = document.createElement("button");
    addEmptyBtn.classList.add("photo-editor-button-layers");
    {
      const icon = icons.find(i => i.key === 'new_layer');
      if (icon) {
        addEmptyBtn.innerHTML = `<img src="${icon.src}" alt="New Layer" class="photo-editor-icon" />`;
      } else {
        addEmptyBtn.textContent = "New Layer";
      }
    }
    addEmptyBtn.onclick = this.addEmptyLayer.bind(this);
    layerActions.appendChild(addEmptyBtn);

    // Add Image Layer
    const addImageBtn = document.createElement("button");
    addImageBtn.classList.add("photo-editor-button-layers");
    {
      const icon = icons.find(i => i.key === 'new_image');
      if (icon) {
        addImageBtn.innerHTML = `<img src="${icon.src}" alt="Add Image" class="photo-editor-icon" />`;
      } else {
        addImageBtn.textContent = "Add Image";
      }
    }
    addImageBtn.onclick = this.addImageLayer.bind(this);
    layerActions.appendChild(addImageBtn);

    // Remove Layer
    const removeBtn = document.createElement("button");
    removeBtn.classList.add("photo-editor-button-layers");
    {
      const icon = icons.find(i => i.key === 'delete_layer');
      if (icon) {
        removeBtn.innerHTML = `<img src="${icon.src}" alt="Delete" class="photo-editor-icon" />`;
      } else {
        removeBtn.textContent = "Remove";
      }
    }
    removeBtn.onclick = this.removeSelectedLayer.bind(this);
    layerActions.appendChild(removeBtn);

    // Finish
    const finishBtn = document.createElement("button");
    finishBtn.classList.add("photo-editor-finish");
    finishBtn.textContent = "Finish";
    finishBtn.onclick = this.finishEditing.bind(this);
    layerActions.appendChild(finishBtn);

    layersBox.appendChild(layerActions);

    // Put Options + Layers into right panel
    rightPanel.appendChild(optionsBox);
    rightPanel.appendChild(layersBox);

    // Append sub-panels
    this.container.appendChild(leftPanel);
    this.container.appendChild(centerPanel);
    this.container.appendChild(rightPanel);

    // Keep references
    this.selectOptionsDiv = selectOptionsDiv;
    this.penOptionsDiv = penOptionsDiv;
    this.textOptionsDiv = textOptionsDiv;

    this.rotateInput = rotSlider;
    this.opacityInput = opSlider;

    // Load initial images (if any)
    this.loadInitialImages();

    // Update UI
    this.updateToolUI();
    // Initial draw
    this.redrawAll();
  };

  // ------------------------------------------------------------------------
  // Zoom & Helpers
  // ------------------------------------------------------------------------
  PhotoEditor.prototype.changeZoom = function (factor) {
    this.zoomFactor *= factor;
    if (this.zoomFactor < 0.1) this.zoomFactor = 0.1;
    if (this.zoomFactor > 10) this.zoomFactor = 10;
    this.canvas.style.transform = `scale(${this.zoomFactor})`;
  };

  PhotoEditor.prototype.fitToScreen = function () {
    const centerPanel = this.container.querySelector('.photo-editor-center-panel');
    if (!centerPanel) return;
    const availW = centerPanel.clientWidth - 20;
    const availH = centerPanel.clientHeight - 100;
    if (availW <= 10 || availH <= 10) return;

    const sx = availW / this.width;
    const sy = availH / this.height;
    const scale = Math.min(sx, sy);

    this.zoomFactor = scale;
    if (this.zoomFactor < 0.1) this.zoomFactor = 0.1;
    if (this.zoomFactor > 10) this.zoomFactor = 10;
    this.canvas.style.transform = `scale(${this.zoomFactor})`;
  };

  // Convert mouse offsetX/Y to "real" unscaled coords
  PhotoEditor.prototype.getRealMouse = function (e) {
    const realX = e.offsetX;/// this.zoomFactor;
    const realY = e.offsetY;/// this.zoomFactor;
    return { x: realX, y: realY };
  };

  // ------------------------------------------------------------------------
  // Tools UI
  // ------------------------------------------------------------------------
  PhotoEditor.prototype.updateToolUI = function () {
    // Hide sub-panels
    this.selectOptionsDiv.style.display = "none";
    this.penOptionsDiv.style.display = "none";
    this.textOptionsDiv.style.display = "none";

    // Unselect all .photo-editor-button
    document.querySelectorAll('.photo-editor-button').forEach(el => {
      el.classList.remove('photo-editor-button-selected');
    });

    // Select the current tool's button
    const btn = document.getElementById('tool-button-' + this.tool);
    if (btn) {
      btn.classList.add('photo-editor-button-selected');
    }

    // Show relevant panel
    if (this.tool === "select") {
      this.selectOptionsDiv.style.display = "block";
      this.canvas.style.cursor = "default";
    } else if (this.tool === "pen") {
      this.penOptionsDiv.style.display = "block";
      this.canvas.style.cursor = "crosshair";
    } else if (this.tool === "text") {
      this.textOptionsDiv.style.display = "block";
      this.canvas.style.cursor = "text";
    }
  };

  // ------------------------------------------------------------------------
  // Loading initial images
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
        const w = img.width;
        const h = img.height;
        // fit into editor if bigger
        const sw = this.width / w;
        const sh = this.height / h;
        const sc = Math.min(sw, sh, 1);
        const displayW = w * sc;
        const displayH = h * sc;

        // Offscreen
        const off = document.createElement("canvas");
        off.width = w;
        off.height = h;
        off.getContext("2d").drawImage(img, 0, 0);

        this.layers.push({
          id: this.nextLayerId++,
          x: 0, y: 0,
          width: displayW,
          height: displayH,
          originalWidth: w,
          originalHeight: h,
          visible: true,
          rotation: 0,
          opacity: 1,
          offscreenCanvas: off,
          isText: false
        });
        this.redrawAll();
        this.updateLayersListUI();
      };
      img.src = url;
    });
  };

  // ------------------------------------------------------------------------
  // Layer creation
  // ------------------------------------------------------------------------
  PhotoEditor.prototype.addEmptyLayer = function () {
    const off = document.createElement("canvas");
    off.width = this.width;
    off.height = this.height;

    this.layers.push({
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
      isText: false
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
          const w = img.width;
          const h = img.height;
          const sw = this.width / w;
          const sh = this.height / h;
          const sc = Math.min(sw, sh, 1);
          const displayW = w * sc;
          const displayH = h * sc;

          const off = document.createElement("canvas");
          off.width = w;
          off.height = h;
          off.getContext("2d").drawImage(img, 0, 0);

          this.layers.push({
            id: this.nextLayerId++,
            x: 0, y: 0,
            width: displayW,
            height: displayH,
            originalWidth: w,
            originalHeight: h,
            visible: true,
            rotation: 0,
            opacity: 1,
            offscreenCanvas: off,
            isText: false
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

  // Add text layer at the mouse position
  PhotoEditor.prototype.addTextLayer = function (x, y, text) {
    const w = 300;
    const h = 100;
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;

    const newLayer = {
      id: this.nextLayerId++,
      x: x,
      y: y,
      width: w,
      height: h,
      originalWidth: w,
      originalHeight: h,
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
      italic: false
    };
    this.renderTextLayer(newLayer);
    this.layers.push(newLayer);

    this.redrawAll();
    this.updateLayersListUI();
  };

  // Render text to its offscreen
  PhotoEditor.prototype.renderTextLayer = function (layer) {
    const ctx = layer.offscreenCanvas.getContext("2d");
    ctx.clearRect(0, 0, layer.originalWidth, layer.originalHeight);

    const weight = layer.bold ? "bold" : "normal";
    const style = layer.italic ? "italic" : "normal";
    ctx.font = `${style} ${weight} ${layer.fontSize}px ${layer.fontFamily}`;
    ctx.fillStyle = layer.textColor;
    ctx.textBaseline = "top";

    const lines = layer.textContent.split("\n");
    const lineHeight = layer.fontSize * 1.2;
    let cursorY = 0;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], 0, cursorY);
      cursorY += lineHeight;
    }
  };

  // ------------------------------------------------------------------------
  // Remove layer
  // ------------------------------------------------------------------------
  PhotoEditor.prototype.removeSelectedLayer = function () {
    if (!this.selectedLayerId) {
      alert("No layer selected.");
      return;
    }
    this.layers = this.layers.filter(l => l.id !== this.selectedLayerId);
    this.selectedLayerId = null;
    this.redrawAll();
    this.updateLayersListUI();
  };

  PhotoEditor.prototype.moveLayerUp = function (layerId) {
    const idx = this.layers.findIndex(l => l.id === layerId);
    if (idx < 0 || idx === this.layers.length - 1) return;
    const temp = this.layers[idx];
    this.layers[idx] = this.layers[idx + 1];
    this.layers[idx + 1] = temp;
    this.redrawAll();
    this.updateLayersListUI();
  };

  PhotoEditor.prototype.moveLayerDown = function (layerId) {
    const idx = this.layers.findIndex(l => l.id === layerId);
    if (idx <= 0) return;
    const temp = this.layers[idx];
    this.layers[idx] = this.layers[idx - 1];
    this.layers[idx - 1] = temp;
    this.redrawAll();
    this.updateLayersListUI();
  };

  // ------------------------------------------------------------------------
  // Finish => Flatten
  // ------------------------------------------------------------------------
  PhotoEditor.prototype.finishEditing = function () {
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = this.width;
    tempCanvas.height = this.height;
    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.clearRect(0, 0, this.width, this.height);

    // Draw each layer at full resolution
    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];
      if (!layer.visible) continue;
      if (layer.isText) {
        this.renderTextLayer(layer);
      }

      tempCtx.save();
      tempCtx.globalAlpha = layer.opacity;

      // same transform approach
      const cx = layer.x + layer.width / 2;
      const cy = layer.y + layer.height / 2;
      tempCtx.translate(cx, cy);
      tempCtx.rotate((layer.rotation || 0) * Math.PI / 180);
      const sx = layer.width / layer.originalWidth;
      const sy = layer.height / layer.originalHeight;
      tempCtx.scale(sx, sy);
      tempCtx.translate(-layer.originalWidth / 2, -layer.originalHeight / 2);

      tempCtx.drawImage(layer.offscreenCanvas, 0, 0);
      tempCtx.restore();
    }

    const dataUrl = tempCanvas.toDataURL("image/png");
    this.onComplete(dataUrl);
  };

  // ------------------------------------------------------------------------
  // Double-click => Re-edit text
  // ------------------------------------------------------------------------
  PhotoEditor.prototype.onDoubleClick = function (e) {
    const { x, y } = this.getRealMouse(e);
    const clicked = this.getTopmostLayerAt(x, y);
    if (!clicked || !clicked.isText) return;

    // simple prompts
    const newText = prompt("Edit text (\\n for lines):", clicked.textContent);
    if (newText === null) return;
    clicked.textContent = newText;

    const isBold = prompt("Bold? (y/n)", clicked.bold ? "y" : "n");
    clicked.bold = (isBold && isBold.toLowerCase() === "y");

    const isItalic = prompt("Italic? (y/n)", clicked.italic ? "y" : "n");
    clicked.italic = (isItalic && isItalic.toLowerCase() === "y");

    const newSize = prompt("Font size?", String(clicked.fontSize));
    if (newSize !== null) {
      const num = parseInt(newSize, 10);
      if (!isNaN(num) && num > 0) clicked.fontSize = num;
    }

    const newFam = prompt("Font family?", clicked.fontFamily);
    if (newFam && newFam.trim().length > 0) {
      clicked.fontFamily = newFam.trim();
    }

    this.renderTextLayer(clicked);
    this.redrawAll();
  };

  // ------------------------------------------------------------------------
  // Mouse events
  // ------------------------------------------------------------------------
  PhotoEditor.prototype.onMouseDown = function (e) {
    this.isMouseDown = true;
    const { x, y } = this.getRealMouse(e);

    // 1) Pen
    if (this.tool === "pen") {
      const layer = this.getSelectedLayer();
      if (!layer) {
        alert("No layer selected for Pen Tool.");
        this.isMouseDown = false;
        return;
      }
      this.isDrawing = true;
      this.drawPenStroke(layer, x, y, x, y);
      this.lastPenX = x;
      this.lastPenY = y;
      return;
    }

    // 2) Text
    if (this.tool === "text") {
      const userText = prompt("Enter text:", "Hello");
      if (!userText) {
        this.isMouseDown = false;
        return;
      }
      this.addTextLayer(x, y, userText);
      // auto-select new text layer
      this.selectedLayerId = this.layers[this.layers.length - 1].id;
      this.redrawAll();
      this.updateLayersListUI();
      this.isMouseDown = false;
      return;
    }

    // 3) SELECT tool
    if (e.ctrlKey) {
      // Pixel-based picking
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

    const sel = this.getSelectedLayer();
    if (sel && sel.visible) {
      const handle = this.getEdgeOrCornerHit(sel, x, y);
      if (handle) {
        this.dragMode = handle;
        this.setupDragVars(sel, x, y);
        this.canvas.style.cursor = this.getCursorForHandle(handle) || "move";
      } else {
        // inside bounding box => move?
        if (x >= sel.x && x <= sel.x + sel.width &&
          y >= sel.y && y <= sel.y + sel.height) {
          this.dragMode = "move";
          this.setupDragVars(sel, x, y);
          this.canvas.style.cursor = "move";
        } else {
          // pick another layer
          const clicked = this.getTopmostLayerAt(x, y);
          if (clicked) {
            this.selectedLayerId = clicked.id;
            const handle2 = this.getEdgeOrCornerHit(clicked, x, y);
            this.dragMode = handle2 || "move";
            this.setupDragVars(clicked, x, y);
            this.canvas.style.cursor = "move";
          } else {
            this.selectedLayerId = null;
            this.dragMode = null;
            this.canvas.style.cursor = "default";
          }
        }
      }
    } else {
      // no selected => pick
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
  };

  PhotoEditor.prototype.setupDragVars = function (layer, x, y) {
    this.dragStartX = x;
    this.dragStartY = y;
    this.originalX = layer.x;
    this.originalY = layer.y;
    this.originalW = layer.width;
    this.originalH = layer.height;
  };

  PhotoEditor.prototype.onMouseMove = function (e) {
    const { x, y } = this.getRealMouse(e);

    // Pen
    if (this.tool === "pen" && this.isDrawing) {
      const layer = this.getSelectedLayer();
      if (!layer) return;
      this.drawPenStroke(layer, this.lastPenX, this.lastPenY, x, y);
      this.lastPenX = x;
      this.lastPenY = y;
      this.redrawAll();
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

    // Resizing
    if (this.dragMode === "resize-left") {
      const newW = this.originalW - dx;
      if (!shift) {
        // keep aspect ratio
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
      } else { // "resize-br"
        newW = this.originalW + dx;
        newH = this.originalH + dy;
      }
      if (!shift) {
        // keep aspect ratio
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
        // no aspect ratio
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
    if (this.isDrawing) {
      this.isDrawing = false;
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
        // inside bounding box => move
        if (x >= sel.x && x <= sel.x + sel.width &&
          y >= sel.y && y <= sel.y + sel.height) {
          this.canvas.style.cursor = "move";
          return;
        }
      }
    }
    // else check topmost
    const topLayer = this.getTopmostLayerAt(x, y);
    this.canvas.style.cursor = topLayer ? "move" : "default";
  };

  // ------------------------------------------------------------------------
  // PEN TOOL
  // ------------------------------------------------------------------------
  PhotoEditor.prototype.drawPenStroke = function (layer, x1, y1, x2, y2) {
    const ctx = layer.offscreenCanvas.getContext("2d");
    const scaleX = layer.originalWidth / layer.width;
    const scaleY = layer.originalHeight / layer.height;

    const lx1 = (x1 - layer.x) * scaleX;
    const ly1 = (y1 - layer.y) * scaleY;
    const lx2 = (x2 - layer.x) * scaleX;
    const ly2 = (y2 - layer.y) * scaleY;

    ctx.strokeStyle = this.penColor;
    ctx.lineWidth = this.penSize;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(lx1, ly1);
    ctx.lineTo(lx2, ly2);
    ctx.stroke();
  };

  // ------------------------------------------------------------------------
  // Pixel-based picking
  // ------------------------------------------------------------------------
  PhotoEditor.prototype.getTopmostLayerAt = function (x, y) {
    for (let i = this.layers.length - 1; i >= 0; i--) {
      const layer = this.layers[i];
      if (!layer.visible) continue;

      // bounding box check
      if (x < layer.x || x > layer.x + layer.width) continue;
      if (y < layer.y || y > layer.y + layer.height) continue;

      // pixel check
      const localX = x - layer.x;
      const localY = y - layer.y;
      const scaleX = layer.originalWidth / layer.width;
      const scaleY = layer.originalHeight / layer.height;
      const testX = Math.floor(localX * scaleX);
      const testY = Math.floor(localY * scaleY);

      if (testX < 0 || testX >= layer.originalWidth ||
        testY < 0 || testY >= layer.originalHeight) {
        continue;
      }

      // draw the layer’s offscreen to the main offscreenCanvas
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
  // REDRAW
  // ------------------------------------------------------------------------
  PhotoEditor.prototype.redrawAll = function () {
    this.ctx.clearRect(0, 0, this.width, this.height);

    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];
      if (!layer.visible) continue;

      // If text changed, re-render it
      if (layer.isText) {
        this.renderTextLayer(layer);
      }

      // Draw the layer with its transform
      this.drawLayerWithTransform(layer);

    }
  };

  // The Key Fix: bounding box also drawn inside the same transform
  PhotoEditor.prototype.drawLayerWithTransform = function (layer) {
    this.ctx.save();

    // 1) Move to layer center
    const cx = layer.x + layer.width / 2;
    const cy = layer.y + layer.height / 2;
    this.ctx.translate(cx, cy);

    // 2) Rotate
    const rad = (layer.rotation || 0) * Math.PI / 180;
    this.ctx.rotate(rad);

    // 3) Scale
    const sx = layer.width / layer.originalWidth;
    const sy = layer.height / layer.originalHeight;
    this.ctx.scale(sx, sy);

    // 4) Move origin to top-left
    this.ctx.translate(-layer.originalWidth / 2, -layer.originalHeight / 2);

    // 5) Set opacity
    this.ctx.globalAlpha = layer.opacity;

    // 6) Draw the layer's image
    this.ctx.drawImage(layer.offscreenCanvas, 0, 0);

    // 7) If selected => draw bounding box in local coords
    if (this.tool === "select" && layer.id === this.selectedLayerId) {
      var nx=sx/2;
      ///console.log(nx);
      this.ctx.save();
      this.ctx.strokeStyle = "#018dff";
      this.ctx.lineWidth = 2/nx;
      // bounding box around the original size
      this.ctx.strokeRect(0, 0, layer.originalWidth, layer.originalHeight);

      // 8 handles
      const s = 8/nx;
      // corners
      this.drawHandle(0, 0, s);
      this.drawHandle(layer.originalWidth, 0, s);
      this.drawHandle(0, layer.originalHeight, s);
      this.drawHandle(layer.originalWidth, layer.originalHeight, s);
      // edges
      this.drawHandle(layer.originalWidth / 2, 0, s);
      this.drawHandle(layer.originalWidth / 2, layer.originalHeight, s);
      this.drawHandle(0, layer.originalHeight / 2, s);
      this.drawHandle(layer.originalWidth, layer.originalHeight / 2, s);

      this.ctx.restore();
    }

    this.ctx.restore();
  };

  // Draw a small square handle in local coords
  PhotoEditor.prototype.drawHandle = function (x, y, size) {
    this.ctx.fillStyle = "#018dff";
    this.ctx.fillRect(x - size / 2, y - size / 2, size, size);
  };

  // ------------------------------------------------------------------------
  // Hit detection for bounding box edges/corners (Axis-aligned)
  // ------------------------------------------------------------------------
  PhotoEditor.prototype.getEdgeOrCornerHit = function (layer, x, y) {
    const buffer = 8;
    const L = layer.x;
    const R = layer.x + layer.width;
    const T = layer.y;
    const B = layer.y + layer.height;

    // corners
    if (this.isNear(x, y, L, T, buffer)) return "resize-tl";
    if (this.isNear(x, y, R, T, buffer)) return "resize-tr";
    if (this.isNear(x, y, L, B, buffer)) return "resize-bl";
    if (this.isNear(x, y, R, B, buffer)) return "resize-br";

    // edges
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

  // Get the currently selected layer
  PhotoEditor.prototype.getSelectedLayer = function () {
    return this.layers.find(l => l.id === this.selectedLayerId);
  };

  // ------------------------------------------------------------------------
  // LAYER LIST UI
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

      // Hide/Show
      const hideBtn = document.createElement("button");
      hideBtn.classList.add("photo-editor-button", "layer-control-button");
      if (layer.visible) {
        const iconShow = icons.find(ii => ii.key === 'show');
        hideBtn.innerHTML = iconShow
          ? `<img src="${iconShow.src}" alt="Hide" class="layer-option-icon" />`
          : "Hide";
      } else {
        const iconHide = icons.find(ii => ii.key === 'hide');
        hideBtn.innerHTML = iconHide
          ? `<img src="${iconHide.src}" alt="Show" class="layer-option-icon" />`
          : "Show";
      }
      hideBtn.onclick = (evt) => {
        evt.stopPropagation();
        layer.visible = !layer.visible;
        this.redrawAll();
        this.updateLayersListUI();
      };
      row.appendChild(hideBtn);

      // Preview
      const preview = this.createLayerPreview(layer, 80, 50);
      preview.classList.add("layer-preview-canvas");
      row.appendChild(preview);

      // Label
      const textSpan = document.createElement("span");
      textSpan.textContent = layer.isText ? "Text Layer" : "Image Layer";
      row.appendChild(textSpan);

      // Clicking row => select
      row.onclick = () => {
        this.selectedLayerId = layer.id;
        this.redrawAll();
        this.updateLayersListUI();
        this.syncSelectedLayerOptions();
      };

      // Move Up
      const upBtn = document.createElement("button");
      upBtn.classList.add("photo-editor-button", "layer-control-button");
      {
        const icon = icons.find(ii => ii.key === 'sort_up');
        if (icon) {
          upBtn.innerHTML = `<img src="${icon.src}" alt="Up" class="layer-option-icon" />`;
        } else {
          upBtn.textContent = "Up";
        }
      }
      upBtn.onclick = (evt) => {
        evt.stopPropagation();
        this.moveLayerUp(layer.id);
      };
      row.appendChild(upBtn);

      // Move Down
      const downBtn = document.createElement("button");
      downBtn.classList.add("photo-editor-button", "layer-control-button");
      {
        const icon = icons.find(ii => ii.key === 'sort_down');
        if (icon) {
          downBtn.innerHTML = `<img src="${icon.src}" alt="Down" class="layer-option-icon" />`;
        } else {
          downBtn.textContent = "Down";
        }
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

  // Create a small preview thumbnail
  PhotoEditor.prototype.createLayerPreview = function (layer, w, h) {
    const previewCanvas = document.createElement("canvas");
    previewCanvas.width = w;
    previewCanvas.height = h;
    const ctx = previewCanvas.getContext("2d");

    ctx.clearRect(0, 0, w, h);
    const scale = Math.min(w / layer.originalWidth, h / layer.originalHeight);
    const newW = layer.originalWidth * scale;
    const newH = layer.originalHeight * scale;
    const offsetX = (w - newW) / 2;
    const offsetY = (h - newH) / 2;

    // re-render text if needed
    if (layer.isText) {
      this.renderTextLayer(layer);
    }
    ctx.drawImage(layer.offscreenCanvas, offsetX, offsetY, newW, newH);

    return previewCanvas;
  };

  // Sync the rotation/opacity inputs with selected layer
  PhotoEditor.prototype.syncSelectedLayerOptions = function () {
    const layer = this.getSelectedLayer();
    if (!layer) {
      this.rotateInput.value = 0;
      this.opacityInput.value = 1;
      return;
    }
    this.rotateInput.value = layer.rotation || 0;
    this.opacityInput.value = layer.opacity || 1;
  };

  // Expose PhotoEditor
  global.PhotoEditor = PhotoEditor;
})(window);
