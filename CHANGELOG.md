# Changelog

## 1.0.2

- Edit individual annotations: selection, movement, resizing, deletion, styles,
  multiline text, and numbered-marker values.
- Add sequential numbered markers, solid redactions, and translucent highlights.
- Save a base-image snapshot and editable objects in a companion JSON file;
  restore objects when reopening a PNG and follow Obsidian image renames.
- Copy flattened images without annotation data to the clipboard.
- Remember common styles and provide six color swatches.
- Pan with Space-drag or the middle mouse button; zoom around the pointer.
- Replace one selected embed or all matches, preserving wiki dimensions and
  standard Markdown alt text and titles.
- Protect unsaved work, block repeat/conflicting saves, and restore previous
  files after failed writes.
- Include the Image Converter context-menu integration fix from September 4.

Editable companion files include the unredacted base image. Share the PNG alone
when distributing redacted results. Existing flattened annotations cannot be
recovered as editable objects.
