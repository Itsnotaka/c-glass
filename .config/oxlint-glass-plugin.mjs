/** Oxlint JS plugin: glass-local rules (ESLint-compatible API). */

const maxLines = 3;

/** @param {Record<string, unknown>} n */
function isFn(n) {
  return (
    n.type === "FunctionDeclaration" ||
    n.type === "FunctionExpression" ||
    n.type === "ArrowFunctionExpression"
  );
}

/** @param {Record<string, unknown>} node */
function childNodes(node) {
  const out = [];
  for (const [k, v] of Object.entries(node)) {
    if (
      k === "parent" ||
      k === "loc" ||
      k === "range" ||
      k === "leadingComments" ||
      k === "trailingComments" ||
      k === "tokens"
    ) {
      continue;
    }
    if (v == null) continue;
    if (Array.isArray(v)) {
      for (const x of v) {
        if (x && typeof x === "object" && typeof x.type === "string") out.push(x);
      }
    } else if (typeof v === "object" && typeof v.type === "string") {
      out.push(v);
    }
  }
  return out;
}

/**
 * @param {string} src
 * @param {number} start
 * @param {number} end
 */
function nonEmptyLineCount(src, start, end) {
  if (start >= end || start >= src.length) return 0;
  const e = Math.min(end, src.length);
  return src
    .slice(start, e)
    .split("\n")
    .filter((line) => line.trim() !== "").length;
}

/**
 * @param {Record<string, unknown>} root
 * @param {Record<string, unknown>} cur
 */
function containsInvocation(root, cur) {
  if (cur !== root && isFn(cur)) return false;
  if (cur.type === "CallExpression" || cur.type === "NewExpression") return true;
  for (const c of childNodes(cur)) {
    if (containsInvocation(root, c)) return true;
  }
  return false;
}

/**
 * @param {Record<string, unknown>} fn
 */
function reportTarget(fn) {
  if (fn.type === "FunctionDeclaration" || fn.type === "FunctionExpression") {
    const id = fn.id;
    if (id && typeof id === "object" && "type" in id) return id;
    const p = fn.parent;
    if (
      p &&
      typeof p === "object" &&
      p.type === "MethodDefinition" &&
      p.key &&
      typeof p.key === "object"
    ) {
      return p.key;
    }
  }
  return fn;
}

/**
 * @param {Record<string, unknown>} node
 */
function firstUnknown(node) {
  if (node.type === "TSUnknownKeyword") return node;
  for (const c of childNodes(node)) {
    const hit = firstUnknown(c);
    if (hit) return hit;
  }
  return null;
}

const noTinyWrapperFunction = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Flags `function` / class methods whose body is only a `return` or only `const`/`let` + `return` (≤3 non-empty lines) with a call or `new` in the body. The two-statement form matches only when the `return` is a binary compare (e.g. `===`) — the usual split-to-evade of a one-line predicate. Ignores arrows, properties, and other multi-statement bodies.",
    },
    schema: [],
    messages: {
      tinyWrapper:
        "This {{kind}} is only {{lines}} {{lineWord}} of code and contains a call or `new`. Inline the expression (do not split into `const` + `return` to evade this rule).",
    },
  },

  create(context) {
    const src = context.sourceCode.text;

    /**
     * @param {Record<string, unknown>} fn
     * @param {"function" | "method"} kind
     */
    function check(fn, kind) {
      const body = fn.body;
      if (!body || body.type !== "BlockStatement" || !Array.isArray(body.range)) return;
      const stmts = body.body;
      if (!Array.isArray(stmts)) return;

      if (stmts.length === 1) {
        const only = stmts[0];
        if (only.type !== "ReturnStatement" || !only.argument) return;
      } else if (stmts.length === 2) {
        const head = stmts[0];
        const tail = stmts[1];
        if (head.type !== "VariableDeclaration") return;
        if (head.kind !== "const" && head.kind !== "let") return;
        const decs = head.declarations;
        if (!Array.isArray(decs) || decs.length !== 1 || !decs[0]?.init) return;
        if (tail.type !== "ReturnStatement" || !tail.argument) return;
        if (tail.argument.type !== "BinaryExpression") return;
      } else return;

      const a = stmts[0].range;
      const b = stmts[stmts.length - 1].range;
      if (!Array.isArray(a) || !Array.isArray(b)) return;
      const start = a[0];
      const end = b[1];

      const lines = nonEmptyLineCount(src, start, end);
      if (lines === 0 || lines > maxLines) return;
      if (!containsInvocation(body, body)) return;

      const target = reportTarget(fn);
      const lineWord = lines === 1 ? "line" : "lines";
      context.report({
        node: target,
        messageId: "tinyWrapper",
        data: { kind, lines: String(lines), lineWord },
      });
    }

    return {
      FunctionDeclaration(node) {
        if (node.declare) return;
        check(node, "function");
      },
      MethodDefinition(node) {
        if (node.kind === "constructor") return;
        check(node.value, "method");
      },
    };
  },
};

const noUnknownFunctionType = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Flags explicit `unknown` in function and method signatures. Use concrete types or a validated boundary object instead of `unknown` to bypass checks.",
    },
    schema: [],
    messages: {
      unknownSig:
        "Avoid `unknown` in {{where}} for this {{kind}}. Use a concrete type, narrowed union, or boundary parser result.",
    },
  },

  create(context) {
    /**
     * @param {Record<string, unknown>} fn
     * @param {"function" | "method"} kind
     */
    function report(fn, kind, where, node) {
      context.report({
        node: node ?? reportTarget(fn),
        messageId: "unknownSig",
        data: { kind, where },
      });
    }

    /**
     * @param {Record<string, unknown>} fn
     * @param {"function" | "method"} kind
     */
    function check(fn, kind) {
      for (const p of fn.params ?? []) {
        const hit = firstUnknown(p);
        if (!hit) continue;
        report(fn, kind, "parameters", hit);
      }

      if (fn.returnType) {
        const hit = firstUnknown(fn.returnType);
        if (hit) report(fn, kind, "return type", hit);
      }

      if (fn.typeParameters) {
        const hit = firstUnknown(fn.typeParameters);
        if (hit) report(fn, kind, "type parameters", hit);
      }
    }

    return {
      FunctionDeclaration(node) {
        if (node.declare) return;
        check(node, "function");
      },
      FunctionExpression(node) {
        if (node.parent?.type === "MethodDefinition") return;
        check(node, "function");
      },
      ArrowFunctionExpression(node) {
        check(node, "function");
      },
      MethodDefinition(node) {
        if (node.kind === "constructor") return;
        check(node.value, "method");
      },
    };
  },
};

export default {
  meta: { name: "glass" },
  rules: {
    "no-tiny-wrapper-function": noTinyWrapperFunction,
    "no-unknown-function-type": noUnknownFunctionType,
  },
};
