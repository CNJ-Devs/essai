import type { DemoState } from "@/lib/data/store-types";

export const DEMO_USER_ID = "user_demo";

export function createSeedState(): DemoState {
  const baseTime = Date.now();
  const now = new Date(baseTime).toISOString();
  const minutesAgo = (minutes: number) =>
    new Date(baseTime - minutes * 60_000).toISOString();

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

  const schemeFixtures = [
    {
      id: "scheme_cto_car",
      name: "年轻 CTO 车内口播",
      description:
        "用于停车后或出发前录制的单人口播。目标平台是抖音、小红书、B 站，视频时长 1 到 3 分钟。输出口播逐字稿，语言自然，有观点，有个人经历，有反差感，但不要像知识付费广告。",
      lawIds: ["law_golden_3s", "law_point_first", "law_less_preachy"],
    },
    {
      id: "scheme_cos_shoot",
      name: "COS 氛围感美拍",
      description:
        "用于无台词美拍视频，主题通常和 COS、穿搭、生活方式、氛围感有关。输出镜头、动作、时长、运镜、剪辑节奏、转场方式和音乐氛围。视频总长 15 到 45 秒。",
      lawIds: ["law_golden_3s"],
    },
    {
      id: "scheme_founder_note",
      name: "创始人长文随笔",
      description:
        "把一个产品判断、团队选择或行业观察写成偏长的公众号/即刻风格随笔。需要保留人的犹豫、推理过程和具体场景，避免像融资新闻稿或企业文化墙。",
      lawIds: ["law_point_first", "law_less_preachy"],
    },
    {
      id: "scheme_xhs_product_story",
      name: "小红书产品故事",
      description:
        "用于把一个小产品点、一句用户反馈或一个设计细节写成小红书图文。开头要轻，信息密度要高，结尾给人一种可以收藏或转发给朋友的感觉。",
      lawIds: ["law_golden_3s", "law_less_preachy"],
    },
    {
      id: "scheme_bilibili_outline",
      name: "B 站深度视频大纲",
      description:
        "把碎片扩展成 6 到 12 分钟的视频结构。输出标题、分段、每段核心观点、画面建议和过渡句。节奏不能像课程，要像一个人认真讲完一件自己想明白的事。",
      lawIds: ["law_point_first"],
    },
    {
      id: "scheme_launch_post",
      name: "产品上线说明",
      description:
        "用于产品发布、功能上线或版本更新。强调为什么做、适合谁、解决什么具体时刻的问题，以及用户第一步可以怎么试。语气克制，不要写成夸张的发布会通稿。",
      lawIds: ["law_point_first", "law_less_preachy"],
    },
    {
      id: "scheme_interview_answer",
      name: "访谈回答润色",
      description:
        "把零散回答整理成采访稿里的完整表达。保留口语感，但去掉重复和散乱。适合创始人访谈、播客逐字稿整理、媒体问答或个人品牌内容复用。",
      lawIds: ["law_less_preachy"],
    },
    {
      id: "scheme_script_short",
      name: "30 秒短视频脚本",
      description:
        "输出短视频逐字稿，控制在 30 秒左右。必须有一个清楚的开头钩子，一个具体例子，一个可被记住的收束句。适合日更、轻量观点、生活观察。",
      lawIds: ["law_golden_3s", "law_point_first"],
    },
    {
      id: "scheme_script_long_name_density_test",
      name: "超长标题测试：把一个很小很散的念头慢慢酿成一条既有观点又不失温度的内容",
      description:
        "专门用于测试卡片标题换行、说明截断和 grid 高度稳定性。这个方案的名字故意很长，说明也故意偏长：它应该在弹窗里被优雅地限制，而不是把卡片撑坏、把按钮挤走，或者让整个弹窗显得支离破碎。",
      lawIds: ["law_golden_3s", "law_point_first", "law_less_preachy"],
    },
    {
      id: "scheme_thread_series",
      name: "连续帖系列",
      description:
        "把一个碎片拆成 5 到 8 条连续短帖，每条有独立信息点，又能连成一个完整脉络。适合微博、Threads、即刻动态或社区长讨论。",
      lawIds: ["law_point_first"],
    },
    {
      id: "scheme_ad_soft",
      name: "软性转化文案",
      description:
        "把一个观点自然引到产品使用场景。重点不是硬卖，而是让读者意识到自己也遇到过这个问题，并理解为什么这个工具会在那个时刻有用。",
      lawIds: ["law_less_preachy", "law_point_first"],
    },
    {
      id: "scheme_email_update",
      name: "用户邮件更新",
      description:
        "写给早期用户的产品进展邮件。结构清楚、语气真诚，告诉用户最近做了什么、为什么做、他们可以怎么试，以及团队接下来想验证什么。",
      lawIds: ["law_point_first", "law_less_preachy"],
    },
    {
      id: "scheme_pitch_one_page",
      name: "一页式 Pitch",
      description:
        "把碎片整理成适合投资人或合作方快速理解的一页式表达。包含问题、洞察、方案、为什么现在、为什么是我们。语气要清楚，不要堆概念。",
      lawIds: ["law_point_first"],
    },
    {
      id: "scheme_title_pack",
      name: "标题包生成",
      description:
        "只输出标题候选，不生成正文。给出 12 个不同角度：冲突型、结果型、故事型、反常识型、提问型、温柔观察型等，并说明每类标题适合的平台。",
      lawIds: ["law_golden_3s"],
    },
    {
      id: "scheme_live_talk",
      name: "直播开场白",
      description:
        "把碎片变成直播前 2 分钟的开场。需要快速交代今天聊什么、为什么值得听、观众会得到什么，并自然带入互动问题。",
      lawIds: ["law_golden_3s", "law_less_preachy"],
    },
    {
      id: "scheme_course_outline",
      name: "小课结构",
      description:
        "把一个经验拆成轻量课程结构。输出学习目标、章节安排、每节核心例子和练习。不要像企业内训 PPT，要像一个人把经验认真交给另一个人。",
      lawIds: ["law_point_first", "law_less_preachy"],
    },
    {
      id: "scheme_scene_storyboard",
      name: "场景分镜",
      description:
        "用于把一个观点转成可拍摄的短片分镜。输出场景、画面、动作、字幕、声音和剪辑节奏。适合产品故事、情绪短片、生活方式内容。",
      lawIds: ["law_golden_3s"],
    },
    {
      id: "scheme_community_reply",
      name: "社区回复",
      description:
        "把碎片写成一条高质量评论或回复。它不需要完整成文，但要有态度、有信息量、有一点人的温度，避免像机器人客服或空泛鼓励。",
      lawIds: ["law_less_preachy"],
    },
    {
      id: "scheme_internal_memo",
      name: "团队内部 Memo",
      description:
        "把一个想法整理成团队内部 memo。说明背景、判断、风险、下一步和需要大家一起决定的问题。语气要坦诚，不装作所有事情已经确定。",
      lawIds: ["law_point_first", "law_less_preachy"],
    },
    {
      id: "scheme_poetic_caption",
      name: "图文短句",
      description:
        "用于照片、截图或作品集旁边的短句。输出 10 条不同气质的 caption：克制、轻盈、故事感、带一点幽默、带一点留白。不要过度文艺。",
      lawIds: ["law_less_preachy"],
    },
  ];

  const schemes = schemeFixtures.map((scheme) => ({
    ...scheme,
    userId: DEMO_USER_ID,
    createdAt: now,
    updatedAt: now,
  }));

  const fragments = [
    {
      id: "fragment_product_name",
      userId: DEMO_USER_ID,
      title: "“拾光集”这个名字像一个容器",
      titleSource: "user" as const,
      content: "它不是文件夹，也不是素材库，更像把还没成形的念头先接住。",
      createdAt: minutesAgo(4),
      updatedAt: minutesAgo(4),
    },
    {
      id: "fragment_launch_pressure",
      userId: DEMO_USER_ID,
      title: "不要把发布会做成审判现场",
      titleSource: "user" as const,
      content:
        "很多新产品第一次对外讲的时候，团队会不自觉地把自己放到被审判的位置：每句话都要证明自己没错，每个功能都要解释为什么值得存在。结果是观众还没理解产品，先感受到一种紧张。也许发布会真正要做的不是辩护，而是让别人进入一个具体场景，看到这个东西为什么会在那一刻被需要。",
      createdAt: minutesAgo(13),
      updatedAt: minutesAgo(13),
    },
    {
      id: "fragment_cos_weather",
      userId: DEMO_USER_ID,
      title: "雨天 COS 反而更容易有氛围",
      titleSource: "user" as const,
      content:
        "如果是小雨，不一定要躲。湿掉的地面会把霓虹和路灯反出来，伞、风、头发贴在脸侧这些细节都能让画面变得更像故事。关键是不要拍成狼狈感，而是让人物像刚从某个剧情里走出来。",
      createdAt: minutesAgo(21),
      updatedAt: minutesAgo(21),
    },
    {
      id: "fragment_hiring_note",
      userId: DEMO_USER_ID,
      title: "面试里最难问出的不是能力，是自我修正能力",
      titleSource: "user" as const,
      content:
        "候选人会提前准备项目经历，也会准备失败案例。但真正有信息量的地方，往往不是他说自己失败了什么，而是他后来有没有改变做事方式。比如他以前怎么判断优先级，现在怎么判断；以前怎么处理冲突，现在怎么处理；有没有某个具体习惯是因为那次失败才建立的。",
      createdAt: minutesAgo(37),
      updatedAt: minutesAgo(37),
    },
    {
      id: "fragment_manager_prove",
      userId: DEMO_USER_ID,
      title: "年轻管理者为什么总想证明自己",
      titleSource: "user" as const,
      content:
        "年轻管理者有时候不是想把事情做好，而是太想证明自己配得上这个位置。越想证明，越容易把团队带进一种紧绷状态。",
      createdAt: minutesAgo(52),
      updatedAt: minutesAgo(52),
    },
    {
      id: "fragment_user_quote",
      userId: DEMO_USER_ID,
      title: "用户说“不想再开一个文档”",
      titleSource: "user" as const,
      content:
        "今天访谈里有一句话挺刺中我的：不是我没有地方写东西，是我不想再开一个文档。文档意味着我要开始整理、分类、命名、决定这是不是一篇东西。但很多时候我只有一句话、一个例子、一个刚刚冒出来的角度。它太小了，小到不配打开一个正式空间；但它又太有用，丢掉会可惜。",
      createdAt: minutesAgo(68),
      updatedAt: minutesAgo(68),
    },
    {
      id: "fragment_bus_sleep",
      userId: DEMO_USER_ID,
      title: "公交车上犯困时冒出来的一句话",
      titleSource: "user" as const,
      content:
        "真正消耗人的不是忙，而是每件事都没有结束感。",
      createdAt: minutesAgo(91),
      updatedAt: minutesAgo(91),
    },
    {
      id: "fragment_pricing_fear",
      userId: DEMO_USER_ID,
      title: "定价焦虑像是在给未来的用户道歉",
      titleSource: "user" as const,
      content:
        "做产品定价时最容易掉进去的坑，是还没开口就开始替用户觉得贵。于是你不断压低价格、增加权益、解释自己不是想赚钱，最后反而把产品价值讲得越来越轻。也许定价不是道歉，而是把产品能解决的问题、节省的时间、带来的确定性说清楚。用户可以选择不买，但不需要你先替他把价值否定掉。",
      createdAt: minutesAgo(126),
      updatedAt: minutesAgo(126),
    },
  ];

  const managerDraftSnapshot = {
    schemeId: "scheme_cto_car",
    schemeName: "年轻 CTO 车内口播",
    schemeDescription: schemes[0].description,
    laws: laws
      .filter((law) => schemes[0].lawIds.includes(law.id))
      .map((law) => ({
        lawId: law.id,
        name: law.name,
        prompt: law.prompt,
      })),
    snapshottedAt: now,
  };

  const drafts = [
    {
      id: "draft_manager_cto_car",
      fragmentId: "fragment_manager_prove",
      schemeSnapshot: managerDraftSnapshot,
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
          snapshot: {
            type: "scheme" as const,
            version: 1 as const,
            content: managerDraftSnapshot,
          },
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
