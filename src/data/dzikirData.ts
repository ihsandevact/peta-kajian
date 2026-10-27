export interface DzikirItem {
  id: string;
  title: string;
  arabic: string;
  transliteration?: string;
  translation: string;
  narrator: string;
  faedah?: string;
  targetCount: number;
  time: 'pagi' | 'petang' | 'both';
}

export const DZIKIR_ITEMS: DzikirItem[] = [
  // 1. Ayat Kursi (Pagi & Petang) - 1x
  {
    id: 'd-ayat-kursi',
    title: 'Ayat Kursi',
    time: 'both',
    targetCount: 1,
    arabic:
      'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ ۚ لَّهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ ۗ مَن ذَا الَّذِي يَشْفَعُ عِندَهُ إِلَّا بِإِذْنِهِ ۚ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ ۖ وَلَا يُحِيطُونَ بِشَيْءٍ مِّنْ عِلْمِهِ إِلَّا بِمَا شَاءَ ۚ وَسِعَ كُرْسِيُّهُ السَّمَاوَاتِ وَالْأَرْضَ ۖ وَلَا يَئُودُهُ حِفْظُهُمَا ۚ وَهُوَ الْعَلِيُّ الْعَظِيمُ',
    transliteration:
      'Allahu laa ilaaha illa huwal hayyul qayyum, laa ta\'khudzuhu sinatuw walaa naum, lahu maa fis-samaawaati wa maa fil ardh, man dzalladzii yasyfa\'u \'indahuu illaa bi-idznih, ya\'lamu maa baina aydiihim wa maa khalfahum, wa laa yuhiithuuna bi syai-im min \'ilmihii illaa bimaa syaa\', wasi\'a kursiyyuhus-samaawaati wal ardh, wa laa ya-uuduhuu hifzhuhumaa, wa huwal \'aliyyul \'azhiim.',
    translation:
      'Allah, tidak ada ilah (yang berhak disembah) melainkan Dia Yang Hidup Kekal lagi terus menerus mengurus (makhluk-Nya); tidak mengantuk dan tidak tidur. Kepunyaan-Nya apa yang di langit dan di bumi. Tiada yang dapat memberi syafa\'at di sisi Allah tanpa izin-Nya? Allah mengetahui apa-apa yang di hadapan mereka dan di belakang mereka, dan mereka tidak mengetahui apa-apa dari ilmu Allah melainkan apa yang dikehendaki-Nya. Kursi Allah meliputi langit dan bumi. Dan Allah tidak merasa berat memelihara keduanya, dan Allah Maha Tinggi lagi Maha Besar.',
    narrator: 'HR. Al-Hakim (1/562), dishahihkan oleh Al-Albani',
    faedah: 'Barangsiapa membacanya ketika pagi hari, maka ia dilindungi dari godaan jin hingga petang. Dan barangsiapa membacanya di petang hari, ia dilindungi hingga pagi hari.',
  },

  // 2. Surat Al-Ikhlas (Pagi & Petang) - 3x
  {
    id: 'd-al-ikhlas',
    title: 'Surat Al-Ikhlas',
    time: 'both',
    targetCount: 3,
    arabic:
      'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ\nقُلْ هُوَ اللَّهُ أَحَدٌ ﴿١﴾ اللَّهُ الصَّمَدُ ﴿٢﴾ لَمْ يَلِدْ وَلَمْ يُولَدْ ﴿٣﴾ وَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ ﴿٤﴾',
    transliteration:
      'Bismillaahir-rahmaanir-rahiim.\nQul huwallaahu ahad (1). Allaahush-shamad (2). Lam yalid wa lam yuulad (3). Wa lam yakul lahuu kufuwan ahad (4).',
    translation:
      'Dengan nama Allah Yang Maha Pengasih lagi Maha Penyayang.\n1. Katakanlah (Muhammad), "Dialah Allah, Yang Maha Esa."\n2. Allah tempat meminta segala sesuatu.\n3. (Allah) tidak beranak dan tidak pula diperanakkan,\n4. dan tidak ada sesuatu yang setara dengan Dia.',
    narrator: 'HR. Abu Dawud no. 5082 & At-Tirmidzi no. 3575 (Hasan Shahih)',
    faedah:
      'Dibaca 3 kali di waktu pagi dan petang. Rasulullah shallallahu \'alaihi wa sallam bersabda: "Maka ia akan mencukupkanmu dari segala sesuatu (melindungi dari segala keburukan).',
  },

  // 3. Surat Al-Falaq (Pagi & Petang) - 3x
  {
    id: 'd-al-falaq',
    title: 'Surat Al-Falaq',
    time: 'both',
    targetCount: 3,
    arabic:
      'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ\nقُلْ أَعُوذُ بِرَبِّ الْفَلَقِ ﴿١﴾ مِن شَرِّ مَا خَلَقَ ﴿٢﴾ وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ ﴿٣﴾ وَمِن شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ ﴿٤﴾ وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ ﴿٥﴾',
    transliteration:
      'Bismillaahir-rahmaanir-rahiim.\nQul a\'uudzu bi rabbil-falaq (1). Min syarri maa khalaq (2). Wa min syarri ghaasiqin idzaa waqab (3). Wa min syarrin-naffaatsaati fil \'uqad (4). Wa min syarri haasidin idzaa hasad (5).',
    translation:
      'Dengan nama Allah Yang Maha Pengasih lagi Maha Penyayang.\n1. Katakanlah, "Aku berlindung kepada Tuhan yang menguasai subuh (fajar),\n2. dari kejahatan (makhluk yang) Dia ciptakan,\n3. dan dari kejahatan malam apabila telah gelap gulita,\n4. dan dari kejahatan (perempuan-perempuan) penyihir yang meniup pada buhul-buhul (talinya),\n5. dan dari kejahatan orang yang dengki apabila dia dengki."',
    narrator: 'HR. Abu Dawud no. 5082 & At-Tirmidzi no. 3575 (Hasan Shahih)',
    faedah:
      'Dibaca 3 kali di waktu pagi dan petang. Melindungi dari segala marabahaya, sihir, \'ain, serta kedengkian makhluk.',
  },

  // 4. Surat An-Naas (Pagi & Petang) - 3x
  {
    id: 'd-an-naas',
    title: 'Surat An-Naas',
    time: 'both',
    targetCount: 3,
    arabic:
      'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ\nقُلْ أَعُوذُ بِرَبِّ النَّاسِ ﴿١﴾ مَلِكِ النَّاسِ ﴿٢﴾ إِلَٰهِ النَّاسِ ﴿٣﴾ مِن شَرِّ الْوَسْوَاسِ الْخَنَّاسِ ﴿٤﴾ الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ ﴿٥﴾ مِنَ الْجِنَّةِ وَالنَّاسِ ﴿٦﴾',
    transliteration:
      'Bismillaahir-rahmaanir-rahiim.\nQul a\'uudzu bi rabbin-naas (1). Malikin-naas (2). Ilaahin-naas (3). Min syarril-waswaasil-khannaas (4). Alladzii yuwaswisu fii shuduurin-naas (5). Minal jinnati wan-naas (6).',
    translation:
      'Dengan nama Allah Yang Maha Pengasih lagi Maha Penyayang.\n1. Katakanlah, "Aku berlindung kepada Tuhannya manusia,\n2. Raja manusia,\n3. Sembahan manusia,\n4. dari kejahatan (bisikan) setan yang bersembunyi,\n5. yang membisikkan (kejahatan) ke dalam dada manusia,\n6. dari (golongan) jin dan manusia."',
    narrator: 'HR. Abu Dawud no. 5082 & At-Tirmidzi no. 3575 (Hasan Shahih)',
    faedah:
      'Dibaca 3 kali di waktu pagi dan petang sebagai pelindung utama dari bisikan dan godaan setan, jin, dan manusia.',
  },

  // 5. Pagi: Ashbahna wa ashbahal mulku lillah - 1x
  {
    id: 'd-ashbahna-mulku',
    title: 'Ashbahna wa Ashbahal Mulku Lillah',
    time: 'pagi',
    targetCount: 1,
    arabic:
      'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ، رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَذَا الْيَوْمِ وَخَيْرَ مَا بَعْدَهُ، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَذَا الْيَوْمِ وَشَرِّ مَا بَعْدَهُ، رَبِّ أَعُوذُ بِكَ مِنَ الْكَسَلِ وَسُوءِ الْكِبَرِ، رَبِّ أَعُوذُ بِكَ مِنْ عَذَابٍ فِي النَّارِ وَعَذَابٍ فِي الْقَبْرِ',
    transliteration:
      'Ashbahnaa wa ashbahal mulku lillaahi walhamdu lillaah, laa ilaaha illallaahu wahdahu laa syariika lah, lahul mulku wa lahul hamdu wa huwa \'alaa kulli syai-in qadiir. Rabbi as-aluka khaira maa fii haadzal yaumi wa khaira maa ba\'dahu, wa a\'uudzu bika min syarri maa fii haadzal yaumi wa syarri maa ba\'dahu, rabbi a\'uudzu bika minal kasali wa suu-il kibar, rabbi a\'uudzu bika min \'adzaabin fin-naari wa \'adzaabin fil qabr.',
    translation:
      'Kami telah memasuki waktu pagi dan kerajaan hanya milik Allah, segala puji bagi Allah. Tidak ada ilah yang berhak disembah melainkan Allah semata, tiada sekutu bagi-Nya. Bagi-Nya kerajaan dan bagi-Nya pujian. Dan Dia Maha Kuasa atas segala sesuatu. Wahai Rabbku, aku memohon kepada-Mu kebaikan di hari ini dan kebaikan sesudahnya. Dan aku berlindung kepada-Mu dari kejahatan hari ini dan kejahatan sesudahnya. Wahai Rabbku, aku berlindung kepada-Mu dari kemalasan dan keburukan di hari tua. Wahai Rabbku, aku berlindung kepada-Mu dari siksaan di neraka dan siksaan di kubur.',
    narrator: 'HR. Muslim no. 2723',
    faedah: 'Memohon perlindungan sepanjang hari dari kemalasan, keburukan usia tua, serta siksa kubur dan neraka.',
  },

  // 5. Petang: Amsayna wa amsal mulku lillah - 1x
  {
    id: 'd-amsayna-mulku',
    title: 'Amsayna wa Amsal Mulku Lillah',
    time: 'petang',
    targetCount: 1,
    arabic:
      'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ، رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَذِهِ اللَّيْلَةِ وَخَيْرَ مَا بَعْدَهَا، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَذِهِ اللَّيْلَةِ وَشَرِّ مَا بَعْدَهَا، رَبِّ أَعُوذُ بِكَ مِنَ الْكَسَلِ وَسُوءِ الْكِبَرِ، رَبِّ أَعُوذُ بِكَ مِنْ عَذَابٍ فِي النَّارِ وَعَذَابٍ فِي الْقَبْرِ',
    transliteration:
      'Amsaynaa wa amsal mulku lillaahi walhamdu lillaah, laa ilaaha illallaahu wahdahu laa syariika lah, lahul mulku wa lahul hamdu wa huwa \'alaa kulli syai-in qadiir. Rabbi as-aluka khaira maa fii haadzihil lailati wa khaira maa ba\'dahaa, wa a\'uudzu bika min syarri maa fii haadzihil lailati wa syarri maa ba\'dahaa, rabbi a\'uudzu bika minal kasali wa suu-il kibar, rabbi a\'uudzu bika min \'adzaabin fin-naari wa \'adzaabin fil qabr.',
    translation:
      'Kami telah memasuki waktu petang dan kerajaan hanya milik Allah, segala puji bagi Allah. Tidak ada ilah yang berhak disembah melainkan Allah semata, tiada sekutu bagi-Nya. Bagi-Nya kerajaan dan bagi-Nya pujian. Dan Dia Maha Kuasa atas segala sesuatu. Wahai Rabbku, aku memohon kepada-Mu kebaikan di malam ini dan kebaikan sesudahnya. Dan aku berlindung kepada-Mu dari kejahatan malam ini dan kejahatan sesudahnya. Wahai Rabbku, aku berlindung kepada-Mu dari kemalasan dan keburukan di hari tua. Wahai Rabbku, aku berlindung kepada-Mu dari siksaan di neraka dan siksaan di kubur.',
    narrator: 'HR. Muslim no. 2723',
    faedah: 'Memohon perlindungan sepanjang malam dari kemalasan, keburukan usia tua, serta siksa kubur dan neraka.',
  },

  // 6. Sayyidul Istighfar (Pagi & Petang) - 1x
  {
    id: 'd-sayyidul-istighfar',
    title: 'Sayyidul Istighfar (Penghulu Istighfar)',
    time: 'both',
    targetCount: 1,
    arabic:
      'اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ بِذَنْبِي فَاغْفِرْ لِي فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ',
    transliteration:
      'Allaahumma anta rabbii laa ilaaha illaa anta, khalaqtanii wa anaa \'abduka, wa anaa \'alaa \'ahdika wa wa\'dika mastatha\'tu, a\'uudzu bika min syarri maa shana\'tu, abuu-u laka bini\'matika \'alayya, wa abuu-u bi-dzanbii faghfir lii fa-innahu laa yaghfirudz-dzunuuba illaa anta.',
    translation:
      'Ya Allah, Engkau adalah Rabbku, tiada ilah yang berhak disembah selain Engkau. Engkaulah yang menciptakan aku dan aku adalah hamba-Mu. Aku akan setia pada perjanjianku dengan-Mu semampuku. Aku berlindung kepada-Mu dari keburukan yang telah aku perbuat. Aku mengakui nikmat-Mu kepadaku dan aku mengakui dosaku kepada-Mu, maka ampunilah aku. Sebab sesungguhnya tidak ada yang dapat mengampuni dosa melainkan hanya Engkau.',
    narrator: 'HR. Bukhari no. 6306 & 6323',
    faedah: 'Barangsiapa membacanya di petang hari dengan yakin lalu meninggal malam itu, maka ia termasuk penghuni surga. Demikian pula jika dibaca di pagi hari lalu meninggal di hari itu.',
  },

  // 7. Pagi: Allahumma bika ashbahna - 1x
  {
    id: 'd-bika-ashbahna',
    title: 'Allahumma Bika Ashbahna',
    time: 'pagi',
    targetCount: 1,
    arabic:
      'اللَّهُمَّ بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ النُّشُورُ',
    transliteration:
      'Allaahumma bika ashbahnaa, wa bika amsaynaa, wa bika nahyaa, wa bika namuutu, wa ilaykan-nusyuur.',
    translation:
      'Ya Allah, dengan rahmat dan pertolongan-Mu kami memasuki waktu pagi, dan dengan rahmat dan pertolongan-Mu kami memasuki waktu petang. Dengan rahmat dan kehendak-Mu kami hidup dan dengan kehendak-Mu kami mati. Dan kepada-Mu tempat kembali (kebangkitan).',
    narrator: 'HR. At-Tirmidzi no. 3391 (Shahih)',
  },

  // 7. Petang: Allahumma bika amsayna - 1x
  {
    id: 'd-bika-amsayna',
    title: 'Allahumma Bika Amsayna',
    time: 'petang',
    targetCount: 1,
    arabic:
      'اللَّهُمَّ بِكَ أَمْسَيْنَا، وَبِكَ أَصْبَحْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ الْمَصِيرُ',
    transliteration:
      'Allaahumma bika amsaynaa, wa bika ashbahnaa, wa bika nahyaa, wa bika namuutu, wa ilaykal mashiir.',
    translation:
      'Ya Allah, dengan rahmat dan pertolongan-Mu kami memasuki waktu petang, dan dengan rahmat dan pertolongan-Mu kami memasuki waktu pagi. Dengan rahmat dan kehendak-Mu kami hidup dan dengan kehendak-Mu kami mati. Dan kepada-Mu tempat berpulang.',
    narrator: 'HR. At-Tirmidzi no. 3391 (Shahih)',
  },

  // 8. Doa Afiyat Badan, Pendengaran, Penglihatan - 3x
  {
    id: 'd-afiyat',
    title: 'Doa Kesehatan & Perlindungan Kekufuran',
    time: 'both',
    targetCount: 3,
    arabic:
      'اللَّهُمَّ عَافِنِي فِي بَدَنِي، اللَّهُمَّ عَافِنِي فِي سَمْعِي، اللَّهُمَّ عَافِنِي فِي بَصَرِي، لَا إِلَهَ إِلَّا أَنْتَ. اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْكُفْرِ وَالْفَقْرِ، وَأَعُوذُ بِكَ مِنْ عَذَابِ الْقَبْرِ، لَا إِلَهَ إِلَّا أَنْتَ',
    transliteration:
      'Allaahumma \'aafinii fii badanii, allaahumma \'aafinii fii sam\'ii, allaahumma \'aafinii fii basharii, laa ilaaha illaa anta. Allaahumma innii a\'uudzu bika minal kufri wal faqr, wa a\'uudzu bika min \'adzaabil qabr, laa ilaaha illaa anta.',
    translation:
      'Ya Allah, selamatkanlah tubuhku (dari penyakit). Ya Allah, selamatkanlah pendengaranku. Ya Allah, selamatkanlah penglihatanku, tiada ilah yang berhak disembah selain Engkau. Ya Allah, sesungguhnya aku berlindung kepada-Mu dari kekafiran dan kefakiran. Dan aku berlindung kepada-Mu dari siksa kubur, tiada ilah yang berhak disembah selain Engkau.',
    narrator: 'HR. Abu Dawud no. 5090 & Ahmad (5/42) (Hasan)',
  },

  // 9. Doa Perlindungan Dunia & Akhirat - 1x
  {
    id: 'd-afwa-wal-afiyah',
    title: 'Doa Memohon Ampunan & Penjagaan Segala Arah',
    time: 'both',
    targetCount: 1,
    arabic:
      'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي الدُّنْيَا وَالْآخِرَةِ، اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي دِينِي وَدُنْيَايَ وَأَهْلِي وَمَالِي، اللَّهُمَّ اسْتُرْ عَوْرَاتِي وَآمِنْ رَوْعَاتِي، اللَّهُمَّ احْفَظْنِي مِنْ بَيْنِ يَدَيَّ، وَمِنْ خَلْفِي، وَعَنْ يَمِينِي، وَعَنْ شِمَالِي، وَمِنْ فَوْقِي، وَأَعُوذُ بِعَظَمَتِكَ أَنْ أُغْتَالَ مِنْ تَحْتِي',
    transliteration:
      'Allaahumma innii as-alukal \'afwa wal \'aafiyata fid-dunyaa wal aakhirah. Allaahumma innii as-alukal \'afwa wal \'aafiyata fii diinii wa dunyaaya wa ahlii wa maalii. Allaahummastur \'auraatii wa aamin rau\'aatii. Allaahummahfazhnii min baini yadayya, wa min khalfii, wa \'an yamiinii, wa \'an syimaalii, wa min fawqii, wa a\'uudzu bi\'azhamatika an ughtaala min tahtii.',
    translation:
      'Ya Allah, sesungguhnya aku memohon ampunan dan keselamatan di dunia dan akhirat. Ya Allah, sesungguhnya aku memohon ampunan dan keselamatan dalam agamaku, duniaku, keluargaku, dan hartaku. Ya Allah, tutupilah auratku (aib-aibku) dan amankanlah ketakutanku. Ya Allah, peliharalah aku dari arah depanku, belakangku, kananku, kiriku, dan atasku. Dan aku berlindung dengan keagungan-Mu agar aku tidak diserang secara tiba-tiba dari bawahku (dibenamkan ke dalam bumi).',
    narrator: 'HR. Abu Dawud no. 5074 & Ibnu Majah no. 3871 (Shahih)',
    faedah: 'Doa yang senantiasa dipanjatkan oleh Rasulullah shallallahu \'alaihi wa sallam setiap pagi dan petang tanpa pernah ditinggalkan.',
  },

  // 10. Perlindungan dari Gangguan Setan & Syirik - 1x
  {
    id: 'd-alimal-ghaib',
    title: 'Doa Perlindungan dari Keburukan Diri & Setan',
    time: 'both',
    targetCount: 1,
    arabic:
      'اللَّهُمَّ عَالِمَ الْغَيْبِ وَالشَّهَادَةِ، فَاطِرَ السَّمَاوَاتِ وَالْأَرْضِ، رَبَّ كُلِّ شَيْءٍ وَمَلِيكَهُ، أَشْهَدُ أَنْ لَا إِلَهَ إِلَّا أَنْتَ، أَعُوذُ بِكَ مِنْ شَرِّ نَفْسِي، وَمِنْ شَرِّ الشَّيْطَانِ وَشِرْكِهِ، وَأَنْ أَقْتَرِفَ عَلَى نَفْسِي سُوءًا أَوْ أَجُرَّهُ إِلَى مُسْلِمٍ',
    transliteration:
      'Allaahumma \'aalimal ghaibi wash-syahaadah, faathiras-samaawaati wal ardh, rabba kulli syai-in wa maliikah, asyhadu an laa ilaaha illaa anta, a\'uudzu bika min syarri nafsii, wa min syarrisy-syaithaani wa syirkihii, wa an aqtariifa \'alaa nafsii suu-an au ajurrahuu ilaa muslim.',
    translation:
      'Ya Allah, Yang Maha Mengetahui yang ghaib dan yang nyata, Pencipta langit dan bumi, Rabb dan Raja bagi segala sesuatu. Aku bersaksi bahwa tiada ilah yang berhak disembah selain Engkau. Aku berlindung kepada-Mu dari keburukan diriku, keburukan setan dan sekutunya, serta dari perbuatan buruk yang menimpa diriku sendiri atau yang kutimpakan kepada seorang muslim.',
    narrator: 'HR. At-Tirmidzi no. 3392 & Abu Dawud no. 5067 (Shahih)',
  },

  // 11. Bismillahilladzi laa yadhurru - 3x
  {
    id: 'd-bismillahilladzi',
    title: 'Bismillahilladzi Laa Yadhurru',
    time: 'both',
    targetCount: 3,
    arabic:
      'بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ',
    transliteration:
      'Bismillaahilladzii laa yadhurru ma\'asmihii syai-un fil ardhi wa laa fis-samaa-i wa huwas-samii\'ul \'aliim.',
    translation:
      'Dengan nama Allah yang bersama nama-Nya tidak ada sesuatu pun di bumi maupun di langit yang dapat mendatangkan mudharat (bahaya), dan Dia Maha Mendengar lagi Maha Mengetahui.',
    narrator: 'HR. Abu Dawud no. 5088 & At-Tirmidzi no. 3388 (Shahih)',
    faedah: 'Barangsiapa membacanya 3 kali pada pagi hari dan 3 kali pada petang hari, maka tidak ada sesuatu bahaya pun yang dapat mencelakakannya.',
  },

  // 12. Radheetu billahi rabba - 3x
  {
    id: 'd-radheetu-billah',
    title: 'Radheetu Billahi Rabba',
    time: 'both',
    targetCount: 3,
    arabic:
      'رَضِيتُ بِاللَّهِ رَبًّا، وَبِالْإِسْلَامِ دِينًا، وَبِمُحَمَّدٍ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ نَبِيًّا',
    transliteration:
      'Radhiitu billaahi rabbaa, wa bil Islaami diinaa, wa bi Muhammadin shallallaahu \'alayhi wa sallama nabiyyaa.',
    translation:
      'Aku ridha Allah sebagai Rabbku, Islam sebagai agamaku, dan Muhammad shallallahu \'alaihi wa sallam sebagai Nabiku.',
    narrator: 'HR. Abu Dawud no. 5072 & Ahmad (4/337) (Shahih)',
    faedah: 'Barangsiapa membacanya sebanyak 3 kali setiap pagi dan petang, maka Allah pasti akan meridhai orang tersebut pada hari kiamat.',
  },

  // 13. Yaa Hayyu Yaa Qayyoom - 1x
  {
    id: 'd-yaa-hayyu',
    title: 'Yaa Hayyu Yaa Qayyoom',
    time: 'both',
    targetCount: 1,
    arabic:
      'يَا حَيُّ يَا قَيُّومُ بِرَحْمَتِكَ أَسْتَغِيثُ، أَصْلِحْ لِي شَأْنِي كُلَّهُ، وَلَا تَكِلْنِي إِلَى نَفْسِي طَرْفَةَ عَيْنٍ',
    transliteration:
      'Yaa Hayyu yaa Qayyuum, bi-rahmatika astaghiits, ashlih lii sya\'nii kullah, wa laa takilnii ilaa nafsii tharfata \'ain.',
    translation:
      'Wahai Yang Maha Hidup, wahai Yang Maha Berdiri Sendiri (mengurus makhluk-Nya), dengan rahmat-Mu aku memohon pertolongan. Perbaikilah urusanku seluruhnya, dan janganlah Engkau serahkan aku kepada diriku sendiri walau sekejap mata pun.',
    narrator: 'HR. Al-Hakim (1/545) & An-Nasa\'i (Shahih)',
  },

  // 14. Pagi: Ashbahna 'ala fithratil Islam - 1x
  {
    id: 'd-fithratil-islam-pagi',
    title: 'Ashbahna \'ala Fithratil Islam',
    time: 'pagi',
    targetCount: 1,
    arabic:
      'أَصْبَحْنَا عَلَى فِطْرَةِ الْإِسْلَامِ، وَعَلَى كَلِمَةِ الْإِخْلَاصِ، وَعَلَى دِينِ نَبِيِّنَا مُحَمَّدٍ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ، وَعَلَى مِلَّةِ أَبِينَا إِبْرَاهِيمَ حَنِيفًا مُسْلِمًا وَمَا كَانَ مِنَ الْمُشْرِكِينَ',
    transliteration:
      'Ashbahnaa \'alaa fithratil Islaam, wa \'alaa kalimatil ikhlaash, wa \'alaa diini nabiyyinaa Muhammadin shallallaahu \'alayhi wa sallam, wa \'alaa millati abiinaa Ibraahiima haniifam muslimaw wa maa kaana minal musyrikiin.',
    translation:
      'Kami memasuki waktu pagi di atas fitrah Islam, di atas kalimat ikhlas (dua kalimat syahadat), di atas agama Nabi kami Muhammad shallallahu \'alaihi wa sallam, dan di atas millah (ajaran) ayah kami Ibrahim yang hanif lagi berserah diri, dan beliau sekali-kali bukanlah termasuk orang-orang musyrik.',
    narrator: 'HR. Ahmad (3/406) (Shahih)',
  },

  // 14. Petang: Amsayna 'ala fithratil Islam - 1x
  {
    id: 'd-fithratil-islam-petang',
    title: 'Amsayna \'ala Fithratil Islam',
    time: 'petang',
    targetCount: 1,
    arabic:
      'أَمْسَيْنَا عَلَى فِطْرَةِ الْإِسْلَامِ، وَعَلَى كَلِمَةِ الْإِخْلَاصِ، وَعَلَى دِينِ نَبِيِّنَا مُحَمَّدٍ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ، وَعَلَى مِلَّةِ أَبِينَا إِبْرَاهِيمَ حَنِيفًا مُسْلِمًا وَمَا كَانَ مِنَ الْمُشْرِكِينَ',
    transliteration:
      'Amsaynaa \'alaa fithratil Islaam, wa \'alaa kalimatil ikhlaash, wa \'alaa diini nabiyyinaa Muhammadin shallallaahu \'alayhi wa sallam, wa \'alaa millati abiinaa Ibraahiima haniifam muslimaw wa maa kaana minal musyrikiin.',
    translation:
      'Kami memasuki waktu petang di atas fitrah Islam, di atas kalimat ikhlas (dua kalimat syahadat), di atas agama Nabi kami Muhammad shallallahu \'alaihi wa sallam, dan di atas millah (ajaran) ayah kami Ibrahim yang hanif lagi berserah diri, dan beliau sekali-kali bukanlah termasuk orang-orang musyrik.',
    narrator: 'HR. Ahmad (3/406) (Shahih)',
  },

  // 15. Petang Khusus: Perlindungan Racun / Sengatan Hewan - 3x
  {
    id: 'd-auudzu-bikalimatillah',
    title: 'A\'uudzu bi Kalimaatillaahit-Taammaat (Khusus Petang)',
    time: 'petang',
    targetCount: 3,
    arabic:
      'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ',
    transliteration:
      'A\'uudzu bikalimaatillaahit-taammaati min syarri maa khalaq.',
    translation:
      'Aku berlindung dengan kalimat-kalimat Allah yang sempurna dari kejahatan makhluk yang Dia ciptakan.',
    narrator: 'HR. Muslim no. 2709',
    faedah: 'Barangsiapa membacanya 3 kali pada petang hari, niscaya tidak akan ada racun atau sengatan hewan berbisa yang dapat memudharatkannya pada malam itu.',
  },

  // 16. Tasbih Penghapus Dosa - 100x
  {
    id: 'd-subhanallah-wa-bihamdihi-100',
    title: 'Subhanallahi wa Bihamdih (100x)',
    time: 'both',
    targetCount: 100,
    arabic:
      'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ',
    transliteration: 'Subhaanallaahi wa bihamdih.',
    translation: 'Maha Suci Allah dan segala puji bagi-Nya.',
    narrator: 'HR. Muslim no. 2692',
    faedah: 'Barangsiapa membacanya 100 kali dalam sehari, maka dosa-dosanya akan diampuni meskipun sebanyak buih di lautan. Dan tiada seorang pun yang membawa pahala lebih baik pada hari kiamat melainkan orang yang membaca serupa atau lebih banyak.',
  },

  // 17. Tahlil Tauhid - 10x atau 100x (Diset 10x untuk kemudahan)
  {
    id: 'd-tahlil-10',
    title: 'Laa Ilaaha Illallah Wahdahu Laa Syarika Lah (10x)',
    time: 'both',
    targetCount: 10,
    arabic:
      'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ',
    transliteration:
      'Laa ilaaha illallaahu wahdahu laa syariika lah, lahul mulku wa lahul hamdu wa huwa \'alaa kulli syai-in qadiir.',
    translation:
      'Tidak ada ilah yang berhak disembah selain Allah semata, tiada sekutu bagi-Nya. Bagi-Nya kerajaan dan bagi-Nya segala pujian, dan Dia Maha Kuasa atas segala sesuatu.',
    narrator: 'HR. An-Nasa\'i (\'Amalul Yaum wal Lailah no. 24) (Shahih)',
    faedah: 'Membacanya 10 kali bagaikan memerdekakan empat orang budak dari keturunan Ismail.',
  },

  // 18. Istighfar Harian - 100x
  {
    id: 'd-astaghfirullah-100',
    title: 'Istighfar (100x)',
    time: 'both',
    targetCount: 100,
    arabic:
      'أَسْتَغْفِرُ اللَّهَ وَأَتُوبُ إِلَيْهِ',
    transliteration: 'Astaghfirullaaha wa atuubu ilayh.',
    translation: 'Aku memohon ampunan kepada Allah dan aku bertaubat kepada-Nya.',
    narrator: 'HR. Bukhari no. 6307 & Muslim no. 2702',
    faedah: 'Nabi shallallahu \'alaihi wa sallam beristighfar dan bertaubat kepada Allah dalam sehari tidak kurang dari 100 kali.',
  },

  // 19. Pagi Khusus: Doa Memohon Ilmu, Rezeki & Amal Diterima - 1x
  {
    id: 'd-ilman-naafia',
    title: 'Doa Ilmu yang Bermanfaat & Rezeki Halal (Khusus Pagi)',
    time: 'pagi',
    targetCount: 1,
    arabic:
      'اللَّهُمَّ إِنِّي أَسْأَلُكَ عِلْمًا نَافِعًا، وَرِزْقًا طَيِّبًا، وَعَمَلًا مُتَقَبَّلًا',
    transliteration:
      'Allaahumma innii as-aluka \'ilman naafi\'aa, wa rizqan thayyibaa, wa \'amalan mutaqabbalaa.',
    translation:
      'Ya Allah, sesungguhnya aku memohon kepada-Mu ilmu yang bermanfaat, rezeki yang halal dan baik, serta amalan yang diterima.',
    narrator: 'HR. Ibnu Majah no. 925 (Shahih)',
    faedah: 'Dibaca ba\'da sholat Subuh atau di waktu pagi untuk keberkahan aktivitas sepanjang hari.',
  },
];
