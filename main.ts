import { App, Editor, MarkdownView, Notice, Plugin, PluginSettingTab, Setting, WorkspaceLeaf, ItemView, moment, TFile, Modal, TextComponent, ColorComponent, Menu, setIcon, MarkdownRenderer, Component } from 'obsidian';
import Sortable from 'sortablejs';
import { i18n } from './src/i18n';
import { getAllTags } from "obsidian";
import { TagRenamer } from './src/TagRenamer';
import { HierarchyBoard } from './src/HierarchyBoard';
import changelogsData from './changelogs.json';


// Helper function to insert tag into an input element
function insertTagIntoInputElement(inputElement: HTMLInputElement, tag: string, addHashPrefix: boolean = true) {
	const cursorPos = inputElement.selectionStart ?? 0;
	const currentValue = inputElement.value;

	const tagToInsert = addHashPrefix ? `#${tag}` : tag;

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
const CHANGELOG_VIEW_TYPE = 'tgm-changelog-view';

interface TagGroup {
	id?: string; // 唯一标识符，可选是因为旧数据可能没有
	name: string;
	tags: string[];
	autoExpandedTags?: string[]; // 新增：记录通过"展开功能"自动添加的标签（用于区分手动添加）
}

interface TagGroupSet {
	id: string;
	name: string;
	icon: string;
	groupIds: string[]; // 包含的标签组 ID 列表 (有序)
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
	tagColorMappings: TagColorMapping[]; // 标签颜色映射表 (用于正则/批量)
	enableCustomColors: boolean;         // 是否启用自定义颜色功能
	customColors: string[];              // 新增：7个自定义颜色槽
	tagColors: Record<string, string>;   // 新增：单个标签颜色设置
	tagGroupSets: TagGroupSet[];         // 新增：标签组集
	lastSeenVersion: string;             // 记录用户上次看到的版本
	// Multi-level tag adaptation
	autoExpandMultiLevelTags: boolean;
	autoAddTags: boolean;
	autoAddRules: string;
	// 多级标签自动添加配置
	multiLevelAutoAdd: {
		enabled: boolean;              // 启用多级标签智能匹配
		matchMode: 'level1' | 'level2'; // 匹配模式：level1(2级展开) 或 level2(3级展开)
		createIfNotExists: boolean;    // 如果不存在是否自动创建标签组
	};
	enableTextTagStyling: boolean;
	expandTagPrefixes: string;           // 新增：指定要展开的第一级标签（逗号分隔）
	expandDepth: number;                 // 新增：展开深度（2或3）
}

const DEFAULT_SETTINGS: TagGroupManagerSettings = {
	tagGroups: [],
	showStarButton: true,
	tagColorMappings: [],
	enableCustomColors: false,
	customColors: ['', '', '', '', '', '', ''],
	tagColors: {},
	tagGroupSets: [],
	lastSeenVersion: '',
	autoExpandMultiLevelTags: false,
	autoAddTags: false,
	autoAddRules: '',
	multiLevelAutoAdd: {
		enabled: true,
		matchMode: 'level2', // 默认3级展开
		createIfNotExists: false
	},
	enableTextTagStyling: false,
	expandTagPrefixes: '',
	expandDepth: 3
};

// 生成 UUID 的简单实现
function generateUUID(): string {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
		const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	});
}

// 工具函数：根据标签名获取对应的颜色
function getTagColor(tagName: string, settings: TagGroupManagerSettings): string | null {
	// 1. 优先检查单个标签的颜色设置
	if (settings.tagColors && settings.tagColors[tagName]) {
		return settings.tagColors[tagName];
	}

	// 2. 检查正则/批量映射
	const colorMappings = settings.tagColorMappings;
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
		} catch {
			// 正则表达式错误时跳过此映射
			// console.warn(`Invalid regex pattern in tag color mapping: ${mapping.pattern}`);
			continue;
		}
	}

	return null;
}

// 工具函数：根据颜色值获取对应的CSS类
function getColorClass(colorValue: string): string | null {
	const colorMap: { [key: string]: string } = {
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

// 工具函数：判断标签是否应该被隐藏
// 隐藏规则：
// 1. 必须是通过"展开功能"自动添加的标签（在 autoExpandedTags 中）
// 2. 必须是多级标签（包含 '/'）
// 3. 深度必须 >= minDepth（3级展开时为3，2级展开时为2）
// 4. 在所有标签中，没有其他标签以"该标签/"为前缀（即没有子节点）
// 
// 不隐藏的情况：
// - 手动添加的标签（不在 autoExpandedTags 中）
// - 非多级标签（如 React）
// - 深度 < minDepth 的多级标签
// - 有子节点的多级标签（如 前端/框架/React，且存在 前端/框架/React/Hooks）
function shouldHideTag(tag: string, allTags: string[], autoExpandedTags?: string[], minDepth: number = 3): boolean {
	// 如果没有 autoExpandedTags 或标签不在其中，说明是手动添加的，不隐藏
	if (!autoExpandedTags || !autoExpandedTags.includes(tag)) {
		return false;
	}
	
	// 如果不是多级标签，不隐藏
	if (!tag.includes('/')) {
		return false;
	}
	
	// 如果深度 < minDepth，不隐藏
	const depth = tag.split('/').length;
	if (depth < minDepth) {
		return false;
	}
	
	// 检查是否有子节点
	const prefix = tag + '/';
	const hasChildren = allTags.some(t => t.startsWith(prefix));
	
	// 如果没有子节点，则是叶子节点，需要隐藏
	return !hasChildren;
}

// 工具函数：判断标签组的展开深度
// 如果标签组在某个组集中，说明是3级展开；否则是2级展开
function getGroupExpandDepth(group: TagGroup, tagGroupSets: TagGroupSet[]): number {
	if (!group.id) return 2;
	
	// 检查是否有组集包含这个标签组
	const inSet = tagGroupSets.some(set => set.groupIds.includes(group.id!));
	return inSet ? 3 : 2;
}

export default class TagGroupManagerPlugin extends Plugin {
	settings: TagGroupManagerSettings;
	hierarchyBoard: HierarchyBoard;
	private registeredCommands: string[] = []; // 跟踪已注册的命令ID



	async onload() {
		await this.loadSettings();

		// 数据迁移：确保所有标签组都有 ID
		let settingsChanged = false;
		this.settings.tagGroups.forEach(group => {
			if (!group.id) {
				group.id = generateUUID();
				settingsChanged = true;
			}
		});

		if (settingsChanged) {
			await this.saveSettings();
		}

		// 使用moment.js获取语言设置（这是Obsidian内部使用的方式）
		const momentLocale = moment.locale() || 'en';
		// 如果是中文相关的locale，使用中文，否则使用英文
		const locale = momentLocale.startsWith('zh') ? 'zh' : 'en';
		i18n.setLocale(locale);

		// Initialize HierarchyBoard
		this.hierarchyBoard = new HierarchyBoard(this.app, this);
		this.addChild(this.hierarchyBoard);

		// 注册视图类型
		this.registerView(
			TAG_GROUP_VIEW,
			(leaf: WorkspaceLeaf) => new TagGroupView(leaf, this)
		);
		this.registerView(
			CHANGELOG_VIEW_TYPE,
			(leaf: WorkspaceLeaf) => new ChangelogView(leaf, this)
		);

		// 添加星星按钮到右侧边栏
		this.addRibbonIcon('star', i18n.t('overview.title'), () => {
			// Feature #4: If no groups exist, prompt user and open settings
			if (this.settings.tagGroups.length === 0) {
				new Notice(i18n.t('messages.noGroupsCreateFirst') || 'No tag groups found. Please create one in settings.');
				// Open settings tab
				// @ts-ignore
				this.app.setting.open();
				// @ts-ignore
				this.app.setting.openTabById(this.manifest.id);
				return;
			}
			// 激活标签组管理器视图
			void this.activateView();
			// 关闭所有已打开的标签选择器

		});

		// 为每个标签组注册命令
		this.registerTagGroupCommands();

		// 添加设置选项卡
		this.addSettingTab(new TagGroupManagerSettingTab(this.app, this));

		// 检查版本更新并显示更新日志
		this.checkVersionAndShowChangelog();

		// Apply text tag styling if enabled
		this.applyTextTagStyling();

		// 监听视图模式切换（Live Preview <-> Reading View）
		this.registerEvent(
			this.app.workspace.on('layout-change', () => {
				// 当布局改变时（包括模式切换），重新处理标签
				if (this.settings.enableTextTagStyling) {
					// 延迟一小段时间，确保DOM已经更新
					setTimeout(() => {
						this.processExistingTags();
					}, 100);
				}
			})
		);

		// 监听活动叶子变化（切换文件时）
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', () => {
				if (this.settings.enableTextTagStyling) {
					setTimeout(() => {
						this.processExistingTags();
					}, 100);
				}
			})
		);

		// Auto-run scanner on startup if enabled
		if (this.settings.autoAddTags) {
			// Run after a short delay to ensure cache is ready
			this.app.workspace.onLayoutReady(async () => {
				await this.autoScanTagsToGroups();
			});
		}

		// 添加右键菜单命令：清除笔记中的所有标签
		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, file) => {
				if (file instanceof TFile) {
					menu.addItem((item) => {
						item
							.setTitle(i18n.t('commands.clearTags'))
							.setIcon('tag')
							.onClick(() => {
								void this.clearAllTags(file);
							});
					});
				}
			})
		);


	}

	// 检查版本更新并显示更新日志
	private checkVersionAndShowChangelog() {
		const currentVersion = this.manifest.version;
		const lastSeenVersion = this.settings.lastSeenVersion;

		// 如果是新安装或版本更新
		if (lastSeenVersion !== currentVersion) {
			// 获取当前版本的更新日志
			const changelog = this.getChangelog(currentVersion);

			if (changelog) {
				// 延迟显示，确保 Obsidian 完全加载
				setTimeout(async () => {
					// new ChangelogModal(this.app, currentVersion, changelog).open();

					// 打开一个新的 Leaf (Tab)
					const leaf = this.app.workspace.getLeaf('tab');
					await leaf.setViewState({
						type: CHANGELOG_VIEW_TYPE,
						active: true
					});

					// 获取视图实例并设置内容
					if (leaf.view instanceof ChangelogView) {
						leaf.view.setChangelog(currentVersion, changelog);
					}
				}, 1000);
			}

			// 更新已看版本
			this.settings.lastSeenVersion = currentVersion;
			void this.saveSettings();
		}
	}

	// 获取指定版本的更新日志
	private getChangelog(version: string): string | null {
		// 从导入的JSON文件获取changelog数据
		const versionData = changelogsData[version as keyof typeof changelogsData];
		if (!versionData) return null;

		// 根据当前语言返回对应的changelog
		const locale = i18n.getLocale();
		const changelogArray = locale === 'zh' ? versionData.zh : versionData.en;

		// 如果是数组，用换行符连接；否则直接返回字符串
		const changelog = Array.isArray(changelogArray) 
			? changelogArray.join('\n') 
			: changelogArray;

		return changelog || null;
	}

	// 清除笔记中的所有标签
	async clearAllTags(file: TFile) {
		try {
			// 先尝试打开文件到当前视图
			const activeLeaf = this.app.workspace.getLeaf();
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
				await this.app.vault.process(file, (content) => {
					// 使用正则表达式移除所有标签
					let newContent = content.replace(/#[\w\u4e00-\u9fa5\-_/]+/g, '');
					// 删除上下文标签之间的空格
					newContent = newContent.replace(/\n\s*\n/g, '\n');
					return newContent;
				});

				// 显示成功通知
				new Notice(i18n.t('messages.tagsCleared'));
			}
		} catch (e) {
			if (e instanceof Error) {
				new Notice(i18n.t('messages.tagsClearFailed') + ': ' + e.message);
			} else {
				new Notice(i18n.t('messages.tagsClearFailed'));
			}
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
				editorCallback: (editor: Editor, _view: MarkdownView) => {
					if (group.tags.length > 0) {
						new TagSelectorModal(this.app, editor, group.tags.slice(), this, group).open();
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
		// 停止Live Preview观察器
		this.stopLivePreviewObserver();
		
		// 清理所有注册的命令
		this.registeredCommands.forEach(commandId => {
			// @ts-ignore - removeCommand 是私有方法，但这是清理命令的正确方式
			this.app.commands.removeCommand(commandId);
		});
		this.registeredCommands = [];
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		
		// 根据展开深度自动设置智能匹配模式
		if (this.settings.expandDepth === 2) {
			// 2级展开: 按第一级匹配
			this.settings.multiLevelAutoAdd.matchMode = 'level1';
		} else if (this.settings.expandDepth === 3) {
			// 3级展开: 按第二级匹配
			this.settings.multiLevelAutoAdd.matchMode = 'level2';
		}
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
		for (const l of workspace.getLeavesOfType(TAG_GROUP_VIEW)) {
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
			void workspace.revealLeaf(leaf);
		}
	}

	async convertMultiLevelTagsToGroups() {
		const allFiles = this.app.vault.getMarkdownFiles();
		const allTags = new Set<string>();

		for (const file of allFiles) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (cache) {
				const tags = getAllTags(cache);
				if (tags) {
					tags.forEach(t => allTags.add(t.substring(1))); // Remove #
				}
			}
		}

		let changesMade = false;

		// 解析用户指定的第一级标签前缀
		const prefixes = this.settings.expandTagPrefixes
			.split(',')
			.map(p => p.trim())
			.filter(p => p.length > 0);

		const expandDepth = this.settings.expandDepth || 3;

		// 辅助函数：生成唯一的组集名称
		const getUniqueSetName = (baseName: string): string => {
			let name = baseName;
			let counter = 1;
			while (this.settings.tagGroupSets.some(s => s.name === name)) {
				name = `${baseName} (${counter})`;
				counter++;
			}
			return name;
		};

		// 辅助函数：生成唯一的标签组名称
		const getUniqueGroupName = (baseName: string): string => {
			let name = baseName;
			let counter = 1;
			while (this.settings.tagGroups.some(g => g.name === name)) {
				name = `${baseName} (${counter})`;
				counter++;
			}
			return name;
		};

		if (expandDepth === 3) {
			// 3级展开模式
			const groupsToUpdate = new Map<string, Set<string>>(); // Key: "Set/Group", Value: Set of tags to add
			const twoLevelGroups = new Map<string, Set<string>>(); // Key: "GroupName", Value: Set of tags (for 2-level tags)

			for (const tag of allTags) {
				const parts = tag.split('/');
				
				if (parts.length === 2) {
					// 两级标签：A/B → 标签组=A，标签=A/B
					const groupName = parts[0];
					
					// 如果用户指定了前缀，只处理匹配的标签
					if (prefixes.length > 0 && !prefixes.includes(groupName)) {
						continue;
					}
					
					if (!twoLevelGroups.has(groupName)) twoLevelGroups.set(groupName, new Set());
					twoLevelGroups.get(groupName)!.add(tag);
					
				} else if (parts.length >= 3) {
					// 三级及以上标签：A/B/C/D/E → 组集=A，标签组=B，标签=C、C/D、C/D/E
					const setName = parts[0];
					
					// 如果用户指定了前缀，只处理匹配的标签
					if (prefixes.length > 0 && !prefixes.includes(setName)) {
						continue;
					}
					
					const groupName = parts[1];
					const key = `${setName}/${groupName}`;

					// 从第3层开始遍历到最后一层，全部添加
					for (let i = 2; i < parts.length; i++) {
						const tagToAdd = parts.slice(0, i + 1).join('/');
						if (!groupsToUpdate.has(key)) groupsToUpdate.set(key, new Set());
						groupsToUpdate.get(key)!.add(tagToAdd);
					}
				}
			}

			// 处理两级标签（不创建组集）
			for (const [groupName, tagsToAdd] of twoLevelGroups.entries()) {
				// 生成唯一的标签组名称
				const uniqueGroupName = getUniqueGroupName(groupName);
				
				// Find or Create Group
				let group = this.settings.tagGroups.find(g => g.name === uniqueGroupName);
				if (!group) {
					group = { id: generateUUID(), name: uniqueGroupName, tags: [], autoExpandedTags: [] };
					this.settings.tagGroups.push(group);
					changesMade = true;
				} else {
					if (!group.autoExpandedTags) {
						group.autoExpandedTags = [];
					}
				}

				// Add Tags
				const sortedTags = Array.from(tagsToAdd).sort();
				for (const t of sortedTags) {
					const wasAutoExpanded = group.autoExpandedTags && group.autoExpandedTags.includes(t);
					const isCurrentlyInGroup = group.tags.includes(t);
					
					if (!isCurrentlyInGroup) {
						if (!wasAutoExpanded) {
							group.tags.push(t);
							changesMade = true;
							
							if (!group.autoExpandedTags!.includes(t)) {
								group.autoExpandedTags!.push(t);
								changesMade = true;
							}
						}
					} else {
						if (!group.autoExpandedTags!.includes(t)) {
							group.autoExpandedTags!.push(t);
							changesMade = true;
						}
					}
				}
			}

			// 处理三级及以上标签（创建组集）
			for (const [key, tagsToAdd] of groupsToUpdate.entries()) {
				const [setName, groupName] = key.split('/');

				// 1. Find or Create Set（使用唯一名称）
				const uniqueSetName = getUniqueSetName(setName);
				let set = this.settings.tagGroupSets.find(s => s.name === uniqueSetName);
				if (!set) {
					set = { id: generateUUID(), name: uniqueSetName, icon: 'folder', groupIds: [] };
					this.settings.tagGroupSets.push(set);
					changesMade = true;
				}

				// 2. Find or Create Group（使用唯一名称）
				const uniqueGroupName = getUniqueGroupName(groupName);
				let group = this.settings.tagGroups.find(g => g.name === uniqueGroupName);
				if (!group) {
					group = { id: generateUUID(), name: uniqueGroupName, tags: [], autoExpandedTags: [] };
					this.settings.tagGroups.push(group);
					if (!set.groupIds.includes(group.id!)) set.groupIds.push(group.id!);
					changesMade = true;
				} else {
					if (group.id && !set.groupIds.includes(group.id)) {
						set.groupIds.push(group.id);
						changesMade = true;
					}
					if (!group.autoExpandedTags) {
						group.autoExpandedTags = [];
					}
				}

				// 3. Add Tags
				const sortedTags = Array.from(tagsToAdd).sort();
				for (const t of sortedTags) {
					const wasAutoExpanded = group.autoExpandedTags && group.autoExpandedTags.includes(t);
					const isCurrentlyInGroup = group.tags.includes(t);
					
					if (!isCurrentlyInGroup) {
						if (!wasAutoExpanded) {
							group.tags.push(t);
							changesMade = true;
							
							if (!group.autoExpandedTags!.includes(t)) {
								group.autoExpandedTags!.push(t);
								changesMade = true;
							}
						}
					} else {
						if (!group.autoExpandedTags!.includes(t)) {
							group.autoExpandedTags!.push(t);
							changesMade = true;
						}
					}
				}
			}
		} else if (expandDepth === 2) {
			// 2级展开：A/B/C/D → 标签组=A，标签=B、B/C、B/C/D（不创建组集）
			const groupsToUpdate = new Map<string, Set<string>>(); // Key: "GroupName", Value: Set of tags to add

			for (const tag of allTags) {
				const parts = tag.split('/');
				if (parts.length >= 2) {
					const groupName = parts[0];
					
					// 如果用户指定了前缀，只处理匹配的标签
					if (prefixes.length > 0 && !prefixes.includes(groupName)) {
						continue;
					}

					// 从第2层开始遍历到最后一层，全部添加
					for (let i = 1; i < parts.length; i++) {
						const tagToAdd = parts.slice(0, i + 1).join('/');
						if (!groupsToUpdate.has(groupName)) groupsToUpdate.set(groupName, new Set());
						groupsToUpdate.get(groupName)!.add(tagToAdd);
					}
				}
			}

			// Apply updates for 2-level expansion
			for (const [groupName, tagsToAdd] of groupsToUpdate.entries()) {
				// 生成唯一的标签组名称
				const uniqueGroupName = getUniqueGroupName(groupName);
				
				// Find or Create Group
				let group = this.settings.tagGroups.find(g => g.name === uniqueGroupName);
				if (!group) {
					group = { id: generateUUID(), name: uniqueGroupName, tags: [], autoExpandedTags: [] };
					this.settings.tagGroups.push(group);
					changesMade = true;
				} else {
					if (!group.autoExpandedTags) {
						group.autoExpandedTags = [];
					}
				}

				// Add Tags
				const sortedTags = Array.from(tagsToAdd).sort();
				for (const t of sortedTags) {
					const wasAutoExpanded = group.autoExpandedTags && group.autoExpandedTags.includes(t);
					const isCurrentlyInGroup = group.tags.includes(t);
					
					if (!isCurrentlyInGroup) {
						if (!wasAutoExpanded) {
							group.tags.push(t);
							changesMade = true;
							
							if (!group.autoExpandedTags!.includes(t)) {
								group.autoExpandedTags!.push(t);
								changesMade = true;
							}
						}
					} else {
						if (!group.autoExpandedTags!.includes(t)) {
							group.autoExpandedTags!.push(t);
							changesMade = true;
						}
					}
				}
			}
		}

		if (changesMade) {
			await this.saveSettings();
			new Notice(i18n.t('messages.multiLevelConverted') || 'Multi-level tags converted.');
		} else {
			new Notice(i18n.t('messages.noMultiLevelConverted') || 'No new tags to convert.');
		}
	}

	async autoScanTagsToGroups(): Promise<number> {
		const rules = this.settings.autoAddRules.split(';').filter(r => r.trim().length > 0);
		
		// 如果既没有规则也没有启用智能匹配,直接返回
		if (rules.length === 0 && !this.settings.multiLevelAutoAdd.enabled) {
			return 0;
		}

		const allFiles = this.app.vault.getMarkdownFiles();
		const allTags = new Set<string>(); // All unique tags in vault

		for (const file of allFiles) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (cache) {
				const tags = getAllTags(cache);
				if (tags) {
					tags.forEach(t => allTags.add(t.substring(1)));
				}
			}
		}

		const groupsToUpdate = new Map<string, Set<string>>();

		for (const tag of allTags) {
			let alreadyMatched = false; // 标记标签是否已经被智能匹配处理
			
			// 检查标签是否已经在任何标签组中
			const isTagInAnyGroup = this.settings.tagGroups.some(g => g.tags.includes(tag));
			
			// 多级标签智能匹配逻辑 - 只处理未被添加的标签
			const tagParts = tag.split('/');
			const isMultiLevel = tagParts.length >= 2;
			
			if (isMultiLevel && this.settings.multiLevelAutoAdd.enabled && !isTagInAnyGroup) {
				let matchedGroup: string | null = null;
				
				// 根据匹配模式进行匹配(二选一,找不到就不添加)
				if (this.settings.multiLevelAutoAdd.matchMode === 'level1') {
					// level1模式: 只按第一级匹配(适配2级展开)
					const level1 = tagParts[0];
					const group = this.settings.tagGroups.find(g => g.name === level1);
					if (group) {
						matchedGroup = group.name;
					}
				} else if (this.settings.multiLevelAutoAdd.matchMode === 'level2' && tagParts.length >= 2) {
					// level2模式: 只按第二级匹配(适配3级展开)
					const level2 = tagParts[1];
					const group = this.settings.tagGroups.find(g => g.name === level2);
					if (group) {
						matchedGroup = group.name;
					}
				}
				
				// 如果找到匹配的组，添加标签
				if (matchedGroup) {
					if (!groupsToUpdate.has(matchedGroup)) {
						groupsToUpdate.set(matchedGroup, new Set());
					}
					
					// 对于多级标签，添加所有层级节点（从第三级开始，或从第二级开始如果只有两级）
					if (tagParts.length >= 3) {
						for (let i = 2; i < tagParts.length; i++) {
							const tagToAdd = tagParts.slice(0, i + 1).join('/');
							groupsToUpdate.get(matchedGroup)!.add(tagToAdd);
						}
					} else {
						// 只有两级的标签，直接添加完整标签
						groupsToUpdate.get(matchedGroup)!.add(tag);
					}
					
					alreadyMatched = true; // 标记为已匹配，跳过规则匹配
				}
			}
			
			// 规则匹配逻辑（原有逻辑）- 只有在智能匹配未处理时才执行
			if (!alreadyMatched) {
				for (const rule of rules) {
				// 改进的规则解析：使用indexOf避免冒号在pattern或groupName中的问题
				const colonIndex = rule.indexOf(':');
				if (colonIndex === -1) continue;
				
				const pattern = rule.substring(0, colonIndex).trim();
				const targetGroupName = rule.substring(colonIndex + 1).trim();
				
				if (!pattern || !targetGroupName) continue;

				let matched = false;
				try {
					const regex = new RegExp(pattern, 'i');
					if (regex.test(tag)) matched = true;
				} catch {
					if (tag.toLowerCase().includes(pattern.toLowerCase())) matched = true;
				}

				if (matched) {
					const tagParts = tag.split('/');
					if (tagParts.length >= 3) {
						// 修复：收录所有节点，与展开功能保持一致
						for (let i = 2; i < tagParts.length; i++) {
							const tagToAdd = tagParts.slice(0, i + 1).join('/');
							if (!groupsToUpdate.has(targetGroupName)) groupsToUpdate.set(targetGroupName, new Set());
							groupsToUpdate.get(targetGroupName)!.add(tagToAdd);
						}
					} else {
						// For non-deep tags, just add them
						if (!groupsToUpdate.has(targetGroupName)) groupsToUpdate.set(targetGroupName, new Set());
						groupsToUpdate.get(targetGroupName)!.add(tag);
					}
				}
			}
			} // 结束 if (!alreadyMatched) 块
		}

		let addedCount = 0;
		let changesMade = false;

		// 修复：支持autoExpandedTags标记，尊重用户删除操作
		for (const [groupName, tagsToAdd] of groupsToUpdate.entries()) {
			const group = this.settings.tagGroups.find(g => g.name === groupName);
			if (group) {
				// 确保 autoExpandedTags 字段存在
				if (!group.autoExpandedTags) {
					group.autoExpandedTags = [];
				}
				
				const sortedTags = Array.from(tagsToAdd).sort();
				for (const t of sortedTags) {
					// 检查标签是否被用户手动删除
					const wasAutoExpanded = group.autoExpandedTags.includes(t);
					const isCurrentlyInGroup = group.tags.includes(t);
					
					if (!isCurrentlyInGroup) {
						// 标签不在组中
						if (!wasAutoExpanded) {
							// 这是新标签，添加它
							group.tags.push(t);
							changesMade = true;
							addedCount++;
							
							// 记录为自动添加的标签
							if (!group.autoExpandedTags.includes(t)) {
								group.autoExpandedTags.push(t);
							}
						}
						// 如果 wasAutoExpanded 为 true，说明用户手动删除了，不重新添加
					} else {
						// 标签已在组中，确保它在 autoExpandedTags 中
						if (!group.autoExpandedTags.includes(t)) {
							group.autoExpandedTags.push(t);
						}
					}
				}
			}
		}

		if (changesMade) {
			await this.saveSettings();
		}
		return addedCount;
	}

	private livePreviewObserver: MutationObserver | null = null;

	applyTextTagStyling() {
		if (!this.settings.enableTextTagStyling) {
			const existingStyle = document.getElementById('tgm-dynamic-tag-styles');
			if (existingStyle) existingStyle.remove();
			this.stopLivePreviewObserver();
			return;
		}

		let css = '';
		const tagColors = this.settings.tagColors;
		const presetColors: { [key: string]: string } = {
			'var(--color-red)': '#e74c3c',
			'var(--color-blue)': '#3498db',
			'var(--color-green)': '#2ecc71',
			'var(--color-orange)': '#f39c12',
			'var(--color-purple)': '#9b59b6',
			'var(--color-cyan)': '#1abc9c',
			'var(--color-pink)': '#e91e63'
		};

		for (const [tag, color] of Object.entries(tagColors)) {
			if (!color) continue;

			// Generate styles for both Reading View and Live Preview
			let rgb = { r: 0, g: 0, b: 0 };

			let hexColor = color;
			if (color.startsWith('var(--')) {
				hexColor = presetColors[color] || '#888888';
			}

			if (hexColor.startsWith('#')) {
				const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hexColor);
				if (result) rgb = { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) };
			}

			// 模仿属性标签样式：更浅的背景色，更深的文字色
			const bgColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`;
			const textColor = `rgb(${Math.floor(rgb.r * 0.65)}, ${Math.floor(rgb.g * 0.65)}, ${Math.floor(rgb.b * 0.65)})`;

			// 转义标签名中的特殊字符（用于CSS选择器）
			const escapedTag = tag.replace(/[\/\.\+\*\?\^\$\(\)\[\]\{\}\|\\]/g, '\\$&');
			// 为data属性生成安全的值（替换特殊字符为连字符）
			const safeTagAttr = tag.replace(/[\/\s]/g, '-');

			css += `
            /* Reading View (阅读模式) - 模仿属性标签样式 */
            .markdown-preview-view a.tag[href="#${escapedTag}" i],
            .markdown-rendered a.tag[href="#${escapedTag}" i] { 
                background-color: ${bgColor} !important; 
                color: ${textColor} !important;
                border: none !important;
                border-radius: 13px !important;
                padding: 2px 8px !important;
                font-size: 13px !important;
                line-height: 13px !important;
                display: inline-flex !important;
                align-items: center !important;
                height: 17px !important;
                text-decoration: none !important;
            }
            
            /* Live Preview (实时预览/编辑模式) - 模仿属性标签样式 */
            /* 标签容器样式 */
            .cm-line .cm-hashtag[data-tag-name="${safeTagAttr}"] {
                background-color: ${bgColor} !important;
                color: ${textColor} !important;
                border: none !important;
                display: inline-flex !important;
                align-items: center !important;
                height: 17px !important;
                line-height: 13px !important;
                font-size: 13px !important;
            }
            
            /* 标签开始（#号）的圆角和内边距 */
            .cm-line .cm-hashtag-begin[data-tag-name="${safeTagAttr}"] {
                border-top-left-radius: 13px !important;
                border-bottom-left-radius: 13px !important;
                padding-left: 8px !important;
            }
            
            /* 标签结束（文本）的圆角和内边距 */
            .cm-line .cm-hashtag-end[data-tag-name="${safeTagAttr}"] {
                border-top-right-radius: 13px !important;
                border-bottom-right-radius: 13px !important;
                padding-right: 8px !important;
            }
            `;
		}

		let styleEl = document.getElementById('tgm-dynamic-tag-styles') as HTMLStyleElement;
		if (!styleEl) {
			styleEl = document.createElement('style');
			styleEl.id = 'tgm-dynamic-tag-styles';
			document.head.appendChild(styleEl);
		}
		styleEl.textContent = css;

		// 启动Live Preview标签监听器
		this.startLivePreviewObserver();
	}

	private startLivePreviewObserver() {
		// 停止现有的观察器
		this.stopLivePreviewObserver();

		// 处理现有的标签元素
		this.processExistingTags();

		// 创建新的观察器来监听DOM变化
		this.livePreviewObserver = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (mutation.type === 'childList') {
					mutation.addedNodes.forEach((node) => {
						if (node.nodeType === Node.ELEMENT_NODE) {
							const element = node as HTMLElement;
							// 处理新添加的标签元素
							this.processTagElement(element);
							// 处理子元素中的标签
							const hashtags = element.querySelectorAll('.cm-hashtag');
							hashtags.forEach((tag) => this.processTagElement(tag as HTMLElement));
						}
					});
				}
			}
		});

		// 观察整个文档的变化
		this.livePreviewObserver.observe(document.body, {
			childList: true,
			subtree: true
		});
	}

	private stopLivePreviewObserver() {
		if (this.livePreviewObserver) {
			this.livePreviewObserver.disconnect();
			this.livePreviewObserver = null;
		}
	}

	private processExistingTags() {
		// 处理所有现有的标签元素
		const hashtags = document.querySelectorAll('.cm-hashtag');
		hashtags.forEach((tag) => this.processTagElement(tag as HTMLElement));
	}

	private processTagElement(element: HTMLElement) {
		// 只处理标签文本部分（cm-hashtag-end）
		if (!element.classList.contains('cm-hashtag-end')) {
			return;
		}

		// 如果已经处理过，跳过
		if (element.hasAttribute('data-tag-name')) {
			return;
		}

		// 获取标签文本
		const tagText = element.textContent?.trim();
		if (!tagText) return;

		// 检查这个标签是否有配置的颜色
		if (this.settings.tagColors[tagText]) {
			// 生成安全的属性值
			const safeTagAttr = tagText.replace(/[\/\s]/g, '-');
			
			// 为标签文本元素添加data属性
			element.setAttribute('data-tag-name', safeTagAttr);
			
			// 找到对应的#号元素（前一个兄弟节点）
			const prevSibling = element.previousElementSibling;
			if (prevSibling && prevSibling.classList.contains('cm-hashtag-begin')) {
				prevSibling.setAttribute('data-tag-name', safeTagAttr);
			}
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
	private currentGroup: TagGroup | null = null; // 当前标签组

	constructor(app: App, editor: Editor, tags: string[], plugin?: TagGroupManagerPlugin, group?: TagGroup) {
		this.app = app;
		this.editor = editor;
		this.tags = tags;
		this.originalTags = [...tags]; // 保存原始标签列表的副本
		this.plugin = plugin || null;
		this.currentGroup = group || null;
		// 创建根元素
		this.rootEl = document.createElement('div');
		this.rootEl.addClass('tag-group-selector-modal');

		// 创建UI并添加到DOM
		this.createUI();
		document.body.appendChild(this.rootEl);

		// 设置拖拽
		this.setupDrag();

		// 异步设置搜索框监听器
		void (async () => {
			try {
				await this.setupSearchBoxListener();
			} catch (e) {
				// 静默处理错误
				console.error("Error setting up search box listener:", e);
			}
		})();
	}

	open() {
		// 修改open方法，移除自动插入第一个标签的逻辑
		// 只显示标签选择界面，不自动插入任何标签
		this.renderTags();
	}



	// 设置位置 - 简化为使用CSS类
	setPosition(_left: number, _top: number) {
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
		infiniteButton.addEventListener('click', (e: MouseEvent) => {
			void (async () => {
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
			})();
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
		// 计算新位置
		const newX = e.clientX - this.offsetX;
		const newY = e.clientY - this.offsetY;

		// 确保在视口范围内
		const windowWidth = window.innerWidth;
		const windowHeight = window.innerHeight;
		const elementWidth = this.rootEl.offsetWidth;
		const elementHeight = this.rootEl.offsetHeight;

		const boundedX = Math.max(0, Math.min(newX, windowWidth - elementWidth));
		const boundedY = Math.max(0, Math.min(newY, windowHeight - elementHeight));

		// 拖动时切换到可拖动样式
		this.rootEl.addClass('tgm-position-element');
		this.rootEl.addClass('tgm-position-draggable');
		// 移除默认位置
		this.rootEl.removeClass('tgm-position-default');

		// 移除之前的网格类（清理之前的状态）
		this.rootEl.removeClass('tgm-position-grid');
		for (let i = 0; i < 20; i++) {
			this.rootEl.removeClass(`tgm-pos-x-${i}`);
			this.rootEl.removeClass(`tgm-pos-y-${i}`);
		}

		// 直接应用位置样式
		this.rootEl.style.left = `${boundedX}px`;
		this.rootEl.style.top = `${boundedY}px`;
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
		return !!tag && tag.length > 0 && !/^\.|[\s[](){}<>#:;,'"?=+`~!@$%^&*]/.test(tag);
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
	getTagCount(tag: string): number {
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

	renderTags() {
		// 清空容器
		this.containerEl.empty();

		// 过滤掉自动展开的叶子节点（末节点）- 这些节点只在设置页面显示
		// 手动添加的标签不会被过滤
		const autoExpandedTags = this.currentGroup?.autoExpandedTags;
		const minDepth = this.currentGroup && this.plugin 
			? getGroupExpandDepth(this.currentGroup, this.plugin.settings.tagGroupSets)
			: 3;
		const filteredTags = this.tags.filter(tag => !shouldHideTag(tag, this.tags, autoExpandedTags, minDepth));

		// 渲染每个标签
		for (const tag of filteredTags) {
			const tagEl = this.containerEl.createDiv('tgm-tag-item');

			// 检查标签是否有效
			const isValid = this.isValidTag(tag);
			if (!isValid) {
				tagEl.addClass('invalid-tag');
			}

			// 应用自定义颜色（如果启用且有匹配的颜色映射）
			if (this.plugin && this.plugin.settings.enableCustomColors) {
				const customColor = getTagColor(tag, this.plugin.settings);
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
							// 对于自定义颜色，使用类似彩虹目录的渐变效果
							// 将十六进制颜色转换为 RGB
							const hexToRgb = (hex: string) => {
								const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
								return result ? {
									r: parseInt(result[1], 16),
									g: parseInt(result[2], 16),
									b: parseInt(result[3], 16)
								} : null;
							};

							const rgb = hexToRgb(customColor);
							if (rgb) {
								const bgColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.08)`;
								const textColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.85)`;
								const borderColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`;

								tagEl.style.setProperty('background', `linear-gradient(145deg, ${bgColor}, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.06))`, 'important');
								tagEl.style.setProperty('color', textColor, 'important');
								tagEl.style.setProperty('border-color', borderColor, 'important');
							}
						}

						tagEl.addClass('custom-colored-tag');
					}
				} else {
					// 开启颜色映射但未设置特定颜色时，使用默认的彩虹风格渐变
					// 使用中性的灰蓝色作为默认颜色
					const defaultRgb = { r: 148, g: 163, b: 184 }; // lighter slate
					const bgColor = `rgba(${defaultRgb.r}, ${defaultRgb.g}, ${defaultRgb.b}, 0.08)`;
					const textColor = `rgba(${defaultRgb.r}, ${defaultRgb.g}, ${defaultRgb.b}, 0.85)`;
					const borderColor = `rgba(${defaultRgb.r}, ${defaultRgb.g}, ${defaultRgb.b}, 0.15)`;

					tagEl.style.setProperty('background', `linear-gradient(145deg, ${bgColor}, rgba(${defaultRgb.r}, ${defaultRgb.g}, ${defaultRgb.b}, 0.06))`, 'important');
					tagEl.style.setProperty('color', textColor, 'important');
					tagEl.style.setProperty('border-color', borderColor, 'important');
					tagEl.addClass('tgm-default-rainbow-tag');
				}
			}

			// 创建标签文本容器
			const tagTextEl = tagEl.createDiv('tgm-tag-text');

			// 检查是否为嵌套标签并添加图标
			let displayText = tag;
			const isMultiLevelTag = tag.includes('/');
			
			if (isMultiLevelTag) {
				// 添加lucide tags图标
				const iconEl = tagTextEl.createSpan('tgm-tag-icon');
				setIcon(iconEl, 'tags');
				// Show shortened name (leaf)
				displayText = ` ${tag.split('/').pop()}`;
				tagTextEl.addClass('nested-tag');
			}
			tagTextEl.appendText(displayText);

			// Add Hierarchy Board Trigger (Tag Selector) - 仅用于多级标签
			if (isMultiLevelTag && this.plugin) {
				const triggerEl = tagEl.createDiv('tgm-hierarchy-trigger');
				triggerEl.setText('>>');
				triggerEl.removeAttribute('aria-label');

				triggerEl.addEventListener('mouseenter', (e) => {
					const rect = triggerEl.getBoundingClientRect();
					this.plugin?.hierarchyBoard.show(tag, rect, false, this);
				});

				triggerEl.addEventListener('mouseleave', (e) => {
					this.plugin?.hierarchyBoard.hide(200);
				});

				triggerEl.addEventListener('mousedown', (e) => {
					e.stopPropagation();
				});

				triggerEl.addEventListener('click', (e) => {
					e.stopPropagation();
					e.stopImmediatePropagation();
					e.preventDefault();
					const rect = triggerEl.getBoundingClientRect();
					this.plugin?.hierarchyBoard.show(tag, rect, true, this);
				});
			}

			// 设置 Tooltip - 仅用于非多级标签
			// 多级标签通过 hierarchy board 查看完整路径，不需要 tooltip
			if (!isMultiLevelTag) {
				tagTextEl.setAttribute('aria-label', tag);
			}

			// 添加标签计数
			const tagCountEl = tagEl.createDiv('tgm-tag-count');
			const count = this.getTagCount(tag);
			tagCountEl.setText(`${count}`);
			tagCountEl.setAttribute('aria-label', i18n.t('messages.tagcounttip').replace('{count}', count.toString()));

			// 添加点击事件
			tagEl.addEventListener('mousedown', (e) => {
				// Check for PCards input field first
				const pcardsTagInput = document.querySelector('form.quick-note-form input#tags');
				if (pcardsTagInput instanceof HTMLInputElement) {
					e.preventDefault();
					e.stopPropagation();
					if (!isValid) return;

					insertTagIntoInputElement(pcardsTagInput, tag);

					if (!this.isInfiniteMode) {
						tagEl.addClass('tgm-inserted-tag');
					}
					// Update count display
					tagCountEl.setText(`${count + 1}`);
					setTimeout(() => {
						const newCount = this.getTagCount(tag);
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

				// 检查是否是 Live Preview 的元数据属性编辑区域 (Properties view)
				const isMetadataInput = activeElement && activeElement.closest('.metadata-container');

				// 如果是输入框但不是Markdown编辑器，或者是Properties区域
				if ((isInputElement && !isMarkdownEditor) || (isMetadataInput && isInputElement)) {
					// 处理 Properties 视图的特殊情况
					if (isMetadataInput) {
						if (activeElement.contentEditable === 'true' || activeElement.tagName === 'INPUT') {
							// 1. 插入文本
							document.execCommand('insertText', false, tag);

							// 2. 模拟 Enter 键，触发 Obsidian 将文本转换为标签块
							const eventProps = {
								key: 'Enter',
								code: 'Enter',
								keyCode: 13,
								which: 13,
								bubbles: true,
								cancelable: true,
								view: window
							};
							activeElement.dispatchEvent(new KeyboardEvent('keydown', eventProps));
							activeElement.dispatchEvent(new KeyboardEvent('keypress', eventProps));
							activeElement.dispatchEvent(new KeyboardEvent('keyup', eventProps));

							// 在非循环模式下，将标签添加已插入样式
							if (!this.isInfiniteMode) {
								tagEl.addClass('tgm-inserted-tag');
								// Update count display
								tagCountEl.setText(`${count + 1}`);
								setTimeout(() => {
									const newCount = this.getTagCount(tag);
									tagCountEl.setText(`${newCount}`);
								}, 3000);
							}
							return;
						}
					}

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
							newCursor = { line: lastTagLine + 1, ch: ('  - ' + tag).length };
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
				setTimeout(() => {
					const newCount = this.getTagCount(tag);
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

// 更新日志视图
class ChangelogView extends ItemView {
	plugin: TagGroupManagerPlugin;
	version: string;
	changelog: string;

	constructor(leaf: WorkspaceLeaf, plugin: TagGroupManagerPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return CHANGELOG_VIEW_TYPE;
	}

	getDisplayText(): string {
		return `${this.plugin.manifest.name} - What's New`;
	}

	getIcon(): string {
		return 'rocket';
	}

	setChangelog(version: string, changelog: string) {
		this.version = version;
		this.changelog = changelog;
		this.render();
	}

	async onOpen() {
		// 初始渲染可能为空，等待 setChangelog 调用
		this.render();
	}

	async render() {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass('tgm-changelog-view');

		const scrollingContainer = container.createDiv('tgm-changelog-scroll-container');
		scrollingContainer.style.maxWidth = '800px';
		scrollingContainer.style.margin = '0 auto';
		scrollingContainer.style.padding = '50px 20px';

		if (this.version && this.changelog) {
			scrollingContainer.createEl('h1', { text: `What's New in ${this.plugin.manifest.name} ${this.version}` });

			const contentDiv = scrollingContainer.createDiv('markdown-rendered');

			// 使用 Obsidian 的 Markdown 渲染器
			await MarkdownRenderer.render(
				this.plugin.app,
				this.changelog,
				contentDiv,
				'/',
				this // Component
			);
		} else {
			scrollingContainer.createEl('p', { text: 'No changelog loaded.' });
		}
	}
}

// 颜色选择器模态框
class ColorPickerModal extends Modal {
	plugin: TagGroupManagerPlugin;
	initialColor: string;
	onSave: (color: string) => void;
	currentPickerColor: string;

	constructor(app: App, plugin: TagGroupManagerPlugin, initialColor: string, onSave: (color: string) => void) {
		super(app);
		this.plugin = plugin;
		this.initialColor = initialColor;
		this.onSave = onSave;
		this.currentPickerColor = initialColor.startsWith('#') ? initialColor : '#000000';
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('tgm-color-picker-modal');


		contentEl.createEl('h2', { text: i18n.t('settings.selectColor') || '选择颜色' });

		// 1. 预设颜色
		contentEl.createEl('h3', { text: i18n.t('settings.presetColors') || '预设颜色' });
		const presetsContainer = contentEl.createDiv('tgm-color-presets');

		const presetColors = [
			{ name: i18n.t('settings.presetRed') || '红色', value: 'var(--color-red)', bg: '#e74c3c' },
			{ name: i18n.t('settings.presetBlue') || '蓝色', value: 'var(--color-blue)', bg: '#3498db' },
			{ name: i18n.t('settings.presetGreen') || '绿色', value: 'var(--color-green)', bg: '#2ecc71' },
			{ name: i18n.t('settings.presetOrange') || '橙色', value: 'var(--color-orange)', bg: '#f39c12' },
			{ name: i18n.t('settings.presetPurple') || '紫色', value: 'var(--color-purple)', bg: '#9b59b6' },
			{ name: i18n.t('settings.presetCyan') || '青色', value: 'var(--color-cyan)', bg: '#1abc9c' },
			{ name: i18n.t('settings.presetPink') || '粉色', value: 'var(--color-pink)', bg: '#e91e63' }
		];

		presetColors.forEach(preset => {
			const btn = presetsContainer.createDiv('tgm-color-preset-btn');
			btn.style.backgroundColor = preset.bg;
			btn.setAttribute('aria-label', preset.name);
			if (this.initialColor === preset.value) btn.addClass('selected');

			btn.addEventListener('click', () => {
				this.onSave(preset.value);
				this.close();
			});
		});

		// 2. 自定义颜色
		contentEl.createEl('h3', { text: i18n.t('settings.customColors') || '自定义颜色' });

		const customContainer = contentEl.createDiv('tgm-custom-color-container');

		// 颜色选择器
		const pickerContainer = customContainer.createDiv('tgm-color-picker-control');
		const colorPicker = new ColorComponent(pickerContainer)
			.setValue(this.currentPickerColor)
			.onChange((value) => {
				this.currentPickerColor = value;
			});

		const useColorBtn = pickerContainer.createEl('button', { text: i18n.t('settings.useColor') || '使用此颜色' });
		useColorBtn.addClass('mod-cta');

		// 添加恢复默认按钮
		const resetBtn = pickerContainer.createEl('button', { text: i18n.t('settings.resetColor') || '恢复默认' });
		resetBtn.addClass('tgm-reset-color-btn');

		// 槽位
		const slotsContainer = customContainer.createDiv('tgm-color-slots');

		const renderSlots = () => {
			slotsContainer.empty();
			this.plugin.settings.customColors.forEach((color, index) => {
				const slot = slotsContainer.createDiv('tgm-color-slot');
				if (color) {
					slot.style.backgroundColor = color;
					if (this.initialColor === color) slot.addClass('selected');
					slot.setAttribute('aria-label', `${i18n.t('settings.useColor') || '使用此颜色'} (Right click to clear)`);

					slot.addEventListener('click', () => {
						this.onSave(color);
						this.close();
					});

					// 右键删除
					slot.addEventListener('contextmenu', (e) => {
						e.preventDefault();
						this.plugin.settings.customColors[index] = '';
						void this.plugin.saveSettings();
						renderSlots();
					});
				} else {
					slot.addClass('empty');
					slot.setText('+');
					slot.setAttribute('aria-label', i18n.t('settings.saveToSlot') || '保存到此位置');
					slot.addEventListener('click', () => {
						// 保存当前选择器颜色到此槽位
						this.plugin.settings.customColors[index] = this.currentPickerColor;
						void this.plugin.saveSettings();
						renderSlots();
					});
				}
			});
		};

		renderSlots();

		useColorBtn.addEventListener('click', () => {
			// 自动保存到槽位逻辑
			const currentColor = this.currentPickerColor;

			// 检查颜色是否已经存在于槽位中
			const existingIndex = this.plugin.settings.customColors.indexOf(currentColor);

			if (existingIndex === -1) {
				// 寻找第一个空槽位
				let targetIndex = this.plugin.settings.customColors.findIndex(c => !c);

				if (targetIndex === -1) {
					let nextIndex = (this.plugin.settings as any).customColorIndex || 0;
					targetIndex = nextIndex;
					(this.plugin.settings as any).customColorIndex = (nextIndex + 1) % 7;
				}

				this.plugin.settings.customColors[targetIndex] = currentColor;
				void this.plugin.saveSettings();
			}

			this.onSave(currentColor);
			this.close();
		});

		resetBtn.addEventListener('click', () => {
			this.onSave(''); // 保存空字符串表示移除自定义颜色
			this.close();
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class TagGroupSetModal extends Modal {
	plugin: TagGroupManagerPlugin;
	groupSet: TagGroupSet;
	onSave: (groupSet: TagGroupSet) => void;

	constructor(plugin: TagGroupManagerPlugin, groupSet: TagGroupSet | null, onSave: (groupSet: TagGroupSet) => void) {
		super(plugin.app);
		this.plugin = plugin;
		this.onSave = onSave;

		// 如果是编辑模式，使用现有数据；如果是新建模式，初始化空数据
		this.groupSet = groupSet ? { ...groupSet } : {
			id: generateUUID(),
			name: '',
			icon: 'home',
			groupIds: []
		};
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: this.groupSet.name ? i18n.t('tagGroupSets.editSet') : i18n.t('tagGroupSets.addSet') });

		// 1. 组集名称
		new Setting(contentEl)
			.setName(i18n.t('tagGroupSets.setName'))
			.addText(text => text
				.setPlaceholder(i18n.t('tagGroupSets.namePlaceholder'))
				.setValue(this.groupSet.name)
				.onChange(value => {
					this.groupSet.name = value;
				}));

		// 2. 图标设置
		new Setting(contentEl)
			.setName(i18n.t('tagGroupSets.setIcon'))
			.setDesc(i18n.t('tagGroupSets.iconPlaceholder'))
			.addText(text => text
				.setValue(this.groupSet.icon)
				.onChange(value => {
					this.groupSet.icon = value;
				}));

		// 3. 选择包含的标签组
		contentEl.createEl('h3', { text: i18n.t('tagGroupSets.selectGroups') });
		const groupsContainer = contentEl.createDiv('tgm-group-selection-container');
		groupsContainer.style.maxHeight = '300px';
		groupsContainer.style.overflowY = 'auto';
		groupsContainer.style.border = '1px solid var(--background-modifier-border)';
		groupsContainer.style.padding = '10px';
		groupsContainer.style.borderRadius = '4px';

		// 获取所有可用的标签组
		const allGroups = this.plugin.settings.tagGroups;

		if (allGroups.length === 0) {
			groupsContainer.createEl('div', { text: i18n.t('messages.noTagsInGroup'), cls: 'tgm-no-data' });
		} else {
			allGroups.forEach(group => {
				const groupItem = groupsContainer.createDiv('tgm-group-selection-item');
				groupItem.style.display = 'flex';
				groupItem.style.alignItems = 'center';
				groupItem.style.marginBottom = '5px';

				const checkbox = groupItem.createEl('input', { type: 'checkbox' });
				checkbox.checked = this.groupSet.groupIds.includes(group.id!);
				checkbox.style.marginRight = '10px';

				checkbox.addEventListener('change', (e) => {
					const isChecked = (e.target as HTMLInputElement).checked;
					if (isChecked) {
						if (!this.groupSet.groupIds.includes(group.id!)) {
							this.groupSet.groupIds.push(group.id!);
						}
					} else {
						this.groupSet.groupIds = this.groupSet.groupIds.filter(id => id !== group.id);
					}
				});

				groupItem.createSpan({ text: group.name });
			});
		}

		// 4. 保存按钮
		const buttonContainer = contentEl.createDiv('tgm-modal-button-container');
		buttonContainer.style.marginTop = '20px';
		buttonContainer.style.display = 'flex';
		buttonContainer.style.justifyContent = 'flex-end';

		const saveBtn = buttonContainer.createEl('button', {
			text: i18n.t('settings.confirmSelection') || 'Save',
			cls: 'mod-cta'
		});

		saveBtn.addEventListener('click', () => {
			if (!this.groupSet.name.trim()) {
				new Notice(i18n.t('tagGroupSets.namePlaceholder'));
				return;
			}
			this.onSave(this.groupSet);
			this.close();
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

// 设置选项卡
class TagGroupManagerSettingTab extends PluginSettingTab {
	plugin: TagGroupManagerPlugin;

	constructor(app: App, plugin: TagGroupManagerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	private async saveSettingsAndRefreshDisplay() {
		try {
			await this.plugin.saveSettings();
			this.display();
		} catch (error) {
			console.error("Failed to save settings and refresh display:", error);
			new Notice("Failed to save settings.");
		}
	}


	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		// ==================== 重要Tips区域 (Collapsible Callout) ====================
		const tipsDetails = containerEl.createEl('details');
		tipsDetails.addClass('tgm-tips-callout');

		const tipsSummary = tipsDetails.createEl('summary');
		tipsSummary.addClass('tgm-tips-summary');
		tipsSummary.setText(i18n.t('settings.importantTips'));

		const tipsContent = tipsDetails.createDiv('tgm-tips-content');

		// 标签总览视图部分
		const overviewSection = tipsContent.createDiv('tgm-tips-section');
		new Setting(overviewSection).setName(i18n.t('settings.tagOverviewTips')).setHeading();

		const overviewList = overviewSection.createEl('ol', { cls: 'tgm-tips-list' });
		overviewList.createEl('li', { text: i18n.t('settings.tip1') });
		overviewList.createEl('li', { text: i18n.t('settings.tip2') });
		overviewList.createEl('li', { text: i18n.t('settings.tip3') });

		// 浮动标签选择器部分
		const selectorSection = tipsContent.createDiv('tgm-tips-section');
		new Setting(selectorSection).setName(i18n.t('settings.floatingTagSelectorTips')).setHeading();

		const selectorList = selectorSection.createEl('ol', { cls: 'tgm-tips-list' });
		selectorList.createEl('li', { text: i18n.t('settings.tip4') });
		selectorList.createEl('li', { text: i18n.t('settings.tip5') });
		selectorList.createEl('li', { text: i18n.t('settings.tip6') });

		// ==================== 多级标签适配设置区域 ====================
		this.renderMultiLevelSettings(containerEl);

		// ==================== 颜色设置区域 ====================
		this.renderColorSettings(containerEl);

		// ==================== 组集管理区域 ====================
		this.renderTagGroupSetSettings(containerEl);

		// ==================== 全局标签重命名区域 ====================
		this.renderRenameSettings(containerEl);

		// ==================== 标签组管理区域 ====================
		this.renderTagGroupSettings(containerEl);
	}




	renderMultiLevelSettings(containerEl: HTMLElement): void {
		const section = containerEl.createDiv('settings-section');
		new Setting(section).setName(i18n.t('multiLevelAdaptation.title') || '多级标签适配').setHeading();

		// 展开配置区域（集中显示）
		const expandConfigContainer = section.createDiv('tgm-expand-config-container');
		expandConfigContainer.style.border = '1px solid var(--background-modifier-border)';
		expandConfigContainer.style.borderRadius = '6px';
		expandConfigContainer.style.padding = '16px';
		expandConfigContainer.style.marginBottom = '20px';
		expandConfigContainer.style.backgroundColor = 'var(--background-secondary)';

		// 展开深度
		new Setting(expandConfigContainer)
			.setName('展开深度')
			.setDesc('3级展开：前三级作为组集/标签组/标签；2级展开：前两级作为标签组/标签（不创建组集）')
			.addDropdown(dropdown => dropdown
				.addOption('3', '3级展开（组集/标签组/标签）')
				.addOption('2', '2级展开（标签组/标签）')
				.setValue(this.plugin.settings.expandDepth.toString())
				.onChange(async (value) => {
					this.plugin.settings.expandDepth = parseInt(value);
					// 根据展开深度自动设置智能匹配模式
					if (parseInt(value) === 2) {
						this.plugin.settings.multiLevelAutoAdd.matchMode = 'level1';
					} else {
						this.plugin.settings.multiLevelAutoAdd.matchMode = 'level2';
					}
					await this.plugin.saveSettings();
					// 刷新设置页面以更新智能匹配区域的显示
					this.display();
				}));

		// 指定展开的第一级标签
		new Setting(expandConfigContainer)
			.setName('指定展开的第一级标签')
			.setDesc('输入要展开的第一级标签名称，多个标签用逗号分隔。留空则展开所有多级标签。例如：前端,后端,数据库')
			.addText(text => {
				text.setPlaceholder('前端,后端,数据库')
					.setValue(this.plugin.settings.expandTagPrefixes)
					.onChange(async (value) => {
						this.plugin.settings.expandTagPrefixes = value;
						await this.plugin.saveSettings();
					});
				text.inputEl.style.width = '100%';
			});

		// 立即展开按钮
		new Setting(expandConfigContainer)
			.setName('多级标签自动展开功能')
			.setDesc('点击后将自动扫描库中的多级标签并转化为组集和标签组')
			.addButton(btn => btn
				.setButtonText('立即展开')
				.setCta()
				.onClick(async () => {
					await this.plugin.convertMultiLevelTagsToGroups();
					this.display();
				}));

		// 2.3 Auto Add Rules
		const autoAddSection = section.createDiv('tgm-auto-add-section');
		autoAddSection.style.border = '1px solid var(--background-modifier-border)';
		autoAddSection.style.borderRadius = '6px';
		autoAddSection.style.padding = '16px';
		autoAddSection.style.marginBottom = '20px';
		autoAddSection.style.backgroundColor = 'var(--background-secondary)';
		
		new Setting(autoAddSection)
			.setName(i18n.t('multiLevelAdaptation.autoAddTags') || '自动添加标签至标签组')
			.setDesc(i18n.t('multiLevelAdaptation.autoAddTagsDesc') || '根据关键字或正则表达式,扫描未被划分到标签组的标签,自动将相关标签添加至目标标签组')
			.setHeading();

		// Rules List
		const rulesList = autoAddSection.createDiv('tgm-rules-list');
		rulesList.style.marginBottom = '12px';
		
		const updateRulesList = () => {
			rulesList.empty();
			const rules = this.plugin.settings.autoAddRules.split(';').filter(r => r.trim().length > 0);
			
			if (rules.length > 0) {
				rules.forEach(rule => {
					const ruleEl = rulesList.createDiv('tgm-rule-item');
					ruleEl.style.display = 'flex';
					ruleEl.style.alignItems = 'center';
					ruleEl.style.justifyContent = 'space-between';
					ruleEl.style.padding = '6px 10px';
					ruleEl.style.marginBottom = '6px';
					ruleEl.style.backgroundColor = 'var(--background-primary)';
					ruleEl.style.borderRadius = '4px';
					ruleEl.style.border = '1px solid var(--background-modifier-border)';
					
					const [pattern, group] = rule.split(':');
					const textSpan = ruleEl.createSpan({ text: `${pattern} → ${group}` });
					textSpan.style.flex = '1';
					textSpan.style.fontSize = '0.9em';
					
					const deleteBtn = ruleEl.createEl('button', { text: '×' });
					deleteBtn.style.padding = '2px 8px';
					deleteBtn.style.cursor = 'pointer';
					deleteBtn.style.border = 'none';
					deleteBtn.style.background = 'transparent';
					deleteBtn.style.color = 'var(--text-muted)';
					deleteBtn.style.fontSize = '1.2em';
					deleteBtn.onmouseenter = () => deleteBtn.style.color = 'var(--text-error)';
					deleteBtn.onmouseleave = () => deleteBtn.style.color = 'var(--text-muted)';
					deleteBtn.onclick = async () => {
						const newRules = rules.filter(r => r !== rule).join(';');
						this.plugin.settings.autoAddRules = newRules;
						await this.plugin.saveSettings();
						updateRulesList();
					};
				});
			}
		};
		updateRulesList();

		// Add Rule UI - Compact layout
		const addRuleContainer = autoAddSection.createDiv('tgm-add-rule-container');
		addRuleContainer.style.display = 'grid';
		addRuleContainer.style.gridTemplateColumns = '1fr 1fr auto';
		addRuleContainer.style.gap = '8px';
		addRuleContainer.style.marginBottom = '16px';
		addRuleContainer.style.alignItems = 'center';

		const patternInput = addRuleContainer.createEl('input', {
			type: 'text',
			placeholder: i18n.t('multiLevelAdaptation.rulePlaceholder') || '关键字或正则表达式'
		});
		patternInput.style.width = '100%';
		patternInput.style.padding = '6px 10px';
		
		// Add Datalist for suggestions
		const dataListId = 'tgm-group-suggestions';
		const dataList = addRuleContainer.createEl('datalist', { attr: { id: dataListId } });
		this.plugin.settings.tagGroups.forEach(g => {
			dataList.createEl('option', { attr: { value: g.name } });
		});

		const groupInput = addRuleContainer.createEl('input', {
			type: 'text',
			placeholder: i18n.t('multiLevelAdaptation.targetGroupPlaceholder') || '目标标签组名称'
		});
		groupInput.setAttribute('list', dataListId);
		groupInput.style.width = '100%';
		groupInput.style.padding = '6px 10px';
		
		const addRuleBtn = addRuleContainer.createEl('button', {
			text: i18n.t('multiLevelAdaptation.addRule') || '添加规则'
		});
		addRuleBtn.style.padding = '6px 16px';
		addRuleBtn.style.whiteSpace = 'nowrap';

		addRuleBtn.onclick = async () => {
			const p = patternInput.value.trim();
			const g = groupInput.value.trim();
			if (p && g) {
				const newRule = `${p}:${g}`;
				const currentRules = this.plugin.settings.autoAddRules.split(';').filter(r => r.trim().length > 0);
				if (!currentRules.includes(newRule)) {
					currentRules.push(newRule);
					this.plugin.settings.autoAddRules = currentRules.join(';');
					await this.plugin.saveSettings();
					updateRulesList();
					patternInput.value = '';
					groupInput.value = '';
				}
			}
		};

		// Bottom controls in one row
		const controlsContainer = autoAddSection.createDiv();
		controlsContainer.style.display = 'flex';
		controlsContainer.style.gap = '20px';
		controlsContainer.style.alignItems = 'center';
		controlsContainer.style.justifyContent = 'space-between';
		controlsContainer.style.paddingTop = '12px';
		controlsContainer.style.marginTop = '12px';
		controlsContainer.style.borderTop = '1px solid var(--background-modifier-border)';
		
		// Run Now Button (no label, just button)
		const runNowSetting = new Setting(controlsContainer)
			.addButton(btn => btn
				.setButtonText(i18n.t('multiLevelAdaptation.runAutoAdd') || '立即刷新')
				.onClick(async () => {
					const count = await this.plugin.autoScanTagsToGroups();
					new Notice(i18n.t('messages.scanComplete').replace('{count}', count.toString()));
					this.display();
				}));
		runNowSetting.settingEl.style.border = 'none';
		runNowSetting.settingEl.style.padding = '0';
		runNowSetting.settingEl.style.justifyContent = 'flex-start';

		// Auto run on startup toggle
		const autoRunSetting = new Setting(controlsContainer)
			.setName(i18n.t('multiLevelAdaptation.autoAddOnStartup') || '启动时自动运行')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoAddTags)
				.onChange(async (value) => {
					this.plugin.settings.autoAddTags = value;
					await this.plugin.saveSettings();
				}));
		autoRunSetting.settingEl.style.border = 'none';
		autoRunSetting.settingEl.style.padding = '0';

		// 多级标签智能匹配配置
		const smartMatchSection = section.createDiv('tgm-smart-match-section');
		smartMatchSection.style.border = '1px solid var(--background-modifier-border)';
		smartMatchSection.style.borderRadius = '6px';
		smartMatchSection.style.padding = '16px';
		smartMatchSection.style.marginTop = '20px';
		smartMatchSection.style.backgroundColor = 'var(--background-secondary)';

		new Setting(smartMatchSection)
			.setName(i18n.t('multiLevelAdaptation.smartMatch.title') || '多级标签智能匹配')
			.setDesc(i18n.t('multiLevelAdaptation.smartMatch.desc') || '配合多级标签展开功能使用,自动将新出现的多级标签添加到对应的标签组中(仅处理未被添加的标签)')
			.setHeading();

		// 启用智能匹配
		new Setting(smartMatchSection)
			.setName(i18n.t('multiLevelAdaptation.smartMatch.enabled') || '启用智能匹配')
			.setDesc(i18n.t('multiLevelAdaptation.smartMatch.enabledDesc') || '启用后,新出现的多级标签将自动按层级匹配到对应的标签组')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.multiLevelAutoAdd.enabled)
				.onChange(async (value) => {
					this.plugin.settings.multiLevelAutoAdd.enabled = value;
					await this.plugin.saveSettings();
					this.display();
				}));

		if (this.plugin.settings.multiLevelAutoAdd.enabled) {
			// 当前匹配模式显示
			const modeContainer = smartMatchSection.createDiv('tgm-mode-container');
			modeContainer.style.marginTop = '10px';
			modeContainer.style.padding = '12px';
			modeContainer.style.backgroundColor = 'var(--background-primary)';
			modeContainer.style.borderRadius = '4px';
			modeContainer.style.border = '1px solid var(--background-modifier-border)';
			
			const currentMode = this.plugin.settings.multiLevelAutoAdd.matchMode;
			const expandDepth = this.plugin.settings.expandDepth;
			
			const modeTitle = modeContainer.createEl('div', { 
				text: i18n.t('multiLevelAdaptation.smartMatch.currentMode') || '当前匹配模式',
				cls: 'setting-item-name'
			});
			modeTitle.style.fontWeight = '600';
			modeTitle.style.marginBottom = '8px';
			
			const modeDesc = modeContainer.createEl('div');
			modeDesc.style.fontSize = '0.9em';
			modeDesc.style.color = 'var(--text-muted)';
			
			if (currentMode === 'level1') {
				modeDesc.innerHTML = `
					<div style="margin-bottom: 4px;">✓ <strong>level1模式</strong> - 按第一级匹配(适配${expandDepth}级展开)</div>
					<div style="margin-left: 16px; color: var(--text-faint);">示例: #前端/框架/React → 匹配"前端"组</div>
				`;
			} else {
				modeDesc.innerHTML = `
					<div style="margin-bottom: 4px;">✓ <strong>level2模式</strong> - 按第二级匹配(适配${expandDepth}级展开)</div>
					<div style="margin-left: 16px; color: var(--text-faint);">示例: #前端/框架/React → 匹配"框架"组</div>
				`;
			}
			
			const modeNote = modeContainer.createEl('div');
			modeNote.style.marginTop = '8px';
			modeNote.style.fontSize = '0.85em';
			modeNote.style.color = 'var(--text-muted)';
			modeNote.style.fontStyle = 'italic';
			modeNote.textContent = i18n.t('multiLevelAdaptation.smartMatch.modeNote') || '匹配模式根据展开深度自动设置,找不到匹配的标签组时不会添加';

			// 自动创建标签组选项
			new Setting(smartMatchSection)
				.setName(i18n.t('multiLevelAdaptation.smartMatch.createIfNotExists') || '自动创建标签组')
				.setDesc(i18n.t('multiLevelAdaptation.smartMatch.createIfNotExistsDesc') || '如果匹配的标签组不存在，是否自动创建（暂未实现）')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.multiLevelAutoAdd.createIfNotExists)
					.setDisabled(true) // 暂时禁用，未来版本实现
					.onChange(async (value) => {
						this.plugin.settings.multiLevelAutoAdd.createIfNotExists = value;
						await this.plugin.saveSettings();
					}));
		}

	}

	// 渲染颜色设置区域
	renderColorSettings(containerEl: HTMLElement): void {
		const colorSection = containerEl.createDiv('settings-section');
		new Setting(colorSection).setName(i18n.t('settings.tagColors')).setHeading();

		// Text Tag Styling (Moved here)
		new Setting(colorSection)
			.setName(i18n.t('settings.tagColors') || '标签颜色管理')
			.setDesc(i18n.t('multiLevelAdaptation.enableStylingDesc'))
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableTextTagStyling)
				.onChange(async (value) => {
					this.plugin.settings.enableTextTagStyling = value;
					await this.plugin.saveSettings();
					this.plugin.applyTextTagStyling();
				}));
		new Setting(colorSection).setName(i18n.t('settings.colorSettings') || '颜色设置').setHeading();

		// 添加自定义颜色功能开关
		new Setting(colorSection)
			.setName(i18n.t('settings.enableCustomColors'))
			.setDesc(i18n.t('settings.enableCustomColorsDesc'))
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableCustomColors)
				.onChange((value) => {
					this.plugin.settings.enableCustomColors = value;
					void this.saveSettingsAndRefreshDisplay();
				})
			);

		// 如果启用了自定义颜色，显示颜色配置界面
		if (this.plugin.settings.enableCustomColors) {
			// 添加单个标签颜色设置提示
			new Setting(colorSection)
				.setName(i18n.t('settings.singleTagColorSetting'))
				.setDesc(i18n.t('settings.singleTagColorSettingDesc'));

			this.renderColorMappingSettings(colorSection);
		}
	}

	// 渲染组集管理设置界面
	renderTagGroupSetSettings(containerEl: HTMLElement): void {
		const groupSetSection = containerEl.createDiv('settings-section');
		const header = new Setting(groupSetSection)
			.setName(i18n.t('tagGroupSets.title'))
			.setHeading();

		// 使用更显眼的按钮替代原来的加号图标
		const addBtn = header.controlEl.createEl('button', {
			text: i18n.t('tagGroupSets.addSet'),
			cls: 'mod-cta'
		});
		addBtn.addEventListener('click', () => {
			new TagGroupSetModal(this.plugin, null, async (newSet) => {
				this.plugin.settings.tagGroupSets.push(newSet);
				await this.saveSettingsAndRefreshDisplay();
				new Notice(i18n.t('tagGroupSets.setCreated'));
			}).open();
		});

		const setsContainer = groupSetSection.createDiv('tgm-group-sets-list');

		if (this.plugin.settings.tagGroupSets.length === 0) {
			setsContainer.createEl('div', {
				text: i18n.t('tagGroupSets.noSets'),
				cls: 'tgm-no-data'
			});
		} else {
			this.plugin.settings.tagGroupSets.forEach((set, index) => {
				const setItem = setsContainer.createDiv('tgm-group-set-item');
				// 样式将在 CSS 中定义

				const infoContainer = setItem.createDiv('tgm-group-set-info');

				// 1. 图标 (使用 setIcon 渲染真实图标)
				const iconSpan = infoContainer.createSpan({ cls: 'tgm-group-set-icon-preview' });
				setIcon(iconSpan, set.icon || 'home');

				// 2. 名称
				const nameSpan = infoContainer.createEl('strong', { text: set.name, cls: 'tgm-group-set-name' });

				// 3. 包含的标签组名称列表
				const groupNames = set.groupIds
					.map(id => this.plugin.settings.tagGroups.find(g => g.id === id)?.name)
					.filter(name => !!name)
					.join(', ');

				const groupsSpan = infoContainer.createSpan({
					text: groupNames ? `[${groupNames}]` : '[]',
					cls: 'tgm-group-set-groups-list'
				});

				const actionsContainer = setItem.createDiv('tgm-group-set-actions');

				// 编辑按钮
				new Setting(actionsContainer)
					.addExtraButton(btn => btn
						.setIcon('pencil')
						.setTooltip(i18n.t('tagGroupSets.editSet'))
						.onClick(() => {
							new TagGroupSetModal(this.plugin, set, async (updatedSet) => {
								this.plugin.settings.tagGroupSets[index] = updatedSet;
								await this.saveSettingsAndRefreshDisplay();
								new Notice(i18n.t('tagGroupSets.setUpdated'));
							}).open();
						}));

				// 删除按钮
				new Setting(actionsContainer)
					.addExtraButton(btn => btn
						.setIcon('trash')
						.setTooltip(i18n.t('tagGroupSets.deleteSet'))
						.onClick(async () => {
							if (confirm(i18n.t('tagGroupSets.confirmDelete'))) {
								this.plugin.settings.tagGroupSets.splice(index, 1);
								await this.saveSettingsAndRefreshDisplay();
								new Notice(i18n.t('tagGroupSets.setDeleted'));
							}
						}));
			});
		}
	}

	// 渲染全局标签重命名设置区域
	renderRenameSettings(containerEl: HTMLElement): void {
		const renameSection = containerEl.createDiv('settings-section');
		renameSection.style.padding = '20px';
		renameSection.style.marginBottom = '20px';
		
		// 标题
		new Setting(renameSection)
			.setName(i18n.t('rename.sectionTitle'))
			.setHeading();

		// 警告提示 - 更紧凑的样式
		const warningText = i18n.t('rename.warning');
		
		const warningEl = renameSection.createDiv('tgm-rename-warning');
		warningEl.style.padding = '8px 12px';
		warningEl.style.marginBottom = '16px';
		warningEl.style.backgroundColor = 'rgba(255, 100, 100, 0.15)';
		warningEl.style.border = '1px solid rgba(255, 100, 100, 0.3)';
		warningEl.style.borderRadius = '6px';
		warningEl.style.fontSize = '0.9em';
		warningEl.style.color = 'var(--text-normal)';
		warningEl.style.display = 'flex';
		warningEl.style.alignItems = 'center';
		warningEl.style.gap = '8px';
		
		const iconSpan = warningEl.createSpan();
		iconSpan.setText('⚠️');
		iconSpan.style.fontSize = '1.2em';
		
		const textSpan = warningEl.createSpan();
		textSpan.setText(warningText);
		textSpan.style.flex = '1';

		let oldTag = '';
		let newTag = '';
		let includeCanvas = false;

		// 输入区域容器 - 使用flex布局使其更紧凑
		const inputContainer = renameSection.createDiv('tgm-rename-inputs');
		inputContainer.style.display = 'flex';
		inputContainer.style.gap = '12px';
		inputContainer.style.marginBottom = '12px';
		inputContainer.style.flexWrap = 'wrap';

		// 旧标签名输入
		const oldTagContainer = inputContainer.createDiv();
		oldTagContainer.style.flex = '1';
		oldTagContainer.style.minWidth = '200px';
		new Setting(oldTagContainer)
			.setName(i18n.t('rename.oldTagName'))
			.setDesc(i18n.t('rename.oldTagNameDesc'))
			.addText(text => text
				.setPlaceholder(i18n.t('rename.oldTagName'))
				.onChange(async (value) => {
					oldTag = value;
				}));

		// 新标签名输入
		const newTagContainer = inputContainer.createDiv();
		newTagContainer.style.flex = '1';
		newTagContainer.style.minWidth = '200px';
		new Setting(newTagContainer)
			.setName(i18n.t('rename.newTagName'))
			.setDesc(i18n.t('rename.newTagNameDesc'))
			.addText(text => text
				.setPlaceholder(i18n.t('rename.newTagName'))
				.onChange(async (value) => {
					newTag = value;
				}));

		// Canvas选项和按钮容器 - 放在同一行
		const actionContainer = renameSection.createDiv('tgm-rename-actions');
		actionContainer.style.display = 'flex';
		actionContainer.style.alignItems = 'center';
		actionContainer.style.gap = '16px';
		actionContainer.style.marginTop = '12px';

		// Canvas选项
		const canvasToggleContainer = actionContainer.createDiv();
		canvasToggleContainer.style.flex = '1';
		new Setting(canvasToggleContainer)
			.setName(i18n.t('rename.includeCanvas'))
			.setDesc(i18n.t('rename.includeCanvasDesc'))
			.addToggle(toggle => toggle
				.setValue(false)
				.onChange(async (value) => {
					includeCanvas = value;
				}));

		// 重命名按钮
		const buttonContainer = actionContainer.createDiv();
		new Setting(buttonContainer)
			.addButton(btn => btn
				.setButtonText(i18n.t('rename.button'))
				.setCta()
				.onClick(async () => {
					if (!oldTag || !newTag) {
						new Notice(i18n.t('rename.warning'));
						return;
					}
					new TagRenamer(this.app, this.plugin).renameTag(oldTag, newTag, includeCanvas);
				}));
	}

	// 渲染标签组设置区域
	renderTagGroupSettings(containerEl: HTMLElement): void {
		const tagGroupSection = containerEl.createDiv('settings-section');
		new Setting(tagGroupSection).setName(i18n.t('settings.tagGroupSettings') || '标签组管理').setHeading();

		// 添加新标签组的按钮
		new Setting(tagGroupSection)
			.setName(i18n.t('settings.addGroup'))
			.setDesc(i18n.t('settings.enterGroupName'))
			.addButton(cb => cb
				.setButtonText(i18n.t('settings.addGroup'))
				.onClick(() => {
					this.plugin.settings.tagGroups.push({
						name: i18n.t('settings.groupName'),
						tags: []
					});
					void this.saveSettingsAndRefreshDisplay();
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

			groupNameInput.addEventListener('change', () => {
				this.plugin.settings.tagGroups[index].name = groupNameInput.value;
				void this.plugin.saveSettings().catch(err => {
					console.error("Failed to save settings:", err);
					new Notice("Failed to save settings.");
				});
			});

			// 添加批量设置颜色按钮（仅在启用自定义颜色时显示）
			if (this.plugin.settings.enableCustomColors) {
				const setGroupColorBtn = groupHeaderContainer.createEl('button', {
					text: '🎨',
					cls: 'tgm-set-group-color-btn'
				});
				setGroupColorBtn.setAttribute('aria-label', i18n.t('settings.setGroupColor'));

				setGroupColorBtn.onclick = () => {
					// 确保customColors已初始化
					if (!this.plugin.settings.customColors || !Array.isArray(this.plugin.settings.customColors) || this.plugin.settings.customColors.length !== 7) {
						this.plugin.settings.customColors = ['', '', '', '', '', '', ''];
					}

					// 打开颜色选择器
					new ColorPickerModal(this.app, this.plugin, '', (color) => {
						if (!color) {
							new Notice(i18n.t('settings.pleaseSelectColor'));
							return;
						}

						// 为该组的所有标签设置颜色
						const tagCount = group.tags.length;
						group.tags.forEach(tag => {
							this.plugin.settings.tagColors[tag] = color;
						});

						void this.plugin.saveSettings().then(() => {
							// 显示成功消息
							const message = i18n.t('settings.groupColorApplied')
								.replace('{count}', tagCount.toString())
								.replace('{groupName}', group.name);
							new Notice(message);
							// 刷新显示
							this.display();
						});
					}).open();
				};
			}

			const deleteGroupBtn = groupHeaderContainer.createEl('button', {
				text: i18n.t('settings.deleteGroup'),
				cls: 'tgm-delete-group-btn'
			});

			deleteGroupBtn.onclick = () => {
				this.plugin.settings.tagGroups.splice(index, 1);
				void this.saveSettingsAndRefreshDisplay();
			};

			// 显示现有标签
			const tagsList = tagsContainer.createDiv('tgm-tags-list');
			group.tags.forEach((tag, tagIndex) => {
				const tagEl = tagsList.createDiv('tgm-tag-item');

				// 应用颜色（如果启用且有颜色设置）
				if (this.plugin.settings.enableCustomColors) {
					const customColor = getTagColor(tag, this.plugin.settings);
					if (customColor) {
						const isRainbowColor = customColor.startsWith('var(--color-');
						if (isRainbowColor) {
							tagEl.addClass('tag-group-manager-rainbow-tag');
							tagEl.setAttribute('data-color', customColor);
						} else {
							tagEl.addClass('tgm-custom-color-tag');
							const colorClass = getColorClass(customColor);
							if (colorClass) {
								tagEl.addClass(colorClass);
							} else {
								// 对于自定义颜色，使用类似彩虹目录的渐变效果
								const hexToRgb = (hex: string) => {
									const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
									return result ? {
										r: parseInt(result[1], 16),
										g: parseInt(result[2], 16),
										b: parseInt(result[3], 16)
									} : null;
								};

								const rgb = hexToRgb(customColor);
								if (rgb) {
									const bgColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.08)`;
									const textColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.85)`;
									const borderColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`;

									tagEl.style.setProperty('background', `linear-gradient(145deg, ${bgColor}, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.06))`, 'important');
									tagEl.style.setProperty('color', textColor, 'important');
									tagEl.style.setProperty('border-color', borderColor, 'important');
								}
							}
							tagEl.addClass('custom-colored-tag');
						}
					} else {
						// 开启颜色映射但未设置特定颜色时，使用默认的彩虹风格渐变
						const defaultRgb = { r: 148, g: 163, b: 184 };
						const bgColor = `rgba(${defaultRgb.r}, ${defaultRgb.g}, ${defaultRgb.b}, 0.08)`;
						const textColor = `rgba(${defaultRgb.r}, ${defaultRgb.g}, ${defaultRgb.b}, 0.85)`;
						const borderColor = `rgba(${defaultRgb.r}, ${defaultRgb.g}, ${defaultRgb.b}, 0.15)`;

						tagEl.style.setProperty('background', `linear-gradient(145deg, ${bgColor}, rgba(${defaultRgb.r}, ${defaultRgb.g}, ${defaultRgb.b}, 0.06))`, 'important');
						tagEl.style.setProperty('color', textColor, 'important');
						tagEl.style.setProperty('border-color', borderColor, 'important');
						tagEl.addClass('tgm-default-rainbow-tag');
					}
				}

				const tagText = tagEl.createSpan('tgm-tag-text');

				// 检查是否为嵌套标签并添加图标
				let displayText = `#${tag}`;
				const isMultiLevelTag = tag.includes('/');
				
				if (isMultiLevelTag) {
					// 添加lucide tags图标
					const iconEl = tagText.createSpan('tgm-tag-icon');
					setIcon(iconEl, 'tags');
					displayText = ` #${tag}`;
					tagText.addClass('nested-tag');
				}

				tagText.appendText(displayText);

				// 设置 Tooltip - 所有标签都显示 tooltip
				// 在设置页面中，tooltip 可以帮助用户更清晰地看到完整路径
				tagEl.setAttribute('aria-label', `#${tag}`);

				// 添加点击事件打开颜色选择器
				if (this.plugin.settings.enableCustomColors) {
					tagEl.addClass('tgm-tag-clickable');
					tagEl.addEventListener('click', (e) => {
						// 如果点击的是删除按钮，不打开颜色选择器
						if ((e.target as HTMLElement).hasClass('tgm-tag-delete-btn')) {
							return;
						}

						// 确保customColors已初始化
						if (!this.plugin.settings.customColors || !Array.isArray(this.plugin.settings.customColors) || this.plugin.settings.customColors.length !== 7) {
							this.plugin.settings.customColors = ['', '', '', '', '', '', ''];
						}

						const currentColor = this.plugin.settings.tagColors[tag] || '';
						new ColorPickerModal(this.app, this.plugin, currentColor, (color) => {
							// 保存颜色
							this.plugin.settings.tagColors[tag] = color;
							void this.plugin.saveSettings();
							// 刷新显示
							this.display();
						}).open();
					});
				}

				const deleteBtn = tagEl.createSpan('tgm-tag-delete-btn');
				deleteBtn.setText('✕');
				deleteBtn.addEventListener('click', (e) => {
					e.stopPropagation(); // 阻止冒泡到标签点击事件
					this.plugin.settings.tagGroups[index].tags.splice(tagIndex, 1);
					// 同时删除该标签的颜色设置
					if (this.plugin.settings.tagColors[tag]) {
						delete this.plugin.settings.tagColors[tag];
					}
					void this.saveSettingsAndRefreshDisplay();
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
			batchFilterBtn.addEventListener('click', () => {
				void (() => {
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
								const isMultiLevelTag = tag.includes('/');
								
								if (isMultiLevelTag) {
									// 添加lucide tags图标
									const iconEl = tagTextEl.createSpan('tgm-tag-icon');
									setIcon(iconEl, 'tags');
									displayText = ` ${tag}`;
									tagTextEl.addClass('nested-tag');
								}

								tagTextEl.appendText(displayText);

								// 设置 Tooltip - 所有标签都显示 tooltip
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
						batchFilterBtn.onclick = (e) => {
							void (async () => {
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
							})();
						};
					}
				})();
			});

			// 创建标签库浮动区域
			const tagLibraryContainer = popupContainer.createDiv('tag-library-container');
			tagLibraryContainer.addClass('tgm-display-none');

			// 从标签库添加按钮点击事件
			addFromLibraryBtn.addEventListener('click', () => {
				void (() => {
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
							const isMultiLevelTag = tag.includes('/');
							
							if (isMultiLevelTag) {
								// 添加lucide tags图标
								const iconEl = tagTextEl.createSpan('tgm-tag-icon');
								setIcon(iconEl, 'tags');
								displayText = ` ${tag}`;
								tagTextEl.addClass('nested-tag');
							}

							tagTextEl.appendText(displayText);

							// 设置 Tooltip - 所有标签都显示 tooltip
							tagEl.setAttribute('aria-label', tag);

							tagEl.addEventListener('click', () => {
								// 添加标签到组
								if (!this.plugin.settings.tagGroups[index].tags.includes(tag)) {
									this.plugin.settings.tagGroups[index].tags.push(tag);
									void (async () => {
										try {
											await this.plugin.saveSettings();
											tagEl.addClass('selected');
										} catch (err) {
											console.error("Failed to save settings:", err);
											new Notice("Failed to save settings.");
										}
									})();
								}
							});
						});
					}
				})();
			});

			// 验证标签是否符合语法规则的函数
			const isValidTag = (tag: string): boolean => {
				// 检查标签是否以.开头或包含其他不符合语法的字符
				return !!tag && tag.length > 0 && !/^\.|[\s\](){}<>#:;,"?=+`~!@$%^&*]/.test(tag);
			};

			addTagBtn.addEventListener('click', () => {
				const tagValue = addTagInput.value.trim();

				// 验证标签是否符合语法规则
				if (!isValidTag(tagValue)) {
					new Notice(i18n.t('messages.invalidTagName') + ': ' + tagValue);
					return;
				}

				if (tagValue && !this.plugin.settings.tagGroups[index].tags.includes(tagValue)) {
					this.plugin.settings.tagGroups[index].tags.push(tagValue);
					addTagInput.value = '';
					void this.saveSettingsAndRefreshDisplay();
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
		// 创建批量颜色操作区域
		const batchSection = containerEl.createDiv('color-mapping-subsection');
		new Setting(batchSection)
			.setName(i18n.t('settings.batchColorOperation'))
			.setDesc(i18n.t('settings.batchColorOperationDesc'))
			.setHeading();

		// 创建紧凑的单行操作区域
		const batchContainer = batchSection.createDiv('tgm-batch-color-container');

		// 存储当前选中的颜色
		let selectedColor = '';

		// 正则表达式输入框
		const patternInput = batchContainer.createEl('input', {
			type: 'text',
			placeholder: i18n.t('settings.regexPatternPlaceholder'),
			cls: 'tgm-batch-pattern-input'
		});

		// 颜色选择框（可点击）
		const colorBox = batchContainer.createDiv('tgm-batch-color-box');
		colorBox.style.backgroundColor = '#888888'; // 默认灰色

		colorBox.addEventListener('click', () => {
			// 打开颜色选择器
			new ColorPickerModal(
				this.app,
				this.plugin,
				selectedColor || '#3b82f6',
				(color: string) => {
					selectedColor = color;
					// 更新颜色框显示
					if (color.startsWith('var(--color-')) {
						// 预设颜色，使用对应的RGB值作为预览
						const presetMap: { [key: string]: string } = {
							'var(--color-red)': '#e74c3c',
							'var(--color-blue)': '#3498db',
							'var(--color-green)': '#2ecc71',
							'var(--color-orange)': '#f39c12',
							'var(--color-purple)': '#9b59b6',
							'var(--color-cyan)': '#1abc9c',
							'var(--color-pink)': '#e91e63'
						};
						colorBox.style.backgroundColor = presetMap[color] || color;
					} else {
						colorBox.style.backgroundColor = color;
					}
				}
			).open();
		});

		// 应用颜色按钮
		const applyBtn = batchContainer.createEl('button', {
			text: i18n.t('settings.applyColor'),
			cls: 'mod-cta tgm-batch-apply-btn'
		});

		applyBtn.addEventListener('click', async () => {
			const pattern = patternInput.value.trim();

			if (!pattern) {
				new Notice(i18n.t('settings.pleaseEnterPattern'));
				return;
			}

			if (!selectedColor) {
				new Notice(i18n.t('settings.pleaseSelectColor'));
				return;
			}

			// 获取所有标签组中的标签
			const allTagsSet = new Set<string>();
			this.plugin.settings.tagGroups.forEach(group => {
				group.tags.forEach(tag => {
					allTagsSet.add(tag);
				});
			});
			const allTags = Array.from(allTagsSet);


			// 匹配标签
			let matchedTags: string[] = [];
			try {
				const regex = new RegExp(pattern);
				matchedTags = allTags.filter(tag => regex.test(tag));
			} catch (e) {
				// 如果不是有效的正则表达式，则作为普通字符串匹配
				matchedTags = allTags.filter(tag => tag.includes(pattern));
			}

			if (matchedTags.length === 0) {
				new Notice(i18n.t('settings.noMatchingTags'));
				return;
			}

			// 应用颜色到匹配的标签
			matchedTags.forEach(tag => {
				const existingIndex = this.plugin.settings.tagColorMappings.findIndex(
					m => m.pattern === tag && !m.isRegex
				);

				if (existingIndex >= 0) {
					// 更新现有映射
					this.plugin.settings.tagColorMappings[existingIndex].color = selectedColor;
					this.plugin.settings.tagColorMappings[existingIndex].enabled = true;
				} else {
					// 添加新映射
					this.plugin.settings.tagColorMappings.push({
						pattern: tag,
						color: selectedColor,
						isRegex: false,
						enabled: true
					});
				}
			});

			await this.saveSettingsAndRefreshDisplay();
			new Notice(i18n.t('settings.colorAppliedSuccess').replace('{count}', matchedTags.length.toString()));

			// 清空输入框
			patternInput.value = '';
			selectedColor = '';
			colorBox.style.backgroundColor = '#888888';
		});

		// 清除颜色按钮
		const clearBtn = batchContainer.createEl('button', {
			text: i18n.t('settings.clearColor'),
			cls: 'tgm-batch-clear-btn'
		});

		clearBtn.addEventListener('click', async () => {
			const pattern = patternInput.value.trim();

			if (!pattern) {
				new Notice(i18n.t('settings.pleaseEnterPattern'));
				return;
			}

			// 获取所有标签组中的标签
			const allTagsSet = new Set<string>();
			this.plugin.settings.tagGroups.forEach(group => {
				group.tags.forEach(tag => {
					allTagsSet.add(tag);
				});
			});
			const allTags = Array.from(allTagsSet);


			// 匹配标签
			let matchedTags: string[] = [];
			try {
				const regex = new RegExp(pattern);
				matchedTags = allTags.filter(tag => regex.test(tag));
			} catch (e) {
				// 如果不是有效的正则表达式，则作为普通字符串匹配
				matchedTags = allTags.filter(tag => tag.includes(pattern));
			}

			if (matchedTags.length === 0) {
				new Notice(i18n.t('settings.noMatchingTags'));
				return;
			}

			// 移除匹配标签的所有映射
			const originalLength = this.plugin.settings.tagColorMappings.length;
			this.plugin.settings.tagColorMappings = this.plugin.settings.tagColorMappings.filter(
				m => !matchedTags.includes(m.pattern)
			);
			const removedCount = originalLength - this.plugin.settings.tagColorMappings.length;

			await this.saveSettingsAndRefreshDisplay();
			new Notice(i18n.t('settings.colorClearedSuccess').replace('{count}', removedCount.toString()));

			// 清空输入框
			patternInput.value = '';
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
			presetColors.forEach((color) => {
				dropdown.addOption(color.value, color.name);
			});

			// 设置当前值
			const currentPreset = presetColors.find(color => color.value === mapping.color);
			dropdown.setValue(currentPreset ? currentPreset.value : '');

			dropdown.onChange((value) => {
				if (value) {
					// 选择了预设颜色
					this.plugin.settings.tagColorMappings[index].color = value;
				} else {
					// 选择了自定义颜色，使用默认颜色
					this.plugin.settings.tagColorMappings[index].color = '#3b82f6';
				}
				void this.saveSettingsAndRefreshDisplay();
			});
		});

		// 只有在选择自定义颜色时才显示颜色选择器
		const isCustomColor = !presetColors.some(color => color.value === mapping.color);
		if (isCustomColor) {
			setting.addColorPicker(color => color
				.setValue(mapping.color)
				.onChange((value) => {
					this.plugin.settings.tagColorMappings[index].color = value;
					void this.plugin.saveSettings().catch(err => {
						console.error("Failed to save settings:", err);
						new Notice("Failed to save settings.");
					});
				}));
		}
	}
}

// 标签组视图
class TagGroupView extends ItemView {
	plugin: TagGroupManagerPlugin;
	private groupSortable: Sortable;
	private tagSortables: Sortable[] = [];
	public isInsertMode: boolean = false; // Changed to public to allow access from HierarchyBoard

	constructor(leaf: WorkspaceLeaf, plugin: TagGroupManagerPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.icon = 'star';
	}

	getViewType(): string {
		return TAG_GROUP_VIEW;
	}

	getDisplayText(): string {
		return i18n.t('overview.title');
	}

	onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		container.empty();
		this.renderTagGroups();
		return Promise.resolve();
	}


	currentGroupSetId: string | null = null;

	renderTagGroups() {
		const container = this.containerEl.children[1];
		container.empty();

		// 1. 确定要渲染的标签组
		let groupsToRender: TagGroup[] = [];
		let activeSet: TagGroupSet | undefined;

		if (this.currentGroupSetId) {
			activeSet = this.plugin.settings.tagGroupSets.find(s => s.id === this.currentGroupSetId);
			if (activeSet) {
				// 按照 set.groupIds 的顺序渲染
				groupsToRender = activeSet.groupIds
					.map(id => this.plugin.settings.tagGroups.find(g => g.id === id))
					.filter((g): g is TagGroup => !!g);
			} else {
				// 如果找不到组集，回退到默认视图
				this.currentGroupSetId = null;
				groupsToRender = this.plugin.settings.tagGroups;
			}
		} else {
			groupsToRender = this.plugin.settings.tagGroups;
		}

		// 不再需要顶部标题栏，直接通过点击标签组名称切换模式

		// 创建标签组容器
		const groupContainer = container.createDiv('tag-group-container');

		// 渲染标签组
		groupsToRender.forEach((group, localIndex) => {
			// 获取在全局数组中的索引，用于后续的数据操作
			const globalIndex = this.plugin.settings.tagGroups.indexOf(group);

			const groupEl = groupContainer.createDiv('tag-group-item');
			// 关键：这里必须存储全局索引，因为 tagSortables 的逻辑依赖于它来定位数据
			groupEl.setAttribute('data-group-index', globalIndex.toString());

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

			// ==================== 新增：组集切换按钮 ====================

			const switcherBtn = nameContainer.createDiv('tgm-group-set-switcher');
			// 设置样式类，稍后在CSS中调整位置
			const iconName = activeSet ? activeSet.icon : 'home';
			setIcon(switcherBtn, iconName);
			switcherBtn.setAttribute('aria-label', activeSet ? activeSet.name : i18n.t('tagGroupSets.title'));

			switcherBtn.onclick = (e) => {
				e.stopPropagation();
				const menu = new Menu();

				// 1. 总览 (Home)
				menu.addItem(item => item
					.setTitle(i18n.t('tagGroupSets.title'))
					.setIcon('home')
					.setChecked(this.currentGroupSetId === null)
					.onClick(() => {
						this.currentGroupSetId = null;
						this.renderTagGroups();
					}));

				menu.addSeparator();

				// 2. 所有组集
				this.plugin.settings.tagGroupSets.forEach(set => {
					menu.addItem(item => item
						.setTitle(set.name)
						.setIcon(set.icon)
						.setChecked(this.currentGroupSetId === set.id)
						.onClick(() => {
							this.currentGroupSetId = set.id;
							this.renderTagGroups();
						}));
				});

				menu.showAtMouseEvent(e);
			};
			// ==========================================================

			// 创建标签容器
			const tagsContainer = groupEl.createDiv('tags-view-container');

			// 过滤掉自动展开的叶子节点（末节点）- 这些节点只在设置页面显示
			// 手动添加的标签不会被过滤
			const minDepth = getGroupExpandDepth(group, this.plugin.settings.tagGroupSets);
			const filteredTags = group.tags.filter(tag => !shouldHideTag(tag, group.tags, group.autoExpandedTags, minDepth));

			// 渲染标签
			filteredTags.forEach(tag => {

				const tagEl = tagsContainer.createDiv('tgm-tag-item');
				tagEl.setAttribute('data-tag', tag);

				// 创建标签文本容器
				const tagTextEl = tagEl.createDiv('tgm-tag-text');

				// 检查是否为嵌套标签并添加图标
				let displayText = tag;
				const isMultiLevelTag = tag.includes('/');
				
				if (isMultiLevelTag) {
					// 添加lucide tags图标
					const iconEl = tagTextEl.createSpan('tgm-tag-icon');
					setIcon(iconEl, 'tags');
					// Show shortened name (leaf)
					displayText = ` ${tag.split('/').pop()}`;
					tagTextEl.addClass('nested-tag');
				}

				tagTextEl.appendText(displayText);

				// Add Hierarchy Board Trigger - 仅用于多级标签
				if (isMultiLevelTag) {
					const triggerEl = tagEl.createDiv('tgm-hierarchy-trigger');
					triggerEl.setText('>>');
					triggerEl.removeAttribute('aria-label');

					// Hover to show (ephemeral)
					triggerEl.addEventListener('mouseenter', (e) => {
						const rect = triggerEl.getBoundingClientRect();
						this.plugin.hierarchyBoard.show(tag, rect, false, this); // false = not pinned
					});

					triggerEl.addEventListener('mouseleave', (e) => {
						this.plugin.hierarchyBoard.hide(200);
					});

					triggerEl.addEventListener('mousedown', (e) => {
						e.stopPropagation();
					});

					// Click to PIN
					triggerEl.addEventListener('click', (e) => {
						e.stopPropagation();
						e.stopImmediatePropagation();
						e.preventDefault();
						const rect = triggerEl.getBoundingClientRect();
						this.plugin.hierarchyBoard.show(tag, rect, true, this); // true = pinned
					});
				}

				// 设置 Tooltip - 仅用于非多级标签
				// 多级标签通过 hierarchy board 查看完整路径，不需要 tooltip
				if (!isMultiLevelTag) {
					tagTextEl.setAttribute('aria-label', tag);
				}

				// 应用自定义颜色（如果启用且有匹配的颜色映射）
				if (this.plugin.settings.enableCustomColors) {
					const customColor = getTagColor(tag, this.plugin.settings);
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
								// 对于自定义颜色，使用类似彩虹目录的渐变效果
								const hexToRgb = (hex: string) => {
									const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
									return result ? {
										r: parseInt(result[1], 16),
										g: parseInt(result[2], 16),
										b: parseInt(result[3], 16)
									} : null;
								};

								const rgb = hexToRgb(customColor);
								if (rgb) {
									// 排序模式使用淡渐变(0.06)，插入模式使用深渐变(0.5)
									const gradientEnd = this.isInsertMode ? 0.5 : 0.06;
									const bgColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.08)`;
									const textColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.85)`;
									const borderColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`;

									tagEl.style.setProperty('background', `linear-gradient(145deg, ${bgColor}, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${gradientEnd}))`, 'important');
									tagEl.style.setProperty('color', textColor, 'important');
									tagEl.style.setProperty('border-color', borderColor, 'important');

									// 在插入模式下，为 hover 效果添加动态 box-shadow
									if (this.isInsertMode) {
										tagEl.style.setProperty('--custom-shadow-color', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`);
									}
								}
							}

							tagEl.addClass('custom-colored-tag');
						}
					} else {
						// 开启颜色映射但未设置特定颜色时，使用默认的彩虹风格渐变
						const defaultRgb = { r: 148, g: 163, b: 184 };
						// 排序模式使用淡渐变(0.06)，插入模式使用深渐变(0.5)
						const gradientEnd = this.isInsertMode ? 0.5 : 0.06;
						const bgColor = `rgba(${defaultRgb.r}, ${defaultRgb.g}, ${defaultRgb.b}, 0.08)`;
						const textColor = `rgba(${defaultRgb.r}, ${defaultRgb.g}, ${defaultRgb.b}, 0.85)`;
						const borderColor = `rgba(${defaultRgb.r}, ${defaultRgb.g}, ${defaultRgb.b}, 0.15)`;

						tagEl.style.setProperty('background', `linear-gradient(145deg, ${bgColor}, rgba(${defaultRgb.r}, ${defaultRgb.g}, ${defaultRgb.b}, ${gradientEnd}))`, 'important');
						tagEl.style.setProperty('color', textColor, 'important');
						tagEl.style.setProperty('border-color', borderColor, 'important');
						tagEl.addClass('tgm-default-rainbow-tag');
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

						// 提前捕获 cm-editor 引用（Canvas 在点击后可能丢失焦点）
						const capturedCmEditor = activeElement?.closest('.cm-editor') as HTMLElement | null;

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

						// 检查是否是 Live Preview 的元数据属性编辑区域 (Properties view)
						const isMetadataInput = activeElement && activeElement.closest('.metadata-container');

						// 如果是输入框但不是Markdown编辑器，使用统一的插入规则
						// 对 Metadata 区域也使用此规则
						if ((isInputElement && !isMarkdownEditor) || (isMetadataInput && isInputElement)) {
							// 如果是 Metadata 区域，我们需要使用 select 之前的文本，因为 metadata input 可能是特殊的
							if (isMetadataInput) {
								// 尝试触发 Enter 来确认为一个标签
								// 对于属性面板中的 tags，通常需要输入文本后按 Enter 才能生成标签块
								const tagText = tag;
								if (activeElement.contentEditable === 'true' || activeElement.tagName === 'INPUT') {
									// 1. 插入文本
									document.execCommand('insertText', false, tagText);

									// 2. 模拟 Enter 键，触发 Obsidian 将文本转换为标签块
									activeElement.dispatchEvent(new KeyboardEvent('keydown', {
										key: 'Enter',
										code: 'Enter',
										keyCode: 13,
										which: 13,
										bubbles: true,
										cancelable: true,
										view: window
									}));

									activeElement.dispatchEvent(new KeyboardEvent('keypress', {
										key: 'Enter',
										code: 'Enter',
										keyCode: 13,
										which: 13,
										bubbles: true,
										cancelable: true,
										view: window
									}));

									activeElement.dispatchEvent(new KeyboardEvent('keyup', {
										key: 'Enter',
										code: 'Enter',
										keyCode: 13,
										which: 13,
										bubbles: true,
										cancelable: true,
										view: window
									}));

									return;
								}
							}

							const inputElement = activeElement as HTMLInputElement | HTMLTextAreaElement;

							// 如果是输入框但不是Markdown编辑器，使用统一的插入规则
							// (这里的判断是多余的，已经在上面判断过了，但为了保持逻辑清晰，保留结构)

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
						// 尝试获取当前活动的编辑器
						let editor = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
						console.log('[TGM Debug] Tag clicked, MarkdownView editor:', editor ? 'found' : 'not found');

						// 如果不是 MarkdownView，尝试从 activeEditor 获取 (支持 Canvas)
						if (!editor) {
							// @ts-ignore - activeEditor is available in newer Obsidian versions
							editor = this.app.workspace.activeEditor?.editor;
							console.log('[TGM Debug] activeEditor:', editor ? 'found' : 'not found');
						}

						if (!editor) {
							// 尝试从最近的 leaf 获取编辑器（当从侧边栏点击时需要）
							const recentLeaf = this.app.workspace.getMostRecentLeaf();
							const leafView = recentLeaf?.view;
							const viewType = leafView?.getViewType();
							console.log('[TGM Debug] recentLeaf viewType:', viewType);

							// 检查是否是 Markdown 视图
							if (leafView && viewType === 'markdown') {
								editor = (leafView as MarkdownView).editor;
								console.log('[TGM Debug] Got editor from recentLeaf markdown view:', editor ? 'found' : 'not found');
							}
						}

						// 如果仍然没有编辑器，尝试 Canvas 视图的特殊处理
						if (!editor) {
							const recentLeaf = this.app.workspace.getMostRecentLeaf();
							const leafView = recentLeaf?.view;
							const viewType = leafView?.getViewType();

							// 检查是否是 Canvas 视图
							if (leafView && viewType === 'canvas') {
								const canvasContainer = leafView.containerEl;

								// 检查 activeElement 是否是 iframe（嵌入的 Markdown 文件）
								if (activeElement && activeElement.tagName === 'IFRAME') {
									try {
										const iframe = activeElement as HTMLIFrameElement;
										const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

										if (iframeDoc) {
											const iframeCmEditor = iframeDoc.querySelector('.cm-editor') as HTMLElement | null;

											if (iframeCmEditor) {
												const cmContent = iframeCmEditor.querySelector('.cm-content') as HTMLElement | null;
												if (cmContent) {
													cmContent.focus();
													const tagText = `#${tag} `;
													iframeDoc.execCommand('insertText', false, tagText);
													return;
												}
											}
										}
									} catch (e) {
										// 静默处理 iframe 访问错误
									}
								}

								// 在 Canvas 视图中查找当前焦点的 cm-editor
								const focusedCmEditor = canvasContainer?.querySelector('.cm-editor.cm-focused') as HTMLElement | null;

								if (focusedCmEditor) {
									const cmContent = focusedCmEditor.querySelector('.cm-content') as HTMLElement | null;
									if (cmContent) {
										cmContent.focus();
										const tagText = `#${tag} `;
										document.execCommand('insertText', false, tagText);
										return;
									}
								}

								// 如果没有焦点编辑器，尝试找任何正在编辑的卡片
								const anyCmEditor = canvasContainer?.querySelector('.cm-editor') as HTMLElement | null;
								if (anyCmEditor) {
									const cmContent = anyCmEditor.querySelector('.cm-content') as HTMLElement | null;
									if (cmContent) {
										cmContent.focus();
										const tagText = `#${tag} `;
										document.execCommand('insertText', false, tagText);
										return;
									}
								}
							}

							// 使用提前捕获的 cm-editor 引用（备用方案）
							if (capturedCmEditor) {
								const cmContent = capturedCmEditor.querySelector('.cm-content') as HTMLElement | null;
								if (cmContent) {
									cmContent.focus();
									const tagText = `#${tag} `;
									document.execCommand('insertText', false, tagText);
									return;
								}
							}

							// 如果是其他 contenteditable 区域，使用 execCommand 插入
							if (activeElement && activeElement.contentEditable === 'true') {
								const selection = document.getSelection();
								if (selection && selection.rangeCount > 0) {
									const range = selection.getRangeAt(0);
									const textNode = range.startContainer;
									const offset = range.startOffset;

									// 简单的上下文检查 (尝试获取光标前的字符)
									let charBefore = '';
									if (textNode.nodeType === Node.TEXT_NODE) {
										const text = textNode.textContent || '';
										if (offset > 0) {
											charBefore = text[offset - 1];
										}
									}

									const prefix = (charBefore && charBefore !== ' ' && charBefore !== '\n' && charBefore.trim() !== '') ? ' ' : '';
									const tagText = `${prefix}#${tag} `;

									document.execCommand('insertText', false, tagText);
									return;
								}
							}

							new Notice(i18n.t('messages.openMarkdownFirst') || "请先打开一个 Markdown 文档并将光标放置在插入位置");
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
							if (i === 0 && lines[i].trim() === '---') {
								yamlStart = true;
								continue;
							}
							if (yamlStart && lines[i].trim() === '---') {
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
						console.log(`[TGM YAML Debug] cursor.line=${cursor.line}, yamlStart=${yamlStart}, yamlEnd=${yamlEnd}, isInYaml=${isInYaml}, yamlTagLine=${yamlTagLine}`);
						console.log(`[TGM YAML Debug] lines[0]='${lines[0]}', lines.length=${lines.length}`);
						let newCursor;
						let tagText = '';
						if (isInYaml) {
							// 在YAML区域内使用YAML格式
							if (yamlTagLine === -1) {
								// 如果没有tags标签，创建一个
								editor.replaceRange('tags:\n  - ' + tag + '\n', cursor);
								newCursor = { line: cursor.line + 1, ch: ('  - ' + tag).length };
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
								newCursor = { line: lastTagLine + 1, ch: ('  - ' + tag).length };
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
					});
				}
			});

			// 在非插入模式下创建Sortable实例
			if (!this.isInsertMode) {
				this.tagSortables.push(
					Sortable.create(tagsContainer, {
						group: 'tags',
						animation: 150,
						onEnd: (evt: Sortable.SortableEvent) => {
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

							void this.plugin.saveSettings().catch(err => {
								console.error("Failed to save settings:", err);
								new Notice("Failed to save settings.");
							});
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
				onEnd: () => {
					// 更新组的顺序

					// 1. 获取当前DOM中的组ID顺序
					const newOrderIds: string[] = [];
					groupContainer.querySelectorAll('.tag-group-item').forEach((el) => {
						const index = parseInt(el.getAttribute('data-group-index') || '-1');
						if (index >= 0 && this.plugin.settings.tagGroups[index]) {
							const group = this.plugin.settings.tagGroups[index];
							if (group.id) newOrderIds.push(group.id);
						}
					});

					if (this.currentGroupSetId && activeSet) {
						// 2. 如果在组集模式下，只更新该组集的 groupIds
						activeSet.groupIds = newOrderIds;
					} else {
						// 3. 如果在总览模式下，更新全局 tagGroups
						const newGroups: TagGroup[] = [];
						groupContainer.querySelectorAll('.tag-group-item').forEach((el) => {
							const index = parseInt(el.getAttribute('data-group-index') || '0');
							newGroups.push(this.plugin.settings.tagGroups[index]);
						});
						this.plugin.settings.tagGroups = newGroups;
					}

					void this.plugin.saveSettings().catch(err => {
						console.error("Failed to save settings:", err);
						new Notice("Failed to save settings.");
					});
				}
			});
		}
	}

	onClose(): Promise<void> {
		// 清理Sortable实例
		if (this.groupSortable) {
			this.groupSortable.destroy();
		}
		this.tagSortables.forEach(sortable => sortable.destroy());
		this.tagSortables = [];
		return Promise.resolve();
	}
}




