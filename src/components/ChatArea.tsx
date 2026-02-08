import { Send, Paperclip, X, FileText, Sparkles, Settings2, PanelLeft } from "lucide-react";
import { Message, MessageNode, Theme, ChatMode } from "../types";
import { useState, useRef, useEffect, useMemo } from "react";
import clsx from "clsx";
import { ThreadItem } from "./ThreadItem";
import { Tooltip } from "./ui/Tooltip";

interface ChatAreaProps {
  messages: Message[];
  streamingContent: string;
  isStreaming: boolean;
  onSendMessage: (content: string, images?: string[], pdfs?: string[], replyToId?: number) => void;
  onRetry: () => void;
  onEdit: (id: number, content: string) => void;
  onDelete: (id: number) => void;
  theme: Theme;
  availableModels: string[];
  onRegenerate: (messageId: number, model: string) => void;
  selectedModel: string;
  onArchive: (threadId: number) => void;
  chatModes: ChatMode[];
  currentModeId: string;
  smartContextEnabled: boolean;
  onOpenContextConfig: () => void;
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
}

function buildMessageTree(messages: Message[]): MessageNode[] {
  const messageMap = new Map<number, MessageNode>();
  const roots: MessageNode[] = [];

  // 1. Initialize map with patched messages
  const patchedMessages = messages.map((m, index) => {
    const msg = { ...m };
    // Heuristic: If assistant message has no reply_to_id, 
    // and follows a user message that IS a reply, 
    // treat it as a reply to that user message.
    if (msg.role === 'assistant' && !msg.reply_to_id && index > 0) {
      const prev = messages[index - 1];
      if (prev.role === 'user') {
        msg.reply_to_id = prev.id;
      }
    }
    return msg;
  });

  patchedMessages.forEach(m => {
    messageMap.set(m.id, { ...m, children: [] });
  });

  // 2. Build tree
  patchedMessages.forEach(m => {
    const node = messageMap.get(m.id)!;
    if (m.reply_to_id && messageMap.has(m.reply_to_id)) {
      const parent = messageMap.get(m.reply_to_id)!;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

export function ChatArea({
  messages,
  streamingContent,
  isStreaming,
  onSendMessage,
  onRetry,
  onEdit,
  onDelete,
  theme,
  availableModels,
  onRegenerate,
  selectedModel,
  onArchive,
  chatModes,
  currentModeId,
  smartContextEnabled,
  onOpenContextConfig,
  onToggleSidebar,
  isSidebarOpen
}: ChatAreaProps) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<{ type: 'image' | 'pdf', content: string, name: string }[]>([]);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const [footerHeight, setFooterHeight] = useState(140); // Default initial height
  const isDark = theme === 'dark';

  useEffect(() => {
    if (!footerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Use getBoundingClientRect to get the full visual height including padding
        setFooterHeight(entry.target.getBoundingClientRect().height);
      }
    });

    observer.observe(footerRef.current);
    return () => observer.disconnect();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleReply = (message: Message) => {
    setReplyingTo(message);
    textareaRef.current?.focus();
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  const messageTree = useMemo(() => {
    const tree = buildMessageTree(messages);

    // Handle streaming message attachment to tree
    if (isStreaming) {
      const streamingMsg: MessageNode = {
        id: -1,
        thread_id: -1,
        role: 'assistant',
        content: streamingContent,
        created_at: new Date().toISOString(),
        children: []
      };

      const lastMessage = messages[messages.length - 1];

      // Only attach streaming message to thread if the last message was part of a thread
      if (lastMessage && lastMessage.reply_to_id) {
        const attachToId = lastMessage.id;

        // Helper to find and attach
        const attachToNode = (nodes: MessageNode[]): boolean => {
          for (const node of nodes) {
            if (node.id === attachToId) {
              node.children.push(streamingMsg);
              return true;
            }
            if (attachToNode(node.children)) return true;
          }
          return false;
        };

        if (!attachToNode(tree)) {
          // If not found (shouldn't happen), add as root
          tree.push(streamingMsg);
        }
      } else {
        // Main chat or no previous message -> add as root
        tree.push(streamingMsg);
      }
    }
    return tree;
  }, [messages, isStreaming, streamingContent]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      for (const file of files) {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const content = event.target?.result as string;
            setAttachments(prev => [...prev, { type: 'image', content, name: file.name }]);
          };
          reader.readAsDataURL(file);
        } else if (file.type === 'application/pdf') {
          const reader = new FileReader();
          reader.onload = (event) => {
            const content = event.target?.result as string;
            setAttachments(prev => [...prev, { type: 'pdf', content, name: file.name }]);
          };
          reader.readAsDataURL(file);
        }
      }
      e.target.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && attachments.length === 0) || isStreaming) return;

    const images = attachments.filter(a => a.type === 'image').map(a => a.content.split(',')[1]);
    const pdfs = attachments.filter(a => a.type === 'pdf').map(a => a.content.split(',')[1]);

    onSendMessage(
      input,
      images.length > 0 ? images : undefined,
      pdfs.length > 0 ? pdfs : undefined,
      replyingTo?.id // Pass the reply ID
    );
    setInput("");
    setAttachments([]);
    setReplyingTo(null); // Clear reply state
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if ((input.trim() || attachments.length > 0) && !isStreaming) {
        const images = attachments.filter(a => a.type === 'image').map(a => a.content.split(',')[1]);
        const pdfs = attachments.filter(a => a.type === 'pdf').map(a => a.content.split(',')[1]);

        onSendMessage(
          input,
          images.length > 0 ? images : undefined,
          pdfs.length > 0 ? pdfs : undefined,
          replyingTo?.id
        );
        setInput("");
        setAttachments([]);
        setReplyingTo(null);
      }
    }
  };

  return (
    <div className={clsx("flex-1 flex flex-col h-full min-h-0 transition-colors duration-300 relative", isDark ? "bg-[#0f0f0f] text-gray-100" : "bg-[#f8f9fa] text-gray-900")}>
      {/* Chat Header */}
      <div className={clsx(
        "flex-none px-6 py-3 border-b flex items-center justify-between z-10",
        isDark ? "bg-[#0f0f0f] border-[#222]" : "bg-white border-gray-200"
      )}>
        <div className="flex items-center gap-3">
          <Tooltip content={isSidebarOpen ? "Close sidebar" : "Open sidebar"}>
            <button
              onClick={onToggleSidebar}
              className={clsx(
                "p-2 rounded-lg transition-colors mr-1",
                isDark ? "hover:bg-[#1a1a1a] text-gray-400 hover:text-white" : "hover:bg-gray-100 text-gray-600 hover:text-black"
              )}
            >
              <PanelLeft size={20} />
            </button>
          </Tooltip>

          <div className={clsx(
            "p-2 rounded-lg",
            isDark ? "bg-[#1a1a1a]" : "bg-gray-100"
          )}>
            <Sparkles size={18} className={isDark ? "text-amber-400" : "text-amber-500"} />
          </div>
          <div>
            <div className="text-sm font-semibold flex items-center gap-2">
              {chatModes.find(m => m.id === currentModeId)?.name}
              {smartContextEnabled && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-bold tracking-wide uppercase">
                  Context Active
                </span>
              )}
            </div>
            <div className="text-xs opacity-50">
              {smartContextEnabled ? "Smart context enabled" : "Standard chat session"}
            </div>
          </div>
        </div>

        <Tooltip content="Configure Context & Agent">
          <button
            onClick={onOpenContextConfig}
            className={clsx(
              "p-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium",
              isDark ? "hover:bg-[#1a1a1a] text-gray-400 hover:text-gray-200" : "hover:bg-gray-100 text-gray-600 hover:text-gray-900"
            )}
          >
            <Settings2 size={18} />
            <span className="hidden sm:inline">Configure</span>
          </button>
        </Tooltip>
      </div>

      <div
        className="flex-1 overflow-y-auto p-4 md:p-6"
        style={{ paddingBottom: `${footerHeight}px` }}
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center opacity-50 space-y-6">
            <div className={clsx(
              "w-20 h-20 rounded-2xl flex items-center justify-center rotate-3 transition-transform hover:rotate-6",
              isDark ? "bg-[#1a1a1a] border border-[#333]" : "bg-white border border-gray-200"
            )}>
              <Send size={32} className={isDark ? "text-white" : "text-black"} />
            </div>
            <div className="text-center space-y-2">
              <p className="text-lg font-semibold">Start a conversation</p>
              <p className="text-sm opacity-60 max-w-xs mx-auto">Type a message below to begin chatting with your local AI model.</p>
            </div>
          </div>
        )}

        <div className="space-y-6 max-w-5xl mx-auto">
          {messageTree.map((root) => (
            <ThreadItem
              key={root.id}
              node={root}
              depth={0}
              onRetry={onRetry}
              onEdit={onEdit}
              onDelete={onDelete}
              onReply={handleReply}
              theme={theme}
              availableModels={availableModels}
              onRegenerate={onRegenerate}
              defaultModel={selectedModel}
              onArchive={onArchive}
            />
          ))}
        </div>

        <div ref={messagesEndRef} />
      </div>

      <div
        ref={footerRef}
        className="absolute bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-current via-current to-transparent pt-12"
        style={{ color: isDark ? '#0f0f0f' : '#f8f9fa', '--tw-gradient-from': isDark ? '#0f0f0f' : '#f8f9fa', '--tw-gradient-via': isDark ? '#0f0f0f' : '#f8f9fa' } as any}>
        <form
          onSubmit={handleSubmit}
          className={clsx(
            "max-w-4xl mx-auto p-3 rounded-[24px] border shadow-xl flex flex-col gap-2 transition-all duration-300 relative z-10",
            isDark ? "bg-[#1a1a1a] border-[#333] shadow-black/50" : "bg-white border-gray-200 shadow-gray-200/50"
          )}
        >
          {replyingTo && (
            <div className={clsx(
              "flex items-center justify-between px-4 py-2 rounded-xl text-xs mb-1 mx-1",
              isDark ? "bg-[#252525] text-gray-300 border border-[#333]" : "bg-gray-50 text-gray-600 border border-gray-100"
            )}>
              <div className="flex items-center gap-2 truncate">
                <span className="font-semibold text-blue-500">Replying to {replyingTo.role}:</span>
                <span className="truncate opacity-70 max-w-[200px]">{replyingTo.content.substring(0, 50)}...</span>
              </div>
              <button
                type="button"
                onClick={cancelReply}
                className="hover:text-red-500 transition-colors p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {attachments.length > 0 && (
            <div className="flex gap-3 overflow-x-auto p-2 pb-1 mx-1">
              {attachments.map((att, index) => (
                <div key={index} className="relative group shrink-0">
                  {att.type === 'image' ? (
                    <img src={att.content} alt={att.name} className="h-16 w-16 object-cover rounded-xl border border-gray-500/30 shadow-sm" />
                  ) : (
                    <div className={clsx("h-16 w-16 flex flex-col items-center justify-center rounded-xl border shadow-sm", isDark ? "bg-[#252525] border-[#333]" : "bg-gray-50 border-gray-200")}>
                      <FileText size={24} className="opacity-50" />
                      <span className="text-[9px] truncate max-w-full px-1 mt-1 opacity-70">{att.name}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeAttachment(index)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2 px-1">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept="image/*,.pdf"
              multiple
            />
            <Tooltip content="Add attachment">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={clsx(
                  "p-3 rounded-full transition-colors mb-0.5",
                  isDark ? "text-gray-400 hover:text-white hover:bg-[#252525]" : "text-gray-400 hover:text-black hover:bg-gray-100"
                )}
              >
                <Paperclip size={20} />
              </button>
            </Tooltip>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className={clsx(
                "flex-1 bg-transparent border-none focus:ring-0 px-2 py-3 focus:outline-none resize-none max-h-48 min-h-[44px] text-[15px] leading-relaxed",
                isDark ? "text-white placeholder-gray-500" : "text-black placeholder-gray-400"
              )}
              disabled={isStreaming}
              rows={1}
              style={{ height: 'auto', minHeight: '44px' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = `${target.scrollHeight}px`;
              }}
            />
            <Tooltip content="Send message">
              <button
                type="submit"
                disabled={(!input.trim() && attachments.length === 0) || isStreaming}
                className={clsx(
                  "p-3 rounded-full transition-all mb-0.5 shadow-sm",
                  (!input.trim() && attachments.length === 0) || isStreaming
                    ? "opacity-30 cursor-not-allowed bg-gray-500/20"
                    : (isDark ? "bg-white text-black hover:bg-gray-200 hover:scale-105 active:scale-95" : "bg-black text-white hover:bg-gray-800 hover:scale-105 active:scale-95")
                )}
              >
                <Send size={18} />
              </button>
            </Tooltip>
          </div>
        </form>
        <div className={clsx("text-center text-[11px] mt-3 font-medium tracking-wide opacity-40 select-none", isDark ? "text-gray-400" : "text-gray-500")}>
          AI can make mistakes. Consider checking important information.
        </div>
      </div>
    </div>
  );
}
