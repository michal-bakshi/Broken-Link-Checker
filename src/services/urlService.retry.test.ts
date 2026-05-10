import { describe, it, expect, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { checkUrl } from "@urlService";
import { SOFT_404_DETECTED, MAX_RETRY_ATTEMPTS } from "@constant";
import { server } from "@/mocks/server";

// Mock delay to avoid waiting during retry tests
vi.mock("timers/promises", () => ({
  setTimeout: vi.fn().mockResolvedValue(undefined),
}));

const MOCK_URL = "https://mock-retry.com";

const OK_HTML = "<html><head><title>Home</title></head><body>ok</body></html>";

const SOFT_404_HTML =
  "<html><head><title>404 Not Found</title></head><body>oops</body></html>";

function mockGet(handler: () => any) {
  server.use(http.get(MOCK_URL, handler));
}

describe("checkUrl retry logic", () => {
  it("succeeds on the first attempt and sets attempts to 1", async () => {
    mockGet(() => HttpResponse.html(OK_HTML, { status: 200 }));

    const result = await checkUrl(MOCK_URL);

    expect(result.isBroken).toBe(false);
    expect(result.statusCode).toBe(200);
    expect(result.attempts).toBe(1);
  });

  it("retries after a 5xx error and succeeds on the second attempt", async () => {
    let callCount = 0;

    mockGet(() => {
      callCount += 1;
      if (callCount === 1) {
        return HttpResponse.json({}, { status: 500 });
      }
      return HttpResponse.html(OK_HTML, { status: 200 });
    });

    const result = await checkUrl(MOCK_URL);

    expect(result.isBroken).toBe(false);
    expect(result.statusCode).toBe(200);
    expect(result.attempts).toBe(2);
  });

  it("returns broken after exhausting all retry attempts on a persistent 5xx error", async () => {
    mockGet(() => HttpResponse.json({}, { status: 500 }));

    const result = await checkUrl(MOCK_URL);

    expect(result.isBroken).toBe(true);
    expect(result.statusCode).toBe(500);
    expect(result.attempts).toBe(MAX_RETRY_ATTEMPTS);
  });

  it("does not retry a 4xx error and returns broken with attempts: 1", async () => {
    mockGet(() => HttpResponse.json({}, { status: 404 }));

    const result = await checkUrl(MOCK_URL);

    expect(result.isBroken).toBe(true);
    expect(result.statusCode).toBe(404);
    expect(result.attempts).toBe(1);
  });

  it("does not retry a soft-404 and returns broken with attempts: 1", async () => {
    mockGet(() => HttpResponse.html(SOFT_404_HTML, { status: 200 }));

    const result = await checkUrl(MOCK_URL);

    expect(result.isBroken).toBe(true);
    expect(result.error).toBe(SOFT_404_DETECTED);
    expect(result.attempts).toBe(1);
  });
});
