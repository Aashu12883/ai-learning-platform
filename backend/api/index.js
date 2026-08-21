// Vercel's Node runtime picks up whatever this file exports as the
// serverless function handler. Our Express app already knows how to
// handle a request/response pair, so we just re-export it as-is.
export { default } from '../server.js';
