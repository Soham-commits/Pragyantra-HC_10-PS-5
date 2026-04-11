import { useState, useEffect } from "react";
import { DoctorLayout } from "@/features/doctor/components/DoctorLayout";
import { fetchWithAuth } from "@/services/api";
import { cn } from "@/utils";
import {
    Calendar,
    Clock,
    Plus,
    Trash2,
    CheckCircle,
    XCircle,
    CalendarClock,
    Loader2,
    CalendarPlus,
    X,
    Timer,
    Sparkles,
    CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface TimeSlot {
    slot_id: string;
    doctor_id: string;
    date: string;
    start_time: string;
    end_time: string;
    is_booked: boolean;
}

interface BookingRequest {
    booking_id: string;
    slot_id: string;
    patient_health_id: string;
    patient_name: string;
    patient_age?: number;
    patient_gender?: string;
    doctor_id: string;
    doctor_name: string;
    doctor_specialization?: string;
    date: string;
    start_time: string;
    end_time: string;
    reason: string;
    notes?: string;
    status: string;
    created_at: string;
    updated_at: string;
}

interface PendingSlot {
    id: string;
    date: string;
    start_time: string;
    end_time: string;
}

type Tab = "requests" | "availability";

const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
    });
};

const formatDateShort = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
    });
};

const formatTime = (time: string) => {
    const [h, m] = time.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${m} ${ampm}`;
};

const addMinutesToTime = (time: string, minutes: number): string => {
    const [h, m] = time.split(":").map(Number);
    const totalMinutes = h * 60 + m + minutes;
    const newH = Math.floor(totalMinutes / 60) % 24;
    const newM = totalMinutes % 60;
    return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
};

const statusConfig: Record<string, { label: string; color: string; bg: string; borderColor: string }> = {
    pending: { label: "Pending", color: "text-amber-700", bg: "bg-amber-50", borderColor: "border-amber-200" },
    accepted: { label: "Accepted", color: "text-emerald-700", bg: "bg-emerald-50", borderColor: "border-emerald-200" },
    declined: { label: "Declined", color: "text-red-700", bg: "bg-red-50", borderColor: "border-red-200" },
    cancelled: { label: "Cancelled", color: "text-gray-500", bg: "bg-gray-50", borderColor: "border-gray-200" },
};

const DURATIONS = [
    { label: "15 min", value: 15 },
    { label: "30 min", value: 30 },
    { label: "45 min", value: 45 },
    { label: "1 hr", value: 60 },
    { label: "1.5 hr", value: 90 },
    { label: "2 hr", value: 120 },
];

export default function DoctorAppointments() {
    const [tab, setTab] = useState<Tab>("requests");
    const [slots, setSlots] = useState<TimeSlot[]>([]);
    const [requests, setRequests] = useState<BookingRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // New slot form
    const [showNewSlotForm, setShowNewSlotForm] = useState(false);
    const [newDate, setNewDate] = useState("");
    const [newStartTime, setNewStartTime] = useState("");
    const [selectedDuration, setSelectedDuration] = useState<number>(30);
    const [customEndTime, setCustomEndTime] = useState("");
    const [useCustomEnd, setUseCustomEnd] = useState(false);
    const [addingSlots, setAddingSlots] = useState(false);
    const [pendingSlots, setPendingSlots] = useState<PendingSlot[]>([]);
    const [slotSuccess, setSlotSuccess] = useState("");

    // Computed end time
    const computedEndTime = useCustomEnd
        ? customEndTime
        : newStartTime
            ? addMinutesToTime(newStartTime, selectedDuration)
            : "";

    // â”€â”€â”€ Fetch â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    const fetchSlots = async () => {
        try {
            const res = await fetchWithAuth("/api/doctor/availability");
            if (res.ok) {
                const data = await res.json();
                setSlots(data);
            }
        } catch (err) {
            console.error("Failed to fetch slots:", err);
        }
    };

    const fetchRequests = async () => {
        try {
            const res = await fetchWithAuth("/api/doctor/booking-requests");
            if (res.ok) {
                const data = await res.json();
                setRequests(data);
            }
        } catch (err) {
            console.error("Failed to fetch requests:", err);
        }
    };

    const loadAll = async () => {
        setLoading(true);
        await Promise.all([fetchSlots(), fetchRequests()]);
        setLoading(false);
    };

    useEffect(() => {
        loadAll();
    }, []);

    // â”€â”€â”€ Actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    const handleAddToPending = () => {
        if (!newDate || !newStartTime || !computedEndTime) return;

        // Check for duplicate in pending
        const isDuplicate = pendingSlots.some(
            (s) => s.date === newDate && s.start_time === newStartTime && s.end_time === computedEndTime
        );
        if (isDuplicate) return;

        const newSlot: PendingSlot = {
            id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            date: newDate,
            start_time: newStartTime,
            end_time: computedEndTime,
        };

        setPendingSlots((prev) => [...prev, newSlot]);

        // Auto-advance start time for next slot
        setNewStartTime(computedEndTime);
    };

    const handleRemovePending = (id: string) => {
        setPendingSlots((prev) => prev.filter((s) => s.id !== id));
    };

    const handleSubmitAllSlots = async () => {
        if (pendingSlots.length === 0) return;

        setAddingSlots(true);
        try {
            const res = await fetchWithAuth("/api/doctor/availability", {
                method: "POST",
                body: JSON.stringify({
                    slots: pendingSlots.map((s) => ({
                        date: s.date,
                        start_time: s.start_time,
                        end_time: s.end_time,
                    })),
                }),
            });

            if (res.ok) {
                const data = await res.json();
                setPendingSlots([]);
                setNewDate("");
                setNewStartTime("");
                setCustomEndTime("");
                setShowNewSlotForm(false);
                setSlotSuccess(`${data.slot_ids?.length || pendingSlots.length} slot(s) added successfully!`);
                setTimeout(() => setSlotSuccess(""), 4000);
                fetchSlots();
            } else {
                const err = await res.json();
                alert(err.detail || "Failed to add slots");
            }
        } catch (err) {
            alert("Something went wrong");
        } finally {
            setAddingSlots(false);
        }
    };

    // Quick add: single slot directly
    const handleQuickAddSingle = async () => {
        if (!newDate || !newStartTime || !computedEndTime) return;

        setAddingSlots(true);
        try {
            const res = await fetchWithAuth("/api/doctor/availability", {
                method: "POST",
                body: JSON.stringify({
                    slots: [
                        {
                            date: newDate,
                            start_time: newStartTime,
                            end_time: computedEndTime,
                        },
                    ],
                }),
            });

            if (res.ok) {
                setNewStartTime(computedEndTime); // Auto-advance
                setSlotSuccess("Slot added successfully!");
                setTimeout(() => setSlotSuccess(""), 3000);
                fetchSlots();
            } else {
                const err = await res.json();
                alert(err.detail || "Failed to add slot");
            }
        } catch (err) {
            alert("Something went wrong");
        } finally {
            setAddingSlots(false);
        }
    };

    const handleDeleteSlot = async (slotId: string) => {
        if (!confirm("Delete this time slot?")) return;

        setActionLoading(slotId);
        try {
            const res = await fetchWithAuth(`/api/doctor/availability/${slotId}`, {
                method: "DELETE",
            });
            if (res.ok) {
                fetchSlots();
            } else {
                const err = await res.json();
                alert(err.detail || "Failed to delete slot");
            }
        } catch (err) {
            alert("Something went wrong");
        } finally {
            setActionLoading(null);
        }
    };

    const handleRespondToBooking = async (bookingId: string, action: "accept" | "decline") => {
        setActionLoading(bookingId);
        try {
            const res = await fetchWithAuth(`/api/doctor/booking-requests/${bookingId}?action=${action}`, {
                method: "PATCH",
            });
            if (res.ok) {
                await Promise.all([fetchRequests(), fetchSlots()]);
            } else {
                const err = await res.json();
                alert(err.detail || `Failed to ${action} booking`);
            }
        } catch (err) {
            alert("Something went wrong");
        } finally {
            setActionLoading(null);
        }
    };

    // Group slots by date
    const slotsByDate: Record<string, TimeSlot[]> = {};
    for (const slot of slots) {
        if (!slotsByDate[slot.date]) slotsByDate[slot.date] = [];
        slotsByDate[slot.date].push(slot);
    }

    const pendingCount = requests.filter((r) => r.status === "pending").length;
    const totalSlots = slots.length;
    const bookedSlots = slots.filter((s) => s.is_booked).length;
    const availableSlots = totalSlots - bookedSlots;

    const today = new Date().toISOString().split("T")[0];

    return (
        <DoctorLayout title="Appointments" showSearch={false}>
            {/* Tab Toggle */}
            <div className="flex flex-wrap gap-2 mb-6">
                <button
                    onClick={() => setTab("requests")}
                    className={cn(
                        "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all relative",
                        tab === "requests"
                            ? "bg-gray-900 text-white shadow-lg"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    )}
                >
                    <CalendarClock className="h-4 w-4" />
                    Booking Requests
                    {pendingCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                            {pendingCount}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setTab("availability")}
                    className={cn(
                        "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all",
                        tab === "availability"
                            ? "bg-gray-900 text-white shadow-lg"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    )}
                >
                    <Calendar className="h-4 w-4" />
                    My Availability
                </button>
            </div>

            {loading ? (
                <div className="text-center py-16">
                    <Loader2 className="h-8 w-8 text-gray-400 mx-auto animate-spin" />
                    <p className="mt-3 text-sm text-gray-500">Loading...</p>
                </div>
            ) : (
                <>
                    {/* â”€â”€â”€ TAB: Booking Requests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                    {tab === "requests" && (
                        <>
                            {requests.length === 0 ? (
                                <div className="text-center py-16 bg-gray-50 rounded-3xl">
                                    <CalendarClock className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                                    <h3 className="text-lg font-semibold text-gray-700 mb-1">No Booking Requests</h3>
                                    <p className="text-sm text-gray-500">
                                        When patients book your available slots, requests will appear here
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {requests.map((req) => {
                                        const sc = statusConfig[req.status] || statusConfig.pending;
                                        const isPending = req.status === "pending";
                                        return (
                                            <div
                                                key={req.booking_id}
                                                className={cn(
                                                    "rounded-2xl border p-5 transition-all",
                                                    isPending
                                                        ? "border-amber-200 bg-gradient-to-br from-amber-50/50 to-white shadow-sm"
                                                        : `border-gray-200 bg-white`
                                                )}
                                            >
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                                                            {req.patient_name
                                                                .split(" ")
                                                                .map((n) => n[0])
                                                                .join("")
                                                                .slice(0, 2)
                                                                .toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <h4 className="font-semibold text-gray-900 text-sm">{req.patient_name}</h4>
                                                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                                                {req.patient_age && <span>{req.patient_age} yrs</span>}
                                                                {req.patient_gender && (
                                                                    <>
                                                                        <span>â€¢</span>
                                                                        <span className="capitalize">{req.patient_gender}</span>
                                                                    </>
                                                                )}
                                                                <span>â€¢</span>
                                                                <span className="font-mono">{req.patient_health_id}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <span className={cn("px-2.5 py-1 rounded-full text-xs font-semibold border", sc.color, sc.bg, sc.borderColor)}>
                                                        {sc.label}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-4 text-xs text-gray-600 mb-2">
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="h-3.5 w-3.5" />
                                                        {formatDate(req.date)}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="h-3.5 w-3.5" />
                                                        {formatTime(req.start_time)} â€“ {formatTime(req.end_time)}
                                                    </span>
                                                </div>

                                                <p className="text-xs text-gray-700 mb-1">
                                                    <span className="font-medium">Reason:</span> {req.reason}
                                                </p>
                                                {req.notes && (
                                                    <p className="text-xs text-gray-500">
                                                        <span className="font-medium">Notes:</span> {req.notes}
                                                    </p>
                                                )}

                                                {isPending && (
                                                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-200/60">
                                                        <Button
                                                            onClick={() => handleRespondToBooking(req.booking_id, "accept")}
                                                            disabled={actionLoading === req.booking_id}
                                                            className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium shadow-sm"
                                                        >
                                                            {actionLoading === req.booking_id ? (
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <>
                                                                    <CheckCircle className="h-4 w-4 mr-1.5" />
                                                                    Accept
                                                                </>
                                                            )}
                                                        </Button>
                                                        <Button
                                                            onClick={() => handleRespondToBooking(req.booking_id, "decline")}
                                                            disabled={actionLoading === req.booking_id}
                                                            variant="outline"
                                                            className="flex-1 h-10 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 text-sm font-medium"
                                                        >
                                                            <XCircle className="h-4 w-4 mr-1.5" />
                                                            Decline
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}

                    {/* â”€â”€â”€ TAB: Availability â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                    {tab === "availability" && (
                        <>
                            {/* Stats Bar */}
                            {totalSlots > 0 && (
                                <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6">
                                    <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
                                        <p className="text-2xl font-bold text-gray-900">{totalSlots}</p>
                                        <p className="text-xs font-medium text-gray-500 mt-0.5">Total Slots</p>
                                    </div>
                                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-4 border border-emerald-100">
                                        <p className="text-2xl font-bold text-gray-900">{bookedSlots}</p>
                                        <p className="text-xs font-medium text-emerald-600 mt-0.5">Booked</p>
                                    </div>
                                    <div className="bg-gradient-to-br from-blue-50 to-sky-50 rounded-2xl p-4 border border-blue-100">
                                        <p className="text-2xl font-bold text-gray-900">{availableSlots}</p>
                                        <p className="text-xs font-medium text-blue-600 mt-0.5">Available</p>
                                    </div>
                                </div>
                            )}

                            {/* Success toast */}
                            {slotSuccess && (
                                <div className="mb-5 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 animate-in slide-in-from-top duration-300">
                                    <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                                    <p className="text-sm text-emerald-800 font-medium">{slotSuccess}</p>
                                </div>
                            )}

                            {/* Add Slot Area */}
                            <div className="mb-6">
                                {!showNewSlotForm ? (
                                    <Button
                                        onClick={() => setShowNewSlotForm(true)}
                                        className="h-12 px-6 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-semibold text-sm shadow-lg"
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add Available Slots
                                    </Button>
                                ) : (
                                    <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden animate-in slide-in-from-top duration-300">
                                        {/* Header */}
                                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                                            <div className="flex items-center gap-2.5">
                                                <div className="h-9 w-9 rounded-xl bg-gray-900 flex items-center justify-center shadow-sm">
                                                    <CalendarPlus className="h-4 w-4 text-white" />
                                                </div>
                                                <div>
                                                    <h3 className="text-sm font-bold text-gray-900">Add Time Slots</h3>
                                                    <p className="text-[11px] text-gray-500">Set your availability for patients</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setShowNewSlotForm(false);
                                                    setPendingSlots([]);
                                                    setNewDate("");
                                                    setNewStartTime("");
                                                    setCustomEndTime("");
                                                }}
                                                className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>

                                        <div className="p-5 space-y-5">
                                            {/* Step 1: Date */}
                                            <div>
                                                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-2">
                                                    <CalendarDays className="h-3.5 w-3.5 text-gray-500" />
                                                    Select Date
                                                </label>
                                                <input
                                                    type="date"
                                                    value={newDate}
                                                    min={today}
                                                    onChange={(e) => setNewDate(e.target.value)}
                                                    className="w-full h-12 rounded-xl bg-white border-2 border-gray-200 px-4 text-sm font-medium text-gray-700 outline-none focus:border-gray-400 focus:ring-4 focus:ring-gray-100 transition-all"
                                                />
                                            </div>

                                            {/* Step 2: Start Time */}
                                            <div>
                                                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-2">
                                                    <Clock className="h-3.5 w-3.5 text-gray-500" />
                                                    Start Time
                                                </label>
                                                <input
                                                    type="time"
                                                    value={newStartTime}
                                                    onChange={(e) => setNewStartTime(e.target.value)}
                                                    className="w-full h-12 rounded-xl bg-white border-2 border-gray-200 px-4 text-sm font-medium text-gray-700 outline-none focus:border-gray-400 focus:ring-4 focus:ring-gray-100 transition-all"
                                                />
                                            </div>

                                            {/* Step 3: Duration or Custom End */}
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                                                        <Timer className="h-3.5 w-3.5 text-gray-500" />
                                                        {useCustomEnd ? "End Time" : "Duration"}
                                                    </label>
                                                    <button
                                                        onClick={() => {
                                                            setUseCustomEnd(!useCustomEnd);
                                                            setCustomEndTime("");
                                                        }}
                                                        className="text-[11px] font-medium text-gray-500 hover:text-gray-900 transition-colors"
                                                    >
                                                        {useCustomEnd ? "Use quick duration" : "Set custom end time"}
                                                    </button>
                                                </div>

                                                {useCustomEnd ? (
                                                    <input
                                                        type="time"
                                                        value={customEndTime}
                                                        onChange={(e) => setCustomEndTime(e.target.value)}
                                                        className="w-full h-12 rounded-xl bg-white border-2 border-gray-200 px-4 text-sm font-medium text-gray-700 outline-none focus:border-gray-400 focus:ring-4 focus:ring-gray-100 transition-all"
                                                    />
                                                ) : (
                                                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                                                        {DURATIONS.map((d) => (
                                                            <button
                                                                key={d.value}
                                                                onClick={() => setSelectedDuration(d.value)}
                                                                className={cn(
                                                                    "h-11 rounded-xl text-sm font-semibold transition-all border-2",
                                                                    selectedDuration === d.value
                                                                        ? "bg-gray-900 text-white border-gray-900 shadow-md"
                                                                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-900"
                                                                )}
                                                            >
                                                                {d.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Preview */}
                                            {newDate && newStartTime && computedEndTime && (
                                                <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-4 flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 rounded-xl bg-gray-100 flex items-center justify-center">
                                                            <Sparkles className="h-5 w-5 text-gray-600" />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-gray-900">
                                                                {formatTime(newStartTime)} â€“ {formatTime(computedEndTime)}
                                                            </p>
                                                            <p className="text-xs text-gray-500">{formatDate(newDate)}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            onClick={handleAddToPending}
                                                            disabled={addingSlots}
                                                            variant="outline"
                                                            className="h-9 rounded-lg border-gray-200 text-gray-600 hover:bg-gray-100 text-xs font-semibold px-3"
                                                        >
                                                            <Plus className="h-3.5 w-3.5 mr-1" />
                                                            Queue
                                                        </Button>
                                                        <Button
                                                            onClick={handleQuickAddSingle}
                                                            disabled={addingSlots}
                                                            className="h-9 rounded-lg bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold px-3"
                                                        >
                                                            {addingSlots ? (
                                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                            ) : (
                                                                <>
                                                                    <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                                                    Add Now
                                                                </>
                                                            )}
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Pending Slots Queue */}
                                            {pendingSlots.length > 0 && (
                                                <div>
                                                    <div className="flex items-center justify-between mb-2.5">
                                                        <p className="text-xs font-semibold text-gray-700">
                                                            Queued Slots ({pendingSlots.length})
                                                        </p>
                                                        <button
                                                            onClick={() => setPendingSlots([])}
                                                            className="text-[11px] font-medium text-red-500 hover:text-red-600"
                                                        >
                                                            Clear all
                                                        </button>
                                                    </div>
                                                    <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                                                        {pendingSlots.map((slot) => (
                                                            <div
                                                                key={slot.id}
                                                                className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-3 py-2"
                                                            >
                                                                <div className="flex items-center gap-2.5">
                                                                    <Clock className="h-3.5 w-3.5 text-gray-400" />
                                                                    <span className="text-xs font-semibold text-gray-900">
                                                                        {formatDateShort(slot.date)} Â· {formatTime(slot.start_time)} â€“ {formatTime(slot.end_time)}
                                                                    </span>
                                                                </div>
                                                                <button
                                                                    onClick={() => handleRemovePending(slot.id)}
                                                                    className="h-6 w-6 rounded-md flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                                                >
                                                                    <X className="h-3.5 w-3.5" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <Button
                                                        onClick={handleSubmitAllSlots}
                                                        disabled={addingSlots}
                                                        className="w-full mt-3 h-11 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-semibold text-sm shadow-lg"
                                                    >
                                                        {addingSlots ? (
                                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                        ) : (
                                                            <CalendarPlus className="h-4 w-4 mr-2" />
                                                        )}
                                                        {addingSlots ? "Adding..." : `Add All ${pendingSlots.length} Slot${pendingSlots.length > 1 ? "s" : ""}`}
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Existing Slots */}
                            {Object.keys(slotsByDate).length === 0 ? (
                                <div className="text-center py-16 bg-gray-50 rounded-3xl">
                                    <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                                    <h3 className="text-lg font-semibold text-gray-700 mb-1">No Available Slots</h3>
                                    <p className="text-sm text-gray-500">Add your available time slots for patients to book</p>
                                </div>
                            ) : (
                                <div className="space-y-5">
                                    {Object.entries(slotsByDate).map(([date, dateSlots]) => (
                                        <div key={date}>
                                            <div className="flex items-center gap-2 mb-3">
                                                <Calendar className="h-4 w-4 text-gray-500" />
                                                <h3 className="text-sm font-semibold text-gray-700">{formatDate(date)}</h3>
                                                <span className="text-xs text-gray-400">
                                                    ({dateSlots.length} slot{dateSlots.length > 1 ? "s" : ""})
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                                                {dateSlots.map((slot) => (
                                                    <div
                                                        key={slot.slot_id}
                                                        className={cn(
                                                            "rounded-xl border p-3.5 flex items-center justify-between transition-all",
                                                            slot.is_booked
                                                                ? "bg-emerald-50 border-emerald-200"
                                                                : "bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-2.5">
                                                            <div
                                                                className={cn(
                                                                    "h-9 w-9 rounded-lg flex items-center justify-center",
                                                                    slot.is_booked ? "bg-emerald-100" : "bg-gray-100"
                                                                )}
                                                            >
                                                                <Clock className={cn("h-4 w-4", slot.is_booked ? "text-emerald-600" : "text-gray-500")} />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-semibold text-gray-900">
                                                                    {formatTime(slot.start_time)} â€“ {formatTime(slot.end_time)}
                                                                </p>
                                                                <p className={cn("text-[10px] font-medium", slot.is_booked ? "text-emerald-600" : "text-gray-400")}>
                                                                    {slot.is_booked ? "âœ“ Booked" : "Available"}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        {!slot.is_booked && (
                                                            <button
                                                                onClick={() => handleDeleteSlot(slot.slot_id)}
                                                                disabled={actionLoading === slot.slot_id}
                                                                className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                            >
                                                                {actionLoading === slot.slot_id ? (
                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                ) : (
                                                                    <Trash2 className="h-4 w-4" />
                                                                )}
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </>
            )}
        </DoctorLayout>
    );
}

