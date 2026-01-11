import { App, TFile, Notice, parseFrontMatterTags, CachedMetadata } from 'obsidian';
import { i18n } from './i18n';
import type TagGroupManagerPlugin from '../main';

export class TagRenamer {
    app: App;
    plugin: TagGroupManagerPlugin;

    constructor(app: App, plugin: TagGroupManagerPlugin) {
        this.app = app;
        this.plugin = plugin;
    }

    /**
     * Renames a tag globally across the vault.
     * @param oldTag The tag to rename (without #)
     * @param newTag The new tag name (without #)
     * @param includeCanvas Whether to also rename tags in .canvas files
     */
    async renameTag(oldTag: string, newTag: string, includeCanvas: boolean = false): Promise<void> {
        // Normalize tags (remove # if user provided it)
        const oldTagCore = oldTag.startsWith('#') ? oldTag.substring(1) : oldTag;
        const newTagCore = newTag.startsWith('#') ? newTag.substring(1) : newTag;

        if (!oldTagCore || !newTagCore || oldTagCore === newTagCore) {
            new Notice(i18n.t('messages.invalidTagRename'));
            return;
        }

        let processedFiles = 0;
        const errors: string[] = [];

        new Notice(i18n.t('messages.renamingTag').replace('#{old}', oldTagCore).replace('#{new}', newTagCore));

        // 1. Process Markdown Files
        const files = this.app.vault.getMarkdownFiles();
        for (const file of files) {
            try {
                if (await this.fileHasTag(file, oldTagCore)) {
                    await this.processFile(file, oldTagCore, newTagCore);
                    processedFiles++;
                }
            } catch (e) {
                console.error(`Failed to rename tag in file ${file.path}:`, e);
                errors.push(file.path);
            }
        }

        // 2. Process Canvas Files (Optional)
        if (includeCanvas) {
            const canvasFiles = this.app.vault.getFiles().filter(f => f.extension === 'canvas');
            for (const file of canvasFiles) {
                try {
                    const modified = await this.processCanvasFile(file, oldTagCore, newTagCore);
                    if (modified) processedFiles++;
                } catch (e) {
                    console.error(`Failed to rename tag in canvas ${file.path}:`, e);
                    errors.push(file.path);
                }
            }
        }

        // 3. Update Sync Settings (Tag Groups)
        // Iterate through all tag groups and update the tag name
        let settingsUpdated = false;
        if (this.plugin.settings.tagGroups) {
            this.plugin.settings.tagGroups.forEach(group => {
                if (group.tags) {
                    // Find if the group has the exact tag
                    const index = group.tags.indexOf(oldTagCore);
                    if (index !== -1) {
                        group.tags[index] = newTagCore;
                        settingsUpdated = true;
                    }
                    // Also handle nested tags if necessary (though simple replacement handles exact matches)
                    // If we support hierarchy rename (a -> b), then a/c -> b/c should also be updated in groups?
                    // Current Tag Group implementation stores full tag strings.
                    // So we should check for startsWith
                    for (let i = 0; i < group.tags.length; i++) {
                        if (group.tags[i].startsWith(oldTagCore + '/')) {
                            group.tags[i] = newTagCore + group.tags[i].substring(oldTagCore.length);
                            settingsUpdated = true;
                        }
                    }
                }
            });
        }

        if (settingsUpdated) {
            await this.plugin.saveSettings();
        }

        let message = i18n.t('messages.renameComplete').replace('{count}', processedFiles.toString());
        if (errors.length > 0) {
            message += `\n` + i18n.t('messages.renameErrors').replace('{count}', errors.length.toString());
        }
        new Notice(message);
    }

    /**
     * Checks if a file contains the tag (frontmatter or inline).
     */
    private async fileHasTag(file: TFile, tag: string): Promise<boolean> {
        const cache = this.app.metadataCache.getFileCache(file);
        if (!cache) return false;

        // Check frontmatter tags
        const frontmatterTags = parseFrontMatterTags(cache.frontmatter);
        if (frontmatterTags) {
            for (const t of frontmatterTags) {
                const tName = t.startsWith('#') ? t.substring(1) : t;
                if (tName === tag || tName.startsWith(tag + '/')) {
                    return true;
                }
            }
        }

        // Check inline tags
        if (cache.tags) {
            for (const t of cache.tags) {
                const tName = t.tag.startsWith('#') ? t.tag.substring(1) : t.tag;
                if (tName === tag || tName.startsWith(tag + '/')) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Processes a single file to rename the tag in both frontmatter and content.
     */
    private async processFile(file: TFile, oldTag: string, newTag: string): Promise<void> {
        // 1. Process Frontmatter safely
        await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
            // Function to recursively rename tags in an array or string
            const replaceInValue = (val: any): any => {
                if (typeof val === 'string') {
                    if (val === oldTag) return newTag;
                    if (val.startsWith(oldTag + '/')) return newTag + val.substring(oldTag.length);
                    return val;
                }
                if (Array.isArray(val)) {
                    return val.map(replaceInValue);
                }
                return val;
            };

            // 'tags' and 'tag' can be string or array
            if (frontmatter['tags']) {
                frontmatter['tags'] = replaceInValue(frontmatter['tags']);
            }
            if (frontmatter['tag']) {
                frontmatter['tag'] = replaceInValue(frontmatter['tag']);
            }
        });

        // 2. Process Inline Tags in the body
        let content = await this.app.vault.read(file);

        const escapedOldTag = this.escapeRegExp(oldTag);

        // Regex: /(#)oldTag(?=[\/\s\p{P}]|$)/gu
        const regex = new RegExp(`(#)${escapedOldTag}(?=[\\/\\s\\p{P}]|$)`, 'gu');

        if (regex.test(content)) {
            const newContent = content.replace(regex, `$1${newTag}`);
            if (newContent !== content) {
                await this.app.vault.modify(file, newContent);
            }
        }
    }

    private async processCanvasFile(file: TFile, oldTag: string, newTag: string): Promise<boolean> {
        const content = await this.app.vault.read(file);
        try {
            const canvasData = JSON.parse(content);
            let modified = false;

            if (canvasData.nodes && Array.isArray(canvasData.nodes)) {
                for (const node of canvasData.nodes) {
                    // Check 'text' property for Text Nodes or Group Nodes (which might have labels)
                    if (node.text && typeof node.text === 'string') {
                        // Simple replace for now, similar to simple text file but manually
                        const escapedOldTag = this.escapeRegExp(oldTag);
                        const regex = new RegExp(`(#)${escapedOldTag}(?=[\\/\\s\\p{P}]|$)`, 'gu');

                        if (regex.test(node.text)) {
                            node.text = node.text.replace(regex, `$1${newTag}`);
                            modified = true;
                        }
                    }
                    // Note: Canvas doesn't officially support 'tags' property yet like Frontmatter
                    // If it does in future, handle it here.
                }
            }

            if (modified) {
                await this.app.vault.modify(file, JSON.stringify(canvasData, null, '\t')); // Pretty print? Or try to keep original formatting?
                // JSON.stringify will reformat. But typically acceptable for .canvas
                return true;
            }
        } catch (e) {
            console.error(`Error parsing canvas file ${file.path}`, e);
        }
        return false;
    }

    private escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
    }
}
