import tseslint from "typescript-eslint";

export default tseslint.config(
    {
        ignores: ["dist/**", "build/**", "coverage/**", ".turbo/**"],
    },
    ...tseslint.configs.recommended
);
