import { getLanguage, Modal, App, setIcon } from "obsidian";

export function tr(zh: string, en: string): string { return getLanguage().toLowerCase().startsWith("zh") ? zh : en; }
export function iconButton(parent: HTMLElement, icon: string, title: string, action: () => void): HTMLButtonElement {
  const button = parent.createEl("button", { cls: "vf-ia-icon-button", attr: { type: "button", title, "aria-label": title } });
  setIcon(button, icon);
  button.addEventListener("click", action);
  return button;
}

export class ConfirmModal extends Modal {
  private settled = false;
  constructor(app: App, private titleText: string, private acceptText: string, private resolve: (result: boolean) => void) { super(app); }
  onOpen(): void {
    this.setTitle(this.titleText);
    const actions = this.contentEl.createDiv({ cls: "vf-ia-dialog-actions" });
    const cancel = actions.createEl("button", { text: tr("继续编辑", "Keep editing") });
    cancel.addEventListener("click", () => this.finish(false));
    actions.createEl("button", { text: this.acceptText, cls: "mod-warning" }).addEventListener("click", () => this.finish(true));
    cancel.focus();
  }
  onClose(): void { if (!this.settled) { this.settled = true; this.resolve(false); } this.contentEl.empty(); }
  private finish(value: boolean): void { this.settled = true; this.resolve(value); this.close(); }
}

export function confirmDiscard(app: App): Promise<boolean> {
  return new Promise(resolve => new ConfirmModal(app, tr("放弃未保存的标注？", "Discard unsaved annotations?"), tr("放弃更改", "Discard changes"), resolve).open());
}

class ValueModal extends Modal {
  private settled = false;
  constructor(app: App, private initial: string, private numeric: boolean, private resolve: (value: string | null) => void) { super(app); }
  onOpen(): void {
    this.setTitle(this.numeric ? tr("编号", "Number") : tr("标注文字", "Annotation text"));
    const input = this.numeric ? this.contentEl.createEl("input", { type: "number" }) : this.contentEl.createEl("textarea");
    input.addClass("vf-ia-text-input");
    input.value = this.initial;
    input.setAttribute("aria-label", this.numeric ? tr("编号", "Number") : tr("标注文字", "Annotation text"));
    if (input instanceof HTMLInputElement) { input.min = "1"; input.max = "9999"; input.step = "1"; }
    const actions = this.contentEl.createDiv({ cls: "vf-ia-dialog-actions" });
    actions.createEl("button", { text: tr("取消", "Cancel") }).addEventListener("click", () => this.finish(null));
    const submit = actions.createEl("button", { text: tr("确定", "Apply"), cls: "mod-cta" });
    const valid = (): boolean => this.numeric ? /^\d+$/.test(input.value) && Number(input.value) > 0 && Number(input.value) <= 9999 : !!input.value.trim() && input.value.length <= 10000;
    const update = (): void => { submit.disabled = !valid(); };
    input.addEventListener("input", update);
    input.addEventListener("keydown", rawEvent => {
      const event = rawEvent as KeyboardEvent;
      if (event.key === "Enter" && (this.numeric || event.ctrlKey || event.metaKey) && valid()) { event.preventDefault(); this.finish(input.value.trim()); }
    });
    submit.addEventListener("click", () => { if (valid()) this.finish(input.value.trim()); });
    update();
    input.focus();
    input.select();
  }
  onClose(): void { if (!this.settled) { this.settled = true; this.resolve(null); } this.contentEl.empty(); }
  private finish(value: string | null): void { this.settled = true; this.resolve(value); this.close(); }
}
export function promptValue(app: App, initial = "", numeric = false): Promise<string | null> {
  return new Promise(resolve => new ValueModal(app, initial, numeric, resolve).open());
}
