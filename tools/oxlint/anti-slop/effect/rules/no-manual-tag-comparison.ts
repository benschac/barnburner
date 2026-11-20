import { defineRule } from "@oxlint/plugins";

import {
  isInsideBroadEffectHandler,
  tagMemberFromComparison,
} from "../shared/tagged-values.ts";

// Local change (see ../../UPSTREAM.md): a `switch` over `_tag` is allowed, because
// typescript/switch-exhaustiveness-check already fails one that misses a member.
export const noManualTagComparisonRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Use Effect Match, Predicate helpers, or an exhaustive `switch` instead of comparing `_tag` by hand.",
    },
    messages: {
      manualComparison:
        "Use Match.valueTags or Match.tagsExhaustive for tagged-value branching, a `switch` that covers every member, or Predicate.isTagged for a simple reusable predicate.",
    },
  },
  createOnce(context) {
    return {
      BinaryExpression(node) {
        if (
          tagMemberFromComparison(node) === undefined ||
          isInsideBroadEffectHandler(node)
        ) {
          return;
        }
        context.report({ node, messageId: "manualComparison" });
      },
    };
  },
});
