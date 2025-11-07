import { moment } from 'obsidian';
import en from './i18n/en.json';
import zh from './i18n/zh.json';

export type LocaleString = keyof I18nStrings;

export interface I18nStrings {
  settings: {
    title: string;
    addGroup: string;
    groupName: string;
    addTag: string;
    addFromLibrary: string;
    batchFilterAdd: string;
    addSelectedTags: string;
    confirmSelection: string;
    filterTagsPlaceholder: string;
    selectAll: string;
    deselectAll: string;
    noMatchingTags: string;
    selectAtLeastOneTag: string;
    tagsAddedSuccess: string;
    noNewTagsAdded: string;
    deleteGroup: string;
    importantTips: string;
    tagOverviewTips: string;
    floatingTagSelectorTips: string;
    tip1: string;
    tip2: string;
    tip3: string;
    tip4: string;
    tip5: string;
    tip6: string;
    deleteGroupConfirm: string;
    enterTagName: string;
    enterGroupName: string;
    filterTags: string;
    noTagsFound: string;
  };
  selector: {
    drag: string;
    close: string;
    cycle: string;
    pin: string;
    unpin: string;
  };
  overview: {
    title: string;
    sortMode: string;
    insertMode: string;
    insertModeTitle: string;
    sortModeTitle: string;
    doubleClickToSwitch: string;
    clickToSwitch: string;
    refresh: string;
  };
  commands: {
    insertHere: string;
    clearTags: string;
  };
  messages: {
    groupCreated: string;
    groupDeleted: string;
    tagAdded: string;
    tagRemoved: string;
    tagsCleared: string;
    invalidTagName: string;
    duplicateTag: string;
    noEditorFound: string;
    openMarkdownFirst: string;
    supportsUndo: string;
    tagsClearFailed: string;
    noTagsInGroup: string;
    tagGroupUpdated: string;
    tagGroupUpToDate: string;
    noMatchingTagGroup: string;
  };
}

export class I18n {
  private static instance: I18n;
  private currentLocale: string;
  private listeners: Array<() => void> = [];

  private constructor() {
    // 尝试从多个来源获取语言设置
    const momentLocale = moment.locale() || 'en';
    // 如果是中文相关的locale，使用中文，否则使用英文
    this.currentLocale = momentLocale.startsWith('zh') ? 'zh' : 'en';
  }

  public static getInstance(): I18n {
    if (!I18n.instance) {
      I18n.instance = new I18n();
    }
    return I18n.instance;
  }

  public t(key: string): string {
    const keys = key.split('.');
    let current: Record<string, unknown> | string = this.getTranslations();

    for (const k of keys) {
      if (typeof current === 'object' && current !== null && k in current) {
        current = (current as Record<string, unknown>)[k];
      } else {
        // console.warn(`Translation key not found: ${key}`);
        return key;
      }
    }

    return current as string;
  }

  private getTranslations(): I18nStrings {
    try {
      return this.currentLocale === 'zh' ? zh : en;
    } catch (e) {
      console.warn(`Locale ${this.currentLocale} not found, falling back to English`, e);
      return en;
    }
  }

  public setLocale(locale: string): void {
    if (this.currentLocale !== locale) {
      this.currentLocale = locale;
      this.notifyListeners();
    }
  }

  public getLocale(): string {
    return this.currentLocale;
  }

  public addChangeListener(listener: () => void): void {
    this.listeners.push(listener);
  }

  public removeChangeListener(listener: () => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }
}

export const i18n = I18n.getInstance();