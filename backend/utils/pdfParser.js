import { get } from "@vercel/blob";
import pdfParse from "pdf-parse";

/**
 * Extract text from a PDF stored in a private Vercel Blob store.
 * Uses the authenticated `get()` SDK call (BLOB_READ_WRITE_TOKEN) since a
 * plain unauthenticated fetch would be rejected — private blobs require an
 * authorized request even to read them.
 *
 * Deliberately pinned to pdf-parse v1.x, not the v2 rewrite: v2 is built on
 * pdfjs-dist, which optionally loads the native `@napi-rs/canvas` package for
 * page-rendering support. That native binary reliably failed to load in
 * Vercel's serverless environment (crashing with `DOMMatrix is not defined`
 * on every request, since the import chain runs at module load time) even
 * after being added as an explicit dependency with a `vercel.json`
 * `includeFiles` override — two separate fix attempts, same crash. v1.x is
 * pure JS with no canvas/DOM dependency at all, which sidesteps the problem
 * entirely since we only ever need plain text, never page rendering.
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

    // pdf-parse v1's API is a plain function taking a Buffer, not a class
    const data = await pdfParse(Buffer.from(arrayBuffer));

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
