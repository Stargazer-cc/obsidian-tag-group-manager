import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, WorkspaceLeaf, ItemView, moment } from 'obsidian';
import Sortable from 'sortablejs';
import { i18n } from './src/i18n';
import { getAllTags } from "obsidian";


// Helper function to insert tag into an input element
function insertTagIntoInputElement(inputElement: HTMLInputElement, tag: string, addHashPrefix: boolean = true) {
    const cursorPos = inputElement.selectionStart ?? 0;
    const currentValue = inputElement.value;
    
    let tagToInsert = addHashPrefix ? `#${tag}` : tag;
    
    // Add leading space if necessary
    const prefix = (cursorPos > 0 && currentValue[cursorPos - 1] !== ' ' && currentValue.length > 0) ? ' ' : '';
    // Add trailing space
    const suffix = ' ';

    const textToInsert = `${prefix}${tagToInsert}${suffix}`;

    const newValue = currentValue.slice(0, cursorPos) + textToInsert + currentValue.slice(cursorPos);
    inputElement.value = newValue;

    // Trigger input event to ensure the form framework (e.g., React, Svelte) picks up the change
    const inputEvent = new Event('input', { bubbles: true, cancelable: true });
    inputElement.dispatchEvent(inputEvent);

    // Update cursor position
    const newCursorPos = cursorPos + textToInsert.length;
    inputElement.setSelectionRange(newCursorPos, newCursorPos);
    inputElement.focus();
}

const TAG_GROUP_VIEW = 'tag-group-view';

interface TagGroup {
	name: string;
	tags: string[];
}

interface TagColorMapping {
	pattern: string;  // 标签名或正则表达式
	color: string;    // 颜色值 (hex, rgb, 或 CSS 颜色名)
	isRegex: boolean; // 是否为正则表达式
	enabled: boolean; // 是否启用此映射
}

interface TagGroupManagerSettings {
	tagGroups: TagGroup[];
	showStarButton: boolean;
	tagColorMappings: TagColorMapping[]; // 新增：标签颜色映射表
	enableCustomColors: boolean;         // 新增：是否启用自定义颜色功能
}

const DEFAULT_SETTINGS: TagGroupManagerSettings = {
	tagGroups: [],
	showStarButton: true,
	tagColorMappings: [],
	enableCustomColors: false
};

// 工具函数：根据标签名获取对应的颜色
function getTagColor(tagName: string, colorMappings: TagColorMapping[]): string | null {
	if (!colorMappings || colorMappings.length === 0) {
		return null;
	}

	for (const mapping of colorMappings) {
		if (!mapping.enabled) continue;

		try {
			if (mapping.isRegex) {
				const regex = new RegExp(mapping.pattern, 'i'); // 不区分大小写
				if (regex.test(tagName)) {
					return mapping.color;
				}
			} else {
				// 精确匹配（不区分大小写）
				if (tagName.toLowerCase() === mapping.pattern.toLowerCase()) {
					return mapping.color;
				}
			}
		} catch (error) {
			// 正则表达式错误时跳过此映射
			// console.warn(`Invalid regex pattern in tag color mapping: ${mapping.pattern}`, error);
			continue;
		}
	}

	return null;
}

// 工具函数：根据颜色值获取对应的CSS类
function getColorClass(colorValue: string): string | null {
	const colorMap: {[key: string]: string} = {
		'var(--color-red)': 'tgm-color-red',
		'var(--color-blue)': 'tgm-color-blue',
		'var(--color-green)': 'tgm-color-green',
		'var(--color-orange)': 'tgm-color-orange',
		'var(--color-purple)': 'tgm-color-purple',
		'var(--color-cyan)': 'tgm-color-cyan',
		'var(--color-pink)': 'tgm-color-pink',
	};
	
	return colorMap[colorValue] || null;
}

export default class TagGroupManagerPlugin extends Plugin {
	settings: TagGroupManagerSettings;
	private registeredCommands: string[] = []; // 跟踪已注册的命令ID
	
	
	
	async onload() {
		await this.loadSettings();

		// 使用moment.js获取语言设置（这是Obsidian内部使用的方式）
		const momentLocale = moment.locale() || 'en';
		// 如果是中文相关的locale，使用中文，否则使用英文
		const locale = momentLocale.startsWith('zh') ? 'zh' : 'en';
		i18n.setLocale(locale);

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
			// console.error('清除标签时出错:', error);
			new Notice(i18n.t('messages.tagsClearFailed') + ': ' + error);
		}
	}





	// 注册每个标签组的命令
	registerTagGroupCommands() {
		// 清除现有的标签组命令
		this.registeredCommands.forEach(commandId => {
			// @ts-ignore - removeCommand 是私有方法，但这是清理命令的正确方式
			this.app.commands.removeCommand(commandId);
		});
		this.registeredCommands = [];

		// 为每个标签组注册新命令
		this.settings.tagGroups.forEach(group => {
			const commandId = `${group.name.toLowerCase().replace(/\s+/g, '-')}`;
			this.addCommand({
				id: group.name.toLowerCase().replace(/\s+/g, '-'),
				name: i18n.t('commands.insertFrom').replace('{groupName}', group.name),
				editorCallback: (editor: Editor, view: MarkdownView) => {
					if (group.tags.length > 0) {
						new TagSelectorModal(this.app, editor, group.tags.slice(), this).open();
					} else {
						new Notice(i18n.t('messages.noTagsInGroup'));
					}
				}
			});
			// 记录已注册的命令ID
			this.registeredCommands.push(commandId);
		});
	}

	onunload() {
		// 清理所有注册的命令
		this.registeredCommands.forEach(commandId => {
			// @ts-ignore - removeCommand 是私有方法，但这是清理命令的正确方式
			this.app.commands.removeCommand(commandId);
		});
		this.registeredCommands = [];
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
		
		// 异步设置搜索框监听器
		this.setupSearchBoxListener().catch(() => {
			// 静默处理错误
		});
	}

	open() {
		// 修改open方法，移除自动插入第一个标签的逻辑
		// 只显示标签选择界面，不自动插入任何标签
		this.renderTags();
	}
	

	
	// 设置位置 - 简化为使用CSS类
	setPosition(left: number, top: number) {
		// 我们现在使用固定位置，忽略参数
		this.rootEl.addClass('tgm-position-element');
		this.rootEl.addClass('tgm-position-default');
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
		
		// 使用固定位置类
		this.rootEl.addClass('tgm-position-element');
		this.rootEl.addClass('tgm-position-default');
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
	async setupSearchBoxListener() {
		// 尝试获取搜索框元素
		let searchInput = document.querySelector('.search-input-container input');
		let retryCount = 0;
		const maxRetries = 5;

		// 如果没有找到搜索框，且未超过最大重试次数，则等待后重试
		while (!searchInput && retryCount < maxRetries) {
			await new Promise(resolve => setTimeout(resolve, 1000));
			searchInput = document.querySelector('.search-input-container input');
			retryCount++;
		}

		if (searchInput) {
			searchInput.addEventListener('focus', () => {
				this.isSearchBoxFocused = true;
				// console.log('搜索框获得焦点');
			});
			searchInput.addEventListener('blur', () => {
				this.isSearchBoxFocused = false;
				// console.log('搜索框失去焦点');
			});
		}
		
		// 添加全局点击事件监听器，用于检测搜索框的焦点状态
		document.addEventListener('mousedown', (e) => {
			const searchInput = document.querySelector('.search-input-container input');
			if (searchInput && e.target === searchInput) {
				this.isSearchBoxFocused = true;
				// console.log('通过点击检测到搜索框获得焦点');
			}
		});

		// 添加全局键盘事件监听器，用于检测搜索框的焦点状态
		document.addEventListener('keydown', () => {
			const searchInput = document.querySelector('.search-input-container input');
			if (searchInput && document.activeElement === searchInput) {
				this.isSearchBoxFocused = true;
				// console.log('通过键盘检测到搜索框获得焦点');
			}
		});
	}

	handleMouseMove = (e: MouseEvent) => {
		
		e.preventDefault();
		
		// 计算新位置
		const newX = e.clientX - this.offsetX;
		const newY = e.clientY - this.offsetY;
		
		// 拖动时切换到可拖动样式
		this.rootEl.addClass('tgm-position-element');
		this.rootEl.addClass('tgm-position-draggable');
		this.rootEl.addClass('tgm-position-grid');
		// 移除默认位置
		this.rootEl.removeClass('tgm-position-default');
		
		// 移除所有位置类
		for (let i = 0; i < 20; i++) {
			this.rootEl.removeClass(`tgm-pos-x-${i}`);
			this.rootEl.removeClass(`tgm-pos-y-${i}`);
		}
		
		// 计算网格位置
		const windowWidth = window.innerWidth;
		const windowHeight = window.innerHeight;
		
		// 将绝对像素位置转换为网格索引
		const xIndex = Math.min(19, Math.max(0, Math.floor((newX / windowWidth) * 20)));
		const yIndex = Math.min(19, Math.max(0, Math.floor((newY / windowHeight) * 20)));
		
		// 应用网格位置类
		this.rootEl.addClass(`tgm-pos-x-${xIndex}`);
		this.rootEl.addClass(`tgm-pos-y-${yIndex}`);
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
			const tagEl = this.containerEl.createDiv('tgm-tag-item');

			// 检查标签是否有效
			const isValid = this.isValidTag(tag);
			if (!isValid) {
				tagEl.addClass('invalid-tag');
			}

			// 应用自定义颜色（如果启用且有匹配的颜色映射）
			if (this.plugin && this.plugin.settings.enableCustomColors) {
				const customColor = getTagColor(tag, this.plugin.settings.tagColorMappings);
				if (customColor) {
					// 检查是否是预设的彩虹颜色
					const isRainbowColor = customColor.startsWith('var(--color-');
					if (isRainbowColor) {
						tagEl.addClass('tag-group-manager-rainbow-tag');
						tagEl.setAttribute('data-color', customColor);
					} else {
						// 使用传统的自定义颜色样式
						tagEl.addClass('tgm-custom-color-tag');
						
						// 使用预定义的颜色类
						const colorClass = getColorClass(customColor);
						if (colorClass) {
							tagEl.addClass(colorClass);
						} else {
							// 对于自定义颜色，使用数据属性
							tagEl.setAttribute('data-custom-color', customColor);
						}
						
						tagEl.addClass('custom-colored-tag');
					}
				}
			}

			// 创建标签文本容器
			const tagTextEl = tagEl.createDiv('tgm-tag-text');

			// 检查是否为嵌套标签并添加图标
			let displayText = tag;
			if (tag.includes('/')) {
				displayText = `📁 ${tag}`;
				tagTextEl.addClass('nested-tag');
			}

			tagTextEl.setText(displayText);

			// 使用Obsidian原生的tooltip系统，设置在整个标签项上
			tagEl.setAttribute('aria-label', tag);
			
			// 添加标签计数
			const tagCountEl = tagEl.createDiv('tgm-tag-count');
			const count = await this.getTagCount(tag);
			tagCountEl.setText(`${count}`);
			tagCountEl.setAttribute('aria-label', i18n.t('messages.tagcounttip').replace('{count}', count.toString()));
			
			// 添加点击事件
			tagEl.addEventListener('mousedown', async (e) => {
				// Check for PCards input field first
				const pcardsTagInput = document.querySelector('form.quick-note-form input#tags') as HTMLInputElement;
				if (pcardsTagInput) {
					e.preventDefault();
					e.stopPropagation();
					if (!isValid) return;

					insertTagIntoInputElement(pcardsTagInput, tag);

					if (!this.isInfiniteMode) {
						tagEl.addClass('tgm-inserted-tag');
					}
					// Update count display
					tagCountEl.setText(`${count + 1}`);
					setTimeout(async () => {
						const newCount = await this.getTagCount(tag);
						tagCountEl.setText(`${newCount}`);
					}, 3000);
					return; // Exit if PCards input is handled
				}

				e.preventDefault(); 
				// 阻止事件冒泡，避免触发关闭事件
				e.stopPropagation();
				
				if (!isValid) return;

				// 首先检查是否有任何输入框处于焦点状态（除了Markdown编辑器）
				const activeElement = document.activeElement as HTMLElement;

				// 检查是否是输入框或文本区域（但不是Markdown编辑器）
				const isInputElement = activeElement && (
					activeElement.tagName === 'INPUT' ||
					activeElement.tagName === 'TEXTAREA' ||
					activeElement.contentEditable === 'true'
				);

				// 检查是否是Markdown编辑器
				const isMarkdownEditor = activeElement && (
					activeElement.classList.contains('cm-editor') ||
					activeElement.closest('.cm-editor') ||
					activeElement.classList.contains('CodeMirror') ||
					activeElement.closest('.CodeMirror')
				);

				// 如果是输入框但不是Markdown编辑器，使用统一的插入规则
				if (isInputElement && !isMarkdownEditor) {
					const inputElement = activeElement as HTMLInputElement | HTMLTextAreaElement;

					// 统一的插入规则：带#号，连续插入时空一格
					const cursorPos = inputElement.selectionStart ?? 0;
					const currentValue = inputElement.value;

					// 检查光标前是否需要空格
					const prefix = (cursorPos > 0 && currentValue[cursorPos - 1] !== ' ') ? ' ' : '';
					// 检查光标后是否需要空格
					const suffix = (cursorPos < currentValue.length && currentValue[cursorPos] !== ' ') ? ' ' : '';
					const insertText = `${prefix}#${tag}${suffix}`;

					// 更新输入框的值
					const newValue = currentValue.slice(0, cursorPos) + insertText + currentValue.slice(cursorPos);
					inputElement.value = newValue;

					// 触发input事件以确保其他插件能检测到变化
					const inputEvent = new Event('input', { bubbles: true, cancelable: true });
					inputElement.dispatchEvent(inputEvent);

					// 更新光标位置
					const newCursorPos = cursorPos + insertText.length;
					inputElement.setSelectionRange(newCursorPos, newCursorPos);
					inputElement.focus();

					// 在非循环模式下，将标签添加已插入样式
					if (!this.isInfiniteMode) {
						tagEl.addClass('tgm-inserted-tag');
					}
					// No need to dispatch input event for Obsidian's search, it handles it.
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
						tagEl.addClass('tgm-inserted-tag');
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

		// ==================== 重要Tips区域 ====================
		const tipsContainer = containerEl.createDiv('tgm-tips-container');
		const tipsHeader = tipsContainer.createEl('h3', {
			text: i18n.t('settings.importantTips'),
			cls: 'tgm-tips-header'
		});

		const tipsContent = tipsContainer.createDiv('tgm-tips-content');

		// 标签总览视图部分
		const overviewSection = tipsContent.createDiv('tgm-tips-section');
		const overviewTitle = overviewSection.createEl('h4', {
			text: i18n.t('settings.tagOverviewTips'),
			cls: 'tgm-tips-section-title'
		});

		const overviewList = overviewSection.createEl('ol', { cls: 'tgm-tips-list' });
		overviewList.createEl('li', { text: i18n.t('settings.tip1') });
		overviewList.createEl('li', { text: i18n.t('settings.tip2') });
		overviewList.createEl('li', { text: i18n.t('settings.tip3') });

		// 浮动标签选择器部分
		const selectorSection = tipsContent.createDiv('tgm-tips-section');
		const selectorTitle = selectorSection.createEl('h4', {
			text: i18n.t('settings.floatingTagSelectorTips'),
			cls: 'tgm-tips-section-title'
		});

		const selectorList = selectorSection.createEl('ol', { cls: 'tgm-tips-list' });
		selectorList.createEl('li', { text: i18n.t('settings.tip4') });
		selectorList.createEl('li', { text: i18n.t('settings.tip5') });
		selectorList.createEl('li', { text: i18n.t('settings.tip6') });

		// ==================== 颜色设置区域 ====================
		this.renderColorSettings(containerEl);

		// ==================== 标签组管理区域 ====================
		this.renderTagGroupSettings(containerEl);
	}



	// 渲染颜色设置区域
	renderColorSettings(containerEl: HTMLElement): void {
		const colorSection = containerEl.createDiv('settings-section');
		colorSection.createEl('h3', { text: i18n.t('settings.colorSettings') || '颜色设置', cls: 'settings-section-title' });

		// 添加自定义颜色功能开关
		new Setting(colorSection)
			.setName(i18n.t('settings.enableCustomColors'))
			.setDesc(i18n.t('settings.enableCustomColorsDesc'))
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableCustomColors)
				.onChange(async (value) => {
					this.plugin.settings.enableCustomColors = value;
					await this.plugin.saveSettings();
					this.display(); // 重新渲染设置页面
				})
			);

		// 如果启用了自定义颜色，显示颜色配置界面
		if (this.plugin.settings.enableCustomColors) {
			this.renderColorMappingSettings(colorSection);
		}
	}

	// 渲染标签组设置区域
	renderTagGroupSettings(containerEl: HTMLElement): void {
		const tagGroupSection = containerEl.createDiv('settings-section');
		tagGroupSection.createEl('h3', { text: i18n.t('settings.tagGroupSettings') || '标签组管理', cls: 'settings-section-title' });

		// 添加新标签组的按钮
		new Setting(tagGroupSection)
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
			// 创建独立的标签组容器
			const groupContainer = tagGroupSection.createDiv('tag-group-container-settings');

			// 标签管理区域（现在包含组名编辑）
			const tagsContainer = groupContainer.createDiv('tgm-tags-container');

			// 组名编辑区域（放在标签容器顶部）
			const groupHeaderContainer = tagsContainer.createDiv('tgm-group-header');

			const groupNameInput = groupHeaderContainer.createEl('input', {
				type: 'text',
				value: group.name,
				placeholder: i18n.t('settings.groupName'),
				cls: 'tgm-group-name-input'
			});

			groupNameInput.addEventListener('change', async () => {
				this.plugin.settings.tagGroups[index].name = groupNameInput.value;
				await this.plugin.saveSettings();
			});

			const deleteGroupBtn = groupHeaderContainer.createEl('button', {
				text: i18n.t('settings.deleteGroup'),
				cls: 'tgm-delete-group-btn'
			});

			deleteGroupBtn.onclick = async () => {
				this.plugin.settings.tagGroups.splice(index, 1);
				await this.plugin.saveSettings();
				this.display();
			};

			// 显示现有标签
			const tagsList = tagsContainer.createDiv('tgm-tags-list');
			group.tags.forEach((tag, tagIndex) => {
				const tagEl = tagsList.createDiv('tgm-tag-item');
				
				const tagText = tagEl.createSpan('tgm-tag-text');

				// 检查是否为嵌套标签并添加图标
				let displayText = `#${tag}`;
				if (tag.includes('/')) {
					displayText = `📁 #${tag}`;
					tagText.addClass('nested-tag');
				}

				tagText.setText(displayText);

				// 使用Obsidian原生的tooltip系统，设置在整个标签项上
				tagEl.setAttribute('aria-label', `#${tag}`);
				
				const deleteBtn = tagEl.createSpan('tgm-tag-delete-btn');
				deleteBtn.setText('✕');
				deleteBtn.addEventListener('click', async () => {
					this.plugin.settings.tagGroups[index].tags.splice(tagIndex, 1);
					await this.plugin.saveSettings();
					this.display();
				});
			});

			// 添加新标签 - 统一的按钮行布局
            const addTagContainer = tagsContainer.createDiv('add-tag-container');

            // 创建输入框
            const addTagInput = addTagContainer.createEl('input', {
                type: 'text',
                placeholder: i18n.t('settings.enterTagName'),
                cls: 'add-tag-input'
            });

            // 创建添加标签按钮
            const addTagBtn = addTagContainer.createEl('button', {
                text: i18n.t('settings.addTag'),
                cls: 'add-tag-btn'
            });

            // 创建从标签库添加按钮
            const addFromLibraryBtn = addTagContainer.createEl('button', {
                text: i18n.t('settings.addFromLibrary'),
                cls: 'library-btn'
            });

            // 创建批量筛选添加按钮
            const batchFilterBtn = addTagContainer.createEl('button', {
                text: i18n.t('settings.batchFilterAdd') || '批量筛选添加',
                cls: 'batch-filter-btn'
            });

            // 创建弹出区域容器（在按钮行下方）
            const popupContainer = addTagContainer.createDiv('popup-container');

            // 创建批量筛选标签的浮动区域
            const batchFilterContainer = popupContainer.createDiv('batch-filter-container');
            batchFilterContainer.addClass('tgm-display-none');
            
            // 批量筛选添加按钮点击事件
            batchFilterBtn.addEventListener('click', async () => {
                const isVisible = !batchFilterContainer.hasClass('tgm-display-none');
                
                if (isVisible) {
                    // 如果筛选界面已显示，则是确认添加操作
                    batchFilterContainer.addClass('tgm-display-none');
                    batchFilterContainer.removeClass('tgm-display-block');
                    batchFilterBtn.removeClass('tgm-btn-active');
                    batchFilterBtn.textContent = i18n.t('settings.batchFilterAdd') || '批量筛选添加';
                    this.display(); // 刷新当前标签组
                } else {
                    // 关闭标签库（如果打开的话）
                    const tagLibraryContainer = tagsContainer.querySelector('.tag-library-container') as HTMLElement;
                    const addFromLibraryBtn = tagsContainer.querySelector('.library-btn') as HTMLElement;
                    if (tagLibraryContainer && addFromLibraryBtn) {
                        tagLibraryContainer.addClass('tgm-display-none');
                        tagLibraryContainer.removeClass('tgm-display-block');
                        addFromLibraryBtn.removeClass('tgm-btn-active');
                        addFromLibraryBtn.textContent = i18n.t('settings.addFromLibrary');
                    }

                    // 显示筛选界面
                    batchFilterContainer.removeClass('tgm-display-none');
                    batchFilterContainer.addClass('tgm-display-block');
                    batchFilterBtn.addClass('tgm-btn-active');
                    batchFilterBtn.textContent = i18n.t('settings.confirmSelection') || '确认选择';
                    
                    // 清空并重新加载筛选界面
                    batchFilterContainer.empty();
                    
                    // 创建筛选输入框
                    const filterInputContainer = batchFilterContainer.createDiv('filter-input-container');
                    const filterInput = filterInputContainer.createEl('input', {
                         type: 'text',
                         placeholder: i18n.t('settings.filterTagsPlaceholder') || '输入关键词筛选标签'
                     });
                    
                    // 创建全选/取消全选按钮
                    const selectAllBtn = filterInputContainer.createEl('button', {
                         text: i18n.t('settings.selectAll') || '全选',
                         cls: 'select-all-btn'
                     });
                    
                    // 创建标签显示区域
                    const filteredTagsContainer = batchFilterContainer.createDiv('filtered-tags-container');
                    
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
                    
                    // 渲染筛选后的标签
                    const renderFilteredTags = (filterText: string) => {
                        filteredTagsContainer.empty();
                        
                        const filteredTags = filterText.trim() === '' 
                            ? availableTags 
                            : availableTags.filter(tag => tag.toLowerCase().includes(filterText.toLowerCase()));
                        
                        if (filteredTags.length === 0) {
                             filteredTagsContainer.createDiv('no-tags-message').setText(i18n.t('settings.noMatchingTags') || '没有匹配的标签');
                             return;
                         }
                        
                        // 默认全选所有筛选出的标签
                         const isAllSelected = true;
                         selectAllBtn.textContent = isAllSelected ? (i18n.t('settings.deselectAll') || '取消全选') : (i18n.t('settings.selectAll') || '全选');
                        
                        filteredTags.forEach(tag => {
                            const tagEl = filteredTagsContainer.createDiv('library-tag-item');
                            tagEl.setAttribute('data-tag', tag);

                            // 创建标签文本容器
                            const tagTextEl = tagEl.createSpan('tag-text');

                            // 检查是否为嵌套标签并添加图标
                            let displayText = tag;
                            if (tag.includes('/')) {
                                displayText = `📁 ${tag}`;
                                tagTextEl.addClass('nested-tag');
                            }

                            tagTextEl.setText(displayText);

                            // 使用Obsidian原生的tooltip系统，设置在整个标签项上
                            tagEl.setAttribute('aria-label', tag);

                            // 默认选中所有筛选出的标签
                            if (isAllSelected) {
                                tagEl.addClass('selected');
                            }

                            tagEl.addEventListener('click', () => {
                                tagEl.toggleClass('selected', true);

                                // 更新全选按钮状态
                                const allTagEls = filteredTagsContainer.querySelectorAll('.library-tag-item');
                                const selectedTagEls = filteredTagsContainer.querySelectorAll('.library-tag-item.selected');
                                selectAllBtn.textContent = (allTagEls.length === selectedTagEls.length) ? (i18n.t('settings.deselectAll') || '取消全选') : (i18n.t('settings.selectAll') || '全选');
                            });
                        });
                    };
                    
                    // 初始渲染所有可用标签
                    renderFilteredTags('');
                    
                    // 添加筛选输入框事件
                    filterInput.addEventListener('input', () => {
                        renderFilteredTags(filterInput.value);
                    });
                    
                    // 添加全选/取消全选按钮事件
                    selectAllBtn.addEventListener('click', () => {
                        const allTagEls = filteredTagsContainer.querySelectorAll('.library-tag-item');
                        const selectedTagEls = filteredTagsContainer.querySelectorAll('.library-tag-item.selected');
                        const shouldSelect = allTagEls.length !== selectedTagEls.length;
                        
                        allTagEls.forEach(el => {
                            if (shouldSelect) {
                                el.addClass('selected');
                            } else {
                                el.removeClass('selected');
                            }
                        });
                        
                        selectAllBtn.textContent = shouldSelect ? (i18n.t('settings.deselectAll') || '取消全选') : (i18n.t('settings.selectAll') || '全选');
                    });
                    
                    // 移除之前的点击事件处理程序，避免重复添加
                     const oldClickHandler = batchFilterBtn.onclick;
                     batchFilterBtn.onclick = async (e) => {
                         // 阻止事件冒泡，避免触发外层的点击事件
                         e.stopPropagation();
                         e.preventDefault();
                        const selectedTagEls = filteredTagsContainer.querySelectorAll('.library-tag-item.selected');
                        if (selectedTagEls.length === 0) {
                             new Notice(i18n.t('settings.selectAtLeastOneTag') || '请至少选择一个标签');
                             return;
                         }
                        
                        // 添加选中的标签到当前标签组
                        let addedCount = 0;
                        for (const tagEl of Array.from(selectedTagEls)) {
                            const tag = tagEl.getAttribute('data-tag');
                            if (tag && !this.plugin.settings.tagGroups[index].tags.includes(tag)) {
                                this.plugin.settings.tagGroups[index].tags.push(tag);
                                addedCount++;
                            }
                        }
                        
                        if (addedCount > 0) {
                            await this.plugin.saveSettings();
                            const successMessage = i18n.t('settings.tagsAddedSuccess') || `成功添加 {{count}} 个标签到 {{groupName}} 组`;
                             new Notice(successMessage
                                 .replace('{{count}}', addedCount.toString())
                                 .replace('{{groupName}}', this.plugin.settings.tagGroups[index].name));
                         } else {
                             new Notice(i18n.t('settings.noNewTagsAdded') || '没有新标签被添加');
                        }
                        
                        // 隐藏筛选界面并重置按钮
                        batchFilterContainer.addClass('tgm-display-none');
                        batchFilterContainer.removeClass('tgm-display-block');
                        batchFilterBtn.removeClass('tgm-btn-active');
                        batchFilterBtn.textContent = i18n.t('settings.batchFilterAdd') || '批量筛选添加';
                        this.display(); // 刷新当前标签组
                    };
                }
            });

            // 创建标签库浮动区域
            const tagLibraryContainer = popupContainer.createDiv('tag-library-container');
            tagLibraryContainer.addClass('tgm-display-none');

            // 从标签库添加按钮点击事件
            addFromLibraryBtn.addEventListener('click', async () => {
                const isVisible = !tagLibraryContainer.hasClass('tgm-display-none');
                
                if (isVisible) {
                    // 如果标签库已显示，则是确认添加操作
                    tagLibraryContainer.addClass('tgm-display-none');
                    tagLibraryContainer.removeClass('tgm-display-block');
                    addFromLibraryBtn.removeClass('tgm-btn-active');
                    addFromLibraryBtn.textContent = i18n.t('settings.addFromLibrary');
                    this.display(); // 刷新当前标签组
                } else {
                    // 关闭批量筛选（如果打开的话）
                    const batchFilterContainer = tagsContainer.querySelector('.batch-filter-container') as HTMLElement;
                    const batchFilterBtn = tagsContainer.querySelector('.batch-filter-btn') as HTMLElement;
                    if (batchFilterContainer && batchFilterBtn) {
                        batchFilterContainer.addClass('tgm-display-none');
                        batchFilterContainer.removeClass('tgm-display-block');
                        batchFilterBtn.removeClass('tgm-btn-active');
                        batchFilterBtn.textContent = i18n.t('settings.batchFilterAdd');
                    }

                    // 显示标签库
                    tagLibraryContainer.removeClass('tgm-display-none');
                    tagLibraryContainer.addClass('tgm-display-block');
                    addFromLibraryBtn.addClass('tgm-btn-active');
                    addFromLibraryBtn.textContent = i18n.t('settings.confirmSelection');
                    
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

                        // 创建标签文本容器
                        const tagTextEl = tagEl.createSpan('tag-text');

                        // 检查是否为嵌套标签并添加图标
                        let displayText = tag;
                        if (tag.includes('/')) {
                            displayText = `📁 ${tag}`;
                            tagTextEl.addClass('nested-tag');
                        }

                        tagTextEl.setText(displayText);

                        // 使用Obsidian原生的tooltip系统，设置在整个标签项上
                        tagEl.setAttribute('aria-label', tag);

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

	// 渲染颜色映射设置界面
	renderColorMappingSettings(containerEl: HTMLElement): void {
		// 创建颜色映射子区域
		const colorMappingSection = containerEl.createDiv('color-mapping-subsection');
		colorMappingSection.createEl('h4', { text: i18n.t('settings.tagColorMappings'), cls: 'settings-subsection-title' });

		// 添加说明文字
		const descEl = colorMappingSection.createEl('p', {
			text: i18n.t('settings.colorMappingDesc'),
			cls: 'setting-item-description'
		});

		// 添加新颜色映射按钮
		new Setting(colorMappingSection)
			.setName(i18n.t('settings.addColorMapping'))
			.setDesc(i18n.t('settings.addColorMappingDesc'))
			.addButton(cb => cb
				.setButtonText(i18n.t('settings.addColorMapping'))
				.onClick(async () => {
					this.plugin.settings.tagColorMappings.push({
						pattern: '',
						color: '#3b82f6',
						isRegex: false,
						enabled: true
					});
					await this.plugin.saveSettings();
					this.display();
				}));

		// 显示现有颜色映射
		this.plugin.settings.tagColorMappings.forEach((mapping, index) => {
			const mappingContainer = colorMappingSection.createDiv('color-mapping-item-compact');

			// 创建单行设置，包含所有控件
			const setting = new Setting(mappingContainer)
				.setName(`${i18n.t('settings.colorMapping')} ${index + 1}`)
				.setDesc('')
				.addToggle(toggle => toggle
					.setValue(mapping.enabled)
					.setTooltip(i18n.t('settings.enabled'))
					.onChange(async (value) => {
						this.plugin.settings.tagColorMappings[index].enabled = value;
						await this.plugin.saveSettings();
					}))
				.addText(text => text
					.setPlaceholder(i18n.t('settings.patternPlaceholder'))
					.setValue(mapping.pattern)
					.onChange(async (value) => {
						this.plugin.settings.tagColorMappings[index].pattern = value;
						await this.plugin.saveSettings();
					}))
				.addToggle(toggle => toggle
					.setValue(mapping.isRegex)
					.setTooltip(i18n.t('settings.useRegex'))
					.onChange(async (value) => {
						this.plugin.settings.tagColorMappings[index].isRegex = value;
						await this.plugin.saveSettings();
					}));

			// 添加预设颜色选择器
			this.addPresetColorPicker(setting, mapping, index);

			setting.addButton(cb => cb
				.setButtonText(i18n.t('settings.delete'))
				.setWarning()
				.onClick(async () => {
					this.plugin.settings.tagColorMappings.splice(index, 1);
					await this.plugin.saveSettings();
					this.display();
				}));
		});
	}

	// 添加预设颜色选择器
	addPresetColorPicker(setting: Setting, mapping: TagColorMapping, index: number): void {
		// 定义彩虹目录的七种预设颜色（基于Obsidian主题变量）
		const presetColors = [
			{ name: i18n.t('settings.presetRed') || '红色', value: 'var(--color-red)', rgb: '#e74c3c' },
			{ name: i18n.t('settings.presetBlue') || '蓝色', value: 'var(--color-blue)', rgb: '#3498db' },
			{ name: i18n.t('settings.presetGreen') || '绿色', value: 'var(--color-green)', rgb: '#2ecc71' },
			{ name: i18n.t('settings.presetOrange') || '橙色', value: 'var(--color-orange)', rgb: '#f39c12' },
			{ name: i18n.t('settings.presetPurple') || '紫色', value: 'var(--color-purple)', rgb: '#9b59b6' },
			{ name: i18n.t('settings.presetCyan') || '青色', value: 'var(--color-cyan)', rgb: '#1abc9c' },
			{ name: i18n.t('settings.presetPink') || '粉色', value: 'var(--color-pink)', rgb: '#e91e63' }
		];

		// 添加预设颜色下拉选择器
		setting.addDropdown(dropdown => {
			dropdown.addOption('', i18n.t('settings.customColor') || '自定义颜色');
			presetColors.forEach((color, colorIndex) => {
				dropdown.addOption(color.value, color.name);
			});

			// 设置当前值
			const currentPreset = presetColors.find(color => color.value === mapping.color);
			dropdown.setValue(currentPreset ? currentPreset.value : '');

			dropdown.onChange(async (value) => {
				if (value) {
					// 选择了预设颜色
					this.plugin.settings.tagColorMappings[index].color = value;
				} else {
					// 选择了自定义颜色，使用默认颜色
					this.plugin.settings.tagColorMappings[index].color = '#3b82f6';
				}
				await this.plugin.saveSettings();
				this.display(); // 重新渲染以更新颜色选择器
			});
		});

		// 只有在选择自定义颜色时才显示颜色选择器
		const isCustomColor = !presetColors.some(color => color.value === mapping.color);
		if (isCustomColor) {
			setting.addColorPicker(color => color
				.setValue(mapping.color)
				.onChange(async (value) => {
					this.plugin.settings.tagColorMappings[index].color = value;
					await this.plugin.saveSettings();
				}));
		}
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

        // 不再需要顶部标题栏，直接通过点击标签组名称切换模式

        // 创建标签组容器
        const groupContainer = container.createDiv('tag-group-container');

        // 渲染标签组
        this.plugin.settings.tagGroups.forEach((group, groupIndex) => {
            const groupEl = groupContainer.createDiv('tag-group-item');
            groupEl.setAttribute('data-group-index', groupIndex.toString());

            // 创建标签组名称容器（包含拖拽手柄和名称）
            const nameContainer = groupEl.createDiv('tag-group-name-container');

            // 在非插入模式下添加拖拽手柄到名称容器的上方
            if (!this.isInsertMode) {
                const handle = nameContainer.createDiv('tag-group-handle');
                handle.setText('☰');
            }

            // 添加组名到名称容器
            const nameEl = nameContainer.createDiv('tag-group-name');
            nameEl.setText(group.name);
            if (this.isInsertMode) {
                nameEl.addClass('insert-mode');
            }

            // 添加tooltip提示用户可以点击切换模式
            const nextModeText = this.isInsertMode ? i18n.t('overview.sortMode') : i18n.t('overview.insertMode');
            nameEl.setAttribute('aria-label', i18n.t('overview.clickToSwitch').replace('{mode}', nextModeText));
            
            // 添加点击事件处理 - 点击任意标签组名称切换模式
            nameEl.addEventListener('click', () => {
                this.isInsertMode = !this.isInsertMode;

                // 在右上角显示模式切换提示
                const modeText = this.isInsertMode ? i18n.t('overview.insertModeTitle') : i18n.t('overview.sortModeTitle');
                const modeIcon = this.isInsertMode ? '✏️' : '🔄';

                new Notice(`${modeIcon} ${modeText}`, 2000);

                // 重新渲染标签组
                this.renderTagGroups();
            });

            // 创建标签容器
            const tagsContainer = groupEl.createDiv('tags-view-container');
            
            // 渲染标签
            group.tags.forEach(tag => {

                const tagEl = tagsContainer.createDiv('tgm-tag-item');
                tagEl.setAttribute('data-tag', tag);

                // 创建标签文本容器
                const tagTextEl = tagEl.createDiv('tgm-tag-text');

                // 检查是否为嵌套标签并添加图标
                let displayText = tag;
                if (tag.includes('/')) {
                    displayText = `📁 ${tag}`;
                    tagTextEl.addClass('nested-tag');
                }

                tagTextEl.setText(displayText);

                // 使用Obsidian原生的tooltip系统，设置在整个标签项上
                tagEl.setAttribute('aria-label', tag);

                // 应用自定义颜色（如果启用且有匹配的颜色映射）
                if (this.plugin.settings.enableCustomColors) {
                    const customColor = getTagColor(tag, this.plugin.settings.tagColorMappings);
                    if (customColor) {
                        // 检查是否是预设的彩虹颜色
                        const isRainbowColor = customColor.startsWith('var(--color-');
                        if (isRainbowColor) {
                            tagEl.addClass('tag-group-manager-rainbow-tag');
                            tagEl.setAttribute('data-color', customColor);
                        } else {
                            // 使用传统的自定义颜色样式
                            tagEl.addClass('tgm-custom-color-tag');
                            
                            // 使用预定义的颜色类
                            const colorClass = getColorClass(customColor);
                            if (colorClass) {
                                tagEl.addClass(colorClass);
                            } else {
                                // 对于自定义颜色，使用数据属性
                                tagEl.setAttribute('data-custom-color', customColor);
                            }
                            
                            tagEl.addClass('custom-colored-tag');
                        }
                    }
                }
                
                // 在插入模式下为标签添加点击事件
                if (this.isInsertMode) {
                    tagEl.addClass('clickable');
                    tagEl.addEventListener('mousedown', (e) => {
                        e.preventDefault(); // 防止焦点丢失
                        e.stopPropagation(); // 阻止事件冒泡

                        // 首先检查是否有任何输入框处于焦点状态（除了Markdown编辑器）
                        const activeElement = document.activeElement as HTMLElement;

                        // 检查是否是输入框或文本区域（但不是Markdown编辑器）
                        const isInputElement = activeElement && (
                            activeElement.tagName === 'INPUT' ||
                            activeElement.tagName === 'TEXTAREA' ||
                            activeElement.contentEditable === 'true'
                        );

                        // 检查是否是Markdown编辑器
                        const isMarkdownEditor = activeElement && (
                            activeElement.classList.contains('cm-editor') ||
                            activeElement.closest('.cm-editor') ||
                            activeElement.classList.contains('CodeMirror') ||
                            activeElement.closest('.CodeMirror')
                        );

                        // 如果是输入框但不是Markdown编辑器，使用统一的插入规则
                        if (isInputElement && !isMarkdownEditor) {
                            const inputElement = activeElement as HTMLInputElement | HTMLTextAreaElement;

                            // 统一的插入规则：带#号，连续插入时空一格
                            const cursorPos = inputElement.selectionStart ?? 0;
                            const currentValue = inputElement.value;

                            // 检查光标前是否需要空格
                            const prefix = (cursorPos > 0 && currentValue[cursorPos - 1] !== ' ') ? ' ' : '';
                            // 检查光标后是否需要空格
                            const suffix = (cursorPos < currentValue.length && currentValue[cursorPos] !== ' ') ? ' ' : '';
                            const insertText = `${prefix}#${tag}${suffix}`;

                            // 更新输入框的值
                            const newValue = currentValue.slice(0, cursorPos) + insertText + currentValue.slice(cursorPos);
                            inputElement.value = newValue;

                            // 触发input事件以确保其他插件能检测到变化
                            const inputEvent = new Event('input', { bubbles: true, cancelable: true });
                            inputElement.dispatchEvent(inputEvent);

                            // 更新光标位置
                            const newCursorPos = cursorPos + insertText.length;
                            inputElement.setSelectionRange(newCursorPos, newCursorPos);
                            inputElement.focus();
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
								// console.log("⚠️ 当前 view:", view);
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
							// console.log(`YAML区域状态: 开始=${yamlStart}, 结束=${yamlEnd}, 在区域内=${isInYaml}, tags行=${yamlTagLine}`);
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
                            evt.to.querySelectorAll('.tgm-tag-item').forEach((el) => {
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
