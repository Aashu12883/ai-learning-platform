import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import mongoose from 'mongoose';
import DocumentChunk from '../models/DocumentChunk.js';

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIMENSIONS = 768;
const VECTOR_INDEX_NAME = 'chunk_vector_index';

/**
 * Embed a batch of document chunks in a single API call.
 * Uses taskType RETRIEVAL_DOCUMENT since these are the texts being stored
 * and later searched against (Gemini's embedding model is asymmetric —
 * documents and queries are embedded differently for best retrieval quality).
 * @param {string[]} texts - Chunk contents to embed
 * @returns {Promise<number[][]>} One embedding vector per input text, same order
 */
export const embedChunks = async (texts) => {
  if (!texts || texts.length === 0) {
    return [];
  }

  try {
    const response = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: texts,
      config: {
        taskType: 'RETRIEVAL_DOCUMENT',
        outputDimensionality: EMBEDDING_DIMENSIONS,
      },
    });

    return response.embeddings.map((e) => e.values);
  } catch (error) {
    console.error('Embedding error (chunks):', error);
    throw new Error('Failed to embed document chunks');
  }
};

/**
 * Embed a single user question/concept for retrieval.
 * Uses taskType RETRIEVAL_QUERY (paired asymmetrically with RETRIEVAL_DOCUMENT
 * above) for best match quality against chunks embedded with embedChunks().
 * @param {string} text - The question or concept to embed
 * @returns {Promise<number[]>}
 */
export const embedQuery = async (text) => {
  try {
    const response = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: text,
      config: {
        taskType: 'RETRIEVAL_QUERY',
        outputDimensionality: EMBEDDING_DIMENSIONS,
      },
    });

    return response.embeddings[0].values;
  } catch (error) {
    console.error('Embedding error (query):', error);
    throw new Error('Failed to embed query');
  }
};

/**
 * Save one DocumentChunk (with its embedding) per chunk of a processed document.
 * @param {string} documentId
 * @param {string} userId
 * @param {Array<{content: string, chunkIndex: number, pageNumber: number}>} chunks
 */
export const saveChunkEmbeddings = async (documentId, userId, chunks) => {
  if (!chunks || chunks.length === 0) {
    return;
  }

  const embeddings = await embedChunks(chunks.map((c) => c.content));

  const documentChunks = chunks.map((chunk, index) => ({
    documentId,
    userId,
    chunkIndex: chunk.chunkIndex,
    content: chunk.content,
    pageNumber: chunk.pageNumber,
    embedding: embeddings[index],
  }));

  // Clear out any previous chunks for this document first (e.g. a retry
  // after a failed earlier processing attempt) to avoid duplicates.
  await DocumentChunk.deleteMany({ documentId });
  await DocumentChunk.insertMany(documentChunks);
};

/**
 * Semantic retrieval: find the chunks whose embeddings are closest (cosine
 * similarity) to the query embedding, scoped to one document and its owner.
 * Replaces the keyword-scoring findRelevantChunks() in textChunker.js for
 * Chat and Explain Concept, returning the same shape those callers expect.
 * @param {string} documentId
 * @param {string} userId
 * @param {number[]} queryEmbedding
 * @param {number} maxChunks
 * @returns {Promise<Array<{content: string, chunkIndex: number, pageNumber: number}>>}
 */
export const findRelevantChunksSemantic = async (documentId, userId, queryEmbedding, maxChunks = 3) => {
  try {
    const results = await DocumentChunk.aggregate([
      {
        $vectorSearch: {
          index: VECTOR_INDEX_NAME,
          path: 'embedding',
          queryVector: queryEmbedding,
          numCandidates: 100,
          limit: maxChunks,
          filter: {
            documentId: new mongoose.Types.ObjectId(documentId),
            userId: new mongoose.Types.ObjectId(userId),
          },
        },
      },
      {
        $project: {
          _id: 0,
          content: 1,
          chunkIndex: 1,
          pageNumber: 1,
          score: { $meta: 'vectorSearchScore' },
        },
      },
    ]);

    return results;
  } catch (error) {
    console.error('Vector search error:', error);
    // Fail soft: an index/config issue shouldn't 500 the whole chat request —
    // callers just get no context chunks, matching the "nothing relevant
    // found" behavior the old keyword function already had.
    return [];
  }
};
