# Changelog

All notable changes to the Tag Group Manager plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.6.0] - 2026-03-20

### Added
- **Multi-level Tag Expansion Feature Fully Upgraded**
  - Flexible expansion depth selection (2-level and 3-level modes)
  - Selective expansion with first-level tag filtering
  - Smart node collection including all leaf nodes (depth>3)
  - Special handling for two-level tags in 3-level mode
  - Naming conflict prevention with auto-numbering
  - Smart display strategy across different interfaces
  - Respect for user actions (manual additions/deletions)
  
- **Tag Color Styles Fully Upgraded**
  - Property tag style imitation with pill-shaped appearance
  - 13px border-radius for capsule look
  - 20% transparency background color
  - Dark text color (65% brightness of original)
  - Borderless design
  - More generous padding (8px left/right)
  - Live Preview support with MutationObserver
  - Auto-styling for tags with configured colors
  - Complete visual consistency with reading mode

- **Auto-add Tags Feature Optimized**
  - Complete node collection fixing depth>3 leaf node omission
  - New `autoExpandedTags` field to distinguish auto-added from manual tags
  - Respect for deletion operations
  - Smart scanning with auto-scan on startup support

### Changed
- Expanded hover panel trigger area from 20px to 32px width
- Changed multi-level tag icon from 📁 to ⚡ for better visibility
- Centralized expansion config UI in bordered container
- Optimized input width to 100% for proper input

### Fixed
- Input box unable to type issue
- Depth>3 tags being missed during expansion
- Repeated expansion affecting edited tag groups
- Tag colors not displaying in Live Preview mode

### Technical
- Added `autoExpandedTags` field to TagGroup interface
- Added `expandTagPrefixes` and `expandDepth` settings fields
- Added `livePreviewObserver` for DOM change monitoring
- Optimized tag display filtering logic
- Improved backward compatibility for seamless old data upgrade

## [1.5.12] - 2024-XX-XX

### Added
- **Tag Group Sets Management**: Organize tag groups into sets for different workflows
- **Live Preview Properties Support**: Insert tags directly into Properties (YAML) section
- **Canvas Support**: Insert tags into Canvas cards and embedded notes

### Changed
- **Refactored Color Settings**:
  - Independent settings area with string/regex matching
  - Left-click for detailed settings (presets/custom, history of 7)
  - Standardized styles with soft gradient backgrounds

### Fixed
- YAML cursor jumping issue during continuous insertion
- Improved "Usage Tips" display
- Smoother positioning and dragging for Floating Tag Selector

## [1.5.x] - Previous Versions

### Features
- Tag group management with manual/batch addition
- Floating tag selector with drag and pin support
- Tag overview view with sorting/insertion modes
- Custom tag colors with presets and custom picker
- Multi-language support (Chinese/English)
- Quick clear tags from notes
- Universal insertion support (YAML, Properties, Canvas, etc.)

---

For more detailed information about each release, please visit the [GitHub Releases](https://github.com/Stargazer-cc/obsidian-tag-group-manager/releases) page.
