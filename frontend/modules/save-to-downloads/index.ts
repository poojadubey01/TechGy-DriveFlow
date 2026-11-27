import { requireOptionalNativeModule } from 'expo';

type SaveToDownloads = {
  /** True on Android 10 and newer. */
  isAvailable: boolean;
  /** Copies a file:// file into Downloads; returns its content URI and final name. */
  save(fileUri: string, fileName: string, mimeType: string): Promise<{ uri: string; name: string }>;
  /** Opens a saved file in a viewer app. */
  open(contentUri: string, mimeType: string): Promise<void>;
};

/** Android only (null on iOS and web, and in builds made before this module existed). */
export const SaveToDownloadsModule = requireOptionalNativeModule<SaveToDownloads>('SaveToDownloads');
