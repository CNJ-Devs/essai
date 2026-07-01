import type { DemoState } from "@/lib/data/store-types";

export const DEMO_USER_ID = "user_demo";

export function createSeedState(): DemoState {
  const now = new Date().toISOString();

  const laws = [
    {
      id: "law_golden_3s",
      ownerUserId: DEMO_USER_ID,
      name: "黄金三秒",
      prompt:
        "开头 3 秒内必须让观众知道这条内容和自己有什么关系。优先使用冲突、反常识、结果前置、问题直击、身份反差中的一种。不要用低信息密度开场。",
      tags: ["开头", "短视频"],
      visibility: "private" as const,
      sourceLawId: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "law_point_first",
      ownerUserId: DEMO_USER_ID,
      name: "观点先行",
      prompt:
        "不要先铺垫背景，先给出这条内容最核心的判断。后续内容再解释这个判断为什么成立。每一段都要服务于这个核心观点。",
      tags: ["结构", "表达"],
      visibility: "private" as const,
      sourceLawId: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "law_less_preachy",
      ownerUserId: DEMO_USER_ID,
      name: "弱化说教感",
      prompt:
        "尽量避免居高临下地教育观众。多使用具体场景、个人经历、反思和观察。表达观点时保留一点开放感，允许观众有不同经历。",
      tags: ["语气", "个人 IP"],
      visibility: "private" as const,
      sourceLawId: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const schemes = [
    {
      id: "scheme_cto_car",
      userId: DEMO_USER_ID,
      name: "年轻 CTO 车内口播",
      description:
        "用于停车后或出发前录制的单人口播。目标平台是抖音、小红书、B 站，视频时长 1 到 3 分钟。输出口播逐字稿，语言自然，有观点，有个人经历，有反差感，但不要像知识付费广告。",
      lawIds: ["law_golden_3s", "law_point_first", "law_less_preachy"],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "scheme_cos_shoot",
      userId: DEMO_USER_ID,
      name: "COS 氛围感美拍",
      description:
        "用于无台词美拍视频，主题通常和 COS、穿搭、生活方式、氛围感有关。输出镜头、动作、时长、运镜、剪辑节奏、转场方式和音乐氛围。视频总长 15 到 45 秒。",
      lawIds: ["law_golden_3s"],
      createdAt: now,
      updatedAt: now,
    },
  ];

  const fragments = [
    {
      id: "fragment_manager_prove",
      userId: DEMO_USER_ID,
      title: "年轻管理者为什么总想证明自己",
      titleSource: "user" as const,
      content:
        "年轻管理者有时候不是想把事情做好，而是太想证明自己配得上这个位置。越想证明，越容易把团队带进一种紧绷状态。",
      createdAt: now,
      updatedAt: now,
    },
  ];

  const drafts = [
    {
      id: "draft_manager_cto_car",
      fragmentId: "fragment_manager_prove",
      schemeSnapshot: {
        schemeId: "scheme_cto_car",
        schemeName: "年轻 CTO 车内口播",
        schemeDescription: schemes[0].description,
        laws: laws
          .filter((law) => schemes[0].lawIds.includes(law.id))
          .map((law) => ({
            lawId: law.id,
            name: law.name,
            prompt: law.prompt,
            version: law.version,
          })),
        snapshottedAt: now,
      },
      versions: [
        {
          id: "draft_version_manager_1",
          draftId: "draft_manager_cto_car",
          versionNo: 1,
          status: "completed" as const,
          source: "ai" as const,
          content:
            "标题建议\n年轻管理者越想证明自己，团队越累\n\n内容定位\n一条适合车内口播的管理反思。\n\n核心表达\n管理者真正需要证明的，不是自己有多强，而是团队能不能因为你变得更稳。\n\n正文成稿\n很多年轻管理者刚开始带团队的时候，会有一个很隐蔽的念头：我得证明自己配得上这个位置。\n\n这个念头本身没问题，它甚至说明你在意结果。但问题是，一旦你太想证明自己，你就很容易把团队带进一种紧绷状态。\n\n别人提一个不同意见，你会觉得是在挑战你。项目出一点问题，你会下意识想马上证明不是你的判断错了。最后团队感受到的不是方向感，而是压力。\n\n我后来慢慢发现，管理者真正需要证明的，不是你比大家更聪明，也不是你永远对，而是团队能不能因为你在，变得更清楚、更稳定、更敢把问题说出来。\n\n所以年轻管理者最该练的，可能不是强势表达，而是降低自己的证明欲。",
          errorMessage: null,
          model: "local-fallback",
          promptTemplateVersion: "v1",
          createdAt: now,
          updatedAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
  ];

  return { fragments, schemes, laws, drafts };
}
