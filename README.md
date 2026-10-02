# AI Learning Assistant

An AI-powered learning application for uploading PDF documents and turning them into useful study material. Users can chat with their documents, generate summaries, create flashcards and quizzes, and track their learning progress.

## Features

- User registration and JWT-based authentication
- PDF document upload and storage
- PDF text extraction and chunking
- Vector embeddings and semantic document search
- Document-aware AI chat
- AI-generated summaries and concept explanations
- AI-generated flashcards and quizzes
- Flashcard and quiz management
- Learning-progress tracking

## Tech Stack

### Frontend

- React
- Vite
- React Router
- Axios
- React Markdown

### Backend

- Node.js
- Express
- MongoDB with Mongoose
- JSON Web Tokens (JWT)
- Gemini AI
- MongoDB Atlas Vector Search
- Vercel Blob storage

## Project Structure

```text
mern_ai_learning_assistant/
|-- backend/
|   |-- controllers/    # Request handling and business logic
|   |-- middleware/     # Authentication middleware
|   |-- models/         # MongoDB/Mongoose models
|   |-- routes/         # REST API route definitions
|   |-- utils/          # PDF parsing, embeddings, and Gemini helpers
|   `-- server.js       # Express server entry point
|
`-- frontend/
    |-- src/
    |   |-- components/ # Reusable UI components
    |   |-- context/    # Authentication state
    |   |-- pages/      # Application screens
    |   |-- services/   # Frontend API calls
    |   `-- utils/      # Axios configuration and API paths
    `-- package.json
```

## How It Works

1. A user registers or logs in and receives a JWT token.
2. The user uploads a PDF document.
3. The backend downloads the PDF from blob storage and extracts its text.
4. The extracted text is split into chunks and converted to vector embeddings.
5. Chunks are stored in MongoDB with the document ID and user ID.
6. When the user asks a question, the app searches for the most relevant chunks using vector search.
7. The relevant document context is sent to Gemini AI to generate a grounded response, summary, quiz, flashcards, or explanation.

## Prerequisites

Install these before running the project:

- Node.js 18 or later
- npm
- MongoDB Atlas database with Vector Search enabled
- A Gemini API key
- A Vercel Blob store token

## Environment Variables

Create a `backend/.env` file with values similar to the following:

```env
PORT=8000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_long_random_jwt_secret
GEMINI_API_KEY=your_gemini_api_key
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
VECTOR_INDEX_NAME=document_vector_index
```

For a separate deployed frontend, add `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000
```

When `VITE_API_URL` is not set, the frontend uses `http://localhost:8000` by default.

## Installation

Install backend dependencies:

```bash
cd backend
npm install
```

Install frontend dependencies:

```bash
cd frontend
npm install
```

## Run Locally

Start the backend server:

```bash
cd backend
npm run dev
```

Start the frontend in another terminal:

```bash
cd frontend
npm run dev
```

Open the URL shown by Vite, usually `http://localhost:5173`.

## API Groups

All API routes are served by the backend, normally at `http://localhost:8000`.

| Base path | Purpose |
| --- | --- |
| `/api/auth` | Register, login, and user authentication |
| `/api/documents` | Upload, confirm, list, retrieve, and manage documents |
| `/api/ai` | Generate summaries, flashcards, quizzes, explanations, and document chat |
| `/api/flashcards` | Retrieve and manage generated flashcards |
| `/api/quizzes` | Retrieve, take, and manage quizzes |
| `/api/progress` | Store and retrieve learning progress |

Most routes require this request header after login:

```http
Authorization: Bearer <JWT_TOKEN>
```

## Security Notes

- Authentication is enforced through the `protect` middleware.
- Documents and document chunks are associated with a `userId`.
- Semantic searches filter by both `documentId` and `userId`, which ensures results belong to the requested document and its owner.
- Do not commit `.env` files or API keys to Git.

## Useful Development Notes

- PDF extraction logs appear in the backend terminal, not in the browser console.
- The browser PDF viewer may use temporary browser memory/cache, but it does not store the uploaded document in `localStorage` unless the app explicitly writes it there.
- The frontend sends ordinary API requests through `frontend/src/utils/axiosInstance.js` and endpoint paths are defined in `frontend/src/utils/apiPaths.js`.

