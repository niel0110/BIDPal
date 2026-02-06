import { AuthProvider } from "@/context/AuthContext";
import "./globals.css";

export const metadata = {
  title: "BIDPal",
  description: "Unlock the value of what you already have.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
