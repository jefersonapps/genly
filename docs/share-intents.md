# Shared files and native targets

`ShareIntentProvider` mounts before database migrations and does not reset pending shares when the app goes into the background. Root navigation waits for fonts, authentication, onboarding and the initial `/` redirect to finish before opening the destination. It acknowledges an import only after the active route contains its `shareRequestId`.

The active app route is resolved through Expo Router's internal `__root` wrappers. A wrapper without an app stack is not ready for imports. Readiness and receipt checks use the app stack's focused screen, so the cold-start index redirect completes before opening the import screen and the request is acknowledged at its destination.

The `expo-share-intent` patch queues Android intents, assigns request identifiers and retains each request until acknowledged. Cold starts register JS event listeners before asking native code to replay pending content. Resetting request A cannot clear request B. A completed request is removed from the Activity intent to prevent replay on recreation.

Shared files are copied to unique private cache files on a worker thread while the URI grant is valid. Missing metadata columns and MIME types have fallbacks. File-copy failures retain the pending request and offer retry or cancellation. Android file grants and access to cloud-only photos still depend on the source provider.

Android `ACTION_VIEW` file intents (including PDFs opened from WhatsApp) use the same import pipeline as `ACTION_SEND`. The native URL hook keeps `content://` and `file://` addresses out of page routing: cold starts initialize through `/`, while a running app ignores the file URL so it cannot overwrite the import destination. The share provider retains the file URI and selects the destination by MIME type even without a filename extension.

The PDF organizer imports whenever route parameters change, including after preloading or another share, while ignoring repeat deliveries of an imported request.

Run `npm run test:share-intent` for routing, cold-start subscriptions, lifecycle resets and PDF import regressions. The native patch requires rebuilding the Android app; JavaScript tests do not replace testing gallery intents on a physical device.
