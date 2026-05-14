import { describe, it, expect, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { checkUrl } from "@urlService";
import { SOFT_404_DETECTED, MAX_RETRY_ATTEMPTS } from "@constant";
import { server } from "@/mocks/server";

vi.mock("timers/promises", () => ({
  setTimeout: vi.fn().mockResolvedValue(undefined),
}));

const MOCK_URL = "https://mock-retry.com";

const OK_HTML = "<html><head><title>Home</title></head><body>ok</body></html>";

const SOFT_404_HTML =
  "<html><head><title>404 Not Found</title></head><body>oops</body></html>";

describe("checkUrl retry logic", () => {
  it("succeeds on the first attempt and sets attempts to 1", async () => {
    server.use(http.get(MOCK_URL, () => HttpResponse.html(OK_HTML, { status: 200 })));

    const result = await checkUrl(MOCK_URL);

    expect(result).toMatchObject({
      isBroken: false,
      statusCode: 200,
      attempts: 1,
    });
  });

  it("retries after a 5xx error and succeeds on the second attempt", async () => {
    let callCount = 0;

    server.use(
      http.get(MOCK_URL, () => {
        callCount += 1;
        if (callCount === 1) {
          return HttpResponse.json({}, { status: 500 });
        }
        return HttpResponse.html(OK_HTML, { status: 200 });
      })
    );

    const result = await checkUrl(MOCK_URL);

    expect(result).toMatchObject({
      isBroken: false,
      statusCode: 200,
      attempts: 2,
    });
  });

  it("returns broken after exhausting all retry attempts on a persistent 5xx error", async () => {
    server.use(http.get(MOCK_URL, () => HttpResponse.json({}, { status: 500 })));

    const result = await checkUrl(MOCK_URL);

    expect(result).toMatchObject({
      isBroken: true,
      statusCode: 500,
      attempts: MAX_RETRY_ATTEMPTS,
    });
  });

  it("does not retry a 4xx error and returns broken with attempts: 1", async () => {
    server.use(http.get(MOCK_URL, () => HttpResponse.json({}, { status: 404 })));

    const result = await checkUrl(MOCK_URL);

    expect(result).toMatchObject({
      isBroken: true,
      statusCode: 404,
      attempts: 1,
    });
  });

  it("does not retry a soft-404 and returns broken with attempts: 1", async () => {
    server.use(
      http.get(MOCK_URL, () => HttpResponse.html(SOFT_404_HTML, { status: 200 }))
    );

    const result = await checkUrl(MOCK_URL);

    expect(result).toMatchObject({
      isBroken: true,
      error: SOFT_404_DETECTED,
      attempts: 1,
    });
  });
});
