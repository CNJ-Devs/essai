#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync, spawn } from "node:child_process";

const repoRoot = resolve(import.meta.dirname, "..");
const mobileDir = resolve(repoRoot, "packages/mobile");
const defaultEnvFile = resolve(mobileDir, ".env.production");

const usage = `
Usage:
  npm run mobile:package -- <ios|android|all> [options]

Options:
  --env-file <path>          Env file to load. Defaults to packages/mobile/.env.production.
  --android-variant <name>   Android Gradle variant: release or debug. Defaults to release.
  --ios-device <value>       iOS device selector. Defaults to the first connected device.
                             Use generic for a build-only simulator app.
  --no-clean                 Skip clean Expo prebuild before packaging.
  -h, --help                 Show this help.

Examples:
  npm run mobile:package:android
  npm run mobile:package:ios
  npm run mobile:package -- all
  npm run mobile:package -- ios --ios-device generic
`;

const args = process.argv.slice(2);
const target = args[0];

if (!target || target === "-h" || target === "--help") {
  console.log(usage.trim());
  process.exit(0);
}

if (!["ios", "android", "all"].includes(target)) {
  console.error(`Unknown mobile package target: ${target}`);
  console.error(usage.trim());
  process.exit(1);
}

const options = parseOptions(args.slice(1));
const envFile = resolve(repoRoot, options.envFile ?? defaultEnvFile);
const buildEnv = normalizeBuildEnv({
  ...process.env,
  ...readEnvFile(envFile),
  ...resolveBuildEnv(target),
});

if (!options.envFile && !existsSync(defaultEnvFile)) {
  console.error(`Missing default env file: ${defaultEnvFile}`);
  process.exit(1);
}

console.log(`Using env file: ${envFile}`);
if (buildEnv.ANDROID_HOME && buildEnv.ANDROID_HOME !== process.env.ANDROID_HOME) {
  console.log(`Using ANDROID_HOME: ${buildEnv.ANDROID_HOME}`);
}
if (buildEnv.JAVA_HOME && buildEnv.JAVA_HOME !== process.env.JAVA_HOME) {
  console.log(`Using JAVA_HOME: ${buildEnv.JAVA_HOME}`);
}

if (target === "all") {
  await prebuild("all", options);
  await packageAndroid(options, false);
  await packageIos(options, false);
} else if (target === "android") {
  await prebuild("android", options);
  await packageAndroid(options, false);
} else {
  await prebuild("ios", options);
  await packageIos(options, false);
}

async function prebuild(platform, options) {
  if (!options.clean) return;

  const command = ["expo", "prebuild", "--clean"];

  if (platform !== "all") {
    command.push("--platform", platform);
  }

  await run("npx", command, { cwd: mobileDir });
  restoreMobileDevScripts();
}

async function packageAndroid(options) {
  const androidDir = resolve(mobileDir, "android");

  if (!existsSync(androidDir)) {
    throw new Error("Missing Android project. Run prebuild first.");
  }

  const variant = options.androidVariant;
  const task =
    variant === "debug" ? ":app:assembleDebug" : ":app:assembleRelease";

  await run("./gradlew", [task, "--no-daemon"], { cwd: androidDir });

  const output =
    variant === "debug"
      ? "packages/mobile/android/app/build/outputs/apk/debug/"
      : "packages/mobile/android/app/build/outputs/apk/release/";

  console.log(`Android output: ${output}`);
}

async function packageIos(options) {
  const iosDevice = options.iosDevice ?? detectFirstIosDevice();

  if (!iosDevice) {
    throw new Error(
      "No connected iOS device found. Unlock the device, trust this computer, and try again.",
    );
  }

  const command = [
    "expo",
    "run:ios",
    "--configuration",
    "Release",
    "--device",
    iosDevice,
  ];

  if (iosDevice === "generic") {
    command.push("--output", resolve(repoRoot, "build/mobile/ios"));
  }

  await run("npx", command, { cwd: mobileDir });

  if (iosDevice === "generic") {
    console.log("iOS simulator app output: build/mobile/ios/");
  }
}

function detectFirstIosDevice() {
  try {
    const output = execFileSync("xcrun", ["devicectl", "list", "devices"], {
      encoding: "utf8",
    });
    const rows = output
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    for (const row of rows) {
      const columns = row.split(/\s{2,}/);
      const [name, , , state, model] = columns;

      if (
        name &&
        (state === "available" || state?.startsWith("connected")) &&
        (model?.startsWith("iPhone") || model?.startsWith("iPad"))
      ) {
        return name;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function parseOptions(args) {
  const options = {
    androidVariant: "release",
    clean: true,
    envFile: null,
    iosDevice: null,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--env-file") {
      options.envFile = readOptionValue(args, ++index, arg);
    } else if (arg === "--android-variant") {
      const variant = readOptionValue(args, ++index, arg);

      if (!["debug", "release"].includes(variant)) {
        throw new Error("--android-variant must be debug or release.");
      }

      options.androidVariant = variant;
    } else if (arg === "--ios-device") {
      options.iosDevice = readOptionValue(args, ++index, arg);
    } else if (arg === "--no-clean") {
      options.clean = false;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function readOptionValue(args, index, optionName) {
  const value = args[index];

  if (!value || value.startsWith("-")) {
    throw new Error(`Missing value for ${optionName}.`);
  }

  return value;
}

function readEnvFile(path) {
  if (!existsSync(path)) {
    throw new Error(`Missing env file: ${path}`);
  }

  const env = {};
  const lines = readFileSync(path, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");

    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();

    env[key] = unquote(value);
  }

  return env;
}

function restoreMobileDevScripts() {
  const packageJsonPath = resolve(mobileDir, "package.json");
  const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));

  pkg.scripts = {
    ...pkg.scripts,
    android: "expo start --android",
    ios: "expo start --ios",
  };

  writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
}

function resolveBuildEnv(target) {
  const env = {};
  const pathParts = [];

  if (target !== "ios") {
    const androidSdkRoot = resolveAndroidSdkRoot();

    if (androidSdkRoot) {
      env.ANDROID_HOME = androidSdkRoot;
      env.ANDROID_SDK_ROOT = androidSdkRoot;
      pathParts.push(
        resolve(androidSdkRoot, "platform-tools"),
        resolve(androidSdkRoot, "emulator"),
        resolve(androidSdkRoot, "cmdline-tools/latest/bin"),
      );
    }

    const javaHome = resolveJavaHome();

    if (javaHome) {
      env.JAVA_HOME = javaHome;
      pathParts.push(resolve(javaHome, "bin"));
    }
  }

  if (pathParts.length > 0) {
    env.PATH = [...pathParts, process.env.PATH ?? ""].join(":");
  }

  return env;
}

function normalizeBuildEnv(env) {
  if (!env.NODE_ENV) {
    env.NODE_ENV = "production";
  }

  delete env.FORCE_COLOR;
  delete env.NO_COLOR;

  return env;
}

function resolveAndroidSdkRoot() {
  const sdkRoot =
    process.env.ANDROID_HOME ||
    process.env.ANDROID_SDK_ROOT ||
    resolve(process.env.HOME ?? "", "Library/Android/sdk");

  return existsSync(sdkRoot) ? sdkRoot : null;
}

function resolveJavaHome() {
  if (process.platform !== "darwin") return null;

  try {
    return execFileSync("/usr/libexec/java_home", ["-v", "17"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return null;
  }
}

function unquote(value) {
  const quote = value[0];

  if (
    (quote === "\"" || quote === "'") &&
    value.endsWith(quote) &&
    value.length >= 2
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function run(command, args, options) {
  console.log(`\n$ ${command} ${args.join(" ")}`);

  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      ...options,
      env: buildEnv,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolveRun();
        return;
      }

      reject(new Error(`${command} exited with code ${code}.`));
    });
  });
}
