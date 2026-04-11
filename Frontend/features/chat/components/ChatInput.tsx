import { useEffect, useRef, useState } from "react";
import { Send, Mic, MessageCircle } from "lucide-react";
import { cn } from "@/utils";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
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
    if (message.trim() && !disabled) {
      onSend(message.trim());
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

    if (!SpeechRecognitionApi || disabled) {
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
    <form onSubmit={handleSubmit} className="relative">
      <div className="relative bg-gray-50 rounded-2xl border border-gray-100 focus-within:border-gray-300 focus-within:shadow-sm transition-all">
        <MessageCircle className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        <textarea
          ref={textareaRef}
          rows={1}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe symptoms"
          disabled={disabled}
          className={cn(
            "w-full resize-none bg-transparent text-sm leading-5 text-gray-900 placeholder-gray-400 outline-none",
            "pl-12 pr-24 py-2.5",
            "min-h-[40px]",
            disabled && "opacity-50"
          )}
        />
        <div className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center gap-2">
          {message.trim() && (
            <button
              type="submit"
              disabled={disabled}
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
  );
}

