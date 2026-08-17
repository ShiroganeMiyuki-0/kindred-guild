# Kindred Guild growth and communication audit

## Live homepage findings

The homepage now gives visitors four understandable entry points: needing help, offering help, having an idea, or wanting to meet people. The public quest board also has a deliberate empty state instead of silently rendering nothing. The browser showed that the live database currently reports 46 members, 131 quests posted, 10 completed tasks, and 0 coins earned, while the public board has no open quests. This means the acquisition problem is not only the absence of features. It is also a communication and liquidity problem: visitors need to understand what is happening now, what they can safely do first, and how their first contribution will be noticed.

The homepage already contains useful announcements and trust explanations, but it still has a large feature inventory. The new conversation starter is a better bridge because it asks the visitor to identify with a role instead of asking them to understand the whole platform. The empty quest state now communicates an honest founding-stage situation and gives two immediate actions.

## Product diagnosis

The next Kindred improvement should make early participation feel socially acknowledged. A new visitor should see a clear founding-season invitation, a concrete first contribution, and a promise of what happens after they act: the request becomes visible, a worker can respond, and the member can help shape the Guild. Public metrics should be paired with interpretation rather than left as isolated numbers. Sparse activity should be framed honestly, never hidden or fabricated.

The existing “Live Quest Board” has no open public quests despite many historical quests, so the homepage must avoid implying current liquidity that is not present. A useful next step is a clearly labeled founder-led starter quest or community prompt, provided it is real, transparent, and backed by the owner—not an artificial bot activity stream.

## Guild Hall verification

The unauthenticated Guild Hall initially showed a generic “We could not verify your session” toast over an otherwise empty chat surface. That contradicted the homepage invitation to join the conversation. The Hall now uses an optional silent, non-redirecting auth check for public visitors, renders a welcoming preview card with the prompt “What would make Kindred Guild useful to you this week?”, disables the composer with an honest “Join the Guild to write here” label, and offers direct links to join or learn more. A cache-busted shared helper URL was added so browsers do not retain the old error behavior. Fresh browser verification showed the preview and no session-error toast.

## Quest Board verification

The public Quest Board had the same communication failure as the Guild Hall: it forced authentication, showed “Loading...,” and displayed a session-error toast to visitors. The board now loads in visitor-preview mode. It labels the visitor honestly, keeps the Available view public, disables member-only views with an explanation, shows granted-wish activity when available, and provides a human empty-board invitation or a join-to-accept action for public quests. Both the shared auth helper and Quest Board controller are cache-busted so the real browser loads the new behavior. Fresh browser verification showed “Visitor preview,” disabled member-only tabs, and no session-error toast.

## Latest public-board verification

After the data request settled, the live Quest Board showed “The board is waiting for its next story,” explained that no open public quests are currently available, and offered “Join the Guild” and “See How the Guild Works.” The header displayed “Join to Post a Task,” the visitor label remained visible, member-only tabs remained disabled with join explanations, and the granted-wish update was visible. No session-error toast appeared.

## Homepage public-quest verification

The homepage empty-state now offers “Browse the Quest Board,” “Join to Post the First Quest,” and “Say Hello in the Hall.” The live preview also renders public quest cards as links to the Quest Board rather than sending every visitor directly to authentication. The first-screen path chooser remains visible and human-readable.

## Worker Board verification

The public Worker Board now loads without a session-error path. It labels the visitor preview, replaces the protected posting form with “Offer a skill to the Guild,” provides “Join to Offer Your Skills,” and renders existing worker listings with “Join to Contact.” The onboarding overlay was updated to use the same language rather than describing a form the visitor cannot use.

## Original everyday-quest and join-gate verification

The Quest Post page now shows 11 starting points, including Quick Favor, Community Setup, and Study Buddy. Anonymous visitors see “Visitor preview,” a clear explanation that posting requires membership, “Join to Post a Task,” and “Browse the Quest Board,” with no session-error toast. The onboarding copy matches the new experience.
