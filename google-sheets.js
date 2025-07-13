import { google } from 'googleapis';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
];
const CREDENTIALS_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const SHEET_NAME = process.env.GOOGLE_SHEET_NAME;
const INPUT_WORKSHEET_NAME = process.env.INPUT_WORKSHEET_NAME || 'input';
const OUTPUT_WORKSHEET_NAME = process.env.OUTPUT_WORKSHEET_NAME || 'output';

function getAuth() {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
  const { client_email, private_key } = credentials;
  return new google.auth.JWT(
    client_email,
    null,
    private_key,
    SCOPES
  );
}

async function getSpreadsheetIdByName(sheetName) {
  const auth = getAuth();
  const drive = google.drive({ version: 'v3', auth });
  const res = await drive.files.list({
    q: `mimeType='application/vnd.google-apps.spreadsheet' and name='${sheetName}' and trashed=false`,
    fields: 'files(id, name)',
    spaces: 'drive',
    pageSize: 10,
  });
  if (!res.data.files || res.data.files.length === 0) {
    throw new Error(`No spreadsheet found with name: ${sheetName}`);
  }
  // If multiple, pick the first
  return res.data.files[0].id;
}

let cachedSpreadsheetId = null;
async function getSpreadsheetId() {
  if (!cachedSpreadsheetId) {
    cachedSpreadsheetId = await getSpreadsheetIdByName(SHEET_NAME);
  }
  return cachedSpreadsheetId;
}

export async function readInputSheet() {
  console.log('Environment variables:', {
    GOOGLE_SHEET_NAME: process.env.GOOGLE_SHEET_NAME,
    INPUT_WORKSHEET_NAME: process.env.INPUT_WORKSHEET_NAME,
    OUTPUT_WORKSHEET_NAME: process.env.OUTPUT_WORKSHEET_NAME
  });
  console.log('Using worksheet name:', INPUT_WORKSHEET_NAME);
  
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = await getSpreadsheetId();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${INPUT_WORKSHEET_NAME}!A2:B`, // Read columns A, B only
  });
  // Return array of objects: { business, category }
  return (res.data.values || []).filter(row => row.length >= 2).map(row => ({
    business: row[0],
    category: row[1],
  }));
}

export async function writeOutputSheet(rows, worksheetName) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = await getSpreadsheetId();
  const targetSheet = worksheetName || OUTPUT_WORKSHEET_NAME;
  try {
    // First, try to get existing data to check if worksheet exists
    const existingData = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${targetSheet}!A1`,
    });
    // If worksheet exists and has data, append to it
    if (existingData.data.values && existingData.data.values.length > 0) {
      console.log(`${targetSheet} worksheet exists, appending new results...`);
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${targetSheet}!A:A`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: rows.slice(1), // Skip header row when appending
        },
      });
    } else {
      // If worksheet doesn't exist or is empty, create it with headers
      console.log(`Creating new ${targetSheet} worksheet with headers...`);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${targetSheet}!A1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: rows,
        },
      });
    }
  } catch (error) {
    // If worksheet doesn't exist, create it
    if (error.code === 400 && error.message.includes('Unable to parse range')) {
      console.log(`${targetSheet} worksheet does not exist, creating it...`);
      // First, add the worksheet
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: targetSheet,
                },
              },
            },
          ],
        },
      });
      // Then add the data
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${targetSheet}!A1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: rows,
        },
      });
    } else {
      throw error;
    }
  }
} 