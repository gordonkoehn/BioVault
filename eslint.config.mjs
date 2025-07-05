import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Disable TypeScript ESLint rules
      "@typescript-eslint/no-explicit-any": "off",
      // Disable Vercel/Next.js linking rules
      "@next/next/no-html-link-for-pages": "off",
      "@next/next/no-img-element": "off",
      "@next/next/no-page-custom-font": "off",
      "@next/next/no-styled-jsx-in-document": "off",
      "@next/next/no-sync-scripts": "off",
      "@next/next/no-title-in-document-head": "off",
      "@next/next/no-unwanted-polyfillio": "off",
    },
  },
];

export default eslintConfig;
