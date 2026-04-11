import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation as useRouterLocation } from "react-router-dom";
import { ChatMessage } from "@/features/chat/components/ChatMessage";
import { ChatInput } from "@/features/chat/components/ChatInput";
import { TypingIndicator } from "@/features/chat/components/TypingIndicator";
import { ReportPromptCard } from "@/features/chat/components/ReportPromptCard";
import { HospitalPromptCard } from "@/features/chat/components/HospitalPromptCard";
import { HospitalRecommendations } from "@/features/chat/components/HospitalRecommendations";
import { ChatSidebar } from "@/features/chat/components/ChatSidebar";
import { FloatingNav } from "@/layouts/FloatingNav";
import { ArrowLeft, Menu, Activity, MapPin, FileText, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "@/store/LocationContext";
import { locationApi } from "@/services/api";

interface Hospital {
  hospital_id: string;
  name: string;
  distance_km: number;
  address: string;
  phone?: string;
  specializations?: string[];
  has_required_specialization?: boolean;
  emergency_available?: boolean;
  rating?: number;
  estimated_travel_time?: string;
  google_maps_url: string;
  latitude?: number;
  longitude?: number;
}

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: string;
  sessionId?: string;
  shouldOfferReport?: boolean;
  shouldOfferHospitals?: boolean;
  detectedSymptoms?: string[];
  severityLevel?: string;
  hospitals?: Hospital[];
  hospitalRecommendationReason?: string;
}

const quickActions = [
  {
    id: 1,
    icon: Activity,
    question: "Help me understand my recent lung or skin scan results.",
  },
  {
    id: 2,
    icon: MapPin,
    question: "Find nearby hospitals and specialists for my symptoms.",
  },
  {
    id: 3,
    icon: FileText,
    question: "Generate a comprehensive health report from my medical history.",
  },
  {
    id: 4,
    icon: Stethoscope,
    question: "I have some symptoms. Can you assess them and provide recommendations?",
  },
];

const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const initialMessages: Message[] = [];

// API call to backend chatbot
const getAIResponse = async (
  userMessage: string,
  sessionId: string,
  userLocation: { latitude: number; longitude: number } | null
): Promise<{
  response: string;
  sessionId?: string;
  shouldOfferReport?: boolean;
  shouldOfferHospitals?: boolean;
  detectedSymptoms?: string[];
  severityLevel?: string;
  hospitals?: Hospital[];
  hospitalRecommendationReason?: string;
}> => {
  try {
    const token = localStorage.getItem("token");

    const response = await fetch("/api/patient/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        message: userMessage,
        session_id: sessionId,
        location: userLocation,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      response: data.response || "I'm having trouble processing that. Could you try again?",
      sessionId: data.session_id,
      shouldOfferReport: data.should_offer_report,
      shouldOfferHospitals: data.should_offer_hospitals,
      detectedSymptoms: data.detected_symptoms,
      severityLevel: data.severity_level,
      hospitals: data.hospitals,
      hospitalRecommendationReason: data.hospital_recommendation_reason,
    };
  } catch (error) {
    console.error("Chat API error:", error);
    return {
      response: "I'm having trouble connecting right now. Please try again in a moment.",
    };
  }
};

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isTyping, setIsTyping] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [sessionId, setSessionId] = useState<string>(() => `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const routerLocation = useRouterLocation();
  const hasProcessedInitialMessage = useRef(false);
  const hasProcessedNewChat = useRef(false);

  // Track whether the user has dismissed report/hospital offers in this session
  // so we don't keep re-showing them on every new message
  const reportDismissedRef = useRef(false);
  const hospitalsDismissedRef = useRef(false);

  // Use location context
  const { location: userLocation, requestLocation, hasPermission } = useLocation();

  // Helper: detect if the user is explicitly asking for hospitals
  const isExplicitHospitalRequest = (text: string): boolean => {
    const lower = text.toLowerCase();
    const hospitalPatterns = [
      "nearby hospital", "near hospital", "find hospital", "show hospital",
      "recommend hospital", "suggest hospital", "closest hospital",
      "nearest hospital", "hospital near", "hospitals near",
      "find a hospital", "find me a hospital", "tell me nearby hospital",
      "where is the nearest hospital", "hospital recommendation",
      "nearby clinic", "nearest clinic", "find clinic",
      "need a doctor", "need a hospital", "where can i go",
      "healthcare facilit", "medical center near",
    ];
    return hospitalPatterns.some((p) => lower.includes(p));
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Load most recent chat session on mount unless a new chat is requested
  useEffect(() => {
    const state = routerLocation.state as { initialMessage?: string; newChat?: boolean } | null;
    if (state?.newChat) {
      setIsLoadingHistory(false);
      return;
    }
    const loadRecentSession = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch("/api/patient/chat/sessions?limit=1", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const sessions = await response.json();
          if (sessions.length > 0) {
            const recentSession = sessions[0];
            setSessionId(recentSession.session_id);

            // Load messages from this session
            const messagesResponse = await fetch(
              `/api/patient/chat/session/${recentSession.session_id}`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }
            );

            if (messagesResponse.ok) {
              const sessionData = await messagesResponse.json();
              const loadedMessages: Message[] = [];

              sessionData.messages.forEach((msg: any, index: number) => {
                loadedMessages.push({
                  id: `${Date.now()}-${index}-user`,
                  content: msg.user_message,
                  isUser: true,
                  timestamp: new Date(msg.timestamp).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  }),
                });
                loadedMessages.push({
                  id: `${Date.now()}-${index}-ai`,
                  content: msg.ai_response,
                  isUser: false,
                  timestamp: new Date(msg.timestamp).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  }),
                  detectedSymptoms: msg.detected_symptoms,
                  severityLevel: msg.severity_level,
                });
              });

              if (loadedMessages.length > 0) {
                setMessages(loadedMessages);
                setShowWelcome(false);
              }
            }
          }
        }
      } catch (error) {
        console.error("Error loading chat history:", error);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadRecentSession();
  }, [routerLocation.state]);

  // Handle initial message from navigation
  useEffect(() => {
    const state = routerLocation.state as { initialMessage?: string; newChat?: boolean } | null;

    if (state?.newChat && !hasProcessedNewChat.current && !isLoadingHistory) {
      hasProcessedNewChat.current = true;
      const newSessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      setMessages([]);
      setShowWelcome(true);
      setSessionId(newSessionId);
      reportDismissedRef.current = false;
      hospitalsDismissedRef.current = false;

      if (state.initialMessage) {
        handleSendMessage(state.initialMessage, newSessionId);
      }

      window.history.replaceState({}, document.title);
      return;
    }

    if (state?.initialMessage && !hasProcessedInitialMessage.current && !isLoadingHistory) {
      hasProcessedInitialMessage.current = true;
      handleSendMessage(state.initialMessage);
      window.history.replaceState({}, document.title);
    }
  }, [routerLocation, isLoadingHistory]);

  const handleSendMessage = async (content: string, overrideSessionId?: string) => {
    setShowWelcome(false);

    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      isUser: true,
      timestamp: "Just now",
    };

    // Clear any existing report/hospital offers from previous messages
    // so they don't stack up
    setMessages((prev) =>
      prev.map((msg) => ({
        ...msg,
        shouldOfferReport: false,
        shouldOfferHospitals: false,
      }))
    );

    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    // Check if the user is explicitly asking for hospitals
    const userWantsHospitals = isExplicitHospitalRequest(content);

    // Call backend AI chatbot with location
    const activeSessionId = overrideSessionId || sessionId;
    const aiResponseData = await getAIResponse(content, activeSessionId, userLocation);
    if (aiResponseData.sessionId && aiResponseData.sessionId !== activeSessionId) {
      setSessionId(aiResponseData.sessionId);
    }

    // Respect previous dismissals: don't re-show offers the user already declined
    const shouldShowReport =
      aiResponseData.shouldOfferReport === true && !reportDismissedRef.current;
    const shouldShowHospitals =
      (aiResponseData.shouldOfferHospitals === true && !hospitalsDismissedRef.current);

    const aiResponse: Message = {
      id: (Date.now() + 1).toString(),
      content: aiResponseData.response,
      isUser: false,
      timestamp: "Just now",
      sessionId: aiResponseData.sessionId || activeSessionId,
      shouldOfferReport: shouldShowReport,
      shouldOfferHospitals: shouldShowHospitals,
      detectedSymptoms: aiResponseData.detectedSymptoms,
      severityLevel: aiResponseData.severityLevel,
      hospitals: aiResponseData.hospitals,
      hospitalRecommendationReason: aiResponseData.hospitalRecommendationReason,
    };

    setIsTyping(false);
    setMessages((prev) => [...prev, aiResponse]);

    // If user explicitly asked for hospitals, auto-fetch them via OSM
    if (userWantsHospitals && userLocation) {
      try {
        const osmResults = await locationApi.getNearbyHospitals(
          userLocation.latitude,
          userLocation.longitude,
          5000
        );

        // Map OSM results to the Hospital shape
        const hospitals: Hospital[] = osmResults
          .map((h, idx) => {
            const distanceKm = Math.round(
              haversineKm(
                userLocation.latitude,
                userLocation.longitude,
                h.latitude,
                h.longitude
              ) * 10
            ) / 10;
            return {
              hospital_id: `osm-${h.latitude}-${h.longitude}-${idx}`,
              name: h.hospital_name,
              distance_km: distanceKm,
              address: h.address,
              phone: "",
              specializations: [],
              has_required_specialization: false,
              emergency_available: false,
              estimated_travel_time: `${Math.max(1, Math.round(distanceKm * 3))} mins`,
              google_maps_url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                `${h.hospital_name} ${h.latitude},${h.longitude}`
              )}`,
              latitude: h.latitude,
              longitude: h.longitude,
            };
          })
          .sort((a, b) => a.distance_km - b.distance_km);

        if (hospitals.length > 0) {
          handleHospitalsRequested(aiResponse.id, hospitals);
        }
      } catch (error) {
        console.error("Error auto-fetching hospitals:", error);
      }
    } else if (userWantsHospitals && !userLocation) {
      // Show an inline message that location is needed
      const locationMsg: Message = {
        id: (Date.now() + 2).toString(),
        content: "To find nearby hospitals, I need access to your location. Please enable location access using the banner at the top of the chat.",
        isUser: false,
        timestamp: "Just now",
      };
      setMessages((prev) => [...prev, locationMsg]);
    }
  };

  const handleHospitalsRequested = (messageId: string, hospitals: Hospital[]) => {
    // Update the specific message with the fetched hospitals
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId
          ? { ...msg, hospitals, shouldOfferHospitals: false }
          : msg
      )
    );
  };

  const handleQuickAction = (question: string) => {
    handleSendMessage(question);
  };

  const handleNewChat = () => {
    setMessages([]);
    setShowWelcome(true);
    setSessionId(`session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    // Reset dismissal tracking for the new session
    reportDismissedRef.current = false;
    hospitalsDismissedRef.current = false;
  };

  const handleSessionSelect = async (selectedSessionId: string) => {
    setIsLoadingHistory(true);
    setSessionId(selectedSessionId);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `/api/patient/chat/session/${selectedSessionId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const sessionData = await response.json();
        const loadedMessages: Message[] = [];

        sessionData.messages.forEach((msg: any, index: number) => {
          loadedMessages.push({
            id: `${Date.now()}-${index}-user`,
            content: msg.user_message,
            isUser: true,
            timestamp: new Date(msg.timestamp).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            }),
          });
          loadedMessages.push({
            id: `${Date.now()}-${index}-ai`,
            content: msg.ai_response,
            isUser: false,
            timestamp: new Date(msg.timestamp).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            }),
            detectedSymptoms: msg.detected_symptoms,
            severityLevel: msg.severity_level,
          });
        });

        setMessages(loadedMessages);
        setShowWelcome(loadedMessages.length === 0);
      }
    } catch (error) {
      console.error("Error loading session:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex flex-col pb-24">
      {/* Chat Sidebar */}
      <ChatSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        currentSessionId={sessionId}
        onSessionSelect={handleSessionSelect}
        onNewChat={handleNewChat}
      />

      {/* Fixed Header with Menu and Back buttons */}
      <div className="fixed top-0 left-0 right-0 z-30 bg-gradient-to-b from-gray-50 via-gray-50/95 to-transparent backdrop-blur-sm">
        <div className="max-w-md md:max-w-6xl lg:max-w-7xl mx-auto px-6 md:px-8 lg:px-10 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="h-12 w-12 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm"
              aria-label="Open chat history"
            >
              <Menu className="h-5 w-5 text-gray-700" />
            </button>
            <button
              onClick={() => navigate("/")}
              className="h-12 w-12 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5 text-gray-700" />
            </button>
          </div>
        </div>

        {/* Location Status Banner */}
        {!userLocation && (
          <div className="max-w-md md:max-w-6xl lg:max-w-7xl mx-auto px-6 md:px-8 lg:px-10 pb-3">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-amber-600 flex-shrink-0" />
              <p className="text-xs text-amber-800 flex-1">
                Location disabled. Enable it to see nearby hospitals.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={requestLocation}
                className="h-7 text-xs border-amber-300 hover:bg-amber-100"
              >
                Enable
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Main Content with top padding to account for fixed header */}
      <div className="pt-24">
        {showWelcome && messages.length === 0 ? (
          /* Welcome Screen */
          <div className="flex-1 px-5 pt-28 pb-8 flex flex-col">
            {/* Welcome Text */}
            <div className="mb-8">
              <h1 className="text-4xl font-bold text-gray-900 mb-3">Hi, I'm Mira</h1>
              <p className="text-gray-600 text-base">
                Your AI health companion. Ask me about symptoms, medications, or health concerns.
              </p>
            </div>

            {/* Quick Action Cards */}
            <div className="grid grid-cols-2 gap-4 mb-auto">
              {quickActions.map((action, index) => {
                const Icon = action.icon;
                const gradients = [
                  "bg-gradient-to-br from-blue-50/80 via-purple-50/50 to-pink-50/80",
                  "bg-gradient-to-br from-pink-50/80 via-purple-50/50 to-blue-50/80",
                  "bg-gradient-to-br from-purple-50/80 via-blue-50/50 to-pink-50/80",
                  "bg-gradient-to-br from-blue-50/70 via-pink-50/50 to-purple-50/70"
                ];
                return (
                  <button
                    key={action.id}
                    onClick={() => handleQuickAction(action.question)}
                    className={`${gradients[index]} rounded-3xl p-5 shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all text-left`}
                  >
                    <div className="h-12 w-12 rounded-2xl bg-white/60 backdrop-blur-sm flex items-center justify-center mb-4">
                      <Icon className="h-6 w-6 text-gray-700" />
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{action.question}</p>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* Chat Messages */
          <div className="flex-1 overflow-y-auto px-5 pt-24 pb-4 space-y-4">
            {messages.map((message) => (
              <div key={message.id} className="space-y-3">
                <ChatMessage
                  content={message.content}
                  isUser={message.isUser}
                  timestamp={message.timestamp}
                />
                {!message.isUser && message.shouldOfferHospitals && (
                  <HospitalPromptCard
                    detectedSymptoms={message.detectedSymptoms}
                    severityLevel={message.severityLevel}
                    reason={message.hospitalRecommendationReason}
                    location={userLocation}
                    onHospitalsRequested={(hospitals) => handleHospitalsRequested(message.id, hospitals)}
                    onDismiss={() => {
                      // Remember that the user dismissed the hospital offer
                      hospitalsDismissedRef.current = true;
                      setMessages((prevMessages) =>
                        prevMessages.map((msg) =>
                          msg.id === message.id
                            ? { ...msg, shouldOfferHospitals: false }
                            : msg
                        )
                      );
                    }}
                  />
                )}
                {!message.isUser && message.hospitals && message.hospitals.length > 0 && (
                  <HospitalRecommendations
                    hospitals={message.hospitals}
                    reason={message.hospitalRecommendationReason}
                    severityLevel={message.severityLevel}
                  />
                )}
                {!message.isUser && message.shouldOfferReport && (
                  <ReportPromptCard
                    sessionId={message.sessionId || sessionId}
                    detectedSymptoms={message.detectedSymptoms}
                    severityLevel={message.severityLevel}
                    onReportGenerated={(reportId) => {
                      console.log("Report generated:", reportId);
                      // After generating a report, don't offer again
                      reportDismissedRef.current = true;
                    }}
                    onDismiss={() => {
                      // Remember that the user dismissed the report offer
                      reportDismissedRef.current = true;
                      setMessages((prevMessages) =>
                        prevMessages.map((msg) =>
                          msg.id === message.id
                            ? { ...msg, shouldOfferReport: false }
                            : msg
                        )
                      );
                    }}
                  />
                )}
              </div>
            ))}
            {isTyping && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area - Now handled by transformed FloatingNav */}
      <FloatingNav onChatSend={handleSendMessage} chatDisabled={isTyping} />
    </div>
  );
}

