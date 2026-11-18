import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { IconSprite } from "../components/icons";
import { StoreProvider } from "../components/store";
import Header from "../components/Header";
import Footer from "../components/Footer";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata = {
  title: "RaiDigi — Platform Jual Beli Produk Digital Terpercaya",
  description:
    "RaiDigi — platform jual beli produk digital terpercaya. Topup game, akun premium, voucher, dan item digital dengan proses cepat dan aman.",
  icons: { icon: "/assets/logo-38a70cd657.png" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={jakarta.className}>
      <head>
        <meta name="color-scheme" content="dark" />
      </head>
      <body>
        <IconSprite />
        <StoreProvider>
          <Header />
          <main>{children}</main>
          <Footer />
        </StoreProvider>
      </body>
    </html>
  );
}
