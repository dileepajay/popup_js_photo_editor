# Popup JS Photo Editor

**Popup JS Photo Editor** is a lightweight JavaScript-based **image editor** that can be easily integrated into a popup window. Users can **import images, edit them, and export the final result** as a `base64` data URL. The editor provides essential editing tools such as drawing, resizing, cropping, and filtering.
![Photo Editor UI](readme_screenshot/Screenshot%202025-02-18%20133925.png)


---

## Features

- **Drag & Drop Support** – Users can drag images directly into the editor.
- **Popup-Based Editing** – The editor opens in a modal window for seamless workflow.
- **Canvas-Based Transformations** – Supports **resizing, cropping, and filtering**.
- **Adjustable Canvas Size** – Users can **set custom width and height** for better flexibility.
- **Layer Management** – Add, delete, and reorder image layers.
- **Pen Tool & Drawing** – Allows **freehand drawing** with adjustable brush size and color.
- **Text Tool** – Add and customize text with different fonts, sizes, and colors.
- **Zoom & Pan** – Supports **Ctrl + Alt + Scroll** for zooming.
- **Undo & Redo** – Navigate between multiple edits.
- **Multiple Image Support** – Edit multiple images simultaneously.
- **Final Image Output** – Returns the edited image as a `base64` data URL.
- **Easy Integration** – Can be quickly added to **any website or web application**.

---

## Installation

To use the editor, include the **CSS and JS** files in your project:

```html
<link rel="stylesheet" href="popup_js_photo_editor.css" />
<script src="popup_js_photo_editor.js"></script>
```

---

## Usage

### 1. Create an Editor Container

```html
<div id="editor-container"></div>
```

### 2. Initialize the Editor with JavaScript

```js
const editor = new PhotoEditor();
editor.init(
    document.getElementById("editor-container"), // Target container
    1920,  // Canvas width
    1080,  // Canvas height
    [ "image1.png", "image2.png" ], // Array of image URLs
    function(finalDataURL) {  // Callback function when editing is complete
        console.log("Edited Image:", finalDataURL);
        alert("Editing complete!");
    }
);
```

---

## Example Usage

A working example is provided in the `examples/` folder:

```
examples/index.html
```

### Steps:
1. **Drag and drop images** into the uploader.
2. **Select the canvas resolution** (width and height).
3. **Click the "Edit" button** to launch the **photo editor** in a popup window.

---

## Screenshots

### **1. Image Upload & Canvas Selection**
Users can **drag and drop multiple images** and select the **canvas resolution** before launching the editor.

![Drag and Drop Example](readme_screenshot/Screenshot%202025-02-18%20131556.png)

---

### **2. Photo Editor Window**
- **Left Panel:** Toolbar with **selection, drawing, and text tools**.
- **Middle Section:** **Canvas area** for image editing.
- **Right Panel:** Options box for **adjustments (opacity, rotation, etc.)**.
- **Bottom Section:** Layers box to **manage layers, visibility, and order**.

![Photo Editor UI](readme_screenshot/Screenshot%202025-02-18%20131540.png)

---

## Project Structure

```
PhotoEditor/
│── examples/           # Example implementations
│── icons/              # Icons used in the editor
│── readme_screenshot/  # Screenshots for documentation
│── popup_js_photo_editor.css  # Styles for the editor
│── popup_js_photo_editor.js   # Core JavaScript file
│── README.md           # Documentation
```

---