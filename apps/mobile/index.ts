// NOTE: Bu dosya Metro bundler'a Expo tip extensions'ı tanıtır.
// index.ts — uygulama giriş noktası, App.tsx'i render eder.

import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
