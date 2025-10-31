import './globals.css';
export const metadata = { title: 'MySpinBot UI' };
export default function RootLayout({ children }) {
  return (
    <html lang='en'>
      <body className='min-h-screen bg-gray-950 text-gray-100'>
        <main className='p-6'>{children}</main>
      </body>
    </html>
  );
}

