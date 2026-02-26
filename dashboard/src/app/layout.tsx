import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SKILLGRAPH // MONOLITH',
  description: 'Personal AI-native knowledge graph',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="grid-overlay" />
        {children}
      </body>
    </html>
  );
}
