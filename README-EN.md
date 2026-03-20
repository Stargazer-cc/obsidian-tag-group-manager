<h1 align="center">Obsidian Tag Group Manager</h1>

<div align="center">

![Obsidian Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&color=%23483699&label=downloads&query=%24%5B%22tag-group-manager%22%5D.downloads&url=https%3A%2F%2Fraw.githubusercontent.com%2Fobsidianmd%2Fobsidian-releases%2Fmaster%2Fcommunity-plugin-stats.json)
![GitHub release](https://img.shields.io/github/v/release/stargazer-cc/obsidian-tag-group-manager?color=blue)
![GitHub stars](https://img.shields.io/github/stars/stargazer-cc/obsidian-tag-group-manager?style=flat&color=yellow)
![License](https://img.shields.io/github/license/stargazer-cc/obsidian-tag-group-manager?color=green)

English | [中文](https://github.com/Stargazer-cc/obsidian-tag-group-manager/blob/main/README.md)

</div>

Tag Group Manager is a tag management enhancement plugin for [Obsidian](https://obsidian.md/), providing tag group management, quick tag insertion, custom tag colors, and powerful tag organization features to improve note organization and classification efficiency.

For more detailed introduction, please visit [Obsidian Forum](https://forum.obsidian.md)

![image](https://github.com/Stargazer-cc/obsidian-tag-group-manager/blob/dev/%E5%BC%80%E5%90%AF%E9%A2%9C%E8%89%B2%E8%AE%BE%E7%BD%AE.png)


## ✨ Features

- 📁 **Tag Group Management** - Create, edit, and delete custom tag groups with manual addition, vault filtering, and batch import
- 📚 **Tag Group Sets** - Organize multiple tag groups into sets for one-click context switching with independent sorting
- 🎯 **Floating Tag Selector** - Draggable, pinnable tag selection interface accessible via command palette or hotkeys, with auto-dimming for used tags
- 📊 **Tag Overview View** - Right sidebar hub with sorting/insertion mode toggle, drag-and-drop reordering, and cross-group sorting
- 🔌 **Universal Insertion Support** - Works in YAML areas, properties panel, Canvas, search boxes, and other plugin input fields
- 🎨 **Custom Tag Colors** - Seven preset colors plus custom color picker, with single-tag and batch regex pattern matching, tag styles imitate Obsidian property tags
- 🏷️ **Multi-level Tag Expansion** - Support 2-level and 3-level expansion modes, smart collection of all nodes, selective expansion and naming conflict prevention
- 🔄 **Auto-add Tags** - Automatically add tags to corresponding tag groups based on rules, support auto-scan on startup
- 🌍 **Multi-language Support** - Auto-detects Obsidian language settings for Chinese and English interfaces
- 🧹 **Quick Clear Tags** - Right-click menu option to remove all tags from a note instantly

  

## Installation

### Official Marketplace Installation

Simply search for "Tag Group Manager" in Obsidian's plugin marketplace and click install.


### Manual Installation

1. Download the latest release package
2. Extract the downloaded file
3. Copy the extracted folder to your Obsidian plugins directory: `{your-vault}/.obsidian/plugins/`
4. Restart Obsidian or refresh third-party plugins
5. Enable the plugin in settings


## Usage

### Creating Tag Groups

1. Open Obsidian settings
2. Go to the "Tag Group Manager" settings tab
3. Click the "Add Tag Group" button
4. Enter the tag group name
5. Add desired tags under the group (no need to enter the # symbol)

![](https://github.com/Stargazer-cc/obsidian-tag-group-manager/blob/main/4.gif)

### Creating Tag Group Sets

1. **Create Sets**: Create new sets in settings, select included tag groups, and set icons.
2. **Switch Views**: Click the icon button below any tag group name in the overview view.
3. **Select Context**: Choose a set from the menu, or select "Home" to view all groups.
4. **Independent Sorting**: Drag and drop tag groups to reorder them within a specific set; this order is saved independently.

### Setting Tag Colors

1. **Single Tag Color Settings**: Left-click tags in the tag group settings on the settings page to open color settings popup.
2. **Batch Color Settings**: In the independent settings area on the settings page, apply or clear colors for tags that meet conditions through normal matching or conditional matching.
3. **Color Selection Popup**: Both color setting methods share the color selection popup, click OK after selecting a color.
     **Preset Colors**: Provides seven rainbow-style preset colors (Red, Blue, Green, Orange, Purple, Cyan, Pink), click to apply.
     **Custom Colors**
       **Auto Save**: After entering a color value, click the apply color button to apply the color, automatically saves the last 7 colors used, cycling from left to right.
       **Manual Save**: After completing color input, left-click a slot to add, right-click a slot to delete, best to save to the rightmost slot first to prevent auto-save overwriting.

Notes:
1. If you want custom colors to be more harmonious and beautiful, avoid using colors that are too dull.
2. After enabling color settings, tag styles are better adapted to light interfaces. Although adapted for dark interfaces, there may still be some disharmony. If you prefer a simpler tag style with better universal compatibility, you can disable color settings. As shown below: using the default theme color

![Disable Color Settings](https://github.com/Stargazer-cc/obsidian-tag-group-manager/blob/dev/%E5%85%B3%E9%97%AD%E9%A2%9C%E8%89%B2%E8%AE%BE%E7%BD%AE.png)

### Using Tag Selector

1. **Launch**: The command only appears when the cursor is in the editor area, open the command palette (Ctrl/Cmd + P)
2. **Search**: Search for "Insert Here", all created tag groups will be displayed, select the desired tag group
3. **Insert**: In the popup tag selector, click the tags you want to insert, tags will be automatically inserted at the cursor position and turn gray.
4. **Cycle Use**: Click the cycle button in the upper left corner of the tag selector to cycle through the current tag group's tags.
5. **Refresh**: When new tags are added to a tag group, Shift + click the cycle button in the upper right corner of the tag selector to refresh the current tag group's tags.

![](https://github.com/Stargazer-cc/obsidian-tag-group-manager/blob/main/3.gif)

### Tag Overview View
- **Launch**: Click the star icon in the left sidebar to activate this view
- **Switch Modes**: Click any tag group name to switch between sorting/insertion modes. In sorting mode, drag any tag to sort, drag the drag handle to sort tag groups.
- **Switch Set Display**: Click the icon button below any tag group name to select the set to switch to, default is overview.
- **Refresh**: When new tags are added to a tag group, click any tag group name to refresh the current tag group's tags.

![](https://github.com/Stargazer-cc/obsidian-tag-group-manager/blob/main/6.gif)

### Multi-level Tag Expansion Feature

#### Feature Overview
The multi-level tag expansion feature can automatically expand multi-level tags (e.g., `frontend/framework/React`) in your vault into tag groups and sets, greatly simplifying multi-level tag management.

#### Expansion Depth Selection

**3-level Expansion (Default):**
- Structure: `A/B/C/D/E` → Set=A, Group=B, Tags=C, C/D, C/D/E
- Use case: When you need sets to organize many tag groups
- Example:
  ```
  #frontend/framework/React/Hooks/useState
  → Set "frontend"
    → Group "framework"
      → Tags "React", "React/Hooks", "React/Hooks/useState"
  ```
- Special handling: Two-level tags (e.g., `frontend/React`) create groups directly without sets

**2-level Expansion:**
- Structure: `A/B/C/D` → Group=A, Tags=B, B/C, B/C/D
- Use case: When you have fewer tag categories and don't need sets
- Example:
  ```
  #framework/React/Hooks/useState
  → Group "framework"
    → Tags "React", "React/Hooks", "React/Hooks/useState"
  ```

#### Selective Expansion
- Enter tags to expand in the "Specify first-level tags to expand" input box
- Separate multiple tags with commas, e.g., `frontend,backend,database`
- Leave empty to expand all multi-level tags

#### Smart Display Strategy
- **Settings page**: Show all tags, allow color settings for all tags
- **Selector/Overview**: Hide auto-expanded deep leaf nodes for clean interface
- **Hover board**: Show complete tree structure with access to all nodes

#### Naming Conflict Prevention
- If set or group name already exists, auto-add number suffix (e.g., `frontend (1)`)
- Support safe re-expansion without breaking existing configuration

#### Respect User Actions
- Manually added tags always visible
- Manually deleted tags won't be re-added
- Preserve user's tag order

#### Usage Steps
1. Open plugin settings page
2. Find "Multi-level Tag Adaptation" section
3. Select expansion depth (2-level or 3-level)
4. (Optional) Enter first-level tags to expand
5. Click "⚡ Expand Multi-level Tags" button
6. View generated tag groups and sets

### Auto-add Tags Feature

#### Feature Overview
Automatically add tags that match rules to corresponding tag groups.

#### Usage
1. Find "Auto-add Tags to Tag Groups" section in settings
2. Enable "Auto-add tags" toggle
3. Set rules in format: `tagname:groupname`, one rule per line
4. Example rules:
   ```
   react:test-frontend-framework
   vue:test-frontend-framework
   python:test-backend-language
   ```
5. Click "Scan and Add" button, or enable "Auto-scan on startup"

#### Smart Behavior
- Auto-collect all tags matching rules, including depth>3 tags
- Distinguish between auto-added and manually added tags
- Respect user deletion, won't re-add deleted tags
- Support repeated scanning, only add new tags



## Configuration

In the plugin settings page, you can:

### Read Operation Guide Area

- Key operation instructions for floating tag selector and tag overview page

### Color Settings
- **Enable Custom Tag Colors**: Master switch to enable personalized colors for different tags
- **Single Tag Color Settings**: In tag group settings area, left-click any tag to open color settings popup
  - Choose from preset rainbow directory-style colors (Red, Blue, Green, Orange, Purple, Cyan, Pink)
  - Or use custom color picker with auto-save of last 7 colors used
- **Batch Color Settings**: Independent settings area supporting string and regex pattern matching

### Tag Group Sets Configuration
- **Add or Delete Sets**
- **Configure Sets**: Click the pen icon to configure naming, icons [Get Lucide icon names](https://lucide.dev/), and select tag groups within the set

### Tag Group Management
- Create multiple tag groups, each containing different types of tags
- Edit tag group names (directly edit within group containers)
- Add or remove tags from groups
- Delete unnecessary tag groups
- Add tags from your tag library
- Batch filter and add multiple tags

![](https://github.com/Stargazer-cc/obsidian-tag-group-manager/blob/main/4.png)



## Regular Expression Syntax Guide

In batch color settings, you can use regular expressions to match multiple tags. Here are some commonly used regex syntax:

### Basic Syntax

| Syntax | Description | Example | Match Result |
|--------|-------------|---------|--------------|
| `.` | Match any single character | `mov.` | move, movie, movi |
| `*` | Match preceding character 0 or more times | `sci.*` | sci, science, sci-fi |
| `+` | Match preceding character 1 or more times | `code+` | code, codee |
| `?` | Match preceding character 0 or 1 time | `books?` | book, books |
| `^` | Match start of string | `^movie` | movie (but not "old movie") |
| `$` | Match end of string | `note$` | reading note (but not "notebook") |
| `\|` | OR operator | `movie\|film` | movie OR film |
| `[]` | Character set | `[mft]ove` | move, fove, tove |
| `[^]` | Negated character set | `[^m]ove` | love, dove (but not "move") |

### Practical Examples

| Need | Regular Expression | Description |
|------|-------------------|-------------|
| Match all tags starting with "work" | `^work.*` | e.g.: work, working, workspace |
| Match all tags containing "note" | `.*note.*` | e.g.: notebook, notes, reading-note |
| Match "movie" or "film" | `^(movie\|film)$` | Exact match for these two tags |
| Match all numeric tags | `^\d+$` | e.g.: 2023, 001, 42 |
| Match tags containing years | `.*20\d{2}.*` | e.g.: 2020, movie2023 |
| Match nested tags | `.*\/.*` | e.g.: work/project, study/coding |
| Match specific prefixes | `^(work\|study\|life)` | All tags starting with these words |

### Notes

1. **Escape Characters**: Some special characters need to be escaped with backslash `\`, such as `\.`, `\*`, `\+`, etc.
2. **Case Sensitivity**: Regular expressions are case-sensitive by default

## Use Cases
- Daily tag usage, wanting quick tag insertion
- Large tag libraries that need categorization
- Managing movie libraries, book libraries, and other personal archive collections with tags
  
## FAQ

**Q: Why aren't my tag groups showing in the command palette?**

A: You must be in an editable view to call these commands.

**Q: How do I make real-time added tags appear in already open tag selectors and overview pages?**

A: In existing tag selectors: Shift+click the cycle icon to refresh the current selector; In tag overview page: Click any tag group name to refresh and switch modes.

**Q: Which input environments does the plugin support?**

A: The plugin comprehensively supports various input environments:
- **Source Mode YAML Area**: Uses YAML format insertion (`- tagname`), fixed cursor jumping issue during continuous insertion
- **Live Preview Properties Panel**: Click to insert directly into Properties (YAML) view without switching modes
- **Canvas**: Insert tags directly into Canvas cards and embedded notes
- **Markdown Content**: Uses tag format insertion (`#tagname`)
- **Other Plugin Input Fields**: Uniformly uses `#tagname` format with automatic space separation for consecutive insertions




## Feedback and Support

If you have any questions, suggestions, or feedback, please contact through:

- Submit an Issue on GitHub
- Send a message through the Obsidian forum

## License

[MIT License](LICENSE)
