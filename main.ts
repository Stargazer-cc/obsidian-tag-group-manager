import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

interface TagGroup {
	name: string;
	tags: string[];
}

interface TagGroupManagerSettings {
	tagGroups: TagGroup[];
}

const DEFAULT_SETTINGS: TagGroupManagerSettings = {
	tagGroups: []
};

export default class TagGroupManagerPlugin extends Plugin {
	settings: TagGroupManagerSettings;

	async onload() {
		await this.loadSettings();

		// 为每个标签组注册命令
		this.registerTagGroupCommands();

		// 添加设置选项卡
		this.addSettingTab(new TagGroupManagerSettingTab(this.app, this));
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
						new TagSelectorModal(this.app, editor, group.tags.slice()).open();
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
}

// 标签选择器（不使用模态框）
class TagSelectorModal {
	private app: App;
	private editor: Editor;
	private tags: string[];
	public containerEl: HTMLElement;
	private rootEl: HTMLElement;
	private isPinned: boolean = false;
	private dragHandle: HTMLElement;
	private initialX: number = 0;
	private initialY: number = 0;
	private offsetX: number = 0;
	private offsetY: number = 0;

	constructor(app: App, editor: Editor, tags: string[]) {
		this.app = app;
		this.editor = editor;
		this.tags = tags;
		// 创建根元素
		this.rootEl = document.createElement('div');
		this.rootEl.addClass('tag-group-selector-modal');
	}

	open() {
		// 设置初始定位样式
		this.rootEl.style.position = 'absolute';
		this.rootEl.style.zIndex = '9999';
		
		// 创建顶部栏
		const topBar = this.rootEl.createDiv('tag-selector-top-bar');
		
		// 创建拖动句柄
		this.dragHandle = topBar.createDiv('tag-selector-drag-handle');
		this.dragHandle.setText('拖动');
		this.setupDrag();

		// 创建固定按钮
		const pinButton = topBar.createDiv('tag-selector-pin-button');
		pinButton.setText('📌');
		pinButton.addEventListener('click', () => {
			this.isPinned = !this.isPinned;
			pinButton.toggleClass('active', this.isPinned);
		});

		// 创建关闭按钮
		const closeButton = topBar.createDiv('tag-selector-close-button');
		closeButton.setText('✕');
		closeButton.addEventListener('click', () => {
			this.close();
		});

		// 创建标签容器
		this.containerEl = this.rootEl.createDiv('tag-selector-container');
		this.renderTags();

		// 将元素添加到文档中
		document.body.appendChild(this.rootEl);

		// 设置初始位置在视口中央
		const rect = this.rootEl.getBoundingClientRect();
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;
		this.rootEl.style.left = `${(viewportWidth - rect.width) / 2}px`;
		this.rootEl.style.top = `${(viewportHeight - rect.height) / 3}px`;
	}

	setupDrag() {
		this.dragHandle.addEventListener('mousedown', (e) => {
			if (this.isPinned) return; // 如果已固定，则不允许拖动
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
		if (this.isPinned) return; // 如果已固定，则不处理移动事件
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
	};

	renderTags() {
		this.containerEl.empty();
		
		if (this.tags.length === 0) {
			this.close();
			return;
		}

		this.tags.forEach((tag) => {
			const tagEl = this.containerEl.createDiv('tag-item');
			tagEl.setText(`#${tag}`);
			tagEl.addEventListener('click', () => {
				// 在光标位置插入标签
				this.editor.replaceSelection(`#${tag} `);
				
				// 从列表中移除该标签
				this.tags = this.tags.filter(t => t !== tag);
				
				// 重新渲染标签列表
				this.renderTags();
			});
		});
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
			tagsHeader.setText(`${group.name} 的标签:`);

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
			const addTagInput = addTagContainer.createEl('input', {
				type: 'text',
				placeholder: '输入标签（不含#）'
			});
			
			const addTagBtn = addTagContainer.createEl('button', {
				text: '添加标签'
			});
			
			addTagBtn.addEventListener('click', async () => {
				const tagValue = addTagInput.value.trim();
				if (tagValue && !this.plugin.settings.tagGroups[index].tags.includes(tagValue)) {
					this.plugin.settings.tagGroups[index].tags.push(tagValue);
					await this.plugin.saveSettings();
					addTagInput.value = '';
					this.display();
				}
			});
		});
	}
}