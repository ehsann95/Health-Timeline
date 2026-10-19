import "./globals.css";

export const metadata = {
  title: "LabReport Manager",
  description: "Store, compare and understand your lab reports",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
