import { useRef, useEffect, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
    MessageSquare,
    ScanLine,
    Eye,
    Fingerprint,
    FileText,
    MapPin,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const features = [
    {
        icon: MessageSquare,
        title: "Symptom-Based AI Assistant",
        description:
            "Describe your symptoms through a conversational AI that asks follow-up questions and provides preliminary health insights based on trusted medical knowledge.",
        tag: "Conversational AI",
        number: "01",
    },
    {
        icon: ScanLine,
        title: "Medical Image Screening",
        description:
            "AI-assisted screening of medical images such as chest X-rays and skin lesion scans to identify potential abnormalities at an early stage.",
        tag: "Computer Vision",
        number: "02",
    },
    {
        icon: Eye,
        title: "Explainable AI (Grad-CAM)",
        description:
            "Visual heatmaps highlight regions influencing the AI's decision for abnormal scan results, improving transparency and user trust.",
        tag: "Transparency",
        number: "03",
    },
    {
        icon: Fingerprint,
        title: "Unified Health ID",
        description:
            "A unique Health ID securely stores and links your medical history, reports, and scan results across visits and doctors.",
        tag: "Identity",
        number: "04",
    },
    {
        icon: FileText,
        title: "Automated Medical Reports",
        description:
            "Structured, easy-to-understand medical reports generated automatically that can be shared directly with healthcare providers.",
        tag: "Reports",
        number: "05",
    },
    {
        icon: MapPin,
        title: "Doctor & Hospital Recommendations",
        description:
            "Based on symptoms and screening results, MediQ suggests nearby hospitals, clinics, and doctors for further consultation.",
        tag: "Recommendations",
        number: "06",
    },
];

export function FeaturesSection() {
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(true);

    const checkScroll = () => {
        if (!scrollRef.current) return;
        const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
        setCanScrollLeft(scrollLeft > 5);
        setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 5);
    };

    const scroll = (direction: "left" | "right") => {
        if (!scrollRef.current) return;
        const cardWidth = scrollRef.current.querySelector(".feature-card")?.clientWidth ?? 320;
        const gap = 20;
        const distance = cardWidth + gap;
        scrollRef.current.scrollBy({
            left: direction === "left" ? -distance : distance,
            behavior: "smooth",
        });
    };

    useEffect(() => {
        const el = scrollRef.current;
        if (el) {
            el.addEventListener("scroll", checkScroll, { passive: true });
            // Check initial state
            checkScroll();
            // Recheck after layout
            const timer = setTimeout(checkScroll, 100);
            return () => {
                el.removeEventListener("scroll", checkScroll);
                clearTimeout(timer);
            };
        }
    }, []);

    useEffect(() => {
        const ctx = gsap.context(() => {
            gsap.fromTo(
                ".features-header-el",
                { y: 30, opacity: 0 },
                {
                    y: 0,
                    opacity: 1,
                    duration: 0.8,
                    stagger: 0.1,
                    ease: "power2.out",
                    scrollTrigger: {
                        trigger: containerRef.current,
                        start: "top 80%",
                        toggleActions: "play none none reverse",
                    },
                }
            );

            gsap.fromTo(
                ".feature-card",
                { x: 60, opacity: 0 },
                {
                    x: 0,
                    opacity: 1,
                    duration: 0.6,
                    stagger: 0.08,
                    ease: "power2.out",
                    scrollTrigger: {
                        trigger: ".features-scroll-track",
                        start: "top 85%",
                        toggleActions: "play none none reverse",
                    },
                }
            );
        }, containerRef);

        return () => ctx.revert();
    }, []);

    return (
        <section
            ref={containerRef}
            id="features"
            className="w-full py-24 md:py-32 bg-[#fbfbfd]"
        >
            {/* Section Header */}
            <div className="max-w-7xl mx-auto px-6 md:px-12">
                <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-6 mb-12">
                    <div className="md:w-1/2">
                        <div className="features-header-el inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-200 bg-white shadow-sm mb-6">
                            <ScanLine className="w-4 h-4 text-indigo-500" />
                            <span className="text-xs font-medium text-slate-600 uppercase tracking-tight">
                                Core Features
                            </span>
                        </div>
                        <h2 className="features-header-el text-3xl md:text-5xl font-medium text-slate-900 tracking-tight leading-tight">
                            Everything you need
                            <br />
                            <span className="text-slate-500">
                                for smarter healthcare.
                            </span>
                        </h2>
                    </div>
                    <div className="md:w-1/3 flex flex-col items-start md:items-end gap-6">
                        <p className="features-header-el text-[17px] font-normal text-slate-500 leading-normal tracking-tight">
                            From AI-driven symptom analysis to explainable imaging — MediQ
                            brings clinical-grade tools to your fingertips.
                        </p>
                        {/* Navigation Arrows */}
                        <div className="features-header-el flex items-center gap-3">
                            <button
                                onClick={() => scroll("left")}
                                disabled={!canScrollLeft}
                                className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all duration-200 ${canScrollLeft
                                        ? "border-slate-300 bg-white text-slate-700 hover:bg-slate-900 hover:text-white hover:border-slate-900 shadow-sm cursor-pointer"
                                        : "border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed"
                                    }`}
                            >
                                <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
                            </button>
                            <button
                                onClick={() => scroll("right")}
                                disabled={!canScrollRight}
                                className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all duration-200 ${canScrollRight
                                        ? "border-slate-300 bg-white text-slate-700 hover:bg-slate-900 hover:text-white hover:border-slate-900 shadow-sm cursor-pointer"
                                        : "border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed"
                                    }`}
                            >
                                <ChevronRight className="w-5 h-5" strokeWidth={1.5} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Horizontal Scroll Track */}
            <div
                ref={scrollRef}
                className="features-scroll-track flex gap-5 overflow-x-auto pb-4 px-6 md:px-12 scroll-smooth"
                style={{
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                    WebkitOverflowScrolling: "touch",
                }}
            >
                {/* Left spacer for centering on large screens */}
                <div className="shrink-0 w-0 md:w-[calc((100vw-1280px)/2)]" />

                {features.map((feature) => {
                    const Icon = feature.icon;
                    return (
                        <div
                            key={feature.title}
                            className="feature-card group relative shrink-0 w-[280px] md:w-[300px] flex flex-col bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-slate-200/80 transition-all duration-300 overflow-hidden"
                        >
                            {/* Top accent bar */}
                            <div className="h-1 w-full bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 group-hover:from-indigo-400 group-hover:via-cyan-400 group-hover:to-indigo-400 transition-all duration-500" />

                            <div className="flex flex-col flex-1 p-7">
                                {/* Number & Tag */}
                                <div className="flex items-center justify-between mb-8">
                                    <span className="text-[32px] font-light text-slate-200 tracking-tight leading-none group-hover:text-indigo-200 transition-colors duration-300">
                                        {feature.number}
                                    </span>
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                                        {feature.tag}
                                    </span>
                                </div>

                                {/* Icon */}
                                <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-6 group-hover:bg-slate-900 group-hover:border-slate-900 transition-all duration-300">
                                    <Icon
                                        className="w-7 h-7 text-slate-700 group-hover:text-white transition-colors duration-300"
                                        strokeWidth={1.5}
                                    />
                                </div>

                                {/* Title */}
                                <h3 className="text-lg font-medium text-slate-900 mb-3 tracking-tight leading-snug">
                                    {feature.title}
                                </h3>

                                {/* Description */}
                                <p className="text-slate-500 leading-relaxed tracking-tight font-normal text-[14px] mt-auto">
                                    {feature.description}
                                </p>
                            </div>
                        </div>
                    );
                })}

                {/* Right spacer */}
                <div className="shrink-0 w-6 md:w-[calc((100vw-1280px)/2)]" />
            </div>

            {/* Hide scrollbar CSS */}
            <style>{`
        .features-scroll-track::-webkit-scrollbar {
          display: none;
        }
      `}</style>
        </section>
    );
}
