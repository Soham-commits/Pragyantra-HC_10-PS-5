import { Home, MessageCircle, FileText, Scan, User, Mic, Send } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/utils";
import { useEffect, useRef, useState } from "react";
import { MediqIcon } from "@/components/ui/MediqIcon";
import { useTranslation } from "react-i18next";

interface FloatingNavProps {
  onChatSend?: (message: string) => void;
  chatDisabled?: boolean;
}

export function FloatingNav({ onChatSend, chatDisabled }: FloatingNavProps = {}) {
  const { t } = useTranslation();
  const navItems = [
    { label: t('nav.home'), path: "/", icon: Home },
    { label: t('nav.scan'), path: "/scan", icon: Scan },
    { label: t('nav.chat'), path: "/chat", icon: MessageCircle, isKey: true },
    { label: t('nav.reports'), path: "/reports", icon: FileText },
    { label: t('nav.profile'), path: "/profile", icon: User },
  ];
  const location = useLocation();
  const navigate = useNavigate();
  const isOnChatPage = location.pathname === "/chat";
  const [message, setMessage] = useState("");
  const [isListening, setIsListening] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const maxLines = 8;

  const resizeTextarea = () => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    const styles = window.getComputedStyle(textarea);
    const lineHeight = Number.parseFloat(styles.lineHeight || "20");
    const paddingTop = Number.parseFloat(styles.paddingTop || "0");
    const paddingBottom = Number.parseFloat(styles.paddingBottom || "0");
    const maxHeight = lineHeight * maxLines + paddingTop + paddingBottom;

    textarea.style.height = "auto";
    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  };

  useEffect(() => {
    resizeTextarea();
  }, [message]);

  const handleSend = () => {
    if (message.trim() && !chatDisabled && onChatSend) {
      onChatSend(message.trim());
      setMessage("");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleVoiceClick = () => {
    const SpeechRecognitionApi =
      (window as unknown as { SpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;

    if (!SpeechRecognitionApi || chatDisabled) {
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SpeechRecognitionApi();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      setMessage(transcript);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    setIsListening(true);
    recognition.start();
  };

  return (
    <div 
      className={cn(
        "fixed left-1/2 -translate-x-1/2 z-50 transition-all duration-700 ease-in-out",
        isOnChatPage ? "bottom-6 w-[calc(100%-2.5rem)] max-w-md" : "bottom-5 w-auto"
      )}
    >
      <div className={cn(
        "rounded-full shadow-lg border transition-all duration-700 ease-in-out overflow-hidden",
        isOnChatPage 
          ? "bg-gray-50 border-gray-100 rounded-2xl" 
          : "bg-white border-gray-100 px-4 py-2"
      )}>
        <div className={cn(
          "flex items-center transition-all duration-700 ease-in-out",
          isOnChatPage ? "gap-0" : "gap-2"
        )}>
          {/* Navigation Items - fade out on chat page */}
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            const isChatIcon = item.path === "/chat";
            
            return (
              isChatIcon ? (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => navigate("/chat", { state: { newChat: true } })}
                  className={cn(
                    "flex items-center justify-center rounded-full transition-all duration-500 p-0",
                    isOnChatPage && "opacity-0 w-0 p-0 pointer-events-none overflow-hidden"
                  )}
                  aria-label={item.label}
                >
                  <MediqIcon
                    className="h-14 w-14 min-h-[56px] min-w-[56px] rounded-full block"
                  />
                </button>
              ) : (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center justify-center rounded-full transition-all duration-500",
                    " p-3 ",
                    isActive && "text-gray-900",
                    !isActive && "text-gray-400 hover:text-gray-700 hover:bg-gray-100",
                    isOnChatPage && "opacity-0 w-0 p-0 pointer-events-none overflow-hidden"
                  )}
                  aria-label={item.label}
                >
                  <Icon className="h-6 w-6" />
                </Link>
              )
            );
          })}
          
          {/* Chat Input - fade in on chat page with home page design */}
          {isOnChatPage && (
            <form onSubmit={handleSubmit} className="flex-1 animate-in fade-in duration-700">
              <div className="relative px-5 py-4">
                <MessageCircle className="pointer-events-none absolute left-9 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('chat.describe_symptoms')}
                  disabled={chatDisabled}
                  className={cn(
                    "w-full resize-none bg-transparent text-sm leading-5 text-gray-900 placeholder-gray-400 outline-none",
                    "pl-12 pr-24 py-2.5",
                    "min-h-[40px]",
                    chatDisabled && "opacity-50"
                  )}
                />
                <div className="absolute right-9 top-1/2 flex -translate-y-1/2 items-center gap-2">
                  {message.trim() && (
                    <button
                      type="submit"
                      disabled={chatDisabled}
                      className="bg-gray-900 hover:bg-gray-800 text-white p-3 rounded-full transition-all animate-in fade-in zoom-in duration-200"
                      aria-label="Send message"
                    >
                      <Send className="h-5 w-5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleVoiceClick}
                    className={cn(
                      "bg-gray-900 hover:bg-gray-800 text-white p-3 rounded-full transition-colors",
                      isListening && "ring-2 ring-gray-400"
                    )}
                    aria-label="Voice chat"
                    aria-pressed={isListening}
                  >
                    <Mic className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

