import multer from 'multer';
import { ApiError } from '../utils/errors';

const spreadsheetMimeTypes = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/csv',
  'text/plain',
  'application/octet-stream',
];

export const uploadSpreadsheet = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.toLowerCase();
    const okExt = ext.endsWith('.xlsx') || ext.endsWith('.xls') || ext.endsWith('.csv');
    if (!okExt || !spreadsheetMimeTypes.includes(file.mimetype)) {
      return cb(ApiError.badRequest('Only .xlsx, .xls and .csv files are allowed'));
    }
    cb(null, true);
  },
});

export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(ApiError.badRequest('Only image files are allowed'));
    }
    cb(null, true);
  },
});
