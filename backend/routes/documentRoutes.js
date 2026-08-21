import express from 'express';
import {
  getUploadToken,
  confirmUpload,
  getDocuments,
  getDocument,
  getDocumentFile,
  deleteDocument,
} from '../controllers/documentController.js';
import protect from '../middleware/auth.js';

const router = express.Router();

// Not behind `protect`: the Vercel Blob client SDK calls this route itself
// from the browser and doesn't attach our Authorization header. Auth is
// instead verified manually inside getUploadToken via `clientPayload`.
// See the comment on getUploadToken in documentController.js for why.
router.post('/upload-token', getUploadToken);

// Everything else is a normal authenticated request through our own
// axiosInstance, so it keeps the usual JWT header and stays protected.
router.use(protect);

router.post('/confirm', confirmUpload);
router.get('/', getDocuments);
router.get('/:id', getDocument);
router.get('/:id/file', getDocumentFile);
router.delete('/:id', deleteDocument);

export default router;