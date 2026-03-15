import { Poppins } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
});

export const metadata = {
  title: "BIDPal",
  description: "Unlock the value of what you already have.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning className={poppins.variable}>
      <body suppressHydrationWarning>
        <AuthProvider>
          <CartProvider>
            {children}
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
