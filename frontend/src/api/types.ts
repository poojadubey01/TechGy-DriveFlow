/** Shapes of the API's JSON (see backend/README.md). */

export type ApiUser = {
  id: string;
  name: string;
  email: string;
  company?: string;
  provider: 'email' | 'google';
  hasPassword: boolean;
  emailVerified: boolean;
  createdAt: string;
};

export type ApiDrive = {
  connected: boolean;
  account: string | null;
  folder: { id: string; name: string } | null;
  lastSync: string | null;
  provider: 'google' | 'mock' | null;
};

export type ApiSettings = {
  defaultSlides: 8 | 12 | 15;
  defaultTemplate: 'classic' | 'editorial' | 'split' | 'bold';
  notifyReady: boolean;
  notifyViews: boolean;
  notifyPhotos: boolean;
};

export type ApiBrand = { on: boolean; name: string; accent: string; displayName: string };

export type ApiMe = { user: ApiUser; drive: ApiDrive; settings: ApiSettings; brand: ApiBrand; unreadNotifications: number };

export type ApiSignedIn = { token: string; user: ApiUser; isNew?: boolean };

export type ApiPhoto = { id: string; name: string; kind: 'exterior' | 'interior' | 'night' | null; width: number | null; height: number | null; url: string };

export type ApiClientSummary = { id: string; name: string; meta: string; photos: number; decks: number; cover: ApiPhoto | null };
export type ApiClientDetail = { id: string; name: string; meta: string; removed: boolean; cover: ApiPhoto | null; photos: ApiPhoto[] };

export type ApiShare = { id: string; url: string; active: boolean; allowPdf: boolean };

export type ApiDeckSummary = {
  id: string;
  client: { id: string; name: string };
  type: 'Portfolio' | 'Proposal' | 'Moodboard';
  title: string;
  template: ApiSettings['defaultTemplate'];
  slides: number;
  builtSlides: number;
  edited: boolean;
  cover: { photoId: string; url: string } | null;
  share: ApiShare;
  opens: number;
  createdAt: string;
  updatedAt: string;
};

export type ApiDeckDetail = ApiDeckSummary & {
  client: { id: string; name: string; meta: string };
  sourcePhotoIds: string[] | null;
  sender: { name: string; email: string; company?: string };
  slideList: { photoId: string; title: string; url: string; missing: boolean }[];
};

export type ApiActivity = {
  opens: number;
  totalSeconds: number;
  downloads: number;
  perSlide: number[];
  visits: { id: string; startedAt: string; lastSeenAt: string; device: 'phone' | 'laptop' | 'tablet'; seconds: number; downloaded: boolean }[];
};

export type ApiNotification = {
  id: string;
  kind: 'ready' | 'viewed' | 'photos' | 'team';
  title: string;
  body: string;
  target: { pathname: '/ready' | '/clients' | '/profile' | '/client/[id]' | '/activity'; params?: Record<string, string> };
  read: boolean;
  createdAt: string;
};

export type ApiDriveFolder = { id: string; name: string; clientFolders: number; updated: string | null; recommended: boolean };

export type ApiPublicDeck = {
  title: string;
  type: ApiDeckSummary['type'];
  template: ApiSettings['defaultTemplate'];
  allowPdf: boolean;
  client: { name: string; meta: string };
  sender: { name: string; email: string; company?: string };
  brand: { on: boolean; name: string; accent: string };
  slides: { title: string; url: string; missing: boolean }[];
};
