import { upload } from '@vercel/blob/client';
import axiosInstance from '../utils/axiosInstance';
import { API_PATHS, BASE_URL } from '../utils/apiPaths';

const getDocuments = async () => {
  try {
    const response = await axiosInstance.get(API_PATHS.DOCUMENTS.GET_DOCUMENTS);
    return response.data?.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to fetch documents' };
  }
};

const uploadDocument = async (file, title) => {
  try {
    const token = localStorage.getItem('token');

    // The file goes straight from the browser to Vercel Blob storage,
    // bypassing our backend entirely for the actual bytes (a Vercel
    // serverless function caps request bodies at 4.5MB). This internal
    // request doesn't carry our usual Authorization header, so the JWT
    // travels through `clientPayload` instead — verified server-side in
    // getUploadToken (documentController.js).
    const blob = await upload(file.name, file, {
      access: 'private',
      handleUploadUrl: `${BASE_URL}${API_PATHS.DOCUMENTS.UPLOAD_TOKEN}`,
      clientPayload: JSON.stringify({ token }),
    });

    // Now that the file exists in Blob storage, ask the backend to create
    // the Document record and process it. This is a small JSON request, so
    // it goes through axiosInstance with the normal JWT header.
    const response = await axiosInstance.post(API_PATHS.DOCUMENTS.CONFIRM_UPLOAD, {
      title,
      fileName: file.name,
      fileSize: file.size,
      blobUrl: blob.url,
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: error.message || 'Failed to upload document' };
  }
};

const deleteDocument = async (id) => {
  try {
    const response = await axiosInstance.delete(API_PATHS.DOCUMENTS.DELETE_DOCUMENT(id));
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to delete document' };
  }
};

const getDocumentById = async (id) => {
    try {
        const response = await axiosInstance.get(API_PATHS.DOCUMENTS.GET_DOCUMENT_BY_ID(id));
        return response.data;
    } catch (error) {
        throw error.response?.data || { message: 'Failed to fetch document details' };
    }
};

// The Blob store is private, so the PDF can't be loaded with a plain
// <iframe src="..."> — that request wouldn't carry our JWT. Instead we fetch
// the bytes ourselves (through axiosInstance, so the Authorization header is
// attached as usual) and hand back a local object URL the iframe can use.
const getDocumentFileUrl = async (id) => {
  try {
    const response = await axiosInstance.get(API_PATHS.DOCUMENTS.GET_DOCUMENT_FILE(id), {
      responseType: 'blob',
    });
    return URL.createObjectURL(response.data);
  } catch (error) {
    throw error.response?.data || { message: 'Failed to load PDF file' };
  }
};

const documentService = {
  getDocuments,
  uploadDocument,
  deleteDocument,
  getDocumentById,
  getDocumentFileUrl,
};

export default documentService;
