import type { AgriSector } from '../types.ts';

import farmerAvatarImg from '../assets/images/farmer_friend_avatar_1794837273687.jpg';
import allAgriImg from '../assets/images/sector_all_agriculture_1794837274078.jpg';
import fieldCropsImg from '../assets/images/sector_field_crops_1794837274664.jpg';
import horticultureImg from '../assets/images/sector_horticulture_1794837273790.jpg';
import greenhouseImg from '../assets/images/sector_greenhouse_1794837274774.jpg';
import livestockImg from '../assets/images/sector_livestock_1794837275168.jpg';
import aquacultureImg from '../assets/images/sector_aquaculture_1794837275781.jpg';

export const FARMER_ASSISTANT_AVATAR = farmerAvatarImg;

export const SECTOR_TITLE_IMAGES: Record<AgriSector, string> = {
  all: allAgriImg,
  'row-crops': fieldCropsImg,
  horticulture: horticultureImg,
  greenhouse: greenhouseImg,
  livestock: livestockImg,
  aquaculture: aquacultureImg,
};
