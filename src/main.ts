import { Menu, Notice, Plugin, TFile, normalizePath } from "obsidian";
import { ImageAnnotatorModal } from "./editor";
import { EmbedContext } from "./embeds";
import { defaults, preferences, Preferences } from "./model";
import { SIDECAR } from "./storage";
import { tr } from "./ui";

interface ImageConverterMenuOwner { addAnnotateImageMenuItem: (...args: unknown[]) => unknown }
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif", "bmp"]);
function isImageFile(file: TFile): boolean { return IMAGE_EXTENSIONS.has(file.extension.toLowerCase()); }

export default class ImageAnnotatorPlugin extends Plugin {
  preferences: Preferences = { ...defaults };
  savingPaths = new Set<string>();
  private preferenceWrite: Promise<void> = Promise.resolve();
  private imageConverterMenuOwner: ImageConverterMenuOwner | null = null;
  private originalImageConverterMenuMethod: ((...args: unknown[]) => unknown) | null = null;
  private patchedImageConverterMenuMethod: ((...args: unknown[]) => unknown) | null = null;

  async onload(): Promise<void> {
    const data: unknown = await this.loadData();
    this.preferences = preferences((data as { preferences?: unknown } | null)?.preferences);
    this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => {
      if (!(file instanceof TFile) || !isImageFile(file)) return;
      menu.addItem(item => item.setTitle(tr("标注图片", "Annotate image")).setIcon("square-dashed").onClick(() => this.openAnnotator(file)));
    }));
    this.registerDomEvent(document, "contextmenu", event => {
      const image = this.resolveImageElement(event.target);
      if (!image) return;
      const file = this.resolveImageFile(image);
      if (!file) return;
      // Image Converter owns its own menu; its hook below appends our command.
      if (this.imageConverterMenuOwner) return;
      event.preventDefault();
      const menu = new Menu();
      menu.addItem(item => item.setTitle(tr("标注图片", "Annotate image")).setIcon("square-dashed").onClick(() => this.openAnnotator(file, image)));
      menu.showAtPosition({ x: event.clientX, y: event.clientY });
    });
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
      if (!(file instanceof TFile) || !isImageFile(file)) return;
      const sidecar = this.app.vault.getAbstractFileByPath(oldPath + SIDECAR);
      if (!(sidecar instanceof TFile)) return;
      const destination = file.path + SIDECAR;
      if (this.app.vault.getAbstractFileByPath(destination)) { new Notice(tr("标注数据未移动：目标位置已有同名文件。", "Annotation data was not moved: destination already exists.")); return; }
      void this.app.vault.rename(sidecar, destination).catch(error => {
        console.error("Image Annotator: could not move annotation data", error);
        new Notice(tr("图片已移动，但标注数据移动失败。", "Image moved, but annotation data could not be moved."));
      });
    }));
    this.ensureImageConverterMenuIntegration();
    this.registerInterval(window.setInterval(() => this.ensureImageConverterMenuIntegration(), 2000));
    this.addCommand({
      id: "annotate-active-image", name: tr("标注当前图片", "Annotate active image"),
      checkCallback: checking => {
        const file = this.app.workspace.getActiveFile();
        if (!file || !isImageFile(file)) return false;
        if (!checking) this.openAnnotator(file);
        return true;
      }
    });
  }

  remember(value: Preferences): void {
    this.preferences = preferences(value);
    const snapshot = { ...this.preferences };
    this.preferenceWrite = this.preferenceWrite.then(() => this.saveData({ preferences: snapshot })).catch(error => {
      console.error("Image Annotator: could not save preferences", error);
      new Notice(tr("常用样式保存失败", "Could not save style preferences"));
    });
  }

  onunload(): void { this.restoreImageConverterMenuIntegration(); }

  private openAnnotator(file: TFile, image?: HTMLImageElement): ImageAnnotatorModal {
    const note = this.app.workspace.getActiveFile();
    const context: EmbedContext | null = note?.extension === "md" ? { note } : null;
    if (context && image) {
      const container = image.closest(".markdown-preview-view, .markdown-source-view");
      const images = container ? Array.from(container.querySelectorAll<HTMLImageElement>("img")).filter(candidate => this.resolveImageFile(candidate)?.path === file.path) : [];
      const embeds = (this.app.metadataCache.getFileCache(context.note)?.embeds ?? []).filter(embed => this.app.metadataCache.getFirstLinkpathDest(embed.link, context.note.path)?.path === file.path);
      const index = images.indexOf(image);
      if (index >= 0 && embeds.length === images.length) context.preferredIndex = index;
    }
    const modal = new ImageAnnotatorModal(this.app, file, context, this);
    modal.open();
    return modal;
  }

  private ensureImageConverterMenuIntegration(): void {
    const owner = this.findImageConverterMenuOwner();
    if (!owner) { this.restoreImageConverterMenuIntegration(); return; }
    if (owner === this.imageConverterMenuOwner && owner.addAnnotateImageMenuItem === this.patchedImageConverterMenuMethod) return;
    this.restoreImageConverterMenuIntegration();
    const original = owner.addAnnotateImageMenuItem;
    const patched = (...args: unknown[]): unknown => {
      const result: unknown = original.apply(owner, args);
      const [menu, image] = args;
      if (menu instanceof Menu && this.isImageElement(image)) {
        const file = this.resolveImageFile(image);
        if (file) menu.addItem(item => item.setTitle(tr("标注图片", "Annotate image")).setIcon("square-dashed").onClick(() => this.openAnnotator(file, image)));
      }
      return result;
    };
    owner.addAnnotateImageMenuItem = patched;
    this.imageConverterMenuOwner = owner;
    this.originalImageConverterMenuMethod = original;
    this.patchedImageConverterMenuMethod = patched;
  }

  private restoreImageConverterMenuIntegration(): void {
    if (this.imageConverterMenuOwner && this.originalImageConverterMenuMethod && this.imageConverterMenuOwner.addAnnotateImageMenuItem === this.patchedImageConverterMenuMethod) {
      this.imageConverterMenuOwner.addAnnotateImageMenuItem = this.originalImageConverterMenuMethod;
    }
    this.imageConverterMenuOwner = null;
    this.originalImageConverterMenuMethod = null;
    this.patchedImageConverterMenuMethod = null;
  }

  private findImageConverterMenuOwner(): ImageConverterMenuOwner | null {
    const manager = (this.app as unknown as { plugins?: { getPlugin?: (id: string) => unknown } }).plugins;
    const plugin = manager?.getPlugin?.("image-converter");
    if (!plugin || typeof plugin !== "object" && typeof plugin !== "function") return null;
    const queue: Array<{ value: object; depth: number }> = [{ value: plugin, depth: 0 }];
    const seen = new Set<object>();
    while (queue.length && seen.size < 200) {
      const current = queue.shift();
      if (!current || seen.has(current.value)) continue;
      seen.add(current.value);
      if (typeof (current.value as Partial<ImageConverterMenuOwner>).addAnnotateImageMenuItem === "function") return current.value as ImageConverterMenuOwner;
      if (current.depth >= 2) continue;
      for (const [key, child] of Object.entries(current.value)) {
        if (["app", "manifest", "settings"].includes(key) || !child || typeof child !== "object" && typeof child !== "function" || Array.isArray(child) || child instanceof HTMLElement) continue;
        queue.push({ value: child as object, depth: current.depth + 1 });
      }
    }
    return null;
  }

  private isImageElement(value: unknown): value is HTMLImageElement { return Boolean(value && typeof value === "object" && (value as Element).tagName === "IMG"); }
  private resolveImageElement(target: EventTarget | null): HTMLImageElement | null {
    if (!target || typeof target !== "object") return null;
    if (this.isImageElement(target)) return target;
    const wrapper = (target as Element).closest?.(".image-wrapper, .image-embed");
    const image = wrapper?.querySelector(".image-resize-container img, img");
    return this.isImageElement(image) ? image : null;
  }

  private resolveImageFile(image: HTMLImageElement): TFile | null {
    const wrapper = image.closest(".image-wrapper, .image-embed, .internal-embed");
    const path = image.getAttribute("data-path") ?? image.getAttribute("data-src") ?? wrapper?.getAttribute("data-path") ?? wrapper?.getAttribute("data-src") ?? wrapper?.getAttribute("src");
    const notePath = this.app.workspace.getActiveFile()?.path ?? "";
    if (path) {
      const linked = this.app.metadataCache.getFirstLinkpathDest(path, notePath);
      if (linked && isImageFile(linked)) return linked;
      const direct = this.app.vault.getAbstractFileByPath(normalizePath(path));
      if (direct instanceof TFile && isImageFile(direct)) return direct;
    }
    let src = (image.currentSrc || image.src).split("?")[0].split("#")[0];
    try { src = decodeURIComponent(src); } catch { /* Keep literal source when URI decoding fails. */ }
    const linked = this.app.metadataCache.getFirstLinkpathDest(src.split("/").pop() ?? "", notePath);
    return linked && isImageFile(linked) ? linked : null;
  }
}
