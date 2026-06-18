import ExcelJS from 'exceljs';
import path from 'node:path';
import os from 'node:os';

const SRC = process.env.SRC_XLSX ?? path.join(os.homedir(), 'Downloads', 'test-cases.xlsx');

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(SRC);
const ws = wb.worksheets[0];

const rows = [];
ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
  const vals = [];
  for (let c = 1; c <= 16; c++) {
    const cell = row.getCell(c);
    vals.push(cell.text ?? '');
  }
  rows.push({ rowNumber, vals });
});

console.log(JSON.stringify(rows, null, 2));
