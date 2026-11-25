# Neotic

<p align="center">
  <strong>Think Smarter. Create Without Limits.</strong>
</p>

<p align="center">
  A modern AI-powered application built with React, TypeScript and Google's Gemini AI.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/TypeScript-Enabled-3178C6?logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Vite-Powered-646CFF?logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/AI-Google%20Gemini-8E75B2?logo=google&logoColor=white" />
  <img src="https://img.shields.io/badge/Backend-Express-000000?logo=express&logoColor=white" />
</p>

---

## About Neotic

**Neotic** is a modern web application built using a contemporary JavaScript and TypeScript stack, with Google Gemini AI integration.

The project combines a React-based frontend with a Node.js backend to provide a foundation for AI-powered application experiences.

It is designed with a modular architecture and modern development tools.

## Tech Stack

| Technology | Purpose |
|---|---|
| React 19 | Frontend development |
| TypeScript | Type-safe development |
| Vite | Development and build tooling |
| Tailwind CSS 4 | Styling |
| Express.js | Backend server |
| Google Gemini API | AI integration |
| Firebase | Backend services |
| SQLite | Database |
| Sharp | Image processing |
| XLSX | Spreadsheet processing |
| Motion | UI animations |
| Lucide React | Icons |

## Project Structure

```text
Neotic/
│
├── public/
│   └── assets/
│       └── aistudio/
│
├── server/
│
├── src/
│
├── .env.example
├── .gitignore
├── Dockerfile
├── firebase-applet-config.json
├── index.html
├── package.json
├── render.yaml
├── server.ts
├── tsconfig.json
└── vite.config.ts
```

## Getting Started

Follow these instructions to run Neotic locally.

### Prerequisites

Make sure you have installed:

- [Node.js](https://nodejs.org/)
- [Git](https://git-scm.com/)
- [Bun](https://bun.sh/) (if using the Bun lockfile)

### 1. Clone the Repository

```bash
git clone https://github.com/AryanPatil-T/Neotic.git
```

### 2. Navigate to the Project

```bash
cd Neotic
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment Variables

Create your environment configuration using the example file:

```bash
cp .env.example .env
```

Add the required API keys and configuration values to `.env` according to the example file.

**Important:** Never commit your API keys, credentials, or private environment variables to GitHub.

### 5. Start the Development Server

```bash
npm run dev
```

### 6. Build for Production

```bash
npm run build
```

To preview the production build:

```bash
npm run preview
```

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Build production frontend |
| `npm run preview` | Preview production build |
| `npm run lint` | Run TypeScript checks |
| `npm start` | Start the application server |

## Environment Variables

The application uses an environment configuration file.

Refer to `.env.example` for the exact variables required by the project.

Keep sensitive values private and use your deployment platform's environment-variable settings for production.

## Deployment

The repository includes deployment-related configuration files:

- `Dockerfile` – Container configuration.
- `render.yaml` – Render deployment configuration.

Deployment requirements may vary depending on the environment and configured services.

## Contributing

Contributions, suggestions and improvements are welcome.

1. Fork this repository.
2. Create a feature branch.
3. Make your changes.
4. Commit your changes.
5. Open a Pull Request.

## Author

**Aryan Patil**

- GitHub: [@AryanPatil-T](https://github.com/AryanPatil-T)
- Project: [Neotic](https://github.com/AryanPatil-T/Neotic)

---

<p align="center">
  Built with curiosity and a passion for technology.
</p>
