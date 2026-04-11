import { cn } from "@/utils";
import { Activity } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface ChatMessageProps {
  content: string;
  isUser: boolean;
  timestamp?: string;
}

export function ChatMessage({ content, isUser, timestamp }: ChatMessageProps) {
  return (
    <div
      className={cn(
        "flex gap-3",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-gray-900" : "bg-black"
        )}
      >
        {isUser ? (
          <span className="text-xs font-medium text-white">You</span>
        ) : (
          <Activity className="h-4 w-4 text-white" />
        )}
      </div>

      {/* Message */}
      <div className={cn("max-w-[80%] space-y-1", isUser && "text-right")}>
        <div
          className={cn(
            "inline-block px-4 py-3 rounded-2xl shadow-sm",
            isUser
              ? "bg-gray-900 text-white rounded-br-md"
              : "bg-white text-gray-900 rounded-bl-md border border-gray-200 shadow-md"
          )}
        >
          {isUser ? (
            <p className="text-sm whitespace-pre-wrap">{content}</p>
          ) : (
            <div className="text-sm prose prose-sm max-w-none">
              <ReactMarkdown
                components={{
                  // Style headings
                  h1: ({ node, ...props }) => (
                    <h1 className="text-base font-bold mb-2 mt-3 text-gray-900" {...props} />
                  ),
                  h2: ({ node, ...props }) => (
                    <h2 className="text-sm font-semibold mb-2 mt-2 text-gray-800" {...props} />
                  ),
                  h3: ({ node, ...props }) => (
                    <h3 className="text-sm font-medium mb-1 mt-2 text-gray-800" {...props} />
                  ),
                  // Style paragraphs
                  p: ({ node, ...props }) => (
                    <p className="mb-2 last:mb-0 leading-relaxed text-gray-700" {...props} />
                  ),
                  // Style lists
                  ul: ({ node, ...props }) => (
                    <ul className="list-disc pl-4 mb-2 space-y-1 text-gray-700" {...props} />
                  ),
                  ol: ({ node, ...props }) => (
                    <ol className="list-decimal pl-4 mb-2 space-y-1 text-gray-700" {...props} />
                  ),
                  li: ({ node, ...props }) => (
                    <li className="leading-relaxed" {...props} />
                  ),
                  // Style code blocks
                  code: ({ node, inline, ...props }: any) =>
                    inline ? (
                      <code
                        className="bg-gray-100 text-pink-600 px-1.5 py-0.5 rounded text-xs font-mono"
                        {...props}
                      />
                    ) : (
                      <code
                        className="block bg-gray-50 p-2 rounded text-xs font-mono overflow-x-auto border border-gray-200"
                        {...props}
                      />
                    ),
                  // Style blockquotes
                  blockquote: ({ node, ...props }) => (
                    <blockquote
                      className="border-l-4 border-blue-400 pl-3 py-1 my-2 italic text-gray-600 bg-blue-50"
                      {...props}
                    />
                  ),
                  // Style strong/bold text
                  strong: ({ node, ...props }) => (
                    <strong className="font-semibold text-gray-900" {...props} />
                  ),
                  // Style links
                  a: ({ node, ...props }) => (
                    <a
                      className="text-blue-600 hover:text-blue-700 underline"
                      target="_blank"
                      rel="noopener noreferrer"
                      {...props}
                    />
                  ),
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>
        {timestamp && (
          <p className="text-xs text-gray-500 px-1">{timestamp}</p>
        )}
      </div>
    </div>
  );
}

