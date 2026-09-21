/**
 * Expo Image wrapper — fallback'li görsel bileşeni.
 * expo-image paketi yoksa react-native Image kullanır.
 */
import React from 'react';
import { Image, ImageProps, StyleSheet } from 'react-native';

type Props = {
  source: { uri: string };
  style?: any;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
};

export function ExpoImage(props: Props) {
  return (
    <Image
      source={props.source}
      style={props.style}
      resizeMode={props.resizeMode || 'cover'}
    />
  );
}
