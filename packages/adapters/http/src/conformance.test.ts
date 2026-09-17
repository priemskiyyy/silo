import { testStorageAdapter } from "@priemskiyyy/silo/testing";
import { fakeServer } from "src/fakeServer.fixture";
import { http } from "src/http";

testStorageAdapter({
  name: "http",
  createAdapter: () => {
    const server = fakeServer();

    return http({ url: server.base, fetch: server.fetch });
  },
});
