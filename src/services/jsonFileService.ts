import { stat, open } from 'fs/promises';
import { ensureDataDirectoryExists } from '@/services/urlRecordsService';

const appendToExistingFile = async(
  filePath: string,
  fileStats: { size: number },
  itemsBody: string
): Promise<void> => {
  const fileHandle = await open(filePath, 'r+');
  const position = fileStats.size - 2;
  const dataToAppend = `,\n  ${itemsBody}\n]`;

  await fileHandle.write(dataToAppend, position);
  await fileHandle.close();
};

const writeNewFile = async(
  filePath: string,
  items: string
): Promise<void> => {
  await ensureDataDirectoryExists();
  const fileHandle = await open(filePath, 'w');
  await fileHandle.write(items);
  await fileHandle.close();
};


export const appendToJsonArrayFile = async<T>(
  filePath: string,
  newItems: T[]
): Promise<void> => {

  const indentedItems = JSON.stringify(newItems, null, 2);
  const itemsBody = indentedItems.slice(1, -1).trim();

  try {
    const fileStats = await stat(filePath);

    if (fileStats.size > 5) {
      await appendToExistingFile(filePath, fileStats, itemsBody);
    } else {
      await writeNewFile(filePath, indentedItems);
    }
  } catch (error) {
    const err = error as { code: string };

    if (err.code === 'ENOENT') {
      try {
        await writeNewFile(filePath, indentedItems);
      } catch (createError) {
        console.error(`Failed to create new file at ${filePath}:`, createError);
      }
    } else {
      console.error(`Unexpected error accessing file at ${filePath}:`, error);
    }
  }
};

