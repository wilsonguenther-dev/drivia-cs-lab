/**
 * Drivia CS Lab curriculum — undergrad → PhD.
 *
 * Each chapter has:
 *   • A history/intro video block at the top (Computerphile, MIT OCW, 3B1B, etc.)
 *   • An era tag (when this body of knowledge crystallized)
 *   • Topics, each with: plain English · formal definition · history · code in
 *     multiple languages · animation/visualization hooks · seminal papers ·
 *     practice problems · difficulty tier (undergrad / grad / research).
 *
 * Notation: KaTeX math is inline in `.formal` and `.steps[].math` fields.
 * Citation chips: `papers` array with author/year/title/url.
 */

export type Difficulty = "undergrad" | "grad" | "research";

export interface Paper {
  author: string;
  year: number;
  title: string;
  url?: string;
}

export interface VideoRef {
  id: string;          // YouTube ID
  source: string;      // "Computerphile" | "MIT OCW" | "3Blue1Brown" | …
  title: string;
}

export interface CSStep {
  math?: string;       // KaTeX
  code?: { lang: string; src: string };
  text: string;        // narration
}

export interface CSTopic {
  slug: string;
  title: string;
  difficulty: Difficulty;
  plain: string;
  formal?: string;     // KaTeX formal statement
  pronunciation?: string;
  history?: string;
  analogy?: string;
  example?: string;
  steps?: CSStep[];    // animated walkthrough
  code?: { lang: string; label: string; src: string }[];
  videos: VideoRef[];
  papers?: Paper[];
  reading?: string[];  // book chapters / lecture notes
}

export interface CSChapter {
  index: number;
  title: string;
  era?: string;
  blurb: string;
  videos: VideoRef[];          // chapter-level intro reel
  topics: CSTopic[];
}

// ──────────────────────────────────────────────────────────────────────
// CURRICULUM
// ──────────────────────────────────────────────────────────────────────

export const CHAPTERS: CSChapter[] = [
  {
    index: 1,
    title: "Foundations & History",
    era: "1830s · Babbage → 1936 · Turing → 1948 · Shannon",
    blurb: "Where the field came from. The dreams of Babbage and Lovelace, the rigor of Hilbert, the cut of Turing, the channel of Shannon. Read this once and the rest of the curriculum maps to a place.",
    videos: [
      { id: "dNRDvLACg5Q", source: "Veritasium", title: "Math Has a Fatal Flaw — Gödel & Turing" },
      { id: "macM_MtS_w4", source: "Computerphile", title: "Turing & The Halting Problem" },
      { id: "PLVCscCY4xI", source: "Royal Institution", title: "Ada Lovelace's Notes — Christmas Lectures" },
    ],
    topics: [
      {
        slug: "turing-machine",
        title: "Turing machine",
        difficulty: "undergrad",
        plain: "An imagined device with an infinite tape and a tiny rulebook. At each step it reads the symbol under its head, looks up the rule for that symbol in its current state, writes a new symbol, moves left or right, and changes state. Anything any computer can compute, a Turing machine can compute.",
        formal: "M = (Q, \\Sigma, \\Gamma, \\delta, q_0, q_{accept}, q_{reject})",
        pronunciation: "A Turing machine is a seven-tuple: a finite set of states Q, an input alphabet Sigma, a tape alphabet Gamma, a transition function delta from state and symbol to state, symbol, and direction, a start state q-zero, an accept state, and a reject state.",
        history: "Alan Turing proposed this model in 1936 in 'On Computable Numbers, with an Application to the Entscheidungsproblem' to formalize what 'computable' means and to prove the Halting Problem undecidable. The Entscheidungsproblem was Hilbert's challenge: is there a mechanical procedure that decides every mathematical statement? Turing's answer: no.",
        analogy: "A diligent clerk with an infinite scroll, a one-symbol stamp, and a flip-card of rules. The clerk has no memory of what came before this step — every decision is made from the current state and the symbol they're staring at.",
        example: "A two-state Turing machine can recognize the language { 0^n 1^n | n ≥ 1 }: zero out each 0 and the matching 1 alternately, walking the tape back and forth.",
        steps: [
          { math: "Q = \\{q_0, q_1, q_{accept}, q_{reject}\\}", text: "The machine has a finite set of states. Q is the set; each state is one configuration." },
          { math: "\\Sigma \\subsetneq \\Gamma", text: "The input alphabet sigma is a strict subset of the tape alphabet gamma. The tape may contain symbols the input never does, like the blank." },
          { math: "\\delta : Q \\times \\Gamma \\to Q \\times \\Gamma \\times \\{L, R\\}", text: "The transition function delta is the program. Given a state and the symbol under the head, it returns a new state, a symbol to write, and a direction to move." },
          { math: "q_0 \\in Q", text: "The machine starts in state q-zero with the input written on the tape." },
          { math: "q_{accept}, q_{reject} \\in Q", text: "If the machine ever enters the accept state, it halts and accepts. If it ever enters the reject state, it halts and rejects. Otherwise it runs forever." },
        ],
        code: [
          { lang: "python", label: "Python", src: `# A 5-state Turing machine that accepts 0^n 1^n
def step(tape, head, state, delta):
    sym = tape[head]
    new_state, new_sym, move = delta[(state, sym)]
    tape[head] = new_sym
    head += 1 if move == "R" else -1
    return tape, head, new_state` },
          { lang: "haskell", label: "Haskell", src: `data Move = L | R
type Delta = (State, Sym) -> (State, Sym, Move)
step :: Delta -> Tape -> Int -> State -> (Tape, Int, State)
step delta tape head state =
  let (s', sym', mv) = delta (state, tape !! head)
      tape' = update head sym' tape
      head' = if mv == R then head + 1 else head - 1
  in (tape', head', s')` },
        ],
        videos: [
          { id: "dNRDvLACg5Q", source: "Veritasium", title: "Math Has a Fatal Flaw" },
          { id: "macM_MtS_w4", source: "Computerphile", title: "Turing & The Halting Problem" },
        ],
        papers: [
          { author: "Turing, A.", year: 1936, title: "On Computable Numbers, with an Application to the Entscheidungsproblem", url: "https://www.cs.virginia.edu/~robins/Turing_Paper_1936.pdf" },
        ],
        reading: ["Sipser, Introduction to the Theory of Computation, Ch. 3", "Hopcroft & Ullman, Ch. 8"],
      },
      {
        slug: "church-turing-thesis",
        title: "Church–Turing thesis",
        difficulty: "undergrad",
        plain: "Every function that is effectively computable by any method — lambda calculus, recursive functions, Turing machines, your laptop, a quantum computer — is computable by a Turing machine. It is a thesis, not a theorem: it claims that our intuitive notion of 'effectively computable' coincides with a specific formal definition.",
        formal: "f \\text{ effectively computable} \\iff f \\text{ Turing-computable}",
        pronunciation: "The Church-Turing thesis says: a function is effectively computable if and only if it is Turing computable.",
        history: "Alonzo Church developed the lambda calculus in 1932-1936 to formalize functions. Turing developed his machines independently in 1936. Stephen Kleene proved the two models compute the same class of functions. Church and Turing each proposed their model captured 'effective calculability'; together they form the thesis.",
        analogy: "Different ways to describe a recipe — pictogram, English prose, a chef's flow chart — all reduce to the same dishes. Different models of computation all reduce to the same set of computable functions.",
        example: "JavaScript, x86 assembly, Lisp, Conway's Game of Life, the lambda calculus, and a Turing machine are all Turing-complete — each can simulate the others. Their computable sets are identical.",
        videos: [
          { id: "RvQczjU9hjU", source: "Computerphile", title: "What on Earth is Recursion?" },
        ],
        papers: [
          { author: "Church, A.", year: 1936, title: "An Unsolvable Problem of Elementary Number Theory" },
          { author: "Kleene, S.C.", year: 1936, title: "General Recursive Functions of Natural Numbers" },
        ],
      },
      {
        slug: "lambda-calculus",
        title: "Lambda calculus",
        difficulty: "grad",
        plain: "A tiny programming language with just three pieces: a variable, a function (lambda x. body), and an application (function argument). With those three you can express every computable function. Numbers, booleans, lists, recursion — all encoded as functions.",
        formal: "e ::= x \\mid \\lambda x.\\, e \\mid e\\, e",
        pronunciation: "An expression in lambda calculus is either a variable x, an abstraction lambda x dot e, or an application of one expression to another.",
        history: "Alonzo Church, 1932-1936. He wanted a foundation for math that didn't depend on set theory. Russell's paradox had broken Frege's set theory; Church's calculus avoided self-reference by carefully distinguishing functions from their arguments. Type theory grew out of this, eventually giving us ML, Haskell, and modern type systems.",
        analogy: "A vending machine. Insert an argument, the machine substitutes it into a slot, hands you the result. Stack vending machines and you can compute anything.",
        example: "Church-encoded booleans: TRUE = λx.λy.x, FALSE = λx.λy.y. AND = λp.λq.p q p. NOT = λp.λx.λy.p y x. Numbers: 0 = λf.λx.x, 1 = λf.λx.f x, 2 = λf.λx.f (f x). Successor: SUCC = λn.λf.λx.f (n f x).",
        steps: [
          { math: "\\lambda x.\\, x", text: "The identity function. Takes any argument and returns it." },
          { math: "(\\lambda x.\\, x)\\, y \\to_\\beta y", text: "Beta reduction: substitute the argument y for the bound variable x in the body." },
          { math: "(\\lambda x.\\, x\\, x)\\, (\\lambda x.\\, x\\, x)", text: "The omega combinator. Beta-reducing it produces itself forever — the simplest non-terminating term." },
          { math: "Y = \\lambda f.\\, (\\lambda x.\\, f\\, (x\\, x))\\, (\\lambda x.\\, f\\, (x\\, x))", text: "The Y combinator gives you recursion without naming the function. Y(f) = f(Y(f))." },
        ],
        code: [
          { lang: "haskell", label: "Haskell", src: `-- Identity, application, composition
id' = \\x -> x
apply f x = f x
compose f g = \\x -> f (g x)
-- Church numerals
zero  = \\f x -> x
one   = \\f x -> f x
succ' = \\n f x -> f (n f x)` },
          { lang: "python", label: "Python", src: `# Lambda calculus is a one-liner in Python
TRUE  = lambda x: lambda y: x
FALSE = lambda x: lambda y: y
AND   = lambda p: lambda q: p(q)(p)
# Church numerals
ZERO  = lambda f: lambda x: x
SUCC  = lambda n: lambda f: lambda x: f(n(f)(x))
def to_int(n): return n(lambda x: x + 1)(0)` },
        ],
        videos: [
          { id: "eis11j_iGMs", source: "Computerphile", title: "Lambda Calculus" },
          { id: "3VQ382QG-y4", source: "Graham Hutton", title: "Lambda Calculus Intro" },
        ],
        papers: [
          { author: "Church, A.", year: 1936, title: "An Unsolvable Problem of Elementary Number Theory" },
          { author: "Barendregt, H.", year: 1984, title: "The Lambda Calculus: Its Syntax and Semantics" },
        ],
        reading: ["Pierce, TAPL Ch. 5–6", "Selinger, Lecture Notes on the Lambda Calculus"],
      },
      {
        slug: "shannon-information",
        title: "Information & entropy",
        difficulty: "undergrad",
        plain: "Information measures surprise. A coin flip carries 1 bit because two outcomes are equally likely. A six-sided die carries log₂(6) ≈ 2.58 bits. Shannon entropy is the average surprise of a probability distribution — the lower bound on how few bits per symbol you need to encode it.",
        formal: "H(X) = -\\sum_{x \\in \\mathcal{X}} p(x) \\log_2 p(x)",
        pronunciation: "The entropy of a random variable X equals negative the sum over all outcomes x of the probability of x times log base two of the probability of x.",
        history: "Claude Shannon, 1948, 'A Mathematical Theory of Communication' in Bell System Technical Journal. He single-handedly created the field of information theory. The paper introduced bits, entropy, channel capacity, and the noisy-channel coding theorem. Every modern modem, codec, and compression algorithm traces to it.",
        analogy: "How many yes/no questions you need to ask to pin down a random outcome on average. Two equiprobable options: 1 question. Eight equiprobable options: 3 questions. Skewed distribution: fewer, because guessing the common one first wins.",
        example: "English text averages about 1.0–1.5 bits per character even though there are 27 possible symbols (log₂(27) ≈ 4.75). Compression algorithms exploit that gap.",
        steps: [
          { math: "p(x)", text: "Each outcome x has a probability p(x)." },
          { math: "I(x) = -\\log_2 p(x)", text: "The information content of a single outcome is its self-information: rare events carry more information." },
          { math: "H(X) = \\mathbb{E}[I(X)] = -\\sum p(x) \\log_2 p(x)", text: "The entropy is the expected information content — average surprise per draw." },
          { math: "H(X) \\le \\log_2 |\\mathcal{X}|", text: "Maximum entropy occurs when the distribution is uniform." },
        ],
        videos: [
          { id: "ErfnhcEV1O8", source: "3Blue1Brown", title: "Solving Wordle using information theory" },
          { id: "9TJI8jjuQfg", source: "Steve Brunton", title: "Shannon Entropy" },
        ],
        papers: [
          { author: "Shannon, C.E.", year: 1948, title: "A Mathematical Theory of Communication", url: "https://people.math.harvard.edu/~ctm/home/text/others/shannon/entropy/entropy.pdf" },
        ],
        reading: ["Cover & Thomas, Elements of Information Theory, Ch. 2", "MacKay, ITILA, Ch. 2"],
      },
    ],
  },

  {
    index: 2,
    title: "Mathematical Foundations",
    era: "1850s · Boole → 1879 · Frege → 1931 · Gödel",
    blurb: "The math your code stands on. Sets, logic, proof, induction, combinatorics, graphs, probability. Skip nothing — these are the load-bearing axioms.",
    videos: [
      { id: "MFRhgmFTjbk", source: "Computerphile", title: "What's so Special about Set Theory?" },
      { id: "I4pQbo5MQOs", source: "Computerphile", title: "Gödel's Incompleteness Theorem" },
    ],
    topics: [
      {
        slug: "set-theory",
        title: "Sets, relations, functions",
        difficulty: "undergrad",
        plain: "A set is an unordered collection of distinct elements. A relation between two sets is a subset of their Cartesian product. A function is a relation where every input maps to exactly one output. From these three you build every data structure in computing.",
        formal: "f : A \\to B \\iff \\forall a \\in A,\\ \\exists!\\, b \\in B : (a, b) \\in f",
        pronunciation: "f is a function from A to B if and only if for every a in A there exists a unique b in B such that the pair a comma b is in f.",
        history: "Georg Cantor founded modern set theory in the 1870s. Russell's paradox (1901) broke naive set theory — 'the set of all sets that don't contain themselves.' Zermelo and Fraenkel patched it with axiomatic set theory (ZFC, 1908-1922), the foundation most working mathematicians use today.",
        analogy: "A set is a sack with no order and no duplicates. A function is a no-cheating lookup table: every key has exactly one value.",
        example: "Database keys form a set. A foreign-key constraint is a function from one table's rows to another's primary keys. SQL's GROUP BY partitions rows into an equivalence relation.",
        videos: [
          { id: "MFRhgmFTjbk", source: "Computerphile", title: "What's so Special about Set Theory?" },
        ],
        papers: [
          { author: "Cantor, G.", year: 1874, title: "Über eine Eigenschaft des Inbegriffes aller reellen algebraischen Zahlen" },
        ],
        reading: ["Halmos, Naive Set Theory", "Enderton, Elements of Set Theory"],
      },
      {
        slug: "induction",
        title: "Mathematical induction",
        difficulty: "undergrad",
        plain: "Prove a property P holds for every natural number by showing two things: P(0) is true, and if P(n) is true then P(n+1) is true. The dominos all fall. Strong induction lets you assume P(k) for every k ≤ n.",
        formal: "(P(0) \\land \\forall n.\\, P(n) \\Rightarrow P(n+1)) \\Rightarrow \\forall n \\in \\mathbb{N}.\\, P(n)",
        pronunciation: "If P of zero is true and for all n, P of n implies P of n plus one, then P of n is true for all natural numbers n.",
        history: "Pascal, Fermat, and others used induction informally in the 17th century. Peano's axioms (1889) made it rigorous. It's the workhorse proof technique for algorithms — almost every correctness proof of a recursive algorithm is induction on input size.",
        analogy: "A domino chain. Knock over the first, and prove each domino knocks the next, and the whole chain falls.",
        example: "Prove 1 + 2 + ... + n = n(n+1)/2. Base: n=1 gives 1 = 1·2/2 ✓. Step: assume true for n, then 1 + ... + (n+1) = n(n+1)/2 + (n+1) = (n+1)(n+2)/2. ✓",
        videos: [
          { id: "wctLmuPyAt0", source: "MIT OCW", title: "Mathematics for CS — Induction" },
        ],
        reading: ["Lehman, Leighton & Meyer, Mathematics for Computer Science, Ch. 5"],
      },
    ],
  },

  {
    index: 3,
    title: "Computability & Theory of Computation",
    era: "1936 · Turing → 1956 · Chomsky → 1971 · Cook",
    blurb: "What can be computed, what cannot, and what costs how much. Finite automata, pushdown automata, Turing machines, the Chomsky hierarchy, decidability, the halting problem.",
    videos: [
      { id: "9syvZr-9xwk", source: "Up and Atom", title: "The Chomsky Hierarchy" },
      { id: "macM_MtS_w4", source: "Computerphile", title: "Turing & The Halting Problem" },
    ],
    topics: [
      {
        slug: "finite-automaton",
        title: "Deterministic finite automaton (DFA)",
        difficulty: "undergrad",
        plain: "A machine with a finite set of states and a transition table. Read one input symbol, jump to the state the table says, repeat. Accept if you end in an accepting state. DFAs recognize exactly the regular languages — same expressive power as regular expressions.",
        formal: "M = (Q, \\Sigma, \\delta, q_0, F),\\quad \\delta : Q \\times \\Sigma \\to Q",
        pronunciation: "A DFA is a five-tuple: a finite set of states Q, an alphabet sigma, a transition function delta from state and symbol to state, a start state q-zero, and a set of accept states F.",
        history: "Kleene's theorem (1956) proved DFAs, NFAs, and regular expressions all recognize the same languages. The Chomsky hierarchy (1956) placed regular languages at the bottom of a four-tier ladder of formal-language complexity.",
        analogy: "A vending machine. Press a coin button — state changes. Press another — state changes again. Reach the 'dispense' state and you get a soda; reach 'invalid combo' and you get nothing.",
        example: "Match the language of strings over {0,1} that contain '101'. Three states: 'haven't started', 'saw 1', 'saw 10', 'saw 101' (accept). On each input symbol the state machine advances.",
        videos: [
          { id: "Qa6csfkK7_I", source: "Easy Theory", title: "DFA — Construct a DFA Step-by-Step" },
        ],
        papers: [
          { author: "Kleene, S.C.", year: 1956, title: "Representation of Events in Nerve Nets and Finite Automata" },
        ],
        reading: ["Sipser, Theory of Computation, Ch. 1"],
      },
      {
        slug: "halting-problem",
        title: "The Halting problem",
        difficulty: "grad",
        plain: "There is no algorithm that takes a program P and an input I and decides whether P halts on I. Not 'we haven't found one' — proven impossible. Turing's proof: assume HALT exists, build a program that asks HALT about itself and does the opposite — contradiction.",
        formal: "\\nexists\\, H : \\Sigma^* \\times \\Sigma^* \\to \\{0, 1\\} \\text{ s.t. } H(P, I) = 1 \\iff P(I) \\text{ halts}",
        pronunciation: "There does not exist a computable function H from program and input to one or zero such that H of P comma I equals one if and only if P halts on input I.",
        history: "Turing, 1936, in the same paper that defined the Turing machine. The proof is the prototype for every undecidability result that followed: Rice's theorem, the Post correspondence problem, the word problem for groups.",
        analogy: "A perfect lie detector that turns itself on. If a perfect lie detector exists, ask it 'will you say no?' — and both answers are contradictions. The Halting problem is the lie detector for 'does this program halt?'",
        example: "while True: pass — clearly doesn't halt. print('hi') — clearly halts. But: while not is_perfect(n): n += 1 where is_perfect tests if n equals the sum of its proper divisors — does this halt? Open problem.",
        steps: [
          { math: "\\text{Assume } H(P, I) \\text{ halts and decides correctly.}", text: "Suppose there's a perfect halting decider H." },
          { math: "D(P) = \\text{if } H(P, P) \\text{ then loop forever else halt}", text: "Build D, which asks H about P run on itself, then does the opposite." },
          { math: "D(D) = ?", text: "Now run D on D. By H's spec, D(D) halts iff H(D,D) = 1 iff D(D) loops. Contradiction." },
          { math: "\\therefore\\ H \\text{ cannot exist.}", text: "Therefore no such H exists. The Halting problem is undecidable." },
        ],
        videos: [
          { id: "macM_MtS_w4", source: "Computerphile", title: "Turing & The Halting Problem" },
          { id: "92WHN-pAFCs", source: "Up and Atom", title: "Why You Can't Solve The Halting Problem" },
        ],
        papers: [
          { author: "Turing, A.", year: 1936, title: "On Computable Numbers" },
        ],
        reading: ["Sipser Ch. 4", "Hopcroft & Ullman Ch. 9"],
      },
      {
        slug: "np-completeness",
        title: "NP-completeness",
        difficulty: "grad",
        plain: "P is the class of decision problems solvable in polynomial time. NP is the class where a 'yes' answer can be verified in polynomial time given a witness. An NP-complete problem is in NP AND every other NP problem reduces to it in polynomial time. If any one NP-complete problem has a polynomial-time algorithm, P = NP.",
        formal: "L \\in \\text{NP-complete} \\iff L \\in \\text{NP} \\land \\forall L' \\in \\text{NP},\\ L' \\le_p L",
        pronunciation: "A language L is NP-complete if and only if L is in NP and every language L-prime in NP polynomially reduces to L.",
        history: "Cook (1971) proved SAT is NP-complete — the foundational result. Karp (1972) showed 21 classical problems reduce to SAT, exploding the NP-complete class. The P vs NP question is one of the Clay Millennium Prize Problems; whoever resolves it wins $1M.",
        analogy: "P = problems where you can quickly find an answer. NP = problems where you can quickly check an answer if someone hands you one. P = NP would mean checking is as easy as finding, which most computer scientists doubt.",
        example: "3-SAT, the traveling salesman decision version, vertex cover, subset sum, graph coloring, Sudoku, and Tetris are all NP-complete. Cracking any one of them in polynomial time cracks them all.",
        videos: [
          { id: "YX40hbAHx3s", source: "Up and Atom", title: "P vs NP — The Most Important Unsolved Problem" },
          { id: "moPtwq_cVH8", source: "Undefined Behavior", title: "Cook-Levin Theorem visualization" },
        ],
        papers: [
          { author: "Cook, S.", year: 1971, title: "The Complexity of Theorem-Proving Procedures" },
          { author: "Karp, R.", year: 1972, title: "Reducibility Among Combinatorial Problems" },
          { author: "Levin, L.", year: 1973, title: "Universal Sequential Search Problems" },
        ],
        reading: ["Sipser Ch. 7", "Garey & Johnson, Computers and Intractability"],
      },
    ],
  },

  // Stub chapters 4–20 — chapter intros + curated videos + topic titles.
  // Each topic has at least plain English + a video so the lab is usable
  // end-to-end on day one; deep content gets filled in chapter by chapter.

  { index: 4, title: "Algorithms & Complexity", era: "1950s · Hoare → today", blurb: "Sorting, searching, divide-and-conquer, dynamic programming, greedy, graph algorithms. Big-O is the price tag on every algorithm.",
    videos: [
      { id: "kPRA0W1kECg", source: "3Blue1Brown", title: "Quicksort — Visualized" },
      { id: "f6EzDmbCFcY", source: "Reducible", title: "P vs NP and the Computational Complexity Zoo" },
    ],
    topics: [
      { slug: "big-o", title: "Big-O notation", difficulty: "undergrad", plain: "An asymptotic upper bound on a function's growth. f(n) = O(g(n)) if there are constants c, n₀ such that f(n) ≤ c·g(n) for all n ≥ n₀.", formal: "f(n) = O(g(n)) \\iff \\exists c, n_0 : \\forall n \\ge n_0,\\ f(n) \\le c \\cdot g(n)", videos: [{ id: "v4cd1O4zkGw", source: "HackerRank", title: "Big O Notation" }] },
      { slug: "merge-sort", title: "Merge sort", difficulty: "undergrad", plain: "Recursively split the array in half, sort each half, merge them. O(n log n) worst case, O(n) extra space, stable.", formal: "T(n) = 2T(n/2) + \\Theta(n) \\Rightarrow T(n) = \\Theta(n \\log n)", videos: [{ id: "ZRPoEKHXTJg", source: "Reducible", title: "Merge sort visualized" }] },
      { slug: "dynamic-programming", title: "Dynamic programming", difficulty: "grad", plain: "Solve a problem by combining solutions to overlapping subproblems. Memoize: cache subproblem results so each is computed once.", videos: [{ id: "OQ5jsbhAv_M", source: "Reducible", title: "Dynamic programming visualized" }] },
    ],
  },

  { index: 5, title: "Data Structures", era: "1960s · Knuth → today", blurb: "Arrays, lists, trees, BSTs, heaps, hash tables, tries, B-trees, graphs, skip lists, persistent data structures.",
    videos: [{ id: "rqg9JUWDFqs", source: "MIT OCW", title: "MIT 6.006 — Data Structures" }],
    topics: [
      { slug: "hash-table", title: "Hash table", difficulty: "undergrad", plain: "An array indexed by hash(key). Average O(1) lookup, insert, delete. Worst case O(n) when many keys collide.", videos: [{ id: "shs0KM3wKv8", source: "HackerRank", title: "Hash tables" }] },
      { slug: "b-tree", title: "B-tree", difficulty: "grad", plain: "A self-balancing tree where each node holds many keys and many children. Designed for disk/SSD where reading a block is the dominant cost. Postgres, MySQL, and SQLite all use B-tree variants for indexes.", videos: [{ id: "aZjYr87r1b8", source: "Computerphile", title: "B-trees" }] },
    ],
  },

  { index: 6, title: "Computer Architecture", era: "1945 · von Neumann → today", blurb: "Logic gates, ALUs, CPU pipelines, cache hierarchies, memory, I/O, RISC vs CISC, branch prediction, speculative execution.",
    videos: [{ id: "Z5JC9Ve1sfI", source: "Crash Course", title: "Computer Architecture" }, { id: "JaaGK3GsZbk", source: "Ben Eater", title: "Building an 8-bit CPU" }],
    topics: [
      { slug: "von-neumann", title: "Von Neumann architecture", difficulty: "undergrad", plain: "Code and data live in the same memory; a single bus moves both to the CPU. Almost every computer you've ever touched is von Neumann.", videos: [{ id: "Ml3-kVYLNr8", source: "Computerphile", title: "Von Neumann Architecture" }] },
      { slug: "cache-hierarchy", title: "Cache hierarchy", difficulty: "grad", plain: "L1 (per-core, ~1ns), L2 (per-core, ~5ns), L3 (shared, ~15ns), DRAM (~100ns), SSD (~100μs), disk (~10ms). Each level is 10–100x slower and 10–100x bigger than the one above.", videos: [{ id: "we0E3UWaaxk", source: "Computerphile", title: "Caches Explained" }] },
    ],
  },

  { index: 7, title: "Operating Systems", era: "1965 · Multics → today", blurb: "Processes, threads, scheduling, virtual memory, file systems, concurrency, synchronization, syscalls.",
    videos: [{ id: "26QPDBe-NB8", source: "Crash Course", title: "Operating Systems" }],
    topics: [
      { slug: "process-vs-thread", title: "Process vs thread", difficulty: "undergrad", plain: "A process is an isolated address space — its own memory map, file descriptors, signals. A thread is an execution context inside a process; threads in the same process share memory.", videos: [{ id: "0Hr_a7sj7-A", source: "Computerphile", title: "Processes and Threads" }] },
      { slug: "virtual-memory", title: "Virtual memory", difficulty: "grad", plain: "Each process sees its own contiguous address space; the MMU maps virtual pages to physical frames via page tables. Pages can be swapped to disk on demand.", videos: [{ id: "qcBIvnQt0Bw", source: "Computerphile", title: "Virtual Memory" }] },
    ],
  },

  { index: 8, title: "Networks", era: "1969 · ARPANET → today", blurb: "OSI/TCP-IP layers, routing, congestion control, DNS, HTTP, TLS, BGP, the actual Internet.",
    videos: [{ id: "AEaKrq3SpW8", source: "Practical Networking", title: "Networking Fundamentals" }],
    topics: [
      { slug: "tcp-ip", title: "TCP/IP", difficulty: "undergrad", plain: "Four layers: link (Ethernet/WiFi), network (IP — routing across networks), transport (TCP for reliable, UDP for fast), application (HTTP, DNS, SSH). Each layer wraps the one above.", videos: [{ id: "fEAlfFnpKvE", source: "Computerphile", title: "TCP/IP" }] },
      { slug: "tls", title: "TLS 1.3", difficulty: "grad", plain: "Transport-layer security. Modern TLS does a Diffie-Hellman key exchange to derive a shared secret, authenticates the server via certificate signature, then encrypts the rest of the conversation with AES-GCM or ChaCha20-Poly1305.", videos: [{ id: "0TLDTodL7Lc", source: "Computerphile", title: "Transport Layer Security" }] },
    ],
  },

  { index: 9, title: "Databases", era: "1970 · Codd → today", blurb: "Relational model, SQL, normalization, indexes, transactions, ACID, NoSQL, distributed databases.",
    videos: [{ id: "ztHopE5Wnpc", source: "Crash Course", title: "Databases" }, { id: "yu33pkj6Wog", source: "CMU", title: "Database Systems — Andy Pavlo" }],
    topics: [
      { slug: "acid", title: "ACID transactions", difficulty: "undergrad", plain: "Atomicity (all-or-nothing), Consistency (DB invariants hold before and after), Isolation (concurrent txns don't see each other's partial work), Durability (committed data survives crashes).", videos: [{ id: "yaQ5YMWkxq4", source: "ByteByteGo", title: "What is ACID?" }] },
      { slug: "indexes", title: "Indexes", difficulty: "undergrad", plain: "A separate data structure (usually a B-tree) that maps column values to row pointers, so range queries don't have to scan the whole table.", videos: [{ id: "-qNSXK7s7_w", source: "ByteByteGo", title: "How indexes work" }] },
    ],
  },

  { index: 10, title: "Programming Languages", era: "1958 · Lisp → today", blurb: "Type systems, parsers, semantics, paradigms: imperative, functional, logic, OO. Where languages come from and how they differ.",
    videos: [{ id: "MyP5Fh6QvNc", source: "Computerphile", title: "Type Theory" }, { id: "1tH9aXTNGuQ", source: "PWLConf", title: "Lambda calculus and modern PL design" }],
    topics: [
      { slug: "type-system", title: "Type system", difficulty: "grad", plain: "A set of rules that assigns each expression a type, used to prove (statically or at runtime) that the program won't go wrong. Hindley-Milner inferred types automatically; dependent types let types depend on values.", videos: [{ id: "PUVHrHdSJ_E", source: "Computerphile", title: "Type Inference" }] },
    ],
  },

  { index: 11, title: "Compilers", era: "1957 · FORTRAN → today", blurb: "Lexing, parsing, AST, type checking, IR, optimization, codegen, register allocation.",
    videos: [{ id: "54bo1qaHAfk", source: "Computerphile", title: "Compilers" }, { id: "8VB5TY1sIRo", source: "Lex Fridman", title: "Chris Lattner on LLVM" }],
    topics: [
      { slug: "parser", title: "Parsers", difficulty: "undergrad", plain: "A parser takes a stream of tokens and builds a syntax tree according to a grammar. LL(k) parsers look k tokens ahead; LR parsers use a stack and a state table; PEG parsers express grammar as recursive descent with ordered choice.", videos: [{ id: "0c8b7YfsBKs", source: "Computerphile", title: "Parser Combinators" }] },
    ],
  },

  { index: 12, title: "Software Engineering", era: "1968 · NATO conference → today", blurb: "Testing, code review, version control, CI/CD, observability, design patterns. The craft of shipping code that doesn't fall over.",
    videos: [{ id: "DKCMU9PaOJM", source: "Computerphile", title: "Software Engineering" }],
    topics: [
      { slug: "git-internals", title: "Git internals", difficulty: "undergrad", plain: "Git is a content-addressed object store. Every blob, tree, commit, and tag is identified by the SHA-1 (or SHA-256) of its content. Branches are just pointers to commits.", videos: [{ id: "P6jD966jzlk", source: "ThoughtBot", title: "Tig and Git Internals" }] },
    ],
  },

  { index: 13, title: "Artificial Intelligence & ML", era: "1956 · Dartmouth → today", blurb: "Search, planning, neural networks, RL, NLP, computer vision, transformers, RLHF. The discipline that's eating computer science.",
    videos: [{ id: "aircAruvnKk", source: "3Blue1Brown", title: "But what IS a neural network?" }, { id: "wjZofJX0v4M", source: "3Blue1Brown", title: "How transformers work" }],
    topics: [
      { slug: "backprop", title: "Backpropagation", difficulty: "grad", plain: "The chain rule applied to a computational graph. Compute the gradient of the loss with respect to each parameter by walking the graph backwards from the output to the inputs.", formal: "\\frac{\\partial L}{\\partial w_i} = \\sum_j \\frac{\\partial L}{\\partial z_j} \\cdot \\frac{\\partial z_j}{\\partial w_i}", videos: [{ id: "Ilg3gGewQ5U", source: "3Blue1Brown", title: "Backpropagation" }] },
      { slug: "attention", title: "Attention", difficulty: "research", plain: "An attention head computes a weighted average over a set of values, where the weights come from a similarity (softmax of QK^T) between the query and each key. Stacking many heads is what makes a Transformer.", formal: "\\text{Attn}(Q, K, V) = \\text{softmax}\\!\\left(\\frac{QK^\\top}{\\sqrt{d_k}}\\right) V", videos: [{ id: "eMlx5fFNoYc", source: "3Blue1Brown", title: "Attention in transformers" }] },
    ],
  },

  { index: 14, title: "Cryptography", era: "1976 · Diffie–Hellman → today", blurb: "Symmetric, asymmetric, hashing, PKI, zero-knowledge proofs, post-quantum.",
    videos: [{ id: "_-feyaZZjEw", source: "Computerphile", title: "Public Key Cryptography" }],
    topics: [
      { slug: "diffie-hellman", title: "Diffie–Hellman key exchange", difficulty: "grad", plain: "Two parties pick private numbers a and b. Each sends g^a mod p and g^b mod p over the wire. Each can compute g^(ab) mod p, but nobody listening can — that's their shared secret.", formal: "K = g^{ab} \\mod p", videos: [{ id: "NmM9HA2MQGI", source: "Computerphile", title: "Diffie-Hellman Key Exchange" }] },
    ],
  },

  { index: 15, title: "Distributed Systems", era: "1978 · Lamport → today", blurb: "CAP, consensus, Paxos, Raft, gossip, replicated state machines, distributed transactions.",
    videos: [{ id: "Sa9iLjUp_Tk", source: "Heidi Howard", title: "Distributed Consensus" }],
    topics: [
      { slug: "cap-theorem", title: "CAP theorem", difficulty: "grad", plain: "In a partition, you must choose: consistency (every read sees the latest write) or availability (every request gets a response). You cannot have both during a network partition.", formal: "P \\Rightarrow \\neg(C \\land A)", videos: [{ id: "k-Yaq8AHlFA", source: "ByteByteGo", title: "CAP theorem" }] },
      { slug: "raft", title: "Raft consensus", difficulty: "research", plain: "An understandable consensus algorithm. A cluster elects one leader; the leader appends every command to its log and replicates to followers. A majority quorum commits each entry.", videos: [{ id: "vYp4LYbnnW8", source: "Diego Ongaro", title: "Raft consensus explained" }] },
    ],
  },

  { index: 16, title: "Quantum Computing", era: "1981 · Feynman → today", blurb: "Qubits, gates, superposition, entanglement, Shor's algorithm, Grover's algorithm, error correction.",
    videos: [{ id: "F_Riqjdh2oM", source: "Quanta", title: "Quantum Computing for Computer Scientists" }],
    topics: [
      { slug: "qubit", title: "Qubit & superposition", difficulty: "grad", plain: "A qubit is a unit vector in ℂ². Measured in the {|0⟩, |1⟩} basis it collapses to 0 with probability |α|² or 1 with probability |β|². Until measurement, it's both.", formal: "|\\psi\\rangle = \\alpha|0\\rangle + \\beta|1\\rangle,\\quad |\\alpha|^2 + |\\beta|^2 = 1", videos: [{ id: "lypnkNm0B4A", source: "MinutePhysics", title: "How Quantum Computers Work" }] },
    ],
  },

  { index: 17, title: "Formal Methods", era: "1969 · Hoare → today", blurb: "Hoare logic, model checking, type theory, theorem provers (Coq, Lean, Isabelle).",
    videos: [{ id: "FfRBP3SMnVA", source: "Strange Loop", title: "Formal verification at Amazon" }],
    topics: [
      { slug: "hoare-logic", title: "Hoare logic", difficulty: "grad", plain: "Reason about programs with triples {P} C {Q}: if P holds before executing C, then Q holds after — provided C terminates. The basis of every program verifier from Frama-C to Dafny to F*.", formal: "\\{P\\}\\ C\\ \\{Q\\}", videos: [{ id: "qe-VsP9-Fw0", source: "Computerphile", title: "Program Verification" }] },
    ],
  },

  { index: 18, title: "Computational Geometry", era: "1975 · Shamos → today", blurb: "Convex hulls, Voronoi diagrams, range trees, BSPs, computational topology.",
    videos: [{ id: "lJzVa5BqdRY", source: "WilliamFiset", title: "Convex Hull Algorithm" }],
    topics: [
      { slug: "convex-hull", title: "Convex hull", difficulty: "undergrad", plain: "The smallest convex polygon containing a set of points. Graham scan: sort by angle, walk around, pop on right turns. O(n log n).", videos: [{ id: "B2AJoQSZf4M", source: "WilliamFiset", title: "Graham Scan" }] },
    ],
  },

  { index: 19, title: "Approximation & Randomized Algorithms", era: "1979 · Karp → today", blurb: "PTAS, FPTAS, Las Vegas, Monte Carlo, randomized rounding, MCMC.",
    videos: [{ id: "ZtINklXThJE", source: "Reducible", title: "Approximation algorithms" }],
    topics: [
      { slug: "monte-carlo", title: "Monte Carlo algorithms", difficulty: "grad", plain: "A randomized algorithm with bounded runtime and bounded probability of error. Miller-Rabin primality is the textbook example: O(k) tests, error ≤ 4^-k.", videos: [{ id: "AyBNnkYrSWY", source: "Numberphile", title: "Monte Carlo" }] },
    ],
  },

  { index: 20, title: "Research Methodology", era: "Now", blurb: "Reading papers, writing proofs, finding open problems, navigating a PhD. The meta-skill that turns the previous 19 chapters into research output.",
    videos: [{ id: "733m6qBH-jI", source: "Andrew Ng", title: "How to read research papers" }],
    topics: [
      { slug: "reading-papers", title: "Reading a CS paper", difficulty: "undergrad", plain: "Three passes: skim (read title, abstract, intro, section headers, conclusion), reread (figures, theorems, results), and rebuild (try to derive the proofs yourself, find a hole, propose a follow-up).", videos: [{ id: "733m6qBH-jI", source: "Andrew Ng", title: "How to read research papers" }] },
    ],
  },
];

// Flatten topics — global index used by SpeakBack widgets etc.
export const TOPICS = CHAPTERS.flatMap((c) => c.topics);
