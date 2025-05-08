import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, WorkspaceLeaf, ItemView } from 'obsidian';
import Sortable from 'sortablejs';
import { i18n } from './src/i18n';
import { getAllTags } from "obsidian";


const TAG_GROUP_VIEW = 'tag-group-view';

interface TagGroup {
	name: string;
	tags: string[];
}

interface TagGroupManagerSettings {
	tagGroups: TagGroup[];
	showStarButton: boolean;
	language: string;
}

const DEFAULT_SETTINGS: TagGroupManagerSettings = {
	tagGroups: [],
	showStarButton: true,
	language: 'zh'
};

export default class TagGroupManagerPlugin extends Plugin {
	settings: TagGroupManagerSettings;
	
	
	
	async onload() {
		await this.loadSettings();

		// 设置保存的语言
		i18n.setLocale(this.settings.language);

		// 注册视图类型
		this.registerView(
			TAG_GROUP_VIEW,
			(leaf: WorkspaceLeaf) => new TagGroupView(leaf, this)
		);

		// 添加星星按钮到右侧边栏
		const starButton = this.addRibbonIcon('star', i18n.t('overview.title'), async () => {
			// 激活标签组管理器视图
			await this.activateView();
			// 关闭所有已打开的标签选择器
			
		});

		// 为每个标签组注册命令
		this.registerTagGroupCommands();

		// 添加设置选项卡
		this.addSettingTab(new TagGroupManagerSettingTab(this.app, this));
		

		// 添加右键菜单命令：清除笔记中的所有标签
		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, file) => {
				if (file) {
					menu.addItem((item) => {
						item
							.setTitle(i18n.t('commands.clearTags'))
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
				new Notice(i18n.t('messages.tagsCleared') + ' (' + i18n.t('messages.supportsUndo') + ')');
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
				new Notice(i18n.t('messages.tagsCleared'));
			}
		} catch (error) {
			console.error('清除标签时出错:', error);
			new Notice(i18n.t('messages.tagsClearFailed') + ': ' + error);
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
				name: i18n.t('commands.insertFrom').replace('{groupName}', group.name),
				editorCallback: (editor: Editor, view: MarkdownView) => {
					if (group.tags.length > 0) {
						new TagSelectorModal(this.app, editor, group.tags.slice(), this).open();
					} else {
						new Notice(i18n.t('messages.noTagsInGroup'));
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
	private isSearchBoxFocused: boolean = false; // 搜索框是否处于焦点状态

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
		
		// 监听搜索框的焦点变化
		this.setupSearchBoxListener();
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
		infiniteButton.setAttribute('aria-label', i18n.t('messages.cycleButtonTooltip'));
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
						new Notice(i18n.t('messages.tagGroupUpdated').replace('{count}', newTags.length.toString()));
					} else {
						new Notice(i18n.t('messages.tagGroupUpToDate'));
					}
				} else {
					new Notice(i18n.t('messages.noMatchingTagGroup'));
				}
			} else {
				// 原有的循环模式逻辑
				this.isInfiniteMode = !this.isInfiniteMode;
				
				if (this.isInfiniteMode) {
					// 启用循环模式时，恢复所有原始标签
					this.tags = [...this.originalTags];
					infiniteButton.addClass('active');
					infiniteButton.setAttribute('aria-label', i18n.t('messages.cycleButtonTooltip1'));
				} else {
					infiniteButton.removeClass('active');
					infiniteButton.setAttribute('aria-label', i18n.t('messages.cycleButtonTooltip2'));
				}
			}
			
			// 重新渲染标签列表
			this.renderTags();
		});
		
	
		
		// 创建关闭按钮
		const closeButton = topBar.createDiv('tag-selector-close-button');
		closeButton.setText('✕');
		closeButton.addEventListener('click', () => {
			this.close();
		});
		
		// 创建标签容器
		this.containerEl = this.rootEl.createDiv('tag-selector-container');
		
		// 设置初始位置（右上角）
		const windowWidth = window.innerWidth;
		const windowHeight = window.innerHeight;
		const modalWidth = 300; // 标签选择器的宽度
		const modalHeight = 200; // 标签选择器的高度
		const padding = 20; // 与窗口边缘的距离
		
		// 计算右上角位置，确保不会超出窗口边界
		this.rootEl.style.left = `${windowWidth - modalWidth - padding}px`;
		this.rootEl.style.top = `${padding}px`;
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

	// 监听搜索框的焦点变化
	setupSearchBoxListener() {
		// 监听搜索框的焦点变化
		const searchInput = document.querySelector('.search-input-container input');
		if (searchInput) {
			searchInput.addEventListener('focus', () => {
				this.isSearchBoxFocused = true;
				
			});
			searchInput.addEventListener('blur', () => {
				this.isSearchBoxFocused = false;

			});
		}
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
		const files = this.app.vault.getMarkdownFiles();
		let count = 0;
		
		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (cache) {
				const allTags = getAllTags(cache);
				count += allTags?.filter(t => t === `#${tag}`).length || 0;
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
			tagCountEl.setAttribute('aria-label', i18n.t('messages.tagcounttip').replace('{count}', count.toString()));
			
			// 添加点击事件
			tagEl.addEventListener('mousedown', async (e) => {
				e.preventDefault(); 
				// 阻止事件冒泡，避免触发关闭事件
				e.stopPropagation();
				
				if (!isValid) return;

				// 检查是否在搜索框中
				if (this.isSearchBoxFocused) {
					// 获取搜索框元素
					const searchInput = document.querySelector('.search-input-container input') as HTMLInputElement;
					if (searchInput) {
						// 获取当前光标位置
						const cursorPos = searchInput.selectionStart ?? 0;
						const currentValue = searchInput.value;

						// 在光标位置插入标签（不带#前缀）
						const prefix = (cursorPos > 0 && currentValue[cursorPos - 1] !== ' ') ? ' ' : '';
						const suffix = (cursorPos < currentValue.length && currentValue[cursorPos] !== ' ') ? ' ' : '';
						const insertText = `${prefix}#${tag}${suffix}`;

						// 更新搜索框的值
						const newValue = currentValue.slice(0, cursorPos) + insertText + currentValue.slice(cursorPos);
						searchInput.value = newValue;

						// 触发input事件以更新搜索结果
						const inputEvent = new Event('input', { bubbles: true });
						searchInput.dispatchEvent(inputEvent);

						// 更新光标位置
						const newCursorPos = cursorPos + insertText.length;
						searchInput.setSelectionRange(newCursorPos, newCursorPos);
						searchInput.focus();

						// 在非循环模式下，将标签添加已插入样式
						if (!this.isInfiniteMode) {
							tagEl.addClass('inserted-tag');
						}
					}
				} else {
					// 在编辑器中插入标签
					const cursor = this.editor.getCursor();
					const line = this.editor.getLine(cursor.line);
					
					// 检查是否在YAML区域内
					let isInYaml = false;
					let yamlTagLine = -1;
					const content = this.editor.getValue();
					const lines = content.split('\n');
					let yamlStart = false;
					let yamlEnd = false;
				
					// 检查YAML前置元数据区域
					for (let i = 0; i < lines.length; i++) {
						if (i === 0 && lines[i] === '---') {
							yamlStart = true;
							continue;
						}
						if (yamlStart && lines[i] === '---') {
							yamlEnd = true;
							break;
						}
						if (yamlStart && !yamlEnd) {
							// 检查是否在YAML区域内且光标在当前行
							if (cursor.line === i) {
								isInYaml = true;
							}
							// 查找tags标签所在行
							if (lines[i].trim().startsWith('tags:')) {
								yamlTagLine = i;
							}
						}
					}
					
					let newCursor;
					let tagText = '';
					if (isInYaml) {
						// 在YAML区域内使用YAML格式
						if (yamlTagLine === -1) {
							// 如果没有tags标签，创建一个
							this.editor.replaceRange('tags:\n  - ' + tag + '\n', cursor);
							newCursor = { line: cursor.line + 2, ch: 0 };
						} else {
							// 在已有的tags下添加新标签
							// 找到最后一个标签的位置
							let lastTagLine = yamlTagLine;
							for (let i = yamlTagLine + 1; i < lines.length; i++) {
								const line = lines[i].trim();
								if (line.startsWith('- ')) {
									lastTagLine = i;
								} else if (!line.startsWith('  ') || line === '---') {
									break;
								}
							}
							// 在最后一个标签后面添加新标签
							const pos = { line: lastTagLine + 1, ch: 0 };
							this.editor.replaceRange('  - ' + tag + '\n', pos);
							newCursor = { line: lastTagLine + 2, ch: 0 };
						}
					} else {
						// 在正文中使用普通格式
						const charBefore = cursor.ch > 0 ? line[cursor.ch - 1] : '\n';
						const prefix = (charBefore !== ' ' && charBefore !== '\n') ? ' ' : '';
						tagText = `${prefix}#${tag} `;
						this.editor.replaceRange(tagText, cursor);
						newCursor = {
							line: cursor.line,
							ch: cursor.ch + tagText.length
						};
					}
					
					// 将光标移动到插入的标签末尾
					this.editor.setCursor(newCursor);

					// 在非循环模式下，将标签添加已插入样式
					if (!this.isInfiniteMode) {
						tagEl.addClass('inserted-tag');
					}
				}
				
				// 立即更新计数显示
				tagCountEl.setText(`${count + 1}`);
				
				// 等待元数据缓存更新后再次刷新计数
				setTimeout(async () => {
					const newCount = await this.getTagCount(tag);
					tagCountEl.setText(`${newCount}`);
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

		containerEl.createEl('h2', { text: i18n.t('settings.title') });

		// 添加语言选择器
		new Setting(containerEl)
			.setName('Language')
			.setDesc('选择插件界面语言')
			.addDropdown(dropdown => dropdown
				.addOption('zh', '中文')
				.addOption('en', 'English')
				.setValue(this.plugin.settings.language)
				.onChange(async (value) => {
					this.plugin.settings.language = value;
					i18n.setLocale(value);
					await this.plugin.saveSettings();
					this.display(); // 重新渲染设置页面
				})
			);



		// 添加新标签组的按钮
		new Setting(containerEl)
			.setName(i18n.t('settings.addGroup'))
			.setDesc(i18n.t('settings.enterGroupName'))
			.addButton(cb => cb
				.setButtonText(i18n.t('settings.addGroup'))
				.onClick(async () => {
					this.plugin.settings.tagGroups.push({
						name: i18n.t('settings.groupName'),
						tags: []
					});
					await this.plugin.saveSettings();
					this.display();
				}));

		// 显示现有标签组
		this.plugin.settings.tagGroups.forEach((group, index) => {
			const groupSetting = new Setting(containerEl)
				.setName(i18n.t('settings.groupName'))
				.setDesc(i18n.t('settings.enterGroupName'))
				.addText(text => text
					.setPlaceholder(i18n.t('settings.groupName'))
					.setValue(group.name)
					.onChange(async (value) => {
						this.plugin.settings.tagGroups[index].name = value;
						await this.plugin.saveSettings();
					}))
				.addButton(cb => cb
					.setButtonText(i18n.t('settings.deleteGroup'))
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
                placeholder: i18n.t('settings.enterTagName')
            });
            
            const addTagBtn = manualAddContainer.createEl('button', {
                text: i18n.t('settings.addTag')
            });

            // 创建从标签库添加的容器
            const libraryAddContainer = addTagContainer.createDiv('library-add-container');
            const addFromLibraryBtn = libraryAddContainer.createEl('button', {
                text: i18n.t('settings.addFromLibrary')
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
                    addFromLibraryBtn.textContent = i18n.t('settings.addFromLibrary');
                    this.display(); // 刷新当前标签组
                } else {
                    // 显示标签库
                    tagLibraryContainer.style.display = 'block';
                    addFromLibraryBtn.style.backgroundColor = '#2ecc71';
                    addFromLibraryBtn.textContent = i18n.t('settings.addTag');
                    
                    // 清空并重新加载标签库
                    tagLibraryContainer.empty();

                    // 获取所有文件的标签
                    const allTags = new Set<string>();
                    for (const file of this.app.vault.getMarkdownFiles()) {
						const cache = this.app.metadataCache.getFileCache(file);
						if (!cache) continue;
					
						const tags = getAllTags(cache);
						if (tags) {
							tags.forEach(tag => allTags.add(tag.substring(1))); // 去掉 #
						}
					}

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
					new Notice(i18n.t('messages.invalidTagName') + ': ' + tagValue);
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
					addTagInput.setAttribute('aria-label', i18n.t('messages.invalidTagName'));
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
    private isInsertMode: boolean = false;

    constructor(leaf: WorkspaceLeaf, plugin: TagGroupManagerPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return TAG_GROUP_VIEW;
    }

    getDisplayText(): string {
        return i18n.t('overview.title');
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        await this.renderTagGroups();
    }



    async renderTagGroups() {
        const container = this.containerEl.children[1];
        container.empty();

        // 创建状态切换按钮容器
        const stateControlContainer = container.createDiv('state-control-container');
        const stateToggleBtn = stateControlContainer.createEl('button', {
            text: this.isInsertMode ? i18n.t('overview.sortMode') : i18n.t('overview.insertMode'),
            cls: 'state-toggle-button'
        });

        stateToggleBtn.addEventListener('click', () => {
            this.isInsertMode = !this.isInsertMode;
            this.renderTagGroups();
        });

        // 创建标签组容器
        const groupContainer = container.createDiv('tag-group-container');

        // 渲染标签组
        this.plugin.settings.tagGroups.forEach((group, groupIndex) => {
            const groupEl = groupContainer.createDiv('tag-group-item');
            groupEl.setAttribute('data-group-index', groupIndex.toString());

            // 在非插入模式下添加拖拽手柄
            if (!this.isInsertMode) {
                const handle = groupEl.createDiv('tag-group-handle');
                handle.setText('☰');
            }

            // 添加组名，在插入模式下移动到右边
            const nameEl = groupEl.createDiv('tag-group-name');
            nameEl.setText(group.name);
            if (this.isInsertMode) {
                nameEl.addClass('insert-mode');
            }
            
            // 添加点击事件处理
            if (!this.isInsertMode) {
                // 在排序模式下，点击标签组名称刷新标签组
                nameEl.addEventListener('click', () => {
                    this.renderTagGroups();
                    new Notice(i18n.t('overview.refresh') + `: ${group.name}`);
                });
            } else {
                // 在插入模式下，点击标签组名称显示提示
                nameEl.addEventListener('click', () => {
                    new Notice(i18n.t('commands.insertHere'));
                });
            }

            // 创建标签容器
            const tagsContainer = groupEl.createDiv('tags-view-container');
            
            // 渲染标签
            group.tags.forEach(tag => {
				
                const tagEl = tagsContainer.createDiv('tag-item');
                tagEl.setText(tag);
                tagEl.setAttribute('data-tag', tag);
                
                // 在插入模式下为标签添加点击事件
                if (this.isInsertMode) {
                    tagEl.addClass('clickable');
                    tagEl.addEventListener('mousedown', (e) => {
                        e.preventDefault(); // 防止焦点丢失
                        e.stopPropagation(); // 阻止事件冒泡

                        // 检查当前焦点是否在搜索框中
                        const searchInput = document.querySelector('.search-input-container input') as HTMLInputElement;
                        const isSearchBoxFocused = searchInput && document.activeElement === searchInput;

                        if (isSearchBoxFocused) {
                            // 在搜索框中插入标签
                            const cursorPos = searchInput.selectionStart ?? 0;
                            const currentValue = searchInput.value;

                            // 在光标位置插入标签（不带#前缀）
                            const prefix = (cursorPos > 0 && currentValue[cursorPos - 1] !== ' ') ? ' ' : '';
                            const suffix = (cursorPos < currentValue.length && currentValue[cursorPos] !== ' ') ? ' ' : '';
                            const insertText = `${prefix}#${tag}${suffix}`;

                            // 更新搜索框的值
                            const newValue = currentValue.slice(0, cursorPos) + insertText + currentValue.slice(cursorPos);
                            searchInput.value = newValue;

                            // 触发input事件以更新搜索结果
                            const inputEvent = new Event('input', { bubbles: true });
                            searchInput.dispatchEvent(inputEvent);

                            // 更新光标位置
                            const newCursorPos = cursorPos + insertText.length;
                            searchInput.setSelectionRange(newCursorPos, newCursorPos);
                            searchInput.focus();
                            return;
                        }

                        // 如果不在搜索框中，则插入到编辑器
                        const mostRecentLeaf = this.app.workspace.getMostRecentLeaf();

                        if (!mostRecentLeaf) {
							new Notice(i18n.t('messages.noEditorFound') || "未找到可用编辑器，请先打开一个文档");
							return;
						}
                        
                        mostRecentLeaf.setViewState({ type: "markdown", active: true });
                        // 等待一个短暂的时间让焦点生效
                        setTimeout(() => {
							const view = this.app.workspace.getActiveViewOfType(MarkdownView);
							const editor = view?.editor;
					
							if (!editor) {
								new Notice(i18n.t('messages.openMarkdownFirst') || "请先打开一个 Markdown 文档并将光标放置在插入位置");
								console.log("⚠️ 当前 view:", view);
								return;
							}
                        
								// 让编辑器重新获得焦点
				            editor.focus();
				
                            const cursor = editor.getCursor();
                            const line = editor.getLine(cursor.line);
                            const content = editor.getValue();
                            const lines = content.split('\n');
                            let yamlStart = false;
                            let yamlEnd = false;
                            let isInYaml = false;
                            let yamlTagLine = -1;

                            // 检查YAML前置元数据区域
                            for (let i = 0; i < lines.length; i++) {
                                if (i === 0 && lines[i] === '---') {
                                    yamlStart = true;
                                    continue;
                                }
                                if (yamlStart && lines[i] === '---') {
                                    yamlEnd = true;
                                    break;
                                }
                                if (yamlStart && !yamlEnd) {
                                    // 检查是否在YAML区域内且光标在当前行
                                    if (cursor.line === i) {
                                        isInYaml = true;
                                    }
                                    // 查找tags标签所在行
                                    if (lines[i].trim().startsWith('tags:')) {
                                        yamlTagLine = i;
                                    }
                                }
                            }
							console.log(`YAML区域状态: 开始=${yamlStart}, 结束=${yamlEnd}, 在区域内=${isInYaml}, tags行=${yamlTagLine}`);
                            let newCursor;
                            let tagText = '';
                            if (isInYaml) {
                                // 在YAML区域内使用YAML格式
                                if (yamlTagLine === -1) {
                                    // 如果没有tags标签，创建一个
                                    editor.replaceRange('tags:\n  - ' + tag + '\n', cursor);
                                    newCursor = { line: cursor.line + 2, ch: 0 };
                                } else {
                                    // 在已有的tags下添加新标签
                                    // 找到最后一个标签的位置
                                    let lastTagLine = yamlTagLine;
                                    for (let i = yamlTagLine + 1; i < lines.length; i++) {
                                        const line = lines[i].trim();
                                        if (line.startsWith('- ')) {
                                            lastTagLine = i;
                                        } else if (!line.startsWith('  ') || line === '---') {
                                            break;
                                        }
                                    }
                                    // 在最后一个标签后面添加新标签
                                    const pos = { line: lastTagLine + 1, ch: 0 };
                                    editor.replaceRange('  - ' + tag + '\n', pos);
                                    newCursor = { line: lastTagLine + 2, ch: 0 };
                                }
                            } else {
                                // 在正文中使用普通格式
                                const charBefore = cursor.ch > 0 ? line[cursor.ch - 1] : '\n';
                                const prefix = (charBefore !== ' ' && charBefore !== '\n') ? ' ' : '';
                                tagText = `${prefix}#${tag} `;
                                editor.replaceRange(tagText, cursor);
                                newCursor = {
                                    line: cursor.line,
                                    ch: cursor.ch + tagText.length
                                };
                            }
                            
                            // 将光标移动到插入的标签末尾
                            editor.setCursor(newCursor);
                        }, 50);
                    });
                }
            });

            // 在非插入模式下创建Sortable实例
            if (!this.isInsertMode) {
                this.tagSortables.push(
                    Sortable.create(tagsContainer, {
                        group: 'tags',
                        animation: 150,
                        onEnd: async (evt: Sortable.SortableEvent) => {
                            const tag = evt.item.getAttribute('data-tag');
                            const fromGroupItem = evt.from.closest('.tag-group-item');
                            const toGroupItem = evt.to.closest('.tag-group-item');
                            const fromGroupIndex = parseInt(fromGroupItem?.getAttribute('data-group-index') || '0');
                            const toGroupIndex = parseInt(toGroupItem?.getAttribute('data-group-index') || '0');

                            // 更新标签顺序
                            const newTags: string[] = [];
                            evt.to.querySelectorAll('.tag-item').forEach((el) => {
                                const tagValue = el.getAttribute('data-tag');
                                if (tagValue) newTags.push(tagValue);
                            });

                            if (fromGroupIndex !== toGroupIndex) {
                                // 从源组中移除标签
                                this.plugin.settings.tagGroups[fromGroupIndex].tags = 
                                    this.plugin.settings.tagGroups[fromGroupIndex].tags.filter(t => t !== tag);

                                // 添加到目标组
                                if (tag && !this.plugin.settings.tagGroups[toGroupIndex].tags.includes(tag)) {
                                    this.plugin.settings.tagGroups[toGroupIndex].tags.push(tag);
                                }
                            } else {
                                // 更新同一组内的标签顺序
                                this.plugin.settings.tagGroups[fromGroupIndex].tags = newTags;
                            }

                            await this.plugin.saveSettings();
                        }
                    })
                );
            }
        });

        // 在非插入模式下创建组排序实例
        if (!this.isInsertMode) {
            this.groupSortable = Sortable.create(groupContainer, {
                animation: 150,
                handle: '.tag-group-handle',
                onEnd: async () => {
                    // 更新组的顺序
                    const newGroups: TagGroup[] = [];
                    groupContainer.querySelectorAll('.tag-group-item').forEach((el) => {
                        const index = parseInt(el.getAttribute('data-group-index') || '0');
                        newGroups.push(this.plugin.settings.tagGroups[index]);
                    });
                    this.plugin.settings.tagGroups = newGroups;
                    await this.plugin.saveSettings();
                }
            });
        }
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