import { get } from "@vercel/blob";
import { PDFParse } from "pdf-parse";

/**
 * Extract text from a PDF stored in a private Vercel Blob store.
 * Uses the authenticated `get()` SDK call (BLOB_READ_WRITE_TOKEN) since a
 * plain unauthenticated fetch would be rejected — private blobs require an
 * authorized request even to read them.
 * @param {string} urlOrPathname - The blob's URL or pathname
 * @returns {Promise<{text: string, numPages: number}>}
 */
export const extractTextFromPDF = async (urlOrPathname) => {
  try {
    const result = await get(urlOrPathname, { access: "private" });

    if (!result || result.statusCode !== 200) {
      throw new Error("Failed to download PDF from Blob storage");
    }

    // result.stream is a Web ReadableStream; collect it into one buffer
    const arrayBuffer = await new Response(result.stream).arrayBuffer();

    // pdf-parse expects a Uint8Array, not a Buffer
    const parser = new PDFParse(new Uint8Array(arrayBuffer));
    const data = await parser.getText();

    return {
      text: data.text,
      numPages: data.numpages,
      info: data.info,
    };
  } catch (error) {
    console.error("PDF parsing error:", error);
    throw new Error("Failed to extract text from PDF");
  }
};
