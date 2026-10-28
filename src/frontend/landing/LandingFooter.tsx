import React from 'react';
import { NAV_LINKS, CASE_META } from './landingData';

const CREDITS = [
  {
    href: 'https://commons.wikimedia.org/wiki/File:Front_AICTE_Head_Office_Delhi_Jan26_A7C_07986-7_PanoPg.jpg',
    title: 'AICTE Head Office, New Delhi',
    credit: 'Timothy A. Gonsalves · CC BY-SA 4.0',
  },
  {
    href: 'https://commons.wikimedia.org/wiki/File:College_of_Engineering,_Gunndy,_Chennai,_India.jpg',
    title: 'College of Engineering, Guindy',
    credit: 'N. Vivekananthamoorthy · CC BY 4.0',
  },
  {
    href: 'https://commons.wikimedia.org/wiki/File:Mechanical_Laboratory_at_The_College_of_Engineering_-_Poona.jpg',
    title: 'Mechanical Laboratory, Poona',
    credit: 'Raphael Tuck & Sons · CC BY 4.0',
  },
  {
    href: 'https://commons.wikimedia.org/wiki/File:Sir_J_C_Bose_Laboratory_Complex_-_Indian_Institute_of_Technology_Campus_-_Kharagpur_-_West_Midnapore_2015-01-24_5085.jpg',
    title: 'Sir J. C. Bose Laboratory Complex',
    credit: 'Biswarup Ganguly · CC BY 3.0',
  },
];

export const LandingFooter: React.FC = () => (
  <footer className="fp-footer" data-chapter="dark" aria-labelledby="footer-title">
    <div className="fp-shell fp-footer__inner">
      <div className="fp-footer__cols">
        <div>
          <h3>This page</h3>
          <ul>
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href}>{link.label}</a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3>The product</h3>
          <ul>
            <li>Application file</li>
            <li>Document verification</li>
            <li>Compliance watch</li>
            <li>Expert committee inspections</li>
          </ul>
        </div>

        <div>
          <h3>The sample</h3>
          <ul>
            <li>{CASE_META.ref}</li>
            <li>{CASE_META.institution}</li>
            <li>12 Aug – 27 Sep 2026</li>
            <li>46 days · six gates</li>
          </ul>
        </div>

        <div>
          <h3>Pictures</h3>
          <ul>
            {CREDITS.map((item) => (
              <li key={item.href}>
                <a href={item.href} target="_blank" rel="noreferrer">
                  {item.title}
                </a>
                <span>{item.credit}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="fp-footer__middle">
        <p className="fp-footer__statement">
          Approval is not a mailbox. It is a file that can be read.
        </p>
        <p className="fp-footer__aside">
          Independent prototype for AICTE institutional approvals. Not an AICTE product.
        </p>
      </div>

      <div className="fp-footer__close">
        <h2 className="fp-sr-only" id="footer-title">
          FlowPilot
        </h2>
        <svg
          className="fp-footer__wordmark"
          viewBox="0 0 1000 168"
          role="img"
          aria-label="FlowPilot"
          preserveAspectRatio="xMidYMid meet"
        >
          <text
            x="0"
            y="142"
            textLength="1000"
            lengthAdjust="spacingAndGlyphs"
            fontFamily="'Plus Jakarta Sans', sans-serif"
            fontWeight="800"
            fontSize="170"
            letterSpacing="-10"
          >
            FlowPilot
          </text>
        </svg>
        <p className="fp-footer__legal">
          Independent prototype. Not an AICTE product. Sample records are illustrative.
          Photographs are cropped in layout; image files unmodified. Every picture is credited
          above with its source and licence.
        </p>
      </div>
    </div>
  </footer>
);
