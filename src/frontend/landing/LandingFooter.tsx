import React from 'react';
import { NAV_LINKS, CASE_META } from './landingData';

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
            <li>
              <a
                href="https://commons.wikimedia.org/wiki/File:Front_AICTE_Head_Office_Delhi_Jan26_A7C_07986-7_PanoPg.jpg"
                target="_blank"
                rel="noreferrer"
              >
                AICTE Head Office, New Delhi
              </a>
              <span>Timothy A. Gonsalves · CC BY-SA 4.0</span>
            </li>
            <li>
              <a
                href="https://commons.wikimedia.org/wiki/File:College_of_Engineering,_Gunndy,_Chennai,_India.jpg"
                target="_blank"
                rel="noreferrer"
              >
                College of Engineering, Guindy
              </a>
              <span>N. Vivekananthamoorthy · CC BY 4.0</span>
            </li>
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
        <h2 className="fp-footer__wordmark" id="footer-title">
          FlowPilot
        </h2>
        <p className="fp-footer__legal">
          Independent prototype. Not an AICTE product. Sample records are illustrative.
          Photographs are unmodified apart from resizing; full credits are linked above.
        </p>
      </div>
    </div>
  </footer>
);
