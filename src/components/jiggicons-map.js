"use client";
/* Ikon Jiggicons (80 ikon gratis) untuk nama-nama sprite yang punya padanan.
   Dipakai oleh komponen Icon di icons.js — nama di luar peta ini tetap
   dirender dari sprite SVG lama. Suara tidak pernah diaktifkan (prop sound
   tidak dipasang); gerakan main saat hover/fokus pada kontrol di sekitarnya.
   Ukuran & warna diatur CSS .icon di globals.css (sama seperti ikon sprite),
   jadi prop size tidak dipasang di sini. */
import {
  Bell,
  Cart,
  Clock,
  Cube,
  Diamond,
  Flash,
  Gift,
  Heart,
  Home,
  Laptop,
  Mail,
  Message,
  Money,
  MusicNote2,
  Phone,
  Receipt,
  Trophy,
} from "jiggicons-react";

const MAP = {
  "i-home": Home,
  "i-cart": Cart,
  "i-receipt": Receipt,
  "i-bell": Bell,
  "i-clock": Clock,
  "i-gift": Gift,
  "i-heart": Heart,
  "i-mail": Mail,
  "i-phone": Phone,
  "i-msg": Message,
  "i-music": MusicNote2,
  "i-gem": Diamond,
  "i-zap": Flash,
  "i-coins": Money,
  "i-monitor": Laptop,
  "i-crown": Trophy,
  "i-package": Cube,
};

export function JiggiIcon({ name, cls = "" }) {
  const Cmp = MAP[name];
  if (!Cmp) return null;
  return <Cmp variant="outline" className={"icon " + cls} />;
}
