# Image Annotator

[English](README.md) | 简体中文

Image Annotator 为 Obsidian 提供专注的图片标注工作区。通过图片的右键菜单打开插件，添加可视化标记，并在源文件旁保存合成后的 PNG 图片。

## 功能

- 绘制矩形、箭头、自由线条和文字。
- 调整标注颜色、线宽和文字大小。
- 缩放编辑画布，同时保持导出图片的原始尺寸。
- 撤销和重做标注操作。
- 在源图片旁保存 PNG 标注副本。
- 可选择将当前 Markdown 笔记中匹配的图片引用替换为标注副本。

首次保存不会修改原图，而是创建 `<原文件名>-annotated.png`。再次打开已有的 `-annotated.png` 标注副本并保存时，将直接更新该副本。早期版本创建的 `-标注.png` 文件仍受支持，并会原位更新。

## 使用方法

1. 在文件列表或笔记中的图片上单击右键。
2. 选择 **Image Annotator**。
3. 添加标注，然后点击保存按钮。
4. 选择是否替换当前笔记中匹配的原图引用。

支持的源图片格式包括 PNG、JPEG、WebP、GIF 和 BMP，导出格式为 PNG。打开动态图片时，导出结果会固定为当时显示的画面。

## 隐私

Image Annotator 完全在你的 Vault 中运行，不使用网络、不收集遥测数据，也不会访问 Vault 之外的文件。

## 语言

界面会自动跟随 Obsidian 的语言。中文语言环境显示中文，其他语言环境默认显示英文。

## 手动安装

从最新 Release 下载 `main.js`、`manifest.json` 和 `styles.css`，放入以下目录：

```text
<vault>/.obsidian/plugins/image-annotator/
```

重新加载 Obsidian，然后在“第三方插件”中启用 **Image Annotator**。

## 开发

```bash
npm install
npm run build
npm run lint
```

构建产物位于 `dist/`。

## 许可证

[MIT](LICENSE)
