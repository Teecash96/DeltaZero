# Glaze Build Prompt — Cehua

Build **Cehua**, a simple, polished Mac app that turns a product idea into a lightweight PRD and a visual user-flow diagram with AI.

This is a hackathon MVP. Keep the build small enough to complete in approximately 30 minutes. Prioritize one complete, working experience over advanced features.

## Purpose

Cehua helps a founder, product manager, or developer quickly organize an early product idea. The user describes what they want to build, Cehua generates a concise PRD and user flow, and the user can review, edit, copy, and export the result.

## Main user journey

1. The user opens Cehua and sees a welcoming empty state.
2. They enter a product idea and a few optional details.
3. They click **Generate plan**.
4. Cehua uses Glaze AI to generate a concise PRD and user flow.
5. The result appears in a clean workspace with **PRD** and **User Flow** tabs.
6. The user can edit the generated content, regenerate it, copy it, or export it as Markdown.

## Screen 1: New plan

Create a simple form containing:

- Product or feature name
- Describe your idea — required multiline field
- Target user — optional
- Main problem — optional
- Primary goal — optional
- **Generate plan** button

Include three clickable example ideas below the form so judges can try the app immediately. Disable the Generate button until the idea field contains text. Show a clear inline message if the user tries to submit incomplete information.

## Screen 2: Generated workspace

After generation, show the project name at the top and two tabs.

### PRD tab

Generate an editable, concise PRD with these sections:

- Product summary
- Problem
- Target user
- User goal
- Core features — maximum five
- User stories — maximum five
- Success criteria — maximum five
- Assumptions
- Out of scope

Keep the PRD practical and brief. Do not invent market statistics, customer research, or unsupported facts. Clearly label reasonable assumptions.

### User Flow tab

Generate one primary user flow based on the PRD. Display it as a clear left-to-right or top-to-bottom visual diagram using connected cards.

Every step should have:

- A short step title
- The user action
- The expected result

The diagram should include:

- Entry point
- Main actions
- One decision point when relevant
- Success outcome
- One simple failure or retry path
- Exit or next step

Keep the diagram readable and limited to approximately five to eight steps. Selecting a card should reveal its details. Also provide a plain-text numbered version beneath the visual diagram for accessibility and easy copying.

## Screen 3: Saved plans

Save projects locally on the Mac. Add a simple sidebar listing recent plans with their name and last-edited time. The user can open, rename, or delete a saved plan. Ask for confirmation before deletion.

## AI behavior

Use Glaze AI for generation. Give the AI the form inputs and request structured output for the PRD and user-flow steps. While generation is running, show a friendly loading state such as “Turning your idea into a plan…”.

If generation fails, keep the user’s input and show **Try again**. Do not leave the user on a blank screen. The user must be able to manually edit all generated text.

## Export actions

Provide three simple actions:

- **Copy PRD** — copies the PRD as formatted text
- **Copy user flow** — copies the numbered flow
- **Export Markdown** — saves one `.md` file containing the project title, PRD, and numbered user flow

Show a brief confirmation after a successful copy or export.

## Visual direction

Make Cehua feel calm, intelligent, and native to the Mac. Use a clean sidebar, generous spacing, readable typography, subtle borders, and one restrained blue or indigo accent color. Support light and dark mode. Avoid gradients, decorative dashboards, excessive cards, complex animations, and chat-style bubbles.

The primary visual signature is the connected user-flow diagram. It should look polished enough to demonstrate clearly during the hackathon.

## Accessibility and essential states

- Support keyboard navigation and visible focus.
- Give buttons and diagram steps clear labels.
- Do not rely on color alone to communicate meaning.
- Include empty, generating, success, error, and no-saved-plans states.
- Preserve the user’s form input when generation fails.

## Strict scope limits

Do not add:

- Accounts, sign-in, teams, or collaboration
- Cloud databases or sync
- Repository or file indexing
- GitHub, Linear, Slack, or other integrations
- Code generation or code execution
- Command-line or terminal features
- Prototype builders
- Analytics
- Payments or subscriptions
- PDF generation
- Multiple AI providers or API-key settings
- Complex permissions or approval workflows

Use local storage only. Choose the simplest reliable implementation supported by Glaze. Do not spend time creating a custom framework or elaborate architecture.

## Definition of done

Cehua is complete when a judge can launch the app, choose an example or enter an idea, generate a concise PRD and visual user flow, edit the result, save it locally, reopen it from the sidebar, copy either output, and export the complete plan as Markdown without encountering a broken state.
