export interface StateDirectoryEntry {
  state: string;
  labelKn?: string;
  districts: Record<string, string[]>;
}

/**
 * Real Indian State -> District -> Taluk / APMC geographic hierarchy.
 * No prices are hardcoded here — all market rates are fetched live via Google Search grounding.
 */
export const INDIA_MARKET_LOCATIONS: StateDirectoryEntry[] = [
  {
    state: 'Karnataka',
    labelKn: 'ಕರ್ನಾಟಕ (Karnataka)',
    districts: {
      'Bagalkote': ['Bagalkote', 'Badami', 'Bilagi', 'Guledgudda', 'Hungund', 'Ilkal', 'Jamkhandi', 'Mudhol', 'Rabkavi Banhatti'],
      'Ballari': ['Ballari', 'Kampli', 'Kurugodu', 'Sandur', 'Siruguppa'],
      'Belagavi': ['Athani', 'Bailhongal', 'Belagavi', 'Chikkodi', 'Gokak', 'Hukkeri', 'Kagwad', 'Khanapur', 'Kittur', 'Mudalgi', 'Nippani', 'Ramdurg', 'Raybag', 'Saundatti', 'Yaragatti'],
      'Bengaluru Rural': ['Devanahalli', 'Doddaballapura', 'Hosakote', 'Nelamangala'],
      'Bengaluru Urban': ['Anekal', 'Bengaluru East', 'Bengaluru North', 'Bengaluru South', 'Yelahanka', 'Yeshwanthpur APMC'],
      'Bidar': ['Aurad', 'Basavakalyan', 'Bhalki', 'Bidar', 'Chitguppa', 'Hulsoor', 'Humnabad', 'Kamalnagar'],
      'Chamarajanagara': ['Chamarajanagara', 'Gundlupet', 'Hanur', 'Kollegal', 'Yelandur'],
      'Chikkaballapura': ['Bagepalli', 'Chelur', 'Chikkaballapura', 'Chintamani', 'Gauribidanur', 'Gudibanda', 'Manchenahalli', 'Sidlaghatta'],
      'Chikkamagaluru': ['Ajjampura', 'Chikkamagaluru', 'Kadur', 'Kalasa', 'Koppa', 'Mudigere', 'Narasimharajapura', 'Sringeri', 'Tarikere'],
      'Chitradurga': ['Challakere', 'Chitradurga', 'Hiriyur', 'Holalkere', 'Hosadurga', 'Molakalmuru'],
      'Dakshina Kannada': ['Bantwal', 'Belthangady', 'Kadaba', 'Mangaluru', 'Moodabidri', 'Mulki', 'Puttur', 'Sullia', 'Ullal'],
      'Davanagere': ['Channagiri', 'Davanagere', 'Harihara', 'Honnali', 'Jagaluru', 'Nyamathi'],
      'Dharwad': ['Alnavar', 'Annigeri', 'Dharwad', 'Hubballi', 'Kalghatgi', 'Kundgol', 'Navalgund'],
      'Gadag': ['Gadag', 'Gajendragad', 'Laxmeshwar', 'Mundargi', 'Nargund', 'Ron', 'Shirahatti'],
      'Hassan': ['Alur', 'Arkalgud', 'Arsikere', 'Belur', 'Channarayapatna', 'Hassan', 'Holenarasipura', 'Sakleshpur'],
      'Haveri': ['Byadgi', 'Hanagal', 'Haveri', 'Hirekerur', 'Ranebennur', 'Rattihalli', 'Savanur', 'Shiggaon'],
      'Kalaburagi': ['Afzalpur', 'Aland', 'Chincholi', 'Chittapur', 'Jevargi', 'Kalaburagi', 'Kalagi', 'Kamalapur', 'Sedam', 'Shahabad', 'Yadrami'],
      'Kodagu': ['Kushalnagar', 'Madikeri', 'Ponnampet', 'Somwarpet', 'Virajpet'],
      'Kolar': ['Bangarapet', 'K.G.F.', 'Kolar', 'Malur', 'Mulbagal', 'Srinivaspur'],
      'Koppal': ['Gangavathi', 'Kanakagiri', 'Karatagi', 'Koppal', 'Kukanoor', 'Kushtagi', 'Yelburga'],
      'Mandya': ['Krishnarajapet (K.R. Pet)', 'Maddur', 'Malavalli', 'Mandya', 'Nagamangala', 'Pandavapura', 'Srirangapatna'],
      'Mysuru': ['Heggadadevana Kote', 'Hunsur', 'Krishnarajanagara', 'Mysuru', 'Nanjangud', 'Periyapatna', 'Saligrama', 'Saragur', 'Tirumakudalu Narasipura'],
      'Raichur': ['Devadurga', 'Lingsugur', 'Manvi', 'Maski', 'Raichur', 'Sindhanur', 'Sirwar'],
      'Ramanagara': ['Channapatna', 'Harohalli', 'Kanakapura', 'Magadi', 'Ramanagara'],
      'Shivamogga': ['Bhadravathi', 'Hosanagara', 'Sagar', 'Shikaripura', 'Shivamogga', 'Soraba', 'Thirthahalli'],
      'Tumakuru': ['Chikkanayakanahalli', 'Gubbi', 'Koratagere', 'Kunigal', 'Madhugiri', 'Pavagada', 'Sira', 'Tiptur', 'Tumakuru', 'Turuvekere'],
      'Udupi': ['Brahmavar', 'Byndoor', 'Hebri', 'Kapu', 'Karkala', 'Kundapura', 'Udupi'],
      'Uttara Kannada': ['Ankola', 'Bhatkal', 'Dandeli', 'Haliyal', 'Honnavar', 'Joida', 'Karwar', 'Kumta', 'Mundgod', 'Siddapur', 'Sirsi', 'Yellapur'],
      'Vijayanagara': ['Hadagali', 'Hagaribommanahalli', 'Harapanahalli', 'Hoovina Hadagali', 'Hosapete', 'Kotturu', 'Kudligi'],
      'Vijayapura': ['Alamela', 'Babaleshwar', 'Basavana Bagewadi', 'Chadchan', 'Devara Hipparagi', 'Indi', 'Kolhar', 'Muddebihal', 'Nidagundi', 'Sindagi', 'Talikoti', 'Tikota', 'Vijayapura'],
      'Yadgir': ['Gurumitkal', 'Hunasagi', 'Shahapur', 'Shorapur', 'Vadagera', 'Yadgir'],
    },
  },
  {
    state: 'Maharashtra',
    labelKn: 'ಮಹಾರಾಷ್ಟ್ರ (Maharashtra)',
    districts: {
      'Pune': ['Baramati', 'Daund', 'Indapur', 'Junnar', 'Khed', 'Maval', 'Pune', 'Shirur'],
      'Nashik': ['Lasalgaon', 'Malegaon', 'Manmad', 'Nandgaon', 'Nashik', 'Niphad', 'Pimpalgaon Baswant', 'Sinnar', 'Yeola'],
      'Kolhapur': ['Gadhinglaj', 'Hatkanangale', 'Kagal', 'Karveer', 'Kolhapur', 'Panhala', 'Shirol'],
      'Sangli': ['Atpadi', 'Jat', 'Kadegaon', 'Miraj', 'Palus', 'Sangli', 'Tasgaon', 'Vita', 'Walwa'],
      'Satara': ['Karad', 'Khatav', 'Koregaon', 'Phaltan', 'Satara', 'Wai'],
      'Solapur': ['Akkalkot', 'Barshi', 'Karmala', 'Madha', 'Malshiras', 'Mangalwedha', 'Pandharpur', 'Sangola', 'Solapur'],
      'Nagpur': ['Hingna', 'Kamptee', 'Katol', 'Nagpur', 'Ramtek', 'Savner', 'Umred'],
      'Ahilyanagar (Ahmednagar)': ['Akole', 'Jamkhed', 'Kopargaon', 'Nagar', 'Nevasa', 'Parner', 'Rahata', 'Rahuri', 'Sangamner', 'Shrigonda', 'Shrirampur'],
    },
  },
  {
    state: 'Andhra Pradesh',
    labelKn: 'ಆಂಧ್ರ ಪ್ರದೇಶ (Andhra Pradesh)',
    districts: {
      'Guntur': ['Guntur', 'Mangalagiri', 'Ponnur', 'Tenali'],
      'Anantapuramu': ['Anantapur', 'Dharmavaram', 'Gooty', 'Guntakal', 'Kalyandurg', 'Rayadurg', 'Tadipatri'],
      'Kurnool': ['Adoni', 'Alur', 'Kurnool', 'Mantralayam', 'Pattikonda', 'Yemmiganur'],
      'Chittoor': ['Chittoor', 'Kuppam', 'Madanapalle', 'Nagari', 'Palamaner', 'Punganur'],
      'East Godavari': ['Amalapuram', 'Kakinada', 'Mandapeta', 'Rajahmundry', 'Ravulapalem', 'Tuni'],
      'NTR / Krishna': ['Gudivada', 'Jaggayyapeta', 'Machilipatnam', 'Nuzvid', 'Vijayawada'],
    },
  },
  {
    state: 'Telangana',
    labelKn: 'ತೆಲಂಗಾಣ (Telangana)',
    districts: {
      'Hyderabad / Rangareddy': ['Bowenpally', 'Gaddiannaram', 'Ibrahimpatnam', 'Shadnagar', 'Vikarabad'],
      'Nizamabad': ['Armoor', 'Bodhan', 'Kamareddy', 'Nizamabad'],
      'Warangal': ['Ghanpur', 'Jangaon', 'Mahabubabad', 'Narsampet', 'Warangal (Enumamula)'],
      'Karimnagar': ['Huzurabad', 'Jagtial', 'Karimnagar', 'Peddapalli'],
      'Khammam': ['Khammam', 'Kothagudem', 'Madhira', 'Sathupalli', 'Wyra'],
      'Nalgonda': ['Miryalaguda', 'Nalgonda', 'Suryapet'],
    },
  },
  {
    state: 'Tamil Nadu',
    labelKn: 'ತಮಿಳುನಾಡು (Tamil Nadu)',
    districts: {
      'Coimbatore': ['Coimbatore', 'Mettupalayam', 'Pollachi', 'Sulur'],
      'Erode': ['Bhavani', 'Erode', 'Gobichettipalayam', 'Perundurai', 'Sathyamangalam'],
      'Salem': ['Attur', 'Mettur', 'Omalur', 'Salem', 'Sankari'],
      'Madurai': ['Madurai', 'Melur', 'Thirumangalam', 'Usilampatti'],
      'Thanjavur': ['Kumbakonam', 'Orathanadu', 'Pattukkottai', 'Thanjavur'],
      'Krishnagiri': ['Denkanikottai', 'Hosur', 'Krishnagiri', 'Pochampalli'],
    },
  },
  {
    state: 'Kerala',
    labelKn: 'ಕೇರಳ (Kerala)',
    districts: {
      'Wayanad': ['Kalpetta', 'Mananthavady', 'Sulthan Bathery'],
      'Idukki': ['Adimali', 'Kattappana', 'Nedumkandam', 'Thodupuzha'],
      'Palakkad': ['Alathur', 'Chittur', 'Mannarkkad', 'Ottapalam', 'Palakkad'],
      'Kozhikode': ['Koyilandy', 'Kozhikode', 'Thamarassery', 'Vatakara'],
      'Thrissur': ['Chalakudy', 'Irinjalakuda', 'Kodungallur', 'Kunnamkulam', 'Thrissur'],
    },
  },
  {
    state: 'Madhya Pradesh',
    labelKn: 'ಮಧ್ಯ ಪ್ರದೇಶ (Madhya Pradesh)',
    districts: {
      'Indore': ['Depalpur', 'Indore', 'Mhow', 'Sanwer'],
      'Ujjain': ['Badnagar', 'Khachrod', 'Mahidpur', 'Nagda', 'Tarana', 'Ujjain'],
      'Bhopal': ['Berasia', 'Bhopal', 'Huzur'],
      'Sehore': ['Ashta', 'Budhni', 'Ichhawar', 'Nasrullaganj', 'Sehore'],
      'Jabalpur': ['Jabalpur', 'Patan', 'Shahpura', 'Sihora'],
    },
  },
  {
    state: 'Gujarat',
    labelKn: 'ಗುಜರಾತ್ (Gujarat)',
    districts: {
      'Rajkot': ['Dhoraji', 'Gondal', 'Jasdan', 'Jetpur', 'Rajkot'],
      'Banaskantha': ['Deesa', 'Dhanera', 'Palanpur', 'Tharad'],
      'Junagadh': ['Junagadh', 'Keshod', 'Mangrol', 'Visavadar'],
      'Mehsana': ['Kadi', 'Mehsana', 'Unjha', 'Visnagar'],
      'Surat': ['Bardoli', 'Kamrej', 'Mahuva', 'Surat'],
    },
  },
  {
    state: 'Rajasthan',
    labelKn: 'ರಾಜಸ್ಥಾನ (Rajasthan)',
    districts: {
      'Jaipur': ['Chomu', 'Jaipur', 'Kotputli', 'Shahpura'],
      'Kota': ['Itawa', 'Kota', 'Ramganj Mandi', 'Sangod'],
      'Sri Ganganagar': ['Anupgarh', 'Padampur', 'Raisinghnagar', 'Sri Ganganagar', 'Suratgarh'],
      'Jodhpur': ['Bilara', 'Jodhpur', 'Osian', 'Phalodi'],
      'Bikaner': ['Bikaner', 'Lunkaransar', 'Nokha', 'Sri Dungargarh'],
    },
  },
  {
    state: 'Punjab',
    labelKn: 'ಪಂಜಾಬ್ (Punjab)',
    districts: {
      'Ludhiana': ['Jagraon', 'Khanna', 'Ludhiana', 'Payal', 'Raikot', 'Samrala'],
      'Amritsar': ['Ajnala', 'Amritsar', 'Baba Bakala', 'Majitha'],
      'Patiala': ['Nabha', 'Patiala', 'Rajpura', 'Samana'],
      'Bathinda': ['Bathinda', 'Maur', 'Rampura Phul', 'Talwandi Sabo'],
      'Jalandhar': ['Jalandhar', 'Nakodar', 'Phillaur', 'Shahkot'],
    },
  },
  {
    state: 'Haryana',
    labelKn: 'ಹರಿಯಾಣ (Haryana)',
    districts: {
      'Karnal': ['Assandh', 'Gharaunda', 'Indri', 'Karnal', 'Nilokheri'],
      'Hisar': ['Adampur', 'Barwala', 'Hansi', 'Hisar', 'Narnaund'],
      'Sirsa': ['Dabwali', 'Ellenabad', 'Rania', 'Sirsa'],
      'Kurukshetra': ['Ladwa', 'Pehowa', 'Shahabad', 'Thanesar'],
    },
  },
  {
    state: 'Uttar Pradesh',
    labelKn: 'ಉತ್ತರ ಪ್ರದೇಶ (Uttar Pradesh)',
    districts: {
      'Agra': ['Agra', 'Etmadpur', 'Fatehabad', 'Kheragarh'],
      'Lucknow': ['Bakshi Ka Talab', 'Lucknow', 'Malihabad', 'Mohanlalganj'],
      'Meerut': ['Mawana', 'Meerut', 'Sardhana'],
      'Varanasi': ['Pindra', 'Raja Talab', 'Varanasi'],
      'Kanpur Nagar': ['Bilhaur', 'Ghatampur', 'Kanpur'],
    },
  },
  {
    state: 'Bihar',
    labelKn: 'ಬಿಹಾರ (Bihar)',
    districts: {
      'Patna': ['Barh', 'Danapur', 'Masaurhi', 'Patna'],
      'Muzaffarpur': ['Kanti', 'Motipur', 'Muzaffarpur', 'Sakra'],
      'Purnia': ['Banmankhi', 'Dhamdaha', 'Purnia'],
    },
  },
  {
    state: 'West Bengal',
    labelKn: 'ಪಶ್ಚಿಮ ಬಂಗಾಳ (West Bengal)',
    districts: {
      'Purba Bardhaman': ['Bardhaman', 'Kalna', 'Katwa', 'Memari'],
      'Hooghly': ['Arambagh', 'Chinsurah', 'Serampore', 'Singur'],
      'Murshidabad': ['Baharampur', 'Jangipur', 'Kandi', 'Lalbagh'],
    },
  },
  {
    state: 'Odisha',
    labelKn: 'ಒಡಿಶಾ (Odisha)',
    districts: {
      'Cuttack': ['Athagarh', 'Banki', 'Cuttack', 'Salipur'],
      'Sambalpur': ['Kuchinda', 'Rairakhol', 'Sambalpur'],
      'Bargarh': ['Attabira', 'Bargarh', 'Padampur'],
    },
  },
  {
    state: 'Assam',
    labelKn: 'ಅಸ್ಸಾಂ (Assam)',
    districts: {
      'Kamrup': ['Guwahati', 'Rangia', 'Palasbari'],
      'Nagaon': ['Dhing', 'Hojai', 'Nagaon'],
      'Jorhat': ['Jorhat', 'Mariani', 'Titabor'],
    },
  },
  {
    state: 'Chhattisgarh',
    labelKn: 'ಛತ್ತೀಸ್‌ಗಢ (Chhattisgarh)',
    districts: {
      'Raipur': ['Abhanpur', 'Arang', 'Raipur', 'Tilda'],
      'Durg': ['Dhamdha', 'Durg', 'Patan'],
      'Bilaspur': ['Bilaspur', 'Kota', 'Takhatpur'],
    },
  },
  {
    state: 'Goa',
    labelKn: 'ಗೋವಾ (Goa)',
    districts: {
      'North Goa': ['Mapusa', 'Panaji', 'Ponda', 'Sanquelim'],
      'South Goa': ['Canacona', 'Margao', 'Quepem', 'Sanguem'],
    },
  },
  {
    state: 'Himachal Pradesh',
    labelKn: 'ಹಿಮಾಚಲ ಪ್ರದೇಶ (Himachal Pradesh)',
    districts: {
      'Shimla': ['Rohru', 'Shimla', 'Theog'],
      'Kullu': ['Bhuntar', 'Kullu', 'Manali'],
      'Solan': ['Arki', 'Nalagarh', 'Solan'],
    },
  },
  {
    state: 'Jharkhand',
    labelKn: 'ಜಾರ್ಖಂಡ್ (Jharkhand)',
    districts: {
      'Ranchi': ['Bundu', 'Ormanjhi', 'Ranchi'],
      'Hazaribagh': ['Barhi', 'Hazaribagh', 'Ichak'],
    },
  },
  {
    state: 'Uttarakhand',
    labelKn: 'ಉತ್ತರಾಖಂಡ (Uttarakhand)',
    districts: {
      'Dehradun': ['Dehradun', 'Rishikesh', 'Vikasnagar'],
      'Udham Singh Nagar': ['Haldwani', 'Kashipur', 'Rudrapur'],
    },
  },
  {
    state: 'NCT of Delhi',
    labelKn: 'ದೆಹಲಿ (Delhi Azadpur)',
    districts: {
      'North Delhi': ['Azadpur Mandi', 'Narela'],
      'South West Delhi': ['Najafgarh'],
    },
  },
];

export const QUICK_MARKET_HUBS = [
  { state: 'Karnataka', district: 'Bengaluru Urban', taluk: 'Yeshwanthpur APMC', labelKn: 'ಬೆಂಗಳೂರು (ಯಶವಂತಪುರ)', labelEn: 'Bengaluru (Yeshwanthpur)' },
  { state: 'Karnataka', district: 'Bengaluru Rural', taluk: 'Doddaballapura', labelKn: 'ಬೆಂಗಳೂರು ಗ್ರಾಮಾಂತರ', labelEn: 'Bengaluru Rural' },
  { state: 'Karnataka', district: 'Mandya', taluk: 'Mandya', labelKn: 'ಮಂಡ್ಯ ಎಪಿಎಂಸಿ', labelEn: 'Mandya APMC' },
  { state: 'Karnataka', district: 'Mysuru', taluk: 'Mysuru', labelKn: 'ಮೈಸೂರು ಎಪಿಎಂಸಿ', labelEn: 'Mysuru APMC' },
  { state: 'Karnataka', district: 'Kolar', taluk: 'Kolar', labelKn: 'ಕೋಲಾರ (ಟೊಮೇಟೊ)', labelEn: 'Kolar Tomato Mandi' },
  { state: 'Karnataka', district: 'Hassan', taluk: 'Hassan', labelKn: 'ಹಾಸನ ಎಪಿಎಂಸಿ', labelEn: 'Hassan APMC' },
  { state: 'Karnataka', district: 'Dharwad', taluk: 'Hubballi', labelKn: 'ಹುಬ್ಬಳ್ಳಿ-ಧಾರವಾಡ', labelEn: 'Hubballi APMC' },
  { state: 'Karnataka', district: 'Belagavi', taluk: 'Belagavi', labelKn: 'ಬೆಳಗಾವಿ ಎಪಿಎಂಸಿ', labelEn: 'Belagavi APMC' },
  { state: 'Karnataka', district: 'Shivamogga', taluk: 'Shivamogga', labelKn: 'ಶಿವಮೊಗ್ಗ (ಅಡಿಕೆ)', labelEn: 'Shivamogga (Arecanut)' },
  { state: 'Karnataka', district: 'Davanagere', taluk: 'Davanagere', labelKn: 'ದಾವಣಗೆರೆ', labelEn: 'Davanagere APMC' },
  { state: 'Karnataka', district: 'Kalaburagi', taluk: 'Kalaburagi', labelKn: 'ಕಲಬುರಗಿ (ತೊಗರಿ)', labelEn: 'Kalaburagi (Tur)' },
  { state: 'Karnataka', district: 'Dakshina Kannada', taluk: 'Mangaluru', labelKn: 'ಮಂಗಳೂರು', labelEn: 'Mangaluru' },
];

export const POPULAR_COMMODITIES = [
  { id: '', labelKn: 'ಎಲ್ಲಾ ಮಾರುಕಟ್ಟೆ ಪಟ್ಟಿ (All List)', labelEn: 'All Commodities (Full List)' },
  { id: 'Tomato', labelKn: 'ಟೊಮೇಟೊ (Tomato)', labelEn: 'Tomato' },
  { id: 'Onion', labelKn: 'ಈರುಳ್ಳಿ (Onion)', labelEn: 'Onion' },
  { id: 'Potato', labelKn: 'ಆಲೂಗಡ್ಡೆ (Potato)', labelEn: 'Potato' },
  { id: 'Ragi (Finger Millet)', labelKn: 'ರಾಗಿ (Ragi)', labelEn: 'Ragi' },
  { id: 'Paddy (Dhan)', labelKn: 'ಭತ್ತ (Paddy)', labelEn: 'Paddy / Rice' },
  { id: 'Maize', labelKn: 'ಮೆಕ್ಕೆಜೋಳ (Maize)', labelEn: 'Maize' },
  { id: 'Arecanut (Betel Nut)', labelKn: 'ಅಡಿಕೆ (Arecanut)', labelEn: 'Arecanut' },
  { id: 'Coconut', labelKn: 'ತೆಂಗು (Coconut)', labelEn: 'Coconut' },
  { id: 'Tur (Arhar / Red Gram)', labelKn: 'ತೊಗರಿ (Tur / Red Gram)', labelEn: 'Tur / Red Gram' },
  { id: 'Groundnut', labelKn: 'ಶೇಂಗಾ (Groundnut)', labelEn: 'Groundnut' },
  { id: 'Cotton', labelKn: 'ಹತ್ತಿ (Cotton)', labelEn: 'Cotton' },
  { id: 'Green Chilli', labelKn: 'ಹಸಿ ಮೆಣಸಿನಕಾಯಿ (Green Chilli)', labelEn: 'Green Chilli' },
  { id: 'Dry Chilli', labelKn: 'ಒಣ ಮೆಣಸಿನಕಾಯಿ (Dry Chilli)', labelEn: 'Dry Chilli' },
  { id: 'Banana', labelKn: 'ಬಾಳೆಹಣ್ಣು (Banana)', labelEn: 'Banana' },
  { id: 'Beans', labelKn: 'ಬೀನ್ಸ್ (Beans)', labelEn: 'Beans' },
  { id: 'Carrot', labelKn: 'ಕ್ಯಾರೆಟ್ (Carrot)', labelEn: 'Carrot' },
  { id: 'Cabbage', labelKn: 'ಎಲೆಕೋಸು (Cabbage)', labelEn: 'Cabbage' },
  { id: 'Brinjal', labelKn: 'ಬದನೆಕಾಯಿ (Brinjal)', labelEn: 'Brinjal' },
  { id: 'Turmeric', labelKn: 'ಅರಿಶಿನ (Turmeric)', labelEn: 'Turmeric' },
  { id: 'Ginger', labelKn: 'ಶುಂಠಿ (Ginger)', labelEn: 'Ginger' },
  { id: 'Coffee', labelKn: 'ಕಾಫಿ (Coffee)', labelEn: 'Coffee' },
  { id: 'Black Pepper', labelKn: 'ಕಾಳುಮೆಣಸು (Black Pepper)', labelEn: 'Black Pepper' },
];

