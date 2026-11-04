import React, { useState } from 'react';
import AdminLogin from './AdminLogin.jsx';
import WelcomeScreen from './WelcomeScreen.jsx';
import { supabase } from './supabaseClient';

export default function App() {
  const [screen, setScreen] = useState('welcome');

  // ترتيب البرنامج:
  // WelcomeScreen -> AdminLogin -> بوابة الموظفين
  if (screen === 'welcome') {
    return (
      <WelcomeScreen
        onNavigateLogin={() => setScreen('login')}
      />
    );
  }

  return (
    <AdminLogin
      supabase={supabase}
      onLogout={() => setScreen('welcome')}
      onGoHome={() => setScreen('welcome')}
    />
  );
}
