import type { Metadata } from 'next';
import SiteNav from '../components/SiteNav';
import './globals.css';

export const metadata: Metadata = {
  title: 'MYCORP24 — Your Company. Always On.',
  description:
    '마케팅, 영업, 재무, 운영, 전략 등 회사에 필요한 AI 조직이 365일 24시간 움직이는 당신의 AI 회사.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <header className="site">
          <div className="wrap">
            <div>
              <span className="wordmark">MYCORP24</span>{' '}
              <span className="endorse">by AMOV</span>
            </div>
            <SiteNav />
          </div>
        </header>
        {children}
        <footer className="site">
          <div className="wrap">
            MYCORP24 by AMOV · Your Company. Always On.
          </div>
        </footer>
      </body>
    </html>
  );
}
