import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: [".next", "node_modules", "next-env.d.ts", "public/editor"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx,mjs}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Secrets must never reach the browser bundle.
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[object.property.name='env'][property.name=/^NEXT_PUBLIC_.*(SECRET|KEY|PASSWORD)/]",
          message: "Never expose a secret through a NEXT_PUBLIC_ variable.",
        },
      ],
    },
  },
  prettier,
);
