# LogicLens

LogicLens is an interactive AI-powered code analysis, optimization, and execution workspace. It combines a professional code editor, an integrated command runner terminal, and a structured AI tutoring console to help developers inspect, run, and understand code snippets in real-time.

The application is structured as a monorepo consisting of an Express backend that handles system child processes and inference integrations, alongside a React frontend designed with a responsive, glassmorphic layout.

---

## Project Structure

*   **backend/**: A Node.js Express server that interfaces with LLM endpoints and exposes streaming terminal runners for shell execution.
*   **frontend/**: A React client bootstrapped with Vite, utilizing Monaco Editor for input handling and PrismJS for syntax highlights.

---

## Key Features

### Code Editor
*   Powered by Monaco Editor for high-performance input and editing.
*   Supports standard IDE features including auto-bracket closing, automatic double quote completion, and folding.
*   Includes real-time syntax checking and semantic validation, displaying red diagnostics squiggles for errors.
*   Programmatic document formatting triggers clean code indentation automatically.

### Integrated Terminal Panel
*   Displays a monospace console interface with a working directory path prompt.
*   Streams command stdout and stderr logs in real-time using Server-Sent Events.
*   Supports directory changes with path verification, clearing terminal buffers, and custom commands.
*   Maintains terminal command history accessible via the Up and Down arrow keys.
*   Provides manual process termination (SIGINT emulation) to kill running background processes.

### Code Playground Executor
*   Saves the code from the editor to a temporary workspace file based on the selected language.
*   Executes the code block directly using matching system runtimes (such as Node.js for JavaScript, Python for Python, GCC for C/C++, and Javac for Java).
*   Streams execution outputs directly to the integrated terminal screen.

### Artificial Intelligence Explainer
*   Submits the code context to a LLM runner for structured breakdown.
*   Returns code analyses formatted in markdown, divided into:
    1. Overall code behavior summary.
    2. Line-by-line breakdown.
    3. Error checking and logical bugs.
    4. Code optimizations and best practices.
*   Renders explanations with clear typographic hierarchies, blockquotes, styled tables, and fully highlighted code blocks.

---

## Getting Started

Follow these steps to run LogicLens locally on your system.

### Prerequisites
*   Node.js (Version 18 or higher recommended)
*   NPM or Yarn package manager
*   Access to terminal compilers (e.g., Python, GCC, or Java SDK installed in your system PATH) if you wish to run those respective languages.

### Backend Configuration

1. Navigate to the backend directory:
    ```bash
    cd backend
    ```

2. Install dependencies:
    ```bash
    npm install
    ```

3. Create a .env file in the backend directory and configure the environment variables:
    ```env
    PORT=3000
    HF_TOKEN=your_hugging_face_api_token
    ```

4. Start the server:
    ```bash
    node server.js
    ```

### Frontend Configuration

1. Navigate to the frontend directory:
    ```bash
    cd ../frontend
    ```

2. Install dependencies:
    ```bash
    npm install
    ```

3. Start the Vite development server:
    ```bash
    npm run dev
    ```

4. Open your browser and navigate to the local server URL (typically http://localhost:5173).
