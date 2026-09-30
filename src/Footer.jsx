import React from 'react';
import { FaWhatsapp, FaLinkedinIn, FaFacebookF, FaEnvelope } from 'react-icons/fa';
import raedLogo from './raed-logo.png';

export default function Footer() {
  return (
    <footer className="site-footer" dir="rtl">
      <div className="footer-glow" />
      <div className="footer-inner">
        <div className="footer-brand">
          <img src={raedLogo} alt="Raed Elsaidi" />
          <div>
            <strong>Eng. Raed Khaleel Elsaidi</strong>
            <span>Full Stack Web Developer</span>
          </div>
        </div>
        <div className="footer-links">
          <a href="https://wa.me/970599242087" target="_blank" rel="noreferrer" title="WhatsApp">
            <FaWhatsapp /><span>00970599242087</span>
          </a>
          <a href="https://www.linkedin.com/in/raed-elsaidi-98b1033a6" target="_blank" rel="noreferrer" title="LinkedIn">
            <FaLinkedinIn /><span>LinkedIn</span>
          </a>
          <a href="https://www.facebook.com/raed.elsaidi" target="_blank" rel="noreferrer" title="Facebook">
            <FaFacebookF /><span>Facebook</span>
          </a>
          <a href="mailto:elsaidiraed@gmail.com" title="Gmail">
            <FaEnvelope /><span>elsaidiraed@gmail.com</span>
          </a>
        </div>
        <div className="footer-copy">
          <strong>© حقوق النسخ محفوظة 2026</strong>
          <span>برنامج الامتحانات الإلكترونية</span>
        </div>
      </div>
    </footer>
  );
}
