import React from 'react';
import { LEGAL_BUSINESS_NAME, legalLinks } from '../legal/legalContent';

export default function Footer() {
  return <footer className="mt-auto border-t border-slate-800/80 px-4 py-6 text-center text-xs text-slate-500">
    <p>© 2026 {LEGAL_BUSINESS_NAME}. All rights reserved.</p>
    <nav aria-label="Legal" className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-2">
      <a className="hover:text-blue-400" href={legalLinks.privacy}>Privacy Policy</a>
      <a className="hover:text-blue-400" href={legalLinks.terms}>Terms of Use</a>
      <a className="hover:text-blue-400" href={legalLinks.contact}>Contact</a>
    </nav>
  </footer>;
}
