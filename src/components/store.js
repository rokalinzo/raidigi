"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Icon } from "./icons";

const StoreCtx = createContext(null);

export function StoreProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [toasts, setToasts] = useState([]);
  const loaded = useRef(false);

  useEffect(() => {
    try {
      const c = JSON.parse(localStorage.getItem("rdg_cart") || "[]");
      const w = JSON.parse(localStorage.getItem("rdg_wishlist") || "[]");
      if (Array.isArray(c)) setCart(c);
      if (Array.isArray(w)) setWishlist(w);
    } catch { /* abaikan */ }
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (loaded.current) localStorage.setItem("rdg_cart", JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    if (loaded.current) localStorage.setItem("rdg_wishlist", JSON.stringify(wishlist));
  }, [wishlist]);

  const toast = useCallback((msg, icon = "i-check") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg, icon }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }, []);

  const addToCart = useCallback((item) => {
    setCart((prev) => {
      const ex = prev.find((c) => c.key === item.key);
      if (ex) return prev.map((c) => (c.key === item.key ? { ...c, qty: c.qty + item.qty } : c));
      return [...prev, item];
    });
  }, []);

  const removeFromCart = useCallback((key) => {
    setCart((prev) => prev.filter((c) => c.key !== key));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const toggleWish = useCallback((slug) => {
    setWishlist((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
  }, []);

  const cartCount = cart.reduce((a, c) => a + c.qty, 0);

  return (
    <StoreCtx.Provider
      value={{ cart, addToCart, removeFromCart, clearCart, cartCount, wishlist, toggleWish, toast }}
    >
      {children}
      <div id="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div className="toast" key={t.id}>
            <Icon name={t.icon} />
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </StoreCtx.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore harus dipakai di dalam StoreProvider");
  return ctx;
}
