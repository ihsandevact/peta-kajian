export type SholatHukum = 'rukun' | 'wajib' | 'sunnah';

export interface BacaanItem {
  id: string;
  title: string;
  arabic: string;
  transliteration?: string;
  translation: string;
  narrator: string;
  note?: string;
}

export interface SifatSholatStep {
  id: string;
  stepNumber: number;
  title: string;
  slug: string;
  hukum: SholatHukum;
  hukumLabel: string;
  summary: string;
  movementDescription: string[];
  bacaanList?: BacaanItem[];
  commonMistakes?: string[];
  sunnahTips?: string[];
  hadithDalil: {
    matan?: string;
    narrator: string;
    translation: string;
  };
}

export const SIFAT_SHOLAT_CATEGORIES = [
  { id: 'all', label: 'Semua Tahapan', icon: 'format_list_numbered' },
  { id: 'rukun', label: 'Rukun & Wajib', icon: 'verified' },
  { id: 'bacaan', label: 'Kumpulan Bacaan', icon: 'menu_book' },
  { id: 'kesalahan', label: 'Koreksi Kesalahan', icon: 'error_outline' },
  { id: 'saved', label: 'Tersimpan', icon: 'bookmark' },
] as const;

export const SIFAT_SHOLAT_STEPS: SifatSholatStep[] = [
  // 1. NIAT & BERDIRI TEGAK
  {
    id: 'niat-berdiri',
    stepNumber: 1,
    title: 'Niat & Berdiri Tegak Menghadap Kiblat',
    slug: 'niat-dan-berdiri-tegak',
    hukum: 'rukun',
    hukumLabel: 'Rukun Sholat',
    summary: 'Menghadirkan niat di dalam hati tanpa dilafadzkan, berdiri tegak menghadap kiblat, dan disunnahkan menghadap sutrah.',
    movementDescription: [
      'Berdiri tegak lurus bagi yang mampu (qiyam) menghadap ke arah kiblat.',
      'Kedua kaki dibuka wajar selebar bahu, tidak terlalu renggang dan tidak terlalu rapat.',
      'Pandangan mata diarahkan ke tempat sujud dengan khusyuk dan tidak menoleh ke kiri, kanan, atau ke atas langit-langit.',
      'Niat diwajibkan dalam hati secara mantap untuk sholat yang hendak dikerjakan (tidak disyariatkan melafalkannya dengan lisan).',
      'Disunnahkan mendekat ke sutrah (pembatas di depan orang sholat seperti dinding, tiang, atau sajadah).'
    ],
    sunnahTips: [
      'Menjadikan sutrah di depan tempat sujud dengan jarak kira-kira selebar tempat lewat seekor kambing (sekitar 3 hasta).',
      'Mengikhlaskan niat semata-mata karena mengharap ridha Allah Subhanahu wa Ta\'ala.'
    ],
    commonMistakes: [
      'Melafalkan niat secara jahr (keras) atau berbisik yang tidak pernah dicontohkan oleh Rasulullah ﷺ maupun para Sahabat.',
      'Mengarahkan pandangan ke atas langit yang terdapat larangan keras dan ancaman dalam hadits.',
      'Berdiri bertumpu hanya pada satu kaki atau merenggangkan kaki secara berlebihan.'
    ],
    hadithDalil: {
      matan: 'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى',
      narrator: 'HR. Bukhari no. 1 & Muslim no. 1907',
      translation: 'Sesungguhnya setiap amalan tergantung pada niatnya, dan setiap orang akan mendapatkan balasan sesuai apa yang dia niatkan.'
    }
  },

  // 2. TAKBIRATUL IHRAM & MENGANGKAT TANGAN
  {
    id: 'takbiratul-ihram',
    stepNumber: 2,
    title: 'Takbiratul Ihram & Mengangkat Kedua Tangan',
    slug: 'takbiratul-ihram',
    hukum: 'rukun',
    hukumLabel: 'Rukun Sholat',
    summary: 'Memulai sholat dengan mengucap lafadz Allahu Akbar bersamaan dengan mengangkat kedua tangan sejajar pundak atau daun telinga.',
    movementDescription: [
      'Mengucapkan takbir: "Allahu Akbar" (hukumnya rukun sholat).',
      'Mengangkat kedua tangan sejajar dengan kedua pundak atau sejajar dengan daun telinga.',
      'Jari-jemari tangan dibentangkan lurus ke atas menghadap kiblat, tidak menggenggam dan tidak merenggangkan jari terlalu lebar.',
      'Mengangkat tangan dapat dilakukan bersamaan dengan takbir, sebelum takbir, atau sesudah takbir.'
    ],
    bacaanList: [
      {
        id: 'lafazh-takbir',
        title: 'Lafadz Takbiratul Ihram',
        arabic: 'اللهُ أَكْبَرُ',
        transliteration: 'Allahu Akbar',
        translation: 'Allah Maha Besar.',
        narrator: 'HR. Bukhari no. 735 & Muslim no. 390',
        note: 'Wajib diucapkan dengan lisan (minimal terdengar oleh diri sendiri) dan tidak sah sholat tanpa mengucapkannya.'
      }
    ],
    sunnahTips: [
      'Mengangkat tangan juga disunnahkan pada 3 tempat lainnya: saat hendak ruku\', saat bangkit dari ruku\' (i\'tidal), dan saat bangkit dari tasyahhud awal menuju rakaat ketiga.'
    ],
    commonMistakes: [
      'Mengucapkan takbir hanya dalam hati tanpa menggerakkan bibir/lisan.',
      'Menyentuhkan ibu jari ke daun telinga secara berlebihan (bukan sunnah yang tsabit).',
      'Memanjangkan huruf hamzah (Aallahu Akbar) yang mengubah makna menjadi kalimat tanya.'
    ],
    hadithDalil: {
      matan: 'مِفْتَاحُ الصَّلاَةِ الطُّهُورُ، وَتَحْرِيمُهَا التَّكْبِيرُ، وَتَحْلِيلُهَا التَّسْلِيمُ',
      narrator: 'HR. Abu Dawud no. 61 & At-Tirmidzi no. 3 (Shahih)',
      translation: 'Kunci sholat adalah bersuci, pengharamnya (dari hal di luar sholat) adalah takbir, dan penghalalnya adalah salam.'
    }
  },

  // 3. BERSEDEKAP DI DADA
  {
    id: 'bersedekap',
    stepNumber: 3,
    title: 'Bersedekap (Meletakkan Tangan di Atas Dada)',
    slug: 'bersedekap-di-dada',
    hukum: 'sunnah',
    hukumLabel: 'Sunnah Sholat',
    summary: 'Meletakkan telapak tangan kanan di atas punggung telapak tangan kiri, pergelangan, atau lengan di atas dada.',
    movementDescription: [
      'Setelah bertakbir, meletakkan tangan kanan di atas tangan kiri.',
      'Posisi sedekap diletakkan di atas dada.',
      'Cara sedekap ada dua pilihan shahih:',
      '1. Meletakkan telapak tangan kanan di atas punggung tangan kiri, pergelangan, dan lengan.',
      '2. Menggenggam pergelangan tangan kiri dengan tangan kanan.'
    ],
    sunnahTips: [
      'Tetap menjaga ketenangan (thuma\'ninah) saat bersedekap dan menundukkan pandangan ke tempat sujud.'
    ],
    commonMistakes: [
      'Meletakkan tangan di bawah pusar atau terlalu ke perut bawah (posisi yang shahih dari sunnah adalah di atas dada).',
      'Memeluk kedua lengan secara berlebihan.'
    ],
    hadithDalil: {
      matan: 'كَانَ النَّاسُ يُؤْمَرُونَ أَنْ يَضَعَ الرَّجُلُ الْيَدَ الْيُمْنَى عَلَى ذِرَاعِهِ الْيُسْرَى فِي الصَّلاَةِ',
      narrator: 'HR. Bukhari no. 740 & Muslim no. 401',
      translation: 'Dahulu para manusia diperintahkan agar seseorang meletakkan tangan kanannya di atas lengan kirinya dalam sholat.'
    }
  },

  // 4. DOA ISTIFTAH / IFTITAH
  {
    id: 'doa-istiftah',
    stepNumber: 4,
    title: 'Membaca Doa Istiftah (Iftitah)',
    slug: 'doa-istiftah',
    hukum: 'sunnah',
    hukumLabel: 'Sunnah Muakkadah',
    summary: 'Membaca salah satu doa istiftah yang shahih setelah takbiratul ihram sebelum membaca Ta\'awwudz dan Al-Fatihah.',
    movementDescription: [
      'Dibaca dengan suara lirih (sirr) baik dalam sholat sirriyah maupun jahriyah.',
      'Dibaca pada rakaat pertama saja.',
      'Boleh memilih salah satu dari riwayat shahih yang diajarkan oleh Rasulullah ﷺ.'
    ],
    bacaanList: [
      {
        id: 'istiftah-abu-hurairah',
        title: 'Doa Istiftah 1 (Paling Sering Dibaca Nabi ﷺ)',
        arabic: 'اللَّهُمَّ بَاعِدْ بَيْنِي وَبَيْنَ خَطَايَايَ كَمَا بَاعَدْتَ بَيْنَ المَشْرِقِ وَالمَغْرِبِ، اللَّهُمَّ نَقِّنِي مِنْ خَطَايَايَ كَمَا يُنَقَّى الثَّوْبُ الأَبْيَضُ مِنَ الدَّنَسِ، اللَّهُمَّ اغْسِلْنِي مِنْ خَطَايَايَ بِالثَّلْجِ وَالمَاءِ وَالبَرَدِ',
        transliteration: 'Allaahumma baa\'id baynii wa bayna khathaayaaya kamaa baa\'adta baynal-masyriqi wal-maghrib. Allaahumma naqqinii min khathaayaaya kamaa yunaqqats-tsawbul-abyadhu minad-danas. Allaahummaghsilnii min khathaayaaya bits-tsalji wal-maa-i wal-barad.',
        translation: 'Ya Allah, jauhkanlah antara diriku dan kesalahan-kesalahanku sebagaimana Engkau menjauhkan antara timur dan barat. Ya Allah, bersihkanlah aku dari kesalahan-kesalahanku sebagaimana dibersihkannya pakaian putih dari noda kotoran. Ya Allah, sucikanlah aku dari kesalahan-kesalahanku dengan salju, air, dan embun es.',
        narrator: 'HR. Bukhari no. 744 & Muslim no. 598'
      },
      {
        id: 'istiftah-umar',
        title: 'Doa Istiftah 2 (Riwayat Sahabat Umar bin Khaththab)',
        arabic: 'سُبْحَانَكَ اللَّهُمَّ وَبِحَمْدِكَ، وَتَبَارَكَ اسْمُكَ، وَتَعَالَى جَدُّكَ، وَلاَ إِلَهَ غَيْرُكَ',
        transliteration: 'Subhaanakallaahumma wa bihamdika, wa tabaarakasmuka, wa ta\'aalaa jadduka, wa laa ilaaha ghayruk.',
        translation: 'Maha Suci Engkau ya Allah, dan dengan memuji-Mu. Maha Berkah nama-Mu, Maha Luhur kemuliaan-Mu, dan tidak ada sesembahan yang berhak disembah selain Engkau.',
        narrator: 'HR. Muslim no. 399 & Abu Dawud no. 775 (Shahih)'
      },
      {
        id: 'istiftah-ali',
        title: 'Doa Istiftah 3 (Sering Dibaca saat Sholat Malam)',
        arabic: 'وَجَّهْتُ وَجْهِيَ لِلَّذِي فَطَرَ السَّمَاوَاتِ وَالأَرْضَ حَنِيفًا وَمَا أَنَا مِنَ الْمُشْرِكِينَ، إِنَّ صَلاَتِي وَنُسُكِي وَمَحْيَايَ وَمَمَاتِي لِلَّهِ رَبِّ الْعَالَمِينَ، لاَ شَرِيكَ لَهُ وَبِذَلِكَ أُمِرْتُ وَأَنَا مِنَ الْمُسْلِمِينَ',
        transliteration: 'Wajjahtu wajhiya lilladzii fatharas-samaawaati wal-ardha haniifaw-wamaa ana minal-musyrikiin. Inna shalaatii wa nusukii wa mahyaaya wa mamaatii lillaahi rabbil-\'aalamiin. Laa syariika lahu wa bidzaalika umirtu wa ana minal-muslimiin.',
        translation: 'Aku hadapkan wajahku kepada Dzat yang menciptakan langit dan bumi dengan lurus dan berserah diri, dan aku bukanlah termasuk orang-orang musyrik. Sesungguhnya sholatku, ibadah sembelihanku, hidupku, dan matiku semata-mata kepunyaan Allah Rabb semesta alam. Tidak ada sekutu bagi-Nya dan dengan demikianlah aku diperintahkan dan aku termasuk orang-orang yang berserah diri.',
        narrator: 'HR. Muslim no. 771'
      }
    ],
    commonMistakes: [
      'Menggabungkan semua doa istiftah dalam satu rakaat (sunnahnya adalah membaca salah satu riwayat secara bergantian di waktu sholat yang berbeda).',
      'Membaca istiftah dengan suara keras saat sholat berjamaah.'
    ],
    hadithDalil: {
      matan: 'سَأَلْتُ رَسُولَ اللَّهِ ﷺ: أَرَأَيْتَ سُكُوتَكَ بَيْنَ التَّكْبِيرِ وَالقِرَاءَةِ، مَا تَقُولُ؟ قَالَ: أَقُولُ: اللَّهُمَّ بَاعِدْ...',
      narrator: 'HR. Bukhari no. 744 (Shahih)',
      translation: 'Abu Hurairah radhiyallahu \'anhu bertanya kepada Rasulullah ﷺ tentang apa yang beliau baca saat diam sejenak antara takbir dan membaca Al-Fatihah, lalu beliau ﷺ menyebutkan doa Allahumma baa\'id...'
    }
  },

  // 5. TA'AWWUDZ, BASMALAH, AL-FATIHAH & AAMIIN
  {
    id: 'fatihah-aamiin',
    stepNumber: 5,
    title: 'Ta\'awwudz, Basmalah, Surah Al-Fatihah & Aamiin',
    slug: 'al-fatihah-dan-aamiin',
    hukum: 'rukun',
    hukumLabel: 'Rukun Sholat',
    summary: 'Membaca Ta\'awwudz, Basmalah, dan Surah Al-Fatihah secara tertib dan tartil, diakhiri dengan ucapan Aamiin.',
    movementDescription: [
      'Membaca isti\'adzah (Ta\'awwudz) untuk memohon perlindungan dari godaan setan: "A\'uudzu billaahi minasy-syaithaanir-rajiim".',
      'Membaca Basmalah secara sirr (lirih): "Bismillaahir-rahmaanir-rahiim".',
      'Membaca Surah Al-Fatihah ayat demi ayat dengan berhenti (waqaf) pada setiap akhir ayat.',
      'Membaca Al-Fatihah merupakan rukun sholat pada setiap rakaat.',
      'Mengucapkan "Aamiin" setelah selesai membaca ayat terakhir Al-Fatihah. Dalam sholat jahriyah (Subuh, Maghrib, Isya), imam dan makmum mengeraskan ucapan Aamiin secara bersamaan.'
    ],
    bacaanList: [
      {
        id: 'taawwudz',
        title: 'Lafadz Isti\'adzah (Ta\'awwudz)',
        arabic: 'أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ',
        transliteration: 'A\'uudzu billaahi minasy-syaithaanir-rajiim.',
        translation: 'Aku berlindung kepada Allah dari godaan setan yang terkutuk.',
        narrator: 'HR. Abu Dawud no. 764 & At-Tirmidzi no. 242'
      },
      {
        id: 'lafazh-aamiin',
        title: 'Lafadz Aamiin',
        arabic: 'آمِينَ',
        transliteration: 'Aamiin',
        translation: 'Kabulkanlah doa kami ya Allah.',
        narrator: 'HR. Bukhari no. 780 & Muslim no. 410',
        note: 'Dibaca dengan memanjangkan huruf alif (aa) dan mim (miin).'
      }
    ],
    sunnahTips: [
      'Membaca Al-Fatihah secara tartil dan merenungi maknanya.',
      'Bagi makmum, mengucapkan Aamiin bersamaan dengan ucapan Aamiin sang imam agar malaikat turut mengaminkannya.'
    ],
    commonMistakes: [
      'Membaca Al-Fatihah terburu-buru tanpa waqaf di setiap ujung ayat.',
      'Mendahului ucapan Aamiin imam atau melafalkan Aamiin terlalu cepat/terputus.',
      'Tidak membaca Al-Fatihah sama sekali dalam sholat sendirian.'
    ],
    hadithDalil: {
      matan: 'لاَ صَلاَةَ لِمَنْ لَمْ يَقْرَأْ بِفَاتِحَةِ الْكِتَابِ',
      narrator: 'HR. Bukhari no. 756 & Muslim no. 394',
      translation: 'Tidak ada sholat (tidak sah) bagi orang yang tidak membaca pembuka Kitab (Surah Al-Fatihah).'
    }
  },

  // 6. MEMBACA AYAT / SURAH AL-QUR'AN
  {
    id: 'baca-surah',
    stepNumber: 6,
    title: 'Membaca Surah atau Ayat Al-Qur\'an',
    slug: 'membaca-surah-setelah-fatihah',
    hukum: 'sunnah',
    hukumLabel: 'Sunnah Sholat',
    summary: 'Disunnahkan membaca surah utuh atau sebagian ayat Al-Qur\'an setelah Al-Fatihah pada rakaat pertama dan kedua.',
    movementDescription: [
      'Membaca satu surah utuh atau ayat Al-Qur\'an setelah Al-Fatihah.',
      'Dilakukan pada rakaat pertama dan kedua sholat fardhu maupun sunnah.',
      'Pada rakaat ketiga dan keempat, umumnya cukup membaca Al-Fatihah saja.',
      'Dibaca dengan suara keras (jahr) pada rakaat 1 & 2 sholat Subuh, Maghrib, Isya, dan sholat Jum\'at/Hari Raya.',
      'Dibaca lirih (sirr) pada sholat Dzuhur dan Ashar.'
    ],
    sunnahTips: [
      'Disunnahkan membaca surah yang lebih panjang pada rakaat pertama dibanding rakaat kedua.',
      'Membaca surah secara tartil dengan tajwid yang benar.'
    ],
    commonMistakes: [
      'Membaca surah pada rakaat kedua jauh lebih panjang daripada rakaat pertama.',
      'Membaca surah dengan sangat tergesa-gesa tanpa memperhatikan waqaf dan makharijul huruf.'
    ],
    hadithDalil: {
      matan: 'كَانَ النَّبِيُّ ﷺ يَقْرَأُ فِي الظُّهْرِ فِي الأُولَيَيْنِ بِأُمِّ الكِتَابِ وَسُورَتَيْنِ، وَفِي الأُخْرَيَيْنِ بِأُمِّ الكِتَابِ',
      narrator: 'HR. Bukhari no. 776 & Muslim no. 451',
      translation: 'Nabi ﷺ membaca pada dua rakaat pertama sholat Dzuhur dengan Ummul Kitab (Al-Fatihah) dan dua surah, serta pada dua rakaat terakhir hanya dengan Ummul Kitab.'
    }
  },

  // 7. RUKU' & THUMA'NINAH
  {
    id: 'ruku',
    stepNumber: 7,
    title: 'Ruku\' & Thuma\'ninah',
    slug: 'ruku-dan-thumaninah',
    hukum: 'rukun',
    hukumLabel: 'Rukun Sholat',
    summary: 'Membungkukkan badan dengan meratakan punggung, mencengkeram lutut dengan kedua tangan, dan tenang (thuma\'ninah).',
    movementDescription: [
      'Bertakbir intiqal (Allahu Akbar) sambil mengangkat kedua tangan sejajar pundak atau daun telinga.',
      'Membungkukkan badan hingga punggung rata horizontal (jika ditaruh bejana berisi air di atasnya, niscaya tidak akan tumpah).',
      'Kepala lurus sejajar punggung, tidak mendongak ke atas dan tidak terlalu menunduk.',
      'Kedua tangan memegang kedua lutut dengan jari-jemari meregang seakan-akan mencengkeramnya.',
      'Kedua siku dijauhkan dari lambung dan kedua lengan direnggangkan lurus.',
      'Wajib thuma\'ninah (tenang sejenak sampai seluruh persendian kembali mapan) sambil membaca tasbih ruku\'.'
    ],
    bacaanList: [
      {
        id: 'tasbih-ruku-1',
        title: 'Bacaan Ruku\' 1 (Paling Utama, dibaca 3x atau lebih)',
        arabic: 'سُبْحَانَ رَبِّيَ الْعَظِيمِ',
        transliteration: 'Subhaana rabbiyal-\'azhiim.',
        translation: 'Maha Suci Rabbku Yang Maha Agung.',
        narrator: 'HR. Muslim no. 772 & Abu Dawud no. 871',
        note: 'Disunnahkan dibaca 3 kali atau lebih dalam jumlah ganjil.'
      },
      {
        id: 'tasbih-ruku-2',
        title: 'Bacaan Ruku\' 2 (Lengkap dengan Bihamdih)',
        arabic: 'سُبْحَانَ رَبِّيَ الْعَظِيمِ وَبِحَمْدِهِ',
        transliteration: 'Subhaana rabbiyal-\'azhiimi wa bihamdih.',
        translation: 'Maha Suci Rabbku Yang Maha Agung dan dengan segala puji bagi-Nya.',
        narrator: 'HR. Abu Dawud no. 870 & Ahmad (Shahih)'
      },
      {
        id: 'tasbih-ruku-3',
        title: 'Bacaan Ruku\' & Sujud Riwayat Aisyah',
        arabic: 'سُبْحَانَكَ اللَّهُمَّ رَبَّنَا وَبِحَمْدِكَ، اللَّهُمَّ اغْفِرْ لِي',
        transliteration: 'Subhaanakallaahumma rabbanaa wa bihamdika, allaahummaghfir lii.',
        translation: 'Maha Suci Engkau ya Allah Rabb kami, dan dengan memuji-Mu. Ya Allah, ampunilah dosaku.',
        narrator: 'HR. Bukhari no. 794 & Muslim no. 484'
      }
    ],
    sunnahTips: [
      'Menjaga ketenangan dan kekhusyukan saat ruku\' tanpa terburu-buru bangkit.',
      'Memperbanyak pengagungan terhadap Allah Subhanahu wa Ta\'ala.'
    ],
    commonMistakes: [
      'Punggung melengkung ke atas atau membungkuk setengah-setengah seperti mematuk.',
      'Kedua tangan diletakkan di paha bukan memegang lutut.',
      'Tidak thuma\'ninah (langsung bangkit sebelum anggota tubuh diam sempurna).'
    ],
    hadithDalil: {
      matan: 'ثُمَّ ارْكَعْ حَتَّى تَطْمَئِنَّ رَاكِعًا',
      narrator: 'HR. Bukhari no. 757 & Muslim no. 397 (Hadits Orang yang Buruk Sholatnya)',
      translation: 'Kemudian ruku\'lah hingga engkau thuma\'ninah (tenang sempurna) dalam keadaan ruku\'.'
    }
  },

  // 8. I'TIDAL & THUMA'NINAH
  {
    id: 'itidal',
    stepNumber: 8,
    title: 'Bangkit dari Ruku\' (I\'tidal) & Thuma\'ninah',
    slug: 'itidal-dan-thumaninah',
    hukum: 'rukun',
    hukumLabel: 'Rukun Sholat',
    summary: 'Bangkit berdiri tegak lurus dari ruku\' sambil membaca tasmi\', dilanjutkan tahmid dengan tenang (thuma\'ninah).',
    movementDescription: [
      'Bangkit dari ruku\' seraya mengangkat kedua tangan sejajar pundak atau daun telinga sambil mengucapkan: "Sami\'allaahu liman hamidah" (bagi imam dan sholat sendiri).',
      'Makmum mengucapkan: "Rabbanaa wa lakal hamd" saat bangkit mendengar tasmi\' imam.',
      'Berdiri tegak lurus hingga setiap tulang dan persendian kembali ke posisinya semula.',
      'Wajib thuma\'ninah (tidak terburu-buru turun sujud sebelum tegak sempurna).',
      'Kedua tangan dibiarkan lurus ke bawah (atau bersedekap kembali menurut sebagian ulama, namun meluruskan tangan adalah pendapat mayoritas).'
    ],
    bacaanList: [
      {
        id: 'tasmi-itidal',
        title: 'Lafadz Tasmi\' (Saat Bangkit)',
        arabic: 'سَمِعَ اللَّهُ لِمَنْ حَمِدَهُ',
        transliteration: 'Sami\'allaahu liman hamidah.',
        translation: 'Allah Maha Mendengar siapa saja yang memuji-Nya.',
        narrator: 'HR. Bukhari no. 795 & Muslim no. 404'
      },
      {
        id: 'tahmid-itidal-1',
        title: 'Lafadz Tahmid 1 (Ringkas & Paling Populer)',
        arabic: 'رَبَّنَا وَلَكَ الْحَمْدُ',
        transliteration: 'Rabbanaa wa lakal-hamd.',
        translation: 'Wahai Rabb kami, bagi-Mu lah segala puji.',
        narrator: 'HR. Bukhari no. 796 & Muslim no. 409'
      },
      {
        id: 'tahmid-itidal-2',
        title: 'Lafadz Tahmid 2 (Lengkap Penuh Berkah)',
        arabic: 'رَبَّنَا وَلَكَ الْحَمْدُ، حَمْدًا كَثِيرًا طَيِّبًا مُبَارَكًا فِيهِ',
        transliteration: 'Rabbanaa wa lakal-hamd, hamdan katsiiran thayyiban mubaarakan fiih.',
        translation: 'Wahai Rabb kami, bagi-Mu lah segala pujian, pujian yang banyak, baik, lagi penuh berkah di dalamnya.',
        narrator: 'HR. Bukhari no. 799 (Lebih dari 30 malaikat berebut mencatat pahalanya)'
      }
    ],
    sunnahTips: [
      'Menikmati berdiri tegak dengan thuma\'ninah yang seimbang lamanya dengan waktu ruku\'.'
    ],
    commonMistakes: [
      'Turun langsung sujud sebelum tubuh tegak lurus sempurna.',
      'Makmum mengucapkan "Sami\'allahu liman hamidah" mendahului imam.'
    ],
    hadithDalil: {
      matan: 'لاَ يَنْظُرُ اللَّهُ إِلَى صَلاَةِ رَجُلٍ لاَ يُقِيمُ صُلْبَهُ بَيْنَ رُكُوعِهِ وَسُجُودِهِ',
      narrator: 'HR. Ahmad & Ibnu Majah no. 870 (Shahih)',
      translation: 'Allah tidak akan memandang sholat seorang hamba yang tidak menegakkan tulang punggungnya di antara ruku\' dan sujudnya.'
    }
  },

  // 9. TURUN SUJUD & SUJUD PERTAMA
  {
    id: 'sujud',
    stepNumber: 9,
    title: 'Sujud Pertama di Atas 7 Anggota Sujud',
    slug: 'sujud-pertama',
    hukum: 'rukun',
    hukumLabel: 'Rukun Sholat',
    summary: 'Turun bersujud dengan takbir intiqal, menempelkan 7 anggota badan di lantai, dan thuma\'ninah.',
    movementDescription: [
      'Turun bersujud dengan mengucap takbir "Allahu Akbar" (tanpa mengangkat tangan).',
      'Turun sujud mendahulukan kedua tangan sebelum lutut (atau lutut sebelum tangan, keduanya memiliki sandaran pendapat ulama yang mu\'tabar, mendahulukan tangan adalah pendapat yang dikuatkan Syaikh Al-Albani).',
      'Wajib menempelkan 7 anggota sujud ke lantai:',
      '  1. Kening dan hidung (satu kesatuan).',
      '  2 & 3. Kedua telapak tangan.',
      '  4 & 5. Kedua lutut.',
      '  6 & 7. Ujung-ujung jari kedua kaki.',
      'Kedua telapak tangan diletakkan sejajar pundak atau daun telinga, jari-jemari dirapatkan menghadap kiblat.',
      'Kedua siku diangkat dan direnggangkan dari lambung (tidak menempel di lantai seperti anjing duduk).',
      'Kedua tumit dirapatkan dan ujung jari kaki ditekuk menghadap kiblat.',
      'Wajib thuma\'ninah dan memperbanyak doa saat sujud.'
    ],
    bacaanList: [
      {
        id: 'tasbih-sujud-1',
        title: 'Tasbih Sujud 1 (Paling Utama, dibaca 3x atau lebih)',
        arabic: 'سُبْحَانَ رَبِّيَ الأَعْلَى',
        transliteration: 'Subhaana rabbiyal-a\'laa.',
        translation: 'Maha Suci Rabbku Yang Maha Tinggi.',
        narrator: 'HR. Muslim no. 772 & Abu Dawud no. 871',
        note: 'Disunnahkan dibaca minimal 3 kali.'
      },
      {
        id: 'tasbih-sujud-2',
        title: 'Tasbih Sujud 2 (Lengkap dengan Bihamdih)',
        arabic: 'سُبْحَانَ رَبِّيَ الأَعْلَى وَبِحَمْدِهِ',
        transliteration: 'Subhaana rabbiyal-a\'laa wa bihamdih.',
        translation: 'Maha Suci Rabbku Yang Maha Tinggi dan dengan memuji-Nya.',
        narrator: 'HR. Abu Dawud no. 870 (Shahih)'
      },
      {
        id: 'tasbih-sujud-3',
        title: 'Tasbih Sujud 3 (Subbuhun Quddus)',
        arabic: 'سُبُّوحٌ قُدُّوسٌ، رَبُّ الْمَلاَئِكَةِ وَالرُّوحِ',
        transliteration: 'Subbuuhun qudduusun, rabbul-malaa-ikati war-ruuh.',
        translation: 'Maha Suci lagi Maha Mulia, Rabb para malaikat dan malaikat Jibril.',
        narrator: 'HR. Muslim no. 487'
      }
    ],
    sunnahTips: [
      'Memperbanyak doa kebaikan dunia dan akhirat saat sujud, karena sujud adalah kondisi terdekat seorang hamba dengan Allah.'
    ],
    commonMistakes: [
      'Hidung tidak menempel ke lantai (hanya kening saja).',
      'Meletakkan kedua siku/lengan bawah menempel di lantai seperti anjing (larangan keras dari Nabi ﷺ).',
      'Mengangkat salah satu kaki dari lantai saat sujud sehingga anggota sujud tidak lengkap 7.',
      'Membaca ayat Al-Qur\'an saat sujud (dilarang membaca Al-Qur\'an ketika ruku\' dan sujud).'
    ],
    hadithDalil: {
      matan: 'أُمِرْتُ أَنْ أَسْجُدَ عَلَى سَبْعَةِ أَعْظُمٍ: عَلَى الْجَبْهَةِ - وَأَشَارَ بِيَدِهِ عَلَى أَنْفِهِ - وَالْيَدَيْنِ، وَالرُّكْبَتَيْنِ، وَأَطْرَافِ الْقَدَمَيْنِ',
      narrator: 'HR. Bukhari no. 812 & Muslim no. 490',
      translation: 'Aku diperintahkan untuk bersujud di atas 7 tulang: pada dahi (dan beliau mengisyaratkan tangannya ke hidung), kedua tangan, kedua lutut, dan ujung-ujung kedua jari kaki.'
    }
  },

  // 10. DUDUK DI ANTARA DUA SUJUD
  {
    id: 'duduk-antara-dua-sujud',
    stepNumber: 10,
    title: 'Duduk di Antara Dua Sujud (Duduk Iftirasy)',
    slug: 'duduk-antara-dua-sujud',
    hukum: 'rukun',
    hukumLabel: 'Rukun Sholat',
    summary: 'Bangkit dari sujud dengan takbir, duduk iftirasy dengan tenang (thuma\'ninah) sambil memohon ampunan.',
    movementDescription: [
      'Bangkit dari sujud dengan takbir "Allahu Akbar".',
      'Duduk iftirasy: membentangkan punggung kaki kiri lalu mendudukinya, sedangkan kaki kanan ditegakkan dengan jari-jari menghadap kiblat.',
      'Kedua tangan diletakkan di atas kedua paha atau lutut.',
      'Punggung tegak lurus dan wajib thuma\'ninah.',
      'Boleh sesekali melakukan duduk iq\'a\' yang syar\'i (menegakkan kedua tumit lalu menduduki kedua tumit dengan jari-jari kaki menghadap kiblat) di antara dua sujud.'
    ],
    bacaanList: [
      {
        id: 'doa-duduk-1',
        title: 'Doa Duduk 1 (Paling Ringkas & Sering Dibaca)',
        arabic: 'رَبِّ اغْفِرْ لِي، رَبِّ اغْفِرْ لِي',
        transliteration: 'Rabbighfir lii, rabbighfir lii.',
        translation: 'Wahai Rabbku ampunilah aku, wahai Rabbku ampunilah aku.',
        narrator: 'HR. Abu Dawud no. 874 & Ibnu Majah no. 897 (Shahih)'
      },
      {
        id: 'doa-duduk-2',
        title: 'Doa Duduk 2 (Lengkap)',
        arabic: 'اللَّهُمَّ اغْفِرْ لِي، وَارْحَمْنِي، وَاهْدِنِي، وَاجْبُرْنِي، وَعَافِنِي، وَارْزُقْنِي، وَارْفَعْنِي',
        transliteration: 'Allaahummaghfir lii, warhamnii, wahdinii, wajburnii, wa\'aafinii, warzuqnii, warfa\'nii.',
        translation: 'Ya Allah ampunilah dosaku, kasihanilah aku, berilah aku petunjuk, cukupkanlah kekuranganku, berilah aku kesehatan, limpahkanlah rezeki kepadaku, dan tinggikanlah derajatku.',
        narrator: 'HR. Abu Dawud no. 850 & At-Tirmidzi no. 284 (Shahih)'
      }
    ],
    commonMistakes: [
      'Duduk terlalu singkat tanpa thuma\'ninah (seperti burung mematuk biji-bijian).',
      'Duduk melipat kedua kaki ke arah yang tidak sesuai sunnah.'
    ],
    hadithDalil: {
      matan: 'ثُمَّ ارْفَعْ حَتَّى تَطْمَئِنَّ جَالِسًا',
      narrator: 'HR. Bukhari no. 757 & Muslim no. 397',
      translation: 'Kemudian bangkitlah hingga engkau thuma\'ninah (tenang sempurna) dalam keadaan duduk.'
    }
  },

  // 11. SUJUD KEDUA & DUDUK ISTIRAHAT
  {
    id: 'sujud-kedua',
    stepNumber: 11,
    title: 'Sujud Kedua & Duduk Istirahat Sejenak',
    slug: 'sujud-kedua-dan-istirahat',
    hukum: 'rukun',
    hukumLabel: 'Rukun Sholat',
    summary: 'Melakukan sujud kedua persis seperti sujud pertama, lalu duduk istirahat sejenak sebelum bangkit.',
    movementDescription: [
      'Bertakbir "Allahu Akbar" lalu turun melakukan sujud kedua persis seperti tata cara dan bacaan sujud pertama.',
      'Wajib thuma\'ninah dan menempelkan 7 anggota sujud.',
      'Setelah sujud kedua selesai, bertakbir untuk bangkit.',
      'Disunnahkan duduk istirahat sejenak (duduk iftirasy ringan) sebelum berdiri tegak menuju rakaat berikutnya.'
    ],
    sunnahTips: [
      'Duduk istirahat sejenak tidak ada bacaan khusus, tujuannya untuk mengembalikan keseimbangan tubuh sebelum bangkit berdiri.'
    ],
    commonMistakes: [
      'Melompat berdiri langsung dari sujud tanpa thuma\'ninah.'
    ],
    hadithDalil: {
      matan: 'فَإِذَا رَفَعَ رَأْسَهُ عَنِ السَّجْدَةِ الثَّانِيَةِ اسْتَوَى قَاعِدًا ثُمَّ نَهَضَ',
      narrator: 'HR. Bukhari no. 823 (Dari Malik bin Al-Huwairits)',
      translation: 'Apabila beliau ﷺ mengangkat kepalanya dari sujud yang kedua, beliau duduk tegak sejenak lalu bangkit berdiri.'
    }
  },

  // 12. BANGKIT KE RAKAAT BERIKUTNYA
  {
    id: 'bangkit-rakaat',
    stepNumber: 12,
    title: 'Bangkit ke Rakaat Berikutnya',
    slug: 'bangkit-ke-rakaat-berikutnya',
    hukum: 'sunnah',
    hukumLabel: 'Sunnah Sholat',
    summary: 'Bangkit berdiri dengan bertumpu pada kedua tangan di atas lantai.',
    movementDescription: [
      'Setelah duduk istirahat sejenak, bangkit berdiri menuju rakaat kedua/ketiga/keempat.',
      'Disunnahkan bangkit dengan bertumpu pada kedua tangan di atas lantai (sebagaimana pembuat adonan roti bertumpu).',
      'Mengerjakan rakaat berikutnya sama persis seperti rakaat pertama, kecuali tidak ada doa istiftah lagi.'
    ],
    hadithDalil: {
      matan: 'ثُمَّ اعْتَمَدَ عَلَى الأَرْضِ ثُمَّ قَامَ',
      narrator: 'HR. Bukhari no. 824',
      translation: 'Kemudian beliau ﷺ bertumpu pada lantai (dengan kedua tangannya) lalu bangkit berdiri.'
    }
  },

  // 13. TASYAHHUD AWAL
  {
    id: 'tasyahhud-awal',
    stepNumber: 13,
    title: 'Tasyahhud Awal & Isyarat Telunjuk',
    slug: 'tasyahhud-awal',
    hukum: 'wajib',
    hukumLabel: 'Wajib Sholat',
    summary: 'Duduk iftirasy pada rakaat kedua sholat 3 atau 4 rakaat, berisyarat dengan jari telunjuk, membaca tasyahhud dan shalawat.',
    movementDescription: [
      'Dilakukan setelah menyelesaikan sujud kedua pada rakaat kedua.',
      'Duduk iftirasy: menduduki kaki kiri dan menegakkan kaki kanan.',
      'Meletakkan tangan kiri terbuka di atas paha/lutut kiri.',
      'Meletakkan tangan kanan di atas paha/lutut kanan, dengan menggenggam jari kelingking, manis, dan tengah, lalu melingkarkan ibu jari dengan jari tengah (atau membentuk angka 53).',
      'Mengacungkan jari telunjuk kanan ke arah kiblat sejak awal tasyahhud dan menggerak-gerakkannya secara perlahan saat berdoa, dengan pandangan mata tertuju ke jari telunjuk.',
      'Membaca bacaan tasyahhud (Attahiyyaat) dan disunnahkan membaca shalawat nabi.'
    ],
    bacaanList: [
      {
        id: 'tasyahhud-ibnu-masud',
        title: 'Bacaan Tasyahhud Riwayat Ibnu Mas\'ud (Paling Shahih & Utama)',
        arabic: 'التَّحِيَّاتُ لِلَّهِ وَالصَّلَوَاتُ وَالطَّيِّبَاتُ، السَّلاَمُ عَلَيْكَ أَيُّهَا النَّبِيُّ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ، السَّلاَمُ عَلَيْنَا وَعَلَى عِبَادِ اللَّهِ الصَّالِحِينَ، أَشْهَدُ أَنْ لاَ إِلَهَ إِلاَّ اللَّهُ وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ',
        transliteration: 'At-tahiyyaatu lillaahi wash-shalawaatu wath-thayyibaat. As-salaamu \'alayka ayyuhan-nabiyyu wa rahmatullaahi wa barakaatuh. As-salaamu \'alaynaa wa \'alaa \'ibaadillaahish-shaalihiin. Asyhadu allaa ilaaha illallaah, wa asyhadu anna Muhammadan \'abduhu wa rasuuluh.',
        translation: 'Segala kehormatan, keselamatan, dan kebaikan hanyalah milik Allah. Semoga keselamatan, rahmat Allah, dan berkah-Nya tercurah kepadamu wahai Nabi. Semoga keselamatan tercurah pula kepada kami dan kepada hamba-hamba Allah yang shalih. Aku bersaksi bahwa tidak ada sesembahan yang berhak disembah selain Allah, dan aku bersaksi bahwa Muhammad adalah hamba dan utusan-Nya.',
        narrator: 'HR. Bukhari no. 831 & Muslim no. 402'
      },
      {
        id: 'shalawat-pendek',
        title: 'Lafadz Shalawat Nabi pada Tasyahhud Awal',
        arabic: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ',
        transliteration: 'Allaahumma shalli \'alaa Muhammad wa \'alaa aali Muhammad.',
        translation: 'Ya Allah, berilah shalawat kepada Nabi Muhammad dan kepada keluarga Nabi Muhammad.',
        narrator: 'HR. Bukhari no. 3370 & Muslim no. 406'
      }
    ],
    sunnahTips: [
      'Mengarahkan pandangan mata tidak lepas dari isyarat jari telunjuk kanan selama membaca tasyahhud.'
    ],
    commonMistakes: [
      'Menolehkan pandangan ke kiri-kanan atau melihat ke langit saat tasyahhud.',
      'Menggerakkan jari telunjuk berputar-putar seperti kipas angin (yang sunnah adalah menggerakkannya naik turun lembut ke arah kiblat saat berdoa).'
    ],
    hadithDalil: {
      matan: 'كَانَ رَسُولُ اللَّهِ ﷺ إِذَا قَعَدَ فِي التَّشَهُّدِ وَضَعَ كَفَّهُ الْيُمْنَى عَلَى فَخِذِهِ الْيُمْنَى وَقَبَضَ أَصَابِعَهُ كُلَّهَا، وَأَشَارَ بِإِصْبَعِهِ السَّبَّاحَةِ',
      narrator: 'HR. Muslim no. 580',
      translation: 'Rasulullah ﷺ apabila duduk tasyahhud meletakkan telapak tangan kanannya di atas paha kanannya, menggenggam seluruh jarinya, dan berisyarat dengan jari telunjuknya.'
    }
  },

  // 14. TASYAHHUD AKHIR
  {
    id: 'tasyahhud-akhir',
    stepNumber: 14,
    title: 'Tasyahhud Akhir & Duduk Tawarruk',
    slug: 'tasyahhud-akhir-dan-tawarruk',
    hukum: 'rukun',
    hukumLabel: 'Rukun Sholat',
    summary: 'Duduk tawarruk pada rakaat terakhir sholat 3 atau 4 rakaat, membaca tasyahhud, Shalawat Ibrahimiyah, dan doa perlindungan dari 4 fitnah.',
    movementDescription: [
      'Duduk tawarruk (pada sholat 3 atau 4 rakaat seperti Maghrib, Isya, Dzuhur, Ashar): memasukkan kaki kiri di bawah betis/paha kanan dan pantat kiri duduk langsung menempel ke lantai, sedangkan kaki kanan ditegakkan.',
      'Untuk sholat yang hanya 2 rakaat (seperti sholat Subuh atau sholat sunnah), duduknya tetap duduk iftirasy.',
      'Posisi tangan dan isyarat telunjuk sama persis dengan tasyahhud awal.',
      'Membaca bacaan tasyahhud, dilanjutkan Shalawat Ibrahimiyah yang sempurna.',
      'Disunnahkan membaca doa memohon perlindungan dari 4 fitnah sebelum salam.'
    ],
    bacaanList: [
      {
        id: 'shalawat-ibrahimiyah',
        title: 'Shalawat Ibrahimiyah (Lafadz Paling Utama & Shahih)',
        arabic: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ، كَمَا صَلَّيْتَ عَلَى إِبْرَاهِيمَ وَعَلَى آلِ إِبْرَاهِيمَ، إِنَّكَ حَمِيدٌ مَجِيدٌ. اللَّهُمَّ بَارِكْ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ، كَمَا بَارَكْتَ عَلَى إِبْرَاهِيمَ وَعَلَى آلِ إِبْرَاهِيمَ، إِنَّكَ حَمِيدٌ مَجِيدٌ',
        transliteration: 'Allaahumma shalli \'alaa Muhammad wa \'alaa aali Muhammad, kamaa shallayta \'alaa Ibraahiim wa \'alaa aali Ibraahiim, innaka hamiidum-majiid. Allaahumma baarik \'alaa Muhammad wa \'alaa aali Muhammad, kamaa baarakta \'alaa Ibraahiim wa \'alaa aali Ibraahiim, innaka hamiidum-majiid.',
        translation: 'Ya Allah, berilah shalawat kepada Muhammad dan kepada keluarga Muhammad, sebagaimana Engkau telah memberi shalawat kepada Ibrahim dan kepada keluarga Ibrahim, sesungguhnya Engkau Maha Terpuji lagi Maha Mulia. Ya Allah, berkahilah Muhammad dan keluarga Muhammad, sebagaimana Engkau telah memberkahi Ibrahim dan keluarga Ibrahim, sesungguhnya Engkau Maha Terpuji lagi Maha Mulia.',
        narrator: 'HR. Bukhari no. 3370 & Muslim no. 406'
      },
      {
        id: 'doa-empat-fitnah',
        title: 'Doa Perlindungan dari 4 Perkara Sebelum Salam',
        arabic: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنْ عَذَابِ جَهَنَّمَ، وَمِنْ عَذَابِ الْقَبْرِ، وَمِنْ فِتْنَةِ الْمَحْيَا وَالْمَمَاتِ، وَمِنْ شَرِّ فِتْنَةِ الْمَسِيحِ الدَّجَّالِ',
        transliteration: 'Allaahumma innii a\'uudzu bika min \'adzaabi jahannam, wa min \'adzaabil-qabr, wa min fitnatil-mahyaa wal-mamaat, wa min syarri fitnatil-masiihid-dajjaal.',
        translation: 'Ya Allah, sesungguhnya aku berlindung kepada-Mu dari adzab neraka Jahannam, dari adzab kubur, dari fitnah kehidupan dan kematian, serta dari keburukan fitnah Al-Masih Ad-Dajjal.',
        narrator: 'HR. Bukhari no. 1377 & Muslim no. 588',
        note: 'Sebagian ulama mewajibkan membaca doa ini karena Rasulullah ﷺ memberi perintah yang sangat tegas.'
      }
    ],
    sunnahTips: [
      'Memperbanyak doa kebaikan sebelum salam setelah membaca doa perlindungan dari 4 perkara di atas.'
    ],
    commonMistakes: [
      'Membaca shalawat yang tidak bersumber dari hadits shahih atau menambah lafadz yang tidak diajarkan Nabi ﷺ.',
      'Langsung salam tanpa membaca doa perlindungan dari empat fitnah.'
    ],
    hadithDalil: {
      matan: 'إِذَا فَرَغَ أَحَدُكُمْ مِنَ التَّشَهُّدِ الآخِرِ، فَلْيَتَعَوَّذْ بِاللَّهِ مِنْ أَرْبَعٍ: مِنْ عَذَابِ جَهَنَّمَ...',
      narrator: 'HR. Muslim no. 588',
      translation: 'Apabila salah seorang di antara kalian telah selesai dari tasyahhud akhir, hendaklah ia memohon perlindungan kepada Allah dari empat hal: dari siksa Jahannam, dari siksa kubur, dari fitnah kehidupan dan kematian, serta dari fitnah Al-Masih Ad-Dajjal.'
    }
  },

  // 15. SALAM & MENOLEH
  {
    id: 'salam',
    stepNumber: 15,
    title: 'Salam & Menoleh ke Kanan dan ke Kiri',
    slug: 'salam-dan-menoleh',
    hukum: 'rukun',
    hukumLabel: 'Rukun Sholat',
    summary: 'Mengucapkan salam sambil menoleh ke kanan hingga terlihat pipi kanan, kemudian menoleh ke kiri.',
    movementDescription: [
      'Mengucapkan salam pertama ke arah kanan dengan lafadz: "Assalaamu \'alaykum wa rahmatullaah" hingga pipi kanan yang putih terlihat oleh makmum di belakang.',
      'Mengucapkan salam kedua ke arah kiri dengan lafadz: "Assalaamu \'alaykum wa rahmatullaah" hingga pipi kiri terlihat oleh makmum di belakang.',
      'Sholat resmi selesai setelah pengucapan salam pertama.',
      'Dilanjutkan dengan beristighfar 3x dan membaca dzikir ba\'da sholat sesuai sunnah.'
    ],
    bacaanList: [
      {
        id: 'lafazh-salam-1',
        title: 'Lafadz Salam Standar',
        arabic: 'السَّلاَمُ عَلَيْكُمْ وَرَحْمَةُ اللَّهِ',
        transliteration: 'Assalaamu \'alaykum wa rahmatullaah.',
        translation: 'Semoga keselamatan dan rahmat Allah tercurah kepada kalian.',
        narrator: 'HR. Muslim no. 582 & Abu Dawud no. 996'
      },
      {
        id: 'lafazh-salam-2',
        title: 'Lafadz Salam Pertama dengan Tambahan Wabarakatuh (Pilihan Shahih)',
        arabic: 'السَّلاَمُ عَلَيْكُمْ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ',
        transliteration: 'Assalaamu \'alaykum wa rahmatullaahi wa barakaatuh.',
        translation: 'Semoga keselamatan, rahmat Allah, dan berkah-Nya tercurah kepada kalian.',
        narrator: 'HR. Abu Dawud no. 997 (Shahih)'
      }
    ],
    sunnahTips: [
      'Menoleh ke kanan secara sempurna terlebih dahulu sebelum memulai salam ke kiri.',
      'Segera menyambung dengan istighfar 3 kali: Astaghfirullaah, Astaghfirullaah, Astaghfirullaah...'
    ],
    commonMistakes: [
      'Mengangguk-anggukkan kepala ke bawah saat menoleh salam.',
      'Menggerakkan telapak tangan ke samping seakan melambai saat mengucapkan salam (dilarang keras oleh Rasulullah ﷺ).'
    ],
    hadithDalil: {
      matan: 'كَانَ رَسُولُ اللَّهِ ﷺ يُسَلِّمُ عَنْ يَمِينِهِ وَعَنْ يَسَارِهِ: السَّلاَمُ عَلَيْكُمْ وَرَحْمَةُ اللَّهِ، السَّلاَمُ عَلَيْكُمْ وَرَحْمَةُ اللَّهِ، حَتَّى يُرَى بَيَاضُ خَدِّهِ',
      narrator: 'HR. Muslim no. 582',
      translation: 'Rasulullah ﷺ biasa mengucapkan salam ke kanan dan ke kirinya: "Assalamu\'alaikum wa rahmatullah, Assalamu\'alaikum wa rahmatullah" hingga terlihat putih pipinya.'
    }
  }
];

export const RUKUN_SHOLAT_SUMMARY = [
  { no: 1, name: 'Niat (dalam hati)', hukum: 'Rukun' },
  { no: 2, name: 'Berdiri bagi yang mampu pada sholat fardhu', hukum: 'Rukun' },
  { no: 3, name: 'Takbiratul Ihram (ucapan Allahu Akbar)', hukum: 'Rukun' },
  { no: 4, name: 'Membaca Surah Al-Fatihah pada setiap rakaat', hukum: 'Rukun' },
  { no: 5, name: 'Ruku\'', hukum: 'Rukun' },
  { no: 6, name: 'Thuma\'ninah dalam ruku\'', hukum: 'Rukun' },
  { no: 7, name: 'Bangkit dari ruku\' dan I\'tidal (berdiri tegak)', hukum: 'Rukun' },
  { no: 8, name: 'Thuma\'ninah dalam I\'tidal', hukum: 'Rukun' },
  { no: 9, name: 'Sujud di atas 7 anggota sujud', hukum: 'Rukun' },
  { no: 10, name: 'Thuma\'ninah dalam sujud', hukum: 'Rukun' },
  { no: 11, name: 'Duduk di antara dua sujud', hukum: 'Rukun' },
  { no: 12, name: 'Thuma\'ninah dalam duduk di antara dua sujud', hukum: 'Rukun' },
  { no: 13, name: 'Duduk Tasyahhud Akhir', hukum: 'Rukun' },
  { no: 14, name: 'Membaca Tasyahhud pada tasyahhud akhir', hukum: 'Rukun' },
  { no: 15, name: 'Membaca Shalawat kepada Nabi ﷺ pada tasyahhud akhir', hukum: 'Rukun' },
  { no: 16, name: 'Salam pertama', hukum: 'Rukun' },
  { no: 17, name: 'Tertib (mengerjakan rukun secara berurutan)', hukum: 'Rukun' },
];

export const KESALAHAN_UMUM_SHOLAT = [
  {
    title: 'Mendahului Gerakan Imam',
    desc: 'Mendahului ruku\', sujud, atau bangkit sebelum imam adalah dosa besar yang dapat membatalkan sholat.',
    dalil: 'HR. Bukhari no. 691 & Muslim no. 427: "Tidakkah takut orang yang mengangkat kepalanya sebelum imam bahwa Allah akan mengubah kepalanya menjadi kepala keledai?"'
  },
  {
    title: 'Tidak Thuma\'ninah (Terburu-buru)',
    desc: 'Bergerak terlalu cepat tanpa membiarkan seluruh tulang diam mapan sejenak menyebabkan sholat tidak sah, sebagaimana hadits orang yang buruk sholatnya diperintahkan mengulang sholatnya.',
    dalil: 'HR. Bukhari no. 757: "Kembalilah dan sholatlah, karena sesungguhnya engkau belum sholat."'
  },
  {
    title: 'Mengarahkan Pandangan ke Langit',
    desc: 'Menatap langit atau langit-langit saat sholat dilarang keras karena dapat menghilangkan kekhusyukan.',
    dalil: 'HR. Bukhari no. 750: "Hendaklah orang-orang benar-benar berhenti mengarahkan pandangannya ke langit saat sholat, atau pandangan mereka akan disambar."'
  },
  {
    title: 'Menempelkan Siku ke Lantai Saat Sujud',
    desc: 'Menghamparkan kedua lengan bawah di lantai menyerupai cara anjing mendekam, yang secara tegas dilarang oleh Nabi ﷺ.',
    dalil: 'HR. Bukhari no. 822: "Luruskanlah dalam sujud dan janganlah salah seorang di antara kalian menghamparkan kedua lengannya seperti anjing membentangkan lengannya."'
  },
  {
    title: 'Menggerakkan Tangan Saat Salam',
    desc: 'Mengisyaratkan tangan ke kanan dan ke kiri saat salam menyerupai ekor kuda binal yang dilarang oleh Rasulullah ﷺ.',
    dalil: 'HR. Muslim no. 430: "Mengapa kalian mengangkat tangan kalian seperti ekor kuda liar yang tidak tenang? Cukuplah salah seorang di antara kalian meletakkan tangannya di atas pahanya lalu mengucapkan salam..."'
  }
];
