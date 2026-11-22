import React from 'react';
import maleAvatarImg from '../assets/images/avatar_male_3d_anime_1795279037587.jpg';
import femaleAvatarImg from '../assets/images/avatar_female_3d_anime_1795279041191.jpg';
import type { UserGender } from '../types';

export const ANIME_AVATARS: Record<UserGender, { src: string; label: string; subtitle: string }> = {
  male: {
    src: maleAvatarImg,
    label: 'Male',
    subtitle: '3D Anime Avatar'
  },
  female: {
    src: femaleAvatarImg,
    label: 'Female',
    subtitle: '3D Anime Avatar'
  }
};

export function getAnimeAvatarSrc(gender?: UserGender): string {
  return gender === 'female' ? femaleAvatarImg : maleAvatarImg;
}

interface UserAvatarProps {
  gender?: UserGender;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<UserAvatarProps['size']>, string> = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-14 h-14',
  xl: 'w-20 h-20'
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  gender = 'male',
  name = 'Member',
  size = 'md',
  className = ''
}) => {
  const src = getAnimeAvatarSrc(gender);
  return (
    <img
      src={src}
      alt={`${name} (${gender === 'female' ? 'Female' : 'Male'} 3D Anime Avatar)`}
      className={`${SIZE_CLASSES[size]} rounded-full object-cover border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 shrink-0 ${className}`}
    />
  );
};
