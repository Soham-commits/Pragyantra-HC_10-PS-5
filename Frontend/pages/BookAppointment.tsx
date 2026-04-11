import { useState, useEffect } from "react";
import { FloatingNav } from "@/layouts/FloatingNav";
import { MediqIcon } from "@/components/ui/MediqIcon";
import { fetchWithAuth } from "@/services/api";
import { Link, useNavigate } from "react-router-dom";
import { cn } from "@/utils";
import {
    ArrowLeft,
    Calendar,
    Clock,
    Star,
    Briefcase,
    MapPin,
    ChevronRight,
    CheckCircle,
    XCircle,
    Loader2,
    Stethoscope,
    User,
    CalendarCheck,
    CalendarClock,
    Search,
    Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Doctor {
    doctor_id: string;
    full_name: string;
    specialization: string;
    qualification: string;
    experience_years: number;
    hospital_affiliation?: string;
    consultation_fee?: number;
    rating?: number;
    total_consultations: number;
    available_slot_count: number;
}

interface TimeSlot {
    slot_id: string;
    date: string;
    start_time: string;
    end_time: string;
}

interface DoctorSlots {
    doctor: {
        doctor_id: string;
        full_name: string;
        specialization: string;
        qualification: string;
        experience_years: number;
        hospital_affiliation?: string;
        consultation_fee?: number;
    };
    slots: TimeSlot[];
}

interface MyBooking {
    booking_id: string;
    slot_id: string;
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

type ViewState = "doctors" | "slots" | "booking" | "my-appointments";

const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
    });
};

const formatTime = (time: string) => {
    const [h, m] = time.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${m} ${ampm}`;
};

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
    pending: { label: "Pending", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", icon: CalendarClock },
    accepted: { label: "Confirmed", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", icon: CheckCircle },
    declined: { label: "Declined", color: "text-red-700", bg: "bg-red-50 border-red-200", icon: XCircle },
    cancelled: { label: "Cancelled", color: "text-gray-700", bg: "bg-gray-50 border-gray-200", icon: Ban },
};

export default function BookAppointment() {
    const navigate = useNavigate();
    const [view, setView] = useState<ViewState>("doctors");
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [doctorSlots, setDoctorSlots] = useState<DoctorSlots | null>(null);
    const [myBookings, setMyBookings] = useState<MyBooking[]>([]);
    const [loading, setLoading] = useState(true);
    const [slotsLoading, setSlotsLoading] = useState(false);
    const [bookingsLoading, setBookingsLoading] = useState(false);
    const [bookingInProgress, setBookingInProgress] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
    const [bookingReason, setBookingReason] = useState("");
    const [bookingNotes, setBookingNotes] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    // â”€â”€â”€ Fetch doctors â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const fetchDoctors = async () => {
        setLoading(true);
        try {
            const res = await fetchWithAuth("/api/patient/available-doctors");
            if (res.ok) {
                const data = await res.json();
                setDoctors(data);
            }
        } catch (err) {
            console.error("Failed to fetch doctors:", err);
        } finally {
            setLoading(false);
        }
    };

    // â”€â”€â”€ Fetch doctor slots â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const fetchDoctorSlots = async (doctorId: string) => {
        setSlotsLoading(true);
        try {
            const res = await fetchWithAuth(`/api/patient/doctor/${doctorId}/slots`);
            if (res.ok) {
                const data = await res.json();
                setDoctorSlots(data);
                setView("slots");
            }
        } catch (err) {
            console.error("Failed to fetch slots:", err);
        } finally {
            setSlotsLoading(false);
        }
    };

    // â”€â”€â”€ Fetch my bookings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const fetchMyBookings = async () => {
        setBookingsLoading(true);
        try {
            const res = await fetchWithAuth("/api/patient/my-appointments");
            if (res.ok) {
                const data = await res.json();
                setMyBookings(data);
            }
        } catch (err) {
            console.error("Failed to fetch bookings:", err);
        } finally {
            setBookingsLoading(false);
        }
    };

    // â”€â”€â”€ Book appointment â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const handleBookAppointment = async () => {
        if (!selectedSlot || !doctorSlots || !bookingReason.trim()) return;

        setBookingInProgress(true);
        try {
            const res = await fetchWithAuth("/api/patient/book-appointment", {
                method: "POST",
                body: JSON.stringify({
                    doctor_id: doctorSlots.doctor.doctor_id,
                    slot_id: selectedSlot.slot_id,
                    reason: bookingReason,
                    notes: bookingNotes || undefined,
                }),
            });

            if (res.ok) {
                setSuccessMessage(`Appointment request sent to Dr. ${doctorSlots.doctor.full_name}! You'll be notified once the doctor accepts.`);
                setSelectedSlot(null);
                setBookingReason("");
                setBookingNotes("");
                // Refresh slots
                fetchDoctorSlots(doctorSlots.doctor.doctor_id);
                setTimeout(() => setSuccessMessage(""), 5000);
            } else {
                const err = await res.json();
                alert(err.detail || "Failed to book appointment");
            }
        } catch (err) {
            alert("Something went wrong. Please try again.");
        } finally {
            setBookingInProgress(false);
        }
    };

    // â”€â”€â”€ Cancel booking â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const handleCancelBooking = async (bookingId: string) => {
        if (!confirm("Are you sure you want to cancel this appointment?")) return;

        try {
            const res = await fetchWithAuth(`/api/patient/my-appointments/${bookingId}`, {
                method: "DELETE",
            });
            if (res.ok) {
                fetchMyBookings();
            } else {
                const err = await res.json();
                alert(err.detail || "Failed to cancel");
            }
        } catch (err) {
            alert("Something went wrong");
        }
    };

    useEffect(() => {
        fetchDoctors();
    }, []);

    // Group slots by date
    const slotsByDate: Record<string, TimeSlot[]> = {};
    if (doctorSlots) {
        for (const slot of doctorSlots.slots) {
            if (!slotsByDate[slot.date]) slotsByDate[slot.date] = [];
            slotsByDate[slot.date].push(slot);
        }
    }

    const filteredDoctors = doctors.filter((doc) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
            doc.full_name.toLowerCase().includes(q) ||
            doc.specialization.toLowerCase().includes(q) ||
            (doc.hospital_affiliation?.toLowerCase().includes(q) ?? false)
        );
    });

    return (
        <div className="min-h-screen bg-white pb-24">
            <FloatingNav />

            <main className="max-w-lg md:max-w-2xl lg:max-w-3xl mx-auto px-4 md:px-6 py-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                if (view === "slots" || view === "my-appointments") {
                                    setView("doctors");
                                    setDoctorSlots(null);
                                    setSelectedSlot(null);
                                } else {
                                    navigate("/");
                                }
                            }}
                            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </button>
                        <h1 className="text-xl font-bold text-gray-900">
                            {view === "my-appointments"
                                ? "My Appointments"
                                : view === "slots"
                                    ? "Available Slots"
                                    : "Book Appointment"}
                        </h1>
                    </div>
                </div>

                {/* Tab Toggle */}
                <div className="flex gap-2 mb-6">
                    <button
                        onClick={() => {
                            setView("doctors");
                            setDoctorSlots(null);
                            setSelectedSlot(null);
                        }}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
                            view !== "my-appointments"
                                ? "bg-gray-900 text-white shadow-lg"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        )}
                    >
                        <Stethoscope className="h-4 w-4" />
                        Find Doctors
                    </button>
                    <button
                        onClick={() => {
                            setView("my-appointments");
                            fetchMyBookings();
                        }}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
                            view === "my-appointments"
                                ? "bg-gray-900 text-white shadow-lg"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        )}
                    >
                        <CalendarCheck className="h-4 w-4" />
                        My Appointments
                    </button>
                </div>

                {/* Success Toast */}
                {successMessage && (
                    <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3 animate-in slide-in-from-top duration-300">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-emerald-800 font-medium">{successMessage}</p>
                    </div>
                )}

                {/* â”€â”€â”€ VIEW: Doctor List â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                {view === "doctors" && (
                    <>
                        {/* Search */}
                        <div className="relative mb-5">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                placeholder="Search by name, specialization, or hospital..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full h-11 rounded-xl bg-gray-50 border border-gray-200 pl-12 pr-4 text-sm text-gray-700 placeholder:text-gray-400 outline-none focus:border-gray-300 transition-all"
                            />
                        </div>

                        {loading ? (
                            <div className="text-center py-16">
                                <Loader2 className="h-8 w-8 text-gray-400 mx-auto animate-spin" />
                                <p className="mt-3 text-sm text-gray-500">Finding available doctors...</p>
                            </div>
                        ) : filteredDoctors.length === 0 ? (
                            <div className="text-center py-16 bg-gray-50 rounded-3xl">
                                <Stethoscope className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                                <h3 className="text-lg font-semibold text-gray-700 mb-1">No Doctors Found</h3>
                                <p className="text-sm text-gray-500">
                                    {searchQuery ? "Try a different search term" : "No doctors are currently available"}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {filteredDoctors.map((doc) => (
                                    <button
                                        key={doc.doctor_id}
                                        onClick={() => fetchDoctorSlots(doc.doctor_id)}
                                        disabled={slotsLoading}
                                        className="w-full text-left bg-white rounded-2xl p-5 border border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all group"
                                    >
                                        <div className="flex items-start gap-4">
                                            {/* Avatar */}
                                            <div className="h-14 w-14 rounded-2xl bg-gray-900 flex items-center justify-center text-white text-lg font-bold shadow-md flex-shrink-0">
                                                {doc.full_name
                                                    .split(" ")
                                                    .map((n) => n[0])
                                                    .join("")
                                                    .slice(0, 2)
                                                    .toUpperCase()}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1">
                                                    <h3 className="font-semibold text-gray-900 text-base truncate">
                                                        Dr. {doc.full_name.replace(/^(Dr\.?\s*)/i, "")}
                                                    </h3>
                                                    <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-gray-700 transition-colors flex-shrink-0" />
                                                </div>

                                                <div className="flex items-center gap-2 mb-2.5">
                                                    <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                                                        {doc.specialization}
                                                    </span>
                                                    {doc.available_slot_count > 0 && (
                                                        <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                                            {doc.available_slot_count} slots
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                                    {doc.experience_years > 0 && (
                                                        <span className="flex items-center gap-1">
                                                            <Briefcase className="h-3 w-3" />
                                                            {doc.experience_years} yrs exp
                                                        </span>
                                                    )}
                                                    {doc.rating != null && doc.rating > 0 && (
                                                        <span className="flex items-center gap-1">
                                                            <Star className="h-3 w-3 text-amber-500" />
                                                            {doc.rating.toFixed(1)}
                                                        </span>
                                                    )}
                                                    {doc.hospital_affiliation && (
                                                        <span className="flex items-center gap-1 truncate">
                                                            <MapPin className="h-3 w-3" />
                                                            {doc.hospital_affiliation}
                                                        </span>
                                                    )}
                                                </div>

                                                {doc.consultation_fee != null && doc.consultation_fee > 0 && (
                                                    <p className="mt-2 text-sm font-semibold text-gray-900">
                                                        â‚¹{doc.consultation_fee}{" "}
                                                        <span className="text-xs font-normal text-gray-500">per consultation</span>
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {/* â”€â”€â”€ VIEW: Doctor Slots â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                {view === "slots" && doctorSlots && (
                    <>
                        {/* Doctor info card */}
                        <div className="bg-gray-50 rounded-2xl p-5 border border-gray-200 mb-6">
                            <div className="flex items-center gap-4">
                                <div className="h-16 w-16 rounded-2xl bg-gray-900 flex items-center justify-center text-white text-xl font-bold shadow-lg flex-shrink-0">
                                    {doctorSlots.doctor.full_name
                                        .split(" ")
                                        .map((n) => n[0])
                                        .join("")
                                        .slice(0, 2)
                                        .toUpperCase()}
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900">
                                        Dr. {doctorSlots.doctor.full_name.replace(/^(Dr\.?\s*)/i, "")}
                                    </h2>
                                    <p className="text-sm text-gray-600 font-medium">
                                        {doctorSlots.doctor.specialization}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        {doctorSlots.doctor.qualification} â€¢ {doctorSlots.doctor.experience_years} yrs experience
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Slots grouped by date */}
                        {Object.keys(slotsByDate).length === 0 ? (
                            <div className="text-center py-16 bg-gray-50 rounded-3xl">
                                <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                                <h3 className="text-lg font-semibold text-gray-700 mb-1">No Available Slots</h3>
                                <p className="text-sm text-gray-500">This doctor has no open slots at the moment</p>
                            </div>
                        ) : (
                            <div className="space-y-5">
                                {Object.entries(slotsByDate).map(([date, slots]) => (
                                    <div key={date}>
                                        <div className="flex items-center gap-2 mb-3">
                                            <Calendar className="h-4 w-4 text-gray-500" />
                                            <h3 className="text-sm font-semibold text-gray-700">{formatDate(date)}</h3>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {slots.map((slot) => (
                                                <button
                                                    key={slot.slot_id}
                                                    onClick={() => setSelectedSlot(selectedSlot?.slot_id === slot.slot_id ? null : slot)}
                                                    className={cn(
                                                        "p-3 rounded-xl border-2 text-center transition-all",
                                                        selectedSlot?.slot_id === slot.slot_id
                                                            ? "border-gray-900 bg-gray-50 shadow-md ring-2 ring-gray-200"
                                                            : "border-gray-200 bg-white hover:border-gray-400 hover:shadow-sm"
                                                    )}
                                                >
                                                    <div className="flex items-center justify-center gap-1.5 mb-1">
                                                        <Clock className="h-3.5 w-3.5 text-gray-500" />
                                                        <span className="text-sm font-semibold text-gray-900">
                                                            {formatTime(slot.start_time)}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-gray-500">
                                                        to {formatTime(slot.end_time)}
                                                    </p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Booking form */}
                        {selectedSlot && (
                            <div className="mt-6 p-5 rounded-2xl bg-gradient-to-br from-gray-50 to-white border border-gray-200 shadow-sm animate-in slide-in-from-bottom duration-300">
                                <h3 className="text-base font-bold text-gray-900 mb-1">Book This Slot</h3>
                                <p className="text-xs text-gray-500 mb-4">
                                    {formatDate(selectedSlot.date)} â€¢ {formatTime(selectedSlot.start_time)} â€“ {formatTime(selectedSlot.end_time)}
                                </p>

                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs font-medium text-gray-700 mb-1 block">
                                            Reason for Visit <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            value={bookingReason}
                                            onChange={(e) => setBookingReason(e.target.value)}
                                            placeholder="e.g., General checkup, follow-up, specific symptom..."
                                            className="w-full h-11 rounded-xl bg-white border border-gray-200 px-4 text-sm text-gray-700 placeholder:text-gray-400 outline-none focus:border-gray-300 focus:ring-2 focus:ring-gray-100 transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-700 mb-1 block">
                                            Additional Notes <span className="text-gray-400">(optional)</span>
                                        </label>
                                        <textarea
                                            value={bookingNotes}
                                            onChange={(e) => setBookingNotes(e.target.value)}
                                            rows={2}
                                            placeholder="Any extra information for the doctor..."
                                            className="w-full rounded-xl bg-white border border-gray-200 px-4 py-3 text-sm text-gray-700 placeholder:text-gray-400 outline-none focus:border-gray-300 focus:ring-2 focus:ring-gray-100 transition-all resize-none"
                                        />
                                    </div>
                                    <Button
                                        onClick={handleBookAppointment}
                                        disabled={bookingInProgress || !bookingReason.trim()}
                                        className="w-full h-12 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-semibold text-sm shadow-lg transition-all"
                                    >
                                        {bookingInProgress ? (
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        ) : (
                                            <CalendarCheck className="h-4 w-4 mr-2" />
                                        )}
                                        {bookingInProgress ? "Sending Request..." : "Request Appointment"}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* â”€â”€â”€ VIEW: My Appointments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                {view === "my-appointments" && (
                    <>
                        {bookingsLoading ? (
                            <div className="text-center py-16">
                                <Loader2 className="h-8 w-8 text-gray-400 mx-auto animate-spin" />
                                <p className="mt-3 text-sm text-gray-500">Loading your appointments...</p>
                            </div>
                        ) : myBookings.length === 0 ? (
                            <div className="text-center py-16 bg-gray-50 rounded-3xl">
                                <CalendarCheck className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                                <h3 className="text-lg font-semibold text-gray-700 mb-1">No Appointments Yet</h3>
                                <p className="text-sm text-gray-500 mb-4">Browse doctors and book your first appointment</p>
                                <Button
                                    onClick={() => setView("doctors")}
                                    className="bg-gray-900 text-white rounded-xl px-6"
                                >
                                    Find Doctors
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {myBookings.map((booking) => {
                                    const sc = statusConfig[booking.status] || statusConfig.pending;
                                    const StatusIcon = sc.icon;
                                    return (
                                        <div
                                            key={booking.booking_id}
                                            className={cn(
                                                "rounded-2xl border p-4 transition-all",
                                                sc.bg
                                            )}
                                        >
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="h-10 w-10 rounded-xl bg-gray-900 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                                                        {booking.doctor_name
                                                            .replace(/^(Dr\.?\s*)/i, "")
                                                            .split(" ")
                                                            .map((n) => n[0])
                                                            .join("")
                                                            .slice(0, 2)
                                                            .toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-semibold text-gray-900 text-sm">
                                                            Dr. {booking.doctor_name.replace(/^(Dr\.?\s*)/i, "")}
                                                        </h4>
                                                        {booking.doctor_specialization && (
                                                            <p className="text-xs text-gray-500">{booking.doctor_specialization}</p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className={cn("flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold", sc.color, sc.bg)}>
                                                    <StatusIcon className="h-3.5 w-3.5" />
                                                    {sc.label}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4 text-xs text-gray-600 mb-2">
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="h-3.5 w-3.5" />
                                                    {formatDate(booking.date)}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Clock className="h-3.5 w-3.5" />
                                                    {formatTime(booking.start_time)} â€“ {formatTime(booking.end_time)}
                                                </span>
                                            </div>

                                            <p className="text-xs text-gray-700">
                                                <span className="font-medium">Reason:</span> {booking.reason}
                                            </p>

                                            {(booking.status === "pending" || booking.status === "accepted") && (
                                                <div className="mt-3 pt-3 border-t border-gray-200/50">
                                                    <button
                                                        onClick={() => handleCancelBooking(booking.booking_id)}
                                                        className="text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
                                                    >
                                                        Cancel Appointment
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}

