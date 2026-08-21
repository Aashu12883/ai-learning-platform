import mongoose from 'mongoose';

// A flat, one-document-per-chunk collection used purely for semantic
// (embedding-based) retrieval via MongoDB Atlas Vector Search. This is
// separate from Document.chunks (which stays embedded and keyword-searched
// where it's still used) because Atlas Vector Search cannot index a field
// nested inside an array of subdocuments — the vector field has to live on
// a top-level collection.
const documentChunkSchema = new mongoose.Schema({
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  chunkIndex: {
    type: Number,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  pageNumber: {
    type: Number,
    default: 0
  },
  embedding: {
    type: [Number],
    required: true
  }
}, {
  timestamps: true
});

documentChunkSchema.index({ documentId: 1 });

const DocumentChunk = mongoose.model('DocumentChunk', documentChunkSchema);

export default DocumentChunk;
