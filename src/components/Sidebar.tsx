import { Plus, MessageSquare, Sun, Moon, Pencil, Trash2, Check, X } from "lucide-react";
import { Thread, Theme } from "../types";
import { useState } from "react";
import clsx from "clsx";
import { Tooltip } from "./ui/Tooltip";

interface SidebarProps {
  threads: Thread[];
  activeThreadId: number | null;
  onSelectThread: (id: number) => void;
  onNewChat: () => void;
  onRenameThread: (id: number, newTitle: string) => void;
  onDeleteThread: (id: number) => void;
  theme: Theme;
  onToggleTheme: () => void;
}

export function Sidebar({
  threads,
  activeThreadId,
  onSelectThread,
  onNewChat,
  onRenameThread,
  onDeleteThread,
  theme,
  onToggleTheme
}: SidebarProps) {
  const isDark = theme === 'dark';
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const startEditing = (thread: Thread, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(thread.id);
    setEditTitle(thread.title);
  };

  const cancelEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
    setEditTitle("");
  };

  const saveEditing = (id: number, e: React.MouseEvent | React.FormEvent) => {
    e.stopPropagation();
    if (editTitle.trim()) {
      onRenameThread(id, editTitle.trim());
    }
    setEditingId(null);
    setEditTitle("");
  };

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteThread(id);
  };

  return (
    <div className={clsx(
      "w-full flex flex-col h-full border-r transition-colors duration-300",
      isDark ? "bg-[#0f0f0f] border-[#222] text-gray-200" : "bg-gray-50/50 border-gray-200/60 text-gray-700"
    )}>
      <div className="p-4 space-y-3">
        <Tooltip content="Start a new chat session">
          <button
            onClick={onNewChat}
            className={clsx(
              "w-full flex items-center gap-3 py-3 px-4 rounded-xl transition-all duration-200 group border",
              isDark
                ? "bg-[#1a1a1a] border-[#333] hover:border-[#444] text-gray-200 hover:bg-[#222]"
                : "bg-white border-gray-200 hover:border-gray-300 text-gray-700 hover:bg-gray-50 hover:shadow-sm"
            )}
          >
            <div className={clsx("p-1.5 rounded-md transition-colors", isDark ? "bg-gray-800 group-hover:bg-gray-700" : "bg-gray-100 group-hover:bg-gray-200")}>
              <Plus size={16} />
            </div>
            <span className="font-medium text-sm">New Chat</span>
          </button>
        </Tooltip>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
        <div className={clsx("px-3 py-2 text-[11px] font-bold uppercase tracking-widest opacity-50 mb-1", isDark ? "text-gray-500" : "text-gray-400")}>
          Recent Chats
        </div>
        {threads.map((thread) => (
          <div
            key={thread.id}
            className={clsx(
              "w-full text-left p-3 flex items-center gap-3 rounded-lg transition-all duration-200 text-sm group relative border border-transparent",
              activeThreadId === thread.id
                ? (isDark ? "bg-[#1a1a1a] text-white border-[#333]" : "bg-white text-gray-900 border-gray-200 shadow-sm")
                : (isDark ? "text-gray-400 hover:bg-[#1a1a1a]/50 hover:text-gray-200" : "text-gray-600 hover:bg-white/60 hover:text-gray-900")
            )}
            onClick={() => onSelectThread(thread.id)}
          >
            <MessageSquare size={16} className={clsx("shrink-0 transition-opacity", activeThreadId === thread.id ? "opacity-100" : "opacity-40 group-hover:opacity-70")} />

            {editingId === thread.id ? (
              <div className="flex items-center gap-1 flex-1 min-w-0" onClick={e => e.stopPropagation()}>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className={clsx(
                    "flex-1 bg-transparent border-b focus:outline-none min-w-0 px-1 py-0.5 text-sm",
                    isDark ? "border-gray-500 text-white focus:border-blue-500" : "border-gray-400 text-black focus:border-blue-500"
                  )}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEditing(thread.id, e);
                    if (e.key === 'Escape') cancelEditing(e as any);
                  }}
                />
                <button onClick={(e) => saveEditing(thread.id, e)} className="p-1 hover:text-green-500 transition-colors"><Check size={14} /></button>
                <button onClick={cancelEditing} className="p-1 hover:text-red-500 transition-colors"><X size={14} /></button>
              </div>
            ) : (
              <>
                <span className="truncate flex-1 font-medium">{thread.title}</span>
                <div className={clsx("hidden group-hover:flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all absolute right-2 top-1/2 -translate-y-1/2 px-1 rounded-md", isDark ? "bg-[#1a1a1a] shadow-[-10px_0_10px_#1a1a1a]" : "bg-white/80 backdrop-blur-sm shadow-[-10px_0_10px_white]")}>
                  <Tooltip content="Rename chat">
                    <button
                      onClick={(e) => startEditing(thread, e)}
                      className={clsx("p-1.5 rounded-md transition-colors", isDark ? "hover:bg-gray-700 text-gray-400 hover:text-gray-200" : "hover:bg-gray-200 text-gray-500 hover:text-gray-700")}
                    >
                      <Pencil size={12} />
                    </button>
                  </Tooltip>
                  <Tooltip content="Delete chat">
                    <button
                      onClick={(e) => handleDelete(thread.id, e)}
                      className={clsx("p-1.5 rounded-md transition-colors", isDark ? "hover:bg-red-900/30 text-gray-400 hover:text-red-400" : "hover:bg-red-50 text-gray-500 hover:text-red-600")}
                    >
                      <Trash2 size={12} />
                    </button>
                  </Tooltip>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="p-4 border-t" style={{ borderColor: isDark ? '#222' : '#f0f0f0' }}>
        <Tooltip content={isDark ? "Switch to light mode" : "Switch to dark mode"}>
          <button
            onClick={onToggleTheme}
            className={clsx(
              "w-full flex items-center justify-between p-3 rounded-xl transition-all duration-200 text-sm border",
              isDark
                ? "bg-[#1a1a1a] border-[#333] hover:border-[#444] text-gray-400 hover:text-white"
                : "bg-white border-gray-200 hover:border-gray-300 text-gray-600 hover:text-gray-900 shadow-sm"
            )}
          >
            <div className="flex items-center gap-3">
              {isDark ? <Moon size={16} /> : <Sun size={16} />}
              <span className="font-medium">{isDark ? "Dark Mode" : "Light Mode"}</span>
            </div>
            <div className={clsx("w-8 h-4 rounded-full relative transition-colors", isDark ? "bg-blue-600" : "bg-gray-300")}>
              <div className={clsx("absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all shadow-sm", isDark ? "left-4.5" : "left-0.5")} style={{ left: isDark ? '18px' : '2px' }} />
            </div>
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
