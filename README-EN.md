# Tag Group Manager

![GitHub all releases](https://img.shields.io/github/downloads/stargazer-cc/obsidian-tag-group-manager/total?color=success)

- [中文](https://github.com/Stargazer-cc/obsidian-tag-group-manager/blob/main/README.md)

- For more detailed introduction, [visit Obsidian Forum](https://forum.obsidian.md)

## Introduction

Tag Group Manager is a plugin designed for Obsidian that helps manage and quickly insert tags. It allows users to create custom tag groups and quickly insert tags into notes through a floating window, improving the efficiency of note organization and classification.

![image](https://github.com/Stargazer-cc/obsidian-tag-group-manager/blob/main/image.jpg)


## Features

- **Tag Group Management**: Create, edit, and delete custom tag groups
  - Support manual tag addition, meaning the same tag can be added to different groups
  - Support adding from existing tags in your vault with filtering functionality, avoiding duplicates
  - Support batch filtering to add multiple tags to groups at once, activated buttons turn green and display "Confirm Selection" to clearly indicate current state

- **Tag Group Sets**: Organize multiple tag groups into sets for easy context switching
  - **One-Click Switching**: Quickly switch between different sets via the button below group names in the overview view
  - **Independent Sorting**: Each set has its own independent tag group order
  - **Flexible Management**: Create, edit, and delete sets with custom names and icons (Lucide)

- **Floating Tag Selector**: Draggable and pinnable tag selection interface
  - **One-to-one correspondence between tag groups and floating selectors**: Each new tag group registers a floating selector generation command
  - **Quick Tag Insertion**: Quickly call the tag selector through the command palette or hotkeys for insertion
  - **Auto-dimming After Use**: Used tags switch to a different state to avoid duplicate additions, this process can be reset and cycled

- **Tag Overview View**: Functional integration center in the right sidebar
  - **Insertion Mode Switching**: Switch between sorting/insertion modes by clicking any tag group name
    - **Sorting Mode**: Supports drag-and-drop sorting of tag groups and cross-group tag sorting, drag handles appear above tag group names
    - **Insertion Mode**: Click to directly insert tags
  - **Set Switching**: Switch between different tag group sets by clicking the icon button below any tag group set name
    - **Tag Group Sorting**: Supports drag-and-drop sorting of tag groups and cross-group tag sorting, drag handles appear above tag group names

- **Comprehensive Tag Insertion Support**
  - **Source Code YAML Area**: YAML frontmatter in both Source Mode and Live Preview
  - **Live Preview or Reading Mode Properties Panel**: Click to insert directly into the graphical tags property value without switching to source mode
  - **Canvas Support**: Insert tags directly into Canvas cards and embedded notes
  - **Search Box**: Support inserting tags directly into various Obsidian search boxes
  - **Other Plugin Support**: Support inserting tags into input boxes or editor areas of other plugins

- **Custom Tag Colors**: Set personalized colors for tags
  - **Color Settings Master Switch**: One-click enable/disable tag color functionality without affecting saved configurations
  - **Single Tag Color Settings**: Left-click tags in the tag group settings on the settings page to open color settings popup
    - **Seven Preset Colors**: Provides seven rainbow directory-style preset colors (Red, Blue, Green, Orange, Purple, Cyan, Pink)
    - **Custom Colors**: Support adding custom colors to color slots, automatically saves last 7 colors used
  - **Batch Color Settings**: Independent settings area supporting string and regex pattern matching
  - **Unified Visual Style**: When enabled, all tags apply soft gradient background styles

- **Multi-language Support**: Automatically detects Obsidian language settings
  - Chinese interface for Chinese users
  - English interface for other language users

- **Quick Clear All Tags**
  - Available in the right-click menu when a note is selected

  

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
2. After enabling color settings, tag styles are better adapted to light interfaces. Although adapted for dark interfaces, there may still be some disharmony.

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

## Use Cases
- Daily tag usage, wanting quick tag insertion
- Large tag libraries where multi-level tags are undesirable
- Managing movie libraries, book libraries, and other personal archive collections with tags, working elegantly with Quickadd and Buttons for archive note entry
  
## FAQ

**Q: Why aren't my tag groups showing in the command palette?**

A: You must be in an editable view to call these commands.

**Q: How do I make real-time added tags appear in already open tag selectors and overview pages?**

A: In existing tag selectors: Shift+click the cycle icon to refresh the current selector; In tag overview page: Click any tag group name to refresh and switch modes.

**Q: How can I change the color of tag units?**

A: The plugin now supports custom tag color functionality:
1. Enable "Enable Custom Tag Colors" in settings
2. Add color mapping by entering tag names or regex patterns
3. Choose from preset rainbow colors or custom colors
4. Matching tags will automatically apply the set colors

**Q: What's the difference between rainbow colors and custom colors?**

A: Rainbow colors use the rainbow directory style system with gradient backgrounds, transparency effects, and 3D shadows that automatically adapt to Obsidian themes. Custom colors use solid backgrounds, suitable for scenarios requiring specific colors.

**Q: Which input environments does the plugin support?**

A: The plugin comprehensively supports various input environments:
- **Source Mode YAML Area**: Uses YAML format insertion (`- tagname`), fixed cursor jumping issue during continuous insertion
- **Live Preview Properties Panel**: Click to insert directly into Properties (YAML) view without switching modes
- **Canvas**: Insert tags directly into Canvas cards and embedded notes
- **Markdown Content**: Uses tag format insertion (`#tagname`)
- **Other Plugin Input Fields**: Uniformly uses `#tagname` format with automatic space separation for consecutive insertions

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
3. **Testing Recommendation**: Suggest testing with simple patterns first, confirm matching results before applying colors
4. **Performance Consideration**: Overly complex regular expressions may affect performance, keep them simple




## Feedback and Support

If you have any questions, suggestions, or feedback, please contact through:

- Submit an Issue on GitHub
- Send a message through the Obsidian forum

## License

[MIT License](LICENSE)
