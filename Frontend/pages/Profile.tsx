import { FloatingNav } from "@/layouts/FloatingNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { User, Mail, Calendar, Settings, LogOut, ChevronRight, Activity, Heart, Droplet, Phone, FileText, Scan, MessageSquare, Edit2, Save, X, IdCard, Bell, Shield, Info } from "lucide-react";
import { cn } from "@/utils";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchWithAuth, profileApi } from "@/services/api";
import { HealthWalletCard } from "@/components/profile/HealthWalletCard";
import { useTranslation } from "react-i18next";

interface UserProfile {
  health_id: string;
  full_name: string;
  email: string;
  onboarded: boolean;
  wallet_address?: string;
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
  emergency_contacts?: string;
}

interface StatsData {
  reports: number;
  scans: number;
  chats: number;
}

type ActiveSection = 'personal' | 'settings' | null;

export default function Profile() {
  const { t } = useTranslation();

  const menuItems = [
    { icon: User, label: t('profile.personal_info'), description: t('profile.update_profile'), id: "personal" },
    { icon: Settings, label: t('profile.settings'), description: t('profile.app_preferences'), id: "settings" },
  ];
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<StatsData>({ reports: 0, scans: 0, chats: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<ActiveSection>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState<Partial<UserProfile>>({});
  const [notificationPrefs, setNotificationPrefs] = useState(() => {
    try {
      const raw = localStorage.getItem("settings_notifications");
      if (raw) {
        return JSON.parse(raw) as {
          emailAlerts: boolean;
          referralUpdates: boolean;
          appNotifications: boolean;
        };
      }
    } catch (_e) {
      // Fall back to defaults when local storage is not parseable.
    }
    return {
      emailAlerts: true,
      referralUpdates: true,
      appNotifications: true,
    };
  });
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setError(null);
        const token = localStorage.getItem('token');
        console.log('Token exists:', !!token);
        console.log('API Base URL:', window.location.hostname);
        
        if (!token) {
          console.error('No token found, redirecting to login');
          navigate('/login');
          return;
        }

        // Fetch user profile
        console.log('Fetching profile from:', `/api/auth/profile`);
        const profileResponse = await fetchWithAuth('/api/auth/profile');
        console.log('Profile response status:', profileResponse.status);
        
        if (!profileResponse.ok) {
          const errorText = await profileResponse.text();
          console.error('Profile error details:', errorText);
          setError(`Failed to load profile: ${profileResponse.status} - ${errorText.substring(0, 100)}`);
          throw new Error('Failed to fetch profile');
        }
        
        const profileData = await profileResponse.json();
        console.log('Profile data received:', profileData);
        
        if (!profileData || !profileData.email) {
          console.error('Invalid profile data:', profileData);
          setError('Received invalid profile data from server');
          return;
        }
        
        setUserProfile(profileData);

        // Prefer server-side totals (more reliable than counting list endpoints).
        let totalReports = 0;
        let totalScans = 0;

        const historyResponse = await fetchWithAuth("/api/patient/history?limit=1");
        if (historyResponse.ok) {
          const historyData = await historyResponse.json();
          totalReports = Number(historyData?.total_reports || 0);
          totalScans = Number(historyData?.total_scans || 0);
        } else {
          // Fallback to counting list endpoints if history isn't available.
          const reportsResponse = await fetchWithAuth("/api/patient/reports?limit=100");
          const reportsData = reportsResponse.ok ? await reportsResponse.json() : [];

          const scansResponse = await fetchWithAuth("/api/patient/scans?limit=100");
          const scansData = scansResponse.ok ? await scansResponse.json() : [];

          totalReports = Array.isArray(reportsData) ? reportsData.length : 0;
          totalScans = Array.isArray(scansData) ? scansData.length : 0;
        }

        const chatsResponse = await fetchWithAuth("/api/patient/chat/sessions?limit=100");
        const chatsData = chatsResponse.ok ? await chatsResponse.json() : [];

        setStats({
          reports: totalReports,
          scans: totalScans,
          chats: Array.isArray(chatsData) ? chatsData.length : 0,
        });
      } catch (error) {
        console.error('Error fetching data:', error);
        setError(error instanceof Error ? error.message : 'Unknown error occurred');
        // Don't redirect to signup if we just can't fetch stats
        // Only redirect if there's no token or auth failure
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('health_id');
    localStorage.removeItem('doctor_id');
    localStorage.removeItem('role');
    localStorage.removeItem('onboarded');
    navigate('/login');
  };

  const handleDownloadMyData = async () => {
    setExportError(null);
    setExporting(true);
    try {
      const response = await fetchWithAuth("/api/patient/export", { method: "GET" });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to export data");
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get("content-disposition") || "";
      const filenameMatch = /filename=\"?([^\";]+)\"?/i.exec(contentDisposition);
      const filename = filenameMatch?.[1] || "mediq_export.pdf";

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Failed to export data");
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteError(null);
    setDeletingAccount(true);
    try {
      const response = await fetchWithAuth("/api/patient/delete-account", {
        method: "POST",
        body: JSON.stringify({ confirm: deleteConfirmText }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to delete account");
      }

      localStorage.removeItem("token");
      localStorage.removeItem("health_id");
      localStorage.removeItem("doctor_id");
      localStorage.removeItem("role");
      localStorage.removeItem("onboarded");

      setDeleteDialogOpen(false);
      setDeleteConfirmText("");
      navigate("/");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete account");
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleMenuClick = (itemId: string) => {
    setActiveSection(itemId as ActiveSection);
  };

  const handleEditToggle = () => {
    if (isEditing) {
      // Cancel editing
      setEditedProfile({});
      setIsEditing(false);
    } else {
      // Start editing
      setEditedProfile({ ...userProfile });
      setIsEditing(true);
    }
  };

  const handleSaveProfile = async () => {
    try {
      const updatedProfile = await profileApi.updateProfile(editedProfile);
      setUserProfile(updatedProfile);
      setIsEditing(false);
      setEditedProfile({});
    } catch (error) {
      console.error('Error updating profile:', error);
      alert(t('profile.update_failed'));
    }
  };

  const handleInputChange = (field: keyof UserProfile, value: any) => {
    setEditedProfile(prev => ({ ...prev, [field]: value }));
  };

  const toggleNotificationPref = (key: "emailAlerts" | "referralUpdates" | "appNotifications") => {
    setNotificationPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem("settings_notifications", JSON.stringify(next));
      return next;
    });
  };

  const getInitials = (name: string | undefined | null) => {
    if (!name || typeof name !== 'string' || name.trim() === '') return 'U';
    const trimmedName = name.trim();
    const parts = trimmedName.split(' ').filter(part => part.length > 0);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return trimmedName.substring(0, Math.min(2, trimmedName.length)).toUpperCase();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('profile.loading')}</p>
        </div>
      </div>
    );
  }

  // Show error state if profile failed to load
  if (error && !userProfile) {
    return (
      <div className="min-h-screen bg-white pb-24">
        <FloatingNav />
        <main className="max-w-md md:max-w-6xl lg:max-w-7xl mx-auto px-5 md:px-8 lg:px-10 py-6">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <h2 className="text-lg font-semibold text-red-900 mb-2">{t('profile.profile_failed')}</h2>
            <p className="text-sm text-red-700 mb-4">{error}</p>
            <div className="space-y-2 text-xs text-left bg-white rounded p-3 mb-4">
              <p><strong>{t('profile.api_url')}</strong> {window.location.hostname}:8000</p>
              <p><strong>{t('profile.token')}</strong> {localStorage.getItem('token') ? t('common.present') : t('common.missing')}</p>
            </div>
            <div className="space-y-2">
              <Button 
                onClick={() => window.location.reload()} 
                className="w-full"
              >
                Retry
              </Button>
              <Button
                onClick={handleLogout}
                variant="outline"
                className="w-full"
              >
                {t('profile.sign_out')}
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Render active section
  if (activeSection) {
    return (
      <div className="min-h-screen bg-white pb-24">
        <FloatingNav />
        <main className="max-w-md md:max-w-6xl lg:max-w-7xl mx-auto px-5 md:px-8 lg:px-10 py-6">
          <div className="flex items-center mb-6">
            <button
              onClick={() => setActiveSection(null)}
              className="mr-3 p-2 hover:bg-gray-100 rounded-full"
              aria-label="Go back"
            >
              <ChevronRight className="h-5 w-5 text-gray-700 rotate-180" />
            </button>
            <h1 className="text-xl font-bold text-gray-900">
              {menuItems.find(item => item.id === activeSection)?.label}
            </h1>
          </div>

          {activeSection === 'personal' && (
            <div className="space-y-4">
              <div className="flex justify-end mb-4">
                {!isEditing ? (
                  <Button
                    onClick={handleEditToggle}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <Edit2 className="h-4 w-4" />
                    {t('profile.edit')}
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      onClick={handleEditToggle}
                      variant="outline"
                      size="sm"
                      className="gap-2"
                    >
                      <X className="h-4 w-4" />
                      {t('profile.cancel')}
                    </Button>
                    <Button
                      onClick={handleSaveProfile}
                      size="sm"
                      className="gap-2"
                    >
                      <Save className="h-4 w-4" />
                      {t('profile.save')}
                    </Button>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 rounded-2xl border border-gray-200 p-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-600 block mb-1.5">{t('profile.full_name')}</label>
                    <Input
                      value={isEditing ? (editedProfile.full_name || '') : (userProfile?.full_name || '')}
                      onChange={(e) => handleInputChange('full_name', e.target.value)}
                      disabled={!isEditing}
                      className="bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600 block mb-1.5">{t('profile.email')}</label>
                    <Input
                      value={userProfile?.email || ''}
                      type="email"
                      disabled
                      className="bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600 block mb-1.5">{t('profile.phone')}</label>
                    <Input
                      value={isEditing ? (editedProfile.phone || '') : (userProfile?.phone || '')}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      disabled={!isEditing}
                      className="bg-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-600 block mb-1.5">{t('profile.age')}</label>
                      <Input
                        value={isEditing ? (editedProfile.age || '') : (userProfile?.age || '')}
                        onChange={(e) => handleInputChange('age', parseInt(e.target.value))}
                        type="number"
                        disabled={!isEditing}
                        className="bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 block mb-1.5">{t('profile.gender')}</label>
                      <Input
                        value={isEditing ? (editedProfile.gender || '') : (userProfile?.gender || '')}
                        onChange={(e) => handleInputChange('gender', e.target.value)}
                        disabled={!isEditing}
                        className="bg-white"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-600 block mb-1.5">{t('profile.height')}</label>
                      <Input
                        value={isEditing ? (editedProfile.height || '') : (userProfile?.height || '')}
                        onChange={(e) => handleInputChange('height', parseFloat(e.target.value))}
                        type="number"
                        disabled={!isEditing}
                        className="bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 block mb-1.5">{t('profile.weight')}</label>
                      <Input
                        value={isEditing ? (editedProfile.weight || '') : (userProfile?.weight || '')}
                        onChange={(e) => handleInputChange('weight', parseFloat(e.target.value))}
                        type="number"
                        disabled={!isEditing}
                        className="bg-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600 block mb-1.5">{t('profile.blood_group')}</label>
                    <Input
                      value={isEditing ? (editedProfile.blood_group || '') : (userProfile?.blood_group || '')}
                      onChange={(e) => handleInputChange('blood_group', e.target.value)}
                      disabled={!isEditing}
                      className="bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600 block mb-1.5">{t('profile.allergies')}</label>
                    <Input
                      value={isEditing ? (editedProfile.allergies || '') : (userProfile?.allergies || '')}
                      onChange={(e) => handleInputChange('allergies', e.target.value)}
                      disabled={!isEditing}
                      className="bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600 block mb-1.5">{t('profile.chronic_conditions')}</label>
                    <Input
                      value={isEditing ? (editedProfile.chronic_conditions || '') : (userProfile?.chronic_conditions || '')}
                      onChange={(e) => handleInputChange('chronic_conditions', e.target.value)}
                      disabled={!isEditing}
                      className="bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600 block mb-1.5">{t('profile.current_medications')}</label>
                    <Input
                      value={isEditing ? (editedProfile.current_medications || '') : (userProfile?.current_medications || '')}
                      onChange={(e) => handleInputChange('current_medications', e.target.value)}
                      disabled={!isEditing}
                      className="bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'settings' && (
            <div className="space-y-3">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-gray-100 flex items-center justify-center">
                    <User className="h-4 w-4 text-gray-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">Profile</p>
                    <p className="text-sm text-gray-500">Manage your personal profile details</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setActiveSection('personal')} className="gap-1 text-gray-700">
                    Open Profile
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-9 w-9 rounded-lg bg-gray-100 flex items-center justify-center">
                    <Bell className="h-4 w-4 text-gray-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">Notifications</p>
                    <p className="text-sm text-gray-500">Control email alerts and in-app updates</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {[
                    { key: "emailAlerts" as const, label: "Email Alerts" },
                    { key: "referralUpdates" as const, label: "Referral Updates" },
                    { key: "appNotifications" as const, label: "App Notifications" },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                      <p className="text-sm text-gray-700">{item.label}</p>
                      <button
                        type="button"
                        onClick={() => toggleNotificationPref(item.key)}
                        className={cn(
                          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                          notificationPrefs[item.key] ? "bg-gray-900" : "bg-gray-300"
                        )}
                        role="switch"
                        aria-checked={notificationPrefs[item.key]}
                        aria-label={item.label}
                      >
                        <span
                          className={cn(
                            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                            notificationPrefs[item.key] ? "translate-x-6" : "translate-x-1"
                          )}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className="h-9 w-9 rounded-lg bg-gray-100 flex items-center justify-center mt-0.5">
                    <Shield className="h-4 w-4 text-gray-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">Privacy &amp; Security</p>
                    <p className="text-sm text-gray-500">Data rights and policy controls</p>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 mb-3">
                  <p className="text-sm font-medium text-gray-900">Data &amp; Privacy</p>
                  <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                    MediQ collects and processes medical scans, reports, referrals, and basic profile information in alignment with DPDP Act 2023.
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Rights: Access, Erasure, Data Export, Withdraw Consent (privacy@mediq.health)
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Export My Data</p>
                      <p className="text-xs text-gray-500">Download all associated health data</p>
                      {exportError && <p className="text-xs text-red-600 mt-1">{exportError}</p>}
                    </div>
                    <Button variant="outline" size="sm" onClick={handleDownloadMyData} disabled={exporting}>
                      {exporting ? t('profile.preparing') : 'Export'}
                    </Button>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate('/trust')}
                    className="w-full flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">Trust Center</p>
                      <p className="text-xs text-gray-500">Security and compliance standards</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-500" />
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate('/privacy')}
                    className="w-full flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">Privacy Policy</p>
                      <p className="text-xs text-gray-500">What data we collect and your rights</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-500" />
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate('/grievance')}
                    className="w-full flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">Submit a Grievance</p>
                      <p className="text-xs text-gray-500">Raise a data concern or consent issue</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-500" />
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-gray-100 flex items-center justify-center">
                    <Info className="h-4 w-4 text-gray-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">About</p>
                    <p className="text-sm text-gray-500">MediQ AI health screening companion</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-800">v0.1.0</p>
                    <p className="text-xs text-gray-500">MediQ Health Companion</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-gray-200" />

              <div className="bg-red-50 rounded-xl border border-red-200 shadow-sm p-4 mt-2">
                <h3 className="font-semibold text-red-900 mb-3">Danger Zone</h3>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-red-900">Delete Account</p>
                    <p className="text-xs text-red-700">Permanently delete your account and all associated health data. This cannot be undone.</p>
                  </div>

                  <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => {
                    setDeleteDialogOpen(open);
                    if (!open) {
                      setDeleteConfirmText("");
                      setDeleteError(null);
                    }
                  }}>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">Delete</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('profile.delete_confirm_title')}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t('profile.delete_confirm_desc')}
                        </AlertDialogDescription>
                      </AlertDialogHeader>

                      <div className="space-y-3">
                        <Input
                          value={deleteConfirmText}
                          onChange={(e) => setDeleteConfirmText(e.target.value)}
                          placeholder={t('profile.type_delete')}
                          className="bg-white"
                          disabled={deletingAccount}
                        />
                        {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
                      </div>

                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={deletingAccount}>{t('common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={(e) => {
                            e.preventDefault();
                            void handleDeleteAccount();
                          }}
                          disabled={deletingAccount || deleteConfirmText !== "DELETE"}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {deletingAccount ? t('profile.deleting') : t('profile.confirm_delete')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      <FloatingNav />

      <main className="max-w-md md:max-w-6xl lg:max-w-7xl mx-auto px-5 md:px-8 lg:px-10 py-6">
        {/* Profile Header */}
        <div className="mb-8 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1 md:gap-4">
            <div className="relative shrink-0">
              <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center text-xl font-bold text-gray-700 md:h-20 md:w-20 md:text-2xl">
                {userProfile ? getInitials(userProfile.full_name) : 'U'}
              </div>
              <button className="absolute bottom-0 right-0 h-6 w-6 rounded-full bg-gray-900 flex items-center justify-center md:h-7 md:w-7" aria-label="Edit profile">
                <Settings className="h-3.5 w-3.5 text-white md:h-4 md:w-4" />
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold text-gray-900 truncate md:text-xl">{userProfile?.full_name || t('common.user')}</h1>
              <p className="text-xs text-gray-600 mt-1 truncate md:text-sm">{userProfile?.email || t('profile.no_email')}</p>
            </div>
          </div>

          <Button
            onClick={handleLogout}
            className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 h-9 w-9 p-0 rounded-xl shrink-0 md:h-10 md:w-auto md:px-4"
            title="Sign Out"
          >
            <LogOut className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">{t('profile.sign_out')}</span>
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
            <FileText className="h-5 w-5 text-gray-600 mx-auto mb-2" />
            <p className="text-xl font-bold text-gray-900">{stats.reports}</p>
            <p className="text-xs text-gray-600 mt-1">{t('profile.reports')}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
            <Scan className="h-5 w-5 text-gray-600 mx-auto mb-2" />
            <p className="text-xl font-bold text-gray-900">{stats.scans}</p>
            <p className="text-xs text-gray-600 mt-1">{t('profile.scans')}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
            <MessageSquare className="h-5 w-5 text-gray-600 mx-auto mb-2" />
            <p className="text-xl font-bold text-gray-900">{stats.chats}</p>
            <p className="text-xs text-gray-600 mt-1">{t('profile.chats')}</p>
          </div>
        </div>

        {userProfile?.health_id && (
          <>
            <HealthWalletCard
              patientId={userProfile.health_id}
              walletAddress={userProfile.wallet_address}
            />
          </>
        )}

        {/* Profile Info Card */}
        {userProfile?.onboarded && (
          <div className="bg-gray-50 rounded-2xl border border-gray-200 p-6 mb-6">
            <h2 className="font-semibold text-gray-900 mb-4">{t('profile.profile_info')}</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="text-sm text-gray-600 block mb-1.5">Full Name</label>
                  <Input defaultValue={userProfile.full_name} disabled className="bg-white" />
                </div>
                <div>
                  <label className="text-sm text-gray-600 block mb-1.5">Email</label>
                  <Input defaultValue={userProfile.email} type="email" disabled className="bg-white" />
                </div>
              </div>
              {userProfile.phone && (
                <div>
                  <label className="text-sm text-gray-600 block mb-1.5">Phone</label>
                  <Input defaultValue={userProfile.phone} disabled className="bg-white" />
                </div>
              )}
              <div className="grid grid-cols-1 gap-4">
                {userProfile.age && (
                  <div>
                    <label className="text-sm text-gray-600 block mb-1.5">Age</label>
                    <Input defaultValue={userProfile.age} type="number" disabled className="bg-white" />
                  </div>
                )}
                {userProfile.gender && (
                  <div>
                    <label className="text-sm text-gray-600 block mb-1.5">Gender</label>
                    <Input defaultValue={userProfile.gender} disabled className="bg-white" />
                  </div>
                )}
                {userProfile.blood_group && (
                  <div>
                    <label className="text-sm text-gray-600 block mb-1.5">{t('profile.blood_type')}</label>
                    <Input defaultValue={userProfile.blood_group} disabled className="bg-white" />
                  </div>
                )}
              </div>
              {(userProfile.height || userProfile.weight) && (
                <div className="grid grid-cols-2 gap-4">
                  {userProfile.height && (
                    <div>
                      <label className="text-sm text-gray-600 block mb-1.5">{t('profile.height')}</label>
                      <Input defaultValue={userProfile.height} disabled className="bg-white" />
                    </div>
                  )}
                  {userProfile.weight && (
                    <div>
                      <label className="text-sm text-gray-600 block mb-1.5">{t('profile.weight')}</label>
                      <Input defaultValue={userProfile.weight} disabled className="bg-white" />
                    </div>
                  )}
                </div>
              )}
              {userProfile.allergies && (
                <div>
                  <label className="text-sm text-gray-600 block mb-1.5">Allergies</label>
                  <Input defaultValue={userProfile.allergies} disabled className="bg-white" />
                </div>
              )}
              {userProfile.chronic_conditions && (
                <div>
                  <label className="text-sm text-gray-600 block mb-1.5">Chronic Conditions</label>
                  <Input defaultValue={userProfile.chronic_conditions} disabled className="bg-white" />
                </div>
              )}
              {userProfile.current_medications && (
                <div>
                  <label className="text-sm text-gray-600 block mb-1.5">Current Medications</label>
                  <Input defaultValue={userProfile.current_medications} disabled className="bg-white" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Menu Items */}
        <div className="space-y-2 mb-6">
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={() => handleMenuClick(item.id)}
              className="w-full flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100 transition-all duration-200 hover:bg-gray-100 text-left group"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">
                <item.icon className="h-5 w-5 text-gray-700" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">{item.label}</p>
                <p className="text-xs text-gray-500">{item.description}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400 transition-transform group-hover:translate-x-1" />
            </button>
          ))}
        </div>

        {/* Health ID */}
        <div className="mb-4">
          <div className="rounded-2xl border border-gray-100 bg-gray-50 px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-gray-500">{t('profile.health_id')}</p>
                <p className="font-mono text-sm font-medium text-gray-900 mt-1">{userProfile?.health_id || t('common.na')}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-white border border-gray-100 flex items-center justify-center text-gray-500">
                <IdCard className="h-5 w-5" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

