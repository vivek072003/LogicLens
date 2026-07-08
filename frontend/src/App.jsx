import { useState, useRef, useEffect } from "react";
import Editor from "@monaco-editor/react";
import ReactMarkdown from "react-markdown";
import Prism from "prismjs";
import "prismjs/themes/prism-tomorrow.css";
// Languages for Prism highlighting:
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-python";
import "prismjs/components/prism-c";
import "prismjs/components/prism-cpp";
import "prismjs/components/prism-java";
import "prismjs/components/prism-css";
import "prismjs/components/prism-json";

import "./App.css";

function App() {
  const [code, setCode] = useState(`// Paste or write your code here...
function calculateFactorial(n) {
  if (n <= 1) return 1;
  return n * calculateFactorial(n - 1);
}
console.log(calculateFactorial(5));`);
  const [explanation, setExplanation] = useState("");
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState("javascript");
  const [copied, setCopied] = useState(false);
  
  // Terminal State
  const [currentDir, setCurrentDir] = useState("C:\\");
  const [terminalBuffer, setTerminalBuffer] = useState([
    "LogicLens Integrated Terminal [Version 1.0.0]",
    "Type 'help' for documentation, or click 'Run Code' above to execute.",
    ""
  ]);
  const [terminalInput, setTerminalInput] = useState("");
  const [terminalLoading, setTerminalLoading] = useState(false);
  const [commandHistory, setCommandHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const editorRef = useRef(null);
  const terminalEndRef = useRef(null);
  const terminalInputRef = useRef(null);
  const activeEventSourceRef = useRef(null);

  // Fetch CWD on load
  useEffect(() => {
    fetch("http://localhost:3000/api/terminal/cwd")
      .then((res) => res.json())
      .then((data) => {
        if (data.cwd) setCurrentDir(data.cwd);
      })
      .catch((err) => console.error("Error fetching initial cwd:", err));
  }, []);

  // Trigger PrismJS highlighting on output updates
  useEffect(() => {
    Prism.highlightAll();
  }, [explanation, loading]);

  // Auto scroll terminal to bottom
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [terminalBuffer]);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    if (monaco) {
      monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
      });
      monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
      });
    }
  };

  const formatCode = async () => {
    if (editorRef.current) {
      try {
        await editorRef.current.getAction("editor.action.formatDocument").run();
        // Wait slightly for Monaco to apply formatting and update local value
        await new Promise((resolve) => setTimeout(resolve, 150));
      } catch (e) {
        console.warn("Formatting is not supported or failed for this language", e);
      }
    }
  };

  const explainCode = async () => {
    if (!code || !code.trim()) return;

    setLoading(true);

    // Auto-format the code in Monaco
    await formatCode();

    // Get the formatted code directly from editor
    const codeToSend = editorRef.current ? editorRef.current.getValue() : code;

    try {
      const response = await fetch("http://localhost:3000/api/explain", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: codeToSend }),
      });

      const data = await response.json();
      setExplanation(data.explanation || "");
    } catch (error) {
      console.error(error);
      setExplanation("### Error\nFailed to explain the code. Please check that the server is running.");
    } finally {
      setLoading(false);
    }
  };

  const resetConversation = async () => {
    try {
      await fetch("http://localhost:3000/api/reset", {
        method: "POST",
      });
    } catch (error) {
      console.error("Failed to reset:", error);
    }
    setCode("// Code cleared\n");
    setExplanation("");
  };

  const copyToClipboard = () => {
    if (!explanation) return;
    navigator.clipboard.writeText(explanation);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Helper to append text to the terminal buffer
  const appendToBuffer = (text) => {
    setTerminalBuffer((prev) => {
      const lines = text.split("\n");
      if (prev.length === 0) return lines;
      const newBuffer = [...prev];
      // Merge first line of new text into the last line of buffer
      newBuffer[newBuffer.length - 1] += lines[0];
      // Push all other lines
      for (let i = 1; i < lines.length; i++) {
        newBuffer.push(lines[i]);
      }
      return newBuffer;
    });
  };

  // Execute terminal command
  const runTerminalCommand = (cmdString) => {
    const trimmed = cmdString.trim();
    if (!trimmed) {
      setTerminalBuffer((prev) => [...prev, ""]);
      return;
    }

    // Add to command history
    setCommandHistory((prev) => [trimmed, ...prev]);
    setHistoryIndex(-1);

    // Append command to visual output
    setTerminalBuffer((prev) => [...prev, `${currentDir} > ${trimmed}`]);

    // Check clear
    if (trimmed.toLowerCase() === "clear") {
      setTerminalBuffer([]);
      return;
    }

    // Check help
    if (trimmed.toLowerCase() === "help") {
      setTerminalBuffer((prev) => [
        ...prev,
        "Available commands:",
        "  cd <path>        Change working directory",
        "  clear            Clear terminal screen",
        "  help             Print this help menu",
        "  [shell commands] Run standard system utilities (e.g. dir, node, python, git)",
        ""
      ]);
      return;
    }

    // Check cd
    if (trimmed.toLowerCase().startsWith("cd ")) {
      const target = trimmed.substring(3).trim();
      fetch("http://localhost:3000/api/terminal/cd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentDir, target })
      })
        .then((res) => {
          if (!res.ok) return res.json().then(e => { throw new Error(e.error); });
          return res.json();
        })
        .then((data) => {
          if (data.success) {
            setCurrentDir(data.newDir);
            setTerminalBuffer((prev) => [...prev, ""]);
          }
        })
        .catch((err) => {
          setTerminalBuffer((prev) => [...prev, `Error: ${err.message}`, ""]);
        });
      return;
    }

    // Run custom shell command via SSE
    setTerminalLoading(true);
    appendToBuffer("\n");

    const es = new EventSource(
      `http://localhost:3000/api/terminal/run?cmd=${encodeURIComponent(trimmed)}&cwd=${encodeURIComponent(currentDir)}`
    );
    activeEventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.text) {
          appendToBuffer(payload.text);
        }
        if (payload.event === "exit") {
          es.close();
          activeEventSourceRef.current = null;
          appendToBuffer(`\n[Process exited with code ${payload.code}]\n\n`);
          setTerminalLoading(false);
        }
      } catch (err) {
        console.error("Failed parsing message:", err);
      }
    };

    es.onerror = () => {
      es.close();
      activeEventSourceRef.current = null;
      appendToBuffer("\nError connecting to backend command stream.\n\n");
      setTerminalLoading(false);
    };
  };

  const handleTerminalSubmit = (e) => {
    e.preventDefault();
    if (terminalLoading) return;
    const cmd = terminalInput;
    setTerminalInput("");
    runTerminalCommand(cmd);
  };

  const handleTerminalKeyDown = (e) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (commandHistory.length === 0) return;
      const nextIndex = historyIndex + 1;
      if (nextIndex < commandHistory.length) {
        setHistoryIndex(nextIndex);
        setTerminalInput(commandHistory[nextIndex]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const nextIndex = historyIndex - 1;
      if (nextIndex >= 0) {
        setHistoryIndex(nextIndex);
        setTerminalInput(commandHistory[nextIndex]);
      } else {
        setHistoryIndex(-1);
        setTerminalInput("");
      }
    }
  };

  const stopCurrentCommand = () => {
    if (activeEventSourceRef.current) {
      activeEventSourceRef.current.close();
      activeEventSourceRef.current = null;
      appendToBuffer("\n^C\n[Command terminated by user]\n\n");
      setTerminalLoading(false);
    }
  };

  const runCodeInTerminal = async () => {
    if (terminalLoading) return;
    
    // 1. Format the editor code
    await formatCode();
    const currentCode = editorRef.current ? editorRef.current.getValue() : code;

    // 2. Save code via API
    try {
      const saveRes = await fetch("http://localhost:3000/api/terminal/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: currentCode, language })
      });
      
      if (!saveRes.ok) {
        throw new Error(`Server returned status ${saveRes.status}. Please make sure you have restarted your backend server.`);
      }
      
      const saveData = await saveRes.json();
      if (!saveData.success) {
        setTerminalBuffer((prev) => [...prev, `[Save Error] Failed to write playground file.`, ""]);
        return;
      }

      // 3. Determine execution command based on language
      const extMap = {
        javascript: "playground.js",
        typescript: "playground.ts",
        python: "playground.py",
        cpp: "playground.cpp",
        c: "playground.c",
        java: "Playground.java"
      };
      
      const file = extMap[language];
      if (!file) {
        setTerminalBuffer((prev) => [...prev, `[Execution Warning] Running ${language} directly is not supported.`, ""]);
        return;
      }

      let runCmd = "";
      switch (language) {
        case "javascript":
          runCmd = `node ${file}`;
          break;
        case "typescript":
          runCmd = `npx tsx ${file}`;
          break;
        case "python":
          runCmd = `python ${file}`;
          break;
        case "cpp":
          runCmd = `g++ ${file} -o playground.exe && .\\playground.exe`;
          break;
        case "c":
          runCmd = `gcc ${file} -o playground.exe && .\\playground.exe`;
          break;
        case "java":
          runCmd = `javac ${file} && java Playground`;
          break;
      }

      if (runCmd) {
        runTerminalCommand(runCmd);
      }

    } catch (err) {
      console.error(err);
      setTerminalBuffer((prev) => [
        ...prev,
        `[Execution Error] ${err.message}`,
        "Tip: Ensure the backend is active, and restart it to register the new /api/terminal endpoints.",
        ""
      ]);
    }
  };

  const focusTerminal = () => {
    if (terminalInputRef.current) {
      terminalInputRef.current.focus();
    }
  };

  return (
    <div className="app-wrapper">
      <header className="app-header">
        <div className="logo-container">
          <div className="logo-icon">🔍</div>
          <div className="logo-text">
            <h1>LogicLens</h1>
            <span>AI Code Analyzer & Explainer</span>
          </div>
        </div>
      </header>

      <div className="container">
        {/* TOP ROW: Code Editor & Terminal */}
        <div className="top-row">
          {/* Left panel: Code Editor */}
          <div className="left card">
            <div className="panel-header">
              <h2>Code Input</h2>
              <div className="toolbar">
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="select-dropdown"
                >
                  <option value="javascript">JavaScript</option>
                  <option value="typescript">TypeScript</option>
                  <option value="python">Python</option>
                  <option value="cpp">C++</option>
                  <option value="c">C</option>
                  <option value="java">Java</option>
                  <option value="html">HTML</option>
                  <option value="css">CSS</option>
                  <option value="json">JSON</option>
                </select>
                <button onClick={formatCode} className="btn btn-secondary" title="Format Code">
                  Format
                </button>
                <button onClick={resetConversation} className="btn btn-danger" title="Clear Chat History">
                  Reset
                </button>
              </div>
            </div>

            <div className="editor-container">
              <Editor
                height="100%"
                language={language}
                theme="vs-dark"
                value={code}
                onChange={(val) => setCode(val || "")}
                onMount={handleEditorDidMount}
                path={`playground.${language === "javascript" ? "js" : language === "typescript" ? "ts" : language === "python" ? "py" : language === "cpp" ? "cpp" : language === "c" ? "c" : language === "java" ? "java" : language}`}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  fontFamily: "Fira Code, Consolas, 'Courier New', monospace",
                  automaticLayout: true,
                  padding: { top: 12, bottom: 12 },
                  tabSize: 2,
                  autoClosingBrackets: "always",
                  autoClosingQuotes: "always",
                  formatOnPaste: true,
                  formatOnType: true,
                  cursorBlinking: "smooth",
                  cursorSmoothCaretAnimation: "on",
                  renderLineHighlight: "all",
                  scrollbar: {
                    verticalScrollbarSize: 8,
                    horizontalScrollbarSize: 8,
                  }
                }}
              />
            </div>
          </div>

          {/* Right panel: Terminal */}
          <div className="right-terminal card" onClick={focusTerminal}>
            <div className="panel-header">
              <h2>Integrated Terminal</h2>
              <div className="toolbar">
                <button
                  onClick={runCodeInTerminal}
                  className="btn btn-primary btn-run"
                  disabled={terminalLoading || ["html", "css", "json"].includes(language)}
                  title="Run current code in terminal"
                >
                  ▶ Run Code
                </button>
                {terminalLoading && (
                  <button onClick={stopCurrentCommand} className="btn btn-danger" title="Stop current execution">
                    Stop (Ctrl+C)
                  </button>
                )}
                <button onClick={() => setTerminalBuffer([])} className="btn btn-secondary" title="Clear screen">
                  Clear
                </button>
              </div>
            </div>

            <div className="terminal-body">
              <div className="terminal-scroll-area">
                {terminalBuffer.map((line, index) => (
                  <div key={index} className="terminal-line">
                    {line}
                  </div>
                ))}
                <div ref={terminalEndRef} />
              </div>
              <form onSubmit={handleTerminalSubmit} className="terminal-prompt-form">
                <span className="terminal-prompt-path">{currentDir} &gt;</span>
                <input
                  ref={terminalInputRef}
                  type="text"
                  value={terminalInput}
                  onChange={(e) => setTerminalInput(e.target.value)}
                  onKeyDown={handleTerminalKeyDown}
                  className="terminal-prompt-input"
                  placeholder={terminalLoading ? "Process running..." : "Type command here..."}
                  disabled={terminalLoading}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                />
              </form>
            </div>
          </div>
        </div>

        {/* BOTTOM ROW: Explanation Output */}
        <div className="bottom-row">
          <div className="explanation-panel card">
            <div className="panel-header">
              <h2>Code Explanation</h2>
              <div className="toolbar">
                <button onClick={explainCode} className="btn btn-primary explain-btn" disabled={loading}>
                  {loading ? "Formatting & Processing..." : "Explain Code"}
                </button>
                {explanation && (
                  <button onClick={copyToClipboard} className="btn btn-secondary copy-btn">
                    {copied ? "Copied! ✓" : "Copy Markdown"}
                  </button>
                )}
              </div>
            </div>

            <div className="output">
              {loading ? (
                <div className="loading-state">
                  <div className="pulse-loader"></div>
                  <p>LogicLens is analyzing your code structure...</p>
                </div>
              ) : explanation ? (
                <ReactMarkdown>{explanation}</ReactMarkdown>
              ) : (
                <div className="empty-state">
                  <p>Write your code on the left and click "Explain Code" below to receive a detailed AI explanation and optimization analysis.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;