# Nchat H5 Design

## Summary

Nchat is a Nexa App only H5 chat application. It is not meant to be used from the PC web experience. Users enter through Nexa authorization, complete a required profile setup on first launch, receive a permanent unique 8-digit chat ID, search other users by nickname or chat ID, add friends instantly, and exchange one-to-one text messages in real time.

This first version intentionally stays narrow:

- Nexa App only
- One-to-one text chat only
- Bottom tabs: `聊天` and `我的`
- Search and instant mutual friendship
- SSE for real-time incoming message and unread updates
- Telegram-like unread badges on conversation rows

## Goals

- Reuse the project's existing Nexa authorization pattern instead of inventing a new login flow.
- Keep the UI mobile-first and H5-friendly inside Nexa App.
- Make the first-use flow simple: authorize, upload avatar, set nickname, start chatting.
- Make user identification stable with Nexa `openId` plus a platform-owned 8-digit chat ID.
- Ensure users receive new messages in real time while online.

## Non-goals

- No group chat
- No image, audio, or file message types
- No message recall, delete, or block list
- No public user square or discovery feed
- No desktop web experience
- No cross-partner Nexa account linking beyond the current app's `openId`

## Product Rules

### Platform access

- Nchat should only be usable inside Nexa App.
- If opened from a regular browser or unsupported host environment, the page should render a clear blocking state:
  - Title: `请在 Nexa App 内打开 Nchat`
  - No chat features should be accessible.

### Login and identity

- Entry route: `/nchat/`
- On first load inside Nexa App:
  - Trigger Nexa authorization immediately.
  - Sync authorized session to backend.
- Backend should treat Nexa `openId` as the stable external identity key.
- Nchat should assign one permanent unique 8-digit numeric `chatId` per user.
- Nicknames may repeat.
- Internal logic must never rely on nickname uniqueness.

### First-use profile completion

- After successful authorization, if the user has no avatar or no nickname, force a profile setup modal/screen.
- Required fields:
  - avatar upload
  - nickname input
- Until profile setup is completed, the user cannot enter the chat list.

### Friend adding

- Search supports:
  - nickname keyword
  - exact 8-digit chat ID
- When a user taps the result action:
  - friendship is created immediately
  - both sides become friends at once
  - a direct conversation is created or reused
  - the initiator is taken directly into the conversation
- Searching self should be blocked with a friendly error.
- If users are already friends, the action should just open the existing conversation.

### Messaging

- Only friends can message each other.
- Messages are plain text only.
- Empty messages should be blocked.
- Sender sees the new message inserted immediately after successful send.
- Receiver gets a real-time push event while online.

### Unread badge behavior

- Conversation rows must show:
  - avatar
  - nickname
  - chat ID
  - latest message
  - latest time
  - unread badge
- If a friend sends 1 unread message, badge shows `1`.
- If the friend sends 2 unread messages, badge shows `2`.
- Badge keeps incrementing until the conversation is opened.
- When the user opens that conversation, unread count for that conversation is cleared and the badge disappears immediately.

## UI Structure

## Entry and guard states

- `Nchat` page should follow the existing project pattern used by other Nexa-integrated H5 apps.
- Guard states:
  - unsupported environment state
  - loading / authorizing state
  - forced profile setup state
  - main app state

## Main tabs

Bottom navigation contains only:

- `聊天`
- `我的`

## Chat tab

### Header area

- Search input at top
- Placeholder can be Chinese-first, for example:
  - `搜索昵称或聊天号`

### Default content

- Show conversation list, not all platform users.
- Each row displays:
  - avatar
  - nickname
  - chat ID
  - latest message preview
  - latest timestamp
  - unread badge when unread count > 0

### Search flow

- Input search term
- Trigger backend search
- Show matching users with:
  - avatar
  - nickname
  - chat ID
  - button like `添加并聊天`

### Conversation view

- Full-screen or panel view inside the same H5 app
- Top bar:
  - back button
  - target avatar
  - nickname
  - chat ID
- Message list in middle
- Composer at bottom:
  - text input
  - send button

## My tab

- Show current user's avatar
- Show nickname
- Show 8-digit chat ID
- Support editing avatar and nickname
- Chat ID is read-only
- Add a copy button for chat ID

## Data Model

### `nchat_users`

- `id`
- `open_id`
- `chat_id`
- `nickname`
- `avatar_url`
- `created_at`
- `updated_at`

Constraints:

- unique on `open_id`
- unique on `chat_id`
- nickname not unique

### `nchat_friendships`

- `id`
- `user_a_id`
- `user_b_id`
- `created_at`

Constraints:

- canonical pair storage should prevent duplicate reversed rows
- unique pair on the normalized user combination

### `nchat_conversations`

- `id`
- `user_a_id`
- `user_b_id`
- `last_message_id`
- `last_message_preview`
- `last_message_at`
- `created_at`
- `updated_at`

Constraints:

- one unique direct conversation per normalized user pair

### `nchat_messages`

- `id`
- `conversation_id`
- `sender_user_id`
- `receiver_user_id`
- `content`
- `created_at`
- `read_at`

### `nchat_inbox_state`

- `id`
- `conversation_id`
- `user_id`
- `unread_count`
- `last_read_message_id`
- `updated_at`

This table powers per-user unread badges without recomputing from the entire message history on every render.

## API Design

### Session and bootstrap

#### `POST /api/nchat/session`

Purpose:

- Accept Nexa auth payload from frontend
- Normalize and persist server session
- Ensure a `nchat_users` row exists
- Generate `chatId` if user is new

Request:

- `openId`
- `sessionKey`
- optional `nickname`
- optional `avatar`

Response:

- normalized session object
- basic user info if available

#### `GET /api/nchat/session`

Purpose:

- Read current authenticated Nchat session from cookie

#### `GET /api/nchat/bootstrap`

Purpose:

- Return the initial app payload:
  - current user profile
  - whether profile completion is required
  - conversation list
  - unread totals

### Profile

#### `POST /api/nchat/profile`

Purpose:

- Save first-time profile setup
- Later allow editing avatar and nickname

Request:

- `nickname`
- `avatarUrl` or uploaded asset reference

Rules:

- nickname required
- avatar required for first completion

### Search and friendship

#### `GET /api/nchat/search?q=`

Purpose:

- Search users by nickname or chat ID

Behavior:

- If query is an 8-digit numeric string, prefer exact chat ID match
- Otherwise perform nickname contains match
- Exclude self from results

#### `POST /api/nchat/friends`

Purpose:

- Instantly create friendship and ensure a direct conversation exists

Request:

- target user identifier, preferably internal target user ID or chat ID

Response:

- friendship result
- conversation summary

### Conversations and messages

#### `GET /api/nchat/conversations`

Purpose:

- Return current user's conversation list with unread counts

#### `GET /api/nchat/conversations/:id/messages`

Purpose:

- Return message history for a direct conversation

Scope for v1:

- newest or oldest ordering can follow the existing frontend convention, but should be consistent
- simple pagination can be omitted initially if message count is still reasonable

#### `POST /api/nchat/conversations/:id/messages`

Purpose:

- Send a new text message

Request:

- `content`

Behavior:

- validate sender belongs to conversation
- validate sender and receiver are friends
- reject empty content
- insert message
- update conversation summary
- increment receiver unread count
- emit realtime event

#### `POST /api/nchat/conversations/:id/read`

Purpose:

- Clear unread count for current user when conversation is opened

Behavior:

- set unread count to zero
- update read markers
- return latest conversation state

### Realtime

#### `GET /api/nchat/events`

Purpose:

- SSE endpoint for current logged-in user

Events:

- `nchat.message`
  - new incoming message payload
- `nchat.conversation-updated`
  - latest preview, time, unread count changed
- `nchat.read-updated`
  - optional event for clearing badge state on another open view if needed

## Realtime Strategy

- Use one SSE connection per logged-in online user.
- Reuse the project's current SSE architectural style already used in other modules.
- On message send:
  - persist message
  - update unread counters and conversation summary
  - emit events to receiver
  - optionally emit conversation update to sender as well

Frontend behavior:

- In chat list:
  - update matching conversation row in place
  - move it to the top if it became the latest conversation
  - refresh unread badge number
- In open conversation:
  - append incoming message directly to the message flow
  - if conversation is currently active, mark read immediately or right after load sync

## Chat ID allocation

- Chat ID format: exactly 8 numeric digits
- Allocation strategy:
  - generate random candidate
  - retry until unique
- Avoid sequential IDs to reduce predictability

## Error Handling

- Not in Nexa App:
  - show blocking state
- Unauthorized:
  - restart Nexa auth flow
- Missing profile:
  - force profile completion
- Search with no results:
  - show `未找到用户`
- Search self:
  - show `不能添加自己`
- Existing friend:
  - open conversation instead of error
- Send empty message:
  - reject on frontend and backend
- SSE disconnect:
  - auto reconnect with backoff

## Security and correctness

- Session cookie should follow the existing secure Nexa app patterns already used in the project.
- Backend should derive current user identity from server session, not from client-claimed sender IDs.
- Conversation access must always verify membership.
- Message sending must always verify friendship + conversation ownership.
- Search results should not leak more profile data than necessary.

## Route and navigation integration

- New public route: `/nchat/`
- Add a dedicated H5 app entry, but do not surface it as a normal PC web app.
- If the project's games/app directory needs a card entry, that entry should be intended for Nexa access only.

## Testing Strategy

### Page tests

- Nchat page renders mobile-first app shell
- bottom nav has `聊天` and `我的`
- unsupported browser state is present
- forced profile setup UI exists

### State / frontend tests

- search result selection creates/open conversation
- unread badge increments on pushed incoming messages
- unread badge disappears after opening and marking read

### API tests

- session sync creates Nchat user and stable 8-digit chat ID
- duplicate `openId` reuses same chat ID
- search by nickname works
- search by chat ID works
- self search add is blocked
- adding friend creates normalized friendship and conversation
- sending message stores message and updates conversation preview
- reading conversation clears unread count

### SSE tests

- receiver stream gets notified when sender sends message
- conversation list unread count is updated through event payload

## Recommended implementation order

1. database schema for users, friendships, conversations, messages, unread state
2. session and bootstrap endpoints
3. profile completion flow
4. search and instant friend creation
5. conversation list and message history endpoints
6. send message endpoint
7. SSE event stream and realtime updates
8. unread badge behavior
9. mobile polish and Nexa-only blocking state

## Open assumptions confirmed with user

- Nexa App only
- H5 app
- bottom tabs are `聊天` and `我的`
- nickname may repeat
- chat ID is unique 8 digits
- search by nickname or chat ID
- searching and tapping result adds friend immediately
- only one-to-one chat in v1
- receiver should get messages in real time
- unread badge should behave like Telegram-style list counters
