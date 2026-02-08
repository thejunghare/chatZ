# Chatz (Rust + Tauri)     

A native macOS chatbot application using Rust that integrates with Ollama's local language models.

## Features

- **Native Rust Backend**: Built with Tauri for high performance.
- **Ollama Integration**: Real-time streaming response from local models (llama2, mistral, etc.).
- **Persistent Storage**: SQLite database to save threads and messages.
- **Modern UI**: React + TypeScript + Tailwind CSS with Markdown rendering.
- **Thread Management**: Create and switch between multiple conversations.

## Prerequisites

1. **Rust**: [Install Rust](https://www.rust-lang.org/tools/install)
2. **Node.js**: [Install Node.js](https://nodejs.org/)
3. **Ollama**: [Install Ollama](https://ollama.com/)
   - Run `ollama serve` in a terminal.
   - Pull a model: `ollama pull llama2` (or your preferred model).
