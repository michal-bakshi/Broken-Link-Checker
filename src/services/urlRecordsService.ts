import fs from 'fs/promises';
import path from 'path';
import { UrlCheckResult } from '@/services/urlService';
import { appendToJsonArrayFile } from '@/services/jsonFileService';

export interface UrlCheckRecord {
  result: UrlCheckResult;
  checkedAt: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');

const getTodayDateComponents = (): {
  year: number;
  month: string;
  day: string;
  dateString: string;
} => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const dateString = `${year}-${month}-${day}`;
  return { year, month, day, dateString };
};

const getYearMonthPath = (): string => {
  const { year, month } = getTodayDateComponents();
  return path.join(DATA_DIR, String(year), month);
};

const getTodayFilePath = (): string => {
  const { dateString } = getTodayDateComponents();
  const yearMonthPath = getYearMonthPath();
  return path.join(yearMonthPath, `${dateString}.json`);
};

//TODO: place this function 
export const ensureDataDirectoryExists = async (): Promise<void> => {
  const yearMonthPath = getYearMonthPath();
  await fs.mkdir(yearMonthPath, { recursive: true });
};

export const writeToFile = async (
  results: UrlCheckResult | UrlCheckResult[]
): Promise<void> => {
  try {
    const filePath = getTodayFilePath();
    const resultsArray = Array.isArray(results) ? results : [results];
    const checkedAt = new Date().toISOString();

    const newRecords: UrlCheckRecord[] = resultsArray.map((result) => ({
      result,
      checkedAt,
    }));

    await appendToJsonArrayFile<UrlCheckRecord>(filePath, newRecords);
  } catch (error) {
    console.error('Error saving URL check results to file:', error);
  }
};

