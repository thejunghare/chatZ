import { X, Check, Search, Bot, Sparkles, MessageSquare, Info } from "lucide-react";
import { Thread, ChatMode, Theme } from "../types";
import { useState, useEffect } from "react";
import clsx from "clsx";
import { motion, AnimatePresence } from "framer-motion";

interface ContextConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  threads: Thread[];
  chatModes: ChatMode[];
  currentModeId: string;
  onSelectMode: (modeId: string) => void;
  smartContextEnabled: boolean;
  onToggleSmartContext: (enabled: boolean) => void;
  selectedThreadIds: number[];
  onSelectThreadIds: (ids: number[]) => void;
  theme: Theme;
}

export function ContextConfigModal({
  isOpen,
  onClose,
  threads,
  chatModes,
  currentModeId,
  onSelectMode,
  smartContextEnabled,
  onToggleSmartContext,
  selectedThreadIds,
  onSelectThreadIds,
  theme
}: ContextConfigModalProps) {
  const isDark = theme === 'dark';
  const [searchQuery, setSearchQuery] = useState("");
  const [localEnabled, setLocalEnabled] = useState(smartContextEnabled);
  const [localModeId, setLocalModeId] = useState(currentModeId);
  const [localSelectedIds, setLocalSelectedIds] = useState<number[]>(selectedThreadIds);

  // Sync props to local state when opening
  useEffect(() => {
    if (isOpen) {
      setLocalEnabled(smartContextEnabled);
      setLocalModeId(currentModeId);
      setLocalSelectedIds(selectedThreadIds);
    }
  }, [isOpen, smartContextEnabled, currentModeId, selectedThreadIds]);

  const handleSave = () => {
    onToggleSmartContext(localEnabled);
    onSelectMode(localModeId);
    onSelectThreadIds(localSelectedIds);
    onClose();
  };

  const toggleThread = (id: number) => {
    setLocalSelectedIds(prev =>
      prev.includes(id) ? prev.filter(tid => tid !== id) : [...prev, id]
    );
  };

  const filteredThreads = threads.filter(t =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />

          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            className={clsx(
              "relative w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]",
              isDark ? "bg-[#1a1a1a] border border-[#333] text-gray-200" : "bg-white border border-gray-200 text-gray-800"
            )}
          >
            {/* Header */}
            <div className={clsx(
              "px-6 py-4 border-b flex items-center justify-between",
              isDark ? "border-[#333] bg-[#222]" : "border-gray-200 bg-gray-50"
            )}>
              <div className="flex items-center gap-2">
                <Sparkles className={isDark ? "text-amber-400" : "text-amber-500"} size={20} />
                <h2 className="text-lg font-semibold">Context Configuration</h2>
              </div>
              <button
                onClick={onClose}
                className={clsx("p-1.5 rounded-lg transition-colors", isDark ? "hover:bg-[#333]" : "hover:bg-gray-200")}
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">

              {/* Agent Selection */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Bot size={18} className="opacity-70" />
                  <h3 className="font-medium text-sm uppercase tracking-wider opacity-70">Agent Persona</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {chatModes.map(mode => (
                    <button
                      key={mode.id}
                      onClick={() => setLocalModeId(mode.id)}
                      className={clsx(
                        "text-left p-3 rounded-xl border transition-all duration-200 relative group",
                        localModeId === mode.id
                          ? (isDark ? "bg-[#252525] border-blue-500/50 ring-1 ring-blue-500/50" : "bg-blue-50 border-blue-200 ring-1 ring-blue-200")
                          : (isDark ? "bg-[#111] border-[#333] hover:border-[#444]" : "bg-white border-gray-200 hover:border-gray-300")
                      )}
                    >
                      <div className="font-medium mb-1">{mode.name}</div>
                      <div className="text-xs opacity-60 leading-relaxed">{mode.description}</div>
                      {localModeId === mode.id && (
                        <div className="absolute top-3 right-3 text-blue-500">
                          <Check size={16} />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Smart Context Selection */}
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <MessageSquare size={18} className="opacity-70" />
                    <h3 className="font-medium text-sm uppercase tracking-wider opacity-70">Smart Context Sources</h3>
                  </div>

                  {/* Toggle Switch */}
                  <button
                    onClick={() => setLocalEnabled(!localEnabled)}
                    className={clsx(
                      "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                      localEnabled
                        ? (isDark ? "bg-green-500/20 text-green-400" : "bg-green-100 text-green-700")
                        : (isDark ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-500")
                    )}
                  >
                    {localEnabled ? "Enabled" : "Disabled"}
                  </button>
                </div>

                <div className={clsx(
                  "border rounded-xl overflow-hidden transition-opacity duration-300",
                  !localEnabled && "opacity-50 pointer-events-none grayscale"
                )}>
                  {/* Search */}
                  <div className={clsx(
                    "px-3 py-2 border-b flex items-center gap-2",
                    isDark ? "border-[#333] bg-[#1a1a1a]" : "border-gray-200 bg-white"
                  )}>
                    <Search size={14} className="opacity-50" />
                    <input
                      type="text"
                      placeholder="Search threads..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="bg-transparent border-none outline-none text-sm w-full"
                    />
                  </div>

                  {/* Thread List */}
                  <div className={clsx(
                    "max-h-[250px] overflow-y-auto p-1 space-y-0.5",
                    isDark ? "bg-[#111]" : "bg-gray-50"
                  )}>
                    {filteredThreads.length === 0 ? (
                      <div className="p-4 text-center text-sm opacity-50">No threads found</div>
                    ) : (
                      filteredThreads.map(thread => (
                        <button
                          key={thread.id}
                          onClick={() => toggleThread(thread.id)}
                          className={clsx(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left group",
                            localSelectedIds.includes(thread.id)
                              ? (isDark ? "bg-[#252525] text-white" : "bg-white text-black shadow-sm")
                              : (isDark ? "text-gray-400 hover:bg-[#1a1a1a]" : "text-gray-600 hover:bg-white")
                          )}
                        >
                          <div className={clsx(
                            "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                            localSelectedIds.includes(thread.id)
                              ? "bg-blue-500 border-blue-500 text-white"
                              : (isDark ? "border-gray-600 group-hover:border-gray-500" : "border-gray-300 group-hover:border-gray-400")
                          )}>
                            {localSelectedIds.includes(thread.id) && <Check size={10} />}
                          </div>
                          <span className="truncate flex-1">{thread.title}</span>
                          <span className="text-xs opacity-40 font-mono">#{thread.id}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
                <p className="text-xs opacity-50 px-1">
                  Selected threads will be used to provide context for new chats.
                </p>
              </div>

              {/* Help / Info Section */}
              <div className={clsx(
                "p-4 rounded-xl border text-sm",
                isDark ? "bg-blue-500/10 border-blue-500/20 text-blue-200" : "bg-blue-50 border-blue-100 text-blue-800"
              )}>
                <div className="flex items-center gap-2 mb-2 font-semibold">
                  <Info size={16} />
                  <span>How to use Smart Context & Agents</span>
                </div>
                <ul className="space-y-2 opacity-90 list-disc pl-4 leading-relaxed">
                  <li><strong>Agent Persona:</strong> Choose <em>General Assistant</em> for everyday tasks or <em>Professional Developer</em> for high-quality code generation and technical advice.</li>
                  <li><strong>Smart Context:</strong> Enable this to let the AI "remember" specific past conversations. Select relevant threads from the list above to give the AI context from those discussions.</li>
                  <li><strong>Tip:</strong> Use Smart Context to continue working on a project across multiple chat sessions without losing key details.</li>
                </ul>
              </div>

            </div>

            {/* Footer */}
            <div className={clsx(
              "px-6 py-4 border-t flex justify-end gap-3",
              isDark ? "border-[#333] bg-[#222]" : "border-gray-200 bg-gray-50"
            )}>
              <button
                onClick={onClose}
                className={clsx(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  isDark ? "hover:bg-[#333] text-gray-300" : "hover:bg-gray-200 text-gray-700"
                )}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-all"
              >
                Apply Changes
              </button>
            </div>

          </motion.div>
        </div >
      )
      }
    </AnimatePresence >
  );
}
