import {
  App,
  getLanguage,
  Menu,
  Modal,
  Notice,
  Plugin,
  Setting,
  setIcon,
  TFile,
  normalizePath
} from "obsidian";

type Tool = "select" | "rect" | "arrow" | "pen" | "text";
type Locale = "en" | "zh";

const EN_MESSAGES = {
  addTextTitle: "Add text",
  annotationText: "Text",
  enterText: "Enter annotation text",
  cancel: "Cancel",
  add: "Add",
  replaceImageEmbed: "Replace image embed",
  savedTo: "Saved to",
  replaceEmbedQuestion: "Replace the original image embed in the current note with the annotated copy?",
  keepOriginal: "Keep original",
  replaceEmbed: "Replace embed",
  failedToLoadImage: "Failed to load image",
  select: "Select",
  selectTool: "Select tool",
  rectangle: "Rectangle",
  drawRectangle: "Draw rectangle",
  arrow: "Arrow",
  drawArrow: "Draw arrow",
  pen: "Pen",
  drawFreehand: "Draw freehand",
  text: "Text",
  addText: "Add text",
  color: "Color",
  annotationColor: "Annotation color",
  lineWidth: "Line width",
  textSize: "Text size",
  zoomOut: "Zoom out",
  resetZoom: "Reset zoom",
  fitImageToWindow: "Fit image to window",
  zoomIn: "Zoom in",
  undo: "Undo",
  undoShortcut: "Undo Ctrl/Cmd+Z",
  redo: "Redo",
  redoShortcut: "Redo Ctrl/Cmd+Shift+Z",
  cancelAndClose: "Cancel and close",
  savePng: "Save PNG",
  saveAsPng: "Save as PNG",
  rectangleHint: "Drag to draw an unfilled rectangle",
  arrowHint: "Drag to draw an arrow",
  penHint: "Drag to draw freehand",
  textHint: "Click the image to add text",
  selectHint: "Use the select tool to inspect the image; undo removes annotations",
  annotatedImageSaved: "Annotated image saved",
  failedToSaveImage: "Failed to save annotated image",
  annotateImage: "Annotate image",
  annotateActiveImage: "Annotate active image"
} as const;

type MessageKey = keyof typeof EN_MESSAGES;

const MESSAGES: Record<Locale, Record<MessageKey, string>> = {
  en: EN_MESSAGES,
  zh: {
    addTextTitle: "添加文字",
    annotationText: "标注文字",
    enterText: "输入标注文字",
    cancel: "取消",
    add: "添加",
    replaceImageEmbed: "替换图片引用",
    savedTo: "已保存至",
    replaceEmbedQuestion: "是否将当前笔记中的原图引用替换为标注副本？",
    keepOriginal: "保留原引用",
    replaceEmbed: "替换引用",
    failedToLoadImage: "图片加载失败",
    select: "选择",
    selectTool: "选择工具",
    rectangle: "矩形",
    drawRectangle: "绘制矩形",
    arrow: "箭头",
    drawArrow: "绘制箭头",
    pen: "画笔",
    drawFreehand: "自由绘制",
    text: "文字",
    addText: "添加文字",
    color: "颜色",
    annotationColor: "标注颜色",
    lineWidth: "线宽",
    textSize: "文字大小",
    zoomOut: "缩小",
    resetZoom: "重置缩放",
    fitImageToWindow: "适应窗口",
    zoomIn: "放大",
    undo: "撤销",
    undoShortcut: "撤销 Ctrl/Cmd+Z",
    redo: "重做",
    redoShortcut: "重做 Ctrl/Cmd+Shift+Z",
    cancelAndClose: "取消并关闭",
    savePng: "保存 PNG",
    saveAsPng: "另存为 PNG",
    rectangleHint: "拖拽绘制矩形，默认不填充",
    arrowHint: "拖拽绘制箭头",
    penHint: "按住鼠标自由绘制",
    textHint: "点击图片后输入文字",
    selectHint: "使用选择工具查看图片，撤销可移除标注",
    annotatedImageSaved: "标注图片已保存",
    failedToSaveImage: "标注图片保存失败",
    annotateImage: "标注图片",
    annotateActiveImage: "标注当前图片"
  }
};

function t(key: MessageKey): string {
  const locale: Locale = getLanguage().toLowerCase().startsWith("zh") ? "zh" : "en";
  return MESSAGES[locale][key];
}

interface Point {
  x: number;
  y: number;
}

interface BaseItem {
  color: string;
  width: number;
}

interface RectItem extends BaseItem {
  type: "rect";
  start: Point;
  end: Point;
}

interface ArrowItem extends BaseItem {
  type: "arrow";
  start: Point;
  end: Point;
}

interface PenItem extends BaseItem {
  type: "pen";
  points: Point[];
}

interface TextItem extends BaseItem {
  type: "text";
  point: Point;
  text: string;
  size: number;
}

type Item = RectItem | ArrowItem | PenItem | TextItem;

interface ImageConverterMenuOwner {
  addAnnotateImageMenuItem: (...args: unknown[]) => unknown;
}

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif", "bmp"]);

function cloneItems(items: Item[]): Item[] {
  return JSON.parse(JSON.stringify(items)) as Item[];
}

function isImageFile(file: TFile): boolean {
  return IMAGE_EXTENSIONS.has(file.extension.toLowerCase());
}

function mimeFor(file: TFile): string {
  switch (file.extension.toLowerCase()) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "bmp":
      return "image/bmp";
    default:
      return "image/png";
  }
}

class TextPromptModal extends Modal {
  private settled = false;
  private value = "";

  constructor(app: App, private readonly resolve: (value: string | null) => void) {
    super(app);
  }

  onOpen(): void {
    this.setTitle(t("addTextTitle"));
    let input: HTMLInputElement | null = null;
    new Setting(this.contentEl)
      .setName(t("annotationText"))
      .addText((text) => {
        input = text.inputEl;
        text.setPlaceholder(t("enterText")).onChange((value) => {
          this.value = value;
        });
        text.inputEl.addEventListener("keydown", (event) => {
          if (event.key === "Enter") this.submit();
        });
      });
    new Setting(this.contentEl)
      .addButton((button) => button.setButtonText(t("cancel")).onClick(() => this.finish(null)))
      .addButton((button) => button.setButtonText(t("add")).setCta().onClick(() => this.submit()));
    window.setTimeout(() => input?.focus(), 0);
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this.settled) this.finish(null);
  }

  private submit(): void {
    const value = this.value.trim();
    if (value) this.finish(value);
  }

  private finish(value: string | null): void {
    if (this.settled) return;
    this.settled = true;
    this.resolve(value);
    this.close();
  }
}

class ReplaceEmbedModal extends Modal {
  private settled = false;

  constructor(
    app: App,
    private readonly targetPath: string,
    private readonly resolve: (replace: boolean) => void
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle(t("replaceImageEmbed"));
    this.contentEl.createEl("p", {
      text: `${t("savedTo")}: ${this.targetPath}`
    });
    this.contentEl.createEl("p", {
      text: t("replaceEmbedQuestion")
    });
    new Setting(this.contentEl)
      .addButton((button) => button.setButtonText(t("keepOriginal")).onClick(() => this.finish(false)))
      .addButton((button) => button.setButtonText(t("replaceEmbed")).setCta().onClick(() => this.finish(true)));
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this.settled) this.finish(false);
  }

  private finish(replace: boolean): void {
    if (this.settled) return;
    this.settled = true;
    this.resolve(replace);
    this.close();
  }
}

function promptForText(app: App): Promise<string | null> {
  return new Promise((resolve) => new TextPromptModal(app, resolve).open());
}

function confirmEmbedReplacement(app: App, targetPath: string): Promise<boolean> {
  return new Promise((resolve) => new ReplaceEmbedModal(app, targetPath, resolve).open());
}

class ImageAnnotatorModal extends Modal {
  private readonly sourceFile: TFile;
  private readonly noteFile: TFile | null;
  private canvas!: HTMLCanvasElement;
  private canvasWrap!: HTMLElement;
  private context!: CanvasRenderingContext2D;
  private imageUrl = "";
  private image!: HTMLImageElement;
  private items: Item[] = [];
  private undoStack: Item[][] = [];
  private redoStack: Item[][] = [];
  private tool: Tool = "rect";
  private color = "#e11d48";
  private lineWidth = 4;
  private textSize = 32;
  private zoom = 1;
  private zoomLabel!: HTMLElement;
  private draft: Item | null = null;
  private dragStart: Point | null = null;
  private toolbar!: HTMLElement;
  private stage!: HTMLElement;
  private hint!: HTMLElement;
  private status!: HTMLElement;

  constructor(app: App, sourceFile: TFile, noteFile: TFile | null) {
    super(app);
    this.sourceFile = sourceFile;
    this.noteFile = noteFile?.extension === "md" ? noteFile : null;
  }

  onOpen(): void {
    this.modalEl.addClass("vf-image-annotator-modal");
    this.contentEl.empty();
    const shell = this.contentEl.createDiv({ cls: "vf-ia-shell" });
    this.toolbar = shell.createDiv({ cls: "vf-ia-toolbar" });
    this.buildToolbar();
    this.stage = shell.createDiv({ cls: "vf-ia-stage" });
    this.canvasWrap = this.stage.createDiv({ cls: "vf-ia-canvas-wrap" });
    this.canvas = this.canvasWrap.createEl("canvas");
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointercancel", this.onPointerUp);
    const footer = shell.createDiv({ cls: "vf-ia-footer" });
    this.hint = footer.createDiv({ cls: "vf-ia-hint" });
    this.status = footer.createDiv({ cls: "vf-ia-status" });
    this.status.setText(this.sourceFile.name);
    this.status.title = this.sourceFile.path;
    this.modalEl.tabIndex = -1;
    this.modalEl.focus();
    this.modalEl.addEventListener("keydown", this.onKeyDown);
    this.setTool(this.tool);
    this.loadImage().catch((error: unknown) => {
      console.error("image-annotator: failed to load image", error);
      new Notice(t("failedToLoadImage"));
      this.close();
    });
  }

  onClose(): void {
    this.canvas?.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas?.removeEventListener("pointermove", this.onPointerMove);
    this.canvas?.removeEventListener("pointerup", this.onPointerUp);
    this.canvas?.removeEventListener("pointercancel", this.onPointerUp);
    this.modalEl.removeEventListener("keydown", this.onKeyDown);
    if (this.imageUrl) URL.revokeObjectURL(this.imageUrl);
    this.contentEl.empty();
  }

  private buildToolbar(): void {
    const toolGroup = this.toolbar.createDiv({ cls: "vf-ia-tool-group" });
    const tools: Array<[Tool, string, string, string]> = [
      ["select", "mouse-pointer-2", t("select"), t("selectTool")],
      ["rect", "square", t("rectangle"), t("drawRectangle")],
      ["arrow", "arrow-up-right", t("arrow"), t("drawArrow")],
      ["pen", "pencil", t("pen"), t("drawFreehand")],
      ["text", "type", t("text"), t("addText")]
    ];
    for (const [tool, icon, label, tooltip] of tools) {
      const button = this.createIconButton(icon, label, tooltip, toolGroup);
      button.dataset.tool = tool;
      button.addEventListener("click", () => this.setTool(tool));
    }

    const settings = this.toolbar.createDiv({ cls: "vf-ia-settings-group" });
    settings.createSpan({ text: t("color") });
    const color = settings.createEl("input");
    color.type = "color";
    color.value = this.color;
    color.title = t("annotationColor");
    color.addEventListener("input", () => {
      this.color = color.value;
    });

    settings.createSpan({ text: t("lineWidth") });
    const width = settings.createEl("input");
    width.type = "number";
    width.min = "1";
    width.max = "30";
    width.value = String(this.lineWidth);
    width.title = t("lineWidth");
    width.addEventListener("change", () => {
      this.lineWidth = Math.max(1, Math.min(30, Number(width.value) || 4));
      width.value = String(this.lineWidth);
    });

    settings.createSpan({ text: t("textSize") });
    const size = settings.createEl("input");
    size.type = "number";
    size.min = "10";
    size.max = "160";
    size.value = String(this.textSize);
    size.title = t("textSize");
    size.addEventListener("change", () => {
      this.textSize = Math.max(10, Math.min(160, Number(size.value) || 32));
      size.value = String(this.textSize);
    });

    this.toolbar.createSpan({ cls: "vf-ia-spacer" });
    const zoomControls = this.toolbar.createDiv({ cls: "vf-ia-zoom-controls" });
    const zoomOut = this.createIconButton("zoom-out", t("zoomOut"), t("zoomOut"), zoomControls);
    zoomOut.addEventListener("click", () => this.setZoom(this.zoom - 0.25));
    const resetZoom = this.createIconButton("scan", t("resetZoom"), t("fitImageToWindow"), zoomControls);
    resetZoom.addEventListener("click", () => this.setZoom(1));
    this.zoomLabel = zoomControls.createSpan({ cls: "vf-ia-zoom-label" });
    this.zoomLabel.setText("100%");
    const zoomIn = this.createIconButton("zoom-in", t("zoomIn"), t("zoomIn"), zoomControls);
    zoomIn.addEventListener("click", () => this.setZoom(this.zoom + 0.25));

    const actions = this.toolbar.createDiv({ cls: "vf-ia-actions" });
    const undo = this.createIconButton("undo-2", t("undo"), t("undoShortcut"), actions);
    undo.addEventListener("click", () => this.undo());
    const redo = this.createIconButton("redo-2", t("redo"), t("redoShortcut"), actions);
    redo.addEventListener("click", () => this.redo());
    const cancel = this.createIconButton("x", t("cancel"), t("cancelAndClose"), actions);
    cancel.addEventListener("click", () => this.close());
    const save = this.createIconButton("save", t("savePng"), t("saveAsPng"), actions);
    save.addClass("mod-cta");
    save.addEventListener("click", () => void this.save());

    this.setTool(this.tool);
  }

  private setZoom(value: number): void {
    this.zoom = Math.max(0.5, Math.min(3, Math.round(value * 100) / 100));
    this.canvasWrap?.style.setProperty("--image-annotator-zoom", String(this.zoom));
    this.zoomLabel?.setText(`${Math.round(this.zoom * 100)}%`);
  }

  private createIconButton(
    icon: string,
    label: string,
    tooltip: string,
    parent: HTMLElement = this.toolbar
  ): HTMLButtonElement {
    const button = parent.createEl("button");
    button.type = "button";
    button.addClass("vf-ia-icon-button");
    button.title = tooltip;
    button.setAttribute("aria-label", label);
    setIcon(button, icon);
    return button;
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (!(event.ctrlKey || event.metaKey)) return;
    if (event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) this.redo();
      else this.undo();
    }
  };

  private setTool(tool: Tool): void {
    this.tool = tool;
    this.toolbar.querySelectorAll<HTMLButtonElement>("button[data-tool]").forEach((button) => {
      button.toggleClass("is-active", button.dataset.tool === tool);
    });
    this.canvas?.classList.toggle("vf-ia-crosshair", tool !== "select");
    this.hint?.setText(
      tool === "rect"
        ? t("rectangleHint")
        : tool === "arrow"
          ? t("arrowHint")
          : tool === "pen"
            ? t("penHint")
            : tool === "text"
              ? t("textHint")
              : t("selectHint")
    );
  }

  private async loadImage(): Promise<void> {
    const bytes = await this.app.vault.readBinary(this.sourceFile);
    this.imageUrl = URL.createObjectURL(new Blob([bytes], { type: mimeFor(this.sourceFile) }));
    this.image = new Image();
    this.image.src = this.imageUrl;
    await new Promise<void>((resolve, reject) => {
      this.image.onload = () => resolve();
      this.image.onerror = () => reject(new Error("Image decode failed"));
    });
    this.canvas.width = this.image.naturalWidth;
    this.canvas.height = this.image.naturalHeight;
    this.context = this.canvas.getContext("2d") as CanvasRenderingContext2D;
    this.context.imageSmoothingEnabled = true;
    this.context.imageSmoothingQuality = "high";
    this.draw();
  }

  private pointFromEvent(event: PointerEvent): Point {
    const bounds = this.canvas.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * (this.canvas.width / bounds.width),
      y: (event.clientY - bounds.top) * (this.canvas.height / bounds.height)
    };
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (this.tool === "select") return;
    const point = this.pointFromEvent(event);
    if (this.tool === "text") {
      void promptForText(this.app).then((value) => {
        if (!value) return;
        this.pushUndo();
        this.items.push({
          type: "text",
          point,
          text: value,
          size: this.textSize,
          color: this.color,
          width: this.lineWidth
        });
        this.draw();
      });
      return;
    }
    this.dragStart = point;
    this.pushUndo();
    if (this.tool === "rect") {
      this.draft = { type: "rect", start: point, end: point, color: this.color, width: this.lineWidth };
    } else if (this.tool === "arrow") {
      this.draft = { type: "arrow", start: point, end: point, color: this.color, width: this.lineWidth };
    } else {
      this.draft = { type: "pen", points: [point], color: this.color, width: this.lineWidth };
    }
    this.canvas.setPointerCapture(event.pointerId);
    this.draw();
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.draft || !this.dragStart) return;
    const point = this.pointFromEvent(event);
    if (this.draft.type === "pen") {
      this.draft.points.push(point);
    } else if (this.draft.type === "rect" || this.draft.type === "arrow") {
      this.draft.end = point;
    }
    this.draw();
  };

  private onPointerUp = (): void => {
    if (!this.draft) return;
    const item = this.draft;
    this.draft = null;
    this.dragStart = null;
    if (this.hasMeaningfulSize(item)) {
      this.items.push(item);
    } else {
      this.undoStack.pop();
    }
    this.draw();
  };

  private hasMeaningfulSize(item: Item): boolean {
    if (item.type === "pen") return item.points.length > 1;
    if (item.type === "text") return true;
    return Math.abs(item.end.x - item.start.x) > 2 || Math.abs(item.end.y - item.start.y) > 2;
  }

  private pushUndo(): void {
    this.undoStack.push(cloneItems(this.items));
    if (this.undoStack.length > 100) this.undoStack.shift();
    this.redoStack = [];
  }

  private undo(): void {
    const previous = this.undoStack.pop();
    if (!previous) return;
    this.redoStack.push(cloneItems(this.items));
    this.items = previous;
    this.draw();
  }

  private redo(): void {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(cloneItems(this.items));
    this.items = next;
    this.draw();
  }

  private draw(): void {
    if (!this.context || !this.image) return;
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.context.drawImage(this.image, 0, 0, this.canvas.width, this.canvas.height);
    for (const item of this.items) this.drawItem(item);
    if (this.draft) this.drawItem(this.draft);
  }

  private drawItem(item: Item): void {
    const ctx = this.context;
    ctx.save();
    ctx.strokeStyle = item.color;
    ctx.fillStyle = item.color;
    ctx.lineWidth = item.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (item.type === "rect") {
      const x = Math.min(item.start.x, item.end.x);
      const y = Math.min(item.start.y, item.end.y);
      ctx.strokeRect(x, y, Math.abs(item.end.x - item.start.x), Math.abs(item.end.y - item.start.y));
    } else if (item.type === "arrow") {
      this.drawArrow(item.start, item.end, item.width, item.color);
    } else if (item.type === "pen") {
      ctx.beginPath();
      item.points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
    } else {
      ctx.font = `${item.size}px sans-serif`;
      ctx.textBaseline = "top";
      ctx.fillText(item.text, item.point.x, item.point.y);
    }
    ctx.restore();
  }

  private drawArrow(start: Point, end: Point, width: number, color: string): void {
    const ctx = this.context;
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const head = Math.max(12, width * 4);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(end.x - head * Math.cos(angle - Math.PI / 6), end.y - head * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(end.x - head * Math.cos(angle + Math.PI / 6), end.y - head * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  }

  private async save(): Promise<void> {
    try {
      if (!this.image || !this.context) return;
      const blob = await new Promise<Blob>((resolve, reject) => {
        this.canvas.toBlob(
          (value) => (value ? resolve(value) : reject(new Error("PNG encode failed"))),
          "image/png"
        );
      });
      const bytes = await blob.arrayBuffer();
      const targetPath = await this.resolveOutputPath();
      let targetFile = this.app.vault.getAbstractFileByPath(targetPath);
      if (targetFile instanceof TFile) {
        await this.app.vault.modifyBinary(targetFile, bytes);
      } else {
        await this.app.vault.createBinary(targetPath, bytes);
        targetFile = this.app.vault.getAbstractFileByPath(targetPath);
      }
      if (!(targetFile instanceof TFile)) throw new Error("Output file was not created");

      if (this.noteFile && targetFile.path !== this.sourceFile.path) {
        const shouldUpdate = await confirmEmbedReplacement(this.app, targetFile.path);
        if (shouldUpdate) await this.replaceNoteEmbeds(this.noteFile, this.sourceFile, targetFile);
      }
      new Notice(`${t("annotatedImageSaved")}: ${targetFile.path}`);
      this.close();
    } catch (error) {
      console.error("Image Annotator: failed to save image", error);
      new Notice(t("failedToSaveImage"));
    }
  }

  private async resolveOutputPath(): Promise<string> {
    const dir = this.sourceFile.parent?.path ? `${this.sourceFile.parent.path}/` : "";
    if (/(?:-annotated|-标注)(?:-\d+)?$/u.test(this.sourceFile.basename) && this.sourceFile.extension === "png") {
      return this.sourceFile.path;
    }
    const base = `${dir}${this.sourceFile.basename}-annotated`;
    let candidate = `${base}.png`;
    let index = 2;
    while (this.app.vault.getAbstractFileByPath(candidate)) {
      candidate = `${base}-${index}.png`;
      index += 1;
    }
    return normalizePath(candidate);
  }

  private async replaceNoteEmbeds(note: TFile, source: TFile, target: TFile): Promise<void> {
    const newLink = this.app.metadataCache.fileToLinktext(target, note.path, true);
    await this.app.vault.process(note, (oldContent) => {
      let content = oldContent.replace(/!\[\[([^\]]+)\]\]/g, (full, raw: string) => {
        const parts = raw.split("|");
        const link = parts.shift() ?? "";
        const destination = this.app.metadataCache.getFirstLinkpathDest(link, note.path);
        if (!destination || destination.path !== source.path) return full;
        return `![[${newLink}${parts.length ? `|${parts.join("|")}` : ""}]]`;
      });
      content = content.replace(
        /!\[([^\]]*)\]\(([^)\s]+)([^)]*)\)/g,
        (full, alt: string, link: string, tail: string) => {
          const destination = this.app.metadataCache.getFirstLinkpathDest(link, note.path);
          if (!destination || destination.path !== source.path) return full;
          return `![${alt}](${newLink}${tail})`;
        }
      );
      return content;
    });
  }
}

export default class ImageAnnotatorPlugin extends Plugin {
  private imageConverterMenuOwner: ImageConverterMenuOwner | null = null;
  private originalImageConverterMenuMethod: ((...args: unknown[]) => unknown) | null = null;
  private patchedImageConverterMenuMethod: ((...args: unknown[]) => unknown) | null = null;

  async onload(): Promise<void> {
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (!(file instanceof TFile) || !isImageFile(file)) return;
        menu.addItem((item) => {
          item
            .setTitle(t("annotateImage"))
            .setIcon("square-dashed")
            .onClick(() => this.openAnnotator(file, this.app.workspace.getActiveFile()));
        });
      })
    );

    this.registerDomEvent(document, "contextmenu", (event) => {
      const image = this.resolveImageElement(event.target);
      if (!image) return;
      const file = this.resolveImageFile(image);
      if (!file) return;
      event.preventDefault();
      const menu = new Menu();
      menu.addItem((item) => {
        item
          .setTitle(t("annotateImage"))
          .setIcon("square-dashed")
          .onClick(() => this.openAnnotator(file, this.app.workspace.getActiveFile()));
      });
      menu.showAtPosition({ x: event.clientX, y: event.clientY });
    });

    this.ensureImageConverterMenuIntegration();
    this.registerInterval(
      window.setInterval(() => this.ensureImageConverterMenuIntegration(), 2000)
    );

    this.addCommand({
      id: "annotate-active-image",
      name: t("annotateActiveImage"),
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || !isImageFile(file)) return false;
        if (!checking) this.openAnnotator(file, null);
        return true;
      }
    });
  }

  onunload(): void {
    this.restoreImageConverterMenuIntegration();
  }

  private openAnnotator(file: TFile, noteFile: TFile | null): void {
    new ImageAnnotatorModal(this.app, file, noteFile).open();
  }

  private ensureImageConverterMenuIntegration(): void {
    const owner = this.findImageConverterMenuOwner();
    if (!owner) {
      this.restoreImageConverterMenuIntegration();
      return;
    }
    if (
      owner === this.imageConverterMenuOwner &&
      owner.addAnnotateImageMenuItem === this.patchedImageConverterMenuMethod
    ) {
      return;
    }

    this.restoreImageConverterMenuIntegration();
    const original = owner.addAnnotateImageMenuItem;
    const patched = (...args: unknown[]): unknown => {
      const result: unknown = original.apply(owner, args);
      const [menu, image] = args;
      if (menu instanceof Menu && this.isImageElement(image)) {
        this.addAnnotatorMenuItem(menu, image);
      }
      return result;
    };

    owner.addAnnotateImageMenuItem = patched;
    this.imageConverterMenuOwner = owner;
    this.originalImageConverterMenuMethod = original;
    this.patchedImageConverterMenuMethod = patched;
  }

  private restoreImageConverterMenuIntegration(): void {
    if (
      this.imageConverterMenuOwner &&
      this.originalImageConverterMenuMethod &&
      this.imageConverterMenuOwner.addAnnotateImageMenuItem === this.patchedImageConverterMenuMethod
    ) {
      this.imageConverterMenuOwner.addAnnotateImageMenuItem = this.originalImageConverterMenuMethod;
    }
    this.imageConverterMenuOwner = null;
    this.originalImageConverterMenuMethod = null;
    this.patchedImageConverterMenuMethod = null;
  }

  private findImageConverterMenuOwner(): ImageConverterMenuOwner | null {
    const pluginManager = (this.app as unknown as {
      plugins?: { getPlugin?: (id: string) => unknown };
    }).plugins;
    const imageConverter = pluginManager?.getPlugin?.("image-converter");
    if (!imageConverter || (typeof imageConverter !== "object" && typeof imageConverter !== "function")) {
      return null;
    }

    const queue: Array<{ value: object; depth: number }> = [
      { value: imageConverter, depth: 0 }
    ];
    const seen = new Set<object>();
    while (queue.length && seen.size < 200) {
      const current = queue.shift();
      if (!current || seen.has(current.value)) continue;
      seen.add(current.value);
      const candidate = current.value as Partial<ImageConverterMenuOwner>;
      if (typeof candidate.addAnnotateImageMenuItem === "function") {
        return candidate as ImageConverterMenuOwner;
      }
      if (current.depth >= 2) continue;

      for (const [key, child] of Object.entries(current.value)) {
        if (key === "app" || key === "manifest" || key === "settings") continue;
        if (!child || (typeof child !== "object" && typeof child !== "function")) continue;
        if (Array.isArray(child) || child instanceof HTMLElement) continue;
        queue.push({ value: child as object, depth: current.depth + 1 });
      }
    }
    return null;
  }

  private addAnnotatorMenuItem(menu: Menu, image: HTMLImageElement): void {
    const file = this.resolveImageFile(image);
    if (!file) return;
    menu.addItem((item) => {
      item
        .setTitle(t("annotateImage"))
        .setIcon("square-dashed")
        .onClick(() => this.openAnnotator(file, this.app.workspace.getActiveFile()));
    });
  }

  private isImageElement(value: unknown): value is HTMLImageElement {
    return Boolean(value && typeof value === "object" && (value as Element).tagName === "IMG");
  }

  private resolveImageElement(target: EventTarget | null): HTMLImageElement | null {
    if (!target || typeof target !== "object") return null;
    const element = target as Element;
    if (this.isImageElement(element)) return element;
    const wrapper = element.closest?.(".image-wrapper, .image-embed");
    const image = wrapper?.querySelector(".image-resize-container img, img");
    return this.isImageElement(image) ? image : null;
  }

  private resolveImageFile(image: HTMLImageElement): TFile | null {
    const wrapper = image.closest(".image-wrapper, .image-embed, .internal-embed");
    const pathCandidate = image.getAttribute("data-path") ??
      image.getAttribute("data-src") ??
      wrapper?.getAttribute("data-path") ??
      wrapper?.getAttribute("data-src") ??
      wrapper?.getAttribute("src");
    if (pathCandidate) {
      const activePath = this.app.workspace.getActiveFile()?.path ?? "";
      const linkedFile = this.app.metadataCache.getFirstLinkpathDest(pathCandidate, activePath);
      if (linkedFile && isImageFile(linkedFile)) return linkedFile;
      const directFile = this.app.vault.getAbstractFileByPath(normalizePath(pathCandidate));
      if (directFile instanceof TFile && isImageFile(directFile)) return directFile;
    }

    const src = image.currentSrc || image.src;
    const normalizedSrc = this.normalizeImageSource(src);
    const filename = normalizedSrc.split("/").pop() ?? "";
    const activePath = this.app.workspace.getActiveFile()?.path ?? "";
    const linkedFile = this.app.metadataCache.getFirstLinkpathDest(filename, activePath);
    return linkedFile && isImageFile(linkedFile) ? linkedFile : null;
  }

  private normalizeImageSource(value: string): string {
    const withoutQuery = value.split("?")[0].split("#")[0];
    try {
      return decodeURIComponent(withoutQuery);
    } catch {
      return withoutQuery;
    }
  }
}
