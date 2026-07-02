import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { StyleProp, ViewStyle } from "react-native";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import {
  ArrowLeft,
  BookOpenText,
  CircleEllipsis,
  Download,
  FileText,
  Info,
  KeyRound,
  LibraryBig,
  Plus,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react-native";

type Count = 1 | 2 | 3;
type TabId = "fragments" | "schemes" | "laws" | "more";

type RootStackParamList = {
  Home: undefined;
  FragmentDetail: { id: string };
  SchemeDetail: { id: string };
  LawDetail: { id: string };
};

const RootStack = createNativeStackNavigator<RootStackParamList>();

type Scheme = {
  id: string;
  name: string;
  description: string;
  lawIds: string[];
  createdAt: string;
  updatedAt: string;
};

type Law = {
  id: string;
  name: string;
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
  status: "completed" | "brewing" | "failed";
};

type Draft = {
  id: string;
  schemeId: string;
  schemeName: string;
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

const initialLaws: Law[] = [
  {
    id: "law_plain_voice",
    name: "像正常说话",
    content: "保留自然语气，不要把每句话都写得像课程大纲。",
    tags: ["语气", "表达"],
    createdAt: daysAgo(5),
    updatedAt: hoursAgo(20),
  },
  {
    id: "law_concrete_scene",
    name: "给一点现场",
    content: "如果内容太抽象，优先补一个具体场景，让观点有落点。",
    tags: ["结构", "场景"],
    createdAt: daysAgo(4),
    updatedAt: hoursAgo(14),
  },
  {
    id: "law_no_teaching",
    name: "弱化说教感",
    content: "避免直接替读者下结论，先把观察讲清楚，再让判断自然浮出来。",
    tags: ["语气", "节奏"],
    createdAt: daysAgo(2),
    updatedAt: hoursAgo(8),
  },
];

const initialSchemes: Scheme[] = [
  {
    id: "scheme_daily_share",
    name: "日常分享",
    description:
      "把零散想法整理成一段自然、有观点但不端着的表达。适合朋友圈、频道动态，或者一段轻量的个人更新。",
    lawIds: ["law_plain_voice", "law_concrete_scene"],
    createdAt: daysAgo(5),
    updatedAt: hoursAgo(10),
  },
  {
    id: "scheme_short_video",
    name: "短视频口播",
    description:
      "适合快速开场、观点明确、节奏更紧的口播初稿。开头要尽快给出钩子，中间保留清晰转折。",
    lawIds: ["law_concrete_scene", "law_no_teaching"],
    createdAt: daysAgo(4),
    updatedAt: hoursAgo(7),
  },
  {
    id: "scheme_reading_note",
    name: "读书感想",
    description:
      "把书里的一句话、一段联想，整理成更完整的个人表达。不要写成读后感作业，要保留自己的当下处境。",
    lawIds: ["law_plain_voice"],
    createdAt: daysAgo(3),
    updatedAt: hoursAgo(5),
  },
  {
    id: "scheme_one_minute",
    name: "一分钟想法",
    description:
      "适合把一个判断压缩成一段可以直接说出口的内容，结尾留一点余味，不急着讲满。",
    lawIds: ["law_plain_voice", "law_no_teaching"],
    createdAt: daysAgo(2),
    updatedAt: hoursAgo(3),
  },
];

const initialFragments: FragmentItem[] = [
  createFragmentSeed({
    id: "fragment_street_note",
    title: "便利店门口的停顿",
    content:
      "刚才路过便利店，看到有人站在门口回消息，突然想到很多内容其实不是没有想法，而是缺一个允许它先不完整的入口。",
    createdAt: hoursAgo(2),
    draftSchemes: [initialSchemes[0], initialSchemes[1]],
  }),
  createFragmentSeed({
    id: "fragment_reading_note",
    title: "读到一半时冒出来的问题",
    content:
      "读书的时候看到一句话：很多选择不是被想清楚的，而是在不断靠近里慢慢变清楚的。这个角度好像可以用来讲做产品，也可以拿来讲职业选择。它不是一个答案，更像是一种允许自己继续靠近的姿态。",
    createdAt: hoursAgo(7),
    draftSchemes: [initialSchemes[2]],
  }),
  createFragmentSeed({
    id: "fragment_photo_hint",
    title: "雨后路面的反光",
    content:
      "今天拍到一张雨后路面的照片，车灯反光很漂亮。也许可以作为一个开头：有些东西不是被照亮了才存在，而是终于找到了能反光的地方。",
    createdAt: hoursAgo(26),
    draftSchemes: [],
  }),
  createFragmentSeed({
    id: "fragment_manager_prove",
    title: "年轻管理者为什么总想证明自己",
    content:
      "年轻管理者好像特别容易陷入一个状态：明明已经在承担责任了，却还是想不断证明自己够格。证明本身没有错，但如果所有动作都围绕证明展开，团队会很累，自己也会很累。",
    createdAt: daysAgo(2),
    draftSchemes: [initialSchemes[0], initialSchemes[3]],
  }),
  createFragmentSeed({
    id: "fragment_quiet_morning",
    title: "早上没有打开电脑的十分钟",
    content:
      "早上醒来之后没有马上打开电脑，坐了一会儿。突然发现有些焦虑不是事情真的很多，而是自己太快进入了处理事情的状态。",
    createdAt: daysAgo(3),
    draftSchemes: [initialSchemes[0]],
  }),
  createFragmentSeed({
    id: "fragment_product_name",
    title: "名字不是标签，是入口",
    content:
      "想到产品命名的时候，名字不只是一个贴上去的标签。它更像入口，用户第一次靠近它的时候，名字会先告诉他：你可以用什么姿态进入这里。",
    createdAt: daysAgo(4),
    draftSchemes: [initialSchemes[2], initialSchemes[3]],
  }),
];

const tabs: Array<{ id: TabId; label: string; Icon: LucideIcon }> = [
  { id: "fragments", label: "拾光集", Icon: FileText },
  { id: "schemes", label: "方案簿", Icon: LibraryBig },
  { id: "laws", label: "创作法典", Icon: BookOpenText },
  { id: "more", label: "更多", Icon: CircleEllipsis },
];

const quickLawTagMaxLength = 24;

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

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("fragments");
  const [schemes, setSchemes] = useState<Scheme[]>(initialSchemes);
  const [laws, setLaws] = useState<Law[]>(initialLaws);
  const [fragments, setFragments] = useState<FragmentItem[]>(initialFragments);
  const [composeOpen, setComposeOpen] = useState(false);
  const [schemeEditorOpen, setSchemeEditorOpen] = useState(false);
  const [lawEditorOpen, setLawEditorOpen] = useState(false);
  const [editingSchemeId, setEditingSchemeId] = useState<string | null>(null);
  const [editingLawId, setEditingLawId] = useState<string | null>(null);

  const editingScheme = useMemo(
    () => schemes.find((scheme) => scheme.id === editingSchemeId),
    [schemes, editingSchemeId],
  );
  const editingLaw = useMemo(
    () => laws.find((law) => law.id === editingLawId),
    [laws, editingLawId],
  );

  function collectFragment(content: string, selection: SchemeSelection) {
    const createdAt = new Date().toISOString();
    const title = createFragmentTitle(content);
    const pickedSchemes = schemes.flatMap((scheme) => {
      const item = selection[scheme.id];
      if (!item?.selected) return [];
      return [{ scheme, count: item.count }];
    });

    const fragment: FragmentItem = {
      id: createId("fragment"),
      title,
      content,
      createdAt,
      updatedAt: createdAt,
      drafts: pickedSchemes.map(({ scheme, count }) =>
        createDraft({
          scheme,
          fragmentContent: content,
          count,
        }),
      ),
    };

    setFragments((current) => [fragment, ...current]);
    setComposeOpen(false);
    return fragment.id;
  }

  function renameFragment(fragmentId: string, title: string) {
    setFragments((current) =>
      current.map((fragment) =>
        fragment.id === fragmentId
          ? { ...fragment, title, updatedAt: new Date().toISOString() }
          : fragment,
      ),
    );
  }

  function deleteFragment(fragmentId: string) {
    setFragments((current) =>
      current.filter((fragment) => fragment.id !== fragmentId),
    );
  }

  function saveScheme(name: string, description: string, lawIds: string[]) {
    const now = new Date().toISOString();

    if (editingSchemeId) {
      const savedId = editingSchemeId;
      setSchemes((current) =>
        current.map((scheme) =>
          scheme.id === editingSchemeId
            ? {
                ...scheme,
                name,
                description,
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
        name,
        description,
        lawIds,
        createdAt: now,
        updatedAt: now,
      };
      setSchemes((current) => [scheme, ...current]);
      setSchemeEditorOpen(false);
      setEditingSchemeId(null);
      return scheme.id;
    }
  }

  function createLawFromSchemeEditor(
    name: string,
    content: string,
    tags: string[],
  ) {
    const now = new Date().toISOString();
    const law: Law = {
      id: createId("law"),
      name,
      content,
      tags,
      createdAt: now,
      updatedAt: now,
    };

    setLaws((current) => [law, ...current]);
    return law;
  }

  function saveLaw(name: string, content: string, tags: string[]) {
    const now = new Date().toISOString();

    if (editingLawId) {
      const savedId = editingLawId;
      setLaws((current) =>
        current.map((law) =>
          law.id === editingLawId
            ? {
                ...law,
                name,
                content,
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
        name,
        content,
        tags,
        createdAt: now,
        updatedAt: now,
      };
      setLaws((current) => [law, ...current]);
      setLawEditorOpen(false);
      setEditingLawId(null);
      return law.id;
    }
  }

  function deleteScheme(schemeId: string) {
    setSchemes((current) => current.filter((scheme) => scheme.id !== schemeId));
  }

  function deleteLaw(lawId: string) {
    setLaws((current) => current.filter((law) => law.id !== lawId));
    setSchemes((current) =>
      current.map((scheme) => ({
        ...scheme,
        lawIds: scheme.lawIds.filter((id) => id !== lawId),
      })),
    );
  }

  function addDraft(fragmentId: string, scheme: Scheme) {
    setFragments((current) =>
      current.map((fragment) => {
        if (fragment.id !== fragmentId) return fragment;

        const now = new Date().toISOString();
        const existingDraft = fragment.drafts.find(
          (draft) => draft.schemeId === scheme.id,
        );

        if (!existingDraft) {
          return {
            ...fragment,
            updatedAt: now,
            drafts: [
              createDraft({
                scheme,
                fragmentContent: fragment.content,
                count: 1,
              }),
              ...fragment.drafts,
            ],
          };
        }

        return {
          ...fragment,
          updatedAt: now,
          drafts: fragment.drafts
            .map((draft) =>
              draft.id === existingDraft.id
                ? {
                    ...draft,
                    versions: [
                      ...draft.versions,
                      createDraftVersion({
                        scheme,
                        fragmentContent: fragment.content,
                        versionNo: draft.versions.length + 1,
                      }),
                    ],
                  }
                : draft,
            )
            .toSorted(
              (a, b) =>
                new Date(latestDraftVersion(b)?.createdAt ?? 0).getTime() -
                new Date(latestDraftVersion(a)?.createdAt ?? 0).getTime(),
            ),
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

  return (
    <>
      <StatusBar style="dark" />
      <NavigationContainer>
        <RootStack.Navigator
          screenOptions={({ navigation }) => ({
            animation: "slide_from_right",
            contentStyle: { backgroundColor: colors.background },
            headerBackVisible: false,
            headerLeft: () => (
              <NavigationBackButton onPress={() => navigation.goBack()} />
            ),
            headerShadowVisible: true,
            headerStyle: { backgroundColor: colors.background },
            headerTitleAlign: "left",
          })}
        >
          <RootStack.Screen name="Home" options={{ headerShown: false }}>
            {({ navigation }) => (
              <SafeAreaView style={styles.safeArea}>
                <View style={styles.shell}>
                  <ScrollView
                    style={styles.content}
                    contentContainerStyle={styles.contentInner}
                    showsVerticalScrollIndicator={false}
                  >
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

                    {activeTab === "more" ? <MoreView /> : null}
                  </ScrollView>

                  {activeTab === "schemes" ? (
                    <PageFloatingAction
                      Icon={LibraryBig}
                      label="新建方案"
                      onPress={openSchemeEditor}
                    />
                  ) : null}

                  {activeTab === "laws" ? (
                    <PageFloatingAction
                      Icon={BookOpenText}
                      label="收录法则"
                      onPress={openLawEditor}
                    />
                  ) : null}

                  <BottomNav
                    activeTab={activeTab}
                    onChange={setActiveTab}
                    onCreateFragment={() => setComposeOpen(true)}
                  />
                </View>

                {composeOpen ? (
                  <ComposeSheet
                    schemes={schemes}
                    onClose={() => setComposeOpen(false)}
                    onSubmit={(content, selection) => {
                      const id = collectFragment(content, selection);
                      navigation.push("FragmentDetail", { id });
                    }}
                  />
                ) : null}

                {schemeEditorOpen ? (
                  <SchemeEditor
                    initialScheme={editingScheme}
                    laws={laws}
                    onClose={() => {
                      setSchemeEditorOpen(false);
                      setEditingSchemeId(null);
                    }}
                    onCreateLaw={createLawFromSchemeEditor}
                    onSubmit={(name, description, lawIds) => {
                      const wasEditing = Boolean(editingSchemeId);
                      const id = saveScheme(name, description, lawIds);

                      if (!wasEditing) {
                        navigation.push("SchemeDetail", { id });
                      }
                    }}
                  />
                ) : null}

                {lawEditorOpen ? (
                  <LawEditor
                    initialLaw={editingLaw}
                    onClose={() => {
                      setLawEditorOpen(false);
                      setEditingLawId(null);
                    }}
                    onSubmit={(name, content, tags) => {
                      const wasEditing = Boolean(editingLawId);
                      const id = saveLaw(name, content, tags);

                      if (!wasEditing) {
                        navigation.push("LawDetail", { id });
                      }
                    }}
                  />
                ) : null}
              </SafeAreaView>
            )}
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
                        : "返回上一页再试一次。"
                    }
                    title={fragment?.title ?? "碎片不见了"}
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
                return <MissingStackScreen title="碎片不见了" />;
              }

              return (
                <FragmentDetail
                  fragment={fragment}
                  schemes={schemes}
                  onAddDraft={addDraft}
                  onDelete={() => {
                    deleteFragment(fragment.id);
                    navigation.goBack();
                  }}
                  onRename={renameFragment}
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
                    description={scheme ? "方案笺" : "返回上一页再试一次。"}
                    title={scheme?.name ?? "方案不见了"}
                  />
                ),
              };
            }}
          >
            {({ navigation, route }) => {
              const scheme = schemes.find((item) => item.id === route.params.id);

              if (!scheme) {
                return <MissingStackScreen title="方案不见了" />;
              }

              return (
                <SchemeDetail
                  fragments={fragments}
                  scheme={scheme}
                  laws={laws}
                  onDelete={() => {
                    deleteScheme(scheme.id);
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
                    description={law ? "法则条文" : "返回上一页再试一次。"}
                    title={law?.name ?? "法则不见了"}
                  />
                ),
              };
            }}
          >
            {({ navigation, route }) => {
              const law = laws.find((item) => item.id === route.params.id);

              if (!law) {
                return <MissingStackScreen title="法则不见了" />;
              }

              return (
                <LawDetail
                  law={law}
                  onDelete={() => {
                    deleteLaw(law.id);
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
    </>
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

  return (
    <View style={styles.bottomNavWrap}>
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
        aria-label="收集碎片"
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
        {tab.label}
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
  return (
    <Pressable style={styles.pageFloatingAction} onPress={onPress}>
      <Icon color={colors.primaryText} size={18} strokeWidth={2.35} />
      <Text style={styles.pageFloatingActionText}>{label}</Text>
    </Pressable>
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
      <PageHeader text="灵光乍现，也有去处。" />

      {fragments.length > 0 ? (
        <FragmentMasonry fragments={fragments} onOpen={onOpen} />
      ) : (
        <EmptyState
          title="还没有碎片"
          description="先拾起这一点，余下的交给时间。"
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
      <PageHeader text="给灵感一条路，让同一种表达方式可以反复被调用。" />

      {schemes.length > 0 ? (
        <View style={styles.listStack}>
          {schemes.map((scheme) => (
            <SchemeCard key={scheme.id} scheme={scheme} onOpen={onOpen} />
          ))}
        </View>
      ) : (
        <EmptyState
          title="还没有出稿方案"
          description="先写下一种可复用的表达路径，之后碎片就能沿着它自动酝酿成稿。"
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
      <PageHeader text="把你的表达经验收成条文，让每一次出稿都有迹可循。" />

      {laws.length > 0 ? (
        <View style={styles.listStack}>
          {laws.map((law) => (
            <LawCard key={law.id} law={law} onOpen={onOpen} />
          ))}
        </View>
      ) : (
        <EmptyState
          title="还没有创作法则"
          description="先收录一条你想反复遵循的表达判断，它会成为之后出稿时可以引用的创作准则。"
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
      minColumnWidth={172}
      estimateItemHeight={(fragment, columnWidth) =>
        estimateFragmentCardHeight(fragment, columnWidth)
      }
      renderItem={(fragment) => (
        <FragmentCard fragment={fragment} onOpen={onOpen} />
      )}
    />
  );
}

function MoreView() {
  return (
    <View style={styles.pageStack}>
      <PageHeader text="导出、导入、密钥和关于，先都放在这里。" />
      <View style={styles.moreList}>
        <MoreItem
          Icon={Download}
          title="导出数据"
          description="把本地碎片、方案和创作法典整理成备份文件。"
        />
        <MoreItem
          Icon={Upload}
          title="导入数据"
          description="从备份文件恢复到当前设备。"
        />
        <MoreItem
          Icon={KeyRound}
          title="API Key"
          description="之后可以在这里管理本机保存的模型服务密钥。"
        />
        <MoreItem
          Icon={Info}
          title="关于 EssAI"
          description="版本、说明和一些不常用的信息。"
        />
      </View>
    </View>
  );
}

function MoreItem({
  Icon,
  title,
  description,
}: {
  Icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <Pressable style={styles.moreItem}>
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
  const { columnWidth } = useColumnMetrics(172, 16);
  const draftCount = fragment.drafts.reduce(
    (sum, draft) => sum + draft.versions.length,
    0,
  );
  const previewHeight = estimateFragmentPreviewHeight(fragment, columnWidth);

  return (
    <Pressable style={styles.fragmentCard} onPress={() => onOpen(fragment.id)}>
      <View style={[styles.fragmentPreviewArea, { height: previewHeight }]}>
        <Text style={styles.fragmentPreviewText}>
          {fragment.content}
        </Text>
        <LinearGradient
          colors={["rgba(255, 253, 248, 0)", colors.card]}
          style={[styles.fragmentPreviewFade, styles.noPointerEvents]}
        />
      </View>

      <View style={styles.fragmentFooter}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {fragment.title}
        </Text>
        <View style={styles.simpleMetaRow}>
          <Text style={styles.mutedText}>{formatDate(fragment.createdAt)}</Text>
          {draftCount > 0 ? <Text style={styles.mutedText}>{draftCount} 稿</Text> : null}
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
    <View style={styles.gridCard}>
      <Pressable style={styles.gridCardContent} onPress={() => onOpen(scheme.id)}>
        <Text style={styles.gridCardTitle} numberOfLines={2}>
          {scheme.name}
        </Text>
        <Text style={styles.gridCardBody} numberOfLines={5}>
          {summarize(scheme.description, 180)}
        </Text>
      </Pressable>
      <View style={styles.gridCardFooter}>
        <Text style={styles.mutedText}>{formatDate(scheme.updatedAt)}</Text>
      </View>
    </View>
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
    <View style={styles.gridCard}>
      <Pressable style={styles.gridCardContent} onPress={() => onOpen(law.id)}>
        <Text style={styles.gridCardTitle} numberOfLines={2}>
          {law.name}
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
      </Pressable>
      <View style={styles.gridCardFooter}>
        <Text style={styles.mutedText}>{formatDate(law.updatedAt)}</Text>
      </View>
    </View>
  );
}

function ComposeSheet({
  schemes,
  onClose,
  onSubmit,
}: {
  schemes: Scheme[];
  onClose: () => void;
  onSubmit: (content: string, selection: SchemeSelection) => void;
}) {
  const [content, setContent] = useState("");
  const [selection, setSelection] = useState<SchemeSelection>(() =>
    Object.fromEntries(
      schemes.map((scheme, index) => [
        scheme.id,
        {
          selected: index === 0,
          count: 1 as Count,
        },
      ]),
    ),
  );
  const canSubmit = content.trim().length > 0;

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
    <Modal animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: "padding", default: undefined })}
        style={styles.modalShell}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <ModalHeader
            description="把这一刻想到的内容放进来就好，可以是一句话、一段素材，或者一个还没整理完整的想法。"
            onClose={onClose}
            title="收集碎片"
          />

          <View style={styles.composeBody}>
            <TextInput
              value={content}
              onChangeText={setContent}
              multiline
              textAlignVertical="top"
              placeholder="片段、判断、素材、吐槽、画面，甚至只是一个模糊的感觉，先写下来就好。"
              placeholderTextColor={colors.muted}
              style={styles.composeInput}
            />

            <SchemeSelectionScroller
              schemes={schemes}
              selection={selection}
              onCountChange={setCount}
              onToggle={toggleScheme}
            />
          </View>

          <View style={styles.modalFooter}>
            <Pressable
              disabled={!canSubmit}
              style={[styles.primaryButton, !canSubmit && styles.buttonDisabled]}
              onPress={() => onSubmit(content.trim(), selection)}
            >
              <Text style={styles.primaryButtonIcon}>✦</Text>
              <Text style={styles.primaryButtonText}>收集</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
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
        如果想现在先出几版初稿，可以在下面选择方案和数量；也可以先收起来，之后在碎片札记里再慢慢出稿。
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
                    style={[
                      styles.schemeTile,
                      item.selected && styles.schemeTileSelected,
                    ]}
                  >
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
                        {scheme.name}
                      </Text>
                      <Text style={styles.schemeTileBody} numberOfLines={4}>
                        {summarize(scheme.description, 96)}
                      </Text>
                    </Pressable>
                    <View style={styles.schemeTileFooter}>
                      <Text style={styles.mutedText}>稿次数</Text>
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
            title="还没有可选方案"
            description="这条碎片可以先收起来；等方案簿里有方案后，再回来为它出稿。"
          />
        )}
      </View>
    </View>
  );
}

function SchemeEditor({
  initialScheme,
  laws,
  onClose,
  onCreateLaw,
  onSubmit,
}: {
  initialScheme?: Scheme;
  laws: Law[];
  onClose: () => void;
  onCreateLaw: (name: string, content: string, tags: string[]) => Law;
  onSubmit: (name: string, description: string, lawIds: string[]) => void;
}) {
  const [availableLaws, setAvailableLaws] = useState(laws);
  const [name, setName] = useState(initialScheme?.name ?? "");
  const [description, setDescription] = useState(
    initialScheme?.description ?? "",
  );
  const [lawIds, setLawIds] = useState<string[]>(initialScheme?.lawIds ?? []);
  const [quickLawName, setQuickLawName] = useState("");
  const [quickLawContent, setQuickLawContent] = useState("");
  const [quickLawTags, setQuickLawTags] = useState<string[]>([]);
  const [quickLawError, setQuickLawError] = useState<string | null>(null);
  const canSubmit = name.trim().length > 0 && description.trim().length > 0;
  const canCreateLaw =
    quickLawName.trim().length > 0 && quickLawContent.trim().length > 0;

  useEffect(() => {
    setAvailableLaws((current) => mergeLawLists(laws, current));
  }, [laws]);

  function toggleLaw(lawId: string) {
    setLawIds((current) =>
      current.includes(lawId)
        ? current.filter((id) => id !== lawId)
        : [...current, lawId],
    );
  }

  function createQuickLaw() {
    const nextName = quickLawName.trim();
    const nextContent = quickLawContent.trim();

    if (!nextName || !nextContent) {
      setQuickLawError("名称和内容都填一下，就能先收进法典。");
      return;
    }

    const law = onCreateLaw(
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
    <Modal animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafeArea}>
        <ModalHeader
          description="把身份、题材、平台、时长、语气、输出形态和禁忌写清楚，之后就能反复复用。"
          onClose={onClose}
          title={initialScheme ? "编辑出稿方案" : "新建出稿方案"}
        />
        <ScrollView
          style={styles.modalScroll}
          contentContainerStyle={styles.formStack}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.inputLabel}>名称</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="例如：日常分享、读书感想、短视频口播..."
            placeholderTextColor={colors.muted}
            style={styles.singleInput}
          />
          <Text style={styles.inputLabel}>说明</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
            placeholder="例如：适合把零散想法整理成一段自然的分享。语气轻松一点，有自己的判断，不要太像正式文章..."
            placeholderTextColor={colors.muted}
            style={styles.noteInput}
          />
          <Text style={styles.inputLabel}>创作法则</Text>
          <Text style={styles.helpText}>
            从创作法典里挑选要引用的法则，也可以在这里新增。
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
                          {law.name}
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
              title="还没有可选法则"
              description="可以在法典里先收录一条。"
            />
          )}

          <View style={styles.quickLawBox}>
            <View style={styles.quickLawHeader}>
              <View style={styles.quickLawHeaderText}>
                <Text style={styles.quickLawTitle}>新增法则</Text>
                <Text style={styles.quickLawDescription}>
                  会先收进创作法典，并在这里自动选中。
                </Text>
              </View>
              <Pressable
                disabled={!canCreateLaw}
                style={[
                  styles.quickLawButton,
                  !canCreateLaw && styles.buttonDisabled,
                ]}
                onPress={createQuickLaw}
              >
                <Plus color={colors.primaryText} size={15} strokeWidth={2.4} />
                <Text style={styles.primaryButtonText}>收录</Text>
              </Pressable>
            </View>

            <View style={styles.quickLawFields}>
              <View style={styles.quickLawField}>
                <Text style={styles.inputLabel}>名称</Text>
                <TextInput
                  value={quickLawName}
                  onChangeText={setQuickLawName}
                  placeholder="例如：像正常说话..."
                  placeholderTextColor={colors.muted}
                  style={styles.singleInput}
                />
              </View>
            </View>

            <Text style={styles.inputLabel}>内容</Text>
            <TextInput
              value={quickLawContent}
              onChangeText={setQuickLawContent}
              multiline
              textAlignVertical="top"
              placeholder="例如：保留自然语气，不要把每句话都写得像课程大纲。"
              placeholderTextColor={colors.muted}
              style={styles.quickLawInput}
            />
            <TagEditor tags={quickLawTags} onChange={setQuickLawTags} />
            {quickLawError ? (
              <Text style={styles.errorText}>{quickLawError}</Text>
            ) : null}
          </View>
        </ScrollView>
        <View style={styles.modalFooter}>
          <Pressable
            disabled={!canSubmit}
            style={[styles.primaryButton, !canSubmit && styles.buttonDisabled]}
            onPress={() => onSubmit(name.trim(), description.trim(), lawIds)}
          >
            <Text style={styles.primaryButtonText}>
              {initialScheme ? "保存方案" : "创建方案"}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function LawEditor({
  initialLaw,
  onClose,
  onSubmit,
}: {
  initialLaw?: Law;
  onClose: () => void;
  onSubmit: (name: string, content: string, tags: string[]) => void;
}) {
  const [name, setName] = useState(initialLaw?.name ?? "");
  const [content, setContent] = useState(initialLaw?.content ?? "");
  const [tags, setTags] = useState<string[]>(initialLaw?.tags ?? []);
  const canSubmit = name.trim().length > 0 && content.trim().length > 0;

  return (
    <Modal animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafeArea}>
        <ModalHeader
          description="一条法则就是一条可复用的创作判断。出稿时，它会和方案一起影响内容的取舍、语气和结构。"
          onClose={onClose}
          title={initialLaw ? "修订创作法则" : "收录创作法则"}
        />
        <ScrollView
          style={styles.modalScroll}
          contentContainerStyle={styles.formStack}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.inputLabel}>名称</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="例如：黄金三秒..."
            placeholderTextColor={colors.muted}
            style={styles.singleInput}
          />
          <Text style={styles.inputLabel}>内容</Text>
          <TextInput
            value={content}
            onChangeText={setContent}
            multiline
            textAlignVertical="top"
            placeholder="例如：开头 3 秒内必须让观众知道这条内容和自己有什么关系..."
            placeholderTextColor={colors.muted}
            style={styles.noteInput}
          />
          <TagEditor tags={tags} onChange={setTags} />
        </ScrollView>
        <View style={styles.modalFooter}>
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
              {initialLaw ? "保存修订" : "收录"}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function TagEditor({
  label = "标签",
  onChange,
  tags,
}: {
  label?: string;
  onChange: (tags: string[]) => void;
  tags: string[];
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

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
      <Text style={styles.inputLabel}>{label}</Text>
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
        <View style={styles.centerModalOverlay}>
          <View style={styles.centerModalCard}>
            <Text style={styles.centerModalTitle}>新增标签</Text>
            <TextInput
              autoFocus
              value={draft}
              onChangeText={setDraft}
              placeholder="例如：语气"
              placeholderTextColor={colors.muted}
              maxLength={quickLawTagMaxLength}
              style={styles.singleInput}
            />
            <View style={styles.centerModalActions}>
              <Pressable style={styles.outlineButton} onPress={close}>
                <Text style={styles.outlineButtonText}>取消</Text>
              </Pressable>
              <Pressable
                disabled={!draft.trim()}
                style={[
                  styles.primaryButton,
                  !draft.trim() && styles.buttonDisabled,
                ]}
                onPress={save}
              >
                <Text style={styles.primaryButtonText}>保存</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ConfirmDialog({
  cancelLabel = "取消",
  confirmLabel = "确认",
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
  onRename,
}: {
  fragment: FragmentItem;
  schemes: Scheme[];
  onAddDraft: (fragmentId: string, scheme: Scheme) => void;
  onDelete: () => void;
  onRename: (id: string, title: string) => void;
}) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const defaultScheme = schemes[0];
  const sortedDrafts = [...fragment.drafts].sort(
    (a, b) =>
      new Date(latestDraftVersion(b)?.createdAt ?? 0).getTime() -
      new Date(latestDraftVersion(a)?.createdAt ?? 0).getTime(),
  );

  return (
    <SafeAreaView style={styles.stackSafeArea}>
        <ScrollView
          style={styles.detailScroll}
          contentContainerStyle={styles.detailInner}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.paperSurface}>{fragment.content}</Text>

          <View style={styles.actionRow}>
            <Pressable
              style={styles.outlineButton}
              onPress={() => onRename(fragment.id, `${fragment.title} `)}
            >
              <Text style={styles.outlineButtonText}>调整内容</Text>
            </Pressable>
            {defaultScheme ? (
              <Pressable
                style={styles.primaryButton}
                onPress={() => onAddDraft(fragment.id, defaultScheme)}
              >
                <Text style={styles.primaryButtonText}>出稿</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={styles.dangerButton}
              onPress={() => setDeleteConfirmOpen(true)}
            >
              <Text style={styles.dangerButtonText}>删除</Text>
            </Pressable>
          </View>

          <Text style={styles.sectionTitle}>成稿</Text>

          {sortedDrafts.length > 0 ? (
            <ResponsiveGrid
              items={sortedDrafts}
              minColumnWidth={220}
              renderItem={(draft) => {
                const latest = latestDraftVersion(draft);
                return (
                  <View style={styles.draftCard}>
                    <View>
                      <Text style={styles.gridCardTitle} numberOfLines={3}>
                        {draft.schemeName}
                      </Text>
                      <Text style={styles.gridCardBody} numberOfLines={6}>
                        {latest?.content ?? "这一稿还在酝酿中。"}
                      </Text>
                    </View>
                    <View style={styles.gridCardFooter}>
                      <Text style={styles.mutedText}>
                        {draft.versions.length} 个稿次
                      </Text>
                    </View>
                  </View>
                );
              }}
            />
          ) : (
            <EmptyState
              compact
              title="还没有成稿"
              description="可以从右上角选择出稿方案，让这条碎片先酝酿出第一版。"
            />
          )}
        </ScrollView>
      <ConfirmDialog
        confirmLabel="删除"
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={onDelete}
        subtitle="这条碎片和它派生出的成稿都会被删除。"
        title="删除碎片"
        visible={deleteConfirmOpen}
      />
    </SafeAreaView>
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
  onDelete: () => void;
  onEdit: () => void;
  onOpenFragment: (id: string) => void;
}) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const boundLaws = laws.filter((law) => scheme.lawIds.includes(law.id));
  const relatedFragments = fragments.filter((fragment) =>
    fragment.drafts.some((draft) => draft.schemeId === scheme.id),
  );

  return (
    <SafeAreaView style={styles.stackSafeArea}>
        <ScrollView
          style={styles.detailScroll}
          contentContainerStyle={styles.detailInner}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.paperSurface}>{scheme.description}</Text>
          <Text style={styles.sectionTitle}>创作法则</Text>
          {boundLaws.length > 0 ? (
            boundLaws.map((law) => (
              <View key={law.id} style={styles.lawDetailCard}>
                <Text style={styles.gridCardTitle}>{law.name}</Text>
                <Text style={styles.gridCardBody}>{law.content}</Text>
              </View>
            ))
          ) : (
            <EmptyState
              compact
              title="还没有绑定创作法则"
              description="编辑方案时可以从创作法典里选择法则。"
            />
          )}
          <Text style={styles.sectionTitle}>此间拾遗</Text>
          {relatedFragments.length > 0 ? (
            <FragmentMasonry
              fragments={relatedFragments}
              onOpen={onOpenFragment}
            />
          ) : (
            <EmptyState
              compact
              title="还没有碎片"
              description="当碎片经由这个方案成稿后，会出现在这里。"
            />
          )}
        </ScrollView>
        <View style={styles.modalFooterRow}>
          <Pressable
            style={styles.dangerButton}
            onPress={() => setDeleteConfirmOpen(true)}
          >
            <Text style={styles.dangerButtonText}>删除</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={onEdit}>
            <Text style={styles.primaryButtonText}>编辑方案</Text>
          </Pressable>
        </View>
      <ConfirmDialog
        confirmLabel="删除"
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={onDelete}
        subtitle={`「${scheme.name}」会从方案簿中移除。`}
        title="删除出稿方案"
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
  onDelete: () => void;
  onEdit: () => void;
}) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  return (
    <SafeAreaView style={styles.stackSafeArea}>
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
            <Text style={styles.dangerButtonText}>删除</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={onEdit}>
            <Text style={styles.primaryButtonText}>修订</Text>
          </Pressable>
        </View>
      <ConfirmDialog
        confirmLabel="删除"
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={onDelete}
        subtitle={`「${law.name}」会从创作法典中移除。`}
        title="删除创作法则"
        visible={deleteConfirmOpen}
      />
    </SafeAreaView>
  );
}

function MissingStackScreen({ title }: { title: string }) {
  return (
    <SafeAreaView style={styles.stackSafeArea}>
      <EmptyState
        title={title}
        description="这条内容可能已经被删除，或者当前预览数据还没有同步过来。"
      />
    </SafeAreaView>
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
    <View style={styles.modalHeader}>
      <View style={styles.modalHeaderText}>
        <Text style={styles.modalTitle}>{title}</Text>
        <Text style={styles.modalDescription}>{description}</Text>
      </View>
      <Pressable style={styles.closeButton} onPress={onClose}>
        <Text style={styles.closeButtonText}>关闭</Text>
      </Pressable>
    </View>
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

function createFragmentSeed({
  id,
  title,
  content,
  createdAt,
  draftSchemes,
}: {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  draftSchemes: Scheme[];
}): FragmentItem {
  return {
    id,
    title,
    content,
    createdAt,
    updatedAt: createdAt,
    drafts: draftSchemes.map((scheme, index) =>
      createDraft({
        scheme,
        fragmentContent: content,
        count: index === 0 ? 2 : 1,
      }),
    ),
  };
}

function createDraft({
  scheme,
  fragmentContent,
  count,
}: {
  scheme: Scheme;
  fragmentContent: string;
  count: Count | number;
}): Draft {
  return {
    id: createId("draft"),
    schemeId: scheme.id,
    schemeName: scheme.name,
    versions: Array.from({ length: count }, (_, index) =>
      createDraftVersion({
        scheme,
        fragmentContent,
        versionNo: index + 1,
      }),
    ),
  };
}

function createDraftVersion({
  scheme,
  fragmentContent,
  versionNo,
}: {
  scheme: Scheme;
  fragmentContent: string;
  versionNo: number;
}): DraftVersion {
  return {
    id: createId("version"),
    versionNo,
    status: "completed",
    createdAt: new Date().toISOString(),
    content: `这是根据「${scheme.name}」整理出的第 ${versionNo} 版初稿。\n\n${fragmentContent}\n\n接下来可以把开头再收紧一点，保留最有意思的判断，让它更适合直接拿去继续编辑。`,
  };
}

function latestDraftVersion(draft: Draft) {
  return draft.versions.at(-1);
}

function createFragmentTitle(content: string) {
  const firstLine = content.replace(/\s+/g, " ").trim();
  if (!firstLine) return "新碎片";
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
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function daysAgo(days: number) {
  return hoursAgo(days * 24);
}

const colors = {
  background: "#f8f1e6",
  card: "#fffdf8",
  muted: "#7f7164",
  mutedSurface: "#efe6d7",
  border: "#dfcfba",
  text: "#302117",
  primary: "#3f2415",
  primaryText: "#fff9ef",
  secondary: "#efe2ce",
  danger: "#b54a35",
  dangerSoft: "#f4ded7",
};

const shadow: StyleProp<ViewStyle> = {
  shadowColor: colors.text,
  shadowOpacity: 0.07,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
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
    marginLeft: -6,
    width: 42,
  },
  navigationHeaderTitle: {
    minWidth: 0,
    paddingRight: 8,
  },
  navigationHeaderPrimary: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "800",
    lineHeight: 25,
  },
  navigationHeaderSecondary: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 1,
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
    fontSize: 13,
    fontWeight: "800",
  },
  bottomNavTextActive: {
    color: colors.text,
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
    borderColor: "rgba(48, 33, 23, 0.1)",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 14,
    minHeight: 82,
    padding: 14,
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
  fragmentCard: {
    backgroundColor: colors.card,
    borderColor: "rgba(48, 33, 23, 0.1)",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    ...shadow,
  },
  fragmentPreviewArea: {
    backgroundColor: "rgba(239, 230, 215, 0.42)",
    minHeight: 184,
    overflow: "hidden",
    paddingHorizontal: 16,
    paddingTop: 20,
    position: "relative",
  },
  fragmentPreviewText: {
    color: "rgba(48, 33, 23, 0.82)",
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
  gridCard: {
    backgroundColor: colors.card,
    borderColor: "rgba(48, 33, 23, 0.1)",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
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
    backgroundColor: "rgba(239, 230, 215, 0.48)",
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
    flex: 1,
    backgroundColor: colors.background,
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
  composeBody: {
    flex: 1,
    gap: 18,
    minHeight: 0,
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
    backgroundColor: "rgba(239, 230, 215, 0.45)",
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
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    width: 208,
  },
  schemeTileSelected: {
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
    borderColor: "rgba(127, 113, 100, 0.55)",
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
    backgroundColor: "rgba(239, 230, 215, 0.5)",
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
    backgroundColor: "rgba(239, 230, 215, 0.32)",
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
    backgroundColor: "rgba(239, 230, 215, 0.42)",
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
    backgroundColor: "rgba(48, 33, 23, 0.24)",
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
  draftCard: {
    aspectRatio: 0.8,
    backgroundColor: colors.card,
    borderColor: "rgba(48, 33, 23, 0.1)",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "space-between",
    overflow: "hidden",
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
