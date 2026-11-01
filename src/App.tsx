import { ExpoRoot } from 'expo-router';
import Head from 'expo-router/head';
import React from 'react';

// Keep the route context outside the registration module for Fast Refresh.
const context = require.context('./app');

export default function App() {
  return (
    <Head.Provider>
      <ExpoRoot context={context} />
    </Head.Provider>
  );
}
