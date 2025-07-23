# Tag Group Manager

![GitHub all releases](https://img.shields.io/github/downloads/stargazer-cc/obsidian-tag-group-manager/total?color=success)

- [中文](https://github.com/Stargazer-cc/obsidian-tag-group-manager/blob/main/README.md)

- For more detailed introduction, [visit Obsidian Forum](https://forum.obsidian.md)

## Introduction

Tag Group Manager is a plugin designed for Obsidian that helps manage and quickly insert tags. It allows users to create custom tag groups and quickly insert tags into notes through a floating window, improving the efficiency of note organization and classification.

![image](https://github.com/user-attachments/assets/0e1ab649-68c0-443e-b7a5-6f0ee23aa258)

## Features

- **Tag Group Management**: Create, edit, and delete custom tag groups
  - Support manual tag addition, meaning the same tag can be added to different groups
  - Support adding from existing tags in your vault with filtering functionality, avoiding duplicates
  - Support batch filtering to add multiple tags to groups at once
- **Floating Tag Selector**: Draggable and pinnable tag selection interface
  - **One-to-one correspondence between tag groups and floating selectors**: Each new tag group registers a floating selector generation command
  - **Quick Tag Insertion**: Quickly call the tag selector through the command palette for insertion, supports YAML area insertion
  - **Auto-dimming After Use**: Used tags switch to a different state to avoid duplicate additions
  - **Smart Insertion Rules**: Automatically detects input environment, uses YAML format in YAML areas, unified #tag format in other input fields
- **Tag Overview View**: Tag overview page with sorting mode and tag insertion mode
  - In sorting mode, supports drag-and-drop sorting of tag groups and cross-group tag sorting
  - In tag insertion mode, click to directly insert tags, supports YAML area insertion
- **Custom Tag Colors**: Set personalized colors for tags
  - Support regex pattern matching for tag names
  - Provide seven rainbow directory-style preset colors (Red, Blue, Green, Orange, Purple, Cyan, Pink)
  - Support custom color selection
  - Perfect mimicry of rainbow directory's gradient background and transparency effects
- **Multi-language Support**: Automatically detects Obsidian language settings
  - Chinese interface for Chinese users
  - English interface for other language users
- **Quick Clear All Tags**
  - Available in the right-click menu when a note is selected

## Installation

### Manual Installation

1. Download the latest release package
2. Extract the downloaded file
3. Copy the extracted folder to your Obsidian plugins directory: `{your-vault}/.obsidian/plugins/`
4. Restart Obsidian or refresh third-party plugins
5. Enable the plugin in settings

### BRAT Installation

You can also use BRAT by entering https://github.com/Stargazer-cc/obsidian-tag-group-manager and selecting the latest version to get updates.

## Usage

### Creating Tag Groups

1. Open Obsidian settings
2. Go to the "Tag Group Manager" settings tab
3. Click the "Add Tag Group" button
4. Enter the tag group name
5. Add desired tags under the group (no need to enter the # symbol)

![](https://github.com/Stargazer-cc/obsidian-tag-group-manager/blob/main/4.gif)

### Using Tag Groups

1. While editing a note, open the command palette (Ctrl/Cmd + P)
2. Search for "Insert Here", all created tag groups will be displayed
3. Select the desired tag group
4. Click the tags you want to insert in the popup tag selector
5. Tags will be automatically inserted at the cursor position

### Tag Selector Features

- **Drag**: Click the "Drag" area at the top to move the selector position
- **Close**: Click the ✕ button
- **Cycle**: Can reuse the insertion box multiple times, clicking restores all tags

![](https://github.com/Stargazer-cc/obsidian-tag-group-manager/blob/main/3.gif)

### Tag Overview View
- Click the star icon in the function area to activate this view
- Switch between sorting mode and tag insertion mode
- In sorting mode, supports drag-and-drop sorting of tag groups and cross-group tag sorting
- In tag insertion mode, click to directly insert tags, supports YAML area insertion

![](https://github.com/Stargazer-cc/obsidian-tag-group-manager/blob/main/6.gif)

## Configuration

In the plugin settings page, you can:

### Color Settings
- **Enable Custom Tag Colors**: Enable to set personalized colors for different tags
- **Add Color Mapping**: Set colors for tag names or regex patterns
- **Preset Color Selection**: Provides seven rainbow directory-style preset colors
- **Custom Colors**: Choose any color as tag background

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

A: In existing tag selectors: Shift+click the cycle icon to refresh the current selector; In tag overview page: Click any group name in sorting mode to refresh.

**Q: How can I change the color of tag units?**

A: The plugin now supports custom tag color functionality:
1. Enable "Enable Custom Tag Colors" in settings
2. Add color mapping by entering tag names or regex patterns
3. Choose from preset rainbow colors or custom colors
4. Matching tags will automatically apply the set colors

**Q: What's the difference between rainbow colors and custom colors?**

A: Rainbow colors use the rainbow directory style system with gradient backgrounds, transparency effects, and 3D shadows that automatically adapt to Obsidian themes. Custom colors use solid backgrounds, suitable for scenarios requiring specific colors.

**Q: Which input environments does the plugin support?**

A: The plugin intelligently detects the current input environment:
- YAML area: Uses YAML format insertion (`- tagname`)
- Markdown content: Uses tag format insertion (`#tagname`)
- Other plugin input fields: Uniformly uses `#tagname` format with automatic space separation for consecutive insertions

## Feedback and Support

If you have any questions, suggestions, or feedback, please contact through:

- Submit an Issue on GitHub
- Send a message through the Obsidian forum

## License

[MIT License](LICENSE)
