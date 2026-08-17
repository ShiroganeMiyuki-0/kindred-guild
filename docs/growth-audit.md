# Kindred Guild growth and communication audit

## Live homepage findings

The homepage now gives visitors four understandable entry points: needing help, offering help, having an idea, or wanting to meet people. The public quest board also has a deliberate empty state instead of silently rendering nothing. The browser showed that the live database currently reports 46 members, 131 quests posted, 10 completed tasks, and 0 coins earned, while the public board has no open quests. This means the acquisition problem is not only the absence of features. It is also a communication and liquidity problem: visitors need to understand what is happening now, what they can safely do first, and how their first contribution will be noticed.

The homepage already contains useful announcements and trust explanations, but it still has a large feature inventory. The new conversation starter is a better bridge because it asks the visitor to identify with a role instead of asking them to understand the whole platform. The empty quest state now communicates an honest founding-stage situation and gives two immediate actions.

## Product diagnosis

The next Kindred improvement should make early participation feel socially acknowledged. A new visitor should see a clear founding-season invitation, a concrete first contribution, and a promise of what happens after they act: the request becomes visible, a worker can respond, and the member can help shape the Guild. Public metrics should be paired with interpretation rather than left as isolated numbers. Sparse activity should be framed honestly, never hidden or fabricated.

The existing “Live Quest Board” has no open public quests despite many historical quests, so the homepage must avoid implying current liquidity that is not present. A useful next step is a clearly labeled founder-led starter quest or community prompt, provided it is real, transparent, and backed by the owner—not an artificial bot activity stream.

## Guild Hall verification

The unauthenticated Guild Hall initially showed a generic “We could not verify your session” toast over an otherwise empty chat surface. That contradicted the homepage invitation to join the conversation. The Hall now uses an optional silent, non-redirecting auth check for public visitors, renders a welcoming preview card with the prompt “What would make Kindred Guild useful to you this week?”, disables the composer with an honest “Join the Guild to write here” label, and offers direct links to join or learn more. A cache-busted shared helper URL was added so browsers do not retain the old error behavior. Fresh browser verification showed the preview and no session-error toast.
