import { App, Component, TFile, getAllTags, MarkdownView, setIcon, Notice } from 'obsidian';
import TagGroupManagerPlugin from '../main';
import { i18n } from './i18n';

interface HierarchyNode {
    name: string;
    fullName: string;
    children: Map<string, HierarchyNode>;
    depth: number;
}

export class HierarchyBoard extends Component {
    app: App;
    plugin: TagGroupManagerPlugin;
    containerEl: HTMLElement;
    boardEl: HTMLElement;
    isVisible: boolean = false;
    isPinned: boolean = false;
    isMouseOverBoard: boolean = false;
    currentRootTag: string = '';
    private caller: any = null;
    private hTimer: number | null = null;

    constructor(app: App, plugin: TagGroupManagerPlugin) {
        super();
        this.app = app;
        this.plugin = plugin;
    }

    onload() {
        // 创建悬浮看板容器
        this.containerEl = document.body.createDiv('tgm-hierarchy-board-container');
        this.containerEl.style.display = 'none';

        // 看板主体
        this.boardEl = this.containerEl.createDiv('tgm-hierarchy-board');

        // 监听鼠标移入/移出以处理自动隐藏逻辑
        this.boardEl.addEventListener('mouseenter', () => {
            this.isMouseOverBoard = true;
            if (this.hTimer) {
                window.clearTimeout(this.hTimer);
                this.hTimer = null;
            }
        });
        this.boardEl.addEventListener('mouseleave', () => {
            this.isMouseOverBoard = false;
            // 如果未固定，移出看板时延迟隐藏
            if (!this.isPinned) {
                this.hide(200);
            }
        });

        // 全局点击事件：未固定时点击外部关闭
        document.addEventListener('click', (e) => {
            if (this.isVisible && this.isPinned) {
                const target = e.target as HTMLElement;
                if (!this.boardEl.contains(target) && !target.classList.contains('tgm-hierarchy-trigger')) {
                    this.hide();
                }
            }
        });
    }

    onunload() {
        if (this.containerEl) {
            this.containerEl.remove();
        }
    }

    show(rootTag: string, triggerRect: DOMRect, pinned: boolean = false, caller?: any) {
        this.caller = caller;
        this.currentRootTag = rootTag;
        // Correct positioning logic and robust show

        // If already showing same tag, just update pinned status if needed
        if (this.isVisible && this.currentRootTag === rootTag) {
            if (pinned) {
                this.isPinned = true;
                this.boardEl.addClass('pinned');
            }
            this.containerEl.style.display = 'block';
            this.boardEl.addClass('tgm-show');
            // Cancel any pending hide
            if (this.hTimer) {
                window.clearTimeout(this.hTimer);
                this.hTimer = null;
            }
            return;
        }

        // Cancel pending hide if switching to a new tag
        if (this.hTimer) {
            window.clearTimeout(this.hTimer);
            this.hTimer = null;
        }

        this.currentRootTag = rootTag;
        this.isVisible = true;
        this.isPinned = pinned;
        this.containerEl.style.display = 'block';

        // Clear previous content
        this.boardEl.empty();
        // Remove old positioning styles to prevent conflict
        this.boardEl.style.removeProperty('top');
        this.boardEl.style.removeProperty('left');
        this.boardEl.style.removeProperty('right');
        this.boardEl.style.removeProperty('bottom');

        // Add Close Button (top-right)
        const closeBtn = this.boardEl.createDiv('tgm-hb-close-btn');
        setIcon(closeBtn, 'x');
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.hide();
        });

        // Add Header
        const header = this.boardEl.createDiv('tgm-hb-header');
        header.setText(rootTag);

        // Build and render tree
        const tree = this.buildTagTree(rootTag);
        const treeContainer = this.boardEl.createDiv('tgm-hb-tree-container');
        this.renderTree(tree, treeContainer);

        // --- Positioning Logic (FIXED) ---
        // Use fixed positioning relative to viewport
        const maxBoardHeight = Math.min(600, window.innerHeight * 0.8);
        const gap = 2; // Slight gap

        // Vertical Alignment
        // Use a more predictable approach: 
        // If in bottom half of screen, grow upwards from the trigger.
        // If in top half of screen, grow downwards from the trigger.
        const isBottomHalf = triggerRect.top > window.innerHeight * 0.5;
        const margin = 20;

        if (isBottomHalf) {
            // Align bottom of board with bottom of trigger
            const bottom = window.innerHeight - triggerRect.bottom;
            this.boardEl.style.bottom = `${bottom}px`;
            this.boardEl.style.top = 'auto';
            // Restrict height to stay within screen
            const availableHeight = triggerRect.bottom - margin;
            this.boardEl.style.maxHeight = `${Math.min(maxBoardHeight, availableHeight)}px`;
        } else {
            // Align top of board with top of trigger
            const top = triggerRect.top;
            this.boardEl.style.top = `${top}px`;
            this.boardEl.style.bottom = 'auto';
            // Restrict height to stay within screen
            const availableHeight = window.innerHeight - triggerRect.top - margin;
            this.boardEl.style.maxHeight = `${Math.min(maxBoardHeight, availableHeight)}px`;
        }

        // Horizontal Alignment
        // Logic: 
        // 1. If trigger is in the RIGHT half of screen (e.g. Sidebar), board goes to LEFT.
        // 2. If trigger is in the LEFT half of screen (e.g. Floating Window), board goes to RIGHT.
        // 3. Exception: If in Left half but not enough space on Right? (Unlikely).

        // Simple Heuristic: If there is more space on the Left, go Left.
        const spaceOnLeft = triggerRect.left;
        const spaceOnRight = window.innerWidth - triggerRect.right;

        if (spaceOnLeft > spaceOnRight) {
            // Place on LEFT
            // right of board = windowWidth - triggerRect.left + gap
            const rightPos = window.innerWidth - triggerRect.left + gap;
            this.boardEl.style.right = `${rightPos}px`;
            this.boardEl.style.left = 'auto';
        } else {
            // Place on RIGHT
            // left of board = triggerRect.right + gap
            this.boardEl.style.left = `${triggerRect.right + gap}px`;
            this.boardEl.style.right = 'auto';
        }

        this.boardEl.style.top = `${top}px`;
        this.boardEl.style.maxHeight = `${maxBoardHeight}px`;

        this.boardEl.addClass('tgm-show');
        if (pinned) {
            this.boardEl.addClass('pinned');
        } else {
            this.boardEl.removeClass('pinned');
        }
    }


    hide(delay: number = 0) {
        if (this.hTimer) window.clearTimeout(this.hTimer);

        if (delay > 0) {
            this.hTimer = window.setTimeout(() => {
                // Double check mouse state before hiding
                if (!this.isMouseOverBoard && !this.isPinned) {
                    this.performHide();
                }
            }, delay);
        } else {
            this.performHide();
        }
    }

    private performHide() {
        this.isVisible = false;
        this.isPinned = false;
        this.isMouseOverBoard = false;
        this.containerEl.style.display = 'none';
        this.boardEl.removeClass('tgm-show');
        this.currentRootTag = '';
    }

    private buildTagTree(rootTag: string): HierarchyNode {
        const allTags = this.getAllVaultTags();
        const rootNode: HierarchyNode = {
            name: rootTag,
            fullName: rootTag,
            children: new Map(),
            depth: 0
        };

        const relatedTags = allTags.filter(t => t === rootTag || t.startsWith(rootTag + '/'));

        relatedTags.forEach(tag => {
            if (tag === rootTag) return;

            // Remove root prefix
            const relativePath = tag.substring(rootTag.length + 1);
            const parts = relativePath.split('/');

            let currentNode = rootNode;
            let currentPath = rootTag;

            parts.forEach((part, index) => {
                currentPath += '/' + part;
                if (!currentNode.children.has(part)) {
                    currentNode.children.set(part, {
                        name: part,
                        fullName: currentPath,
                        children: new Map(),
                        depth: currentNode.depth + 1
                    });
                }
                currentNode = currentNode.children.get(part)!;
            });
        });

        return rootNode;
    }

    private getAllVaultTags(): string[] {
        const tagSet = new Set<string>();
        const files = this.app.vault.getMarkdownFiles();
        for (const file of files) {
            const cache = this.app.metadataCache.getFileCache(file);
            if (cache) {
                const tags = getAllTags(cache);
                if (tags) {
                    tags.forEach(t => tagSet.add(t.substring(1)));
                }
            }
        }
        // Include tags from settings settings to be complete
        this.plugin.settings.tagGroups.forEach(g => g.tags.forEach(t => tagSet.add(t)));
        return Array.from(tagSet);
    }

    private renderTree(node: HierarchyNode, container: HTMLElement) {

        if (node.children.size === 0) {
            const emptyEl = container.createDiv('tgm-hb-empty');
            emptyEl.setText(i18n.t('hierarchyBoard.noSubTags') || 'No sub-tags');
            return;
        }

        const sortedChildren = Array.from(node.children.values()).sort((a, b) => a.name.localeCompare(b.name));
        sortedChildren.forEach(child => this.renderNodeRecursive(child, container));
    }

    private renderNodeRecursive(node: HierarchyNode, parentEl: HTMLElement) {
        const itemEl = parentEl.createDiv('tgm-hb-item');
        itemEl.setAttribute('data-depth', node.depth.toString());

        // Line and content wrapper
        const contentWrapper = itemEl.createDiv('tgm-hb-content-wrapper');

        const pillEl = contentWrapper.createDiv('tgm-hb-pill');
        pillEl.setText(node.name);

        const color = this.plugin.settings.tagColors[node.fullName] || null;
        if (color) {
            pillEl.style.setProperty('--pill-color', color);
            pillEl.addClass('colored');
        }

        pillEl.addEventListener('click', (e) => {
            e.stopPropagation();
            this.insertTag(node.fullName);
            if (!this.isPinned) this.hide();
        });

        if (node.children.size > 0) {
            const childrenContainer = itemEl.createDiv('tgm-hb-children');
            const sortedChildren = Array.from(node.children.values()).sort((a, b) => a.name.localeCompare(b.name));
            sortedChildren.forEach(child => this.renderNodeRecursive(child, childrenContainer));
        }
    }

    private insertTag(tag: string) {
        // 修复：仅在 TagGroupView 且为排序模式时禁止插入 (Request #2)
        // 浮动选择器 (TagSelectorModal) 始终允许插入
        if (this.caller && this.caller.constructor.name === 'TagGroupView') {
            if (!this.caller.isInsertMode) {
                new Notice(i18n.t('messages.cannotInsertInSortMode') || '排序模式下无法插入标签');
                return;
            }
        }

        // 始终插入被点击节点的完整路径
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView) {
            const editor = activeView.editor;
            const cursor = editor.getCursor();
            const textToInsert = `#${tag} `;
            editor.replaceRange(textToInsert, cursor);
            editor.setCursor({ line: cursor.line, ch: cursor.ch + textToInsert.length });
        }
    }
}
