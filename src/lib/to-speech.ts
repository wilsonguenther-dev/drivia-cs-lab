/**
 * Convert math-heavy text (LaTeX + unicode) into speakable English.
 * Shared by the bake script and the runtime so Gemini-baked audio matches
 * Kokori-live fallback word-for-word.
 *
 * Imperfect by design — Gemini Charon smooths over a lot. Goal: never say
 * "backslash sigma" or "dollar sign x".
 */

export function toSpeech(text: string): string {
  let s = text;

  // ── strip $...$ wrappers but keep contents ──
  s = s.replace(/\$([^$]+)\$/g, " $1 ");

  // ── LaTeX commands ──
  s = s
    .replace(/\\dfrac\{([^}]+)\}\{([^}]+)\}/g, " $1 over $2 ")
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, " $1 over $2 ")
    .replace(/\\sqrt\{([^}]+)\}/g, " square root of $1 ")
    .replace(/\\text\{([^}]*)\}/g, "$1")
    .replace(/\\mathbf\{([^}]*)\}/g, "$1")
    .replace(/\\boldsymbol\{([^}]*)\}/g, "$1");

  // ── greek letters (escape codes) ──
  const greek: Record<string, string> = {
    "sigma": "sigma", "alpha": "alpha", "beta": "beta", "gamma": "gamma",
    "delta": "delta", "epsilon": "epsilon", "theta": "theta", "lambda": "lambda",
    "mu": "mu", "pi": "pi", "eta": "eta", "rho": "rho", "tau": "tau",
    "phi": "phi", "chi": "chi", "psi": "psi", "omega": "omega",
    "Sigma": "capital sigma", "Theta": "capital theta", "Pi": "capital pi",
    "Lambda": "capital lambda", "Omega": "capital omega", "Delta": "capital delta",
  };
  for (const [k, v] of Object.entries(greek)) {
    s = s.replace(new RegExp(`\\\\${k}\\b`, "g"), v);
  }

  // ── exponents (must come before raw ^ replacements) ──
  s = s
    .replace(/\^\{-([^}]+)\}/g, " to the negative $1 ")
    .replace(/\^\{([^}]+)\}/g, " to the $1 ")
    .replace(/\^-(\w+)/g, " to the negative $1 ")
    .replace(/\^(\w+)/g, " to the $1 ");

  // ── subscripts ──
  s = s
    .replace(/_\{([^}]+)\}/g, " sub $1 ")
    .replace(/_(\w+)/g, " sub $1 ");

  // ── unicode greek + math symbols ──
  const uni: Record<string, string> = {
    "σ": "sigma", "α": "alpha", "β": "beta", "γ": "gamma", "δ": "delta",
    "ε": "epsilon", "ζ": "zeta", "η": "eta", "θ": "theta", "ι": "iota",
    "κ": "kappa", "λ": "lambda", "μ": "mu", "ν": "nu", "ξ": "xi",
    "π": "pi", "ρ": "rho", "τ": "tau", "υ": "upsilon", "φ": "phi",
    "χ": "chi", "ψ": "psi", "ω": "omega",
    "Σ": "capital sigma", "Θ": "capital theta", "Π": "capital pi",
    "Λ": "capital lambda", "Ω": "capital omega", "Δ": "capital delta",
    "∇": "nabla", "∂": "partial",
    "ŷ": "y hat", "x̂": "x hat",
    "×": " times ", "÷": " divided by ", "·": " dot ",
    "√": " square root of ",
    "‖": " norm of ",
    "≈": " approximately equal to ",
    "≤": " less than or equal to ",
    "≥": " greater than or equal to ",
    "≠": " not equal to ",
    "→": " maps to ",
    "²": " squared ",
    "³": " cubed ",
  };
  for (const [k, v] of Object.entries(uni)) {
    s = s.replaceAll(k, v);
  }

  // ── function-call notation: f(x) → "f of x" — only when no operator before paren ──
  s = s.replace(/([A-Za-z]\w*)\(/g, "$1 of (");

  // ── negative numbers in parens: (-3) → (negative 3) ──
  s = s.replace(/\(\s*-\s*(\d+(?:\.\d+)?)\s*\)/g, "(negative $1)");
  s = s.replace(/=\s*-\s*(\d+(?:\.\d+)?)/g, "equals negative $1");
  s = s.replace(/,\s*-\s*(\d+(?:\.\d+)?)/g, ", negative $1");

  // ── operators ──
  s = s
    .replace(/\s*=\s*/g, " equals ")
    .replace(/\s*\+\s*/g, " plus ")
    .replace(/\s*\*\s*/g, " times ")
    .replace(/(\d)\s*\/\s*(\d)/g, "$1 divided by $2");

  // ── arrays "[a, b, c]" → "the vector a, b, c" ──
  s = s.replace(/\[\s*([^\]]+?)\s*\]/g, (_, inside) => {
    const parts = inside.split(",").map((p: string) => p.trim()).filter(Boolean);
    if (parts.length <= 1) return inside;
    return ` the vector ${parts.join(", ")} `;
  });

  // ── cleanup ──
  s = s
    .replace(/\\/g, " ")        // any stray backslash
    .replace(/[{}]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();

  return s;
}
