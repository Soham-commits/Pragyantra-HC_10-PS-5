import { useState, useEffect } from "react";
import { X, Plus, MessageCircle, Calendar, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils";

interface ChatSession {
  session_id: string;
  started_at: string;
  last_message_at: string;
  message_count: number;
  preview: string;
  symptoms: string[];
}

interface ChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentSessionId: string;
  onSessionSelect: (sessionId: string) => void;
  onNewChat: () => void;
}

export function ChatSidebar({
  isOpen,
  onClose,
  currentSessionId,
  onSessionSelect,
  onNewChat,
}: ChatSidebarProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchSessions();
    }
  }, [isOpen]);

  const fetchSessions = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/patient/chat/sessions?limit=20", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSessions(data);
      }
    } catch (error) {
      console.error("Error fetching chat sessions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0 || diffDays === 1) {
      return "Today";
    } else if (diffDays === 2) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }
  };

  const handleNewChat = () => {
    onNewChat();
    onClose();
  };

  const handleSessionClick = (sessionId: string) => {
    if (sessionId !== currentSessionId) {
      onSessionSelect(sessionId);
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Sidebar */}
      <div
        className={cn(
          "fixed top-0 left-0 h-full w-80 bg-white shadow-2xl z-50 transition-transform duration-300 ease-out flex flex-col",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-purple-50">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Chat History</h2>
            <p className="text-xs text-gray-600 mt-0.5">Your conversations with Mira</p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full hover:bg-white/60 flex items-center justify-center transition-colors"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-4 border-b border-gray-200">
          <Button
            onClick={handleNewChat}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            <Plus className="h-5 w-5 mr-2" />
            New Chat
          </Button>
        </div>

        {/* Sessions List */}
        <ScrollArea className="flex-1 px-4 py-2">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400 mb-3" />
              <p className="text-sm text-gray-500">Loading chats...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <MessageCircle className="h-12 w-12 text-gray-300 mb-3" />
              <h3 className="font-medium text-gray-900 mb-1">No chat history</h3>
              <p className="text-sm text-gray-500">
                Start a new conversation with Mira
              </p>
            </div>
          ) : (
            <div className="space-y-2 pb-4">
              {sessions.map((session) => (
                <button
                  key={session.session_id}
                  onClick={() => handleSessionClick(session.session_id)}
                  className={cn(
                    "w-full text-left p-3 rounded-xl transition-all hover:bg-gray-50 border-2",
                    session.session_id === currentSessionId
                      ? "bg-blue-50 border-blue-200 shadow-sm"
                      : "bg-white border-gray-100 hover:border-gray-200"
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <MessageCircle
                        className={cn(
                          "h-4 w-4 shrink-0",
                          session.session_id === currentSessionId
                            ? "text-blue-600"
                            : "text-gray-400"
                        )}
                      />
                      <span
                        className={cn(
                          "text-xs font-medium",
                          session.session_id === currentSessionId
                            ? "text-blue-900"
                            : "text-gray-900"
                        )}
                      >
                        {formatDate(session.last_message_at)}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs",
                        session.session_id === currentSessionId
                          ? "bg-blue-100 text-blue-700 border-blue-200"
                          : "bg-gray-100 text-gray-600 border-gray-200"
                      )}
                    >
                      {session.message_count} msg
                    </Badge>
                  </div>

                  <p className="text-sm text-gray-700 line-clamp-2 mb-2">
                    {session.preview}
                  </p>

                  {session.symptoms.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {session.symptoms.slice(0, 2).map((symptom, idx) => (
                        <span
                          key={idx}
                          className={cn(
                            "text-xs px-2 py-0.5 rounded-full",
                            session.session_id === currentSessionId
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-100 text-gray-600"
                          )}
                        >
                          {symptom}
                        </span>
                      ))}
                      {session.symptoms.length > 2 && (
                        <span
                          className={cn(
                            "text-xs px-2 py-0.5 rounded-full",
                            session.session_id === currentSessionId
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-100 text-gray-600"
                          )}
                        >
                          +{session.symptoms.length - 2}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <p className="text-xs text-gray-500 text-center">
            Your conversations are private and secure
          </p>
        </div>
      </div>
    </>
  );
}

