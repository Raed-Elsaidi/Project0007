import React from 'react';
import {
  FaArrowLeft,
  FaEnvelope,
  FaFacebookF,
  FaLinkedinIn,
  FaWhatsapp,
  FaShieldHalved,
  FaUserTie,
} from 'react-icons/fa6';
import raedLogo from './raed-logo1.jpg';
import ministryLogo from './logo.png';
import { useInstitution, institutionName, institutionLogo } from './institution';
import { supabase } from './supabaseClient';

export default function StaffPortalWelcome({
  onNavigateLogin,
  institutionId: institutionIdProp,
  institution: institutionProp,
}) {
  const [showContactModal, setShowContactModal] = React.useState(false);

  const institution = useInstitution(supabase);

  const currentInstitutionName = institutionName(institution);
  const currentInstitutionLogo = institutionLogo(institution) || ministryLogo;

  React.useEffect(() => {
    const contactModalEscapeHandler = (event) => {
      if (event.key === 'Escape') setShowContactModal(false);
    };
    if (showContactModal) window.addEventListener('keydown', contactModalEscapeHandler);
    return () => {
      window.removeEventListener('keydown', contactModalEscapeHandler);
    };
  }, [showContactModal]);

  const goToLogin = () => {
    if (typeof onNavigateLogin === 'function') {
      onNavigateLogin();
    }
  };

  return (
    <div className="staff-portal-page" dir="rtl">

      <style>{`
        * { box-sizing: border-box; }
        html, body, #root { margin: 0; min-height: 100%; }
        body { overflow-x: hidden; overflow-y: hidden; }

        .staff-portal-page {
          width: 100%;
          height: 100vh;
          min-height: 620px;
          overflow: hidden;
          position: relative;
          color: #fff;
          font-family: "Noto Kufi Arabic", "Noto Sans Arabic", Tahoma, sans-serif;
          background: #07182c url('/AlAqsa_StaffPortal_Background.png') center center / cover no-repeat;
        }

        .staff-portal-page::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          background:
            linear-gradient(180deg, rgba(2,14,30,.16) 0%, rgba(2,15,33,.08) 38%, rgba(0,10,24,.48) 100%),
            radial-gradient(circle at 50% 48%, rgba(0,0,0,.12), rgba(0,0,0,.42) 75%);
        }

        .staff-smoke {
          position: absolute;
          z-index: 1;
          left: 50%;
          top: 53%;
          width: min(74vw, 980px);
          height: min(48vh, 430px);
          transform: translate(-50%, -50%);
          pointer-events: none;
          opacity: .78;
          filter: blur(18px);
          background:
            radial-gradient(ellipse at 50% 48%, rgba(0,0,0,.78) 0%, rgba(0,0,0,.63) 30%, rgba(0,0,0,.30) 55%, transparent 78%),
            radial-gradient(ellipse at 18% 60%, rgba(0,0,0,.40) 0%, transparent 58%),
            radial-gradient(ellipse at 82% 42%, rgba(0,0,0,.38) 0%, transparent 58%);
          clip-path: polygon(5% 45%, 12% 25%, 24% 29%, 34% 12%, 47% 23%, 58% 8%, 71% 24%, 84% 18%, 96% 40%, 88% 58%, 95% 76%, 78% 72%, 68% 91%, 53% 77%, 39% 94%, 26% 76%, 12% 82%, 16% 62%, 3% 54%);
        }

        .staff-shell {
          position: relative;
          z-index: 2;
          height: 100vh;
          min-height: 620px;
          display: flex;
          flex-direction: column;
        }

        .staff-header {
          position: relative;
          flex: 0 0 112px;
        }

        .bismillah {
          position: absolute;
          top: 12px;
          left: 50%;
          transform: translateX(-50%);
          color: #fff;
          font-family: "Amiri", "Traditional Arabic", serif;
          font-size: clamp(18px, 1.65vw, 28px);
          font-weight: 800;
          white-space: nowrap;
          text-shadow: 0 3px 14px rgba(0,0,0,.8);
        }
        .bismillah::before, .bismillah::after {
          content: "";
          display: inline-block;
          width: 76px;
          height: 1px;
          margin: 0 12px 7px;
          background: rgba(255,255,255,.65);
        }

        .institution-brand {
          position: absolute;
          top: 24px;
          right: 22px;
          width: 210px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 3px;
        }
        .header-logo {
          width: 72px;
          height: 72px;
          object-fit: contain;
          border-radius: 50%;
          background: rgba(255,255,255,.92);
          padding: 2px;
          box-shadow: 0 5px 18px rgba(0,0,0,.35);
        }
        .institution-line {
          display: inline-block;
          color: #fff;
          background: rgba(2,16,34,.60);
          border: 1px solid rgba(255,255,255,.20);
          border-radius: 8px;
          padding: 2px 8px;
          font-size: 11px;
          line-height: 1.35;
          font-weight: 900;
          text-shadow: 0 1px 8px rgba(0,0,0,.7);
          backdrop-filter: blur(6px);
        }

        .staff-main {
          
          flex: 1 1 auto;
          min-height: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 0 20px 8px;
          
        
          position: relative;
          top: -45px;
        }

        .program-title {
          margin: -4px 0 5px;
          color: #ffffff;
          font-size: clamp(24px, 2.5vw, 38px);
          font-weight: 900;
          text-shadow: 0 3px 15px rgba(0,0,0,.85), 0 0 12px rgba(22,169,255,.25);
        }
        .program-title .program-exams-blue { color: #16a9ff; }
        .staff-title {
          display: none;
          margin: 0 0 4px;
          color: #fff;
          font-size: clamp(30px, 3.7vw, 52px);
          line-height: 1.1;
          font-weight: 950;
          text-align: center;
          text-shadow: 0 4px 20px rgba(0,0,0,.82);
        }
        .staff-title .accent { color: #16a9ff; }
        .staff-subtitle {
          margin: 0 0 7px;
          color: #72d5ff;
          font-size: clamp(15px, 1.55vw, 23px);
          font-weight: 800;
          text-shadow: 0 2px 12px rgba(0,0,0,.78);
        }
        .staff-description {
          max-width: 760px;
          margin: 0 0 13px;
          color: #f5f8ff;
          text-align: center;
          font-size: clamp(11px, 1vw, 15px);
          line-height: 1.75;
          text-shadow: 0 2px 10px rgba(0,0,0,.85);
        }

        .login-card {
          width: min(90vw, 300px);
          padding: 16px 18px 15px;
          border: 2px solid #f0b400;
          border-radius: 20px;
          background: rgba(25,24,22,.78);
          box-shadow: 0 12px 30px rgba(0,0,0,.46), 0 0 22px rgba(240,180,0,.14), inset 0 0 24px rgba(255,255,255,.025);
          backdrop-filter: blur(8px);
          text-align: center;
        }
        .login-icon {
          width: 62px;
          height: 62px;
          margin: 0 auto 7px;
          display: grid;
          place-items: center;
          border-radius: 15px;
          color: #ffc400;
          background: rgba(58,43,0,.84);
          border: 1px solid rgba(240,180,0,.45);
          box-shadow: 0 0 24px rgba(240,180,0,.25);
          font-size: 28px;
        }
        .login-title {
          margin: 0;
          color: #fff;
          font-size: 21px;
          font-weight: 950;
        }
        .login-description {
          margin: 5px 0 10px;
          color: #f3f3f3;
          font-size: 10px;
          line-height: 1.6;
        }
        .login-button {
          width: 56px;
          height: 56px;
          margin: 0 auto;
          border: 2px solid #fff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          background: radial-gradient(circle, #276dba 0%, #0a315e 72%);
          box-shadow: 0 0 18px rgba(70,178,255,.7), 0 0 0 4px rgba(255,196,0,.15);
          cursor: pointer;
          font: inherit;
          transition: transform .2s ease, filter .2s ease;
        }
        .login-button:hover { transform: scale(1.08); filter: brightness(1.1); }
        .login-button svg { font-size: 23px; }
        .login-button-text { display: none; }

        .vision {
          width: min(82vw, 900px);
          margin-top: 9px;
          padding: 5px 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          color: #fff;
          background: rgba(0, 55, 112, .82);
          border: 1px solid rgba(35,176,255,.70);
          border-radius: 10px;
          box-shadow: 0 6px 18px rgba(0,0,0,.25);
          backdrop-filter: blur(6px);
          text-align: center;
          font-size: 14px;
          line-height: 1.4;
          font-weight: 800;
        }
        .vision strong { color: #12a9ff; font-size: 17px; }
        .vision-icon { color: #12a9ff; font-size: 17px; filter: drop-shadow(0 0 7px rgba(18,169,255,.3)); }

        .staff-footer {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 7px;
          width: 100%;
          z-index: 20;
          min-height: 58px;
          height: 58px;
          padding: 8px 20px;
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          border-top: 1px solid rgba(255,255,255,.20);
          background: rgba(1,17,35,.90);
          backdrop-filter: blur(7px);
          overflow: hidden;
        }
        .footer-brand {
          transform: translateY(-6px);
          grid-column: 1;
          justify-self: start;
          display: flex;
          align-items: center;
          gap: 9px;
          direction: ltr;
          text-align: left;
        }
        .footer-logo {
          width: 45px !important;
          height: 45px !important;
          object-fit: contain;
          border-radius: 4px;
          background: #fff;
          padding: 1px;
        }
        .brand-name {
          font-size: 12px;
          line-height: 1.25;
          font-weight: 800;
          white-space: nowrap;
        }
        .brand-role {
          margin-top: 2px;
          font-size: 9px;
          line-height: 1.2;
          opacity: .82;
          white-space: nowrap;
        }
        .social-links {
          transform: translateY(-6px);
          grid-column: 2;
          justify-self: center;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .social-link {
          width: 34px;
          height: 34px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          text-decoration: none;
          border: 1px solid rgba(255,255,255,.28);
          border-radius: 8px;
          background: rgba(255,255,255,.08);
          transition: transform .2s ease, background .2s ease;
        }
        .footer-copy {
          transform: translateY(-6px);
          grid-column: 3;
          justify-self: end;
          text-align: right;
          direction: rtl;
          white-space: nowrap;
        }
        .staff-footer .footer-brand,
        .staff-footer .social-links,
        .staff-footer .footer-copy {
          transform: none;
          align-self: center;
        }

        @media (max-width: 760px) {
          .staff-footer {
            position: relative;
            min-height: 58px;
            height: 58px;
            padding: 8px 10px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            flex-wrap: wrap;
            overflow: visible;
          }
          .staff-footer .footer-brand,
          .staff-footer .social-links,
          .staff-footer .footer-copy {
            position: static;
            transform: none;
          }
          .staff-footer .footer-brand { order: 1; height: auto; }
          .staff-footer .social-links { order: 2; height: auto; 
          

          
        
          
        
          
          
          
        
          order: 2;
          margin: 0 auto;
          justify-content: center;
          align-items: center;
        }
          .staff-footer .footer-copy { order: 3; }

          body { overflow-y: auto; }
          .staff-portal-page, .staff-shell { height: auto; min-height: 100vh; overflow: visible; }
          .staff-header { flex-basis: 92px; }
          .bismillah { top: 7px; font-size: 14px; }
          .bismillah::before, .bismillah::after { width: 30px; margin: 0 6px 5px; }
          .institution-brand { top: 5px; right: 5px; width: 125px; }
          .header-logo { width: 52px; height: 52px; }
          .institution-line { font-size: 9px; padding: 2px 5px; }
          .staff-main { padding: 4px 10px 12px; transform: none; }
          .program-title { font-size: 22px; }
          .staff-title { font-size: 30px; }
          .staff-subtitle { font-size: 14px; }
          .staff-description { font-size: 10px; max-width: 92vw; margin-bottom: 10px; }
          .login-card { width: min(90vw, 290px); }
          .vision { width: 88vw; font-size: 9px; padding: 4px 9px; }
          .vision strong { font-size: 12px; }
          .vision-icon { font-size: 15px; }
          .staff-footer { min-height: 100px; height: auto; padding: 9px 8px; grid-template-columns: 1fr auto 1fr; }
          .footer-copy { width: auto; text-align: right; align-self: center; }
        }

        .contact-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 10000;
          display: grid;
          place-items: center;
          padding: 18px;
          background: rgba(0,0,0,.74);
          backdrop-filter: blur(7px);
        }
        .contact-modal {
          position: relative;
          width: min(520px, 94vw);
          padding: 28px 25px 22px;
          border: 2px solid #ffd43b;
          border-radius: 22px;
          background: linear-gradient(145deg,#061326,#0a2a4a);
          color: #fff;
          text-align: center;
          box-shadow: 0 22px 70px rgba(0,0,0,.62), 0 0 28px rgba(18,169,255,.13);
        }
        .contact-modal-x {
          position: absolute;
          top: 10px;
          left: 12px;
          width: 34px;
          height: 34px;
          border: 1px solid rgba(255,255,255,.3);
          border-radius: 50%;
          background: rgba(255,255,255,.08);
          color: #fff;
          font-size: 24px;
          cursor: pointer;
        }
        .contact-modal-logo {
          width: 76px;
          height: 76px;
          object-fit: contain;
          margin: 0 auto 8px;
          display: block;
          border-radius: 50%;
          border: 2px solid #12a9ff;
          box-shadow: 0 0 18px rgba(18,169,255,.25);
        }
        .contact-modal-kicker {
          color: #12a9ff;
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 2px;
        }
        .contact-modal h2 {
          margin: 4px 0 14px;
          color: #fff;
          font-size: 23px;
          font-weight: 950;
        }
        .contact-list {
          display: grid;
          gap: 9px;
        }
        .contact-list a {
          display: block;
          padding: 9px 12px;
          border: 1px solid rgba(18,169,255,.45);
          border-radius: 10px;
          background: rgba(18,169,255,.08);
          color: #fff;
          text-decoration: none;
          font-size: 13px;
          direction: ltr;
          transition: .2s ease;
        }
        .contact-list a:hover {
          border-color: #ffd43b;
          background: rgba(255,212,59,.08);
          transform: translateY(-1px);
        }
        .contact-modal-close-btn {
          margin-top: 16px;
          padding: 8px 30px;
          border: 1px solid #ffd43b;
          border-radius: 10px;
          background: #ffd43b;
          color: #061326;
          font: inherit;
          font-weight: 950;
          cursor: pointer;
        }
        @media (max-width: 700px) {
          .contact-top-btn { top: 10px; left: 10px; min-width: 98px; padding: 7px 11px; }
          .contact-modal { padding: 25px 16px 18px; }
          .contact-list a { font-size: 11px; }
        }


        .contact-modal-kicker {
          color: #12a9ff;
          font-size: 12px;
          font-weight: 950;
          letter-spacing: 2px;
          margin-bottom: 4px;
        }
        .contact-modal h2 {
          margin: 4px 0 18px;
          color: #fff;
          font-size: clamp(28px, 4vw, 42px);
          line-height: 1.2;
          font-weight: 950;
          text-align: center;
          text-shadow: 0 3px 12px rgba(0,0,0,.5);
        }
        .contact-modal h2 b {
          color: #12a9ff;
          font-weight: 950;
        }
        .contact-list {
          display: flex !important;
          flex-direction: row !important;
          direction: ltr;
          align-items: center;
          justify-content: center;
          gap: 18px;
          margin: 12px 0 18px;
        }
        .contact-list a {
          width: 66px;
          height: 66px;
          flex: 0 0 66px;
          display: grid !important;
          place-items: center;
          padding: 0 !important;
          border: 2px solid rgba(255,255,255,.88);
          border-radius: 15px;
          background: rgba(5,25,52,.82);
          color: #fff;
          text-decoration: none;
          font-size: 32px;
          box-shadow: 0 7px 20px rgba(0,0,0,.32), 0 0 14px rgba(18,169,255,.14);
          transition: transform .2s ease, border-color .2s ease, background .2s ease;
        }
        .contact-list a:hover {
          transform: translateY(-3px) scale(1.05);
          border-color: #ffd43b;
          background: rgba(18,169,255,.2);
        }
        @media (max-width: 700px) {
          .contact-list { gap: 10px; }
          .contact-list a {
            width: 52px;
            height: 52px;
            flex-basis: 52px;
            font-size: 25px;
          }
          .contact-modal h2 { font-size: 25px; }
        }

`}</style>

      <div className="staff-smoke" aria-hidden="true" />

      <div className="staff-shell">
        <header className="staff-header">
          <div className="bismillah">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>

          <div className="institution-brand" aria-label="بيانات المؤسسة">
            <img
              src={currentInstitutionLogo}
              alt={currentInstitutionName}
              className="header-logo"
              onError={(event) => {
                if (event.currentTarget.src !== ministryLogo) {
                  event.currentTarget.src = ministryLogo;
                }
              }}
            />

            {currentInstitutionName ? (
              <div className="institution-line">
                {currentInstitutionName}
              </div>
            ) : null}

            {institution.name_line_2 ? (
              <div className="institution-line">{institution.name_line_2}</div>
            ) : null}

            {institution.name_line_3 ? (
              <div className="institution-line">{institution.name_line_3}</div>
            ) : null}
          </div>
        </header>

        <main className="staff-main">
          <div className="program-title">برنامج <span className="program-exams-blue">الامتحانات</span> الالكتروني</div>
          <h1 className="staff-title" aria-hidden="true">بوابة الموظفين الإلكترونية</h1>
          <div className="staff-subtitle">نحو تعليم أكثر تطوراً وأماناً</div>
          <p className="staff-description">
            نظام متكامل لإدارة وتنظيم الامتحانات الإلكترونية مع تقنيات التعرف على الوجه لضمان هوية الطالب<br className="desktop-break" />
            وتحقيق أعلى مستويات النزاهة والشفافية.
          </p>

          <section className="login-card" aria-label="بوابة الموظفين">
            <div className="login-icon"><FaUserTie /></div>
            <h2 className="login-title">دخول الموظفين</h2>
            <p className="login-description">نظام ادارة الامتحانات الالكترونية</p>
            <button type="button" className="login-button" onClick={goToLogin} aria-label="دخول الموظفين">
              <FaArrowLeft />
              <span className="login-button-text">دخول الموظفين</span>
            </button>
          </section>

          <div className="vision">
            <span className="vision-icon" aria-hidden="true">🎓</span>
            <div><strong>رؤيتنا:</strong> التعليم هو جواز سفر للمستقبل، والغد والذين يستعدون له اليوم.</div>
            <span className="vision-icon" aria-hidden="true">🚀</span>
          </div>
        

      {showContactModal && (
        <div
          className="contact-modal-backdrop"
          onClick={() => setShowContactModal(false)}
          role="presentation"
        >
          <div
            className="contact-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-modal-title"
          >
            <button
              type="button"
              className="contact-modal-x"
              onClick={() => setShowContactModal(false)}
              aria-label="إغلاق"
            >
              ×
            </button>

            <img src={raedLogo} alt="Raed Elsaidi" className="contact-modal-logo" />
            <div className="contact-modal-kicker">ABOUT</div>
            <h2 id="contact-modal-title"><span>برنامج</span> <b>الامتحانات</b> <span>الالكتروني</span></h2>

            <div className="contact-list">
              <a href="mailto:elsaidiraed@gmail.com" aria-label="البريد الإلكتروني" title="elsaidiraed@gmail.com">
                <FaEnvelope />
              </a>
              <a href="https://www.facebook.com/raed.elsaidi" target="_blank" rel="noreferrer" aria-label="Facebook" title="https://www.facebook.com/raed.elsaidi">
                <FaFacebookF />
              </a>
              <a href="https://www.linkedin.com/in/raed-elsaidi-98b1033a6" target="_blank" rel="noreferrer" aria-label="LinkedIn" title="https://www.linkedin.com/in/raed-elsaidi-98b1033a6">
                <FaLinkedinIn />
              </a>
              <a href="https://wa.me/00970599242087" target="_blank" rel="noreferrer" aria-label="WhatsApp" title="WhatsApp 00970599242087">
                <FaWhatsapp />
              </a>
            </div>

            <button
              type="button"
              className="contact-modal-close-btn"
              onClick={() => setShowContactModal(false)}
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

        </main>

        <footer className="staff-footer">
          <div className="footer-brand">
            <img
              src={raedLogo}
              alt="Raed Logo"
              className="footer-logo"
            />
            <div>
              <div className="brand-name">ENG. RAED ELSAIDI</div>
              <div className="brand-role">Full Stack Web Developer</div>
            </div>
          </div>

          <div className="social-links" aria-label="روابط التواصل">
            <a
              className="social-link"
              href="https://wa.me/970599242087"
              target="_blank"
              rel="noreferrer"
              aria-label="WhatsApp"
            >
              <FaWhatsapp />
            </a>
            <a
              className="social-link"
              href="https://www.linkedin.com/in/raed-elsaidi-98b1033a6"
              target="_blank"
              rel="noreferrer"
              aria-label="LinkedIn"
            >
              <FaLinkedinIn />
            </a>
            <a
              className="social-link"
              href="https://www.facebook.com/raed.elsaidi"
              target="_blank"
              rel="noreferrer"
              aria-label="Facebook"
            >
              <FaFacebookF />
            </a>
            <a
              className="social-link"
              href="mailto:elsaidiraed@gmail.com"
              aria-label="Email"
            >
              <FaEnvelope />
            </a>
          </div>

          <div className="footer-copy">
            © 2026 — كافة الحقوق محفوظة
          </div>
        </footer>
      </div>
    </div>
  );
}
