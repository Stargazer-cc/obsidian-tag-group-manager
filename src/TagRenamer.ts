/**
 * Tag Renaming Feature
 * 
 * This module provides vault-wide tag renaming functionality.
 * 
 * Acknowledgment:
 * This implementation is inspired by and adapted from the Tag Wrangler plugin
 * (https://github.com/pjeby/tag-wrangler) by @pjeby.
 * 
 * Tag Wrangler is licensed under the MIT License, which permits free use,
 * modification, and distribution of the code under the terms of the license.
 * 
 * We are grateful for @pjeby's excellent work and open-source contribution.
 */

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
     * Deletes a tag globally across the vault.
     * @param oldTag The tag to delete (without #)
     * @param cascadeDelete Whether to also delete child tags
     * @param includeCanvas Whether to also delete tags in .canvas files
     */
    async deleteTag(oldTag: string, cascadeDelete: boolean, includeCanvas: boolean = false): Promise<void> {
        const oldTagCore = oldTag.startsWith('#') ? oldTag.substring(1) : oldTag;
        
        if (!oldTagCore) {
            new Notice(i18n.t('messages.invalidTagRename'));
            return;
        }
        
        // 调用 renameTag，但传入特殊参数表示删除模式
        await this.renameTag(oldTag, '', includeCanvas, cascadeDelete);
    }

    /**
     * Renames a tag globally across the vault.
     * @param oldTag The tag to rename (without #)
     * @param newTag The new tag name (without #)
     * @param includeCanvas Whether to also rename tags in .canvas files
     * @param cascadeOperation For operations, whether to cascade to child tags (rename/delete children)
     */
    async renameTag(oldTag: string, newTag: string, includeCanvas: boolean = false, cascadeOperation: boolean = true): Promise<void> {
        // Normalize tags (remove # if user provided it)
        const oldTagCore = oldTag.startsWith('#') ? oldTag.substring(1) : oldTag;
        const newTagCore = newTag.startsWith('#') ? newTag.substring(1) : newTag;

        // 验证：旧标签不能为空，且新旧标签不能相同
        if (!oldTagCore || oldTagCore === newTagCore) {
            new Notice(i18n.t('messages.invalidTagRename'));
            return;
        }

        // 如果新标签为空，视为删除操作
        const isDeleteOperation = !newTagCore || newTagCore.trim() === '';

        let processedFiles = 0;
        let canvasProcessed = 0;
        const errors: string[] = [];

        if (isDeleteOperation) {
            new Notice(i18n.t('messages.deletingTag').replace('{tag}', oldTagCore));
        } else {
            new Notice(i18n.t('messages.renamingTag').replace('{old}', oldTagCore).replace('{new}', newTagCore));
        }

        // 1. Process Markdown Files
        const files = this.app.vault.getMarkdownFiles();
        for (const file of files) {
            try {
                if (await this.fileHasTag(file, oldTagCore)) {
                    await this.processFile(file, oldTagCore, newTagCore, cascadeOperation);
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
                    if (modified) {
                        canvasProcessed++;
                        processedFiles++;
                    }
                } catch (e) {
                    console.error(`Failed to rename tag in canvas ${file.path}:`, e);
                    errors.push(file.path);
                }
            }
        }

        // 3. Update Sync Settings (Tag Groups)
        // Iterate through all tag groups and update the tag name
        let settingsUpdated = false;
        let groupsUpdated = 0;
        if (this.plugin.settings.tagGroups) {
            this.plugin.settings.tagGroups.forEach(group => {
                if (group.tags) {
                    let groupChanged = false;
                    
                    if (isDeleteOperation) {
                        // 删除操作：从标签组中移除标签
                        const initialLength = group.tags.length;
                        
                        if (cascadeOperation) {
                            // 级联删除：移除标签及其所有子标签
                            group.tags = group.tags.filter(tag => tag !== oldTagCore && !tag.startsWith(oldTagCore + '/'));
                        } else {
                            // 仅删除此标签：只移除精确匹配的标签
                            group.tags = group.tags.filter(tag => tag !== oldTagCore);
                        }
                        
                        if (group.tags.length !== initialLength) {
                            settingsUpdated = true;
                            groupChanged = true;
                        }
                        
                        // 同时从 autoExpandedTags 中移除
                        if (group.autoExpandedTags) {
                            const autoInitialLength = group.autoExpandedTags.length;
                            if (cascadeOperation) {
                                group.autoExpandedTags = group.autoExpandedTags.filter(tag => 
                                    tag !== oldTagCore && !tag.startsWith(oldTagCore + '/')
                                );
                            } else {
                                group.autoExpandedTags = group.autoExpandedTags.filter(tag => tag !== oldTagCore);
                            }
                            if (group.autoExpandedTags.length !== autoInitialLength) {
                                settingsUpdated = true;
                                groupChanged = true;
                            }
                        }
                    } else {
                        // 重命名操作：替换标签名
                        if (cascadeOperation) {
                            // 级联重命名：重命名标签及其所有子标签
                            // Find if the group has the exact tag
                            const index = group.tags.indexOf(oldTagCore);
                            if (index !== -1) {
                                group.tags[index] = newTagCore;
                                settingsUpdated = true;
                                groupChanged = true;
                            }
                            // Also handle nested tags
                            for (let i = 0; i < group.tags.length; i++) {
                                if (group.tags[i].startsWith(oldTagCore + '/')) {
                                    group.tags[i] = newTagCore + group.tags[i].substring(oldTagCore.length);
                                    settingsUpdated = true;
                                    groupChanged = true;
                                }
                            }
                            
                            // 同时更新 autoExpandedTags
                            if (group.autoExpandedTags) {
                                const autoIndex = group.autoExpandedTags.indexOf(oldTagCore);
                                if (autoIndex !== -1) {
                                    group.autoExpandedTags[autoIndex] = newTagCore;
                                    settingsUpdated = true;
                                }
                                for (let i = 0; i < group.autoExpandedTags.length; i++) {
                                    if (group.autoExpandedTags[i].startsWith(oldTagCore + '/')) {
                                        group.autoExpandedTags[i] = newTagCore + group.autoExpandedTags[i].substring(oldTagCore.length);
                                        settingsUpdated = true;
                                    }
                                }
                            }
                        } else {
                            // 仅重命名此标签：只重命名精确匹配的标签
                            const index = group.tags.indexOf(oldTagCore);
                            if (index !== -1) {
                                group.tags[index] = newTagCore;
                                settingsUpdated = true;
                                groupChanged = true;
                            }
                            
                            // 同时更新 autoExpandedTags
                            if (group.autoExpandedTags) {
                                const autoIndex = group.autoExpandedTags.indexOf(oldTagCore);
                                if (autoIndex !== -1) {
                                    group.autoExpandedTags[autoIndex] = newTagCore;
                                    settingsUpdated = true;
                                }
                            }
                        }
                    }
                    
                    if (groupChanged) {
                        groupsUpdated++;
                    }
                }
            });
        }
        
        // 删除操作时，清除标签颜色设置
        if (isDeleteOperation && this.plugin.settings.tagColors) {
            if (this.plugin.settings.tagColors[oldTagCore]) {
                delete this.plugin.settings.tagColors[oldTagCore];
                settingsUpdated = true;
            }
            // 根据 cascadeOperation 决定是否清除子标签的颜色
            if (cascadeOperation) {
                Object.keys(this.plugin.settings.tagColors).forEach(tag => {
                    if (tag.startsWith(oldTagCore + '/')) {
                        delete this.plugin.settings.tagColors[tag];
                        settingsUpdated = true;
                    }
                });
            }
        }

        if (settingsUpdated) {
            await this.plugin.saveSettings();
        }

        // Build detailed completion message
        if (processedFiles === 0 && !settingsUpdated) {
            if (isDeleteOperation) {
                new Notice(i18n.t('messages.renameNoTagFound').replace('{tag}', oldTagCore));
            } else {
                new Notice(i18n.t('messages.renameNoTagFound').replace('{tag}', oldTagCore));
            }
            return;
        }

        let message = i18n.t('messages.renameComplete').replace('{count}', processedFiles.toString());
        
        // Add Canvas info if processed
        if (includeCanvas && canvasProcessed > 0) {
            message += '\n' + i18n.t('messages.renameCanvasProcessed').replace('{count}', canvasProcessed.toString());
        }
        
        // Add tag group update info
        if (settingsUpdated) {
            message += '\n' + i18n.t('messages.renameGroupsUpdated').replace('{count}', groupsUpdated.toString());
        }
        
        // Add error info if any
        if (errors.length > 0) {
            message += '\n' + i18n.t('messages.renameErrors').replace('{count}', errors.length.toString());
        }
        
        new Notice(message, 8000); // Show for 8 seconds due to detailed info
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
    private async processFile(file: TFile, oldTag: string, newTag: string, cascadeOperation: boolean = true): Promise<void> {
        const isDeleteOperation = !newTag || newTag.trim() === '';
        
        // 1. Process Frontmatter safely
        await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
            // Function to recursively rename/delete tags in an array or string
            const replaceInValue = (val: any): any => {
                if (typeof val === 'string') {
                    // 精确匹配
                    if (val === oldTag) {
                        return isDeleteOperation ? null : newTag;
                    }
                    // 子标签匹配
                    if (val.startsWith(oldTag + '/')) {
                        if (isDeleteOperation) {
                            // 删除操作：根据 cascadeOperation 决定是否删除子标签
                            return cascadeOperation ? null : val;
                        } else {
                            // 重命名操作：根据 cascadeOperation 决定是否重命名子标签
                            return cascadeOperation ? newTag + val.substring(oldTag.length) : val;
                        }
                    }
                    return val;
                }
                if (Array.isArray(val)) {
                    const processed = val.map(replaceInValue).filter(v => v !== null);
                    return processed.length > 0 ? processed : undefined;
                }
                return val;
            };

            // 'tags' and 'tag' can be string or array
            if (frontmatter['tags']) {
                const result = replaceInValue(frontmatter['tags']);
                if (result === undefined) {
                    delete frontmatter['tags'];
                } else {
                    frontmatter['tags'] = result;
                }
            }
            if (frontmatter['tag']) {
                const result = replaceInValue(frontmatter['tag']);
                if (result === undefined) {
                    delete frontmatter['tag'];
                } else {
                    frontmatter['tag'] = result;
                }
            }
        });

        // 2. Process Inline Tags in the body
        let content = await this.app.vault.read(file);

        const escapedOldTag = this.escapeRegExp(oldTag);

        if (isDeleteOperation) {
            // 删除操作
            if (cascadeOperation) {
                // 级联删除：删除标签及其所有子标签
                // 匹配 #oldTag 或 #oldTag/...
                const regex = new RegExp(`#${escapedOldTag}(?:[\\/][^\\s]*)?\\s*`, 'gu');
                const newContent = content.replace(regex, '');
                if (newContent !== content) {
                    await this.app.vault.modify(file, newContent);
                }
            } else {
                // 仅删除此标签：只删除精确匹配的标签
                const regex = new RegExp(`#${escapedOldTag}(?=[\\/\\s\\p{P}]|$)\\s*`, 'gu');
                const newContent = content.replace(regex, '');
                if (newContent !== content) {
                    await this.app.vault.modify(file, newContent);
                }
            }
        } else {
            // 重命名操作
            if (cascadeOperation) {
                // 级联重命名：重命名标签及其所有子标签
                const regex = new RegExp(`(#)${escapedOldTag}(?=[\\/\\s\\p{P}]|$)`, 'gu');
                if (regex.test(content)) {
                    const newContent = content.replace(regex, `$1${newTag}`);
                    if (newContent !== content) {
                        await this.app.vault.modify(file, newContent);
                    }
                }
            } else {
                // 仅重命名此标签：只重命名精确匹配的标签
                const regex = new RegExp(`(#)${escapedOldTag}(?=[\\/\\s\\p{P}]|$)`, 'gu');
                const newContent = content.replace(regex, (match, hash, offset) => {
                    // 确保不是子标签的一部分
                    const nextChar = content[offset + match.length];
                    if (nextChar === '/') {
                        return match; // 保持不变
                    }
                    return `${hash}${newTag}`;
                });
                if (newContent !== content) {
                    await this.app.vault.modify(file, newContent);
                }
            }
        }
    }

    private async processCanvasFile(file: TFile, oldTag: string, newTag: string): Promise<boolean> {
        const isDeleteOperation = !newTag || newTag.trim() === '';
        const content = await this.app.vault.read(file);
        try {
            const canvasData = JSON.parse(content);
            let modified = false;

            if (canvasData.nodes && Array.isArray(canvasData.nodes)) {
                for (const node of canvasData.nodes) {
                    // Check 'text' property for Text Nodes or Group Nodes (which might have labels)
                    if (node.text && typeof node.text === 'string') {
                        const escapedOldTag = this.escapeRegExp(oldTag);
                        const regex = new RegExp(`(#)${escapedOldTag}(?=[\\/\\s\\p{P}]|$)`, 'gu');

                        if (regex.test(node.text)) {
                            if (isDeleteOperation) {
                                // 删除标签：移除 #oldTag 及其后面的空格
                                node.text = node.text.replace(new RegExp(`#${escapedOldTag}\\s*`, 'gu'), '');
                            } else {
                                // 重命名标签
                                node.text = node.text.replace(regex, `$1${newTag}`);
                            }
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
