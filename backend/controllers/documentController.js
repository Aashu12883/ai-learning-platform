import jwt from 'jsonwebtoken';
import { Readable } from 'stream';
import { handleUpload } from '@vercel/blob/client';
import { del, get } from '@vercel/blob';
import Document from '../models/Document.js';
import Flashcard from '../models/Flashcard.js';
import Quiz from '../models/Quiz.js';
import { extractTextFromPDF } from '../utils/pdfParser.js';
import { chunkText } from '../utils/textChunker.js';
import { saveChunkEmbeddings } from '../utils/embeddingService.js';
import mongoose from 'mongoose';

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 10485760; // 10MB default

// @desc    Generate a short-lived token so the browser can upload a PDF
//          directly to Vercel Blob storage, bypassing this server entirely
//          for the file bytes (Vercel serverless functions cap request
//          bodies at 4.5MB, well under our 10MB upload limit).
// @route   POST /api/documents/upload-token
// @access  Private (verified manually below, not via the `protect` middleware)
//
// NOTE: this route is intentionally NOT behind `protect`. The Vercel Blob
// client SDK calls this URL itself from the browser and does not attach our
// custom `Authorization` header, so the JWT travels through `clientPayload`
// instead and is verified by hand inside `onBeforeGenerateToken`.
export const getUploadToken = async (req, res) => {
  const body = req.body;

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        try {
          const { token } = JSON.parse(clientPayload || '{}');
          jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
          throw new Error('Not authorized');
        }

        return {
          allowedContentTypes: ['application/pdf'],
          addRandomSuffix: true,
          maximumSizeInBytes: MAX_FILE_SIZE,
          tokenPayload: clientPayload,
        };
      },
      onUploadCompleted: async () => {
        // No-op: this webhook needs a public HTTPS callback URL and never
        // fires on localhost. The browser calls POST /confirm explicitly
        // right after `upload()` resolves instead (see documentService.js).
      },
    });

    res.status(200).json(jsonResponse);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// @desc    Create the Document record once the file already exists in
//          Vercel Blob, then process it (extract text + chunk) before
//          responding. This runs synchronously (awaited) rather than as a
//          background task, since a serverless function isn't guaranteed to
//          keep running after its response is sent.
// @route   POST /api/documents/confirm
// @access  Private
export const confirmUpload = async (req, res, next) => {
  try {
    const { title, fileName, fileSize, blobUrl } = req.body;

    if (!title || !fileName || !blobUrl) {
      return res.status(400).json({
        success: false,
        error: 'Please provide title, fileName and blobUrl',
        statusCode: 400
      });
    }

    const document = await Document.create({
      userId: req.user._id,
      title,
      fileName,
      filePath: blobUrl,
      fileSize: fileSize || 0,
      status: 'processing'
    });

    await processPDF(document._id, blobUrl, req.user._id);

    // Re-fetch so the response already reflects the final 'ready'/'failed'
    // status, since processing has already completed by this point.
    const processedDocument = await Document.findById(document._id);

    res.status(201).json({
      success: true,
      data: processedDocument,
      message: 'Document uploaded and processed successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to process a PDF already stored in Vercel Blob: fetch its
// bytes, extract text, split into chunks, embed each chunk for semantic
// search (RAG), and update the document record.
const processPDF = async (documentId, blobUrl, userId) => {
  try {
    const { text } = await extractTextFromPDF(blobUrl);

    // Create chunks
    const chunks = chunkText(text, 500, 50);

    // Embed each chunk and store it in the flat DocumentChunk collection
    // (used by Chat/Explain Concept's semantic retrieval). A failure here
    // is caught by the same try/catch as extraction/chunking, so the
    // document still ends up 'failed' rather than silently missing RAG data.
    await saveChunkEmbeddings(documentId, userId, chunks);

    // Update document
    await Document.findByIdAndUpdate(documentId, {
      extractedText: text,
      chunks: chunks,
      status: 'ready'
    });

    console.log(`Document ${documentId} processed successfully`);
  } catch (error) {
    console.error(`Error processing document ${documentId}:`, error);

    await Document.findByIdAndUpdate(documentId, {
      status: 'failed'
    });
  }
};

// @desc    Get all user documents
// @route   GET /api/documents
// @access  Private
export const getDocuments = async (req, res, next) => {
  try {
   const documents = await Document.aggregate([
      {
        $match: { userId: new mongoose.Types.ObjectId(req.user._id) }
      },
      {
        $lookup: {
          from: 'flashcards',
          localField: '_id',
          foreignField: 'documentId',
          as: 'flashcardSets'
        }
      },
      {
        $lookup: {
          from: 'quizzes',
          localField: '_id',
          foreignField: 'documentId',
          as: 'quizzes'
        }
      },
      {
        $addFields: {
          flashcardCount: { $size: '$flashcardSets' },
          quizCount: { $size: '$quizzes' }
        }
      },
      {
        $project: {
          extractedText: 0,
          chunks: 0,
          flashcardSets: 0,
          quizzes: 0
        }
      },
      {
        $sort: { uploadDate: -1 }
      }
    ]);

    res.status(200).json({
      success: true,
      count: documents.length,
      data: documents
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single document with chunks
// @route   GET /api/documents/:id
// @access  Private
export const getDocument = async (req, res, next) => {
  try {
   const document = await Document.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found',
        statusCode: 404
      });
    }

    // Get counts of associated flashcards and quizzes
    const flashcardCount = await Flashcard.countDocuments({ documentId: document._id, userId: req.user._id });
    const quizCount = await Quiz.countDocuments({ documentId: document._id, userId: req.user._id });

    // Update last accessed
    document.lastAccessed = Date.now();
    await document.save();

    // Combine document data with counts
    const documentData = document.toObject();
    documentData.flashcardCount = flashcardCount;
    documentData.quizCount = quizCount;

    res.status(200).json({
      success: true,
      data: documentData
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Stream the document's PDF bytes to the authenticated owner.
//          Needed because the Blob store is private: a private blob's URL
//          rejects direct/unauthenticated requests (so a plain <iframe src>
//          or fetch() can't load it), so the browser instead calls this
//          route (with its normal JWT header, via axiosInstance) and we
//          fetch + relay the bytes ourselves after checking ownership.
// @route   GET /api/documents/:id/file
// @access  Private
export const getDocumentFile = async (req, res, next) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found',
        statusCode: 404
      });
    }

    const result = await get(document.filePath, { access: 'private' });

    if (!result || result.statusCode !== 200) {
      return res.status(404).json({
        success: false,
        error: 'File not found in storage',
        statusCode: 404
      });
    }

    res.setHeader('Content-Type', result.blob.contentType || 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-cache');

    Readable.fromWeb(result.stream).pipe(res);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete document
// @route   DELETE /api/documents/:id
// @access  Private
export const deleteDocument = async (req, res, next) => {
  try {
   const document = await Document.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found',
        statusCode: 404
      });
    }

    // Delete file from Vercel Blob storage
    await del(document.filePath).catch(() => {});

    // Delete document
    await document.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
