import express from "express";
import { InferenceClient } from "@huggingface/inference";
import dotenv from "dotenv";
import cors from "cors";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const hf = new InferenceClient(process.env.HF_TOKEN);

/*
Conversation memory

Example:

[
 {
   role:"user",
   content:"const x=5"
 },

 {
   role:"assistant",
   content:"This code declares..."
 }
]
*/

let conversationHistory = [];

app.post("/api/explain", async (req, res) => {

    try {

        const { code } = req.body;

        if (!code) {
            return res.status(400).json({
                error: "Please provide code"
            });
        }

        conversationHistory.push({
            role: "user",
            content: code
        });

        const response = await hf.chatCompletion({

            model: "meta-llama/Llama-3.1-8B-Instruct",

            messages: [

                {
                    role: "system",
                    content:
                        `You are an expert coding tutor.

Explain code in this format:

1. What the code does
2. Line by line explanation
3. Errors if any
4. Improved version
5. Best practices

Keep explanations beginner friendly.
`
                },

                ...conversationHistory

            ],

            max_tokens: 1200

        });

        const explanation =
            response.choices[0].message.content;

        conversationHistory.push({

            role: "assistant",
            content: explanation

        });

        res.json({

            explanation

        });

    }

    catch (err) {

        console.log(err);

        res.status(500).json({

            error:
                "Something went wrong"

        });

    }

});


app.post("/api/reset", (req, res) => {

    conversationHistory = [];

    res.json({

        message:
            "Conversation cleared"

    });

});

app.get("/api/terminal/cwd", (req, res) => {
    res.json({ cwd: process.cwd() });
});

app.post("/api/terminal/cd", (req, res) => {
    const { currentDir, target } = req.body;
    try {
        const resolvedPath = path.resolve(currentDir || process.cwd(), target);
        if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory()) {
            res.json({ success: true, newDir: resolvedPath });
        } else {
            res.status(400).json({ error: `Directory does not exist: ${target}` });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/api/terminal/save", (req, res) => {
    const { code, language } = req.body;
    
    const extMap = {
        javascript: ".js",
        typescript: ".ts",
        python: ".py",
        cpp: ".cpp",
        c: ".c",
        java: ".java",
        html: ".html",
        css: ".css",
        json: ".json"
    };
    
    const ext = extMap[language] || ".txt";
    const fileName = language === "java" ? "Playground.java" : `playground${ext}`;
    const filePath = path.join(process.cwd(), fileName);
    
    try {
        fs.writeFileSync(filePath, code);
        res.json({ success: true, fileName });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/terminal/run", (req, res) => {
    const { cmd, cwd } = req.query;
    
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    
    if (!cmd) {
        res.write(`data: ${JSON.stringify({ text: "Error: No command specified\n" })}\n\n`);
        res.end();
        return;
    }
    
    const commandProcess = spawn(cmd, {
        cwd: cwd || process.cwd(),
        shell: true
    });
    
    commandProcess.stdout.on("data", (data) => {
        res.write(`data: ${JSON.stringify({ text: data.toString() })}\n\n`);
    });
    
    commandProcess.stderr.on("data", (data) => {
        res.write(`data: ${JSON.stringify({ text: data.toString() })}\n\n`);
    });
    
    commandProcess.on("error", (err) => {
        res.write(`data: ${JSON.stringify({ text: `Error: ${err.message}\n` })}\n\n`);
    });
    
    commandProcess.on("close", (code) => {
        res.write(`data: ${JSON.stringify({ event: "exit", code })}\n\n`);
        res.end();
    });
    
    req.on("close", () => {
        commandProcess.kill();
    });
});

app.listen(port, () => {

    console.log(`Running on ${port}`);

});