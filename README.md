# Image Annotator

English | [简体中文](README.zh-CN.md)

Image Annotator adds a focused annotation workspace to Obsidian. Open an image
from its context menu, add visual notes, and save a flattened PNG beside the
source file.

## Features

- Draw rectangles, arrows, freehand marks, and text.
- Adjust annotation color, line width, and text size.
- Zoom the editing canvas without changing the exported image size.
- Undo and redo annotation changes.
- Save a PNG derivative beside the source image.
- Optionally replace matching image embeds in the current Markdown note.

The first save leaves the original image untouched and creates
`<original-name>-annotated.png`. Opening an existing `-annotated.png`
derivative and saving it updates that derivative. Files created by earlier
versions with the `-标注.png` suffix remain supported and are updated in place.

## Usage

1. Right-click a supported image in the file explorer or an image embed.
2. Select **Image Annotator**.
3. Add annotations and select the save button.
4. Choose whether to replace matching embeds in the current note.

Supported source formats are PNG, JPEG, WebP, GIF, and BMP. Exports are PNG
files. Animated images are flattened to the frame displayed when opened.

## Privacy

Image Annotator works entirely inside your vault. It does not use the network,
collect telemetry, or access files outside the vault.

## Languages

The interface follows Obsidian's language automatically. Chinese is shown for
Chinese locales; all other locales use English.

## Manual installation

Download `main.js`, `manifest.json`, and `styles.css` from the latest release
and place them in:

```text
<vault>/.obsidian/plugins/image-annotator/
```

Reload Obsidian and enable **Image Annotator** under Community plugins.

## Development

```bash
npm install
npm run build
npm run lint
```

Build output is written to `dist/`.

## License

[MIT](LICENSE)
