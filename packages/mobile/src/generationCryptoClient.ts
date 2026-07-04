declare const require: (id: string) => unknown;

type EncryptedApiKey = {
  alg: "RSA-OAEP-256";
  ciphertext: string;
  encoding: "base64url";
};

type EncryptedRequestEnvelope = {
  encryptedRequest: {
    alg: "A256GCM+RSA-OAEP-256";
    ciphertext: string;
    encryptedKey: string;
    encoding: "base64url";
    iv: string;
  };
  schemaVersion: 1;
};

type GenerationCryptoClientOptions = {
  apiKeyEncryptionPublicJwk?: string;
  generationApiBaseUrl: string;
  requestEncryptionPublicJwk?: string;
};

type GenerationCryptoBackend = {
  encryptRequest(
    payload: Record<string, unknown>,
    publicJwk: string,
  ): Promise<EncryptedRequestEnvelope>;
  encryptRsaOaep(value: Uint8Array, publicJwk: string): Promise<Uint8Array>;
};

type QuickCryptoCipher = {
  final(): Uint8Array;
  getAuthTag(): Uint8Array;
  update(data: Uint8Array): Uint8Array;
};

type QuickCryptoModule = {
  Buffer?: {
    concat(values: Uint8Array[]): Uint8Array;
    from(value: ArrayBuffer | ArrayBufferView | string): Uint8Array;
  };
  constants: {
    RSA_PKCS1_OAEP_PADDING: number;
  };
  createCipheriv(
    algorithm: string,
    key: Uint8Array,
    iv: Uint8Array,
  ): QuickCryptoCipher;
  publicEncrypt(
    options: { key: string; oaepHash: string; padding: number },
    value: Uint8Array,
  ): Uint8Array;
  randomBytes(size: number): Uint8Array;
};

type RsaPublicJwk = {
  e: string;
  kty: "RSA";
  n: string;
};

export class GenerationApiConfigurationError extends Error {
  reason: "invalid-key" | "missing-backend" | "missing-key";

  constructor(reason: GenerationApiConfigurationError["reason"]) {
    super(
      reason === "missing-backend"
        ? "Generation encryption is not available in this runtime."
        : "Generation encryption is not configured.",
    );
    this.reason = reason;
  }
}

export async function prepareGenerationApiBody<
  T extends Record<string, unknown>,
>(request: T, options: GenerationCryptoClientOptions) {
  if (isLocalGenerationApiUrl(options.generationApiBaseUrl)) {
    return request;
  }

  const requestPublicKey = readPublicKey(options.requestEncryptionPublicJwk);
  const backend = getGenerationCryptoBackend();

  if (!backend) {
    throw new GenerationApiConfigurationError("missing-backend");
  }

  const withEncryptedApiKey = await maybeEncryptProviderApiKey(
    request,
    backend,
    options.apiKeyEncryptionPublicJwk,
  );

  return backend.encryptRequest(withEncryptedApiKey, requestPublicKey);
}

async function maybeEncryptProviderApiKey<T extends Record<string, unknown>>(
  request: T,
  backend: GenerationCryptoBackend,
  publicJwk?: string,
) {
  const apiKey = typeof request.apiKey === "string" ? request.apiKey : "";

  if (!apiKey) {
    return request;
  }

  const publicKey = readPublicKey(publicJwk);
  const encryptedApiKey: EncryptedApiKey = {
    alg: "RSA-OAEP-256",
    ciphertext: bytesToBase64Url(
      await backend.encryptRsaOaep(textToBytes(apiKey), publicKey),
    ),
    encoding: "base64url",
  };
  const { apiKey: _apiKey, ...rest } = request;

  return {
    ...rest,
    encryptedApiKey,
  };
}

function getGenerationCryptoBackend() {
  return createQuickCryptoBackend() ?? createWebCryptoBackend();
}

function createQuickCryptoBackend(): GenerationCryptoBackend | null {
  const quickCrypto = loadQuickCrypto();

  if (!quickCrypto) return null;

  return {
    async encryptRequest(payload, publicJwk) {
      const aesKey = toUint8Array(quickCrypto.randomBytes(32));
      const iv = toUint8Array(quickCrypto.randomBytes(12));
      const cipher = quickCrypto.createCipheriv("aes-256-gcm", aesKey, iv);
      const encrypted = concatBytes(
        toUint8Array(cipher.update(textToBytes(JSON.stringify(payload)))),
        toUint8Array(cipher.final()),
        toUint8Array(cipher.getAuthTag()),
      );
      const encryptedKey = await this.encryptRsaOaep(aesKey, publicJwk);

      return {
        encryptedRequest: {
          alg: "A256GCM+RSA-OAEP-256",
          ciphertext: bytesToBase64Url(encrypted),
          encryptedKey: bytesToBase64Url(encryptedKey),
          encoding: "base64url",
          iv: bytesToBase64Url(iv),
        },
        schemaVersion: 1,
      };
    },
    async encryptRsaOaep(value, publicJwk) {
      const pem = rsaPublicJwkToSpkiPem(publicJwk);

      return toUint8Array(
        quickCrypto.publicEncrypt(
          {
            key: pem,
            oaepHash: "sha256",
            padding: quickCrypto.constants.RSA_PKCS1_OAEP_PADDING,
          },
          value,
        ),
      );
    },
  };
}

function createWebCryptoBackend(): GenerationCryptoBackend | null {
  const subtle = globalThis.crypto?.subtle;

  if (!subtle || !globalThis.crypto?.getRandomValues) return null;

  return {
    async encryptRequest(payload, publicJwk) {
      const aesKey = await subtle.generateKey(
        { length: 256, name: "AES-GCM" },
        true,
        ["encrypt", "decrypt"],
      );
      const aesRaw = await subtle.exportKey("raw", aesKey);
      const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await subtle.encrypt(
        { iv, name: "AES-GCM" },
        aesKey,
        textToBytes(JSON.stringify(payload)),
      );
      const encryptedKey = await this.encryptRsaOaep(
        new Uint8Array(aesRaw),
        publicJwk,
      );

      return {
        encryptedRequest: {
          alg: "A256GCM+RSA-OAEP-256",
          ciphertext: bytesToBase64Url(ciphertext),
          encryptedKey: bytesToBase64Url(encryptedKey),
          encoding: "base64url",
          iv: bytesToBase64Url(iv),
        },
        schemaVersion: 1,
      };
    },
    async encryptRsaOaep(value, publicJwk) {
      const publicKey = await subtle.importKey(
        "jwk",
        parseRsaPublicJwk(publicJwk) as JsonWebKey,
        { hash: "SHA-256", name: "RSA-OAEP" },
        false,
        ["encrypt"],
      );

      return toUint8Array(
        await subtle.encrypt(
          { name: "RSA-OAEP" },
          publicKey,
          toWebCryptoBuffer(value),
        ),
      );
    },
  };
}

function loadQuickCrypto() {
  try {
    const module = require("react-native-quick-crypto") as Partial<
      QuickCryptoModule
    > & { default?: QuickCryptoModule };
    const quickCrypto = module.default ?? module;

    if (!isQuickCryptoModule(quickCrypto)) return null;

    quickCrypto.randomBytes(1);

    return quickCrypto;
  } catch {
    return null;
  }
}

function isQuickCryptoModule(value: unknown): value is QuickCryptoModule {
  return Boolean(
    value &&
      typeof value === "object" &&
      "constants" in value &&
      "createCipheriv" in value &&
      "publicEncrypt" in value &&
      "randomBytes" in value,
  );
}

function readPublicKey(value?: string) {
  const publicKey = value?.trim();

  if (!publicKey) {
    throw new GenerationApiConfigurationError("missing-key");
  }

  return publicKey;
}

function parseRsaPublicJwk(publicJwk: string): RsaPublicJwk {
  try {
    const jwk = JSON.parse(publicJwk) as Partial<RsaPublicJwk>;

    if (jwk.kty !== "RSA" || !jwk.n || !jwk.e) {
      throw new Error("Invalid RSA public JWK.");
    }

    return {
      e: jwk.e,
      kty: "RSA",
      n: jwk.n,
    };
  } catch {
    throw new GenerationApiConfigurationError("invalid-key");
  }
}

function rsaPublicJwkToSpkiPem(publicJwk: string) {
  const jwk = parseRsaPublicJwk(publicJwk);
  const modulus = base64UrlToBytes(jwk.n);
  const exponent = base64UrlToBytes(jwk.e);
  const rsaPublicKeyDer = derSequence(
    derInteger(modulus),
    derInteger(exponent),
  );
  const algorithmIdentifier = Uint8Array.from([
    0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01,
    0x01, 0x05, 0x00,
  ]);
  const spkiDer = derSequence(
    algorithmIdentifier,
    derBitString(rsaPublicKeyDer),
  );
  const base64 = bytesToBase64(spkiDer);
  const lines = base64.match(/.{1,64}/g)?.join("\n") ?? base64;

  return `-----BEGIN PUBLIC KEY-----\n${lines}\n-----END PUBLIC KEY-----`;
}

function derInteger(value: Uint8Array) {
  let start = 0;

  while (start < value.length - 1 && value[start] === 0) {
    start += 1;
  }

  const normalized = value.slice(start);
  const positive =
    normalized[0] !== undefined && normalized[0] >= 0x80
      ? concatBytes(Uint8Array.of(0), normalized)
      : normalized;

  return concatBytes(Uint8Array.of(0x02), derLength(positive.length), positive);
}

function derBitString(value: Uint8Array) {
  const body = concatBytes(Uint8Array.of(0), value);

  return concatBytes(Uint8Array.of(0x03), derLength(body.length), body);
}

function derSequence(...children: Uint8Array[]) {
  const body = concatBytes(...children);

  return concatBytes(Uint8Array.of(0x30), derLength(body.length), body);
}

function derLength(length: number) {
  if (length < 0x80) {
    return Uint8Array.of(length);
  }

  const bytes: number[] = [];
  let remaining = length;

  while (remaining > 0) {
    bytes.unshift(remaining & 0xff);
    remaining >>= 8;
  }

  return Uint8Array.of(0x80 | bytes.length, ...bytes);
}

function isLocalGenerationApiUrl(value: string) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();

    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "0.0.0.0" ||
      hostname === "10.0.2.2" ||
      hostname === "host.docker.internal" ||
      hostname.endsWith(".local") ||
      isPrivateIpv4(hostname)
    );
  } catch {
    return false;
  }
}

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split(".").map((part) => Number(part));

  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }

  const [first, second] = parts;

  return (
    first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254)
  );
}

function textToBytes(value: string) {
  return new TextEncoder().encode(value);
}

function toUint8Array(value: ArrayBuffer | ArrayBufferView) {
  return value instanceof ArrayBuffer
    ? new Uint8Array(value)
    : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
}

function toWebCryptoBuffer(value: Uint8Array) {
  const copy = new Uint8Array(value.byteLength);

  copy.set(value);

  return copy.buffer;
}

function concatBytes(...parts: Uint8Array[]) {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;

  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }

  return output;
}

function base64UrlToBytes(value: string) {
  return base64ToBytes(value.replace(/-/g, "+").replace(/_/g, "/"));
}

function bytesToBase64Url(value: ArrayBuffer | ArrayBufferView) {
  return bytesToBase64(toUint8Array(value))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64ToBytes(value: string) {
  const clean = value.replace(/\s/g, "");
  let buffer = 0;
  let bits = 0;
  const output: number[] = [];

  for (const char of clean) {
    if (char === "=") break;

    const index = base64Alphabet.indexOf(char);

    if (index === -1) {
      throw new GenerationApiConfigurationError("invalid-key");
    }

    buffer = (buffer << 6) | index;
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      output.push((buffer >> bits) & 0xff);
    }
  }

  return Uint8Array.from(output);
}

function bytesToBase64(value: Uint8Array) {
  let output = "";
  let index = 0;

  for (; index + 2 < value.length; index += 3) {
    output += base64Alphabet[value[index] >> 2];
    output +=
      base64Alphabet[((value[index] & 0x03) << 4) | (value[index + 1] >> 4)];
    output +=
      base64Alphabet[
        ((value[index + 1] & 0x0f) << 2) | (value[index + 2] >> 6)
      ];
    output += base64Alphabet[value[index + 2] & 0x3f];
  }

  if (index < value.length) {
    output += base64Alphabet[value[index] >> 2];

    if (index + 1 < value.length) {
      output +=
        base64Alphabet[
          ((value[index] & 0x03) << 4) | (value[index + 1] >> 4)
        ];
      output += base64Alphabet[(value[index + 1] & 0x0f) << 2];
      output += "=";
    } else {
      output += base64Alphabet[(value[index] & 0x03) << 4];
      output += "==";
    }
  }

  return output;
}

const base64Alphabet =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
