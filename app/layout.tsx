import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'NITW Market — Buy from seniors. Sell to juniors.',
  description:
    'The student-to-student marketplace for NIT Warangal. Buy and sell textbooks, electronics, cycles, hostel items, and more.',
  openGraph: {
    title: 'NITW Market',
    description: 'Buy from seniors. Sell to juniors. The NIT Warangal student marketplace.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NITW Market',
    description: 'Buy from seniors. Sell to juniors. The NIT Warangal student marketplace.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
