import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "#f7f8fc",
        ink: "#101828",
        primary: "#1d4ed8",
        accent: "#0891b2"
      }
    }
  },
  plugins: []
};

export default config;
