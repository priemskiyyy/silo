import { testStorageAdapter } from "@priemskiyyy/silo/testing";
import { cloudflareKv } from "src/cloudflareKv";
import { createFakeKvNamespace } from "src/cloudflareKv.fixture";

testStorageAdapter({
  name: "cloudflare-kv",
  createAdapter: () =>
    cloudflareKv({ namespace: createFakeKvNamespace().namespace }),
});
