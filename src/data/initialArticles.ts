export interface ArticleSource {
  id: string;
  name: string;
  slug: string;
  websiteUrl: string;
  rssFeedUrl: string;
  organization: string;
  defaultAuthor: string;
  badgeColor: string;
  icon: string;
}

export interface IslamicArticle {
  id: string;
  title: string;
  slug: string;
  summary: string;
  contentHtml: string;
  canonicalUrl: string;
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  authorName: string;
  category: string;
  tags: string[];
  imageUrl?: string;
  publishedAt: string;
  readTimeMinutes: number;
  isFeatured?: boolean;
}

export const ARTICLE_SOURCES: ArticleSource[] = [
  {
    id: 'muslim-or-id',
    name: 'Muslim.or.id',
    slug: 'muslim-or-id',
    websiteUrl: 'https://muslim.or.id',
    rssFeedUrl: 'https://muslim.or.id/feed',
    organization: 'Yayasan Pendidikan Islam Al-Atsari (YPIA) Yogyakarta',
    defaultAuthor: 'Asatidzah Muslim.or.id',
    badgeColor: 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    icon: 'menu_book',
  },
  {
    id: 'rumaysho',
    name: 'Rumaysho.com',
    slug: 'rumaysho',
    websiteUrl: 'https://rumaysho.com',
    rssFeedUrl: 'https://rumaysho.com/feed',
    organization: 'Pesantren Darush Sholihin Gunungkidul',
    defaultAuthor: 'Ust. Muhammad Abduh Tuasikal, M.Sc.',
    badgeColor: 'bg-sky-600/10 text-sky-700 dark:text-sky-300 border-sky-500/30',
    icon: 'school',
  },
  {
    id: 'konsultasi-syariah',
    name: 'KonsultasiSyariah.com',
    slug: 'konsultasi-syariah',
    websiteUrl: 'https://konsultasisyariah.com',
    rssFeedUrl: 'https://konsultasisyariah.com/feed',
    organization: 'Yufid Network & Dewan Pembina Syariah',
    defaultAuthor: 'Ust. Ammi Nur Baits, S.T., B.A.',
    badgeColor: 'bg-teal-600/10 text-teal-700 dark:text-teal-300 border-teal-500/30',
    icon: 'help',
  },
  {
    id: 'almanhaj',
    name: 'Almanhaj.or.id',
    slug: 'almanhaj',
    websiteUrl: 'https://almanhaj.or.id',
    rssFeedUrl: 'https://almanhaj.or.id/feed',
    organization: 'Yayasan Lajnah Istiqomah Surakarta',
    defaultAuthor: 'Asatidzah Almanhaj',
    badgeColor: 'bg-indigo-600/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
    icon: 'library_books',
  },
];

export const ARTICLE_CATEGORIES = [
  { id: 'all', label: 'Semua Topik', icon: 'apps' },
  { id: 'aqidah', label: 'Aqidah & Tauhid', icon: 'verified' },
  { id: 'ibadah', label: 'Fiqih & Ibadah', icon: 'accessibility_new' },
  { id: 'akhlak', label: 'Akhlak & Hati', icon: 'favorite' },
  { id: 'muamalah', label: 'Muamalah & Fiqih', icon: 'payments' },
  { id: 'keluarga', label: 'Keluarga & Adab', icon: 'family_restroom' },
  { id: 'saved', label: 'Tersimpan', icon: 'bookmark' },
] as const;

export const INITIAL_ARTICLES: IslamicArticle[] = [
  {
    id: 'art-001',
    title: 'Keutamaan Mempelajari Ilmu Agama dan Mengikhlaskan Niat Karena Allah',
    slug: 'keutamaan-mempelajari-ilmu-agama-dan-mengikhlaskan-niat',
    summary:
      'Menuntut ilmu syar\'i adalah jalan pintas menuju surga. Namun amalan agung ini disyaratkan harus berlandaskan keikhlasan semata-mata mengharap wajah Allah Subhanahu wa Ta\'ala.',
    contentHtml: `
<p>Menuntut ilmu agama merupakan salah satu ibadah yang paling agung di dalam Islam. Bahkan, Allah <em>Subhanahu wa Ta'ala</em> memerintahkan Nabi-Nya ﷺ untuk senantiasa meminta tambahan ilmu dalam firman-Nya:</p>
<blockquote><p>وَقُلْ رَبِّ زِدْنِي عِلْمًا</p><p><em>"Dan katakanlah: 'Ya Rabbku, tambahkanlah kepadaku ilmu pengetahuan.'"</em> (QS. Thaha: 114)</p></blockquote>
<p>Rasulullah ﷺ juga mengabarkan bahwa barangsiapa yang menempuh suatu jalan demi mencari ilmu agama, Allah akan memudahkan baginya jalan menuju surga.</p>
<h3>Jalan Menuju Surga</h3>
<p>Dari Abu Hurairah <em>radhiyallahu 'anhu</em>, Rasulullah ﷺ bersabda:</p>
<blockquote><p>مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا سَهَّلَ اللَّهُ لَهُ بِهِ طَرِيقًا إِلَى الْجَنَّةِ</p><p><em>"Barangsiapa menempuh suatu jalan untuk mencari ilmu (agama), niscaya Allah akan memudahkan baginya jalan menuju surga."</em> (HR. Muslim no. 2699)</p></blockquote>
<p>Imam Ibnu Rajab Al-Hanbali <em>rahimahullah</em> menjelaskan bahwa menempuh jalan menuntut ilmu mencakup dua pengertian:</p>
<ol>
  <li><strong>Menempuh jalan secara hakiki:</strong> Yaitu melangkahkan kedua kaki menuju majelis-majelis ilmu di masjid atau halaqah para ulama.</li>
  <li><strong>Menempuh jalan secara maknawi:</strong> Yaitu membaca kitab para ulama, mendengarkan rekaman kajian ilmiah, menghafal dalil, dan berusaha memahaminya.</li>
</ol>
<h3>Syarat Mutlak: Ikhlas Karena Allah</h3>
<p>Keutamaan besar ini tidak akan diraih kecuali oleh penuntut ilmu yang memurnikan niatnya. Menuntut ilmu bukanlah untuk mencari pujian manusia, berdebat kusir, atau meraih gelar duniawi. Sufyan Ats-Tsauri <em>rahimahullah</em> berkata: <em>"Tidaklah aku mengobati sesuatu yang lebih berat daripada niatku, karena niat itu senantiasa berbolak-balik."</em></p>
<p>Semoga Allah mengaruniakan kepada kita ilmu yang bermanfaat, rezeki yang halal lagi baik, serta amal ibadah yang diterima di sisi-Nya.</p>
    `.trim(),
    canonicalUrl: 'https://muslim.or.id/29845-keutamaan-menuntut-ilmu-agama.html',
    sourceId: 'muslim-or-id',
    sourceName: 'Muslim.or.id',
    sourceUrl: 'https://muslim.or.id',
    authorName: 'Ust. dr. Raehanul Bahraen, M.Sc., Sp.PK.',
    category: 'aqidah',
    tags: ['Ilmu Syar\'i', 'Keikhlasan', 'Niat', 'Tazkiyatun Nufus'],
    imageUrl: 'https://images.unsplash.com/photo-1584286595398-a59f21d313f5?auto=format&fit=crop&w=800&q=80',
    publishedAt: '2026-10-25T08:30:00Z',
    readTimeMinutes: 4,
    isFeatured: true,
  },
  {
    id: 'art-002',
    title: 'Kiat-Kiat Menggapai Sholat Khusyuk Sesuai Sunnah Rasulullah ﷺ',
    slug: 'kiat-kiat-menggapai-sholat-khusyuk-sesuai-sunnah',
    summary:
      'Sholat adalah penyejuk hati orang-orang beriman. Temukan kiat praktis agar hati hadir, thuma\'ninah terjaga, dan godaan setan was-was dalam sholat dapat ditumpas.',
    contentHtml: `
<p>Khusyuk di dalam sholat adalah ruh dari ibadah sholat itu sendiri. Sholat tanpa kekhusyukan ibarat jasad tanpa ruh. Allah <em>Subhanahu wa Ta'ala</em> berfirman:</p>
<blockquote><p>قَدْ أَفْلَحَ الْمُؤْمِنُونَ الَّذِينَ هُمْ فِي صَلَاتِهِمْ خَاشِعُونَ</p><p><em>"Sesungguhnya beruntunglah orang-orang yang beriman, (yaitu) orang-orang yang khusyuk dalam sholatnya."</em> (QS. Al-Mukminun: 1-2)</p></blockquote>
<h3>1. Menyempurnakan Wudhu dan Datang Sebelum Sholat Dimulai</h3>
<p>Persiapan khusyuk dimulai sejak berwudhu. Rasulullah ﷺ bersabda bahwa siapa saja yang berwudhu dengan membaguskannya, dosa-dosanya akan keluar hingga dari bawah kuku-kukunya. Datang ke masjid sebelum iqamah dikumandangkan memberi ruang bagi hati untuk tenang dari hiruk pikuk urusan dunia.</p>
<h3>2. Menjaga Thuma'ninah di Setiap Rukun</h3>
<p>Nabi ﷺ pernah menegur seseorang yang sholat terburu-buru hingga tiga kali dengan sabdanya: <em>"Kembalilah dan sholatlah, karena sesungguhnya engkau belum sholat."</em> Thuma'ninah adalah diam sejenak hingga setiap persendian kembali mapan pada posisinya.</p>
<h3>3. Memahami Makna Bacaan yang Dilafadzkan</h3>
<p>Merenungi makna Surah Al-Fatihah, tasbih ruku', dan doa sujud adalah kunci utama membendung godaan pikiran ke mana-mana. Tatkala membaca <em>Iyyaka na'budu wa iyyaka nasta'iin</em>, hadirkan dalam hati kepasrahan total kepada Allah Ta'ala.</p>
<h3>4. Mengatasi Gangguan Setan Khinzab</h3>
<p>Jika merasakan bisikan was-was yang mengacaukan bacaan rakaat sholat, sunnahnya adalah meludah tipis (meniup sedikit) ke arah kiri sebanyak tiga kali dan membaca: <em>A'udzu billahi minasy syaithanir rajim</em> sebagaimana diajarkan Nabi ﷺ kepada Utsman bin Abil 'Ash <em>radhiyallahu 'anhu</em>.</p>
    `.trim(),
    canonicalUrl: 'https://rumaysho.com/15234-kiat-menggapai-sholat-khusyuk.html',
    sourceId: 'rumaysho',
    sourceName: 'Rumaysho.com',
    sourceUrl: 'https://rumaysho.com',
    authorName: 'Ust. Muhammad Abduh Tuasikal, M.Sc.',
    category: 'ibadah',
    tags: ['Sholat Khusyuk', 'Thuma\'ninah', 'Fiqih Ibadah', 'Sunnah'],
    imageUrl: 'https://images.unsplash.com/photo-1564769625905-50e93615e769?auto=format&fit=crop&w=800&q=80',
    publishedAt: '2026-10-24T14:15:00Z',
    readTimeMinutes: 5,
    isFeatured: true,
  },
  {
    id: 'art-003',
    title: 'Hukum Jual Beli Online dan Dropshipping Menurut Tuntunan Syariat',
    slug: 'hukum-jual-beli-online-dan-dropshipping-menurut-syariat',
    summary:
      'Transaksi muamalah digital semakin pesat. Bagaimana status kehalalan sistem dropshipping dan syarat sah serah terima (qabdh) dalam perniagaan Islam modern?',
    contentHtml: `
<p>Islam adalah agama yang sempurna dan mencakup segala aspek kehidupan manusia, termasuk aktivitas perniagaan dan muamalah kontemporer. Kaidah fiqih menetapkan:</p>
<blockquote><p>الأَصْلُ فِي الْمُعَامَلاَتِ الإِبَاحَةُ حَتَّى يَدُلَّ الدَّلِيلُ عَلَى التَّحْرِيمِ</p><p><em>"Hukum asal dalam muamalah adalah boleh (halal) hingga ada dalil yang menunjukkan keharamannya."</em></p></blockquote>
<h3>Larangan Menjual Barang yang Belum Dimiliki</h3>
<p>Salah satu rambu pokok dalam jual beli Islam adalah sabda Rasulullah ﷺ kepada Hakim bin Hizam <em>radhiyallahu 'anhu</em>:</p>
<blockquote><p>لاَ تَبِعْ مَا لَيْسَ عِنْدَكَ</p><p><em>"Janganlah engkau menjual barang yang belum engkau miliki!"</em> (HR. Abu Dawud no. 3503 & At-Tirmidzi no. 1232, Shahih)</p></blockquote>
<h3>Solusi Syar'i untuk Skema Dropshipping</h3>
<p>Bagi pelaku usaha online yang ingin menjalankan skema dropshipping agar terhindar dari riba dan transaksi batil, terdapat 2 opsi solusi yang sesuai syariat:</p>
<ol>
  <li><strong>Menjadi Agen Resmi / Wakalah bil Ujrah:</strong> Pelaku dropship bertindak sebagai wakil penjual utama (supplier) dengan imbalan komisi (ujrah) yang jelas atas setiap produk yang berhasil terjual.</li>
  <li><strong>Akad Salam (Pemesanan di Awal):</strong> Pembeli memesan barang dengan spesifikasi yang sangat jelas, membayarkan uang secara tunai di muka, dan penjual dropshipper berjanji mengirimkan barang tersebut pada waktu yang telah disepakati bersama.</li>
</ol>
<p>Dengan menerapkan prinsip transparansi dan amanah, perniagaan tidak hanya mendatangkan keuntungan finansial, melainkan juga keberkahan di dunia dan akhirat.</p>
    `.trim(),
    canonicalUrl: 'https://konsultasisyariah.com/34821-hukum-dropshipping-online.html',
    sourceId: 'konsultasi-syariah',
    sourceName: 'KonsultasiSyariah.com',
    sourceUrl: 'https://konsultasisyariah.com',
    authorName: 'Ust. Ammi Nur Baits, S.T., B.A.',
    category: 'muamalah',
    tags: ['Muamalah', 'Jual Beli', 'Dropship', 'Halal Haram'],
    imageUrl: 'https://images.unsplash.com/photo-1556742049-0a67c5574f73?auto=format&fit=crop&w=800&q=80',
    publishedAt: '2026-10-23T10:00:00Z',
    readTimeMinutes: 4,
    isFeatured: false,
  },
  {
    id: 'art-004',
    title: 'Menjaga Lisan dan Bahaya Ghibah di Era Media Sosial',
    slug: 'menjaga-lisan-dan-bahaya-ghibah-di-era-media-sosial',
    summary:
      'Ghibah dan fitnah kini tidak hanya terucap lewat bibir, tetapi juga tertulis melalui jemari di grup percakapan dan kolom komentar media sosial. Simak batasan syar\'inya.',
    contentHtml: `
<p>Lisan dan jari-jemari adalah nikmat agung dari Allah yang akan dimintai pertanggungjawaban di hadapan Mahkamah Ilahi kelak. Allah <em>Ta'ala</em> mengingatkan:</p>
<blockquote><p>مَا يَلْفِظُ مِنْ قَوْلٍ إِلَّا لَدَيْهِ رَقِيبٌ عَتِيدٌ</p><p><em>"Tiada suatu ucapan pun yang diucapkannya melainkan ada di dekatnya malaikat pengawas yang selalu hadir."</em> (QS. Qaf: 18)</p></blockquote>
<h3>Definisi Hakiki Ghibah</h3>
<p>Rasulullah ﷺ mendefinisikan ghibah secara gamblang dalam hadits Abu Hurairah <em>radhiyallahu 'anhu</em>:</p>
<blockquote><p>ذِكْرُكَ أَخَاكَ بِمَا يَكْرَهُ</p><p><em>"Engkau membicarakan saudaramu mengenai hal yang tidak ia sukai."</em> Sahabat bertanya: 'Bagaimana jika yang aku katakan itu benar ada padanya?' Beliau ﷺ menjawab: <em>'Jika apa yang engkau katakan itu benar ada padanya, maka engkau telah mengghibahinya. Dan jika tidak benar, engkau telah memfitnahnya (buhtan).'</em> (HR. Muslim no. 2589)</p></blockquote>
<h3>Ghibah Digital di Zaman Sekarang</h3>
<p>Ketikkan komentar di media sosial, sindiran halus di status WhatsApp, atau membicarakan aib sesama muslim di grup keluarga dan pertemanan hakikatnya bernilai sama dengan perkataan lisan. Orang yang paling cerdas adalah yang menyibukkan diri mengoreksi aibnya sendiri daripada sibuk menyebarkan cela orang lain.</p>
    `.trim(),
    canonicalUrl: 'https://almanhaj.or.id/11290-menjaga-lisan-dari-ghibah.html',
    sourceId: 'almanhaj',
    sourceName: 'Almanhaj.or.id',
    sourceUrl: 'https://almanhaj.or.id',
    authorName: 'Ust. Yazid bin Abdul Qadir Jawas rahimahullah',
    category: 'akhlak',
    tags: ['Tazkiyatun Nufus', 'Akhlak', 'Menjaga Lisan', 'Ghibah'],
    imageUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80',
    publishedAt: '2026-10-22T06:20:00Z',
    readTimeMinutes: 4,
    isFeatured: true,
  },
  {
    id: 'art-005',
    title: 'Adab Berbakti Kepada Kedua Orang Tua yang Masih Hidup Maupun Telah Wafat',
    slug: 'adab-berbakti-kepada-kedua-orang-tua',
    summary:
      'Birrul walidain adalah amalan paling dicintai Allah setelah sholat tepat pada waktunya. Pelajari adab memperlakukan orang tua dengan penuh rahmah.',
    contentHtml: `
<p>Hak kedua orang tua di dalam Islam begitu tinggi hingga Allah <em>Subhanahu wa Ta'ala</em> menggandengkan perintah mentauhidkan-Nya dengan perintah berbakti kepada orang tua:</p>
<blockquote><p>وَقَضَىٰ رَبُّكَ أَلَّا تَعْبُدُوا إِلَّا إِيَّاهُ وَبِالْوَالِدَيْنِ إِحْسَانًا</p><p><em>"Dan Rabbmu telah memerintahkan agar kamu jangan menyembah selain Dia dan hendaklah berbuat baik kepada ibu bapak."</em> (QS. Al-Isra': 23)</p></blockquote>
<h3>Bentuk Bakti Saat Orang Tua Masih Hidup</h3>
<ul>
  <li>Menaati perintah mereka selama bukan dalam kemaksiatan kepada Allah.</li>
  <li>Berbicara dengan tutur kata yang lemah lembut, penuh adab, dan merendahkan diri dengan penuh kasih sayang.</li>
  <li>Memberikan nafkah dan memenuhi kebutuhan sehari-hari mereka dengan sukarela.</li>
  <li>Meminta doa dan restu dari mereka dalam urusan-urusan besar kehidupan.</li>
</ul>
<h3>Cara Berbakti Setelah Mereka Wafat</h3>
<p>Tatkala seorang sahabat bertanya kepada Rasulullah ﷺ apakah masih ada bakti yang bisa dipersembahkan setelah orang tua wafat, Nabi ﷺ menjawab:</p>
<blockquote><p><em>"Ya, mendoakan keduanya, memohonkan ampunan bagi keduanya, menunaikan janji/wasiat mereka setelah mereka tiada, menyambung silaturahim yang tidak terhubung kecuali melalui mereka, serta memuliakan sahabat-sahabat karib keduanya."</em> (HR. Abu Dawud no. 5142, Shahih)</p></blockquote>
    `.trim(),
    canonicalUrl: 'https://muslim.or.id/41203-berbakti-kepada-orang-tua.html',
    sourceId: 'muslim-or-id',
    sourceName: 'Muslim.or.id',
    sourceUrl: 'https://muslim.or.id',
    authorName: 'Ust. Dr. Firanda Andirja, M.A.',
    category: 'keluarga',
    tags: ['Birrul Walidain', 'Adab', 'Keluarga', 'Amalan Shalih'],
    imageUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=800&q=80',
    publishedAt: '2026-10-21T09:40:00Z',
    readTimeMinutes: 4,
    isFeatured: false,
  },
  {
    id: 'art-006',
    title: 'Keajaiban Doa Sapu Jagad dan Makna Permohonan Kebaikan Dunia Akhirat',
    slug: 'keajaiban-doa-sapu-jagad-dan-maknanya',
    summary:
      'Doa yang paling sering dipanjatkan oleh Nabi Muhammad ﷺ mencakup segala kebaikan urusan dunia, kelapangan akhirat, dan perlindungan dari siksa neraka.',
    contentHtml: `
<p>Di antara jutaan doa yang diajarkan dalam syariat, terdapat satu doa singkat yang paling sering dibaca oleh Rasulullah ﷺ dalam berbagai kesempatan:</p>
<blockquote><p>رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ</p><p><em>"Rabbana aatina fid-dunya hasanah, wa fil-aakhirati hasanah, wa qinaa 'adzaaban-naar."</em></p><p>(Wahai Rabb kami, berilah kami kebaikan di dunia dan kebaikan di akhirat, dan lindungilah kami dari siksa neraka.) (QS. Al-Baqarah: 201)</p></blockquote>
<h3>Makna Kebaikan Dunia (Hasanah fid-Dunya)</h3>
<p>Al-Hasan Al-Bashri <em>rahimahullah</em> menafsirkan kebaikan di dunia mencakup: ilmu agama yang bermanfaat, rizki yang halal lagi berkah, istri/suami yang shalih, keturunan yang menyejukkan pandangan, serta kesehatan badan dalam ketaatan.</p>
<h3>Makna Kebaikan Akhirat (Hasanah fil-Aakhirah)</h3>
<p>Sedangkan kebaikan di akhirat adalah puncak kenikmatan: diringankannya hisab dan mizan, kemudahan menyeberangi shirath, keselamatan dari dahsyatnya hari kiamat, dimasukkan ke dalam Surga Firdaus, serta kenikmatan terbesar yaitu memandang wajah Allah Yang Maha Mulia.</p>
    `.trim(),
    canonicalUrl: 'https://rumaysho.com/21092-rahasia-doa-sapu-jagad.html',
    sourceId: 'rumaysho',
    sourceName: 'Rumaysho.com',
    sourceUrl: 'https://rumaysho.com',
    authorName: 'Ust. Muhammad Abduh Tuasikal, M.Sc.',
    category: 'ibadah',
    tags: ['Doa', 'Hisnul Muslim', 'Tafsir', 'Dzikir'],
    imageUrl: 'https://images.unsplash.com/photo-1507692049790-de58290a4334?auto=format&fit=crop&w=800&q=80',
    publishedAt: '2026-10-20T12:00:00Z',
    readTimeMinutes: 3,
    isFeatured: false,
  },
];
