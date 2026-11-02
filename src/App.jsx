
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Menu,
  X,
  MoveUpRight,
  Building2,
  Ruler,
  Layers3,
  CheckCircle2,
  LoaderCircle,
} from "lucide-react";

gsap.registerPlugin(ScrollTrigger);


const services = [
  {
    number: "01",
    title: "Structural Design",
    description:
      "Practical, efficient structural systems designed around project requirements.",
    icon: Building2,
  },
  {
    number: "02",
    title: "Design Consultancy",
    description:
      "Technical guidance and coordination from early concepts to project delivery.",
    icon: Ruler,
  },
  {
    number: "03",
    title: "Planning & Analysis",
    description:
      "Careful planning and engineering analysis for dependable structures.",
    icon: Layers3,
  },
];

function Reveal({ children, className = "" }) {
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        element,
        { y: 32, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: 1,
          duration: 0.85,
          ease: "power3.out",
          scrollTrigger: {
            trigger: element,
            start: "top 88%",
            once: true,
          },
        }
      );
    }, element);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

export default function App() {
  const heroRef = useRef(null);
  const projectSectionRef = useRef(null);
  const projectTrackRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const [formSuccess, setFormSuccess] = useState(false);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [verificationToken, setVerificationToken] = useState("");

  // Local backend runs on port 5000. Override with VITE_API_URL only if needed.
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

  const [selectedImage, setSelectedImage] = useState(null);
  const [zoom, setZoom] = useState(1);

  const closeImageViewer = () => {
    setSelectedImage(null);
    setZoom(1);
  };


  useEffect(() => {
    const ctx = gsap.context(() => {
      const heroTimeline = gsap.timeline({ defaults: { ease: "power3.out" } });

      heroTimeline
        .from(".hero-label", {
          y: 18,
          autoAlpha: 0,
          duration: 0.6,
        })
        .from(
          ".hero-line",
          {
            yPercent: 110,
            duration: 0.9,
            stagger: 0.12,
          },
          "-=0.25"
        )
        .from(
          ".hero-copy, .hero-actions, .hero-meta",
          {
            y: 18,
            autoAlpha: 0,
            duration: 0.7,
            stagger: 0.12,
          },
          "-=0.35"
        )
        .from(
          ".hero-image",
          {
            clipPath: "inset(0 0 100% 0)",
            duration: 1.2,
          },
          "-=0.7"
        );

      gsap.to(".hero-image img", {
        yPercent: 10,
        ease: "none",
        scrollTrigger: {
          trigger: heroRef.current,
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });

      // Pin the project section and move the project cards horizontally.
      const section = projectSectionRef.current;
      const track = projectTrackRef.current;

      if (section && track && window.matchMedia("(min-width: 768px)").matches) {
        const getDistance = () =>
          Math.max(0, track.scrollWidth - section.clientWidth);

        gsap.to(track, {
          x: () => -getDistance(),
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: () => `+=${getDistance()}`,
            pin: true,
            scrub: 1,
            invalidateOnRefresh: true,
            anticipatePin: 1,
          },
        });
      }

      // Animate project cards as they enter the viewport on phones and tablets.
      // On mobile, the project gallery remains swipeable instead of being pinned.
      if (window.matchMedia("(max-width: 767px)").matches) {
        gsap.utils.toArray(".project-card").forEach((card, index) => {
          gsap.fromTo(
            card,
            { y: 36, autoAlpha: 0, scale: 0.97 },
            {
              y: 0,
              autoAlpha: 1,
              scale: 1,
              duration: 0.7,
              delay: (index % 2) * 0.06,
              ease: "power3.out",
              scrollTrigger: {
                trigger: card,
                start: "top 92%",
                once: true,
              },
            }
          );
        });
      }

      gsap.from(".hero-orbit", {
        rotation: -30,
        scale: 0.7,
        autoAlpha: 0,
        duration: 1.4,
        ease: "power3.out",
        delay: 0.3,
      });
    });

    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener("load", refresh);

    return () => {
      window.removeEventListener("load", refresh);
      ctx.revert();
    };
  }, []);

  async function handleSendOtp() {
    const customerEmail = email.trim().toLowerCase();

    if (!customerEmail) {
      setFormMessage("Please enter your email address first.");
      setFormSuccess(false);
      return;
    }

    try {
      setSendingOtp(true);
      setFormMessage("");
      const response = await fetch(`${API_URL}/api/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: customerEmail }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Could not send OTP.");

      setOtp("");
      setEmailVerified(false);
      setVerificationToken("");
      setFormMessage("OTP sent to your email. Please check Inbox and Spam.");
      setFormSuccess(true);
    } catch (error) {
      setFormMessage(error.message || "Could not send OTP. Please try again.");
      setFormSuccess(false);
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleVerifyOtp() {
    const customerEmail = email.trim().toLowerCase();
    const enteredOtp = otp.trim();

    if (!/^\d{6}$/.test(enteredOtp)) {
      setFormMessage("Please enter the six-digit OTP.");
      setFormSuccess(false);
      return;
    }

    try {
      setVerifyingOtp(true);
      setFormMessage("");
      const response = await fetch(`${API_URL}/api/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: customerEmail, otp: enteredOtp }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "OTP verification failed.");
      if (!result.verificationToken) throw new Error("Verification token was not returned.");

      setVerificationToken(result.verificationToken);
      setEmailVerified(true);
      setFormMessage("Your email has been verified. You can now send your enquiry.");
      setFormSuccess(true);
    } catch (error) {
      setEmailVerified(false);
      setVerificationToken("");
      setFormMessage(error.message || "OTP verification failed.");
      setFormSuccess(false);
    } finally {
      setVerifyingOtp(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!emailVerified || !verificationToken) {
      setFormMessage("Please verify your email before sending the enquiry.");
      setFormSuccess(false);
      return;
    }

    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      name: String(data.get("name") || "").trim(),
      email: email.trim().toLowerCase(),
      phone: String(data.get("phone") || "").trim(),
      message: String(data.get("message") || "").trim(),
      verificationToken,
    };

    try {
      setSending(true);
      setFormMessage("");
      setFormSuccess(false);
      const response = await fetch(`${API_URL}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Unable to send your enquiry.");

      setFormSuccess(true);
      setFormMessage("Thank you! Your enquiry has been sent to Alpha Engineering.");
      form.reset();
      setEmail("");
      setOtp("");
      setEmailVerified(false);
      setVerificationToken("");
    } catch (error) {
      setFormSuccess(false);
      setFormMessage(error.message || "Could not send your enquiry. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="min-h-screen overflow-x-clip bg-[#171816] text-[#f2f0e9]">
      {/* Navigation */}
      <header className="site-nav">
        <a
          href="#home"
          className="brand"
          onClick={(event) => {
            closeMenu();
            event.preventDefault();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          
      <div className="brand-mark brand-mark-large">
      <img
       src="/images/AE_logo.jpeg"
       alt="Alpha Engineering Logo"
        className="h-full w-full object-contain"
        />
       </div>

          <span>
            <span className="block text-[13px] font-semibold tracking-[0.14em]">
              ALPHA ENGINEERING
            </span>
            <span className="mt-0.5 block text-[9px] tracking-[0.28em] text-white/50">
              ENGINEERING .3D MODELING .DETAILING
            </span>
          </span>
        </a>

        <nav className={`nav-links ${menuOpen ? "nav-open" : ""}`}>
         
          
            {[
             ["Home", "#home"],
             ["About", "#about"],
             ["Services", "#services"],
             ["Projects", "#work"],
             ["Contact Us", "#contact"],
             ].map(([label, href]) => (
             <a key={label} href={href} onClick={closeMenu}>
            {label}
           </a>
           ))}

          <a
            href="#contact"
            className="nav-cta"
            onClick={closeMenu}
          >
            Start a project <ArrowUpRight size={14} />
          </a>
        </nav>

        <button
          type="button"
          className="menu-toggle"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
      </header>

      <main>
        {/* Hero */}
        <section
          id="home"
          ref={heroRef}
          className="hero-section section-wrap"
        >
          <div className="hero-main">
            <Reveal className="hero-label">
              <span className="status-dot" />
              STRUCTURAL DESIGN · ENGINEERING · CONSULTANCY
            </Reveal>

            <h1 className="hero-heading">
              <span className="hero-line-wrap">
                <span className="hero-line">Built on</span>
              </span>
              <span className="hero-line-wrap">
                <span className="hero-line accent-text">precision.</span>
              </span>
              <span className="hero-line-wrap">
                <span className="hero-line">Designed for</span>
              </span>
              <span className="hero-line-wrap">
                <span className="hero-line">the future<span className="orange-dot">.</span></span>
              </span>
            </h1>

            <p className="hero-copy max-w-[410px]">
              Thoughtful structural engineering and design solutions
              that bring ambitious ideas to life.
            </p>

            <div className="hero-actions">
              <a href="#work" className="button-primary">
                Explore our work <ArrowRight size={16} />
              </a>
              <a href="#about" className="text-link">
                Discover our approach <ArrowDown size={14} />
              </a>
            </div>

            <div className="hero-meta">
              <span>INDEPENDENT DESIGN STUDIO</span>
              <span>ENGINEERING WITH INTENT ↗</span>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-image">
              <img
                src="https://images.unsplash.com/photo-1493476523860-a6de6ce1b0c3?q=80&w=1169&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D"
                alt="Alpha Engineering structural project"
              />
              <div className="image-shade" />
              <div className="image-caption">
                <span>FORM FOLLOWS FUNCTION</span>
                <span>01 / 04</span>
              </div>
            </div>

            <div className="hero-orbit">
              <span>AE</span>
              <svg viewBox="0 0 100 100" aria-hidden="true">
                <defs>
                  <path
                    id="orbit-circle"
                    d="M50,50 m-35,0 a35,35 0 1,1 70,0 a35,35 0 1,1 -70,0"
                  />
                </defs>
                <text>
                  <textPath href="#orbit-circle">
                    STRUCTURE · VISION · PRECISION ·
                  </textPath>
                </text>
              </svg>
            </div>

            <div className="visual-index">
              <span className="visual-index-line" />
              <span>ENGINEERING THE DETAILS</span>
            </div>
          </div>

          <a href="#about" className="scroll-cue">
            <span>SCROLL TO EXPLORE</span>
            <ArrowDown size={14} />
          </a>
        </section>

        
{/* ABOUT US SECTION */}
<section
  id="about"
  className="bg-[#171815] text-[#f3f0e9] px-6 md:px-12 py-12 md:py-16"
>
  {/* Top label */}
  <div className="flex items-center justify-between mb-14">
    <span className="text-[10px] tracking-[0.2em] text-white/50 uppercase">
      01 / Who We Are
    </span>

    <span className="text-[10px] tracking-[0.2em] text-white/50 uppercase">
      Thoughtful by Design
    </span>
  </div>

  {/* Main content */}
  <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 pb-16">
    {/* Left heading */}
    <div className="lg:col-span-7">
      <h2 className="text-4xl sm:text-5xl md:text-6xl font-medium tracking-[-0.06em] leading-[1.08]">
        Engineering begins with{" "}
        <span className="text-[#ff792f]">good thinking.</span>
      </h2>
    </div>

    {/* Right description */}
    <div className="lg:col-span-5 lg:pt-1">
      <p className="text-white/65 text-sm md:text-[15px] leading-7 max-w-lg">
        Established in October 2020 by CK, Alpha Engineering has
        grown from an independent freelance initiative into a team
        of 5–6 professionals.
      </p>

      <p className="text-white/65 text-sm md:text-[15px] leading-7 max-w-lg mt-3">
        Based in Indore, India, we deliver structural steel
        detailing, mechanical design, 3D modeling, and product
        development with a focus on precision and practical design.
      </p>

      <a
        href="#services"
        className="inline-flex items-center gap-3 mt-6 text-sm text-[#f3f0e9] hover:text-[#ff792f] transition-colors group"
      >
        What we do
        <span className="text-lg transition-transform group-hover:translate-x-1">
          →
        </span>
      </a>
    </div>
  </div>

  {/* Bottom three points */}
  <div className="grid grid-cols-1 sm:grid-cols-3 border-t border-white/10">
    <div className="pt-8 pb-5 sm:pr-6">
      <h3 className="text-3xl md:text-4xl tracking-[-0.05em] font-normal">
        01 <span className="text-[#ff792f]">—</span>
      </h3>
      <p className="mt-4 text-xs md:text-sm text-white/50">
        Precision in every detail
      </p>
    </div>

    <div className="pt-8 pb-5 sm:px-6">
      <h3 className="text-3xl md:text-4xl tracking-[-0.05em] font-normal">
        02 <span className="text-[#ff792f]">—</span>
      </h3>
      <p className="mt-4 text-xs md:text-sm text-white/50">
        Practical, manufacturing-focused design
      </p>
    </div>

    <div className="pt-8 pb-5 sm:pl-6">
      <h3 className="text-3xl md:text-4xl tracking-[-0.05em] font-normal">
        03 <span className="text-[#ff792f]">—</span>
      </h3>
      <p className="mt-4 text-xs md:text-sm text-white/50">
        Dependable project delivery
      </p>
    </div>
  </div>

  {/* Closing statement */}
  <div className="border-t border-white/10 pt-6 mt-8">
    <p className="text-sm md:text-base text-white/55 leading-7">
      From an individual initiative to a growing engineering team —
      <span className="text-[#ff792f]">
        {" "}building precision into every project.
      </span>
    </p>
  </div>
</section>


        

        
{/* SERVICES */}
<section id="services" className="services-section section-wrap">
  {/* Header with original reveal animation */}
  <Reveal className="section-kicker">
    <span>02 / OUR EXPERTISE</span>
    <span>WHAT WE BRING TO THE TABLE</span>
  </Reveal>

  <Reveal>
    <h2 className="section-heading max-w-[850px]">
      Clear thinking.{" "}
      <span className="accent-text">Solid solutions.</span>
    </h2>
  </Reveal>

  {/* Compact services list */}
  <div className="service-list">
    {[
      {
        number: "01",
        title: "Structural Steel Detailing",
        description:
          "Tekla 3D modeling, fabrication and erection drawings, steel connections, and CNC/NC files.",
        icon: "▦",
      },
      {
        number: "02",
        title: "Mechanical Design",
        description:
          "Machine and SPM design, sheet metal fabrication, equipment modeling, and 2D CAD drawings.",
        icon: "⌁",
      },
      {
        number: "03",
        title: "Product Development",
        description:
          "Concept development, 3D modeling, design refinement, manufacturing, and prototype support.",
        icon: "◇",
      },
      {
        number: "04",
        title: "CAD & Engineering Support",
        description:
          "2D-to-3D conversion, CAD drawings, design optimization, modifications, and engineering documentation.",
        icon: "⌘",
      },
    ].map((service) => (
      <Reveal key={service.number}>
        <article className="service-card">
          <span className="service-number">{service.number}</span>

          <div className="service-icon">
            <span className="text-[#ff792f] text-xl">
              {service.icon}
            </span>
          </div>

          <div className="service-content">
            <h3>{service.title}</h3>
            <p>{service.description}</p>
          </div>

          <span className="service-arrow">
            ↗
          </span>
        </article>
      </Reveal>
    ))}
  </div>
</section>


<section
  id="work"
  ref={projectSectionRef}
  className="work-section"
>
  <div className="work-heading section-wrap">
    <div className="section-kicker">
      <span>03 / PROJECTS</span>
      <span>CONCEPT · DETAIL · EXECUTION</span>
    </div>

    <div className="work-title-row">
      <h2 className="section-heading">
        Ideas made <span className="accent-text">tangible.</span>
      </h2>

      <p className="work-instruction">
        <ArrowRight size={15} />
        SCROLL TO EXPLORE PROJECTS
      </p>
    </div>
  </div>

  <div className="project-viewport">
    <div ref={projectTrackRef} className="project-track">
      {[
        {
          number: "01",
          image: "/images/AE1.jpeg",
          title: "Piping & Ducting Detailing",
          category: "STRUCTURAL DESIGN",
          description:
            "Detailed piping and ducting drawings prepared for accurate fabrication and installation.",
          location: "ALPHA ENGINEERING",
        },
        {
          number: "02",
          image: "/images/AE2.jpeg",
          title: "Large-Scale Piping & Ducting",
          category: "STRUCTURAL DESIGN",
          description:
            "Detailing for a large-scale piping and ducting project with coordinated engineering drawings.",
          location: "ALPHA ENGINEERING",
        },
        {
          number: "03",
          image: "/images/AE3.jpeg",
          title: "Structural Analysis & Fabrication",
          category: "MECHANICAL DESIGN AND ANALYSIS",
          description:
            "Complete 3D modeling, structural analysis, fabrication drawings, and engineering documentation.",
          location: "ALPHA ENGINEERING",
        },
        {
          number: "04",
          image: "/images/AE4.jpeg",
          title: "Reliance Petrol Pump Structure",
          category: "STRUCTURAL DESIGN",
          description:
            "Custom petrol pump canopy featuring Y-shaped columns, designed for Reliance.",
          location: "RELIANCE PROJECT",
        },
        {
          number: "05",
          image: "/images/AE5.jpeg",
          title: "Reliance Canopy Design",
          category: "STRUCTURAL DESIGN",
          description:
            "Steel canopy design and detailing for a Reliance petrol pump project.",
          location: "RELIANCE PROJECT",
        },
        {
          number: "06",
          image: "/images/AE6.jpeg",
          title: "PB Warehouse Projects",
          category: "STRUCTURAL DESIGN",
          description:
            "Warehouse engineering across Central India, including detailing, erection and fabrication drawings, CNC files, and technical reports.",
          location: "CENTRAL INDIA",
        },
        {
          number: "07",
          image: "/images/AE7.jpeg",
          title: "Raipur Convention Centre",
          category: "STRUCTURAL DESIGN",
          description:
            "Structural design and connection detailing for a large convention centre project in Raipur.",
          location: "RAIPUR, INDIA",
        },
        {
          number: "08",
          image: "/images/AE8.jpeg",
          title: "Multistorey Office Complex",
          category: "STRUCTURAL DESIGN",
          description:
            "Structural design and detailing for a multistorey commercial office building.",
          location: "COMMERCIAL PROJECT",
        },
        {
          number: "09",
          image: "/images/AE9.jpeg",
          title: "Shivling-Inspired Hotel",
          category: "STRUCTURAL DESIGN",
          description:
            "An ongoing project in Ujjain featuring a distinctive Shivling-inspired structural form.",
          location: "UJJAIN, INDIA",
        },
        {
          number: "10",
          image: "/images/AE10.jpeg",
          title: "Four-Level Furnace Platform",
          category: "STRUCTURAL DESIGN",
          description:
            "Furnace-support platform structure with staircases, erection and fabrication drawings, and approval documentation.",
          location: "INDUSTRIAL PROJECT",
        },
        {
          number: "11",
          image: "/images/AE11.jpeg",
          title: "L-Shaped Warehouse",
          category: "STRUCTURAL DESIGN",
          description:
            "Large stepped, L-shaped warehouse design with engineering and fabrication documentation.",
          location: "WAREHOUSE PROJECT",
        },
        {
          number: "12",
          images: ["/images/AE12.jpeg", "/images/AE13.jpeg"],
          title: "Industrial Steel Structure",
          category: "STRUCTURAL DESIGN",
          description:
            "Integrated structural steel modeling and detailing, presented through two complementary project views.",
          location: "ALPHA ENGINEERING",
        },
      ].map((project, index) => {
        const number = index + 1;
        const images = project.images || [project.image];

        return (
          <article className="project-card" key={project.number}>
            <div
              className="project-image"
              style={{
                height: "260px",
                overflow: "hidden",
                borderRadius: "8px",
                background: "#e8edf3",
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: images.length > 1 ? "4px" : "0",
                padding: images.length > 1 ? "8px" : "0",
              }}
            >
              {images.map((image, imageIndex) => (
                <img
                  key={image}
                  src={image}
                  alt={`${project.title} - View ${imageIndex + 1}`}
                  loading={number <= 2 ? "eager" : "lazy"}
                  onClick={() => {
                    setSelectedImage({
                      ...project,
                      image,
                    });
                    setZoom(1);
                  }}
                  style={{
                    display: "block",
                    width: images.length > 1 ? "50%" : "100%",
                    height: "100%",
                    minWidth: 0,
                    objectFit: "contain",
                    objectPosition: "center",
                    padding: images.length > 1 ? "2px" : "10px",
                    cursor: "zoom-in",
                  }}
                />
              ))}

              <span className="project-image-number">
                {project.number} / 12
              </span>

              <a
                className="project-open"
                href="#contact"
                aria-label={`Enquire about ${project.title}`}
                onClick={(event) => event.stopPropagation()}
              >
                <MoveUpRight size={19} />
              </a>
            </div>

            <div className="project-details">
              <div>
                <span className="project-category">
                  {project.category}
                </span>

                <h3>{project.title}</h3>

                <p>{project.description}</p>
              </div>

              <span className="project-location">
                {project.location}
              </span>
            </div>
          </article>
        );
      })}

      <div className="project-end-card">
        <span className="status-dot" />
        <p>HAVE A PROJECT IN MIND?</p>
        <h3>Let's build something meaningful.</h3>

        <a href="#contact" className="button-primary">
          Let's talk <ArrowUpRight size={16} />
        </a>
      </div>
    </div>
  </div>

  <div className="work-footer section-wrap">
    <span>SELECTED PROJECTS / 01—12</span>

    <a href="#contact" className="text-link">
      Discuss your project <ArrowRight size={14} />
    </a>
  </div>
</section>












{/* IMAGE ZOOM MODAL */}
{selectedImage && (
  <div
    onClick={closeImageViewer}
    style={{
      position: "fixed",
      inset: 0,
      zIndex: 99999,
      background: "rgba(10, 10, 10, 0.94)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
    }}
  >
    <div
      onClick={(event) => event.stopPropagation()}
      style={{
        width: "min(100%, 1000px)",
        background: "#171815",
        border: "1px solid #333",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      {/* Modal Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "15px 20px",
          color: "#fff",
          borderBottom: "1px solid #333",
        }}
      >
        <div>
          <span style={{ color: "#ff792f", fontSize: "11px" }}>
            {selectedImage.number} / 13
          </span>

          <h3 style={{ marginTop: "4px", fontSize: "16px" }}>
            {selectedImage.title}
          </h3>
        </div>

        <button
          type="button"
          onClick={closeImageViewer}
          style={{
            color: "#fff",
            fontSize: "26px",
            padding: "5px 10px",
            cursor: "pointer",
          }}
          aria-label="Close image viewer"
        >
          ×
        </button>
      </div>

      {/* Zoomable Image */}
      <div
        style={{
          height: "min(65vh, 600px)",
          overflow: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#e8edf3",
        }}
      >
        <img
          src={selectedImage.image}
          alt={selectedImage.title}
          style={{
            display: "block",
            maxWidth: zoom === 1 ? "100%" : "none",
            maxHeight: zoom === 1 ? "100%" : "none",
            width: zoom === 1 ? "auto" : `${zoom * 650}px`,
            height: "auto",
            objectFit: "contain",
            transition: "width 0.2s ease",
          }}
        />
      </div>

      {/* Zoom Controls */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexWrap: "wrap",
          gap: "12px",
          padding: "16px",
          color: "#fff",
        }}
      >
        <button
          type="button"
          disabled={zoom <= 1}
          onClick={() =>
            setZoom((current) => Math.max(1, current - 0.25))
          }
          style={{
            padding: "9px 13px",
            border: "1px solid #555",
            borderRadius: "4px",
            color: "#fff",
            opacity: zoom <= 1 ? 0.4 : 1,
          }}
        >
          − Zoom Out
        </button>

        <span style={{ color: "#ff792f", minWidth: "45px", textAlign: "center" }}>
          {Math.round(zoom * 100)}%
        </span>

        <button
          type="button"
          disabled={zoom >= 3}
          onClick={() =>
            setZoom((current) => Math.min(3, current + 0.25))
          }
          style={{
            padding: "9px 13px",
            border: "1px solid #555",
            borderRadius: "4px",
            color: "#fff",
            opacity: zoom >= 3 ? 0.4 : 1,
          }}
        >
          + Zoom In
        </button>

        <button
          type="button"
          onClick={() => setZoom(1)}
          style={{
            padding: "9px 13px",
            border: "1px solid #ff792f",
            borderRadius: "4px",
            color: "#ff792f",
          }}
        >
          Reset
        </button>
      </div>
    </div>
  </div>
)}






        {/* Contact */}
        <section id="contact" className="contact-section section-wrap">
          <Reveal className="section-kicker">
            <span>04 / GET IN TOUCH</span>
            <span>LET'S START A CONVERSATION</span>
          </Reveal>

          <div className="contact-grid">
            <Reveal className="contact-intro">
              <h2 className="section-heading">
                Have a vision? <span className="accent-text">Let's build it.</span>
              </h2>
              <p>
                Tell us a little about your project. We would love to hear
                what you are planning.
              </p>
              
            <a
               href="https://www.linkedin.com/company/alpha-engineering-design-3d-modelling-detailing/"
               target="_blank"
                rel="noopener noreferrer"
                className="contact-email"
              >
               Connect on LinkedIn <ArrowUpRight size={16} />
             </a>

            </Reveal>

            <Reveal>
              <form className="contact-form" onSubmit={handleSubmit}>
                <div className="form-row">
                  <label>
                    YOUR NAME
                    <input
                      type="text"
                      name="name"
                      placeholder="Full name"
                      maxLength={100}
                      autoComplete="name"
                      required
                    />
                  </label>
                  <label>
                    EMAIL ADDRESS
                    <input
                      type="email"
                      name="email"
                      placeholder="you@example.com"
                      maxLength={254}
                      autoComplete="email"
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        setOtp("");
                        setEmailVerified(false);
                        setVerificationToken("");
                        setFormMessage("");
                      }}
                      required
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className="button-primary"
                    onClick={handleSendOtp}
                    disabled={sendingOtp || !email.trim() || emailVerified}
                  >
                    {sendingOtp ? "Sending OTP..." : emailVerified ? "Email Verified" : "Send OTP"}
                  </button>

                  {emailVerified && (
                    <span className="text-sm text-green-400">Email verified successfully</span>
                  )}
                </div>

                {!emailVerified && (
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="flex-1">
                      ENTER 6-DIGIT OTP
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="Enter OTP"
                        maxLength={6}
                        value={otp}
                        onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                      />
                    </label>
                    <button
                      type="button"
                      className="button-primary"
                      onClick={handleVerifyOtp}
                      disabled={verifyingOtp || otp.length !== 6 || !email.trim()}
                    >
                      {verifyingOtp ? "Verifying..." : "Verify OTP"}
                    </button>
                  </div>
                )}

                <label>
                  PHONE NUMBER
                  <input
                    type="tel"
                    name="phone"
                    placeholder="+91 00000 00000"
                    maxLength={30}
                    autoComplete="tel"
                    required
                  />
                </label>

                <label>
                  TELL US ABOUT YOUR PROJECT
                  <textarea
                    name="message"
                    placeholder="What are you looking to build?"
                    rows={3}
                    maxLength={5000}
                    required
                  />
                </label>

                <button
                  type="submit"
                  className="button-primary submit-button"
                  disabled={sending || !emailVerified || !verificationToken}
                >
                  {sending ? (
                    <>
                      Sending <LoaderCircle className="spin" size={16} />
                    </>
                  ) : (
                    <>
                      Send enquiry <ArrowRight size={16} />
                    </>
                  )}
                </button>

                {formMessage && (
                  <p
                    role="status"
                    className={`form-feedback ${
                      formSuccess ? "success-message" : "error-message"
                    }`}
                  >
                    {formSuccess && <CheckCircle2 size={16} />}
                    {formMessage}
                  </p>
                )}
              </form>
            </Reveal>
          </div>
        </section>

        {/* Footer */}
        <footer className="site-footer section-wrap">
          <a href="#home" className="brand footer-brand">
            <span className="brand-mark footer-brand-mark">
              <img
                src="/images/AE_logo.jpeg"
                alt="Alpha Engineering Logo"
                className="h-full w-full object-contain"
              />
            </span>
            <span>
              <span className="block text-[12px] font-semibold tracking-[0.14em]">
                Alpha Engineering
              </span>
              <span className="mt-0.5 block text-[9px] tracking-[0.28em] text-white/50">
               ENGINEERING .3D MODELING .DETAILING
              </span>
            </span>
          </a>

          <span className="footer-note">
            BUILT ON PRECISION. DESIGNED FOR THE FUTURE.
          </span>
          <a
            href="#home"
            className="back-top"
            onClick={(event) => {
              event.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            BACK TO TOP ↑
          </a>
          <span className="copyright">
            © {new Date().getFullYear()} Alpha Engineering
          </span>
        </footer>
      </main>
    </div>
  );
}

















