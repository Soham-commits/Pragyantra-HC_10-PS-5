import { useRef, useLayoutEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MediqIcon } from "@/components/ui/MediqIcon";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Lock,
  ShieldCheck,
  Menu,
  ScanLine,
  Activity,
  Eye,
  UserCheck,
  Plus,
  Minus,
} from "lucide-react";
import { AboutSection } from "@/features/marketing/components/AboutSection";
import { FeaturesSection } from "@/features/marketing/components/FeaturesSection";
import { DoctorPortalSection } from "@/features/marketing/components/DoctorPortalSection";
import { TechSection } from "@/features/marketing/components/TechSection";

// Register the plugin globally before component renders
gsap.registerPlugin(ScrollTrigger);

const allFeatures = [
  // Original Compliance Cards (Large)
  {
    title: "AI Transparency",
    subtitle: "Explainable screening outputs",
    icon: ShieldCheck,
    points: [
      "Grad-CAM heatmaps",
      "Prediction confidence",
      "Model interpretability",
      "Clinician-readable insights",
    ],
  },
  {
    title: "Data Privacy",
    subtitle: "Security-first scan handling",
    icon: BadgeCheck,
    points: [
      "Secure scan storage",
      "Patient consent",
      "Encrypted processing",
      "Access control by role",
    ],
  },
  {
    title: "Clinical Oversight",
    subtitle: "Doctor-in-the-loop review",
    icon: BookOpen,
    points: [
      "Doctor review integration",
      "Annotation support",
      "Follow-up recommendations",
      "Screening audit trail",
    ],
  },
  {
    title: "Responsible AI",
    subtitle: "Ethical screening deployment",
    icon: Lock,
    points: [
      "Screening, not diagnosis",
      "Bias mitigation",
      "Dataset governance",
      "Human override path",
    ],
  },
  // Assurance Cards (Small)
  {
    title: "Skin Scan Upload",
    subtitle: "Capture lesions and run AI screening in minutes",
    icon: ScanLine,
  },
  {
    title: "Risk Classification",
    subtitle: "Clear abnormality scoring with confidence bands",
    icon: Activity,
  },
  {
    title: "Heatmap Visualization",
    subtitle: "Grad-CAM overlays for explainable screening",
    icon: Eye,
  },
  {
    title: "Doctor Review",
    subtitle: "Clinician validation before follow-up actions",
    icon: UserCheck,
  },
];

export default function Welcome() {
  const containerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const visualsRef = useRef<HTMLDivElement>(null);
  const complianceRef = useRef<HTMLDivElement>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  useLayoutEffect(() => {
    if (!containerRef.current) return;

    const ctx = gsap.context(() => {
      // 1. Initial Load - Entrance Animations
      const loadTl = gsap.timeline();

      // Background Text
      loadTl.fromTo(".hero-bg-text",
        { opacity: 0, scale: 0.9 },
        { opacity: 1, scale: 1, duration: 1.5, ease: "power4.out" }
      );

      // Central Phone Image â€” start from y:100 (no CSS translate class)
      loadTl.fromTo(".hero-phone",
        { y: 100, opacity: 0 },
        { y: 0, opacity: 1, duration: 1, ease: "power3.out" },
        "-=1"
      );

      // Left Description & Buttons
      loadTl.fromTo(".hero-left",
        { x: -50, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.8, ease: "power2.out" },
        "-=0.5"
      );

      // Right Title
      loadTl.fromTo(".hero-right",
        { x: 50, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.8, ease: "power2.out" },
        "-=0.8"
      );

      // 2. Scroll Interaction (Hero Pinning & Phone Animation)
      const scrollTl = gsap.timeline({
        scrollTrigger: {
          trigger: heroRef.current,
          start: "top top",
          end: "+=120%",
          pin: true,
          scrub: 1,
          anticipatePin: 1
        }
      });

      // Phone moves up â€” no scaling, just position shift
      scrollTl.fromTo(".hero-phone",
        { y: 0 },
        { y: -350, ease: "none" },
        0);

      // Mobile text below phone fades in as user scrolls
      scrollTl.fromTo(".hero-mobile-text",
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, ease: "power2.out" },
        0.2);

      // Hero background text "MediQ" fades out and shrinks as user scrolls
      scrollTl.fromTo(".hero-bg-text",
        { opacity: 1, scale: 1 },
        { opacity: 0, scale: 0.85, ease: "none" },
        0);


      // 3. Compliance Section - ScrollTriggers
      const complianceTrigger = {
        trigger: complianceRef.current,
        start: "top 80%",
        toggleActions: "play none none reverse"
      };

      gsap.fromTo(".compliance-header",
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: complianceTrigger
        }
      );

      const items = gsap.utils.toArray(".accordion-item");
      if (items.length > 0) {
        gsap.fromTo(items,
          { y: 20, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.6,
            stagger: 0.05,
            ease: "power2.out",
            scrollTrigger: {
              trigger: ".accordion-list",
              start: "top 85%",
              toggleActions: "play none none reverse"
            }
          }
        );
      }

    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-[#fbfbfd] text-slate-900 selection:bg-slate-200 overflow-x-hidden"
      style={{ fontFamily: '"Inter", "General Sans", sans-serif' }}
    >
      {/* Modern Floating Navbar - OUTSIDE hero so it persists through scroll */}
      <header className="fixed top-6 left-1/2 z-50 flex w-[90%] max-w-5xl -translate-x-1/2 items-center justify-between rounded-full bg-white/80 px-6 py-3 shadow-sm backdrop-blur-md border border-slate-200/60 ring-1 ring-slate-950/5 transition-all hover:shadow-md">
        <div className="flex items-center gap-2">
          <MediqIcon className="h-7 w-7 rounded-lg shadow-sm text-slate-900" />
          <span className="text-lg font-bold tracking-tight text-slate-900">MediQ</span>
        </div>
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <a href="#about" className="hover:text-slate-900 transition-colors">About</a>
          <a href="#features" className="hover:text-slate-900 transition-colors">Features</a>
          <a href="#doctor-portal" className="hover:text-slate-900 transition-colors">Doctor Portal</a>
          <a href="#technology" className="hover:text-slate-900 transition-colors">Technology</a>
          <a href="#compliance" className="hover:text-slate-900 transition-colors">Standards</a>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login">
            <Button className="h-9 rounded-full bg-slate-900 text-white hover:bg-slate-800 shadow-sm px-5">
              Login
            </Button>
          </Link>
          <Button variant="ghost" size="icon" className="md:hidden text-slate-900">
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Light Hero Section - Clean White */}
      <div ref={heroRef} className="relative w-full bg-[#fbfbfd] pb-8 md:pb-0 font-sans min-h-screen">

        {/* Background Big Text */}
        <div className="absolute inset-0 flex items-start justify-center pointer-events-none select-none overflow-hidden pt-28 md:pt-32">
          <h1 className="hero-bg-text text-[23vw] font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-slate-600 to-slate-900 leading-none whitespace-nowrap">
            MediQ
          </h1>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 container mx-auto h-full px-6 md:px-12 pt-36 md:pt-60">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-12 items-center cursor-default">

            {/* Left Column: Description - Desktop only */}
            <div className="hero-left hidden md:block md:col-span-3 md:self-center md:pl-16 md:order-1 opacity-0 mt-8 md:mt-12">
              <p className="text-slate-500 text-sm leading-tight mb-6 max-w-xs font-normal">
                Revolutionary AI for early skin abnormality detection. Secure, clinical-grade analysis.
              </p>
              <div className="flex flex-col gap-3">
                <Link to="/login">
                  <Button className="w-full md:w-auto h-12 rounded-full bg-white hover:bg-slate-50 text-slate-900 border border-slate-900 font-semibold shadow-lg shadow-slate-900/10">
                    Start Now <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <a href="#compliance" className="text-xs text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-2 font-medium">
                  <ShieldCheck className="h-3.5 w-3.5" /> View AI Safety Standards
                </a>
              </div>
            </div>

            {/* Center Column: Phone Image */}
            <div className="hero-phone md:col-span-6 flex flex-col items-center order-1 md:order-2 opacity-0 relative z-20 mt-16 md:mt-60">
              <img
                src="/phone.png"
                alt="MediQ App Interface"
                className="w-[240px] md:w-[340px] drop-shadow-2xl"
              />

              {/* Mobile-only: Title + Description + CTA below phone */}
              <div className="hero-mobile-text md:hidden flex flex-col items-center text-center mt-6 gap-3 opacity-0">
                <h2 className="text-xl font-medium leading-normal text-slate-900 tracking-tight">
                  AI-powered{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-cyan-500">Diagnosis.</span>
                </h2>
                <p className="text-slate-500 text-[13px] leading-normal max-w-[280px] font-normal">
                  Revolutionary AI for early skin abnormality detection. Secure, clinical-grade analysis.
                </p>
                <Link to="/login">
                  <Button className="h-10 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold shadow-lg px-6">
                    Start Now <ArrowRight className="ml-2 h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Right Column: Title - Desktop only */}
            <div className="hero-right hidden md:block md:col-span-3 md:self-center md:order-3 text-left opacity-0 translate-x-10 mt-8 md:mt-12">
              <h2 className="text-3xl md:text-5xl lg:text-5xl font-medium leading-tight text-slate-900 tracking-tight">
                AI-powered <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-cyan-500">Diagnosis.</span>
              </h2>
            </div>

          </div>
        </div>

        {/* Gradient Fade to connect sections */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-b from-transparent to-[#fbfbfd] pointer-events-none" />
      </div>

      <AboutSection />
      <FeaturesSection />
      <DoctorPortalSection />
      <TechSection />

      <section ref={complianceRef} id="compliance" className="relative mx-auto w-full max-w-7xl px-6 py-20 md:py-32 md:px-8 bg-[#fbfbfd]">
        <div className="compliance-header mx-auto max-w-3xl text-center opacity-0 translate-y-6">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">AI Integrity & Data Ethics</h2>
          <p className="mt-6 text-lg text-slate-600">
            Our platform is built on a foundation of clinical oversight, patient privacy, and rigorous responsible AI research.
          </p>
        </div>

        {/* Accordion List Layout */}
        <div className="accordion-list mt-16 w-full max-w-7xl mx-auto flex flex-col">
          <div className="mb-4 text-xs font-bold tracking-widest text-slate-500 uppercase flex items-center gap-2">
            AI STANDARDS
          </div>

          <div className="w-full border-t border-slate-200">
            {allFeatures.map((feature, index) => (
              <AccordionItem
                key={feature.title}
                feature={feature}
                isOpen={openIndex === index}
                onClick={() => setOpenIndex(prev => prev === index ? null : index)}
              />
            ))}
          </div>
        </div>


        <div className="mt-20 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link to="/login" className="w-full sm:w-auto">
            <Button className="h-12 w-full rounded-full px-10 text-base font-semibold shadow-md transition-transform active:scale-95 sm:w-auto">
              Scan as Patient
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link to="/doctor/login" className="w-full sm:w-auto">
            <Button variant="outline" className="h-12 w-full rounded-full px-10 text-base font-medium shadow-sm hover:bg-slate-50 active:scale-95 sm:w-auto">
              Review as Doctor
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer Section - Fixed & Cleaned */}
      <footer className="relative w-full bg-[#0a0a0a] text-white overflow-hidden py-24 px-6 md:px-12 font-sans border-t border-white/5">
        <div className="container mx-auto relative z-20">
          <div className="flex flex-col md:flex-row justify-between items-start gap-16 mb-[30rem]">

            {/* Logo & Tagline */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl font-bold tracking-tight text-white">MediQ</span>
                <div className="h-5 w-px bg-white/20"></div>
                <span className="text-sm text-slate-400 font-medium">Early Detection AI</span>
              </div>
              <p className="text-slate-500 text-sm max-w-xs leading-relaxed">
                Empowering patients and doctors with clinical-grade skin analysis tools.
              </p>
            </div>

            {/* Links Columns */}
            <div className="flex gap-16 md:gap-32 text-sm">
              <div className="flex flex-col gap-5">
                <h4 className="font-semibold text-white tracking-wide">Company</h4>
                <a href="#" className="text-slate-400 hover:text-white transition-colors">Blog</a>
                <a href="#" className="text-slate-400 hover:text-white transition-colors">About</a>
                <a href="#" className="text-slate-400 hover:text-white transition-colors">Careers</a>
              </div>
              <div className="flex flex-col gap-5">
                <h4 className="font-semibold text-white tracking-wide">Legal</h4>
                <a href="#" className="text-slate-400 hover:text-white transition-colors">Privacy</a>
                <a href="#" className="text-slate-400 hover:text-white transition-colors">Terms</a>
                <a href="#" className="text-slate-400 hover:text-white transition-colors">Security</a>
              </div>
            </div>
          </div>

          {/* Bottom Row */}
          <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-white/10 relative">
            <div className="text-xs text-slate-500 mb-4 md:mb-0 font-medium">
              Â© 2026 MediQ Health. All rights reserved.
            </div>

            <div className="flex items-center gap-4">

            </div>
          </div>
        </div>

        {/* Giant MediQ Text background - Fixed z-index & Color */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full pointer-events-none select-none flex justify-center items-center z-0 opacity-100">
          <h1 className="text-[25vw] font-bold text-[#36393d] tracking-tighter leading-none">
            MediQ
          </h1>
        </div>
      </footer>
    </div>
  );
}

function AccordionItem({ feature, isOpen, onClick }: { feature: any, isOpen: boolean, onClick: () => void }) {
  const Icon = feature.icon;
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <div className="accordion-item border-b border-slate-200 opacity-0">
      <button
        onClick={onClick}
        className="w-full py-6 flex items-center justify-between group text-left focus:outline-none"
      >
        <div className="flex items-center gap-4">
          <Icon className="h-6 w-6 text-slate-900 group-hover:text-slate-700 transition-colors" strokeWidth={1.5} />
          <h3 className="text-xl md:text-2xl font-normal text-slate-900 group-hover:text-slate-700 transition-colors">{feature.title}</h3>
        </div>
        <div className="text-slate-900 transition-transform duration-300">
          {isOpen ? <Minus className="h-6 w-6" strokeWidth={1.5} /> : <Plus className="h-6 w-6" strokeWidth={1.5} />}
        </div>
      </button>

      <div
        className={`overflow-hidden transition-all duration-500 ease-in-out ${isOpen ? 'opacity-100 mb-6' : 'opacity-0'}`}
        style={{ maxHeight: isOpen && contentRef.current ? contentRef.current.scrollHeight + 40 : 0 }}
      >
        <div ref={contentRef} className="text-slate-600 leading-relaxed text-base md:text-lg max-w-4xl ml-10 pl-4">
          <p className="mb-4">{feature.subtitle}</p>
          {feature.points && (
            <ul className="space-y-2 list-none">
              {feature.points.map((point: string) => (
                <li key={point} className="flex items-start gap-2">
                  <span className="text-slate-400 select-none">-</span>
                  {point}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

