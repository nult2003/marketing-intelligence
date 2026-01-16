# Marketing Intelligent Project

This project consists of a FastAPI backend and a React (Vite) frontend, managed by Docker Compose.

## Prerequisites

- Docker and Docker Compose
- uv (for backend dependency management)
- Node.js (optional, for local development)

## Project Structure

```
.
├── backend/
│   ├── app/
│   │   ├── api/          # Route handlers
│   │   ├── core/         # Config and database setup
│   │   ├── models/       # SQLAlchemy models (2.0 style)
│   │   ├── schemas/      # Pydantic models (v2)
│   │   └── tasks/        # Celery background tasks
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── App.tsx       # Main app with Admin and News Feed routes
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
└── .env
```

## Getting Started

1.  **Clone the repository.**
2.  **Environment Variables**: The project already has a `.env` file for development. Update as needed.
3.  **Run with Docker Compose**:
    ```bash
    docker-compose up --build
    ```
4.  **Access the applications**:
    - Frontend: [http://localhost:5173](http://localhost:5173)
    - Backend: [http://localhost:8000](http://localhost:8000)
    - API documentation: [http://localhost:8000/docs](http://localhost:8000/docs)

## Key Technologies

- **Backend**: FastAPI, SQLAlchemy 2.0, PostgreSQL, Celery, Redis, Pydantic v2.
- **Frontend**: React (Vite), TypeScript, Tailwind CSS, shadcn/ui, TanStack Query.
