import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 30;

const androidReleaseTagPattern = /^essai-android-v\d+\.\d+\.\d+$/;
const iosReleaseTagPattern = /^essai-ios-v\d+\.\d+\.\d+$/;
const androidGithubEventType = "eas-android-build-finished";
const iosGithubEventType = "eas-ios-build-finished";

const easBuildWebhookSchema = z
  .object({
    id: z.string(),
    accountName: z.string().optional(),
    appId: z.string().optional(),
    artifacts: z
      .object({
        buildUrl: z.string().url().optional(),
      })
      .passthrough()
      .optional(),
    buildDetailsPageUrl: z.string().url().optional(),
    metadata: z
      .object({
        appBuildVersion: z.string().optional(),
        appIdentifier: z.string().optional(),
        appName: z.string().optional(),
        appVersion: z.string().optional(),
        buildProfile: z.string().optional(),
        distribution: z.string().optional(),
        gitCommitHash: z.string().optional(),
        message: z.string().optional(),
      })
      .passthrough()
      .optional(),
    platform: z.enum(["android", "ios"]),
    projectName: z.string().optional(),
    status: z.enum(["finished", "errored", "canceled"]),
  })
  .passthrough();

export async function POST(request: Request) {
  const startedAt = Date.now();
  const rawBody = await request.text();
  const secret = process.env.EAS_WEBHOOK_SECRET;

  if (!secret) {
    return jsonError({
      code: "missing_webhook_secret",
      message: "EAS_WEBHOOK_SECRET is not configured.",
      startedAt,
      status: 500,
    });
  }

  if (
    !verifyExpoSignature({
      rawBody,
      secret,
      signature: request.headers.get("expo-signature"),
    })
  ) {
    return jsonError({
      code: "invalid_signature",
      message: "EAS webhook signature does not match.",
      startedAt,
      status: 401,
    });
  }

  let body: unknown;

  try {
    body = JSON.parse(rawBody);
  } catch {
    return jsonError({
      code: "invalid_json",
      message: "Webhook body must be valid JSON.",
      startedAt,
      status: 400,
    });
  }

  const parsed = easBuildWebhookSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError({
      code: "invalid_payload",
      message: z.prettifyError(parsed.error),
      startedAt,
      status: 400,
    });
  }

  const payload = parsed.data;
  const releaseTag = payload.metadata?.message;

  if (payload.status !== "finished") {
    return jsonIgnored({
      reason: `${payload.platform}_build_${payload.status}`,
      startedAt,
    });
  }

  if (payload.platform === "android") {
    return handleAndroidBuild({ payload, releaseTag, startedAt });
  }

  return handleIosBuild({ payload, releaseTag, startedAt });
}

async function handleAndroidBuild({
  payload,
  releaseTag,
  startedAt,
}: {
  payload: z.infer<typeof easBuildWebhookSchema>;
  releaseTag: string | undefined;
  startedAt: number;
}) {
  if (!releaseTag || !androidReleaseTagPattern.test(releaseTag)) {
    return jsonIgnored({ reason: "missing_or_invalid_android_release_tag", startedAt });
  }

  if (!payload.artifacts?.buildUrl) {
    return jsonError({
      code: "missing_artifact_url",
      message: "Finished Android build did not include artifacts.buildUrl.",
      startedAt,
      status: 422,
    });
  }

  try {
    const dispatchTokenExpiry = await dispatchGithubEvent({
      eventType: androidGithubEventType,
      payload: {
        appBuildVersion: payload.metadata?.appBuildVersion ?? null,
        appIdentifier: payload.metadata?.appIdentifier ?? null,
        appVersion: payload.metadata?.appVersion ?? null,
        buildDetailsPageUrl: payload.buildDetailsPageUrl ?? null,
        buildId: payload.id,
        buildProfile: payload.metadata?.buildProfile ?? null,
        buildUrl: payload.artifacts.buildUrl,
        distribution: payload.metadata?.distribution ?? null,
        gitCommitHash: payload.metadata?.gitCommitHash ?? null,
        releaseTag,
      },
    });

    return Response.json({
      ok: true,
      dispatched: true,
      dispatchTokenExpiry,
      eventType: androidGithubEventType,
      releaseTag,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    return jsonError({
      code: "github_dispatch_failed",
      message: error instanceof Error ? error.message : "GitHub dispatch failed.",
      startedAt,
      status: 500,
    });
  }
}

async function handleIosBuild({
  payload,
  releaseTag,
  startedAt,
}: {
  payload: z.infer<typeof easBuildWebhookSchema>;
  releaseTag: string | undefined;
  startedAt: number;
}) {
  if (!releaseTag || !iosReleaseTagPattern.test(releaseTag)) {
    return jsonIgnored({ reason: "missing_or_invalid_ios_release_tag", startedAt });
  }

  if (
    payload.metadata?.buildProfile !== "production" ||
    payload.metadata?.distribution !== "store"
  ) {
    return jsonIgnored({ reason: "non_store_ios_build", startedAt });
  }

  try {
    const dispatchTokenExpiry = await dispatchGithubEvent({
      eventType: iosGithubEventType,
      payload: {
        appBuildVersion: payload.metadata?.appBuildVersion ?? null,
        appIdentifier: payload.metadata?.appIdentifier ?? null,
        appVersion: payload.metadata?.appVersion ?? null,
        buildDetailsPageUrl: payload.buildDetailsPageUrl ?? null,
        buildId: payload.id,
        buildProfile: payload.metadata?.buildProfile ?? null,
        distribution: payload.metadata?.distribution ?? null,
        gitCommitHash: payload.metadata?.gitCommitHash ?? null,
        releaseTag,
      },
    });

    return Response.json({
      ok: true,
      dispatched: true,
      dispatchTokenExpiry,
      eventType: iosGithubEventType,
      releaseTag,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    return jsonError({
      code: "github_dispatch_failed",
      message: error instanceof Error ? error.message : "GitHub dispatch failed.",
      startedAt,
      status: 500,
    });
  }
}

function verifyExpoSignature({
  rawBody,
  secret,
  signature,
}: {
  rawBody: string;
  secret: string;
  signature: string | null;
}) {
  if (!signature) return false;

  const digest = createHmac("sha1", secret).update(rawBody).digest("hex");
  const expected = `sha1=${digest}`;
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (signatureBuffer.length !== expectedBuffer.length) return false;

  return timingSafeEqual(signatureBuffer, expectedBuffer);
}

async function dispatchGithubEvent({
  eventType,
  payload,
}: {
  eventType: typeof androidGithubEventType | typeof iosGithubEventType;
  payload: Record<string, string | null>;
}) {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repository = process.env.GITHUB_DISPATCH_REPOSITORY || "CNJ-Devs/essai";

  if (!token) {
    throw new Error("GITHUB_DISPATCH_TOKEN is not configured.");
  }

  const response = await fetch(
    `https://api.github.com/repos/${repository}/dispatches`,
    {
      body: JSON.stringify({
        client_payload: payload,
        event_type: eventType,
      }),
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "essai-eas-webhook",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      method: "POST",
    },
  );

  if (!response.ok) {
    const body = await response.text();

    throw new Error(
      `Failed to dispatch GitHub workflow: ${response.status} ${body}`,
    );
  }

  return checkDispatchTokenExpiry(
    response.headers.get("github-authentication-token-expiration"),
  );
}

function checkDispatchTokenExpiry(expiresAtValue: string | null) {
  if (!expiresAtValue) {
    return {
      daysLeft: null,
      expiresAt: null,
      level: "unknown",
    };
  }

  const expiresAt = new Date(expiresAtValue);

  if (Number.isNaN(expiresAt.getTime())) {
    console.warn(`GitHub token expiration header is invalid: ${expiresAtValue}`);

    return {
      daysLeft: null,
      expiresAt: expiresAtValue,
      level: "invalid_header",
    };
  }

  const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000);
  const notice =
    daysLeft <= 0
      ? {
          daysLeft,
          expiresAt: expiresAtValue,
          level: "expired",
        }
      : daysLeft <= 7
        ? {
            daysLeft,
            expiresAt: expiresAtValue,
            level: "critical",
          }
        : daysLeft <= 30
          ? {
              daysLeft,
              expiresAt: expiresAtValue,
              level: "warning",
            }
          : {
              daysLeft,
              expiresAt: expiresAtValue,
              level: "ok",
            };

  if (notice.level !== "ok") {
    console.warn(
      `GITHUB_DISPATCH_TOKEN expiry status: ${notice.level}; ${daysLeft} day(s) left.`,
    );

    // TODO: Send this warning to Feishu or another external notification channel.
    // This route is invoked by EAS webhooks, so it only checks expiry when
    // builds finish and GitHub returns the token expiration header.
  }

  return notice;
}

function jsonIgnored({
  reason,
  startedAt,
}: {
  reason: string;
  startedAt: number;
}) {
  return Response.json({
    ok: true,
    dispatched: false,
    reason,
    durationMs: Date.now() - startedAt,
  });
}

function jsonError({
  code,
  message,
  startedAt,
  status,
}: {
  code: string;
  message: string;
  startedAt: number;
  status: number;
}) {
  return Response.json(
    {
      ok: false,
      error: {
        code,
        message,
      },
      durationMs: Date.now() - startedAt,
    },
    { status },
  );
}
