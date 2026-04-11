import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Brain, Eye, FileText, Activity } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

export function AboutSection() {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const ctx = gsap.context(() => {
            // Animate the header elements
            gsap.fromTo(
                ".about-header-element",
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

            // Animate the cards
            gsap.fromTo(
                ".about-card",
                { y: 40, opacity: 0 },
                {
                    y: 0,
                    opacity: 1,
                    duration: 0.8,
                    stagger: 0.15,
                    ease: "power2.out",
                    scrollTrigger: {
                        trigger: ".about-cards-container",
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
            id="about"
            className="w-full pt-20 pb-20 px-6 md:px-12 bg-[#fbfbfd] border-t border-slate-200/50"
        >
            <div className="max-w-7xl mx-auto">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-8 md:gap-16 mb-16">
                    <div className="md:w-1/2">
                        <div className="about-header-element inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-200 bg-white shadow-sm mb-6">
                            <Activity className="w-4 h-4 text-indigo-500" />
                            <span className="text-xs font-medium text-slate-600 uppercase tracking-tight">Why MediQ?</span>
                        </div>
                        {/* Reduced weight, tighter tracking, tighter leading */}
                        <h2 className="about-header-element text-3xl md:text-5xl font-medium text-slate-900 tracking-tight leading-tight">
                            Early health screening. <br />
                            <span className="text-slate-500">Clear answers. Smarter care.</span>
                        </h2>
                    </div>
                    <div className="md:w-1/2 md:pt-16">
                        {/* Reduced weight, tighter tracking, tighter leading */}
                        <p className="about-header-element text-[17px] font-normal text-slate-500 leading-normal tracking-tight">
                            MediQ is built to address gaps in early healthcare access by combining artificial intelligence,
                            explainable medical imaging, and unified health records into a single, easy-to-use platform.
                            The system prioritizes accessibility, transparency, and real-world feasibility.
                        </p>
                    </div>
                </div>

                {/* Cards Section */}
                <div className="about-cards-container grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Card 1 */}
                    <div className="about-card p-8 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-5">
                            <Brain className="w-6 h-6 text-slate-800" strokeWidth={1.5} />
                        </div>
                        <h3 className="text-xl font-medium text-slate-900 mb-2 tracking-tight">
                            AI-Powered Intelligence
                        </h3>
                        <p className="text-slate-500 leading-snug tracking-tight font-normal">
                            Advanced algorithms for symptom analysis and medical image screening to identify potential health risks early.
                        </p>
                    </div>

                    {/* Card 2 */}
                    <div className="about-card p-8 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-5">
                            <Eye className="w-6 h-6 text-slate-800" strokeWidth={1.5} />
                        </div>
                        <h3 className="text-xl font-medium text-slate-900 mb-2 tracking-tight">
                            Explainable Transparency
                        </h3>
                        <p className="text-slate-500 leading-snug tracking-tight font-normal">
                            Visual heatmaps and clear insights help you understand the 'why' behind every screening result.
                        </p>
                    </div>

                    {/* Card 3 */}
                    <div className="about-card p-8 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-5">
                            <FileText className="w-6 h-6 text-slate-800" strokeWidth={1.5} />
                        </div>
                        <h3 className="text-xl font-medium text-slate-900 mb-2 tracking-tight">
                            Unified Health Records
                        </h3>
                        <p className="text-slate-500 leading-snug tracking-tight font-normal">
                            A single secure Health ID that keeps your medical history, reports, and scans organized in one place.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}
