export interface DailyHadith {
  id: string;
  translation: string;
  narrator: string;
  topic: string;
  arabic?: string;
}

export const DAILY_HADITHS: DailyHadith[] = [
  {
    id: 'h1',
    topic: 'Menuntut Ilmu',
    translation: 'Barangsiapa menempuh suatu jalan untuk mencari ilmu (syar\'i), maka Allah akan memudahkan baginya jalan menuju surga.',
    narrator: 'HR. Muslim no. 2699',
    arabic: 'مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا سَهَّلَ اللَّهُ لَهُ بِهِ طَرِيقًا إِلَى الْجَنَّةِ',
  },
  {
    id: 'h2',
    topic: 'Niat & Ikhlas',
    translation: 'Sesungguhnya setiap amalan tergantung pada niatnya, dan sesungguhnya setiap orang akan mendapatkan sesuai dengan apa yang dia niatkan.',
    narrator: 'HR. Bukhari no. 1 & Muslim no. 1907',
    arabic: 'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى',
  },
  {
    id: 'h3',
    topic: 'Amal Jariyah',
    translation: 'Jika seseorang meninggal dunia, maka terputuslah amalnya kecuali tiga perkara: sedekah jariyah, ilmu yang bermanfaat, dan anak shalih yang mendoakannya.',
    narrator: 'HR. Muslim no. 1631',
    arabic: 'إِذَا مَاتَ الْإِنْسَانُ انْقَطَعَ عَنْهُ عَمَلُهُ إِلَّا مِنْ ثَلَاثَةٍ: صَدَقَةٍ جَارِيَةٍ، أَوْ عِلْمٍ يُنْتَفَعُ بِهِ، أَوْ وَلَدٍ صَالِحٍ يَدْعُو لَهُ',
  },
  {
    id: 'h4',
    topic: 'Keutamaan Belajar Qur\'an',
    translation: 'Sebaik-baik kalian adalah orang yang mempelajari Al-Qur\'an dan mengajarkannya.',
    narrator: 'HR. Bukhari no. 5027',
    arabic: 'خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ',
  },
  {
    id: 'h5',
    topic: 'Keutamaan Masjid',
    translation: 'Barangsiapa bersuci di rumahnya kemudian berjalan menuju salah satu rumah Allah (masjid) untuk menunaikan salah satu kewajiban Allah, maka setiap langkahnya salah satunya menghapus dosa dan yang lainnya meninggikan derajat.',
    narrator: 'HR. Muslim no. 666',
  },
  {
    id: 'h6',
    topic: 'Menunjukkan Kebaikan',
    translation: 'Barangsiapa menunjukkan kepada suatu kebaikan, maka baginya pahala seperti pahala orang yang mengerjakannya.',
    narrator: 'HR. Muslim no. 1893',
    arabic: 'مَنْ دَلَّ عَلَى خَيْرٍ فَلَهُ مِثْلُ أَجْرِ فَاعِلِهِ',
  },
  {
    id: 'h7',
    topic: 'Dzikir & Mengingat Allah',
    translation: 'Perumpamaan orang yang mengingat Tuhannya (berdzikir) dengan orang yang tidak mengingat Tuhannya adalah seperti perumpamaan orang yang hidup dengan orang yang mati.',
    narrator: 'HR. Bukhari no. 6407',
  },
  {
    id: 'h8',
    topic: 'Dua Kalimat Dicintai Allah',
    translation: 'Dua kalimat yang ringan di lisan, berat di timbangan, dan dicintai oleh Ar-Rahman: Subhanallah wa bihamdihi, Subhanallahil \'Azhim.',
    narrator: 'HR. Bukhari no. 6406 & Muslim no. 2694',
    arabic: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، سُبْحَانَ اللَّهِ الْعَظِيمِ',
  },
  {
    id: 'h9',
    topic: 'Kebaikan yang Diinginkan Allah',
    translation: 'Barangsiapa yang Allah kehendaki kebaikan baginya, niscaya Allah fahamkan dia dalam urusan agama.',
    narrator: 'HR. Bukhari no. 71 & Muslim no. 1037',
    arabic: 'مَنْ يُرِدِ اللَّهُ بِهِ خَيْرًا يُفَقِّهْهُ فِي الدِّينِ',
  },
  {
    id: 'h10',
    topic: 'Menjaga Lisan',
    translation: 'Barangsiapa beriman kepada Allah dan hari akhir, hendaklah ia berkata yang baik atau diam.',
    narrator: 'HR. Bukhari no. 6018 & Muslim no. 47',
    arabic: 'مَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الآخِرِ فَلْيَقُلْ خَيْرًا أَوْ لِيَصْمُتْ',
  },
  {
    id: 'h11',
    topic: 'Akhlak Mulia',
    translation: 'Tidak ada sesuatu yang lebih berat dalam timbangan seorang mukmin pada hari kiamat daripada akhlak yang mulia.',
    narrator: 'HR. Tirmidzi no. 2002 (Shahih)',
  },
  {
    id: 'h12',
    topic: 'Senyum Sebagai Sedekah',
    translation: 'Senyummu di hadapan wajah saudaramu adalah sedekah bagimu.',
    narrator: 'HR. Tirmidzi no. 1956 (Shahih)',
    arabic: 'تَبَسُّمُكَ فِي وَجْهِ أَخِيكَ لَكَ صَدَقَةٌ',
  },
  {
    id: 'h13',
    topic: 'Ketenangan di Majelis Ilmu',
    translation: 'Tidaklah suatu kaum berkumpul di salah satu rumah Allah membaca kitab Allah dan saling mempelajarinya di antara mereka, melainkan ketenteraman akan turun kepada mereka, rahmat akan menyelimuti mereka, malaikat mengelilingi mereka, dan Allah menyebut mereka di hadapan makhluk yang ada di sisi-Nya.',
    narrator: 'HR. Muslim no. 2699',
  },
  {
    id: 'h14',
    topic: 'Istighfar & Taubat',
    translation: 'Demi Allah, sungguh aku beristighfar dan bertaubat kepada Allah dalam sehari lebih dari tujuh puluh kali.',
    narrator: 'HR. Bukhari no. 6307',
  },
  {
    id: 'h15',
    topic: 'Memberi Manfaat',
    translation: 'Sebaik-baik manusia adalah yang paling bermanfaat bagi orang lain.',
    narrator: 'HR. Ath-Thabrani (Al-Mu\'jam Al-Ausath no. 5787, dinilai Hasan)',
    arabic: 'خَيْرُ النَّاسِ أَنْفَعُهُمْ لِلنَّاسِ',
  },
  {
    id: 'h16',
    topic: 'Cinta Karena Allah',
    translation: 'Tidak beriman salah seorang di antara kalian sampai dia mencintai saudaranya sebagaimana dia mencintai dirinya sendiri.',
    narrator: 'HR. Bukhari no. 13 & Muslim no. 45',
  },
  {
    id: 'h17',
    topic: 'Doa Antara Adzan & Iqamah',
    translation: 'Doa antara adzan dan iqamah tidak akan ditolak.',
    narrator: 'HR. Abu Dawud no. 521 & Tirmidzi no. 212 (Shahih)',
    arabic: 'الدُّعَاءُ لَا يُرَدُّ بَيْنَ الأَذَانِ وَالإِقَامَةِ',
  },
  {
    id: 'h18',
    topic: 'Sholat Subuh & Ashar',
    translation: 'Barangsiapa mengerjakan sholat di dua waktu yang dingin (yaitu Subuh dan Ashar), maka ia akan masuk surga.',
    narrator: 'HR. Bukhari no. 574 & Muslim no. 635',
  },
  {
    id: 'h19',
    topic: 'Pahala Sholat Berjamaah',
    translation: 'Sholat berjamaah itu lebih utama daripada sholat sendirian sebanyak dua puluh tujuh derajat.',
    narrator: 'HR. Bukhari no. 645 & Muslim no. 650',
    arabic: 'صَلَاةُ الْجَمَاعَةِ تَفْضُلُ صَلَاةَ الْفَذِّ بِسَبْعٍ وَعِشْرِينَ دَرَجَةً',
  },
  {
    id: 'h20',
    topic: 'Memudahkan Urusan Orang Lain',
    translation: 'Barangsiapa mempermudah urusan orang yang sedang kesulitan, niscaya Allah akan mempermudah urusannya di dunia dan di akhirat.',
    narrator: 'HR. Muslim no. 2699',
  },
  {
    id: 'h21',
    topic: 'Menahan Amarah',
    translation: 'Bukanlah orang yang kuat itu yang pandai bergulat, tetapi orang yang kuat adalah orang yang mampu menguasai dirinya ketika marah.',
    narrator: 'HR. Bukhari no. 6114 & Muslim no. 2609',
  },
  {
    id: 'h22',
    topic: 'Membangun Masjid',
    translation: 'Barangsiapa membangun masjid karena Allah, meskipun hanya sebesar sarang burung atau lebih kecil, maka Allah akan membangunkan untuknya rumah di surga.',
    narrator: 'HR. Ibnu Majah no. 738 (Shahih)',
  },
  {
    id: 'h23',
    topic: 'Rasa Syukur',
    translation: 'Sungguh mengagumkan perkara seorang mukmin, sesungguhnya semua perkaranya adalah kebaikan. Jika mendapatkan kelapangan ia bersyukur, maka itu baik baginya. Jika ditimpa kesulitan ia bersabar, maka itu baik baginya.',
    narrator: 'HR. Muslim no. 2999',
  },
  {
    id: 'h24',
    topic: 'Takwa Dimanapun Berada',
    translation: 'Bertakwalah kepada Allah di mana pun kamu berada, dan ikutilah perbuatan buruk dengan perbuatan baik niscaya kebaikan itu akan menghapusnya, serta berakhlaklah kepada manusia dengan akhlak yang baik.',
    narrator: 'HR. Tirmidzi no. 1987 (Hasan Shahih)',
  },
  {
    id: 'h25',
    topic: 'Keutamaan Dzikir Laa Ilaaha Illallah',
    translation: 'Dzikir yang paling utama adalah Laa ilaaha illallah, dan doa yang paling utama adalah Alhamdulillaah.',
    narrator: 'HR. Tirmidzi no. 3383 (Hasan)',
    arabic: 'أَفْضَلُ الذِّكْرِ لَا إِلَهَ إِلَّا اللَّهُ وَأَفْضَلُ الدُّعَاءِ الْحَمْدُ لِلَّهِ',
  },
];
