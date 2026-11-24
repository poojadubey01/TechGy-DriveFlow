import { sql } from 'drizzle-orm';
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

const id = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();
const ts = (name: string) => timestamp(name, { withTimezone: true });

/* ---------------------------------------------------------------- accounts */

export const users = pgTable('users', {
  id: id(),
  /** Always stored lower-case. */
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  company: text('company'),
  /** scrypt hash; null for Google-only accounts. */
  passwordHash: text('password_hash'),
  /** How the account was created: 'email' or 'google'. */
  provider: text('provider').notNull(),
  googleSub: text('google_sub').unique(),
  emailVerifiedAt: ts('email_verified_at'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** One row per signed-in device. Only a hash of the token is stored. */
export const sessions = pgTable(
  'sessions',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
    lastUsedAt: ts('last_used_at').notNull().defaultNow(),
    expiresAt: ts('expires_at').notNull(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

/** 6-digit codes for email verification and password reset (hashed, short-lived, limited attempts). */
export const emailCodes = pgTable(
  'email_codes',
  {
    id: id(),
    email: text('email').notNull(),
    purpose: text('purpose').notNull(),
    codeHash: text('code_hash').notNull(),
    attempts: integer('attempts').notNull().default(0),
    expiresAt: ts('expires_at').notNull(),
    consumedAt: ts('consumed_at'),
    createdAt: createdAt(),
  },
  (t) => [index('email_codes_lookup_idx').on(t.email, t.purpose)],
);

export const userSettings = pgTable('user_settings', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  defaultSlides: integer('default_slides').notNull().default(12),
  defaultTemplate: text('default_template').notNull().default('classic'),
  notifyReady: boolean('notify_ready').notNull().default(true),
  notifyViews: boolean('notify_views').notNull().default(true),
  notifyPhotos: boolean('notify_photos').notNull().default(false),
  updatedAt: updatedAt(),
});

export const brandKits = pgTable('brand_kits', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  on: boolean('on').notNull().default(true),
  /** Empty = use the account's company (or name). */
  name: text('name').notNull().default(''),
  accent: text('accent').notNull().default('#0022FF'),
  updatedAt: updatedAt(),
});

/* ------------------------------------------------------------ google drive */

export const driveConnections = pgTable('drive_connections', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  /** 'google' or 'mock' (development stand-in). */
  provider: text('provider').notNull(),
  account: text('account').notNull(),
  /** AES-256-GCM encrypted Google refresh token. */
  refreshTokenEnc: text('refresh_token_enc'),
  /** The projects folder DriveFlow reads (one sub-folder per client). */
  folderId: text('folder_id'),
  folderName: text('folder_name'),
  lastSyncAt: ts('last_sync_at'),
  connectedAt: createdAt(),
});

/** A client = one sub-folder of the chosen Drive folder. */
export const clients = pgTable(
  'clients',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    driveFolderId: text('drive_folder_id').notNull(),
    name: text('name').notNull(),
    /** Short description ("Luxury villas"); starts as the Drive folder's description. */
    meta: text('meta').notNull().default(''),
    /** Set when the folder disappears from Drive; hidden from lists, kept for old decks. */
    removedAt: ts('removed_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('clients_user_folder_idx').on(t.userId, t.driveFolderId)],
);

export const photos = pgTable(
  'photos',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    driveFileId: text('drive_file_id').notNull(),
    name: text('name').notNull(),
    mimeType: text('mime_type').notNull(),
    width: integer('width'),
    height: integer('height'),
    /** 'exterior' | 'interior' | 'night', or null when unknown. */
    kind: text('kind'),
    /** True once someone set the kind by hand (sync then leaves it alone). */
    kindManual: boolean('kind_manual').notNull().default(false),
    position: integer('position').notNull().default(0),
    driveModifiedAt: ts('drive_modified_at'),
    removedAt: ts('removed_at'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('photos_client_file_idx').on(t.clientId, t.driveFileId), index('photos_client_pos_idx').on(t.clientId, t.position)],
);

/* ------------------------------------------------------------------- decks */

export type SlideRow = { photoId: string; title: string };

export const decks = pgTable(
  'decks',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    /** 'Portfolio' | 'Proposal' | 'Moodboard'. */
    type: text('type').notNull(),
    /** The deck's name, also the cover slide's title. */
    title: text('title').notNull(),
    template: text('template').notNull().default('classic'),
    /** Slides as built ("Reset" in Edit deck goes back to these). */
    builtSlides: jsonb('built_slides').$type<SlideRow[]>().notNull(),
    /** Current slides (after edits). */
    slides: jsonb('slides').$type<SlideRow[]>().notNull(),
    /** Photos the deck was built from, in order; null = all of the client's photos. */
    sourcePhotoIds: jsonb('source_photo_ids').$type<string[] | null>(),
    /** Unguessable code in the share link. */
    shareId: text('share_id').notNull().unique(),
    shareActive: boolean('share_active').notNull().default(true),
    shareAllowPdf: boolean('share_allow_pdf').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('decks_user_created_idx').on(t.userId, t.createdAt)],
);

/** One client visit to a share link. */
export const deckVisits = pgTable(
  'deck_visits',
  {
    id: id(),
    deckId: uuid('deck_id')
      .notNull()
      .references(() => decks.id, { onDelete: 'cascade' }),
    /** Hash of the token the viewer's browser uses to report progress for this visit. */
    tokenHash: text('token_hash').notNull(),
    /** 'phone' | 'laptop' | 'tablet'. */
    device: text('device').notNull(),
    userAgent: text('user_agent'),
    seconds: integer('seconds').notNull().default(0),
    /** Seconds per slide index. */
    slideSeconds: jsonb('slide_seconds').$type<number[]>().notNull().default(sql`'[]'::jsonb`),
    downloadedAt: ts('downloaded_at'),
    startedAt: ts('started_at').notNull().defaultNow(),
    lastSeenAt: ts('last_seen_at').notNull().defaultNow(),
  },
  (t) => [index('deck_visits_deck_idx').on(t.deckId, t.startedAt)],
);

/* ----------------------------------------------------------- notifications */

export type NotificationTarget = {
  pathname: '/ready' | '/clients' | '/profile' | '/client/[id]' | '/activity';
  params?: Record<string, string>;
};

export const notifications = pgTable(
  'notifications',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** 'ready' | 'viewed' | 'photos' | 'team'. */
    kind: text('kind').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    target: jsonb('target').$type<NotificationTarget>().notNull(),
    /** Lets repeated events update one notification (e.g. several views of the same deck). */
    dedupeKey: text('dedupe_key'),
    readAt: ts('read_at'),
    createdAt: createdAt(),
  },
  (t) => [index('notifications_user_created_idx').on(t.userId, t.createdAt)],
);

/**
 * Phones that receive push notifications (Expo push tokens). Tied to the signed-in session, so
 * signing out — or a password reset that signs out every device — stops pushes to that phone.
 */
export const pushTokens = pgTable(
  'push_tokens',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    /** 'ios' | 'android'. */
    platform: text('platform').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('push_tokens_user_idx').on(t.userId)],
);

/* ----------------------------------------------------------------- support */

export const feedback = pgTable('feedback', {
  id: id(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  email: text('email').notNull(),
  message: text('message').notNull(),
  device: text('device'),
  createdAt: createdAt(),
});
