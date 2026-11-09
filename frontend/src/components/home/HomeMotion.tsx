"use client";

import { useEffect, useRef } from "react";
import styles from "@/app/home.module.css";

export default function HomeMotion() {
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-assetflow-home]");

    if (!root) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const revealClasses = [
      styles.introGrid,
      styles.sectionTop,
      styles.featureCard,
      styles.solutionPhoto,
      styles.solutionContent,
      styles.centerHeading,
      styles.workflowCard,
      styles.rolesHeader,
      styles.roleCard,
      styles.ctaGrid,
    ];

    const revealSelector = revealClasses
      .filter(Boolean)
      .map((className) => `.${className}`)
      .join(", ");

    const elements = Array.from(
      root.querySelectorAll<HTMLElement>(revealSelector),
    );

    let observer: IntersectionObserver | null = null;

    if (!reducedMotion && typeof IntersectionObserver !== "undefined") {
      elements.forEach((element, index) => {
        element.dataset.reveal = "pending";

        element.style.setProperty("--reveal-delay", `${(index % 3) * 85}ms`);
      });

      root.dataset.motionEnabled = "true";

      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;

            const element = entry.target as HTMLElement;

            element.dataset.reveal = "visible";
            observer?.unobserve(element);
          });
        },
        {
          threshold: 0.08,
          rootMargin: "0px 0px -35px 0px",
        },
      );

      elements.forEach((element) => {
        observer?.observe(element);
      });
    }

    let animationFrame = 0;

    const updateProgress = () => {
      if (animationFrame) return;

      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = 0;

        const maximum =
          document.documentElement.scrollHeight - window.innerHeight;

        const progress =
          maximum > 0 ? Math.min(1, Math.max(0, window.scrollY / maximum)) : 0;

        if (progressRef.current) {
          progressRef.current.style.transform = `scaleX(${progress})`;
        }
      });
    };

    const handleNavigation = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) {
        return;
      }

      const link = event.target.closest<HTMLAnchorElement>('a[href^="#"]');

      if (!link || !root.contains(link)) {
        return;
      }

      const sectionId = decodeURIComponent(link.hash.slice(1));

      if (!sectionId) return;

      const destination = document.getElementById(sectionId);

      if (!destination || !root.contains(destination)) {
        return;
      }

      event.preventDefault();

      destination.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start",
      });

      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}#${encodeURIComponent(sectionId)}`,
      );

      const mobileMenu = link.closest("details");

      if (mobileMenu) {
        mobileMenu.open = false;
      }
    };

    root.addEventListener("click", handleNavigation);

    window.addEventListener("scroll", updateProgress, {
      passive: true,
    });

    window.addEventListener("resize", updateProgress);

    updateProgress();

    return () => {
      observer?.disconnect();

      root.removeEventListener("click", handleNavigation);

      window.removeEventListener("scroll", updateProgress);

      window.removeEventListener("resize", updateProgress);

      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }

      root.removeAttribute("data-motion-enabled");

      elements.forEach((element) => {
        element.removeAttribute("data-reveal");
        element.style.removeProperty("--reveal-delay");
      });
    };
  }, []);

  return (
    <div
      ref={progressRef}
      className={styles.scrollProgress}
      aria-hidden="true"
    />
  );
}
