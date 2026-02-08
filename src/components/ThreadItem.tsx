import { Message, MessageNode, Theme } from "../types";
import { MessageItem } from "./MessageItem";
import clsx from "clsx";
import { useState } from "react";
import { ChevronRight } from "lucide-react";

interface ThreadItemProps {
  node: MessageNode;
  depth: number;
  onRetry: () => void;
  onEdit: (id: number, content: string) => void;
  onDelete: (id: number) => void;
  onReply: (message: Message) => void;
  theme: Theme;
  availableModels: string[];
  onRegenerate: (messageId: number, model: string) => void;
  defaultModel: string;
  onArchive: (threadId: number) => void;
}

export const ThreadItem = ({ node, depth, onRetry, onEdit, onDelete, onReply, theme, availableModels, onRegenerate, defaultModel, onArchive }: ThreadItemProps) => {
  const isDark = theme === 'dark';
  const hasChildren = node.children.length > 0;
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className={clsx(
      "relative group/message",
      depth > 0 && "ml-4 md:ml-8" // Increased indentation for better visual hierarchy
    )}>
      {/* Visual Thread Line (Vertical) */}
      {depth > 0 && (
        <div className={clsx(
          "absolute top-0 bottom-0 -left-4 w-px",
          isDark ? "bg-[#2a2a2a]" : "bg-gray-200",
          // Only show line if not the last item, or handle connection logic. 
          // For simple tree, a full height line works if we control overflow or parent.
          // Better approach: Line from parent to current.
        )} />
      )}

      {/* Connector Curve for current item */}
      {depth > 0 && (
        <div className={clsx(
          "absolute top-8 -left-4 w-4 h-4 border-b border-l rounded-bl-xl",
          isDark ? "border-[#2a2a2a]" : "border-gray-200"
        )} />
      )}

      <div className={clsx(
        "relative rounded-xl border transition-all duration-200",
        isDark ? "bg-[#141414] border-[#222] hover:border-[#333]" : "bg-white border-gray-100 hover:border-gray-200"
      )}>
        <MessageItem
          message={node}
          isLast={false}
          onRetry={onRetry}
          onEdit={onEdit}
          onDelete={onDelete}
          onReply={onReply}
          theme={theme}
          replyToMessage={undefined}
          availableModels={availableModels}
          onRegenerate={onRegenerate}
          defaultModel={defaultModel}
          onCollapse={() => setIsCollapsed(!isCollapsed)}
          isCollapsed={isCollapsed}
          hasChildren={hasChildren}
        />
      </div>

      {/* Render Children */}
      {hasChildren && !isCollapsed && (
        <div className="mt-2 space-y-2 relative">
          {/* Vertical line for children context */}
          <div className={clsx(
            "absolute top-0 bottom-0 left-4 md:left-4 w-px",
            isDark ? "bg-[#2a2a2a]" : "bg-gray-200"
          )} />

          {node.children.map(child => (
            <ThreadItem
              key={child.id}
              node={child}
              depth={depth + 1}
              onRetry={onRetry}
              onEdit={onEdit}
              onDelete={onDelete}
              onReply={onReply}
              theme={theme}
              availableModels={availableModels}
              onRegenerate={onRegenerate}
              defaultModel={defaultModel}
              onArchive={onArchive}
            />
          ))}
        </div>
      )}
      
      {hasChildren && isCollapsed && (
        <button 
          onClick={() => setIsCollapsed(false)}
          className={clsx(
            "mt-2 ml-4 flex items-center gap-2 text-xs font-medium px-2 py-1 rounded transition-colors",
            isDark ? "text-gray-500 hover:text-gray-300 hover:bg-white/5" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          )}
        >
          <ChevronRight size={14} />
          <span>{node.children.length} replies collapsed</span>
        </button>
      )}
    </div>
  );
};
