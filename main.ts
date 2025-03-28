import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, WorkspaceLeaf, ItemView } from 'obsidian';
import Sortable from 'sortablejs';

const TAG_GROUP_VIEW = 'tag-group-view';

interface TagGroup {
	name: string;
	tags: string[];
}

interface TagGroupManagerSettings {
	tagGroups: TagGroup[];
	showStarButton: boolean;
}

const DEFAULT_SETTINGS: TagGroupManagerSettings = {
	tagGroups: [],
	showStarButton: true
};

export default class TagGroupManagerPlugin extends Plugin {
	settings: TagGroupManagerSettings;
	
	
	// 添加自定义CSS样式
	addStyle() {
		const styleEl = document.createElement('style');
		styleEl.id = 'tag-group-manager-styles';
		styleEl.textContent = `
			.invalid-tag {
				color: #ff5555 !important;
				text-decoration: line-through;
				opacity: 0.7;
				cursor: not-allowed;
			}
			
			.invalid-tag-input {
				border-color: #ff5555 !important;
				background-color: rgba(255, 85, 85, 0.1);
			}
			
			.tag-item {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding-right: 8px;
			}
			
			.tag-count {
				font-size: 0.8em;
				color: var(--text-muted);
				background-color: var(--background-secondary);
				padding: 2px 6px;
				border-radius: 10px;
				margin-left: 8px;
			}

			.tag-group-container {
				padding: 10px;
			}
			
			.tag-group-item {
				display: flex;
				align-items: center;
				padding: 8px;
				margin: 5px 0;
				background: var(--background-secondary);
				border-radius: 5px;
				cursor: pointer;
				transition: background 0.2s ease;
			}
			
			.tag-group-item:hover {
				background: var(--background-modifier-hover);
			}
			
			.tag-group-handle {
				margin-right: 10px;
				cursor: grab;
				color: var(--text-muted);
			}
			
			.tag-group-name {
				flex-grow: 1;
			}
			
			.dragging {
				opacity: 0.5;
			}

			.add-tag-container {
				margin-top: 10px;
			}

			.manual-add-container {
				display: flex;
				gap: 8px;
				margin-bottom: 8px;
			}

			.library-add-container {
				position: relative;
			}

			.tag-library-container {
				/* 使用styles.css中定义的样式 */
			}

			.library-tag-item {
				padding: 4px 8px;
				cursor: pointer;
				border-radius: 4px;
				transition: background-color 0.2s ease;
			}

			.library-tag-item:hover {
				background-color: var(--background-modifier-hover);
			}

			.library-tag-item.selected {
				background-color: var(--interactive-accent);
				color: var(--text-on-accent);
			}
		`;
		document.head.appendChild(styleEl);
	}

	async onload() {
		await this.loadSettings();

		// 注册视图类型
		this.registerView(
			TAG_GROUP_VIEW,
			(leaf: WorkspaceLeaf) => new TagGroupView(leaf, this)
		);

		// 添加星星按钮到右侧边栏
		const starButton = this.addRibbonIcon('star', '标签组管理器', async () => {
			// 激活标签组管理器视图
			await this.activateView();
			// 关闭所有已打开的标签选择器
			
		});

		// 为每个标签组注册命令
		this.registerTagGroupCommands();

		// 添加设置选项卡
		this.addSettingTab(new TagGroupManagerSettingTab(this.app, this));
		
		// 添加自定义CSS样式
		this.addStyle();
		


		// 添加右键菜单命令：清除笔记中的所有标签
		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, file) => {
				if (file) {
					menu.addItem((item) => {
						item
							.setTitle('清除所有标签')
							.setIcon('tag')
							.onClick(async () => {
								await this.clearAllTags(file);
							});
					});
				}
			})
		);
	}

	// 清除笔记中的所有标签
	async clearAllTags(file: any) {
		try {
			// 先尝试打开文件到当前视图
			let activeLeaf = this.app.workspace.getLeaf();
			if (activeLeaf) {
				await activeLeaf.openFile(file);
			}
			
			// 获取当前活跃的编辑器视图
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			
			if (activeView && activeView.file === file) {
				// 如果成功打开文件并获取到编辑器，使用编辑器API进行修改
				const editor = activeView.editor;
				const content = editor.getValue();
				
				// 使用正则表达式移除所有标签
				// 匹配 #tag 格式的标签，确保不会误删其他内容
				let newContent = content.replace(/#[\w\u4e00-\u9fa5\-_/]+/g, '');
				
				// 删除上下文标签之间的空格
				// 匹配两个标签之间的空白字符
				newContent = newContent.replace(/\n\s*\n/g, '\n');
				
				// 通过编辑器接口替换全部内容，这样可以支持撤销
				editor.setValue(newContent);
				
				// 显示成功通知
				new Notice('已清除所有标签（支持撤销）');
			} else {
				// 如果无法打开文件到编辑器，则使用原来的方法
				// 读取文件内容
				const content = await this.app.vault.read(file);
				
				// 使用正则表达式移除所有标签
				let newContent = content.replace(/#[\w\u4e00-\u9fa5\-_/]+/g, '');
				
				// 删除上下文标签之间的空格
				newContent = newContent.replace(/\n\s*\n/g, '\n');
				
				// 写入修改后的内容
				await this.app.vault.modify(file, newContent);
				
				// 显示成功通知
				new Notice('已清除所有标签');
			}
		} catch (error) {
			console.error('清除标签时出错:', error);
			new Notice('清除标签失败: ' + error);
		}
	}

	onunload() {
		// 清理工作
		
	}



	// 注册每个标签组的命令
	registerTagGroupCommands() {
		// 清除现有命令
		// @ts-ignore
		this.app.commands.commands = Object.fromEntries(
			// @ts-ignore
			Object.entries(this.app.commands.commands).filter(([id]) => !id.startsWith('tag-group-manager:insert-'))
		);

		// 为每个标签组注册新命令
		this.settings.tagGroups.forEach(group => {
			this.addCommand({
				id: `insert-tags-from-${group.name.toLowerCase().replace(/\s+/g, '-')}`,
				name: `在此处插入「${group.name}」里的标签`,
				editorCallback: (editor: Editor, view: MarkdownView) => {
					if (group.tags.length > 0) {
						new TagSelectorModal(this.app, editor, group.tags.slice(), this).open();
					} else {
						new Notice('该标签组没有标签');
					}
				}
			});
		});
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		// 更新命令
		this.registerTagGroupCommands();
	}

	async activateView() {
		const { workspace } = this.app;
		let leaf: WorkspaceLeaf | null = null;

		// 查找已存在的视图
		for (let l of workspace.getLeavesOfType(TAG_GROUP_VIEW)) {
			leaf = l;
			break;
		}

		// 如果没有找到，创建新的视图
		if (!leaf) {
			leaf = workspace.getRightLeaf(false);
		}

		// 确保leaf不为null后再进行操作
		if (leaf) {
			await leaf.setViewState({
				type: TAG_GROUP_VIEW,
				active: true,
			});
			workspace.revealLeaf(leaf);
		}
	}
}

// 标签选择器（不使用模态框）
class TagSelectorModal {
	private app: App;
	private editor: Editor;
	private tags: string[];
	private originalTags: string[]; // 保存原始标签列表
	public containerEl: HTMLElement;
	private rootEl: HTMLElement;
	
	private isInfiniteMode: boolean = false; // 是否处于循环模式
	private dragHandle: HTMLElement;
	private initialX: number = 0;
	private initialY: number = 0;
	private offsetX: number = 0;
	private offsetY: number = 0;
	private plugin: TagGroupManagerPlugin | null = null;
	private pinButton: HTMLElement;
	private groupName: string = '';

	constructor(app: App, editor: Editor, tags: string[], plugin?: TagGroupManagerPlugin) {
		this.app = app;
		this.editor = editor;
		this.tags = tags;
		this.originalTags = [...tags]; // 保存原始标签列表的副本
		this.plugin = plugin || null;
		// 创建根元素
		this.rootEl = document.createElement('div');
		this.rootEl.addClass('tag-group-selector-modal');
		
		// 创建UI并添加到DOM
		this.createUI();
		document.body.appendChild(this.rootEl);
		
		// 设置拖拽
		this.setupDrag();
		
	}

	open() {
		// 修改open方法，移除自动插入第一个标签的逻辑
		// 只显示标签选择界面，不自动插入任何标签
		this.renderTags();
	}
	

	
	// 设置位置
	setPosition(left: number, top: number) {
		this.rootEl.style.left = `${left}px`;
		this.rootEl.style.top = `${top}px`;
	}
	
	createUI() {
		// 创建顶部栏
		const topBar = this.rootEl.createDiv('tag-selector-top-bar');
		
		// 创建拖动句柄，显示当前标签组名称
		this.dragHandle = topBar.createDiv('tag-selector-drag-handle');
		
		// 查找当前标签组名称
		let groupName = '标签组';
		if (this.plugin && this.plugin.settings.tagGroups) {
			// 通过比较标签列表找到匹配的标签组
			const matchedGroup = this.plugin.settings.tagGroups.find(group => 
				JSON.stringify(group.tags) === JSON.stringify(this.originalTags));
			if (matchedGroup) {
				groupName = matchedGroup.name;
			}
		}
		this.dragHandle.setText(groupName);
		
		// 创建循环按钮
		const infiniteButton = topBar.createDiv('tag-selector-infinite-button');
		infiniteButton.setText('🔄');
		// 使用aria-label属性代替title和setTooltip，并标注当前循环模式的开关状态
		infiniteButton.setAttribute('aria-label', '循环模式：已关闭 - 点击开启循环模式，可恢复所有标签并保持数量不变。Shift+点击可从标签组更新标签列表。');
		// 移除使用plugins属性的代码
		infiniteButton.addEventListener('click', async (e: MouseEvent) => {
			// 如果按住Shift键点击，则更新标签组
			if (this.plugin && e.shiftKey) {
				// 先重新加载插件设置，确保获取最新数据
				await this.plugin.loadSettings();
				
				// 查找当前标签组
				const currentGroup = this.findCurrentTagGroup();
				if (currentGroup) {
					// 更新原始标签列表
					this.originalTags = [...currentGroup.tags];
					
					// 找出新添加的标签（在原始标签中但不在当前标签中的）
					const newTags = currentGroup.tags.filter(tag => !this.tags.includes(tag));
					
					// 将新标签添加到当前标签列表
					this.tags = [...this.tags, ...newTags];
					
					// 显示通知
					if (newTags.length > 0) {
						new Notice(`已更新标签组，添加了${newTags.length}个新标签`);
					} else {
						new Notice('标签组已是最新状态');
					}
				} else {
					new Notice('无法找到匹配的标签组');
				}
			} else {
				// 原有的循环模式逻辑
				this.isInfiniteMode = !this.isInfiniteMode;
				
				if (this.isInfiniteMode) {
					// 启用循环模式时，恢复所有原始标签
					this.tags = [...this.originalTags];
					infiniteButton.addClass('active');
					infiniteButton.setAttribute('aria-label', '循环模式：已开启 - 点击关闭循环模式。Shift+点击可从标签组更新标签列表。');
				} else {
					infiniteButton.removeClass('active');
					infiniteButton.setAttribute('aria-label', '循环模式：已关闭 - 点击开启循环模式，可恢复所有标签并保持数量不变。Shift+点击可从标签组更新标签列表。');
				}
			}
			
			// 重新渲染标签列表
			this.renderTags();
		});
		
	
		
		// 创建关闭按钮
		const closeButton = topBar.createDiv('tag-selector-close-button');
		closeButton.setText('✕');
		closeButton.setAttribute('aria-label', '关闭标签选择器窗口');
		// 移除title属性，避免提示重复出现
		closeButton.addEventListener('click', () => {
			this.close();
		});
		
		// 创建标签容器
		this.containerEl = this.rootEl.createDiv('tag-selector-container');
		
		// 设置初始位置（居中）
		const windowWidth = window.innerWidth;
		const windowHeight = window.innerHeight;
		this.rootEl.style.left = `${windowWidth / 2 - 150}px`;
		this.rootEl.style.top = `${windowHeight / 2 - 100}px`;
	}

	setupDrag() {
		this.dragHandle.addEventListener('mousedown', (e) => {
			
			e.preventDefault();
			
			// 获取初始位置
			this.initialX = e.clientX;
			this.initialY = e.clientY;
			
			// 获取当前位置
			const rect = this.rootEl.getBoundingClientRect();
			this.offsetX = this.initialX - rect.left;
			this.offsetY = this.initialY - rect.top;
			
			// 添加移动和释放事件监听器
			document.addEventListener('mousemove', this.handleMouseMove);
			document.addEventListener('mouseup', this.handleMouseUp);
		});
	}

	handleMouseMove = (e: MouseEvent) => {
		
		e.preventDefault();
		
		// 计算新位置
		const newX = e.clientX - this.offsetX;
		const newY = e.clientY - this.offsetY;
		
		// 应用新位置
		this.rootEl.style.left = `${newX}px`;
		this.rootEl.style.top = `${newY}px`;
	};

	handleMouseUp = () => {
		// 移除事件监听器
		document.removeEventListener('mousemove', this.handleMouseMove);
		document.removeEventListener('mouseup', this.handleMouseUp);


		document.removeEventListener('mouseup', this.handleMouseUp);
	};

	// 验证标签是否符合语法规则
	isValidTag(tag: string): boolean {
		// 检查标签是否以.开头或包含其他不符合语法的字符
		return !!tag && tag.length > 0 && !/^\.|[\s\[\]\(\)\{\}\<\>\#\:\;\,\'\"\?\=\+\`\~\!\@\$\%\^\&\*]/.test(tag);
	}
	
	// 查找当前标签组
	findCurrentTagGroup(): TagGroup | null {
		if (!this.plugin || !this.plugin.settings.tagGroups) return null;
		
		// 首先通过标签组名称查找（如果拖动句柄显示的是标签组名称）
		const groupNameFromHandle = this.dragHandle.textContent;
		if (groupNameFromHandle) {
			const groupByName = this.plugin.settings.tagGroups.find(group => 
				group.name === groupNameFromHandle);
			if (groupByName) return groupByName;
		}
		
		// 然后尝试通过比较原始标签列表找到匹配的标签组
		let matchedGroup = this.plugin.settings.tagGroups.find(group => 
			JSON.stringify(group.tags.sort()) === JSON.stringify([...this.originalTags].sort()));
		
		// 如果没有找到完全匹配的，尝试找到包含最多相同标签的组
		if (!matchedGroup) {
			let maxMatchCount = 0;
			let bestMatchGroup = null;
			
			for (const group of this.plugin.settings.tagGroups) {
				// 计算共同标签的数量
				const commonTags = group.tags.filter(tag => this.originalTags.includes(tag));
				
				if (commonTags.length > maxMatchCount) {
					maxMatchCount = commonTags.length;
					bestMatchGroup = group;
				}
			}
			
			// 如果找到了最佳匹配且共同标签数量超过原始标签的一半，则使用该组
			if (bestMatchGroup && maxMatchCount >= this.originalTags.length / 2) {
				matchedGroup = bestMatchGroup;
			}
		}
		
		return matchedGroup || null;
	}

	// 获取标签使用次数
	async getTagCount(tag: string): Promise<number> {
		// 使用resolvedLinks来获取标签引用信息
		const files = this.app.vault.getMarkdownFiles();
		let count = 0;
		
		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (cache?.tags) {
				count += cache.tags.filter(t => t.tag === `#${tag}`).length;
			}
		}
		
		return count;
	}

	async renderTags() {
		// 清空容器
		this.containerEl.empty();
		
		// 渲染每个标签
		for (const tag of this.tags) {
			const tagEl = this.containerEl.createDiv('tag-item');
			
			// 检查标签是否有效
			const isValid = this.isValidTag(tag);
			if (!isValid) {
				tagEl.addClass('invalid-tag');
			}
			
			// 创建标签文本容器
			const tagTextEl = tagEl.createDiv('tag-text');
			tagTextEl.setText(tag);
			
			// 添加标签计数
			const tagCountEl = tagEl.createDiv('tag-count');
			const count = await this.getTagCount(tag);
			tagCountEl.setText(`${count}`);
			tagCountEl.setAttribute('aria-label', `在库中使用了 ${count} 次`);
			
			// 添加点击事件
			tagEl.addEventListener('click', async (e) => {
				// 阻止事件冒泡，避免触发关闭事件
				e.stopPropagation();
				
				if (!isValid) return;
				
				// 在编辑器中插入标签
				const cursor = this.editor.getCursor();
				const line = this.editor.getLine(cursor.line);
				const charBefore = cursor.ch > 0 ? line[cursor.ch - 1] : '\n';
				
				// 如果光标前的字符不是空格或换行符，则先添加一个空格
				const prefix = (charBefore !== ' ' && charBefore !== '\n') ? ' ' : '';
				const tagText = `${prefix}#${tag} `;
				this.editor.replaceRange(tagText, cursor);
				
				// 将光标移动到插入的标签末尾
				const newCursor = {
					line: cursor.line,
					ch: cursor.ch + tagText.length
				};
				this.editor.setCursor(newCursor);
				
				// 在非循环模式下，将标签添加已插入样式
				if (!this.isInfiniteMode) {
					tagEl.addClass('inserted-tag');
					// 从标签列表中移除该标签
					this.tags = this.tags.filter(t => t !== tag);
				}
				
				// 立即更新计数显示
				tagCountEl.setText(`${count + 1}`);
				tagCountEl.setAttribute('aria-label', `在库中使用了 ${count + 1} 次`);
				
				// 等待元数据缓存更新后再次刷新计数
				setTimeout(async () => {
					const newCount = await this.getTagCount(tag);
					tagCountEl.setText(`${newCount}`);
					tagCountEl.setAttribute('aria-label', `在库中使用了 ${newCount} 次`);
				}, 3000); // 将延迟时间增加到3秒，给予元数据缓存更多的更新时间
			});
		}
	}

	close() {
		// 从DOM中移除元素
		if (this.rootEl && this.rootEl.parentNode) {
			this.rootEl.parentNode.removeChild(this.rootEl);
		}
	}
}

// 设置选项卡
class TagGroupManagerSettingTab extends PluginSettingTab {
	plugin: TagGroupManagerPlugin;

	constructor(app: App, plugin: TagGroupManagerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: '标签组管理器设置' });



		// 添加新标签组的按钮
		new Setting(containerEl)
			.setName('添加新标签组')
			.setDesc('创建一个新的标签组')
			.addButton(cb => cb
				.setButtonText('添加标签组')
				.onClick(async () => {
					this.plugin.settings.tagGroups.push({
						name: '新标签组',
						tags: []
					});
					await this.plugin.saveSettings();
					this.display();
				}));

		// 显示现有标签组
		this.plugin.settings.tagGroups.forEach((group, index) => {
			const groupSetting = new Setting(containerEl)
				.setName('标签组')
				.setDesc('管理标签组及其标签')
				.addText(text => text
					.setPlaceholder('标签组名称')
					.setValue(group.name)
					.onChange(async (value) => {
						this.plugin.settings.tagGroups[index].name = value;
						await this.plugin.saveSettings();
					}))
				.addButton(cb => cb
					.setButtonText('删除')
					.onClick(async () => {
						this.plugin.settings.tagGroups.splice(index, 1);
						await this.plugin.saveSettings();
						this.display();
					}));

			// 标签管理区域
			const tagsContainer = containerEl.createDiv('tags-container');
			const tagsHeader = tagsContainer.createDiv('tags-header');
			tagsHeader.setText(`${group.name}`);

			// 显示现有标签
			const tagsList = tagsContainer.createDiv('tags-list');
			group.tags.forEach((tag, tagIndex) => {
				const tagEl = tagsList.createDiv('tag-item');
				
				const tagText = tagEl.createSpan('tag-text');
				tagText.setText(`#${tag}`);
				
				const deleteBtn = tagEl.createSpan('tag-delete-btn');
				deleteBtn.setText('✕');
				deleteBtn.addEventListener('click', async () => {
					this.plugin.settings.tagGroups[index].tags.splice(tagIndex, 1);
					await this.plugin.saveSettings();
					this.display();
				});
			});

			// 添加新标签
            const addTagContainer = tagsContainer.createDiv('add-tag-container');
            
            // 创建手动添加标签的容器
            const manualAddContainer = addTagContainer.createDiv('manual-add-container');
            const addTagInput = manualAddContainer.createEl('input', {
                type: 'text',
                placeholder: '输入标签（不含#）'
            });
            
            const addTagBtn = manualAddContainer.createEl('button', {
                text: '手动添加标签'
            });

            // 创建从标签库添加的容器
            const libraryAddContainer = addTagContainer.createDiv('library-add-container');
            const addFromLibraryBtn = libraryAddContainer.createEl('button', {
                text: '从标签库中直接添加'
            });

            // 创建标签库浮动区域
            const tagLibraryContainer = libraryAddContainer.createDiv('tag-library-container');
            tagLibraryContainer.style.display = 'none';

            // 从标签库添加按钮点击事件
            addFromLibraryBtn.addEventListener('click', async () => {
                const isVisible = tagLibraryContainer.style.display !== 'none';
                
                if (isVisible) {
                    // 如果标签库已显示，则是确认添加操作
                    tagLibraryContainer.style.display = 'none';
                    addFromLibraryBtn.style.backgroundColor = '';
                    addFromLibraryBtn.textContent = '从标签库中直接添加';
                    this.display(); // 刷新当前标签组
                } else {
                    // 显示标签库
                    tagLibraryContainer.style.display = 'block';
                    addFromLibraryBtn.style.backgroundColor = '#2ecc71';
                    addFromLibraryBtn.textContent = '点击此处确认添加';
                    
                    // 清空并重新加载标签库
                    tagLibraryContainer.empty();

                    // 获取所有文件的标签
                    const allTags = new Set<string>();
                    this.app.vault.getMarkdownFiles().forEach(file => {
                        const cache = this.app.metadataCache.getFileCache(file);
                        if (cache?.tags) {
                            cache.tags.forEach(tag => {
                                // 移除#前缀并添加到集合
                                allTags.add(tag.tag.substring(1));
                            });
                        }
                    });

                    // 过滤掉所有标签组中已使用的标签
                    const usedTags = new Set<string>();
                    this.plugin.settings.tagGroups.forEach(group => {
                        group.tags.forEach(tag => usedTags.add(tag));
                    });
                    const availableTags = Array.from(allTags)
                        .filter(tag => !usedTags.has(tag))
                        .sort();

                    // 创建标签选择界面
                    availableTags.forEach(tag => {
                        const tagEl = tagLibraryContainer.createDiv('library-tag-item');
                        tagEl.setText(tag);
                        tagEl.addEventListener('click', async () => {
                            // 添加标签到组
                            if (!this.plugin.settings.tagGroups[index].tags.includes(tag)) {
                                this.plugin.settings.tagGroups[index].tags.push(tag);
                                await this.plugin.saveSettings();
                                tagEl.addClass('selected');
                            }
                        });
                    });
                }
            });
			
			// 验证标签是否符合语法规则的函数
			const isValidTag = (tag: string): boolean => {
				// 检查标签是否以.开头或包含其他不符合语法的字符
				return !!tag && tag.length > 0 && !/^\.|[\s\[\]\(\)\{\}\<\>\#\:\;\,\'\"\?\=\+\`\~\!\@\$\%\^\&\*]/.test(tag);
			};

			addTagBtn.addEventListener('click', async () => {
				const tagValue = addTagInput.value.trim();
				
				// 验证标签是否符合语法规则
				if (!isValidTag(tagValue)) {
					new Notice('无法添加不符合语法的标签：' + tagValue);
					return;
				}
				
				if (tagValue && !this.plugin.settings.tagGroups[index].tags.includes(tagValue)) {
					this.plugin.settings.tagGroups[index].tags.push(tagValue);
					await this.plugin.saveSettings();
					addTagInput.value = '';
					this.display();
				}
			});
			
			// 添加输入验证，在输入时实时检查
			addTagInput.addEventListener('input', () => {
				const tagValue = addTagInput.value.trim();
				if (!isValidTag(tagValue) && tagValue.length > 0) {
					addTagInput.classList.add('invalid-tag-input');
					addTagInput.setAttribute('aria-label', '此标签不符合语法规则');
				} else {
					addTagInput.classList.remove('invalid-tag-input');
					addTagInput.removeAttribute('aria-label');
				}
			});
		});
	}
}

// 标签组视图
class TagGroupView extends ItemView {
    plugin: TagGroupManagerPlugin;
    private groupSortable: any;
    private tagSortables: any[] = [];

    constructor(leaf: WorkspaceLeaf, plugin: TagGroupManagerPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return TAG_GROUP_VIEW;
    }

    getDisplayText(): string {
        return '标签组管理器';
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        await this.renderTagGroups();
    }

    async renderTagGroups() {
        const container = this.containerEl.children[1];
        container.empty();

        // 创建标签组容器
        const groupContainer = container.createDiv('tag-group-container');

        // 渲染标签组
        this.plugin.settings.tagGroups.forEach((group, groupIndex) => {
            const groupEl = groupContainer.createDiv('tag-group-item');

            // 添加拖拽手柄
            const handle = groupEl.createDiv('tag-group-handle');
            handle.setText('☰');

            // 添加组名
            const nameEl = groupEl.createDiv('tag-group-name');
            nameEl.setText(group.name);
            
            // 添加点击事件处理
            nameEl.addEventListener('click', () => {
                // 重新渲染标签组
                this.renderTagGroups();
                new Notice(`已刷新「${group.name}」标签组`);
            });

            // 创建标签容器
            const tagsContainer = groupEl.createDiv('tags-container');
            
            // 渲染标签
            group.tags.forEach(tag => {
                const tagEl = tagsContainer.createDiv('tag-item');
                tagEl.setText(tag);
                tagEl.setAttribute('data-tag', tag);
            });

            // 为每个标签组创建Sortable实例
            this.tagSortables.push(
                Sortable.create(tagsContainer, {
                    group: 'tags',
                    animation: 150,
                    onEnd: async (evt: Sortable.SortableEvent) => {
                        const tag = evt.item.getAttribute('data-tag');
                        const groupItem = evt.from.closest('.tag-group-item');
                        const groupIndexAttr = groupItem?.getAttribute('data-group-index');
                        const fromGroupIndex = groupIndexAttr ? parseInt(groupIndexAttr) : -1;
                        const toGroupItem = evt.to.closest('.tag-group-item');
                        const toGroupIndexAttr = toGroupItem?.getAttribute('data-group-index');
                        const toGroupIndex = toGroupIndexAttr ? parseInt(toGroupIndexAttr) : -1;

                        // 更新数据
                        if (fromGroupIndex !== -1 && toGroupIndex !== -1) {
                            // 从源组移除标签
                            this.plugin.settings.tagGroups[fromGroupIndex].tags = 
                                this.plugin.settings.tagGroups[fromGroupIndex].tags.filter(t => t !== tag);

                            // 添加到目标组
                            if (tag && this.plugin.settings.tagGroups[toGroupIndex] && 
                                !this.plugin.settings.tagGroups[toGroupIndex].tags.includes(tag)) {
                                this.plugin.settings.tagGroups[toGroupIndex].tags.splice(
                                    evt.newIndex || 0,
                                    0,
                                    tag
                                );
                            }

                            await this.plugin.saveSettings();
                        }
                    }
                })
            );

            // 添加组索引属性
            groupEl.setAttribute('data-group-index', groupIndex.toString());
        });

        // 创建标签组Sortable实例
        this.groupSortable = Sortable.create(groupContainer, {
            animation: 150,
            handle: '.tag-group-handle',
            onEnd: async (evt: Sortable.SortableEvent) => {
                const fromIndex = evt.oldIndex;
                const toIndex = evt.newIndex;

                // 更新标签组顺序
                if (typeof fromIndex === 'number' && typeof toIndex === 'number') {
                    const movedGroup = this.plugin.settings.tagGroups.splice(fromIndex, 1)[0];
                    this.plugin.settings.tagGroups.splice(toIndex, 0, movedGroup);
                    await this.plugin.saveSettings();
                }
            }
        });
    }

    async onClose() {
        // 清理Sortable实例
        if (this.groupSortable) {
            this.groupSortable.destroy();
        }
        this.tagSortables.forEach(sortable => sortable.destroy());
        this.tagSortables = [];
    }
}