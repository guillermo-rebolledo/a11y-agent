import type {
  PrivateEvidenceStore,
  StoredPrivateEvidenceObject,
} from "./publication-service.js";

export interface R2BucketBinding {
  put(
    key: string,
    body: string,
    options: {
      httpMetadata: {
        contentType: "application/json";
        cacheControl: "private, no-store";
      };
      customMetadata: StoredPrivateEvidenceObject["customMetadata"];
    },
  ): Promise<unknown>;
  delete(key: string): Promise<unknown>;
}

export type R2ReadUrlSigner = (
  key: string,
  ttlSeconds: number,
) => Promise<string>;

export class R2PrivateEvidenceStore implements PrivateEvidenceStore {
  readonly #bucket: R2BucketBinding;
  readonly #signReadUrl: R2ReadUrlSigner;

  constructor(bucket: R2BucketBinding, signReadUrl: R2ReadUrlSigner) {
    this.#bucket = bucket;
    this.#signReadUrl = signReadUrl;
  }

  async put(object: StoredPrivateEvidenceObject): Promise<void> {
    await this.#bucket.put(object.key, object.body, {
      httpMetadata: {
        contentType: object.contentType,
        cacheControl: object.cacheControl,
      },
      customMetadata: object.customMetadata,
    });
  }

  async delete(key: string): Promise<void> {
    await this.#bucket.delete(key);
  }

  async issueReadUrl(key: string, ttlSeconds: number): Promise<string> {
    if (!Number.isInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > 300) {
      throw new Error("Evidence access must last at most 300 seconds");
    }
    return this.#signReadUrl(key, ttlSeconds);
  }
}
