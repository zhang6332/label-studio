import { registerAnalytics } from "@humansignal/core";
registerAnalytics();

import { initI18n } from "./i18n";
// Apply the saved language (DOM dictionary translation) as early as possible.
// initI18n defers the actual DOM walk until the React tree has rendered.
initI18n();

// Must import before ./app/App — ESM evaluates imports before module body, and App calls render() at top level.
import "@humansignal/app-common/pages/AccountSettings/hotkeys/bootstrapHotkeys";
import "./app/App";
import "./utils/service-worker";
import "./utils/state-registry-lso";
