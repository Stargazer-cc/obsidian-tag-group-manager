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
    deleteGroup: string;
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

  private constructor() {
    this.currentLocale = moment.locale() || 'en';
  }

  public static getInstance(): I18n {
    if (!I18n.instance) {
      I18n.instance = new I18n();
    }
    return I18n.instance;
  }

  public t(key: string): string {
    const keys = key.split('.');
    let value: any = this.getTranslations();

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        console.warn(`Translation key not found: ${key}`);
        return key;
      }
    }

    return value as string;
  }

  private getTranslations(): I18nStrings {
    try {
      return this.currentLocale === 'zh' ? zh : en;
    } catch (e) {
      console.warn(`Locale ${this.currentLocale} not found, falling back to English`);
      return en;
    }
  }
}

export const i18n = I18n.getInstance();