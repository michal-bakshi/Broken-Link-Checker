import axios, { AxiosResponse } from "axios";
import { setTimeout as delay } from "timers/promises";
import {
  FAILED_REQUEST,
  HTTP_TIMEOUT,
  INVALID_URL_FORMAT,
  MAX_REDIRECTS,
  SOFT_404_DETECTED,
  LOCALHOST_URL_MESSAGE,
  URL_WORKING,
  URL_BROKEN,
  LOCALHOST_URLS,
  MAX_RETRY_ATTEMPTS,
  RETRY_DELAY_MS,
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_BAD_REQUEST,
} from "@constant";
import { HTML_TITLE_REGEX } from "@/utils/regexUtils";
export interface UrlCheckResult {
  url: string;
  isBroken: boolean;
  statusCode?: number;
  error?: string;
  responseTime?: number;
  message?: string;
  attempts?: number;
}

const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

const isLocalhostUrl = (url: string): boolean => {
  try {
    const { hostname } = new URL(url);
    return LOCALHOST_URLS.includes(hostname);
  } catch {
    return false;
  }
};

const isSoft404 = (response: AxiosResponse): boolean => {
  const contentType = String(response.headers["content-type"] || "");
  if (!contentType.includes("text/html")) return false;

  const body: string = response.data;
  if (typeof body !== "string" || !body.trim()) return false;
  const titleMatch = body.match(HTML_TITLE_REGEX);
  const title = titleMatch?.[1]?.toLowerCase() ?? "";

  const finalUrl = response.request?.res?.responseUrl ?? "";

  return (
    title.includes("404") ||
    title.includes("not found") ||
    finalUrl.includes("/404")
  );
};

const performHttpCheck = async (
  url: string,
  startTime: number,
): Promise<UrlCheckResult> => {
  try {
    const response: AxiosResponse = await axios.get(url, {
      timeout: HTTP_TIMEOUT,
      validateStatus: (status) => status < HTTP_STATUS_BAD_REQUEST,
      maxRedirects: MAX_REDIRECTS,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });

    const responseTime = Date.now() - startTime;

    if (isSoft404(response)) {
      return {
        url,
        isBroken: true,
        statusCode: response.status,
        error: SOFT_404_DETECTED,
        responseTime,
        message: URL_BROKEN,
      };
    }

    return {
      url,
      isBroken: false,
      statusCode: response.status,
      responseTime,
      message: URL_WORKING,
    };
  } catch (error: any) {
    const responseTime = Date.now() - startTime;

    return {
      url,
      isBroken: true,
      statusCode: error.response?.status,
      error: error.message || FAILED_REQUEST,
      responseTime,
      message: URL_BROKEN,
    };
  }
};

export const checkUrl = async (url: string): Promise<UrlCheckResult> => {
  if (!isValidUrl(url)) {
    return {
      url,
      isBroken: true,
      error: INVALID_URL_FORMAT,
      message: URL_BROKEN,
      attempts: 1,
    };
  }

  if (isLocalhostUrl(url)) {
    return {
      url,
      isBroken: false,
      message: LOCALHOST_URL_MESSAGE,
      attempts: 1,
    };
  }

  const startTime = Date.now();

  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    const result = await performHttpCheck(url, startTime);

    if (!result.isBroken) {
      return { ...result, attempts: attempt };
    }

    const isNonRetryable =
      result.statusCode &&
      result.statusCode < HTTP_STATUS_INTERNAL_SERVER_ERROR;

    if (isNonRetryable || attempt === MAX_RETRY_ATTEMPTS) {
      return { ...result, attempts: attempt };
    }

    await delay(RETRY_DELAY_MS);
  }

  return {
    url,
    isBroken: true,
    error: FAILED_REQUEST,
    message: URL_BROKEN,
    attempts: MAX_RETRY_ATTEMPTS,
  };
};

// TODO: Re-test this flow once repository link scanning is implemented.
export const checkMultipleUrls = async (
  urls: string[],
): Promise<UrlCheckResult[]> => {
  const promises = urls.map((url) => checkUrl(url));
  return Promise.all(promises);
};
