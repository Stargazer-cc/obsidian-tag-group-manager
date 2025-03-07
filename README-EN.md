# Tag Group Manager

## Introduction

Tag Group Manager is a plugin designed for Obsidian that helps manage and quickly insert tags. It allows users to create custom tag groups and quickly insert tags into notes through a floating window, improving the efficiency of note organization and classification.

## Features

- **Tag Group Management**: Create, edit, and delete custom tag groups
- **Quick Tag Insertion**: Quickly access the tag selector through the command palette
- **Floating Tag Selector**: Draggable and pinnable tag selection interface
- **One-Click Insertion**: Click to insert selected tags at cursor position
- **Auto-Remove After Use**: Used tags are automatically removed from the selector to avoid duplication

## Installation

### Manual Installation

1. Download the latest release package
2. Extract the downloaded file
3. Copy the extracted folder to the Obsidian plugins directory: `{your-vault}/.obsidian/plugins/`
4. Restart Obsidian
5. Enable the plugin in settings

## Usage

### Creating Tag Groups

1. Open Obsidian settings
2. Go to the "Tag Group Manager" settings tab
3. Click the "Add Tag Group" button
4. Enter a name for the tag group
5. Add desired tags under the tag group (no need to enter the # symbol)

### Using Tag Groups

1. While editing a note, open the command palette (Ctrl/Cmd + P)
2. Search for "Insert here", which will display all created tag groups
3. Select the tag group you want to use
4. In the tag selector that appears, click on the tags you want to insert
5. Tags will be automatically inserted at the cursor position

### Tag Selector Features

- **Drag**: Click on the "Drag" area at the top to move the selector
- **Pin**: Click the 📌 button to pin the selector and prevent accidental closure
- **Close**: Click the ✕ button or automatically close after selecting all tags

## Configuration

In the plugin settings page, you can:

- Create multiple tag groups, each containing different types of tags
- Edit tag group names
- Add or remove tags within tag groups
- Delete tag groups that are no longer needed

## Use Cases

- **Project Management**: Create groups with project-related tags such as #in-progress, #completed, #pending-review, etc.
- **Study Notes**: Create subject tag groups like #mathematics, #physics, #chemistry, etc.
- **Daily Records**: Create commonly used tag groups for emotions, weather, etc.
- **Content Creation**: Create tag groups for different types of content such as #tutorial, #sharing, #review, etc.

## FAQ

**Q: Why isn't my tag group showing in the command palette?**

A: Make sure you've added at least one tag to the group. Empty tag groups won't appear in the command palette.

**Q: How do I modify tags that have already been added?**

A: In the plugin settings page, find the corresponding tag group and tag, delete it, and then add the modified tag.

**Q: Can multiple tag selectors be displayed simultaneously?**

A: Currently, only one tag selector can be displayed at a time. You can open a new selector after completing or closing the current one.

## Feedback and Support

If you have any questions, suggestions, or feedback, please contact us through:
- Email: ecpink@163.com
- Submit an Issue on GitHub

## Changelog

### 1.0.0

- Initial version release
- Support for creating and managing tag groups
- Implementation of floating tag selector
- Support for dragging and pinning the selector

## License

[MIT License](LICENSE)