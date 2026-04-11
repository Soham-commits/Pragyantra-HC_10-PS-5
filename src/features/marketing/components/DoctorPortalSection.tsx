import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
    Stethoscope,
    ClipboardList,
    FilePlus,
    HeartPulse,
    ArrowRight,
} from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const capabilities = [
    {
        icon: ClipboardList,
        text: "View patient history via Health ID",
    },
    {
        icon: FilePlus,
        text: "Access AI-generated reports and scans",
    },
    {
        icon: Stethoscope,
        text: "Add clinical notes and prescriptions",
    },
    {
        icon: HeartPulse,
        text: "Support continuity of care",
    },
];

export function DoctorPortalSection() {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const ctx = gsap.context(() => {
            gsap.fromTo(
                ".doctor-el",
                { y: 30, opacity: 0 },
                {
                    y: 0,
                    opacity: 1,
                    duration: 0.8,
                    stagger: 0.12,
                    ease: "power2.out",
                    scrollTrigger: {
                        trigger: containerRef.current,
                        start: "top 80%",
                        toggleActions: "play none none reverse",
                    },
                }
            );
        }, containerRef);

        return () => ctx.revert();
    }, []);

    return (
        <section className="w-full py-8 md:py-12 px-4 md:px-8 bg-[#fbfbfd]">
            <div
                ref={containerRef}
                id="doctor-portal"
                className="w-full mx-auto py-20 md:py-28 px-6 md:px-16 bg-[#0a0a0a] text-white relative overflow-hidden rounded-3xl"
                style={{ maxWidth: "1440px" }}
            >
                {/* Subtle grid pattern background */}
                <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`,
                        backgroundSize: "60px 60px",
                    }}
                />

                <div className="max-w-7xl mx-auto relative z-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                        {/* Left - Content */}
                        <div>
                            <div className="doctor-el inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 mb-6">
                                <Stethoscope className="w-4 h-4 text-indigo-400" />
                                <span className="text-xs font-medium text-slate-400 uppercase tracking-tight">
                                    Doctor Portal
                                </span>
                            </div>

                            <h2 className="doctor-el text-3xl md:text-5xl font-medium tracking-tight leading-tight mb-6">
                                Designed for
                                <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
                                    healthcare professionals.
                                </span>
                            </h2>

                            <p className="doctor-el text-[17px] font-normal text-slate-400 leading-relaxed tracking-tight max-w-lg mb-10">
                                A dedicated portal that allows healthcare professionals to
                                securely access patient reports and medical history, add
                                diagnoses, prescriptions, and follow-up notes, and streamline
                                patient care.
                            </p>

                            <div className="doctor-el">
                                <Link to="/doctor/login">
                                    <Button className="h-12 rounded-full bg-white hover:bg-slate-100 text-slate-900 font-semibold shadow-lg shadow-white/10 px-8">
                                        Access Doctor Portal
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </Link>
                            </div>
                        </div>

                        {/* Right - Capabilities Cards */}
                        <div className="flex flex-col gap-4">
                            {capabilities.map((cap) => {
                                const Icon = cap.icon;
                                return (
                                    <div
                                        key={cap.text}
                                        className="doctor-el group flex items-center gap-5 p-6 rounded-2xl border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.1] transition-all duration-300"
                                    >
                                        <div className="w-12 h-12 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center shrink-0 group-hover:bg-indigo-500/20 group-hover:border-indigo-500/30 transition-all duration-300">
                                            <Icon
                                                className="w-5 h-5 text-slate-400 group-hover:text-indigo-400 transition-colors duration-300"
                                                strokeWidth={1.5}
                                            />
                                        </div>
                                        <p className="text-[16px] text-slate-300 tracking-tight font-normal">
                                            {cap.text}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
