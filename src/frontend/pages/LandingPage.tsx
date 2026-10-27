import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LandingHeader } from '../landing/LandingHeader';
import { LandingFooter } from '../landing/LandingFooter';
import { CaseFile } from '../landing/CaseFile';
import {
  AfterStamp,
  ClosingCta,
  Gates,
  Hero,
  PhotoBand,
  Questions,
  RecordSection,
  ScopeSection,
  Showcase,
} from '../landing/Sections';
import type { StageKey } from '../landing/landingData';
import '../landing/landing.css';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const LandingPage: React.FC = () => {
  const pageRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<StageKey>('UNDER_REVIEW');

  useEffect(() => {
    const root = pageRef.current;
    if (!root) return;

    const header = root.querySelector<HTMLElement>('.fp-header');
    const chapters = Array.from(root.querySelectorAll<HTMLElement>('[data-chapter]'));

    const updateHeader = () => {
      if (!header || chapters.length === 0) return;
      const y = window.scrollY + 96;
      let current = chapters[0];
      for (const chapter of chapters) {
        const top = chapter.getBoundingClientRect().top + window.scrollY;
        if (top <= y) current = chapter;
      }
      header.dataset.chapter = current.dataset.chapter ?? 'hero';
      header.dataset.scrolled = window.scrollY > 48 ? 'true' : 'false';
    };

    updateHeader();
    window.addEventListener('scroll', updateHeader, { passive: true });
    window.addEventListener('resize', updateHeader);

    const reveals = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'));
    let observer: IntersectionObserver | undefined;
    const motionRoot = document.documentElement;

    if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
      reveals.forEach((element) => element.classList.add('is-visible'));
    } else {
      motionRoot.classList.add('fp-motion');
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.classList.add('is-visible');
            observer?.unobserve(entry.target);
          }
        },
        { threshold: 0.08, rootMargin: '0px 0px -6% 0px' }
      );
      reveals.forEach((element) => observer?.observe(element));
    }

    return () => {
      window.removeEventListener('scroll', updateHeader);
      window.removeEventListener('resize', updateHeader);
      observer?.disconnect();
      motionRoot.classList.remove('fp-motion');
    };
  }, []);

  const openStage = useCallback((next: StageKey) => {
    setStage(next);
    const target = document.getElementById('the-file');
    target?.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'start',
    });
  }, []);

  return (
    <div className="fp-landing" ref={pageRef}>
      <LandingHeader />

      <main id="top">
        <Hero />
        <Showcase />

        <section
          className="fp-file"
          id="the-file"
          data-chapter="dark"
          aria-labelledby="file-title"
        >
          <div className="fp-shell">
            <div className="fp-file__head" data-reveal>
              <h2 id="file-title">
                The file,
                <span>in six gates.</span>
              </h2>
              <p>
                Read it the way an officer would: one stage at a time. The ledger shows
                what arrived, what was checked and what the next gate requires.
              </p>
            </div>

            <div className="fp-file__case" data-reveal style={{ '--reveal-delay': '90ms' } as React.CSSProperties}>
              <CaseFile active={stage} onChange={setStage} />
            </div>

            <p className="fp-file__note" data-reveal>
              Sample file. No real institution data.
            </p>
          </div>
        </section>

        <Gates active={stage} onSelect={openStage} />
        <PhotoBand />
        <AfterStamp />
        <ScopeSection />
        <RecordSection />
        <Questions />
        <ClosingCta />
      </main>

      <LandingFooter />
    </div>
  );
};
