# Kloak Native Functions Reference

> Official Kloak frontend source.
> This document catalogs every exported function, store, hook, type, and constant

---

## Table of Contents

- [Supabase Client & Auth Infrastructure](#supabase-client--auth-infrastructure)
- [Stores (Zustand State Management)](#stores-zustand-state-management)
  - [authStore](#authstore)
  - [serverStore](#serverstore)
  - [messageStore](#messagestore)
  - [dmStore](#dmstore)
  - [friendStore](#friendstore)
  - [notificationStore](#notificationstore)
  - [pollStore](#pollstore)
  - [voiceStore](#voicestore)
  - [voiceSettingsStore](#voicesettingsstore)
  - [channelSettingsStore](#channelsettingsstore)
  - [uiStore](#uistore)
  - [embedStore](#embedstore)
  - [syncStore](#syncstore)
  - [offlineQueueStore](#offlinequeuestore)
- [Library Functions](#library-functions)
  - [crypto](#libcrypto)
  - [security](#libsecurity)
  - [permissions](#libpermissions)
  - [permissionMeta](#libpermissionmeta)
  - [message](#libmessage)
  - [format](#libformat)
  - [storage (localStorage)](#libstorage)
  - [storageUpload (file uploads)](#libstorageupload)
  - [presence](#libpresence)
  - [userCache](#libusercache)
  - [serverEmojis](#libserveremojis)
  - [globalEmojiResolver](#libglobalemojiresolver)
  - [ghostIdentity](#libghostidentity)
  - [errorHandler](#liberrorhandler)
  - [poll](#libpoll)
  - [voiceSounds](#libvoicesounds)
  - [avatarDecorations](#libavatardecorations)
  - [profileEffects](#libprofileeffects)
  - [tauriRuntime](#libtauriruntime)
  - [maintenance](#libmaintenance)
- [Hooks (Realtime & UI)](#hooks-realtime--ui)
  - [Realtime Subscriptions](#realtime-subscriptions)
  - [Voice & Audio](#voice--audio)
  - [Unread Tracking](#unread-tracking)
  - [Presence & Status](#presence--status)
  - [UI & Utility Hooks](#ui--utility-hooks)
- [Types & Constants](#types--constants)
- [Supabase RPC Reference](#supabase-rpc-reference)
- [Edge Function Reference](#edge-function-reference)
- [Supabase Tables & Buckets](#supabase-tables--buckets)
- [Realtime Channel Map](#realtime-channel-map)

---

## Supabase Client & Auth Infrastructure

**File:** `integrations/supabase/client.ts`

Kloak uses Supabase with a **custom key-hash authentication** system (not Supabase Auth sessions).

```
Supabase Project Ref: foquucurnwpqcvgqukpz
Auth model: Secret key → SHA-256 hash → x-key-hash header on every request
Session persistence: DISABLED (persistSession: false)
```

### Key Functions

| Function           | Signature                           | Description                                                            |
| ------------------ | ----------------------------------- | ---------------------------------------------------------------------- |
| `setKeyHashHeader` | `(keyHash: string \| null) => void` | Set/clear the `x-key-hash` header injected into every Supabase request |
| `getKeyHash`       | `() => string \| null`              | Get current key hash (sync)                                            |
| `getKeyHashAsync`  | `() => Promise<string \| null>`     | Get key hash with localStorage fallback (async)                        |

### Auth Flow

1. User registers → gets a 64-char hex **secret key** (their only credential)
2. Secret key is SHA-256 hashed → **key hash**
3. Key hash is sent as `x-key-hash` header on every Supabase request
4. The `authToken` exposed in the app already includes `"Bearer "` prefix — never prepend it again

---

## Stores (Zustand State Management)

All stores use Zustand. Some use `persist` middleware for localStorage persistence.

---

### authStore

**File:** `stores/authStore.ts` — **Persists to:** `"kloak-auth"` (secretKey, keyHash, manualStatus)

#### State

| Property          | Type                 | Description                             |
| ----------------- | -------------------- | --------------------------------------- |
| `user`            | `User \| null`       | Current logged-in user                  |
| `secretKey`       | `string \| null`     | User's secret key credential            |
| `keyHash`         | `string \| null`     | SHA-256 hash of secret key              |
| `isAuthenticated` | `boolean`            | Login state                             |
| `isLoading`       | `boolean`            | Auth check in progress                  |
| `error`           | `string \| null`     | Last error message                      |
| `isNewUser`       | `boolean`            | Just registered flag                    |
| `manualStatus`    | `UserStatus \| null` | Persisted manual status (DND/Invisible) |

#### Actions

| Method           | Signature                                                                            | RPC / Edge Function                                             |
| ---------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `createAccount`  | `(username, hcaptchaResponse) => Promise<{secretKey, user} \| null>`                 | Edge: `register-with-captcha`                                   |
| `login`          | `(secretKey) => Promise<boolean>`                                                    | RPC: `login_user`                                               |
| `logout`         | `() => void`                                                                         | RPC: `update_user_status` (set offline)                         |
| `checkAuth`      | `() => Promise<boolean>`                                                             | RPC: `login_user` (re-validate)                                 |
| `updateUser`     | `(updates: Partial<User>) => Promise<void>`                                          | Edge: `update-user-profile`                                     |
| `updateStatus`   | `(status, opts?) => Promise<void>`                                                   | RPC: `update_user_status` (manual=immediate, auto=90s coalesce) |
| `updateLastSeen` | `() => Promise<void>`                                                                | RPC: `update_user_last_seen` (throttled 60s)                    |
| `resetSecretKey` | `() => Promise<{newSecretKey} \| {error, cooldownEndsAt?, hoursRemaining?} \| null>` | RPC: `reset_user_secret_key`                                    |
| `setUser`        | `(user) => void`                                                                     | Local only                                                      |
| `setSecretKey`   | `(key) => void`                                                                      | Local only                                                      |
| `setIsNewUser`   | `(isNew) => void`                                                                    | Local only                                                      |

**Standalone:** `initializeAuth(): Promise<void>` — Call on app load to rehydrate auth from persisted secretKey.

---

### serverStore

**File:** `stores/serverStore.ts` — No persistence middleware (uses localStorage manually for current server/channel)

#### State

| Property              | Type                     |
| --------------------- | ------------------------ |
| `servers`             | `ServerWithMembership[]` |
| `currentServer`       | `Server \| null`         |
| `currentChannel`      | `Channel \| null`        |
| `categories`          | `ChannelCategory[]`      |
| `channels`            | `Channel[]`              |
| `members`             | `ServerMember[]`         |
| `roles`               | `CustomServerRole[]`     |
| `rolePermissions`     | `RolePermission[]`       |
| `channelPermissions`  | `ChannelPermission[]`    |
| `categoryPermissions` | `CategoryPermission[]`   |

#### Server Actions

| Method                                        | RPC                                                |
| --------------------------------------------- | -------------------------------------------------- |
| `fetchServers(userId)`                        | `get_user_servers`                                 |
| `createServer(name, ownerId)`                 | `create_server_with_owner`                         |
| `updateServer(serverId, userId, updates)`     | `update_server`                                    |
| `joinServer(inviteCode, userId, joinSource?)` | `join_server_by_invite`, `is_server_banned_secure` |
| `leaveServer(serverId, userId)`               | `leave_server`                                     |
| `deleteServer(serverId)`                      | `delete_server`                                    |
| `toggleServerMute(serverId, userId)`          | `toggle_server_mute`                               |

#### Channel Actions

| Method                                                                                    | RPC                                            |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `fetchChannels(serverId)`                                                                 | `get_server_categories`, `get_server_channels` |
| `createChannel(serverId, name, type, userId, categoryId?, icon?, isPrivate?, ghostMode?)` | `create_channel`                               |
| `updateChannel(channelId, updates, userId)`                                               | `update_channel`                               |
| `deleteChannel(channelId, userId)`                                                        | `delete_channel`                               |
| `createCategory(serverId, name, userId)`                                                  | `create_category`                              |
| `updateCategory(categoryId, updates, userId)`                                             | `update_category`                              |
| `deleteCategory(categoryId, userId)`                                                      | `delete_category`                              |
| `reorderCategories(categoryIds)`                                                          | `reorder_categories`                           |
| `reorderChannels(channelId, newCategoryId, newPosition)`                                  | `reorder_channels`                             |
| `moveChannelToCategory(channelId, categoryId)`                                            | `move_channel_to_category`                     |
| `fetchChannelMembers(channelId)`                                                          | `get_channel_members`                          |
| `addChannelMember(channelId, targetUserId, addedBy)`                                      | `add_channel_member`                           |
| `removeChannelMember(channelId, targetUserId, removedBy)`                                 | `remove_channel_member`                        |

#### Member Actions

| Method                                    | RPC                                                                   |
| ----------------------------------------- | --------------------------------------------------------------------- |
| `fetchMembers(serverId, opts?)`           | `get_server_members` (lite) / `get_server_members_full_secure` (full) |
| `updateMember(memberId, updates)`         | `update_member_nickname`, `toggle_mute_member`, `change_member_role`  |
| `kickMember(serverId, userId)`            | `kick_member`                                                         |
| `banMember(serverId, userId)`             | `ban_member`                                                          |
| `transferOwnership(serverId, newOwnerId)` | `transfer_ownership`                                                  |

#### Role Actions

| Method                                             | RPC                       |
| -------------------------------------------------- | ------------------------- |
| `fetchRoles(serverId)`                             | `get_server_roles_secure` |
| `createRole(serverId, userId, name, color, icon?)` | `create_server_role`      |
| `updateRole(roleId, userId, updates)`              | `update_server_role`      |
| `deleteRole(roleId, userId)`                       | `delete_server_role`      |
| `reorderRoles(serverId, userId, orderedRoleIds)`   | `reorder_server_roles`    |
| `assignRoleToMember(memberId, roleId, userId)`     | `assign_role_to_member`   |
| `removeRoleFromMember(memberId, roleId, userId)`   | `remove_role_from_member` |

#### Permission Actions

| Method                                                                                              | RPC                                     |
| --------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `fetchRolePermissions(serverId, opts?)`                                                             | `get_role_permissions`                  |
| `fetchChannelPermissions(channelId, opts?)`                                                         | `get_channel_permissions`               |
| `fetchCategoryPermissions(categoryId)`                                                              | `get_category_permissions`              |
| `setRolePermission(serverId, userId, permission, roleId?, roleName?, allowed?)`                     | `set_role_permission`                   |
| `setChannelPermission(channelId, userId, permission, allowed, roleId?, roleName?, targetUserId?)`   | `set_channel_permission`                |
| `setCategoryPermission(categoryId, userId, permission, allowed, roleId?, roleName?, targetUserId?)` | `set_category_permission`               |
| `deleteRolePermission(permissionId, userId)`                                                        | `delete_role_permission`                |
| `deleteChannelPermission(permissionId, userId)`                                                     | `delete_channel_permission`             |
| `deleteCategoryPermission(permissionId, userId)`                                                    | `delete_category_permission`            |
| `syncCategoryPermissionsToChannels(categoryId, userId)`                                             | `sync_category_permissions_to_channels` |

#### Import Actions

| Method                                                 | Edge Function            |
| ------------------------------------------------------ | ------------------------ |
| `importDiscordTemplate(serverId, userId, templateUrl)` | `fetch-discord-template` |

---

### messageStore

**File:** `stores/messageStore.ts`

#### Constants

| Constant                   | Value            | Purpose                   |
| -------------------------- | ---------------- | ------------------------- |
| `CACHE_EXPIRY_MS`          | `300000` (5 min) | Channel message cache TTL |
| `MAX_CACHED_CHANNELS`      | `12`             | LRU eviction threshold    |
| `MAX_MESSAGES_PER_CHANNEL` | `300`            | Per-channel message cap   |
| `MAX_REPLY_CACHE_ITEMS`    | `800`            | Reply data cache cap      |

#### State

| Property            | Type                                                                             |
| ------------------- | -------------------------------------------------------------------------------- |
| `messagesByChannel` | `Record<string, { messages: Message[]; hasMore: boolean; lastFetched: number }>` |
| `currentChannelId`  | `string \| null`                                                                 |
| `isLoading`         | `boolean`                                                                        |
| `replyingTo`        | `Message \| null`                                                                |

#### Actions

| Method                                                                                       | RPC                                                                                | Notes                                   |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------- |
| `fetchMessages(channelId, limit?, before?, force?)`                                          | `get_channel_bootstrap_secure` (primary), `get_channel_messages_secure` (fallback) | Stale-while-revalidate, in-flight dedup |
| `sendMessage(channelId, userId, content, replyToId?)`                                        | `send_message`                                                                     | Optimistic local add                    |
| `sendPoll(channelId, userId, question, options, allowMultiple, durationSeconds, replyToId?)` | `send_poll`                                                                        |                                         |
| `editMessage(messageId, content, userId)`                                                    | `edit_message`                                                                     |                                         |
| `deleteMessage(messageId, userId)`                                                           | `delete_message`                                                                   |                                         |
| `pinMessage(messageId, isPinned, userId)`                                                    | `pin_message`                                                                      |                                         |
| `setEmbedHidden(messageId, userId, hidden)`                                                  | `set_message_embed_hidden`                                                         |                                         |
| `addReaction(messageId, userId, emoji)`                                                      | `add_reaction`                                                                     | Optimistic + idempotent                 |
| `removeReaction(messageId, userId, emoji)`                                                   | `remove_reaction`                                                                  | Optimistic + idempotent                 |
| `addMessage(message)`                                                                        | —                                                                                  | Realtime handler                        |
| `updateMessage(messageId, updates)`                                                          | —                                                                                  | Realtime handler                        |
| `removeMessage(messageId)`                                                                   | —                                                                                  | Realtime handler                        |
| `removeMessagesByUser(userId)`                                                               | —                                                                                  | Ban purge                               |
| `setReplyingTo(message)`                                                                     | —                                                                                  | Local                                   |
| `clearMessages()`                                                                            | —                                                                                  | Local                                   |
| `clearChannelCache(channelId)`                                                               | —                                                                                  | Local                                   |

---

### dmStore

**File:** `stores/dmStore.ts`

#### State

| Property                 | Type                              |
| ------------------------ | --------------------------------- |
| `conversations`          | `DMConversation[]`                |
| `currentConversation`    | `DMConversation \| null`          |
| `messagesByConversation` | `Record<string, DirectMessage[]>` |

#### Conversation Actions

| Method                                                   | RPC                                      |
| -------------------------------------------------------- | ---------------------------------------- |
| `fetchConversations(userId)`                             | `get_user_dm_conversations`              |
| `openConversation(userId, otherUserId)`                  | `open_dm_conversation`, `get_user_by_id` |
| `createGroupConversation(userId, participantIds, name?)` | `create_group_dm`                        |
| `closeConversation(conversationId, userId)`              | `close_dm_conversation`                  |

#### Message Actions

| Method                                                       | RPC                                                |
| ------------------------------------------------------------ | -------------------------------------------------- |
| `fetchMessages(conversationId, userId, limit?, before?)`     | `get_dm_messages`, `get_dm_messages_by_ids_secure` |
| `sendMessage(conversationId, senderId, content, replyToId?)` | `send_dm`                                          |
| `editMessage(messageId, senderId, content)`                  | `edit_dm`                                          |
| `deleteMessage(messageId, senderId)`                         | `delete_dm`                                        |

#### Group DM Actions

| Method                                                    | RPC                    |
| --------------------------------------------------------- | ---------------------- |
| `updateGroupName(conversationId, userId, newName)`        | `update_group_dm_name` |
| `addGroupMembers(conversationId, userId, memberIds)`      | `add_group_dm_members` |
| `leaveGroup(conversationId, userId)`                      | `leave_group_dm`       |
| `kickGroupMember(conversationId, kickerId, targetUserId)` | `kick_group_dm_member` |

#### Reaction Actions

| Method                                     | RPC                  |
| ------------------------------------------ | -------------------- |
| `addReaction(messageId, userId, emoji)`    | `add_dm_reaction`    |
| `removeReaction(messageId, userId, emoji)` | `remove_dm_reaction` |

---

### friendStore

**File:** `stores/friendStore.ts`

#### State

| Property                   | Type               |
| -------------------------- | ------------------ |
| `friends`                  | `FriendWithUser[]` |
| `pendingRequests`          | `FriendWithUser[]` |
| `outgoingRequests`         | `FriendWithUser[]` |
| `blockedUsers`             | `FriendWithUser[]` |
| `visibilityBlockedUserIds` | `string[]`         |

#### Actions

| Method                                 | RPC                                                                | Notes                |
| -------------------------------------- | ------------------------------------------------------------------ | -------------------- |
| `fetchFriends(userId, opts?)`          | `get_friend_dashboard` (single RPC, preferred), fallback to 5 RPCs | 45s TTL cache        |
| `sendRequest(userId, username)`        | `send_friend_request`                                              | Rate limited: 10/60s |
| `acceptRequest(friendshipId, userId)`  | `accept_friend_request`                                            |                      |
| `declineRequest(friendshipId, userId)` | `decline_friend_request`                                           |                      |
| `removeFriend(friendshipId, userId)`   | `remove_friend`                                                    |                      |
| `blockUser(userId, targetUserId)`      | `block_user`                                                       |                      |
| `unblockUser(userId, blockedUserId)`   | `unblock_user`                                                     |                      |

---

### notificationStore

**File:** `stores/notificationStore.ts`

#### Actions

| Method                                                                             | Supabase Operation                | Notes            |
| ---------------------------------------------------------------------------------- | --------------------------------- | ---------------- |
| `fetchNotifications(userId)`                                                       | `notifications` SELECT (limit 50) |                  |
| `markAsRead(notificationId)`                                                       | `notifications` UPDATE            |                  |
| `markAllAsRead(userId)`                                                            | `notifications` UPDATE            |                  |
| `clearAllNotifications(userId)`                                                    | `notifications` DELETE            |                  |
| `deleteNotification(notificationId)`                                               | `notifications` DELETE            |                  |
| `createMentionNotification(userId, mentionedBy, channelId, channelName, serverId)` | `notifications` INSERT            |                  |
| `addNotification(notification)`                                                    | —                                 | Realtime handler |
| `removeNotification(notificationId)`                                               | —                                 | Realtime handler |

---

### pollStore

**File:** `stores/pollStore.ts`

#### Actions

| Method                                    | RPC                                  | Notes                                       |
| ----------------------------------------- | ------------------------------------ | ------------------------------------------- |
| `fetchPoll(pollId, userId?)`              | `polls` SELECT + `poll_votes` SELECT | Micro-batched (25ms flush), in-flight dedup |
| `votePoll(pollId, userId, optionIndexes)` | `vote_poll`                          |                                             |
| `closePoll(pollId)`                       | `close_poll`                         |                                             |
| `closeExpiredPolls(channelId)`            | `close_expired_polls`                | 60s cooldown per channel                    |

---

### voiceStore

**File:** `stores/voiceStore.ts` — Local state only, no Supabase calls

#### State

| Property            | Type                                                                 |
| ------------------- | -------------------------------------------------------------------- |
| `presenceByChannel` | `Record<string, string[]>` (channelId → sorted userIds)              |
| `joinedChannelId`   | `string \| null`                                                     |
| `joinedChannel`     | `Channel \| null`                                                    |
| `connection`        | `{ channelId, status: "idle"\|"joining"\|"joined"\|"error", error }` |
| `controls`          | `{ muted: boolean, deafened: boolean }`                              |

#### Actions

`setPresence`, `clearPresence`, `setJoinedChannelId`, `setJoinedChannel`, `setConnection`, `setControls`

---

### voiceSettingsStore

**File:** `stores/voiceSettingsStore.ts`

#### Actions

| Method                          | RPC                          | Notes                        |
| ------------------------------- | ---------------------------- | ---------------------------- |
| `loadSettings(userId)`          | `get_user_voice_settings`    |                              |
| `updateSetting(key, value)`     | `upsert_user_voice_settings` | Debounced 500ms              |
| `updateSettings(partial)`       | `upsert_user_voice_settings` | Debounced 500ms              |
| `setUserVolume(userId, volume)` | `upsert_user_voice_settings` | Per-user override, debounced |
| `getUserVolume(userId)`         | —                            | Local getter (default 100)   |
| `resetToDefaults()`             | `upsert_user_voice_settings` | Immediate save               |

---

### channelSettingsStore

**File:** `stores/channelSettingsStore.ts`

#### Types

```typescript
type NotificationLevel = "all" | "mentions" | "nothing";
```

#### Actions

| Method                                   | Supabase Table                 |
| ---------------------------------------- | ------------------------------ |
| `fetchSettings(serverChannelIds)`        | `channel_user_settings` SELECT |
| `toggleMute(channelId)`                  | `channel_user_settings` UPSERT |
| `muteFor(channelId, durationMinutes)`    | `channel_user_settings` UPSERT |
| `toggleHide(channelId)`                  | `channel_user_settings` UPSERT |
| `togglePin(channelId)`                   | `channel_user_settings` UPSERT |
| `setNotificationLevel(channelId, level)` | `channel_user_settings` UPSERT |
| `isMuted(channelId)`                     | — (computed)                   |
| `isHidden(channelId)`                    | — (computed)                   |
| `isPinned(channelId)`                    | — (computed)                   |

---

### uiStore

**File:** `stores/uiStore.ts` — **Persists to:** `"kloak-ui"`

#### Themes

```typescript
const THEMES = [
  { id: "default", name: "Default", description: "..." },
  { id: "nostalgia", name: "Nostalgia", description: "..." },
  { id: "lofi", name: "Lo-Fi", description: "..." },
  { id: "cappuccino", name: "Cappuccino", description: "..." },
  { id: "hokori", name: "Hokori", description: "..." },
] as const;

type Theme = "default" | "nostalgia" | "lofi" | "cappuccino" | "hokori";
type DmPrivacy = "everyone" | "shared_servers" | "friends" | "no_one";
```

#### Modal Types

```typescript
type ModalType =
  | "create-server"
  | "join-server"
  | "server-settings"
  | "create-channel"
  | "edit-channel"
  | "user-settings"
  | "userProfile"
  | "invite"
  | "delete-message"
  | "leave-server"
  | "kick-member"
  | "ban-member"
  | "quickSwitcher"
  | "shortcuts"
  | "pinned-messages"
  | "search"
  | "changeNickname"
  | "confirmAction"
  | "external-link-warning"
  | "permission-debug"
  | "import-discord-template"
  | "import-emoji-pack"
  | null;
```

#### Key State (all persisted)

| Property                      | Type        | Default     |
| ----------------------------- | ----------- | ----------- |
| `theme`                       | `Theme`     | `"default"` |
| `compactMode`                 | `boolean`   | `false`     |
| `showTimestamps`              | `boolean`   | `true`      |
| `animateEmojis`               | `boolean`   | `true`      |
| `dmPrivacy`                   | `DmPrivacy` | `"friends"` |
| `linkPreviewsEnabled`         | `boolean`   | `true`      |
| `desktopNotificationsEnabled` | `boolean`   | `true`      |
| `notificationSoundEnabled`    | `boolean`   | `true`      |
| `notificationVolume`          | `number`    | `50`        |

#### Functions

| Function            | Description                                       |
| ------------------- | ------------------------------------------------- |
| `applyTheme(theme)` | Applies theme class to `document.documentElement` |
| `initializeTheme()` | Reads persisted theme and applies it              |

---

### embedStore

**File:** `stores/embedStore.ts` — **Persists to:** `"kloak-hidden-embeds"` (hiddenEmbedMessages only)

Manages persistent Twitch/Kick stream embeds. Local state only.

```typescript
type ActiveEmbed = {
  id: string;
  url: string;
  type:
    | "twitch-channel"
    | "twitch-video"
    | "twitch-clip"
    | "kick-channel"
    | "kick-video";
  channelOrVideoId: string;
  messageId: string;
  channelId: string;
};
```

---

### syncStore

**File:** `stores/syncStore.ts` — Local state only

Manages connection status, optimistic updates, and operation queue for offline resilience.

#### Key Actions

| Method                                  | Description                                       |
| --------------------------------------- | ------------------------------------------------- |
| `setConnectionStatus(status)`           | `"connected" \| "disconnected" \| "reconnecting"` |
| `addOptimisticItem(tempId, id?)`        | Track optimistic update                           |
| `confirmOptimisticItem(tempId, realId)` | Confirm server response (auto-remove 1s)          |
| `failOptimisticItem(tempId, error)`     | Mark as failed                                    |
| `enqueueOperation(operation)`           | Queue operation for retry                         |
| `retryOperation(id)`                    | Retry (max retries enforced)                      |

---

### offlineQueueStore

**File:** `stores/offlineQueueStore.ts` — **Persists to:** `"kloak-offline-queue"`

Queues messages when offline for later sending.

| Method                           | Description                  |
| -------------------------------- | ---------------------------- |
| `addToQueue(message)`            | Returns generated offline ID |
| `removeFromQueue(id)`            |                              |
| `clearQueue()`                   |                              |
| `getQueuedForChannel(channelId)` |                              |

---

## Library Functions

---

### lib/crypto

**File:** `lib/crypto.ts`

| Function               | Signature                                            | Description                                         |
| ---------------------- | ---------------------------------------------------- | --------------------------------------------------- |
| `generateSecretKey`    | `() => string`                                       | 64-char hex from `crypto.getRandomValues(32 bytes)` |
| `hashSecretKey`        | `(secretKey) => Promise<string>`                     | SHA-256 via Web Crypto or JS fallback               |
| `isValidSecretKey`     | `(key) => boolean`                                   | Matches `/^[0-9a-fA-F]{64}$/`                       |
| `isWebCryptoAvailable` | `() => boolean`                                      | Checks `crypto.subtle.digest` availability          |
| `fetchPoWChallenge`    | `() => Promise<{id, nonce, difficulty, expires_at}>` | Edge: `generate-challenge`                          |
| `solvePoWChallenge`    | `(nonce, difficulty) => Promise<string>`             | Brute-force SHA-256 with leading zeros              |

---

### lib/security

**File:** `lib/security.ts`

#### Validation Functions

| Function                 | Signature                          | Rules                                                |
| ------------------------ | ---------------------------------- | ---------------------------------------------------- |
| `sanitizeInput`          | `(input) => string`                | Strips null bytes, trims                             |
| `validateUsername`       | `(username) => {valid, error?}`    | 3-14 chars, `[a-zA-Z0-9_]`, no reserved names (~40+) |
| `validateServerName`     | `(name) => {valid, error?}`        | 1-100 chars                                          |
| `validateChannelName`    | `(name) => {valid, error?}`        | 1-100 chars, lowercase, `[a-z0-9-]`                  |
| `validateMessageContent` | `(content) => {valid, error?}`     | Non-empty, max 2000 chars                            |
| `validateInviteCode`     | `(code) => {valid, error?}`        | Exactly 8 chars, `[ABCDEFGHJKMNPQRSTUVWXYZ23456789]` |
| `validateFileUpload`     | `(file, opts?) => {valid, error?}` | Default max 10MB, blocks .exe/.bat/.js etc.          |

#### Rate Limiters

| Instance                     | Limit       | Window |
| ---------------------------- | ----------- | ------ |
| `authRateLimiter`            | 5 attempts  | 60s    |
| `messageRateLimiter`         | 10 messages | 10s    |
| `inviteCodeRateLimiter`      | 5 attempts  | 60s    |
| `friendRequestRateLimiter`   | 10 requests | 60s    |
| `accountCreationRateLimiter` | 3 attempts  | 300s   |

```typescript
class RateLimiter {
  constructor(limit: number, windowMs: number);
  isAllowed(key: string): boolean;
  getRemainingTime(key: string): number; // seconds until reset
  clear(key: string): void;
}
```

---

### lib/permissions

**File:** `lib/permissions.ts`

Discord-style permission evaluation with channel overrides, role hierarchy, and base role defaults.

| Function                | Signature                                                                                                                          | Description                                                                                                                          |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `evaluatePermission`    | `(permission, isOwner, customRoles?, rolePermissions?, channelPermissions?, channelId?, userId?, allRoles?, baseRole?) => boolean` | Full permission check. Priority: owner → user channel override → role channel override → server role → @everyone → base role default |
| `canModerateByRoles`    | `(actorIsOwner, actorRoles, targetIsOwner, targetRoles, actorBaseRole?, targetBaseRole?) => boolean`                               | Can actor moderate target? Compares role positions                                                                                   |
| `getMemberPermissions`  | `(...) => Map<Permission, boolean>`                                                                                                | Evaluates all 28 permissions                                                                                                         |
| `getAllowedPermissions` | `(...) => Permission[]`                                                                                                            | Returns only granted permissions                                                                                                     |

**Base Role Hierarchy:** `owner (0) > admin (1) > moderator (2) > member (3)`

---

### lib/permissionMeta

**File:** `lib/permissionMeta.ts`

All 28 permissions with labels, descriptions, and backend enforcement status:

| Permission                 | Label                | Enforced |
| -------------------------- | -------------------- | -------- |
| `view_channels`            | View Channels        | YES      |
| `read_message_history`     | Read Message History | YES      |
| `send_messages`            | Send Messages        | YES      |
| `add_reactions`            | Add Reactions        | YES      |
| `attach_files`             | Attach Files         | YES      |
| `embed_links`              | Embed Links          | YES      |
| `use_external_emojis`      | Use External Emojis  | YES      |
| `kick_members`             | Kick Members         | YES      |
| `ban_members`              | Ban Members          | YES      |
| `mute_members`             | Mute Members         | YES      |
| `manage_nicknames`         | Manage Nicknames     | YES      |
| `change_nickname`          | Change Own Nickname  | YES      |
| `manage_channels`          | Manage Channels      | YES      |
| `manage_messages`          | Manage Messages      | YES      |
| `pin_messages`             | Pin Messages         | YES      |
| `manage_server`            | Manage Server        | YES      |
| `manage_roles`             | Manage Roles         | YES      |
| `manage_emojis`            | Manage Emojis        | YES      |
| `manage_invites`           | Manage Invites       | YES      |
| `connect`                  | Connect (Voice)      | YES      |
| `speak`                    | Speak (Voice)        | YES      |
| `mention_everyone`         | Mention Everyone     | NO       |
| `mention_roles`            | Mention Roles        | NO       |
| `deafen_members`           | Deafen Members       | NO       |
| `move_members`             | Move Members         | NO       |
| `manage_threads`           | Manage Threads       | NO       |
| `manage_webhooks`          | Manage Webhooks      | NO       |
| `create_instant_invite`    | Create Invite        | NO       |
| `transfer_ownership`       | Transfer Ownership   | NO       |
| `use_voice_activation`     | Voice Activity       | NO       |
| `use_application_commands` | Application Commands | NO       |

**Permission Groups (UI):** General (4), Messages (5), Moderation (7), Channel Management (4), Server Administration (7), Voice (3), Advanced (1)

---

### lib/message

**File:** `lib/message.ts`

| Function                    | Signature                                      | Description                                                          |
| --------------------------- | ---------------------------------------------- | -------------------------------------------------------------------- |
| `parseMessageContent`       | `(content, opts?) => string`                   | Converts raw content to HTML (markdown, mentions, code blocks, URLs) |
| `stripMarkdown`             | `(content, usersMap?, channelsMap?) => string` | Strips all formatting to plain text                                  |
| `getMessagePreview`         | `(content, maxLength?, usersMap?) => string`   | Truncated plain text preview (default 100 chars)                     |
| `extractMentions`           | `(content) => Mention[]`                       | Parses `@everyone`, `@here`, `<@UUID>`                               |
| `isImageUrl`                | `(url) => boolean`                             | Detects image URLs (extensions + known hosts)                        |
| `isImageOnlyMessage`        | `(content) => boolean`                         | Message is a single image URL                                        |
| `getImageUrlFromContent`    | `(content) => string \| null`                  | Extracts image URL from image-only message                           |
| `convertMentionsToReadable` | `(content, usersMap, channelsMap?) => string`  | `<@UUID>` → `@displayName` (for edit mode)                           |
| `convertMentionsToRaw`      | `(content, usersMap, channelsMap?) => string`  | `@username` → `<@UUID>` (for saving)                                 |

**Markdown Support:** `**bold**`, `*italic*`, `~~strikethrough~~`, `__underline__`, `||spoiler||`, `` `inline code` ``, ` ```code blocks``` `, URLs auto-linked, `<@UUID>` mentions

**Mention Format:** `<@{UUID}>` for users, `<#{UUID}>` for channels, `@everyone`, `@here`

---

### lib/format

**File:** `lib/format.ts`

| Function                 | Signature                     | Description                                                   |
| ------------------------ | ----------------------------- | ------------------------------------------------------------- |
| `formatMessageTimestamp` | `(date) => string`            | "Today at 2:30 PM" / "Yesterday at..." / "01/15/2025 2:30 PM" |
| `formatRelativeTime`     | `(date) => string`            | "5 minutes ago"                                               |
| `formatCompactTime`      | `(date) => string`            | "5m" / "2h" / "3d" / "1w" / "2mo" / "1y"                      |
| `formatShortTime`        | `(date) => string`            | "2:30 PM"                                                     |
| `generateInviteCode`     | `() => string`                | 8-char code, charset `ABCDEFGHJKMNPQRSTUVWXYZ23456789`        |
| `slugifyChannelName`     | `(name) => string`            | Lowercase, remove non-alphanum, collapse hyphens              |
| `isEmojiOnly`            | `(text) => boolean`           | For large emoji rendering                                     |
| `truncate`               | `(text, maxLength) => string` | Truncate with `...`                                           |

---

### lib/storage

**File:** `lib/storage.ts` — All localStorage operations

| Function                                                                                               | Key                            | Description                                               |
| ------------------------------------------------------------------------------------------------------ | ------------------------------ | --------------------------------------------------------- |
| `saveSecretKey(key)` / `getSecretKey()` / `clearSecretKey()`                                           | `kloak-secret-key`             | Secret key persistence                                    |
| `saveTheme(theme)` / `getTheme()`                                                                      | `kloak-theme`                  | Theme (`'dark'`\|`'light'`\|`'system'`, default `'dark'`) |
| `saveDraft(channelId, content)` / `getDraft(channelId)` / `clearDraft(channelId)` / `clearAllDrafts()` | `kloak-drafts`                 | Per-channel message drafts                                |
| `hasSeenWelcome(userId)` / `markWelcomeSeen(userId)`                                                   | `kloak-welcome-shown-{userId}` | Welcome modal tracking                                    |
| `saveLastChannel(serverId, channelId)` / `getLastChannel(serverId)`                                    | `kloak-last-channels`          | Last visited channel per server                           |

---

### lib/storageUpload

**File:** `lib/storageUpload.ts`

All uploads go through the Supabase Edge Function proxy (not direct storage API).

| Function              | Signature                                                   | Description                                                                                     |
| --------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `secureUpload`        | `(bucket, path, file, opts?) => Promise<{publicUrl, path}>` | Upload via Edge Function. SVGs are sanitized (strips scripts, event handlers, javascript: URIs) |
| `secureDelete`        | `(bucket, pathOrPaths) => Promise<void>`                    | Delete file(s)                                                                                  |
| `secureListAndDelete` | `(bucket, prefix, searchFilter?) => Promise<void>`          | List and delete by prefix (cleanup-before-upload pattern)                                       |

**Endpoint:** `{SUPABASE_URL}/functions/v1/storage-upload`
**Auth Headers:** `x-key-hash` + `Authorization: Bearer {ANON_KEY}`

---

### lib/presence

**File:** `lib/presence.ts`

| Export                          | Type                                              | Description                                                                              |
| ------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `PRESENCE_OFFLINE_THRESHOLD_MS` | `300000` (5 min)                                  | Time without heartbeat = offline                                                         |
| `getEffectivePresence`          | `(status, lastSeen, nowMs?) => EffectivePresence` | Computes reliable presence from status + last_seen. Corrects for lossy Supabase Realtime |

```typescript
type EffectivePresence = {
  status: UserStatus; // Corrected status
  isStale: boolean; // Was the status corrected?
  isOffline: boolean; // Is user offline?
};
```

**Logic:**

- Status `offline` + last_seen within 5min → actually `online` (missed status update)
- Status `online` + last_seen older than 5min → actually `offline` (stale presence)

---

### lib/userCache

**File:** `lib/userCache.ts`

| Function               | Signature                           | Description                                                               |
| ---------------------- | ----------------------------------- | ------------------------------------------------------------------------- |
| `getUserFromCache`     | `(userId) => User \| null`          | 5-minute TTL                                                              |
| `setUserInCache`       | `(userId, user) => void`            |                                                                           |
| `bulkSetUsersInCache`  | `(users) => void`                   | Batch insert                                                              |
| `invalidateUser`       | `(userId) => void`                  |                                                                           |
| `getOrFetchUser`       | `(userId) => Promise<User \| null>` | Cache-first, then RPC: `get_user_by_id`. Deduplicates concurrent requests |
| `deduplicatedFetch<T>` | `(key, fetcher) => Promise<T>`      | Generic request deduplication utility                                     |

---

### lib/serverEmojis

**File:** `lib/serverEmojis.ts`

| Function                 | Signature                                     | Description                                                                       |
| ------------------------ | --------------------------------------------- | --------------------------------------------------------------------------------- |
| `fetchServerEmojis`      | `(serverId, opts?) => Promise<ServerEmoji[]>` | Table: `server_emojis`, bucket: `server-emojis`. 60s cache, concurrent coalescing |
| `invalidateServerEmojis` | `(serverId) => void`                          | Clear cache for server                                                            |

```typescript
type ServerEmoji = { id: string; name: string; file_path: string; url: string };
```

---

### lib/globalEmojiResolver

**File:** `lib/globalEmojiResolver.ts`

| Function                              | Signature                                         | Description                                                       |
| ------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------- |
| `getGlobalEmojiMap`                   | `(opts?) => Promise<Map<string, ResolvedEmoji>>`  | All emojis from user's servers. 2-min cache. First name wins      |
| `getGlobalEmojiDuplicates`            | `() => Set<string>`                               | Names that exist in multiple servers                              |
| `resolveQualifiedEmoji`               | `(qualifiedName) => ResolvedEmoji \| undefined`   | Lookup `"name~ServerName"`                                        |
| `resolveEmojisByNameFallback`         | `(names) => Promise<Map<string, string \| null>>` | Cross-server lookup. **Micro-batched** (25ms flush). 10-min cache |
| `resolveEmojiByNameFallback`          | `(name) => Promise<string \| null>`               | Single-name version                                               |
| `resolveQualifiedEmojiByNameFallback` | `(name, serverName) => Promise<string \| null>`   | `name~ServerName` qualified lookup                                |
| `invalidateGlobalEmojiCache`          | `() => void`                                      |                                                                   |

```typescript
type ResolvedEmoji = {
  name: string;
  url: string;
  serverId: string;
  serverName: string;
  serverIcon: string | null;
  isPublished: boolean;
};
```

---

### lib/ghostIdentity

**File:** `lib/ghostIdentity.ts`

| Function                        | Signature                                                    | Description                                             |
| ------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------- |
| `canRevealGhostIdentityForUser` | `({isGhostMode, authorUserId, members, ownerId}) => boolean` | In ghost mode, only owner/admin identities are revealed |
| `getGhostPseudonymousUserId`    | `(authorUserId, channelId) => string`                        | Deterministic `"ghost_{8hex}"` via FNV-1a hash          |

---

### lib/errorHandler

**File:** `lib/errorHandler.ts`

| Function        | Signature                              | Description                                                                         |
| --------------- | -------------------------------------- | ----------------------------------------------------------------------------------- |
| `classifyError` | `(error) => ErrorInfo`                 | Classifies into: network, auth, permission, validation, rate_limit, server, unknown |
| `handleError`   | `(error, customMessage?) => ErrorInfo` | Classifies + shows toast notification                                               |
| `showSuccess`   | `(title, description?) => void`        | Success toast (3s)                                                                  |
| `showInfo`      | `(title, description?) => void`        | Info toast (4s)                                                                     |
| `showWarning`   | `(title, description?) => void`        | Warning toast (4s)                                                                  |

---

### lib/poll

**File:** `lib/poll.ts`

| Export                 | Value                         | Description                          |
| ---------------------- | ----------------------------- | ------------------------------------ |
| `POLL_CONTENT_PREFIX`  | `"__kloak_poll__:"`           | Magic prefix in message content      |
| `isPollMessageContent` | `(content) => boolean`        | Starts with prefix?                  |
| `getPollIdFromContent` | `(content) => string \| null` | Extract poll ID from message content |

---

### lib/voiceSounds

**File:** `lib/voiceSounds.ts` — Web Audio API

| Function                   | Description                                   |
| -------------------------- | --------------------------------------------- |
| `playJoinSound()`          | Rising tones (440Hz → 587Hz). 500ms cooldown  |
| `playLeaveSound()`         | Falling tones (587Hz → 440Hz). 500ms cooldown |
| `playPTTActivateSound()`   | Short 660Hz blip                              |
| `playPTTDeactivateSound()` | Short 440Hz blip                              |

---

### lib/avatarDecorations

**File:** `lib/avatarDecorations.ts`

| Export                                   | Description                                            |
| ---------------------------------------- | ------------------------------------------------------ |
| `AVATAR_DECORATIONS: AvatarDecoration[]` | Array from `/src/assets/avatar-decos/*.{png,gif,webp}` |
| `getAvatarDecorationSrc(decorationId)`   | Returns asset URL or null                              |

---

### lib/profileEffects

**File:** `lib/profileEffects.ts`

| Export                             | Description                                               |
| ---------------------------------- | --------------------------------------------------------- |
| `PROFILE_EFFECTS: ProfileEffect[]` | Array from `/src/assets/profile-effects/*.{png,gif,webp}` |
| `getProfileEffectSrc(effectId)`    | Returns asset URL or null                                 |

---

### lib/tauriRuntime

**File:** `lib/tauriRuntime.ts`

| Function                | Description                                   |
| ----------------------- | --------------------------------------------- |
| `isTauri()`             | Detects Tauri v2 runtime                      |
| `isTauriWindow()`       | Sync check via URL param                      |
| `resizeWindowForApp()`  | Invokes Tauri `resize_window_for_app` command |
| `getTauriWindowLabel()` | Returns current window label                  |

---

### lib/maintenance

**File:** `lib/maintenance.ts`

| Constant                | Value     | Description                      |
| ----------------------- | --------- | -------------------------------- |
| `MAINTENANCE_MODE`      | `boolean` | From env `VITE_MAINTENANCE_MODE` |
| `REGISTRATION_DISABLED` | `false`   | Hardcoded flag                   |

---

## Hooks (Realtime & UI)

---

### Realtime Subscriptions

| Hook                                           | Channel                                                  | Events                                            | Purpose                                  |
| ---------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------- |
| `useRealtimeMessages(channelId)`               | `chat:${channelId}` (broadcast)                          | `messages`, `reactions`                           | Message/reaction CRUD                    |
| `useRealtimePolls(channelId)`                  | `chat:${channelId}` (broadcast)                          | `polls`                                           | Poll mutations (shared channel)          |
| `useRealtimePinnedMessages(channelId)`         | `chat:${channelId}` (broadcast)                          | `messages`                                        | Pinned message tracking (shared channel) |
| `useRealtimeServer(serverId)`                  | `server:${serverId}` (postgres_changes)                  | servers, channels, categories, permissions        | Server-level changes                     |
| `useRealtimeMembers(serverId)`                 | `members:${serverId}` (postgres_changes)                 | server_members, server_roles, server_member_roles | Member/role changes                      |
| `useRealtimeServerEmojis(serverId)`            | `server-emojis:${serverId}` (postgres_changes)           | server_emojis `*`                                 | Emoji changes                            |
| `useRealtimeNotifications(userId)`             | `notifications:${userId}` (postgres_changes)             | INSERT, DELETE                                    | Notification delivery                    |
| `useRealtimeFriendships(userId)`               | `friendships:${userId}` (postgres_changes)               | `*` on both requester/addressee                   | Friendship changes                       |
| `useRealtimeDMs(opts)`                         | `user:${userId}` (broadcast) + fallback postgres_changes | direct_messages, dm_reactions, dm_participants    | DM realtime                              |
| `useRealtimeOwnMembership()`                   | `own-membership:${userId}` (postgres_changes)            | DELETE, UPDATE on server_members                  | Kick/ban detection                       |
| `useRealtimeUsers()`                           | `presence:users-global` (presence)                       | Presence sync/join/leave                          | Global user presence                     |
| `useRealtimeUserUpdates(userIds, channelName)` | — (polling, not realtime)                                | —                                                 | User profile polling (60s)               |

---

### Voice & Audio

| Hook                                                                 | Signature                                         | Description                                                                                        |
| -------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `useAgoraRoom(opts)`                                                 | `({channelId, userId, displayName?})`             | LiveKit voice room management (join, leave, mute, deafen, screen share). Edge: `get-livekit-token` |
| `useVoicePresenceWatchers(opts)`                                     | `({channelIds, userId})`                          | Read-only presence watchers for voice channel sidebar                                              |
| `useAudioLevel(opts?)`                                               | `({deviceId?, smoothingTimeConstant?, fftSize?})` | Real-time mic level monitoring (Web Audio API)                                                     |
| `useAudioDevices()`                                                  | `()`                                              | Enumerate audio I/O devices                                                                        |
| `usePushToTalk(opts)`                                                | `({room, isConnected, onMuteChange?})`            | Global PTT keyboard listener (hold/toggle modes)                                                   |
| `useAutoDisconnect(opts)`                                            | `({isJoined, isSpeaking, onDisconnect})`          | Auto-disconnect from voice after idle time                                                         |
| `useHideVoiceActivity(opts)`                                         | `({room, isConnected})`                           | No-op shell (logic moved to useAgoraRoom)                                                          |
| `shouldShowSpeakingIndicator(participant, isSpeaking, localUserId?)` | Pure function                                     | Check if speaking indicator should show                                                            |

**Helper functions:**

- `pauseVoicePresenceWatch(channelId)` — Pause watcher when joining voice
- `resumeVoicePresenceWatch(channelId)` — Resume watcher after leaving voice

---

### Unread Tracking

| Hook                         | Signature                                                                                                                             | RPCs                                                                       | Description                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------- |
| `useUnread(channelIds?)`     | Returns `{unreadState, markAsRead, getChannelUnread, hasAnyUnread, getTotalMentions, getServerUnreadInfo, markServerAsRead, refetch}` | `get_all_channel_unread_counts`, `mark_channel_read`, `mark_channels_read` | Batched channel unread tracking. Polls 90s      |
| `useUnreadDMs(userId)`       | Returns `{unreadState, markAsRead, incrementUnread, getUnreadCount, totalUnread, hasUnread, refetch}`                                 | `get_dm_unread_counts`, `mark_dm_read`                                     | DM unread tracking. Polls 120s                  |
| `useUnreadChannelsContext()` | —                                                                                                                                     | —                                                                          | React context consumer for channel unread state |
| `useUnreadDMsContext()`      | —                                                                                                                                     | —                                                                          | React context consumer for DM unread state      |

---

### Presence & Status

| Hook                    | Signature | Description                                                                                                          |
| ----------------------- | --------- | -------------------------------------------------------------------------------------------------------------------- |
| `usePresence()`         | `()`      | Manages own online/idle/offline. Auto-idle 5min. Heartbeat 90s                                                       |
| `useConnectionStatus()` | `()`      | Returns `{status, isConnected, isReconnecting, latency, quality}`. Quality: <100ms=excellent, <300ms=good, else=poor |
| `useOnlineStatus()`     | `()`      | Returns `{isOnline, wasOffline}` from browser events                                                                 |
| `useBackgroundSync()`   | `()`      | Offline queue processing, reconnection, periodic sync. Health: `ping_health` RPC                                     |

**Utility:**

- `patchUserAcrossStores(updatedUser)` — Patches user across serverStore, friendStore, dmStore
- `hasRecentRealtimePresence(userId, nowMs?)` — Check if user had presence within 180s

---

### UI & Utility Hooks

| Hook                                       | Signature                                                                                     | Description                                                                           |
| ------------------------------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `useMemberPermissions(channelId?)`         | Returns `{currentMember, isOwner, baseRole, hasPermission, canModerate, canPerformInChannel}` | Permission checking                                                                   |
| `useAuthorStyles(serverId, targetUserIds)` | Returns `Record<string, AuthorStyle>`                                                         | Fetches role colors/nicknames. RPC: `get_message_author_styles_secure`                |
| `useUserBadges(userId)`                    | Returns `{badges, isLoading}`                                                                 | RPC: `get_user_badges_secure`                                                         |
| `useSignedUrl(fileUrl)`                    | Returns `string \| null`                                                                      | Converts public URLs to signed URLs for `attachments` bucket. 1hr expiry              |
| `useTyping(channelId)`                     | Returns `{typingUsers, startTyping, stopTyping}`                                              | Typing indicators. Edge: `broadcast-typing`. Broadcast: `typing:${channelId}`         |
| `useScrollToMessage(opts)`                 | Returns `{highlightedMessageId}`                                                              | Scroll-to and highlight message by ID                                                 |
| `useNotificationSound()`                   | Returns `{playSound, playTestSound}`                                                          | Type-aware notification sounds                                                        |
| `useSwipeGesture(opts)`                    | Returns `{bindSwipeHandlers}`                                                                 | Mobile touch gesture detection (70px threshold)                                       |
| `useSwipeGestureRef(opts)`                 | Returns `RefObject<HTMLDivElement>`                                                           | Ref-based variant                                                                     |
| `useIsMobile()`                            | Returns `boolean`                                                                             | Viewport < 768px                                                                      |
| `usePreferencesSync()`                     | `()`                                                                                          | Syncs UI preferences with DB. RPCs: `get_user_preferences`, `upsert_user_preferences` |
| `useAppUpdater()`                          | Returns `{updateInfo, checkUpdate, installUpdate}`                                            | Tauri-only app updater                                                                |
| `useTauriNotificationActions()`            | `()`                                                                                          | Tauri-only notification click handler                                                 |

**Standalone:**

- `playNotificationSound(type?)` — Non-hook notification sound player
- `requestNotificationPermission()` — Request browser/Tauri notification permission

---

## Types & Constants

### Voice Settings

**File:** `types/voiceSettings.ts`

```typescript
type VoiceMode = "voice_activity" | "push_to_talk";
type PTTMode = "hold" | "toggle";

interface VoiceSettings {
  inputDeviceId: string | null;
  outputDeviceId: string | null;
  inputGain: number; // 0-200, default 100
  outputVolume: number; // 0-100, default 100
  voiceMode: VoiceMode;
  voiceActivityThreshold: number; // 0-100, default 50
  pttKeybind: string; // default 'Space'
  pttMode: PTTMode;
  noiseSuppression: boolean; // default true
  echoCancellation: boolean; // default true
  autoGainControl: boolean; // default true
  joinLeaveSound: boolean; // default true
  pttActivationSound: boolean; // default true
  visualOnlyMode: boolean; // default false
  muteOnJoin: boolean; // default true (privacy-first)
  autoDisconnectMinutes: number; // 0 = disabled
  hideVoiceActivity: boolean;
  visualVoiceIndicators: boolean;
  monoAudio: boolean;
  userVolumeOverrides: Record<string, number>; // userId → volume 0-100
}

interface AudioDevice {
  deviceId: string;
  label: string;
  kind: "audioinput" | "audiooutput";
  isDefault: boolean;
}
```

### Voice Settings Validation

**File:** `utils/voiceSettingsValidation.ts`

| Function                 | Signature                              | Description                                        |
| ------------------------ | -------------------------------------- | -------------------------------------------------- |
| `validateVoiceSettings`  | `(settings: unknown) => VoiceSettings` | Sanitize DB data, fill defaults for invalid values |
| `hasSettingsChanged`     | `(settings) => boolean`                | Compare to defaults                                |
| `formatKeybind`          | `(keybind) => string`                  | `"Ctrl+Space"` → `"Ctrl + Space"`                  |
| `keyboardEventToKeybind` | `(e: KeyboardEvent) => string \| null` | Keyboard event → keybind string                    |

---

## Supabase RPC Reference

Complete list of Supabase RPCs (server-side functions) called by the frontend:

### Authentication & User

| RPC                          | Parameters                  | Used By                                  |
| ---------------------------- | --------------------------- | ---------------------------------------- |
| `login_user`                 | `{_key_hash}`               | authStore.login, authStore.checkAuth     |
| `update_user_status`         | `{_user_id, _status}`       | authStore.updateStatus, authStore.logout |
| `update_user_last_seen`      | `{_user_id}`                | authStore.updateLastSeen                 |
| `reset_user_secret_key`      | `{_user_id, _new_key_hash}` | authStore.resetSecretKey                 |
| `get_user_by_id`             | `{_user_id}`                | userCache, dmStore, AppLayout            |
| `get_user_profile_secure`    | `{_user_id}`                | useRealtimeSingleUser                    |
| `get_users_basic_secure`     | `{_user_ids}`               | useRealtimeUserUpdates                   |
| `get_users_presence_secure`  | `{_user_ids}`               | useRealtimeUsers (backstop poll)         |
| `get_user_badges_secure`     | `{_user_id}`                | useUserBadges                            |
| `get_user_preferences`       | `{_user_id}`                | usePreferencesSync                       |
| `upsert_user_preferences`    | `{_user_id, _preferences}`  | usePreferencesSync                       |
| `get_user_voice_settings`    | `{_user_id}`                | voiceSettingsStore                       |
| `upsert_user_voice_settings` | `{_user_id, _settings}`     | voiceSettingsStore                       |

### Server

| RPC                        | Parameters                                | Used By                           |
| -------------------------- | ----------------------------------------- | --------------------------------- |
| `get_user_servers`         | `{_user_id}`                              | serverStore.fetchServers          |
| `create_server_with_owner` | `{_name, _owner_id}`                      | serverStore.createServer          |
| `update_server`            | `{_server_id, _user_id, ...}`             | serverStore.updateServer          |
| `delete_server`            | `{_server_id}`                            | serverStore.deleteServer          |
| `join_server_by_invite`    | `{_invite_code, _user_id, _join_source?}` | serverStore.joinServer            |
| `leave_server`             | `{_server_id, _user_id}`                  | serverStore.leaveServer           |
| `toggle_server_mute`       | `{_server_id, _user_id}`                  | serverStore.toggleServerMute      |
| `is_server_banned_secure`  | `{_server_id, _user_id}`                  | serverStore.joinServer, AppLayout |

### Channel

| RPC                        | Parameters                                       | Used By                           |
| -------------------------- | ------------------------------------------------ | --------------------------------- |
| `get_server_channels`      | `{_server_id}`                                   | serverStore.fetchChannels         |
| `get_server_categories`    | `{_server_id}`                                   | serverStore.fetchChannels         |
| `create_channel`           | `{_server_id, _name, _type, _user_id, ...}`      | serverStore.createChannel         |
| `update_channel`           | `{_channel_id, _updates, _user_id}`              | serverStore.updateChannel         |
| `delete_channel`           | `{_channel_id, _user_id}`                        | serverStore.deleteChannel         |
| `create_category`          | `{_server_id, _name, _user_id}`                  | serverStore.createCategory        |
| `update_category`          | `{_category_id, _updates, _user_id}`             | serverStore.updateCategory        |
| `delete_category`          | `{_category_id, _user_id}`                       | serverStore.deleteCategory        |
| `reorder_categories`       | `{_category_ids}`                                | serverStore.reorderCategories     |
| `reorder_channels`         | `{_channel_id, _new_category_id, _new_position}` | serverStore.reorderChannels       |
| `move_channel_to_category` | `{_channel_id, _category_id}`                    | serverStore.moveChannelToCategory |
| `get_channel_members`      | `{_channel_id}`                                  | serverStore.fetchChannelMembers   |
| `add_channel_member`       | `{_channel_id, _target_user_id, _added_by}`      | serverStore.addChannelMember      |
| `remove_channel_member`    | `{_channel_id, _target_user_id, _removed_by}`    | serverStore.removeChannelMember   |

### Members

| RPC                                | Parameters                    | Used By                         |
| ---------------------------------- | ----------------------------- | ------------------------------- |
| `get_server_members`               | `{_server_id}`                | serverStore.fetchMembers (lite) |
| `get_server_members_full_secure`   | `{_server_id}`                | serverStore.fetchMembers (full) |
| `get_message_author_styles_secure` | `{_server_id, _user_ids}`     | useAuthorStyles                 |
| `update_member_nickname`           | `{_member_id, ...}`           | serverStore.updateMember        |
| `toggle_mute_member`               | `{_member_id, ...}`           | serverStore.updateMember        |
| `change_member_role`               | `{_member_id, ...}`           | serverStore.updateMember        |
| `kick_member`                      | `{_server_id, _user_id}`      | serverStore.kickMember          |
| `ban_member`                       | `{_server_id, _user_id}`      | serverStore.banMember           |
| `transfer_ownership`               | `{_server_id, _new_owner_id}` | serverStore.transferOwnership   |

### Roles

| RPC                       | Parameters                                      | Used By                          |
| ------------------------- | ----------------------------------------------- | -------------------------------- |
| `get_server_roles_secure` | `{_server_id}`                                  | serverStore.fetchRoles           |
| `create_server_role`      | `{_server_id, _user_id, _name, _color, _icon?}` | serverStore.createRole           |
| `update_server_role`      | `{_role_id, _user_id, ...}`                     | serverStore.updateRole           |
| `delete_server_role`      | `{_role_id, _user_id}`                          | serverStore.deleteRole           |
| `reorder_server_roles`    | `{_server_id, _user_id, _ordered_role_ids}`     | serverStore.reorderRoles         |
| `assign_role_to_member`   | `{_member_id, _role_id, _user_id}`              | serverStore.assignRoleToMember   |
| `remove_role_from_member` | `{_member_id, _role_id, _user_id}`              | serverStore.removeRoleFromMember |

### Permissions

| RPC                                     | Parameters                                             | Used By                                       |
| --------------------------------------- | ------------------------------------------------------ | --------------------------------------------- |
| `get_role_permissions`                  | `{_server_id}`                                         | serverStore.fetchRolePermissions              |
| `get_channel_permissions`               | `{_channel_id}`                                        | serverStore.fetchChannelPermissions           |
| `get_category_permissions`              | `{_category_id}`                                       | serverStore.fetchCategoryPermissions          |
| `set_role_permission`                   | `{_server_id, _user_id, _permission, ...}`             | serverStore.setRolePermission                 |
| `set_channel_permission`                | `{_channel_id, _user_id, _permission, _allowed, ...}`  | serverStore.setChannelPermission              |
| `set_category_permission`               | `{_category_id, _user_id, _permission, _allowed, ...}` | serverStore.setCategoryPermission             |
| `delete_role_permission`                | `{_permission_id, _user_id}`                           | serverStore.deleteRolePermission              |
| `delete_channel_permission`             | `{_permission_id, _user_id}`                           | serverStore.deleteChannelPermission           |
| `delete_category_permission`            | `{_permission_id, _user_id}`                           | serverStore.deleteCategoryPermission          |
| `sync_category_permissions_to_channels` | `{_category_id, _user_id}`                             | serverStore.syncCategoryPermissionsToChannels |

### Messages

| RPC                            | Parameters                                         | Used By                                                                           |
| ------------------------------ | -------------------------------------------------- | --------------------------------------------------------------------------------- |
| `get_channel_bootstrap_secure` | `{_channel_id, _limit?, _before?}`                 | messageStore.fetchMessages (primary — returns messages + channel perms in 1 call) |
| `get_channel_messages_secure`  | `{_channel_id, _limit?, _before?}`                 | messageStore.fetchMessages (fallback)                                             |
| `get_message_replies_secure`   | `{_message_ids}`                                   | messageStore.fetchMessages (reply hydration)                                      |
| `get_pinned_messages_secure`   | `{_channel_id}`                                    | useRealtimePinnedMessages                                                         |
| `send_message`                 | `{_channel_id, _user_id, _content, _reply_to_id?}` | messageStore.sendMessage                                                          |
| `edit_message`                 | `{_message_id, _content, _user_id}`                | messageStore.editMessage                                                          |
| `delete_message`               | `{_message_id, _user_id}`                          | messageStore.deleteMessage                                                        |
| `pin_message`                  | `{_message_id, _is_pinned, _user_id}`              | messageStore.pinMessage                                                           |
| `set_message_embed_hidden`     | `{_message_id, _user_id, _hidden}`                 | messageStore.setEmbedHidden                                                       |
| `add_reaction`                 | `{_message_id, _user_id, _emoji}`                  | messageStore.addReaction                                                          |
| `remove_reaction`              | `{_message_id, _user_id, _emoji}`                  | messageStore.removeReaction                                                       |

### Direct Messages

| RPC                             | Parameters                                                | Used By                               |
| ------------------------------- | --------------------------------------------------------- | ------------------------------------- |
| `get_user_dm_conversations`     | `{_user_id}`                                              | dmStore.fetchConversations            |
| `open_dm_conversation`          | `{_user_id, _other_user_id}`                              | dmStore.openConversation              |
| `close_dm_conversation`         | `{_conversation_id, _user_id}`                            | dmStore.closeConversation             |
| `create_group_dm`               | `{_user_id, _participant_ids, _name?}`                    | dmStore.createGroupConversation       |
| `update_group_dm_name`          | `{_conversation_id, _user_id, _new_name}`                 | dmStore.updateGroupName               |
| `add_group_dm_members`          | `{_conversation_id, _user_id, _member_ids}`               | dmStore.addGroupMembers               |
| `leave_group_dm`                | `{_conversation_id, _user_id}`                            | dmStore.leaveGroup                    |
| `kick_group_dm_member`          | `{_conversation_id, _kicker_id, _target_user_id}`         | dmStore.kickGroupMember               |
| `get_dm_messages`               | `{_conversation_id, _user_id, _limit?, _before?}`         | dmStore.fetchMessages                 |
| `get_dm_messages_by_ids_secure` | `{_message_ids}`                                          | dmStore.fetchMessages, useRealtimeDMs |
| `get_dm_other_participant`      | `{_conversation_id, _user_id}`                            | AppLayout (DM redirect)               |
| `send_dm`                       | `{_conversation_id, _sender_id, _content, _reply_to_id?}` | dmStore.sendMessage                   |
| `edit_dm`                       | `{_message_id, _sender_id, _content}`                     | dmStore.editMessage                   |
| `delete_dm`                     | `{_message_id, _sender_id}`                               | dmStore.deleteMessage                 |
| `add_dm_reaction`               | `{_message_id, _user_id, _emoji}`                         | dmStore.addReaction                   |
| `remove_dm_reaction`            | `{_message_id, _user_id, _emoji}`                         | dmStore.removeReaction                |
| `get_dm_unread_counts`          | `{_user_id}`                                              | useUnreadDMs                          |
| `mark_dm_read`                  | `{_conversation_id, _user_id}`                            | useUnreadDMs                          |

### Friends

| RPC                                   | Parameters                     | Used By                                           |
| ------------------------------------- | ------------------------------ | ------------------------------------------------- |
| `get_friend_dashboard`                | `{_user_id}`                   | friendStore.fetchFriends (single-call, preferred) |
| `get_user_friends`                    | `{_user_id}`                   | friendStore.fetchFriends (fallback)               |
| `get_pending_friend_requests`         | `{_user_id}`                   | friendStore.fetchFriends (fallback)               |
| `get_outgoing_friend_requests`        | `{_user_id}`                   | friendStore.fetchFriends (fallback)               |
| `get_blocked_users`                   | `{_user_id}`                   | friendStore.fetchFriends (fallback)               |
| `get_blocked_user_ids_for_visibility` | `{_user_id}`                   | friendStore.fetchFriends (fallback)               |
| `send_friend_request`                 | `{_user_id, _username}`        | friendStore.sendRequest                           |
| `accept_friend_request`               | `{_friendship_id, _user_id}`   | friendStore.acceptRequest                         |
| `decline_friend_request`              | `{_friendship_id, _user_id}`   | friendStore.declineRequest                        |
| `remove_friend`                       | `{_friendship_id, _user_id}`   | friendStore.removeFriend                          |
| `block_user`                          | `{_user_id, _target_user_id}`  | friendStore.blockUser                             |
| `unblock_user`                        | `{_user_id, _blocked_user_id}` | friendStore.unblockUser                           |

### Polls

| RPC                   | Parameters                                                                                        | Used By                     |
| --------------------- | ------------------------------------------------------------------------------------------------- | --------------------------- |
| `send_poll`           | `{_channel_id, _user_id, _question, _options, _allow_multiple, _duration_seconds, _reply_to_id?}` | messageStore.sendPoll       |
| `vote_poll`           | `{_poll_id, _user_id, _option_indexes}`                                                           | pollStore.votePoll          |
| `close_poll`          | `{_poll_id}`                                                                                      | pollStore.closePoll         |
| `close_expired_polls` | `{_channel_id}`                                                                                   | pollStore.closeExpiredPolls |

### Unread

| RPC                             | Parameters                           | Used By                     |
| ------------------------------- | ------------------------------------ | --------------------------- |
| `get_all_channel_unread_counts` | `{_channel_ids, _blocked_user_ids?}` | useUnread                   |
| `mark_channel_read`             | `{_channel_id, _last_message_id?}`   | useUnread (legacy fallback) |
| `mark_channels_read`            | `{_channel_ids}`                     | useUnread.markServerAsRead  |

### Health

| RPC           | Parameters | Used By                                |
| ------------- | ---------- | -------------------------------------- |
| `ping_health` | `{}`       | useBackgroundSync, useConnectionStatus |

---

## Edge Function Reference

| Endpoint                 | Method                       | Auth                | Used By                           |
| ------------------------ | ---------------------------- | ------------------- | --------------------------------- |
| `register-with-captcha`  | POST                         | None (pre-auth)     | authStore.createAccount           |
| `update-user-profile`    | POST                         | x-key-hash          | authStore.updateUser              |
| `generate-challenge`     | GET                          | None (pre-auth)     | crypto.fetchPoWChallenge          |
| `storage-upload`         | POST                         | x-key-hash + Bearer | storageUpload.secureUpload        |
| `storage-upload`         | DELETE                       | x-key-hash + Bearer | storageUpload.secureDelete        |
| `storage-upload`         | POST (action: listAndDelete) | x-key-hash + Bearer | storageUpload.secureListAndDelete |
| `get-livekit-token`      | POST                         | x-key-hash          | useAgoraRoom (voice)              |
| `broadcast-typing`       | POST                         | x-key-hash          | useTyping                         |
| `fetch-discord-template` | POST                         | x-key-hash          | serverStore.importDiscordTemplate |

---

## Supabase Tables & Buckets

### Tables (directly queried)

| Table                   | Operations                     | Used By                           |
| ----------------------- | ------------------------------ | --------------------------------- |
| `notifications`         | SELECT, UPDATE, INSERT, DELETE | notificationStore                 |
| `channels`              | SELECT                         | AppLayout (server-channel map)    |
| `channel_user_settings` | SELECT, UPSERT                 | channelSettingsStore              |
| `server_emojis`         | SELECT                         | serverEmojis, globalEmojiResolver |
| `polls`                 | SELECT                         | pollStore                         |
| `poll_votes`            | SELECT                         | pollStore                         |
| `dm_reactions`          | SELECT                         | dmStore                           |
| `users_public`          | SELECT                         | useRealtimeMembers (view)         |

### Tables (realtime subscriptions only)

| Table                 | Channel                                           | Events                 |
| --------------------- | ------------------------------------------------- | ---------------------- |
| `servers`             | `server:${serverId}`                              | UPDATE, DELETE         |
| `channels`            | `server:${serverId}`                              | INSERT, UPDATE, DELETE |
| `channel_categories`  | `server:${serverId}`                              | INSERT, UPDATE, DELETE |
| `channel_permissions` | `server:${serverId}`                              | \*                     |
| `role_permissions`    | `server:${serverId}`                              | \*                     |
| `server_members`      | `members:${serverId}`, `own-membership:${userId}` | INSERT, UPDATE, DELETE |
| `server_roles`        | `members:${serverId}`                             | \*                     |
| `server_member_roles` | `members:${serverId}`, `server:${serverId}`       | INSERT, DELETE         |
| `channel_members`     | `server:${serverId}`                              | \*                     |
| `notifications`       | `notifications:${userId}`                         | INSERT, DELETE         |
| `friendships`         | `friendships:${userId}`                           | \*                     |
| `direct_messages`     | `all-dms:${userId}`                               | INSERT, UPDATE, DELETE |
| `dm_reactions`        | `dm-reactions:${userId}`                          | INSERT, DELETE         |
| `dm_participants`     | `dm-participants:${userId}`                       | INSERT, DELETE         |

### Storage Buckets

| Bucket                       | Purpose                                                 |
| ---------------------------- | ------------------------------------------------------- |
| `server-emojis`              | Custom server emojis                                    |
| `attachments`                | Message file attachments (uses signed URLs, 1hr expiry) |
| General (via `secureUpload`) | Server icons, user avatars, banners, etc.               |

---

## Realtime Channel Map

Quick reference for all Supabase Realtime channels:

| Channel Pattern             | Type             | Purpose                                        |
| --------------------------- | ---------------- | ---------------------------------------------- |
| `chat:${channelId}`         | Broadcast        | Messages, reactions, polls (shared by 3 hooks) |
| `typing:${channelId}`       | Broadcast        | Typing indicators                              |
| `voice:${channelId}`        | Presence         | Voice channel participant tracking             |
| `voice-meta:${channelId}`   | Broadcast        | Voice hide-activity metadata                   |
| `server:${serverId}`        | Postgres Changes | Server/channel/category/permission changes     |
| `members:${serverId}`       | Postgres Changes | Member/role changes                            |
| `server-emojis:${serverId}` | Postgres Changes | Emoji changes                                  |
| `notifications:${userId}`   | Postgres Changes | Notification delivery                          |
| `friendships:${userId}`     | Postgres Changes | Friendship changes                             |
| `own-membership:${userId}`  | Postgres Changes | Kick/ban detection                             |
| `user:${userId}`            | Broadcast        | DM messages, unread counts, channel reads      |
| `all-dms:${userId}`         | Postgres Changes | DM message fallback                            |
| `dm-reactions:${userId}`    | Postgres Changes | DM reactions                                   |
| `dm-participants:${userId}` | Postgres Changes | DM participant changes                         |
| `presence:users-global`     | Presence         | Global user online/offline/idle tracking       |
| `connection-status`         | Shared singleton | Connection health monitoring                   |

---

## localStorage Keys

| Key                            | Data                                        | Used By                             |
| ------------------------------ | ------------------------------------------- | ----------------------------------- |
| `kloak-auth`                   | `{secretKey, keyHash, manualStatus}`        | authStore (Zustand persist)         |
| `kloak-ui`                     | UI preferences (theme, notifications, etc.) | uiStore (Zustand persist)           |
| `kloak-offline-queue`          | Queued messages                             | offlineQueueStore (Zustand persist) |
| `kloak-hidden-embeds`          | Hidden embed message IDs                    | embedStore (Zustand persist)        |
| `kloak-secret-key`             | Secret key (legacy?)                        | lib/storage                         |
| `kloak-theme`                  | Theme string                                | lib/storage                         |
| `kloak-drafts`                 | `{channelId: content}`                      | lib/storage                         |
| `kloak-last-channels`          | `{serverId: channelId}`                     | lib/storage                         |
| `kloak-welcome-shown-{userId}` | Boolean flag                                | lib/storage                         |
| `kloak-current-server-id`      | Server ID                                   | serverStore                         |
| `kloak-current-dm-id`          | DM conversation ID                          | dmStore                             |
| `kloak-dm-view-active`         | Boolean flag                                | serverStore                         |
