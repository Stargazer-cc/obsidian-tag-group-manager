# Tag Group Manager

![GitHub all releases](https://img.shields.io/github/downloads/stargazer-cc/obsidian-tag-group-manager/total?color=success)

- [English](https://github.com/Stargazer-cc/addtags/blob/main/README-EN.md)   

- 更详细的介绍 [前往Obsidian中文论坛](https://forum-zh.obsidian.md/t/topic/47614)

## 简介

Tag Group Manager 是一个为 Obsidian 设计的插件，用于管理和快速插入标签。它允许用户创建自定义标签组，并通过浮动窗口快速将标签插入到笔记中，提高笔记整理和分类的效率。

![image](https://github.com/Stargazer-cc/obsidian-tag-group-manager/blob/main/image.jpg)


## 功能简介

- **标签组管理**：创建、编辑和删除自定义标签组
  - 支持手动添加标签，这意味着可以在不同组中添加同一个标签
  - 支持从笔记库中已有的标签中添加，带有筛选功能，不会被重复添加
  - 支持批量筛选添加标签，可以一次性添加多个标签到组中
- **浮动标签选择器**：可拖动、可固定的标签选择界面
  - **标签组与浮动标签选择器一一对应**：每新建一个标签组，就会注册一个浮动标签选择器生成命令
  - **快速插入标签**：通过命令面板快速调用标签选择器，实现快速插入，支持YAML区域插入
  - **使用后自动变暗**：已使用的标签会切换成另一个状态，避免重复添加
  - **智能插入规则**：自动检测输入环境，兼容其它插件，在YAML区域使用YAML格式，其它插件或者输入框使用统一的#标签格式
- **标签总览视图**：标签总览页面，排序模式和插入标签模式
  - 排序模式下，支持标签组拖拽排序，支持标签跨组排序
  - 插入标签模式下，点击直接插入标签，支持YAML区域插入
- **自定义标签颜色**：为标签设置个性化颜色
  - 支持正则表达式匹配标签名
  - 提供彩虹目录风格的七种预设颜色（红、蓝、绿、橙、紫、青、粉）
  - 支持自定义颜色选择
  - 完美模仿彩虹目录的渐变背景和透明度效果
- **多语言支持**：自动检测Obsidian语言设置
  - 中文用户显示中文界面
  - 其他语言用户显示英文界面
- **快速清除整篇笔记中的全部标签**
  - 选中笔记后的右键菜单中有这个命令

  

## 安装方法

### 手动安装

1. 下载最新版本的发布包
2. 解压缩下载的文件
3. 将解压后的文件夹复制到 Obsidian 插件目录：`{your-vault}/.obsidian/plugins/`
4. 重启 Obsidian或刷新第三方插件
5. 在设置中启用插件

### BRAT安装

你也可以用BRAT输入https://github.com/Stargazer-cc/obsidian-tag-group-manager 选取最新版本添加，以便获取更新。

## 使用方法

### 创建标签组

1. 打开 Obsidian 设置
2. 进入「Tag Group Manager」设置选项卡
3. 点击「添加标签组」按钮
4. 输入标签组名称
5. 在标签组下方添加需要的标签（不需要输入 # 符号）

![](https://github.com/Stargazer-cc/obsidian-tag-group-manager/blob/main/4.gif)

### 使用标签组

1. 在编辑笔记时，打开命令面板（Ctrl/Cmd + P）
2. 搜索「在此处插入」，会显示所有已创建的标签组
3. 选择需要使用的标签组
4. 在弹出的标签选择器中，点击需要插入的标签
5. 标签会自动插入到光标位置

### 标签选择器功能

- **拖动**：点击顶部「拖动」区域可以移动选择器位置
- **关闭**：点击 ✕ 按钮
- **循环**：可多次重复利用插入框，点击后恢复所有标签。

![](https://github.com/Stargazer-cc/obsidian-tag-group-manager/blob/main/3.gif)

### 标签总览视图
- 点击功能区的星星图标激活该视图
- 排序模式和标签插入模式切换
- 排序模式下，支持标签组拖拽排序，支持标签跨组排序，
- 插入标签模式下，点击直接插入标签，支持YAML区域插入

![](https://github.com/Stargazer-cc/obsidian-tag-group-manager/blob/main/6.gif)

## 配置说明

在插件设置页面，你可以：

### 颜色设置
- **启用自定义标签颜色**：开启后可以为不同的标签设置个性化颜色
- **添加颜色映射**：为标签名或正则表达式设置颜色
- **预设颜色选择**：提供七种彩虹目录风格的预设颜色
- **自定义颜色**：选择任意颜色作为标签背景

### 标签组管理
- 创建多个标签组，每个组可以包含不同类型的标签
- 编辑标签组名称（直接在组容器内编辑）
- 添加或删除标签组中的标签
- 删除不再需要的标签组
- 从标签库中添加标签
- 批量筛选添加多个标签

![](https://github.com/Stargazer-cc/obsidian-tag-group-manager/blob/main/4.png)

## 使用场景
- 日常使用标签，想要快速插入标签
- 标签库数量庞大，又不想用难看的多级标签的场景
- 常常用Tag管理电影库、书库等档案库类个人收录库，配合Quickadd和Buttons，档案笔记的录入将十分地优雅和丝滑
  
## 常见问题

**Q: 为什么我的标签组没有显示在命令面板中？**

A: 你必须处在可编辑视图中才能调用这些命令。

**Q: 如何让在设置页面实时添加的标签出现在已经打开的标签选择器中和总览页面？**

A: 已经存在的标签选择器中：shift+点击循环图标 将会刷新当前标签选择器；标签总览页面中：排序模式下点击任意一个标签组的组名将会刷新。

**Q: 如何改变标签单元的颜色？**

A：插件现在支持自定义标签颜色功能：
1. 在设置中开启"启用自定义标签颜色"
2. 添加颜色映射，输入标签名或正则表达式
3. 选择预设的彩虹颜色或自定义颜色
4. 匹配的标签会自动应用设置的颜色

**Q: 彩虹颜色和自定义颜色有什么区别？**

A：彩虹颜色使用彩虹目录的样式系统，具有渐变背景、透明度效果和立体阴影，会自动适配Obsidian主题。自定义颜色使用纯色背景，适合需要特定颜色的场景。

**Q: 插件支持哪些输入环境？**

A：插件会智能检测当前输入环境：
- YAML区域：使用YAML格式插入（`- 标签名`）
- Markdown正文：使用标签格式插入（`#标签名`）
- 其他插件的输入框：统一使用`#标签名`格式，连续插入时自动空格分隔


## 反馈与支持

如果你有任何问题、建议或反馈，请通过以下方式联系：

- 在 GitHub 上提交 Issue
- 通过 Obsidian 论坛发送消息

## 许可证

[MIT License](LICENSE)
