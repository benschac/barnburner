// xstate6/pure-transitions: keep XState v6 transition and action functions pure.
//
// XState v6 computes the next snapshot by calling the function you write in
// on.*, always, after.*, onDone, onError, onTimeout, entry, exit and
// invoke.input (also onDone, onError and onTimeout inside invoke). The function
// returns a { target, context } patch and queues side effects with the second
// argument (enq). Mutation, I/O, time and randomness inside it break replay,
// snapshot prediction (snapshot.can) and persistence. See
// node_modules/xstate/docs/{agents,transition-functions,actions,how-xstate-runs-machines}.md.
//
// Scope: object literals passed to createMachine, or to .createMachine on the
// result of setup(...) or setupEffect(...), imported from 'xstate' or
// '@xstate/effect'. Anything inside a function argument of enq(...) is allowed.
//
// Heuristic, so it prefers false negatives. Known gaps:
// - Handlers that are not inline functions (on: { GO: handler }) and machine
//   configs that are not an inline object literal are not analyzed. Neither are
//   functions in setup({ actions }) or machine.provide(...).
// - Ownership is tracked by name inside one function: a local is "created
//   inside" unless its initializer is a plain identifier or member chain rooted
//   at a parameter or outer binding (const items = context.items). Calls and
//   literals count as new objects, as do parameters of nested callbacks, so
//   context.items.forEach((item) => { item.done = true }) is not reported.
// - Mutating methods are matched by name on identifier or member chains only.
//   Namespace imports (HashMap.set, Array.sort) are skipped. Computed members
//   (window['fetch']) and aliases of globals (const f = fetch) are not matched.
// - Reads of document and window are allowed. Only writes through them (and
//   the mutating-method list) are reported.
// - await is reported through its enclosing async function, not on its own.
// - Calls to helper functions are not followed, so a helper that mutates or
//   reads the clock is not reported.
const MODULES = new Set(["xstate", "@xstate/effect"]);

const SETUPS = new Set(["setup", "setupEffect"]);

const MUTATING_METHODS = new Set([
  "push",
  "splice",
  "pop",
  "shift",
  "unshift",
  "sort",
  "reverse",
  "fill",
  "set",
  "add",
  "delete",
  "clear",
]);

const TIMERS = new Set([
  "setTimeout",
  "setInterval",
  "setImmediate",
  "clearTimeout",
  "clearInterval",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "queueMicrotask",
]);

const GLOBAL_OBJECTS = new Set(["window", "globalThis", "self"]);

const WHOLE_GLOBALS = new Set([
  "console",
  "process",
  "localStorage",
  "sessionStorage",
]);

const IMPURE_MEMBERS = [
  "Date.now",
  "Math.random",
  "performance.now",
  "crypto.randomUUID",
  "crypto.getRandomValues",
];

const FUNCTION_TYPES = new Set([
  "ArrowFunctionExpression",
  "FunctionExpression",
  "FunctionDeclaration",
]);

const TRANSPARENT = new Set([
  "TSAsExpression",
  "TSSatisfiesExpression",
  "TSNonNullExpression",
  "TSTypeAssertion",
  "ParenthesizedExpression",
  "ChainExpression",
]);

// Config keys whose value is a transition or action function (or a list of them).
const FUNCTION_KEYS = new Set([
  "always",
  "entry",
  "exit",
  "onDone",
  "onError",
  "onTimeout",
]);

const INVOKE_KEYS = new Set(["input", "onDone", "onError", "onTimeout"]);

const MUTATION_FIX =
  "Fix: return a patch such as { context: { field: value } } instead of mutating context, event, or outer state, or queue the change with enq(() => ...).";

const IMPURE_FIX =
  "Fix: queue the side effect with enq(() => ...), or invoke actor logic (createEffectLogic) for async work.";

const ASYNC_FIX =
  "Fix: invoke actor logic (createEffectLogic) for async work and handle its result in onDone or onError, and queue other side effects with enq(() => ...).";

const tick = (text) => `@@${text}@@`;

const unwrap = (node) =>
  TRANSPARENT.has(node?.type) ? unwrap(node.expression) : node;

const isNode = (value) => value?.type !== undefined;

const isFunction = (node) => FUNCTION_TYPES.has(node?.type);

const keyName = (prop) =>
  prop.computed ? undefined : (prop.key?.name ?? prop.key?.value);

const propsOf = (node) =>
  unwrap(node)?.type === "ObjectExpression"
    ? unwrap(node).properties.filter((prop) => prop.type === "Property")
    : [];

const childrenOf = (node) =>
  Object.entries(node).flatMap(([key, value]) =>
    key === "parent" ? [] : [value].flat().filter(isNode)
  );

// Visit node and its descendants; visit returns false to skip a subtree.
const walk = (node, visit, parent) => {
  if (visit(node, parent) === false) return;
  childrenOf(node).forEach((child) => {
    walk(child, visit, node);
  });
};

const patternNames = (pattern) => {
  switch (pattern?.type) {
    case "Identifier": {
      return [pattern.name];
    }
    case "ObjectPattern": {
      return pattern.properties.flatMap((prop) =>
        patternNames(prop.type === "Property" ? prop.value : prop.argument)
      );
    }
    case "ArrayPattern": {
      return pattern.elements.flatMap(patternNames);
    }
    case "RestElement": {
      return patternNames(pattern.argument);
    }
    case "AssignmentPattern": {
      return patternNames(pattern.left);
    }
    default: {
      return [];
    }
  }
};

// Root identifier of an identifier or member chain, or undefined for anything else.
const rootName = (node) => {
  const inner = unwrap(node);

  if (inner?.type === "Identifier") return inner.name;

  return inner?.type === "MemberExpression"
    ? rootName(inner.object)
    : undefined;
};

// Names along a chain without computed members, such as ['Date', 'now'].
const pathOf = (node) => {
  const inner = unwrap(node);

  if (inner?.type === "Identifier") return [inner.name];

  if (
    inner?.type !== "MemberExpression" ||
    inner.computed ||
    inner.property.type !== "Identifier"
  )
    return undefined;
  const base = pathOf(inner.object);

  return base && [...base, inner.property.name];
};

// The transition and action functions of a machine config, by position.
const functionsOf = (config) => {
  const found = [];

  const add = (node) => {
    const inner = unwrap(node);

    if (inner?.type === "ArrayExpression") inner.elements.forEach(add);
    else if (isFunction(inner)) found.push(inner);
  };

  const addEach = (node) =>
    propsOf(node).forEach((prop) => {
      add(prop.value);
    });

  const visitInvoke = (node) => {
    const inner = unwrap(node);
    const invokes =
      inner?.type === "ArrayExpression" ? inner.elements : [inner];
    invokes.forEach((invoke) =>
      propsOf(invoke)
        .filter((prop) => INVOKE_KEYS.has(keyName(prop)))
        .forEach((prop) => {
          add(prop.value);
        })
    );
  };

  const visitState = (state) =>
    propsOf(state).forEach((prop) => {
      const name = keyName(prop);

      if (name === "on" || name === "after") addEach(prop.value);
      else if (FUNCTION_KEYS.has(name)) add(prop.value);
      else if (name === "invoke") visitInvoke(prop.value);
      else if (name === "states")
        propsOf(prop.value).forEach((child) => visitState(child.value));
    });

  visitState(config);

  return found;
};

export default {
  meta: { name: "xstate6" },
  rules: {
    "pure-transitions": {
      meta: { type: "problem", schema: [] },
      create(context) {
        const creators = new Set();
        const setups = new Set();
        const namespaces = new Set();
        const setupVars = new Set();
        const imports = new Set();
        const moduleBindings = new Set();

        const isSetupCall = (node) => {
          const inner = unwrap(node);

          if (inner?.type !== "CallExpression") return false;
          const callee = unwrap(inner.callee);

          if (callee.type === "Identifier") return setups.has(callee.name);

          return (
            callee.type === "MemberExpression" &&
            namespaces.has(rootName(callee.object)) &&
            SETUPS.has(callee.property.name)
          );
        };

        const isMachineCall = (node) => {
          const callee = unwrap(node.callee);

          if (callee.type === "Identifier") return creators.has(callee.name);

          if (
            callee.type !== "MemberExpression" ||
            callee.property.name !== "createMachine"
          )
            return false;
          const owner = unwrap(callee.object);

          return (
            isSetupCall(owner) ||
            (owner.type === "Identifier" &&
              (setupVars.has(owner.name) || namespaces.has(owner.name)))
          );
        };

        const text = (node) =>
          context.sourceCode.getText(node).split("\n")[0].slice(0, 60);
        const report = (node, message) =>
          context.report({
            node,
            message: message.replaceAll("@@", String.fromCodePoint(96)),
          });

        const analyze = (fn) => {
          const params = new Set(fn.params.flatMap(patternNames));
          const enqParam =
            fn.params[1]?.type === "Identifier" ? fn.params[1].name : undefined;
          const declared = new Map();
          const deferred = new Set();
          const isEnqCall = (call) =>
            enqParam !== undefined && rootName(call.callee) === enqParam;
          const declare = (name, init) =>
            declared.set(name, declared.has(name) ? null : init);

          walk(fn.body, (node) => {
            if (node.type === "VariableDeclarator")
              patternNames(node.id).forEach((name) =>
                declare(name, node.init ?? null)
              );
            else if (node.type === "ClassDeclaration" && node.id)
              declare(node.id.name, null);
            else if (node.type === "CatchClause")
              patternNames(node.param).forEach((name) => declare(name, null));
            else if (node.type === "CallExpression" && isEnqCall(node))
              node.arguments
                .filter((arg) => arg.type === "Identifier")
                .forEach((arg) => deferred.add(arg.name));

            if (isFunction(node)) {
              if (node.type === "FunctionDeclaration" && node.id)
                declare(node.id.name, null);
              node.params
                .flatMap(patternNames)
                .forEach((name) => declare(name, null));
            }
          });

          const isOwned = (name, depth = 0) => {
            if (!declared.has(name)) return false;
            const init = declared.get(name);
            const root = init ? rootName(init) : undefined;

            return (
              root === undefined ||
              root === name ||
              depth > 8 ||
              isOwned(root, depth + 1)
            );
          };

          const isGlobal = (name) =>
            !declared.has(name) &&
            !params.has(name) &&
            !moduleBindings.has(name);

          const globalPath = (node) => {
            const path = pathOf(node);

            if (!path) return undefined;
            const rest =
              path.length > 1 &&
              GLOBAL_OBJECTS.has(path[0]) &&
              isGlobal(path[0])
                ? path.slice(1)
                : path;

            return isGlobal(rest[0]) ? rest : undefined;
          };

          const checkTarget = (target) => {
            const inner = unwrap(target);

            if (inner?.type === "Identifier") {
              if (!declared.has(inner.name))
                report(
                  target,
                  `${tick(
                    inner.name
                  )} is assigned, but it was not created inside this transition or action function. ${
                    MUTATION_FIX
                  }`
                );
            } else if (inner?.type === "MemberExpression") {
              const root = rootName(inner);

              if (root !== undefined && !isOwned(root))
                report(
                  target,
                  `${tick(text(inner))} is mutated, but ${tick(
                    root
                  )} was not created inside this transition or action function. ${
                    MUTATION_FIX
                  }`
                );
            } else if (inner?.type === "ObjectPattern")
              inner.properties.forEach((prop) => {
                checkTarget(
                  prop.type === "Property" ? prop.value : prop.argument
                );
              });
            else if (inner?.type === "ArrayPattern")
              inner.elements.filter(Boolean).forEach(checkTarget);
            else if (inner?.type === "AssignmentPattern")
              checkTarget(inner.left);
            else if (inner?.type === "RestElement") checkTarget(inner.argument);
          };

          const impure = (node) =>
            report(
              node,
              `${tick(
                text(node)
              )} reads or writes the outside world (I/O, time, or randomness) while the next snapshot is computed. ${
                IMPURE_FIX
              }`
            );

          const checkCall = (node) => {
            const callee = unwrap(node.callee);
            const path = globalPath(callee);

            if (
              path?.length === 1 &&
              (path[0] === "fetch" || TIMERS.has(path[0]))
            )
              impure(node);

            if (
              callee.type !== "MemberExpression" ||
              callee.computed ||
              !MUTATING_METHODS.has(callee.property.name)
            )
              return;
            const root = rootName(callee.object);
            const isNamespace =
              root !== undefined &&
              imports.has(root) &&
              !declared.has(root) &&
              !params.has(root);

            if (
              root !== undefined &&
              root !== enqParam &&
              !isNamespace &&
              !isOwned(root)
            ) {
              report(
                node,
                `${tick(`${text(callee)}(...)`)} mutates ${tick(
                  root
                )}, which was not created inside this transition or action function. ${
                  MUTATION_FIX
                }`
              );
            }
          };

          const checkMember = (node, parent) => {
            if (parent?.type === "MemberExpression" && parent.object === node)
              return;
            const named = pathOf(node);
            const isEffectRun =
              named?.[0] === "Effect" &&
              named[1]?.startsWith("run") &&
              !declared.has("Effect") &&
              !params.has("Effect");
            const path = globalPath(node);
            const isGlobalUse =
              path !== undefined &&
              (WHOLE_GLOBALS.has(path[0]) ||
                IMPURE_MEMBERS.includes(path.slice(0, 2).join(".")));

            if (isEffectRun || isGlobalUse) impure(node);
          };

          // A deferred function declaration is not walked here.
          const declaresDeferred = (node) =>
            (node.type === "VariableDeclarator" &&
              node.id.type === "Identifier" &&
              deferred.has(node.id.name) &&
              isFunction(unwrap(node.init))) ||
            (node.type === "FunctionDeclaration" &&
              node.id &&
              deferred.has(node.id.name));

          const checkNew = (node) => {
            const path = globalPath(node.callee);

            if (
              (path?.length === 1 &&
                path[0] === "Date" &&
                node.arguments.length === 0) ||
              path?.[0] === "XMLHttpRequest"
            )
              impure(node);
          };

          // Callbacks run after the snapshot is resolved, so only the other arguments are checked.
          const checkEnqArguments = (node) => {
            const callee = unwrap(node.callee);
            const spawns =
              callee.type === "MemberExpression" &&
              callee.property.name === "spawn";

            if (!spawns)
              node.arguments
                .filter((arg) => !isFunction(unwrap(arg)))
                .forEach((arg) => {
                  walk(arg, visit, node);
                });
          };

          const visit = (node, parent) => {
            if (declaresDeferred(node)) return false;

            if (isFunction(node) && node.async)
              report(
                node,
                `This function is async, but transition and action functions run synchronously while the next snapshot is computed. ${
                  ASYNC_FIX
                }`
              );

            switch (node.type) {
              case "AssignmentExpression": {
                checkTarget(node.left);
                break;
              }
              case "UpdateExpression": {
                checkTarget(node.argument);
                break;
              }
              case "UnaryExpression": {
                if (node.operator === "delete") checkTarget(node.argument);
                break;
              }
              case "MemberExpression": {
                checkMember(node, parent);
                break;
              }
              case "NewExpression": {
                checkNew(node);
                break;
              }

              case "CallExpression": {
                if (isEnqCall(node)) {
                  checkEnqArguments(node);
                  return false;
                }

                checkCall(node);
                break;
              }
              default: {
                break;
              }
            }

            return undefined;
          };

          walk(fn, visit, undefined);
        };

        return {
          Program(node) {
            node.body.forEach((statement) => {
              const declaration =
                statement.type === "ExportNamedDeclaration" ||
                statement.type === "ExportDefaultDeclaration"
                  ? statement.declaration
                  : statement;

              if (declaration?.type === "ImportDeclaration") {
                const fromXState = MODULES.has(declaration.source.value);
                declaration.specifiers.forEach((specifier) => {
                  imports.add(specifier.local.name);
                  moduleBindings.add(specifier.local.name);

                  if (!fromXState) return;

                  if (specifier.type === "ImportNamespaceSpecifier")
                    namespaces.add(specifier.local.name);
                  const imported =
                    specifier.imported?.name ?? specifier.imported?.value;

                  if (imported === "createMachine")
                    creators.add(specifier.local.name);

                  if (SETUPS.has(imported)) setups.add(specifier.local.name);
                });
              } else if (declaration?.type === "VariableDeclaration")
                declaration.declarations
                  .flatMap((declarator) => patternNames(declarator.id))
                  .forEach((name) => moduleBindings.add(name));
              else if (
                (declaration?.type === "FunctionDeclaration" ||
                  declaration?.type === "ClassDeclaration") &&
                declaration.id
              )
                moduleBindings.add(declaration.id.name);
            });
          },
          VariableDeclarator(node) {
            if (node.id.type === "Identifier" && isSetupCall(node.init))
              setupVars.add(node.id.name);
          },
          CallExpression(node) {
            const config = unwrap(node.arguments[0]);

            if (config?.type === "ObjectExpression" && isMachineCall(node))
              functionsOf(config).forEach(analyze);
          },
        };
      },
    },
  },
};
