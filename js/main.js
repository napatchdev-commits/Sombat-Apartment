import { App } from './app.js';
import { DBService } from './services/db.js';
import { AuthService } from './services/auth.js';
import { Formatters } from './utils/formatters.js';
import { PromptPayService } from './services/promptpay.js';
import { LineService } from './services/line.js';
import { ExportService } from './services/export.js';

// Expose core services globally for backward compatibility with inline window handlers
window.App = App;
window.DBService = DBService;
window.AuthService = AuthService;
window.Formatters = Formatters;
window.PromptPayService = PromptPayService;
window.LineService = LineService;
window.ExportService = ExportService;

function bootApp() {
  try {
    App.init();
  } catch (err) {
    console.error('Fatal App Initialization Error:', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootApp);
} else {
  bootApp();
}
