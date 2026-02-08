import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Sidebar } from "./components/Sidebar";
import { ChatArea } from "./components/ChatArea";
import { ConfirmationModal } from "./components/ConfirmationModal";
import { ContextConfigModal } from "./components/ContextConfigModal";
import { Thread, Message, Theme, ChatMode } from "./types";
import "./App.css";
import clsx from "clsx";

const CHAT_MODES: ChatMode[] = [
  {
    id: 'general',
    name: 'General Assistant',
    systemPrompt: 'You are a highly intelligent and versatile AI assistant. Your goal is to provide accurate, helpful, and concise responses to any query. You adapt your tone and depth of explanation to the user\'s needs. You are excellent at brainstorming, explaining concepts, summarising information, and general problem solving.',
    description: 'Versatile assistant for all-purpose tasks'
  },
  {
    id: 'developer',
    name: 'Professional Developer',
    systemPrompt: 'You are a senior software engineer and architect. You write clean, efficient, modern, and well-documented code. You follow best practices, design patterns, and solid principles. When explaining technical concepts, you are precise and clear. You always consider edge cases, error handling, and performance implications.',
    description: 'Expert coding, architecture, and technical guidance'
  }
];

function App() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("qwen3-vl");
  const [theme, setTheme] = useState<Theme>('dark');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isTauriEnv, setIsTauriEnv] = useState(() => "__TAURI_INTERNALS__" in window);
  const [chatMode, setChatMode] = useState<string>(CHAT_MODES[0].id);
  const [smartContextEnabled, setSmartContextEnabled] = useState(false);
  const [selectedContextThreadIds, setSelectedContextThreadIds] = useState<number[]>([]);
  const [isContextConfigOpen, setIsContextConfigOpen] = useState(false);

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => { },
  });

  useEffect(() => {
    // Check if running in Tauri environment
    const isTauri = "__TAURI_INTERNALS__" in window;
    setIsTauriEnv(isTauri);
    if (!isTauri) {
      console.warn("Tauri API not found. Running in browser mode.");
    }
  }, []);

  useEffect(() => {
    if (isTauriEnv) {
      loadThreads();
      loadModels();
    }
  }, [isTauriEnv]);

  useEffect(() => {
    if (activeThreadId && isTauriEnv) {
      loadMessages(activeThreadId);
    } else {
      setMessages([]);
    }
  }, [activeThreadId, isTauriEnv]);

  useEffect(() => {
    if (!isTauriEnv) return;

    const unlistenResponse = listen<string>("stream-response", (event) => {
      setStreamingContent((prev) => prev + event.payload);
    });

    const unlistenDone = listen("stream-done", () => {
      setIsStreaming(false);
      if (activeThreadId) {
        loadMessages(activeThreadId);
      }
      setStreamingContent("");
    });

    return () => {
      unlistenResponse.then((f) => f());
      unlistenDone.then((f) => f());
    };
  }, [activeThreadId, isTauriEnv]);

  const loadThreads = async () => {
    try {
      const threads = await invoke<Thread[]>("get_threads");
      setThreads(threads);
    } catch (error) {
      console.error("Failed to load threads:", error);
    }
  };

  const loadMessages = async (threadId: number) => {
    try {
      const msgs = await invoke<Message[]>("get_messages", { threadId });
      setMessages(msgs);
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
  };

  const loadModels = async () => {
    if (!isTauriEnv) {
      setModels(["llama2", "mistral", "deepseek-r1"]);
      setSelectedModel("llama2");
      return;
    }
    try {
      const models = await invoke<string[]>("list_models");
      if (models.length > 0) {
        setModels(models);
        setSelectedModel(models[0]);
      } else {
        setModels(["llama2", "mistral"]);
      }
    } catch (error) {
      console.error("Failed to load models", error);
      setModels(["llama2", "mistral"]);
    }
  }

  const handleNewChat = async () => {
    if (!isTauriEnv) return;
    const title = `New Chat ${new Date().toLocaleTimeString()}`;
    const selectedMode = CHAT_MODES.find(m => m.id === chatMode);

    let systemPrompt = selectedMode?.systemPrompt;

    if (smartContextEnabled) {
      try {
        let contextMessages: Message[] = [];

        // If specific threads are selected, use them
        if (selectedContextThreadIds.length > 0) {
          for (const threadId of selectedContextThreadIds) {
            try {
              const msgs = await invoke<Message[]>("get_messages", { threadId });
              // Take last 5 messages from each selected thread to avoid context overflow
              contextMessages.push(...msgs.slice(-5));
            } catch (e) {
              console.warn(`Failed to fetch context for thread ${threadId}`, e);
            }
          }
        } else if (activeThreadId && messages.length > 0) {
          // Fallback to current thread if nothing selected (legacy behavior)
          contextMessages = messages;
        } else if (threads.length > 0) {
          // Fallback to first thread
          contextMessages = await invoke<Message[]>("get_messages", { threadId: threads[0].id });
        }

        if (contextMessages.length > 0) {
          // Sort by creation time if we merged multiple threads
          contextMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

          // Take last 20 messages total
          const recent = contextMessages.slice(-20);
          const contextStr = recent.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n");
          systemPrompt = (systemPrompt || "") + `\n\n[CONTEXT FROM PREVIOUS SESSION]\n${contextStr}\n[END CONTEXT]\n`;
        }
      } catch (e) {
        console.error("Failed to load smart context:", e);
      }
    }

    try {
      const thread = await invoke<Thread>("create_thread", {
        title,
        systemPrompt
      });
      setThreads([thread, ...threads]);
      setActiveThreadId(thread.id);
    } catch (error) {
      console.error("Failed to create thread:", error);
    }
  };

  const handleSendMessage = async (content: string, images?: string[], pdfs?: string[], replyToId?: number) => {
    if (!activeThreadId) return;

    const tempMsg: Message = {
      id: Date.now(),
      thread_id: activeThreadId,
      role: "user",
      content,
      images,
      created_at: new Date().toISOString(),
      reply_to_id: replyToId,
    };
    setMessages((prev) => [...prev, tempMsg]);
    setIsStreaming(true);
    setStreamingContent("");

    if (!isTauriEnv) {
      setTimeout(() => {
        setIsStreaming(false);
        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          thread_id: activeThreadId,
          role: "assistant",
          content: "I cannot reply in browser mode. Please use the app window.",
          created_at: new Date().toISOString(),
        }]);
      }, 500);
      return;
    }

    try {
      await invoke("send_message", {
        threadId: activeThreadId,
        content,
        images,
        pdfs,
        model: selectedModel,
        replyToId,
      });
    } catch (error) {
      console.error("Failed to send message:", error);
      setIsStreaming(false);
    }
  };

  const handleRetry = async () => {
    if (!activeThreadId || isStreaming) return;

    setIsStreaming(true);
    setStreamingContent("");

    // Optimistically remove last assistant message if present
    setMessages(prev => {
      if (prev.length > 0 && prev[prev.length - 1].role === 'assistant') {
        return prev.slice(0, -1);
      }
      return prev;
    });

    try {
      await invoke("regenerate_response", {
        threadId: activeThreadId,
        model: selectedModel
      });
    } catch (error) {
      console.error("Failed to regenerate:", error);
      setIsStreaming(false);
    }
  };

  const handleRegenerateResponse = async (messageId: number, model: string) => {
    if (!activeThreadId || isStreaming) return;

    setIsStreaming(true);
    setStreamingContent("");

    // Optimistically remove the message and subsequent ones
    setMessages(prev => {
      const index = prev.findIndex(m => m.id === messageId);
      if (index === -1) return prev;
      return prev.slice(0, index); // Remove messageId and everything after
    });

    try {
      await invoke("regenerate_from_message", {
        threadId: activeThreadId,
        messageId,
        model
      });
    } catch (error) {
      console.error("Failed to regenerate:", error);
      setIsStreaming(false);
      loadMessages(activeThreadId);
    }
  };

  const handleEdit = async (messageId: number, newContent: string) => {
    if (!activeThreadId || isStreaming) return;

    setIsStreaming(true);
    setStreamingContent("");

    // Optimistically update UI
    setMessages(prev => {
      const index = prev.findIndex(m => m.id === messageId);
      if (index === -1) return prev;
      const updated = prev.slice(0, index + 1); // Keep up to the edited message
      updated[index] = { ...updated[index], content: newContent };
      return updated;
    });

    try {
      await invoke("edit_message", {
        threadId: activeThreadId,
        messageId,
        newContent,
        model: selectedModel
      });
    } catch (error) {
      console.error("Failed to edit:", error);
      setIsStreaming(false);
    }
  };

  const handleRenameThread = async (threadId: number, newTitle: string) => {
    try {
      if (isTauriEnv) {
        await invoke("rename_thread", { threadId, newTitle });
      }
      setThreads(threads.map(t => t.id === threadId ? { ...t, title: newTitle } : t));
    } catch (error) {
      console.error("Failed to rename thread:", error);
    }
  };

  const handleArchiveThread = (threadId: number) => {
    // Implement archive functionality
    console.log("Archive thread", threadId);
  };

  const handleDeleteThread = (threadId: number) => {
    setModalConfig({
      isOpen: true,
      title: "Delete Chat",
      message: "Are you sure you want to delete this chat? This action cannot be undone.",
      onConfirm: async () => {
        try {
          await invoke("delete_thread", { threadId });
          setThreads(prev => prev.filter(t => t.id !== threadId));
          if (activeThreadId === threadId) {
            setActiveThreadId(null);
            setMessages([]);
          }
          setModalConfig(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
          console.error("Failed to delete thread:", error);
          alert(`Failed to delete thread: ${error}`);
          setModalConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleDeleteMessage = (messageId: number) => {
    if (!activeThreadId) return;
    setModalConfig({
      isOpen: true,
      title: "Delete Message",
      message: "Are you sure you want to delete this message? This will also delete all subsequent messages.",
      onConfirm: async () => {
        try {
          await invoke("delete_message", { threadId: activeThreadId, messageId });
          loadMessages(activeThreadId);
          setModalConfig(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
          console.error("Failed to delete message:", error);
          alert(`Failed to delete message: ${error}`);
          setModalConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };



  return (
    <div className={clsx("flex h-screen font-sans antialiased transition-colors duration-300", theme === 'dark' ? "bg-[#0f0f0f] text-white" : "bg-white text-gray-900")}>
      <div className={clsx("transition-all duration-300 overflow-hidden flex-shrink-0", isSidebarOpen ? "w-64" : "w-0")}>
        <Sidebar
          threads={threads}
          activeThreadId={activeThreadId}
          onSelectThread={setActiveThreadId}
          onNewChat={handleNewChat}
          onRenameThread={handleRenameThread}
          onDeleteThread={(id) => {
            setModalConfig({
              isOpen: true,
              title: "Delete Chat",
              message: "Are you sure you want to delete this chat? This action cannot be undone.",
              onConfirm: () => {
                handleDeleteThread(id);
                setModalConfig(prev => ({ ...prev, isOpen: false }));
              }
            });
          }}
          theme={theme}
          onToggleTheme={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
        />
      </div>

      {/* Main Content */}
      <div className={clsx(
        "flex-1 flex flex-col h-full overflow-hidden transition-all duration-300",
        isSidebarOpen ? "ml-0" : "ml-0"
      )}>
        <ChatArea
          messages={messages}
          streamingContent={streamingContent}
          isStreaming={isStreaming}
          onSendMessage={handleSendMessage}
          onRetry={handleRetry}
          onEdit={handleEdit}
          onDelete={handleDeleteMessage}
          theme={theme}
          availableModels={models}
          onRegenerate={handleRegenerateResponse}
          selectedModel={selectedModel}
          onArchive={handleArchiveThread}
          chatModes={CHAT_MODES}
          currentModeId={chatMode}
          smartContextEnabled={smartContextEnabled}
          onOpenContextConfig={() => setIsContextConfigOpen(true)}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          isSidebarOpen={isSidebarOpen}
        />
      </div>

      <ConfirmationModal
        isOpen={modalConfig.isOpen}
        onCancel={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={modalConfig.onConfirm}
        title={modalConfig.title}
        message={modalConfig.message}
        theme={theme}
      />

      <ContextConfigModal
        isOpen={isContextConfigOpen}
        onClose={() => setIsContextConfigOpen(false)}
        threads={threads}
        chatModes={CHAT_MODES}
        currentModeId={chatMode}
        onSelectMode={setChatMode}
        smartContextEnabled={smartContextEnabled}
        onToggleSmartContext={setSmartContextEnabled}
        selectedThreadIds={selectedContextThreadIds}
        onSelectThreadIds={setSelectedContextThreadIds}
        theme={theme}
      />
    </div>
  );
}

export default App;
