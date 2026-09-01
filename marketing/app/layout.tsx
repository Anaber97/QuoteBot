/* oxlint-disable react/only-export-components -- Next.js metadata is intentionally colocated with the root layout. */
import type { Metadata } from 'next';
import './globals.css';
import '../dark.css';
export const metadata:Metadata={
  metadataBase:new URL('https://towcalc.com'),
  title:'TowCalc — Faster, More Consistent Towing Quotes',
  description:'Quoting software built for towing operations. Turn your rates, equipment, service area, and business rules into fast, consistent, professional quotes.',
  openGraph:{title:'TowCalc — Quote faster. Stay consistent.',description:'Quoting software built for towing.',images:[{url:'/og.png',width:1200,height:630,alt:'TowCalc — Quote faster. Stay consistent.'}]},
  twitter:{card:'summary_large_image',title:'TowCalc — Quote faster. Stay consistent.',description:'Quoting software built for towing.',images:['/og.png']},
  icons:{icon:'/favicon.png',apple:'/favicon.png'}
};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>}
