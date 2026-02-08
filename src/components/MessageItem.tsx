import { useState } from "react";
import { Message, Theme } from "../types";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { Copy, RefreshCw, Pencil, Brain, User, Bot, MoreHorizontal, MessageSquare, ChevronDown, Trash2, ChevronUp, Check } from "lucide-react";
import clsx from "clsx";
import { Tooltip } from "./ui/Tooltip";
import { useToast } from "./ui/Toast";
import { motion } from "framer-motion";

interface MessageItemProps {
  message: Message;
  isLast: boolean;
  onRetry: () => void;
  onEdit: (id: number, content: string) => void;
  onDelete: (id: number) => void;
  onReply: (message: Message) => void;
  theme: Theme;
  replyToMessage?: Message;
  availableModels: string[];
  onRegenerate: (messageId: number, model: string) => void;
  defaultModel: string;
  onCollapse?: () => void;
  isCollapsed?: boolean;
  hasChildren?: boolean;
}

export function MessageItem({ message, onEdit, onReply, theme, availableModels, onRegenerate, onCollapse, isCollapsed, hasChildren, onDelete }: MessageItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const { showToast } = useToast();
  const isDark = theme === 'dark';
  const isUser = message.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    showToast("Message copied to clipboard", "success");
    setShowActionsMenu(false);
  };

  const handleDelete = () => {
    onDelete(message.id);
    showToast("Message deleted", "success");
    setShowActionsMenu(false);
  };

  const handleSaveEdit = () => {
    if (editContent.trim() !== message.content) {
      onEdit(message.id, editContent);
    }
    setIsEditing(false);
  };

  const cancelEdit = () => {
    setEditContent(message.content);
    setIsEditing(false);
  };

  // Parsing <think> tag
  const thinkMatch = message.content.match(/<think(?:[\s\S]*?)>([\s\S]*?)<\/think>/);
  const thinkContent = thinkMatch ? thinkMatch[1] : null;
  const mainContent = message.content.replace(/<think(?:[\s\S]*?)>[\s\S]*?<\/think>/, "").trim();

  const openThink = message.content.includes("<think") && !message.content.includes("</think>");
  let effectiveThinkContent = thinkContent;
  let effectiveMainContent = mainContent;

  if (openThink) {
    const parts = message.content.split(/<think(?:[\s\S]*?)>/);
    if (parts.length > 1) {
      effectiveThinkContent = parts[1];
      effectiveMainContent = parts[0].trim();
    }
  }

  const CodeBlock = ({ inline, className, children, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : '';
    const [copied, setCopied] = useState(false);

    const handleCopyCode = () => {
      navigator.clipboard.writeText(String(children).replace(/\n$/, ''));
      setCopied(true);
      showToast("Code copied to clipboard", "success");
      setTimeout(() => setCopied(false), 2000);
    };

    if (inline) {
      return (
        <code
          className={clsx(
            "px-1.5 py-0.5 rounded-[4px] text-[0.85em] font-mono border",
            isDark
              ? "bg-[#2c2c2c] text-[#ff7b72] border-transparent"
              : "bg-[#f2f3f5] text-[#eb5757] border-[#e3e3e3]"
          )}
          {...props}
        >
          {children}
        </code>
      );
    }

    return (
      <div className={clsx(
        "rounded-xl overflow-hidden my-6 border shadow-sm group/code transition-all",
        isDark ? "border-[#333] bg-[#0d0d0d] shadow-black/20" : "border-gray-200 bg-gray-50 shadow-gray-200/50"
      )}>
        {/* Header */}
        <div className={clsx(
          "flex items-center justify-between px-4 py-2.5 border-b text-xs select-none",
          isDark ? "bg-[#1a1a1a] border-[#333] text-gray-400" : "bg-white border-gray-200 text-gray-500"
        )}>
          <div className="flex items-center gap-2">
            <div className={clsx("w-2.5 h-2.5 rounded-full", isDark ? "bg-red-500/20" : "bg-red-500/20")} />
            <div className={clsx("w-2.5 h-2.5 rounded-full", isDark ? "bg-yellow-500/20" : "bg-yellow-500/20")} />
            <div className={clsx("w-2.5 h-2.5 rounded-full", isDark ? "bg-green-500/20" : "bg-green-500/20")} />
            <span className="font-medium lowercase font-mono opacity-70 ml-2">{language || 'text'}</span>
          </div>
          <button
            onClick={handleCopyCode}
            className={clsx(
              "flex items-center gap-1.5 transition-all duration-200 px-2.5 py-1.5 rounded-md text-xs font-medium",
              copied
                ? "text-green-500 bg-green-500/10"
                : (isDark ? "hover:bg-[#252525] hover:text-gray-200" : "hover:bg-gray-100 hover:text-gray-700")
            )}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span className="">{copied ? 'Copied' : 'Copy Code'}</span>
          </button>
        </div>
        {/* Code */}
        <div className={clsx(
          "overflow-x-auto p-5 text-[13px] font-mono leading-relaxed tab-4",
          isDark ? "bg-[#0d0d0d] text-gray-300" : "bg-[#f7f7f5] text-[#37352f]"
        )}>
          <code className={className} {...props}>
            {children}
          </code>
        </div>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      id={`message-${message.id}`}
      className={clsx(
        "flex w-full p-3 md:p-4 group/item transition-colors rounded-2xl",
        // isDark ? "border-gray-800 hover:bg-white/5" : "border-gray-100 hover:bg-gray-50" // Removing this as parent handles it
      )}>
      {/* Avatar Column */}
      <div className="mr-4 flex-shrink-0">
        <div className={clsx(
          "w-8 h-8 rounded-full flex items-center justify-center",
          isUser
            ? (isDark ? "bg-gray-700 text-gray-200" : "bg-white border border-gray-200 text-gray-700")
            : (isDark ? "bg-blue-900/30 text-blue-400 ring-1 ring-blue-500/20" : "bg-blue-50 text-blue-600 border border-blue-100")
        )}>
          {isUser ? <User size={16} /> : <Bot size={18} />}
        </div>
      </div>

      {/* Content Column */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <span className={clsx("font-semibold text-sm tracking-tight", isDark ? "text-gray-200" : "text-gray-900")}>
            {isUser ? "You" : "Assistant"}
          </span>
          <span className={clsx("text-[11px] font-medium opacity-40", isDark ? "text-gray-400" : "text-gray-500")}>
            {new Date(message.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {isUser && (
            <span className={clsx("text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider opacity-60", isDark ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-500")}>
              ME
            </span>
          )}
        </div>

        {/* Edit Mode */}
        {isEditing ? (
          <div className={clsx(
            "w-full rounded-xl p-3 border ring-1 ring-offset-2 ring-blue-500/50",
            isDark ? "bg-[#111] border-[#333] ring-offset-[#111]" : "bg-white border-gray-200"
          )}>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className={clsx(
                "w-full h-32 bg-transparent resize-none focus:outline-none text-sm font-sans leading-relaxed",
                isDark ? "text-white" : "text-black"
              )}
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-2">
              <button onClick={cancelEdit} className={clsx("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors", isDark ? "hover:bg-gray-800 text-gray-400" : "hover:bg-gray-100 text-gray-500")}>
                Cancel
              </button>
              <button onClick={handleSaveEdit} className={clsx("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors", isDark ? "bg-white text-black hover:bg-gray-200" : "bg-black text-white hover:bg-gray-800")}>
                Save Changes
              </button>
            </div>
          </div>
        ) : (
          <div className={clsx("text-[15px] leading-relaxed", isDark ? "text-gray-300" : "text-gray-800")}>
            {/* Thinking Block - Enhanced Visibility */}
            {effectiveThinkContent && (
              <div className="mb-4">
                <details className="group/think" open={openThink ? true : undefined}>
                  <summary className={clsx(
                    "cursor-pointer text-[11px] font-bold uppercase tracking-wider flex items-center gap-2 select-none opacity-60 hover:opacity-100 transition-opacity mb-2 py-1.5 px-3 rounded-lg w-fit border",
                    isDark ? "bg-black/20 border-white/10 text-gray-400 hover:bg-white/5" : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
                  )} title="Click to expand/collapse thinking process">
                    <Brain size={12} />
                    Thinking Process
                  </summary>
                  <div className={clsx(
                    "p-4 text-xs rounded-xl font-mono leading-relaxed border overflow-x-auto",
                    isDark ? "border-[#333] bg-[#0a0a0a] text-gray-400" : "border-gray-200 bg-gray-50/50 text-gray-600"
                  )}>
                    {effectiveThinkContent}
                  </div>
                </details>
              </div>
            )}

            {/* Images */}
            {message.images && message.images.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {message.images.map((img, idx) => (
                  <img
                    key={idx}
                    // Check if it's already a data URL or just base64
                    src={img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`}
                    alt="Attachment"
                    className="max-h-80 rounded-xl border border-gray-500/20 object-contain bg-black/5"
                  />
                ))}
              </div>
            )}

            {/* Text Content */}
            {effectiveMainContent ? (
              <div className={clsx(
                "prose prose-sm max-w-none",
                // Typography overrides for Notion feel
                "prose-headings:font-bold prose-headings:tracking-tight prose-headings:mb-4 prose-headings:mt-8",
                "prose-p:my-3 prose-p:leading-8 prose-p:font-sans",
                "prose-ul:my-3 prose-ul:list-disc prose-ul:pl-6",
                "prose-ol:my-3 prose-ol:list-decimal prose-ol:pl-6",
                "prose-li:my-1 prose-li:leading-relaxed",
                "prose-blockquote:border-l-[3px] prose-blockquote:pl-5 prose-blockquote:my-4 prose-blockquote:not-italic prose-blockquote:font-normal",
                "prose-strong:font-bold",
                "prose-hr:my-8 prose-hr:border-gray-200 dark:prose-hr:border-gray-800",
                // Clear default code styles since we handle them in CodeBlock
                "prose-code:before:content-none prose-code:after:content-none",
                "prose-pre:bg-transparent prose-pre:p-0 prose-pre:m-0 prose-pre:border-none prose-pre:rounded-none",
                isDark
                  ? "prose-invert prose-p:text-gray-300 prose-headings:text-gray-100 prose-blockquote:border-gray-700 prose-blockquote:text-gray-400 prose-strong:text-white"
                  : "prose-neutral prose-p:text-[#37352f] prose-headings:text-[#37352f] prose-blockquote:border-gray-900 prose-blockquote:text-gray-600 prose-strong:text-[#37352f]"
              )}>
                <ReactMarkdown
                  rehypePlugins={[rehypeRaw]}
                  components={{
                    code: CodeBlock
                  }}
                >
                  {effectiveMainContent}
                </ReactMarkdown>
              </div>
            ) : (
              !effectiveThinkContent && <span className="opacity-50 italic text-sm">Thinking...</span>
            )}
          </div>
        )}

        {/* Action Bar (Reddit Style) */}
        {!isEditing && (
          <div className="flex items-center gap-2 mt-3 relative">
            {/* Reply Button (All messages) */}
            <Tooltip content="Reply to this message">
              <button
                onClick={() => onReply(message)}
                className={clsx("flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all active:scale-95", isDark ? "text-gray-500 hover:text-gray-300 hover:bg-white/5" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100")}
                aria-label="Reply to message"
              >
                <MessageSquare size={14} />
                <span className="text-xs font-medium">Reply</span>
              </button>
            </Tooltip>

            {isUser && (
              <Tooltip content="Edit message">
                <button
                  onClick={() => setIsEditing(true)}
                  className={clsx("flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all active:scale-95", isDark ? "text-gray-500 hover:text-gray-300 hover:bg-white/5" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100")}
                  aria-label="Edit message"
                >
                  <Pencil size={14} />
                  <span className="text-xs font-medium">Edit</span>
                </button>
              </Tooltip>
            )}

            {!isUser && (
              <div className="relative">
                <Tooltip content="Regenerate response">
                  <button
                    onClick={() => setShowModelMenu(!showModelMenu)}
                    className={clsx("flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all active:scale-95", isDark ? "text-gray-500 hover:text-gray-300 hover:bg-white/5" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100")}
                    aria-label="Regenerate response"
                  >
                    <RefreshCw size={14} />
                    <span className="text-xs font-medium">Retry</span>
                    <ChevronDown size={10} className="opacity-50" />
                  </button>
                </Tooltip>

                {showModelMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowModelMenu(false)} />
                    <div className={clsx(
                      "absolute bottom-full left-0 mb-1 w-48 rounded-lg shadow-xl border overflow-hidden z-20 flex flex-col py-1",
                      isDark ? "bg-[#1a1a1a] border-[#333]" : "bg-white border-gray-200"
                    )}>
                      {availableModels.map(m => (
                        <button
                          key={m}
                          onClick={() => {
                            onRegenerate(message.id, m);
                            setShowModelMenu(false);
                          }}
                          className={clsx(
                            "w-full text-left px-3 py-2 text-xs hover:bg-opacity-50 transition-colors flex items-center gap-2",
                            message.model === m
                              ? (isDark ? "bg-[#252525] text-blue-400" : "bg-blue-50 text-blue-600")
                              : (isDark ? "text-gray-300 hover:bg-[#252525]" : "text-gray-700 hover:bg-gray-50")
                          )}
                        >
                          <span className="truncate">{m}</span>
                          {message.model === m && <div className="w-1.5 h-1.5 rounded-full bg-current" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Collapse/Close Thread Button - Only for Assistant and if has children */}
            {!isUser && hasChildren && onCollapse && (
              <Tooltip content={isCollapsed ? "Expand Thread" : "Collapse Thread"}>
                <button
                  onClick={onCollapse}
                  className={clsx("flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all active:scale-95", isDark ? "text-gray-500 hover:text-gray-300 hover:bg-white/5" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100")}
                  aria-label={isCollapsed ? "Expand Thread" : "Collapse Thread"}
                >
                  <ChevronUp size={14} className={clsx("transition-transform", isCollapsed && "rotate-180")} />
                  <span className="text-xs font-medium">{isCollapsed ? "Expand" : "Close"}</span>
                </button>
              </Tooltip>
            )}

            {/* Three Dots Menu */}
            <div className="relative ml-auto">
              <Tooltip content="More options" side="left">
                <button
                  className={clsx("flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors active:scale-95", isDark ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600")}
                  aria-label="More options"
                  onClick={() => setShowActionsMenu(!showActionsMenu)}
                >
                  <MoreHorizontal size={14} />
                </button>
              </Tooltip>

              {showActionsMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowActionsMenu(false)} />
                  <div className={clsx(
                    "absolute bottom-full right-0 mb-1 w-32 rounded-lg shadow-xl border overflow-hidden z-20 flex flex-col py-1",
                    isDark ? "bg-[#1a1a1a] border-[#333]" : "bg-white border-gray-200"
                  )}>
                    <button
                      onClick={handleCopy}
                      className={clsx(
                        "w-full text-left px-3 py-2 text-xs hover:bg-opacity-50 transition-colors flex items-center gap-2",
                        isDark ? "text-gray-300 hover:bg-[#252525]" : "text-gray-700 hover:bg-gray-50"
                      )}
                    >
                      <Copy size={14} />
                      <span>Copy</span>
                    </button>
                    <button
                      onClick={handleDelete}
                      className={clsx(
                        "w-full text-left px-3 py-2 text-xs hover:bg-opacity-50 transition-colors flex items-center gap-2 text-red-500 hover:bg-red-500/10",
                      )}
                    >
                      <Trash2 size={14} />
                      <span>Delete</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
