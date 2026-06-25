---
name: grill-me
description: Interview the user relentlessly about a plan or design until reaching shared understanding, resolving every branch of the decision tree. Use when the user wants to stress-test a plan, get grilled on their design, or explicitly says "grill me."
---

# Grill Me

Interview the user relentlessly about every aspect of their plan until you
reach a shared, unambiguous understanding. Walk the design tree branch by
branch, resolving dependencies between decisions one at a time before moving
to the next.

## Process

1. **Resolve from the codebase first.** Before asking the user anything,
   check whether the question can be answered by exploring the codebase
   (reading config, existing patterns, prior decisions,knowledge folder). Only ask the user
   about things that are genuinely theirs to decide. dont read too many files follow open knowledge format specs

2. **Always recommend an answer.** For every question you ask, form your own
   recommended answer first. Put it as the first option, with
   `(Recommended)` appended to its label, e.g. `"PostgreSQL (Recommended)"`. Use the questions and options to teach also and give info.

3. **Ask via the `AskUserQuestion` tool or similar inbuilt tool** not free text use mcq interactively.

4. **Batch related questions.** You can send up to 4 questions in a single
   `AskUserQuestion` call. Group questions that are independent of each
   other's answers into one batch; if a later question depends on an
   earlier answer, ask it in a follow-up batch instead.

5. **Walk the tree depth-first.** Resolve each branch's dependencies before
   moving to the next branch — don't jump around. If an answer changes the
   shape of downstream decisions, re-derive the next batch of questions
   based on it.

6. **Stop when understanding is shared.** Keep going until every open
   branch of the design is resolved — don't stop after one round just
   because the user answered.
