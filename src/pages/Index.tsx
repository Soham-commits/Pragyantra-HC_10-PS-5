import { FloatingNav } from "@/layouts/FloatingNav";
import { Footer } from "@/layouts/Footer";
import { MessageCircle, Mic, Bell, Heart, Star, Award, Activity, Droplet, Scan, FileText, Send, Thermometer, Pill, Brain, Stethoscope, HeartPulse, LogOut, IdCard, Cake, BookOpen, HelpCircle, Newspaper, Eye, Ear, Bone, Zap, Wind, Apple, Shield, CheckCircle, X, CalendarCheck, Wallet } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useEffect, useState, useRef } from "react";
import { MediqIcon } from "@/components/ui/MediqIcon";
import { PatientReferrals } from "@/features/dashboard/components/PatientReferrals";
import { HealthChain } from "@/components/dashboard/HealthChain";
import { fetchWithAuth } from "@/services/api";
import { cn } from "@/utils";
import { Avatar as UserAvatar } from "@/components/Avatar";

const quickAiChats = [
  { name: "Check Symptoms", icon: Stethoscope, prompt: "I have some symptoms I'd like to discuss" },
  { name: "Medication Info", icon: Pill, prompt: "I need information about my medication" },
  { name: "Mental Health", icon: Brain, prompt: "I'd like to talk about mental health" },
  { name: "Heart Health", icon: HeartPulse, prompt: "I have questions about heart health" },
  { name: "Fever & Cold", icon: Thermometer, prompt: "I'm experiencing fever or cold symptoms" },
];

const specialists = [
  {
    id: 1,
    name: "Dr. Sarah Johnson",
    specialty: "Cardiologist",
    price: 150,
    rating: 4.9,
    patients: "2000+",
    credentials: ["MBBS", "MD Cardiology"],
    online: true,
    image: null,
  },
  {
    id: 2,
    name: "Dr. Michael Chen",
    specialty: "Neurologist",
    price: 180,
    rating: 4.8,
    patients: "1800+",
    credentials: ["MBBS", "DM Neurology"],
    online: true,
    image: null,
  },
];

interface UserProfile {
  health_id: string;
  full_name: string;
  email: string;
  onboarded: boolean;
  phone?: string;
  date_of_birth?: string;
  age?: number;
  gender?: string;
  height?: number;
  weight?: number;
  blood_group?: string;
  allergies?: string;
  chronic_conditions?: string;
  current_medications?: string;
}

const Index = () => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const currentHour = new Date().getHours();
  const greeting =
    currentHour >= 0 && currentHour < 5 ? "Good Night" :
      currentHour >= 5 && currentHour < 12 ? "Good Morning" :
        currentHour >= 12 && currentHour < 18 ? "Good Afternoon" :
          "Good Evening";

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          console.error('No token found');
          setLoading(false);
          return;
        }

        const response = await fetch('/api/auth/profile', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch profile');
        }

        const data = await response.json();
        setUserProfile(data);

        // Fetch notifications
        const notificationsResponse = await fetchWithAuth(`/api/notifications/patient/${data.health_id}`);
        if (notificationsResponse.ok) {
          const notificationsData = await notificationsResponse.json();
          setNotifications(notificationsData.notifications || []);
          setUnreadCount(notificationsData.unread_count || 0);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('health_id');
    localStorage.removeItem('doctor_id');
    localStorage.removeItem('role');
    localStorage.removeItem('onboarded');
    navigate('/login');
  };

  // Mark notifications as read when dropdown opens
  const markNotificationsRead = async () => {
    if (unreadCount > 0 && userProfile?.health_id) {
      try {
        await fetchWithAuth(`/api/notifications/patient/${userProfile.health_id}/mark-all-read`, {
          method: 'POST'
        });
        setUnreadCount(0);
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      } catch (e) {
        console.warn('Failed to mark notifications as read');
      }
    }
  };

  // Handle notification bell click
  const handleNotificationClick = () => {
    setShowNotifications(!showNotifications);
    if (!showNotifications) {
      markNotificationsRead();
    }
  };

  // Click outside to close notifications
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your health dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      <FloatingNav />

      <main className="max-w-md md:max-w-6xl lg:max-w-7xl mx-auto px-5 md:px-8 lg:px-10 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link to="/" className="flex items-center gap-2">
            <MediqIcon className="h-10 w-10 rounded-full" />
            <span className="text-lg font-semibold text-gray-900">MediQ</span>
          </Link>
          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            <div ref={notificationRef} className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 hover:bg-gray-100 rounded-full relative"
                onClick={handleNotificationClick}
                title="Notifications"
              >
                <Bell className="h-5 w-5 text-gray-700" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Button>

              {/* Notification Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50 max-h-96 overflow-y-auto">
                  <div className="p-3 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900">Notifications</h3>
                  </div>
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      No notifications
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {notifications.slice(0, 5).map((notification) => (
                        <div
                          key={notification.notification_id}
                          className={`p-3 hover:bg-gray-50 ${!notification.is_read ? 'bg-blue-50/50' : ''}`}
                        >
                          <p className="text-sm text-gray-800">{notification.message}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(notification.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <UserAvatar name={userProfile?.full_name} role="patient" seed={userProfile?.health_id} size="md" />
            <Link to="/profile" title="Wallet">
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 hover:bg-emerald-100 rounded-full"
                aria-label="Open wallet"
              >
                <Wallet className="h-5 w-5 text-emerald-700" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 hover:bg-red-100 rounded-full"
              onClick={handleLogout}
              title="Sign Out"
            >
              <LogOut className="h-5 w-5 text-gray-700 hover:text-red-600" />
            </Button>
          </div>
        </div>

        {/* Greeting + Summary */}
        <section className="mb-8">
          <div className="mb-6">
            <h1 className="text-4xl font-bold text-gray-900 md:text-5xl">
              {greeting}
            </h1>
            <h2 className="mt-1 text-4xl font-bold text-gray-900 md:text-5xl">
              {userProfile?.full_name?.split(' ')[0] || 'User'}
            </h2>
          </div>

          {userProfile?.onboarded && (
            <div className="flex flex-wrap gap-2">
              {/* Health ID */}
              <div className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1.5 shadow-sm">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                  <IdCard className="h-3 w-3" />
                </div>
                <div className="min-w-0 flex flex-col">
                  <p className="text-[9px] text-gray-500">Health ID</p>
                  <p className="truncate text-[10px] font-medium text-gray-900" title={userProfile.health_id}>
                    {userProfile.health_id}
                  </p>
                </div>
              </div>

              {/* Age */}
              {userProfile.age && (
                <div className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1.5 shadow-sm">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-700">
                    <Cake className="h-3 w-3" />
                  </div>
                  <div className="min-w-0 flex flex-col">
                    <p className="text-[9px] text-gray-500">Age</p>
                    <p className="truncate text-[10px] font-medium text-gray-900">{userProfile.age} yrs</p>
                  </div>
                </div>
              )}

              {/* Blood Type */}
              {userProfile.blood_group && (
                <div className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1.5 shadow-sm">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
                    <Droplet className="h-3 w-3" />
                  </div>
                  <div className="min-w-0 flex flex-col">
                    <p className="text-[9px] text-gray-500">Blood</p>
                    <p className="truncate text-[10px] font-medium text-gray-900">{userProfile.blood_group}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Voice Search */}
        <div className="mb-5 relative">
          <form onSubmit={(e) => {
            e.preventDefault();
            if (query.trim()) {
              navigate('/chat', { state: { initialMessage: query.trim(), newChat: true } });
            }
          }} className="flex items-center justify-between bg-gray-50 rounded-2xl px-5 py-4 border border-gray-100 focus-within:border-gray-300 focus-within:shadow-sm transition-all">
            <div className="flex items-center gap-3 flex-1">
              <MessageCircle className="h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask anything about your health"
                className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              {query.trim() && (
                <button
                  type="submit"
                  className="bg-gray-900 hover:bg-gray-800 text-white p-3 rounded-full transition-all animate-in fade-in zoom-in duration-200"
                  aria-label="Send message"
                >
                  <Send className="h-5 w-5" />
                </button>
              )}
              <Link to="/chat" state={{ newChat: true }}>
                <button
                  type="button"
                  className="bg-gray-900 hover:bg-gray-800 text-white p-3 rounded-full transition-colors"
                  aria-label="Voice chat"
                >
                  <Mic className="h-5 w-5" />
                </button>
              </Link>
            </div>
          </form>
        </div>

        {/* Quick AI Chats */}
        <div className="flex gap-3 mb-4 overflow-x-auto pb-2">
          {quickAiChats.map((chat, index) => {
            const Icon = chat.icon;
            return (
              <button
                key={chat.name}
                onClick={() => navigate('/chat', { state: { initialMessage: chat.prompt, newChat: true } })}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full whitespace-nowrap transition-all bg-white text-gray-700 hover:shadow-md border border-gray-200/60 hover:border-gray-300 active:scale-95"
              >
                <div className="inline-flex p-2 rounded-full bg-gradient-to-br from-blue-50 to-purple-50">
                  <Icon className="h-4 w-4 text-blue-600" />
                </div>
                <span className="text-sm font-medium">{chat.name}</span>
              </button>
            );
          })}
        </div>

        {/* Quick Access Cards */}
        <div className="relative mb-4">
          <div aria-hidden className="absolute inset-0 rounded-3xl pointer-events-none">
            <div className="w-full h-full bg-gradient-to-r from-blue-50/40 via-transparent to-purple-50/40 blur-xl opacity-30" />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6 relative z-10">
            <Link
              to="/scan"
              className="bg-gradient-to-br from-blue-50/70 via-white to-blue-100/50 rounded-3xl p-5 hover:shadow-lg transition-all border border-blue-200/80 hover:border-blue-300 shadow-sm"
            >
              <div className="mb-3.5 inline-flex p-3.5 rounded-2xl bg-blue-50">
                <Scan className="h-6 w-6 text-blue-600" />
              </div>
              <h4 className="font-semibold text-gray-900 mb-1 text-base">Medical Scan</h4>
              <p className="text-sm text-gray-500">Upload & analyze</p>
            </Link>

            <Link
              to="/reports"
              className="bg-gradient-to-br from-purple-50/70 via-white to-purple-100/50 rounded-3xl p-5 hover:shadow-lg transition-all border border-purple-200/80 hover:border-purple-300 shadow-sm"
            >
              <div className="mb-3 inline-flex p-3 rounded-2xl bg-purple-50">
                <FileText className="h-6 w-6 text-purple-600" />
              </div>
              <h4 className="font-semibold text-gray-900 mb-1 text-base">My Reports</h4>
              <p className="text-sm text-gray-500">View history</p>
            </Link>

            <Link
              to="/book-appointment"
              className="col-span-2 bg-gradient-to-br from-emerald-50/70 via-white to-teal-100/50 rounded-3xl p-5 hover:shadow-lg transition-all border border-emerald-200/80 hover:border-emerald-300 shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="inline-flex p-3.5 rounded-2xl bg-emerald-50">
                  <CalendarCheck className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-0.5 text-base">Book Appointment</h4>
                  <p className="text-sm text-gray-500">Find doctors & book time slots</p>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Patient Referrals Section */}
        {userProfile?.health_id && (
          <>
            {console.log("ðŸ¥ Index.tsx: Rendering PatientReferrals with health_id:", userProfile.health_id)}
            <PatientReferrals patientId={userProfile.health_id} />
            <HealthChain patientId={userProfile.health_id} />
          </>
        )}

        {/* Health Concerns Section */}
        <div className="mb-8">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Common Health Concerns</h3>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => navigate('/chat', { state: { initialMessage: 'I have a headache and need advice', newChat: true } })}
              className="bg-gradient-to-br from-purple-50/50 via-white to-purple-50/30 rounded-2xl p-4 hover:shadow-lg transition-all border border-gray-200/60 hover:border-purple-300 flex flex-col items-center text-center min-w-[100px] flex-shrink-0"
            >
              <div className="mb-2 inline-flex p-3 rounded-2xl bg-purple-50">
                <Brain className="h-5 w-5 text-purple-600" />
              </div>
              <span className="text-xs font-semibold text-gray-900 whitespace-nowrap">Headache</span>
            </button>

            <button
              onClick={() => navigate('/chat', { state: { initialMessage: 'I have eye pain or vision problems', newChat: true } })}
              className="bg-gradient-to-br from-blue-50/50 via-white to-blue-50/30 rounded-2xl p-4 hover:shadow-lg transition-all border border-gray-200/60 hover:border-blue-300 flex flex-col items-center text-center min-w-[100px] flex-shrink-0"
            >
              <div className="mb-2 inline-flex p-3 rounded-2xl bg-blue-50">
                <Eye className="h-5 w-5 text-blue-600" />
              </div>
              <span className="text-xs font-semibold text-gray-900 whitespace-nowrap">Eye Pain</span>
            </button>

            <button
              onClick={() => navigate('/chat', { state: { initialMessage: 'I have stomach pain or digestive issues', newChat: true } })}
              className="bg-gradient-to-br from-orange-50/50 via-white to-orange-50/30 rounded-2xl p-4 hover:shadow-lg transition-all border border-gray-200/60 hover:border-orange-300 flex flex-col items-center text-center min-w-[100px] flex-shrink-0"
            >
              <div className="mb-2 inline-flex p-3 rounded-2xl bg-orange-50">
                <Zap className="h-5 w-5 text-orange-600" />
              </div>
              <span className="text-xs font-semibold text-gray-900 whitespace-nowrap">Stomach</span>
            </button>

            <button
              onClick={() => navigate('/chat', { state: { initialMessage: 'I have chest pain or heart concerns', newChat: true } })}
              className="bg-gradient-to-br from-red-50/50 via-white to-red-50/30 rounded-2xl p-4 hover:shadow-lg transition-all border border-gray-200/60 hover:border-red-300 flex flex-col items-center text-center min-w-[100px] flex-shrink-0"
            >
              <div className="mb-2 inline-flex p-3 rounded-2xl bg-red-50">
                <Heart className="h-5 w-5 text-red-600" />
              </div>
              <span className="text-xs font-semibold text-gray-900 whitespace-nowrap">Heart</span>
            </button>

            <button
              onClick={() => navigate('/chat', { state: { initialMessage: 'I have joint or bone pain', newChat: true } })}
              className="bg-gradient-to-br from-gray-50/50 via-white to-gray-50/30 rounded-2xl p-4 hover:shadow-lg transition-all border border-gray-200/60 hover:border-gray-300 flex flex-col items-center text-center min-w-[100px] flex-shrink-0"
            >
              <div className="mb-2 inline-flex p-3 rounded-2xl bg-gray-50">
                <Bone className="h-5 w-5 text-gray-600" />
              </div>
              <span className="text-xs font-semibold text-gray-900 whitespace-nowrap">Joint Pain</span>
            </button>

            <button
              onClick={() => navigate('/chat', { state: { initialMessage: 'I have ear pain or hearing problems', newChat: true } })}
              className="bg-gradient-to-br from-yellow-50/50 via-white to-yellow-50/30 rounded-2xl p-4 hover:shadow-lg transition-all border border-gray-200/60 hover:border-yellow-300 flex flex-col items-center text-center min-w-[100px] flex-shrink-0"
            >
              <div className="mb-2 inline-flex p-3 rounded-2xl bg-yellow-50">
                <Ear className="h-5 w-5 text-yellow-600" />
              </div>
              <span className="text-xs font-semibold text-gray-900 whitespace-nowrap">Ear Pain</span>
            </button>

            <button
              onClick={() => navigate('/chat', { state: { initialMessage: 'I have breathing difficulties or respiratory issues', newChat: true } })}
              className="bg-gradient-to-br from-cyan-50/50 via-white to-cyan-50/30 rounded-2xl p-4 hover:shadow-lg transition-all border border-gray-200/60 hover:border-cyan-300 flex flex-col items-center text-center min-w-[100px] flex-shrink-0"
            >
              <div className="mb-2 inline-flex p-3 rounded-2xl bg-cyan-50">
                <Wind className="h-5 w-5 text-cyan-600" />
              </div>
              <span className="text-xs font-semibold text-gray-900 whitespace-nowrap">Breathing</span>
            </button>

            <button
              onClick={() => navigate('/chat', { state: { initialMessage: 'I have fever or temperature concerns', newChat: true } })}
              className="bg-gradient-to-br from-rose-50/50 via-white to-rose-50/30 rounded-2xl p-4 hover:shadow-lg transition-all border border-gray-200/60 hover:border-rose-300 flex flex-col items-center text-center min-w-[100px] flex-shrink-0"
            >
              <div className="mb-2 inline-flex p-3 rounded-2xl bg-rose-50">
                <Thermometer className="h-5 w-5 text-rose-600" />
              </div>
              <span className="text-xs font-semibold text-gray-900 whitespace-nowrap">Fever</span>
            </button>

            <button
              onClick={() => navigate('/chat', { state: { initialMessage: 'I need advice about nutrition and diet', newChat: true } })}
              className="bg-gradient-to-br from-green-50/50 via-white to-green-50/30 rounded-2xl p-4 hover:shadow-lg transition-all border border-gray-200/60 hover:border-green-300 flex flex-col items-center text-center min-w-[100px] flex-shrink-0"
            >
              <div className="mb-2 inline-flex p-3 rounded-2xl bg-green-50">
                <Apple className="h-5 w-5 text-green-600" />
              </div>
              <span className="text-xs font-semibold text-gray-900 whitespace-nowrap">Nutrition</span>
            </button>

            <button
              onClick={() => navigate('/chat', { state: { initialMessage: 'I have questions about my immune system', newChat: true } })}
              className="bg-gradient-to-br from-indigo-50/50 via-white to-indigo-50/30 rounded-2xl p-4 hover:shadow-lg transition-all border border-gray-200/60 hover:border-indigo-300 flex flex-col items-center text-center min-w-[100px] flex-shrink-0"
            >
              <div className="mb-2 inline-flex p-3 rounded-2xl bg-indigo-50">
                <Shield className="h-5 w-5 text-indigo-600" />
              </div>
              <span className="text-xs font-semibold text-gray-900 whitespace-nowrap">Immunity</span>
            </button>
          </div>
        </div>

        {/* Educational Content Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">Health Resources</h3>
            <button
              onClick={() => navigate("/chat", { state: { initialMessage: "Show me more health resources", newChat: true } })}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              See all
            </button>
          </div>

          <div className="space-y-3">
            {/* Health Articles Card */}
            <Link
              to="/chat"
              state={{ initialMessage: "Show me health articles about common conditions", newChat: true }}
              className="bg-gradient-to-br from-blue-50/50 via-white to-blue-50/30 rounded-2xl p-4 hover:shadow-lg transition-all border border-gray-200/60 hover:border-blue-200/50 flex items-center gap-4"
            >
              <div className="inline-flex p-3 rounded-2xl bg-blue-50 flex-shrink-0">
                <BookOpen className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-gray-900 text-sm mb-0.5">Health Articles</h4>
                <p className="text-xs text-gray-500">Expert guides and condition information</p>
              </div>
            </Link>

            {/* Medical FAQs Card */}
            <Link
              to="/chat"
              state={{ initialMessage: "I have questions about common medical conditions and treatments", newChat: true }}
              className="bg-gradient-to-br from-purple-50/50 via-white to-purple-50/30 rounded-2xl p-4 hover:shadow-lg transition-all border border-gray-200/60 hover:border-purple-200/50 flex items-center gap-4"
            >
              <div className="inline-flex p-3 rounded-2xl bg-purple-50 flex-shrink-0">
                <HelpCircle className="h-5 w-5 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-gray-900 text-sm mb-0.5">Medical FAQs</h4>
                <p className="text-xs text-gray-500">Common questions answered by AI</p>
              </div>
            </Link>

            {/* Health News Card */}
            <Link
              to="/chat"
              state={{ initialMessage: "Show me curated health news and medical updates", newChat: true }}
              className="bg-gradient-to-br from-green-50/50 via-white to-green-50/30 rounded-2xl p-4 hover:shadow-lg transition-all border border-gray-200/60 hover:border-green-200/50 flex items-center gap-4"
            >
              <div className="inline-flex p-3 rounded-2xl bg-green-50 flex-shrink-0">
                <Newspaper className="h-5 w-5 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-gray-900 text-sm mb-0.5">Health News</h4>
                <p className="text-xs text-gray-500">Latest medical research and updates</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Health Tips & Insights Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-xl font-bold text-gray-900">Health Tips & Insights</h3>
            <button
              onClick={() => navigate('/chat', { state: { initialMessage: 'Give me more health tips', newChat: true } })}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              See all
            </button>
          </div>

          {/* Health Tip Cards */}
          <div className="space-y-4">
            <button
              onClick={() => navigate('/chat', { state: { initialMessage: 'Tell me about staying hydrated and daily water intake', newChat: true } })}
              className="w-full relative bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow text-left"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="inline-flex p-2 rounded-xl bg-blue-100">
                    <Droplet className="h-5 w-5 text-blue-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">Daily Hydration</span>
                </div>
              </div>

              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="text-2xl font-bold text-gray-900 mb-3">Stay Hydrated</h4>
                  <p className="text-sm text-gray-500 mb-6 font-light">
                    Drinking enough water daily helps maintain energy levels, supports digestion, and keeps your skin healthy.
                  </p>

                  <div className="flex items-center gap-4">
                    <div className="bg-white rounded-2xl px-4 py-3 shadow-sm">
                      <div className="flex items-center gap-1 mb-1">
                        <Droplet className="h-4 w-4 text-blue-500" />
                        <span className="text-lg font-bold text-gray-900">8 glasses</span>
                      </div>
                      <p className="text-xs text-gray-500">Per day</p>
                    </div>

                    <div className="bg-white rounded-2xl px-4 py-3 shadow-sm">
                      <div className="flex items-center gap-1 mb-1">
                        <Activity className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-bold text-gray-900">2-3L</span>
                      </div>
                      <p className="text-xs text-gray-500">Daily goal</p>
                    </div>
                  </div>
                </div>
              </div>
            </button>

            <button
              onClick={() => navigate('/chat', { state: { initialMessage: 'Tell me about the benefits of regular exercise' } })}
              className="w-full relative bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow text-left"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="inline-flex p-2 rounded-xl bg-green-100">
                    <Activity className="h-5 w-5 text-green-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">Physical Activity</span>
                </div>
              </div>

              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="text-2xl font-bold text-gray-900 mb-3">Move Daily</h4>
                  <p className="text-sm text-gray-600 mb-6 font-light">
                    Regular physical activity boosts mood, strengthens your heart, and helps maintain a healthy weight.
                  </p>

                  <div className="flex items-center gap-4">
                    <div className="bg-white rounded-2xl px-4 py-3 shadow-sm">
                      <div className="flex items-center gap-1 mb-1">
                        <Heart className="h-4 w-4 text-green-500" />
                        <span className="text-lg font-bold text-gray-900">30 min</span>
                      </div>
                      <p className="text-xs text-gray-500">Exercise</p>
                    </div>

                    <div className="bg-white rounded-2xl px-4 py-3 shadow-sm">
                      <div className="flex items-center gap-1 mb-1">
                        <Award className="h-4 w-4 text-green-500" />
                        <span className="text-sm font-bold text-gray-900">5 days</span>
                      </div>
                      <p className="text-xs text-gray-500">Per week</p>
                    </div>
                  </div>
                </div>
              </div>
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Index;

