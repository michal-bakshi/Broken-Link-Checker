import fs from 'fs/promises';
import path from 'path';
import { UrlCheckResult } from '@/services/urlService';

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

const ensureDataDirectoryExists = async (): Promise<void> => {
  const yearMonthPath = getYearMonthPath();
  try {
    await fs.access(yearMonthPath);
  } catch {
    await fs.mkdir(yearMonthPath, { recursive: true });
  }
};

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const readTodayFile = async (filePath: string): Promise<UrlCheckRecord[]> => {
  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    return [];
  }
};

const writeTodayFile = async (
  filePath: string,
  records: UrlCheckRecord[]
): Promise<void> => {
  await fs.writeFile(filePath, JSON.stringify(records, null, 2), 'utf-8');
};

export const writeAndUpdate = async (
  results: UrlCheckResult | UrlCheckResult[]
): Promise<void> => {
  try {
    await ensureDataDirectoryExists();

    const filePath = getTodayFilePath();
    const resultsArray = Array.isArray(results) ? results : [results];
    const checkedAt = new Date().toISOString();

    const newRecords: UrlCheckRecord[] = resultsArray.map((result) => ({
      result,
      checkedAt,
    }));

    if (await fileExists(filePath)) {
      const existingRecords = await readTodayFile(filePath);
      const updatedRecords = [...existingRecords, ...newRecords];
      await writeTodayFile(filePath, updatedRecords);
    } else {
      await writeTodayFile(filePath, newRecords);
    }
  } catch (error) {
    console.error('Error saving URL check results to file:', error);
  }
};

