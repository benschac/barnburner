import contract from "../design/contract.json" with { type: "json" };

const colors = [
  ...Object.keys(contract.themes.dark),
  "background-hover",
  "transparent",
];
const categories = new Map();
const add = (category, names) =>
  names.split(" ").forEach((name) => categories.set(name, category));
add(
  "colors",
  "color bg background backgroundColor borderColor borderTopColor borderBottomColor borderLeftColor borderRightColor outlineColor shadowColor textShadowColor textDecorationColor caretColor borderBlockColor borderBlockStartColor borderBlockEndColor borderInlineColor borderInlineStartColor borderInlineEndColor borderStartColor borderEndColor fill stroke"
);
add(
  "space",
  "p px py pt pb pl pr padding paddingTop paddingBottom paddingLeft paddingRight paddingHorizontal paddingVertical m mx my mt mb ml mr margin marginTop marginBottom marginLeft marginRight marginHorizontal marginVertical gap rowGap columnGap paddingStart paddingEnd marginStart marginEnd paddingBlock paddingBlockStart paddingBlockEnd paddingInline paddingInlineStart paddingInlineEnd marginBlock marginBlockStart marginBlockEnd marginInline marginInlineStart marginInlineEnd inset insetBlock insetBlockStart insetBlockEnd insetInline insetInlineStart insetInlineEnd start end l r t b left right top bottom"
);
add(
  "size",
  "w h minW maxW minH maxH width height minWidth maxWidth minHeight maxHeight inlineSize minInlineSize maxInlineSize blockSize minBlockSize maxBlockSize flexBasis"
);
add(
  "radius",
  "rounded borderRadius borderTopLeftRadius borderTopRightRadius borderBottomLeftRadius borderBottomRightRadius borderTopStartRadius borderTopEndRadius borderBottomStartRadius borderBottomEndRadius borderStartStartRadius borderStartEndRadius borderEndStartRadius borderEndEndRadius"
);
add("fontSize", "fontSize");
add("lineHeight", "lineHeight");
add("fontFamily", "fontFamily");
add("fontWeight", "fontWeight");
add("letterSpacing", "letterSpacing");
add(
  "borderWidth",
  "borderWidth borderTopWidth borderBottomWidth borderLeftWidth borderRightWidth borderStartWidth borderEndWidth borderBlockWidth borderBlockStartWidth borderBlockEndWidth borderInlineWidth borderInlineStartWidth borderInlineEndWidth outlineWidth"
);
for (const key of Object.keys(contract.geometry))
  categories.set(key, "geometry");
const nameOf = (node) => node?.name ?? node?.value;
const unwrap = (node) =>
  [
    "TSAsExpression",
    "TSSatisfiesExpression",
    "TSNonNullExpression",
    "ParenthesizedExpression",
  ].includes(node?.type)
    ? unwrap(node.expression)
    : node;

// True when the variable, or a member of it, is assigned or updated anywhere.
const isReassigned = (variable) =>
  variable.references.some((ref) => {
    let use = ref.identifier.parent;
    while (use?.type === "MemberExpression") use = use.parent;
    return (
      use?.type === "AssignmentExpression" || use?.type === "UpdateExpression"
    );
  });
// True when the variable is a const declaration that nothing writes after its initializer.
const isConstant = (variable) => {
  const def = variable.defs[0];
  return (
    def?.node?.type === "VariableDeclarator" &&
    def.parent?.kind === "const" &&
    !variable.references.some((ref) => ref.isWrite() && !ref.init)
  );
};
// True when the variable holds an object literal that is used other than as a JSX prop.
const objectEscapes = (variable) =>
  unwrap(variable.defs[0].node.init)?.type === "ObjectExpression" &&
  variable.references.some((ref) => {
    if (ref.init) return false;
    // Object identity must never escape: calls and aliases may mutate it.
    let use = ref.identifier;
    while (use.parent?.type === "MemberExpression" && use.parent.object === use)
      use = use.parent;
    return use.parent?.type !== "JSXExpressionContainer";
  });

// The values of the const an identifier names, or null when it is not a constant the plugin can read.
function identifierValues(node, context, seen) {
  let scope = context.sourceCode.getScope(node);
  while (scope) {
    const variable = scope.set.get(node.name);
    if (variable) {
      if (
        isReassigned(variable) ||
        !isConstant(variable) ||
        objectEscapes(variable)
      )
        return null;
      return values(variable.defs[0].node.init, context, seen);
    }
    scope = scope.upper;
  }
  return null;
}

function objectValues(node, context, seen) {
  const result = [];
  for (const prop of node.properties) {
    if (prop.type !== "Property" || prop.computed || prop.method) return null;
    const val = values(prop.value, context, seen);
    if (!val) return null;
    result.push(...val);
  }
  return result;
}

function values(node, context, seen = new Set()) {
  node = unwrap(node);
  if (!node || seen.has(node)) return null;
  const next = new Set(seen).add(node);
  if (node.type === "Literal") return [node.value];
  if (node.type === "TemplateLiteral" && !node.expressions.length)
    return [node.quasis[0].value.cooked];
  if (node.type === "ConditionalExpression") {
    const a = values(node.consequent, context, next);
    const b = values(node.alternate, context, next);
    return a && b ? [...a, ...b] : null;
  }
  if (node.type === "Identifier") return identifierValues(node, context, next);
  if (node.type === "ObjectExpression")
    return objectValues(node, context, next);
  if (node.type === "MemberExpression")
    return values(node.object, context, next);
  return null;
}

function valid(value, category, prop) {
  if (category === "geometry") return contract.geometry[prop].includes(value);
  const approved = category === "colors" ? colors : contract[category];
  if (typeof value === "number")
    return Array.isArray(approved) && approved.includes(value);
  if (typeof value !== "string") return false;
  // Token-bearing props have single-token payloads. Reject CSS functions/multiword literals.
  return value.split(/\s+/).every((clause) => {
    const token = clause.split(":").at(-1);
    if (Array.isArray(approved)) return approved.includes(token);
    if (Object.hasOwn(approved, token)) return true;
    if (category === "size" && Object.hasOwn(contract.space, token))
      return true;
    return (
      ["space", "size"].includes(category) &&
      (token === "auto" || /^(?:\d+(?:\.\d+)?%|100[ds]?vh)$/.test(token))
    );
  });
}

const namedColors = new Set(
  "aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen".split(
    " "
  )
);
// name(, at least one non-space argument character, balanced parentheses, closing ) ending the whole value.
function isColorFunction(s) {
  const open = /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/i.exec(s);
  if (!open || !s.endsWith(")")) return false;
  let depth = 0;
  for (let i = open[0].length - 1; i < s.length; i++) {
    if (s[i] === "(") depth++;
    else if (s[i] === ")" && --depth === 0 && i < s.length - 1) return false;
  }
  return depth === 0 && s.slice(open[0].length, -1).trim().length > 0;
}
const isColorLiteral = (text) => {
  const s = text.trim();
  return (
    /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s) ||
    isColorFunction(s) ||
    namedColors.has(s.toLowerCase())
  );
};

const themeKeys = new Set(Object.keys(contract.themes.dark));
const wrappers = [
  "ConditionalExpression",
  "LogicalExpression",
  "TSAsExpression",
  "TSSatisfiesExpression",
  "TSNonNullExpression",
  "ParenthesizedExpression",
];

// True when the call's callee resolves to an import of tamagui's `styled`, under any local name.
function isStyledCall(context, call) {
  if (call?.type !== "CallExpression" || call.callee.type !== "Identifier")
    return false;
  for (
    let scope = context.sourceCode.getScope(call);
    scope;
    scope = scope.upper
  ) {
    const binding = scope.set.get(call.callee.name);
    if (binding)
      return binding.defs.some(
        (def) =>
          def.node.type === "ImportSpecifier" &&
          def.node.imported.name === "styled"
      );
  }
  return false;
}
const isComponent = (opening) =>
  opening?.name?.type === "JSXMemberExpression" ||
  /^[A-Z]/.test(opening?.name?.name ?? "");
const knownProp = (attr) =>
  nameOf(attr.name) === "style" || categories.has(nameOf(attr.name));

// Wrappers, objects, spreads and property values hand the value up to their parent.
const passesUp = (parent, up) =>
  wrappers.includes(parent.type) ||
  parent.type === "ObjectExpression" ||
  parent.type === "SpreadElement" ||
  (parent.type === "Property" && parent.value === up);

// Climb from a value or object member to the place that hands it to Tamagui: a JSX attribute, a JSX spread, or styled() options.
function locate(context, node) {
  let up = node;
  let direct = true;
  for (;;) {
    const parent = up.parent;
    if (!parent) return null;
    if (parent.type === "ConditionalExpression" && parent.test === up)
      return null;
    if (passesUp(parent, up)) {
      if (
        parent.type === "ObjectExpression" ||
        parent.type === "SpreadElement" ||
        parent.type === "Property"
      )
        direct = false;
      up = parent;
      continue;
    }
    if (parent.type === "JSXAttribute")
      return { kind: "attr", attr: parent, opening: parent.parent, direct };
    if (
      parent.type === "JSXExpressionContainer" &&
      parent.parent?.type === "JSXAttribute"
    )
      return {
        kind: "attr",
        attr: parent.parent,
        opening: parent.parent.parent,
        direct,
      };
    if (parent.type === "JSXSpreadAttribute")
      return { kind: "spread", opening: parent.parent, direct };
    if (
      parent.type === "CallExpression" &&
      parent.arguments[1] === up &&
      isStyledCall(context, parent)
    )
      return { kind: "styled", direct };
    return null;
  }
}
// Objects Tamagui reads: styled() options, JSX spreads, and objects given to a prop the plugin knows. Other attributes (spec, data, options) hold chart data.
function tamaguiReadsObject(context, node) {
  const place = locate(context, node);
  return (
    place?.kind === "styled" ||
    place?.kind === "spread" ||
    (place?.kind === "attr" && knownProp(place.attr))
  );
}
const skipsChartSpec = (context, node) =>
  /(?:^|\/)src\/(?:viz|explorer)\//.test(
    (context.filename ?? "").replaceAll("\\", "/")
  ) && !tamaguiReadsObject(context, node);
// A theme token name is not a CSS colour where Tamagui resolves it: on components, never on intrinsic elements such as <path>.
function readByTamagui(context, node) {
  const place = locate(context, node);
  if (!place) return false;
  if (place.kind === "styled") return true;
  if (!isComponent(place.opening)) return false;
  return place.kind === "spread" || place.direct || knownProp(place.attr);
}

function vizThemeColors(context) {
  const report = (node) =>
    context.report({
      node,
      message:
        "Colours in src/viz come from VizTheme; do not write hex, rgb(), hsl(), or named CSS colour literals.",
    });
  return {
    Literal(node) {
      const parent = node.parent;
      if (
        typeof node.value !== "string" ||
        /^(?:ImportDeclaration|ExportAllDeclaration|ExportNamedDeclaration|ImportExpression|TSLiteralType)$/.test(
          parent?.type
        )
      )
        return;
      // A property key names a field (theme["gold"], { gold: 1 }); it is not a colour value.
      if (
        (parent?.type === "MemberExpression" &&
          parent.computed &&
          parent.property === node) ||
        (/^(?:Property|PropertyDefinition|TSPropertySignature)$/.test(
          parent?.type
        ) &&
          parent.key === node)
      )
        return;
      if (themeKeys.has(node.value) && readByTamagui(context, node)) return;
      if (isColorLiteral(node.value)) report(node);
    },
    TemplateLiteral(node) {
      if (
        !node.expressions.length &&
        isColorLiteral(node.quasis[0].value.cooked ?? "")
      )
        report(node);
    },
  };
}

function rule(kind) {
  return {
    meta: { type: "problem", schema: [] },
    create(context) {
      if (kind === "viz-theme-colors") return vizThemeColors(context);
      function check(prop, value, node) {
        if (!["semantic-colors", "token-values"].includes(kind)) return;
        const category = categories.get(prop);
        if (
          (kind === "semantic-colors" && category !== "colors") ||
          (kind === "token-values" && (!category || category === "colors"))
        )
          return;
        const resolved = values(value, context);
        if (
          !resolved ||
          !resolved.length ||
          !resolved.every((v) => valid(v, category, prop))
        )
          context.report({
            node,
            message: `${prop} must use approved ${category} values from design/contract.json; use a literal token or a statically verifiable const/conditional.`,
          });
      }
      function escape(prop, value, node) {
        if (kind !== "no-style-escape") return;
        if (prop === "style") {
          // Tamagui 3.3 excludes table display modes from its typed display prop.
          const obj = unwrap(value);
          if (
            obj?.type === "ObjectExpression" &&
            obj.properties.length === 1 &&
            nameOf(obj.properties[0].key) === "display" &&
            /^(table|table-cell|table-column|table-column-group|table-row|table-row-group|table-header-group)$/.test(
              obj.properties[0].value.value ?? ""
            )
          )
            return;
        }
        if (
          [
            "style",
            "className",
            "css",
            "dangerouslySetInnerHTML",
            "backgroundImage",
            "boxShadow",
            "textShadow",
            "filter",
            "backdropFilter",
            "border",
            "borderBlock",
            "borderInline",
            "borderTop",
            "borderBottom",
            "borderLeft",
            "borderRight",
            "borderBlockStart",
            "borderBlockEnd",
            "borderInlineStart",
            "borderInlineEnd",
            "outline",
          ].includes(prop)
        )
          context.report({
            node,
            message: `Use Tamagui props instead of ${prop}. Only the table display compatibility adapter is allowed.`,
          });
      }
      return {
        JSXOpeningElement(node) {
          if (
            kind === "no-style-escape" &&
            ["style", "link"].includes(nameOf(node.name))
          )
            context.report({
              node,
              message:
                "Use the approved generated stylesheet imports, not style/link elements.",
            });
        },
        JSXAttribute(node) {
          const prop = nameOf(node.name);
          const value =
            node.value?.type === "JSXExpressionContainer"
              ? node.value.expression
              : node.value;
          check(prop, value, node);
          escape(prop, value, node);
        },
        Property(node) {
          if (
            node.parent.type === "ObjectPattern" ||
            skipsChartSpec(context, node)
          )
            return;
          if (node.computed && kind === "no-style-escape")
            context.report({
              node,
              message:
                "Use explicit property names in UI objects so design values can be checked.",
            });
          check(nameOf(node.key), node.value, node);
          escape(nameOf(node.key), node.value, node);
        },
        JSXSpreadAttribute(node) {
          if (kind !== "no-style-escape") return;
          if (unwrap(node.argument)?.type !== "ObjectExpression")
            context.report({
              node,
              message:
                "Expand JSX spreads into explicit props so design values can be checked.",
            });
        },
        SpreadElement(node) {
          if (
            kind === "no-style-escape" &&
            !skipsChartSpec(context, node) &&
            node.parent.type === "ObjectExpression"
          )
            context.report({
              node,
              message:
                "Expand object spreads in UI source so design values can be checked.",
            });
        },
        ImportDeclaration(node) {
          if (
            kind === "no-css-imports" &&
            /\.(css|scss|sass|less)(?:[?#]|$)/.test(node.source.value) &&
            !["@tamagui/core/reset.css", "./tamagui.generated.css"].includes(
              node.source.value
            )
          )
            context.report({
              node,
              message:
                "Only the Tamagui reset and generated CSS may be imported.",
            });
        },
        ImportExpression(node) {
          const isJson =
            node.source.type === "Literal" &&
            typeof node.source.value === "string" &&
            /^[^?#]+\.json$/.test(node.source.value);
          if (kind === "no-css-imports" && !isJson)
            context.report({
              node,
              message:
                "Dynamic imports in UI source must name a literal JSON file; use static imports for code so stylesheet policy is enforceable.",
            });
        },
        CallExpression(node) {
          if (kind === "no-style-escape" && node.callee.type === "Identifier") {
            let scope = context.sourceCode.getScope(node);
            while (scope) {
              const binding = scope.set.get(node.callee.name);
              if (binding) {
                if (
                  binding.defs.some(
                    (def) =>
                      def.node.type === "ImportSpecifier" &&
                      def.node.imported.name === "styled"
                  ) &&
                  unwrap(node.arguments[1])?.type !== "ObjectExpression"
                )
                  context.report({
                    node,
                    message:
                      "Declare styled options inline so the complete style recipe is checked.",
                  });
                break;
              }
              scope = scope.upper;
            }
          }
          if (
            kind === "no-style-escape" &&
            ["insertRule", "replaceSync", "setProperty"].includes(
              nameOf(node.callee.property)
            )
          )
            context.report({
              node,
              message: "Do not inject CSS; use Tamagui props.",
            });
        },
      };
    },
  };
}
export default {
  meta: { name: "design" },
  rules: Object.fromEntries(
    [
      "semantic-colors",
      "token-values",
      "no-style-escape",
      "no-css-imports",
      "viz-theme-colors",
    ].map((name) => [name, rule(name)])
  ),
};
