import { defineRule, type ESTree } from "@oxlint/plugins";

const isTagKey = (key: ESTree.Node): boolean =>
  (key.type === "Identifier" && key.name === "_tag") ||
  (key.type === "Literal" && key.value === "_tag");

/**
 * `Extract<Union, { _tag: "A" }>` and `Exclude<...>` select members of a union that is defined
 * elsewhere; they declare nothing. Local change; see ../../UPSTREAM.md.
 */
const isMemberSelection = (node: ESTree.Node): boolean => {
  const literal = node.parent;
  const args = literal?.type === "TSTypeLiteral" ? literal.parent : undefined;
  const reference =
    args?.type === "TSTypeParameterInstantiation" ? args.parent : undefined;
  return (
    reference?.type === "TSTypeReference" &&
    reference.typeName.type === "Identifier" &&
    (reference.typeName.name === "Extract" ||
      reference.typeName.name === "Exclude")
  );
};

export const noManualTaggedTypeRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Derive tagged types from a tagged Schema or Data constructor instead of declaring `_tag` in a type or interface.",
    },
    messages: {
      manualTaggedType:
        "Do not declare `_tag` by hand. Define the value with Schema.TaggedStruct, Schema.TaggedClass, Schema.TaggedError, Schema.TaggedUnion, Data.TaggedClass, Data.TaggedError, or Data.taggedEnum, then infer the type from it, e.g. `export type X = typeof X.Type`.",
    },
  },
  createOnce(context) {
    return {
      TSPropertySignature(node) {
        if (isTagKey(node.key) && !isMemberSelection(node)) {
          context.report({ node, messageId: "manualTaggedType" });
        }
      },
    };
  },
});
