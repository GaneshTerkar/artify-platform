/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#e94560",
          dark: "#1a1a2e",
          muted: "#16213e",
        },
      },
    },
  },
  plugins: [],
};
