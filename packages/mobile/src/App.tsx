import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import * as DocumentPicker from "expo-document-picker";
import * as Crypto from "expo-crypto";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as SQLite from "expo-sqlite";
import * as SystemUI from "expo-system-ui";
import dayjs from "dayjs";
import calendar from "dayjs/plugin/calendar";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/zh-cn";
import i18next from "i18next";
import JSZip from "jszip";
import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createNavigationContainerRef,
  NavigationContainer,
  StackActions,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Carousel, { type ICarouselInstance } from "react-native-reanimated-carousel";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import type {
  KeyboardEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleProp,
  ViewStyle,
} from "react-native";
import {
  Alert,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  ArrowLeft,
  Bot,
  BookOpenText,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileText,
  Info,
  KeyRound,
  Languages,
  LibraryBig,
  Palette,
  PencilLine,
  Plus,
  RotateCcw,
  Send,
  Settings,
  Trash2,
  Upload,
  WandSparkles,
  X,
  type LucideIcon,
} from "lucide-react-native";
import {
  GenerationApiConfigurationError,
  prepareGenerationApiBody as prepareGenerationApiRequestBody,
} from "./generationCryptoClient";

type Count = 1 | 2 | 3;
type TabId = "fragments" | "schemes" | "laws" | "more";
type ThemeId = "parchment" | "sage" | "rose" | "sky" | "mint" | "dark";
type LanguageId = "system" | "zh-Hans" | "en";
type ProviderId = "openai" | "deepseek" | "anthropic";

type RootStackParamList = {
  Home: undefined;
  FragmentDetail: { id: string };
  DraftDetail: { fragmentId: string; draftId: string };
  SchemeDetail: { id: string };
  LawDetail: { id: string };
  AppearanceSettings: undefined;
  LanguageSettings: undefined;
  ModelSettings: undefined;
  ExportSettings: undefined;
  ImportSettings: undefined;
  AboutSettings: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const rootNavigationRef = createNavigationContainerRef<RootStackParamList>();
const androidSystemBarModalProps =
  Platform.OS === "android"
    ? ({
        navigationBarTranslucent: true,
        statusBarTranslucent: true,
      } as const)
    : {};

type Scheme = {
  id: string;
  title: string;
  content: string;
  lawIds: string[];
  createdAt: string;
  updatedAt: string;
};

type Law = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

type DraftVersion = {
  id: string;
  versionNo: number;
  content: string;
  createdAt: string;
  deadlineAt: string | null;
  snapshot: GenerationSnapshot;
  status: "completed" | "brewing" | "failed" | "expired";
};

type Draft = {
  id: string;
  schemeId: string;
  versions: DraftVersion[];
};

type FragmentItem = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  drafts: Draft[];
};

type SchemeSelection = Record<
  string,
  {
    selected: boolean;
    count: Count;
  }
>;

type ThemeColors = {
  background: string;
  card: string;
  cardBorder: string;
  muted: string;
  mutedBorder: string;
  mutedSurface: string;
  border: string;
  text: string;
  primary: string;
  primaryText: string;
  overlay: string;
  secondary: string;
  danger: string;
  dangerSoft: string;
};

type AppTheme = {
  id: ThemeId;
  name: string;
  description: string;
  tone: string;
  isDark?: boolean;
  colors: ThemeColors;
};

type ProviderKeys = Record<ProviderId, string>;

type SchemeGenerationSnapshot = {
  content: {
    fragment: {
      content: string;
      id: string;
      title: string;
    };
    laws: Array<{
      content: string;
      id: string;
      title: string;
    }>;
    scheme: {
      content: string;
      id: string;
      title: string;
    };
  };
  type: "scheme";
  version: 1;
};

type RewriteGenerationSnapshot = {
  content: {
    instruction: string;
    sourceContent: string;
    sourceVersionId: string;
  };
  type: "rewrite";
  version: 1;
};

type UnavailableGenerationSnapshot = {
  content: {
    reason: string;
  };
  type: "unavailable";
  version: 1;
};

type GenerationSnapshot =
  | SchemeGenerationSnapshot
  | RewriteGenerationSnapshot
  | UnavailableGenerationSnapshot;

type ModelOption = {
  id: string;
  name: string;
  providerId: ProviderId;
  descriptionKey: string;
};

type AvailableModelOption = ModelOption & {
  providerName: string;
};

type TranslateOptions = Record<string, string | number | boolean | null>;

type DraftGenerationPayload =
  | SchemeGenerationSnapshot["content"]
  | RewriteGenerationSnapshot["content"];

type DraftGenerationTarget = {
  draftId: string;
  fragmentId: string;
  payload: DraftGenerationPayload;
  snapshot: GenerationSnapshot;
  versionId: string;
};

type GenerationService = {
  apiKey?: string;
  model: string;
  provider: ProviderId;
};

type GenerationApiRecord = {
  deadlineAt?: string;
  error?: {
    code: string;
    message: string;
    providerStatus: number | null;
  } | null;
  id: string;
  output?: {
    content: string;
  } | null;
  status: "running" | "succeeded" | "failed";
};

type GenerationApiError = {
  code?: string;
  details?: {
    ids?: string[];
  } | null;
  message?: string;
};

type GenerationRecoveryResult = {
  expiredIds: string[];
  records: GenerationApiRecord[];
};

type TransferSectionId = "data" | "config";

type PersistedMobileSettings = {
  activeModelId?: string | null;
  languageId?: LanguageId;
  providerKeys?: ProviderKeys;
  themeId?: ThemeId;
  version: 1;
};

type BackupDataPayload = {
  schemaVersion: 2;
  fragments: FragmentItem[];
  laws: Law[];
  schemes: Scheme[];
};

type ParsedBackupBundle = {
  available: Record<TransferSectionId, boolean>;
  data?: BackupDataPayload;
  fileName: string;
  settings?: Partial<PersistedMobileSettings>;
};

const mobileSettingsStorageKey = "essai.mobile.settings.v1";
const backupDataSchemaVersion = 2;
const workspaceDatabaseName = "essai-workspace.db";
const workspaceSchemaVersion = 5;

const mobileResources = {
  "zh-Hans": {
    translation: {
      tabs: {
        fragments: "拾光集",
        schemes: "方案簿",
        laws: "创作法典",
        settings: "设置",
      },
      nav: {
        backHint: "返回上一页再试一次。",
      },
      actions: {
        cancel: "取消",
        confirm: "确认",
        save: "保存",
        close: "关闭",
        delete: "删除",
        createScheme: "新建方案",
        collectLaw: "收录法则",
        collect: "收集",
        draft: "出稿",
        editContent: "调整内容",
        editScheme: "编辑方案",
        revise: "修订",
        view: "查看",
        retry: "重试",
        rewrite: "改写",
        jump: "跳转",
        saveScheme: "保存方案",
        createSchemeSubmit: "创建方案",
        saveRevision: "保存修订",
        collectRule: "收录",
        gotIt: "知道了",
        more: "更多",
      },
      common: {
        draftCount: "{{count}} 稿",
        countLabel: "稿次数",
        processing: "处理中",
        missingContent: "这条内容可能已经被删除，或者当前预览数据还没有同步过来。",
      },
      status: {
        brewing: "生成中",
        failed: "失败",
        expired: "已失效",
        completed: "已成稿",
      },
      generation: {
        configRequired: "生成服务缺少加密配置，请先补齐环境变量再出稿。",
        configRequiredTitle: "生成服务未配置",
        idConflict: "这次生成任务的 ID 和另一条任务冲突了，请重新出稿。",
        modelRequired: "先在设置里添加服务密钥并选择模型，再开始出稿。",
        modelRequiredTitle: "还没有可用模型",
      },
      pages: {
        fragments: {
          slogan: "灵光乍现，也有去处。",
          emptyTitle: "还没有碎片",
          emptyDescription: "先拾起这一点，余下的交给时间。",
          missingTitle: "碎片不见了",
        },
        schemes: {
          slogan: "给灵感一条路，让同一种表达方式可以反复被调用。",
          emptyTitle: "还没有出稿方案",
          emptyDescription: "先写下一种可复用的表达路径，之后碎片就能沿着它自动酝酿成稿。",
          missingTitle: "方案不见了",
          detailLabel: "方案笺",
          relatedFragmentsTitle: "此间拾遗",
          noRelatedFragmentsTitle: "还没有碎片",
          noRelatedFragmentsDescription: "当碎片经由这个方案成稿后，会出现在这里。",
          noBoundLawsTitle: "还没有绑定创作法则",
          noBoundLawsDescription: "编辑方案时可以从创作法典里选择法则。",
          deleteTitle: "删除出稿方案",
          deleteSubtitle: "「{{name}}」会从方案簿中移除。",
        },
        laws: {
          slogan: "把你的表达经验收成条文，让每一次出稿都有迹可循。",
          emptyTitle: "还没有创作法则",
          emptyDescription: "先收录一条你想反复遵循的表达判断，它会成为之后出稿时可以引用的创作准则。",
          missingTitle: "法则不见了",
          detailLabel: "法则条文",
          deleteTitle: "删除创作法则",
          deleteSubtitle: "「{{name}}」会从创作法典中移除。",
        },
        drafts: {
          missingTitle: "成稿不见了",
          sectionTitle: "成稿",
          emptyTitle: "还没有成稿",
          emptyDescription: "可以先选择一个出稿方案，让这条碎片整理出第一版。",
          pendingPreview: "这一稿还在处理中。",
          contentTitle: "内容",
          sourceTitle: "生成依据",
          schemeTitle: "初稿方案",
          rewriteSourceVersionTitle: "原稿版本",
          rewriteInstructionTitle: "修改意见",
          lawsTitle: "创作法则",
          noLaws: "这份方案暂时没有绑定创作法则。",
          lawUnavailable: "这条法则暂时无法显示。",
          schemeUnavailable: "当前预览里暂时没有这份方案的完整说明。",
          jumpTitle: "跳到哪一稿",
          editTitle: "编辑内容",
          editPlaceholder: "调整这一稿的表达。",
          deleteTitle: "删除这一稿",
          deleteSubtitle: "只会删除当前这一稿，不会影响同一成稿卷里的其他稿次。",
          snapshotA11y: "查看生成依据",
          editA11y: "编辑稿件",
          retryA11y: "重试生成",
          rewriteA11y: "改写稿件",
          rewriteTitle: "改写这一稿",
          rewriteDescription: "写下你想调整的方向，我会基于当前稿件生成一版新的内容。",
          rewriteSourceTitle: "当前稿件",
          rewritePlaceholder: "比如更锋利一点、压缩到 60 秒、结尾更有余味……",
          deleteA11y: "删除稿件",
        },
        settings: {
          title: "设置",
          header: "设置",
          appearanceTitle: "外观",
          appearanceDescription: "更换界面配色。",
          languageTitle: "语言",
          languageDescription: "切换界面文字。",
          modelTitle: "模型配置",
          modelHeaderDescription: "服务与模型",
          modelDescription: "管理生成服务与当前模型。",
          aboutTitle: "关于 EssAI",
          aboutHeaderDescription: "版本与说明",
          exportTitle: "导出数据",
          exportDescription: "保存一份本地备份。",
          importTitle: "导入数据",
          importDescription: "从备份恢复到当前设备。",
          exportLead: "选择要放进导出包的内容。",
          importLead: "选择备份文件后，再确认要导入的内容。",
          exportDataTitle: "数据",
          exportDataDescription: "碎片、方案、创作法则和成稿。",
          exportConfigTitle: "配置",
          exportConfigDescription: "主题、语言和模型选择等使用偏好。",
          exportAction: "生成导出包",
          importFileTitle: "备份文件",
          importFileDescription: "先读取文件内容，再选择要导入的部分。",
          chooseFileAction: "选择文件",
          importAvailableTitle: "可导入内容",
          importAction: "导入选中内容",
          unavailable: "不可用",
          exportDone: "导出包已生成。",
          exportFailed: "导出失败，请稍后再试。",
          importLoaded: "已读取：{{fileName}}",
          importDone: "导入完成。",
          importFailed: "无法读取这个备份文件。",
          appearanceLead: "选择喜欢的界面颜色。",
          languageLead: "选择界面显示语言。",
          modelLead: "添加服务密钥后，选择一个当前用于生成的模型。",
          serviceKeysTitle: "服务密钥",
          activeModelTitle: "当前模型",
          noModelTitle: "还没有可用模型",
          noModelDescription: "添加一个服务密钥后，就可以选择模型。",
          added: "已添加",
          notAdded: "未添加",
          homeAppearanceDescription: "{{theme}} · 界面配色",
          homeModelDescription: "添加服务密钥后选择当前模型。",
          aboutDescription: "版本、说明和相关信息。",
        },
      },
      settings: {
        language: {
          systemName: "跟随系统",
          systemDescription: "使用设备当前的语言设置。",
          zhName: "简体中文",
          zhDescription: "界面文字显示为中文。",
          enName: "English",
          enDescription: "Show the interface in English.",
        },
        themes: {
          parchmentName: "羊皮纸",
          parchmentDescription: "温暖、轻柔，适合日常记录。",
          sageName: "青枝",
          sageDescription: "更安静的绿色调，适合长时间记录。",
          roseName: "蔷薇",
          roseDescription: "偏红但不艳，适合更柔软的心情。",
          skyName: "晴蓝",
          skyDescription: "清爽、克制，适合把内容看清楚。",
          mintName: "薄荷",
          mintDescription: "更清新的浅色调，留白感更强。",
          darkName: "夜色",
          darkDescription: "暗黑模式，适合夜里低亮度使用。",
        },
        models: {
          openaiDescription: "适合日常生成、改写和标题整理。",
          openaiMiniDescription: "默认推荐，速度和效果比较均衡。",
          openaiFullDescription: "适合更复杂的整理和改写。",
          deepseekDescription: "适合轻量、批量的生成任务。",
          deepseekProDescription: "适合质量要求更高的稿件。",
          deepseekFlashDescription: "适合更快的轻量生成。",
          anthropicDescription: "适合长文本整理、语气控制和改写。",
          claudeSonnetDescription: "默认推荐，适合多数创作任务。",
          claudeHaikuDescription: "更轻、更快，适合标题和短稿。",
          claudeFableDescription: "适合更复杂的长稿整理。",
        },
      },
      about: {
        title: "EssAI",
        subtitle: "一个把灵感碎片整理成可继续创作内容的个人工具。",
        versionLabel: "版本",
        versionValue: "0.1.0",
        localTitle: "本地优先",
        localDescription: "碎片、方案和创作法则以本机使用为核心，适合随手记录和随时整理。",
        modelTitle: "自带模型密钥",
        modelDescription: "生成能力由你选择的模型服务提供。密钥只用于请求对应服务。",
        languageTitle: "语言",
        languageDescription: "界面语言可以在设置中切换，已记录的内容保持原样。",
      },
      compose: {
        title: "收集碎片",
        description: "把这一刻想到的内容放进来就好，可以是一句话、一段素材，或者一个还没整理完整的想法。",
        placeholder: "片段、判断、素材、吐槽、画面，甚至只是一个模糊的感觉，先写下来就好。",
        schemeHelp: "如果想现在先出几版初稿，可以在下面选择方案和数量；也可以先收起来，之后在碎片札记里再慢慢出稿。",
        noSchemesTitle: "还没有可选方案",
        noSchemesDescription: "这条碎片可以先收起来；等方案簿里有方案后，再回来为它出稿。",
        createTitleFallback: "新碎片",
      },
      schemeEditor: {
        createTitle: "新建出稿方案",
        editTitle: "编辑出稿方案",
        description: "把身份、题材、平台、时长、语气、输出形态和禁忌写清楚，之后就能反复复用。",
        nameLabel: "名称",
        namePlaceholder: "例如：日常分享",
        descriptionLabel: "说明",
        descriptionPlaceholder: "例如：适合把零散想法整理成一段自然的分享。语气轻松一点，有自己的判断，不要太像正式文章...",
        createTitleFallback: "新方案",
        lawsLabel: "创作法则",
        lawsDescription: "从创作法典里挑选要引用的法则，也可以在这里新增。",
        noLawsTitle: "还没有可选法则",
        noLawsDescription: "可以在法典里先收录一条。",
        quickLawTitle: "新增法则",
        quickLawDescription: "会先收进创作法典，并在这里自动选中。",
        quickLawError: "名称和内容都填一下，就能先收进法典。",
      },
      lawEditor: {
        createTitle: "收录创作法则",
        editTitle: "修订创作法则",
        description: "一条法则就是一条可复用的创作判断。出稿时，它会和方案一起影响内容的取舍、语气和结构。",
        nameLabel: "名称",
        namePlaceholder: "例如：黄金三秒...",
        createTitleFallback: "新法则",
        contentLabel: "内容",
        contentPlaceholder: "例如：开头 3 秒内必须让观众知道这条内容和自己有什么关系...",
        tagLabel: "标签",
        addTagTitle: "新增标签",
        tagPlaceholder: "例如：语气",
      },
      fragmentDetail: {
        deleteTitle: "删除碎片",
        deleteSubtitle: "这条碎片和它派生出的成稿都会被删除。",
        editTitle: "调整内容",
        editDescription: "把缺的、不准的地方补上，让这条碎片更贴近你现在的想法。",
        editPlaceholder: "继续补充这条碎片...",
        generateTitle: "选择出稿方案",
        generateDescription: "选择这条碎片要走的出稿方案，也可以为同一个方案一次生成几版。",
        generateHelp: "选择这条碎片要走的出稿方案，也可以为同一个方案一次生成几版。",
        noSchemesDescription: "等方案簿里有方案后，再回来为它出稿。",
      },
    },
  },
  en: {
    translation: {
      tabs: {
        fragments: "Sparks",
        schemes: "Schemes",
        laws: "Codex",
        settings: "Settings",
      },
      nav: {
        backHint: "Go back and try again.",
      },
      actions: {
        cancel: "Cancel",
        confirm: "Confirm",
        save: "Save",
        close: "Close",
        delete: "Delete",
        createScheme: "New Scheme",
        collectLaw: "Add Rule",
        collect: "Collect",
        draft: "Draft",
        editContent: "Adjust",
        editScheme: "Edit Scheme",
        revise: "Revise",
        view: "View",
        retry: "Retry",
        rewrite: "Rewrite",
        jump: "Jump",
        saveScheme: "Save Scheme",
        createSchemeSubmit: "Create Scheme",
        saveRevision: "Save Revision",
        collectRule: "Add",
        gotIt: "Got it",
        more: "More",
      },
      common: {
        draftCount: "{{count}} drafts",
        countLabel: "Versions",
        processing: "Processing",
        missingContent: "This content may have been deleted or is not available in the preview.",
      },
      status: {
        brewing: "Generating",
        failed: "Failed",
        expired: "Expired",
        completed: "Ready",
      },
      generation: {
        configRequired: "Generation encryption is not configured. Add the required environment variables before drafting.",
        configRequiredTitle: "Generation service not configured",
        idConflict: "This generation ID conflicts with another task. Please draft again.",
        modelRequired: "Add a service key and choose a model in Settings before drafting.",
        modelRequiredTitle: "No model available",
      },
      pages: {
        fragments: {
          slogan: "A spark has somewhere to go.",
          emptyTitle: "No sparks yet",
          emptyDescription: "Pick up this little piece. Let time take care of the rest.",
          missingTitle: "Fragment not found",
        },
        schemes: {
          slogan: "Give an idea a path, so the same way of writing can be used again.",
          emptyTitle: "No schemes yet",
          emptyDescription: "Create a reusable path for turning fragments into drafts.",
          missingTitle: "Scheme not found",
          detailLabel: "Scheme Note",
          relatedFragmentsTitle: "Gathered Pieces",
          noRelatedFragmentsTitle: "No fragments yet",
          noRelatedFragmentsDescription: "Fragments drafted through this scheme will appear here.",
          noBoundLawsTitle: "No creative rules yet",
          noBoundLawsDescription: "Edit the scheme to choose rules from the Codex.",
          deleteTitle: "Delete Scheme",
          deleteSubtitle: "“{{name}}” will be removed from Schemes.",
        },
        laws: {
          slogan: "Collect your writing instincts as rules, so every draft has a trace.",
          emptyTitle: "No rules yet",
          emptyDescription: "Add a reusable writing judgment that can guide future drafts.",
          missingTitle: "Rule not found",
          detailLabel: "Rule Entry",
          deleteTitle: "Delete Rule",
          deleteSubtitle: "“{{name}}” will be removed from the Codex.",
        },
        drafts: {
          missingTitle: "Draft not found",
          sectionTitle: "Drafts",
          emptyTitle: "No drafts yet",
          emptyDescription: "Choose a scheme to turn this fragment into a first draft.",
          pendingPreview: "This draft is still processing.",
          contentTitle: "Content",
          sourceTitle: "Source",
          schemeTitle: "Scheme",
          rewriteSourceVersionTitle: "Source Version",
          rewriteInstructionTitle: "Revision Note",
          lawsTitle: "Creative Rules",
          noLaws: "This scheme has no creative rules yet.",
          lawUnavailable: "This rule cannot be displayed.",
          schemeUnavailable: "This scheme description is not available in the preview.",
          jumpTitle: "Jump to Version",
          editTitle: "Edit Content",
          editPlaceholder: "Adjust this version.",
          deleteTitle: "Delete This Version",
          deleteSubtitle: "Only this version will be deleted. Other versions in this draft roll remain.",
          snapshotA11y: "View source",
          editA11y: "Edit draft",
          retryA11y: "Retry generation",
          rewriteA11y: "Rewrite draft",
          rewriteTitle: "Rewrite this draft",
          rewriteDescription: "Describe what should change, and EssAI will create a new version from the current draft.",
          rewriteSourceTitle: "Current draft",
          rewritePlaceholder: "For example: sharper, shorter, warmer, or better for a 60-second script...",
          deleteA11y: "Delete draft",
        },
        settings: {
          title: "Settings",
          header: "Settings",
          appearanceTitle: "Appearance",
          appearanceDescription: "Change the interface colors.",
          languageTitle: "Language",
          languageDescription: "Change the interface language.",
          modelTitle: "Model Settings",
          modelHeaderDescription: "Services and models",
          modelDescription: "Manage generation services and the active model.",
          aboutTitle: "About EssAI",
          aboutHeaderDescription: "Version and notes",
          exportTitle: "Export Data",
          exportDescription: "Save a local backup.",
          importTitle: "Import Data",
          importDescription: "Restore from a backup on this device.",
          exportLead: "Choose what goes into the export package.",
          importLead: "Choose a backup file, then confirm what to import.",
          exportDataTitle: "Data",
          exportDataDescription: "Fragments, schemes, creative rules, and drafts.",
          exportConfigTitle: "Settings",
          exportConfigDescription: "Theme, language, model choice, and preferences.",
          exportAction: "Create Export Package",
          importFileTitle: "Backup File",
          importFileDescription: "Read the file first, then choose what to import.",
          chooseFileAction: "Choose File",
          importAvailableTitle: "Importable Content",
          importAction: "Import Selected Content",
          unavailable: "Unavailable",
          exportDone: "Export package created.",
          exportFailed: "Export failed. Please try again.",
          importLoaded: "Loaded: {{fileName}}",
          importDone: "Import complete.",
          importFailed: "This backup file could not be read.",
          appearanceLead: "Choose a color theme you like.",
          languageLead: "Choose the interface language.",
          modelLead: "Add a service key, then choose the model used for generation.",
          serviceKeysTitle: "Service Keys",
          activeModelTitle: "Active Model",
          noModelTitle: "No model available",
          noModelDescription: "Add a service key to choose a model.",
          added: "Added",
          notAdded: "Not added",
          homeAppearanceDescription: "{{theme}} · Interface colors",
          homeModelDescription: "Add a service key to choose the active model.",
          aboutDescription: "Version, notes, and related information.",
        },
      },
      settings: {
        language: {
          systemName: "Follow System",
          systemDescription: "Use the device language setting.",
          zhName: "Simplified Chinese",
          zhDescription: "Show the interface in Chinese.",
          enName: "English",
          enDescription: "Show the interface in English.",
        },
        themes: {
          parchmentName: "Parchment",
          parchmentDescription: "Warm and gentle for everyday notes.",
          sageName: "Sage",
          sageDescription: "A quieter green for longer writing sessions.",
          roseName: "Rose",
          roseDescription: "Soft red tones without feeling loud.",
          skyName: "Clear Sky",
          skyDescription: "Fresh and restrained, with strong readability.",
          mintName: "Mint",
          mintDescription: "Light, fresh, and open.",
          darkName: "Night",
          darkDescription: "A dark theme for low-light use.",
        },
        models: {
          openaiDescription: "Good for everyday drafting, rewriting, and titles.",
          openaiMiniDescription: "Recommended by default, balancing speed and quality.",
          openaiFullDescription: "Better for more complex restructuring and rewriting.",
          deepseekDescription: "Good for lightweight and batch generation tasks.",
          deepseekProDescription: "Better when draft quality matters more.",
          deepseekFlashDescription: "Better for fast lightweight generation.",
          anthropicDescription: "Good for long text, voice control, and rewriting.",
          claudeSonnetDescription: "Recommended for most writing tasks.",
          claudeHaikuDescription: "Lighter and faster for titles and short drafts.",
          claudeFableDescription: "Better for complex long-form drafts.",
        },
      },
      about: {
        title: "EssAI",
        subtitle: "A personal tool for turning scattered sparks into something you can keep writing.",
        versionLabel: "Version",
        versionValue: "0.1.0",
        localTitle: "Local-first",
        localDescription: "Fragments, schemes, and rules are centered around local use for quick capture and review.",
        modelTitle: "Bring your own key",
        modelDescription: "Generation is powered by the model service you choose. Keys are used only for that service.",
        languageTitle: "Language",
        languageDescription: "You can switch the interface language here. Your saved content stays as written.",
      },
      compose: {
        title: "Collect Fragment",
        description: "Add the content you have now: a sentence, a note, a feeling, or an unfinished thought.",
        placeholder: "A line, a judgment, a material, a complaint, an image, or just a vague feeling. Write whatever came to mind.",
        schemeHelp: "Choose schemes and counts if you want drafts now, or collect this fragment and draft later from its note.",
        noSchemesTitle: "No schemes available",
        noSchemesDescription: "You can collect this fragment now and come back after creating a scheme.",
        createTitleFallback: "New Fragment",
      },
      schemeEditor: {
        createTitle: "New Scheme",
        editTitle: "Edit Scheme",
        description: "Define the identity, topic, platform, length, voice, output shape, and boundaries for reuse.",
        nameLabel: "Name",
        namePlaceholder: "Daily notes",
        descriptionLabel: "Description",
        descriptionPlaceholder: "For example: Turn scattered thoughts into a natural post with a relaxed voice and a clear judgment...",
        createTitleFallback: "New Scheme",
        lawsLabel: "Creative Rules",
        lawsDescription: "Pick rules from the Codex, or add one here.",
        noLawsTitle: "No rules available",
        noLawsDescription: "Add a rule in the Codex first.",
        quickLawTitle: "New Rule",
        quickLawDescription: "It will be added to the Codex and selected here.",
        quickLawError: "Add both name and content to save this rule.",
      },
      lawEditor: {
        createTitle: "Add Creative Rule",
        editTitle: "Revise Creative Rule",
        description: "A rule is a reusable creative judgment. It shapes what the draft keeps, removes, and emphasizes.",
        nameLabel: "Name",
        namePlaceholder: "For example: First Three Seconds...",
        createTitleFallback: "New Rule",
        contentLabel: "Content",
        contentPlaceholder: "For example: The first 3 seconds must show why this matters to the audience...",
        tagLabel: "Tag",
        addTagTitle: "Add Tag",
        tagPlaceholder: "For example: Voice",
      },
      fragmentDetail: {
        deleteTitle: "Delete Fragment",
        deleteSubtitle: "This fragment and its derived drafts will be deleted.",
        editTitle: "Adjust Content",
        editDescription: "Fill in what is missing or inaccurate, so this fragment matches your current thinking.",
        editPlaceholder: "Continue adding to this fragment...",
        generateTitle: "Choose Scheme",
        generateDescription: "Choose which schemes this fragment should use, and how many versions to create.",
        generateHelp: "Choose which schemes this fragment should use, and how many versions to create.",
        noSchemesDescription: "Create a scheme first, then come back to draft this fragment.",
      },
    },
  },
} as const;

const mobileI18n = i18next.createInstance();

dayjs.extend(calendar);
dayjs.extend(relativeTime);

void mobileI18n.init({
  fallbackLng: "zh-Hans",
  interpolation: { escapeValue: false },
  lng: "zh-Hans",
  resources: mobileResources,
});

let activeI18nLanguage: "zh-Hans" | "en" = "zh-Hans";
let activeDayjsLocale = "zh-cn";

function resolveI18nLanguage(languageId: LanguageId) {
  if (languageId === "en") return "en";
  if (languageId === "zh-Hans") return "zh-Hans";

  const systemLocale =
    Intl.DateTimeFormat().resolvedOptions().locale?.toLowerCase() ?? "";

  return systemLocale.startsWith("zh") ? "zh-Hans" : "en";
}

function applyLanguage(languageId: LanguageId) {
  activeI18nLanguage = resolveI18nLanguage(languageId);
  activeDayjsLocale = activeI18nLanguage === "en" ? "en" : "zh-cn";
}

function tx(key: string, options?: TranslateOptions) {
  return mobileI18n.t(key, { lng: activeI18nLanguage, ...options });
}

const initialLaws: Law[] = [];
const initialSchemes: Scheme[] = [];
const initialFragments: FragmentItem[] = [];

const tabs: Array<{ id: TabId; labelKey: string; Icon: LucideIcon }> = [
  { id: "fragments", labelKey: "tabs.fragments", Icon: FileText },
  { id: "schemes", labelKey: "tabs.schemes", Icon: LibraryBig },
  { id: "laws", labelKey: "tabs.laws", Icon: BookOpenText },
  { id: "more", labelKey: "tabs.settings", Icon: Settings },
];

const languageOptions: Array<{
  id: LanguageId;
  nameKey?: string;
  nativeName?: string;
  descriptionKey: string;
}> = [
  {
    id: "system",
    nameKey: "settings.language.systemName",
    descriptionKey: "settings.language.systemDescription",
  },
  {
    id: "zh-Hans",
    nativeName: "简体中文",
    descriptionKey: "settings.language.zhDescription",
  },
  {
    id: "en",
    nativeName: "English",
    descriptionKey: "settings.language.enDescription",
  },
];

const modelProviders: Array<{
  id: ProviderId;
  name: string;
  keyLabel: string;
  keyPlaceholder: string;
  descriptionKey: string;
  models: ModelOption[];
}> = [
  {
    id: "openai",
    name: "OpenAI",
    keyLabel: "OpenAI API Key",
    keyPlaceholder: "sk-...",
    descriptionKey: "settings.models.openaiDescription",
    models: [
      {
        id: "openai:gpt-5.4-mini",
        name: "GPT-5.4 mini",
        providerId: "openai",
        descriptionKey: "settings.models.openaiMiniDescription",
      },
      {
        id: "openai:gpt-5.4",
        name: "GPT-5.4",
        providerId: "openai",
        descriptionKey: "settings.models.openaiFullDescription",
      },
    ],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    keyLabel: "DeepSeek API Key",
    keyPlaceholder: "sk-...",
    descriptionKey: "settings.models.deepseekDescription",
    models: [
      {
        id: "deepseek:deepseek-v4-pro",
        name: "DeepSeek V4 Pro",
        providerId: "deepseek",
        descriptionKey: "settings.models.deepseekProDescription",
      },
      {
        id: "deepseek:deepseek-v4-flash",
        name: "DeepSeek V4 Flash",
        providerId: "deepseek",
        descriptionKey: "settings.models.deepseekFlashDescription",
      },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    keyLabel: "Anthropic API Key",
    keyPlaceholder: "sk-ant-...",
    descriptionKey: "settings.models.anthropicDescription",
    models: [
      {
        id: "anthropic:claude-sonnet-5",
        name: "Claude Sonnet 5",
        providerId: "anthropic",
        descriptionKey: "settings.models.claudeSonnetDescription",
      },
      {
        id: "anthropic:claude-haiku-4.5",
        name: "Claude Haiku 4.5",
        providerId: "anthropic",
        descriptionKey: "settings.models.claudeHaikuDescription",
      },
      {
        id: "anthropic:claude-fable-5",
        name: "Claude Fable 5",
        providerId: "anthropic",
        descriptionKey: "settings.models.claudeFableDescription",
      },
    ],
  },
];

const emptyProviderKeys: ProviderKeys = {
  anthropic: "",
  deepseek: "",
  openai: "",
};

const quickLawTagMaxLength = 24;
const fragmentMasonryMinColumnWidth = 156;
const fragmentMasonryGap = 8;
const generationWorkflowTimeoutMs = 240_000;
const generationDeadlineBufferMs = 30_000;
const generationApiBaseUrl =
  process.env.EXPO_PUBLIC_GENERATION_API_BASE_URL ??
  (Platform.OS === "android" ? "http://10.0.2.2:3000" : "http://localhost:3000");
const requestEncryptionPublicJwk =
  process.env.EXPO_PUBLIC_REQUEST_ENCRYPTION_PUBLIC_JWK;
const apiKeyEncryptionPublicJwk =
  process.env.EXPO_PUBLIC_API_KEY_ENCRYPTION_PUBLIC_JWK;
const generationProviderDefaults: Record<ProviderId, string> = {
  anthropic: "claude-sonnet-5",
  deepseek: "deepseek-v4-pro",
  openai: "gpt-5.4-mini",
};
const draftGenerationOptions = {
  maxOutputTokens: 1800,
};
const titleGenerationOptions = {
  maxOutputTokens: 96,
};

function NavigationHeaderTitle({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <View style={styles.navigationHeaderTitle}>
      <Text style={styles.navigationHeaderPrimary} numberOfLines={1}>
        {title}
      </Text>
      <Text style={styles.navigationHeaderSecondary} numberOfLines={1}>
        {description}
      </Text>
    </View>
  );
}

function NavigationBackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable style={styles.navigationBackButton} onPress={onPress}>
      <ArrowLeft color={colors.text} size={22} strokeWidth={2.35} />
    </Pressable>
  );
}

function mergeLawLists(primary: Law[], secondary: Law[]) {
  const seen = new Set<string>();

  return [...primary, ...secondary].filter((law) => {
    if (seen.has(law.id)) {
      return false;
    }

    seen.add(law.id);
    return true;
  });
}

function createDefaultSchemeSelection(schemes: Scheme[]): SchemeSelection {
  return Object.fromEntries(
    schemes.map((scheme, index) => [
      scheme.id,
      {
        selected: index === 0,
        count: 1 as Count,
      },
    ]),
  );
}

function withOpacity(color: string, opacity: number) {
  const normalized = color.trim();
  const hex = normalized.startsWith("#") ? normalized.slice(1) : normalized;
  const expanded =
    hex.length === 3
      ? hex
          .split("")
          .map((value) => `${value}${value}`)
          .join("")
      : hex;

  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    return normalized;
  }

  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

export default function App() {
  const [themeId, setThemeId] = useState<ThemeId>("parchment");
  const [languageId, setLanguageId] = useState<LanguageId>("system");
  const activeTheme = getTheme(themeId);
  applyTheme(themeId);
  applyLanguage(languageId);
  const [activeTab, setActiveTab] = useState<TabId>("fragments");
  const [schemes, setSchemes] = useState<Scheme[]>(initialSchemes);
  const [laws, setLaws] = useState<Law[]>(initialLaws);
  const [fragments, setFragments] = useState<FragmentItem[]>(initialFragments);
  const [providerKeys, setProviderKeys] =
    useState<ProviderKeys>(emptyProviderKeys);
  const [activeModelId, setActiveModelId] = useState<string | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [schemeEditorOpen, setSchemeEditorOpen] = useState(false);
  const [lawEditorOpen, setLawEditorOpen] = useState(false);
  const [editingSchemeId, setEditingSchemeId] = useState<string | null>(null);
  const [editingLawId, setEditingLawId] = useState<string | null>(null);
  const availableModels = useMemo(
    () => getAvailableModels(providerKeys),
    [providerKeys],
  );
  const activeModel =
    availableModels.find((model) => model.id === activeModelId) ?? null;
  const recoveringGenerationIdsRef = useRef(new Set<string>());

  const editingScheme = useMemo(
    () => schemes.find((scheme) => scheme.id === editingSchemeId),
    [schemes, editingSchemeId],
  );
  const editingLaw = useMemo(
    () => laws.find((law) => law.id === editingLawId),
    [laws, editingLawId],
  );

  useEffect(() => {
    if (Platform.OS !== "android") return;

    void SystemUI.setBackgroundColorAsync(activeTheme.colors.background).catch(
      () => undefined,
    );
  }, [activeTheme]);

  useEffect(() => {
    let mounted = true;

    readPersistedWorkspaceData()
      .then((data) => {
        if (!mounted) return;

        setFragments(data.fragments);
        setLaws(data.laws);
        setSchemes(data.schemes);
      })
      .catch(() => {
        // A broken local database should not prevent the app shell from opening.
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    readPersistedMobileSettings()
      .then((parsed) => {
        if (!parsed) return;

        if (isThemeId(parsed.themeId)) {
          setThemeId(parsed.themeId);
        }

        if (isLanguageId(parsed.languageId)) {
          setLanguageId(parsed.languageId);
        }

        if (
          typeof parsed.activeModelId === "string" ||
          parsed.activeModelId === null
        ) {
          setActiveModelId(parsed.activeModelId);
        }

        if (isProviderKeys(parsed.providerKeys)) {
          setProviderKeys(parsed.providerKeys);
        }
      })
      .catch(() => {
        // Broken local settings should not block the app shell.
      })
      .finally(() => {
        if (mounted) {
          setSettingsLoaded(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;

    const payload: PersistedMobileSettings = {
      activeModelId,
      languageId,
      providerKeys,
      themeId,
      version: 1,
    };

    void writePersistedMobileSettings(payload).catch(() => undefined);
  }, [activeModelId, languageId, providerKeys, settingsLoaded, themeId]);

  useEffect(() => {
    if (availableModels.length === 0) {
      if (activeModelId !== null) {
        setActiveModelId(null);
      }
      setModelMenuOpen(false);
      return;
    }

    if (!availableModels.some((model) => model.id === activeModelId)) {
      setActiveModelId(availableModels[0]?.id ?? null);
    }
  }, [activeModelId, availableModels]);

  useEffect(() => {
    const pendingRefs = getPendingDraftVersionRefs(fragments).filter(
      (item) => !recoveringGenerationIdsRef.current.has(item.versionId),
    );

    if (pendingRefs.length === 0) return;

    pendingRefs.forEach((item) => {
      recoveringGenerationIdsRef.current.add(item.versionId);
    });

    void recoverDraftVersions(pendingRefs).finally(() => {
      pendingRefs.forEach((item) => {
        recoveringGenerationIdsRef.current.delete(item.versionId);
      });
    });
  }, [fragments]);

  async function recoverDraftVersions(
    refs: Array<{ draftId: string; fragmentId: string; versionId: string }>,
  ) {
    if (refs.length === 0) return;

    try {
      const recovery = await followGenerationRecords(
        refs.map((item) => item.versionId),
      );

      await applyGenerationRecovery(recovery);
    } catch {
      try {
        const recovery = await pullGenerationRecords(
          refs.map((item) => item.versionId),
        );

        await applyGenerationRecovery(recovery);
      } catch {
        // Keep local records brewing; the next recovery pass can try again.
      }
    }
  }

  async function applyGenerationRecovery(recovery: GenerationRecoveryResult) {
    for (const record of recovery.records) {
      await updateDraftVersionFromRecord(record);
    }

    for (const id of recovery.expiredIds) {
      await updateDraftVersionStatus(id, {
        content: tx("status.expired"),
        status: "expired",
      });
    }
  }

  async function requestDraftGenerations(targets: DraftGenerationTarget[]) {
    if (targets.length === 0) return;

    targets.forEach((target) => {
      recoveringGenerationIdsRef.current.add(target.versionId);
    });

    const service = resolveGenerationService(activeModel, providerKeys);

    if (!service) {
      showGenerationModelRequired();
      await Promise.all(
        targets.map((target) =>
          updateDraftVersionStatus(target.versionId, {
            content: tx("generation.modelRequired"),
            status: "failed",
          }),
        ),
      );
      targets.forEach((target) => {
        recoveringGenerationIdsRef.current.delete(target.versionId);
      });
      return;
    }

    try {
      const generations = await Promise.all(
        targets.map(async (target) => ({
          id: target.versionId,
          payload: target.payload,
          requestFingerprint: await buildDraftRequestFingerprint({
            id: target.versionId,
            model: service.model,
            options: draftGenerationOptions,
            payload: target.payload,
            provider: service.provider,
          }),
        })),
      );
      const body = await prepareGenerationApiBody({
        apiKey: service.apiKey,
        generations,
        model: service.model,
        options: draftGenerationOptions,
        provider: service.provider,
        timeoutMs: generationWorkflowTimeoutMs,
      });
      const response = await postGenerationApi<{
        ok: boolean;
        records?: GenerationApiRecord[];
      }>("/api/generations", body);

      for (const record of response.records ?? []) {
        await updateDraftVersionFromRecord(record);
      }
    } catch (error) {
      const apiError = getGenerationApiError(error);
      const ids = getGenerationApiErrorIds(apiError, targets);

      if (apiError?.code === "generation_request_exists") {
        await recoverDraftVersions(
          targets
            .filter((target) => ids.includes(target.versionId))
            .map((target) => ({
              draftId: target.draftId,
              fragmentId: target.fragmentId,
              versionId: target.versionId,
            })),
        );
        return;
      }

      if (apiError?.code === "generation_id_conflict") {
        await Promise.all(
          targets
            .filter((target) => ids.includes(target.versionId))
            .map((target) =>
              updateDraftVersionStatus(target.versionId, {
                content: tx("generation.idConflict"),
                status: "failed",
              }),
            ),
        );
        return;
      }

      if (error instanceof GenerationApiConfigurationError) {
        showGenerationConfigRequired();
        await Promise.all(
          targets.map((target) =>
            updateDraftVersionStatus(target.versionId, {
              content: tx("generation.configRequired"),
              status: "failed",
            }),
          ),
        );
        return;
      }

      await recoverDraftVersions(
        targets.map((target) => ({
          draftId: target.draftId,
          fragmentId: target.fragmentId,
          versionId: target.versionId,
        })),
      );
    } finally {
      targets.forEach((target) => {
        recoveringGenerationIdsRef.current.delete(target.versionId);
      });
    }
  }

  async function requestFragmentTitle(fragment: FragmentItem) {
    const service = resolveGenerationService(activeModel, providerKeys);

    if (!service) return;

    const id = createId("title");
    const payload = {
      fragment: {
        content: fragment.content,
        id: fragment.id,
      },
    };
    const requestFingerprint = await buildTitleRequestFingerprint({
      id,
      model: service.model,
      options: titleGenerationOptions,
      payload,
      provider: service.provider,
    });

    try {
      const body = await prepareGenerationApiBody({
        apiKey: service.apiKey,
        id,
        model: service.model,
        options: titleGenerationOptions,
        payload,
        provider: service.provider,
        requestFingerprint,
        timeoutMs: 60_000,
      });
      const response = await postGenerationApi<{
        ok: boolean;
        title?: string | null;
      }>("/api/generation-title", body);
      const title = response.title?.trim();

      if (!title) return;

      await updatePersistedFragmentTitle(fragment.id, title, new Date().toISOString());
      setFragments((current) =>
        (Array.isArray(current) ? current : []).map((item) =>
          item.id === fragment.id ? { ...item, title } : item,
        ),
      );
    } catch {
      // Title generation is helpful, not required for collecting a fragment.
    }
  }

  async function updateDraftVersionFromRecord(record: GenerationApiRecord) {
    if (record.status === "running") {
      await updateDraftVersionStatus(record.id, {
        deadlineAt: record.deadlineAt ?? undefined,
        status: "brewing",
      });
      return;
    }

    if (record.status === "succeeded") {
      await updateDraftVersionStatus(record.id, {
        content: record.output?.content?.trim() || tx("pages.drafts.pendingPreview"),
        deadlineAt: record.deadlineAt ?? undefined,
        status: "completed",
      });
      return;
    }

    await updateDraftVersionStatus(record.id, {
      content: record.error?.message ?? tx("status.failed"),
      deadlineAt: record.deadlineAt ?? undefined,
      status: "failed",
    });
  }

  async function updateDraftVersionStatus(
    versionId: string,
    patch: Partial<Pick<DraftVersion, "content" | "deadlineAt" | "status">>,
  ) {
    await updatePersistedDraftVersion(versionId, patch);
    setFragments((current) => updateDraftVersionInFragments(current, versionId, patch));
  }

  async function collectFragment(content: string, selection: SchemeSelection) {
    const createdAt = new Date().toISOString();
    const title = tx("compose.createTitleFallback");
    const pickedSchemes = schemes.flatMap((scheme) => {
      const item = selection[scheme.id];
      if (!item?.selected) return [];
      return [{ scheme, count: item.count }];
    });
    const generationSchemes =
      pickedSchemes.length > 0 && !resolveGenerationService(activeModel, providerKeys)
        ? []
        : pickedSchemes;

    if (pickedSchemes.length > 0 && generationSchemes.length === 0) {
      showGenerationModelRequired();
    }

    const fragmentBase = {
      id: createId("fragment"),
      title,
      content,
      createdAt,
      updatedAt: createdAt,
    };
    const draftPlans = generationSchemes.map(({ scheme, count }) =>
      createPendingDraftGenerationPlan({
        count,
        fragment: fragmentBase,
        laws,
        scheme,
        startVersionNo: 1,
      }),
    );

    const fragment: FragmentItem = {
      ...fragmentBase,
      drafts: draftPlans.map((plan) => plan.draft),
    };

    await insertPersistedFragment(fragment);
    setFragments((current) => [fragment, ...current]);
    setComposeOpen(false);
    void requestFragmentTitle(fragment);
    void requestDraftGenerations(draftPlans.flatMap((plan) => plan.targets));
    return fragment.id;
  }

  async function updateFragmentContent(fragmentId: string, content: string) {
    const updatedAt = new Date().toISOString();

    await updatePersistedFragmentContent(fragmentId, content, updatedAt);
    setFragments((current) =>
      current.map((fragment) =>
        fragment.id === fragmentId
          ? { ...fragment, content, updatedAt }
          : fragment,
      ),
    );
  }

  async function deleteFragment(fragmentId: string) {
    await deletePersistedFragment(fragmentId);
    setFragments((current) =>
      current.filter((fragment) => fragment.id !== fragmentId),
    );
  }

  async function saveScheme(title: string, content: string, lawIds: string[]) {
    const now = new Date().toISOString();
    const safeTitle = title.trim() || tx("schemeEditor.createTitleFallback");
    const safeContent = content.trim();

    if (editingSchemeId) {
      const savedId = editingSchemeId;
      const savedScheme = schemes.find((scheme) => scheme.id === editingSchemeId);
      const nextScheme = savedScheme
        ? {
            ...savedScheme,
            title: safeTitle,
            content: safeContent,
            lawIds,
            updatedAt: now,
          }
        : null;

      if (nextScheme) {
        await upsertPersistedScheme(nextScheme);
      }

      setSchemes((current) =>
        current.map((scheme) =>
          scheme.id === editingSchemeId
            ? {
                ...scheme,
                title: safeTitle,
                content: safeContent,
                lawIds,
                updatedAt: now,
              }
            : scheme,
        ),
      );
      setSchemeEditorOpen(false);
      setEditingSchemeId(null);
      return savedId;
    } else {
      const scheme: Scheme = {
        id: createId("scheme"),
        title: safeTitle,
        content: safeContent,
        lawIds,
        createdAt: now,
        updatedAt: now,
      };
      await upsertPersistedScheme(scheme);
      setSchemes((current) => [scheme, ...current]);
      setSchemeEditorOpen(false);
      setEditingSchemeId(null);
      return scheme.id;
    }
  }

  async function createLawFromSchemeEditor(
    title: string,
    content: string,
    tags: string[],
  ) {
    const now = new Date().toISOString();
    const safeTitle = title.trim() || tx("lawEditor.createTitleFallback");
    const law: Law = {
      id: createId("law"),
      title: safeTitle,
      content,
      tags,
      createdAt: now,
      updatedAt: now,
    };

    await upsertPersistedLaw(law);
    setLaws((current) => [law, ...current]);
    return law;
  }

  async function saveLaw(title: string, content: string, tags: string[]) {
    const now = new Date().toISOString();
    const safeTitle = title.trim() || tx("lawEditor.createTitleFallback");
    const safeContent = content.trim();

    if (editingLawId) {
      const savedId = editingLawId;
      const savedLaw = laws.find((law) => law.id === editingLawId);
      const nextLaw = savedLaw
        ? {
            ...savedLaw,
            title: safeTitle,
            content: safeContent,
            tags,
            updatedAt: now,
          }
        : null;

      if (nextLaw) {
        await upsertPersistedLaw(nextLaw);
      }

      setLaws((current) =>
        current.map((law) =>
          law.id === editingLawId
            ? {
                ...law,
                title: safeTitle,
                content: safeContent,
                tags,
                updatedAt: now,
              }
            : law,
        ),
      );
      setLawEditorOpen(false);
      setEditingLawId(null);
      return savedId;
    } else {
      const law: Law = {
        id: createId("law"),
        title: safeTitle,
        content: safeContent,
        tags,
        createdAt: now,
        updatedAt: now,
      };
      await upsertPersistedLaw(law);
      setLaws((current) => [law, ...current]);
      setLawEditorOpen(false);
      setEditingLawId(null);
      return law.id;
    }
  }

  async function deleteScheme(schemeId: string) {
    await deletePersistedScheme(schemeId);
    setSchemes((current) => current.filter((scheme) => scheme.id !== schemeId));
    setFragments((current) =>
      current.map((fragment) => ({
        ...fragment,
        drafts: fragment.drafts.filter((draft) => draft.schemeId !== schemeId),
      })),
    );
  }

  async function deleteLaw(lawId: string) {
    await deletePersistedLaw(lawId);
    setLaws((current) => current.filter((law) => law.id !== lawId));
    setSchemes((current) =>
      current.map((scheme) => ({
        ...scheme,
        lawIds: scheme.lawIds.filter((id) => id !== lawId),
      })),
    );
  }

  async function addDraft(fragmentId: string, scheme: Scheme, count: Count | number = 1) {
    const fragment = fragments.find((item) => item.id === fragmentId);

    if (!fragment) return;

    if (!resolveGenerationService(activeModel, providerKeys)) {
      showGenerationModelRequired();
      return;
    }

    const now = new Date().toISOString();
    const safeCount = Math.min(3, Math.max(1, Math.floor(count)));
    const existingDraft = fragment.drafts.find(
      (draft) => draft.schemeId === scheme.id,
    );

    if (!existingDraft) {
      const plan = createPendingDraftGenerationPlan({
        count: safeCount,
        fragment,
        laws,
        scheme,
        startVersionNo: 1,
      });
      const { draft } = plan;

      await insertPersistedDraft(fragmentId, draft, now);
      setFragments((current) =>
        current.map((item) =>
          item.id === fragmentId
            ? {
                ...item,
                updatedAt: now,
                drafts: [draft, ...item.drafts],
              }
            : item,
        ),
      );
      void requestDraftGenerations(plan.targets);
      return;
    }

    const plan = createPendingDraftGenerationPlan({
      count: safeCount,
      draftId: existingDraft.id,
      fragment,
      laws,
      scheme,
      startVersionNo: existingDraft.versions.length + 1,
    });
    const versions = plan.draft.versions;

    await insertPersistedDraftVersions(fragmentId, existingDraft.id, versions);
    setFragments((current) =>
      current.map((fragment) => {
        if (fragment.id !== fragmentId) return fragment;

        return {
          ...fragment,
          updatedAt: now,
          drafts: fragment.drafts
            .map((draft) =>
              draft.id === existingDraft.id
                ? {
                    ...draft,
                    versions: [...draft.versions, ...versions],
                  }
                : draft,
            )
            .slice()
            .sort(
              (a, b) =>
                new Date(latestDraftVersion(b)?.createdAt ?? 0).getTime() -
                new Date(latestDraftVersion(a)?.createdAt ?? 0).getTime(),
            ),
        };
      }),
    );
    void requestDraftGenerations(plan.targets);
  }

  async function appendDraftVersion(
    fragmentId: string,
    draftId: string,
    version: DraftVersion,
  ) {
    await insertPersistedDraftVersions(fragmentId, draftId, [version]);
    setFragments((current) =>
      current.map((fragment) => {
        if (fragment.id !== fragmentId) return fragment;

        return {
          ...fragment,
          updatedAt: version.createdAt,
          drafts: fragment.drafts.map((draft) =>
            draft.id === draftId
              ? {
                  ...draft,
                  versions: [...draft.versions, version],
                }
              : draft,
          ),
        };
      }),
    );
  }

  async function deleteDraftVersion(
    fragmentId: string,
    draftId: string,
    versionId: string,
  ) {
    const now = new Date().toISOString();

    await deletePersistedDraftVersion(draftId, versionId, now);
    setFragments((current) =>
      current.map((fragment) => {
        if (fragment.id !== fragmentId) return fragment;

        return {
          ...fragment,
          updatedAt: now,
          drafts: fragment.drafts.flatMap((draft) => {
            if (draft.id !== draftId) return [draft];

            const versions = draft.versions.filter(
              (version) => version.id !== versionId,
            );

            return versions.length > 0 ? [{ ...draft, versions }] : [];
          }),
        };
      }),
    );
  }

  function openSchemeEditor() {
    setEditingSchemeId(null);
    setSchemeEditorOpen(true);
  }

  function openLawEditor() {
    setEditingLawId(null);
    setLawEditorOpen(true);
  }

  function pushStack<RouteName extends keyof RootStackParamList>(
    routeName: RouteName,
    params: RootStackParamList[RouteName],
  ) {
    if (!rootNavigationRef.isReady()) return;

    rootNavigationRef.dispatch(StackActions.push(routeName, params));
  }

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <SafeAreaProvider>
        <StatusBar style={activeTheme.isDark ? "light" : "dark"} />
        <NavigationContainer ref={rootNavigationRef}>
          <RootStack.Navigator
            screenOptions={({ navigation }) => ({
              animation: "slide_from_right",
              contentStyle: { backgroundColor: colors.background },
              headerBackButtonDisplayMode: "minimal",
              headerBackButtonMenuEnabled: false,
              headerBackVisible: false,
              headerLeft: () =>
                navigation.canGoBack() ? (
                  <NavigationBackButton onPress={() => navigation.goBack()} />
                ) : null,
              headerShadowVisible: true,
              headerStyle: { backgroundColor: colors.background },
              headerTintColor: colors.text,
              headerTitleAlign: "center",
              unstable_headerLeftItems: () =>
                navigation.canGoBack()
                  ? [
                      {
                        element: (
                          <NavigationBackButton
                            onPress={() => navigation.goBack()}
                          />
                        ),
                        hidesSharedBackground: true,
                        type: "custom" as const,
                      },
                    ]
                  : [],
            })}
          >
          <RootStack.Screen name="Home" options={{ headerShown: false }}>
            {({ navigation }) => (
              <View style={styles.safeArea}>
                <View style={styles.shell}>
                  <HomeScrollView>
                    {activeTab === "fragments" ? (
                      <FragmentsView
                        fragments={fragments}
                        onOpen={(id) =>
                          navigation.push("FragmentDetail", { id })
                        }
                      />
                    ) : null}

                    {activeTab === "schemes" ? (
                      <SchemesView
                        schemes={schemes}
                        onOpen={(id) => navigation.push("SchemeDetail", { id })}
                      />
                    ) : null}

                    {activeTab === "laws" ? (
                      <LawsView
                        laws={laws}
                        onOpen={(id) => navigation.push("LawDetail", { id })}
                      />
                    ) : null}

                    {activeTab === "more" ? (
                      <MoreView
                        activeModel={activeModel}
                        activeTheme={activeTheme}
                        languageId={languageId}
                        onOpenAppearance={() =>
                          navigation.push("AppearanceSettings")
                        }
                        onOpenAbout={() => navigation.push("AboutSettings")}
                        onOpenExport={() => navigation.push("ExportSettings")}
                        onOpenImport={() => navigation.push("ImportSettings")}
                        onOpenLanguage={() =>
                          navigation.push("LanguageSettings")
                        }
                        onOpenModelSettings={() =>
                          navigation.push("ModelSettings")
                        }
                      />
                    ) : null}
                  </HomeScrollView>

                  {activeTab === "schemes" ? (
                    <PageFloatingAction
                      Icon={LibraryBig}
                      label={tx("actions.createScheme")}
                      onPress={openSchemeEditor}
                    />
                  ) : null}

                  {activeTab === "laws" ? (
                    <PageFloatingAction
                      Icon={BookOpenText}
                      label={tx("actions.collectLaw")}
                      onPress={openLawEditor}
                    />
                  ) : null}

                  <BottomNav
                    activeTab={activeTab}
                    onChange={setActiveTab}
                    onCreateFragment={() => setComposeOpen(true)}
                  />
                </View>

              </View>
            )}
          </RootStack.Screen>

          <RootStack.Screen
            name="AppearanceSettings"
            options={{
              headerTitle: () => (
                <NavigationHeaderTitle
                  description={tx("pages.settings.appearanceDescription")}
                  title={tx("pages.settings.appearanceTitle")}
                />
              ),
            }}
          >
            {() => (
              <AppearanceSettings
                activeThemeId={themeId}
                onChangeTheme={setThemeId}
              />
            )}
          </RootStack.Screen>

          <RootStack.Screen
            name="LanguageSettings"
            options={{
              headerTitle: () => (
                <NavigationHeaderTitle
                  description={tx("pages.settings.languageDescription")}
                  title={tx("pages.settings.languageTitle")}
                />
              ),
            }}
          >
            {() => (
              <LanguageSettings
                languageId={languageId}
                onChangeLanguage={setLanguageId}
              />
            )}
          </RootStack.Screen>

          <RootStack.Screen
            name="ModelSettings"
            options={{
              headerTitle: () => (
                <NavigationHeaderTitle
                  description={tx("pages.settings.modelHeaderDescription")}
                  title={tx("pages.settings.modelTitle")}
                />
              ),
            }}
          >
            {() => (
              <ModelSettings
                activeModel={activeModel}
                activeModelId={activeModelId}
                availableModels={availableModels}
                modelMenuOpen={modelMenuOpen}
                providerKeys={providerKeys}
                onChangeActiveModel={(modelId) => {
                  setActiveModelId(modelId);
                  setModelMenuOpen(false);
                }}
                onChangeProviderKey={(providerId, value) => {
                  setProviderKeys((current) => ({
                    ...current,
                    [providerId]: value,
                  }));
                }}
                onToggleModelMenu={() =>
                  setModelMenuOpen((current) => !current)
                }
              />
            )}
          </RootStack.Screen>

          <RootStack.Screen
            name="ExportSettings"
            options={{
              headerTitle: () => (
                <NavigationHeaderTitle
                  description={tx("pages.settings.exportDescription")}
                  title={tx("pages.settings.exportTitle")}
                />
              ),
            }}
          >
            {() => (
              <ExportSettings
                data={{
                  schemaVersion: backupDataSchemaVersion,
                  fragments,
                  laws,
                  schemes,
                }}
                settings={{
                  activeModelId,
                  languageId,
                  providerKeys,
                  themeId,
                  version: 1,
                }}
              />
            )}
          </RootStack.Screen>

          <RootStack.Screen
            name="ImportSettings"
            options={{
              headerTitle: () => (
                <NavigationHeaderTitle
                  description={tx("pages.settings.importDescription")}
                  title={tx("pages.settings.importTitle")}
                />
              ),
            }}
          >
            {() => (
              <ImportSettings
                onImportData={(data) => {
                  setFragments(data.fragments);
                  setLaws(data.laws);
                  setSchemes(data.schemes);
                  void replacePersistedWorkspaceData(data).catch(
                    () => undefined,
                  );
                }}
                onImportSettings={(settings) => {
                  if (isThemeId(settings.themeId)) {
                    setThemeId(settings.themeId);
                  }

                  if (isLanguageId(settings.languageId)) {
                    setLanguageId(settings.languageId);
                  }

                  if (
                    typeof settings.activeModelId === "string" ||
                    settings.activeModelId === null
                  ) {
                    setActiveModelId(settings.activeModelId);
                  }

                  if (isProviderKeys(settings.providerKeys)) {
                    setProviderKeys(settings.providerKeys);
                  }
                }}
              />
            )}
          </RootStack.Screen>

          <RootStack.Screen
            name="AboutSettings"
            options={{
              headerTitle: () => (
                <NavigationHeaderTitle
                  description={tx("pages.settings.aboutHeaderDescription")}
                  title={tx("pages.settings.aboutTitle")}
                />
              ),
            }}
          >
            {() => <AboutSettings />}
          </RootStack.Screen>

          <RootStack.Screen
            name="FragmentDetail"
            options={({ route }) => {
              const fragment = fragments.find(
                (item) => item.id === route.params.id,
              );

              return {
                headerTitle: () => (
                  <NavigationHeaderTitle
                    description={
                      fragment
                        ? formatDate(fragment.createdAt)
                        : tx("nav.backHint")
                    }
                    title={fragment?.title ?? tx("pages.fragments.missingTitle")}
                  />
                ),
              };
            }}
          >
            {({ navigation, route }) => {
              const fragment = fragments.find(
                (item) => item.id === route.params.id,
              );

              if (!fragment) {
                return (
                  <MissingStackScreen title={tx("pages.fragments.missingTitle")} />
                );
              }

              return (
                <FragmentDetail
                  fragment={fragment}
                  schemes={schemes}
                  onAddDraft={addDraft}
                  onDelete={async () => {
                    await deleteFragment(fragment.id);
                    navigation.goBack();
                  }}
                  onOpenDraft={(draftId) =>
                    navigation.push("DraftDetail", {
                      draftId,
                      fragmentId: fragment.id,
                    })
                  }
                  onUpdateContent={updateFragmentContent}
                />
              );
            }}
          </RootStack.Screen>

          <RootStack.Screen
            name="DraftDetail"
            options={({ route }) => {
              const fragment = fragments.find(
                (item) => item.id === route.params.fragmentId,
              );
              const draft = fragment?.drafts.find(
                (item) => item.id === route.params.draftId,
              );
              const scheme = draft
                ? schemes.find((item) => item.id === draft.schemeId)
                : undefined;

              return {
                headerTitle: () => (
                  <NavigationHeaderTitle
                    description={fragment?.title ?? tx("nav.backHint")}
                    title={scheme?.title ?? tx("pages.drafts.missingTitle")}
                  />
                ),
              };
            }}
          >
            {({ navigation, route }) => {
              const fragment = fragments.find(
                (item) => item.id === route.params.fragmentId,
              );
              const draft = fragment?.drafts.find(
                (item) => item.id === route.params.draftId,
              );

              if (!fragment || !draft) {
                return (
                  <MissingStackScreen title={tx("pages.drafts.missingTitle")} />
                );
              }

              const scheme = schemes.find((item) => item.id === draft.schemeId);
              const boundLaws = scheme
                ? laws.filter((law) => scheme.lawIds.includes(law.id))
                : [];

              return (
                <DraftDetail
                  draft={draft}
                  laws={boundLaws}
                  scheme={scheme}
                  onDeleteVersion={async (versionId) => {
                    const shouldLeave = draft.versions.length <= 1;

                    await deleteDraftVersion(fragment.id, draft.id, versionId);

                    if (shouldLeave) {
                      navigation.goBack();
                    }
                  }}
                  onEditVersion={async (content) => {
                    const version = createDraftVersionFromContent({
                      content,
                      sourceVersion: latestDraftVersion(draft),
                      versionNo: draft.versions.length + 1,
                    });

                    await appendDraftVersion(fragment.id, draft.id, version);
                    return version.id;
                  }}
                  onGenerate={async () => {
                    if (scheme) {
                      await addDraft(fragment.id, scheme);
                    }
                  }}
                  onRetryVersion={async (sourceVersion) => {
                    if (sourceVersion.snapshot.type === "rewrite") {
                      const plan = createPendingRewriteGenerationPlan({
                        draftId: draft.id,
                        fragmentId: fragment.id,
                        instruction: sourceVersion.snapshot.content.instruction,
                        sourceContent: sourceVersion.snapshot.content.sourceContent,
                        sourceVersionId:
                          sourceVersion.snapshot.content.sourceVersionId,
                        startVersionNo: draft.versions.length + 1,
                      });
                      const version = plan.draft.versions[0];

                      if (!version) return null;

                      await appendDraftVersion(fragment.id, draft.id, version);
                      void requestDraftGenerations(plan.targets);
                      return version.id;
                    }

                    if (!scheme) return null;

                    const plan = createPendingDraftGenerationPlan({
                      count: 1,
                      draftId: draft.id,
                      fragment,
                      laws,
                      scheme,
                      snapshot: getRetrySnapshot(sourceVersion, fragment, scheme, laws),
                      startVersionNo: draft.versions.length + 1,
                    });
                    const version = plan.draft.versions[0];

                    if (!version) return null;

                    await appendDraftVersion(fragment.id, draft.id, version);
                    void requestDraftGenerations(plan.targets);
                    return version.id;
                  }}
                  onRewriteVersion={async (sourceVersion, instruction) => {
                    const plan = createPendingRewriteGenerationPlan({
                      draftId: draft.id,
                      fragmentId: fragment.id,
                      instruction,
                      sourceContent: sourceVersion.content,
                      sourceVersionId: sourceVersion.id,
                      startVersionNo: draft.versions.length + 1,
                    });
                    const version = plan.draft.versions[0];

                    if (!version) return null;

                    await appendDraftVersion(fragment.id, draft.id, version);
                    void requestDraftGenerations(plan.targets);
                    return version.id;
                  }}
                  onViewScheme={() => {
                    if (scheme) {
                      navigation.push("SchemeDetail", { id: scheme.id });
                    }
                  }}
                />
              );
            }}
          </RootStack.Screen>

          <RootStack.Screen
            name="SchemeDetail"
            options={({ route }) => {
              const scheme = schemes.find((item) => item.id === route.params.id);

              return {
                headerTitle: () => (
                  <NavigationHeaderTitle
                    description={
                      scheme ? tx("pages.schemes.detailLabel") : tx("nav.backHint")
                    }
                    title={scheme?.title ?? tx("pages.schemes.missingTitle")}
                  />
                ),
              };
            }}
          >
            {({ navigation, route }) => {
              const scheme = schemes.find((item) => item.id === route.params.id);

              if (!scheme) {
                return (
                  <MissingStackScreen title={tx("pages.schemes.missingTitle")} />
                );
              }

              return (
                <SchemeDetail
                  fragments={fragments}
                  scheme={scheme}
                  laws={laws}
                  onDelete={async () => {
                    await deleteScheme(scheme.id);
                    navigation.goBack();
                  }}
                  onEdit={() => {
                    setEditingSchemeId(scheme.id);
                    setSchemeEditorOpen(true);
                  }}
                  onOpenFragment={(id) =>
                    navigation.push("FragmentDetail", { id })
                  }
                />
              );
            }}
          </RootStack.Screen>

          <RootStack.Screen
            name="LawDetail"
            options={({ route }) => {
              const law = laws.find((item) => item.id === route.params.id);

              return {
                headerTitle: () => (
                  <NavigationHeaderTitle
                    description={
                      law ? tx("pages.laws.detailLabel") : tx("nav.backHint")
                    }
                    title={law?.title ?? tx("pages.laws.missingTitle")}
                  />
                ),
              };
            }}
          >
            {({ navigation, route }) => {
              const law = laws.find((item) => item.id === route.params.id);

              if (!law) {
                return <MissingStackScreen title={tx("pages.laws.missingTitle")} />;
              }

              return (
                <LawDetail
                  law={law}
                  onDelete={async () => {
                    await deleteLaw(law.id);
                    navigation.goBack();
                  }}
                  onEdit={() => {
                    setEditingLawId(law.id);
                    setLawEditorOpen(true);
                  }}
                />
              );
            }}
          </RootStack.Screen>
        </RootStack.Navigator>
      </NavigationContainer>
      <ComposeSheet
        schemes={schemes}
        visible={composeOpen}
        onClose={() => setComposeOpen(false)}
        onSubmit={async (content, selection) => {
          const id = await collectFragment(content, selection);
          pushStack("FragmentDetail", { id });
        }}
      />
      <SchemeEditor
        initialScheme={editingScheme}
        laws={laws}
        visible={schemeEditorOpen}
        onClose={() => setSchemeEditorOpen(false)}
        onDismiss={() => setEditingSchemeId(null)}
        onCreateLaw={createLawFromSchemeEditor}
        onSubmit={async (name, description, lawIds) => {
          const wasEditing = Boolean(editingSchemeId);
          const id = await saveScheme(name, description, lawIds);

          if (!wasEditing) {
            pushStack("SchemeDetail", { id });
          }
        }}
      />
      <LawEditor
        initialLaw={editingLaw}
        visible={lawEditorOpen}
        onClose={() => setLawEditorOpen(false)}
        onDismiss={() => setEditingLawId(null)}
        onSubmit={async (name, content, tags) => {
          const wasEditing = Boolean(editingLawId);
          const id = await saveLaw(name, content, tags);

          if (!wasEditing) {
            pushStack("LawDetail", { id });
          }
        }}
      />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function BottomNav({
  activeTab,
  onChange,
  onCreateFragment,
}: {
  activeTab: TabId;
  onChange: (tab: TabId) => void;
  onCreateFragment: () => void;
}) {
  const leftTabs = tabs.slice(0, 2);
  const rightTabs = tabs.slice(2);
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bottomNavWrap,
        {
          bottom: Math.max(8, insets.bottom + 6),
          left: 18 + insets.left,
          right: 18 + insets.right,
        },
      ]}
    >
      <View style={styles.bottomNav}>
        {leftTabs.map((tab) => (
          <BottomNavItem
            key={tab.id}
            active={activeTab === tab.id}
            tab={tab}
            onPress={() => onChange(tab.id)}
          />
        ))}
        <View style={styles.bottomNavCenterGap} />
        {rightTabs.map((tab) => (
          <BottomNavItem
            key={tab.id}
            active={activeTab === tab.id}
            tab={tab}
            onPress={() => onChange(tab.id)}
          />
        ))}
      </View>
      <Pressable
        aria-label={tx("compose.title")}
        style={styles.bottomNavCreateButton}
        onPress={onCreateFragment}
      >
        <Plus color={colors.primaryText} size={29} strokeWidth={2.8} />
      </Pressable>
    </View>
  );
}

function BottomNavItem({
  active,
  tab,
  onPress,
}: {
  active: boolean;
  tab: (typeof tabs)[number];
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.bottomNavItem, active && styles.bottomNavItemActive]}
      onPress={onPress}
    >
      <tab.Icon
        color={active ? colors.text : colors.muted}
        size={18}
        strokeWidth={2.2}
      />
      <Text style={[styles.bottomNavText, active && styles.bottomNavTextActive]}>
        {tx(tab.labelKey)}
      </Text>
    </Pressable>
  );
}

function PageFloatingAction({
  Icon,
  label,
  onPress,
}: {
  Icon: LucideIcon;
  label: string;
  onPress: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      style={[
        styles.pageFloatingAction,
        {
          bottom: 88 + Math.max(0, insets.bottom),
          right: 18 + insets.right,
        },
      ]}
      onPress={onPress}
    >
      <Icon color={colors.primaryText} size={18} strokeWidth={2.35} />
      <Text style={styles.pageFloatingActionText}>{label}</Text>
    </Pressable>
  );
}

function HomeScrollView({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.content}
      contentContainerStyle={[
        styles.contentInner,
        {
          paddingBottom: 104 + insets.bottom,
          paddingLeft: 18 + insets.left,
          paddingRight: 18 + insets.right,
          paddingTop: 18 + insets.top,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

function StackScreenSurface({ children }: { children: ReactNode }) {
  return <View style={styles.stackSafeArea}>{children}</View>;
}

function useStackDetailPadding(extraBottom = 0) {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const safeBottom = keyboardHeight > 0 ? 0 : insets.bottom;

  return {
    paddingBottom: 28 + safeBottom + extraBottom,
    paddingLeft: 18 + insets.left,
    paddingRight: 18 + insets.right,
  };
}

function DetailScrollView({
  children,
  extraBottom = 0,
  keyboardDismissMode,
  keyboardShouldPersistTaps,
  onScroll,
  scrollEventThrottle,
  scrollRef,
}: {
  children: ReactNode;
  extraBottom?: number;
  keyboardDismissMode?: "none" | "interactive" | "on-drag";
  keyboardShouldPersistTaps?: "always" | "never" | "handled";
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle?: number;
  scrollRef?: RefObject<ScrollView | null>;
}) {
  const detailPadding = useStackDetailPadding(extraBottom);

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.detailScroll}
      automaticallyAdjustKeyboardInsets
      contentContainerStyle={[styles.detailInner, detailPadding]}
      keyboardDismissMode={keyboardDismissMode}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      onScroll={onScroll}
      scrollEventThrottle={scrollEventThrottle}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

function useCappedDetailContentHeight() {
  const { height: windowHeight } = useWindowDimensions();

  return Math.round(Math.max(220, windowHeight * 0.6));
}

function useFormTextAreaHeight(scale: number, min: number, max: number) {
  const { height: windowHeight } = useWindowDimensions();

  return Math.round(Math.min(max, Math.max(min, windowHeight * scale)));
}

function useKeyboardHeight(options?: { useEventHeightOnAndroid?: boolean }) {
  const { height: windowHeight } = useWindowDimensions();
  const useEventHeightOnAndroid = options?.useEventHeightOnAndroid ?? false;
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    function updateHeight(event: KeyboardEvent) {
      const screenY = event.endCoordinates?.screenY;
      const eventHeight = event.endCoordinates?.height ?? 0;
      const nextHeight =
        Platform.OS === "android" && useEventHeightOnAndroid
          ? eventHeight
          : typeof screenY === "number"
          ? Math.max(0, windowHeight - screenY)
          : eventHeight;

      setKeyboardHeight(Math.round(nextHeight));
    }

    function resetHeight() {
      setKeyboardHeight(0);
    }

    const subscriptions =
      Platform.OS === "ios"
        ? [
            Keyboard.addListener("keyboardWillChangeFrame", updateHeight),
            Keyboard.addListener("keyboardWillHide", resetHeight),
          ]
        : [
            Keyboard.addListener("keyboardDidShow", updateHeight),
            Keyboard.addListener("keyboardDidHide", resetHeight),
          ];

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, [useEventHeightOnAndroid, windowHeight]);

  return keyboardHeight;
}

function useAndroidKeyboardFrame() {
  const { height: windowHeight } = useWindowDimensions();
  const [keyboardFrame, setKeyboardFrame] = useState({
    height: 0,
    top: windowHeight,
  });

  useEffect(() => {
    if (Platform.OS !== "android") {
      return undefined;
    }

    function updateFrame(event: KeyboardEvent) {
      const height = event.endCoordinates?.height ?? 0;
      const screenY = event.endCoordinates?.screenY;
      const top =
        typeof screenY === "number"
          ? screenY
          : Math.max(0, windowHeight - height);

      setKeyboardFrame({ height: Math.round(height), top: Math.round(top) });
    }

    function resetFrame() {
      setKeyboardFrame({ height: 0, top: windowHeight });
    }

    const subscriptions = [
      Keyboard.addListener("keyboardDidShow", updateFrame),
      Keyboard.addListener("keyboardDidHide", resetFrame),
    ];

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, [windowHeight]);

  return keyboardFrame;
}

function useAndroidCoveredInputScrollGuard() {
  const scrollRef = useRef<ScrollView | null>(null);
  const scrollOffsetYRef = useRef(0);
  const focusedInputRef = useRef<TextInput | null>(null);
  const keyboardFrame = useAndroidKeyboardFrame();

  const ensureFocusedInputVisible = useCallback(
    (input = focusedInputRef.current) => {
      if (Platform.OS !== "android" || keyboardFrame.height <= 0 || !input) {
        return;
      }

      input.measureInWindow((_x, y, _width, height) => {
        const keyboardTop = keyboardFrame.top;
        const inputBottom = y + height;
        const visibilityMargin = 20;
        const safeInputBottom = keyboardTop - visibilityMargin;
        const scrollDelta = Math.ceil(inputBottom - safeInputBottom);

        if (scrollDelta <= 0) {
          return;
        }

        scrollRef.current?.scrollTo({
          animated: true,
          y: Math.max(0, scrollOffsetYRef.current + scrollDelta),
        });
      });
    },
    [keyboardFrame.height, keyboardFrame.top],
  );

  useEffect(() => {
    if (keyboardFrame.height <= 0) {
      return;
    }

    const timeout = setTimeout(() => ensureFocusedInputVisible(), 60);

    return () => clearTimeout(timeout);
  }, [ensureFocusedInputVisible, keyboardFrame.height]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffsetYRef.current = event.nativeEvent.contentOffset.y;
    },
    [],
  );

  const handleInputFocus = useCallback(
    (input: TextInput | null) => {
      if (Platform.OS !== "android") {
        return;
      }

      focusedInputRef.current = input;
      requestAnimationFrame(() => ensureFocusedInputVisible(input));
      setTimeout(() => ensureFocusedInputVisible(input), 260);
    },
    [ensureFocusedInputVisible],
  );

  return {
    handleInputFocus,
    handleScroll,
    keyboardHeight: keyboardFrame.height,
    scrollRef,
  };
}

function useFloatingActionBottom(gap = 14) {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const safeAreaBottom = insets.bottom;
  const restingBottom = safeAreaBottom + gap;
  const floatingBottom =
    keyboardHeight > 0 ? keyboardHeight + gap : restingBottom;

  return { floatingBottom, keyboardHeight, restingBottom, safeAreaBottom };
}

function useFloatingActionLayout(gap = 14) {
  const {
    floatingBottom,
    keyboardHeight,
    restingBottom,
    safeAreaBottom,
  } = useFloatingActionBottom(gap);
  const buttonHeight = 42;
  const scrollGap = 18;
  const activeBottom = keyboardHeight > 0 ? gap : restingBottom;
  const restingScrollBottomPadding = restingBottom + buttonHeight + scrollGap;

  return {
    floatingButtonBottom: floatingBottom,
    fullHeightInputBottomPadding:
      keyboardHeight > 0
        ? restingScrollBottomPadding + keyboardHeight - safeAreaBottom
        : restingScrollBottomPadding,
    keyboardHeight,
    restingScrollBottomPadding,
    scrollBottomPadding: activeBottom + buttonHeight + scrollGap,
  };
}

function useCenterModalOverlayStyle() {
  const keyboardHeight = useKeyboardHeight();

  return [
    styles.centerModalOverlay,
    keyboardHeight > 0 ? { paddingBottom: keyboardHeight + 24 } : null,
  ];
}

function ReadonlyContentBox({
  children,
  maxHeight,
}: {
  children: ReactNode;
  maxHeight: number;
}) {
  return (
    <View style={[styles.paperSurfaceFrame, { maxHeight }]}>
      <ScrollView
        bounces={false}
        nestedScrollEnabled
        contentContainerStyle={styles.paperSurfaceScrollInner}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.paperSurfaceText}>{children}</Text>
      </ScrollView>
    </View>
  );
}

function ModalSurface({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.modalShell}>
      <SafeAreaView
        edges={["right", "bottom", "left"]}
        style={[
          styles.modalSafeArea,
          Platform.OS === "android" ? { paddingTop: insets.top + 14 } : null,
        ]}
      >
        {children}
      </SafeAreaView>
    </View>
  );
}

function FragmentsView({
  fragments,
  onOpen,
}: {
  fragments: FragmentItem[];
  onOpen: (id: string) => void;
}) {
  return (
    <View style={styles.pageStack}>
      <PageHeader text={tx("pages.fragments.slogan")} />

      {fragments.length > 0 ? (
        <FragmentMasonry fragments={fragments} onOpen={onOpen} />
      ) : (
        <EmptyState
          title={tx("pages.fragments.emptyTitle")}
          description={tx("pages.fragments.emptyDescription")}
        />
      )}
    </View>
  );
}

function SchemesView({
  schemes,
  onOpen,
}: {
  schemes: Scheme[];
  onOpen: (id: string) => void;
}) {
  return (
    <View style={styles.pageStack}>
      <PageHeader text={tx("pages.schemes.slogan")} />

      {schemes.length > 0 ? (
        <View style={styles.listStack}>
          {schemes.map((scheme) => (
            <SchemeCard key={scheme.id} scheme={scheme} onOpen={onOpen} />
          ))}
        </View>
      ) : (
        <EmptyState
          title={tx("pages.schemes.emptyTitle")}
          description={tx("pages.schemes.emptyDescription")}
        />
      )}
      <View style={styles.pageFloatingActionSpacer} />
    </View>
  );
}

function LawsView({
  laws,
  onOpen,
}: {
  laws: Law[];
  onOpen: (id: string) => void;
}) {
  return (
    <View style={styles.pageStack}>
      <PageHeader text={tx("pages.laws.slogan")} />

      {laws.length > 0 ? (
        <View style={styles.listStack}>
          {laws.map((law) => (
            <LawCard key={law.id} law={law} onOpen={onOpen} />
          ))}
        </View>
      ) : (
        <EmptyState
          title={tx("pages.laws.emptyTitle")}
          description={tx("pages.laws.emptyDescription")}
        />
      )}
      <View style={styles.pageFloatingActionSpacer} />
    </View>
  );
}

function PageHeader({
  text,
  action,
  onAction,
}: {
  text: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.pageHeader}>
      <Text style={styles.pageHeaderText}>{text}</Text>
      {action && onAction ? (
        <Pressable style={styles.primaryButton} onPress={onAction}>
          <Plus color={colors.primaryText} size={17} strokeWidth={2.4} />
          <Text style={styles.primaryButtonText}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function FragmentMasonry({
  fragments,
  onOpen,
}: {
  fragments: FragmentItem[];
  onOpen: (id: string) => void;
}) {
  return (
    <AdaptiveMasonry
      items={fragments}
      gap={fragmentMasonryGap}
      minColumnWidth={fragmentMasonryMinColumnWidth}
      estimateItemHeight={(fragment, columnWidth) =>
        estimateFragmentCardHeight(fragment, columnWidth)
      }
      renderItem={(fragment) => (
        <FragmentCard fragment={fragment} onOpen={onOpen} />
      )}
    />
  );
}

function MoreView({
  activeModel,
  activeTheme,
  languageId,
  onOpenAppearance,
  onOpenAbout,
  onOpenExport,
  onOpenImport,
  onOpenLanguage,
  onOpenModelSettings,
}: {
  activeModel: AvailableModelOption | null;
  activeTheme: AppTheme;
  languageId: LanguageId;
  onOpenAppearance: () => void;
  onOpenAbout: () => void;
  onOpenExport: () => void;
  onOpenImport: () => void;
  onOpenLanguage: () => void;
  onOpenModelSettings: () => void;
}) {
  return (
    <View style={styles.pageStack}>
      <PageHeader text={tx("pages.settings.header")} />
      <View style={styles.moreList}>
        <MoreItem
          Icon={Palette}
          title={tx("pages.settings.appearanceTitle")}
          description={tx("pages.settings.homeAppearanceDescription", {
            theme: getThemeName(activeTheme),
          })}
          onPress={onOpenAppearance}
        />
        <MoreItem
          Icon={Languages}
          title={tx("pages.settings.languageTitle")}
          description={getLanguageName(languageId)}
          onPress={onOpenLanguage}
        />
        <MoreItem
          Icon={Bot}
          title={tx("pages.settings.modelTitle")}
          description={
            activeModel
              ? `${activeModel.providerName} · ${activeModel.name}`
              : tx("pages.settings.homeModelDescription")
          }
          onPress={onOpenModelSettings}
        />
        <MoreItem
          Icon={Download}
          title={tx("pages.settings.exportTitle")}
          description={tx("pages.settings.exportDescription")}
          onPress={onOpenExport}
        />
        <MoreItem
          Icon={Upload}
          title={tx("pages.settings.importTitle")}
          description={tx("pages.settings.importDescription")}
          onPress={onOpenImport}
        />
        <MoreItem
          Icon={Info}
          title={tx("pages.settings.aboutTitle")}
          description={tx("pages.settings.aboutDescription")}
          onPress={onOpenAbout}
        />
      </View>
    </View>
  );
}

function MoreItem({
  Icon,
  title,
  description,
  onPress,
}: {
  Icon: LucideIcon;
  title: string;
  description: string;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.moreItem} onPress={onPress}>
      <View style={styles.moreIcon}>
        <Icon color={colors.text} size={20} strokeWidth={2.1} />
      </View>
      <View style={styles.moreText}>
        <Text style={styles.moreTitle}>{title}</Text>
        <Text style={styles.moreDescription}>{description}</Text>
      </View>
      <Text style={styles.moreChevron}>›</Text>
    </Pressable>
  );
}

function AppearanceSettings({
  activeThemeId,
  onChangeTheme,
}: {
  activeThemeId: ThemeId;
  onChangeTheme: (themeId: ThemeId) => void;
}) {
  return (
    <StackScreenSurface>
      <DetailScrollView>
        <Text style={styles.settingsLead}>
          {tx("pages.settings.appearanceLead")}
        </Text>
        <View style={styles.themeGrid}>
          {themeOptions.map((theme) => (
            <Pressable
              key={theme.id}
              style={styles.themeOption}
              onPress={() => onChangeTheme(theme.id)}
            >
              <View style={styles.themeSwatchRow}>
                <View
                  style={[
                    styles.themeSwatchLarge,
                    { backgroundColor: theme.colors.background },
                  ]}
                />
                <View
                  style={[
                    styles.themeSwatch,
                    { backgroundColor: theme.colors.card },
                  ]}
                />
                <View
                  style={[
                    styles.themeSwatch,
                    { backgroundColor: theme.colors.primary },
                  ]}
                />
              </View>
              <View style={styles.settingChoiceText}>
                <Text style={styles.settingChoiceTitle}>
                  {getThemeName(theme)}
                </Text>
                <Text style={styles.settingChoiceDescription}>
                  {getThemeDescription(theme)}
                </Text>
              </View>
              <SelectionMark selected={theme.id === activeThemeId} />
            </Pressable>
          ))}
        </View>
      </DetailScrollView>
    </StackScreenSurface>
  );
}

function LanguageSettings({
  languageId,
  onChangeLanguage,
}: {
  languageId: LanguageId;
  onChangeLanguage: (languageId: LanguageId) => void;
}) {
  return (
    <StackScreenSurface>
      <DetailScrollView>
        <Text style={styles.settingsLead}>
          {tx("pages.settings.languageLead")}
        </Text>
        <View style={styles.settingsList}>
          {languageOptions.map((language) => (
            <SettingChoice
              key={language.id}
              description={getLanguageDescription(language.id)}
              selected={language.id === languageId}
              title={getLanguageName(language.id)}
              onPress={() => onChangeLanguage(language.id)}
            />
          ))}
        </View>
      </DetailScrollView>
    </StackScreenSurface>
  );
}

function ModelSettings({
  activeModel,
  activeModelId,
  availableModels,
  modelMenuOpen,
  providerKeys,
  onChangeActiveModel,
  onChangeProviderKey,
  onToggleModelMenu,
}: {
  activeModel: AvailableModelOption | null;
  activeModelId: string | null;
  availableModels: AvailableModelOption[];
  modelMenuOpen: boolean;
  providerKeys: ProviderKeys;
  onChangeActiveModel: (modelId: string) => void;
  onChangeProviderKey: (providerId: ProviderId, value: string) => void;
  onToggleModelMenu: () => void;
}) {
  const providerInputRefs = useRef<Partial<Record<ProviderId, TextInput | null>>>(
    {},
  );
  const {
    handleInputFocus,
    handleScroll,
    keyboardHeight,
    scrollRef,
  } = useAndroidCoveredInputScrollGuard();
  const modelSettingsBottomPadding =
    Platform.OS === "android" ? keyboardHeight : 0;

  return (
    <StackScreenSurface>
      <DetailScrollView
        extraBottom={modelSettingsBottomPadding}
        keyboardDismissMode={Platform.OS === "android" ? "none" : undefined}
        keyboardShouldPersistTaps="handled"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        scrollRef={scrollRef}
      >
        <Text style={styles.settingsLead}>
          {tx("pages.settings.modelLead")}
        </Text>

        <Text style={styles.sectionTitle}>
          {tx("pages.settings.activeModelTitle")}
        </Text>
        <View style={styles.providerCard}>
          <Pressable
            disabled={availableModels.length === 0}
            style={[
              styles.modelSelectButton,
              availableModels.length === 0 && styles.buttonDisabled,
            ]}
            onPress={onToggleModelMenu}
          >
            <View style={styles.settingChoiceText}>
              <Text style={styles.settingChoiceTitle}>
                {activeModel?.name ?? tx("pages.settings.noModelTitle")}
              </Text>
              <Text style={styles.settingChoiceDescription}>
                {activeModel
                  ? `${activeModel.providerName} · ${getModelDescription(activeModel)}`
                  : tx("pages.settings.noModelDescription")}
              </Text>
            </View>
            <ChevronRight
              color={colors.muted}
              size={18}
              strokeWidth={2.35}
              style={[
                styles.modelSelectChevron,
                modelMenuOpen && styles.modelSelectChevronOpen,
              ]}
            />
          </Pressable>

          {modelMenuOpen && availableModels.length > 0 ? (
            <View style={styles.modelOptionList}>
              {availableModels.map((model) => (
                <SettingChoice
                  key={model.id}
                  description={`${model.providerName} · ${getModelDescription(model)}`}
                  selected={model.id === activeModelId}
                  title={model.name}
                  onPress={() => onChangeActiveModel(model.id)}
                />
              ))}
            </View>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>
          {tx("pages.settings.serviceKeysTitle")}
        </Text>
        <View style={styles.settingsList}>
          {modelProviders.map((provider) => {
            const configured = providerKeys[provider.id].trim().length > 0;

            return (
              <View key={provider.id} style={styles.providerCard}>
                <View style={styles.providerHeader}>
                  <View style={styles.settingChoiceText}>
                    <Text style={styles.settingChoiceTitle}>{provider.name}</Text>
                    <Text style={styles.settingChoiceDescription}>
                      {tx(provider.descriptionKey)}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.providerStatus,
                      configured && styles.providerStatusActive,
                    ]}
                  >
                    {configured
                      ? tx("pages.settings.added")
                      : tx("pages.settings.notAdded")}
                  </Text>
                </View>
                <Text style={styles.inputLabel}>{provider.keyLabel}</Text>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder={provider.keyPlaceholder}
                  placeholderTextColor={colors.muted}
                  ref={(input) => {
                    providerInputRefs.current[provider.id] = input;
                  }}
                  secureTextEntry
                  style={styles.settingsInput}
                  value={providerKeys[provider.id]}
                  onChangeText={(value) =>
                    onChangeProviderKey(provider.id, value)
                  }
                  onFocus={() =>
                    handleInputFocus(providerInputRefs.current[provider.id] ?? null)
                  }
                />
              </View>
            );
          })}
        </View>
      </DetailScrollView>
    </StackScreenSurface>
  );
}

function ExportSettings({
  data,
  settings,
}: {
  data: BackupDataPayload;
  settings: PersistedMobileSettings;
}) {
  const [selection, setSelection] = useState<Record<TransferSectionId, boolean>>(
    {
      config: true,
      data: true,
    },
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const canSubmit = Object.values(selection).some(Boolean);

  function toggle(sectionId: TransferSectionId) {
    setSelection((current) => ({
      ...current,
      [sectionId]: !current[sectionId],
    }));
  }

  async function exportBundle() {
    if (!canSubmit || busy) return;

    setBusy(true);
    setStatus(null);

    try {
      await writeBackupBundle({ data, selection, settings });
      setStatus(tx("pages.settings.exportDone"));
    } catch {
      setStatus(tx("pages.settings.exportFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView edges={["right", "bottom", "left"]} style={styles.stackSafeArea}>
      <ScrollView
        style={styles.detailScroll}
        contentContainerStyle={styles.detailInner}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.settingsLead}>{tx("pages.settings.exportLead")}</Text>
        <View style={styles.settingsList}>
          {(["data", "config"] as TransferSectionId[]).map((sectionId) => (
            <TransferChoice
              key={sectionId}
              available
              selected={selection[sectionId]}
              sectionId={sectionId}
              onPress={() => toggle(sectionId)}
            />
          ))}
        </View>
        {status ? <Text style={styles.settingsLead}>{status}</Text> : null}
      </ScrollView>
      <View style={styles.modalFooterRow}>
        <Pressable
          disabled={!canSubmit || busy}
          style={[
            styles.primaryButton,
            (!canSubmit || busy) && styles.buttonDisabled,
          ]}
          onPress={exportBundle}
        >
          <Download color={colors.primaryText} size={17} strokeWidth={2.35} />
          <Text style={styles.primaryButtonText}>
            {tx("pages.settings.exportAction")}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function ImportSettings({
  onImportData,
  onImportSettings,
}: {
  onImportData: (data: BackupDataPayload) => void;
  onImportSettings: (settings: Partial<PersistedMobileSettings>) => void;
}) {
  const [available, setAvailable] =
    useState<Record<TransferSectionId, boolean> | null>(null);
  const [bundle, setBundle] = useState<ParsedBackupBundle | null>(null);
  const [selection, setSelection] = useState<Record<TransferSectionId, boolean>>(
    {
      config: false,
      data: false,
    },
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const canSubmit = Object.entries(selection).some(
    ([sectionId, selected]) =>
      selected && Boolean(available?.[sectionId as TransferSectionId]),
  );

  async function chooseFile() {
    if (busy) return;

    setBusy(true);
    setStatus(null);

    try {
      const nextBundle = await pickBackupBundle();

      if (!nextBundle) return;

      setBundle(nextBundle);
      setAvailable(nextBundle.available);
      setSelection(nextBundle.available);
      setStatus(
        tx("pages.settings.importLoaded", { fileName: nextBundle.fileName }),
      );
    } catch {
      setStatus(tx("pages.settings.importFailed"));
    } finally {
      setBusy(false);
    }
  }

  function toggle(sectionId: TransferSectionId) {
    if (!available?.[sectionId]) return;

    setSelection((current) => ({
      ...current,
      [sectionId]: !current[sectionId],
    }));
  }

  function importSelected() {
    if (!bundle || !canSubmit) return;

    if (selection.data && bundle.data) {
      onImportData(bundle.data);
    }

    if (selection.config && bundle.settings) {
      onImportSettings(bundle.settings);
    }

    setStatus(tx("pages.settings.importDone"));
  }

  return (
    <SafeAreaView edges={["right", "bottom", "left"]} style={styles.stackSafeArea}>
      <ScrollView
        style={styles.detailScroll}
        contentContainerStyle={styles.detailInner}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.settingsLead}>{tx("pages.settings.importLead")}</Text>
        <View style={styles.providerCard}>
          <Text style={styles.settingChoiceTitle}>
            {tx("pages.settings.importFileTitle")}
          </Text>
          <Text style={styles.settingChoiceDescription}>
            {tx("pages.settings.importFileDescription")}
          </Text>
          <Pressable
            disabled={busy}
            style={[styles.outlineButton, busy && styles.buttonDisabled]}
            onPress={chooseFile}
          >
            <Upload color={colors.text} size={16} strokeWidth={2.35} />
            <Text style={styles.outlineButtonText}>
              {tx("pages.settings.chooseFileAction")}
            </Text>
          </Pressable>
        </View>

        {available ? (
          <>
            <Text style={styles.sectionTitle}>
              {tx("pages.settings.importAvailableTitle")}
            </Text>
            <View style={styles.settingsList}>
              {(["data", "config"] as TransferSectionId[]).map((sectionId) => (
                <TransferChoice
                  key={sectionId}
                  available={available[sectionId]}
                  selected={selection[sectionId]}
                  sectionId={sectionId}
                  onPress={() => toggle(sectionId)}
                />
              ))}
            </View>
          </>
        ) : null}

        {status ? <Text style={styles.settingsLead}>{status}</Text> : null}
      </ScrollView>
      <View style={styles.modalFooterRow}>
        <Pressable
          disabled={!canSubmit || busy}
          style={[
            styles.primaryButton,
            (!canSubmit || busy) && styles.buttonDisabled,
          ]}
          onPress={importSelected}
        >
          <Upload color={colors.primaryText} size={17} strokeWidth={2.35} />
          <Text style={styles.primaryButtonText}>
            {tx("pages.settings.importAction")}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function TransferChoice({
  available,
  onPress,
  sectionId,
  selected,
}: {
  available: boolean;
  onPress: () => void;
  sectionId: TransferSectionId;
  selected: boolean;
}) {
  const copy = getTransferSectionCopy(sectionId);

  return (
    <Pressable
      disabled={!available}
      style={[styles.settingChoice, !available && styles.buttonDisabled]}
      onPress={onPress}
    >
      <View style={styles.settingChoiceText}>
        <View style={styles.providerHeader}>
          <Text style={styles.settingChoiceTitle}>{copy.title}</Text>
          {!available ? (
            <Text style={styles.providerStatus}>
              {tx("pages.settings.unavailable")}
            </Text>
          ) : null}
        </View>
        <Text style={styles.settingChoiceDescription}>{copy.description}</Text>
      </View>
      <SelectionMark selected={selected && available} />
    </Pressable>
  );
}

function AboutSettings() {
  const items = [
    {
      description: tx("about.versionValue"),
      title: tx("about.versionLabel"),
    },
    {
      description: tx("about.localDescription"),
      title: tx("about.localTitle"),
    },
    {
      description: tx("about.modelDescription"),
      title: tx("about.modelTitle"),
    },
    {
      description: tx("about.languageDescription"),
      title: tx("about.languageTitle"),
    },
  ];

  return (
    <StackScreenSurface>
      <DetailScrollView>
        <Text style={styles.settingsLead}>{tx("about.subtitle")}</Text>
        <View style={styles.settingsList}>
          {items.map((item) => (
            <View key={item.title} style={styles.providerCard}>
              <Text style={styles.settingChoiceTitle}>{item.title}</Text>
              <Text style={styles.settingChoiceDescription}>
                {item.description}
              </Text>
            </View>
          ))}
        </View>
      </DetailScrollView>
    </StackScreenSurface>
  );
}

function SettingChoice({
  title,
  description,
  selected,
  onPress,
}: {
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.settingChoice} onPress={onPress}>
      <View style={styles.settingChoiceText}>
        <Text style={styles.settingChoiceTitle}>{title}</Text>
        <Text style={styles.settingChoiceDescription}>{description}</Text>
      </View>
      <SelectionMark selected={selected} />
    </Pressable>
  );
}

function SelectionMark({ selected }: { selected: boolean }) {
  return (
    <View style={[styles.selectionMark, selected && styles.selectionMarkActive]}>
      {selected ? (
        <Check color={colors.primaryText} size={14} strokeWidth={3} />
      ) : null}
    </View>
  );
}

function AdaptiveMasonry<T extends { id: string }>({
  items,
  renderItem,
  minColumnWidth,
  estimateItemHeight,
  gap = 16,
}: {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  minColumnWidth: number;
  estimateItemHeight?: (item: T, columnWidth: number) => number;
  gap?: number;
}) {
  const { columnCount, columnWidth } = useColumnMetrics(minColumnWidth, gap);
  const columns = Array.from({ length: columnCount }, () => [] as T[]);
  const columnHeights = Array.from({ length: columnCount }, () => 0);

  items.forEach((item, itemIndex) => {
    if (!estimateItemHeight) {
      columns[itemIndex % columnCount]?.push(item);
      return;
    }

    let shortestColumnIndex = 0;
    columnHeights.forEach((height, index) => {
      if (height < columnHeights[shortestColumnIndex]) {
        shortestColumnIndex = index;
      }
    });

    columns[shortestColumnIndex]?.push(item);
    columnHeights[shortestColumnIndex] +=
      estimateItemHeight(item, columnWidth) + gap;
  });

  return (
    <View style={[styles.masonry, { gap }]}>
      {columns.map((column, columnIndex) => (
        <View key={columnIndex} style={[styles.masonryColumn, { gap }]}>
          {column.map((item) => (
            <View key={item.id}>{renderItem(item)}</View>
          ))}
        </View>
      ))}
    </View>
  );
}

function ResponsiveGrid<T extends { id: string }>({
  items,
  renderItem,
  minColumnWidth,
  gap = 16,
}: {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  minColumnWidth: number;
  gap?: number;
}) {
  const { width } = useWindowDimensions();
  const availableWidth = getContentWidth(width);
  const columnCount = Math.max(
    1,
    Math.floor((availableWidth + gap) / (minColumnWidth + gap)),
  );
  const itemWidth = (availableWidth - gap * (columnCount - 1)) / columnCount;

  return (
    <View style={[styles.grid, { gap }]}>
      {items.map((item) => (
        <View key={item.id} style={{ width: itemWidth }}>
          {renderItem(item)}
        </View>
      ))}
    </View>
  );
}

function FragmentCard({
  fragment,
  onOpen,
}: {
  fragment: FragmentItem;
  onOpen: (id: string) => void;
}) {
  const { columnWidth } = useColumnMetrics(
    fragmentMasonryMinColumnWidth,
    fragmentMasonryGap,
  );
  const draftCount = fragment.drafts.reduce(
    (sum, draft) => sum + draft.versions.length,
    0,
  );
  const previewHeight = estimateFragmentPreviewHeight(fragment, columnWidth);

  return (
    <Pressable
      style={styles.fragmentCardShadow}
      onPress={() => onOpen(fragment.id)}
    >
      <View style={styles.fragmentCard}>
        <View style={[styles.fragmentPreviewArea, { height: previewHeight }]}>
          <Text style={styles.fragmentPreviewText}>{fragment.content}</Text>
          <LinearGradient
            colors={[withOpacity(colors.card, 0), colors.card]}
            style={[styles.fragmentPreviewFade, styles.noPointerEvents]}
          />
        </View>

        <View style={styles.fragmentFooter}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {fragment.title}
          </Text>
          <View style={styles.simpleMetaRow}>
            <Text style={styles.mutedText}>{formatDate(fragment.createdAt)}</Text>
            {draftCount > 0 ? (
              <Text style={styles.mutedText}>
                {tx("common.draftCount", { count: draftCount })}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function SchemeCard({
  scheme,
  onOpen,
}: {
  scheme: Scheme;
  onOpen: (id: string) => void;
}) {
  return (
    <Pressable style={styles.gridCardShadow} onPress={() => onOpen(scheme.id)}>
      <View style={styles.gridCard}>
        <View style={styles.gridCardContent}>
          <Text style={styles.gridCardTitle} numberOfLines={2}>
            {scheme.title}
          </Text>
          <Text style={styles.gridCardBody} numberOfLines={5}>
            {summarize(scheme.content, 180)}
          </Text>
        </View>
        <View style={styles.gridCardFooter}>
          <Text style={styles.mutedText}>{formatDate(scheme.updatedAt)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function LawCard({
  law,
  onOpen,
}: {
  law: Law;
  onOpen: (id: string) => void;
}) {
  return (
    <Pressable style={styles.gridCardShadow} onPress={() => onOpen(law.id)}>
      <View style={styles.gridCard}>
        <View style={styles.gridCardContent}>
          <Text style={styles.gridCardTitle} numberOfLines={2}>
            {law.title}
          </Text>
          {law.tags.length > 0 ? (
            <View style={styles.tagRow}>
              {Array.from(new Set(law.tags))
                .slice(0, 3)
                .map((tag, index) => (
                  <Text key={`${law.id}-${tag}-${index}`} style={styles.tag}>
                    {tag}
                  </Text>
                ))}
            </View>
          ) : null}
          <Text style={styles.gridCardBody} numberOfLines={5}>
            {summarize(law.content, 160)}
          </Text>
        </View>
        <View style={styles.gridCardFooter}>
          <Text style={styles.mutedText}>{formatDate(law.updatedAt)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function ComposeSheet({
  schemes,
  visible,
  onClose,
  onSubmit,
}: {
  schemes: Scheme[];
  visible: boolean;
  onClose: () => void;
  onSubmit: (content: string, selection: SchemeSelection) => void;
}) {
  const [content, setContent] = useState("");
  const [selection, setSelection] = useState<SchemeSelection>(() =>
    createDefaultSchemeSelection(schemes),
  );
  const [contentFrameHeight, setContentFrameHeight] = useState(0);
  const [schemeSelectionHeight, setSchemeSelectionHeight] = useState(0);
  const insets = useSafeAreaInsets();
  const {
    floatingButtonBottom,
    keyboardHeight,
    restingScrollBottomPadding,
    scrollBottomPadding,
  } = useFloatingActionLayout();
  const composeInputMinHeight = 140;
  const composeFormGap = 18;
  const composeInputHeight =
    contentFrameHeight > 0
      ? Math.max(
          composeInputMinHeight,
          contentFrameHeight -
            restingScrollBottomPadding -
            schemeSelectionHeight -
            composeFormGap,
        )
      : composeInputMinHeight;
  const composeScrollMinHeight =
    contentFrameHeight > 0
      ? Math.max(
          0,
          contentFrameHeight -
            (keyboardHeight > 0
              ? restingScrollBottomPadding - scrollBottomPadding
              : 0),
        )
      : contentFrameHeight;
  const canSubmit = content.trim().length > 0;

  useEffect(() => {
    if (!visible) return;

    setContent("");
    setSelection(createDefaultSchemeSelection(schemes));
  }, [visible, schemes]);

  function setCount(schemeId: string, count: Count) {
    setSelection((current) => ({
      ...current,
      [schemeId]: {
        selected: true,
        count,
      },
    }));
  }

  function toggleScheme(schemeId: string) {
    setSelection((current) => {
      const item = current[schemeId] ?? { selected: false, count: 1 as Count };
      return {
        ...current,
        [schemeId]: {
          ...item,
          selected: !item.selected,
        },
      };
    });
  }

  function updateContentFrameHeight(height: number) {
    const nextHeight = Math.floor(height);

    setContentFrameHeight((current) =>
      current === nextHeight ? current : nextHeight,
    );
  }

  function updateSchemeSelectionHeight(height: number) {
    const nextHeight = Math.ceil(height);

    setSchemeSelectionHeight((current) =>
      current === nextHeight ? current : nextHeight,
    );
  }

  return (
    <Modal
      {...androidSystemBarModalProps}
      animationType="slide"
      presentationStyle="pageSheet"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalShell}>
        <SafeAreaView
          edges={["right", "left"]}
          style={[
            styles.modalSafeArea,
            Platform.OS === "android" ? { paddingTop: insets.top + 14 } : null,
          ]}
        >
          <ModalHeader
            description={tx("compose.description")}
            onClose={onClose}
            title={tx("compose.title")}
          />

          <View
            style={styles.modalContentFrame}
            onLayout={({ nativeEvent }) =>
              updateContentFrameHeight(nativeEvent.layout.height)
            }
          >
            <ScrollView
              automaticallyAdjustKeyboardInsets
              style={styles.composeScroll}
              contentContainerStyle={[
                styles.composeScrollContent,
                {
                  minHeight: composeScrollMinHeight,
                  paddingBottom: scrollBottomPadding,
                },
              ]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <TextInput
                value={content}
                onChangeText={setContent}
                multiline
                scrollEnabled
                textAlignVertical="top"
                placeholder={tx("compose.placeholder")}
                placeholderTextColor={colors.muted}
                style={[
                  styles.composeInput,
                  styles.composeInputCompact,
                  { flex: 0, height: composeInputHeight },
                ]}
              />

              <View
                onLayout={({ nativeEvent }) =>
                  updateSchemeSelectionHeight(nativeEvent.layout.height)
                }
              >
                <SchemeSelectionScroller
                  schemes={schemes}
                  selection={selection}
                  onCountChange={setCount}
                  onToggle={toggleScheme}
                />
              </View>
            </ScrollView>

            <View
              pointerEvents="box-none"
              style={[
                styles.modalFloatingAction,
                { bottom: floatingButtonBottom },
              ]}
            >
              <Pressable
                disabled={!canSubmit}
                style={[styles.primaryButton, !canSubmit && styles.buttonDisabled]}
                onPress={() => onSubmit(content.trim(), selection)}
              >
                <Text style={styles.primaryButtonIcon}>✦</Text>
                <Text style={styles.primaryButtonText}>
                  {tx("actions.collect")}
                </Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function SchemeSelectionScroller({
  schemes,
  selection,
  onCountChange,
  onToggle,
}: {
  schemes: Scheme[];
  selection: SchemeSelection;
  onCountChange: (schemeId: string, count: Count) => void;
  onToggle: (schemeId: string) => void;
}) {
  return (
    <View style={styles.schemeSelectionBlock}>
      <Text style={styles.helpText}>
        {tx("compose.schemeHelp")}
      </Text>
      <View style={styles.scrollerFrame}>
        {schemes.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.schemeRow}>
              {schemes.map((scheme) => {
                const item = selection[scheme.id] ?? {
                  selected: false,
                  count: 1 as Count,
                };

                return (
                  <View
                    key={scheme.id}
                    style={styles.schemeTile}
                  >
                    <View
                      style={[
                        styles.selectionBorderOverlay,
                        item.selected && styles.selectionBorderOverlaySelected,
                      ]}
                    />
                    <Pressable
                      style={styles.schemeTileTop}
                      onPress={() => onToggle(scheme.id)}
                    >
                      <View
                        style={[
                          styles.checkCircle,
                          item.selected && styles.checkCircleSelected,
                        ]}
                      >
                        <Text style={styles.checkText}>
                          {item.selected ? "✓" : ""}
                        </Text>
                      </View>
                      <Text style={styles.schemeTileTitle} numberOfLines={2}>
                        {scheme.title}
                      </Text>
                      <Text style={styles.schemeTileBody} numberOfLines={4}>
                        {summarize(scheme.content, 96)}
                      </Text>
                    </Pressable>
                    <View style={styles.schemeTileFooter}>
                      <Text style={styles.mutedText}>
                        {tx("common.countLabel")}
                      </Text>
                      <View style={styles.countRow}>
                        {[1, 2, 3].map((count) => (
                          <Pressable
                            key={count}
                            style={[
                              styles.countButton,
                              item.count === count && styles.countButtonActive,
                            ]}
                            onPress={() =>
                              onCountChange(scheme.id, count as Count)
                            }
                          >
                            <Text
                              style={[
                                styles.countButtonText,
                                item.count === count &&
                                  styles.countButtonTextActive,
                              ]}
                            >
                              {count}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        ) : (
          <EmptyState
            compact
            title={tx("compose.noSchemesTitle")}
            description={tx("compose.noSchemesDescription")}
          />
        )}
      </View>
    </View>
  );
}

function SchemeEditor({
  initialScheme,
  laws,
  visible,
  onClose,
  onDismiss,
  onCreateLaw,
  onSubmit,
}: {
  initialScheme?: Scheme;
  laws: Law[];
  visible: boolean;
  onClose: () => void;
  onDismiss: () => void;
  onCreateLaw: (name: string, content: string, tags: string[]) => Promise<Law>;
  onSubmit: (name: string, description: string, lawIds: string[]) => void;
}) {
  const [availableLaws, setAvailableLaws] = useState(laws);
  const [name, setName] = useState(initialScheme?.title ?? "");
  const [description, setDescription] = useState(
    initialScheme?.content ?? "",
  );
  const [lawIds, setLawIds] = useState<string[]>(initialScheme?.lawIds ?? []);
  const [quickLawName, setQuickLawName] = useState("");
  const [quickLawContent, setQuickLawContent] = useState("");
  const [quickLawTags, setQuickLawTags] = useState<string[]>([]);
  const [quickLawError, setQuickLawError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const descriptionInputHeight = useFormTextAreaHeight(0.18, 128, 220);
  const quickLawInputHeight = useFormTextAreaHeight(0.14, 104, 168);
  const {
    floatingButtonBottom,
    scrollBottomPadding,
  } = useFloatingActionLayout();
  const canSubmit = description.trim().length > 0;
  const canCreateLaw =
    quickLawName.trim().length > 0 && quickLawContent.trim().length > 0;

  useEffect(() => {
    setAvailableLaws((current) => mergeLawLists(laws, current));
  }, [laws]);

  useEffect(() => {
    if (!visible) return;

    setAvailableLaws(laws);
    setName(initialScheme?.title ?? "");
    setDescription(initialScheme?.content ?? "");
    setLawIds(initialScheme?.lawIds ?? []);
    setQuickLawName("");
    setQuickLawContent("");
    setQuickLawTags([]);
    setQuickLawError(null);
  }, [visible, initialScheme?.id]);

  function toggleLaw(lawId: string) {
    setLawIds((current) =>
      current.includes(lawId)
        ? current.filter((id) => id !== lawId)
        : [...current, lawId],
    );
  }

  async function createQuickLaw() {
    const nextName = quickLawName.trim();
    const nextContent = quickLawContent.trim();

    if (!nextName || !nextContent) {
      setQuickLawError(tx("schemeEditor.quickLawError"));
      return;
    }

    const law = await onCreateLaw(
      nextName,
      nextContent,
      quickLawTags,
    );

    setAvailableLaws((current) => mergeLawLists([law], current));
    setLawIds((current) =>
      current.includes(law.id) ? current : [law.id, ...current],
    );
    setQuickLawName("");
    setQuickLawContent("");
    setQuickLawTags([]);
    setQuickLawError(null);
  }

  return (
    <Modal
      {...androidSystemBarModalProps}
      animationType="slide"
      presentationStyle="pageSheet"
      visible={visible}
      onDismiss={onDismiss}
      onRequestClose={onClose}
    >
      <View style={styles.modalShell}>
        <SafeAreaView
          edges={["right", "left"]}
          style={[
            styles.modalSafeArea,
            Platform.OS === "android" ? { paddingTop: insets.top + 14 } : null,
          ]}
        >
          <ModalHeader
            description={tx("schemeEditor.description")}
            onClose={onClose}
            title={
              initialScheme
                ? tx("schemeEditor.editTitle")
              : tx("schemeEditor.createTitle")
            }
          />
          <View style={styles.modalContentFrame}>
          <ScrollView
            automaticallyAdjustKeyboardInsets
            style={styles.modalScroll}
            contentContainerStyle={[
              styles.formStack,
              { paddingBottom: scrollBottomPadding },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.inputLabel}>{tx("schemeEditor.nameLabel")}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={tx("schemeEditor.namePlaceholder")}
              placeholderTextColor={colors.muted}
              style={styles.singleInput}
            />
            <Text style={styles.inputLabel}>
              {tx("schemeEditor.descriptionLabel")}
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              multiline
              scrollEnabled
              textAlignVertical="top"
              placeholder={tx("schemeEditor.descriptionPlaceholder")}
              placeholderTextColor={colors.muted}
              style={[styles.noteInput, { height: descriptionInputHeight }]}
            />
            <Text style={styles.inputLabel}>{tx("schemeEditor.lawsLabel")}</Text>
            <Text style={styles.helpText}>
              {tx("schemeEditor.lawsDescription")}
            </Text>
            {availableLaws.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.lawPickScroller}
              >
                <View style={styles.lawPickGrid}>
                  {availableLaws.map((law) => {
                    const selected = lawIds.includes(law.id);
                    return (
                      <Pressable
                        key={law.id}
                        style={[
                          styles.lawPickTile,
                          selected && styles.lawPickTileSelected,
                        ]}
                        onPress={() => toggleLaw(law.id)}
                      >
                        <View
                          style={[
                            styles.lawPickSelectionBorder,
                            { opacity: selected ? 1 : 0 },
                          ]}
                        />
                        <View style={styles.lawPickTitleRow}>
                          <Text style={styles.lawPickTitle} numberOfLines={1}>
                            {law.title}
                          </Text>
                          <View
                            style={[
                              styles.lawPickCheck,
                              { opacity: selected ? 1 : 0 },
                            ]}
                          >
                            <Text style={styles.lawPickCheckText}>✓</Text>
                          </View>
                        </View>
                        <Text style={styles.lawPickBody} numberOfLines={2}>
                          {law.content}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            ) : (
              <EmptyState
                compact
                title={tx("schemeEditor.noLawsTitle")}
                description={tx("schemeEditor.noLawsDescription")}
              />
            )}

            <View style={styles.quickLawBox}>
              <View style={styles.quickLawHeader}>
                <View style={styles.quickLawHeaderText}>
                  <Text style={styles.quickLawTitle}>
                    {tx("schemeEditor.quickLawTitle")}
                  </Text>
                  <Text style={styles.quickLawDescription}>
                    {tx("schemeEditor.quickLawDescription")}
                  </Text>
                </View>
                <Pressable
                  disabled={!canCreateLaw}
                  style={[
                    styles.quickLawButton,
                    !canCreateLaw && styles.buttonDisabled,
                  ]}
                  onPress={() => {
                    void createQuickLaw();
                  }}
                >
                  <Plus color={colors.primaryText} size={15} strokeWidth={2.4} />
                  <Text style={styles.primaryButtonText}>
                    {tx("actions.collectRule")}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.quickLawFields}>
                <View style={styles.quickLawField}>
                  <Text style={styles.inputLabel}>
                    {tx("lawEditor.nameLabel")}
                  </Text>
                  <TextInput
                    value={quickLawName}
                    onChangeText={setQuickLawName}
                    placeholder={tx("lawEditor.namePlaceholder")}
                    placeholderTextColor={colors.muted}
                    style={styles.singleInput}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>{tx("lawEditor.contentLabel")}</Text>
              <TextInput
                value={quickLawContent}
                onChangeText={setQuickLawContent}
                multiline
                scrollEnabled
                textAlignVertical="top"
                placeholder={tx("lawEditor.contentPlaceholder")}
                placeholderTextColor={colors.muted}
                style={[styles.quickLawInput, { height: quickLawInputHeight }]}
              />
              <TagEditor tags={quickLawTags} onChange={setQuickLawTags} />
              {quickLawError ? (
                <Text style={styles.errorText}>{quickLawError}</Text>
              ) : null}
            </View>
          </ScrollView>
          <View
            pointerEvents="box-none"
            style={[
              styles.modalFloatingAction,
              { bottom: floatingButtonBottom },
            ]}
          >
            <Pressable
              disabled={!canSubmit}
              style={[styles.primaryButton, !canSubmit && styles.buttonDisabled]}
              onPress={() => onSubmit(name.trim(), description.trim(), lawIds)}
            >
              <Text style={styles.primaryButtonText}>
                {initialScheme
                  ? tx("actions.saveScheme")
                  : tx("actions.createSchemeSubmit")}
              </Text>
            </Pressable>
          </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function LawEditor({
  initialLaw,
  visible,
  onClose,
  onDismiss,
  onSubmit,
}: {
  initialLaw?: Law;
  visible: boolean;
  onClose: () => void;
  onDismiss: () => void;
  onSubmit: (name: string, content: string, tags: string[]) => void;
}) {
  const [name, setName] = useState(initialLaw?.title ?? "");
  const [content, setContent] = useState(initialLaw?.content ?? "");
  const [tags, setTags] = useState<string[]>(initialLaw?.tags ?? []);
  const insets = useSafeAreaInsets();
  const contentInputHeight = useFormTextAreaHeight(0.24, 150, 280);
  const {
    floatingButtonBottom,
    scrollBottomPadding,
  } = useFloatingActionLayout();
  const canSubmit = name.trim().length > 0 && content.trim().length > 0;

  useEffect(() => {
    if (!visible) return;

    setName(initialLaw?.title ?? "");
    setContent(initialLaw?.content ?? "");
    setTags(initialLaw?.tags ?? []);
  }, [visible, initialLaw?.id]);

  return (
    <Modal
      {...androidSystemBarModalProps}
      animationType="slide"
      presentationStyle="pageSheet"
      visible={visible}
      onDismiss={onDismiss}
      onRequestClose={onClose}
    >
      <View style={styles.modalShell}>
        <SafeAreaView
          edges={["right", "left"]}
          style={[
            styles.modalSafeArea,
            Platform.OS === "android" ? { paddingTop: insets.top + 14 } : null,
          ]}
        >
          <ModalHeader
            description={tx("lawEditor.description")}
            onClose={onClose}
            title={
              initialLaw ? tx("lawEditor.editTitle") : tx("lawEditor.createTitle")
            }
          />
          <View style={styles.modalContentFrame}>
          <ScrollView
            automaticallyAdjustKeyboardInsets
            style={styles.modalScroll}
            contentContainerStyle={[
              styles.formStack,
              { paddingBottom: scrollBottomPadding },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.inputLabel}>{tx("lawEditor.nameLabel")}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={tx("lawEditor.namePlaceholder")}
              placeholderTextColor={colors.muted}
              style={styles.singleInput}
            />
            <Text style={styles.inputLabel}>{tx("lawEditor.contentLabel")}</Text>
            <TextInput
              value={content}
              onChangeText={setContent}
              multiline
              scrollEnabled
              textAlignVertical="top"
              placeholder={tx("lawEditor.contentPlaceholder")}
              placeholderTextColor={colors.muted}
              style={[styles.noteInput, { height: contentInputHeight }]}
            />
            <TagEditor tags={tags} onChange={setTags} />
          </ScrollView>
          <View
            pointerEvents="box-none"
            style={[
              styles.modalFloatingAction,
              { bottom: floatingButtonBottom },
            ]}
          >
            <Pressable
              disabled={!canSubmit}
              style={[styles.primaryButton, !canSubmit && styles.buttonDisabled]}
              onPress={() =>
                onSubmit(
                  name.trim(),
                  content.trim(),
                  tags,
                )
              }
            >
              <Text style={styles.primaryButtonText}>
                {initialLaw
                  ? tx("actions.saveRevision")
                  : tx("actions.collectRule")}
              </Text>
            </Pressable>
          </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function TagEditor({
  label,
  onChange,
  tags,
}: {
  label?: string;
  onChange: (tags: string[]) => void;
  tags: string[];
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const centerModalOverlayStyle = useCenterModalOverlayStyle();

  function close() {
    setOpen(false);
    setDraft("");
  }

  function save() {
    const tag = Array.from(draft.trim())
      .slice(0, quickLawTagMaxLength)
      .join("");

    if (!tag) return;

    onChange(tags.includes(tag) ? tags : [...tags, tag]);
    close();
  }

  return (
    <View style={styles.quickLawTagSection}>
      <Text style={styles.inputLabel}>{label ?? tx("lawEditor.tagLabel")}</Text>
      <View style={styles.quickLawTagRow}>
        {tags.map((tag) => (
          <View key={tag} style={styles.quickLawTag}>
            <Text
              ellipsizeMode="tail"
              numberOfLines={1}
              style={styles.quickLawTagText}
            >
              {tag}
            </Text>
            <Pressable
              hitSlop={8}
              style={styles.quickLawTagRemoveButton}
              onPress={() => onChange(tags.filter((item) => item !== tag))}
            >
              <X color={colors.muted} size={14} strokeWidth={2.6} />
            </Pressable>
          </View>
        ))}
        <Pressable style={styles.quickLawTagAdd} onPress={() => setOpen(true)}>
          <Plus color={colors.text} size={15} strokeWidth={2.4} />
        </Pressable>
      </View>

      <Modal
        animationType="fade"
        onRequestClose={close}
        transparent
        visible={open}
      >
        <View style={centerModalOverlayStyle}>
          <View style={styles.centerModalCard}>
            <Text style={styles.centerModalTitle}>
              {tx("lawEditor.addTagTitle")}
            </Text>
            <TextInput
              autoFocus
              value={draft}
              onChangeText={setDraft}
              placeholder={tx("lawEditor.tagPlaceholder")}
              placeholderTextColor={colors.muted}
              maxLength={quickLawTagMaxLength}
              style={styles.singleInput}
            />
            <View style={styles.centerModalActions}>
              <Pressable style={styles.outlineButton} onPress={close}>
                <Text style={styles.outlineButtonText}>
                  {tx("actions.cancel")}
                </Text>
              </Pressable>
              <Pressable
                disabled={!draft.trim()}
                style={[
                  styles.primaryButton,
                  !draft.trim() && styles.buttonDisabled,
                ]}
                onPress={save}
              >
                <Text style={styles.primaryButtonText}>
                  {tx("actions.save")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ConfirmDialog({
  cancelLabel = tx("actions.cancel"),
  confirmLabel = tx("actions.confirm"),
  onCancel,
  onConfirm,
  subtitle,
  title,
  visible,
}: {
  cancelLabel?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
  subtitle: string;
  title: string;
  visible: boolean;
}) {
  function confirm() {
    onCancel();
    onConfirm();
  }

  return (
    <Modal
      animationType="fade"
      onRequestClose={onCancel}
      transparent
      visible={visible}
    >
      <View style={styles.centerModalOverlay}>
        <View style={styles.centerModalCard}>
          <Text style={styles.centerModalTitle}>{title}</Text>
          <Text style={styles.confirmDialogSubtitle}>{subtitle}</Text>
          <View style={styles.centerModalActions}>
            <Pressable style={styles.outlineButton} onPress={onCancel}>
              <Text style={styles.outlineButtonText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable style={styles.dangerButton} onPress={confirm}>
              <Text style={styles.dangerButtonText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function FragmentDetail({
  fragment,
  schemes,
  onAddDraft,
  onDelete,
  onOpenDraft,
  onUpdateContent,
}: {
  fragment: FragmentItem;
  schemes: Scheme[];
  onAddDraft: (
    fragmentId: string,
    scheme: Scheme,
    count?: Count | number,
  ) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
  onOpenDraft: (draftId: string) => void;
  onUpdateContent: (id: string, content: string) => Promise<void> | void;
}) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const detailContentMaxHeight = useCappedDetailContentHeight();
  const sortedDrafts = [...fragment.drafts].sort(
    (a, b) =>
      new Date(latestDraftVersion(b)?.createdAt ?? 0).getTime() -
      new Date(latestDraftVersion(a)?.createdAt ?? 0).getTime(),
  );

  return (
    <StackScreenSurface>
      <DetailScrollView>
        <ReadonlyContentBox maxHeight={detailContentMaxHeight}>
          {fragment.content}
        </ReadonlyContentBox>

        <View style={styles.actionRow}>
          <Pressable
            style={styles.outlineButton}
            onPress={() => setEditOpen(true)}
          >
            <PencilLine color={colors.text} size={16} strokeWidth={2.3} />
            <Text style={styles.outlineButtonText}>
              {tx("actions.editContent")}
            </Text>
          </Pressable>
          {schemes.length > 0 ? (
            <Pressable
              style={styles.primaryButton}
              onPress={() => setGenerateOpen(true)}
            >
              <WandSparkles
                color={colors.primaryText}
                size={17}
                strokeWidth={2.35}
              />
              <Text style={styles.primaryButtonText}>
                {tx("actions.draft")}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            style={styles.dangerButton}
            onPress={() => setDeleteConfirmOpen(true)}
          >
            <Text style={styles.dangerButtonText}>{tx("actions.delete")}</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>{tx("pages.drafts.sectionTitle")}</Text>

        {sortedDrafts.length > 0 ? (
          <View style={styles.listStack}>
            {sortedDrafts.map((draft) => (
              <DraftSummaryCard
                key={draft.id}
                draft={draft}
                scheme={schemes.find((scheme) => scheme.id === draft.schemeId)}
                onOpen={onOpenDraft}
              />
            ))}
          </View>
        ) : (
          <EmptyState
            compact
            title={tx("pages.drafts.emptyTitle")}
            description={tx("pages.drafts.emptyDescription")}
          />
        )}
      </DetailScrollView>
      <FragmentContentEditor
        fragment={fragment}
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        onSubmit={async (content) => {
          await onUpdateContent(fragment.id, content);
          setEditOpen(false);
        }}
      />
      <DraftGenerateSheet
        schemes={schemes}
        visible={generateOpen}
        onClose={() => setGenerateOpen(false)}
        onSubmit={async (selection) => {
          for (const scheme of schemes) {
            const item = selection[scheme.id];
            if (item?.selected) {
              await onAddDraft(fragment.id, scheme, item.count);
            }
          }
          setGenerateOpen(false);
        }}
      />
      <ConfirmDialog
        confirmLabel={tx("actions.delete")}
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={onDelete}
        subtitle={tx("fragmentDetail.deleteSubtitle")}
        title={tx("fragmentDetail.deleteTitle")}
        visible={deleteConfirmOpen}
      />
    </StackScreenSurface>
  );
}

function DraftSummaryCard({
  draft,
  onOpen,
  scheme,
}: {
  draft: Draft;
  onOpen: (id: string) => void;
  scheme?: Scheme;
}) {
  const latest = latestDraftVersion(draft);

  return (
    <Pressable style={styles.gridCardShadow} onPress={() => onOpen(draft.id)}>
      <View style={styles.gridCard}>
        <View style={styles.gridCardContent}>
          <Text style={styles.gridCardTitle} numberOfLines={2}>
            {scheme?.title ?? tx("pages.drafts.missingTitle")}
          </Text>
          <Text style={styles.gridCardBody} numberOfLines={4}>
            {summarize(latest?.content ?? tx("pages.drafts.pendingPreview"), 150)}
          </Text>
        </View>
        <View style={styles.gridCardFooter}>
          <Text style={styles.mutedText}>
            {latest ? formatDate(latest.createdAt) : tx("common.processing")}
          </Text>
          <View style={styles.footerMeta}>
            <Text style={styles.mutedText}>
              {tx("common.draftCount", { count: draft.versions.length })}
            </Text>
            <ChevronRight color={colors.muted} size={16} strokeWidth={2.3} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function DraftDetail({
  draft,
  laws,
  onDeleteVersion,
  onEditVersion,
  onGenerate,
  onRetryVersion,
  onRewriteVersion,
  onViewScheme,
  scheme,
}: {
  draft: Draft;
  laws: Law[];
  onDeleteVersion: (versionId: string) => Promise<void> | void;
  onEditVersion: (content: string) => Promise<string | null> | string | null;
  onGenerate: () => Promise<void> | void;
  onRetryVersion: (
    version: DraftVersion,
  ) => Promise<string | null> | string | null;
  onRewriteVersion: (
    version: DraftVersion,
    instruction: string,
  ) => Promise<string | null> | string | null;
  onViewScheme: () => void;
  scheme?: Scheme;
}) {
  const latest = latestDraftVersion(draft);
  const carouselRef = useRef<ICarouselInstance>(null);
  const lastSyncedCarouselIndexRef = useRef<number | null>(null);
  const insets = useSafeAreaInsets();
  const [actionVersionId, setActionVersionId] = useState<string | null>(null);
  const [deleteVersionConfirmOpen, setDeleteVersionConfirmOpen] =
    useState(false);
  const [editVersionOpen, setEditVersionOpen] = useState(false);
  const [editVersionText, setEditVersionText] = useState("");
  const [rewriteOpen, setRewriteOpen] = useState(false);
  const [rewriteText, setRewriteText] = useState("");
  const [activeVersionId, setActiveVersionId] = useState(latest?.id ?? null);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [jumpValue, setJumpValue] = useState("");
  const [lawDetailId, setLawDetailId] = useState<string | null>(null);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [carouselFrame, setCarouselFrame] = useState({ height: 0, width: 0 });
  const carouselReady = carouselFrame.width > 0 && carouselFrame.height > 0;
  const carouselCardWidth = Math.max(260, carouselFrame.width - 24);
  const detailPadding = useStackDetailPadding();
  const centerModalOverlayStyle = useCenterModalOverlayStyle();
  const rewriteKeyboardHeight = useKeyboardHeight();
  const rewriteDrawerBottomPadding =
    rewriteKeyboardHeight > 0
      ? rewriteKeyboardHeight + 14
      : Math.max(insets.bottom, 10) + 14;

  useEffect(() => {
    setActiveVersionId(latest?.id ?? null);
  }, [latest?.id]);

  const activeVersion =
    draft.versions.find((version) => version.id === activeVersionId) ?? latest;
  const actionVersion =
    draft.versions.find((version) => version.id === actionVersionId) ??
    activeVersion;
  const schemeDescription =
    scheme?.content ?? tx("pages.drafts.schemeUnavailable");
  const sourceSnapshot = actionVersion?.snapshot ?? activeVersion?.snapshot;
  const sourceSchemeDescription = getSnapshotSchemeDescription(
    sourceSnapshot,
    schemeDescription,
  );
  const sourceLaws = getSnapshotLaws(sourceSnapshot, laws);
  const selectedLaw = sourceLaws.find((law) => law.id === lawDetailId);
  const { height: windowHeight } = useWindowDimensions();
  const snapshotBoxHeight = Math.round(
    Math.min(168, Math.max(104, windowHeight * 0.14)),
  );
  const snapshotCompactBoxHeight = Math.round(
    Math.min(124, Math.max(78, windowHeight * 0.1)),
  );
  const snapshotPillBoxHeight = Math.round(
    Math.min(132, Math.max(72, windowHeight * 0.12)),
  );
  const activeVersionIndex = activeVersion
    ? draft.versions.findIndex((version) => version.id === activeVersion.id)
    : -1;
  const versionTotal = draft.versions.length;
  const activeVersionPosition =
    activeVersionIndex >= 0 ? activeVersionIndex + 1 : 0;
  const previousVersion =
    activeVersionIndex > 0 ? draft.versions[activeVersionIndex - 1] : null;
  const nextVersion =
    activeVersionIndex >= 0 && activeVersionIndex < versionTotal - 1
      ? draft.versions[activeVersionIndex + 1]
      : null;
  const draftCardStackAnimation = useMemo(() => {
    const moveSize = Math.max(1, carouselFrame.width);

    return (value: number, index: number): ViewStyle => {
      "worklet";

      const futureDistance = Math.min(1, Math.max(0, value));
      const stackDistance = Math.min(3, Math.max(0, -value));
      const translateX =
        value > 0 ? moveSize * futureDistance : -stackDistance * 10;
      const scale = 1 - stackDistance * 0.035;

      return {
        opacity: 1,
        transform: [{ translateX }, { scale }],
        zIndex: 1000 + index,
      };
    };
  }, [carouselFrame.width]);
  const jumpTarget = Number.parseInt(jumpValue, 10);
  const canJump =
    Number.isInteger(jumpTarget) &&
    jumpTarget >= 1 &&
    jumpTarget <= versionTotal;

  useEffect(() => {
    if (!carouselReady || activeVersionIndex < 0) return;

    if (lastSyncedCarouselIndexRef.current === activeVersionIndex) return;

    lastSyncedCarouselIndexRef.current = activeVersionIndex;
    requestAnimationFrame(() => {
      carouselRef.current?.scrollTo({
        animated: true,
        index: activeVersionIndex,
      });
    });
  }, [activeVersionIndex, carouselReady, versionTotal]);

  function openJumpDialog() {
    setJumpValue(String(Math.max(activeVersionPosition, 1)));
    setJumpOpen(true);
  }

  function jumpToVersion(position: number) {
    const version = draft.versions[position - 1];

    if (version) {
      goToVersion(position - 1);
    }
  }

  function confirmJump() {
    if (!canJump) return;

    jumpToVersion(jumpTarget);
    setJumpOpen(false);
  }

  function openSnapshot(version: DraftVersion) {
    setActionVersionId(version.id);
    setSnapshotOpen(true);
  }

  function openVersionEditor(version: DraftVersion) {
    setActionVersionId(version.id);
    setEditVersionText(version.content);
    setEditVersionOpen(true);
  }

  function openRewrite(version: DraftVersion) {
    setActionVersionId(version.id);
    setRewriteText("");
    setRewriteOpen(true);
  }

  async function saveVersionEdit() {
    const nextContent = editVersionText.trim();

    if (!nextContent) return;

    const nextVersionId = await onEditVersion(nextContent);
    setEditVersionOpen(false);

    if (nextVersionId) {
      setActiveVersionId(nextVersionId);
      setActionVersionId(nextVersionId);
    }
  }

  async function retryVersion(version: DraftVersion) {
    setActionVersionId(version.id);
    const nextVersionId = await onRetryVersion(version);

    if (nextVersionId) {
      setActiveVersionId(nextVersionId);
      setActionVersionId(nextVersionId);
    }
  }

  async function submitRewrite() {
    const instruction = rewriteText.trim();

    if (!instruction || !actionVersion) return;

    const nextVersionId = await onRewriteVersion(actionVersion, instruction);
    setRewriteOpen(false);

    if (nextVersionId) {
      setActiveVersionId(nextVersionId);
      setActionVersionId(nextVersionId);
    }
  }

  function askDeleteVersion(version: DraftVersion) {
    setActionVersionId(version.id);
    setDeleteVersionConfirmOpen(true);
  }

  async function confirmDeleteVersion() {
    if (!actionVersion) return;

    const removingIndex = draft.versions.findIndex(
      (version) => version.id === actionVersion.id,
    );
    const fallbackVersion =
      draft.versions[removingIndex - 1] ?? draft.versions[removingIndex + 1];

    await onDeleteVersion(actionVersion.id);
    setDeleteVersionConfirmOpen(false);

    if (fallbackVersion) {
      setActiveVersionId(fallbackVersion.id);
      setActionVersionId(fallbackVersion.id);
    }
  }

  function goToVersion(index: number) {
    const version = draft.versions[index];

    if (!version) return;

    setActiveVersionId(version.id);
    lastSyncedCarouselIndexRef.current = index;
    carouselRef.current?.scrollTo({
      animated: true,
      index,
    });
  }

  function handleCarouselSnap(index: number) {
    const version = draft.versions[index];

    if (version) {
      setActiveVersionId(version.id);
    }
  }

  function handleCarouselFrameLayout({
    nativeEvent,
  }: {
    nativeEvent: { layout: { height: number; width: number } };
  }) {
    const nextFrame = {
      height: Math.floor(nativeEvent.layout.height),
      width: Math.floor(nativeEvent.layout.width),
    };

    setCarouselFrame((current) =>
      current.height === nextFrame.height && current.width === nextFrame.width
        ? current
        : nextFrame,
    );
  }

  return (
    <StackScreenSurface>
      <View style={[styles.draftDetailInner, detailPadding]}>
        <View style={styles.draftSchemeCard}>
          <Text style={styles.draftSchemePreviewText} numberOfLines={3}>
            {scheme?.content ?? tx("pages.drafts.schemeUnavailable")}
          </Text>
          {laws.length > 0 ? (
            <View style={styles.draftLawPillRow}>
              {laws.map((law) => (
                <Text key={law.id} style={styles.tag} numberOfLines={1}>
                  {law.title}
                </Text>
              ))}
            </View>
          ) : (
            <Text style={styles.mutedText}>{tx("pages.drafts.noLaws")}</Text>
          )}
          {scheme ? (
            <View style={styles.draftSchemeActions}>
              <Pressable style={styles.outlineButton} onPress={onViewScheme}>
                <Text style={styles.outlineButtonText}>{tx("actions.view")}</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={onGenerate}>
                <WandSparkles
                  color={colors.primaryText}
                  size={17}
                  strokeWidth={2.35}
                />
                <Text style={styles.primaryButtonText}>
                  {tx("actions.draft")}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={styles.draftContentHeader}>
          <Text style={styles.sectionTitle}>{tx("pages.drafts.contentTitle")}</Text>
          <View style={styles.versionStepper}>
            <Pressable
              disabled={!previousVersion}
              style={[
                styles.versionStepperButton,
                !previousVersion && styles.versionStepperButtonDisabled,
              ]}
              onPress={() =>
                previousVersion && goToVersion(activeVersionIndex - 1)
              }
            >
              <ChevronLeft
                color={previousVersion ? colors.text : colors.muted}
                size={17}
                strokeWidth={2.35}
              />
            </Pressable>
            <Pressable
              style={styles.versionNumberButton}
              onPress={openJumpDialog}
            >
              <Text style={styles.versionNumberText}>
                {activeVersionPosition || 1}
              </Text>
            </Pressable>
            <Text style={styles.versionTotalText}>/ {versionTotal}</Text>
            <Pressable
              disabled={!nextVersion}
              style={[
                styles.versionStepperButton,
                !nextVersion && styles.versionStepperButtonDisabled,
              ]}
              onPress={() => nextVersion && goToVersion(activeVersionIndex + 1)}
            >
              <ChevronRight
                color={nextVersion ? colors.text : colors.muted}
                size={17}
                strokeWidth={2.35}
              />
            </Pressable>
          </View>
        </View>

        <View
          style={styles.draftContentCarouselFrame}
          onLayout={handleCarouselFrameLayout}
        >
          {carouselReady ? (
            <Carousel
              ref={carouselRef}
              autoFillData={false}
              customConfig={() => ({
                type: "positive",
                viewCount: versionTotal,
              })}
              customAnimation={draftCardStackAnimation}
              data={draft.versions}
              defaultIndex={Math.max(activeVersionIndex, 0)}
              enabled={versionTotal > 1}
              itemHeight={carouselFrame.height}
              itemWidth={carouselFrame.width}
              loop={false}
              onSnapToItem={handleCarouselSnap}
              pagingEnabled
              snapEnabled
              windowSize={versionTotal}
              style={[
                styles.draftContentCarousel,
                { height: carouselFrame.height, width: carouselFrame.width },
              ]}
              renderItem={({ item }) => (
                <View
                  style={[
                    styles.draftCarouselItem,
                    { height: carouselFrame.height, width: carouselFrame.width },
                  ]}
                >
                  <View
                    style={[
                      styles.draftContentCard,
                      styles.draftContentCardFill,
                      { width: carouselCardWidth },
                    ]}
                  >
                    <View style={styles.draftVersionTopRow}>
                      <View style={styles.draftVersionMeta}>
                        <Text style={styles.softBadge}>
                          {draftStatusText(item.status)}
                        </Text>
                        <Text style={styles.mutedText}>
                          {formatDate(item.createdAt)}
                        </Text>
                      </View>
                      <View style={styles.draftVersionActions}>
                        <Pressable
                          accessibilityLabel={tx("pages.drafts.snapshotA11y")}
                          style={styles.draftVersionActionButton}
                          onPress={() => openSnapshot(item)}
                        >
                          <Eye color={colors.text} size={14} strokeWidth={2.35} />
                        </Pressable>
                        <Pressable
                          accessibilityLabel={tx("pages.drafts.editA11y")}
                          style={styles.draftVersionActionButton}
                          onPress={() => openVersionEditor(item)}
                        >
                          <PencilLine
                            color={colors.text}
                            size={14}
                            strokeWidth={2.35}
                          />
                        </Pressable>
                        <Pressable
                          accessibilityLabel={tx("pages.drafts.retryA11y")}
                          style={styles.draftVersionActionButton}
                          onPress={() => retryVersion(item)}
                        >
                          <RotateCcw
                            color={colors.text}
                            size={14}
                            strokeWidth={2.35}
                          />
                        </Pressable>
                        <Pressable
                          accessibilityLabel={tx("pages.drafts.deleteA11y")}
                          style={styles.draftVersionDeleteButton}
                          onPress={() => askDeleteVersion(item)}
                        >
                          <Trash2
                            color={colors.danger}
                            size={15}
                            strokeWidth={2.35}
                          />
                        </Pressable>
                      </View>
                    </View>
                    <ScrollView
                      style={styles.draftContentScroll}
                      contentContainerStyle={styles.draftContentScrollInner}
                      showsVerticalScrollIndicator={false}
                    >
                      <Text style={styles.draftContentText}>
                        {item.content || tx("pages.drafts.pendingPreview")}
                      </Text>
                    </ScrollView>
                    <Pressable
                      accessibilityLabel={tx("pages.drafts.rewriteA11y")}
                      style={styles.draftRewriteButton}
                      onPress={() => openRewrite(item)}
                    >
                      <WandSparkles
                        color={colors.primaryText}
                        size={18}
                        strokeWidth={2.35}
                      />
                    </Pressable>
                  </View>
                </View>
              )}
            />
          ) : null}
        </View>
      </View>
      <Modal
        animationType="fade"
        onRequestClose={() => setJumpOpen(false)}
        transparent
        visible={jumpOpen}
      >
        <View style={centerModalOverlayStyle}>
          <View style={styles.centerModalCard}>
            <Text style={styles.centerModalTitle}>
              {tx("pages.drafts.jumpTitle")}
            </Text>
            <View style={styles.jumpInputRow}>
              <TextInput
                autoFocus
                keyboardType="number-pad"
                maxLength={String(Math.max(versionTotal, 1)).length}
                onChangeText={(value) => setJumpValue(value.replace(/\D/g, ""))}
                onSubmitEditing={confirmJump}
                placeholder="1"
                placeholderTextColor={colors.muted}
                style={styles.jumpInput}
                value={jumpValue}
              />
              <Text style={styles.jumpTotalText}>/ {versionTotal}</Text>
            </View>
            <View style={styles.centerModalActions}>
              <Pressable
                style={styles.outlineButton}
                onPress={() => setJumpOpen(false)}
              >
                <Text style={styles.outlineButtonText}>
                  {tx("actions.cancel")}
                </Text>
              </Pressable>
              <Pressable
                disabled={!canJump}
                style={[
                  styles.primaryButton,
                  !canJump && styles.buttonDisabled,
                ]}
                onPress={confirmJump}
              >
                <Text style={styles.primaryButtonText}>
                  {tx("actions.jump")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        animationType="fade"
        onRequestClose={() => setSnapshotOpen(false)}
        transparent
        visible={snapshotOpen}
      >
        <View style={styles.centerModalOverlay}>
          <View style={[styles.centerModalCard, styles.versionModalCard]}>
            <Text style={styles.centerModalTitle}>
              {tx("pages.drafts.sourceTitle")}
            </Text>
            <View style={styles.versionModalBody}>
              {sourceSnapshot?.type === "rewrite" ? (
                <>
                  <View style={styles.versionModalSection}>
                    <Text style={styles.versionModalLabel}>
                      {tx("pages.drafts.rewriteSourceVersionTitle")}
                    </Text>
                    <ScrollableSnapshotBox height={snapshotBoxHeight}>
                      <Text style={styles.versionModalText}>
                        {sourceSnapshot.content.sourceContent}
                      </Text>
                    </ScrollableSnapshotBox>
                  </View>
                  <View style={styles.versionModalSection}>
                    <Text style={styles.versionModalLabel}>
                      {tx("pages.drafts.rewriteInstructionTitle")}
                    </Text>
                    <ScrollableSnapshotBox height={snapshotCompactBoxHeight}>
                      <Text style={styles.versionModalText}>
                        {sourceSnapshot.content.instruction}
                      </Text>
                    </ScrollableSnapshotBox>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.versionModalSection}>
                    <Text style={styles.versionModalLabel}>
                      {tx("pages.drafts.schemeTitle")}
                    </Text>
                    <ScrollableSnapshotBox height={snapshotBoxHeight}>
                      <Text style={styles.versionModalText}>
                        {sourceSchemeDescription}
                      </Text>
                    </ScrollableSnapshotBox>
                  </View>
                  <View style={styles.versionModalSection}>
                    <Text style={styles.versionModalLabel}>
                      {tx("pages.drafts.lawsTitle")}
                    </Text>
                    {sourceLaws.length > 0 ? (
                      <View
                        style={[
                          styles.snapshotPillScrollBox,
                          { maxHeight: snapshotPillBoxHeight },
                        ]}
                      >
                        <ScrollView
                          bounces={false}
                          style={styles.snapshotPillScroll}
                          contentContainerStyle={styles.snapshotPillScrollInner}
                          showsVerticalScrollIndicator={false}
                        >
                          {sourceLaws.map((law) => (
                            <Pressable
                              key={law.id}
                              style={styles.lawPillButton}
                              onPress={() => setLawDetailId(law.id)}
                            >
                              <Text
                                style={styles.lawPillButtonText}
                                numberOfLines={1}
                              >
                                {law.title}
                              </Text>
                            </Pressable>
                          ))}
                        </ScrollView>
                      </View>
                    ) : (
                      <Text style={styles.versionModalText}>
                        {tx("pages.drafts.noLaws")}
                      </Text>
                    )}
                  </View>
                </>
              )}
            </View>
            <View style={styles.centerModalActions}>
              <Pressable
                style={styles.primaryButton}
                onPress={() => setSnapshotOpen(false)}
              >
                <Text style={styles.primaryButtonText}>
                  {tx("actions.gotIt")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        animationType="fade"
        onRequestClose={() => setLawDetailId(null)}
        transparent
        visible={Boolean(selectedLaw)}
      >
        <View style={styles.centerModalOverlay}>
          <View style={[styles.centerModalCard, styles.versionModalCard]}>
            <Text style={styles.centerModalTitle}>
              {selectedLaw?.title ?? tx("pages.drafts.lawsTitle")}
            </Text>
            <ScrollView
              style={styles.versionModalScroll}
              contentContainerStyle={styles.versionModalScrollInner}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.versionModalText}>
                {selectedLaw?.content ?? tx("pages.drafts.lawUnavailable")}
              </Text>
              {selectedLaw?.tags.length ? (
                <View style={styles.draftLawPillRow}>
                  {selectedLaw.tags.map((tag, index) => (
                    <Text
                      key={`${tag}-${index}`}
                      style={styles.tag}
                      numberOfLines={1}
                    >
                      {tag}
                    </Text>
                  ))}
                </View>
              ) : null}
            </ScrollView>
            <View style={styles.centerModalActions}>
              <Pressable
                style={styles.primaryButton}
                onPress={() => setLawDetailId(null)}
              >
                <Text style={styles.primaryButtonText}>
                  {tx("actions.gotIt")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        animationType="fade"
        onRequestClose={() => setEditVersionOpen(false)}
        transparent
        visible={editVersionOpen}
      >
        <View style={centerModalOverlayStyle}>
          <View style={[styles.centerModalCard, styles.versionEditorCard]}>
            <Text style={styles.centerModalTitle}>
              {tx("pages.drafts.editTitle")}
            </Text>
            <TextInput
              multiline
              onChangeText={setEditVersionText}
              placeholder={tx("pages.drafts.editPlaceholder")}
              placeholderTextColor={colors.muted}
              style={styles.versionEditorInput}
              textAlignVertical="top"
              value={editVersionText}
            />
            <View style={styles.centerModalActions}>
              <Pressable
                style={styles.outlineButton}
                onPress={() => setEditVersionOpen(false)}
              >
                <Text style={styles.outlineButtonText}>
                  {tx("actions.cancel")}
                </Text>
              </Pressable>
              <Pressable
                disabled={!editVersionText.trim()}
                style={[
                  styles.primaryButton,
                  !editVersionText.trim() && styles.buttonDisabled,
                ]}
                onPress={saveVersionEdit}
              >
                <Text style={styles.primaryButtonText}>
                  {tx("actions.save")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        {...androidSystemBarModalProps}
        animationType="slide"
        onRequestClose={() => setRewriteOpen(false)}
        presentationStyle="pageSheet"
        visible={rewriteOpen}
      >
        <View style={styles.modalShell}>
          <SafeAreaView
            edges={["right", "left"]}
            style={[
              styles.modalSafeArea,
              Platform.OS === "android" ? { paddingTop: insets.top + 14 } : null,
            ]}
          >
            <ModalHeader
              description={tx("pages.drafts.rewriteDescription")}
              onClose={() => setRewriteOpen(false)}
              title={tx("pages.drafts.rewriteTitle")}
            />
            <View style={styles.modalContentFrame}>
              <View
                style={[
                  styles.rewriteDrawerBody,
                  { paddingBottom: rewriteDrawerBottomPadding },
                ]}
              >
                <View style={styles.rewriteSourceCard}>
                  <Text style={styles.rewriteSourceTitle}>
                    {tx("pages.drafts.rewriteSourceTitle")}
                  </Text>
                  <ScrollView
                    style={styles.rewriteSourceScroll}
                    contentContainerStyle={styles.rewriteSourceScrollInner}
                    showsVerticalScrollIndicator={false}
                  >
                    <Text style={styles.rewriteSourceText}>
                      {actionVersion?.content || tx("pages.drafts.pendingPreview")}
                    </Text>
                  </ScrollView>
                </View>
                <View style={styles.rewriteMessageBox}>
                  <ScrollView
                    style={styles.rewriteMessageScroll}
                    contentContainerStyle={styles.rewriteMessageScrollInner}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                  >
                    <TextInput
                      multiline
                      onChangeText={setRewriteText}
                      placeholder={tx("pages.drafts.rewritePlaceholder")}
                      placeholderTextColor={colors.muted}
                      scrollEnabled={false}
                      style={styles.rewriteMessageInput}
                      textAlignVertical="top"
                      value={rewriteText}
                    />
                  </ScrollView>
                  <Pressable
                    disabled={!rewriteText.trim()}
                    style={[
                      styles.rewriteSendButton,
                      !rewriteText.trim() && styles.buttonDisabled,
                    ]}
                    onPress={submitRewrite}
                  >
                    <Send
                      color={colors.primaryText}
                      size={18}
                      strokeWidth={2.35}
                    />
                  </Pressable>
                </View>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
      <ConfirmDialog
        confirmLabel={tx("actions.delete")}
        onCancel={() => setDeleteVersionConfirmOpen(false)}
        onConfirm={confirmDeleteVersion}
        subtitle={tx("pages.drafts.deleteSubtitle")}
        title={tx("pages.drafts.deleteTitle")}
        visible={deleteVersionConfirmOpen}
      />
    </StackScreenSurface>
  );
}

function FragmentContentEditor({
  fragment,
  visible,
  onClose,
  onSubmit,
}: {
  fragment: FragmentItem;
  visible: boolean;
  onClose: () => void;
  onSubmit: (content: string) => void;
}) {
  const [content, setContent] = useState(fragment.content);
  const insets = useSafeAreaInsets();
  const {
    floatingButtonBottom,
    fullHeightInputBottomPadding,
  } = useFloatingActionLayout();
  const canSubmit = content.trim().length > 0;

  useEffect(() => {
    if (!visible) return;

    setContent(fragment.content);
  }, [visible, fragment.id, fragment.content]);

  return (
    <Modal
      {...androidSystemBarModalProps}
      animationType="slide"
      presentationStyle="pageSheet"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalShell}>
        <SafeAreaView
          edges={["right", "left"]}
          style={[
            styles.modalSafeArea,
            Platform.OS === "android" ? { paddingTop: insets.top + 14 } : null,
          ]}
        >
          <ModalHeader
            description={tx("fragmentDetail.editDescription")}
            onClose={onClose}
            title={tx("fragmentDetail.editTitle")}
          />
          <View style={styles.modalContentFrame}>
            <View
              style={[
                styles.draftEditBody,
                { paddingBottom: fullHeightInputBottomPadding },
              ]}
            >
              <TextInput
                value={content}
                onChangeText={setContent}
                multiline
                scrollEnabled
                textAlignVertical="top"
                placeholder={tx("fragmentDetail.editPlaceholder")}
                placeholderTextColor={colors.muted}
                style={[styles.composeInput, styles.fragmentEditInput]}
              />
            </View>
            <View
              pointerEvents="box-none"
              style={[
                styles.modalFloatingAction,
                { bottom: floatingButtonBottom },
              ]}
            >
              <Pressable
                disabled={!canSubmit}
                style={[styles.primaryButton, !canSubmit && styles.buttonDisabled]}
                onPress={() => onSubmit(content.trim())}
              >
                <Text style={styles.primaryButtonText}>
                  {tx("actions.confirm")}
                </Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function DraftGenerateSheet({
  schemes,
  visible,
  onClose,
  onSubmit,
}: {
  schemes: Scheme[];
  visible: boolean;
  onClose: () => void;
  onSubmit: (selection: SchemeSelection) => void;
}) {
  const [selection, setSelection] = useState<SchemeSelection>(() =>
    createDefaultSchemeSelection(schemes),
  );
  const insets = useSafeAreaInsets();
  const {
    floatingButtonBottom,
    scrollBottomPadding,
  } = useFloatingActionLayout();
  const canSubmit = Object.values(selection).some((item) => item.selected);

  useEffect(() => {
    if (!visible) return;

    setSelection(createDefaultSchemeSelection(schemes));
  }, [visible, schemes]);

  function setCount(schemeId: string, count: Count) {
    setSelection((current) => ({
      ...current,
      [schemeId]: {
        selected: true,
        count,
      },
    }));
  }

  function toggleScheme(schemeId: string) {
    setSelection((current) => {
      const item = current[schemeId] ?? { selected: false, count: 1 as Count };
      return {
        ...current,
        [schemeId]: {
          ...item,
          selected: !item.selected,
        },
      };
    });
  }

  return (
    <Modal
      {...androidSystemBarModalProps}
      animationType="slide"
      presentationStyle="pageSheet"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalShell}>
        <SafeAreaView
          edges={["right", "left"]}
          style={[
            styles.modalSafeArea,
            Platform.OS === "android" ? { paddingTop: insets.top + 14 } : null,
          ]}
        >
        <ModalHeader
          description={tx("fragmentDetail.generateDescription")}
          onClose={onClose}
          title={tx("fragmentDetail.generateTitle")}
        />
        <View style={styles.modalContentFrame}>
          <View style={styles.draftGenerateBody}>
            <DraftSchemeSelectionList
              schemes={schemes}
              selection={selection}
              bottomPadding={scrollBottomPadding}
              onCountChange={setCount}
              onToggle={toggleScheme}
            />
          </View>
          <View
            pointerEvents="box-none"
            style={[
              styles.modalFloatingAction,
              { bottom: floatingButtonBottom },
            ]}
          >
            <Pressable
              disabled={!canSubmit}
              style={[styles.primaryButton, !canSubmit && styles.buttonDisabled]}
              onPress={() => onSubmit(selection)}
            >
              <WandSparkles
                color={colors.primaryText}
                size={17}
                strokeWidth={2.35}
              />
              <Text style={styles.primaryButtonText}>{tx("actions.draft")}</Text>
            </Pressable>
          </View>
        </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function DraftSchemeSelectionList({
  schemes,
  selection,
  bottomPadding = 16,
  onCountChange,
  onToggle,
}: {
  schemes: Scheme[];
  selection: SchemeSelection;
  bottomPadding?: number;
  onCountChange: (schemeId: string, count: Count) => void;
  onToggle: (schemeId: string) => void;
}) {
  return (
    <View style={styles.draftSchemeSelectionBlock}>
      <Text style={styles.helpText}>
        {tx("fragmentDetail.generateHelp")}
      </Text>
      {schemes.length > 0 ? (
        <ScrollView
          style={styles.draftSchemeListScroll}
          contentContainerStyle={[
            styles.draftSchemeList,
            { paddingBottom: bottomPadding },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {schemes.map((scheme) => {
            const item = selection[scheme.id] ?? {
              selected: false,
              count: 1 as Count,
            };

            return (
              <View
                key={scheme.id}
                style={styles.draftSchemeListCard}
              >
                <View
                  style={[
                    styles.selectionBorderOverlay,
                    item.selected && styles.selectionBorderOverlaySelected,
                  ]}
                />
                <Pressable
                  style={styles.draftSchemeListTop}
                  onPress={() => onToggle(scheme.id)}
                >
                  <View style={styles.draftSchemeListHeader}>
                    <View
                      style={[
                        styles.checkCircle,
                        item.selected && styles.checkCircleSelected,
                      ]}
                    >
                      <Text style={styles.checkText}>
                        {item.selected ? "✓" : ""}
                      </Text>
                    </View>
                    <Text style={styles.schemeTileTitle} numberOfLines={2}>
                      {scheme.title}
                    </Text>
                  </View>
                  <Text style={styles.schemeTileBody} numberOfLines={3}>
                    {summarize(scheme.content, 120)}
                  </Text>
                </Pressable>
                <View style={styles.schemeTileFooter}>
                  <Text style={styles.mutedText}>
                    {tx("common.countLabel")}
                  </Text>
                  <View style={styles.countRow}>
                    {[1, 2, 3].map((count) => (
                      <Pressable
                        key={count}
                        style={[
                          styles.countButton,
                          item.count === count && styles.countButtonActive,
                        ]}
                        onPress={() => onCountChange(scheme.id, count as Count)}
                      >
                        <Text
                          style={[
                            styles.countButtonText,
                            item.count === count &&
                              styles.countButtonTextActive,
                          ]}
                        >
                          {count}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <EmptyState
          compact
          title={tx("compose.noSchemesTitle")}
          description={tx("fragmentDetail.noSchemesDescription")}
        />
      )}
    </View>
  );
}

function SchemeDetail({
  fragments,
  scheme,
  laws,
  onDelete,
  onEdit,
  onOpenFragment,
}: {
  fragments: FragmentItem[];
  scheme: Scheme;
  laws: Law[];
  onDelete: () => Promise<void> | void;
  onEdit: () => void;
  onOpenFragment: (id: string) => void;
}) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const detailContentMaxHeight = useCappedDetailContentHeight();
  const boundLaws = laws.filter((law) => scheme.lawIds.includes(law.id));
  const relatedFragments = fragments.filter((fragment) =>
    fragment.drafts.some((draft) => draft.schemeId === scheme.id),
  );

  return (
    <SafeAreaView edges={["right", "bottom", "left"]} style={styles.stackSafeArea}>
        <ScrollView
          style={styles.detailScroll}
          contentContainerStyle={styles.detailInner}
          showsVerticalScrollIndicator={false}
        >
          <ReadonlyContentBox maxHeight={detailContentMaxHeight}>
            {scheme.content}
          </ReadonlyContentBox>
          <Text style={styles.sectionTitle}>{tx("schemeEditor.lawsLabel")}</Text>
          {boundLaws.length > 0 ? (
            boundLaws.map((law) => (
              <View key={law.id} style={styles.lawDetailCard}>
                <Text style={styles.gridCardTitle}>{law.title}</Text>
                <Text style={styles.gridCardBody}>{law.content}</Text>
              </View>
            ))
          ) : (
            <EmptyState
              compact
              title={tx("pages.schemes.noBoundLawsTitle")}
              description={tx("pages.schemes.noBoundLawsDescription")}
            />
          )}
          <Text style={styles.sectionTitle}>
            {tx("pages.schemes.relatedFragmentsTitle")}
          </Text>
          {relatedFragments.length > 0 ? (
            <FragmentMasonry
              fragments={relatedFragments}
              onOpen={onOpenFragment}
            />
          ) : (
            <EmptyState
              compact
              title={tx("pages.schemes.noRelatedFragmentsTitle")}
              description={tx("pages.schemes.noRelatedFragmentsDescription")}
            />
          )}
        </ScrollView>
        <View style={styles.modalFooterRow}>
          <Pressable
            style={styles.dangerButton}
            onPress={() => setDeleteConfirmOpen(true)}
          >
            <Text style={styles.dangerButtonText}>{tx("actions.delete")}</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={onEdit}>
            <Text style={styles.primaryButtonText}>
              {tx("actions.editScheme")}
            </Text>
          </Pressable>
        </View>
      <ConfirmDialog
        confirmLabel={tx("actions.delete")}
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={onDelete}
        subtitle={tx("pages.schemes.deleteSubtitle", { name: scheme.title })}
        title={tx("pages.schemes.deleteTitle")}
        visible={deleteConfirmOpen}
      />
    </SafeAreaView>
  );
}

function LawDetail({
  law,
  onDelete,
  onEdit,
}: {
  law: Law;
  onDelete: () => Promise<void> | void;
  onEdit: () => void;
}) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  return (
    <SafeAreaView edges={["right", "bottom", "left"]} style={styles.stackSafeArea}>
        <ScrollView
          style={styles.detailScroll}
          contentContainerStyle={styles.detailInner}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.tagRow}>
            {law.tags.map((tag, index) => (
              <Text key={`${law.id}-detail-${tag}-${index}`} style={styles.tag}>
                {tag}
              </Text>
            ))}
          </View>
          <Text style={styles.paperSurface}>{law.content}</Text>
        </ScrollView>
        <View style={styles.modalFooterRow}>
          <Pressable
            style={styles.dangerButton}
            onPress={() => setDeleteConfirmOpen(true)}
          >
            <Text style={styles.dangerButtonText}>{tx("actions.delete")}</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={onEdit}>
            <Text style={styles.primaryButtonText}>{tx("actions.revise")}</Text>
          </Pressable>
        </View>
      <ConfirmDialog
        confirmLabel={tx("actions.delete")}
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={onDelete}
        subtitle={tx("pages.laws.deleteSubtitle", { name: law.title })}
        title={tx("pages.laws.deleteTitle")}
        visible={deleteConfirmOpen}
      />
    </SafeAreaView>
  );
}

function MissingStackScreen({ title }: { title: string }) {
  return (
    <StackScreenSurface>
      <EmptyState
        title={title}
        description={tx("common.missingContent")}
      />
    </StackScreenSurface>
  );
}

function ModalHeader({
  title,
  description,
  onClose,
}: {
  title: string;
  description: string;
  onClose: () => void;
}) {
  return (
    <Pressable
      accessible={false}
      style={styles.modalHeader}
      onPress={Keyboard.dismiss}
    >
      <View style={styles.modalHeaderText}>
        <Text style={styles.modalTitle}>{title}</Text>
        <Text style={styles.modalDescription}>{description}</Text>
      </View>
      <Pressable style={styles.closeButton} onPress={onClose}>
        <Text style={styles.closeButtonText}>{tx("actions.close")}</Text>
      </Pressable>
    </Pressable>
  );
}

function EmptyState({
  title,
  description,
  compact = false,
}: {
  title: string;
  description: string;
  compact?: boolean;
}) {
  return (
    <View style={[styles.emptyState, compact && styles.emptyStateCompact]}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
    </View>
  );
}

function ScrollableSnapshotBox({
  children,
  height,
}: {
  children: ReactNode;
  height: number;
}) {
  return (
    <View style={[styles.snapshotScrollBox, { height }]}>
      <ScrollView
        bounces={false}
        style={styles.snapshotScroll}
        contentContainerStyle={styles.snapshotScrollInner}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  );
}

function useColumnMetrics(minColumnWidth: number, gap: number) {
  const { width } = useWindowDimensions();
  const availableWidth = getContentWidth(width);
  const columnCount = Math.max(
    1,
    Math.floor((availableWidth + gap) / (minColumnWidth + gap)),
  );
  const columnWidth =
    (availableWidth - gap * Math.max(0, columnCount - 1)) / columnCount;

  return { columnCount, columnWidth };
}

function getContentWidth(width: number) {
  const horizontalPadding = 36;
  return Math.max(0, Math.min(width - horizontalPadding, 1600));
}

function estimateFragmentCardHeight(fragment: FragmentItem, columnWidth: number) {
  return estimateFragmentPreviewHeight(fragment, columnWidth) + 74;
}

function estimateFragmentPreviewHeight(
  fragment: FragmentItem,
  columnWidth: number,
) {
  const contentWidth = Math.max(80, columnWidth - 32);
  const charsPerLine = Math.max(6, Math.floor(contentWidth / 24));
  const estimatedLines = Math.ceil(fragment.content.length / charsPerLine);
  const naturalHeight = 44 + estimatedLines * 27;
  const minHeight = 108;
  const maxHeight = Math.min(260, Math.max(172, columnWidth * 0.78));

  return Math.round(Math.min(maxHeight, Math.max(minHeight, naturalHeight)));
}

function createPendingDraftGenerationPlan({
  count,
  draftId = createId("draft"),
  fragment,
  laws,
  scheme,
  snapshot,
  startVersionNo,
}: {
  count: Count | number;
  draftId?: string;
  fragment: Pick<FragmentItem, "content" | "id" | "title">;
  laws: Law[];
  scheme: Scheme;
  snapshot?: SchemeGenerationSnapshot;
  startVersionNo: number;
}): {
  draft: Draft;
  targets: DraftGenerationTarget[];
} {
  const safeCount = Math.min(3, Math.max(1, Math.floor(count)));
  const generationSnapshot =
    snapshot ?? createSchemeGenerationSnapshot({ fragment, laws, scheme });
  const createdAt = new Date().toISOString();
  const deadlineAt = new Date(
    Date.now() + generationWorkflowTimeoutMs + generationDeadlineBufferMs,
  ).toISOString();
  const versions = Array.from({ length: safeCount }, (_, index) => {
    const version: DraftVersion = {
      content: tx("pages.drafts.pendingPreview"),
      createdAt,
      deadlineAt,
      id: createId("version"),
      snapshot: generationSnapshot,
      status: "brewing",
      versionNo: startVersionNo + index,
    };

    return version;
  });

  return {
    draft: {
      id: draftId,
      schemeId: scheme.id,
      versions,
    },
    targets: versions.map((version) => ({
      draftId,
      fragmentId: fragment.id,
      payload: generationSnapshot.content,
      snapshot: generationSnapshot,
      versionId: version.id,
    })),
  };
}

function createPendingRewriteGenerationPlan({
  draftId,
  fragmentId,
  instruction,
  sourceContent,
  sourceVersionId,
  startVersionNo,
}: {
  draftId: string;
  fragmentId: string;
  instruction: string;
  sourceContent: string;
  sourceVersionId: string;
  startVersionNo: number;
}): {
  draft: Draft;
  targets: DraftGenerationTarget[];
} {
  const snapshot: RewriteGenerationSnapshot = {
    content: {
      instruction,
      sourceContent,
      sourceVersionId,
    },
    type: "rewrite",
    version: 1,
  };
  const createdAt = new Date().toISOString();
  const deadlineAt = new Date(
    Date.now() + generationWorkflowTimeoutMs + generationDeadlineBufferMs,
  ).toISOString();
  const version: DraftVersion = {
    content: tx("pages.drafts.pendingPreview"),
    createdAt,
    deadlineAt,
    id: createId("version"),
    snapshot,
    status: "brewing",
    versionNo: startVersionNo,
  };

  return {
    draft: {
      id: draftId,
      schemeId: "",
      versions: [version],
    },
    targets: [
      {
        draftId,
        fragmentId,
        payload: snapshot.content,
        snapshot,
        versionId: version.id,
      },
    ],
  };
}

function createSchemeGenerationSnapshot({
  fragment,
  laws,
  scheme,
}: {
  fragment: Pick<FragmentItem, "content" | "id" | "title">;
  laws: Law[];
  scheme: Scheme;
}): SchemeGenerationSnapshot {
  return {
    content: {
      fragment: {
        content: fragment.content,
        id: fragment.id,
        title: fragment.title,
      },
      laws: scheme.lawIds.flatMap((lawId) => {
        const law = laws.find((item) => item.id === lawId);

        return law
          ? [
              {
                content: law.content,
                id: law.id,
                title: law.title,
              },
            ]
          : [];
      }),
      scheme: {
        content: scheme.content,
        id: scheme.id,
        title: scheme.title,
      },
    },
    type: "scheme",
    version: 1,
  };
}

function getRetrySnapshot(
  sourceVersion: DraftVersion,
  fragment: FragmentItem,
  scheme: Scheme,
  laws: Law[],
) {
  return sourceVersion.snapshot.type === "scheme"
    ? sourceVersion.snapshot
    : createSchemeGenerationSnapshot({ fragment, laws, scheme });
}

function createUnavailableSnapshot(reason: string): UnavailableGenerationSnapshot {
  return {
    content: {
      reason,
    },
    type: "unavailable",
    version: 1,
  };
}

function getSnapshotSchemeDescription(
  snapshot: GenerationSnapshot | undefined,
  fallback: string,
) {
  return snapshot?.type === "scheme" ? snapshot.content.scheme.content : fallback;
}

function getSnapshotLaws(snapshot: GenerationSnapshot | undefined, fallback: Law[]) {
  if (snapshot?.type !== "scheme") return fallback;

  const now = new Date().toISOString();

  return snapshot.content.laws.map((law) => ({
    content: law.content,
    createdAt: now,
    id: law.id,
    tags: [],
    title: law.title,
    updatedAt: now,
  }));
}

function createDraftVersionFromContent({
  content,
  sourceVersion,
  versionNo,
}: {
  content: string;
  sourceVersion?: DraftVersion;
  versionNo: number;
}): DraftVersion {
  return {
    content,
    createdAt: new Date().toISOString(),
    deadlineAt: null,
    id: createId("version"),
    snapshot: sourceVersion
      ? {
          content: {
            reason: `Manual edit from ${sourceVersion.id}`,
          },
          type: "unavailable",
          version: 1,
        }
      : createUnavailableSnapshot("manual_edit"),
    status: "completed",
    versionNo,
  };
}

function latestDraftVersion(draft: Draft) {
  return draft.versions.at(-1);
}

function draftStatusText(status?: DraftVersion["status"]) {
  if (status === "brewing") return tx("status.brewing");
  if (status === "failed") return tx("status.failed");
  if (status === "expired") return tx("status.expired");
  return tx("status.completed");
}

function createFragmentTitle(content: string) {
  const firstLine = content.replace(/\s+/g, " ").trim();
  if (!firstLine) return tx("compose.createTitleFallback");
  return firstLine.length > 18 ? `${firstLine.slice(0, 18)}...` : firstLine;
}

function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function summarize(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}...`;
}

function formatDate(value: string) {
  const date = dayjs(value);

  if (!date.isValid()) return value;

  const now = dayjs();
  const localizedDate = date.locale(activeDayjsLocale);

  if (date.isAfter(now)) {
    return localizedDate.fromNow();
  }

  const calendarDayDistance = now.startOf("day").diff(date.startOf("day"), "day");

  if (calendarDayDistance === 0) {
    return localizedDate.fromNow();
  }

  if (calendarDayDistance === 1) {
    return localizedDate.calendar(now, {
      lastDay: activeI18nLanguage === "en" ? "[Yesterday]" : "[昨天]",
    });
  }

  if (calendarDayDistance < 7) {
    return localizedDate.fromNow();
  }

  return localizedDate.format(
    date.year() === now.year()
      ? activeI18nLanguage === "en"
        ? "MMM D"
        : "M月D日"
      : activeI18nLanguage === "en"
        ? "MMM D, YYYY"
        : "YYYY年M月D日",
  );
}

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function daysAgo(days: number) {
  return hoursAgo(days * 24);
}

const themeOptions: AppTheme[] = [
  {
    id: "parchment",
    name: "羊皮纸",
    description: "温暖、轻柔，适合日常记录。",
    tone: "暖黄",
    colors: {
      background: "#fbf3e8",
      card: "#fffdf8",
      cardBorder: "#e7d5bd",
      muted: "#7f7164",
      mutedBorder: "rgba(127, 113, 100, 0.5)",
      mutedSurface: "#f4eadc",
      border: "#e4d2bb",
      text: "#302117",
      primary: "#3f2415",
      primaryText: "#fff9ef",
      overlay: "rgba(48, 33, 23, 0.24)",
      secondary: "#f0e3d0",
      danger: "#b54a35",
      dangerSoft: "#f4ded7",
    },
  },
  {
    id: "sage",
    name: "青枝",
    description: "更安静的绿色调，适合长时间记录。",
    tone: "绿色",
    colors: {
      background: "#f3f7ed",
      card: "#fcfff8",
      cardBorder: "#cbdcbd",
      muted: "#62705d",
      mutedBorder: "rgba(98, 112, 93, 0.5)",
      mutedSurface: "#e7efdd",
      border: "#d2dfc5",
      text: "#1f2d1c",
      primary: "#2d4a26",
      primaryText: "#f9fff4",
      overlay: "rgba(31, 45, 28, 0.25)",
      secondary: "#deebd3",
      danger: "#ad4d3d",
      dangerSoft: "#f4ded7",
    },
  },
  {
    id: "rose",
    name: "蔷薇",
    description: "偏红但不艳，适合更柔软的心情。",
    tone: "红色",
    colors: {
      background: "#fff1ee",
      card: "#fffaf8",
      cardBorder: "#eac7bf",
      muted: "#7c615d",
      mutedBorder: "rgba(124, 97, 93, 0.5)",
      mutedSurface: "#f7e0db",
      border: "#e8cbc4",
      text: "#321b17",
      primary: "#6b302b",
      primaryText: "#fff8f5",
      overlay: "rgba(50, 27, 23, 0.25)",
      secondary: "#f1d6cf",
      danger: "#b54a35",
      dangerSoft: "#f4ded7",
    },
  },
  {
    id: "sky",
    name: "晴蓝",
    description: "清爽、克制，适合把内容看清楚。",
    tone: "蓝色",
    colors: {
      background: "#eef6f8",
      card: "#fbfeff",
      cardBorder: "#bfd4df",
      muted: "#5d6f78",
      mutedBorder: "rgba(93, 111, 120, 0.5)",
      mutedSurface: "#e0edf2",
      border: "#cadce4",
      text: "#172a34",
      primary: "#21485a",
      primaryText: "#f6fcff",
      overlay: "rgba(23, 42, 52, 0.25)",
      secondary: "#d6e8ef",
      danger: "#ad4d3d",
      dangerSoft: "#f4ded7",
    },
  },
  {
    id: "mint",
    name: "薄荷",
    description: "更清新的浅色调，留白感更强。",
    tone: "清新",
    colors: {
      background: "#eff9f3",
      card: "#fbfffc",
      cardBorder: "#bfddca",
      muted: "#5e7066",
      mutedBorder: "rgba(94, 112, 102, 0.5)",
      mutedSurface: "#dff0e6",
      border: "#c8dfd1",
      text: "#1b2d24",
      primary: "#27523f",
      primaryText: "#f7fff9",
      overlay: "rgba(27, 45, 36, 0.25)",
      secondary: "#d4eadc",
      danger: "#ad4d3d",
      dangerSoft: "#f4ded7",
    },
  },
  {
    id: "dark",
    name: "夜色",
    description: "暗黑模式，适合夜里低亮度使用。",
    tone: "Dark",
    isDark: true,
    colors: {
      background: "#17120e",
      card: "#211a14",
      cardBorder: "#4d3b2b",
      muted: "#c5ad94",
      mutedBorder: "rgba(197, 173, 148, 0.45)",
      mutedSurface: "#2d241b",
      border: "#4a3929",
      text: "#f8ead8",
      primary: "#e3bd8c",
      primaryText: "#24170e",
      overlay: "rgba(8, 5, 3, 0.58)",
      secondary: "#382b20",
      danger: "#f09a84",
      dangerSoft: "#44231d",
    },
  },
];

const themesById = Object.fromEntries(
  themeOptions.map((theme) => [theme.id, theme]),
) as Record<ThemeId, AppTheme>;

const themedStyleCache = new Map<ThemeId, ReturnType<typeof createThemedStyles>>();

let colors: ThemeColors = themesById.parchment.colors;
let styles = getThemedStyles(themesById.parchment);

function getTheme(themeId: ThemeId) {
  return themesById[themeId] ?? themesById.parchment;
}

function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && value in themesById;
}

function isLanguageId(value: unknown): value is LanguageId {
  return languageOptions.some((language) => language.id === value);
}

function applyTheme(themeId: ThemeId) {
  const theme = getTheme(themeId);
  colors = theme.colors;
  styles = getThemedStyles(theme);
}

function getThemedStyles(theme: AppTheme) {
  const cached = themedStyleCache.get(theme.id);
  if (cached) return cached;

  const nextStyles = createThemedStyles(theme.colors);
  themedStyleCache.set(theme.id, nextStyles);
  return nextStyles;
}

function getLanguageOption(languageId: LanguageId) {
  return (
    languageOptions.find((language) => language.id === languageId) ??
    languageOptions[0]
  );
}

function getLanguageName(languageId: LanguageId) {
  const language = getLanguageOption(languageId);

  return language.nativeName ?? tx(language.nameKey ?? "");
}

function getLanguageDescription(languageId: LanguageId) {
  return tx(getLanguageOption(languageId).descriptionKey);
}

const themeCopyKeys: Record<
  ThemeId,
  {
    description: string;
    name: string;
  }
> = {
  dark: {
    description: "settings.themes.darkDescription",
    name: "settings.themes.darkName",
  },
  mint: {
    description: "settings.themes.mintDescription",
    name: "settings.themes.mintName",
  },
  parchment: {
    description: "settings.themes.parchmentDescription",
    name: "settings.themes.parchmentName",
  },
  rose: {
    description: "settings.themes.roseDescription",
    name: "settings.themes.roseName",
  },
  sage: {
    description: "settings.themes.sageDescription",
    name: "settings.themes.sageName",
  },
  sky: {
    description: "settings.themes.skyDescription",
    name: "settings.themes.skyName",
  },
};

function getThemeName(theme: AppTheme) {
  return tx(themeCopyKeys[theme.id].name);
}

function getThemeDescription(theme: AppTheme) {
  return tx(themeCopyKeys[theme.id].description);
}

function getModelDescription(model: ModelOption) {
  return tx(model.descriptionKey);
}

type WorkspaceDatabase = Awaited<ReturnType<typeof SQLite.openDatabaseAsync>>;

type FragmentRow = {
  content: string;
  created_at: string;
  id: string;
  title: string;
  updated_at: string;
};

type SchemeRow = {
  content: string;
  created_at: string;
  id: string;
  title: string;
  updated_at: string;
};

type SchemeLawRow = {
  law_id: string;
  scheme_id: string;
  sort: number;
};

type LawRow = {
  content: string;
  created_at: string;
  id: string;
  tags_json: string;
  title: string;
  updated_at: string;
};

type DraftRow = {
  created_at: string;
  fragment_id: string;
  id: string;
  scheme_id: string;
  updated_at: string;
};

type DraftVersionRow = {
  content: string;
  created_at: string;
  deadline_at: string | null;
  draft_id: string;
  id: string;
  snapshot_json: string;
  status: string;
  version_no: number;
};

let workspaceDatabasePromise: Promise<WorkspaceDatabase> | null = null;

async function readPersistedWorkspaceData(): Promise<BackupDataPayload> {
  if (Platform.OS === "web") {
    return { schemaVersion: backupDataSchemaVersion, fragments: [], laws: [], schemes: [] };
  }

  const db = await getWorkspaceDatabase();
  const [lawRows, schemeRows, schemeLawRows, fragmentRows, draftRows, versionRows] =
    await Promise.all([
      db.getAllAsync<LawRow>(
        "SELECT * FROM laws ORDER BY updated_at DESC, created_at DESC",
      ),
      db.getAllAsync<SchemeRow>(
        "SELECT * FROM schemes ORDER BY updated_at DESC, created_at DESC",
      ),
      db.getAllAsync<SchemeLawRow>(
        "SELECT * FROM scheme_laws ORDER BY scheme_id ASC, sort ASC",
      ),
      db.getAllAsync<FragmentRow>(
        "SELECT * FROM fragments ORDER BY updated_at DESC, created_at DESC",
      ),
      db.getAllAsync<DraftRow>(
        "SELECT * FROM drafts ORDER BY updated_at DESC, created_at DESC",
      ),
      db.getAllAsync<DraftVersionRow>(
        "SELECT * FROM draft_versions ORDER BY draft_id ASC, version_no ASC",
      ),
    ]);

  const lawIdsBySchemeId = new Map<string, string[]>();
  schemeLawRows.forEach((row) => {
    const ids = lawIdsBySchemeId.get(row.scheme_id) ?? [];
    ids.push(row.law_id);
    lawIdsBySchemeId.set(row.scheme_id, ids);
  });

  const versionsByDraftId = new Map<string, DraftVersion[]>();
  versionRows.forEach((row) => {
    const versions = versionsByDraftId.get(row.draft_id) ?? [];
    versions.push({
      content: row.content,
      createdAt: row.created_at,
      deadlineAt: row.deadline_at,
      id: row.id,
      snapshot: parseGenerationSnapshot(row.snapshot_json),
      status: parseDraftStatus(row.status),
      versionNo: row.version_no,
    });
    versionsByDraftId.set(row.draft_id, versions);
  });

  const draftsByFragmentId = new Map<string, Draft[]>();
  draftRows.forEach((row) => {
    const versions = versionsByDraftId.get(row.id) ?? [];

    if (versions.length === 0) return;

    const drafts = draftsByFragmentId.get(row.fragment_id) ?? [];
    drafts.push({
      id: row.id,
      schemeId: row.scheme_id,
      versions,
    });
    draftsByFragmentId.set(row.fragment_id, drafts);
  });

  return {
    schemaVersion: backupDataSchemaVersion,
    fragments: fragmentRows.map((row) => ({
      content: row.content,
      createdAt: row.created_at,
      drafts: (draftsByFragmentId.get(row.id) ?? [])
        .slice()
        .sort(
          (a, b) =>
            new Date(latestDraftVersion(b)?.createdAt ?? 0).getTime() -
            new Date(latestDraftVersion(a)?.createdAt ?? 0).getTime(),
        ),
      id: row.id,
      title: row.title,
      updatedAt: row.updated_at,
    })),
    laws: lawRows.map((row) => ({
      content: row.content,
      createdAt: row.created_at,
      id: row.id,
      tags: parseStringArray(row.tags_json),
      title: row.title,
      updatedAt: row.updated_at,
    })),
    schemes: schemeRows.map((row) => ({
      content: row.content,
      createdAt: row.created_at,
      id: row.id,
      lawIds: lawIdsBySchemeId.get(row.id) ?? [],
      title: row.title,
      updatedAt: row.updated_at,
    })),
  };
}

async function insertPersistedFragment(fragment: FragmentItem) {
  if (Platform.OS === "web") return;

  await runWorkspaceTransaction(async (db) => {
    await insertFragmentRow(db, fragment);
  });
}

async function updatePersistedFragmentContent(
  fragmentId: string,
  content: string,
  updatedAt: string,
) {
  if (Platform.OS === "web") return;

  const db = await getWorkspaceDatabase();
  await db.runAsync(
    "UPDATE fragments SET content = ?, updated_at = ? WHERE id = ?",
    content,
    updatedAt,
    fragmentId,
  );
}

async function updatePersistedFragmentTitle(
  fragmentId: string,
  title: string,
  updatedAt: string,
) {
  if (Platform.OS === "web") return;

  const db = await getWorkspaceDatabase();
  await db.runAsync(
    "UPDATE fragments SET title = ?, updated_at = ? WHERE id = ?",
    title,
    updatedAt,
    fragmentId,
  );
}

async function deletePersistedFragment(fragmentId: string) {
  if (Platform.OS === "web") return;

  const db = await getWorkspaceDatabase();
  await db.runAsync("DELETE FROM fragments WHERE id = ?", fragmentId);
}

async function upsertPersistedScheme(scheme: Scheme) {
  if (Platform.OS === "web") return;

  await runWorkspaceTransaction(async (db) => {
    await upsertSchemeRow(db, scheme);
  });
}

async function deletePersistedScheme(schemeId: string) {
  if (Platform.OS === "web") return;

  const db = await getWorkspaceDatabase();
  await db.runAsync("DELETE FROM schemes WHERE id = ?", schemeId);
}

async function upsertPersistedLaw(law: Law) {
  if (Platform.OS === "web") return;

  const db = await getWorkspaceDatabase();
  await upsertLawRow(db, law);
}

async function deletePersistedLaw(lawId: string) {
  if (Platform.OS === "web") return;

  await runWorkspaceTransaction(async (db) => {
    await db.runAsync("DELETE FROM scheme_laws WHERE law_id = ?", lawId);
    await db.runAsync("DELETE FROM laws WHERE id = ?", lawId);
  });
}

async function insertPersistedDraft(
  fragmentId: string,
  draft: Draft,
  fragmentUpdatedAt: string,
) {
  if (Platform.OS === "web") return;

  await runWorkspaceTransaction(async (db) => {
    await insertDraftRow(db, fragmentId, draft);
    await db.runAsync(
      "UPDATE fragments SET updated_at = ? WHERE id = ?",
      fragmentUpdatedAt,
      fragmentId,
    );
  });
}

async function insertPersistedDraftVersions(
  fragmentId: string,
  draftId: string,
  versions: DraftVersion[],
) {
  if (Platform.OS === "web" || versions.length === 0) return;

  const updatedAt = versions.at(-1)?.createdAt ?? new Date().toISOString();

  await runWorkspaceTransaction(async (db) => {
    for (const version of versions) {
      await insertDraftVersionRow(db, draftId, version);
    }

    await db.runAsync(
      "UPDATE drafts SET updated_at = ? WHERE id = ?",
      updatedAt,
      draftId,
    );
    await db.runAsync(
      "UPDATE fragments SET updated_at = ? WHERE id = ?",
      updatedAt,
      fragmentId,
    );
  });
}

async function updatePersistedDraftVersion(
  versionId: string,
  patch: Partial<Pick<DraftVersion, "content" | "deadlineAt" | "status">>,
) {
  if (Platform.OS === "web") return;

  const updates: string[] = [];
  const values: Array<string | null> = [];

  if (patch.content !== undefined) {
    updates.push("content = ?");
    values.push(patch.content);
  }

  if (patch.deadlineAt !== undefined) {
    updates.push("deadline_at = ?");
    values.push(patch.deadlineAt);
  }

  if (patch.status !== undefined) {
    updates.push("status = ?");
    values.push(patch.status);
  }

  if (updates.length === 0) return;

  const db = await getWorkspaceDatabase();
  await db.runAsync(
    `UPDATE draft_versions SET ${updates.join(", ")} WHERE id = ?`,
    ...values,
    versionId,
  );
}

async function deletePersistedDraftVersion(
  draftId: string,
  versionId: string,
  fragmentUpdatedAt: string,
) {
  if (Platform.OS === "web") return;

  await runWorkspaceTransaction(async (db) => {
    const draft = await db.getFirstAsync<{ fragment_id: string }>(
      "SELECT fragment_id FROM drafts WHERE id = ?",
      draftId,
    );

    await db.runAsync("DELETE FROM draft_versions WHERE id = ?", versionId);
    await db.runAsync(
      `DELETE FROM drafts
       WHERE id = ?
       AND NOT EXISTS (
         SELECT 1 FROM draft_versions WHERE draft_versions.draft_id = drafts.id
       )`,
      draftId,
    );

    if (draft?.fragment_id) {
      await db.runAsync(
        "UPDATE fragments SET updated_at = ? WHERE id = ?",
        fragmentUpdatedAt,
        draft.fragment_id,
      );
    }
  });
}

async function replacePersistedWorkspaceData(data: BackupDataPayload) {
  if (Platform.OS === "web") return;

  await runWorkspaceTransaction(async (db) => {
    await clearWorkspaceTables(db);

    for (const law of data.laws) {
      await upsertLawRow(db, law);
    }

    for (const scheme of data.schemes) {
      await upsertSchemeRow(db, scheme);
    }

    for (const fragment of data.fragments) {
      await insertFragmentRow(db, fragment);
    }
  });
}

async function getWorkspaceDatabase() {
  workspaceDatabasePromise ??= SQLite.openDatabaseAsync(
    workspaceDatabaseName,
  ).then(async (db) => {
    await migrateWorkspaceDatabase(db);
    return db;
  });

  return workspaceDatabasePromise;
}

async function migrateWorkspaceDatabase(db: WorkspaceDatabase) {
  const versionRow = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  const currentVersion = versionRow?.user_version ?? 0;

  if (currentVersion > 0 && currentVersion < workspaceSchemaVersion) {
    await dropWorkspaceTables(db);
  }

  await db.execAsync(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS laws (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS schemes (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scheme_laws (
      scheme_id TEXT NOT NULL,
      law_id TEXT NOT NULL,
      sort INTEGER NOT NULL,
      PRIMARY KEY (scheme_id, law_id),
      FOREIGN KEY (scheme_id) REFERENCES schemes(id) ON DELETE CASCADE,
      FOREIGN KEY (law_id) REFERENCES laws(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS fragments (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS drafts (
      id TEXT PRIMARY KEY NOT NULL,
      fragment_id TEXT NOT NULL,
      scheme_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (fragment_id) REFERENCES fragments(id) ON DELETE CASCADE,
      FOREIGN KEY (scheme_id) REFERENCES schemes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS draft_versions (
      id TEXT PRIMARY KEY NOT NULL,
      draft_id TEXT NOT NULL,
      version_no INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('brewing', 'completed', 'failed', 'expired')),
      content TEXT NOT NULL,
      deadline_at TEXT,
      snapshot_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (draft_id) REFERENCES drafts(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_scheme_laws_law_id ON scheme_laws(law_id);
    CREATE INDEX IF NOT EXISTS idx_drafts_fragment_id ON drafts(fragment_id);
    CREATE INDEX IF NOT EXISTS idx_drafts_scheme_id ON drafts(scheme_id);
    CREATE UNIQUE INDEX IF NOT EXISTS uq_draft_versions_draft_id_version_no
      ON draft_versions(draft_id, version_no);

    PRAGMA user_version = ${workspaceSchemaVersion};
  `);
}

async function runWorkspaceTransaction(
  task: (db: WorkspaceDatabase) => Promise<void>,
) {
  const db = await getWorkspaceDatabase();
  await db.withExclusiveTransactionAsync(async (transaction) => {
    await task(transaction);
  });
}

async function clearWorkspaceTables(db: WorkspaceDatabase) {
  await db.runAsync("DELETE FROM draft_versions");
  await db.runAsync("DELETE FROM drafts");
  await db.runAsync("DELETE FROM scheme_laws");
  await db.runAsync("DELETE FROM fragments");
  await db.runAsync("DELETE FROM schemes");
  await db.runAsync("DELETE FROM laws");
}

async function dropWorkspaceTables(db: WorkspaceDatabase) {
  await db.execAsync(`
    DROP TABLE IF EXISTS draft_versions;
    DROP TABLE IF EXISTS drafts;
    DROP TABLE IF EXISTS scheme_laws;
    DROP TABLE IF EXISTS fragments;
    DROP TABLE IF EXISTS schemes;
    DROP TABLE IF EXISTS laws;
  `);
}

async function upsertLawRow(db: WorkspaceDatabase, law: Law) {
  await db.runAsync(
    `INSERT OR REPLACE INTO laws
      (id, title, content, tags_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    law.id,
    law.title,
    law.content,
    JSON.stringify(law.tags),
    law.createdAt,
    law.updatedAt,
  );
}

async function upsertSchemeRow(db: WorkspaceDatabase, scheme: Scheme) {
  await db.runAsync(
    `INSERT OR REPLACE INTO schemes
      (id, title, content, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    scheme.id,
    scheme.title,
    scheme.content,
    scheme.createdAt,
    scheme.updatedAt,
  );
  await db.runAsync("DELETE FROM scheme_laws WHERE scheme_id = ?", scheme.id);

  for (const [sort, lawId] of scheme.lawIds.entries()) {
    await db.runAsync(
      `INSERT OR REPLACE INTO scheme_laws
        (scheme_id, law_id, sort)
       VALUES (?, ?, ?)`,
      scheme.id,
      lawId,
      sort,
    );
  }
}

async function insertFragmentRow(db: WorkspaceDatabase, fragment: FragmentItem) {
  await db.runAsync(
    `INSERT OR REPLACE INTO fragments
      (id, title, content, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    fragment.id,
    fragment.title,
    fragment.content,
    fragment.createdAt,
    fragment.updatedAt,
  );

  for (const draft of fragment.drafts) {
    await insertDraftRow(db, fragment.id, draft);
  }
}

async function insertDraftRow(
  db: WorkspaceDatabase,
  fragmentId: string,
  draft: Draft,
) {
  const createdAt = draft.versions[0]?.createdAt ?? new Date().toISOString();
  const updatedAt = latestDraftVersion(draft)?.createdAt ?? createdAt;

  await db.runAsync(
    `INSERT OR REPLACE INTO drafts
      (id, fragment_id, scheme_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    draft.id,
    fragmentId,
    draft.schemeId,
    createdAt,
    updatedAt,
  );

  for (const version of draft.versions) {
    await insertDraftVersionRow(db, draft.id, version);
  }
}

async function insertDraftVersionRow(
  db: WorkspaceDatabase,
  draftId: string,
  version: DraftVersion,
) {
  await db.runAsync(
    `INSERT OR REPLACE INTO draft_versions
      (id, draft_id, version_no, status, content, deadline_at, snapshot_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    version.id,
    draftId,
    version.versionNo,
    version.status,
    version.content,
    version.deadlineAt,
    JSON.stringify(version.snapshot),
    version.createdAt,
  );
}

function parseStringArray(raw: string) {
  try {
    const parsed = JSON.parse(raw) as unknown;

    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function parseDraftStatus(status: string): DraftVersion["status"] {
  return (
    status === "brewing" ||
    status === "failed" ||
    status === "completed" ||
    status === "expired"
  )
    ? status
    : "failed";
}

function parseGenerationSnapshot(raw: string | null | undefined): GenerationSnapshot {
  if (!raw) return createUnavailableSnapshot("missing_snapshot");

  try {
    const parsed = JSON.parse(raw) as unknown;

    return isGenerationSnapshot(parsed)
      ? parsed
      : createUnavailableSnapshot("invalid_snapshot");
  } catch {
    return createUnavailableSnapshot("invalid_snapshot");
  }
}

function isGenerationSnapshot(value: unknown): value is GenerationSnapshot {
  if (!value || typeof value !== "object") return false;

  const snapshot = value as Partial<GenerationSnapshot>;

  if (snapshot.type === "scheme" && snapshot.version === 1) {
    const content = snapshot.content as
      | Partial<SchemeGenerationSnapshot["content"]>
      | undefined;

    return Boolean(
      content?.fragment &&
        content.scheme &&
        Array.isArray(content.laws),
    );
  }

  if (snapshot.type === "rewrite" && snapshot.version === 1) {
    const content = snapshot.content as
      | Partial<RewriteGenerationSnapshot["content"]>
      | undefined;

    return Boolean(
      typeof content?.instruction === "string" &&
        typeof content.sourceContent === "string" &&
        typeof content.sourceVersionId === "string",
    );
  }

  if (snapshot.type === "unavailable" && snapshot.version === 1) {
    const content = snapshot.content as
      | Partial<UnavailableGenerationSnapshot["content"]>
      | undefined;

    return typeof content?.reason === "string";
  }

  return false;
}

function getPendingDraftVersionRefs(fragments: FragmentItem[]) {
  return fragments.flatMap((fragment) =>
    fragment.drafts.flatMap((draft) =>
      draft.versions.flatMap((version) =>
        version.status === "brewing"
          ? [
              {
                draftId: draft.id,
                fragmentId: fragment.id,
                versionId: version.id,
              },
            ]
          : [],
      ),
    ),
  );
}

function updateDraftVersionInFragments(
  fragments: FragmentItem[],
  versionId: string,
  patch: Partial<Pick<DraftVersion, "content" | "deadlineAt" | "status">>,
) {
  const updatedAt = new Date().toISOString();

  return fragments.map((fragment) => {
    let touched = false;
    const drafts = fragment.drafts.map((draft) => {
      const versions = draft.versions.map((version) => {
        if (version.id !== versionId) return version;

        touched = true;
        return {
          ...version,
          ...patch,
        };
      });

      return touched ? { ...draft, versions } : draft;
    });

    return touched ? { ...fragment, drafts, updatedAt } : fragment;
  });
}

async function readPersistedMobileSettings() {
  if (Platform.OS === "web") {
    const raw = globalThis.localStorage?.getItem(mobileSettingsStorageKey);

    return raw
      ? (JSON.parse(raw) as Partial<PersistedMobileSettings>)
      : undefined;
  }

  const uri = getMobileSettingsFileUri();

  if (!uri) return undefined;

  try {
    const info = await FileSystem.getInfoAsync(uri);

    if (!info.exists) return undefined;

    const raw = await FileSystem.readAsStringAsync(uri);

    return JSON.parse(raw) as Partial<PersistedMobileSettings>;
  } catch {
    return undefined;
  }
}

async function writePersistedMobileSettings(settings: PersistedMobileSettings) {
  const raw = JSON.stringify(settings);

  if (Platform.OS === "web") {
    globalThis.localStorage?.setItem(mobileSettingsStorageKey, raw);
    return;
  }

  const uri = getMobileSettingsFileUri();

  if (!uri) return;

  await FileSystem.writeAsStringAsync(uri, raw);
}

function getMobileSettingsFileUri() {
  const directory = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;

  return directory ? `${directory}essai-mobile-settings.json` : null;
}

function getTransferSectionCopy(sectionId: TransferSectionId) {
  if (sectionId === "config") {
    return {
      description: tx("pages.settings.exportConfigDescription"),
      title: tx("pages.settings.exportConfigTitle"),
    };
  }

  return {
    description: tx("pages.settings.exportDataDescription"),
    title: tx("pages.settings.exportDataTitle"),
  };
}

async function writeBackupBundle({
  data,
  selection,
  settings,
}: {
  data: BackupDataPayload;
  selection: Record<TransferSectionId, boolean>;
  settings: PersistedMobileSettings;
}) {
  const zip = new JSZip();
  const sections = (["data", "config"] as TransferSectionId[]).filter(
    (sectionId) => selection[sectionId],
  );
  const fileName = createBackupFileName();

  zip.file(
    "manifest.json",
    JSON.stringify(
      {
        app: "essai",
        createdAt: new Date().toISOString(),
        dataSchemaVersion: selection.data ? data.schemaVersion : undefined,
        sections,
        version: 1,
      },
      null,
      2,
    ),
  );

  if (selection.data) {
    zip.file("data.json", JSON.stringify(data, null, 2));
  }

  if (selection.config) {
    zip.file("settings.json", JSON.stringify(settings, null, 2));
  }

  if (Platform.OS === "web") {
    const blob = await zip.generateAsync({ type: "blob" });
    downloadWebBlob(blob, fileName);
    return;
  }

  const directory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;

  if (!directory) {
    throw new Error("File system is unavailable.");
  }

  const uri = `${directory}${fileName}`;
  const base64 = await zip.generateAsync({ type: "base64" });

  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const canShare = await Sharing.isAvailableAsync();

  if (!canShare) {
    throw new Error("Sharing is unavailable.");
  }

  await Sharing.shareAsync(uri, {
    UTI: "com.pkware.zip-archive",
    dialogTitle: tx("pages.settings.exportTitle"),
    mimeType: "application/zip",
  });
}

async function pickBackupBundle(): Promise<ParsedBackupBundle | null> {
  const result = await DocumentPicker.getDocumentAsync({
    base64: Platform.OS === "web",
    copyToCacheDirectory: true,
    type: [
      "application/zip",
      "application/x-zip-compressed",
      "application/octet-stream",
    ],
  });

  if (result.canceled) return null;

  const asset = result.assets[0];

  if (!asset) return null;

  const zip = await loadPickedZip(asset);
  const data = await readBackupJson<BackupDataPayload>(zip, "data.json");
  const settings = await readBackupJson<Partial<PersistedMobileSettings>>(
    zip,
    "settings.json",
  );
  const available = {
    config: isBackupSettingsPayload(settings),
    data: isBackupDataPayload(data),
  };

  if (!available.config && !available.data) {
    throw new Error("No supported backup content found.");
  }

  return {
    available,
    data: available.data ? data : undefined,
    fileName: asset.name,
    settings: available.config ? settings : undefined,
  };
}

async function loadPickedZip(asset: DocumentPicker.DocumentPickerAsset) {
  if (asset.base64) {
    return JSZip.loadAsync(asset.base64, { base64: true });
  }

  if (asset.file) {
    return JSZip.loadAsync(await asset.file.arrayBuffer());
  }

  const base64 = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return JSZip.loadAsync(base64, { base64: true });
}

async function readBackupJson<T>(zip: JSZip, path: string) {
  const file = zip.file(path);

  if (!file) return undefined;

  return JSON.parse(await file.async("string")) as T;
}

function isBackupDataPayload(value: unknown): value is BackupDataPayload {
  if (!value || typeof value !== "object") return false;

  const payload = value as Partial<BackupDataPayload>;

  return (
    payload.schemaVersion === backupDataSchemaVersion &&
    Array.isArray(payload.fragments) &&
    Array.isArray(payload.laws) &&
    Array.isArray(payload.schemes)
  );
}

function isBackupSettingsPayload(
  value: unknown,
): value is Partial<PersistedMobileSettings> {
  if (!value || typeof value !== "object") return false;

  const payload = value as Partial<PersistedMobileSettings>;

  return (
    isThemeId(payload.themeId) ||
    isLanguageId(payload.languageId) ||
    isProviderKeys(payload.providerKeys) ||
    typeof payload.activeModelId === "string" ||
    payload.activeModelId === null
  );
}

function isProviderKeys(value: unknown): value is ProviderKeys {
  if (!value || typeof value !== "object") return false;

  const payload = value as Partial<Record<ProviderId, unknown>>;

  return modelProviders.every(
    (provider) => typeof payload[provider.id] === "string",
  );
}

function createBackupFileName() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");

  return `essai-backup-${stamp}.zip`;
}

function downloadWebBlob(blob: Blob, fileName: string) {
  const documentRef = globalThis.document;
  const urlApi = globalThis.URL;

  if (!documentRef || !urlApi) {
    throw new Error("Browser download is unavailable.");
  }

  const url = urlApi.createObjectURL(blob);
  const anchor = documentRef.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = "none";
  documentRef.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  urlApi.revokeObjectURL(url);
}

function getAvailableModels(providerKeys: ProviderKeys): AvailableModelOption[] {
  return modelProviders.flatMap((provider) => {
    if (providerKeys[provider.id].trim().length === 0) return [];

    return provider.models.map((model) => ({
      ...model,
      providerName: provider.name,
    }));
  });
}

function resolveGenerationService(
  activeModel: AvailableModelOption | null,
  providerKeys: ProviderKeys,
): GenerationService | null {
  if (!activeModel) {
    return null;
  }

  const apiKey = providerKeys[activeModel.providerId].trim();

  if (!apiKey) {
    return null;
  }

  return {
    apiKey,
    model: getModelNameFromId(activeModel.id),
    provider: activeModel.providerId,
  };
}

function showGenerationModelRequired() {
  const title = tx("generation.modelRequiredTitle");
  const message = tx("generation.modelRequired");

  if (Platform.OS === "web") {
    globalThis.alert?.(`${title}\n${message}`);
    return;
  }

  Alert.alert(title, message);
}

function showGenerationConfigRequired() {
  const title = tx("generation.configRequiredTitle");
  const message = tx("generation.configRequired");

  if (Platform.OS === "web") {
    globalThis.alert?.(`${title}\n${message}`);
    return;
  }

  Alert.alert(title, message);
}

function getModelNameFromId(modelId: string) {
  return modelId.includes(":") ? modelId.split(":").slice(1).join(":") : modelId;
}

async function buildDraftRequestFingerprint({
  id,
  model,
  options,
  payload,
  provider,
}: {
  id: string;
  model: string;
  options: typeof draftGenerationOptions;
  payload: DraftGenerationPayload;
  provider: ProviderId;
}) {
  return requestFingerprint({
    generation: {
      id,
      payload,
      title: null,
    },
    kind: "draft",
    model,
    options,
    provider,
    schemaVersion: 1,
  });
}

async function buildTitleRequestFingerprint({
  id,
  model,
  options,
  payload,
  provider,
}: {
  id: string;
  model: string;
  options: typeof titleGenerationOptions;
  payload: { fragment: { content: string; id: string } };
  provider: ProviderId;
}) {
  return requestFingerprint({
    id,
    kind: "title",
    model,
    options,
    payload,
    provider,
    schemaVersion: 1,
  });
}

async function requestFingerprint(value: unknown) {
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    stableStringify(value),
  );

  return `sha256:${hash}`;
}

function stableStringify(value: unknown) {
  return JSON.stringify(normalizeStableValue(value));
}

function normalizeStableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeStableValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, normalizeStableValue(child)]),
    );
  }

  return value;
}

async function prepareGenerationApiBody<T extends Record<string, unknown>>(
  request: T,
) {
  return prepareGenerationApiRequestBody(request, {
    apiKeyEncryptionPublicJwk,
    generationApiBaseUrl,
    requestEncryptionPublicJwk,
  });
}

async function postGenerationApi<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${generationApiBaseUrl}${path}`, {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new GenerationApiRequestError(data);
  }

  return data as T;
}

async function followGenerationRecords(
  ids: string[],
): Promise<GenerationRecoveryResult> {
  const url = `${generationApiBaseUrl}/api/generations/follow?ids=${ids
    .map(encodeURIComponent)
    .join(",")}&intervalMs=1000`;
  const response = await fetch(url, {
    headers: {
      accept: "text/event-stream",
    },
  });

  if (!response.ok || !response.body || !("getReader" in response.body)) {
    return pullGenerationRecords(ids);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const records = new Map<string, GenerationApiRecord>();
  const expiredIds = new Set<string>();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    while (buffer.includes("\n\n")) {
      const boundary = buffer.indexOf("\n\n");
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const event = parseSseEvent(block);

      if (event?.event === "generation.record" && event.data?.record) {
        records.set(event.data.record.id, event.data.record);
      }

      if (event?.event === "generation.expired" && event.data?.id) {
        expiredIds.add(event.data.id);
      }

      if (
        event?.event === "generation.done" ||
        event?.event === "generation.pause" ||
        event?.event === "generation.error"
      ) {
        return {
          expiredIds: [...expiredIds],
          records: [...records.values()],
        };
      }
    }
  }

  return {
    expiredIds: [...expiredIds],
    records: [...records.values()],
  };
}

async function pullGenerationRecords(
  ids: string[],
): Promise<GenerationRecoveryResult> {
  const response = await postGenerationApi<{
    missing?: Array<{ id: string; status: "expired" }>;
    records?: GenerationApiRecord[];
  }>("/api/generations/pull", { ids });

  return {
    expiredIds: response.missing?.map((item) => item.id) ?? [],
    records: response.records ?? [],
  };
}

function parseSseEvent(block: string) {
  const lines = block.split("\n").filter((line) => !line.startsWith(":"));
  const eventLine = lines.find((line) => line.startsWith("event:"));
  const dataLines = lines
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart());

  if (!eventLine && dataLines.length === 0) return null;

  return {
    data: dataLines.length > 0 ? JSON.parse(dataLines.join("\n")) : null,
    event: eventLine ? eventLine.slice(6).trim() : "message",
  } as {
    data: { id?: string; record?: GenerationApiRecord } | null;
    event: string;
  };
}

class GenerationApiRequestError extends Error {
  details: unknown;

  constructor(details: unknown) {
    const apiError = getGenerationApiError(details);

    super(apiError?.message ?? "Generation API request failed.");
    this.details = details;
  }
}

function getGenerationApiError(error: unknown): GenerationApiError | null {
  const details =
    error instanceof GenerationApiRequestError ? error.details : error;

  if (!details || typeof details !== "object") return null;

  const maybeError = (details as { error?: unknown }).error;

  if (!maybeError || typeof maybeError !== "object") return null;

  return maybeError as GenerationApiError;
}

function getGenerationApiErrorIds(
  error: GenerationApiError | null,
  targets: DraftGenerationTarget[],
) {
  const ids = error?.details?.ids;

  return Array.isArray(ids) && ids.length > 0
    ? ids.filter((id): id is string => typeof id === "string")
    : targets.map((target) => target.versionId);
}

function createThemedStyles(colors: ThemeColors) {
  const shadow: StyleProp<ViewStyle> = {
    shadowColor: colors.text,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  };

  return StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  gestureRoot: {
    flex: 1,
  },
  shell: {
    flex: 1,
    position: "relative",
  },
  stackSafeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  navigationBackButton: {
    alignItems: "center",
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  navigationHeaderTitle: {
    alignItems: "center",
    minWidth: 0,
  },
  navigationHeaderPrimary: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "800",
    lineHeight: 25,
    textAlign: "center",
  },
  navigationHeaderSecondary: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 1,
    textAlign: "center",
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingBottom: 100,
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  pageStack: {
    gap: 24,
  },
  pageFloatingActionSpacer: {
    height: 20,
  },
  pageHeader: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 16,
    justifyContent: "space-between",
  },
  pageHeaderText: {
    color: colors.text,
    flex: 1,
    fontSize: 24,
    fontWeight: "500",
    lineHeight: 32,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 12,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 16,
  },
  primaryButtonIcon: {
    color: colors.primaryText,
    fontSize: 17,
    fontWeight: "800",
  },
  primaryButtonText: {
    color: colors.primaryText,
    fontSize: 15,
    fontWeight: "800",
  },
  outlineButton: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 16,
  },
  outlineButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  buttonDisabled: {
    opacity: 0.38,
  },
  bottomNavWrap: {
    bottom: 8,
    left: 18,
    paddingTop: 18,
    position: "absolute",
    right: 18,
    zIndex: 50,
  },
  pageFloatingAction: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 14,
    bottom: 88,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: 16,
    position: "absolute",
    right: 18,
    shadowColor: colors.text,
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    zIndex: 45,
  },
  pageFloatingActionText: {
    color: colors.primaryText,
    fontSize: 14,
    fontWeight: "800",
  },
  bottomNav: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    padding: 6,
    ...shadow,
  },
  bottomNavCenterGap: {
    width: 74,
  },
  bottomNavCreateButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderColor: colors.background,
    borderRadius: 999,
    borderWidth: 5,
    height: 64,
    justifyContent: "center",
    left: "50%",
    marginLeft: -32,
    position: "absolute",
    top: 0,
    width: 64,
    shadowColor: colors.text,
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    zIndex: 40,
  },
  bottomNavItem: {
    alignItems: "center",
    borderRadius: 18,
    flex: 1,
    gap: 2,
    justifyContent: "center",
    minHeight: 50,
  },
  bottomNavItemActive: {
    backgroundColor: colors.secondary,
  },
  bottomNavIcon: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: "800",
  },
  bottomNavText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "600",
    lineHeight: 13,
  },
  bottomNavTextActive: {
    color: colors.text,
    fontWeight: "700",
  },
  masonry: {
    flexDirection: "row",
    width: "100%",
  },
  masonryColumn: {
    flex: 1,
    minWidth: 0,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: "100%",
  },
  listStack: {
    gap: 14,
    width: "100%",
  },
  moreList: {
    gap: 12,
    width: "100%",
  },
  moreItem: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    minHeight: 82,
    padding: 14,
    ...shadow,
  },
  moreIcon: {
    alignItems: "center",
    backgroundColor: colors.secondary,
    borderRadius: 12,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  moreText: {
    flex: 1,
    minWidth: 0,
  },
  moreTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22,
  },
  moreDescription: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 3,
  },
  moreChevron: {
    color: colors.muted,
    fontSize: 24,
    fontWeight: "600",
  },
  settingsLead: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 23,
  },
  settingsList: {
    gap: 12,
  },
  settingChoice: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    minHeight: 76,
    padding: 14,
  },
  settingChoiceText: {
    flex: 1,
    minWidth: 0,
  },
  settingChoiceTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 21,
  },
  settingChoiceDescription: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 3,
  },
  selectionMark: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  selectionMarkActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  themeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  themeOption: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    minHeight: 156,
    padding: 14,
    width: "48%",
  },
  themeSwatchRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
  },
  themeSwatchLarge: {
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    height: 34,
    width: 48,
  },
  themeSwatch: {
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 22,
    width: 22,
  },
  providerCard: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  providerHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
  },
  providerStatus: {
    backgroundColor: colors.secondary,
    borderRadius: 999,
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  providerStatusActive: {
    backgroundColor: colors.primary,
    color: colors.primaryText,
  },
  settingsInput: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.text,
    fontSize: 14,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  modelSelectButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 70,
    padding: 12,
  },
  modelSelectChevron: {
    transform: [{ rotate: "90deg" }],
  },
  modelSelectChevronOpen: {
    transform: [{ rotate: "-90deg" }],
  },
  modelOptionList: {
    gap: 10,
  },
  fragmentCardShadow: {
    borderRadius: 14,
    ...shadow,
  },
  fragmentCard: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  fragmentPreviewArea: {
    backgroundColor: colors.mutedSurface,
    minHeight: 108,
    overflow: "hidden",
    paddingHorizontal: 16,
    paddingTop: 20,
    position: "relative",
  },
  fragmentPreviewText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 27,
  },
  fragmentPreviewFade: {
    bottom: 0,
    height: 34,
    left: 0,
    position: "absolute",
    right: 0,
  },
  noPointerEvents: {
    pointerEvents: "none",
  },
  fragmentFooter: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  simpleMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    marginTop: 7,
  },
  fragmentTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 7,
  },
  titlePressable: {
    flex: 1,
    minHeight: 27,
    justifyContent: "center",
  },
  cardTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 22,
  },
  titleInput: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 22,
    minHeight: 27,
    padding: 0,
  },
  iconButtonSmall: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  iconButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  cardFooter: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerMeta: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 1,
    gap: 8,
    minWidth: 0,
  },
  mutedText: {
    color: colors.muted,
    fontSize: 12,
  },
  softBadge: {
    backgroundColor: colors.secondary,
    borderRadius: 999,
    color: colors.text,
    fontSize: 11,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  deleteIconButton: {
    alignItems: "center",
    borderRadius: 999,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  deleteIconText: {
    color: colors.muted,
    fontSize: 18,
    fontWeight: "800",
  },
  gridCardShadow: {
    borderRadius: 14,
    ...shadow,
  },
  gridCard: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 154,
    overflow: "hidden",
  },
  gridCardContent: {
    flex: 1,
    gap: 14,
    padding: 16,
  },
  gridCardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 24,
  },
  gridCardBody: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 23,
  },
  gridCardFooter: {
    alignItems: "center",
    backgroundColor: colors.mutedSurface,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: 16,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    backgroundColor: colors.secondary,
    borderRadius: 999,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "flex-start",
    minHeight: 420,
    paddingTop: 64,
  },
  emptyStateCompact: {
    minHeight: 170,
    paddingTop: 28,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyDescription: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 24,
    maxWidth: 360,
    textAlign: "center",
  },
  modalShell: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalSafeArea: {
    backgroundColor: colors.background,
    flex: 1,
    paddingTop: 14,
  },
  modalHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 14,
    justifyContent: "space-between",
    marginBottom: 18,
    paddingHorizontal: 18,
  },
  modalHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 34,
  },
  modalDescription: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 7,
    maxWidth: 620,
  },
  closeButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: 13,
  },
  closeButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  modalContentFrame: {
    flex: 1,
    minHeight: 0,
    position: "relative",
  },
  composeScroll: {
    flex: 1,
  },
  composeScrollContent: {
    gap: 18,
    paddingHorizontal: 18,
  },
  modalFloatingAction: {
    alignItems: "flex-end",
    left: 18,
    position: "absolute",
    right: 18,
    zIndex: 20,
  },
  draftGenerateBody: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 18,
  },
  draftSchemeSelectionBlock: {
    flex: 1,
    gap: 12,
    minHeight: 0,
  },
  draftSchemeListScroll: {
    flex: 1,
  },
  draftSchemeList: {
    gap: 12,
    paddingBottom: 16,
  },
  draftSchemeListCard: {
    backgroundColor: colors.card,
    borderColor: "transparent",
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  draftSchemeListTop: {
    gap: 10,
    padding: 14,
  },
  draftSchemeListHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  draftEditBody: {
    flex: 1,
    minHeight: 0,
    paddingBottom: 14,
    paddingHorizontal: 18,
  },
  composeInput: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    color: colors.text,
    flex: 1,
    fontSize: 17,
    lineHeight: 28,
    minHeight: 280,
    padding: 16,
  },
  composeInputCompact: {
    minHeight: 140,
  },
  fragmentEditInput: {
    minHeight: 0,
  },
  schemeSelectionBlock: {
    flexShrink: 0,
    gap: 10,
  },
  helpText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 22,
  },
  scrollerFrame: {
    backgroundColor: colors.mutedSurface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 240,
    padding: 12,
  },
  schemeRow: {
    flexDirection: "row",
    gap: 12,
  },
  schemeTile: {
    backgroundColor: colors.card,
    borderColor: "transparent",
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
    width: 208,
  },
  selectionBorderOverlay: {
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    bottom: 0,
    left: 0,
    pointerEvents: "none",
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 1,
  },
  selectionBorderOverlaySelected: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  schemeTileTop: {
    aspectRatio: 1,
    gap: 12,
    padding: 13,
  },
  checkCircle: {
    alignItems: "center",
    backgroundColor: colors.background,
    borderColor: colors.mutedBorder,
    borderRadius: 999,
    borderWidth: 1,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  checkCircleSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkText: {
    color: colors.primaryText,
    fontSize: 13,
    fontWeight: "900",
  },
  schemeTileTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 21,
  },
  schemeTileBody: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 19,
  },
  schemeTileFooter: {
    alignItems: "center",
    backgroundColor: colors.mutedSurface,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
  },
  countRow: {
    flexDirection: "row",
    gap: 6,
  },
  countButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 30,
    justifyContent: "center",
    width: 34,
  },
  countButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  countButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  countButtonTextActive: {
    color: colors.primaryText,
  },
  modalFooter: {
    alignItems: "flex-end",
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexShrink: 0,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  modalFooterRow: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  modalScroll: {
    flex: 1,
  },
  formStack: {
    gap: 9,
    paddingBottom: 28,
    paddingHorizontal: 18,
  },
  inputLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
    marginTop: 8,
  },
  singleInput: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  noteInput: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
    minHeight: 150,
    padding: 14,
  },
  lawPickScroller: {
    flexGrow: 0,
    flexShrink: 0,
    height: 100,
    maxHeight: 100,
  },
  lawPickGrid: {
    flexDirection: "row",
    gap: 10,
    height: 100,
  },
  lawPickTile: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: 7,
    height: 100,
    overflow: "visible",
    paddingHorizontal: 13,
    paddingVertical: 12,
    position: "relative",
    width: 278,
  },
  lawPickTileSelected: {
    backgroundColor: colors.mutedSurface,
  },
  lawPickSelectionBorder: {
    borderColor: colors.primary,
    borderRadius: 14,
    borderWidth: 2,
    bottom: 0,
    left: 0,
    pointerEvents: "none",
    position: "absolute",
    right: 0,
    top: 0,
  },
  lawPickTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  lawPickTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    includeFontPadding: false,
    lineHeight: 24,
    minHeight: 24,
    minWidth: 0,
  },
  lawPickCheck: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 999,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  lawPickCheckText: {
    color: colors.primaryText,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 16,
  },
  lawPickBody: {
    color: colors.muted,
    fontSize: 13,
    includeFontPadding: false,
    lineHeight: 21,
  },
  quickLawBox: {
    backgroundColor: colors.mutedSurface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    marginTop: 6,
    padding: 14,
  },
  quickLawHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  quickLawHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  quickLawTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22,
  },
  quickLawDescription: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 3,
  },
  quickLawButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 12,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 12,
  },
  quickLawFields: {
    flexDirection: "row",
    gap: 10,
  },
  quickLawField: {
    flex: 1,
    minWidth: 0,
  },
  quickLawInput: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 96,
    padding: 14,
  },
  quickLawTagSection: {
    gap: 8,
  },
  quickLawTagRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  quickLawTag: {
    alignItems: "center",
    backgroundColor: colors.secondary,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 7,
    height: 32,
    justifyContent: "center",
    maxWidth: "100%",
    minWidth: 0,
    overflow: "hidden",
    paddingHorizontal: 11,
  },
  quickLawTagText: {
    color: colors.text,
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 16,
    minWidth: 0,
  },
  quickLawTagRemoveButton: {
    alignItems: "center",
    height: 18,
    justifyContent: "center",
    width: 18,
  },
  quickLawTagAdd: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  centerModalOverlay: {
    alignItems: "center",
    backgroundColor: colors.overlay,
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  centerModalCard: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 16,
    maxWidth: 360,
    padding: 18,
    width: "100%",
    shadowColor: colors.text,
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
  },
  centerModalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 26,
  },
  confirmDialogSubtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 24,
  },
  centerModalActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 20,
  },
  detailScroll: {
    flex: 1,
  },
  detailInner: {
    gap: 18,
    paddingBottom: 28,
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  draftDetailInner: {
    flex: 1,
    gap: 18,
    minHeight: 0,
    paddingBottom: 28,
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  paperSurface: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    lineHeight: 30,
    padding: 18,
  },
  paperSurfaceFrame: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  paperSurfaceScrollInner: {
    padding: 18,
  },
  paperSurfaceText: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 30,
  },
  actionRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  draftSchemeCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  draftSchemePreviewText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 21,
  },
  draftLawPillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  draftSchemeActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
  },
  draftContentHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  draftVersionTopRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  draftVersionMeta: {
    alignItems: "flex-start",
    gap: 7,
  },
  draftVersionActions: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 1,
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "flex-end",
  },
  draftVersionActionButton: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  draftVersionDeleteButton: {
    alignItems: "center",
    backgroundColor: colors.dangerSoft,
    borderRadius: 999,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  versionStepper: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
  },
  versionStepperButton: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  versionStepperButtonDisabled: {
    opacity: 0.36,
  },
  versionNumberButton: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    minWidth: 42,
    paddingHorizontal: 12,
  },
  versionNumberText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  versionTotalText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
  },
  versionRow: {
    flexDirection: "row",
    gap: 10,
    paddingRight: 18,
  },
  versionPill: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 54,
  },
  versionPillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  versionPillText: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  versionPillTextSelected: {
    color: colors.primaryText,
  },
  draftContentCarouselFrame: {
    alignItems: "center",
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
  },
  draftContentCarousel: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  draftCarouselItem: {
    alignItems: "center",
  },
  draftContentCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: 16,
    padding: 16,
    position: "relative",
  },
  draftContentCardFill: {
    flex: 1,
    minHeight: 0,
  },
  draftContentScroll: {
    flex: 1,
    minHeight: 0,
  },
  draftContentScrollInner: {
    paddingBottom: 68,
  },
  draftContentText: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 30,
  },
  draftRewriteButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderColor: colors.card,
    borderRadius: 999,
    borderWidth: 4,
    bottom: 12,
    height: 48,
    justifyContent: "center",
    position: "absolute",
    right: 12,
    shadowColor: colors.text,
    shadowOpacity: 0.15,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    width: 48,
    zIndex: 10,
  },
  rewriteDrawerBody: {
    flex: 1,
    gap: 12,
    minHeight: 0,
    paddingHorizontal: 18,
  },
  rewriteSourceCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flex: 3,
    gap: 8,
    minHeight: 0,
    padding: 14,
  },
  rewriteSourceTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  rewriteSourceScroll: {
    flex: 1,
    minHeight: 0,
  },
  rewriteSourceScrollInner: {
    paddingBottom: 8,
  },
  rewriteSourceText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 23,
  },
  rewriteMessageBox: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flex: 2,
    minHeight: 0,
    overflow: "hidden",
    position: "relative",
  },
  rewriteMessageScroll: {
    flex: 1,
    minHeight: 0,
  },
  rewriteMessageScrollInner: {
    flexGrow: 1,
    paddingBottom: 66,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  rewriteMessageInput: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 23,
    minHeight: 0,
    padding: 0,
  },
  rewriteSendButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 999,
    bottom: 12,
    height: 42,
    justifyContent: "center",
    position: "absolute",
    right: 12,
    width: 42,
  },
  jumpInputRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  jumpInput: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    minHeight: 52,
    paddingHorizontal: 14,
    textAlign: "center",
  },
  jumpTotalText: {
    color: colors.muted,
    fontSize: 17,
    fontWeight: "800",
    minWidth: 42,
  },
  versionModalCard: {
    maxHeight: "78%",
  },
  versionModalBody: {
    gap: 14,
  },
  versionModalScroll: {
    minHeight: 0,
  },
  versionModalScrollInner: {
    gap: 14,
    paddingBottom: 2,
  },
  versionModalSection: {
    gap: 7,
  },
  lawPillButton: {
    backgroundColor: colors.secondary,
    borderRadius: 999,
    maxWidth: "100%",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  lawPillButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
  },
  snapshotPillScrollBox: {
    minHeight: 0,
  },
  snapshotPillScroll: {
    minHeight: 0,
  },
  snapshotPillScrollInner: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingBottom: 2,
  },
  versionModalLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  versionModalText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 22,
  },
  snapshotScrollBox: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  snapshotScroll: {
    flex: 1,
    minHeight: 0,
  },
  snapshotScrollInner: {
    padding: 12,
  },
  versionEditorCard: {
    maxHeight: "82%",
  },
  versionEditorInput: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.text,
    flex: 1,
    fontSize: 15,
    lineHeight: 24,
    padding: 14,
  },
  lawDetailCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  dangerButton: {
    alignItems: "center",
    backgroundColor: colors.dangerSoft,
    borderRadius: 12,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 16,
  },
  dangerButtonText: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: "800",
  },
});
}
